/**
 * NeXus Radar Scan — START
 * 
 * Startet einen chunked Lead-Radar-Scan.
 * 1. Prüft auf existierenden laufenden Job (Duplikatschutz)
 * 2. Keyless-Multisource-Suche: Bing News RSS + DuckDuckGo (Web/PR/Jobbörsen/PR-Portale)
 *    + synthetische URLs (StepStone/XING/LinkedIn Jobs, NorthData-Firmensuche),
 *    mischt und dedupliziert Kandidaten
 * 3. Legt nexus_scan_jobs-Eintrag an
 * 4. Gibt sofort { job_id, total_steps } zurück (<5s)
 *
 * Tavily ist bewusst entfernt (Keys geblockt: 402/432) — wird bei Bedarf wieder ergänzt.
 */

import { createClient } from '@supabase/supabase-js';
import { searchDuckDuckGo as coreSearchDuckDuckGo } from './_shared/search-core.mjs';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_KEY;

// Hintergrund-Queue anstossen (Phase 3, Radar-Queue): Der Worker faehrt den
// Job serverseitig zu Ende, auch wenn kein Frontend-Tab offen ist.
// Background-Function antwortet sofort mit 202. Ein Fehlschlag ist unkritisch —
// das Frontend-Polling auf nexus-radar-scan-step bleibt als Fallback-Treiber.
// Ohne process.env.URL (lokale Dev-Umgebung) wird nicht ausgeloest.
async function triggerScanQueue(jobId) {
  const base = process.env.URL;
  const secret = process.env.RADAR_QUEUE_SECRET || process.env.SUPABASE_SERVICE_KEY;
  if (!base || !secret) {
    console.warn('[ScanStart] Kein URL/Queue-Secret in der Env — Queue-Trigger uebersprungen (Polling-Fallback).');
    return false;
  }
  try {
    const res = await fetch(`${base}/.netlify/functions/nexus-radar-scan-queue`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-queue-secret': secret },
      body: JSON.stringify({ job_id: jobId }),
      signal: AbortSignal.timeout(4000)
    });
    if (res.ok) {
      console.log(`[ScanStart] Queue-Worker fuer Job ${jobId} angestossen (HTTP ${res.status}).`);
      return true;
    }
    console.warn(`[ScanStart] Queue-Trigger fehlgeschlagen (HTTP ${res.status}) — Frontend-Polling uebernimmt.`);
  } catch (e) {
    console.warn('[ScanStart] Queue-Trigger Fehler:', e.message, '— Frontend-Polling uebernimmt.');
  }
  return false;
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 8000) {
  const controller = new AbortController();
  const abortId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(abortId);
    return res;
  } catch (e) {
    clearTimeout(abortId);
    throw e;
  }
}

function decodeEntities(s) {
  return s
    .replace(/<!\[CDATA\[|\]\]>/g, '')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

// Bing News RSS (keyless) -> echte Unternehmens-News mit Original-Links, max. 14 Tage alt
async function searchBingNews(query, maxResults = 10, timeoutMs = 3000) {
  try {
    const res = await fetchWithTimeout(
      `https://www.bing.com/news/search?q=${encodeURIComponent(query)}&format=rss&count=${maxResults * 2}`,
      { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' } },
      timeoutMs
    );
    if (!res.ok) return [];
    const xml = await res.text();
    const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)];
    const cutoff = Date.now() - 14 * 24 * 3600 * 1000;
    const out = [];
    for (const it of items) {
      const b = it[1];
      const title = decodeEntities(((b.match(/<title>([\s\S]*?)<\/title>/) || [])[1] || '')).trim();
      const link = decodeEntities(((b.match(/<link>([\s\S]*?)<\/link>/) || [])[1] || '')).trim();
      const pub = (b.match(/<pubDate>([\s\S]*?)<\/pubDate>/) || [])[1] || '';
      const ts = pub ? Date.parse(pub) : NaN;
      if (!Number.isNaN(ts) && ts < cutoff) continue;
      // Bing-Redirect: Original-URL im url-Param
      let url = link;
      try { const u = new URL(link); const real = u.searchParams.get('url'); if (real) url = real; } catch { /* keep */ }
      if (!url.startsWith('http') || !title) continue;
      if (!out.some(r => r.url === url)) out.push({ url, title });
      if (out.length >= maxResults) break;
    }
    return out;
  } catch (e) {
    return [];
  }
}

