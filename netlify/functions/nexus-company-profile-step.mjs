/**
 * NeXus Company Profile — STEP
 *
 * Verarbeitet eine URL pro Aufruf (Chunked-Pattern, wie Radar-Scan):
 * 1. Fetch + Text-Extraktion via shared html-fetch.mjs
 * 2. LLM-Extraktion mit Strukturierungs-Prompt
 * 3. Grounding-Check: jedes Zitat muss wörtlich im Text vorkommen
 * 4. Ergebnis an sources anhängen, Rohtext in raw_page_cache sichern
 * 5. Bei Deadline oder leerem pending_urls → status: 'done'
 *
 * Hard Cap: current_step > 8 → status: 'error'
 * Budget: Date.now() + 8500
 */

import { createClient } from '@supabase/supabase-js';
import { GROQ_JSON_HEAVY, OPENROUTER_FREE_MODELS, MISTRAL_DEFAULT_MODEL, OPENAI_DEFAULT_MODEL } from './nexus-models.mjs';
import { fetchAndExtractText } from '../shared/html-fetch.mjs';
import { checkTextGroundedInSource } from './grounding-helpers.mjs';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
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

async function callAI(messages, { temperature = 0.3, max_tokens = 4096, jsonMode = false } = {}) {
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

  const openrouterKey = process.env.OPENROUTER_API_KEY || process.env.VITE_OPENROUTER_API_KEY;
  if (openrouterKey) {
    for (const model of OPENROUTER_FREE_MODELS) {
      try {
        const payload = { model, messages, temperature, max_tokens };
        if (jsonMode) payload.response_format = { type: 'json_object' };
        const res = await fetchWithTimeout('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${openrouterKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        }, 6500);
        if (res.status === 429) continue;
        if (!res.ok) continue;
        const data = await res.json();
        const text = data.choices?.[0]?.message?.content;
        if (text) return { text, provider: 'openrouter', model };
      } catch (e) { /* continue */ }
    }
  }

  const mistralKey = process.env.MISTRAL_API_KEY;
  if (mistralKey) {
    try {
      const payload = { model: MISTRAL_DEFAULT_MODEL, messages, temperature };
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
    } catch (e) { /* skip */ }
  }

  return null;
}

const SYSTEM_PROMPT = `Du bist die NeXus Firmenprofil-Engine. Du extrahierst strukturierte Informationen aus Webseiten-Inhalten.

REGELN:
1. Jede Aussage MUSS ein wörtliches Zitat aus dem Quelltext als Beleg enthalten.
2. Erfinde NICHTS. Wenn nichts Verlässliches im Text steht, gib eine leere Liste zurück.
3. Gib IMMER valides JSON zurück, ohne Markdown-Blöcke.
4. "zitat" muss exakt so im Text vorkommen (Whitespace normalisiert).
5. CRITICAL: Prüfe ob die Firma SELBST ein Anbieter von CRM-, Sales-, Marketing-, Chat- oder E-Commerce-Software/-Tools ist. Das ist der "Competitor-Check".

Gib ein JSON zurück mit diesem Schema:
{
  "aussagen": [
    { "text": "Die Firma bietet X und Y an", "zitat": "wörtlicher Auszug aus dem Text" },
    { "text": "Das Unternehmen wurde 2010 gegründet", "zitat": "Gegründet 2010 in Berlin" }
  ],
  "leistungen": ["Service 1", "Service 2"],
  "zielgruppe": "Beschreibung der Zielgruppe falls erkennbar",
  "impressum_info": "Rechtsform, Ort, Geschäftsführer falls im Impressum",
  "is_competitor": false,
  "competitor_reason": null,
  "competitor_category": null
}

is_competitor: true wenn die Firma SELBST Software/Tools/SaaS für CRM, Sales, Marketing, Chatbot, E-Commerce, Helpdesk, Ticketing, Automatisierung o.ä. verkauft oder als Hauptgeschäft anbietet.
competitor_reason: Kurze Begründung mit Zitat (z.B. "Bietet CRM-Software als SaaS-Produkt an").
competitor_category: Kategorie des Produkts (z.B. "CRM", "Chatbot", "Marketing-Automation", "E-Commerce-Plattform", "Helpdesk").
Wenn die Firma KEIN Software-/SaaS-Anbieter ist: is_competitor: false, competitor_reason: null, competitor_category: null.`;

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type, Authorization' } };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const deadline = Date.now() + 8500;

  try {
    const { profile_id } = JSON.parse(event.body || '{}');

    const authHeader = event.headers.authorization;
    if (!authHeader) return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };

    const userSupabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } }
    });
    const { data: { user }, error: authError } = await userSupabase.auth.getUser();
    if (authError || !user) return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };

    if (!profile_id) return { statusCode: 400, body: JSON.stringify({ error: 'profile_id required' }) };

    const serviceClient = createClient(supabaseUrl, serviceKey);

    // Lade Job
    const jobRes = await serviceClient
      .from('nexus_company_profiles')
      .select('*')
      .eq('id', profile_id)
      .single();

    if (jobRes.error || !jobRes.data) {
      return { statusCode: 404, body: JSON.stringify({ error: 'Profil-Job nicht gefunden' }) };
    }

    const job = jobRes.data;

    if (job.status !== 'running') {
      return {
        statusCode: 200,
        body: JSON.stringify({
          status: job.status,
          current_step: job.current_step,
          total_steps: (job.pending_urls?.length || 0) + job.current_step,
          description: job.description,
          sources: job.sources,
          services: job.services,
          is_competitor: job.is_competitor,
          competitor_reason: job.competitor_reason,
          competitor_category: job.competitor_category
        })
      };
    }

    // Hard Cap Check
    if (job.current_step > 8) {
      await serviceClient
        .from('nexus_company_profiles')
        .update({ status: 'error', updated_at: new Date().toISOString() })
        .eq('id', profile_id);

      return {
        statusCode: 200,
        body: JSON.stringify({
          status: 'error',
          current_step: job.current_step,
          total_steps: (job.pending_urls?.length || 0) + job.current_step,
          error_message: 'Hard Cap erreicht (max 8 Schritte)'
        })
      };
    }

    const pendingUrls = job.pending_urls || [];
    const currentSources = job.sources || [];
    const rawCache = job.raw_page_cache || {};

    // Keine weiteren URLs → fertig
    if (pendingUrls.length === 0) {
      await serviceClient
        .from('nexus_company_profiles')
        .update({
          status: 'done',
          updated_at: new Date().toISOString()
        })
        .eq('id', profile_id);

      return {
        statusCode: 200,
        body: JSON.stringify({
          status: 'done',
          current_step: job.current_step,
          total_steps: job.current_step,
          description: job.description,
          services: job.services,
          sources: currentSources,
          is_competitor: job.is_competitor,
          competitor_reason: job.competitor_reason,
          competitor_category: job.competitor_category
        })
      };
    }

    // Nächste URL holen
    const nextUrl = pendingUrls[0];

    // 1. Text holen via shared html-fetch.mjs (nexus-email-crawler Cheerio-Logik)
    const fetched = await fetchAndExtractText(nextUrl, { timeoutMs: 5000 });

    if (!fetched.ok || !fetched.text || fetched.text.length < 100) {
      const updatedPending = pendingUrls.slice(1);
      await serviceClient
        .from('nexus_company_profiles')
        .update({
          pending_urls: updatedPending,
          current_step: job.current_step + 1,
          updated_at: new Date().toISOString()
        })
        .eq('id', profile_id);

      return {
        statusCode: 200,
        body: JSON.stringify({
          status: 'running',
          current_step: job.current_step + 1,
          total_steps: updatedPending.length + job.current_step + 1,
          last_message: `${nextUrl} — kein brauchbarer Inhalt.`,
          sources: currentSources
        })
      };
    }

    // Rohtext im Cache sichern
    rawCache[nextUrl] = fetched.text.substring(0, 5000);

    // 2. LLM-Extraktion
    const userPrompt = `QUELLE: ${nextUrl}
TITEL: ${fetched.title || 'Unbekannt'}

INHALT:
${fetched.text.substring(0, 3000)}

Extrahiere eine strukturierte Firmenbeschreibung. Jede Aussage MUSS ein wörtliches Zitat als Beleg haben.`;

    const llmResult = await callAI([
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userPrompt }
    ], { temperature: 0.3, max_tokens: 2000, jsonMode: true });

    let extracted = { aussagen: [], leistungen: [], zielgruppe: null, impressum_info: null, is_competitor: false, competitor_reason: null, competitor_category: null };

    if (llmResult?.text) {
      try {
        const cleaned = llmResult.text.replace(/```(?:json)?/g, '').replace(/```/g, '').trim();
        extracted = JSON.parse(cleaned);
      } catch (e) {
        console.warn('[CompanyProfileStep] JSON parse failed:', e.message);
      }
    }

    // 3. Grounding-Check: jedes Zitat muss wörtlich im Text vorkommen
    const groundedSources = [];
    for (const aussage of (extracted.aussagen || [])) {
      const groundResult = checkTextGroundedInSource(aussage.zitat || '', fetched.text);
      if (groundResult.grounded) {
        groundedSources.push({
          claim: aussage.text,
          source_url: nextUrl,
          quote: aussage.zitat
        });
      } else {
        console.log(`[CompanyProfileStep] Quote rejected (not grounded): "${(aussage.zitat || '').substring(0, 50)}..."`);
      }
    }

    // 4. DB updaten
    const updatedSources = [...currentSources, ...groundedSources];
    const updatedPending = pendingUrls.slice(1);

    // Beschreibung nur setzen, wenn noch keine existiert und Text vorhanden
    const descriptionUpdate = (!job.description && extracted.aussagen?.length > 0)
      ? extracted.aussagen.map(a => a.text).join('. ')
      : job.description;

    // Services nur setzen, wenn noch keine existieren
    const servicesUpdate = (!job.services || job.services.length === 0)
      ? (extracted.leistungen || [])
      : job.services;

    // Zielgruppe nur setzen, wenn noch keine existiert
    const targetUpdate = (!job.target_audience && extracted.zielgruppe)
      ? extracted.zielgruppe
      : job.target_audience;

    // Impressum nur setzen, wenn noch keins existiert
    const impressumUpdate = (!job.legal_form_location && extracted.impressum_info)
      ? extracted.impressum_info
      : job.legal_form_location;

    // Competitor-Check: Wenn eine Seite True liefert, gilt das für das gesamte Profil
    const isCompetitor = extracted.is_competitor || job.is_competitor || false;
    const competitorReason = extracted.competitor_reason || job.competitor_reason || null;
    const competitorCategory = extracted.competitor_category || job.competitor_category || null;

    const newStatus = updatedPending.length === 0 ? 'done' : 'running';

    await serviceClient
      .from('nexus_company_profiles')
      .update({
        pending_urls: updatedPending,
        current_step: job.current_step + 1,
        sources: updatedSources,
        raw_page_cache: rawCache,
        description: descriptionUpdate,
        services: servicesUpdate,
        target_audience: targetUpdate,
        legal_form_location: impressumUpdate,
        is_competitor: isCompetitor,
        competitor_reason: competitorReason,
        competitor_category: competitorCategory,
        status: newStatus,
        updated_at: new Date().toISOString()
      })
      .eq('id', profile_id);

    console.log(`[CompanyProfileStep] Step ${job.current_step + 1}: ${nextUrl} — ${groundedSources.length} grounded quotes (${Date.now() - deadline + 8500}ms remaining)`);

    return {
      statusCode: 200,
      body: JSON.stringify({
        status: newStatus,
        current_step: job.current_step + 1,
        total_steps: updatedPending.length + job.current_step + 1,
        sources: updatedSources,
        services: servicesUpdate,
        description: descriptionUpdate,
        is_competitor: isCompetitor,
        competitor_reason: competitorReason,
        competitor_category: competitorCategory,
        last_message: `${nextUrl} — ${groundedSources.length} Aussagen extrahiert.`
      })
    };

  } catch (err) {
    console.error('[CompanyProfileStep] Fatal error:', err);
    return { statusCode: 500, body: JSON.stringify({ error: 'Internal server error', details: err.message }) };
  }
};
