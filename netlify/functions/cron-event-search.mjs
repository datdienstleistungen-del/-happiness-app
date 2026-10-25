/**
 * NeXus Event Search (European Mandate Origination Desk)
 *
 * Offering-unabhängige Event Discovery für C-Level-, Board- und Interim-Vakanzen in Europa.
 *
 * Primärquellen:
 * - DACH: EQS News / DGAP Ad-hoc, SHAB (Schweiz), Wiener Börse
 * - UK & Irland: London Stock Exchange RNS, Investegate, Euronext Dublin
 * - Westeuropa / Frankreich: AMF France, Euronext Paris / Brussels / Amsterdam
 * - Südeuropa / Spanien: CNMV España, BME Mercado Continuo
 * - Pan-Europa: Aggregierte Abfrage aller relevanten europäischen Pflichtmitteilungs-Dienste
 *
 * Flow:
 * 1. Event-Type & Geography → European Mandate Search Strategies (LLM + Deterministic Primary Feeds)
 * 2. Suchstrategien → Web Search (Brave / DDG / Bing News RSS)
 * 3. Rohdaten → nexus_raw_events (URL-Hash + Content-Hash Dedup)
 * 4. nexus_raw_events → Event Extraction (LLM Gatekeeper)
 * 5. Extrahierte Events → nexus_events (Entity Resolution)
 *
 * Input: {
 *   event_type: "organ_vakanz",
 *   event_label: "Abrupte Organ-Vakanz & Rücktritt",
 *   event_keywords: [...],
 *   region_id: "EU_UK",
 *   region: "Europa + UK (Gesamtmarkt)",
 *   target_sources: [...],
 *   source_keywords: "EQS, LSE RNS, SHAB, CNMV, AMF",
 *   time_range: "48h"
 * }
 */

import crypto from 'crypto';
import { callLLM } from './_shared/llm-core.mjs';
import { extractJson } from './_shared/schemas.mjs';
import { searchWithFallback } from './_shared/search-core.mjs';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

function authHeaders(token) {
  return {
    apikey: SUPABASE_KEY,
    Authorization: `Bearer ${token || SUPABASE_KEY}`,
    'Content-Type': 'application/json',
    Prefer: 'return=representation'
  };
}

// --- Deterministic Primary Source Queries for European Mandate Desk ---

