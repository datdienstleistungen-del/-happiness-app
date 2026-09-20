import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_KEY
const supabase = createClient(supabaseUrl, supabaseKey)

const GEMINI_API_KEY = process.env.GEMINI_API_KEY
const GROQ_API_KEY = process.env.GROQ_API_KEY
const MISTRAL_API_KEY = process.env.MISTRAL_API_KEY
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY

const CORS_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization'
}

const GENRE_DESCRIPTIONS = {
  followup_tiktok_optimizer: 'Folge-Video & TikTok-Algorithmus Optimizer (Part 2)',
  comedy_prank: 'Comedy / Prank',
  werbevideo_marketing: 'Werbevideo / Marketing',
  lernvideo_kinder: 'Lernvideo für Kinder',
  lernvideo_erwachsene: 'Lernvideo für Erwachsene'
}

const GENRE_ADDITIONS = {
  followup_tiktok_optimizer: `Ziel: Maximale TikTok / ByteDance Algorithmus-Verteilung und hohe Retention für die Zielgruppe.
Struktur:
- 0:00-0:03 (Scroll-Stopper Hook): Aggressiver Hook, sofortiges Neugier- oder Widerspruch-Signal, direkt auf die Zielgruppe zugeschnitten.
- 0:03-0:08 (Problem / Identifikation): Emotionaler Einstieg und Bezug zum vorigen Erfolg/Thema.
- 0:08-0:18 (NeXus Solution & Live-Mehrwert): Klare, nachvollziehbare Demonstration des Nutzens.
- 0:18-0:25 (Social Proof / Low-Barrier Start): Barrieren abbauen (Smartphone reicht, kein Startkapital nötig).
- 0:25-0:30 (ByteDance Loop CTA): Kommentar-Loop oder Neugier-Trigger für maximale organische Ausspielung.`,
  comedy_prank: `Ton: überraschend, pointiert, Kontrast zwischen echter Emotion und erfundenem Kontext.
Struktur: Setup → Wendepunkt → Payoff → kurzer Ausklang.
Sound-Effekte an Pointen setzen.
 Ende: schnelles Fade-out, kein langes Auslaufen.`,
  werbevideo_marketing: `Ton: positiv, vertrauensbildend, klare Botschaft.
Struktur: Hook (erste 2 Sek. müssen Aufmerksamkeit binden) → Problem/Wunsch → Auflösung/Produkt-Moment → klarer Call-to-Action am Ende (z.B. Text-Overlay mit Link/Aktion).
Branding-Hinweis einbauen: dezent, nicht aufdringlich.`,
  lernvideo_kinder: `Ton: einfache, kurze Sätze, spielerisch, freundlich.
Struktur: Frage/Neugier wecken → einfache Erklärung in 1-2 Schritten → Wiederholung der Kernaussage am Ende als "Das haben wir gelernt"-Overlay.
Keine schnellen Cuts, ruhiges Tempo, keine erschreckenden Sound-Effekte.`,
  lernvideo_erwachsene: `Ton: informativ, strukturiert, auf den Punkt.
Struktur: klares Lernziel am Anfang benennen → 2-3 Kernpunkte mit Text-Overlay hervorheben → kurze Zusammenfassung am Ende.
Ruhiges, sachliches Tempo, keine übertriebenen Sound-Effekte.`
}

