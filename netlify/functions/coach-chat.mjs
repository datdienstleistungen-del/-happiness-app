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

ARCHITEKTUR & MODULE VON NeXus REVENUE OS:
1. NeXus Dashboard (/nexus/dashboard): Zentrale Steuerungszentrale für Pipeline-Übersicht, Konversionsraten, aktive Opportunities und Trigger-Statistiken.
2. Angebotsanalyse (/nexus/angebotsanalyse): KI-gestützte Analyse von Unternehmens-Websites und Dienstleistungen. Extrahiert messerscharfe USPs, Zielgruppen-Definitionen, Pain Points und Value Propositions.
3. Lead Radar (/nexus/lead-radar): Automatischer Echtzeit-Scanner für Kaufsignale (Trigger Events: Expansionen, Managementwechsel, Neueinstellungen, Finanzierungsrunden, Digitalisierungsprojekte).
4. Sales Workspace (/nexus/sales-workspace):
   - Social Reachout: Automatische LinkedIn-Recherche, 1-Klick-Links zu Entscheidern, maßgeschneiderte LinkedIn-Kommentare & Direktnachrichten mit Speicherung im Browser und in der Lead-Historie.
   - Aktion (E-Mail-Pitch): Trigger-basierte Outreach-Mails mit direktem Bezug auf vorherige Social-Aktionen.
   - Historie & Notizen: Lückenlose Erfassung aller Kontaktpunkte.
5. Video Intelligence Suite & Creator Studio:
   - Video Finder (/video-finder): Wettbewerbsanalyse, virale Content-Trends, Hooks & Format-Inspiration.
   - Video Script Generator (/video-script): Erstellung sendefähiger Video-Skripte (TikTok, YouTube Shorts, LinkedIn, Reels) mit Hook, Story, Call-to-Action und visuellen Regieanweisungen.
   - CapCut Studio / Video Maker (/capcut-studio): Vorbereitung von Skripten für Schnittprogramme und KI-Video-Generatoren (z.B. CapCut, HeyGen, Synthesia).
6. NeXus Coach (/coach): Intelligenter Sparringspartner für Vertriebsstrategie, Einwandbehandlung, Recherche, Content- und Video-Skripterstellung.
7. Vertriebspsychologie (/wissenschaft): Fundiertes Wissen zu Verkaufspsychologie, Vertrauensaufbau und Trigger-Mechanismen.

VIDEO-STUDIO & SKRIPT-EXPERTISE:
Wenn der Nutzer dich bittet, ein Skript für ein Video, eine Studioaufnahme, CapCut, TikTok, YouTube Shorts oder LinkedIn zu erstellen:
1. STRUKTUR:
   - Hook (Sekunde 0–3): Muss das Scrollen sofort stoppen (Neugierde, Kontroverse, konkreter Schmerzpunkt oder starkes Ergebnis).
   - Problem / Relevanz (Sekunde 4–15): Klarer Bezug zur Zielgruppe (z.B. "Warum Kaltakquise tot ist", "Wie du Kunden gewinnst, die JETZT kaufen wollen").
   - NeXus-Lösung & Mehrwert (Sekunde 16–45): Konkrete Funktion von NeXus erklären (z.B. "Lead Radar findet Kaufsignale", "Social Reachout generiert 1-Klick LinkedIn-Pitches", "Video Script Studio").
   - Call-to-Action (CTA) (Sekunde 46–60): Klare Handlungsaufforderung (z.B. "Probiert es aus auf nexus-hit.netlify.app", "Schreibt in die Kommentare...").
2. FORMAT FÜR STUDIOPRODUKTION:
   - Liefere das Skript strukturiert mit Spalten oder Abschnitten für [Visual / B-Roll / Kamera], [Audio / Sprechertext] und [On-Screen Text / Captions].
3. CONTENT SAFETY & PLATTFORM-COMPLIANCE:
   - Verwende NIEMALS plumpe "Schnell-Reich-ohne-Arbeit"-Floskeln oder unseriöse Versprechungen, die von Social-Media- und KI-Sicherheitsfiltern blockiert werden.
   - Formuliere professionell, software-fokussiert und faktenbasiert auf echtem B2B-Mehrwert (z.B. Zeitersparnis, qualifizierte Leads, automatisierte Recherche).

