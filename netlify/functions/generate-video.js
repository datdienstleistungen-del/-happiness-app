const SUPABASE_URL = 'https://irumowvmhvrofezwvnop.supabase.co'
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'sb_publishable_tArx0o4FeYQ3HthZ7h7hCQ_fTJslkMa'

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    }
  }

  // Auth-Check: Supabase-JWT verifizieren
  const authHeader = event.headers.authorization || ''
  const token = authHeader.replace('Bearer ', '')
  if (!token) {
    return {
      statusCode: 401,
      body: JSON.stringify({ error: 'Nicht authentifiziert' })
    }
  }

  try {
    // JWT gegen Supabase verifizieren
    const { data: { user }, error: authError } = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { 'Authorization': `Bearer ${token}`, 'apikey': SUPABASE_ANON_KEY }
    }).then(r => r.json())

    if (authError || !user) {
      return {
        statusCode: 401,
        body: JSON.stringify({ error: 'Ungueltiges Token' })
      }
    }

    const { prompt, template, language } = JSON.parse(event.body)

    const apiKey = process.env.GROQ_API_KEY

    if (!apiKey) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'GROQ_API_KEY not configured' })
      }
    }

    const langMap = {
      de: 'Deutsch',
      en: 'English',
      es: 'Espanol',
      fr: 'Francais',
      it: 'Italiano',
      nl: 'Nederlands',
      gr: 'Ellinika'
    }
    const langName = langMap[language] || 'Deutsch'

    let systemPrompt = ''

    if (template === 'motivation') {
      systemPrompt = `Rolle: Video-Scripter.
Aufgabe: 60s Motivations-Video als JSON-Array.
Szene: text1 (Haupttext), text2 (Untertext), duration (2-4s).
Stil: Kuerz, praegnant, motivierend. Ein Satz pro Szene. Kein Emoji.
Sprache: ${langName}
Output: Nur valides JSON.`
    } else if (template === 'dankbarkeit') {
      systemPrompt = `Rolle: Video-Scripter.
Aufgabe: 45s Dankbarkeits-Video als JSON-Array.
Szene: text1 (Haupttext), text2 (Untertext), duration (2-4s).
Stil: Warm, ehrfuerchtig. 5-6 Szenen.
Sprache: ${langName}
Output: Nur valides JSON.`
    } else if (template === 'affirmation') {
      systemPrompt = `Rolle: Video-Scripter.
Aufgabe: 30s Affirmations-Video als JSON-Array.
Szene: text1 (Affirmation), text2 (Ergaenzung), duration (2-3s).
Stil: Kraftvoll, positiv. 4-5 Affirmationen.
Sprache: ${langName}
Output: Nur valides JSON.`
    } else {
      systemPrompt = `Rolle: Video-Scripter.
Aufgabe: 30-45s Video basierend auf Prompt als JSON-Array.
Szene: text1 (Haupttext), text2 (Untertext), duration (2-4s).
Stil: Kuerz, praegnant, visuell. 5-7 Szenen, ein Gedanke pro Szene.
Sprache: ${langName}
Output: Nur valides JSON.`
    }

    const userMessage = template
      ? `Erstelle ein ${template}-Video auf ${langName}.`
      : `Erstelle ein Video zu: "${prompt}" auf ${langName}.`

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage }
        ],
        max_tokens: 1024,
        temperature: 0.8
      })
    })

    if (!response.ok) {
      const error = await response.text()
      console.error('Groq API error:', error)
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'AI service temporarily unavailable' })
      }
    }

    const data = await response.json()
    const aiResponse = data.choices[0]?.message?.content || '[]'

    let scenes
    try {
      const cleaned = aiResponse.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
      scenes = JSON.parse(cleaned)
      if (!Array.isArray(scenes)) scenes = []
      scenes = scenes.map((s, i) => ({
        id: i + 1,
        text1: s.text1 || '',
        text2: s.text2 || '',
        duration: Math.min(10, Math.max(1, s.duration || 3))
      }))
    } catch (parseError) {
      console.error('JSON parse error:', parseError)
      scenes = [
        { id: 1, text1: 'Happiness', text2: 'Dein Video', duration: 3 }
      ]
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': 'https://happiness-eu.netlify.app',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization'
      },
      body: JSON.stringify({ scenes })
    }

  } catch (error) {
    console.error('Generate video error:', error)
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' })
    }
  }
}
