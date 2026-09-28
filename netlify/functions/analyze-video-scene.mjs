import { createClient } from '@supabase/supabase-js'
import { callLLM } from './_shared/llm-core.mjs'
const supabaseUrl = process.env.VITE_SUPABASE_URL

const ANALYSIS_SYSTEM_PROMPT = `Analysiere die übergebenen Bilder.
Es können zwei Arten von Bildern enthalten sein:
1. Video-Frames aus einem bestehenden Video (zur Erkennung von Szenen, Hook, Mimik, Pacing).
2. Screenshots von TikTok / Social Media Analytics (Demografie, Altersverteilung, Geschlecht, Aufrufe, Verweildauer / Retention-Kurve).

Gib ein valides JSON-Objekt mit folgender Struktur zurück:
{
  "beats": [
    {
      "start_time": "0:00",
      "end_time": "0:03",
      "description": "Was visuell passiert, wer im Bild ist, welche Emotion",
      "face_visible_closeup": true,
      "suggested_focus": "z.B. Reaktion, Übergang, Höhepunkt"
    }
  ],
  "analytics_insights": {
    "detected_demographics": "z.B. 72% Frauen (25-34 Jahre), B2B-Interesse",
    "retention_analysis": "z.B. Hoher Einstieg in Sekunde 0-3, Absprung bei Sekunde 12",
    "bytedance_leverage": "Empfehlung für das Folge-Video, um den TikTok-Algorithmus optimal zu triggern"
  }
}

Setze face_visible_closeup nur auf true, wenn ein Gesicht nah, frontal und klar erkennbar im Bild ist.
Antworte ausschließlich mit validem JSON, kein Fließtext, keine Markdown-Codeblöcke.`

const CORS_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization'
}

function buildImageMessages(imagePayloads, analyticsPayloads = []) {
  const content = [
    { 
      type: 'text', 
      text: 'Analysiere diese Bilderserie (Video-Frames und eventuelle TikTok-Analytics-Screenshots) und gib die Szenen-Beats und Zielgruppen-Insights als JSON zurück.' 
    }
  ]
  for (const img of imagePayloads) {
    content.push({ type: 'image_url', image_url: { url: img } })
  }
  if (Array.isArray(analyticsPayloads)) {
    for (const aImg of analyticsPayloads) {
      content.push({ type: 'image_url', image_url: { url: aImg } })
    }
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

async function analyzeImages(imagePayloads, analyticsPayloads = []) {
  const totalSize = imagePayloads.reduce((s, p) => s + p.length, 0) + (analyticsPayloads?.reduce((s, p) => s + p.length, 0) || 0)
  console.log(`[analyze-video] Vision chain: ${imagePayloads.length} frames, ${analyticsPayloads?.length || 0} analytics, ${(totalSize / 1024 / 1024).toFixed(1)}MB total`)

  // Kette Groq -> OpenRouter -> Mistral via _shared/llm-core.mjs (profile vision).
  // acceptText sorgt wie bisher fuer den naechsten Provider, wenn das JSON
  // unbrauchbar ist; wirft, wenn alle Provider versagen.
  const { text, provider, model } = await callLLM(
    buildImageMessages(imagePayloads, analyticsPayloads),
    {
      profile: 'vision',
      providers: ['groq', 'openrouter', 'mistral'],
      temperature: 0.2,
      max_tokens: 4096,
      acceptText: (t) => parseAnalysisResponse(t) !== null,
      xTitle: 'Happiness Video Analysis',
      totalBudgetMs: 40000,
    }
  )
  console.log(`[analyze-video] ${provider}/${model} response length: ${text.length}`)
  return parseAnalysisResponse(text)
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

    const { frames, analytics_images, video_filename, visitor_id } = body

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

    if ((!frames || !Array.isArray(frames) || frames.length === 0) && (!analytics_images || analytics_images.length === 0)) {
      return {
        statusCode: 400,
        headers: CORS_HEADERS,
        body: JSON.stringify({ error: 'frames Array oder analytics_images ist erforderlich' })
      }
    }

    const safeFrames = Array.isArray(frames) ? frames : []
    const safeAnalytics = Array.isArray(analytics_images) ? analytics_images : []

    console.log(`[analyze-video] Received ${safeFrames.length} frames + ${safeAnalytics.length} analytics images, trying vision chain...`)

    // Kette Groq -> OpenRouter -> Mistral via _shared/llm-core.mjs
    let sceneAnalysis = null
    let chainError = null
    try {
      sceneAnalysis = await analyzeImages(safeFrames, safeAnalytics)
    } catch (e) {
      chainError = e.message
    }

    if (!sceneAnalysis) {
      console.error('[analyze-video] ALL PROVIDERS FAILED:', chainError)
      return {
        statusCode: 502,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          error: 'Video-Analyse fehlgeschlagen. Die KI-Modelle konnten die Frames nicht verarbeiten.',
          details: chainError || 'unbekannter Fehler'
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
