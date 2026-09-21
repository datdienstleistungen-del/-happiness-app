// ── Multi-Provider Fallback Chain ──
import { runEmailPatternCrawler } from './nexus-email-crawler.mjs';

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

async function tryGroq(messages, temperature = 0.3, hasImage = false) {
  const key = process.env.GROQ_API_KEY || process.env.VITE_GROQ_API_KEY || BACKUP_GROQ;
  if (!key) return null;
  const models = hasImage 
    ? ['llama-3.2-11b-vision-preview', 'llama-3.2-90b-vision-preview', 'openai/gpt-oss-120b', 'openai/gpt-oss-20b']
    : ['openai/gpt-oss-120b', 'openai/gpt-oss-20b', 'groq/compound-mini', 'groq/compound', 'qwen/qwen3.8-27b'];
  for (const model of models) {
    try {
      console.log(`[NEXUS] Trying Groq model: ${model}`);
      const { res, timer } = await fetchWithTimeout('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          messages,
          temperature,
          max_tokens: 2048
        })
      }, 20000);
      if (!res.ok) {
        clearTimeout(timer);
        continue;
      }
      const data = await res.json();
      clearTimeout(timer);
      const text = data.choices?.[0]?.message?.content;
      if (text) {
        return { text, provider: 'groq', model };
      }
    } catch (e) {
      console.warn(`[NEXUS] Groq ${model} error:`, e.message);
    }
  }
  return null;
}

async function tryOpenRouter(messages, temperature = 0.3) {
  const key = process.env.OPENROUTER_API_KEY || process.env.VITE_OPENROUTER_API_KEY || BACKUP_OPENROUTER;
  if (!key) return null;
  const models = ['nvidia/nemotron-3.5-lightning:free', 'openrouter/free', 'google/gemma-4-26b-a4b-it:free'];
  for (const model of models) {
    try {
      const { res, timer } = await fetchWithTimeout('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${key}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://nexus-hit.netlify.app',
          'X-Title': 'NeXus Sales Intelligence'
        },
        body: JSON.stringify({
          model,
          messages,
          temperature,
          max_tokens: 2048
        })
      }, 15000);
      if (!res.ok) { await res.text().catch(e => {}); clearTimeout(timer); continue; }
      const data = await res.json();
      clearTimeout(timer);
      const text = data.choices?.[0]?.message?.content;
      if (text) {
        return { text, provider: 'openrouter', model };
      }
    } catch (e) {
      console.warn(`[NEXUS] OpenRouter ${model} error:`, e.message);
    }
  }
  return null;
}

async function tryMistral(messages, temperature = 0.3) {
  const key = process.env.MISTRAL_API_KEY || process.env.VITE_MISTRAL_API_KEY || BACKUP_MISTRAL;
  if (!key) return null;
  try {
    const { res, timer } = await fetchWithTimeout('https://api.mistral.ai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'mistral-small-latest',
        messages,
        temperature,
        max_tokens: 4096
      })
    }, 15000);
    if (!res.ok) {
      clearTimeout(timer);
      console.warn(`Mistral API Error (${res.status}) - falling back`);
      return null;
    }
    
    const data = await res.json();
    clearTimeout(timer);
    return { text: data.choices?.[0]?.message?.content || null, provider: 'mistral', model: 'mistral-small-latest' };
  } catch (e) { 
    console.warn('Mistral Exception - falling back:', e.message);
    return null; 
  }
}

async function tryOpenAI(messages, temperature = 0.3) {
  const key = process.env.OPENAI_API_KEY
  if (!key) return null
  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages,
        temperature,
        max_tokens: 4096
      })
    })
    if (!res.ok) { await res.text().catch(e => {}); return null; }
    const data = await res.json()
    return { text: data.choices?.[0]?.message?.content || null, provider: 'openai', model: 'gpt-4o-mini' }
  } catch { return null }
}

