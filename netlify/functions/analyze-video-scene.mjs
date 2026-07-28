import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_KEY
const supabase = createClient(supabaseUrl, supabaseKey)

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
    return null
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
        model: 'meta-llama/llama-4-scout-17b-16e-instruct',
        messages: buildImageMessages(imagePayloads),
        temperature: 0.2,
        max_tokens: 4096
      })
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      console.error('[analyze-video] Groq failed:', res.status, err?.error?.message || JSON.stringify(err))
      return null
    }
    const data = await res.json()
    const text = data.choices?.[0]?.message?.content || ''
    console.log('[analyze-video] Groq response length:', text.length)
    return parseAnalysisResponse(text)
  } catch (e) {
    console.error('[analyze-video] Groq images failed:', e.message)
    return null
  }
}

async function tryOpenRouterImages(imagePayloads) {
  if (!OPENROUTER_API_KEY) return null
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
        model: 'google/gemma-4-31b-it:free',
        messages: buildImageMessages(imagePayloads),
        temperature: 0.2,
        max_tokens: 4096
      })
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      console.error('[analyze-video] OpenRouter failed:', res.status, err?.error?.message)
      return null
    }
    const data = await res.json()
    const text = data.choices?.[0]?.message?.content || ''
    return parseAnalysisResponse(text)
  } catch (e) {
    console.error('[analyze-video] OpenRouter images failed:', e.message)
    return null
  }
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
  if (!token) {
    return { statusCode: 401, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Nicht authentifiziert' }) }
  }

  try {
    const authResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: { 'Authorization': `Bearer ${token}`, 'apikey': process.env.VITE_SUPABASE_ANON_KEY }
    }).then(r => r.json())

    const user = authResponse?.id ? authResponse : authResponse?.data?.user
    if (!user) {
      return { statusCode: 401, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Ungültiges Token' }) }
    }

    let body = {}
    try { body = JSON.parse(event.body || '{}') } catch { body = {} }

    const { frames, video_filename } = body

    if (!frames || !Array.isArray(frames) || frames.length === 0) {
      return {
        statusCode: 400,
        headers: CORS_HEADERS,
        body: JSON.stringify({ error: 'frames Array (base64 Data-URLs) ist erforderlich' })
      }
    }

    console.log(`[analyze-video] Received ${frames.length} frames, trying Groq Vision...`)

    // Try Groq first (fast, reliable)
    let sceneAnalysis = await tryGroqImages(frames)

    if (!sceneAnalysis) {
      console.log('[analyze-video] Groq failed, trying OpenRouter...')
      sceneAnalysis = await tryOpenRouterImages(frames)
    }

    if (!sceneAnalysis) {
      return {
        statusCode: 502,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          error: 'Video-Analyse fehlgeschlagen. Die KI-Modelle konnten die Frames nicht verarbeiten. Versuche ein kürzeres Video.'
        })
      }
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
