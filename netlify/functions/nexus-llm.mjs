// ── Multi-Provider Fallback Chain (via _shared/llm-core.mjs) ──
import { runEmailPatternCrawler } from './nexus-email-crawler.mjs';
import { callLLM } from './_shared/llm-core.mjs';
import { getTavilyKeys, tavilySearch, searchDuckDuckGo as coreSearchDuckDuckGo } from './_shared/search-core.mjs';

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



function cleanModelOutput(text) {
  if (!text || typeof text !== 'string') return text;
  return text
    .replace(/<\|tool_call_start\|>[\s\S]*?<\|tool_call_end\|>/gi, '')
    .replace(/<\|im_start\|>[\s\S]*?<\|im_end\|>/gi, '')
    .replace(/<\|[\s\S]*?\|>/g, '')
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .trim();
}

function getModelTier(provider, model) {
  if (provider === 'groq') {
    if (model === 'allam-2-7b') return 'FREE-TIER';
    if (model === 'openai/gpt-oss-20b') return 'LOW-COST-FALLBACK';
    return 'PAID-FALLBACK';
  }
  if (provider === 'openrouter') {
    return (model?.endsWith(':free') || model === 'openrouter/free') ? 'FREE-TIER' : 'PAID-FALLBACK';
  }
  return 'PAID-FALLBACK';
}

// ── Kette via _shared/llm-core.mjs. testOptions (API-Vertrag) wird hier auf
// Core-Optionen uebersetzt: disable_*/force_fail_providers/invalid_groq_key ->
// Provider-Liste, skipModels -> Core skipModels (Retry ohne Vorstufen-Modell),
// preferJsonModels -> profile 'json' (GROQ_JSON_HEAVY) OHNE response_format,
// weil die alte Kette nur die Modell-Liste tauschte. Vision-Reihenfolge
// (openrouter zuerst) und Text-Fallback mit Hinweis-Note bleiben identisch.
async function callAI(messages, temperature = 0.3, hasImage = false, testOptions = {}) {
  const chainStartTime = Date.now();

  const disabled = new Set([...(testOptions.force_fail_providers || [])]);
  if (testOptions.disable_groq || testOptions.invalid_groq_key) disabled.add('groq');
  if (testOptions.disable_openrouter) disabled.add('openrouter');
  if (testOptions.disable_mistral) disabled.add('mistral');
  if (testOptions.disable_openai) disabled.add('openai');
  if (testOptions.disable_deepseek) disabled.add('deepseek');

  const baseProviders = hasImage
    ? ['openrouter', 'groq', 'mistral', 'deepseek', 'openai']
    : ['groq', 'openrouter', 'mistral', 'deepseek', 'openai'];
  const providers = baseProviders.filter(p => !disabled.has(p));

  const profile = hasImage ? 'vision' : (testOptions.preferJsonModels ? 'json' : 'free');
  const opts = {
    profile,
    temperature,
    max_tokens: 4096,
    providers,
    totalBudgetMs: 20000,
    xTitle: 'NeXus Sales Intelligence',
    skipModels: testOptions.skipModels || [],
  };

  let result = null;
  let lastErr = null;
  try {
    result = await callLLM(messages, opts);
  } catch (e) {
    lastErr = e;
  }

  // Vision-Fallback: wie bisher Bild-Inhalte entfernen und textbasiert wiederholen
  if (!result && hasImage) {
    console.log('[NEXUS] All vision providers failed, falling back to text-only');
    const textMessages = messages.map(m => {
      if (Array.isArray(m.content)) {
        return { ...m, content: m.content.filter(c => c.type === 'text').map(c => c.text).join('\n') };
      }
      return m;
    });
    try {
      result = await callLLM(textMessages, opts);
      result.text = result.text + '\n\n*[Hinweis: Bildanalyse nicht verfügbar — reine Textanalyse]*';
      console.log(`[NEXUS] Text-only fallback succeeded: ${result.provider} (${result.model}) in ${Date.now() - chainStartTime}ms`);
    } catch (e) {
      lastErr = e;
    }
  }

  if (!result || !result.text) {
    const totalDuration = Date.now() - chainStartTime;
    console.error(`[NEXUS] Entire provider chain failed after ${totalDuration}ms.`);
    throw lastErr || new Error('KI antwortet nicht rechtzeitig. Bitte warte kurz und versuche es erneut.');
  }

  const text = cleanModelOutput(result.text);
  const tier = getModelTier(result.provider, result.model);
  const totalDurationMs = Date.now() - chainStartTime;
  console.log(`[NEXUS] Chain completed successfully via ${result.provider} (${result.model}) [${tier}] in ${totalDurationMs}ms total.`);
  return { text, provider: result.provider, model: result.model, usage: result.usage ?? null, tier, totalDurationMs };
}

