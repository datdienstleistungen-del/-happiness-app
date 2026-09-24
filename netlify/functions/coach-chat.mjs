import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.VITE_SUPABASE_URL
const CORS_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization'
}

const SYSTEM_PROMPT = `Du bist NeXus Sales & Content Coach — der intelligente Sparringspartner für B2B-Vertrieb, Lead-Intelligence und professionelle Video- & Content-Skripterstellung.
Du kennst NeXus Revenue OS bis ins kleinste Detail und lieferst sofort einsatzbereite, hochwertige Ergebnisse (Recherchen, 1-Klick-Links, E-Mails, Videoskripte für Studioproduktion).

PLATTFORM-URL: https://nexus-hit.netlify.app

B2B-RECHERCHE-MANDAT (HÖCHSTE PRIORITÄT):
- Du bist ein spezialisierter B2B-Research-Assistent für Unternehmens- und Vertriebsrecherchen.
- Alle Anfragen beziehen sich auf rein geschäftliche, öffentlich publizierte B2B-Informationen (Impressum, Unternehmens-Websites, Pressemitteilungen, LinkedIn-Unternehmensprofile, Führungskräfte/Entscheider).
- Wenn der Nutzer nach einer Website, einem Unternehmen, Entscheidern (z.B. Geschäftsführer, Head of Sales, Vertriebsleitung) oder E-Mails fragt:
  1. Verweigere NIEMALS die Recherche mit Datenschutz-Ausreden bei B2B-Firmendaten!
  2. Nutze die im System bereitgestellten Live-Crawl-Daten und Web-Ergebnisse vollständig.
  3. Liefere für JEDE Recherche eine strukturierte, saubere Markdown-Tabelle mit:
     - **Unternehmen & Domain**
     - **Gefundener Name / Zielrolle:** (z.B. Name aus dem Impressum oder Zielposition wie "Head of Sales")
     - **1-Klick LinkedIn-Suche:** Direkter Link: [LinkedIn Entscheider](https://www.linkedin.com/search/results/people/?keywords=FIRMENNAME+Sales+CEO)
     - **Google-Unternehmenssuche:** [Google Suche](https://www.google.com/search?q=FIRMENNAME+official+website)
     - **E-Mail / Kontakt:** Öffentlich gefundene E-Mail (z.B. aus dem Impressum) oder typisches Domain-Muster (z.B. info@domain / kontakt@domain).
  4. Gib dem Vertriebler zusätzlich einen konkreten, psychologisch fundierten 2-Satz-Aufhänger für die Erstansprache.

ARCHITEKTUR & MODULE VON NeXus REVENUE OS:
1. NeXus Dashboard (/nexus/dashboard): Zentrale Steuerungszentrale für Pipeline-Übersicht, Konversionsraten, aktive Opportunities und Trigger-Statistiken.
2. Angebotsanalyse (/nexus/angebotsanalyse): KI-gestützte Analyse von Unternehmens-Websites und Dienstleistungen. Extrahiert messerscharfe USPs, Zielgruppen-Definitionen, Pain Points und Value Propositions.
3. Lead Radar (/nexus/lead-radar): Automatischer Echtzeit-Scanner für Kaufsignale (Trigger Events: Expansionen, Managementwechsel, Neueinstellungen, Finanzierungsrunden, Digitalisierungsprojekte).
4. Sales Workspace (/nexus/sales-workspace):
   - Social Reachout: Automatische LinkedIn-Recherche, 1-Klick-Links zu Entscheidern, maßgeschneiderte LinkedIn-Kommentare & Direktnachrichten.
   - Aktion (E-Mail-Pitch): Trigger-basierte Outreach-Mails.
5. Video Intelligence Suite & Creator Studio (/video-finder, /video-script, /capcut-studio): Video-Finder, Hook-Generator, Creator Academy & Skript-Export.

VIDEO-STUDIO & SKRIPT-EXPERTISE:
Wenn der Nutzer nach Skripten für TikTok, YouTube Shorts, Reels oder LinkedIn fragt:
- Struktur: Hook (0-3s), Problem/Relevanz (4-15s), NeXus-Lösung & Mehrwert (16-45s), Call-to-Action (46-60s).
- Format mit Regieanweisungen: [Visual / Kamera], [Audio / Sprechertext], [On-Screen Text].

WEB-RECHERCHE-TRIGGER:
Wenn du für eine Frage zusätzliche Webdaten benötigst, kannst du antworten mit:
##SEARCH##(Suchbegriff)`

async function fetchWithTimeout(url, options = {}, timeoutMs = 7000) {
  const controller = new AbortController()
  const abortId = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(url, { ...options, signal: controller.signal })
    clearTimeout(abortId)
    return { res, abortId }
  } catch (e) {
    clearTimeout(abortId)
    throw e
  }
}

