

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

    const deepseekKey = process.env.DEEPSEEK_API_KEY;
    const marketsString = Array.isArray(targetMarkets) && targetMarkets.length > 0 ? targetMarkets.join(", ") : "Worldwide / Global";

    const systemPrompt = `Du bist NeXus HIT, ein High-Impact Intelligence Tool für B2B Sales.
Deine Aufgabe: Entwickle auf Basis des tiefen semantischen VerstÃ¤ndnisses (Offering Understanding) eine umfassende Liste von "Signal Strategies" (Suchstrategien), um im Internet nach passenden Trigger-Ereignissen zu suchen.

ANGEBOTS-VERSTÃ„NDNIS (Wahrheitsschicht):
${JSON.stringify(aiUnderstanding, null, 2)}

ZIELMÃ„RKTE FÃœR DIE SUCHE:
${marketsString}

ARCHITEKTUR-REGEL (GLOBAL BY DESIGN):
- UI Language â‰  Target Market â‰  Search Language.
- FÃ¼r jede Strategie musst du ein Array von Suchanfragen ('search_queries') generieren - eine maßgeschneiderte Query für jeden angegebenen Zielmarkt in der dortigen Landessprache.
- Die ErklÃ¤rung ('why_relevant') und der 'trigger_name' MÃœSSEN in der UI-Sprache des Nutzers (${uiLanguage || "de"}) formuliert sein!

REGELN:
- Generiere 5-10 extrem scharfe und relevante Signal-Strategien.
- Leite diese AUSSCHLIESSLICH aus dem 'demand_contexts' des Angebots-VerstÃ¤ndnisses ab.
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

    const deepseekRes = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${deepseekKey}` },
      body: JSON.stringify({
        model: "deepseek-chat",
        response_format: { type: "json_object" },
        messages: [{ role: "system", content: systemPrompt }],
        temperature: 0.7
      })
    });

    if (!deepseekRes.ok) throw new Error("DeepSeek API Error");
    const dsData = await deepseekRes.json();
    let parsed;
    try {
      parsed = JSON.parse(dsData.choices[0].message.content);
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