// ── Web Search mit Fallback-Kette: Tavily -> DuckDuckGo -> Brave -> SearXNG ──

// Tavily via _shared/search-core.mjs (Multi-Key inkl. VITE-Alias).
// Fix: die alte Version referenzierte das undefinierte BACKUP_TAVILY und
// war damit als erste Stufe stillschweigend IMMER defekt.
async function tryTavilySearch(query) {
  for (const key of getTavilyKeys()) {
    const out = await tavilySearch(query, key, {
      maxResults: 6,
      searchDepth: 'basic',
      includeRawContent: false,
      timeoutMs: 10000,
    });
    if (out.ok) {
      return out.results.map(r => ({
        url: r.url,
        title: r.title,
        snippet: r.content || ''
      }));
    }
  }
  return null;
}

// DuckDuckGo via _shared/search-core.mjs (identisches HTML-Parsing).
async function tryDuckDuckGo(query) {
  try {
    const results = await coreSearchDuckDuckGo(query, { maxResults: 6, timeoutMs: 8000 });
    if (results.length > 0) {
      return results.map(r => ({ url: r.url, title: r.title, snippet: r.content || '' }));
    }
    return null;
  } catch (e) {
    console.warn("[Search] DuckDuckGo failed:", e.message);
    return null;
  }
}

async function trySearXNG(query) {
  const instances = ['https://searx.be', 'https://search.bus-hit.me', 'https://searxng.site'];
  for (const base of instances) {
    try {
      const { res, timer } = await fetchWithTimeout(
        `${base}/search?q=${encodeURIComponent(query)}&format=json&categories=general`,
        { headers: { 'Accept': 'application/json' } },
        8000
      );
      clearTimeout(timer);
      if (!res.ok) continue;
      const data = await res.json();
      if (data.results && data.results.length > 0) {
        return data.results.slice(0, 5).map(r => ({ url: r.url, title: r.title, snippet: r.content || '' }));
      }
    } catch (e) {
      console.warn(`[Search] SearXNG ${base} failed:`, e.message);
    }
  }
  return null;
}

async function tryBraveSearch(query) {
  const key = process.env.BRAVE_API_KEY;
  if (!key) return null;
  try {
    const { res, timer } = await fetchWithTimeout(
      `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=5`,
      { headers: { 'Accept': 'application/json', 'Accept-Encoding': 'gzip', 'X-Subscription-Token': key } },
      8000
    );
    clearTimeout(timer);
    if (!res.ok) return null;
    const data = await res.json();
    if (data.web && data.web.results && data.web.results.length > 0) {
      return data.web.results.slice(0, 5).map(r => ({ url: r.url, title: r.title, snippet: r.description || '' }));
    }
    return null;
  } catch (e) {
    console.warn("[Search] Brave failed:", e.message);
    return null;
  }
}

async function webSearch(query) {
  console.log(`[Search] Searching: "${query}"`);
  
  // 1. Tavily (Top Precision & Speed)
  const tavilyResults = await tryTavilySearch(query);
  if (tavilyResults && tavilyResults.length > 0) {
    console.log(`[Search] Tavily: ${tavilyResults.length} results for "${query}"`);
    return tavilyResults;
  }
  
  // 2. DuckDuckGo
  const ddgResults = await tryDuckDuckGo(query);
  if (ddgResults && ddgResults.length > 0) {
    console.log(`[Search] DuckDuckGo: ${ddgResults.length} results for "${query}"`);
    return ddgResults;
  }
  
  // 3. Brave
  const braveResults = await tryBraveSearch(query);
  if (braveResults && braveResults.length > 0) {
    console.log(`[Search] Brave: ${braveResults.length} results for "${query}"`);
    return braveResults;
  }

  // 4. SearXNG
  const searxResults = await trySearXNG(query);
  if (searxResults && searxResults.length > 0) {
    console.log(`[Search] SearXNG: ${searxResults.length} results for "${query}"`);
    return searxResults;
  }
  
  console.log("[Search] All search providers returned no results for:", query);
  return [];
}