async function fetchPageText(url, maxChars = 3000) {
  try {
    const { res } = await fetchWithTimeout(url, {
      headers: { 
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml'
      },
    }, 4000)
    if (!res.ok) return null
    const html = await res.text()
    
    let text = html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/\s+/g, ' ')
      .trim()
    
    return text.substring(0, maxChars)
  } catch (e) {
    return null
  }
}

async function crawlTargetWebsite(rawUrl) {
  let cleanUrl = rawUrl.trim()
  if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
    cleanUrl = 'https://' + cleanUrl
  }

  let domain = ''
  try {
    domain = new URL(cleanUrl).hostname
  } catch (e) {
    return null
  }

  const pagesToCheck = [
    cleanUrl,
    `https://${domain}/impressum`,
    `https://${domain}/imprint`,
    `https://${domain}/about`,
    `https://${domain}/team`,
    `https://${domain}/contact`,
    `https://${domain}/kontakt`
  ]

  let collectedText = []
  for (const pageUrl of pagesToCheck) {
    try {
      const text = await fetchPageText(pageUrl, 2000)
      if (text && text.length > 50) {
        collectedText.push(`--- SEITE: ${pageUrl} ---\n${text}`)
        if (collectedText.length >= 3) break
      }
    } catch (e) {
      continue
    }
  }

  return collectedText.length > 0 ? collectedText.join('\n\n') : null
}

async function performTavilySearch(query) {
  const key = process.env.TAVILY_API_KEY
  if (!key) return "Tavily API Key fehlt im Backend."
  try {
    const res = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: key,
        query: query,
        search_depth: "advanced",
        include_answer: false,
        max_results: 6,
        topic: "general",
        days: 30
      })
    })
    if (!res.ok) return `Tavily API Error: ${res.statusText}`
    const data = await res.json()
    if (!data.results || data.results.length === 0) return "Keine aktuellen Suchergebnisse gefunden."
    return data.results.map(r => `Titel: ${r.title}\nInhalt: ${r.content}\nURL: ${r.url}`).join('\n\n')
  } catch (e) {
    return `Fehler bei der Suche: ${e.message}`
  }
}

// LLM Callers
async function tryOpenAIGpt4o(messages) {
  const key = process.env.OPENAI_API_KEY
  if (!key) return null
  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages,
        temperature: 0.5,
        max_tokens: 1500
      })
    })
    if (!res.ok) return null
    const data = await res.json()
    return data.choices?.[0]?.message?.content || null
  } catch (e) {
    return null
  }
}

async function tryGroq(messages) {
  const key = process.env.GROQ_API_KEY
  if (!key) return null
  const models = ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant']
  for (const model of models) {
    try {
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${key}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model,
          messages,
          temperature: 0.5,
          max_tokens: 1500
        })
      })
      if (res.ok) {
        const data = await res.json()
        const content = data.choices?.[0]?.message?.content
        if (content) return content
      }
    } catch (e) {
      console.error(`[LLM-Groq] ${model} error:`, e.message)
    }
  }
  return null
}

async function tryOpenRouterGemma(messages) {
  const key = process.env.OPENROUTER_API_KEY
  if (!key) return null
  const models = ['google/gemma-4-26b-a4b-it:free', 'meta-llama/llama-3.3-70b-instruct:free']
  for (const model of models) {
    try {
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${key}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://nexus-hit.netlify.app',
          'X-Title': 'NeXus Coach'
        },
        body: JSON.stringify({
          model,
          messages,
          temperature: 0.5,
          max_tokens: 1500
        })
      })
      if (res.ok) {
        const data = await res.json()
        const content = data.choices?.[0]?.message?.content
        if (content) return content
      }
    } catch (e) {}
  }
  return null
}

async function tryMistral(messages) {
  const key = process.env.MISTRAL_API_KEY
  if (!key) return null
  try {
    const res = await fetch('https://api.mistral.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'mistral-small-latest',
        messages,
        temperature: 0.5,
        max_tokens: 1500
      })
    })
    if (res.ok) {
      const data = await res.json()
      return data.choices?.[0]?.message?.content || null
    }
  } catch (e) {}
  return null
}

