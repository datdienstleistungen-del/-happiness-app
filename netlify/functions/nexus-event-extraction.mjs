/**
 * NeXus Event Extraction (Phase 0)
 *
 * Extrahiert strukturierte Business Events aus Rohdaten.
 *
 * DESIGN PRINZIP (Abnahmeregel 3):
 * Extraction = Event, nicht Offering.
 *
 * WAS die Extraction beantwortet:
 * - Was ist passiert?
 * - Wer ist betroffen?
 * - Wo?
 * - Wann?
 * - Welche Quelle belegt es?
 * - Warum ist es ein Business Event?
 *
 * WAS die Extraction NICHT beantwortet:
 * - Wer könnte das verkaufen?
 * - Welches Offering passt?
 * - Welcher Kunde ist interessiert?
 */

import { callLLM } from './_shared/llm-core.mjs';
import { extractJson, businessEventSchema } from './_shared/schemas.mjs';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

function buildExtractionPrompt(rawContent, sourceUrl, sourceTitle) {
  const currentDate = new Date().toISOString().split('T')[0];
  const currentYear = new Date().getFullYear();

  return [
    {
      role: 'system',
      content: `Du bist ein B2B Intelligence Analyst für das NeXus Sales Operation System. Extrahiere aus dem Text ein strukturiertes Business Event.

# THE SALES WINDOW & TIMING-FILTER:
- Heutiges Datum: ${currentDate} (Jahr ${currentYear}).
- Relevanzfenster: Das Event muss JETZT relevant sein (Zukunft 3-12 Monate oder Veröffentlichung max. 90 Tage alt).
- Veraltete historische Events (z.B. Eröffnung/Fertigstellung liegt über 90 Tage zurück) haben KEINEN Vertriebswert. Wenn das Event rein historisch/abgelaufen ist, setze "confidence": 0.1.

WICHTIG: Nutze NUR echte Daten aus dem Text. Erfinde absolut nichts.
Wenn ein Feld nicht eindeutig bestimmbar ist, setze es auf null.

Gib die Antwort als JSON mit exakt diesen Feldern:
{
  "event_type": "expansion|hiring|investment|founding|merger_acquisition|product_launch|partnership|leadership_change|sustainability|regulatory",
  "title": "Kurzbeschreibung des Events (1 Satz)",
  "description": "Ausführliche Beschreibung (2-3 Sätze)",
  "company_name": "Exakter Name des B2B-Unternehmens (NICHT Produktname, NICHT Markenname)",
  "company_domain": "Domain des Unternehmens (falls im Text erkennbar, z.B. 'firma.de')",
  "country": "ISO-3166-1 Landcode (z.B. DE, AT, CH)",
  "region": "Bundesland oder Region (falls erkennbar)",
  "city": "Stadt (falls erkennbar)",
  "event_date": "YYYY-MM-DD Format (wenn ein Datum im Text genannt wird, sonst null)",
  "confidence": "Zahl zwischen 0 und 1 (wie sicher bist du, dass das ein echtes, aktuelles Business Event ist?)",
  "evidence": "Exakter Text-Auszug aus dem Quelldokument, der das Event belegt (1-2 Sätze)"
}`
    },
    {
      role: 'user',
      content: `QUELLE: ${sourceUrl}
TITEL: ${sourceTitle || 'Kein Titel'}

TEXT:
${rawContent.substring(0, 3000)}`
    }
  ];
}

/**
 * Extrahiert ein Business Event aus einem Raw Event.
 * Nimmt raw_event_id, liest nexus_raw_events, speichert nexus_events.
 */
export async function extractEventFromRaw(rawEventId, token, userId) {
  const headers = {
    apikey: SUPABASE_KEY,
    Authorization: `Bearer ${token || SUPABASE_KEY}`,
    'Content-Type': 'application/json',
    Prefer: 'return=representation'
  };

  // 1. Raw Event laden
  let raw = null;
  try {
    const rawRes = await fetch(
      `${SUPABASE_URL}/rest/v1/nexus_raw_events?id=eq.${rawEventId}&select=*`,
      { headers }
    );
    if (rawRes.ok) {
      const rawArr = await rawRes.json();
      if (Array.isArray(rawArr) && rawArr.length > 0) {
        raw = rawArr[0];
      }
    }
  } catch (e) {
    return { error: `Failed to load raw event: ${e.message}` };
  }

  if (!raw) return { error: 'Raw event not found' };

  // 2. LLM-Prompt bauen
  const messages = buildExtractionPrompt(raw.raw_content || '', raw.source_url, raw.title);

  // 3. LLM aufrufen — Kette via _shared/llm-core, Reihenfolge wie bisher
  //    (Groq -> DeepSeek -> Mistral), Free-Modelle, json_object-Mode.
  let llmResult;
  try {
    llmResult = await callLLM(messages, {
      profile: 'free',
      jsonMode: true,
      temperature: 0.2,
      max_tokens: 1500,
      providers: ['groq', 'deepseek', 'mistral'],
    });
  } catch (e) {
    return { error: 'LLM failed', detail: e.message };
  }

  // 4. JSON parsen (Fence-Toleranz) + Zod-Validierung (_shared/schemas.mjs)
  let extracted = extractJson(llmResult.text);
  if (extracted === null || typeof extracted !== 'object') {
    return { error: 'Invalid JSON from LLM', raw: llmResult.text };
  }
  const eventParsed = businessEventSchema.safeParse(extracted);
  if (!eventParsed.success) {
    return {
      error: 'Schema-Verletzung vom LLM',
      detail: eventParsed.error.issues.slice(0, 3).map((i) => i.path.join('.')).join(', '),
      raw: llmResult.text,
    };
  }
  extracted = eventParsed.data;

  // 5. Validation
  if (!extracted.company_name || extracted.company_name === 'null') {
    extracted.company_name = 'UNRESOLVED';
  }
  if (!extracted.event_type) {
    extracted.event_type = 'regulatory';
  }

  // 6. Entity Resolution aufrufen
  const { resolveEventWithCompany } = await import('./nexus-entity-resolution.mjs');
  const result = await resolveEventWithCompany(
    userId,
    {
      event_type: extracted.event_type,
      title: extracted.title,
      description: extracted.description,
      company_name: extracted.company_name,
      company_domain: extracted.company_domain,
      country: extracted.country,
      region: extracted.region,
      city: extracted.city,
      event_date: extracted.event_date,
      confidence: extracted.confidence,
      source_count: 1,
      raw_event_ids: [rawEventId]
    },
    token
  );

  return {
    ...result,
    extraction: extracted,
    provider: llmResult.provider,
    model: llmResult.model
  };
}

/**
 * Handler für direkten HTTP-Aufruf.
 */
export async function handler(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const { raw_event_id } = JSON.parse(event.body);
    if (!raw_event_id) return { statusCode: 400, body: JSON.stringify({ error: 'raw_event_id required' }) };

    const result = await extractEventFromRaw(raw_event_id);
    return { statusCode: 200, body: JSON.stringify(result) };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
}