// ── JSON-Validierung: Degeneration (Endlosschleifen) & Schema-Check ──
function isDegenerateText(text) {
  if (!text || typeof text !== 'string') return false;
  const sentences = text.split(/[.!?]\s+/).map(s => s.trim()).filter(s => s.length > 70);
  const seen = new Map();
  for (const s of sentences) {
    const key = s.slice(0, 120).toLowerCase();
    seen.set(key, (seen.get(key) || 0) + 1);
    if (seen.get(key) >= 3) return true;
  }
  return false;
}

function extractJsonObject(text) {
  if (!text || typeof text !== 'string') return null;
  const unfenced = text.replace(/```(?:json)?/gi, '').replace(/```/g, '').trim();
  try {
    const p = JSON.parse(unfenced);
    if (p && typeof p === 'object' && !Array.isArray(p)) return p;
  } catch {}
  const start = text.indexOf('{');
  if (start >= 0) {
    let depth = 0, inStr = false, esc = false;
    for (let i = start; i < text.length; i++) {
      const ch = text[i];
      if (esc) { esc = false; continue; }
      if (ch === '\\') { esc = true; continue; }
      if (ch === '"') { inStr = !inStr; continue; }
      if (inStr) continue;
      if (ch === '{') depth++;
      else if (ch === '}') {
        depth--;
        if (depth === 0) {
          try {
            const p = JSON.parse(text.slice(start, i + 1));
            if (p && typeof p === 'object' && !Array.isArray(p)) return p;
          } catch {}
          break;
        }
      }
    }
  }
  return null;
}

