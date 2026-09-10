import crypto from 'crypto';

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    // 1. Auth & Token Check (Server-Side via REST API)
    const authHeader = event.headers.authorization;
    if (!authHeader) {
      return { statusCode: 401, body: JSON.stringify({ error: "Missing Authorization header" }) };
    }
    const token = authHeader.replace('Bearer ', '');
    
    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
    const serviceKey = process.env.SUPABASE_SERVICE_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      return { statusCode: 500, body: JSON.stringify({ error: "Supabase config missing in backend" }) };
    }
    
    const userRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${token}` }
    });
    
    if (!userRes.ok) {
      return { statusCode: 401, body: JSON.stringify({ error: "Invalid token or unauthorized" }) };
    }
    
    const user = await userRes.json();
    if (!user || !user.id) {
      return { statusCode: 401, body: JSON.stringify({ error: "Invalid token or unauthorized" }) };
    }

    // 2. Rate Limiting Check (via PostgREST)
    const MAX_REQUESTS = 1000;
    const today = new Date().toISOString().split('T')[0];
    
    const usageRes = await fetch(`${supabaseUrl}/rest/v1/nexus_api_usage?user_id=eq.${user.id}&select=*`, {
      headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${token}` }
    });
    
    if (!usageRes.ok) {
      console.error("Usage fetch error:", await usageRes.text());
      return { statusCode: 500, body: JSON.stringify({ error: "Database error tracking API usage. Please run the SQL script." }) };
    }
    
    const usageData = await usageRes.json();
    const usage = usageData.length > 0 ? usageData[0] : null;
      
    if (!usage) {
      const insertRes = await fetch(`${supabaseUrl}/rest/v1/nexus_api_usage`, {
        method: 'POST',
        headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${serviceKey}`, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
        body: JSON.stringify({ user_id: user.id, requests_today: 1, last_request_date: today })
      });
      if (!insertRes.ok) console.error("Rate limit insert error:", await insertRes.text());
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
      
      const updateRes = await fetch(`${supabaseUrl}/rest/v1/nexus_api_usage?user_id=eq.${user.id}`, {
        method: 'PATCH',
        headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${serviceKey}`, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
        body: JSON.stringify({ requests_today: newCount, last_request_date: today })
      });
      if (!updateRes.ok) console.error("Rate limit update error:", await updateRes.text());
    }

    const { searchQuery, branche, lang, offeringId } = JSON.parse(event.body);

    const tavilyKey = process.env.TAVILY_API_KEY || process.env.VITE_TAVILY_API_KEY;
    const mistralKey = process.env.MISTRAL_API_KEY || process.env.VITE_MISTRAL_API_KEY;

    if (!tavilyKey) {
      return { statusCode: 500, body: JSON.stringify({ error: "Tavily API Key fehlt im Backend" }) };
    }
    if (!mistralKey) {
      return { statusCode: 500, body: JSON.stringify({ error: "Mistral API Key fehlt im Backend" }) };
    }

    // --- STUFE 1: Auto-Korrektur (Tippfehler) durch Groq ---
    // Da Tavily sehr anfällig für Tippfehler ist (z.B. "markting argenturen"),
    // lassen wir Groq den Suchstring blitzschnell korrigieren, bevor wir suchen.
    let correctedQuery = searchQuery;
    let correctedBranche = branche || '';
    
    try {
      const spellcheckRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${process.env.GROQ_API_KEY}` },
        body: JSON.stringify({
          model: "groq/compound", // Small model für maximale Geschwindigkeit
          messages: [{ 
            role: "system", 
            content: "Du bist eine Rechtschreibkorrektur-Engine. Der User übergibt dir Suchbegriffe. Deine EINZIGE Aufgabe ist es, Tippfehler zu korrigieren. Gib NUR die korrigierten Begriffe zurück, exakt so wie sie sind, ohne Erklärungen, ohne Anführungszeichen und ohne zusätzliche Wörter. Wenn keine Fehler drin sind, gib sie 1:1 zurück."
          }, { 
            role: "user", 
            content: `${searchQuery} ${branche || ''}`
          }],
          temperature: 0.0,
          max_tokens: 50
        })
      });
      
      if (spellcheckRes.ok) {
        const spellData = await spellcheckRes.json();
        const cleaned = spellData.choices[0]?.message?.content?.trim();
        if (cleaned) {
          correctedQuery = cleaned;
          correctedBranche = ''; // Branche ist in der korrigierten Query bereits enthalten
          console.log(`[Auto-Correct] Original: "${searchQuery} ${branche || ''}" -> Korrigiert: "${correctedQuery}"`);
        }
      }
    } catch (e) {
      console.warn("Fehler bei der Auto-Korrektur, nutze Original-Query:", e);
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
    if (offeringId && user.id) {
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
    5. Erfinde NICHTS. Nutze NUR die echten Firmennamen aus dem Text.
    ${langInstruction}
    
    DEINE AUFGABE: Werte die gefundenen Leads aus und SORTIERE SIE nach Priorität (1 ist der absolut beste Lead).
    
    Für jede echte Chance musst du exakt folgendes JSON-Objekt-Format zurückgeben:
    {
      "trigger_events": [
        {
          "hit_id": "Die exakte Hit-ID aus den Quelldaten (kopiere sie 1:1, falls 'none' dann weglassen)",
          "firmenname": "Echter Name aus dem Artikel",
          "prioritaet": 1,
          "bewertung": "A - Höchste Chance. Warum?",
          "signal": "Was ist exakt passiert?",
          "psychologische_ansprache": "Wie muss der Vertriebler diesen Lead anschreiben?"
        }
      ]
    }`;

    const groqKey = process.env.GROQ_API_KEY;
    if (!groqKey) {
      return { statusCode: 500, body: JSON.stringify({ error: "Groq API Key fehlt im Backend" }) };
    }
    
    const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${groqKey}`
      },
      body: JSON.stringify({
        model: "groq/compound",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Web-Recherche Ergebnisse:\n\n${webContext}` }
        ],
        temperature: 0.3
      })
    });
    
    if (!groqRes.ok) {
      throw new Error(`Groq API Error beim Extrahieren der Live-Trigger: ${groqRes.statusText}`);
    }

    const groqData = await groqRes.json();
    let content = groqData.choices[0].message.content;
    
    // Markdown JSON-Blöcke bereinigen, falls Mistral sie hinzufügt
    content = content.replace(/```(?:json)?/g, '').replace(/```/g, '').trim();
    
    let parsed;
    try {
      parsed = JSON.parse(content);
      
      // Update DB status for relevant hits
      if (parsed.trigger_events && Array.isArray(parsed.trigger_events)) {
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
    } catch (e) {
      console.error("Fehler beim Parsen der Mistral-Antwort (Research):", content);
      parsed = { trigger_events: [] }; // Fallback auf leeres Array statt reinem Text
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