function buildSystemPrompt(sceneAnalysis, contentGoal, userPremise, adText, selectedHook) {
  const genreDesc = GENRE_DESCRIPTIONS[contentGoal] || contentGoal
  const genreAddition = GENRE_ADDITIONS[contentGoal] || ''

  let prompt = `Du bist ein hochkarätiger Video-Regisseur, TikTok-Algorithmus-Stratege (ByteDance Retention Engine) und CapCut-Drehbuch-Experte.
Erstelle ein zeitgetaggtes, produktionsreifes Meister-Drehbuch für CapCut basierend auf folgender Szenen- & Analytics-Analyse:

${JSON.stringify(sceneAnalysis, null, 2)}

WICHTIGE REGELN FÜR CAPCUT:
1. Keine Lip-Sync Anweisungen. Löse gesprochene Inhalte über TTS-Offscreen-Stimme oder Text-Overlays.
2. Formatiere jede Szene mit exaktem Zeitabschnitt, Visuellem Bild-Prompt (für CapCut KI-Bild/Video), Gesprochenem Text (Offscreen TTS), Text-Overlay und Sound-Effekt.

Format des fertigen Drehbuchs:
=========================================
🎯 STRATEGIE & ZIELGRUPPEN-BRIEFING
- Zielgruppe: [Demografie / Pain Points]
- ByteDance-Hebel: [0-3s Hook-Stop, Retention-Curve, Comment-Loop]

🎬 CAPCUT MASTER DREHBUCH (Timeline):

[0:00 - 0:03] Szene 1: Der Hook & Scroll-Stopper
- 🖼️ Visueller Prompt (CapCut): [Exakte Bild/Video-Beschreibung]
- 🎙️ Sprecher / Voiceover (TTS): "[Genauer gesprochener Satz]"
- 💬 Text-Overlay: "[Großer, auffälliger Text im Bild]"
- 🔊 Sound / SFX: "[Sound-Effekt]"

[0:03 - 0:08] Szene 2: Das Problem & die Chance
- 🖼️ Visueller Prompt (CapCut): [Exakte Beschreibung]
- 🎙️ Sprecher / Voiceover (TTS): "[Genauer gesprochener Satz]"
- 💬 Text-Overlay: "[Text-Overlay]"
- 🔊 Sound / SFX: "[Sound-Effekt]"

[0:08 - 0:18] Szene 3: Die NeXus-Lösung & der Hebel
- 🖼️ Visueller Prompt (CapCut): [Exakte Beschreibung]
- 🎙️ Sprecher / Voiceover (TTS): "[Genauer gesprochener Satz]"
- 💬 Text-Overlay: "[Text-Overlay]"
- 🔊 Sound / SFX: "[Sound-Effekt]"

[0:18 - 0:25] Szene 4: Transformation & Low-Barrier Start
- 🖼️ Visueller Prompt (CapCut): [Exakte Beschreibung]
- 🎙️ Sprecher / Voiceover (TTS): "[Genauer gesprochener Satz]"
- 💬 Text-Overlay: "[Text-Overlay]"
- 🔊 Sound / SFX: "[Sound-Effekt]"

[0:25 - 0:30] Szene 5: ByteDance Loop Call-to-Action
- 🖼️ Visueller Prompt (CapCut): [Exakte Beschreibung]
- 🎙️ Sprecher / Voiceover (TTS): "[Genauer gesprochener Satz]"
- 💬 Text-Overlay: "[Text-Overlay]"
- 🔊 Sound / SFX: "[Sound-Effekt]"

📱 TIKTOK CAPTION & HASHTAG-CLUSTER:
Caption: [Viraler Begleittext mit Neugier-Trigger]
Hashtags: [Relevante Nischen- und Trend-Hashtags]

✂️ CAPCUT BATCH PROMPT (Zum direkten Kopieren in CapCut EditPilot / Studio):
[Kompakter 1-Klick Textblock aller Szenen]`

  if (selectedHook) {
    prompt += `\n\nWICHTIG — DER USER HAT FOLGENDEN HOOK AUSGEWÄHLT. Das Drehbuch MUSS mit diesem Hook beginnen (Sekunde 0:00-0:01):
- Visuelles Bild: ${selectedHook.visual}
- Text-Overlay: "${selectedHook.text}"
- Audio: ${selectedHook.audio}
- Psychologischer Trigger: ${selectedHook.trigger}`
  }

  if (userPremise) {
    prompt += `\n\nWICHTIG — STRATEGISCHER WUNSCH DES USERS FÜR DAS FOLGE-VIDEO:
"${userPremise}"
Das Drehbuch MUSS exakt diesem inhaltlichen Ziel folgen!`
  }

  if (adText) {
    prompt += `\n\nWICHTIG — FOLGENDER TEXT MUSS EINGEBAUT WERDEN:
"${adText}"`
  }

  prompt += `\n\nAllgemeine Richtlinien:\n- ${genreAddition}\n\nAntworte direkt mit dem formatierten Drehbuch. Keine umschweifenden Erklärungen davor oder danach.`

  return prompt
}


async function tryGemini(systemPrompt) {
  if (!GEMINI_API_KEY) return null
  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: systemPrompt }] }],
        generationConfig: { temperature: 0.5 }
      })
    })
    if (!res.ok) return null
    const data = await res.json()
    return data.candidates?.[0]?.content?.parts?.[0]?.text || null
  } catch (e) {
    console.error('[generate-script] Gemini failed:', e.message)
    return null
  }
}

async function tryDeepSeek(systemPrompt) {
  if (!DEEPSEEK_API_KEY) return null
  try {
    const res = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${DEEPSEEK_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: 'Du bist ein preisgekrönter Regisseur und Copywriter für Video-Skripte.' },
          { role: 'user', content: systemPrompt }
        ],
        temperature: 0.5
      })
    })
    if (!res.ok) return null
    const data = await res.json()
    return data.choices?.[0]?.message?.content || null
  } catch (e) {
    console.error('[generate-script] DeepSeek failed:', e.message)
    return null
  }
}

async function tryGroq(systemPrompt) {
  if (!GROQ_API_KEY) return null
  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${GROQ_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'openai/gpt-oss-120b',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: 'Erstelle das Drehbuch basierend auf der Szenen-Analyse.' }
        ],
        temperature: 0.5,
        max_tokens: 4096
      })
    })
    if (!res.ok) return null
    const data = await res.json()
    return data.choices?.[0]?.message?.content || null
  } catch (e) {
    console.error('[generate-script] Groq failed:', e.message)
    return null
  }
}

