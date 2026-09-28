

import { callLLM } from './_shared/llm-core.mjs';
import { parseStrategiesOutput } from './_shared/schemas.mjs';

// Gesamtbudget für die Provider-Kette — deutlich unter dem Netlify-Sync-Limit
// (60s, nicht konfigurierbar), damit Auth + DELETE + INSERT des Handlers noch Platz haben.
const TOTAL_BUDGET_MS = 22000;

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
- Leite diese AUSSCHLIESSLICH aus den 'demand_contexts' des Angebots-Verständnisses ab.
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

    const aiRes = await callLLM([{ role: "system", content: systemPrompt }], {
      profile: 'json',
      temperature: 0.7,
      jsonMode: true,
      totalBudgetMs: TOTAL_BUDGET_MS,
      xTitle: 'NeXus Strategies',
    });
    // Extraktion + Alias-Normalisierung + Zod sichern die kanonische Form
    // (siehe _shared/schemas.mjs). Wirft -> aeußerer Catch liefert 500 mit Grund.
    const validStrategies = parseStrategiesOutput(aiRes.text).strategies;

    // Alte Strategien erst JETZT löschen — die KI hat erfolgreich geliefert,
    // ein Fehlschlag oben darf die vorhandenen Strategien nicht zerstören.
    await fetch(`${supabaseUrl}/rest/v1/nexus_signal_strategies?offering_id=eq.${offeringId}`, {
      method: 'DELETE',
      headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${token}` }
    });

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
    return { statusCode: 200, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ success: true, provider: aiRes.provider, strategies: insertedData }) };

  } catch (error) {
    console.error("Generate Strategies Error:", error);
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
};
