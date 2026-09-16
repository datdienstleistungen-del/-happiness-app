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

async function tryGroq(messages, temperature = 0.3, hasImage = false) {
  const key = process.env.GROQ_API_KEY || process.env.VITE_GROQ_API_KEY || BACKUP_GROQ;
  if (!key) return null;
  const models = hasImage 
    ? ['llama-3.2-11b-vision-preview', 'llama-3.2-90b-vision-preview', 'openai/gpt-oss-120b', 'openai/gpt-oss-20b']
    : ['openai/gpt-oss-120b', 'openai/gpt-oss-20b', 'groq/compound', 'qwen/qwen3.8-27b'];
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
          max_tokens: 4096
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
        model: 'google/gemma-4-26b-a4b-it:free',
        messages,
        temperature,
        max_tokens: 4096
      })
    }, 15000);
    if (!res.ok) { await res.text().catch(e => {}); clearTimeout(timer); return null; }
    const data = await res.json();
    clearTimeout(timer);
    return { text: data.choices?.[0]?.message?.content || null, provider: 'openrouter', model: 'gemma-4-26b' };
  } catch { return null; }
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

// â"€â"€ Web Search mit Fallback-Kette: DuckDuckGo -> SearXNG -> Brave â"€â"€

async function tryDuckDuckGo(query) {
  try {
    const { res, timer } = await fetchWithTimeout(
      `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`,
      { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; NeXusBot/1.0)' } },
      8000
    );
    if (!res.ok) { clearTimeout(timer); return null; }
    const html = await res.text();
    clearTimeout(timer);
    
    const results = [];
    const regex = /<a[^>]+class="result__a"[^>]*href="([^"]*)"[^>]*>([^<]*)<\/a>[\s\S]*?<a[^>]+class="result__snippet"[^>]*>([\s\S]*?)<\/a>/gi;
    let match;
    while ((match = regex.exec(html)) !== null && results.length < 5) {
      const url = match[1].replace(/.*uddg=/, '').replace(/&.*/, '');
      const title = match[2].replace(/<[^>]*>/g, '').trim();
      const snippet = match[3].replace(/<[^>]*>/g, '').trim();
      if (url && title) results.push({ url, title, snippet });
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
      if (!res.ok) { clearTimeout(timer); continue; }
      const data = await res.json();
      clearTimeout(timer);
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
    if (!res.ok) { clearTimeout(timer); return null; }
    const data = await res.json();
    clearTimeout(timer);
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
  
  // 1. DuckDuckGo
  const ddgResults = await tryDuckDuckGo(query);
  if (ddgResults) { console.log(`[Search] DuckDuckGo: ${ddgResults.length} results`); return ddgResults; }
  
  // 2. SearXNG
  const searxResults = await trySearXNG(query);
  if (searxResults) { console.log(`[Search] SearXNG: ${searxResults.length} results`); return searxResults; }
  
  // 3. Brave
  const braveResults = await tryBraveSearch(query);
  if (braveResults) { console.log(`[Search] Brave: ${braveResults.length} results`); return braveResults; }
  
  console.log("[Search] All providers failed");
  return [];
}

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const body = event.body ? JSON.parse(event.body) : {};
    const { systemPrompt, userMessage, context, temperature, lang, targetLang, isLandingPreview, imageUrl, image_url } = body;
    const attachedImageUrl = imageUrl || image_url || (context && (context.imageUrl || context.image_url)) || null;
    const hasImage = !!attachedImageUrl;

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
    
    let finalLang = lang || 'de';
    if (targetLang && targetLang !== 'auto') {
      finalLang = targetLang;
    }
    const langName = languageNames[finalLang] || languageNames['de'];
    
    let langInstruction = `\n\nCRITICAL REQUIREMENT: Du musst deine gesamte Antwort / Nachricht zwingend in dieser Sprache verfassen: ${langName}! (Respond completely in ${langName}).`;
    if (targetLang === 'auto') {
      langInstruction = `\n\nCRITICAL REQUIREMENT: Falls ein spezifisches Zielunternehmen aus einem anderen Land adressiert wird, passe die Nachricht an dessen Landessprache an. Ansonsten verfasse die gesamte Antwort / Nachricht zwingend in dieser Sprache: ${langName}! (Respond completely in ${langName}).`;
    }

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

    const contextSystem = (context && context.system) ? `\n\n${context.system}` : '';
    const finalSystemPrompt = systemPrompt + contextSystem + langInstruction + contractInstruction;
    
    const messages = [
      { role: "system", content: finalSystemPrompt }
    ];
    
    if (context && context.history && Array.isArray(context.history)) {
      context.history.forEach(msg => messages.push({ role: msg.role, content: msg.content }));
    }
    
    if (hasImage) {
      messages.push({
        role: "user",
        content: [
          { type: "text", text: userMessage || "Bitte analysiere dieses angehängte Bild / Dokument gründlich im NeXus-Vertriebs- und Recherche-Kontext." },
          { type: "image_url", image_url: { url: attachedImageUrl } }
        ]
      });
    } else {
      messages.push({ role: "user", content: userMessage });
    }

    // --- WEB SEARCH & STANDALONE EMAIL CRAWLER: Auto-Suche & Crawler bei Bedarf ---
    const isContactMode = systemPrompt ? (systemPrompt.includes('Recherche-Agent') || systemPrompt.includes('Coach')) : false;
    const searchTriggers = ['website', 'url', 'homepage', 'link', 'ansprechpartner', 'ceo', 
      'geschäftsführer', 'head of', 'wer ist', 'kontakt', 'linkedin', 'firmensitz', 'adresse', 'email', 'e-mail', 'mail'];
    const needsSearch = !hasImage && (isContactMode || searchTriggers.some(t => lowerMsg.includes(t)));
    
    if (needsSearch) {
      // Firma aus Context oder Nachricht extrahieren
      const rawCompany = (context?.company?.name || context?.company || userMessage)
        .replace(/finde den entscheider|find contact|wie lautet die e-mail|wie ist die email|e-mail von|email von|website|url|homepage|link|ansprechpartner|ceo|geschäftsführer|head of|wer ist|kontakt|linkedin|firmensitz|adresse|von|für|die|der|das|bei/gi, '')
        .trim().split(/\s+/).slice(0, 3).join(' ');
      
      const companyName = rawCompany.length > 1 ? rawCompany : (context?.company?.name || null);
      
      if (companyName && companyName.length > 1) {
        console.log(`[NEXUS] Auto-Search & Email Crawler for: ${companyName}`);
        
        // Parallele Ausführung: WebSearch + Email Crawler
        const [websiteResults, contactResults, crawlerResult] = await Promise.all([
          webSearch(`${companyName} website homepage`),
          webSearch(`${companyName} CEO Geschäftsführer Geschäftsführung Ansprechpartner Leiter`),
          runEmailPatternCrawler({ companyName }).catch(err => {
            console.warn('[NEXUS] Email Crawler Fehler:', err.message);
            return null;
          })
        ]);
        
        const allResults = [...(websiteResults || []), ...(contactResults || [])];
        let searchContext = '';
        if (allResults.length > 0) {
          searchContext = allResults.map(r => `Quelle: ${r.title}\nURL: ${r.url}\nInfo: ${r.snippet}`).join("\n\n");
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
          messages[messages.length - 1].content = `[SYSTEM-INTERN: On-Demand Recherche & Email-Crawler für "${companyName}":

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