async function tryDeepSeek(messages, temperature = 0.3) {
  const key = process.env.DEEPSEEK_API_KEY
  if (!key) return null
  try {
    const res = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages,
        temperature,
        max_tokens: 4096
      })
    })
    if (!res.ok) { await res.text().catch(e => {}); return null; }
    const data = await res.json()
    return { text: data.choices?.[0]?.message?.content || null, provider: 'deepseek', model: 'deepseek-chat' }
  } catch { return null }
}

async function callAI(messages, temperature = 0.3, hasImage = false) {
  const providers = hasImage 
    ? [
        () => tryOpenAI(messages, temperature),
        () => tryGroq(messages, temperature, true),
        () => tryOpenRouter(messages, temperature),
        () => tryMistral(messages, temperature),
        () => tryDeepSeek(messages, temperature)
      ]
    : [
        () => tryGroq(messages, temperature, false),
        () => tryMistral(messages, temperature),
        () => tryOpenRouter(messages, temperature),
        () => tryDeepSeek(messages, temperature),
        () => tryOpenAI(messages, temperature),
      ];
  let lastError = null;
  for (const tryProvider of providers) {
    try {
      const result = await tryProvider()
      if (result && result.text) {
        console.log(`[NEXUS] Provider ${result.provider} (${result.model}) returned successfully`);
        return result
      }
    } catch (e) {
      console.warn('Provider failed with exception:', e.message);
      lastError = e;
    }
  }
  throw lastError || new Error("KI antwortet nicht rechtzeitig. Bitte warte kurz und versuche es erneut.");
}

// ── Web Search mit Fallback-Kette: Tavily -> DuckDuckGo -> Brave -> SearXNG ──

async function tryTavilySearch(query) {
  const tavilyKeys = [
    process.env.TAVILY_API_KEY,
    process.env.TAVILY_API_KEY_2,
    process.env.VITE_TAVILY_API_KEY,
    BACKUP_TAVILY
  ].filter(Boolean);

  for (const key of tavilyKeys) {
    try {
      const { res, timer } = await fetchWithTimeout("https://api.tavily.com/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          api_key: key,
          query,
          search_depth: "basic",
          include_answer: false,
          max_results: 6
        })
      }, 10000);
      clearTimeout(timer);
      if (res.ok) {
        const data = await res.json();
        if (data && data.results && data.results.length > 0) {
          return data.results.map(r => ({
            url: r.url,
            title: r.title,
            snippet: r.content || ''
          }));
        }
      }
    } catch (e) {
      console.warn('[Search] Tavily error:', e.message);
    }
  }
  return null;
}