// DDG via _shared/search-core.mjs (Chrome-UA statt generischem Bot-UA).
// Shape bleibt { url, title } — Consumer speichern nur diese beiden Felder.
async function searchDuckDuckGo(query, maxResults = 10, timeoutMs = 4000) {
  const results = await coreSearchDuckDuckGo(query, { maxResults, timeoutMs });
  return results.map(r => ({ url: r.url, title: r.title }));
}

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type, Authorization' } };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const { offering_id, query, branche } = JSON.parse(event.body || '{}');

    // Auth check
    const authHeader = event.headers.authorization;
    if (!authHeader) return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };

    const userSupabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } }
    });
    const { data: { user }, error: authError } = await userSupabase.auth.getUser();
    if (authError || !user) return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };

    if (!offering_id) return { statusCode: 400, body: JSON.stringify({ error: 'offering_id required' }) };

    // Erst: ALLE alten Jobs für diesen User aufräumen (nicht nur dieses Offering)
    const allRunningRes = await userSupabase
      .from('nexus_scan_jobs')
      .select('id, created_at')
      .eq('user_id', user.id)
      .eq('status', 'running');

    if (allRunningRes.data && allRunningRes.data.length > 0) {
      const now = Date.now();
      const staleIds = allRunningRes.data
        .filter(j => now - new Date(j.created_at).getTime() > 2 * 60 * 1000)
        .map(j => j.id);
      if (staleIds.length > 0) {
        console.log(`[ScanStart] Cleaning ${staleIds.length} stale running jobs`);
        await userSupabase.from('nexus_scan_jobs').delete().in('id', staleIds);
      }
      // Wenn noch ein fresh <2min Job existiert → blockieren
      const freshRunning = allRunningRes.data.filter(j => !staleIds.includes(j.id));
      if (freshRunning.length > 0) {
        // Queue erneut anstossen: heilt Jobs, deren Worker gestorben ist
        await triggerScanQueue(freshRunning[0].id);
        return {
          statusCode: 200,
          body: JSON.stringify({
            job_id: freshRunning[0].id,
            status: 'already_running',
            message: 'Ein Scan läuft bereits.'
          })
        };
      }
    }

    const searchQuery = query || `${branche || ''} B2B Unternehmen Expansion`.trim();

    // Kernwort aus der Branche ableiten (lange Phrasen liefern kaum Treffer)
    const STOP = new Set(['im', 'in', 'der', 'die', 'das', 'und', 'für', 'fuer', 'mit', 'von', 'aus', 'am', 'an', 'zu', 'den', 'des', 'dem', 'bereich', 'branche', 'unternehmen', 'firmen', 'kunden']);
    const words = (branche || '').split(/[,\s;-]+/).map(w => w.trim()).filter(w => w.length > 2 && !STOP.has(w.toLowerCase()));
    const kw = words[0] || (searchQuery.trim().split(/\s+/)[0] || '');
    const kwOk = kw.trim().length > 2;
    console.log(`[ScanStart] Query: "${searchQuery}" | kw="${kw}"`);

    // Alle keyless-Quellen PARALLEL: Bing News (14d frisch) + DuckDuckGo (Web/PR/Jobs)
    const newsQueries = kwOk
      ? [...new Set([kw, `${kw} expandiert`, `${kw} stellt ein`])].slice(0, 3)
      : [searchQuery];
    const ddgQueries = [
      { q: searchQuery, type: 'GENERAL_WEB' },
      { q: `${branche || searchQuery} Pressemitteilung`, type: 'GENERAL_WEB' },
      ...(kwOk ? [{ q: `${kw} Stellenangebote`, type: 'JOB_PORTAL' }] : []),
      ...(kwOk ? [{ q: `${kw} site:openpr.de OR site:presseportal.de`, type: 'NEWS' }] : [])
    ];

    const [newsSets, ddgSets] = await Promise.all([
      Promise.allSettled(newsQueries.map(q => searchBingNews(q, 8))),
      // DDG leicht versetzt abfragen (429-Rate-Limit bei parallelen Anfragen)
      Promise.allSettled(ddgQueries.map((d, i) => (async () => {
        if (i > 0) await new Promise(r => setTimeout(r, i * 350));
        return searchDuckDuckGo(d.q, 8);
      })()))
    ]);

    const newsResults = [];
    const newsSeen = new Set();
    for (const s of newsSets) {
      if (s.status !== 'fulfilled') continue;
      for (const r of s.value) {
        if (!newsSeen.has(r.url)) { newsSeen.add(r.url); newsResults.push(r); }
      }
    }

    const webResults = [];
    const webSeen = new Set();
    ddgSets.forEach((s, i) => {
      if (s.status !== 'fulfilled') return;
      for (const r of s.value) {
        if (!webSeen.has(r.url)) {
          webSeen.add(r.url);
          webResults.push({ ...r, source_type: ddgQueries[i].type });
        }
      }
    });

    // Synthetische URLs (öffentlich crawelbar: StepStone 24k, XING 7.6k, LinkedIn 10.8k, NorthData 11k Text)
    const syntheticUrls = kwOk ? [
      { url: `https://www.stepstone.de/jobs/${encodeURIComponent(kw)}`, title: `StepStone Stellenangebote: ${kw}`, source_type: 'JOB_PORTAL' },
      { url: `https://www.xing.com/jobs/search?keywords=${encodeURIComponent(kw)}`, title: `XING Jobs: ${kw}`, source_type: 'JOB_PORTAL' },
      { url: `https://www.linkedin.com/jobs/search?keywords=${encodeURIComponent(kw)}&location=Germany`, title: `LinkedIn Jobs: ${kw}`, source_type: 'JOB_PORTAL' },
      { url: `https://www.northdata.de/suche?q=${encodeURIComponent(kw)}`, title: `NorthData Firmensuche: ${kw}`, source_type: 'REGISTER' }
    ] : [];

    // Mischung: News (M&A/Expansion) -> synthetische (Jobs/Register) -> Web/PR, max. 22 Kandidaten
    const allResults = [
      ...newsResults.slice(0, 10).map(r => ({ ...r, source_type: 'NEWS' })),
      ...syntheticUrls,
      ...webResults.slice(0, 8)
    ];
    console.log(`[ScanStart] Sources: NEWS=${newsResults.length} SYNTH=${syntheticUrls.length} WEB=${webResults.length}`);

    // Dedupliziere URLs (erste Quelle gewinnt)
    const seenUrls = new Set();
    const uniqueResults = [];
    for (const r of allResults) {
      if (r.url && !seenUrls.has(r.url)) {
        seenUrls.add(r.url);
        uniqueResults.push(r);
      }
    }

    if (uniqueResults.length === 0) {
      return {
        statusCode: 200,
        body: JSON.stringify({
          job_id: null,
          status: 'no_results',
          message: 'Keine Kandidaten-URLs gefunden.'
        })
      };
    }

    // Erstelle Scan-Job
    const jobRes = await userSupabase
      .from('nexus_scan_jobs')
      .insert({
        user_id: user.id,
        offering_id,
        status: 'running',
        current_step: 0,
        total_steps: uniqueResults.length,
        pending_urls: uniqueResults.map(r => ({ url: r.url, title: r.title || '', source_type: r.source_type || 'NEWS' })),
        partial_results: [],
        last_message: `Suche gestartet: ${uniqueResults.length} Kandidaten gefunden...`,
        updated_at: new Date().toISOString()
      })
      .select('id')
      .single();

    if (jobRes.error) {
      console.error('[ScanStart] DB insert error:', JSON.stringify(jobRes.error));
      return { statusCode: 500, body: JSON.stringify({ error: `Job konnte nicht erstellt werden: ${jobRes.error.message || jobRes.error.code || 'Unknown'}` }) };
    }

    const newJobId = jobRes.data?.id;
    if (!newJobId) {
      console.error('[ScanStart] No job id returned:', JSON.stringify(jobRes.data));
      return { statusCode: 500, body: JSON.stringify({ error: 'Job-ID fehlt nach dem Anlegen.' }) };
    }

    console.log(`[ScanStart] Job ${newJobId} created: ${uniqueResults.length} URLs`);

    await triggerScanQueue(newJobId);

    return {
      statusCode: 200,
      body: JSON.stringify({
        job_id: newJobId,
        status: 'started',
        total_steps: uniqueResults.length,
        message: `Scan gestartet: ${uniqueResults.length} Kandidaten werden geprüft.`
      })
    };

  } catch (e) {
    console.error('[ScanStart] Error:', e);
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};
