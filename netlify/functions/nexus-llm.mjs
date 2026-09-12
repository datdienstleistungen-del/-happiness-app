// â”€â”€ Multi-Provider Fallback Chain â”€â”€

async function fetchWithTimeout(url, options, timeoutMs = 4000) {
  const controller = new AbortController();
  const abortId = setTimeout(() => controller.abort(), timeoutMs);
  let raceId;
  
  try {
    const res = await Promise.race([
      fetch(url, { ...options, signal: controller.signal }),
      new Promise((_, reject) => {
        raceId = setTimeout(() => reject(new Error('Fetch timeout race')), timeoutMs);
      })
    ]);
    return { res, abortId, raceId };
  } catch (err) {
    clearTimeout(abortId);
    clearTimeout(raceId);
    throw err;
  }
}

async function tryGroq(messages, temperature = 0.3) {
  const key = process.env.GROQ_API_KEY || process.env.VITE_GROQ_API_KEY
  if (!key) return null
  try {
    const { res, abortId, raceId } = await fetchWithTimeout('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'groq/compound',
        messages,
        temperature,
        max_tokens: 4096
      })
    }, 15000)
    if (!res.ok) { 
      const errText = await res.text().catch(e => {}); 
      clearTimeout(abortId); clearTimeout(raceId); 
      throw new Error(`Groq API Error (${res.status}): ${errText}`);
    }
    const data = await res.json()
    clearTimeout(abortId); clearTimeout(raceId);
    return { text: data.choices?.[0]?.message?.content || null, provider: 'groq', model: 'groq/compound' }
  } catch (e) {
    throw new Error(`Groq Fehler: ${e.message}`);
  }
}

async function tryOpenRouter(messages, temperature = 0.3) {
  const key = process.env.OPENROUTER_API_KEY || process.env.VITE_OPENROUTER_API_KEY
  if (!key) return null
  try {
    const { res, abortId, raceId } = await fetchWithTimeout('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://happiness-eu.netlify.app',
        'X-Title': 'NeXus Sales Intelligence'
      },
      body: JSON.stringify({
        model: 'google/gemma-4-26b-a4b-it:free',
        messages,
        temperature,
        max_tokens: 4096
      })
    }, 15000)
    if (!res.ok) { await res.text().catch(e => {}); clearTimeout(abortId); clearTimeout(raceId); return null; }
    const data = await res.json()
    clearTimeout(abortId); clearTimeout(raceId);
    return { text: data.choices?.[0]?.message?.content || null, provider: 'openrouter', model: 'gemma-4-26b' }
  } catch { return null }
}

