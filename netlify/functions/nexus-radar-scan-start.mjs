/**
 * NeXus Radar Scan — START
 * 
 * Startet einen chunked Lead-Radar-Scan.
 * 1. Prüft auf existierenden laufenden Job (Duplikatschutz)
 * 2. Führt Tavily-Suche aus, sammelt Kandidaten-URLs
 * 3. Legt nexus_scan_jobs-Eintrag an
 * 4. Gibt sofort { job_id, total_steps } zurück (<2s)
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_KEY;

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

async function searchTavilyParallel(query, apiKey, maxResults = 10) {
  const B2B_NEWS_DOMAINS = [
    'pressebox.de', 'openpr.de', 'it-business.de', 'crn.de', 'handelsblatt.com',
    'wiwo.de', 'unternehmensboerse.de', 'northdata.de', 'bundesanzeiger.de',
    'heise.de', 'golem.de', 'computerwoche.de'
  ];

  const JOB_PORTAL_DOMAINS = [
    'linkedin.com', 'indeed.com', 'stepstone.de', 'glassdoor.de',
    'xing.com', 'kununu.com', 'absolventa.de'
  ];

  async function tavilySearch(q, domains, topic) {
    try {
      const body = {
        api_key: apiKey,
        query: q,
        search_depth: 'advanced',
        include_answer: false,
        max_results: maxResults
      };
      if (domains) body.include_domains = domains;
      if (topic) body.topic = topic;

      const res = await fetchWithTimeout('https://api.tavily.com/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      }, 5000);

      if (res.ok) {
        const data = await res.json();
        return data.results || [];
      }
    } catch (e) { /* continue */ }
    return [];
  }

  // Alle drei Suchen parallel ausführen
  const [newsResults, jobResults, generalResults] = await Promise.allSettled([
    tavilySearch(query, B2B_NEWS_DOMAINS),
    tavilySearch(`${query} jobs hiring einstellen`, JOB_PORTAL_DOMAINS),
    tavilySearch(`${query} 2026`, null, 'general')
  ]);

  const news = newsResults.status === 'fulfilled' ? newsResults.value : [];
  const jobs = jobResults.status === 'fulfilled' ? jobResults.value : [];
  const general = generalResults.status === 'fulfilled' ? generalResults.value : [];

  // source_type taggen
  const taggedNews = news.map(r => ({ ...r, source_type: 'NEWS' }));
  const taggedJobs = jobs.map(r => ({ ...r, source_type: 'JOB_PORTAL' }));
  const taggedGeneral = general.map(r => ({ ...r, source_type: 'GENERAL_WEB' }));

  // Kombinieren, Duplikate anhand URL entfernen (erste Quelle gewinnt)
  const seen = new Set();
  const combined = [];
  for (const r of [...taggedNews, ...taggedJobs, ...taggedGeneral]) {
    if (r.url && !seen.has(r.url)) {
      seen.add(r.url);
      combined.push(r);
    }
  }

  console.log(`[searchTavilyParallel] query="${query.substring(0,60)}" NEWS=${news.length} JOB_PORTAL=${jobs.length} GENERAL_WEB=${general.length} COMBINED=${combined.length}`);

  return combined;
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

    // Tavily-Suche
    const tavilyKeys = [
      process.env.TAVILY_API_KEY,
      process.env.TAVILY_API_KEY_2,
      process.env.VITE_TAVILY_API_KEY
    ].filter(Boolean);

    if (tavilyKeys.length === 0) {
      return { statusCode: 500, body: JSON.stringify({ error: 'No Tavily API keys configured' }) };
    }

    const searchQuery = query || `${branche || ''} B2B Unternehmen Expansion`.trim();
    console.log(`[ScanStart] Query: "${searchQuery}" | Keys: ${tavilyKeys.length}`);
    let allResults = [];

    for (const key of tavilyKeys) {
      if (allResults.length > 0) break;
      allResults = await searchTavilyParallel(searchQuery, key, 10);
      console.log(`[ScanStart] Key ${key.substring(0,8)}... returned ${allResults.length} results`);
    }

    // Dedupliziere URLs (bereits in searchTavilyParallel erledigt, aber zur Sicherheit)
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
        last_message: `Suche gestartet: ${uniqueResults.length} Kandidaten gefunden...`
      })
      .select('id')
      .single();

    if (jobRes.error) {
      console.error('[ScanStart] DB insert error:', jobRes.error);
      return { statusCode: 500, body: JSON.stringify({ error: 'Job konnte nicht erstellt werden' }) };
    }

    console.log(`[ScanStart] Job ${jobRes.id} created: ${uniqueResults.length} URLs`);

    return {
      statusCode: 200,
      body: JSON.stringify({
        job_id: jobRes.id,
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
