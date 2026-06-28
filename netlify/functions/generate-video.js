exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    }
  }

  try {
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
      systemPrompt = `Du bist ein kreativer Video-Scripter. Erstelle ein 60-sekunden Motivations-Video als JSON-Array von Szenen.
Jede Szene hat: text1 (Haupttext, gross, faengt Aufmerksamkeit), text2 (Untertext, kleiner), duration (Sekunden, 2-4).
Antworte NUR mit validem JSON, kein Text davor oder danach.
Sprache: ${langName}
Stil: Kurz,praegnant, motivierend. Jede Szene ein Satz. Keine Emojis.
Beispiel-Output: [{"text1":"Du bist staerker","text2":"als du denkst","duration":3}]`
    } else if (template === 'dankbarkeit') {
      systemPrompt = `Du bist ein kreativer Video-Scripter. Erstelle ein 45-sekunden Dankbarkeits-Video als JSON-Array von Szenen.
Jede Szene hat: text1 (Haupttext), text2 (Untertext), duration (2-4 Sekunden).
Antworte NUR mit validem JSON.
Sprache: ${langName}
Stil: Warm, ehrfuerchtig, kurz. 5-6 Szenen.
Beispiel: [{"text1":"Heute bin ich dankbar","text2":"fuer die kleinen Dinge","duration":3}]`
    } else if (template === 'affirmation') {
      systemPrompt = `Du bist ein kreativer Video-Scripter. Erstelle ein 30-sekunden Affirmations-Video als JSON-Array von Szenen.
Jede Szene hat: text1 (Affirmation), text2 (Ergaenzung), duration (2-3 Sekunden).
Antworte NUR mit validem JSON.
Sprache: ${langName}
Stil: Kraftvoll, positiv, kurz. 4-5 starke Affirmationen.
Beispiel: [{"text1":"Ich bin genug","text2":"so wie ich bin","duration":3}]`
    } else {
      systemPrompt = `Du bist ein kreativer Video-Scripter. Erstelle ein kurzes Video basierend auf dem Prompt als JSON-Array von Szenen.
Jede Szene hat: text1 (Haupttext, gross), text2 (Untertext), duration (2-4 Sekunden).
Erstelle 5-7 Szenen fuer ein 30-45 Sekunden Video.
Antworte NUR mit validem JSON, kein Text davor oder danach.
Sprache: ${langName}
Stil: Kurz, praegnant, visuell. Jede Szene ein Gedanke.
Beispiel-Output: [{"text1":"Dein Text hier","text2":"Ergaenzung","duration":3}]`
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
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type'
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
