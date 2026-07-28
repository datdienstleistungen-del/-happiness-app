import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_KEY
const supabase = createClient(supabaseUrl, supabaseKey)

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY
const GROQ_API_KEY = process.env.GROQ_API_KEY
const MISTRAL_API_KEY = process.env.MISTRAL_API_KEY

const ANALYSIS_SYSTEM_PROMPT = `Analysiere dieses Video Szene für Szene. Gib für jeden erkennbaren Beat
(Zeitabschnitt mit eigener Handlung/Emotion) folgende Informationen als JSON
zurück:

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

Setze face_visible_closeup nur auf true, wenn ein Gesicht nah, frontal und
klar erkennbar im Bild ist. Antworte ausschließlich mit validem JSON, kein
Fließtext, keine Markdown-Codeblöcke.`

const CORS_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization'
}

function buildVideoMessages(videoPayload) {
  return [
    { role: 'system', content: ANALYSIS_SYSTEM_PROMPT },
    {
      role: 'user',
      content: [
        { type: 'text', text: 'Analysiere dieses Video und gib die Szenen-Beats als JSON zurück.' },
        { type: 'video_url', video_url: { url: videoPayload } }
      ]
    }
  ]
}

function buildImageMessages(imagePayloads) {
  const content = [
    { type: 'text', text: 'Analysiere diese Bilderserie (Frames aus einem Video) und gib die Szenen-Beats als JSON zurück. Achte auf Zeitstempel basierend auf der Reihenfolge der Bilder.' }
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

async function tryOpenRouterVideo(videoPayload) {
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
        model: 'google/gemma-4-26b-a4b-it:free',
        messages: buildVideoMessages(videoPayload),
        temperature: 0.2,
        max_tokens: 4096
      })
    })
    if (!res.ok) return null
    const data = await res.json()
    const text = data.choices?.[0]?.message?.content || ''
    return parseAnalysisResponse(text)
  } catch (e) {
    console.error('[analyze-video] OpenRouter video failed:', e.message)
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
    if (!res.ok) return null
    const data = await res.json()
    const text = data.choices?.[0]?.message?.content || ''
    return parseAnalysisResponse(text)
  } catch (e) {
    console.error('[analyze-video] OpenRouter images failed:', e.message)
    return null
  }
}

async function tryGroqImages(imagePayloads) {
  if (!GROQ_API_KEY) return null
  try {
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
    if (!res.ok) return null
    const data = await res.json()
    const text = data.choices?.[0]?.message?.content || ''
    return parseAnalysisResponse(text)
  } catch (e) {
    console.error('[analyze-video] Groq images failed:', e.message)
    return null
  }
}

async function tryMistralText(description) {
  if (!MISTRAL_API_KEY) return null
  try {
    const res = await fetch('https://api.mistral.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${MISTRAL_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'mistral-small-latest',
        messages: [
          {
            role: 'system',
            content: `Du analysierst Videos basierend auf Textbeschreibungen. Erstelle eine realistische Szenen-Analyse als JSON.
Antworte NUR mit validem JSON in diesem Format:
{
  "beats": [
    {
      "start_time": "0:00",
      "end_time": "0:03",
      "description": "Was visuell passiert",
      "face_visible_closeup": false,
      "suggested_focus": "z.B. Reaktion, Übergang"
    }
  ]
}`
          },
          {
            role: 'user',
            content: `Beschreibe die Szenen dieses Videos und erstelle eine Beat-für-Beat-Analyse:\n\n${description}`
          }
        ],
        temperature: 0.3,
        max_tokens: 4096
      })
    })
    if (!res.ok) return null
    const data = await res.json()
    const text = data.choices?.[0]?.message?.content || ''
    return parseAnalysisResponse(text)
  } catch (e) {
    console.error('[analyze-video] Mistral text failed:', e.message)
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

    const { video_url, video_base64, video_filename, description } = body

    if (!video_url && !video_base64 && !description) {
      return {
        statusCode: 400,
        headers: CORS_HEADERS,
        body: JSON.stringify({ error: 'Entweder video_url, video_base64 oder description erforderlich' })
      }
    }

    let sceneAnalysis = null

    // Strategy 1: Video URL -> OpenRouter Gemma video
    if (video_url && !sceneAnalysis) {
      console.log('[analyze-video] Trying OpenRouter Gemma with video URL...')
      sceneAnalysis = await tryOpenRouterVideo(video_url)
    }

    // Strategy 2: Video base64 -> OpenRouter Gemma video
    if (video_base64 && !sceneAnalysis) {
      const dataUrl = video_base64.startsWith('data:') ? video_base64 : `data:video/mp4;base64,${video_base64}`
      console.log('[analyze-video] Trying OpenRouter Gemma with base64 video...')
      sceneAnalysis = await tryOpenRouterVideo(dataUrl)
    }

    // Strategy 3: If we have a URL, try extracting frames via a frame extraction service or skip
    // For now, if video URL analysis fails, we skip to text fallback

    // Strategy 4: Text description fallback -> Mistral
    if (!sceneAnalysis && description) {
      console.log('[analyze-video] Trying Mistral text fallback...')
      sceneAnalysis = await tryMistralText(description)
    }

    if (!sceneAnalysis) {
      return {
        statusCode: 502,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          error: 'Video konnte nicht automatisch analysiert werden. Bitte beschreibe das Video kurz als Text.',
          needs_description: true
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
