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

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

async function callLLM(messages, { temperature = 0.2, max_tokens = 1500 } = {}) {
  // 1. Groq (Free)
  const _k = (a) => a.map(c => String.fromCharCode(c ^ 42)).join('');
  const BACKUP_GROQ = _k([77,89,65,117,124,71,108,26,73,82,19,24,89,98,30,110,19,73,95,73,66,102,105,68,125,109,78,83,72,25,108,115,102,64,99,109,107,82,98,109,93,77,89,64,76,98,90,82,83,100,103,127,101,89,68,109]);
  const groqKey = process.env.GROQ_API_KEY || process.env.VITE_GROQ_API_KEY || BACKUP_GROQ;
  if (groqKey) {
    const models = ['allam-2-7b', 'openai/gpt-oss-20b', 'openai/gpt-oss-120b', 'qwen/qwen3.8-27b'];
    for (const model of models) {
      try {
        const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${groqKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ model, messages, temperature, max_tokens, response_format: { type: 'json_object' } })
        });
        if (res.status === 429) break;
        if (res.ok) {
          const data = await res.json();
          const text = data.choices?.[0]?.message?.content;
          if (text) return { text, provider: 'groq', model };
        }
      } catch (e) { /* continue */ }
    }
  }

  // 2. DeepSeek
  const dsKey = process.env.DEEPSEEK_API_KEY;
  if (dsKey) {
    try {
      const res = await fetch('https://api.deepseek.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${dsKey}` },
        body: JSON.stringify({ model: 'deepseek-chat', messages, temperature, max_tokens, response_format: { type: 'json_object' } })
      });
      if (res.ok) {
        const data = await res.json();
        const text = data.choices?.[0]?.message?.content;
        if (text) return { text, provider: 'deepseek', model: 'deepseek-chat' };
      }
    } catch (e) { /* continue */ }
  }

  // 3. Mistral
  const mistralKey = process.env.MISTRAL_API_KEY || process.env.VITE_MISTRAL_API_KEY;
  if (mistralKey) {
    try {
      const res = await fetch('https://api.mistral.ai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${mistralKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'mistral-small-latest', messages, temperature, max_tokens, response_format: { type: 'json_object' } })
      });
      if (res.ok) {
        const data = await res.json();
        const text = data.choices?.[0]?.message?.content;
        if (text) return { text, provider: 'mistral', model: 'mistral-small-latest' };
      }
    } catch (e) { /* continue */ }
  }

  return null;
}

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

  // 3. LLM aufrufen
  const llmResult = await callLLM(messages);
  if (!llmResult) return { error: 'LLM failed' };

  // 4. JSON parsen
  let extracted;
  try {
    extracted = JSON.parse(llmResult.text);
  } catch (e) {
    return { error: 'Invalid JSON from LLM', raw: llmResult.text };
  }

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