async function tryMistral(systemPrompt) {
  if (!MISTRAL_API_KEY) return null
  try {
    const res = await fetch('https://api.mistral.ai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${MISTRAL_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'mistral-small-latest',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: 'Erstelle das Drehbuch basierend auf der Szenen-Analyse.' }
        ],
        temperature: 0.5,
        max_tokens: 4096
      })
    })
    if (!res.ok) return null
    const data = await res.json()
    return data.choices?.[0]?.message?.content || null
  } catch (e) {
    console.error('[generate-script] Mistral failed:', e.message)
    return null
  }
}

async function tryOpenRouter(systemPrompt) {
  if (!OPENROUTER_API_KEY) return null
  try {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://nexus-hit.netlify.app',
        'X-Title': 'Happiness Video Script'
      },
      body: JSON.stringify({
        model: 'nvidia/nemotron-3.5-lightning:free',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: 'Erstelle das Drehbuch basierend auf der Szenen-Analyse.' }
        ],
        temperature: 0.5,
        max_tokens: 4096
      })
    })
    if (!res.ok) return null
    const data = await res.json()
    return data.choices?.[0]?.message?.content || null
  } catch (e) {
    console.error('[generate-script] OpenRouter failed:', e.message)
    return null
  }
}


async function checkGuestRateLimit(visitorId, clientIp) {
  if (!visitorId) return { allowed: false, error: 'visitor_id ist erforderlich im Gast-Modus' }

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // Check count by visitorId
  const { count: visitorCount } = await supabase
    .from('events')
    .select('id', { count: 'exact', head: true })
    .eq('event_name', 'guest_generate_script')
    .eq('visitor_id', visitorId)
    .gte('created_at', today.toISOString())

  // Check count by IP in metadata
  const { count: ipCount } = await supabase
    .from('events')
    .select('id', { count: 'exact', head: true })
    .eq('event_name', 'guest_generate_script')
    .eq('metadata->>ip', clientIp)
    .gte('created_at', today.toISOString())

  const totalCount = Math.max(visitorCount || 0, ipCount || 0)
  console.log(`[RateLimit-Script] visitor: ${visitorId}, ip: ${clientIp}, count: ${totalCount}`)

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

    const { scene_analysis, content_goal, user_premise, ad_text, video_filename, script_id, selected_hook, visitor_id } = body

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

    if (!scene_analysis || !content_goal) {
      return {
        statusCode: 400,
        headers: CORS_HEADERS,
        body: JSON.stringify({ error: 'scene_analysis und content_goal sind erforderlich' })
      }
    }

    if (!['followup_tiktok_optimizer', 'comedy_prank', 'werbevideo_marketing', 'lernvideo_kinder', 'lernvideo_erwachsene'].includes(content_goal)) {
      return {
        statusCode: 400,
        headers: CORS_HEADERS,
        body: JSON.stringify({ error: 'Ungültiger content_goal Wert' })
      }
    }

    const systemPrompt = buildSystemPrompt(scene_analysis, content_goal, user_premise, ad_text, selected_hook)

    // Fallback chain: Groq → Mistral → OpenRouter → DeepSeek
    let script = null

    script = await tryGroq(systemPrompt)
    if (script) {
      console.log('[generate-script] Success via Groq')
    }

    if (!script) {
      script = await tryMistral(systemPrompt)
      if (script) console.log('[generate-script] Success via Mistral')
    }

    if (!script) {
      script = await tryOpenRouter(systemPrompt)
      if (script) console.log('[generate-script] Success via OpenRouter')
    }

    if (!script) {
      script = await tryDeepSeek(systemPrompt)
      if (script) console.log('[generate-script] Success via DeepSeek')
    }

    if (!script) {
      return {
        statusCode: 502,
        headers: CORS_HEADERS,
        body: JSON.stringify({ error: 'Drehbuch konnte nicht generiert werden. Alle KI-Modelle sind momentan nicht erreichbar.' })
      }
    }

    // Save to Supabase (update existing or insert new) if user is authenticated
    if (!user) {
      await supabase.from('events').insert({
        visitor_id: visitor_id,
        event_name: 'guest_generate_script',
        metadata: { ip: clientIp }
      })

      return {
        statusCode: 200,
        headers: CORS_HEADERS,
        body: JSON.stringify({ script })
      }
    }

    if (script_id) {
      await supabase
        .from('video_scripts')
        .update({ generated_script: script, scene_analysis })
        .eq('id', script_id)
        .eq('user_id', user.id)
    } else {
      const { data: saved } = await supabase
        .from('video_scripts')
        .insert({
          user_id: user.id,
          video_filename: video_filename || null,
          content_goal,
          scene_analysis,
          generated_script: script
        })
        .select('id')
        .single()

      return {
        statusCode: 200,
        headers: CORS_HEADERS,
        body: JSON.stringify({ script, script_id: saved?.id })
      }
    }

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({ script, script_id })
    }
  } catch (e) {
    console.error('[generate-script] Unexpected error:', e.message)
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: 'Interner Fehler bei der Drehbuch-Generierung' })
    }
  }
}
