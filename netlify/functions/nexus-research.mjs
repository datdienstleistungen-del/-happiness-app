import crypto from 'crypto';
import { callLLM } from './_shared/llm-core.mjs';
import { searchDuckDuckGo, searchBrave, searchBingNewsRss, searchWithFallback } from './_shared/search-core.mjs';
import { isPlaceholderCompany } from './_shared/validation.mjs';
import { tryConsumeDaily, dayKey } from './_shared/quota.mjs';

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

    if (!user) {
      if (!isLandingPreview) {
        return {
          statusCode: 401,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
          body: JSON.stringify({ error: 'Unauthorized: Bitte melde dich an, um NeXus Research zu nutzen.' })
        };
      }
      // Schutz für Landing Page Live-Test: Maximal 3 Scans pro IP pro Tag
      const clientIp = (reqHeaders['x-forwarded-for'] || reqHeaders['client-ip'] || 'anonymous').split(',')[0].trim();
      const ipKey = `preview:research:${clientIp}:${dayKey()}`;
      const ipQuota = await tryConsumeDaily(ipKey, 3);
      if (!ipQuota.allowed) {
        return {
          statusCode: 429,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
          body: JSON.stringify({ error: 'Kostenloses Test-Limit für Gäste erreicht (max. 3 Scans pro Tag). Bitte melde dich kostenlos an, um fortzufahren.' })
        };
      }
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

    // Kostenlose Multi-Quellen-Suche (Brave API -> DuckDuckGo -> Bing News RSS)
    let searchData = null;
    let searchSource = 'Web Search';

    for (const q of searchQueriesToTry) {
      if (searchData && searchData.results && searchData.results.length > 0) break;
      const res = await searchWithFallback(q, { maxResults: 10, timeoutMs: 8000 });
      if (res.results && res.results.length > 0) {
        searchData = { results: res.results };
        searchSource = res.source ? `Web Search (${res.source})` : 'Web Search';
        break;
      }
    }

    console.log('[nexus-research] searchData count:', searchData?.results?.length);
    if (!searchData || !searchData.results || searchData.results.length === 0) {
      console.log('[nexus-research] Returning early due to empty searchData');
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

    const safeResults = searchData.results.filter(r => {
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
            source: r._source || searchSource || 'Web Search',
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
    1. AKZEPTIERE NUR ECHTE UNTERNEHMEN: Nutze ausschließlich reale Firmennamen aus den Web-Ergebnissen. Erfinde NIEMALS Firmen und nutze KEINE Platzhalter wie "Echter Firmenname", "Musterfirma" oder "Test GmbH".
    2. KÄUFER-VS-ANBIETER FILTER (WICHTIG - ANTI-RICOH-FILTER):
       - Frage dich: Ist das gefundene Unternehmen ein potenzieller KÄUFER des Angebots?
       - Wenn das Unternehmen SELBST Anbieter/Hersteller der angebotenen Lösung ist oder eigene Produkte bewirbt (z.B. Ricoh bewirbt eigenes Dokumentenmanagement, IT-Dienstleister bewirbt eigene Cloud), ist das Unternehmen ein WETTBEWERBER/ANBIETER und KEIN Käufer!
       - In solchen Fällen: Setze "target_group_match" auf unter 40 und "is_potential_buyer" auf false!
    3. ZIELGRUPPEN-MATCH (0-100):
       - 80-100: Perfekter Käufer-Match (Passt zur Zielgruppe, echter Bedarf)
       - 50-79: Plausibler Käufer (Bedarf wahrscheinlich)
       - 0-49: Zielgruppe unklar / Anbieter / Wettbewerber / Fehlmatch
    4. KEINE HALLUZINIERTEN KONTAKTE: "ansprechpartner" und "kontakt" dürfen NUR befüllt werden, wenn sie wörtlich im Quelltext stehen. Sonst MUSS der Wert null sein.
    5. QUELLEN: "quelle" MUSS die echte URL aus dem Quelltext sein.
    ${langInstruction}
    
    DEINE AUFGABE: Werte die gefundenen Leads aus und SORTIERE SIE nach Priorität (1 ist der absolut beste Lead).
    
    Gib ein JSON-Objekt mit EXAKT folgender Struktur zurück:
    {
      "trigger_events": [
        {
          "hit_id": "Die exakte Hit-ID aus den Quelldaten (kopiere sie 1:1, falls 'none' dann weglassen)",
          "firmenname": "Konkreter Firmenname aus dem Quelltext (KEIN Platzhalter)",
          "branche": "Branche des Zielunternehmens",
          "prioritaet": 1,
          "bewertung": "A - Höchste Chance. Warum?",
          "signal": "Was ist konkret passiert? (z.B. Senacor übernimmt Finanteq zur Expansion; Bechtle wächst stark im Cloud-Bereich)",
          "relevanz": "Kurze Begründung der Relevanz für das Angebot in 1 Satz",
          "target_group_match": 85,
          "is_potential_buyer": true,
          "match_reason": "Begründung für Zielgruppen-Match: Warum Käufer und kein Anbieter?",
          "ansprechpartner": null,
          "position": null,
          "kontakt": null,
          "quelle": "Die exakte echte URL aus den Suchergebnissen",
          "psychologische_ansprache": "Wie muss der Vertriebler dieses Signal vertrieblich ansprechen?"
        }
      ]
    }`;

    console.log('[nexus-research] Calling LLM with webContext length:', webContext.length);
    const triggerLlmResult = await callLLM([
      { role: "system", content: systemPrompt },
      { role: "user", content: `Web-Recherche Ergebnisse:\n\n${webContext}` }
    ], {
      profile: 'json',
      providers: ['deepseek', 'groq', 'openrouter', 'mistral', 'openai'],
      temperature: 0.3,
      max_tokens: 4096,
      jsonMode: true,
      xTitle: 'NeXus Research',
    });

    let content = triggerLlmResult.text;
    console.log('[nexus-research] LLM raw content:\n', content);
    
    // Markdown JSON-Blöcke bereinigen, falls nötig
    content = content.replace(/```(?:json)?/g, '').replace(/```/g, '').trim();
    
    let parsed = { trigger_events: [] };
    try {
      parsed = JSON.parse(content);
      console.log('[nexus-research] Parsed trigger_events count:', parsed.trigger_events?.length);
      
      // Post-Processing: Quell-URLs absichern, Platzhalter filtern und Defaults setzen
      if (parsed.trigger_events && Array.isArray(parsed.trigger_events)) {
        parsed.trigger_events = parsed.trigger_events
          .filter(t => !isPlaceholderCompany(t.firmenname))
          .map((t, idx) => {
            const matchedSource = safeResults.find(r => r.url === t.quelle) || safeResults[idx % safeResults.length];
            const isKnownVendor = /\b(ricoh|canon|konica minolta|xerox|bechtle|computacenter)\b/i.test((t.firmenname || '').trim());
            const matchScore = isKnownVendor ? 25 : (typeof t.target_group_match === 'number' ? Math.max(0, Math.min(100, t.target_group_match)) : 75);

            return {
              ...t,
              target_group_match: matchScore,
              is_potential_buyer: !isKnownVendor && (t.is_potential_buyer !== false),
              branche: t.branche || branche || 'B2B / Mittelstand',
              relevanz: t.relevanz || t.bewertung || 'Hohe Passgenauigkeit für das analysierte Leistungsportfolio.',
              ansprechpartner: t.ansprechpartner && typeof t.ansprechpartner === 'string' && !t.ansprechpartner.includes('z.B.') ? t.ansprechpartner : null,
              position: t.position && typeof t.position === 'string' && !t.position.includes('z.B.') ? t.position : null,
              kontakt: t.kontakt && typeof t.kontakt === 'string' && !t.kontakt.includes('z.B.') && !t.kontakt.includes('unternehmen.de') ? t.kontakt : null,
              quelle: matchedSource ? matchedSource.url : (t.quelle || 'https://www.bundesanzeiger.de'),
              published_at: matchedSource?.published_date || new Date().toISOString()
            };
          })
          .filter(t => t.is_potential_buyer && t.target_group_match >= 50);

        // Update DB status for ALL hits: Relevante -> 'relevant', Verworfene -> 'irrelevant' (Cron-Leck-Schutz)
        if (user && user.id && supabaseUrl && supabaseKey) {
          const allInsertedIds = Object.values(hitIdMap).filter(id => id && id !== 'none');
          const relevantIds = parsed.trigger_events.map(t => t.hit_id).filter(id => id && id !== 'none');
          const relevantSet = new Set(relevantIds);
          const irrelevantIds = allInsertedIds.filter(id => !relevantSet.has(id));

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
              console.error("Fehler beim Update des Hit-Status (relevant):", e.message);
            }
          }

          if (irrelevantIds.length > 0) {
            try {
              await fetch(`${supabaseUrl}/rest/v1/nexus_radar_hits?id=in.(${irrelevantIds.join(',')})`, {
                method: 'PATCH',
                headers: { 
                  'apikey': supabaseKey, 
                  'Authorization': `Bearer ${token}`, 
                  'Content-Type': 'application/json',
                  'Prefer': 'return=minimal'
                },
                body: JSON.stringify({ status: 'irrelevant' })
              });
            } catch (e) {
              console.error("Fehler beim Update des Hit-Status (irrelevant):", e.message);
            }
          }
        }
      }
    } catch (e) {
      console.error("Fehler beim Parsen der LLM-Antwort (Research):", content);
      parsed = { trigger_events: [] };
      // Fallback: Alle eingefügten Hits auf 'irrelevant' setzen, um Cron-Lecks zu verhindern
      const allInsertedIds = Object.values(hitIdMap).filter(id => id && id !== 'none');
      if (allInsertedIds.length > 0 && user && user.id && supabaseUrl && supabaseKey) {
        try {
          await fetch(`${supabaseUrl}/rest/v1/nexus_radar_hits?id=in.(${allInsertedIds.join(',')})`, {
            method: 'PATCH',
            headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
            body: JSON.stringify({ status: 'irrelevant' })
          });
        } catch (_) {}
      }
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
