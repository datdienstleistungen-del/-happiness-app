import { createClient } from '@supabase/supabase-js'
const supabaseUrl = process.env.VITE_SUPABASE_URL

const GROQ_API_KEY = process.env.GROQ_API_KEY
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY
const MISTRAL_API_KEY = process.env.MISTRAL_API_KEY

const ANALYSIS_SYSTEM_PROMPT = `Analysiere diese Bilderserie (Frames aus einem Video) Szene für Szene.
Gib für jeden erkennbaren Beat (Zeitabschnitt mit eigener Handlung/Emotion) folgende Informationen als JSON zurück:

{
  "beats": [
    {
      "start_time": "0:00",
      "end_time": "0:03",
      "description": "Was visuell passiert, wer im Bild ist, welche Emotion",
      "face_visible_closeup": true,
      "suggested_focus": "z.B. Reaktion, Übergang, Höhepunkt"
    }
  ]
}

Setze face_visible_closeup nur auf true, wenn ein Gesicht nah, frontal und klar erkennbar im Bild ist.
Die Frames sind in chronologischer Reihenfolge. Schätze die Zeitstempel basierend auf der Anzahl der Frames und der geschätzten Videolänge.
Antworte ausschließlich mit validem JSON, kein Fließtext, keine Markdown-Codeblöcke.`

const CORS_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization'
}

function buildImageMessages(imagePayloads) {
  const content = [
    { type: 'text', text: 'Analysiere diese Bilderserie (Frames aus einem Video) und gib die Szenen-Beats als JSON zurück.' }
  ]
  for (const img of imagePayloads) {
    content.push({ type: 'image_url', image_url: { url: img } })
  }
  return [
    { role: 'system', content: ANALYSIS_SYSTEM_PROMPT },
    { role: 'user', content }
  ]
}

function parseAnalysisResponse(text) {
  let cleaned = text.trim()
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '')
  }
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/)
  if (!jsonMatch) return null
  try {
    const parsed = JSON.parse(jsonMatch[0])
    if (parsed.beats && Array.isArray(parsed.beats)) return parsed
    return null
  } catch {
    return null
  }
}

async function tryGroqImages(imagePayloads) {
  if (!GROQ_API_KEY) {
    console.error('[analyze-video] GROQ_API_KEY not set')
    return { error: 'GROQ_API_KEY not configured' }
  }
  try {
    const totalSize = imagePayloads.reduce((s, p) => s + p.length, 0)
    console.log(`[analyze-video] Groq: ${imagePayloads.length} images, ${(totalSize / 1024 / 1024).toFixed(1)}MB total`)
    
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'qwen/qwen3.6-27b',
        messages: buildImageMessages(imagePayloads),
        temperature: 0.2,
        max_tokens: 4096
      })
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      const msg = err?.error?.message || JSON.stringify(err)
      console.error('[analyze-video] Groq failed:', res.status, msg)
      return { error: `Groq ${res.status}: ${msg}` }
    }
    const data = await res.json()
    const text = data.choices?.[0]?.message?.content || ''
    console.log('[analyze-video] Groq response length:', text.length)
    const parsed = parseAnalysisResponse(text)
    if (parsed) return { data: parsed }
    return { error: `Groq returned unparseable response (${text.length} chars): ${text.substring(0, 200)}` }
  } catch (e) {
    console.error('[analyze-video] Groq images failed:', e.message)
    return { error: `Groq exception: ${e.message}` }
  }
}

async function tryOpenRouterImages(imagePayloads) {
  if (!OPENROUTER_API_KEY) return { error: 'OPENROUTER_API_KEY not configured' }
  try {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://happiness-eu.netlify.app',
        'X-Title': 'Happiness Video Analysis'
      },
      body: JSON.stringify({
        model: 'meta-llama/llama-4-maverick-17b-128e-instruct',
        messages: buildImageMessages(imagePayloads),
        temperature: 0.2,
        max_tokens: 4096
      })
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      const msg = err?.error?.message || JSON.stringify(err)
      console.error('[analyze-video] OpenRouter failed:', res.status, msg)
      return { error: `OpenRouter ${res.status}: ${msg}` }
    }
    const data = await res.json()
    const text = data.choices?.[0]?.message?.content || ''
    const parsed = parseAnalysisResponse(text)
    if (parsed) return { data: parsed }
    return { error: `OpenRouter returned unparseable response (${text.length} chars): ${text.substring(0, 200)}` }
  } catch (e) {
    console.error('[analyze-video] OpenRouter images failed:', e.message)
    return { error: `OpenRouter exception: ${e.message}` }
  }
}

async function tryMistralImages(imagePayloads) {
  if (!MISTRAL_API_KEY) return { error: 'MISTRAL_API_KEY not configured' }
  try {
    const content = [
      { type: 'text', text: 'Analysiere diese Bilderserie (Frames aus einem Video) und gib die Szenen-Beats als JSON zurück. Antworte ausschließlich mit validem JSON.' }
    ]
    for (const img of imagePayloads) {
      content.push({ type: 'image_url', image_url: { url: img } })
    }
    const res = await fetch('https://api.mistral.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${MISTRAL_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'pixtral-12b-2409',
        messages: [
          { role: 'system', content: ANALYSIS_SYSTEM_PROMPT },
          { role: 'user', content }
        ],
        temperature: 0.2,
        max_tokens: 4096
      })
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      const msg = err?.error?.message || JSON.stringify(err)
      console.error('[analyze-video] Mistral failed:', res.status, msg)
      return { error: `Mistral ${res.status}: ${msg}` }
    }
    const data = await res.json()
    const text = data.choices?.[0]?.message?.content || ''
    const parsed = parseAnalysisResponse(text)
    if (parsed) return { data: parsed }
    return { error: `Mistral returned unparseable response (${text.length} chars): ${text.substring(0, 200)}` }
  } catch (e) {
    console.error('[analyze-video] Mistral images failed:', e.message)
    return { error: `Mistral exception: ${e.message}` }
  }
}