DEINE HALTUNG & B2B-RECHERCHE:
- Sei maximal service-orientiert, lieferfertig und präzise. Keine langen Meta-Vorträge – erstelle direkt den fertigen Text, das Skript oder die Tabelle.
- Wenn der Nutzer nach Personen, Firmen-Entscheidern, News oder Web-Daten fragt, führe bei Bedarf eine Suche aus oder nutze die Web-Ergebnisse.

WEB-RECHERCHE (PFLICHT BEI PERSONEN & FAKTEN):
Wenn der Nutzer nach Personen (z.B. "Wer ist Head of Media bei Havas?"), Firmen-Entscheidern, aktuellen News oder spezifischen Fakten fragt, antworte AUSSCHLIESSLICH mit folgendem Befehl:
##SEARCH##(Suchbegriff)
Beispiel: ##SEARCH##(Head of Media Havas Media Deutschland)`

// Tavily Search Helper
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
        max_results: 5,
        topic: "general",
        days: 14
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

// LLM Fallback Callers
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
        temperature: 0.7,
        max_tokens: 1024
      })
    })
    if (!res.ok) {
      console.warn(`[LLM-OpenAI] Response not ok: ${res.status}`)
      return null
    }
    const data = await res.json()
    return data.choices?.[0]?.message?.content || null
  } catch (e) {
    console.error('[LLM-OpenAI] Error:', e.message)
    return null
  }
}
async function tryGroq(messages) {
  const key = process.env.GROQ_API_KEY
  if (!key) return null
  const models = ['openai/gpt-oss-120b', 'openai/gpt-oss-20b', 'groq/compound-mini', 'groq/compound', 'qwen/qwen3.8-27b']
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
          temperature: 0.7,
          max_tokens: 1024
        })
      })
      if (res.ok) {
        const data = await res.json()
        const content = data.choices?.[0]?.message?.content
        if (content) return content
      } else {
        console.warn(`[LLM-Groq] ${model} response not ok: ${res.status}`)
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
  const models = ['nvidia/nemotron-3.5-lightning:free', 'openrouter/free', 'google/gemma-4-26b-a4b-it:free']
  for (const model of models) {
    try {
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${key}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://nexus-hit.netlify.app',
          'X-Title': 'Happiness Coach Chat'
        },
        body: JSON.stringify({
          model,
          messages,
          temperature: 0.7,
          max_tokens: 1024
        })
      })
      if (res.ok) {
        const data = await res.json()
        const content = data.choices?.[0]?.message?.content
        if (content) return content
      } else {
        console.warn(`[LLM-OpenRouter] ${model} response not ok: ${res.status}`)
      }
    } catch (e) {
      console.error(`[LLM-OpenRouter] ${model} error:`, e.message)
    }
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
        temperature: 0.7,
        max_tokens: 1024
      })
    })
    if (!res.ok) {
      console.warn(`[LLM-Mistral] Response not ok: ${res.status}`)
      return null
    }
    const data = await res.json()
    return data.choices?.[0]?.message?.content || null
  } catch (e) {
    console.error('[LLM-Mistral] Error:', e.message)
    return null
  }
}

async function tryDeepSeek(messages) {
  const key = process.env.DEEPSEEK_API_KEY
  if (!key) return null
  try {
    const res = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages,
        temperature: 0.7,
        max_tokens: 1024
      })
    })
    if (!res.ok) {
      console.warn(`[LLM-DeepSeek] Response not ok: ${res.status}`)
      return null
    }
    const data = await res.json()
    return data.choices?.[0]?.message?.content || null
  } catch (e) {
    console.error('[LLM-DeepSeek] Error:', e.message)
    return null
  }
}

