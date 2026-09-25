

import { GROQ_JSON_HEAVY, OPENROUTER_FREE_MODELS, MISTRAL_DEFAULT_MODEL } from './nexus-models.mjs';

async function fetchWithTimeout(url, options, timeoutMs = 20000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    return { res, timer };
  } catch (err) {
    clearTimeout(timer);
    throw err;
  }
}

async function callAI(messages, { temperature = 0.7, max_tokens = 4096, jsonMode = false } = {}) {
  // 1. Groq (High Speed & Low-Cost: gpt-oss-20b is rock-solid for complex JSON)
  const groqKey = process.env.GROQ_API_KEY || process.env.VITE_GROQ_API_KEY;
  if (groqKey) {
    const models = GROQ_JSON_HEAVY;
    for (const model of models) {
      try {
        const payload = { model, messages, temperature, max_tokens };
        if (jsonMode) payload.response_format = { type: 'json_object' };
        const { res, timer } = await fetchWithTimeout('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${groqKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        }, 7000);
        if (res.status === 429) {
          clearTimeout(timer);
          break; // Abort whole provider on 429
        }
        if (!res.ok) {
          clearTimeout(timer);
          continue;
        }
        const data = await res.json();
        clearTimeout(timer);
        const text = data.choices?.[0]?.message?.content;
        if (text) return { text, provider: 'groq', model };
      } catch (e) {
        console.warn(`[Groq Error ${model}]:`, e.message);
      }
    }
  }

  // 2. OpenRouter (Free Models)
  const openrouterKey = process.env.OPENROUTER_API_KEY || process.env.VITE_OPENROUTER_API_KEY;
  if (openrouterKey) {
    const models = OPENROUTER_FREE_MODELS;
    for (const model of models) {
      try {
        const { res, timer } = await fetchWithTimeout('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${openrouterKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://nexus-hit.netlify.app',
            'X-Title': 'NeXus Strategies'
          },
          body: JSON.stringify({ model, messages, temperature, max_tokens })
        }, 5000);
        if (res.status === 429) {
          clearTimeout(timer);
          break; // Abort whole provider on 429
        }
        if (!res.ok) {
          clearTimeout(timer);
          continue;
        }
        const data = await res.json();
        clearTimeout(timer);
        const text = data.choices?.[0]?.message?.content || data.choices?.[0]?.message?.reasoning;
        if (text) return { text, provider: 'openrouter', model };
      } catch (e) {
        console.warn(`[OpenRouter Error ${model}]:`, e.message);
      }
    }
  }

  // 3. Mistral
  const mistralKey = process.env.MISTRAL_API_KEY || process.env.VITE_MISTRAL_API_KEY;
  if (mistralKey) {
    try {
      const payload = { model: 'mistral-small-latest', messages, temperature, max_tokens };
      if (jsonMode) payload.response_format = { type: 'json_object' };
      const { res, timer } = await fetchWithTimeout('https://api.mistral.ai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${mistralKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }, 5000);
      if (res.ok) {
        const data = await res.json();
        clearTimeout(timer);
        const text = data.choices?.[0]?.message?.content;
        if (text) return { text, provider: 'mistral', model: 'mistral-small-latest' };
      } else {
        clearTimeout(timer);
      }
    } catch (e) {
      console.warn('[Mistral Error]:', e.message);
    }
  }

  // 4. OpenAI
  const openaiKey = process.env.OPENAI_API_KEY;
  if (openaiKey) {
    try {
      const payload = { model: 'gpt-4o-mini', messages, temperature, max_tokens };
      if (jsonMode) payload.response_format = { type: 'json_object' };
      const { res, timer } = await fetchWithTimeout('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${openaiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }, 5000);
      if (res.ok) {
        const data = await res.json();
        clearTimeout(timer);
        const text = data.choices?.[0]?.message?.content;
        if (text) return { text, provider: 'openai', model: 'gpt-4o-mini' };
      } else {
        clearTimeout(timer);
      }
    } catch (e) {
      console.warn('[OpenAI Error]:', e.message);
    }
  }

  throw new Error('Alle KI-Provider sind derzeit ausgelastet oder nicht erreichbar.');
}

export const handler = async (event, context) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    const supabaseUrl = process.env.VITE_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
    const authHeader = event.headers.authorization || event.headers.Authorization;
    const token = authHeader ? authHeader.replace("Bearer ", "") : "";

    const userRes = await fetch(`${supabaseUrl}/auth/v1/user`, { headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${token}` } });
    if (!userRes.ok) return { statusCode: 401, body: JSON.stringify({ error: "Invalid token or unauthorized" }) };
    const user = await userRes.json();

    const { offeringId, aiUnderstanding, targetMarkets, uiLanguage } = JSON.parse(event.body);
    if (!offeringId || !aiUnderstanding) {
      return { statusCode: 400, body: JSON.stringify({ error: "Missing offering details or AI understanding" }) };
    }

    // 1. Delete old strategies to ensure idempotency and clean state
    await fetch(`${supabaseUrl}/rest/v1/nexus_signal_strategies?offering_id=eq.${offeringId}`, {
      method: 'DELETE',
      headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${token}` }
    });

    const marketsString = Array.isArray(targetMarkets) && targetMarkets.length > 0 ? targetMarkets.join(", ") : "Worldwide / Global";
    const currentYear = new Date().getFullYear();

    const systemPrompt = `Du bist NeXus HIT, ein High-Impact Intelligence Tool für B2B Sales.
HEUTIGES DATUM / AKTUELLER ZEITHORIZONT: Jahr ${currentYear}.
Deine Aufgabe: Entwickle auf Basis des tiefen semantischen Verständnisses (Offering Understanding) eine umfassende Liste von "Signal Strategies" (Suchstrategien), um im Internet nach passenden, hochaktuellen Trigger-Ereignissen (Jahr ${currentYear}) zu suchen.

ANGEBOTS-VERSTÄNDNIS (Wahrheitsschicht):
${JSON.stringify(aiUnderstanding, null, 2)}

ZIELMÄRKTE FÜR DIE SUCHE:
${marketsString}

ARCHITEKTUR-REGEL (GLOBAL BY DESIGN & AKTUALITÄT):
- UI Language ≠ Target Market ≠ Search Language.
- ZEITBEZUG (STRIKT): Alle Suchanfragen MÜSSEN sich auf das aktuelle Jahr ${currentYear} beziehen (z.B. "${currentYear}" in Quotes für Jahresfilter) oder zeitlose Suchoperatoren verwenden. Verwende NIEMALS veraltete Jahreszahlen wie 2024 oder 2023 in Suchstrings!
- Für jede Strategie musst du ein Array von Suchanfragen ('search_queries') generieren - eine maßgeschneiderte Query für jeden angegebenen Zielmarkt in der dortigen Landessprache.
- Die Erklärung ('why_relevant') und der 'trigger_name' MÜSSEN in der UI-Sprache des Nutzers (${uiLanguage || "de"}) formuliert sein!

REGELN:
- Generiere 5-10 extrem scharfe und relevante Signal-Strategien.
- Leite diese AUSSCHLIESSLICH aus dem 'demand_contexts' des Angebots-Verständnisses ab.
- Erfinde keine Fantasie-Produkte. Halte dich strikt an 'what_is_NOT_sold'.

Antworte AUSSCHLIESSLICH im folgenden JSON-Format:
{
  "strategies": [
    {
      "signal_category": "jobs, news, tenders, expansion, leadership, legal_financial, product_launches, partnerships, investments",
      "trigger_name": "Name des Triggers (UI-Sprache)",
      "search_queries": [
        {
          "market": "Markt Name (z.B. Deutschland)",
          "language": "Sprachcode (z.B. de-DE)",
          "query": "Suchmaschinen-String für diesen Markt (mit ${currentYear} falls Jahresfilter nötig)"
        }
      ],
      "source_hints": ["Wo man das findet (z.B. LinkedIn, News)"],
      "why_relevant": "Warum zeigt dieser Trigger exakt Bedarf für das Angebot? (UI-Sprache)"
    }
  ]
}`;

    const aiRes = await callAI([{ role: "system", content: systemPrompt }], { temperature: 0.7, jsonMode: true });
    let content = aiRes.text.replace(/```(?:json)?/g, '').replace(/```/g, '').trim();
    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch(e) {
      return { statusCode: 500, body: JSON.stringify({ error: "Invalid JSON from AI" }) };
    }

    let rawStrategies = [];
    if (Array.isArray(parsed)) {
      rawStrategies = parsed;
    } else if (Array.isArray(parsed.strategies)) {
      rawStrategies = parsed.strategies;
    } else if (Array.isArray(parsed.signal_strategies)) {
      rawStrategies = parsed.signal_strategies;
    } else if (Array.isArray(parsed.data)) {
      rawStrategies = parsed.data;
    } else {
      for (const val of Object.values(parsed)) {
        if (Array.isArray(val) && val.length > 0) {
          rawStrategies = val;
          break;
        }
      }
    }

    const validStrategies = rawStrategies.map(s => {
      const category = s.signal_category || s.category || s.type || 'expansion';
      const triggerName = s.trigger_name || s.name || s.trigger || s.title || 'Signal Trigger';
      const whyRelevant = s.why_relevant || s.why || s.relevance || s.reason || s.explanation || 'Relevanter B2B Vertriebs-Trigger';
      const queries = s.search_queries || s.queries || (s.query ? [{ market: 'Global', language: 'de', query: s.query }] : []);
      const sources = s.source_hints || s.sources || s.hints || ['Web & LinkedIn'];

      return {
        signal_category: category,
        trigger_name: triggerName,
        why_relevant: whyRelevant,
        search_queries: queries,
        source_hints: sources
      };
    }).filter(s => s.trigger_name && s.why_relevant);

    if (validStrategies.length === 0) {
      return { statusCode: 500, body: JSON.stringify({ error: "AI generated no valid strategies." }) };
    }

    const rowsToInsert = validStrategies.map(s => ({
      offering_id: offeringId,
      user_id: user.id,
      signal_category: s.signal_category,
      trigger_name: s.trigger_name,
      search_queries: s.search_queries || [],
      source_hints: s.source_hints || [],
      why_relevant: s.why_relevant
    }));

    const insertRes = await fetch(`${supabaseUrl}/rest/v1/nexus_signal_strategies`, {
      method: 'POST',
      headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json', 'Prefer': 'return=representation' },
      body: JSON.stringify(rowsToInsert)
    });

    if (!insertRes.ok) {
      const errText = await insertRes.text();
      throw new Error(`Supabase insert error: ${errText}`);
    }

    const insertedData = await insertRes.json();
    return { statusCode: 200, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ success: true, strategies: insertedData }) };

  } catch (error) {
    console.error("Generate Strategies Error:", error);
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
};
