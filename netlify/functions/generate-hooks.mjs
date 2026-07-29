import { getMistralKey, getSupabaseClient } from '../util/_helpers.mjs'

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type, Authorization' }, body: '' }
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

    let body = {}
    try { body = JSON.parse(event.body || '{}') } catch { body = {} }

    const { genre, premise, scene_description } = body

    if (!genre) {
      return { statusCode: 400, body: JSON.stringify({ error: 'genre ist erforderlich' }) }
    }

    const genreLabels = {
      comedy_prank: 'Comedy / Prank — Unterhaltung, Pointen, Reaktionen',
      werbevideo_marketing: 'Werbevideo — Marketing, Produkt, Call-to-Action',
      lernvideo_kinder: 'Lernvideo (Kinder) — Einfach, spielerisch, freundlich',
      lernvideo_erwachsene: 'Lernvideo (Erwachsene) — Informativ, strukturiert, sachlich'
    }

    const genreLabel = genreLabels[genre] || genre
    const premiseHint = premise ? `\nPrämisse des Users: "${premise}"` : ''
    const sceneHint = scene_description ? `\nSzenen-Beschreibung des Videos: "${scene_description}"` : ''

    const prompt = `Du bist ein weltklasse TikTok-Hook-Spezialist. Du generierst 5 radikal verschiedene Hooks für ein TikTok-Video.

Genre: ${genreLabel}${premiseHint}${sceneHint}

REGELN FÜR JEDEN HOOK:
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
      const mistralKey = getMistralKey()
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

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type, Authorization' },
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
