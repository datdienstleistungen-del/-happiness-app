console.log('chat.js v7 - OpenRouter + Groq + DeepSeek + Mistral + RAG')
console.log('DEEPSEEK_API_KEY vorhanden:', !!process.env.DEEPSEEK_API_KEY)
console.log('GROQ_API_KEY vorhanden:', !!process.env.GROQ_API_KEY)
console.log('OPENROUTER_API_KEY vorhanden:', !!process.env.OPENROUTER_API_KEY)
console.log('MISTRAL_API_KEY vorhanden:', !!process.env.MISTRAL_API_KEY)
const SUPABASE_URL = 'https://irumowvmhvrofezwvnop.supabase.co'
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || ''

const GROQ_API_BASE = 'https://api.groq.com/openai/v1'
const DEEPSEEK_API_BASE = 'https://api.deepseek.com/v1'

// ── Happiness Knowledge System (RAG) ──

const KNOWLEDGE_CATEGORIES = {
  company: ['happiness', 'platform', 'europe', 'gdpr', 'company', 'about', 'community platform', 'soziale plattform', 'europäisch', 'datenschutz', 'mission', 'vision'],
  brand: ['brand', 'marke', 'voice', 'tone', 'tonalität', 'identity', 'logo', 'values', 'style', 'communication'],
  'ncg-academy': ['ncg academy', 'academy', 'new creator generation', 'feedback', 'content review', 'content feedback', 'verbesserung', 'entwurf', 'creator academy', 'coach', 'academy feedback', 'plattform einschätzung', 'hook check', 'hook'],
  'creator-engine': ['creator engine', 'content erstellen', 'content workflow', 'workflow', 'idee zu content', 'content strategie', 'skript', 'caption', 'publishing strategie', 'creator projekt', 'multi platform', 'content generation'],
  community: ['community', 'feed', 'beitrag', 'post', 'freunde', 'friends', 'verbinden', 'netzwerk', 'comments', 'kommentare', 'reactions', 'interaktion'],
  products: ['premium', 'subscription', 'abonnement', '6.99', 'kostenlos', 'free', 'pricing', 'preis', 'bezahlen', 'upgrade', 'stripe', 'pay', 'konto'],
  ai: ['ai agent', 'ki agent', 'strategist', 'copywriter', 'builder', 'agent architecture', 'multi agent', 'intelligence'],
  publishing: ['publishing', 'veröffentlichen', 'cross post', 'plattform optimierung', 'tiktok', 'instagram', 'youtube', 'linkedin', 'content format', 'hook'],
  analytics: ['analytics', 'analyse', 'performance', 'tracking', 'wachstum', 'growth', 'metrics', 'kennzahlen', 'verbesserung', 'daten'],
  'creator-workflow': ['creator prozess', 'workflow', 'erstellungsprozess', 'idee', 'publish', 'veröffentlichen', 'iteration', 'creator journey'],
  learning: ['lernen', 'learning', 'bildung', 'education', 'creator education', 'teaching', 'scaffolding', 'lernphilosophie', 'anfänger', 'verbessern', 'tutorial'],
  marketing: ['marketing', 'positionierung', 'target audience', 'zielgruppe', 'message', 'werbung', 'reach', 'reichweite'],
  roadmap: ['roadmap', 'future', 'zukunft', 'geplant', 'upcoming', 'mobile app', 'neue features', 'produktentwicklung'],
  general: ['faq', 'frage', 'help', 'hilfe', 'how to', 'wie funktioniert', 'was ist', 'erklärung', 'supported'],
}

const INTENT_PATTERNS = {
  general: [
    /^(hallo|hi|hey|moin|servus|grüß)/i,
    /übersetz(?:e|ung)/i,
    /schreib (?:einen|eine|mir)/i,
    /erklär mir/i,
    /was bedeutet/i,
    /wie (?:geht|funktioniert|kann|mach)/i,
    /rechne/i,
  ],
  creator: [
    /content|post|beitrag|erstellen|schreiben/i,
    /creator|ersteller|influencer/i,
    /hook|caption|skript|script/i,
    /plattform (?:einschätzung|optimierung)/i,
    /feedback|verbesserung|review/i,
    /publish|veröffentlichen/i,
    /idee/i,
  ],
  platform: [
    /happiness|platform|community/i,
    /ncg|academy|creator academy/i,
    /premium|abo|kostenlos|free/i,
    /europe|europa|gdpr|datenschutz|privacy/i,
    /feature|funktion|produkt/i,
    /marketplace|marktplatz|jobs|kurse|courses/i,
  ],
}