function getDeterministicMandateQueries(eventType, regionId, keywords = []) {
  const queries = [];

  const isDach = regionId === 'DACH' || regionId === 'EU_UK' || !regionId;
  const isUk = regionId === 'UK_IRL' || regionId === 'EU_UK' || !regionId;
  const isWest = regionId === 'WEST_EU' || regionId === 'EU_UK';
  const isSouth = regionId === 'SOUTH_EU' || regionId === 'EU_UK';

  // 1. DACH Primärquellen (EQS News / DGAP, SHAB Schweiz, Wiener Börse)
  if (isDach) {
    if (eventType === 'organ_vakanz') {
      queries.push({
        query: 'site:eqs-news.com ("Vorstand" OR "CEO" OR "CFO") ("Rücktritt per sofort" OR "Amtsniederlegung" OR "abberufen")',
        focus: 'EQS News Ad-hoc Vorstandsrücktritt'
      });
      queries.push({
        query: 'site:shab.ch ("Mutation" OR "Tagesregister") ("Verwaltungsrat" OR "Geschäftsführer") "ausgeschieden"',
        focus: 'SHAB Schweiz Organmutation'
      });
    } else if (eventType === 'restrukturierung_cro') {
      queries.push({
        query: 'site:eqs-news.com ("StaRUG" OR "Eigenverwaltung" OR "Schutzschirm" OR "Restrukturierung" OR "CRO")',
        focus: 'EQS Sanierung & Restrukturierung'
      });
      queries.push({
        query: 'site:eqs-news.com ("Chief Restructuring Officer" OR "Restrukturierungsvorstand" OR "Sanierungsgutachten")',
        focus: 'EQS CRO Mandate'
      });
    } else if (eventType === 'not_governance_ar') {
      queries.push({
        query: 'site:eqs-news.com ("Aufsichtsrat" OR "Verwaltungsrat") ("übernimmt operative Führung" OR "interimistisch" OR "Interim-Vorstand")',
        focus: 'EQS Not-Governance & AR-Interim'
      });
    } else if (eventType === 'm_and_a_board') {
      queries.push({
        query: 'site:eqs-news.com ("Vorstandsumbau" OR "Squeeze-Out" OR "Delisting" OR "Vollzug der Übernahme")',
        focus: 'EQS M&A Organumbau'
      });
    } else if (eventType === 'carveout_pe') {
      queries.push({
        query: 'site:eqs-news.com ("Carve-Out" OR "Spin-Off" OR "Portfolio-Gesellschaft") ("neuer Vorstand" OR "Geschäftsführung")',
        focus: 'EQS PE & Carve-Out Lead'
      });
    } else if (eventType === 'finanz_sondersituation') {
      queries.push({
        query: 'site:eqs-news.com ("Refinanzierung" OR "Debt Restructuring" OR "Anleihegläubiger" OR "Covenant")',
        focus: 'EQS Finanzielle Sondersituation'
      });
    }
  }

  // 2. UK & Irland Primärquellen (London Stock Exchange RNS, Investegate)
  if (isUk) {
    if (eventType === 'organ_vakanz') {
      queries.push({
        query: 'site:londonstockexchange.com ("Directorate Change" OR "Board Change") ("resignation" OR "stepping down" OR "immediate effect")',
        focus: 'LSE RNS Executive Directorate Change'
      });
      queries.push({
        query: 'site:investegate.co.uk ("resigns as CEO" OR "stands down from board" OR "directorate change")',
        focus: 'Investegate UK Directorate Resignation'
      });
    } else if (eventType === 'restrukturierung_cro') {
      queries.push({
        query: 'site:londonstockexchange.com ("restructuring plan" OR "turnaround" OR "interim management" OR "administration")',
        focus: 'LSE Restructuring & Turnaround'
      });
    } else if (eventType === 'not_governance_ar') {
      queries.push({
        query: 'site:londonstockexchange.com ("Interim Executive Chairman" OR "Non-Executive Director steps in" OR "Interim CEO")',
        focus: 'LSE RNS Interim Governance'
      });
    } else if (eventType === 'm_and_a_board') {
      queries.push({
        query: 'site:londonstockexchange.com ("Takeover Offer unconditional" OR "delisting" OR "board changes following acquisition")',
        focus: 'LSE Post-Merger Board Changes'
      });
    } else if (eventType === 'carveout_pe') {
      queries.push({
        query: 'site:londonstockexchange.com ("demerger" OR "spin-off" OR "divestment") ("new leadership" OR "board appointment")',
        focus: 'LSE Demerger & Carve-out'
      });
    } else if (eventType === 'finanz_sondersituation') {
      queries.push({
        query: 'site:londonstockexchange.com ("refinancing agreement" OR "covenant waiver" OR "debt restructuring")',
        focus: 'LSE Debt Sondersituation'
      });
    }
  }

  // 3. Westeuropa / Frankreich Primärquellen (AMF France, Euronext Paris)
  if (isWest) {
    if (eventType === 'organ_vakanz') {
      queries.push({
        query: 'site:amf-france.org OR site:euronext.com ("démission" OR "départ immédiat") ("Directeur Général" OR "Président du Conseil")',
        focus: 'AMF/Euronext Démission Dirigeant'
      });
    } else if (eventType === 'restrukturierung_cro') {
      queries.push({
        query: 'site:euronext.com ("redressement judiciaire" OR "procédure de sauvegarde" OR "restructuration financière")',
        focus: 'Euronext Sauvegarde & Restructuration'
      });
    } else if (eventType === 'not_governance_ar') {
      queries.push({
        query: 'site:euronext.com ("gouvernance par intérim" OR "Président-Directeur Général par intérim")',
        focus: 'France Gouvernance Intérim'
      });
    }
  }

  // 4. Südeuropa / Spanien Primärquellen (CNMV España, BME)
  if (isSouth) {
    if (eventType === 'organ_vakanz') {
      queries.push({
        query: 'site:cnmv.es ("dimisión" OR "renuncia" OR "cese") ("Consejero Delegado" OR "Presidente del Consejo")',
        focus: 'CNMV Dimisión Órgano de Administración'
      });
    } else if (eventType === 'restrukturierung_cro') {
      queries.push({
        query: 'site:cnmv.es ("concurso de acreedores" OR "plan de reestructuración")',
        focus: 'CNMV Concurso & Reestructuración'
      });
    }
  }

  // Fallback if needed
  if (queries.length === 0) {
    queries.push({
      query: `site:eqs-news.com "${eventType}" OR "Vorstand" OR "CEO"`,
      focus: 'EQS News Regulatory Fallback'
    });
    queries.push({
      query: `site:londonstockexchange.com "Directorate Change" "${eventType}"`,
      focus: 'LSE RNS Directorate Fallback'
    });
  }

  return queries;
}

// --- LLM: Suchstrategien generieren (mit europäischen Primärquellen) ---

