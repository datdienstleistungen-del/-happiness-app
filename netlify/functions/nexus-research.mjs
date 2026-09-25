import crypto from 'crypto';
import { GROQ_JSON_HEAVY, OPENROUTER_FREE_MODELS, MISTRAL_DEFAULT_MODEL, OPENAI_DEFAULT_MODEL } from './nexus-models.mjs';

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



async function searchDuckDuckGo(query, maxResults = 10) {
  try {
    const { res, timer } = await fetchWithTimeout(
      `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`,
      { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' } },
      8000
    );
    clearTimeout(timer);
    if (!res.ok) return null;
    const html = await res.text();
    const results = [];
    const linkRegex = /<a[^>]+class="result__a"[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;
    let match;
    while ((match = linkRegex.exec(html)) !== null && results.length < maxResults) {
      const href = match[1];
      const title = match[2].replace(/<[^>]*>/g, '').trim();
      let url = null;
      if (href.includes('uddg=')) {
        const uddgMatch = href.match(/uddg=([^&]*)/);
        if (uddgMatch) url = decodeURIComponent(uddgMatch[1]);
      } else if (href.startsWith('http')) {
        url = href;
      }
      const snippetRegex = /<a[^>]+class="result__snippet"[^>]*>([\s\S]*?)<\/a>/gi;
      snippetRegex.lastIndex = match.index + match[0].length;
      const snippetMatch = snippetRegex.exec(html);
      const snippet = snippetMatch ? snippetMatch[1].replace(/<[^>]*>/g, '').trim() : '';
      if (url && title) {
        results.push({ url, title, snippet });
      }
    }
    return results.length > 0 ? results : null;
  } catch (e) {
    return null;
  }
}

async function callAI(messages, { temperature = 0.3, max_tokens = 4096, jsonMode = false } = {}) {
  // 1. Groq (High Speed & Free/Low-Cost Priority)
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
        }, 6500);
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
            'X-Title': 'NeXus Research'
          },
          body: JSON.stringify({ model, messages, temperature, max_tokens })
        }, 6500);
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
      const payload = { model: MISTRAL_DEFAULT_MODEL, messages, temperature, max_tokens };
      if (jsonMode) payload.response_format = { type: 'json_object' };
      const { res, timer } = await fetchWithTimeout('https://api.mistral.ai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${mistralKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }, 6500);
      if (res.ok) {
        const data = await res.json();
        clearTimeout(timer);
        const text = data.choices?.[0]?.message?.content;
        if (text) return { text, provider: 'mistral', model: MISTRAL_DEFAULT_MODEL };
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
      const payload = { model: OPENAI_DEFAULT_MODEL, messages, temperature, max_tokens };
      if (jsonMode) payload.response_format = { type: 'json_object' };
      const { res, timer } = await fetchWithTimeout('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${openaiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }, 6500);
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

  throw new Error('Alle KI-Provider sind derzeit ausgelastet oder nicht erreichbar. Bitte versuche es in wenigen Augenblicken erneut.');
}

let inFlightResearch = 0;
const MAX_CONCURRENT_RESEARCH = 20;

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  // ── 0. Kill-Switch & Concurrency Guards (Launch Day Safety) ──
  const isResearchEnabled = process.env.NEXUS_RESEARCH_ENABLED !== 'false';
  if (!isResearchEnabled) {
    console.log('[nexus-research] Kill-Switch active (NEXUS_RESEARCH_ENABLED=false). Returning graceful paused response.');
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: "temporarily_unavailable",
        message: "NeXus is experiencing high demand right now. Research is temporarily paused. Please try again shortly.",
        trigger_events: []
      })
    };
  }

  if (inFlightResearch >= MAX_CONCURRENT_RESEARCH) {
    console.warn(`[nexus-research] Concurrency limit reached (${inFlightResearch}/${MAX_CONCURRENT_RESEARCH}). Returning graceful busy state.`);
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: "temporarily_unavailable",
        message: "NeXus is experiencing high demand right now. Research capacity is temporarily full. Please try again shortly.",
        trigger_events: []
      })
    };
  }

  inFlightResearch++;

  try {
    const body = event.body ? JSON.parse(event.body) : {};
    const ctx = body.opportunityContext || {};
    const rawSearchQuery = body.searchQuery || ctx.company?.name || (typeof ctx.company === 'string' ? ctx.company : '') || ctx.searchQuery || '';
    const branche = body.branche || ctx.company?.industry || ctx.branche || '';
    const lang = body.lang || ctx.lang || 'de';
    const offeringId = body.offeringId || ctx.offering_id || ctx.offering?.id || null;
    const isLandingPreview = body.isLandingPreview === true;
    const angebot = body.angebot || ctx.offering?.offering_name || (typeof ctx.offering === 'string' ? ctx.offering : '') || ctx.angebot || '';

    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
    const serviceKey = process.env.SUPABASE_SERVICE_KEY;

    let user = null;
    let isPreview = isLandingPreview === true;
    const reqHeaders = event.headers || {};
    const authHeader = reqHeaders.authorization || reqHeaders.Authorization;
    const token = authHeader ? authHeader.replace('Bearer ', '').trim() : '';

    if (token && token !== 'undefined' && token !== 'null' && supabaseUrl && supabaseKey) {
      try {
        const userRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
          headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${token}` }
        });
        if (userRes.ok) {
          user = await userRes.json();
        }
      } catch (err) {
        console.warn("User auth verification failed:", err.message);
      }
    }

    if (!user && !isPreview) {
      // If not authenticated and not explicitly in preview mode, default to preview if on landing page
      isPreview = true;
    }

    // 2. Rate Limiting Check (only for authenticated non-preview users via PostgREST)
    if (user && user.id && !isPreview && supabaseUrl && supabaseKey) {
      let isPremium = false;
      let premiumTier = 'free';
      try {
        const settingsRes = await fetch(`${supabaseUrl}/rest/v1/ai_settings?user_id=eq.${user.id}&select=is_premium,premium_tier`, {
          headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${token}` }
        });
        if (settingsRes.ok) {
          const settingsData = await settingsRes.json();
          isPremium = settingsData[0]?.is_premium === true;
          premiumTier = settingsData[0]?.premium_tier || 'free';
        }
      } catch(e) {}

      const TIER_LIMITS = { free: 5, pro: 100, enterprise: 500 };
      const MAX_REQUESTS = TIER_LIMITS[premiumTier] || 5;
      const today = new Date().toISOString().split('T')[0];
      
      const usageRes = await fetch(`${supabaseUrl}/rest/v1/nexus_api_usage?user_id=eq.${user.id}&select=*`, {
        headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${token}` }
      });
      
      if (usageRes.ok) {
        const usageData = await usageRes.json();
        const usage = usageData.length > 0 ? usageData[0] : null;
          
        if (!usage) {
          await fetch(`${supabaseUrl}/rest/v1/nexus_api_usage`, {
            method: 'POST',
            headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${serviceKey}`, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
            body: JSON.stringify({ user_id: user.id, requests_today: 1, last_request_date: today })
          }).catch(() => {});
        } else {
          let newCount = usage.requests_today;
          if (usage.last_request_date !== today) {
            newCount = 1; 
          } else {
            newCount += 1;
          }
          
          if (newCount > MAX_REQUESTS) {
            return { statusCode: 429, body: JSON.stringify({ error: `Rate limit exceeded. Max ${MAX_REQUESTS} requests per day.` }) };
          }
          
          await fetch(`${supabaseUrl}/rest/v1/nexus_api_usage?user_id=eq.${user.id}`, {
            method: 'PATCH',
            headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${serviceKey}`, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
            body: JSON.stringify({ requests_today: newCount, last_request_date: today })
          }).catch(() => {});
        }
      }
    }

    // Signal-Strategien laden (wenn Offering-ID vorhanden)
    let searchQuery = rawSearchQuery;
    if (offeringId && user && user.id) {
      try {
        const stratRes = await fetch(`${supabaseUrl}/rest/v1/nexus_signal_strategies?offering_id=eq.${offeringId}&select=search_queries`, {
          headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${token}` }
        });
        if (stratRes.ok) {
          const strats = await stratRes.json();
          const queries = [];
          for (const s of strats) {
            if (Array.isArray(s.search_queries)) {
              for (const sq of s.search_queries) {
                if (sq.query) queries.push(sq.query);
              }
            }
          }
          if (queries.length > 0) {
            searchQuery = branche
              ? queries.find(q => q.toLowerCase().includes(branche.toLowerCase())) || queries[0]
              : queries[0];
            console.log(`[Signal Strategy] Using query: "${searchQuery}" (from ${queries.length} strategies)`);
          }
        }
      } catch (e) {
        console.warn(`[Signal Strategy] Fehler beim Laden, nutze Fallback-Query:`, e.message);
      }
    }

    if (!searchQuery && (branche || angebot)) {
      searchQuery = `${branche || ''} ${angebot ? angebot.slice(0, 80) : ''} Expansion Investition Modernisierung`.trim();
    }

    // Intelligent Buyer & Market Search Queries: Target companies experiencing buying events
    const contextText = `${searchQuery || ''} ${branche || ''} ${angebot || ''}`.toLowerCase();
    const searchQueriesToTry = [];
    
    if (contextText.includes('it') || contextText.includes('software') || contextText.includes('crm') || contextText.includes('cloud') || contextText.includes('saas') || contextText.includes('tech')) {
      searchQueriesToTry.push('IT-Dienstleister OR Softwarehaus OR IT-Systemhaus expandiert ODER Übernahme ODER Wachstum');
      searchQueriesToTry.push('IT-Systemhaus expandiert ODER neue Niederlassung ODER Übernahme');
      searchQueriesToTry.push('Softwareunternehmen Wachstum Finanzierung Neugeschäft');
    } else if (contextText.includes('logistik') || contextText.includes('transport') || contextText.includes('spedition')) {
      searchQueriesToTry.push('Logistikunternehmen OR Spedition neue Niederlassung ODER Expansion ODER Übernahme');
      searchQueriesToTry.push('Transportlogistik Lagerneubau Expansion Investition');
    } else if (contextText.includes('bau') || contextText.includes('halle') || contextText.includes('immobilie')) {
      searchQueriesToTry.push('Gewerbebau Neubau Logistikzentrum Spatenstich Baugenehmigung');
      searchQueriesToTry.push('Industriebau Hallenbau Spatenstich Expansion');
    } else if (contextText.includes('beratung') || contextText.includes('consulting') || contextText.includes('agentur')) {
      searchQueriesToTry.push('Unternehmensberatung Agentur Fusion ODER Expansion ODER Übernahme');
    } else if (branche && branche !== 'B2B Entscheider') {
      searchQueriesToTry.push(`${branche} expandiert ODER Übernahme ODER Wachstum ODER Neueröffnung`);
    }

    if (searchQuery && searchQuery.length < 80 && !searchQuery.toLowerCase().includes('cloudbasierte')) {
      searchQueriesToTry.unshift(searchQuery);
    }
    
    searchQueriesToTry.push('Mittelstand Unternehmen Expansion ODER Übernahme ODER Investition');

    // Multi-key Tavily with failover & DuckDuckGo fallback
    const tavilyKeys = [
      process.env.TAVILY_API_KEY,
      process.env.TAVILY_API_KEY_2,
      process.env.VITE_TAVILY_API_KEY
    ].filter(Boolean);

    let tavilyData = null;
    let searchSource = 'Tavily Deep Search';

    const B2B_NEWS_DOMAINS = [
      'pressebox.de', 'openpr.de', 'it-business.de', 'crn.de', 'handelsblatt.com', 
      'wiwo.de', 'unternehmensboerse.de', 'northdata.de', 'bundesanzeiger.de',
      'heise.de', 'golem.de', 'computerwoche.de'
    ];

    for (const q of searchQueriesToTry) {
      if (tavilyData && tavilyData.results && tavilyData.results.length > 0) break;

      for (const key of tavilyKeys) {
        try {
          // 1. Priorität: Gezielte Suche auf B2B- & Wirtschafts-Nachrichtenportalen
          let tavilyRes = await fetch("https://api.tavily.com/search", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              api_key: key,
              query: q,
              search_depth: "advanced",
              include_answer: false,
              max_results: 10,
              include_domains: B2B_NEWS_DOMAINS
            })
          });

          if (tavilyRes.ok) {
            const data = await tavilyRes.json();
            if (data && data.results && data.results.length > 0) {
              tavilyData = data;
              break;
            }
          }

          // 2. Priorität: Allgemeine Web-Suche
          tavilyRes = await fetch("https://api.tavily.com/search", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              api_key: key,
              query: `${q} 2026`,
              search_depth: "advanced",
              include_answer: false,
              max_results: 10,
              topic: "general"
            })
          });

          if (tavilyRes.ok) {
            const data = await tavilyRes.json();
            if (data && data.results && data.results.length > 0) {
              tavilyData = data;
              break;
            }
          }
        } catch (keyErr) {
          console.warn(`[nexus-research] Tavily Fetch Error:`, keyErr.message);
        }
      }
    }

    // Ultimativer Fallback: DuckDuckGo falls alle Tavily Keys erschöpft sind
    if (!tavilyData || !tavilyData.results || tavilyData.results.length === 0) {
      console.log(`[nexus-research] Alle Tavily Keys erschöpft/nicht verfügbar. Aktiviere DuckDuckGo Fallback-Suche...`);
      for (const q of searchQueriesToTry) {
        try {
          const ddgResults = await searchDuckDuckGo(q, 10);
          if (ddgResults && ddgResults.length > 0) {
            tavilyData = {
              results: ddgResults.map(r => ({
                url: r.url,
                title: r.title,
                content: r.snippet,
                published_date: new Date().toISOString()
              }))
            };
            searchSource = 'DuckDuckGo Search (Fallback)';
            break;
          }
        } catch (ddgErr) {
          console.warn(`[nexus-research] DuckDuckGo Fallback Error:`, ddgErr.message);
        }
      }
    }

    console.log('[nexus-research] tavilyData count:', tavilyData?.results?.length);
    if (!tavilyData || !tavilyData.results || tavilyData.results.length === 0) {
      console.log('[nexus-research] Returning early due to empty tavilyData');
      return {
        statusCode: 200,
        body: JSON.stringify({ trigger_events: [] }),
        headers: { "Content-Type": "application/json" }
      };
    }

    // --- STUFE 4.5: CONTENT SAFETY & BLACKLIST FILTERING ---
    const BANNED_DOMAINS = [
      'gofundme.com', 'reddit.com/r/medical', 'reddit.com/r/askdocs', 'reddit.com/r/suicidewatch',
      'reddit.com/r/depression', 'reddit.com/r/relationship_advice', 'webmd.com', 'healthline.com'
    ];
    
    const BANNED_KEYWORDS = [
      'suicide', 'selbstmord', 'cancer', 'krebs', 'diagnose', 'diagnosis', 'tumor', 
      'death', 'tod', 'gestorben', 'passed away', 'krankenhaus', 'hospital',
      'domestic violence', 'häusliche gewalt', 'abuse', 'missbrauch',
      'anxiety', 'angststörung', 'ptsd', 'selfharm', 'selbstverletzung',
      'addiction', 'sucht', 'entzug', 'miscarriage', 'fehlgeburt',
      'pregnancy', 'schwangerschaft', 'depression'
    ];

    const safeResults = tavilyData.results.filter(r => {
      const lowerUrl = (r.url || '').toLowerCase();
      const lowerText = ((r.title || '') + ' ' + (r.content || '')).toLowerCase();
      
      // 1. Domain Check
      if (BANNED_DOMAINS.some(domain => lowerUrl.includes(domain))) return false;
      
      // 2. Keyword Check
      if (BANNED_KEYWORDS.some(kw => lowerText.includes(kw))) return false;
      
      return true;
    });

    console.log('[nexus-research] safeResults count:', safeResults.length);
    if (safeResults.length === 0) {
      console.log('[nexus-research] Returning early due to empty safeResults');
      return {
        statusCode: 200,
        body: JSON.stringify({ trigger_events: [] }),
        headers: { "Content-Type": "application/json" }
      };
    }

    // --- STUFE 4.6: SYNC DB INSERT (Phase A Inbox) ---
    let hitIdMap = {}; 
    if (offeringId && user && user.id) {
      try {
        const rowsToInsert = safeResults.map(r => {
          const hash = crypto.createHash('md5').update(r.url || '').digest('hex');
          return {
            user_id: user.id,
            offering_id: offeringId,
            url: r.url,
            url_hash: hash,
            source: 'Tavily Deep Search',
            title: r.title || '',
            raw_content: r.content || '',
            published_at: r.published_date || null,
            status: 'pending'
          };
        });
        
        const insertRes = await fetch(`${supabaseUrl}/rest/v1/nexus_radar_hits?on_conflict=user_id,offering_id,url_hash&select=id,url`, {
          method: 'POST',
          headers: { 
            'apikey': supabaseKey, 
            'Authorization': `Bearer ${token}`, 
            'Content-Type': 'application/json',
            'Prefer': 'resolution=ignore-duplicates,return=representation' 
          },
          body: JSON.stringify(rowsToInsert)
        });
        
        if (insertRes.ok) {
          const insertedData = await insertRes.json();
          if (Array.isArray(insertedData)) {
            insertedData.forEach(row => {
              hitIdMap[row.url] = row.id;
            });
          }
        } else {
          console.error("DB Insert Fehler (Hits):", await insertRes.text());
        }
      } catch (err) {
        console.error("Exception beim DB-Insert der Radar Hits:", err.message);
        // Live-Scan läuft trotzdem weiter!
      }
    }

    const webContext = safeResults.map(r => `Hit-ID: ${hitIdMap[r.url] || 'none'}\nTitel: ${r.title}\nInhalt: ${r.content}\nURL: ${r.url}`).join('\n\n---\n\n');
    
    // --- STUFE 5: KI bewertet Relevanz ---
    const languageNames = { de: 'Deutsch (German)', en: 'Englisch (English)', es: 'Spanisch (Spanish)', fr: 'Französisch (French)', it: 'Italienisch (Italian)', nl: 'Niederländisch (Dutch)' };
    const langName = languageNames[lang] || 'Deutsch (German)';
    const langInstruction = `\n\nSPRACH- & AUSWERTUNGS-VORGABE (MANDATORISCH):
- Der Nutzer analysiert weltweite B2B-Märkte und benötigt alle Auswertungen in ${langName}.
- Du akzeptierst weltweite, internationale und nationale B2B-Unternehmen (z.B. USA, Europa, Lateinamerika, Asien, DACH).
- Alle ausgegebenen Werte im JSON (Signal, Bewertung, Relevanz, Psychologische Ansprache, Position, Branche) MÜSSEN für den Vertriebler verständlich und professionell in ${langName} formuliert sein.
- Wenn eine Meldung aus dem Ausland (z.B. USA, Spanien, Polen, Frankreich) stammt, analysiere das Kaufsignal und begründe die Relevanz präzise in ${langName}.`;

    const currentIsoDate = new Date().toISOString().split('T')[0];
    const currentYear = new Date().getFullYear();
    const currentMonthYear = new Date().toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });

    const systemPrompt = `Du bist die zentrale Intelligence Engine für das "Nexus Sales Operation System" und ein brillanter B2B-Verkaufspsychologe.
    Hier ist ein Daten-Pool aus echten Internet- und Wirtschaftsquellen zu folgenden Suchbegriffen: "${searchQuery}".
    Angebot / Kontext des Nutzers: "${angebot || searchQuery || 'B2B Software & Services'}" (Branche/Zielgruppe: "${branche || 'B2B'}").
    
    DEIN ZIEL: Finde konkrete, namentlich genannte B2B-Unternehmen aus den Web-Ergebnissen, die aufgrund der aktuellen News/Signale HEUTE einen aktiven Bedarf an unserem Angebot haben.
    
    # KAUFSIGNAL-KATEGORIEN (TRIGGER TYPES):
    1. EXPANSION & WACHSTUM: Eröffnung neuer Standorte, Internationalisierung, Umsatzwachstum, Personalaufbau, Skalierung.
    2. FÜHRUNGS- & STRATEGIEWECHSEL: Neuer Geschäftsführer, neuer Vertriebsleiter, Reorganisation, Neuausrichtung.
    3. M&A & INVESTITIONEN: Übernahmen, Fusionen, Finanzierungsrunden, Investitionsprogramme, Modernisierungen.
    4. SYSTEMWECHSEL & DIGITALISIERUNG: Ablösung alter Systeme, Tool-Wechsel, Digitalisierungsprojekte, Prozessoptimierung.
    5. NEUES PRODUKT / PROJEKTE: Neue Produktlinien, Großaufträge, neue Marktsegmente.
    
    # STRIKTE REGELN:
    1. AKZEPTIERE NUR ECHTE UNTERNEHMEN: Nutze ausschließlich reale Firmennamen, die explizit in den Web-Ergebnissen genannt werden. Erfinde NIEMALS Firmen.
    2. MATCHING ZUM ANGEBOT: Erkläre präzise, warum dieses Ereignis eine Verkaufschance für das analysierte Angebot ("${angebot || searchQuery}") darstellt.
    3. KEINE HALLUZINIERTEN KONTAKTE: "ansprechpartner" und "kontakt" dürfen NUR befüllt werden, wenn sie wörtlich im Quelltext stehen. Sonst MUSS der Wert null sein.
    4. QUELLEN: "quelle" MUSS die echte URL aus dem Quelltext sein.
    ${langInstruction}
    
    DEINE AUFGABE: Werte die gefundenen Leads aus und SORTIERE SIE nach Priorität (1 ist der absolut beste Lead).
    
    Gib ein JSON-Objekt mit EXAKT folgender Struktur zurück:
    {
      "trigger_events": [
        {
          "hit_id": "Die exakte Hit-ID aus den Quelldaten (kopiere sie 1:1, falls 'none' dann weglassen)",
          "firmenname": "Echter Firmenname aus dem Quelltext",
          "branche": "Branche des Zielunternehmens",
          "prioritaet": 1,
          "bewertung": "A - Höchste Chance. Warum?",
          "signal": "Was ist konkret passiert? (z.B. Senacor übernimmt Finanteq zur Expansion; Bechtle wächst stark im Cloud-Bereich)",
          "relevanz": "Kurze Begründung der Relevanz für das Angebot in 1 Satz",
          "ansprechpartner": null,
          "position": null,
          "kontakt": null,
          "quelle": "Die exakte echte URL aus den Suchergebnissen",
          "psychologische_ansprache": "Wie muss der Vertriebler dieses Signal vertrieblich ansprechen?"
        }
      ]
    }`;

    console.log('[nexus-research] Calling LLM with webContext length:', webContext.length);
    const triggerLlmResult = await callAI([
      { role: "system", content: systemPrompt },
      { role: "user", content: `Web-Recherche Ergebnisse:\n\n${webContext}` }
    ], { temperature: 0.3, max_tokens: 4096, jsonMode: true });

    let content = triggerLlmResult.text;
    console.log('[nexus-research] LLM raw content:\n', content);
    
    // Markdown JSON-Blöcke bereinigen, falls nötig
    content = content.replace(/```(?:json)?/g, '').replace(/```/g, '').trim();
    
    let parsed = { trigger_events: [] };
    try {
      parsed = JSON.parse(content);
      console.log('[nexus-research] Parsed trigger_events count:', parsed.trigger_events?.length);
      
      // Post-Processing: Quell-URLs absichern und Defaults setzen falls LLM Felder auslässt
      if (parsed.trigger_events && Array.isArray(parsed.trigger_events)) {
        parsed.trigger_events = parsed.trigger_events.map((t, idx) => {
          const matchedSource = safeResults.find(r => r.url === t.quelle) || safeResults[idx % safeResults.length];
          return {
            ...t,
            branche: t.branche || branche || 'B2B / Mittelstand',
            relevanz: t.relevanz || t.bewertung || 'Hohe Passgenauigkeit für das analysierte Leistungsportfolio.',
            ansprechpartner: t.ansprechpartner && typeof t.ansprechpartner === 'string' && !t.ansprechpartner.includes('z.B.') ? t.ansprechpartner : null,
            position: t.position && typeof t.position === 'string' && !t.position.includes('z.B.') ? t.position : null,
            kontakt: t.kontakt && typeof t.kontakt === 'string' && !t.kontakt.includes('z.B.') && !t.kontakt.includes('unternehmen.de') ? t.kontakt : null,
            quelle: matchedSource ? matchedSource.url : (t.quelle || 'https://www.bundesanzeiger.de')
          };
        });

        // Update DB status for relevant hits (only if user and db present)
        if (user && user.id && supabaseUrl && supabaseKey) {
          const relevantIds = parsed.trigger_events.map(t => t.hit_id).filter(id => id && id !== 'none');
          if (relevantIds.length > 0) {
            try {
              await fetch(`${supabaseUrl}/rest/v1/nexus_radar_hits?id=in.(${relevantIds.join(',')})`, {
                method: 'PATCH',
                headers: { 
                  'apikey': supabaseKey, 
                  'Authorization': `Bearer ${token}`, 
                  'Content-Type': 'application/json',
                  'Prefer': 'return=minimal'
                },
                body: JSON.stringify({ status: 'relevant' })
              });
            } catch (e) {
              console.error("Fehler beim Update des Hit-Status:", e.message);
            }
          }
        }
      }
    } catch (e) {
      console.error("Fehler beim Parsen der LLM-Antwort (Research):", content);
      parsed = { trigger_events: [] };
    }

    return {
      statusCode: 200,
      body: JSON.stringify(parsed),
      headers: { "Content-Type": "application/json" }
    };
  } catch (error) {
    console.error("Backend Research Error:", error);
    return {
      statusCode: 200,
      body: JSON.stringify({ 
        status: "error",
        message: error.message || "NeXus Research temporarily unavailable.",
        trigger_events: [] 
      }),
      headers: { "Content-Type": "application/json" }
    };
  } finally {
    inFlightResearch = Math.max(0, inFlightResearch - 1);
  }
};
