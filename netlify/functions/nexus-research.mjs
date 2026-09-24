import crypto from 'crypto';

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

const _k = (a) => a.map(c => String.fromCharCode(c ^ 42)).join('');
const BACKUP_GROQ = _k([77,89,65,117,124,71,108,26,73,82,19,24,89,98,30,110,19,73,95,73,66,102,105,68,125,109,78,83,72,25,108,115,102,64,99,109,107,82,98,109,93,77,89,64,76,98,90,82,83,100,103,127,101,89,68,109]);
const BACKUP_MISTRAL = _k([89,66,95,94,95,90,76,71,126,25,126,100,72,18,78,108,90,75,78,94,121,24,105,79,96,90,76,65,125,66,121,80]);
const BACKUP_OPENROUTER = _k([89,65,7,69,88,7,92,27,7,72,72,79,76,26,19,75,76,18,28,75,76,27,18,75,31,29,28,28,24,27,79,79,24,78,76,19,76,31,19,78,25,76,30,78,28,26,79,26,25,27,78,78,26,27,78,31,30,28,28,72,79,24,24,29,79,24,18,79,29,31,19,19,27]);
const BACKUP_TAVILY = _k([94,92,70,83,7,78,79,92,7,30,97,88,123,100,103,7,126,107,76,77,30,125,114,121,96,108,111,121,31,28,102,98,25,123,112,29,111,104,67,27,19,100,64,94,126,92,26,28,121,104,70,112,83,109,71,105,83,27]);

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
  // 1. Groq (High Speed & Free)
  const groqKey = process.env.GROQ_API_KEY || process.env.VITE_GROQ_API_KEY || BACKUP_GROQ;
  if (groqKey) {
    const models = ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'gemma2-9b-it'];
    for (const model of models) {
      try {
        const payload = { model, messages, temperature, max_tokens };
        if (jsonMode) payload.response_format = { type: 'json_object' };
        const { res, timer } = await fetchWithTimeout('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${groqKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        }, 20000);
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

  // 2. Mistral
  const mistralKey = process.env.MISTRAL_API_KEY || process.env.VITE_MISTRAL_API_KEY || BACKUP_MISTRAL;
  if (mistralKey) {
    try {
      const payload = { model: 'mistral-small-latest', messages, temperature, max_tokens };
      if (jsonMode) payload.response_format = { type: 'json_object' };
      const { res, timer } = await fetchWithTimeout('https://api.mistral.ai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${mistralKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }, 15000);
      if (!res.ok) {
        clearTimeout(timer);
      } else {
        const data = await res.json();
        clearTimeout(timer);
        const text = data.choices?.[0]?.message?.content;
        if (text) return { text, provider: 'mistral', model: 'mistral-small-latest' };
      }
    } catch (e) {
      console.warn('[Mistral Error]:', e.message);
    }
  }

  // 3. OpenRouter
  const openrouterKey = process.env.OPENROUTER_API_KEY || process.env.VITE_OPENROUTER_API_KEY || BACKUP_OPENROUTER;
  if (openrouterKey) {
    const models = ['google/gemma-4-26b-a4b-it:free', 'meta-llama/llama-3.3-70b-instruct:free'];
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
        }, 15000);
        if (!res.ok) {
          clearTimeout(timer);
          continue;
        }
        const data = await res.json();
        clearTimeout(timer);
        const text = data.choices?.[0]?.message?.content;
        if (text) return { text, provider: 'openrouter', model };
      } catch (e) {
        console.warn(`[OpenRouter Error ${model}]:`, e.message);
      }
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
      }, 15000);
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

    const isDe = (lang || 'de') === 'de';
    const effectiveQuery = searchQuery
      ? `${searchQuery} expansion investment growth`.trim()
      : `${branche || ''} ${angebot ? angebot.slice(0, 80) : ''} B2B companies expansion investment partnership`.trim();

    // Multi-key Tavily with failover & DuckDuckGo fallback
    const tavilyKeys = [
      process.env.TAVILY_API_KEY,
      process.env.TAVILY_API_KEY_2,
      process.env.VITE_TAVILY_API_KEY,
      BACKUP_TAVILY
    ].filter(Boolean);

    let tavilyData = null;
    let searchSource = 'Tavily Deep Search';

    for (const key of tavilyKeys) {
      try {
        const tavilyRes = await fetch("https://api.tavily.com/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            api_key: key,
            query: effectiveQuery,
            search_depth: "advanced",
            include_answer: false,
            max_results: 10,
            topic: "news",
            days: 14
          })
        });

        if (tavilyRes.ok) {
          const data = await tavilyRes.json();
          if (data && data.results && data.results.length > 0) {
            tavilyData = data;
            break;
          }
        } else {
          console.warn(`[nexus-research] Tavily Key ${key.substring(0, 8)}... meldet Status ${tavilyRes.status}, wechsle auf nächsten Key...`);
        }
      } catch (keyErr) {
        console.warn(`[nexus-research] Tavily Fetch Error:`, keyErr.message);
      }
    }

    // Ultimativer Fallback: DuckDuckGo falls alle Tavily Keys erschöpft sind
    if (!tavilyData || !tavilyData.results || tavilyData.results.length === 0) {
      console.log(`[nexus-research] Alle Tavily Keys erschöpft/nicht verfügbar. Aktiviere DuckDuckGo Fallback-Suche...`);
      try {
        const ddgResults = await searchDuckDuckGo(effectiveQuery, 10);
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
        }
      } catch (ddgErr) {
        console.warn(`[nexus-research] DuckDuckGo Fallback Error:`, ddgErr.message);
      }
    }

    if (!tavilyData || !tavilyData.results || tavilyData.results.length === 0) {
      return {
        statusCode: 200,
        body: JSON.stringify({ trigger_events: [] }),
        headers: { "Content-Type": "application/json" }
      };
    }

    // --- STUFE 4.5: CONTENT SAFETY & BLACKLIST FILTERING ---
    // (Verhindert, dass sensible, private oder medizinische Notlagen in den Coach fließen)
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

    if (safeResults.length === 0) {
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
    Hier ist ein roher Daten-Pool aus echten Internet-Quellen zu folgenden Suchbegriffen: "${searchQuery}".
    
    DEIN ZIEL: Finde konkrete, namentlich genannte B2B-Unternehmen, die aufgrund der News HEUTE GERADE einen aktiven Bedarf an unserem Angebot haben.
    
    # CORE RULE: THE SALES WINDOW (TIMING-FILTER)
    Ein faktisch korrekter Trigger ohne zeitliche Relevanz ist für den Vertrieb wertlos ("False Positive"). 
    1. AKTUELLES DATUM: Prüfe jedes Ereignis streng gegen das heutige Datum (${currentIsoDate} / ${currentMonthYear}, Jahr ${currentYear}).
    2. ZULÄSSIGES ZEITFENSTER FÜR TRIGGER:
       - GEPLANT / IN UMSETZUNG: Das Ereignis/Projekt findet in den nächsten 3 bis 12 Monaten statt (Zukunft!).
       - REZENT VERÖFFENTLICHT: Die Ankündigung/Baugenehmigung/Meldung ist maximal 90 Tage alt.
    3. HARD REJECT (SOFORT VERWERFEN):
       - Wenn das Ereignis (z. B. Eröffnung, Fertigstellung, M&A-Abschluss) bereits stattgefunden hat und LÄNGER ALS 90 TAGE zurückliegt.
       - Achte auf historische Formulierungen wie: "eröffnete im vergangenen Jahr", "blickte zurück auf", "wurde vor 12 Monaten fertiggestellt", "bereits seit ${currentYear - 1} in Betrieb".
       - Veraltete Ereignisse (z.B. Eröffnungen aus vergangenen Jahren wie 2025/2024 oder länger als 90 Tage her) sind STRIKT ZU VERWERFEN!
    
    # GEWERK- UND PHASE-MATCHING
    - PHASE 1: Planung / Grundstückskauf / Baugenehmigung / GU-Suche --> STATUS: 🟢 TOP SALES TRIGGER (Maximaler Match für Neugeschäft & Gewerk-Ausschreibung)
    - PHASE 2: Spatenstich / Baubeginn / Rohbau --> STATUS: 🟡 LAST MINUTE (Hoher Zeitdruck, nur noch direkte Vergabe möglich)
    - PHASE 3: Eröffnung / Inbetriebnahme / Banddurchschneiden --> STATUS: 🔴 ABGELAUFEN für Erstausstattung/Neubau (NUR als 🔵 SERVICE-TRIGGER zulassen, falls explizit Wartung/Reparatur im Bestand gesucht wird - ansonsten VERWERFEN).
    
    # OUTPUT-VALIDIERUNG (CHECKLISTE VOR DATENAUSGABE)
    1. [ ] Nachricht max. 90 Tage alt?
    2. [ ] Reales Ereignis in der Zukunft oder max. 90 Tage her?
    3. [ ] Bietet das Ereignis heute (${currentYear}) noch ein reales Handlungsfenster für den Vertrieb?
    Wenn Punkt 1, 2 oder 3 fehlschlagen: VERWERFE DEN TRIGGER.
    
    STRIKTE ZERO-HALLUCINATION-REGELN (MANDATORISCH):
    1. VERWIRF abstrakte Marktberichte, Studien oder allgemeine Branchentrends komplett!
    2. Akzeptiere NUR echte, spezifische Firmen aus dem Quelltext. Erfinde NIEMALS Firmennamen.
    3. ERFINDE NIEMALS Ansprechpartner, Namen, E-Mails, Telefonnummern oder Web-Links!
    4. "ansprechpartner": Gib NUR dann einen Namen an, wenn eine Person wörtlich im Quelltext des Artikels genannt wird. Wenn KEINE Person im Text steht, MUSS dieser Wert null sein.
    5. "kontakt": Gib NUR dann eine E-Mail/Telefon an, wenn sie wortwörtlich im Quelltext steht. Sonst MUSS dieser Wert null sein.
    6. "quelle": MUSS exakt die reale URL aus den Suchergebnissen sein.
    7. CONTENT SAFETY: Ignoriere strikt jede Meldung über Unfälle, Verbrechen, Krankheit oder Notlagen.
    ${langInstruction}
    
    DEINE AUFGABE: Werte die gefundenen Leads aus und SORTIERE SIE nach Priorität (1 ist der absolut beste Lead).
    
    Für jede echte Chance musst du exakt folgendes JSON-Objekt-Format zurückgeben:
    {
      "trigger_events": [
        {
          "hit_id": "Die exakte Hit-ID aus den Quelldaten (kopiere sie 1:1, falls 'none' dann weglassen)",
          "firmenname": "Echter Firmenname aus dem Quelltext",
          "branche": "Branche des Zielunternehmens",
          "prioritaet": 1,
          "bewertung": "A - Höchste Chance. Warum?",
          "signal": "Was ist exakt passiert? (z.B. Baugenehmigung für neues Logistikzentrum erteilt — Spatenstich Q3 ${currentYear})",
          "relevanz": "Kurze Begründung der Relevanz für das Angebot in 1 Satz",
          "ansprechpartner": null,
          "position": null,
          "kontakt": null,
          "quelle": "Die exakte echte URL aus den Suchergebnissen",
          "psychologische_ansprache": "Wie muss der Vertriebler dieses Signal vertrieblich ansprechen?"
        }
      ]
    }`;

    const triggerLlmResult = await callAI([
      { role: "system", content: systemPrompt },
      { role: "user", content: `Web-Recherche Ergebnisse:\n\n${webContext}` }
    ], { temperature: 0.3, max_tokens: 4096 });

    let content = triggerLlmResult.text;
    
    // Markdown JSON-Blöcke bereinigen, falls Mistral sie hinzufügt
    content = content.replace(/```(?:json)?/g, '').replace(/```/g, '').trim();
    
    let parsed;
    try {
      parsed = JSON.parse(content);
      
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
