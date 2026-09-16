

async function fetchWithTimeout(url, options, timeoutMs = 12000) {
  const controller = new AbortController();
  const abortId = setTimeout(() => controller.abort(), timeoutMs);
  let raceId;
  try {
    const res = await Promise.race([
      fetch(url, { ...options, signal: controller.signal }),
      new Promise((_, reject) => {
        raceId = setTimeout(() => reject(new Error('Fetch timeout race')), timeoutMs);
      })
    ]);
    return { res, abortId, raceId };
  } catch (err) {
    clearTimeout(abortId);
    clearTimeout(raceId);
    throw err;
  }
}

async function callAI(messages, { temperature = 0.7, max_tokens = 4096, jsonMode = false } = {}) {
  // 1. Groq
  const groqKey = process.env.GROQ_API_KEY || process.env.VITE_GROQ_API_KEY;
  if (groqKey) {
    const models = ['openai/gpt-oss-120b', 'qwen/qwen3.8-27b', 'groq/compound', 'openai/gpt-oss-20b'];
    for (const model of models) {
      try {
        const payload = { model, messages, temperature, max_tokens };
        if (jsonMode) payload.response_format = { type: 'json_object' };
        const { res, abortId, raceId } = await fetchWithTimeout('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${groqKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        }, 15000);
        clearTimeout(abortId); clearTimeout(raceId);
        if (res.ok) {
          const data = await res.json();
          const text = data.choices?.[0]?.message?.content;
          if (text) return { text, provider: 'groq', model };
        }
      } catch (e) {
        console.warn(`[Groq Error ${model}]:`, e.message);
      }
    }
  }

  // 2. Mistral
  const mistralKey = process.env.MISTRAL_API_KEY || process.env.VITE_MISTRAL_API_KEY;
  if (mistralKey) {
    try {
      const payload = { model: 'mistral-small-latest', messages, temperature, max_tokens };
      if (jsonMode) payload.response_format = { type: 'json_object' };
      const { res, abortId, raceId } = await fetchWithTimeout('https://api.mistral.ai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${mistralKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }, 15000);
      clearTimeout(abortId); clearTimeout(raceId);
      if (res.ok) {
        const data = await res.json();
        const text = data.choices?.[0]?.message?.content;
        if (text) return { text, provider: 'mistral', model: 'mistral-small-latest' };
      }
    } catch (e) {
      console.warn('[Mistral Error]:', e.message);
    }
  }

  // 3. OpenRouter
  const openrouterKey = process.env.OPENROUTER_API_KEY || process.env.VITE_OPENROUTER_API_KEY;
  if (openrouterKey) {
    const models = ['google/gemma-4-26b-a4b-it:free', 'meta-llama/llama-3.3-70b-instruct:free'];
    for (const model of models) {
      try {
        const { res, abortId, raceId } = await fetchWithTimeout('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${openrouterKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://nexus-hit.netlify.app',
            'X-Title': 'NeXus Strategies'
          },
          body: JSON.stringify({ model, messages, temperature, max_tokens })
        }, 15000);
        clearTimeout(abortId); clearTimeout(raceId);
        if (res.ok) {
          const data = await res.json();
          const text = data.choices?.[0]?.message?.content;
          if (text) return { text, provider: 'openrouter', model };
        }
      } catch (e) {
        console.warn(`[OpenRouter Error ${model}]:`, e.message);
      }
    }
  }

  // 4. DeepSeek
  const deepseekKey = process.env.DEEPSEEK_API_KEY;
  if (deepseekKey) {
    try {
      const payload = { model: 'deepseek-chat', messages, temperature, max_tokens };
      if (jsonMode) payload.response_format = { type: 'json_object' };
      const { res, abortId, raceId } = await fetchWithTimeout('https://api.deepseek.com/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${deepseekKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }, 15000);
      clearTimeout(abortId); clearTimeout(raceId);
      if (res.ok) {
        const data = await res.json();
        const text = data.choices?.[0]?.message?.content;
        if (text) return { text, provider: 'deepseek', model: 'deepseek-chat' };
      }
    } catch (e) {
      console.warn('[DeepSeek Error]:', e.message);
    }
  }

  // 5. OpenAI
  const openaiKey = process.env.OPENAI_API_KEY;
  if (openaiKey) {
    try {
      const payload = { model: 'gpt-4o-mini', messages, temperature, max_tokens };
      if (jsonMode) payload.response_format = { type: 'json_object' };
      const { res, abortId, raceId } = await fetchWithTimeout('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${openaiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }, 15000);
      clearTimeout(abortId); clearTimeout(raceId);
      if (res.ok) {
        const data = await res.json();
        const text = data.choices?.[0]?.message?.content;
        if (text) return { text, provider: 'openai', model: 'gpt-4o-mini' };
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

    const systemPrompt = `Du bist NeXus HIT, ein High-Impact Intelligence Tool für B2B Sales.
Deine Aufgabe: Entwickle auf Basis des tiefen semantischen Verständnisses (Offering Understanding) eine umfassende Liste von "Signal Strategies" (Suchstrategien), um im Internet nach passenden Trigger-Ereignissen zu suchen.

ANGEBOTS-VERSTÄNDNIS (Wahrheitsschicht):
${JSON.stringify(aiUnderstanding, null, 2)}

ZIELMÄRKTE FÜR DIE SUCHE:
${marketsString}

ARCHITEKTUR-REGEL (GLOBAL BY DESIGN):
- UI Language ≠ Target Market ≠ Search Language.
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
          "query": "Suchmaschinen-String für diesen Markt"
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

    if (!parsed.strategies || !Array.isArray(parsed.strategies)) {
      return { statusCode: 500, body: JSON.stringify({ error: "AI generated no valid strategies array." }) };
    }

    const validStrategies = parsed.strategies.filter(s => s.signal_category && s.trigger_name && s.why_relevant);
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
