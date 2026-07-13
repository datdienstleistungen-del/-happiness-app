const SUPABASE_URL = 'https://irumowvmhvrofezwvnop.supabase.co'
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || ''
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'sb_publishable_tArx0o4FeYQ3HthZ7h7hCQ_fTJslkMa'
const PEXELS_API_KEY = process.env.PEXELS_API_KEY

const DEFAULT_STOCK = [
  'https://images.pexels.com/videos/3045161/free-video-3045161.jpg',
  'https://images.pexels.com/videos/855401/free-video-855401.jpg',
  'https://images.pexels.com/photos/255379/pexels-photo-255379.jpeg',
  'https://images.pexels.com/photos/414171/pexels-photo-414171.jpeg',
  'https://images.pexels.com/photos/374016/pexels-photo-374016.jpeg'
]

const FALLBACK_IMAGES = {
  motivation: 'https://images.pexels.com/photos/255379/pexels-photo-255379.jpeg',
  nature: 'https://images.pexels.com/photos/414171/pexels-photo-414171.jpeg',
  product: 'https://images.pexels.com/photos/374016/pexels-photo-374016.jpeg',
  lifestyle: 'https://images.pexels.com/photos/255379/pexels-photo-255379.jpeg',
  default: 'https://images.pexels.com/photos/374016/pexels-photo-374016.jpeg'
}

const supabaseFetch = async (path, options = {}) => {
  const url = `${SUPABASE_URL}${path}`
  const res = await fetch(url, {
    ...options,
    headers: {
      'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
      'apikey': SUPABASE_SERVICE_KEY,
      ...options.headers
    }
  })
  return res.json()
}