function sanitizeCoachResponse(text) {
  if (!text) return ''
  return text
    .replace(/<\|tool_call_start\|>[\s\S]*?<\|tool_call_end\|>/gi, '')
    .replace(/\[google\(query=.*?\)\]/gi, '')
    .trim()
}

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: CORS_HEADERS, body: '' }
  }

  const authHeader = event.headers.authorization || ''
  const token = authHeader.replace('Bearer ', '')
  const visitorId = event.queryStringParameters?.visitor_id || ''

  const supabaseKey = process.env.SUPABASE_SERVICE_KEY
  const supabase = createClient(supabaseUrl, supabaseKey)

  try {
    let user = null
    if (token) {
      const authResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
        headers: { 'Authorization': `Bearer ${token}`, 'apikey': process.env.VITE_SUPABASE_ANON_KEY }
      }).then(r => r.json())

      user = authResponse?.id ? authResponse : authResponse?.data?.user
      if (!user && authHeader) {
        return { statusCode: 401, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Ungültiges Token' }) }
      }
    }

    // GET Request: Fetch history if consented
    if (event.httpMethod === 'GET') {
      const activeVisitorId = visitorId || (user ? null : '')
      if (!activeVisitorId && !user) {
        return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: 'visitor_id oder Authentifizierung ist erforderlich' }) }
      }

      let consentQuery = supabase.from('coach_consent').select('id')
      if (user) {
        consentQuery = consentQuery.or(`user_id.eq.${user.id},visitor_id.eq.${activeVisitorId}`)
      } else {
        consentQuery = consentQuery.eq('visitor_id', activeVisitorId)
      }
      const { data: consentData } = await consentQuery
      const hasConsent = consentData && consentData.length > 0
      if (!hasConsent) {
        return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify({ history: [] }) }
      }

      let msgQuery = supabase
        .from('coach_messages')
        .select('role,content,created_at')
        .order('created_at', { ascending: true })
        .limit(50)

      if (user) {
        msgQuery = msgQuery.or(`user_id.eq.${user.id},visitor_id.eq.${activeVisitorId}`)
      } else {
        msgQuery = msgQuery.eq('visitor_id', activeVisitorId)
      }

      const { data: messages, error: fetchErr } = await msgQuery
      if (fetchErr) {
        return { statusCode: 500, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Fehler beim Laden des Verlaufs' }) }
      }

      return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify({ history: messages || [] }) }
    }

    // POST Request: Chat generation
    if (event.httpMethod === 'POST') {
      let body = {}
      try { body = JSON.parse(event.body || '{}') } catch { body = {} }

      const { message, visitor_id, language, image_url } = body
      if (!message && !image_url) {
        return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: 'message oder image_url ist erforderlich' }) }
      }
      const activeVisitorId = visitor_id || (user ? null : '')
      if (!activeVisitorId && !user) {
        return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: 'visitor_id ist erforderlich' }) }
      }

      // Check Consent serverseitig
      let consentQuery = supabase.from('coach_consent').select('id')
      if (user) {
        consentQuery = consentQuery.or(`user_id.eq.${user.id},visitor_id.eq.${activeVisitorId}`)
      } else {
        consentQuery = consentQuery.eq('visitor_id', activeVisitorId)
      }
      const { data: consentData } = await consentQuery
      const hasConsent = consentData && consentData.length > 0

      // Get Conversation history
      let history = []
      if (hasConsent) {
        let msgQuery = supabase
          .from('coach_messages')
          .select('role,content')
          .order('created_at', { ascending: false })
          .limit(16)

        if (user) {
          msgQuery = msgQuery.or(`user_id.eq.${user.id},visitor_id.eq.${activeVisitorId}`)
        } else {
          msgQuery = msgQuery.eq('visitor_id', activeVisitorId)
        }

        const { data: rawMsgs } = await msgQuery
        if (rawMsgs) {
          history = rawMsgs.reverse()
        }
      }

      const LANG_NAMES = {
        de: 'Deutsch',
        en: 'English',
        es: 'Español',
        fr: 'Français',
        it: 'Italiano',
        nl: 'Nederlands',
        el: 'Ελληνικά'
      }
      const langName = LANG_NAMES[language] || 'Deutsch'
      const languageDirective = `SPRACHREGEL (höchste Priorität): Antworte AUSSCHLIESSLICH auf ${langName}.\n\n`

      // --- LIVE RESEARCH & CRAWL PRE-PROCESSING ---
      let liveContext = ''
      const userMessageText = message || ''
      
      // 1. Detect URLs in user message and crawl website
      const urlMatch = userMessageText.match(/(https?:\/\/[^\s]+|[a-zA-Z0-9-]+\.(?:com|de|net|org|io|eu|ch|at|es|fr|it|uk)[^\s]*)/i)
      if (urlMatch) {
        const foundUrl = urlMatch[0]
        console.log(`[coach-chat] URL detected in message: ${foundUrl}, executing live crawl...`)
        const crawlContent = await crawlTargetWebsite(foundUrl)
        if (crawlContent) {
          liveContext += `\n\n[LIVE CRAWL DER ZIEL-WEBSITE (${foundUrl})]:\n${crawlContent}\n\n`
        }

        // Also search Tavily for company background & LinkedIn profiles
        const domainClean = foundUrl.replace(/^https?:\/\//, '').replace(/\/.*$/, '')
        const searchResults = await performTavilySearch(`${domainClean} Geschäftsführer Head of Sales LinkedIn`)
        if (searchResults && !searchResults.includes("Fehlt im Backend") && !searchResults.includes("Keine aktuellen")) {
          liveContext += `\n\n[WEB-RECHERCHE ERGEBNISSE FÜR ${domainClean}]:\n${searchResults}\n\n`
        }
      } else {
        // 2. Keyword-based search
        const searchKeywords = ['wer ist', 'head of', 'name', 'ansprechpartner', 'ceo', 'geschäftsführer', 'vertriebsleiter', 'recherchier', 'suche nach', 'finde'];
        const userMessageLower = userMessageText.toLowerCase();
        if (!image_url && searchKeywords.some(kw => userMessageLower.includes(kw))) {
          console.log('[coach-chat] User message triggered auto-search for:', userMessageText);
          const searchResults = await performTavilySearch(userMessageText);
          if (searchResults && !searchResults.includes("Fehlt im Backend") && !searchResults.includes("Keine aktuellen")) {
            liveContext += `\n\n[WEB-RECHERCHE ERGEBNISSE]:\n${searchResults}\n\n`;
          }
        }
      }

      if (liveContext) {
        liveContext = `\n\n[ECHTZEIT-DATEN FÜR DIESE RECHERCHE - Nutze diese Fakten, um dem Nutzer sofort konkrete Firmen, gefundene Namen, Impressums-Daten, E-Mail-Muster und 1-Klick-LinkedIn-Links in einer Markdown-Tabelle zu liefern]:\n${liveContext}\n\n`
      }

      const llmMessages = [
        { role: 'system', content: languageDirective + SYSTEM_PROMPT + liveContext },
        ...history,
        { role: 'user', content: image_url ? [
          { type: 'text', text: message || 'Bitte analysiere dieses Bild.' },
          { type: 'image_url', image_url: { url: image_url } }
        ] : message }
      ]

      let responseText = null
      let providerUsed = ''

      const executeChain = async () => {
        responseText = null
        if (image_url) {
          responseText = await tryOpenAIGpt4o(llmMessages)
          if (responseText) providerUsed = 'OpenAI (GPT-4o Vision)'
        }

        if (!responseText) {
          responseText = await tryGroq(llmMessages)
          if (responseText) {
            providerUsed = 'Groq (Llama 3.3 70B)'
          } else {
            responseText = await tryMistral(llmMessages)
            if (responseText) {
              providerUsed = 'Mistral API (Mistral Small)'
            } else {
              responseText = await tryOpenRouterGemma(llmMessages)
              if (responseText) {
                providerUsed = 'OpenRouter (Llama 3.3 / Gemma)'
              }
            }
          }
        }
      }

      await executeChain()

      // Handle ##SEARCH## interceptor if triggered by LLM
      if (responseText && responseText.includes('##SEARCH##')) {
        const match = responseText.match(/##SEARCH##\s*\((.*?)\)/)
        if (match && match[1]) {
          const query = match[1]
          const searchResults = await performTavilySearch(query)
          llmMessages.push({ role: 'assistant', content: responseText })
          llmMessages.push({ role: 'user', content: `[SYSTEM-INTERN: Web-Recherche Ergebnisse für "${query}"]:\n\n${searchResults}\n\nBitte erstelle nun basierend auf diesen Fakten die vollständige Recherche-Tabelle mit 1-Klick-Links.` })
          await executeChain()
        }
      }

      responseText = sanitizeCoachResponse(responseText)

      if (!responseText) {
        return {
          statusCode: 500,
          headers: CORS_HEADERS,
          body: JSON.stringify({ error: 'Kein KI-Modell konnte die Anfrage beantworten. Bitte versuche es in wenigen Sekunden noch einmal.' })
        }
      }

      // Speichere in DB nur falls Consent vorliegt
      if (hasConsent) {
        await supabase.from('coach_messages').insert([
          {
            visitor_id: activeVisitorId || '',
            user_id: user ? user.id : null,
            role: 'user',
            content: image_url ? `[Bildanhang] ${message}` : message
          },
          {
            visitor_id: activeVisitorId || '',
            user_id: user ? user.id : null,
            role: 'assistant',
            content: responseText
          }
        ]).catch(() => {})
      }

      return {
        statusCode: 200,
        headers: CORS_HEADERS,
        body: JSON.stringify({ response: responseText, provider: providerUsed })
      }
    }

    return { statusCode: 405, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Method not allowed' }) }
  } catch (e) {
    console.error('[coach-chat] Unexpected error:', e.message)
    return { statusCode: 500, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Interner Server-Fehler' }) }
  }
}
