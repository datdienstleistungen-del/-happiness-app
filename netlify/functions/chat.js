console.log('chat.js v4 - DeepSeek + Groq')
console.log('DEEPSEEK_API_KEY vorhanden:', !!process.env.DEEPSEEK_API_KEY)
console.log('GROQ_API_KEY vorhanden:', !!process.env.GROQ_API_KEY)
console.log('OPENROUTER_API_KEY vorhanden:', !!process.env.OPENROUTER_API_KEY)
const SUPABASE_URL = 'https://irumowvmhvrofezwvnop.supabase.co'
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || ''

const GROQ_API_BASE = 'https://api.groq.com/openai/v1'
const DEEPSEEK_API_BASE = 'https://api.deepseek.com/v1'

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
      },
      body: ''
    }
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) }
  }

  try {
    const authHeader = event.headers.authorization || ''
    const token = authHeader.replace('Bearer ', '')
    if (!token) {
      return { statusCode: 401, body: JSON.stringify({ error: 'Nicht authentifiziert' }) }
    }

    let userId = null
    try {
      const authRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
        headers: { 'Authorization': `Bearer ${token}`, 'apikey': SUPABASE_SERVICE_KEY }
      })
      if (authRes.ok) {
        const userData = await authRes.json()
        userId = userData.id
      }
    } catch (e) {
      console.error('Auth check failed:', e.message)
    }

    const body = JSON.parse(event.body)
    const { message, systemPrompt, history, imageBase64, testVision } = body

    // Debug: Zeige was ankommt
    if (imageBase64) {
      console.log('imageBase64 prefix:', typeof imageBase64, imageBase64.substring(0, 60))
    }

    // Test-Modus: öffentliches Bild von Groq selbst analysieren (Bypass user image)
    if (testVision) {
      const apiKey = process.env.GROQ_API_KEY
      if (!apiKey) return { statusCode: 500, body: JSON.stringify({ error: 'GROQ_API_KEY fehlt' }) }
      try {
        const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'meta-llama/llama-4-scout-17b-16e-instruct',
            messages: [{
              role: 'user',
              content: [
                { type: 'text', text: 'Was siehst du in diesem Bild? Antworte auf Deutsch.' },
                { type: 'image_url', image_url: { url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/47/PNG_transparency_demonstration_1.png/300px-PNG_transparency_demonstration_1.png' } }
              ]
            }],
            max_tokens: 200
          })
        })
        const d = await r.json()
        return {
          statusCode: 200,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
          body: JSON.stringify({ success: r.ok, httpStatus: r.status, response: d })
        }
      } catch (e) {
        return { statusCode: 500, body: JSON.stringify({ error: e.message }) }
      }
    }

    // --- Creator Academy usage limit check ---
    let caSettings = null
    const isCreatorAcademy = systemPrompt && systemPrompt.includes('New Creator Generation Academy')
    if (isCreatorAcademy && userId) {
      const settingsRes = await fetch(
        `${SUPABASE_URL}/rest/v1/ai_settings?user_id=eq.${userId}&select=is_premium,free_content_used`,
        {
          headers: {
            'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
            'apikey': SUPABASE_SERVICE_KEY,
            'Accept': 'application/json'
          }
        }
      )
      const settingsData = await settingsRes.json()
      caSettings = Array.isArray(settingsData) ? settingsData[0] : settingsData

      if (caSettings && !caSettings.is_premium && (caSettings.free_content_used || 0) >= 5) {
        return {
          statusCode: 402,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          },
          body: JSON.stringify({ error: 'Kostenloses Kontingent aufgebraucht', code: 'limit_reached' })
        }
      }
    }

    const hasImage = imageBase64 && typeof imageBase64 === 'string' && imageBase64.startsWith('data:image/')
    
    const buildMessages = (historyLimit, textOnly = false) => {
      const msgs = []
      msgs.push({ role: 'system', content: systemPrompt || 'Du bist ein erfahrener Mentor, guter Freund und kluger Ratgeber.' })
      if (history && Array.isArray(history)) {
        for (const msg of history.slice(-historyLimit)) {
          msgs.push({
            role: msg.role === 'assistant' ? 'assistant' : 'user',
            content: msg.content
          })
        }
      }
      let userContent
      if (hasImage && !textOnly) {
        userContent = [
          { type: 'text', text: message || 'Analysiere dieses Bild.' },
          { type: 'image_url', image_url: { url: imageBase64 } }
        ]
      } else {
        userContent = message || 'Hallo'
      }
      msgs.push({ role: 'user', content: userContent })
      return msgs
    }

    let historyLimit = 3
    
    // Proaktive Token-Limit-Prüfung: History reduzieren falls nötig
    let sendMessages = buildMessages(historyLimit)
    const sysTok = (systemPrompt || '').length / 4
    const histTok = (history || []).reduce((s, m) => s + (m.content || '').length, 0) / 4
    const msgTok = (message || '').length / 4
    const imgTok = (imageBase64 || '').length / 4
    console.log(`TOKEN-AUFTEILUNG: systemPrompt=${Math.round(sysTok)} history=${Math.round(histTok)} message=${Math.round(msgTok)} image=${Math.round(imgTok)} total=${Math.round(sysTok+histTok+msgTok+imgTok)}`)

    const SAFE_THRESHOLD = !hasImage ? 100000 : 7500
    do {
      const estimate = JSON.stringify({ messages: sendMessages }).length / 3
      if (estimate < SAFE_THRESHOLD) break
      if (historyLimit > 1) {
        historyLimit--
        sendMessages = buildMessages(historyLimit)
        continue
      }
      if (hasImage) {
        return {
          statusCode: 413,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
          body: JSON.stringify({ error: 'Bild zu groß — bitte ein kleineres Bild verwenden', code: 'image_too_large' })
        }
      }
      break
    } while (true)

    let aiResponse = ''
    let usage = null
    let provider = ''
    let modelName = ''
    let deepseekError = null

    if (hasImage) {
      const apiKey = process.env.GROQ_API_KEY
      if (!apiKey) {
        return {
          statusCode: 500,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
          body: JSON.stringify({ error: 'GROQ_API_KEY nicht konfiguriert' })
        }
      }
      
      let res = null
      let data = null

      try {
        res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: 'meta-llama/llama-4-scout-17b-16e-instruct',
            messages: buildMessages(historyLimit),
            temperature: 0.7,
            max_tokens: 4096
          })
        })
        data = await res.json()
      } catch (err) {
        console.error('Groq Vision fetch failed:', err.message)
      }

      if (res && res.ok && data && data.choices) {
        console.log('Antwort von:', 'groq-vision')
        aiResponse = data.choices?.[0]?.message?.content || 'Entschuldigung, ich konnte keine Antwort generieren.'
        usage = data.usage
        provider = 'groq'
        modelName = 'meta-llama/llama-4-scout-17b-16e-instruct'
      } else {
        const errMsg = (data?.error?.message || '').toLowerCase()
        console.log('Vision model failed, falling back to text-only with DeepSeek. Error:', errMsg)
        
        const textApiKey = process.env.DEEPSEEK_API_KEY
        if (textApiKey) {
          try {
            const fallbackRes = await fetch('https://api.deepseek.com/chat/completions', {
              method: 'POST',
              headers: { 'Authorization': `Bearer ${textApiKey}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({
                model: 'deepseek-v4-flash',
                messages: buildMessages(historyLimit, true),
                temperature: 0.7,
                max_tokens: 4096
              })
            })
            if (fallbackRes.ok) {
              const fallbackData = await fallbackRes.json()
              console.log('Antwort von:', 'deepseek')
              aiResponse = fallbackData.choices?.[0]?.message?.content || 'Entschuldigung, ich konnte keine Antwort generieren.'
              usage = fallbackData.usage
              provider = 'deepseek'
              modelName = 'deepseek-v4-flash'
              return {
                statusCode: 200,
                headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
                body: JSON.stringify({
                  response: aiResponse,
                  imageNote: 'Das Bild konnte nicht analysiert werden – der Chat funktioniert aber ganz normal weiter.',
                  usage: usage,
                  provider,
                  model: modelName
                })
              }
            } else {
              const fallbackData = await fallbackRes.json().catch(() => ({}))
              console.error('DeepSeek fallback failed:', fallbackRes.status, fallbackData)
            }
          } catch (e) {
            console.error('DeepSeek fallback error:', e.message)
          }
        }
        
        console.error('Groq Vision failed and DeepSeek fallback was unsuccessful:', JSON.stringify(data))
        return {
          statusCode: 502,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
          body: JSON.stringify({
            error: data?.error?.message || 'Groq Vision failed and fallback was unsuccessful.',
            rawResponse: data
          })
        }
      }
    } else {
      // Text-only request: Fallback Chain: DeepSeek -> Groq -> OpenRouter
      let success = false

      // Stage 1: DeepSeek
      const deepseekKey = process.env.DEEPSEEK_API_KEY
      console.log('DeepSeek check: key vorhanden =', !!deepseekKey)
      if (deepseekKey) {
        try {
          const dsRes = await fetch('https://api.deepseek.com/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${deepseekKey}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              model: 'deepseek-v4-flash',
              messages: buildMessages(historyLimit),
              temperature: 0.7,
              max_tokens: 4096
            })
          })
          if (dsRes.ok) {
            const dsData = await dsRes.json()
            console.log('Antwort von:', 'deepseek')
            aiResponse = dsData.choices?.[0]?.message?.content || ''
            usage = dsData.usage
            provider = 'deepseek'
            modelName = 'deepseek-v4-flash'
            success = true
          } else {
            const dsData = await dsRes.json().catch(() => ({}))
            const errMsg = dsData?.error?.message || JSON.stringify(dsData)
            deepseekError = { status: dsRes.status, error: errMsg }
            console.warn('DeepSeek failed, status:', dsRes.status, 'message:', errMsg)
          }
        } catch (err) {
          deepseekError = { status: 0, error: err.message }
          console.warn('DeepSeek fetch failed:', err.message)
        }
      } else {
        deepseekError = { status: 0, error: 'DEEPSEEK_API_KEY not configured' }
        console.warn('DEEPSEEK_API_KEY not configured, skipping to Groq fallback')
      }

      // Stage 2: Groq Fallback
      if (!success) {
        const groqKey = process.env.GROQ_API_KEY
        if (groqKey) {
          try {
            const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${groqKey}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                model: 'openai/gpt-oss-20b',
                messages: buildMessages(historyLimit),
                temperature: 0.7,
                max_tokens: 4096
              })
            })
            if (groqRes.ok) {
              const groqData = await groqRes.json()
              console.log('Antwort von:', 'groq-fallback')
              aiResponse = groqData.choices?.[0]?.message?.content || ''
              usage = groqData.usage
              provider = 'groq'
              modelName = 'openai/gpt-oss-20b'
              success = true
            } else {
              const groqData = await groqRes.json().catch(() => ({}))
              console.warn('Groq fallback failed, status:', groqRes.status, JSON.stringify(groqData))
            }
          } catch (err) {
            console.warn('Groq fallback fetch failed:', err.message)
          }
        } else {
          console.warn('GROQ_API_KEY not configured, skipping to OpenRouter')
        }
      }

      // Stage 3: OpenRouter Fallback
      if (!success) {
        const orKey = process.env.OPENROUTER_API_KEY
        if (orKey) {
          try {
            const orRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${orKey}`,
                'Content-Type': 'application/json',
                'HTTP-Referer': 'https://happiness-app.netlify.app',
                'X-Title': 'Happiness App'
              },
              body: JSON.stringify({
                model: 'meta-llama/llama-3.1-8b-instruct',
                messages: buildMessages(historyLimit),
                temperature: 0.7,
                max_tokens: 4096
              })
            })
            if (orRes.ok) {
              const orData = await orRes.json()
              console.log('Antwort von:', 'openrouter')
              aiResponse = orData.choices?.[0]?.message?.content || ''
              usage = orData.usage
              provider = 'openrouter'
              modelName = 'meta-llama/llama-3.1-8b-instruct'
              success = true
            } else {
              const orData = await orRes.json().catch(() => ({}))
              console.error('OpenRouter fallback failed, status:', orRes.status, JSON.stringify(orData))
            }
          } catch (err) {
            console.error('OpenRouter fallback fetch failed:', err.message)
          }
        } else {
          console.error('OPENROUTER_API_KEY not configured')
        }
      }

      if (!success) {
        return {
          statusCode: 502,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
          body: JSON.stringify({ error: 'All text AI providers in the fallback chain failed.' })
        }
      }
    }

    // --- Increment Creator Academy counter ---
    if (isCreatorAcademy && caSettings && !caSettings.is_premium) {
      await fetch(
        `${SUPABASE_URL}/rest/v1/ai_settings?user_id=eq.${userId}`,
        {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
            'apikey': SUPABASE_SERVICE_KEY,
            'Content-Type': 'application/json',
            'Prefer': 'return=minimal'
          },
          body: JSON.stringify({
            free_content_used: (caSettings.free_content_used || 0) + 1
          })
        }
      )
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ response: aiResponse, usage: usage, provider, model: modelName, _debug: { deepseekError } })
    }

  } catch (error) {
    console.error('Chat function error:', error.message, error.stack)
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ error: error.message || 'Internal server error' })
    }
  }
}