exports.handler = async (event) => {
  console.log('[TIKTOK] Function called, method:', event.httpMethod)

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) }
  }

  const authHeader = event.headers.authorization || ''
  const token = authHeader.replace('Bearer ', '')
  if (!token) {
    console.log('[TIKTOK] No token provided')
    return { statusCode: 401, body: JSON.stringify({ error: 'Nicht authentifiziert' }) }
  }

  let userId = null
  try {
    const authRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { 'Authorization': `Bearer ${token}`, 'apikey': SUPABASE_ANON_KEY }
    })
    console.log('[TIKTOK] Auth response status:', authRes.status)
    if (authRes.ok) {
      const userData = await authRes.json()
      userId = userData.id
      console.log('[TIKTOK] userId:', userId)
    } else {
      const errBody = await authRes.text().catch(() => '')
      console.log('[TIKTOK] Auth failed:', authRes.status, errBody.substring(0, 200))
    }
  } catch (e) {
    console.error('[TIKTOK] Auth check failed:', e.message)
  }

  if (!userId) {
    console.log('[TIKTOK] No userId, returning 401')
    return { statusCode: 401, body: JSON.stringify({ error: 'Ungueltiges Token' }) }
  }

  let body
  try {
    body = JSON.parse(event.body)
  } catch (e) {
    console.log('[TIKTOK] Body parse error:', e.message)
    return { statusCode: 400, body: JSON.stringify({ error: 'Ungueltige Daten' }) }
  }
  const { text, imageUrl } = body
  console.log('[TIKTOK] Text length:', text?.length, 'imageUrl:', imageUrl ? 'yes' : 'no')

  if (!text || text.trim().length < 3) {
    console.log('[TIKTOK] Text too short')
    return { statusCode: 400, body: JSON.stringify({ error: 'Text ist zu kurz (min. 3 Zeichen)' }) }
  }

  // --- Free video usage limit check ---
  const settingsRes = await supabaseFetch(
    `/rest/v1/ai_settings?user_id=eq.${userId}&select=is_premium,free_video_used`
  )
  const settings = Array.isArray(settingsRes) ? settingsRes[0] : settingsRes
  console.log('[TIKTOK] Settings:', JSON.stringify(settings))

  if (settings && !settings.is_premium && (settings.free_video_used || 0) >= 3) {
    console.log('[TIKTOK] Free limit reached')
    return {
      statusCode: 402,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': 'https://happiness-eu.netlify.app',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization'
      },
      body: JSON.stringify({ error: 'Kostenloses Kontingent aufgebraucht', code: 'limit_reached' })
    }
  }

  // Step 1: Generate script — Groq → OpenRouter → DeepSeek → Mistral fallback chain
  const systemPrompt = `Rolle: TikTok-Video-Scripter.
Aufgabe: Produktbeschreibung in vertikales 9:16 Video (max 60s) umwandeln.
Output: JSON-Array von Szenen.
Jede Szene: text1 (Haupttext, max 6 Woerter), text2 (Untertext, max 10 Woerter), duration (2-5s), visualPrompt (englisch, 3-5 Woerter).
Struktur: Szene 1 = Hook, letzte Szene = CTA, dazwischen Vorteile/Emotionen.
Regeln: Max 15 Szenen, kein Emoji, Deutsch, ein Gedanke pro Szene.
Nur valides JSON ausgeben.`

  const userMessage = `Erstelle ein TikTok-Video fuer: ${text}`

  const providers = []

  // Provider 1: Groq
  const groqKey = process.env.GROQ_API_KEY
  if (groqKey) {
    providers.push({
      name: 'groq',
      url: 'https://api.groq.com/openai/v1/chat/completions',
      key: groqKey,
      model: 'llama-3.3-70b-versatile'
    })
  }

  // Provider 2: OpenRouter
  const orKey = process.env.OPENROUTER_API_KEY
  if (orKey) {
    providers.push({
      name: 'openrouter',
      url: 'https://openrouter.ai/api/v1/chat/completions',
      key: orKey,
      model: 'mistralai/mistral-small-3.1-24b-instruct:free'
    })
  }

  // Provider 3: DeepSeek
  const dsKey = process.env.DEEPSEEK_API_KEY
  if (dsKey) {
    providers.push({
      name: 'deepseek',
      url: 'https://api.deepseek.com/v1/chat/completions',
      key: dsKey,
      model: 'deepseek-chat'
    })
  }

  // Provider 4: Mistral
  const mistralKey = process.env.MISTRAL_API_KEY
  if (mistralKey) {
    providers.push({
      name: 'mistral',
      url: 'https://api.mistral.ai/v1/chat/completions',
      key: mistralKey,
      model: 'mistral-small-latest'
    })
  }

  if (providers.length === 0) {
    console.log('[TIKTOK] No AI providers configured')
    return { statusCode: 500, body: JSON.stringify({ error: 'KI-Service nicht verfuegbar. Bitte spaeter erneut versuchen.' }) }
  }

  let aiResponse = null
  let lastError = ''
  for (const provider of providers) {
    console.log(`[TIKTOK] Trying ${provider.name}...`)
    try {
      const aiRes = await fetch(provider.url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${provider.key}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: provider.model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userMessage }
          ],
          temperature: 0.8,
          max_tokens: 4096
        })
      })

      if (aiRes.ok) {
        const data = await aiRes.json()
        aiResponse = data.choices?.[0]?.message?.content || null
        if (aiResponse) {
          console.log(`[TIKTOK] Success with ${provider.name}`)
          break
        }
      } else {
        const errBody = await aiRes.text().catch(() => '')
        lastError = `${provider.name}: HTTP ${aiRes.status} - ${errBody.substring(0, 100)}`
        console.warn(`[TIKTOK] ${lastError}`)
      }
    } catch (e) {
      lastError = `${provider.name}: ${e.message}`
      console.warn(`[TIKTOK] ${lastError}`)
    }
  }

  if (!aiResponse) {
    console.error('[TIKTOK] All providers failed:', lastError)
    return { statusCode: 429, body: JSON.stringify({ error: 'Alle KI-Dienste sind gerade ausgelastet. Bitte versuch es in ein paar Minuten nochmal.' }) }
  }

  let scenes
  try {
    const cleaned = aiResponse.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    scenes = JSON.parse(cleaned)
    if (!Array.isArray(scenes)) scenes = []
    scenes = scenes.map((s, i) => ({
      id: i + 1,
      text1: s.text1 || '',
      text2: s.text2 || '',
      duration: Math.min(5, Math.max(2, s.duration || 3)),
      visualPrompt: s.visualPrompt || 'abstract background'
    }))
    if (scenes.length === 0) scenes = fallbackScenes(text)
    let totalDur = scenes.reduce((sum, s) => sum + s.duration, 0)
    while (totalDur > 60 && scenes.length > 1) {
      scenes.pop()
      totalDur = scenes.reduce((sum, s) => sum + s.duration, 0)
    }
  } catch (parseError) {
    console.error('JSON parse error:', parseError, 'Raw:', aiResponse)
    scenes = fallbackScenes(text)
  }

  // Step 2: Fetch background images from Pexels for each scene
  for (const scene of scenes) {
    if (imageUrl) {
      scene.backgroundType = 'product'
      scene.backgroundUrl = imageUrl
    } else {
      scene.backgroundType = 'stock'
      scene.backgroundUrl = await searchPexelsImage(scene.visualPrompt, PEXELS_API_KEY)
    }
  }

  // Step 3: Add style colors
  const stylePalette = [
    { bg: '#1a1a2e', accent: '#e94560', text: '#ffffff' },
    { bg: '#0f0f0f', accent: '#c9a96e', text: '#f5f5f5' },
    { bg: '#ffffff', accent: '#2d3436', text: '#2d3436' },
    { bg: '#0a0a23', accent: '#00d2ff', text: '#ffffff' },
    { bg: '#fff5e6', accent: '#e17055', text: '#2d3436' },
    { bg: '#1b4332', accent: '#95d5b2', text: '#f0f7f4' },
    { bg: '#2b1055', accent: '#e0aaff', text: '#ffffff' },
    { bg: '#3c096c', accent: '#ff9e00', text: '#ffffff' },
  ]
  scenes = scenes.map((s, i) => ({ ...s, colors: stylePalette[i % stylePalette.length] }))

  // --- Increment video counter after successful creation ---
  if (settings && !settings.is_premium) {
    await supabaseFetch(
      `/rest/v1/ai_settings?user_id=eq.${userId}`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify({
          free_video_used: (settings.free_video_used || 0) + 1
        })
      }
    )
  }

  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': 'https://happiness-eu.netlify.app',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    },
    body: JSON.stringify({ scenes, totalDuration: scenes.reduce((sum, s) => sum + s.duration, 0) })
  }
}

