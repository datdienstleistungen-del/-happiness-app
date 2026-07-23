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

const SYSTEM_PROMPT = `Du bist ein preisgekrönter Senior Copywriter und Content-Strategist, spezialisiert auf Kurzvideos (TikTok, Reels, Shorts) und visuelle Foto-Storys. Erstelle ein hochgradig konvertierendes, emotionales und maßgeschneidertes "Rezept" (Videoskript oder Caption).

STRUKTUR- UND STILVORGABEN FÜR DIE ZIELGRUPPE (24-35 JAHRE):

1. PSYCHOLOGISCHER STRUKTUR-AUFBAU (PAS-Modell)
- Problem: Hole die Zielgruppe sofort ab. Nutze Schmerzpunkte der Altersgruppe 24-35 (Alltagsstress, Zeitmangel, Reizüberflutung, "Hustle Culture", Suche nach Balance, finanzielle oder berufliche Weiterentwicklung).
- Agitation: Vertiefe das Problem emotional, sodass sich der User ertappt fühlt.
- Solution: Präsentiere den Aha-Moment und die Lösung passend zum Thema des Users.

2. FORMALER REZEPT-AUFBAU FÜR VIDEOS/FOTOS
Teile die Ausgabe strikt in folgende 3 Abschnitte auf:

--- HOOK & VISUAL (Die ersten 3 Sekunden) ---
- Gib eine extrem starke, fesselnde Hookline aus (Fett gedruckt, maximal 1 kurze Zeile, mit passendem Emoji).
- Schreibe in Klammern eine visuelle Regieanweisung für das Video/Foto (z.B. [Visual: Du schaust gestresst auf dein Handy...]).

--- BODY & STORYLINE (Das Skript) ---
- Schreibe den Hauptteil in kurzen, rhythmischen Sätzen. Nutze viele Absätze (maximale Scannability). Es muss sich flüssig sprechen oder lesen lassen.
- Tonfall: Absolut authentisch auf Augenhöhe, direkte "Du"-Ansprache. Nutze modernen, organischen Sprachgebrauch der 24-35-Jährigen. Verwende etablierte, lockere Begriffe (z.B. Workflow, Gamechanger, Daily Business, Mindset, Side Hustle, Burnout, Fokus, Cut), aber übertreibe es nicht mit künstlichem Jugendslang. Es muss professionell, aber nahbar klingen.
- KEINE Standard-Floskeln: Verhindere Phrasen wie "In der heutigen digitalen Welt..." oder "Kennst du das auch?". Starte mitten in der Story.

--- CALL TO ACTION & BRANDING ---
- Beende den Inhalt mit einer dynamischen Handlungsaufforderung (z.B. "Speicher das Video für deinen nächsten Work-Day", "Teile das mit jemandem, der das hören muss").

REGEL: Jede Textgenerierung muss sich komplett neu und individuell anfühlen. Wiederhole niemals die Satzstrukturen aus vorherigen Antworten. Geh voll auf das spezifische Thema des Users ein.

Output: NUR valides JSON (kein Markdown, kein Text davor/danach, keine Erklärungen).

JSON-Struktur:
{
  "video_title": "Kurzprägnanter Titel",
  "voiceover_script": "Kompletter Voiceover-Text am Stück zum Kopieren für TTS. PAS-Modell: Problem → Agitation → Solution. Kurze, rhythmische Sätze. Authentisch, keine Floskeln.",
  "scenes": [
    {
      "timestamp": "00:00 - 00:03",
      "spoken_text": "Text der in dieser Szene gesprochen wird",
      "visual_prompt": "Detaillierter Englischer Prompt für KI-Bildgenerierung, cinematic shot, photorealistic, 4k, --ar 9:16"
    }
  ],
  "publishing_payload": {
    "tiktok_instagram": {
      "hook": "Extrem starke Hookline mit Emoji (max 1 Zeile)",
      "description": "PAS-Struktur: Problem → Agitation → Solution. Authentisch, keine Floskeln. Mit Hashtags."
    },
    "linkedin_facebook": {
      "headline": "Professionelle Hook-Zeile",
      "body_text": "Wertgetriebener, strukturierter Beitragstext für Business-Netzwerke. PAS-Modell. Mit Zeilenumbrüchen und Emojis."
    },
    "youtube_shorts": {
      "title": "Catchy YouTube-Titel (max 60 Zeichen)",
      "description": "Kurze Beschreibung mit relevanten Keywords und #Shorts"
    },
    "reddit": {
      "title": "Subreddit-freundlicher Titel (engagiert/Frage-Stil)",
      "body_text": "Ehrlich, nicht werblich. Community-first. PAS-Struktur."
    }
  },
  "hook_check_notes": [],
  "hook_check_suggestions": []
}

REGELN:
- LÄNGE: Das voiceover_script muss eine vollständige, packende Geschichte erzählen. Zielgröße: ca. 120-150 Wörter (entspricht ca. 30-45 Sekunden Videozeit).
- PAS-Modell: Problem (Schmerzpunkt) → Agitation (emotional vertiefen) → Solution (Aha-Moment)
- Schreibe das Skript auf DEUTSCH (es sei denn, der User-Input verlangt explizit Englisch)
- ZIELGRUPPE 24-35: Authentisch, "Du"-Ansprache, professionell aber nahbar. Keine Standard-Floskeln.
- INTELLIGENZ-ANPASSUNG: Bei Gaming-Kontext authentischen Gamer-Slang verwenden (Clutch, Highlight, Chat, Live etc.)
- Passe die Anzahl der Szenen an die gewünschte Dauer an (ca. 3-5 Sekunden pro Szene)
- Voiceover-Text: Natürlich, emotional, flüssig lesbar, kein Deutsch-Englisch-Mischmasch
- Visual Prompts: Englisch, detailliert, aber KNAPP (max 25 Wörter pro Prompt), immer mit "cinematic, photorealistic, 4k, --ar 9:16" am Ende
- Erste Szene = Hook (sofortige Aufmerksamkeit), letzte Szene = CTA (Handlungsaufforderung)
- publishing_payload: Jede Plattform hat eigene Mechaniken. TikTok/Instagram = kurz + Hook, LinkedIn = professionell, YouTube = SEO-optimiert, Reddit = community-first
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

  // Hook-Rules aus Supabase laden
  let hookRulesText = '';
  try {
    const rulesRes = await supabaseFetch(
      '/rest/v1/hook_rules?select=rule_key,pattern_de,severity,fix_instruction&applies_to_step=eq.video_concept&active=eq.true'
    );
    
    if (Array.isArray(rulesRes) && rulesRes.length > 0) {
      hookRulesText = '\n\n--- HOOK-REGELN (VOR DER GENERIERUNG PRÜFEN) ---\n' +
        rulesRes.map(r => 
          `- [${r.severity.toUpperCase()}] ${r.pattern_de}\n  → BEHEBUNG: ${r.fix_instruction}`
        ).join('\n') +
        '\n\nWICHTIG: Generiere das Video-Konzept SO, dass diese Regeln EINGEHALTEN werden.' +
        '\nFalls eine Regel verletzt wird, füge in die JSON-Antwort die Felder hinzu:' +
        '\n- "hook_check_notes": ["Notiz zu Regelverletzung X"]' +
        '\n- "hook_check_suggestions": ["Vorschlag zur Verbesserung Y"]';
      console.log('[CAPCUT-RECIPE] Hook-Rules loaded:', rulesRes.length, 'rules');
    }
  } catch (e) {
    console.error('[CAPCUT-RECIPE] Hook-Rules konnten nicht geladen werden:', e.message);
    // Fallback: Kein Hard-Fail, Flow läuft ohne Constraint-Check weiter
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
            { role: 'system', content: SYSTEM_PROMPT + hookRulesText },
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

    // Hook-Check-Felder sind optional (nicht erzwingen)
    recipe.hook_check_notes = recipe.hook_check_notes || [];
    recipe.hook_check_suggestions = recipe.hook_check_suggestions || [];

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
