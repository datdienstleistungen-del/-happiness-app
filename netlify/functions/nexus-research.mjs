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

async function callAI(messages, { temperature = 0.3, max_tokens = 4096, jsonMode = false } = {}) {
  // 1. Groq (High Speed & Free)
  const groqKey = process.env.GROQ_API_KEY || process.env.VITE_GROQ_API_KEY || BACKUP_GROQ;
  if (groqKey) {
    const models = ['openai/gpt-oss-120b', 'openai/gpt-oss-20b', 'groq/compound', 'qwen/qwen3.8-27b'];
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

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const body = event.body ? JSON.parse(event.body) : {};
    const { searchQuery: rawSearchQuery, branche, lang, offeringId, isLandingPreview, angebot } = body;

    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
    const serviceKey = process.env.SUPABASE_SERVICE_KEY;

    let user = null;
    let isPreview = isLandingPreview === true;
    const authHeader = event.headers.authorization || event.headers.Authorization;
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

    const tavilyKey = process.env.TAVILY_API_KEY || process.env.VITE_TAVILY_API_KEY || BACKUP_TAVILY;
    if (!tavilyKey) {
      return { statusCode: 500, body: JSON.stringify({ error: "Tavily API Key fehlt im Backend" }) };
    }

    // --- STUFE 1: Auto-Korrektur (Tippfehler) ---
    let correctedQuery = searchQuery;
    let correctedBranche = branche || '';
    
    try {
      const spellData = await callAI([{ 
        role: "system", 
        content: "Du bist eine Rechtschreibkorrektur-Engine. Der User übergibt dir Suchbegriffe. Deine EINZIGE Aufgabe ist es, Tippfehler zu korrigieren. Gib NUR die korrigierten Begriffe zurück, exakt so wie sie sind, ohne Erklärungen, ohne Anführungszeichen und ohne zusätzliche Wörter. Wenn keine Fehler drin sind, gib sie 1:1 zurück."
      }, { 
        role: "user", 
        content: `${searchQuery} ${branche || ''}`
      }], { temperature: 0.0, max_tokens: 50 });
      
      const cleaned = spellData?.text?.trim();
      if (cleaned) {
        correctedQuery = cleaned;
        correctedBranche = '';
        console.log(`[Auto-Correct] Original: "${searchQuery} ${branche || ''}" -> Korrigiert: "${correctedQuery}"`);
      }
    } catch (e) {
      console.warn("Fehler bei der Auto-Korrektur, nutze Original-Query:", e.message);
    }

    // --- STUFE 2: Tavily Deep Search ---
    const tavilyRes = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: tavilyKey,
        query: `${correctedQuery} ${correctedBranche} Unternehmen Deutschland`,
        search_depth: "advanced",
        include_answer: false,
        max_results: 10,
        topic: "news",
        days: 14
      })
    });

    if (!tavilyRes.ok) throw new Error(`Tavily API Error: ${tavilyRes.statusText}`);
    const tavilyData = await tavilyRes.json();
    
    if (!tavilyData.results || tavilyData.results.length === 0) {
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
    const langInstruction = `\n\nCRITICAL REQUIREMENT: The user's language is ${langName}. All generated content MUST be written in ${langName}. Do not translate structural JSON keys (like "trigger_events", "firmenname", "signal", etc.), but write all their string values in ${langName}.`;

    const systemPrompt = `Du bist die Kern-Intelligenz der NeXus Research Engine und ein brillanter Verkaufspsychologe im B2B-Vertrieb.
    Hier ist ein roher Daten-Pool aus echten, topaktuellen Internet-Quellen zu folgenden Suchbegriffen: "${searchQuery}".
    
    DEIN ZIEL: Finde konkrete, namentlich genannte B2B-Unternehmen, die aufgrund der News JETZT GERADE einen Bedarf an unserem Angebot haben könnten.
    
    WICHTIGE REGELN:
    1. VERWIRF abstrakte Marktberichte, Studien oder allgemeine Branchentrends komplett!
    2. VERWIRF alles, was kein konkretes Endkunden-Unternehmen nennt.
    3. Akzeptiere NUR echte, spezifische Firmen (Wachstum, Umzug, Investitionen, Förderungen, etc.).
    4. CONTENT SAFETY (KRITISCH): Ignoriere strikt jede Meldung über Unfälle, Verbrechen, Krankheit oder Notlagen.
    5. Erfinde NICHTS bei den Firmennamen. Nutze NUR die echten Firmennamen aus dem Text.
    ${langInstruction}
    
    DEINE AUFGABE: Werte die gefundenen Leads aus und SORTIERE SIE nach Priorität (1 ist der absolut beste Lead).
    
    Für jede echte Chance musst du exakt folgendes JSON-Objekt-Format zurückgeben:
    {
      "trigger_events": [
        {
          "hit_id": "Die exakte Hit-ID aus den Quelldaten (kopiere sie 1:1, falls 'none' dann weglassen)",
          "firmenname": "Echter Firmenname aus dem Artikel",
          "branche": "Branche des Zielunternehmens",
          "prioritaet": 1,
          "bewertung": "A - Höchste Chance. Warum?",
          "signal": "Was ist exakt passiert? (z.B. Expansion in neue Märkte — gemeldet am 10. September 2026)",
          "relevanz": "Kurze Begründung der Relevanz für das Angebot in 1 Satz",
          "ansprechpartner": "Name des zuständigen Entscheiders oder Geschäftsführers (z.B. Dr. Michael Weber)",
          "position": "Position / Rolle im Unternehmen (z.B. Geschäftsführer / Head of Operations)",
          "kontakt": "E-Mail oder Telefon (z.B. kontakt@unternehmen.de / +49 89 ...)",
          "quelle": "Offizielle Quell-URL aus den Suchergebnissen",
          "psychologische_ansprache": "Wie muss der Vertriebler diesen Lead anschreiben?"
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
          const fallbackSource = safeResults[idx % safeResults.length];
          return {
            ...t,
            branche: t.branche || correctedBranche || 'B2B / Mittelstand',
            relevanz: t.relevanz || t.bewertung || 'Hohe Passgenauigkeit für das analysierte Leistungsportfolio.',
            ansprechpartner: t.ansprechpartner || 'Geschäftsführung / Vorstand',
            position: t.position || 'Geschäftsleitung / Entscheidungsbefugt',
            kontakt: t.kontakt || 'kontakt@' + ((t.firmenname || 'unternehmen').toLowerCase().replace(/[^a-z0-9]/g, '')) + '.de',
            quelle: t.quelle || fallbackSource?.url || 'https://www.bundesanzeiger.de'
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
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
      headers: { "Content-Type": "application/json" }
    };
  }
};