async function searchPexelsImage(query, apiKey) {
  if (!apiKey) return pickDefault(query)
  try {
    const res = await fetch(
      `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=3&orientation=portrait`,
      { headers: { 'Authorization': apiKey } }
    )
    if (!res.ok) return pickDefault(query)
    const data = await res.json()
    if (!data.photos?.length) return pickDefault(query)
    return data.photos[Math.floor(Math.random() * Math.min(3, data.photos.length))].src.large
  } catch (e) {
    console.error('Pexels search error:', e.message)
    return pickDefault(query)
  }
}

function pickDefault(query) {
  const q = query.toLowerCase()
  if (q.includes('product')) return FALLBACK_IMAGES.product
  if (q.includes('nature') || q.includes('outdoor') || q.includes('sunshine')) return FALLBACK_IMAGES.nature
  if (q.includes('lifestyle') || q.includes('happy') || q.includes('smiling')) return FALLBACK_IMAGES.lifestyle
  if (q.includes('motivat')) return FALLBACK_IMAGES.motivation
  return DEFAULT_STOCK[Math.floor(Math.random() * DEFAULT_STOCK.length)]
}

function fallbackScenes(text) {
  const words = text.split(' ').filter(w => w.length > 3)
  const prompts = ['surprised happy person', 'product detail closeup', 'happy lifestyle', 'person using product', 'call to action modern']
  return words.length > 0 ? words.slice(0, 5).map((w, i) => ({
    id: i + 1,
    text1: w.charAt(0).toUpperCase() + w.slice(1),
    text2: words[(i + 3) % words.length] || 'Deine Idee',
    duration: 3,
    visualPrompt: prompts[i % prompts.length]
  })) : [
    { id: 1, text1: 'Deine Idee', text2: 'Jetzt umsetzen', duration: 3, visualPrompt: 'creative workspace' },
    { id: 2, text1: 'Einzigartig', text2: 'Wie du', duration: 3, visualPrompt: 'unique lifestyle' },
    { id: 3, text1: 'Jetzt starten', text2: 'Worauf wartest du?', duration: 3, visualPrompt: 'call to action' },
  ]
}
