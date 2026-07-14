const SUPABASE_URL = 'https://irumowvmhvrofezwvnop.supabase.co'
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || ''
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'sb_publishable_tArx0o4FeYQ3HthZ7h7hCQ_fTJslkMa'

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

const SYSTEM_PROMPT = `Rolle: Du bist ein erfahrener Video-Produzent und Social Media Stratege.
Aufgabe: Erstelle ein strukturiertes Video-Rezept für CapCut mit plattformspezifischen Publishing-Payloads.

Input: Ein Thema/Beschreibung vom User und eine gewünschte Dauer.

Output: NUR valides JSON (kein Markdown, kein Text davor/danach, keine Erklärungen).

JSON-Struktur:
{
  "video_title": "Kurzprägnanter Titel",
  "voiceover_script": "Kompletter Voiceover-Text am Stück zum Kopieren für TTS",
  "scenes": [
    {
      "timestamp": "00:00 - 00:03",
      "spoken_text": "Text der in dieser Szene gesprochen wird",
      "visual_prompt": "Detaillierter Englischer Prompt für KI-Bildgenerierung, cinematic shot, photorealistic, 4k, --ar 9:16"
    }
  ],
  "publishing_payload": {
    "tiktok_instagram": {
      "hook": "Text-Overlay für die ersten 3 Sekunden (Aufmerksamkeits-Hook)",
      "description": "Kurze, prägnante Caption mit viralen Hashtags (#happiness #creator #fyp #viral #motivation)"
    },
    "linkedin_facebook": {
      "headline": "Professionelle Hook-Zeile",
      "body_text": "Wertgetriebener, strukturierter Beitragstext für Business-Netzwerke. Mit Zeilenumbrüchen und Emojis."
    },
    "youtube_shorts": {
      "title": "Catchy YouTube-Titel (max 60 Zeichen)",
      "description": "Kurze Beschreibung mit relevanten Keywords und #Shorts"
    },
    "reddit": {
      "title": "Subreddit-freundlicher Titel (engagiert/Frage-Stil)",
      "body_text": "Kontext für Querposting in relevante Communities. Ehrlich, nicht werblich."
    }
  }
}

Regeln:
- LÄNGE: Das voiceover_script muss eine vollständige, packende Geschichte erzählen. Zielgröße: ca. 120-150 Wörter (entspricht ca. 30-45 Sekunden Videozeit).
- Das Skript MUSS eine klare psychologische Struktur haben:
  1. Aggressiver Hook (Sekunde 1-5),
  2. Problem-Präsentation (Keine Zeit für Videoschnitt),
  3. H.I.T. als Lösung vorstellen,
  4. Das faire Angebot (3 Gratis-Videos, danach 4,99 €),
  5. Ein glasklarer Call to Action mit der URL 'happiness-eu.netlify.app' am Schluss.
- Schreibe das Skript auf DEUTSCH (es sei denn, der User-Input verlangt explizit Englisch), damit es perfekt zur Zielgruppe passt.
- INTELLIGENZ-ANPASSUNG: Wenn die Benutzereingabe Gaming-Kontext enthält (z.B. Twitch, Stream, Gaming, Let's Play, Fortnite, Minecraft, Apex, League of Legends), muss das Skript und die Social Captions im authentischen Gamer-Slang verfasst werden (Begriffe wie Stream, Clutch, Fail, Highlight, Chat, Live nutzen).
- REDDIT GAMING FOCUS: Optimiere den Reddit-Payload speziell für Gaming-Communities. Erzeuge einen Titel und Kontext, der zu einer echten Diskussion einlädt (z.B. für r/gaming oder r/streamers), anstatt wie reine Werbung zu wirken.
- Passe die Anzahl der Szenen an die gewünschte Dauer an (ca. 3-5 Sekunden pro Szene)
- Voiceover-Text: Natürlich, emotional, flüssig lesbar, kein Deutsch-Englisch-Mischmasch
- Visual Prompts: Englisch, detailliert, aber KNAPP (max 25 Wörter pro Prompt), immer mit "cinematic, photorealistic, 4k, --ar 9:16" am Ende
- Verwende einfache, klare Visual Prompts die CapCut's Free-Tier Seedance-Modell nicht überlasten
- Erste Szene = Hook (sofortige Aufmerksamkeit), letzte Szene = CTA (Handlungsaufforderung)
- Dazwischen: Nutzen, Emotionen, Vorteile
- Timestamps müssen korrekt berechnet sein und zur tatsächlichen Dauer passen
- Jede Szene braucht einen einzigartigen visuellen Prompt
- publishing_payload: Jede Plattform hat eigene Mechaniken. TikTok/Instagram = kurz + Hook, LinkedIn = professionell, YouTube = SEO-optimiert, Reddit = community-first (Gaming-Communities wenn thematisch passend)
- NUR valides JSON ausgeben, kein anderer Text`

