/**
 * NeXus Radar Scan — STEP
 * 
 * Verarbeitet eine URL pro Aufruf:
 * 1. Volltext fetch von pending_urls[0]
 * 2. LLM-Extraktion (wiederverwendet nexus-research.mjs Logik)
 * 3. Ergebnis an partial_results anhängen
 * 4. URL entfernen, current_step erhöhen
 * 5. Bei leerem pending_urls → status: 'done'
 * 
 * Hard Cap: current_step > 12 → status: 'error'
 */

import { createClient } from '@supabase/supabase-js';
import { callLLM } from './_shared/llm-core.mjs';
import { parseScanTriggers, extractJson } from './_shared/schemas.mjs';

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

async function fetchPageText(url) {
  try {
    const res = await fetchWithTimeout(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; NeXusBot/1.0)' }
    }, 4000);
    if (!res.ok) return null;
    const html = await res.text();
    // Einfache Text-Extraktion: HTML-Tags entfernen
    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    return text.substring(0, 4000); // Max 4000 chars
  } catch (e) {
    return null;
  }
}

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type, Authorization' } };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const { job_id } = JSON.parse(event.body || '{}');

    // Auth check
    const authHeader = event.headers.authorization;
    if (!authHeader) return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };

    const userSupabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } }
    });
    const { data: { user }, error: authError } = await userSupabase.auth.getUser();
    if (authError || !user) return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };

    if (!job_id) return { statusCode: 400, body: JSON.stringify({ error: 'job_id required' }) };

    // Lade Job
    const jobRes = await userSupabase
      .from('nexus_scan_jobs')
      .select('*')
      .eq('id', job_id)
      .eq('user_id', user.id)
      .single();

    if (jobRes.error || !jobRes.data) {
      return { statusCode: 404, body: JSON.stringify({ error: 'Job nicht gefunden' }) };
    }

    const job = jobRes.data;

    if (job.status !== 'running') {
      return {
        statusCode: 200,
        body: JSON.stringify({
          status: job.status,
          current_step: job.current_step,
          total_steps: job.total_steps,
          last_message: job.last_message,
          partial_results: job.partial_results,
          error_message: job.error_message
        })
      };
    }

    // Stale-Job-Check: Wenn der Job älter als 5 Minuten ist und noch "running"
    const jobAge = Date.now() - new Date(job.created_at).getTime();
    if (jobAge > 5 * 60 * 1000) {
      console.log(`[ScanStep] Stale job ${job_id} (${Math.round(jobAge/1000)}s old) — marking as error`);
      await userSupabase
        .from('nexus_scan_jobs')
        .update({ status: 'error', error_message: 'Scan-Timeout: Job stale (>5min)', updated_at: new Date().toISOString() })
        .eq('id', job_id);
      return {
        statusCode: 200,
        body: JSON.stringify({
          status: 'error',
          current_step: job.current_step,
          total_steps: job.total_steps,
          last_message: 'Scan-Timeout',
          partial_results: job.partial_results,
          error_message: 'Scan-Timeout: Job stale (>5min)'
        })
      };
    }

    // Hard Cap Check (Sicherheitsnetz — Scans mit 20 Kandidaten dürfen nicht abgebrochen werden)
    if (job.current_step > 25) {
      await userSupabase
        .from('nexus_scan_jobs')
        .update({ status: 'error', error_message: 'Hard Cap erreicht (max 25 Schritte)', updated_at: new Date().toISOString() })
        .eq('id', job_id);

      return {
        statusCode: 200,
        body: JSON.stringify({
          status: 'error',
          current_step: job.current_step,
          total_steps: job.total_steps,
          last_message: 'Scan wurde abgebrochen: zu viele Schritte.',
          partial_results: job.partial_results,
          error_message: 'Hard Cap erreicht (max 25 Schritte)'
        })
      };
    }

    const pendingUrls = job.pending_urls || [];
    const partialResults = job.partial_results || [];

    // Keine weiteren URLs → fertig
    if (pendingUrls.length === 0) {
      await userSupabase
        .from('nexus_scan_jobs')
        .update({ status: 'done', last_message: `Fertig: ${partialResults.length} Leads gefunden.`, updated_at: new Date().toISOString() })
        .eq('id', job_id);

      return {
        statusCode: 200,
        body: JSON.stringify({
          status: 'done',
          current_step: job.current_step,
          total_steps: job.total_steps,
          last_message: `Fertig: ${partialResults.length} Leads gefunden.`,
          partial_results: partialResults
        })
      };
    }

    // Nächste URL verarbeiten
    const nextUrl = pendingUrls[0];
    const domain = new URL(nextUrl.url).hostname.replace('www.', '');

    // Update: Step läuft
    await userSupabase
      .from('nexus_scan_jobs')
      .update({ last_message: `Prüfe ${domain} auf aktuelle Meldungen...`, updated_at: new Date().toISOString() })
      .eq('id', job_id);

    // 1. Volltext holen
    const pageText = await fetchPageText(nextUrl.url);

    if (!pageText || pageText.length < 100) {
      // URL überspringen
      const updatedPending = pendingUrls.slice(1);
      await userSupabase
        .from('nexus_scan_jobs')
        .update({
          pending_urls: updatedPending,
          current_step: job.current_step + 1,
          last_message: `${domain} — kein brauchbarer Inhalt gefunden.`,
          updated_at: new Date().toISOString()
        })
        .eq('id', job_id);

      return {
        statusCode: 200,
        body: JSON.stringify({
          status: 'running',
          current_step: job.current_step + 1,
          total_steps: job.total_steps,
          last_message: `${domain} — kein brauchbarer Inhalt gefunden.`,
          partial_results: partialResults
        })
      };
    }

    // 2. LLM-Extraktion (wiederverwendet nexus-research.mjs Prompt-Struktur)
    const extractPrompt = `Du bist die Intelligence Engine für NeXus Sales. Analysiere diesen Web-Inhalt und finde B2B-Kaufsignale.

QUELLE: ${nextUrl.url}
TITEL: ${nextUrl.title || 'Unbekannt'}

INHALT:
${pageText.substring(0, 3000)}

REGELN:
1. NUR echte Firmennamen aus dem Text
2. Erfinde KEINE Unternehmen
3. Erkläre warum das ein Kaufsignal ist
4. "ansprechpartner" nur wenn Name WÖRTLICH im Text steht, sonst null
5. "quelle" MUSS die echte URL sein
6. Klassifiziere jedes Signal in eine der 5 Kategorien (siehe unten)
7. Die "psychologische_ansprache" MUSS tiefgehend sein: Nicht nur "wie ansprechen", sondern: Was ist der emotionale Zustand? Was ist der unsichtbare Schmerz? Was passiert im Kopf des Entscheiders?

KAUFSIGNAL-KATEGORIEN:
1. HIRING — Massiver Personalaufbau (10+ Stellen in kurzer Zeit, neue Abteilungen)
2. FUNDING — Finanzierungsrunden, Investitionen, Series A/B/C
3. TECH_MIGRATION — Cloud-Migration, Systemwechsel, Legacy-Ablösung
4. REGULATION — Neue Gesetze, Compliance-Pflichten, regulatorische Änderungen
5. M_A — Übernahmen, Fusionen, Partnerschaften

Gib ein JSON zurück:
{
  "trigger_events": [
    {
      "firmenname": "Echter Firmenname",
      "branche": "Branche",
      "prioritaet": 1,
      "bewertung": "B - Hohe Chance. Warum?",
      "signal": "Was ist passiert?",
      "signal_kategorie": "HIRING | FUNDING | TECH_MIGRATION | REGULATION | M_A",
      "relevanz": "Relevanz für das Angebot",
      "ansprechpartner": null,
      "position": null,
      "kontakt": null,
      "quelle": "${nextUrl.url}",
      "psychologische_ansprache": "Deep dive: Was ist der emotionale Zustand des Entscheiders? Welcher unsichtbare Schmerz verbirgt sich hinter diesem Signal? Was passiert gerade im Unternehmen, was niemand nach außen trägt?"
    }
  ]
}`;

    const llmResult = await Promise.race([
      callLLM([
        { role: 'system', content: 'Du gibst IMMER valides JSON zurück, ohne Markdown-Blöcke.' },
        { role: 'user', content: extractPrompt }
      ], { profile: 'json', temperature: 0.3, max_tokens: 2000, jsonMode: true, totalBudgetMs: 4400, xTitle: 'NeXus Research' }).catch(() => null),
      new Promise(resolve => setTimeout(() => resolve(null), 4500)) // LLM-Budget: nie über 10s Netlify-Limit
    ]);

    // Zod sichert: trigger_events bleibt ein Array (siehe _shared/schemas.mjs)
    let extracted = { trigger_events: [] };
    if (llmResult?.text) {
      if (extractJson(llmResult.text) === null) {
        console.warn(`[ScanStep] JSON parse error for ${domain}: kein valides JSON`);
      }
      extracted = parseScanTriggers(llmResult.text);
    }

    // 3. Ergebnis an partial_results anhängen
    const newResults = [...partialResults, {
      url: nextUrl.url,
      title: nextUrl.title,
      domain,
      source_type: nextUrl.source_type || 'NEWS',
      triggers: extracted.trigger_events || [],
      extracted_at: new Date().toISOString()
    }];

    const updatedPending = pendingUrls.slice(1);
    const newStep = job.current_step + 1;
    const triggersFound = (extracted.trigger_events || []).length;
    const message = triggersFound > 0
      ? `${triggersFound} mögliche Signale auf ${domain} gefunden, werte aus...`
      : `${domain} — keine Signale erkannt.`;

    // 4. DB updaten — fertig ist nur, wenn keine Kandidaten-URLs mehr übrig sind
    const isDone = updatedPending.length === 0;
    await userSupabase
      .from('nexus_scan_jobs')
      .update({
        pending_urls: updatedPending,
        partial_results: newResults,
        current_step: newStep,
        last_message: message,
        status: isDone ? 'done' : 'running',
        updated_at: new Date().toISOString()
      })
      .eq('id', job_id);

    return {
      statusCode: 200,
      body: JSON.stringify({
        status: isDone ? 'done' : 'running',
        current_step: newStep,
        total_steps: job.total_steps,
        last_message: message,
        partial_results: newResults
      })
    };

  } catch (e) {
    console.error('[ScanStep] Error:', e);
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};