async function tryMistral(messages, temperature = 0.3) {
  const key = process.env.MISTRAL_API_KEY || process.env.VITE_MISTRAL_API_KEY
  if (!key) return null
  try {
    console.log("[NEXUS] Mistral fetch start");
    const { res, abortId, raceId } = await fetchWithTimeout('https://api.mistral.ai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'mistral-small-latest',
        messages,
        temperature,
        max_tokens: 4096
      })
    }, 15000)
    console.log("[NEXUS] Mistral fetch done", res.status);
    if (!res.ok) {
      const errText = await res.text()
      clearTimeout(abortId); clearTimeout(raceId);
      console.error(`Mistral API Error (${res.status}):`, errText)
      if (res.status === 429) {
        throw new Error('Mistral Rate Limit erreicht (Zu groÃŸer Text oder zu viele Anfragen).')
      }
      return null
    }
    
    let streamTimer;
    console.log("[NEXUS] Mistral json read start");
    const data = await Promise.race([
      res.json(),
      new Promise((_, reject) => { streamTimer = setTimeout(() => reject(new Error('Stream timeout')), 15000); })
    ])
    clearTimeout(abortId); clearTimeout(raceId); clearTimeout(streamTimer);
    console.log("[NEXUS] Mistral json read done");
    return { text: data.choices?.[0]?.message?.content || null, provider: 'mistral', model: 'mistral-small-latest' }
  } catch (e) { 
    console.error('Mistral Exception:', e.message)
    if (e.message.includes('Rate Limit')) throw e
    return null 
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

async function callAI(messages, temperature = 0.3) {
  const providers = [
    () => tryDeepSeek(messages, temperature),
    () => tryMistral(messages, temperature),
    () => tryOpenRouter(messages, temperature),
    () => tryOpenAI(messages, temperature),
  ]
  let lastError = null;
  for (const tryProvider of providers) {
    try {
      console.log(`[NEXUS] Trying provider loop step`);
      const result = await tryProvider()
      if (result && result.text) {
        console.log(`[NEXUS] Provider returned successfully`);
        return result
      }
    } catch (e) {
      console.warn('Provider failed with exception:', e.message);
      lastError = e;
      // continue to next provider
    }
  }
  throw lastError || new Error("KI antwortet nicht rechtzeitig (Rate Limit oder Ãœberlastung). Bitte warte kurz und versuche es erneut.");
}

// â"€â"€ Web Search mit Fallback-Kette: DuckDuckGo -> SearXNG -> Brave â"€â"€

async function tryDuckDuckGo(query) {
  try {
    const { res, abortId, raceId } = await fetchWithTimeout(
      `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`,
      { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; NeXusBot/1.0)' } },
      8000
    );
    if (!res.ok) { clearTimeout(abortId); clearTimeout(raceId); return null; }
    const html = await res.text();
    clearTimeout(abortId); clearTimeout(raceId);
    
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
      const { res, abortId, raceId } = await fetchWithTimeout(
        `${base}/search?q=${encodeURIComponent(query)}&format=json&categories=general`,
        { headers: { 'Accept': 'application/json' } },
        8000
      );
      if (!res.ok) { clearTimeout(abortId); clearTimeout(raceId); continue; }
      const data = await res.json();
      clearTimeout(abortId); clearTimeout(raceId);
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
    const { res, abortId, raceId } = await fetchWithTimeout(
      `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=5`,
      { headers: { 'Accept': 'application/json', 'Accept-Encoding': 'gzip', 'X-Subscription-Token': key } },
      8000
    );
    if (!res.ok) { clearTimeout(abortId); clearTimeout(raceId); return null; }
    const data = await res.json();
    clearTimeout(abortId); clearTimeout(raceId);
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
    // 1. Auth & Token Check
    const authHeader = event.headers.authorization;
    if (!authHeader) return { statusCode: 401, body: JSON.stringify({ error: "Missing Authorization header" }) };
    const token = authHeader.replace('Bearer ', '');
    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
    const serviceKey = process.env.SUPABASE_SERVICE_KEY;
    if (!supabaseUrl || !supabaseKey) return { statusCode: 500, body: JSON.stringify({ error: "Supabase config missing" }) };
    
    console.log("[NEXUS] Fetching user auth");
    let userRes, abortId, raceId;
    try {
      ({ res: userRes, abortId, raceId } = await fetchWithTimeout(`${supabaseUrl}/auth/v1/user`, {
        headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${token}` }
      }, 15000));
    } catch(e) {
      console.log("[NEXUS] Auth fetch failed:", e.message);
      return { statusCode: 500, body: JSON.stringify({ error: "Auth timeout" }) };
    }
    
    if (!userRes.ok) {
      await userRes.text().catch(e => {}); // Konsumiere Body, um Socket zu schlieÃŸen!
      clearTimeout(abortId); clearTimeout(raceId);
      return { statusCode: 401, body: JSON.stringify({ error: "Invalid token" }) };
    }
    
    let userTimer;
    const user = await Promise.race([
      userRes.json(),
      new Promise((_, reject) => { userTimer = setTimeout(() => reject(new Error('User json timeout')), 15000); })
    ]).catch(e => null);
    clearTimeout(abortId); clearTimeout(raceId); clearTimeout(userTimer);
    
    if (!user || !user.id) return { statusCode: 401, body: JSON.stringify({ error: "Invalid token" }) };

    // Admin-Bypass: Harro darf alles
    const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || 'harro@happiness.de').split(',');
    const isAdmin = user.email && ADMIN_EMAILS.includes(user.email);

    // Premium-Tier-Check: is_premium + premium_tier
    let isPremium = false;
    let premiumTier = 'free';
    try {
      const { res: settingsRes } = await fetchWithTimeout(`${supabaseUrl}/rest/v1/ai_settings?user_id=eq.${user.id}&select=is_premium,premium_tier`, {
        headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${token}` }
      }, 10000);
      if (settingsRes.ok) {
        const settingsData = await settingsRes.json();
        isPremium = settingsData[0]?.is_premium === true;
        premiumTier = settingsData[0]?.premium_tier || 'free';
      }
    } catch(e) {}

    // 2. Rate Limiting Check
    console.log("[NEXUS] Fetching API usage");
    const TIER_LIMITS = { free: 5, pro: 100, enterprise: 500 };
    const MAX_REQUESTS = isAdmin ? Infinity : (TIER_LIMITS[premiumTier] || 5);
    const today = new Date().toISOString().split('T')[0];
    
    // SELECT: User-JWT (RLS erlaubt SELECT auf eigene Zeile)
    let usageRes, uAbortId, uRaceId;
    try {
      ({ res: usageRes, abortId: uAbortId, raceId: uRaceId } = await fetchWithTimeout(`${supabaseUrl}/rest/v1/nexus_api_usage?user_id=eq.${user.id}&select=*`, {
        headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${token}` }
      }, 15000));
    } catch(e) {
      console.log("[NEXUS] Usage fetch failed:", e.message);
      return { statusCode: 500, body: JSON.stringify({ error: "Usage timeout" }) };
    }

    if (!usageRes.ok) {
      await usageRes.text().catch(e => {}); // Body konsumieren
      clearTimeout(uAbortId); clearTimeout(uRaceId);
      return { statusCode: 500, body: JSON.stringify({ error: "DB usage error" }) };
    }
    
    let usageTimer;
    const usageData = await Promise.race([
      usageRes.json(),
      new Promise((_, reject) => { usageTimer = setTimeout(() => reject(new Error('Usage json timeout')), 15000); })
    ]).catch(e => []);
    clearTimeout(uAbortId); clearTimeout(uRaceId); clearTimeout(usageTimer);
    
    const usage = usageData.length > 0 ? usageData[0] : null;
    
    // Admin: Kein Rate-Limit, aber Usage trotzdem tracken
    if (!usage) {
      console.log("[NEXUS] Inserting usage (service key)");
      try {
        const { res: iRes, abortId: iAbort, raceId: iRace } = await fetchWithTimeout(`${supabaseUrl}/rest/v1/nexus_api_usage`, {
          method: 'POST',
          headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${serviceKey}`, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
          body: JSON.stringify({ user_id: user.id, requests_today: 1, last_request_date: today })
        }, 15000);
        await iRes.text().catch(e => {}); // Immer konsumieren
        clearTimeout(iAbort); clearTimeout(iRace);
      } catch(e) {}
    } else {
      let newCount = usage.requests_today;
      if (usage.last_request_date !== today) newCount = 1; else newCount += 1;
      
      // Admin: Kein Limit, aber Usage tracken
      if (!isAdmin && newCount > MAX_REQUESTS) {
        return { statusCode: 429, body: JSON.stringify({ error: "Rate limit exceeded." }) };
      }
      
      console.log("[NEXUS] Updating usage (service key)");
      try {
        const { res: uRes, abortId: upAbort, raceId: upRace } = await fetchWithTimeout(`${supabaseUrl}/rest/v1/nexus_api_usage?user_id=eq.${user.id}`, {
          method: 'PATCH',
          headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${serviceKey}`, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
          body: JSON.stringify({ requests_today: newCount, last_request_date: today })
        }, 15000);
        await uRes.text().catch(e => {}); // Immer konsumieren
        clearTimeout(upAbort); clearTimeout(upRace);
      } catch(e) {}
    }
    


    console.log("[NEXUS] Starting handler");
    const { systemPrompt, userMessage, context, temperature, lang, targetLang } = JSON.parse(event.body);

    const languageNames = { de: 'Deutsch', en: 'Englisch', es: 'Spanisch', fr: 'FranzÃ¶sisch', it: 'Italienisch', nl: 'NiederlÃ¤ndisch' };
    
    let finalLang = lang || 'de';
    if (targetLang && targetLang !== 'auto') {
      finalLang = targetLang;
    }
    const langName = languageNames[finalLang] || languageNames['de'];
    
    let langInstruction = `\n\nCRITICAL REQUIREMENT: Du musst die Nachricht zwingend auf ${langName} verfassen!`;
    if (targetLang === 'auto') {
      langInstruction = `\n\nCRITICAL REQUIREMENT: Passe die Sprache der Nachricht automatisch an das Land des Ziel-Unternehmens an. (z.B. Englisch fÃ¼r internationale Firmen, Deutsch fÃ¼r DACH).`;
    }

    const contextSystem = (context && context.system) ? `\n\n${context.system}` : '';
    const finalSystemPrompt = systemPrompt + contextSystem + langInstruction;
    
    const messages = [
      { role: "system", content: finalSystemPrompt }
    ];
    
    if (context && context.history && Array.isArray(context.history)) {
      context.history.forEach(msg => messages.push({ role: msg.role, content: msg.content }));
    }
    
    messages.push({ role: "user", content: userMessage });

    // --- WEB SEARCH: Auto-Suche bei Bedarf ---
    const lowerMsg = userMessage.toLowerCase();
    const isContactMode = systemPrompt.includes('Recherche-Agent');
    const searchTriggers = ['website', 'url', 'homepage', 'link', 'ansprechpartner', 'ceo', 
      'geschäftsführer', 'head of', 'wer ist', 'kontakt', 'linkedin', 'firmensitz', 'adresse'];
    const needsSearch = isContactMode || searchTriggers.some(t => lowerMsg.includes(t));
    
    if (needsSearch) {
      // Firma aus Context oder Nachricht extrahieren
      const companyName = context?.company || userMessage.replace(/finde den entscheider|find contact|website|url|homepage|link|ansprechpartner|ceo|geschäftsführer|head of|wer ist|kontakt|linkedin|firmensitz|adresse|von|für|die|der|das/gi, '').trim().split(/\s+/).slice(0, 3).join(' ');
      
      if (companyName && companyName.length > 1) {
        console.log(`[NEXUS] Auto-Search for: ${companyName}`);
        
        // Parallele Suchen: Website + Ansprechpartner
        const [websiteResults, contactResults] = await Promise.all([
          webSearch(`${companyName} website homepage`),
          webSearch(`${companyName} CEO Geschäftsführer Geschäftsführung Ansprechpartner Leiter`)
        ]);
        
        const allResults = [...(websiteResults || []), ...(contactResults || [])];
        if (allResults.length > 0) {
          const searchContext = allResults.map(r => `Quelle: ${r.title}\nURL: ${r.url}\nInfo: ${r.snippet}`).join("\n\n");
          messages[messages.length - 1].content = `[SYSTEM-INTERN: Web-Suche durchgeführt für "${companyName}". Gefundene Ergebnisse:\n\n${searchContext}\n\nBEFEHL: Nutze diese Informationen um die Frage des Nutzers präzise zu beantworten. Nenne konkrete URLs und Namen. Falls die Suche nichts Relevantes ergibt, sage das ehrlich.]\n\nMeine Frage: ${userMessage}`;
        }
      }
    }
    // --- END WEB SEARCH ---

    console.log("[NEXUS] Starting callAI loop");
    const result = await callAI(messages, temperature || 0.3);
    console.log("[NEXUS] callAI loop done");

    if (!result || !result.text) {
      throw new Error("Mistral KI antwortet nicht rechtzeitig (Rate Limit oder Ãœberlastung). Bitte warte kurz und versuche es erneut.");
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





