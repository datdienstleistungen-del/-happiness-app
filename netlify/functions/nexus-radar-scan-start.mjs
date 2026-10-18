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
 * Kostenlose DACH-Recherche: Bing News RSS (de-DE, de-AT, de-CH) + DuckDuckGo + Brave Search API.
 * Tavily ist vollständig aus dem Standardbetrieb entfernt.
 */

import { createServerClient as createClient } from './_shared/supabase-client.mjs';
import {
  searchDuckDuckGo as coreSearchDuckDuckGo,
  searchBrave,
  searchBingNewsRss
} from './_shared/search-core.mjs';
import { isBlockedUrl } from './_shared/url-rules.mjs';
import { buildDachScanQueries, simplifyForBingNews } from './_shared/query-builder.mjs';

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
    const res = await fetch(`${base}/.netlify/functions/nexus-radar-scan-queue-background`, {
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

// Bing News RSS (kostenlos, keyless) für DACH-Märkte (de-DE, de-AT, de-CH)
async function searchBingNews(query, maxResults = 10, timeoutMs = 4000) {
  const hits = await searchBingNewsRss(query, {
    maxResults,
    markets: ['de-DE', 'de-AT', 'de-CH'],
    cutoffDays: 3,
    timeoutMs
  });
  return hits.map(h => ({ url: h.url, title: h.title, published_date: h.published_date }));
}

// Web-Suche mit kostenlosen & konformen Quellen:
// 1. Brave Search API (falls serverseitig BRAVE_SEARCH_API_KEY konfiguriert ist)
// 2. DuckDuckGo HTML-Suche (kostenlos, keyless)
// 3. Bing News RSS Fallback für DACH-Märkte
async function searchWebWithFallback(query, maxResults = 8, timeoutMs = 5000) {
  // 1. Brave Search API (falls serverseitiger Key konfiguriert)
  try {
    const braveRes = await searchBrave(query, { maxResults, country: 'DE', timeoutMs: 5000 });
    if (braveRes.ok && braveRes.results.length > 0) {
      return braveRes.results.map(r => ({ url: r.url, title: r.title }));
    }
  } catch {}

  // 2. DuckDuckGo HTML-Suche versuchen
  try {
    const ddgResults = await coreSearchDuckDuckGo(query, { maxResults, timeoutMs: 3500 });
    if (ddgResults && ddgResults.length > 0) {
      return ddgResults.map(r => ({ url: r.url, title: r.title }));
    }
  } catch {}

  // 3. Bing News RSS Fallback für DACH-Märkte (de-DE, de-AT, de-CH)
  try {
    const cleanQ = simplifyForBingNews(query);
    if (cleanQ) {
      const bingResults = await searchBingNewsRss(cleanQ, {
        maxResults,
        markets: ['de-DE', 'de-AT', 'de-CH'],
        cutoffDays: 3,
        timeoutMs: 4000
      });
      if (bingResults && bingResults.length > 0) {
        return bingResults.map(r => ({ url: r.url, title: r.title }));
      }
    }
  } catch {}

  return [];
}

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type, Authorization' } };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const { offering_id, query, branche, force_refresh = false } = JSON.parse(event.body || '{}');

    // Auth check
    const authHeader = event.headers.authorization;
    if (!authHeader) return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };

    const userSupabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } }
    });
    const { data: { user }, error: authError } = await userSupabase.auth.getUser();
    if (authError || !user) return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };

    if (!offering_id) return { statusCode: 400, body: JSON.stringify({ error: 'offering_id required' }) };

    const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || 'harro@happiness.de,hgoerndt@gmail.com,datdienstleistungen@gmail.com,nexustest-e2e@example.com')
      .split(',')
      .map(e => e.trim().toLowerCase());
    const userEmail = (user.email || '').trim().toLowerCase();
    const isAdmin = Boolean(userEmail && ADMIN_EMAILS.includes(userEmail));

    // 1. RATE LIMITING: Admin unbegrenzt, reguläres Limit auf 1000 Scans pro Tag erhöht
    const MAX_SCANS_PER_DAY = 1000;
    if (!isAdmin) {
      const todayStart = new Date();
      todayStart.setUTCHours(0, 0, 0, 0);
      const todayIso = todayStart.toISOString();

      const todayScansRes = await userSupabase
        .from('nexus_scan_jobs')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .gte('created_at', todayIso);

      const todayScanCount = todayScansRes.count || 0;
      if (todayScanCount >= MAX_SCANS_PER_DAY) {
        console.warn(`[ScanStart] User ${user.id} reached daily scan limit (${todayScanCount}/${MAX_SCANS_PER_DAY})`);
        return {
          statusCode: 429,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
          body: JSON.stringify({
            error: `Tageslimit erreicht: Du hast heute bereits ${todayScanCount} von maximal ${MAX_SCANS_PER_DAY} Scans gestartet. Bitte warte bis morgen oder nutze bestehende Ergebnisse.`
          })
        };
      }
    }

    // 2. 24h-SCAN-CACHING: Gleiche Angebote innerhalb von 24h aus Cache bedienen (außer force_refresh)
    if (!force_refresh) {
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data: cachedJob } = await userSupabase
        .from('nexus_scan_jobs')
        .select('*')
        .eq('user_id', user.id)
        .eq('offering_id', offering_id)
        .eq('status', 'done')
        .gte('created_at', twentyFourHoursAgo)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      const hasActualTriggers = cachedJob && Array.isArray(cachedJob.partial_results) &&
        cachedJob.partial_results.some(r => Array.isArray(r.triggers) && r.triggers.length > 0);

      if (hasActualTriggers) {
        console.log(`[ScanStart] 24h-Cache Hit für Offering ${offering_id} (Job ${cachedJob.id}, ${cachedJob.partial_results.length} Treffer)`);
        return {
          statusCode: 200,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
          body: JSON.stringify({
            job_id: cachedJob.id,
            status: 'done',
            is_cached: true,
            total_steps: cachedJob.total_steps || cachedJob.partial_results.length,
            current_step: cachedJob.total_steps || cachedJob.partial_results.length,
            partial_results: cachedJob.partial_results,
            cached_at: cachedJob.created_at,
            message: `Ergebnisse aus dem 24h-Cache geladen (${cachedJob.partial_results.length} Treffer).`
          })
        };
      }
    }

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

    // Offering-Daten und vorhandene nexus_signal_strategies laden (Phase 2A)
    const { data: offering } = await userSupabase
      .from('nexus_offerings')
      .select('id, offering_name, target_audience, positioning, ai_understanding')
      .eq('id', offering_id)
      .maybeSingle();

    const { data: signalStrategies } = await userSupabase
      .from('nexus_signal_strategies')
      .select('signal_category, trigger_name, search_queries, why_relevant')
      .eq('offering_id', offering_id);

    const { newsQueries, ddgQueries, strategySource } = buildDachScanQueries({
      offering,
      signalStrategies: signalStrategies || [],
      manualQuery: query,
      branche
    });

    console.log(`[ScanStart] Query-Strategie (${strategySource}): ${newsQueries.length} News-Queries, ${ddgQueries.length} Web-Queries`);

    const [newsSets, ddgSets] = await Promise.all([
      Promise.allSettled(newsQueries.map(q => searchBingNews(q, 8))),
      // Web-Suche leicht versetzt abfragen (429-Rate-Limit bei parallelen Anfragen)
      Promise.allSettled(ddgQueries.map((d, i) => (async () => {
        if (i > 0) await new Promise(r => setTimeout(r, i * 350));
        return searchWebWithFallback(d.q, 8);
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

    // Blocklist-Filter (Phase 5a): nur fuer Suchergebnisse — die synthetischen
    // URLs unten bleiben bewusst erhalten (NorthData ist gesetzte Register-Quelle).
    const newsKept = newsResults.filter(r => !isBlockedUrl(r.url));
    const webKept = webResults.filter(r => !isBlockedUrl(r.url, { allowJobPortals: r.source_type === 'JOB_PORTAL' || r.source_type === 'HIRING_GENERIC' || r.source_type === 'HIRING' }));
    const blockedCount = (newsResults.length - newsKept.length) + (webResults.length - webKept.length);
    if (blockedCount > 0) {
      console.log(`[ScanStart] ${blockedCount} Suchtreffer durch URL-Blocklist gefiltert.`);
    }

    // Synthetische URLs (nur barrierefreie Register-Quellen wie NorthData)
    const registerTerm = (offering?.target_audience || branche || query || 'Mittelstand')
      .split(/[/,\s;-]+/)
      .map(w => w.trim())
      .filter(w => w.length > 2 && w.toLowerCase() !== 'b2b')[0] || 'Mittelstand';
    const syntheticUrls = registerTerm ? [
      { url: `https://www.northdata.de/suche?q=${encodeURIComponent(registerTerm)}`, title: `NorthData Firmensuche: ${registerTerm}`, source_type: 'REGISTER' }
    ] : [];

    // Mischung: News (M&A/Expansion) -> Web/PR/Jobs (organische Karriereseiten) -> Register, max. 22 Kandidaten
    const allResults = [
      ...newsKept.slice(0, 10).map(r => ({ ...r, source_type: 'NEWS' })),
      ...webKept.slice(0, 12),
      ...syntheticUrls
    ];
    console.log(`[ScanStart] Sources: NEWS=${newsResults.length} WEB/JOBS=${webResults.length} SYNTH=${syntheticUrls.length}`);

    // DACH-Domain-Erkennung
    function isDachDomain(urlStr) {
      try {
        const host = new URL(urlStr).hostname.toLowerCase();
        if (host.endsWith('.de') || host.endsWith('.at') || host.endsWith('.ch')) return true;
        if (/\b(handelsblatt|wiwo|manager-magazin|presseportal|openpr|unternehmensregister|bundesanzeiger|northdata|xing|gtai)\b/.test(host)) return true;
        return false;
      } catch {
        return false;
      }
    }

    // Dedupliziere URLs (erste Quelle gewinnt)
    const seenUrls = new Set();
    const uniqueResults = [];
    for (const r of allResults) {
      if (r.url && !seenUrls.has(r.url)) {
        seenUrls.add(r.url);
        uniqueResults.push(r);
      }
    }

    // DACH-Fokus-Garantie: Mindestens 80 % der gescannten URLs müssen von DACH-Domains stammen
    const dachCandidates = uniqueResults.filter(r => isDachDomain(r.url));
    const nonDachCandidates = uniqueResults.filter(r => !isDachDomain(r.url));

    let finalCandidates = [];
    if (dachCandidates.length > 0) {
      // Maximal 20% Non-DACH beimischen, um mindestens 80% DACH-Quote zu garantieren
      const allowedNonDach = Math.floor(dachCandidates.length * 0.25);
      finalCandidates = [...dachCandidates, ...nonDachCandidates.slice(0, allowedNonDach)];
    } else {
      finalCandidates = uniqueResults;
    }

    if (finalCandidates.length === 0) {
      return {
        statusCode: 200,
        body: JSON.stringify({
          job_id: null,
          status: 'no_results',
          message: 'Keine Kandidaten-URLs gefunden.'
        })
      };
    }

    // Erstelle Scan-Job mit DACH-priorisierten Kandidaten
    const jobRes = await userSupabase
      .from('nexus_scan_jobs')
      .insert({
        user_id: user.id,
        offering_id,
        status: 'running',
        current_step: 0,
        total_steps: finalCandidates.length,
        pending_urls: finalCandidates.map(r => ({ url: r.url, title: r.title || '', source_type: r.source_type || 'NEWS' })),
        partial_results: [],
        last_message: `Suche gestartet: ${finalCandidates.length} Kandidaten (${dachCandidates.length} DACH-Quellen) gefunden...`,
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