async function checkGuestRateLimit(visitorId, clientIp) {
  if (!visitorId) return { allowed: false, error: 'visitor_id ist erforderlich im Gast-Modus' }

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const supabaseKey = process.env.SUPABASE_SERVICE_KEY
  const supabase = createClient(supabaseUrl, supabaseKey)

  // Check count by visitorId
  const { count: visitorCount } = await supabase
    .from('events')
    .select('id', { count: 'exact', head: true })
    .eq('event_name', 'guest_analyze_scene')
    .eq('visitor_id', visitorId)
    .gte('created_at', today.toISOString())

  // Check count by IP in metadata
  const { count: ipCount } = await supabase
    .from('events')
    .select('id', { count: 'exact', head: true })
    .eq('event_name', 'guest_analyze_scene')
    .eq('metadata->>ip', clientIp)
    .gte('created_at', today.toISOString())

  const totalCount = Math.max(visitorCount || 0, ipCount || 0)
  console.log(`[RateLimit-Analyze] visitor: ${visitorId}, ip: ${clientIp}, count: ${totalCount}`)

  if (totalCount >= 3) {
    return { allowed: false, error: 'Limit für kostenlose Generierungen erreicht (maximal 3 pro Tag). Bitte registriere dich, um unbegrenzt Videos zu erstellen!' }
  }
  return { allowed: true }
}

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: CORS_HEADERS, body: '' }
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Method not allowed' }) }
  }

  const authHeader = event.headers.authorization || ''
  const token = authHeader.replace('Bearer ', '')
  const clientIp = event.headers['x-nf-client-connection-ip'] || '127.0.0.1'

  try {
    let user = null
    if (token) {
      const authResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
        headers: { 'Authorization': `Bearer ${token}`, 'apikey': process.env.VITE_SUPABASE_ANON_KEY }
      }).then(r => r.json())

      user = authResponse?.id ? authResponse : authResponse?.data?.user
      if (!user) {
        return { statusCode: 401, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Ungültiges Token' }) }
      }
    }

    let body = {}
    try { body = JSON.parse(event.body || '{}') } catch { body = {} }

    const { frames, video_filename, visitor_id } = body

    if (!user) {
      const rateLimit = await checkGuestRateLimit(visitor_id, clientIp)
      if (!rateLimit.allowed) {
        return {
          statusCode: 403,
          headers: CORS_HEADERS,
          body: JSON.stringify({ error: rateLimit.error })
        }
      }
    }

    if (!frames || !Array.isArray(frames) || frames.length === 0) {
      return {
        statusCode: 400,
        headers: CORS_HEADERS,
        body: JSON.stringify({ error: 'frames Array (base64 Data-URLs) ist erforderlich' })
      }
    }

    console.log(`[analyze-video] Received ${frames.length} frames, trying Groq Vision...`)

    // Try Groq first (fast, reliable)
    let groqResult = await tryGroqImages(frames)
    let sceneAnalysis = groqResult?.data || null
    let allErrors = groqResult?.error ? [`Groq: ${groqResult.error}`] : []

    if (!sceneAnalysis) {
      console.log('[analyze-video] Groq failed, trying OpenRouter...')
      let orResult = await tryOpenRouterImages(frames)
      sceneAnalysis = orResult?.data || null
      if (orResult?.error) allErrors.push(`OpenRouter: ${orResult.error}`)
    }

    if (!sceneAnalysis) {
      console.log('[analyze-video] OpenRouter failed, trying Mistral...')
      let mistralResult = await tryMistralImages(frames)
      sceneAnalysis = mistralResult?.data || null
      if (mistralResult?.error) allErrors.push(`Mistral: ${mistralResult.error}`)
    }

    if (!sceneAnalysis) {
      console.error('[analyze-video] ALL PROVIDERS FAILED:', allErrors)
      return {
        statusCode: 502,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          error: 'Video-Analyse fehlgeschlagen. Die KI-Modelle konnten die Frames nicht verarbeiten.',
          details: allErrors.join(' | ')
        })
      }
    }

    if (!user) {
      const supabaseKey = process.env.SUPABASE_SERVICE_KEY
      const supabase = createClient(supabaseUrl, supabaseKey)
      await supabase.from('events').insert({
        visitor_id: visitor_id,
        event_name: 'guest_analyze_scene',
        metadata: { ip: clientIp }
      })
    }

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        scene_analysis: sceneAnalysis,
        video_filename: video_filename || 'video'
      })
    }
  } catch (e) {
    console.error('[analyze-video] Unexpected error:', e.message)
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: 'Interner Fehler bei der Video-Analyse' })
    }
  }
}