async function tryDuckDuckGo(query) {
  try {
    const { res, timer } = await fetchWithTimeout(
      `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`,
      { 
        headers: { 
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'de-DE,de;q=0.9,en-US;q=0.8,en;q=0.7'
        } 
      },
      8000
    );
    clearTimeout(timer);
    if (!res.ok) return null;
    const html = await res.text();
    
    const results = [];
    const linkRegex = /<a[^>]+class="result__a"[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;
    let match;
    while ((match = linkRegex.exec(html)) !== null && results.length < 6) {
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

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const body = event.body ? JSON.parse(event.body) : {};
    const { systemPrompt, userMessage, context, temperature, lang, targetLang, isLandingPreview, imageUrl, image_url, imageUrls, image_urls } = body;
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

    const lowerMsg = (typeof userMessage === 'string' ? userMessage : (JSON.stringify(userMessage) || '')).toLowerCase();

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

    const b2bResearchDirective = `\n\n--- B2B-RECHERCHE-MANDAT (ÖFFENTLICHE FIRMENDATEN, WEBSITES & ENTSCHEIDER) ---
- Du bist ein hocheffizienter B2B-Vertriebs- & Recherche-Assistent.
- Wenn der Nutzer nach Firmen-Websites, Links, Ansprechpartnern, Entscheidern oder E-Mail-Adressen fragt (z.B. für Firmen aus Text oder Screenshots wie "BioPharma Innovación", "LogiChain Distribuciones", "EcoBuild Constructora", "DataFlux Analytics", "Innovatec Soluciones Industriales"):
- Liefere für JEDE angefragte Firma eine strukturierte Markdown-Tabelle oder Übersicht mit:
  1. Firma & Branche
  2. Offizielle Website / 1-Klick-Suchlink: [Website / Google Suche](https://www.google.com/search?q=...)
  3. Relevante B2B-Entscheider-Rollen (z.B. Geschäftsführer / CEO, Head of Sales, VP Business Development, Einkaufsleiter)
  4. 1-Klick-Link zur gezielten Personensuche auf LinkedIn: [LinkedIn Suche](https://www.linkedin.com/search/results/people/?keywords=...)
  5. Typisches geschäftliches E-Mail-Schema (z.B. info@firma.com, kontakt@firma.com oder vorname.nachname@firma.com)
- STRIKT VERBOTEN: Verweigere NIEMALS mit Floskeln wie "Es tut mir leid, aber ich kann Ihnen bei dieser Anfrage nicht weiterhelfen" oder Datenschutz-Vorwänden!
- STRIKT VERBOTEN: Stelle NIEMALS theoretische Gegenfragen oder Fragebögen ("Welches Ziel hatten Sie?", "Welche Quellen haben Sie genutzt?").
- Liefere IMMER sofort handlungsfähige Ergebnisse, 1-Klick-Links und strukturierte Markdown-Tabellen!`;

    const contextSystem = (context && context.system && !systemPrompt.includes(context.system.slice(0, 50))) ? `\n\n${context.system}` : '';
    const finalSystemPrompt = [systemPrompt, contextSystem, langInstruction, contractInstruction, b2bResearchDirective].filter(Boolean).join('\n\n');
    
    const messages = [
      { role: "system", content: finalSystemPrompt }
    ];
    
    if (context && context.history && Array.isArray(context.history)) {
      context.history.forEach(msg => messages.push({ role: msg.role, content: msg.content }));
    }
    
    if (hasImage) {
      const contentArray = [
        { type: "text", text: userMessage || "Bitte analysiere diese angehängten Bilder / Dokumente / Video-Frames gründlich im NeXus-Vertriebs-, Content- und Video-Kontext." }
      ];
      attachedImages.forEach(imgUrl => {
        if (imgUrl) contentArray.push({ type: "image_url", image_url: { url: imgUrl } });
      });
      messages.push({
        role: "user",
        content: contentArray
      });
    } else {
      messages.push({ role: "user", content: userMessage });
    }

    // --- WEB SEARCH & STANDALONE EMAIL CRAWLER: Nur bei gezielten Recherche-Anfragen ---
    const isExplicitRechercheMode = systemPrompt && systemPrompt.includes('Recherche-Agent');
    const searchTriggers = ['wer ist der geschäftsführer', 'wer ist ceo', 'ansprechpartner finden', 'entscheider finden', 'e-mail adresse von', 'kontakt von', 'recherchiere'];
    const needsSearch = !hasImage && (isExplicitRechercheMode || searchTriggers.some(t => lowerMsg.includes(t)));

    if (needsSearch) {
      // Firma aus Context oder Nachricht extrahieren
      let companyName = (context?.company?.name || context?.company?.firmenname || context?.company || '').toString().trim();
      if (!companyName || companyName === '[object Object]') {
        const cleaned = userMessage
          .replace(/\b(finde den entscheider|find contact|wie lautet die e-mail|wie ist die email|e-mail von|email von|website|url|homepage|link|ansprechpartner|ceo|geschäftsführer|head of|wer ist|kontakt|linkedin|firmensitz|adresse|opportunity|die|der|das|von|für|bei|und|zu|in|mit|über|wie|was|finde|finden|suche|suchen|recherchiere|recherchieren|analysiere|analysieren)\b/gi, ' ')
          .replace(/[^\w\säöüÄÖÜßáéíóúÁÉÍÓÚñÑ-]/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();
        companyName = cleaned.split(/\s+/).slice(0, 4).join(' ');
      }
      
      const effectiveTarget = companyName.length > 1 ? companyName : userMessage.trim().slice(0, 60);
      
      if (effectiveTarget && effectiveTarget.length > 1) {
        console.log(`[NEXUS] Auto-Search & Email Crawler for: ${effectiveTarget}`);
        
        // Parallele Ausführung mit maximal 3.5s Timeout
        const timeoutPromise = new Promise(resolve => setTimeout(() => resolve(null), 3500));
        const searchTasks = Promise.all([
          webSearch(`${effectiveTarget} official website`).catch(() => null),
          webSearch(`${effectiveTarget} LinkedIn`).catch(() => null),
          webSearch(`${effectiveTarget} CEO Geschäftsführer Ansprechpartner Leiter`).catch(() => null),
          runEmailPatternCrawler({ companyName: effectiveTarget }).catch(() => null)
        ]);

        const searchRes = await Promise.race([searchTasks, timeoutPromise]) || [null, null, null, null];
        const [websiteResults, linkedinResults, contactResults, crawlerResult] = searchRes;
        
        // Deduplizierte Resultate zusammenführen
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
          crawlerContext = `\n\n--- STANDALONE EMAIL CRAWLER ERGEBNISSE (On-Demand Intelligence) ---
Firma: ${crawlerResult.company}
Domain: ${crawlerResult.domain}
Gecrawlt: ${crawlerResult.crawledPages?.length || 0} Seiten (${crawlerResult.crawledPages?.join(', ') || ''})
Gefundene Personen-Adressen: ${crawlerResult.foundEmails?.personal?.join(', ') || 'Keine direkten'}
Allgemeine Adressen: ${crawlerResult.foundEmails?.generic?.join(', ') || 'Keine'}
Abgeleitetes Muster: ${crawlerResult.patternInfo?.patternLabel || 'vorname.nachname@' + crawlerResult.domain}
Zielperson: ${crawlerResult.person?.name || 'Ansprechpartner'} (${crawlerResult.person?.role || 'Entscheider'})
Generierte E-Mail: ${crawlerResult.person?.email}
Konfidenz: ${crawlerResult.person?.email_confidence}/100 (${crawlerResult.patternInfo?.isGuess ? 'ungeprüfte Standard-Vermutung' : 'abgeleitet aus echten Website-Adressen'})
Formulierungsvorschlag: ${crawlerResult.coachText}`;
        } else if (crawlerResult && crawlerResult.success === false) {
          crawlerContext = `\n\n--- STANDALONE EMAIL CRAWLER INFO ---
Status: Keine Domain erreichbar oder keine E-Mail-Muster auffindbar (${crawlerResult.reason}).
Formulierungsvorschlag: ${crawlerResult.coachText}`;
        }

        if (searchContext || crawlerContext) {
          messages[messages.length - 1].content = `[SYSTEM-INTERN: On-Demand Recherche & Email-Crawler für "${effectiveTarget}":

${searchContext}
${crawlerContext}

BEFEHL: Verwende diese Daten für eine präzise, faktenbasierte und transparente Antwort. Nenne die E-Mail-Adresse, das erkannte Muster und die Konfidenz transparent (z.B. "Basierend auf dem E-Mail-Muster von..."). Falls keine Daten vorliegen, sage das ehrlich. Erwähne keine kostenpflichtigen Drittanbieter-Tools wie Hunter.io.]

Meine Frage: ${userMessage}`;
        }
      }
    }
    // --- END WEB SEARCH & STANDALONE EMAIL CRAWLER ---

    console.log("[NEXUS] Starting callAI loop (hasImage=" + hasImage + ")");
    const result = await callAI(messages, temperature || 0.3, hasImage);
    console.log("[NEXUS] callAI loop done");

    if (!result || !result.text) {
      throw new Error("KI antwortet nicht rechtzeitig. Bitte warte kurz und versuche es erneut.");
    }

    const content = result.text;
    
    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch (e) {
      parsed = content; // Fallback
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