async function tryOpenRouterDeepSeek(messages) {
  const key = process.env.OPENROUTER_API_KEY
  if (!key) return null
  try {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://nexus-hit.netlify.app',
        'X-Title': 'Happiness Coach Chat'
      },
      body: JSON.stringify({
        model: 'deepseek/deepseek-chat',
        messages,
        temperature: 0.7,
        max_tokens: 1024
      })
    })
    if (!res.ok) {
      console.warn(`[LLM-OpenRouterDeepSeek] Response not ok: ${res.status}`)
      return null
    }
    const data = await res.json()
    return data.choices?.[0]?.message?.content || null
  } catch (e) {
    console.error('[LLM-OpenRouterDeepSeek] Error:', e.message)
    return null
  }
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

      // Check consent
      let consentQuery = supabase.from('coach_consent').select('id')
      if (user) {
        consentQuery = consentQuery.or(`user_id.eq.${user.id},visitor_id.eq.${activeVisitorId}`)
      } else {
        consentQuery = consentQuery.eq('visitor_id', activeVisitorId)
      }
      const { data: consentData } = await consentQuery

      const hasConsent = consentData && consentData.length > 0
      if (!hasConsent) {
        // Return empty array if no consent is active
        return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify({ history: [] }) }
      }

      // Fetch messages chronologically
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
        console.error('[coach-chat] Fetch error:', fetchErr.message)
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

      // --- Guest Upload Rate Limit Pre-Check ---
      if (image_url && !user && activeVisitorId) {
        const { data: limitData, error: limitErr } = await supabase
          .from('coach_guest_uploads')
          .select('*')
          .eq('visitor_id', activeVisitorId)
          .maybeSingle()
          
        if (!limitErr && limitData) {
          const today = new Date().toDateString()
          const lastUploadDate = new Date(limitData.last_upload).toDateString()
          if (lastUploadDate === today && limitData.upload_count >= 3) {
            console.log(`[coach-chat] Guest rate limit reached for visitor: ${activeVisitorId}`)
            return {
              statusCode: 429,
              headers: CORS_HEADERS,
              body: JSON.stringify({ error: 'Kostenloses Upload-Limit (3/3) erreicht.', code: 'limit_reached' })
            }
          }
        }
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

      // Get Conversation history (up to last 20 messages for LLM context window cost limits)
      let history = []
      if (hasConsent) {
        let msgQuery = supabase
          .from('coach_messages')
          .select('role,content')
          .order('created_at', { ascending: false })
          .limit(20)

        if (user) {
          msgQuery = msgQuery.or(`user_id.eq.${user.id},visitor_id.eq.${activeVisitorId}`)
        } else {
          msgQuery = msgQuery.eq('visitor_id', activeVisitorId)
        }

        const { data: rawMsgs } = await msgQuery
        if (rawMsgs) {
          // Reverse to make it chronological
          history = rawMsgs.reverse()
        }
      }

      // Map language codes to names for LLM directives
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
      const languageDirective = `SPRACHREGEL (hoechste Prioritaet, nicht verhandelbar): Antworte AUSSCHLIESSLICH auf ${langName}. Ignoriere alle anderen Sprachanweisungen in früheren Nachrichten oder im Kontext.\n\n`

      // --- PRE-PROCESSING AUTO-SEARCH ---
      const searchKeywords = ['wer ist', 'head of', 'name', 'ansprechpartner', 'ceo', 'geschäftsführer', 'marketingleiter', 'person', 'recherchier', 'suche nach'];
      const userMessageLower = (message || '').toLowerCase();
      let searchContext = '';

      if (!image_url && searchKeywords.some(kw => userMessageLower.includes(kw))) {
        console.log('[coach-chat] User message triggered auto-search for:', message);
        const searchResults = await performTavilySearch(message);
        if (searchResults && !searchResults.includes("Fehlt im Backend") && !searchResults.includes("Keine aktuellen")) {
          searchContext = `\n\n[SYSTEM-INTERN: Ich habe im Hintergrund automatisch das Internet nach Informationen durchsucht, die zur Frage des Nutzers passen. Hier sind die gefundenen Echtzeit-Ergebnisse aus dem Web:\n\n${searchResults}\n\nNutze diese Informationen zwingend, um die Frage des Nutzers so präzise und hilfreich wie möglich zu beantworten, ohne zu erwähnen, dass du keinen Zugriff auf das Internet hättest (denn du hast diese Infos ja jetzt!). Du darfst die gefundenen Namen direkt nennen.]\n\n`;
        }
      }

      // Construct messages array for LLM
      const llmMessages = [
        { role: 'system', content: languageDirective + SYSTEM_PROMPT + searchContext },
        ...history,
        { role: 'user', content: image_url ? [
          { type: 'text', text: message || 'Bitte analysiere dieses Bild.' },
          { type: 'image_url', image_url: { url: image_url } }
        ] : message }
      ]

      // Execute Fallback Chain
      // 1. OpenAI (GPT-4o) if image is present
      // 2. Groq (qwen/qwen3.8-27b)
      // 3. OpenRouter (google/gemma-4-26b-a4b-it:free)
      // 4. Mistral API (mistral-small-latest)
      // 5. DeepSeek API (deepseek-chat)
      // 6. OpenRouter (deepseek/deepseek-chat)
      let responseText = null
      let providerUsed = ''

      const executeChain = async () => {
        responseText = null
        if (image_url) {
          console.log('[coach-chat] Image detected, routing to OpenAI GPT-4o Vision')
          responseText = await tryOpenAIGpt4o(llmMessages)
          if (responseText) providerUsed = 'OpenAI (GPT-4o Vision)'
        }

        if (!responseText) {
          responseText = await tryGroq(llmMessages)
          if (responseText) {
            providerUsed = 'Groq (Llama 3.3 70B)'
          } else {
            console.log('[LLM-Fallback] Groq failed, trying OpenRouter Gemma 4')
            responseText = await tryOpenRouterGemma(llmMessages)
            if (responseText) {
              providerUsed = 'OpenRouter (Gemma 4 26B Free)'
            } else {
              console.log('[LLM-Fallback] OpenRouter Gemma 4 failed, trying Mistral')
              responseText = await tryMistral(llmMessages)
              if (responseText) {
                providerUsed = 'Mistral API (Mistral Small)'
              } else {
                console.log('[LLM-Fallback] Mistral failed, trying DeepSeek')
                responseText = await tryDeepSeek(llmMessages)
                if (responseText) {
                  providerUsed = 'DeepSeek API (V4 Flash)'
                } else {
                  console.log('[LLM-Fallback] DeepSeek API failed, trying OpenRouter DeepSeek V4 Flash')
                  responseText = await tryOpenRouterDeepSeek(llmMessages)
                  if (responseText) {
                    providerUsed = 'OpenRouter (DeepSeek V4 Flash)'
                  }
                }
              }
            }
          }
        }
      }

      await executeChain()

      // --- SEARCH INTERCEPTOR ---
      if (responseText && responseText.includes('##SEARCH##')) {
        const match = responseText.match(/##SEARCH##\s*\((.*?)\)/)
        if (match && match[1]) {
          const query = match[1]
          console.log(`[coach-chat] AI requested web search for: ${query}`)
          const searchResults = await performTavilySearch(query)
          llmMessages.push({ role: 'assistant', content: responseText })
          llmMessages.push({ role: 'user', content: `[SYSTEM-INTERN: Web-Recherche Ergebnisse für "${query}"]\n\n${searchResults}\n\nBitte beantworte nun meine ursprüngliche Frage basierend auf diesen Fakten.` })
          await executeChain() // Run LLM again with the new context
        } else {
          // Fallback if regex failed but ##SEARCH## was there
          responseText = "Ich versuche gerade, im Internet zu recherchieren, aber es gab ein technisches Problem mit meiner Suchanfrage."
        }
      }

      if (!responseText) {
        return {
          statusCode: 500,
          headers: CORS_HEADERS,
          body: JSON.stringify({ error: 'Kein KI-Modell konnte die Anfrage beantworten. Bitte versuche es später noch einmal.' })
        }
      }

      console.log(`[coach-chat] Response generated successfully using ${providerUsed}. Consent: ${hasConsent}`)

      // --- Update Guest Rate Limit ---
      if (image_url && !user && activeVisitorId) {
        const { data: limitData } = await supabase
          .from('coach_guest_uploads')
          .select('*')
          .eq('visitor_id', activeVisitorId)
          .maybeSingle()

        const todayStr = new Date().toDateString()
        
        if (limitData) {
          const lastUploadDate = new Date(limitData.last_upload).toDateString()
          const newCount = (lastUploadDate === todayStr) ? limitData.upload_count + 1 : 1
          await supabase.from('coach_guest_uploads')
            .update({ upload_count: newCount, last_upload: new Date().toISOString() })
            .eq('visitor_id', activeVisitorId)
        } else {
          await supabase.from('coach_guest_uploads')
            .insert([{ visitor_id: activeVisitorId, upload_count: 1, last_upload: new Date().toISOString() }])
        }
      }

      // Speichere in DB nur falls Consent vorliegt
      if (hasConsent) {
        const { error: saveErr } = await supabase.from('coach_messages').insert([
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
        ])
        if (saveErr) {
          console.error('[coach-chat] Failed to save conversation messages:', saveErr.message)
        }
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