function validateStructuredResult(content, requiredKeys) {
  if (isDegenerateText(content)) return { ok: false, reason: 'wiederholte, degenerierte Antwort' };
  const parsed = extractJsonObject(content);
  if (!parsed) return { ok: false, reason: 'kein valides JSON' };
  const missing = requiredKeys.filter(k => !(k in parsed));
  if (missing.length > 0) return { ok: false, reason: `Pflichtfelder fehlen: ${missing.join(', ')}` };
  return { ok: true, parsed };
}

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const body = event.body ? JSON.parse(event.body) : {};
    const { systemPrompt, userMessage, context, temperature, lang, targetLang, isLandingPreview, imageUrl, image_url, imageUrls, image_urls, mode, testOptions } = body;
    let attachedImages = [];
    if (Array.isArray(imageUrls) && imageUrls.length > 0) attachedImages = imageUrls;
    else if (Array.isArray(image_urls) && image_urls.length > 0) attachedImages = image_urls;
    else if (Array.isArray(context?.imageUrls) && context.imageUrls.length > 0) attachedImages = context.imageUrls;
    else if (Array.isArray(context?.image_urls) && context.image_urls.length > 0) attachedImages = context.image_urls;
    else if (imageUrl || image_url || context?.imageUrl || context?.image_url) {
      attachedImages = [imageUrl || image_url || context?.imageUrl || context?.image_url];
    }
    const hasImage = attachedImages.length > 0;

    const authHeader = (event.headers && (event.headers.authorization || event.headers.Authorization)) || '';
    const token = authHeader ? authHeader.replace('Bearer ', '').trim() : '';
    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
    const serviceKey = process.env.SUPABASE_SERVICE_KEY;

    const isPublicPreview = isLandingPreview || !token || token === 'undefined' || token === 'null' || (systemPrompt && (
      systemPrompt.includes('angebotsanalyse') ||
      systemPrompt.includes('trigger_hypotheses') ||
      systemPrompt.includes('trigger_detection') ||
      systemPrompt.includes('hypotheses') ||
      systemPrompt.includes('Kaufsignale')
    ));

    let user = null;
    let isAdmin = false;

    if (token && token !== 'undefined' && token !== 'null' && supabaseUrl && supabaseKey) {
      try {
        const { res: userRes, timer } = await fetchWithTimeout(`${supabaseUrl}/auth/v1/user`, {
          headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${token}` }
        }, 10000);
        if (userRes.ok) {
          user = await userRes.json();
        }
        clearTimeout(timer);
      } catch (err) {
        console.warn("[NEXUS] Auth check failed:", err.message);
      }
    }

    if (user && user.id) {
      const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || 'harro@happiness.de').split(',');
      isAdmin = user.email && ADMIN_EMAILS.includes(user.email);
    }

    // Premium-Tier-Check & Rate Limiting (nur für eingeloggte User)
    if (user && user.id) {
      let isPremium = false;
      let premiumTier = 'free';
      try {
        const { res: settingsRes, timer: sTimer } = await fetchWithTimeout(`${supabaseUrl}/rest/v1/ai_settings?user_id=eq.${user.id}&select=is_premium,premium_tier`, {
          headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${token}` }
        }, 10000);
        if (settingsRes.ok) {
          const settingsData = await settingsRes.json();
          isPremium = settingsData[0]?.is_premium === true;
          premiumTier = settingsData[0]?.premium_tier || 'free';
        }
        clearTimeout(sTimer);
      } catch(e) {}

      const TIER_LIMITS = { free: 5, pro: 100, enterprise: 500 };
      const MAX_REQUESTS = isAdmin ? Infinity : (TIER_LIMITS[premiumTier] || 5);
      const today = new Date().toISOString().split('T')[0];
      
      try {
        const { res: usageRes, timer: uTimer } = await fetchWithTimeout(`${supabaseUrl}/rest/v1/nexus_api_usage?user_id=eq.${user.id}&select=*`, {
          headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${token}` }
        }, 15000);
        
        if (usageRes.ok) {
          const usageData = await usageRes.json();
          clearTimeout(uTimer);
          const usage = usageData.length > 0 ? usageData[0] : null;
          
          if (!usage) {
            fetch(`${supabaseUrl}/rest/v1/nexus_api_usage`, {
              method: 'POST',
              headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${serviceKey}`, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
              body: JSON.stringify({ user_id: user.id, requests_today: 1, last_request_date: today })
            }).catch(() => {});
          } else {
            let newCount = usage.requests_today;
            if (usage.last_request_date !== today) newCount = 1; else newCount += 1;
            
            if (!isAdmin && newCount > MAX_REQUESTS) {
              return { statusCode: 429, body: JSON.stringify({ error: "Rate limit exceeded." }) };
            }
            
            fetch(`${supabaseUrl}/rest/v1/nexus_api_usage?user_id=eq.${user.id}`, {
              method: 'PATCH',
              headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${serviceKey}`, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
              body: JSON.stringify({ requests_today: newCount, last_request_date: today })
            }).catch(() => {});
          }
        } else {
          clearTimeout(uTimer);
        }
      } catch(e) {
        console.warn("[NEXUS] Usage tracking skipped:", e.message);
      }
    }
    


    console.log("[NEXUS] Starting handler");

    const languageNames = { 
      de: 'Deutsch', 
      en: 'Englisch (English)', 
      es: 'Spanisch (Spanish)', 
      fr: 'Französisch (French)', 
      it: 'Italienisch (Italian)', 
      nl: 'Niederländisch (Dutch)',
      el: 'Griechisch (Greek)'
    };
    
    const userLangCode = lang || 'de';
    const userLangName = languageNames[userLangCode] || 'Deutsch';

    let langInstruction = `\n\nCRITICAL LANGUAGE DIRECTIVE (MANDATORISCH & HÖCHSTE PRIORITÄT):
- Du MUSST zu 100% auf ${userLangName} antworten!
- Alle Erklärungen, Analysen, Coach-Antworten, Tabellen, Übersetzungen, Ratschläge und Begründungen MÜSSEN ZWINGEND auf ${userLangName} formuliert sein.
- Selbst wenn im Text, in Screenshots oder in den Daten ausländische Firmen vorkommen (z.B. aus Uruguay, Spanien, Frankreich oder Lateinamerika): Dein Nutzer ist ein deutschsprachiger Vertriebler. Antworte ihm daher AUSSCHLIESSLICH auf ${userLangName}!
- Übersetze fremdsprachige Firmenangaben und Kaufsignale für den Vertriebler automatisch und präzise auf ${userLangName}.`;

    if (targetLang && targetLang !== 'auto' && targetLang !== userLangCode) {
      const targetLangName = languageNames[targetLang] || targetLang;
      langInstruction += `\n- HINWEIS ZUR PITCH-GENERIERUNG: Nur der eigentliche Entwurf des Anschreibens im "response"-Feld soll auf ${targetLangName} verfasst sein. Alle Denkprozesse, Begründungen und Erklärungen bleiben zwingend auf ${userLangName}.\n`;
    }

    const rawUserMsg = userMessage || body.message || (Array.isArray(body.messages) ? body.messages.filter(m => m.role === 'user').pop()?.content : '') || '';
    const effectiveUserMessage = typeof rawUserMsg === 'string' ? rawUserMsg : (Array.isArray(rawUserMsg) ? rawUserMsg.map(c => c.text || '').join(' ') : JSON.stringify(rawUserMsg));
    const lowerMsg = effectiveUserMessage.toLowerCase();

    const isContractAnalysis = (context && (context.quickAction === 'contract' || context.action === 'contract')) ||
      lowerMsg.includes('vertrag') || lowerMsg.includes('agb') || lowerMsg.includes('terms') || lowerMsg.includes('klausel') || lowerMsg.includes('kleingedruckt');

    let contractInstruction = '';
    if (isContractAnalysis) {
      contractInstruction = `\n\n--- SPEZIAL-MODUS: VERTRAGS- & AGB-ANALYSE (RED FLAG SCANNER) ---
Deine Aufgabe ist es, den bereitgestellten Vertrag, die AGB oder das Dokument gründlich und verständlich auf Risiken zu prüfen:
1. 📌 EXECUTIVE SUMMARY: Was ist der Kern des Dokuments und welche Hauptpflichten entstehen? (3-5 klare Aufzählungspunkte).
2. 🚩 RED-FLAG-RADAR: Gibt es gefährliche, unübliche oder einseitige Klauseln?
   • Versteckte automatische Vertragsverlängerungen & überlange Kündigungsfristen
   • Einseitige Haftungsverschiebungen / Haftungsausschlüsse
   • Versteckte Gebühren, Nachberechnungen oder Preiserhöhungsklauseln
   • Einseitige Kündigungs- oder Leistungsänderungsrechte
   • Ungewöhnliche Gerichtsstände oder Schiedsgerichtsklauseln
3. 💡 VERHANDLUNGS-TIPPS: Was sollte vor der Unterschrift gestrichen oder nachverhandelt werden?
4. ⚖️ RECHTLICHER DISCLAIMER (Zwingend am Ende anhängen):
   > ⚠️ *Hinweis: Diese automatisierte Zusammenfassung dient der operativen Orientierung und ersetzt keine anwaltliche Rechtsberatung nach dem RDG.*`;
    }

    const currentYear = new Date().getFullYear();
    const b2bResearchDirective = `\n\n--- B2B-RECHERCHE-MANDAT (WELTWEITE FIRMENDATEN, WEBSITES & ENTSCHEIDER - ZEITSTAND ${currentYear}) ---
- Du bist ein hochkompetenter B2B-Sales- & Recherche-Assistent für das D.A.T. NeXus Revenue OS.
- Alle Anfragen beziehen sich AUSSCHLIESSLICH auf öffentlich zugängliche B2B-Unternehmensdaten, Impressumsangaben (§ 5 TMG / DSGVO geschäftliche Angaben) und öffentliche LinkedIn-Profile von Führungskräften und Organen im geschäftlichen Verkehr.
- STRENGSTENS UNTERSAGT: Verweigere NIEMALS Auskünfte mit Datenschutz-, Privatsphäre- oder "personenbezogene Kontaktdaten"-Floskeln (wie z.B. "Ich kann dir leider keine personenbezogenen Kontaktdaten zur Verfügung stellen")! Bei geschäftlichen B2B-Daten und Firmenwebseiten ist das unzulässig und falsch.
- Wenn der Nutzer nach einer Firma, Website, Domain, Ansprechpartnern, Entscheidern oder E-Mail-Adressen fragt:
  1. Liefere IMMER eine saubere, strukturierte Markdown-Tabelle auf ${userLangName}:
     | Unternehmen & Land | Offizielle Website / Suche | Ansprechpartner / Zielrolle | 1-Klick LinkedIn-Suche | Kontakt & E-Mail-Muster |
     |---|---|---|---|---|
     | Firmenname | [Website / Suche](https://www.google.com/search?q=FIRMENNAME+official+website) | Name (falls gefunden) oder Zielrolle (z.B. Head of Sales / Geschäftsführer) | [LinkedIn Suche](https://www.linkedin.com/search/results/people/?keywords=FIRMENNAME+Sales+CEO) | gefundene E-Mail (z.B. aus Impressum) oder \`info@firma.com\` / \`vorname.nachname@firma.com\` |
  2. Gib direkt danach 2-3 konkrete Sätze als perfekten B2B-Aufhänger / Einstieg für die Erstansprache.
  3. Stelle NIEMALS theoretische Gegenfragen ("Welche Tools haben Sie genutzt?"). Liefere sofort die fertige Tabelle mit allen anklickbaren Links!`;

    const isIntelligenceMode = mode === 'lead_intelligence' || (systemPrompt || '').includes('zielgruppe') || (systemPrompt || '').includes('vertriebsstrategie');
    const contextSystem = (context && context.system && !systemPrompt.includes(context.system.slice(0, 50))) ? `\n\n${context.system}` : '';
    const finalSystemPrompt = [systemPrompt, contextSystem, langInstruction, contractInstruction, isIntelligenceMode ? '' : b2bResearchDirective].filter(Boolean).join('\n\n');
    
    const messages = [
      { role: "system", content: finalSystemPrompt }
    ];
    
    if (context && context.history && Array.isArray(context.history)) {
      context.history.forEach(msg => messages.push({ role: msg.role, content: msg.content }));
    }

    if (hasImage) {
      const contentArray = [
        { type: "text", text: effectiveUserMessage || "Bitte analysiere diese angehängten Bilder / Dokumente / Video-Frames gründlich im NeXus-Vertriebs-, Content- und Video-Kontext." }
      ];
      attachedImages.forEach(imgUrl => {
        if (imgUrl) contentArray.push({ type: "image_url", image_url: { url: imgUrl } });
      });
      messages.push({
        role: "user",
        content: contentArray
      });
    } else {
      messages.push({ role: "user", content: effectiveUserMessage });
    }

    // --- WEB SEARCH & STANDALONE EMAIL CRAWLER: Vollautomatische B2B-Recherche ---
    const urlMatches = effectiveUserMessage.match(/(?:https?:\/\/|www\.)[^\s<>"'`]+|[a-zA-Z0-9-]+\.(?:de|com|net|org|io|ai|eu|at|ch|es|fr|it|uk|co|biz|info)\b/gi);
    const directUrlOrDomain = urlMatches && urlMatches.length > 0 ? urlMatches[0] : null;
    const isExplicitRechercheMode = systemPrompt && (
      systemPrompt.includes('Recherche-Agent') || 
      systemPrompt.includes('Sales & Content Coach') || 
      systemPrompt.includes('DealCoach') || 
      systemPrompt.includes('B2B-RECHERCHE-MANDAT')
    );
    const searchTriggers = [
      'wer ist', 'geschäftsführer', 'ceo', 'ansprechpartner', 'entscheider', 
      'e-mail', 'email', 'kontakt', 'recherchiere', 'scanne', 'analysiere', 
      'finde', 'suche', 'website', 'homepage', 'url', 'linkedin', 'firma', 
      'unternehmen', 'lead', 'head of', 'leiter', 'vertrieb', 'sales', 'adresse', 'impressum'
    ];
    const isAngebotsanalyse = mode === 'angebotsanalyse' || (systemPrompt || '').includes('B2B Vertriebsmodell') || (lowerMsg.includes('analysiere') && lowerMsg.includes('angebot'));
    const isChatMode = mode === 'chat';
    const needsSearch = !hasImage && !isChatMode && !isAngebotsanalyse && !isIntelligenceMode && (Boolean(directUrlOrDomain) || isExplicitRechercheMode || searchTriggers.some(t => lowerMsg.includes(t)));

    if (needsSearch) {
      let companyName = (context?.company?.name || context?.company?.firmenname || context?.company || '').toString().trim();
      let domainTarget = directUrlOrDomain ? directUrlOrDomain.replace(/^https?:\/\//i, '').replace(/^www\./i, '').split('/')[0].toLowerCase() : null;

      if (!companyName || companyName === '[object Object]') {
        const cleaned = effectiveUserMessage
          .replace(/https?:\/\/[^\s]+/gi, ' ')
          .replace(/\b(finde den entscheider|find contact|wie lautet die e-mail|wie ist die email|e-mail von|email von|website|url|homepage|link|ansprechpartner|ceo|geschäftsführer|head of|wer ist|kontakt|linkedin|firmensitz|adresse|opportunity|die|der|das|von|für|bei|und|zu|in|mit|über|wie|was|finde|finden|suche|suchen|recherchiere|recherchieren|analysiere|analysieren|scanne|scannen)\b/gi, ' ')
          .replace(/[^\w\säöüÄÖÜßáéíóúÁÉÍÓÚñÑ-]/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();
        companyName = cleaned.split(/\s+/).slice(0, 4).join(' ');
      }
      
      const effectiveTarget = companyName.length > 1 ? companyName : (domainTarget || effectiveUserMessage.trim().slice(0, 60));
      
      if (effectiveTarget && effectiveTarget.length > 1) {
        console.log(`[NEXUS] Auto-Search & Email Crawler for: "${effectiveTarget}" (Domain: ${domainTarget || 'none'})`);
        
        const timeoutPromise = new Promise(resolve => setTimeout(() => resolve(null), 4500));
        const searchTasks = Promise.all([
          webSearch(`${effectiveTarget} official website`).catch(() => null),
          webSearch(`${effectiveTarget} LinkedIn`).catch(() => null),
          webSearch(`${effectiveTarget} CEO Geschäftsführer Ansprechpartner Leiter Impressum`).catch(() => null),
          runEmailPatternCrawler({ companyName: effectiveTarget, domain: domainTarget }).catch(() => null)
        ]);

        const searchRes = await Promise.race([searchTasks, timeoutPromise]) || [null, null, null, null];
        const [websiteResults, linkedinResults, contactResults, crawlerResult] = searchRes;
        
        const seenUrls = new Set();
        const allResults = [];
        for (const item of [...(websiteResults || []), ...(linkedinResults || []), ...(contactResults || [])]) {
          if (item && item.url && !seenUrls.has(item.url)) {
            seenUrls.add(item.url);
            allResults.push(item);
          }
        }
        
        let searchContext = '';
        if (allResults.length > 0) {
          searchContext = allResults.slice(0, 8).map(r => `Quelle: ${r.title}\nURL: ${r.url}\nInfo: ${r.snippet}`).join("\n\n");
        }
        
        let crawlerContext = '';
        if (crawlerResult && crawlerResult.success) {
          crawlerContext = `\n\n--- STANDALONE EMAIL CRAWLER ERGEBNISSE ---
Firma: ${crawlerResult.company || effectiveTarget}
Domain: ${crawlerResult.domain}
Gecrawlt: ${crawlerResult.crawledPages?.length || 0} Seiten
Gefundene Personen-Adressen: ${crawlerResult.foundEmails?.personal?.join(', ') || 'Keine direkten'}
Allgemeine Adressen: ${crawlerResult.foundEmails?.generic?.join(', ') || 'Keine'}
Abgeleitetes Muster: ${crawlerResult.patternInfo?.patternLabel || 'vorname.nachname@' + crawlerResult.domain}
Zielperson: ${crawlerResult.person?.name || 'Entscheider'} (${crawlerResult.person?.role || 'Führungskraft'})
Generierte E-Mail: ${crawlerResult.person?.email || 'kontakt@' + crawlerResult.domain}
Konfidenz: ${crawlerResult.person?.email_confidence || crawlerResult.patternInfo?.confidence || 75}/100`;
        } else if (crawlerResult && crawlerResult.success === false) {
          crawlerContext = `\n\n--- STANDALONE EMAIL CRAWLER INFO ---
Status: ${crawlerResult.reason || 'Keine direkten E-Mails im Quellcode gefunden'}.
Vorschlag: ${crawlerResult.coachText || ''}`;
        }

        if (searchContext || crawlerContext) {
          messages[messages.length - 1].content = `[SYSTEM-INTERN: LIVE ON-DEMAND B2B-RECHERCHE & CRAWLER FÜR "${effectiveTarget}":

${searchContext}
${crawlerContext}

BEFEHL: Verwende diese Web-Daten für eine präzise B2B-Tabelle mit 1-Klick-Links zu LinkedIn und Google sowie offiziellen Kontaktangaben. Verweigere unter keinen Umständen mit Datenschutz-Ausreden.]

Meine Frage: ${userMessage}`;
        }
      }
    }
    // --- END WEB SEARCH & STANDALONE EMAIL CRAWLER ---

    console.log("[NEXUS] Starting callAI loop (hasImage=" + hasImage + ")");
    const wantsJsonMode = mode ? (mode !== 'chat' && mode !== 'assistant') : /validem JSON|EXAKT folgender Struktur/i.test(systemPrompt || '');
    const strictSchema = wantsJsonMode && (isIntelligenceMode || isAngebotsanalyse);
    const requiredKeys = ['zielgruppe', 'schmerzpunkte', 'vertriebsstrategie', 'pitch_grundlage'];
    const callStart = Date.now();

    let result = await callAI(messages, temperature || 0.3, hasImage, { ...(testOptions || {}), preferJsonModels: wantsJsonMode });
    console.log("[NEXUS] callAI loop done via " + (result?.model || 'none'));

    if (!result || !result.text) {
      throw new Error("KI antwortet nicht rechtzeitig. Bitte warte kurz und versuche es erneut.");
    }

    const content = result.text;

    if (strictSchema) {
      let check = validateStructuredResult(content, requiredKeys);

      // 1 Retry mit anderem Modell, wenn Zeitbudget es zulässt
      if (!check.ok && Date.now() - callStart < 6000 && result.model) {
        console.warn(`[NEXUS] Schema-Validation failed (${check.reason}) -> Retry ohne Modell ${result.model}`);
        const retry = await callAI(messages, temperature || 0.3, hasImage, { ...(testOptions || {}), preferJsonModels: true, skipModels: [result.model] });
        if (retry?.text) {
          const recheck = validateStructuredResult(retry.text, requiredKeys);
          if (recheck.ok) {
            result = retry;
            check = recheck;
            console.log(`[NEXUS] Retry succeeded via ${retry.provider} (${retry.model})`);
          } else {
            console.warn(`[NEXUS] Retry failed too: ${recheck.reason}`);
            check.reason = `${check.reason} / Retry: ${recheck.reason}`;
          }
        }
      }

      if (!check.ok) {
        // NIEMALS Roh-Text oder degeneriertes JSON ausliefern
        return {
          statusCode: 502,
          body: JSON.stringify({ error: `Die KI-Analyse war ungültig (${check.reason}). Bitte versuche es erneut.` }),
          headers: { "Content-Type": "application/json" }
        };
      }

      return {
        statusCode: 200,
        body: JSON.stringify(check.parsed),
        headers: { "Content-Type": "application/json" }
      };
    }

    // Nachsichtig: JSON wenn möglich, sonst strukturierte Extraktion, sonst Roh-Text (Chat)
    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch (e) {
      parsed = extractJsonObject(content) || content;
    }

    return {
      statusCode: 200,
      body: JSON.stringify(parsed),
      headers: { "Content-Type": "application/json" }
    };
  } catch (error) {
    console.error("Backend LLM Error:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
      headers: { "Content-Type": "application/json" }
    };
  }
};





