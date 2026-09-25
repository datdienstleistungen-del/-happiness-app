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

async function searchTavily(query, apiKey, maxResults = 10) {
  const B2B_NEWS_DOMAINS = [
    'pressebox.de', 'openpr.de', 'it-business.de', 'crn.de', 'handelsblatt.com',
    'wiwo.de', 'unternehmensboerse.de', 'northdata.de', 'bundesanzeiger.de',
    'heise.de', 'golem.de', 'computerwoche.de'
  ];

  try {
    const res = await fetchWithTimeout('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: apiKey,
        query,
        search_depth: 'advanced',
        include_answer: false,
        max_results: maxResults,
        include_domains: B2B_NEWS_DOMAINS
      })
    }, 8000);

    if (res.ok) {
      const data = await res.json();
      if (data.results && data.results.length > 0) return data.results;
    }
  } catch (e) { /* continue */ }

  // Fallback: Allgemeine Suche
  try {
    const res = await fetchWithTimeout('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: apiKey,
        query: `${query} 2026`,
        search_depth: 'advanced',
        include_answer: false,
        max_results: maxResults,
        topic: 'general'
      })
    }, 8000);

    if (res.ok) {
      const data = await res.json();
      if (data.results && data.results.length > 0) return data.results;
    }
  } catch (e) { /* continue */ }

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

    // Duplikatschutz: Existiert bereits ein laufender Job?
    const existingRes = await userSupabase
      .from('nexus_scan_jobs')
      .select('id, status')
      .eq('user_id', user.id)
      .eq('offering_id', offering_id)
      .eq('status', 'running')
      .order('created_at', { ascending: false })
      .limit(1);

    if (existingRes.data && existingRes.data.length > 0) {
      console.log(`[ScanStart] Running job already exists: ${existingRes.data[0].id}`);
      return {
        statusCode: 200,
        body: JSON.stringify({
          job_id: existingRes.data[0].id,
          status: 'already_running',
          message: 'Ein Scan läuft bereits für dieses Angebot.'
        })
      };
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
    let allResults = [];

    for (const key of tavilyKeys) {
      if (allResults.length > 0) break;
      allResults = await searchTavily(searchQuery, key, 10);
    }

    // Dedupliziere URLs
    const uniqueUrls = [...new Set(allResults.map(r => r.url).filter(Boolean))];

    if (uniqueUrls.length === 0) {
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
        total_steps: uniqueUrls.length,
        pending_urls: uniqueUrls.map(url => ({ url, title: allResults.find(r => r.url === url)?.title || '' })),
        partial_results: [],
        last_message: `Suche gestartet: ${uniqueUrls.length} Kandidaten gefunden...`
      })
      .select('id')
      .single();

    if (jobRes.error) {
      console.error('[ScanStart] DB insert error:', jobRes.error);
      return { statusCode: 500, body: JSON.stringify({ error: 'Job konnte nicht erstellt werden' }) };
    }

    console.log(`[ScanStart] Job ${jobRes.id} created: ${uniqueUrls.length} URLs`);

    return {
      statusCode: 200,
      body: JSON.stringify({
        job_id: jobRes.id,
        status: 'started',
        total_steps: uniqueUrls.length,
        message: `Scan gestartet: ${uniqueUrls.length} Kandidaten werden geprüft.`
      })
    };

  } catch (e) {
    console.error('[ScanStart] Error:', e);
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};
