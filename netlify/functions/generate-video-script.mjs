import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_KEY
const supabase = createClient(supabaseUrl, supabaseKey)

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
  comedy_prank: 'Comedy / Prank',
  werbevideo_marketing: 'Werbevideo / Marketing',
  lernvideo_kinder: 'Lernvideo für Kinder',
  lernvideo_erwachsene: 'Lernvideo für Erwachsene'
}

const GENRE_ADDITIONS = {
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

function buildSystemPrompt(sceneAnalysis, contentGoal, userPremise) {
  const genreDesc = GENRE_DESCRIPTIONS[contentGoal] || contentGoal
  const genreAddition = GENRE_ADDITIONS[contentGoal] || ''

  let prompt = `Du erstellst ein zeitgetaggtes Drehbuch für CapCut EditPilot basierend auf folgender Szenen-Analyse:

${JSON.stringify(sceneAnalysis, null, 2)}

WICHTIGE REGEL: EditPilot kann aktuell keinen echten Lip-Sync auf neu generierten Dialog erzeugen. Formuliere daher NIEMALS Anweisungen wie "Lippen synchron animieren". Löse gesprochene Inhalte stattdessen über:
- Untertitel/Text-Overlay
- TTS-Offscreen-Stimme
- Reaktions-Cuts und Zooms

Gib das Drehbuch in diesem Format aus, direkt copy-paste-fähig für den EditPilot-Chat in CapCut:

Bearbeite dieses Video als ${genreDesc}. Timeline:

[Zeitabschnitt]
[Was passieren soll: Dialog/Text-Overlay/Sound/Cut/Emotion]

...

Allgemein:
- Untertitel automatisch mit einblenden, wo Text/Dialog vorkommt
- ${genreAddition}`

  if (userPremise) {
    prompt += `\n\nZusätzliche Idee/Prämisse des Users: ${userPremise}`
  }

  prompt += `\n\nAntworte NUR mit dem fertigen Drehbuch. Kein Markdown, keine Codeblöcke, kein Vorwort.`

  return prompt
}

async function tryGroq(systemPrompt) {
  if (!GROQ_API_KEY) return null
  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${GROQ_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
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
        'HTTP-Referer': 'https://happiness-eu.netlify.app',
        'X-Title': 'Happiness Video Script'
      },
      body: JSON.stringify({
        model: 'google/gemma-4-26b-a4b-it:free',
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

async function tryDeepSeek(systemPrompt) {
  if (!DEEPSEEK_API_KEY) return null
  try {
    const res = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${DEEPSEEK_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'deepseek-v4-flash',
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
    console.error('[generate-script] DeepSeek failed:', e.message)
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

    const { scene_analysis, content_goal, user_premise, video_filename, script_id } = body

    if (!scene_analysis || !content_goal) {
      return {
        statusCode: 400,
        headers: CORS_HEADERS,
        body: JSON.stringify({ error: 'scene_analysis und content_goal sind erforderlich' })
      }
    }

    if (!['comedy_prank', 'werbevideo_marketing', 'lernvideo_kinder', 'lernvideo_erwachsene'].includes(content_goal)) {
      return {
        statusCode: 400,
        headers: CORS_HEADERS,
        body: JSON.stringify({ error: 'Ungültiger content_goal Wert' })
      }
    }

    const systemPrompt = buildSystemPrompt(scene_analysis, content_goal, user_premise)

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

    // Save to Supabase (update existing or insert new)
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
