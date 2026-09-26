/**
 * NeXus Radar Scan — STEP
 * 
 * Verarbeitet eine URL pro Aufruf:
 * 1. Volltext fetch von pending_urls[0]
 * 2. LLM-Extraktion (wiederverwendet nexus-research.mjs Logik)
 * 3. Ergebnis an partial_results anhängen
 * 4. URL entfernen, current_step erhöhen
 * 5. Bei Deadline oder leerem pending_urls → status: 'done'
 * 
 * Hard Cap: current_step > 12 → status: 'error'
 */

import { createClient } from '@supabase/supabase-js';
import { GROQ_JSON_HEAVY, OPENROUTER_FREE_MODELS, MISTRAL_DEFAULT_MODEL, OPENAI_DEFAULT_MODEL } from './nexus-models.mjs';

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
    }, 6000);
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

async function callAI(messages, { temperature = 0.3, max_tokens = 4096, jsonMode = false } = {}) {
  // 1. Groq
  const groqKey = process.env.GROQ_API_KEY || process.env.VITE_GROQ_API_KEY;
  if (groqKey) {
    for (const model of GROQ_JSON_HEAVY) {
      try {
        const payload = { model, messages, temperature, max_tokens };
        if (jsonMode) payload.response_format = { type: 'json_object' };
        const res = await fetchWithTimeout('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${groqKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        }, 6500);
        if (res.status === 429) break;
        if (!res.ok) continue;
        const data = await res.json();
        const text = data.choices?.[0]?.message?.content;
        if (text) return { text, provider: 'groq', model };
      } catch (e) { /* continue */ }
    }
  }

  // 2. OpenRouter
  const openrouterKey = process.env.OPENROUTER_API_KEY || process.env.VITE_OPENROUTER_API_KEY;
  if (openrouterKey) {
    for (const model of OPENROUTER_FREE_MODELS) {
      try {
        const res = await fetchWithTimeout('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${openrouterKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://nexus-hit.netlify.app',
            'X-Title': 'NeXus Research'
          },
          body: JSON.stringify({ model, messages, temperature, max_tokens })
        }, 6500);
        if (res.status === 429) break;
        if (!res.ok) continue;
        const data = await res.json();
        const text = data.choices?.[0]?.message?.content;
        if (text) return { text, provider: 'openrouter', model };
      } catch (e) { /* continue */ }
    }
  }

  // 3. Mistral
  const mistralKey = process.env.MISTRAL_API_KEY || process.env.VITE_MISTRAL_API_KEY;
  if (mistralKey) {
    try {
      const payload = { model: MISTRAL_DEFAULT_MODEL, messages, temperature, max_tokens };
      if (jsonMode) payload.response_format = { type: 'json_object' };
      const res = await fetchWithTimeout('https://api.mistral.ai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${mistralKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }, 6500);
      if (res.ok) {
        const data = await res.json();
        const text = data.choices?.[0]?.message?.content;
        if (text) return { text, provider: 'mistral', model: MISTRAL_DEFAULT_MODEL };
      }
    } catch (e) { /* continue */ }
  }

  // 4. OpenAI
  const openaiKey = process.env.OPENAI_API_KEY;
  if (openaiKey) {
    try {
      const payload = { model: OPENAI_DEFAULT_MODEL, messages, temperature, max_tokens };
      if (jsonMode) payload.response_format = { type: 'json_object' };
      const res = await fetchWithTimeout('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${openaiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }, 6500);
      if (res.ok) {
        const data = await res.json();
        const text = data.choices?.[0]?.message?.content;
        if (text) return { text, provider: 'openai', model: 'gpt-4o-mini' };
      }
    } catch (e) { /* continue */ }
  }

  return null;
}

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type, Authorization' } };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const deadline = Date.now() + 8500; // 8.5s Budget

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

    // Hard Cap Check
    if (job.current_step > 12) {
      await userSupabase
        .from('nexus_scan_jobs')
        .update({ status: 'error', error_message: 'Hard Cap erreicht (max 12 Schritte)', updated_at: new Date().toISOString() })
        .eq('id', job_id);

      return {
        statusCode: 200,
        body: JSON.stringify({
          status: 'error',
          current_step: job.current_step,
          total_steps: job.total_steps,
          last_message: 'Scan wurde abgebrochen: zu viele Schritte.',
          partial_results: job.partial_results,
          error_message: 'Hard Cap erreicht (max 12 Schritte)'
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

    const llmResult = await callAI([
      { role: 'system', content: 'Du gibst IMMER valides JSON zurück, ohne Markdown-Blöcke.' },
      { role: 'user', content: extractPrompt }
    ], { temperature: 0.3, max_tokens: 2000, jsonMode: true });

    let extracted = { trigger_events: [] };
    if (llmResult?.text) {
      try {
        const cleaned = llmResult.text.replace(/```(?:json)?/g, '').replace(/```/g, '').trim();
        extracted = JSON.parse(cleaned);
      } catch (e) {
        console.warn(`[ScanStep] JSON parse error for ${domain}:`, e.message);
      }
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

    // 4. DB updaten
    const isDone = updatedPending.length === 0 || Date.now() >= deadline;
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