async function generateSearchStrategies({
  eventType,
  eventLabel,
  eventKeywords,
  regionId,
  regionLabel,
  targetSources,
  sourceKeywords,
  customKeyword
}) {
  const deterministicQueries = getDeterministicMandateQueries(eventType, regionId, eventKeywords);

  if (customKeyword) {
    deterministicQueries.unshift({
      query: `(site:eqs-news.com OR site:londonstockexchange.com OR site:shab.ch OR site:amf-france.org OR site:cnmv.es) "${customKeyword}" ("Vorstand" OR "CEO" OR "CFO" OR "Director" OR "Restrukturierung")`,
      focus: `Custom Entity Search: ${customKeyword}`
    });
  }

  const messages = [
    {
      role: 'system',
      content: `Du bist ein European Board & C-Level Mandate Intelligence Analyst für den NeXus Mandate Origination Desk.
Generiere hochpräzise Suchstrategien für die Erkennung von mandatsrelevanten Sondersituationen in Europa (Board-Vakanzen, CRO-Restrukturierungen, Ad-hoc-Governance).

Zielquellen: ${sourceKeywords || 'EQS News, LSE RNS, SHAB, CNMV, AMF'}
Zielregion: ${regionLabel || 'Europa + UK (Gesamtmarkt)'}
Trigger: "${eventLabel || eventType}" (${Array.isArray(eventKeywords) ? eventKeywords.slice(0, 5).join(', ') : ''})

Gib als JSON-Objekt mit dem Key "strategies" zurück:
{ "strategies": [{ "query": "Präziser Suchbegriff mit site: Filter", "focus": "Fokus der Abfrage" }] }

REGELN:
- Binde die europäischen Primärquellen ein (site:eqs-news.com, site:londonstockexchange.com, site:shab.ch, site:amf-france.org, site:cnmv.es).
- Nutze Fachtermini der Pflichtmitteilungen (z.B. "Amtsniederlegung per sofort", "Directorate Change", "démission du directeur général", "dimisión consejero delegado", "StaRUG", "Schutzschirm").
- Keine generischen Werbetexte oder Marketing-Suchbegriffe.`
    },
    {
      role: 'user',
      content: `Trigger: ${eventLabel || eventType}
Region: ${regionLabel || 'Europa + UK'}
Primärquellen: ${sourceKeywords || 'EQS, LSE RNS, SHAB, CNMV, AMF'}
Zeitraum: Letzte 48 Stunden bis max 7 Tage`
    }
  ];

  try {
    const aiRes = await callLLM(messages, {
      profile: 'json',
      jsonMode: true,
      temperature: 0.3,
      max_tokens: 800,
      totalBudgetMs: 8000,
      providers: ['deepseek', 'mistral', 'groq'],
    });
    const parsed = extractJson(aiRes.text);
    const llmStrategies = parsed ? (Array.isArray(parsed) ? parsed : (parsed.strategies || parsed.queries || [])) : [];

    const seen = new Set();
    const combined = [];

    for (const item of [...deterministicQueries, ...llmStrategies]) {
      if (!item || !item.query) continue;
      const normalized = item.query.trim().toLowerCase();
      if (!seen.has(normalized)) {
        seen.add(normalized);
        combined.push(item);
      }
    }

    return combined.slice(0, 10);
  } catch (e) {
    console.warn('[Event Search] LLM Strategy generation failed, using deterministic primary feeds:', e.message);
    return deterministicQueries.slice(0, 8);
  }
}

// --- Content Hash ---

function contentHash(text) {
  return crypto.createHash('sha256').update(text || '').digest('hex');
}

// --- Main Handler ---

