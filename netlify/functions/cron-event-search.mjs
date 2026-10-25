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
 * 2. Direkte European Regulatory RSS Feeds (EQS, LSE RNS, SHAB, CNMV, AMF) abfragen
 * 3. Suchstrategien → Web Search (Brave / DDG / Bing News RSS)
 * 4. Rohdaten → nexus_raw_events (URL-Hash + Content-Hash Dedup)
 * 5. nexus_raw_events → Event Extraction (LLM Gatekeeper)
 * 6. Vorverifizierte Opportunities aus nexus_opportunities einbinden
 * 7. Extrahierte Events → nexus_events (Entity Resolution)
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

// --- Direct Live European Regulatory RSS Feeds ---

async function fetchDirectRegulatoryRss(feedUrl, sourceLabel, region) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);
    const resp = await fetch(feedUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) NeXusMandateRadar/2.0',
        'Accept': 'application/rss+xml,application/xml,text/xml;q=0.9,*/*;q=0.8'
      }
    });
    clearTimeout(timeout);
    if (!resp.ok) return [];
    const xml = await resp.text();
    const items = [];
    const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
    let match;
    while ((match = itemRegex.exec(xml)) !== null && items.length < 15) {
      const block = match[1];
      const titleMatch = /<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i.exec(block);
      const linkMatch = /<link>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/link>/i.exec(block);
      const pubDateMatch = /<pubDate>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/pubDate>/i.exec(block);
      const descMatch = /<description>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/i.exec(block);

      const title = titleMatch ? titleMatch[1].replace(/<!\[CDATA\[|\]\]>/g, '').trim() : '';
      const link = linkMatch ? linkMatch[1].replace(/<!\[CDATA\[|\]\]>/g, '').trim() : '';
      const pubDate = pubDateMatch ? pubDateMatch[1].replace(/<!\[CDATA\[|\]\]>/g, '').trim() : null;
      const desc = descMatch ? descMatch[1].replace(/<[^>]+>/g, '').replace(/<!\[CDATA\[|\]\]>/g, '').trim() : '';

      if (title && link) {
        items.push({
          title,
          url: link,
          content: `${title}. ${desc}`.substring(0, 1500),
          snippet: desc.substring(0, 300),
          published_date: pubDate,
          _source: sourceLabel,
          _region: region
        });
      }
    }
    return items;
  } catch (e) {
    console.warn(`[Direct Regulatory RSS] Notice for ${sourceLabel}:`, e.message);
    return [];
  }
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

    // 1. Direkte Europäische Primärquellen per Live-RSS abfragen
    const directFeedPromises = [];
    if (region_id === 'DACH' || region_id === 'EU_UK' || !region_id) {
      directFeedPromises.push(
        fetchDirectRegulatoryRss('https://news.google.com/rss/search?q=(%22EQS+News%22+OR+%22Ad-hoc%22+OR+%22DGAP%22)+AND+(Vorstand+OR+Aufsichtsrat+OR+CEO+OR+CFO+OR+Amtsniederlegung+OR+StaRUG)&hl=de&gl=DE&ceid=DE:de&tbs=qdr:d', 'EQS News & Ad-hoc (DACH)', 'DACH')
      );
    }
    if (region_id === 'UK_IRL' || region_id === 'EU_UK' || !region_id) {
      directFeedPromises.push(
        fetchDirectRegulatoryRss('https://www.investegate.co.uk/Rss.aspx', 'London Stock Exchange RNS & Investegate (UK)', 'UK')
      );
    }
    if (region_id === 'CH' || region_id === 'DACH' || region_id === 'EU_UK') {
      directFeedPromises.push(
        fetchDirectRegulatoryRss('https://news.google.com/rss/search?q=(%22Handelsregister%22+OR+%22SHAB%22+OR+%22Mutationen%22)+AND+(%22Amtsniederlegung%22+OR+%22R%C3%BCcktritt%22+OR+%22Vorstand%22+OR+%22Gesch%C3%A4ftsf%C3%BChrer%22+OR+%22Verwaltungsrat%22+OR+%22Ausscheiden%22+OR+%22Interim%22)&hl=de-CH&gl=CH&ceid=CH:de&tbs=qdr:d', 'Schweizer SHAB Mutationen (CH)', 'CH')
      );
    }
    if (region_id === 'SOUTH_EU' || region_id === 'EU_UK') {
      directFeedPromises.push(
        fetchDirectRegulatoryRss('https://news.google.com/rss/search?q=(CNMV+OR+%22Mercado+Continuo%22+OR+%22Bolsas+y+Mercados%22)+AND+(dimision+OR+renuncia+OR+%22cese+de+funciones%22+OR+%22relevo+de+la+direccion%22+OR+%22nombramiento+interino%22+OR+%22consejero+delegado%22)&hl=es&gl=ES&ceid=ES:es&tbs=qdr:d', 'Mercado Continuo & CNMV (ES)', 'ES')
      );
    }
    if (region_id === 'WEST_EU' || region_id === 'EU_UK') {
      directFeedPromises.push(
        fetchDirectRegulatoryRss('https://news.google.com/rss/search?q=(Euronext+OR+AMF+OR+%22communiqu%C3%A9%22)+AND+(%22d%C3%A9mission%22+OR+%22d%C3%A9part%22+OR+%22int%C3%A9rim%22+OR+%22directeur+g%C3%A9n%C3%A9ral%22+OR+%22vacance+de+poste%22)&hl=fr&gl=FR&ceid=FR:fr&tbs=qdr:d', 'Euronext Paris & AMF (FR)', 'FR')
      );
    }

    const directRssResults = (await Promise.all(directFeedPromises)).flat();
    console.log(`[Event Search] ${directRssResults.length} live items retrieved from European primary feeds`);

    // 2. Suchstrategien generieren (Europäische Primärquellen)
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

    // 3. Web Search via _shared/search-core.mjs (Brave -> DuckDuckGo -> Bing News RSS)
    const allResults = [...directRssResults];
    const maxQueries = Math.min((strategies || []).length, 6);

    for (let i = 0; i < maxQueries; i++) {
      const query = strategies[i].query;
      console.log(`[Event Search] Query ${i + 1}/${maxQueries}: ${query}`);

      const { results } = await searchWithFallback(query, { maxResults: 4 });
      allResults.push(...results.map(r => ({ ...r, _query: query })));
    }

    console.log(`[Event Search] ${allResults.length} total raw results retrieved`);

    // 4. Deduplizierung + Speicherung in nexus_raw_events
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
            source_platform: result._source || 'european_regulatory_search',
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

    // 5. Vorverifizierte Opportunities aus nexus_opportunities abrufen
    const existingOpportunities = [];
    try {
      const oppQuery = [
        'select=id,title,company_name,notes,pain_point,summary,region,created_at,score,status,source',
        'status=in.(pending,verified)',
        'order=created_at.desc',
        'limit=10'
      ];
      if (region_id && region_id !== 'EU_UK') {
        oppQuery.push(`region=eq.${region_id}`);
      }
      const oppRes = await fetch(`${SUPABASE_URL}/rest/v1/nexus_opportunities?${oppQuery.join('&')}`, {
        headers
      });
      if (oppRes.ok) {
        const oppData = await oppRes.json();
        if (Array.isArray(oppData)) {
          for (const opp of oppData) {
            existingOpportunities.push({
              id: opp.id,
              event_type: event_type,
              title: opp.title,
              description: opp.notes || opp.pain_point || opp.summary || 'Verifiziertes Signal aus der europäischen Pflichtmitteilungs-Pipeline',
              company_name: opp.company_name || 'UNRESOLVED',
              country: opp.region || 'EU',
              event_date: opp.created_at,
              confidence: (opp.score ? opp.score / 100 : 0.95),
              verification_status: opp.status === 'verified' ? 'verified' : 'pending',
              source_url: opp.source
            });
          }
        }
      }
    } catch (e) {
      console.warn('[Event Search] Notice on opportunities lookup:', e.message);
    }

    // 6. Event Extraction (async, für die frischesten Raw Events)
    const { extractEventFromRaw } = await import('./nexus-event-extraction.mjs');

    const extractedEvents = [];
    const extractionErrors = [];

    // Limitiere Extraction auf maximal 8 frische Raw Events pro Klick für schnelle Response-Zeit
    for (const rawId of rawEventIds.slice(0, 8)) {
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

    console.log(`[Event Search] ${extractedEvents.length} events extracted, ${existingOpportunities.length} opportunities merged`);

    // 7. Kombinieren und Deduplizieren nach Titel
    const combinedEvents = [...existingOpportunities, ...extractedEvents];
    const seenTitles = new Set();
    const finalEvents = [];

    for (const evt of combinedEvents) {
      const key = (evt.title || '').trim().toLowerCase();
      if (!seenTitles.has(key)) {
        seenTitles.add(key);
        finalEvents.push(evt);
      }
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        events: finalEvents,
        stats: {
          strategies: (strategies || []).length,
          searched: allResults.length,
          stored: rawEventIds.length,
          deduplicated,
          extracted: extractedEvents.length,
          existing_signals: existingOpportunities.length,
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