function classifyIntent(message) {
  if (!message) return 'general'
  const lower = message.toLowerCase()
  
  for (const [intent, patterns] of Object.entries(INTENT_PATTERNS)) {
    for (const pattern of patterns) {
      if (pattern.test(lower)) return intent
    }
  }
  
  // Check against knowledge categories
  for (const [category, keywords] of Object.entries(KNOWLEDGE_CATEGORIES)) {
    for (const keyword of keywords) {
      if (lower.includes(keyword)) return category
    }
  }
  
  return 'general'
}

async function loadKnowledge(message, userId) {
  const intent = classifyIntent(message)
  console.log('RAG intent:', intent, 'message:', (message || '').substring(0, 60))
  
  // For general intents, skip knowledge loading
  if (intent === 'general') {
    // Still check if it matches a very specific keyword
    const lower = (message || '').toLowerCase()
    for (const [category, keywords] of Object.entries(KNOWLEDGE_CATEGORIES)) {
      if (category === 'general') continue
      for (const keyword of keywords) {
        if (lower.includes(keyword)) {
          // Found a match — load that category
          try {
            const res = await fetch(
              `${SUPABASE_URL}/rest/v1/knowledge_base?category=eq.${encodeURIComponent(category)}&select=title,content,keywords&order=priority.desc`,
              { headers: { 'apikey': SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}` } }
            )
            if (res.ok) {
              const data = await res.json()
              if (data && data.length > 0) return formatKnowledge(data)
            }
          } catch (e) {
            console.error('Knowledge fetch failed:', e.message)
          }
          return ''
        }
      }
    }
    return ''
  }
  
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/knowledge_base?category=eq.${encodeURIComponent(intent)}&select=title,content,keywords&order=priority.desc`,
      { headers: { 'apikey': SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}` } }
    )
    if (res.ok) {
      const data = await res.json()
      if (data && data.length > 0) return formatKnowledge(data)
    }
  } catch (e) {
    console.error('Knowledge fetch failed:', e.message)
  }
  
  return ''
}

function formatKnowledge(entries) {
  if (!entries || entries.length === 0) return ''
  let result = '\n\n=== HAPPINESS WISSEN ===\n'
  result += 'Plattform-Kenntnis: Du kennst Happiness genau. Nur bei relevanten Fragen nutzen.\n\n'
  for (const entry of entries) {
    const lines = entry.content.split('\n').filter(l => l.trim() && !l.startsWith('#'))
    const relevant = lines.slice(0, 15).join('\n').trim()
    if (relevant) {
      result += `--- ${entry.title} ---\n${relevant}\n\n`
    }
  }
  result += '=== ENDE ===\n'
  return result
}

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
    const { message, systemPrompt: originalPrompt, history, imageBase64, testVision } = body

    // RAG: Load Happiness knowledge context
    const knowledgeContext = await loadKnowledge(message, userId)
    const systemPrompt = knowledgeContext ? originalPrompt + knowledgeContext : originalPrompt

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
    const providerErrors = []

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
        console.log('Vision model failed, falling back to text-only with Groq. Error:', errMsg)
        
        const textApiKey = process.env.GROQ_API_KEY
        if (textApiKey) {
          try {
            const fallbackRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
              method: 'POST',
              headers: { 'Authorization': `Bearer ${textApiKey}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({
                model: 'openai/gpt-oss-20b',
                messages: buildMessages(historyLimit, true),
                temperature: 0.7,
                max_tokens: 4096
              })
            })
            if (fallbackRes.ok) {
              const fallbackData = await fallbackRes.json()
              console.log('Antwort von:', 'groq-vision-fallback')
              aiResponse = fallbackData.choices?.[0]?.message?.content || 'Entschuldigung, ich konnte keine Antwort generieren.'
              usage = fallbackData.usage
              provider = 'groq'
              modelName = 'openai/gpt-oss-20b'
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
              console.error('Groq vision fallback failed:', fallbackRes.status, fallbackData)
            }
          } catch (e) {
            console.error('Groq vision fallback error:', e.message)
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
      // Text-only request: Fallback Chain: OpenRouter (free) -> Groq -> DeepSeek
      let success = false

      // Stage 1: OpenRouter (kostenlos - primär)
      const orKey = process.env.OPENROUTER_API_KEY
      if (orKey) {
        try {
          const orRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${orKey}`,
              'Content-Type': 'application/json',
              'HTTP-Referer': 'https://happiness-eu.netlify.app',
              'X-Title': 'Happiness'
            },
            body: JSON.stringify({
              model: 'google/gemma-4-26b-a4b-it:free',
              messages: buildMessages(historyLimit),
              temperature: 0.7,
              max_tokens: 4096
            })
          })
          if (orRes.ok) {
            const orData = await orRes.json()
            console.log('Antwort von:', 'openrouter-free')
            aiResponse = orData.choices?.[0]?.message?.content || ''
            usage = orData.usage
            provider = 'openrouter'
            modelName = 'google/gemma-4-26b-a4b-it:free'
            success = true
          } else {
            const orData = await orRes.json().catch(() => ({}))
            const errMsg = orData?.error?.message || JSON.stringify(orData)
            providerErrors.push(`OpenRouter: ${errMsg} (HTTP ${orRes.status})`)
            console.warn('OpenRouter free failed, status:', orRes.status, 'message:', errMsg)
          }
        } catch (err) {
          providerErrors.push(`OpenRouter: ${err.message}`)
          console.warn('OpenRouter fetch failed:', err.message)
        }
      } else {
        providerErrors.push('OpenRouter: OPENROUTER_API_KEY not configured')
        console.warn('OPENROUTER_API_KEY not configured, skipping to Groq')
      }

      // Stage 2: Groq (schnellster Anbieter)
      if (!success) {
        const groqKey = process.env.GROQ_API_KEY
        console.log('Groq check: key vorhanden =', !!groqKey)
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
              console.log('Antwort von:', 'groq')
              aiResponse = groqData.choices?.[0]?.message?.content || ''
              usage = groqData.usage
              provider = 'groq'
              modelName = 'openai/gpt-oss-20b'
              success = true
            } else {
              const groqData = await groqRes.json().catch(() => ({}))
              const errMsg = groqData?.error?.message || JSON.stringify(groqData)
              providerErrors.push(`Groq: ${errMsg} (HTTP ${groqRes.status})`)
              console.warn('Groq failed, status:', groqRes.status, 'message:', errMsg)
            }
          } catch (err) {
            providerErrors.push(`Groq: ${err.message}`)
            console.warn('Groq fetch failed:', err.message)
          }
        } else {
          providerErrors.push('Groq: GROQ_API_KEY not configured')
          console.warn('GROQ_API_KEY not configured, skipping to DeepSeek fallback')
        }
      }

      // Stage 3: DeepSeek Fallback
      if (!success) {
        const deepseekKey = process.env.DEEPSEEK_API_KEY
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
              console.log('Antwort von:', 'deepseek-fallback')
              aiResponse = dsData.choices?.[0]?.message?.content || ''
              usage = dsData.usage
              provider = 'deepseek'
              modelName = 'deepseek-v4-flash'
              success = true
            } else {
              const dsData = await dsRes.json().catch(() => ({}))
              const errMsg = dsData?.error?.message || JSON.stringify(dsData)
              providerErrors.push(`DeepSeek: ${errMsg} (HTTP ${dsRes.status})`)
              console.warn('DeepSeek fallback failed, status:', dsRes.status, errMsg)
            }
          } catch (err) {
            providerErrors.push(`DeepSeek: ${err.message}`)
            console.warn('DeepSeek fallback fetch failed:', err.message)
          }
        } else {
          providerErrors.push('DeepSeek: DEEPSEEK_API_KEY not configured')
          console.warn('DEEPSEEK_API_KEY not configured, trying Mistral')
        }
      }

      // Stage 4: Mistral (kostenlos - fallback)
      if (!success) {
        const mistralKey = process.env.MISTRAL_API_KEY
        if (mistralKey) {
          try {
            const mistralRes = await fetch('https://api.mistral.ai/v1/chat/completions', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${mistralKey}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                model: 'mistral-small-latest',
                messages: buildMessages(historyLimit),
                temperature: 0.7,
                max_tokens: 4096
              })
            })
            if (mistralRes.ok) {
              const mistralData = await mistralRes.json()
              console.log('Antwort von:', 'mistral-fallback')
              aiResponse = mistralData.choices?.[0]?.message?.content || ''
              usage = mistralData.usage
              provider = 'mistral'
              modelName = 'mistral-small-latest'
              success = true
            } else {
              const mistralData = await mistralRes.json().catch(() => ({}))
              const errMsg = mistralData?.error?.message || JSON.stringify(mistralData)
              providerErrors.push(`Mistral: ${errMsg} (HTTP ${mistralRes.status})`)
              console.warn('Mistral fallback failed, status:', mistralRes.status, errMsg)
            }
          } catch (err) {
            providerErrors.push(`Mistral: ${err.message}`)
            console.warn('Mistral fetch failed:', err.message)
          }
        } else {
          providerErrors.push('Mistral: MISTRAL_API_KEY not configured')
          console.warn('MISTRAL_API_KEY not configured, no more providers')
        }
      }

      if (!success) {
        return {
          statusCode: 502,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
          body: JSON.stringify({ error: 'Alle AI-Provider fehlgeschlagen: ' + providerErrors.join(' | ') })
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
      body: JSON.stringify({ response: aiResponse, usage: usage, provider, model: modelName })
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

