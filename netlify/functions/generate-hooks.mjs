import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.VITE_SUPABASE_URL
const CORS_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization'
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
    .eq('event_name', 'script_generation')
    .eq('visitor_id', visitorId)
    .gte('created_at', today.toISOString())

  // Check count by IP in metadata
  const { count: ipCount } = await supabase
    .from('events')
    .select('id', { count: 'exact', head: true })
    .eq('event_name', 'script_generation')
    .eq('metadata->>ip', clientIp)
    .gte('created_at', today.toISOString())

  const totalCount = Math.max(visitorCount || 0, ipCount || 0)
  console.log(`[RateLimit-Hooks] visitor: ${visitorId}, ip: ${clientIp}, count: ${totalCount}`)

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

    const { genre, premise, scene_description, visitor_id } = body

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

    if (!genre) {
      return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: 'genre ist erforderlich' }) }
    }

    const genreLabels = {
      comedy_prank: 'Comedy / Prank — Unterhaltung, Pointen, Reaktionen',
      werbevideo_marketing: 'Werbevideo — Marketing, Produkt, Call-to-Action',
      lernvideo_kinder: 'Lernvideo (Kinder) — Einfach, spielerisch, freundlich',
      lernvideo_erwachsene: 'Lernvideo (Erwachsene) — Informativ, strukturiert, sachlich'
    }

    const genreLabel = genreLabels[genre] || genre
    const premiseHint = premise ? `\nPrämisse des Users (Zwingender inhaltlicher Kern): "${premise}"` : ''
    const sceneHint = scene_description ? `\nSzenen-Beschreibung des Videos (Visualisierungs-Grundlage): "${scene_description}"` : ''

    const prompt = `Du bist ein weltklasse TikTok-Hook-Spezialist. Du generierst 5 radikal verschiedene Hooks für ein TikTok-Video.

Genre: ${genreLabel}${premiseHint}${sceneHint}

REGELN FÜR JEDEN HOOK:
- Die Prämisse/Idee des Users ("${premise || ''}") MUSS das Hauptthema sein und inhaltlich im gesprochenen Text/Text-Overlay vorkommen. Weiche nicht davon ab!
- Nutze die Szenen-Beschreibung des Videos als visuelle Untermalung (z.B. wenn dort Katzen/Hunde vorkommen, binde sie visuell ein, aber das THEMA des Textes bleibt die User-Prämisse).
- Frame 1 (Sekunde 0:00-0:01) muss BÄNGERN — kein langsamer Zoom, kein Aufwärmen
- Kein "Hallo ich bin..." oder "Heute zeige ich euch..."
- Text-Overlay muss in 0.5 Sekunden sichtbar sein
- Sound ist 50% des Hooks — ohne guten Sound verliert selbst das beste Setup
- Jeder Hook muss sich VONANDERN UNTERSCHIEDEN (unterschiedlicher psychologischer Trigger)

Für jede der 5 Ideen:
1. VISUAL: Was sieht man EXAKT in Frame 1? (kein "schönes Setup" sondern KONKRET: Was liegt wo, welche Handbewegung, welche Farbe)
2. TEXT: Was steht in GROSS, UNÜBERSEHBAR auf dem Bildschirm? (max 6 Wörter, deutsch, GenZ-tauglich)
3. AUDIO: Was hört man IN DER ERSTEN SEKUNDE? (Sound-Effekt +/oder erster Voiceover-Satz)
4. TRIGGER: Welcher psychologische Trigger wird ausgelöst? (Neugier, FOMO, Schock, Humor, visueller Genuss, Widerspruch)

Antworte NUR mit einem gültigen JSON Array:
[
  {
    "visual": "Exakte Beschreibung von Frame 1",
    "text": "Text-Overlay (max 6 Wörter)",
    "audio": "Sound-Effekt + erster Voiceover-Satz",
    "trigger": "Psychologischer Trigger + kurze Erklärung warum"
  }
]

NUR das JSON Array. Kein Text davor oder danach. Kein markdown.`

    let hooks = null
    let lastError = null

    // Try Groq first
    const GROQ_API_KEY = process.env.GROQ_API_KEY
    if (GROQ_API_KEY) {
      try {
        const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${GROQ_API_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'openai/gpt-oss-120b',
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.8,
            max_tokens: 2048
          })
        })
        if (res.ok) {
          const data = await res.json()
          const content = data.choices?.[0]?.message?.content || ''
          const jsonMatch = content.match(/\[[\s\S]*\]/)
          if (jsonMatch) hooks = JSON.parse(jsonMatch[0])
        } else {
          lastError = `Groq: ${res.status}`
        }
      } catch (e) {
        lastError = `Groq: ${e.message}`
      }
    }

    // Try Mistral
    if (!hooks) {
      const mistralKey = process.env.MISTRAL_API_KEY || ''
      try {
        const res = await fetch('https://api.mistral.ai/v1/chat/completions', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${mistralKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'mistral-large-latest',
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.8,
            max_tokens: 2048
          })
        })
        if (res.ok) {
          const data = await res.json()
          const content = data.choices?.[0]?.message?.content || ''
          const jsonMatch = content.match(/\[[\s\S]*\]/)
          if (jsonMatch) hooks = JSON.parse(jsonMatch[0])
        } else {
          lastError = `Mistral: ${res.status}`
        }
      } catch (e) {
        lastError = `Mistral: ${e.message}`
      }
    }

    if (!hooks) {
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type, Authorization' },
        body: JSON.stringify({ hooks: [], error: `Hooks konnten nicht generiert werden: ${lastError}` })
      }
    }

    if (!user) {
      const supabaseKey = process.env.SUPABASE_SERVICE_KEY
      const supabase = createClient(supabaseUrl, supabaseKey)
      await supabase.from('events').insert({
        visitor_id: visitor_id,
        event_name: 'script_generation',
        metadata: { ip: clientIp }
      })
    }

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({ hooks, total: hooks.length })
    }

  } catch (e) {
    console.error('[generate-hooks] Error:', e.message)
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type, Authorization' },
      body: JSON.stringify({ hooks: [], error: 'Fehler bei der Hook-Generierung' })
    }
  }
}