export async function handler(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  // ── 0. Zwingende Autorisierungsprüfung (Nur autorisierte Cron-Scheduler oder eingeloggte User) ──
  const reqHeaders = event?.headers || {};
  const authHeader = reqHeaders.authorization || reqHeaders.Authorization || '';
  const cronSecret = reqHeaders['x-cron-secret'] || reqHeaders['X-Cron-Secret'] || '';
  const expectedSecret = process.env.CRON_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

  const isSecretValid = Boolean(expectedSecret && cronSecret && cronSecret === expectedSecret);
  let userId = null;
  let userToken = null;

  if (authHeader) {
    const rawToken = authHeader.replace('Bearer ', '').trim();
    try {
      const authRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
        headers: {
          'apikey': process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || SUPABASE_KEY,
          'Authorization': `Bearer ${rawToken}`
        }
      });
      if (authRes.ok) {
        const u = await authRes.json();
        userId = u?.id;
        userToken = rawToken;
      }
    } catch (e) {
      console.warn('[Event Search] Token verification failed:', e.message);
    }
  }

  if (!isSecretValid && !userId) {
    return {
      statusCode: 401,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Unauthorized: Anmeldung oder gültiges Cron-Secret erforderlich.' })
    };
  }

  if (isSecretValid && !userId) {
    userId = 'system-cron';
    userToken = SUPABASE_KEY;
  }

  const headers = authHeaders(userToken || SUPABASE_KEY);

  try {
    const {
      event_type,
      event_label,
      event_keywords,
      region,
      region_id,
      target_sources,
      source_keywords,
      custom_keyword,
      time_range
    } = JSON.parse(event.body || '{}');

    if (!event_type) {
      return { statusCode: 400, body: JSON.stringify({ error: 'event_type required' }) };
    }

    console.log(`[Event Search] Start: type=${event_type}, region=${region || region_id || 'EU_UK'}, sources=${source_keywords || 'EQS, LSE RNS, SHAB, CNMV, AMF'}`);

    // 1. Suchstrategien generieren (Europäische Primärquellen)
    const strategies = await generateSearchStrategies({
      eventType: event_type,
      eventLabel: event_label,
      eventKeywords: event_keywords,
      regionId: region_id,
      regionLabel: region,
      targetSources: target_sources,
      sourceKeywords: source_keywords,
      customKeyword: custom_keyword
    });

    if (!strategies || strategies.length === 0) {
      return { statusCode: 500, body: JSON.stringify({ error: 'Strategy generation failed' }) };
    }

    console.log(`[Event Search] ${strategies.length} strategies generated for European primary sources`);

    // 2. Web Search via _shared/search-core.mjs (Brave -> DuckDuckGo -> Bing News RSS)
    const allResults = [];
    const maxQueries = Math.min(strategies.length, 10);

    for (let i = 0; i < maxQueries; i++) {
      const query = strategies[i].query;
      console.log(`[Event Search] Query ${i + 1}/${maxQueries}: ${query}`);

      const { results } = await searchWithFallback(query, { maxResults: 5 });
      allResults.push(...results.map(r => ({ ...r, _query: query })));
    }

    console.log(`[Event Search] ${allResults.length} raw results retrieved`);

    // 3. Deduplizierung + Speicherung in nexus_raw_events
    const rawEventIds = [];
    let deduplicated = 0;

    for (const result of allResults) {
      const cHash = contentHash(result.content || result.title || '');

      // URL-Hard-Dedup
      try {
        const dedupRes = await fetch(
          `${SUPABASE_URL}/rest/v1/nexus_raw_events?source_url=eq.${encodeURIComponent(result.url)}&select=id`,
          { headers }
        );
        if (dedupRes.ok) {
          const dedupData = await dedupRes.json();
          if (Array.isArray(dedupData) && dedupData.length > 0) {
            deduplicated++;
            rawEventIds.push(dedupData[0].id);
            continue;
          }
        }
      } catch (e) {
        console.warn('[Event Search] Dedup check failed:', e.message);
      }

      // Neues Raw Event
      try {
        const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/nexus_raw_events`, {
          method: 'POST',
          headers: { ...headers, Prefer: 'return=representation' },
          body: JSON.stringify({
            source_platform: 'european_regulatory_search',
            source_url: result.url,
            title: result.title || '',
            raw_content: result.content || result.snippet || '',
            content_hash: cHash,
            author: null,
            published_at: result.published_date || null
          })
        });
        if (insertRes.ok) {
          const insertData = await insertRes.json();
          if (Array.isArray(insertData) && insertData.length > 0) {
            rawEventIds.push(insertData[0].id);
          }
        } else {
          const errText = await insertRes.text();
          console.warn(`[Event Search] INSERT failed (${insertRes.status}):`, errText.substring(0, 200));
        }
      } catch (e) {
        console.warn('[Event Search] INSERT error:', e.message);
      }
    }

    console.log(`[Event Search] ${rawEventIds.length} raw events stored, ${deduplicated} deduplicated`);

    // 4. Event Extraction (async, für jedes Raw Event)
    const { extractEventFromRaw } = await import('./nexus-event-extraction.mjs');

    const extractedEvents = [];
    const extractionErrors = [];

    for (const rawId of rawEventIds) {
      try {
        const result = await extractEventFromRaw(rawId, userToken, userId);
        if (result.error) {
          extractionErrors.push({ rawId, error: result.error });
        } else if (result.event) {
          extractedEvents.push(result.event);
        }
      } catch (e) {
        extractionErrors.push({ rawId, error: e.message });
      }
    }

    console.log(`[Event Search] ${extractedEvents.length} events extracted, ${extractionErrors.length} errors`);

    // 5. Ergebnis
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        events: extractedEvents,
        stats: {
          strategies: strategies.length,
          searched: allResults.length,
          stored: rawEventIds.length,
          deduplicated,
          extracted: extractedEvents.length,
          errors: extractionErrors.length
        }
      })
    };

  } catch (err) {
    console.error('[Event Search] Error:', err.message);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: err.message })
    };
  }
}
