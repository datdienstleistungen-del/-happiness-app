/**
 * NeXus Event Search (Phase 0)
 *
 * Offering-unabhängige Event Discovery.
 *
 * Flow:
 * 1. Event-Type → Suchstrategien (LLM)
 * 2. Suchstrategien → Tavily Search (max 10 Queries)
 * 3. Rohdaten → nexus_raw_events (URL-Hash + Content-Hash Dedup)
 * 4. nexus_raw_events → Event Extraction (LLM)
 * 5. Extrahierte Events → nexus_events (Entity Resolution)
 *
 * Input: { event_type: "expansion", region: "Deutschland", time_range: "30d" }
 * Output: { events: [...], stats: { searched, extracted, deduplicated } }
 */

import crypto from 'crypto';
import { callLLM } from './_shared/llm-core.mjs';
import { extractJson } from './_shared/schemas.mjs';
import { getTavilyKeys, tavilySearch, searchDuckDuckGo } from './_shared/search-core.mjs';

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

// --- LLM: Suchstrategien generieren ---

async function generateSearchStrategies(eventType, region) {
  const messages = [
    {
      role: 'system',
      content: `Du bist ein B2B Intelligence Researcher. Generiere Suchstrategien für die Suche nach "${eventType}" Events in ${region || 'Deutschland'}.

Gib als JSON-Objekt mit dem Key "strategies" zurück:
{ "strategies": [{ "query": "Suchbegriff auf Deutsch", "focus": "Was wird gesucht" }] }

Generiere 5-8 Suchstrategien. Mische:
- Direkte Suchbegriffe (z.B. "Firmenerweiterung München")
- Branchenspezifische Begriffe
- REGION-spezifische Begriffe
- Synonyme und Varianten

WICHTIG: Alle Queries auf DEUTSCH. Keine englischen Suchbegriffe.`
    },
    {
      role: 'user',
      content: `Event-Typ: ${eventType}
Region: ${region || 'Deutschland'}
Zeitraum: Letzte 30 Tage`
    }
  ];

  try {
    // Kette via _shared/llm-core (Profile aus nexus-models, json_object-Mode).
    // Nur Groq wie bisher — kein bezahlter Fallback fuer diesen Cron.
    const aiRes = await callLLM(messages, {
      profile: 'json',
      jsonMode: true,
      temperature: 0.3,
      max_tokens: 800,
      totalBudgetMs: 12000,
      providers: ['groq'],
    });
    const parsed = extractJson(aiRes.text);
    if (!parsed) return null;
    return Array.isArray(parsed) ? parsed : (parsed.strategies || parsed.queries || []);
  } catch (e) {
    console.warn('[Event Search] Strategy generation failed:', e.message);
    return null;
  }
}

// --- Tavily Search ---

async function searchTavily(query, maxResults = 5) {
  for (const key of getTavilyKeys()) {
    const out = await tavilySearch(query, key, { maxResults, searchDepth: 'basic', includeRawContent: false, daysBack: 30 });
    if (out.ok) return out.results;
  }
  return [];
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

  const userToken = event.headers?.authorization?.replace('Bearer ', '') || SUPABASE_KEY;
  const headers = authHeaders(SUPABASE_KEY);

  // User-ID aus JWT dekodieren
  let userId = null;
  try {
    const parts = userToken.split('.');
    if (parts.length === 3) {
      const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
      userId = payload.sub;
    }
  } catch (e) { /* fallback below */ }
  if (!userId) userId = '00000000-0000-0000-0000-000000000000';

  try {
    const { event_type, region, time_range } = JSON.parse(event.body || '{}');

    if (!event_type) {
      return { statusCode: 400, body: JSON.stringify({ error: 'event_type required' }) };
    }

    console.log(`[Event Search] Start: type=${event_type}, region=${region || 'DE'}`);

    // 1. Suchstrategien generieren
    const strategies = await generateSearchStrategies(event_type, region);
    if (!strategies || strategies.length === 0) {
      return { statusCode: 500, body: JSON.stringify({ error: 'Strategy generation failed' }) };
    }

    console.log(`[Event Search] ${strategies.length} strategies generated`);

    // 2. Tavily Search (max 10 Queries)
    const allResults = [];
    const maxQueries = Math.min(strategies.length, 10);

    for (let i = 0; i < maxQueries; i++) {
      const query = strategies[i].query;
      console.log(`[Event Search] Query ${i + 1}/${maxQueries}: ${query}`);

      let results = await searchTavily(query, 5);
      if (results.length === 0) {
        results = await searchDuckDuckGo(query, { maxResults: 5 });
      }
      allResults.push(...results.map(r => ({ ...r, _query: query })));
    }

    console.log(`[Event Search] ${allResults.length} raw results`);

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
            source_platform: 'web_search',
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
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
}