exports.handler = async (event) => {
  console.log('[CAPCUT-RECIPE] Function called, method:', event.httpMethod)

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

  const authHeader = event.headers.authorization || ''
  const token = authHeader.replace('Bearer ', '')
  if (!token) {
    return { statusCode: 401, body: JSON.stringify({ error: 'Nicht authentifiziert' }) }
  }

  let userId = null
  try {
    const authRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { 'Authorization': `Bearer ${token}`, 'apikey': SUPABASE_ANON_KEY }
    })
    if (authRes.ok) {
      const userData = await authRes.json()
      userId = userData.id
    }
  } catch (e) {
    console.error('[CAPCUT-RECIPE] Auth check failed:', e.message)
  }

  if (!userId) {
    return { statusCode: 401, body: JSON.stringify({ error: 'Ungueltiges Token' }) }
  }

  let body
  try {
    body = JSON.parse(event.body)
  } catch (e) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Ungueltige Daten' }) }
  }

  const { topic, duration } = body

  if (!topic || topic.trim().length < 3) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Thema ist zu kurz (min. 3 Zeichen)' }) }
  }

  if (topic.length > 2000) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Thema ist zu lang (max. 2000 Zeichen)' }) }
  }

  const validDurations = [15, 30, 45, 60]
  const videoDuration = validDurations.includes(duration) ? duration : 30

  const providers = []

  const groqKey = process.env.GROQ_API_KEY
  if (groqKey) {
    providers.push({
      name: 'groq',
      url: 'https://api.groq.com/openai/v1/chat/completions',
      key: groqKey,
      model: 'llama-3.3-70b-versatile'
    })
  }

  const orKey = process.env.OPENROUTER_API_KEY
  if (orKey) {
    providers.push({
      name: 'openrouter',
      url: 'https://openrouter.ai/api/v1/chat/completions',
      key: orKey,
      model: 'mistralai/mistral-small-3.1-24b-instruct:free'
    })
  }

  const dsKey = process.env.DEEPSEEK_API_KEY
  if (dsKey) {
    providers.push({
      name: 'deepseek',
      url: 'https://api.deepseek.com/v1/chat/completions',
      key: dsKey,
      model: 'deepseek-chat'
    })
  }

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
    return { statusCode: 500, body: JSON.stringify({ error: 'KI-Service nicht verfuegbar.' }) }
  }

  const userMessage = `Erstelle ein ${videoDuration}-Sekunden Video-Rezept fuer: ${topic.trim()}`

  let aiResponse = null
  let lastError = ''

  for (const provider of providers) {
    console.log(`[CAPCUT-RECIPE] Trying ${provider.name}...`)
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
            { role: 'system', content: SYSTEM_PROMPT },
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
          console.log(`[CAPCUT-RECIPE] Success with ${provider.name}`)
          break
        }
      } else {
        lastError = `${provider.name}: HTTP ${aiRes.status}`
        console.warn(`[CAPCUT-RECIPE] ${lastError}`)
      }
    } catch (e) {
      lastError = `${provider.name}: ${e.message}`
      console.warn(`[CAPCUT-RECIPE] ${lastError}`)
    }
  }

  if (!aiResponse) {
    return { statusCode: 429, body: JSON.stringify({ error: 'Alle KI-Dienste sind gerade ausgelastet.' }) }
  }

  let recipe
  try {
    const cleaned = aiResponse.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    recipe = JSON.parse(cleaned)

    if (!recipe.video_title || !recipe.voiceover_script || !Array.isArray(recipe.scenes)) {
      throw new Error('Invalid recipe structure')
    }

    recipe.scenes = recipe.scenes.map((s, i) => ({
      timestamp: s.timestamp || `00:${String(i * 3).padStart(2, '0')} - 00:${String((i + 1) * 3).padStart(2, '0')}`,
      spoken_text: s.spoken_text || '',
      visual_prompt: s.visual_prompt || 'cinematic shot, abstract background, photorealistic, 4k, --ar 9:16'
    }))

    if (!recipe.publishing_payload) {
      recipe.publishing_payload = {
        tiktok_instagram: {
          hook: recipe.scenes[0]?.spoken_text || recipe.video_title,
          description: `${recipe.video_title}\n\n${recipe.scenes.map(s => s.spoken_text).join(' ').substring(0, 150)}...\n\n#happiness #creator #fyp #viral #motivation`
        },
        linkedin_facebook: {
          headline: recipe.video_title,
          body_text: recipe.voiceover_script.substring(0, 500)
        },
        youtube_shorts: {
          title: recipe.video_title.substring(0, 60),
          description: `${recipe.video_title} — ${recipe.voiceover_script.substring(0, 100)}...\n\n#Shorts #${recipe.video_title.replace(/\s+/g, '')}`
        },
        reddit: {
          title: recipe.video_title,
          body_text: recipe.voiceover_script.substring(0, 500)
        }
      }
    }

  } catch (parseError) {
    console.error('[CAPCUT-RECIPE] JSON parse error:', parseError.message, 'Raw:', aiResponse.substring(0, 200))
    return { statusCode: 500, body: JSON.stringify({ error: 'Rezept konnte nicht generiert werden. Bitte versuch es nochmal.' }) }
  }

  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    },
    body: JSON.stringify(recipe)
  }
}
