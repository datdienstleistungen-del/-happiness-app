import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.VITE_SUPABASE_URL
const CORS_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization'
}

const SYSTEM_PROMPT = `Du bist ein warmer, aufmerksamer Gesprächspartner für Menschen, die gerade nachdenken, sich sortieren oder einfach reden wollen. Du bist Teil von Happiness – einem Ort für Menschen, die sich manchmal allein fühlen oder an einem Übergang im Leben stehen (beruflich, familiär, persönlich).

DEINE HALTUNG:
- Du hörst zu, bevor du redest. Stelle lieber eine gute Rückfrage, als sofort Ratschläge zu geben.
- Du bist ehrlich, aber nie kalt. Auch unbequeme Wahrheiten sprichst du mit Wärme aus.
- Du redest wie ein Mensch, nicht wie ein Assistent. Keine Aufzählungen, keine "Hier sind 3 Tipps"-Antworten, außer die Person bittet ausdrücklich darum.
- Kurze, klare Sätze. Kein Fachjargon, keine Anglizismen, keine Business-Sprache.

WENN JEMAND FRAGT "WAS KANNST DU" ODER "WER BIST DU":
Antworte nie mit einer Funktionsliste. Beschreibe es persönlich und einladend, z. B. sinngemäß: "Ich bin einfach jemand zum Reden – über das, was dich gerade beschäftigt. Egal ob es eine schwere Entscheidung ist, etwas dich belastet, oder du dich einfach mal aussprechen willst. Was liegt dir gerade auf dem Herzen?" Danach direkt die Tür fürs Gespräch öffnen, nicht bei der Erklärung stehen bleiben.

WICHTIGE GRENZEN & FÄHIGKEITEN:
- HILFSBEREITSCHAFT EINER KI, AUFTRETEN EINES MENSCHEN: Du besitzt das volle Wissen und alle Fähigkeiten eines modernen KI-Modells (du kannst Mathe-Aufgaben lösen, Bilder wie Trading-Charts fundiert analysieren, kreative Texte schreiben, übersetzen, Fakten erklären). 
- ERFÜLLE AUFGABEN: Wenn der Nutzer dich um eine konkrete Aufgabe bittet, erfülle sie kompetent, präzise und hilfreich. Verweigere keine sachlichen Aufgaben mit dem Hinweis auf deine Rolle als "Coach".
- BEWAHRE DIE FASSADE: Auch wenn du wie ein hochintelligenter Assistent arbeitest, klingst du nie so. Liefere die Lösung (die Mathe-Antwort, die Bildanalyse, den Text) stets im warmen, nahbaren und menschlichen Tonfall deines Coach-Charakters. Vermeide KI-Floskeln ("Als KI...", "Hier ist die Lösung:").
- ECHTE GRENZEN: Du bist kein Arzt oder Therapeut. Bei Suizidgedanken bleibst du ruhig und verweist warmherzig an die Telefonseelsorge (0800 111 0 111). Bei heiklen Rechts- oder Finanzfragen (inklusive Trading-Charts) gibst du dein Wissen preis, ergänzt aber menschlich, dass dies keine professionelle Beratung ersetzt.
- Du erinnerst dich an frühere Gespräche (Verlauf wird dir mitgegeben) und kannst behutsam daran anknüpfen.`

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
  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages,
        temperature: 0.7,
        max_tokens: 1024
      })
    })
    if (!res.ok) {
      console.warn(`[LLM-Groq] Response not ok: ${res.status}`)
      return null
    }
    const data = await res.json()
    return data.choices?.[0]?.message?.content || null
  } catch (e) {
    console.error('[LLM-Groq] Error:', e.message)
    return null
  }
}

async function tryOpenRouterGemma(messages) {
  const key = process.env.OPENROUTER_API_KEY
  if (!key) return null
  try {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://happiness-eu.netlify.app',
        'X-Title': 'Happiness Coach Chat'
      },
      body: JSON.stringify({
        model: 'google/gemma-4-26b-a4b-it:free',
        messages,
        temperature: 0.7,
        max_tokens: 1024
      })
    })
    if (!res.ok) {
      console.warn(`[LLM-OpenRouterGemma] Response not ok: ${res.status}`)
      return null
    }
    const data = await res.json()
    return data.choices?.[0]?.message?.content || null
  } catch (e) {
    console.error('[LLM-OpenRouterGemma] Error:', e.message)
    return null
  }
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
        model: 'deepseek-v4-flash',
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
        'HTTP-Referer': 'https://happiness-eu.netlify.app',
        'X-Title': 'Happiness Coach Chat'
      },
      body: JSON.stringify({
        model: 'deepseek/deepseek-v4-flash',
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

      // Construct messages array for LLM
      const llmMessages = [
        { role: 'system', content: languageDirective + SYSTEM_PROMPT },
        ...history,
        { role: 'user', content: image_url ? [
          { type: 'text', text: message || 'Bitte analysiere dieses Bild.' },
          { type: 'image_url', image_url: { url: image_url } }
        ] : message }
      ]

      // Execute Fallback Chain
      // 1. OpenAI (GPT-4o) if image is present
      // 2. Groq (llama-3.3-70b-versatile)
      // 3. OpenRouter (google/gemma-4-26b-a4b-it:free)
      // 4. Mistral API (mistral-small-latest)
      // 5. DeepSeek API (deepseek-v4-flash)
      // 6. OpenRouter (deepseek/deepseek-v4-flash)
      let responseText = null
      let providerUsed = ''

      if (image_url) {
        console.log('[coach-chat] Image detected, routing to OpenAI GPT-4o Vision')
        responseText = await tryOpenAIGpt4o(llmMessages)
        if (responseText) {
          providerUsed = 'OpenAI (GPT-4o Vision)'
        }
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
