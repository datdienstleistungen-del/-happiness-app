const SUPABASE_URL = 'https://irumowvmhvrofezwvnop.supabase.co'
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || ''

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) }
  }

  const authHeader = event.headers.authorization || ''
  const token = authHeader.replace('Bearer ', '')
  if (!token) {
    return { statusCode: 401, body: JSON.stringify({ error: 'Nicht authentifiziert' }) }
  }

  try {
    const { data: { user }, error: authError } = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { 'Authorization': `Bearer ${token}`, 'apikey': SUPABASE_ANON_KEY }
    }).then(r => r.json())

    if (authError || !user) {
      return { statusCode: 401, body: JSON.stringify({ error: 'Ungueltiges Token' }) }
    }

    const { text, imageUrl } = JSON.parse(event.body)
    if (!text || text.trim().length < 3) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Text ist zu kurz (min. 3 Zeichen)' }) }
    }

    const apiKey = process.env.MISTRAL_API_KEY
    if (!apiKey) {
      return { statusCode: 500, body: JSON.stringify({ error: 'MISTRAL_API_KEY nicht konfiguriert' }) }
    }

    const systemPrompt = `Du bist ein kreativer TikTok-Video-Scripter. Erstelle ein vertikales 9:16 Video (max 60 Sekunden) basierend auf der Produktbeschreibung des Users.

Formatiere die Antwort als JSON-Array von Szenen. Jede Szene hat:
- text1: Haupttext (kurz, max 6 Wörter, große Schrift)
- text2: Untertext/Ergänzung (max 10 Wörter, kleinere Schrift)
- duration: Dauer in Sekunden (2-5)
- style: Hintergrundstil (einer von: "bold", "elegant", "minimal", "dynamic", "warm")
- visualPrompt: Kurze Beschreibung für Stock-Material (3-5 Wörter auf Englisch, z.B. "woman smiling coffee shop")

Regeln:
- Maximal 15 Szenen, insgesamt max 60 Sekunden
- Erste Szene: Haken/Attention-Grabber
- Letzte Szene: Call-to-Action
- Dazwischen: Produktvorteile, Emotionen, Lifestyle
- Jede Szene EINEN Gedanken, nicht überladen
- Keine Emojis im Text
- Sprache: Deutsch

Antworte NUR mit validem JSON-Array, kein Text davor oder danach.

Beispiel-Format:
[{"text1":"Nie wieder Langeweile","text2":"Dein perfekter Begleiter","duration":3,"style":"bold","visualPrompt":"happy person outdoors sunshine"},{"text1":"Endlich Freiheit","text2":"Wohin du willst","duration":4,"style":"dynamic","visualPrompt":"person traveling road trip"}]`

    const mistralRes = await fetch('https://api.mistral.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'mistral-small-latest',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Erstelle ein TikTok-Video für: ${text}` }
        ],
        temperature: 0.8,
        max_tokens: 4096
      })
    })

    if (!mistralRes.ok) {
      const errText = await mistralRes.text()
      console.error('Mistral API error:', errText)
      return { statusCode: 502, body: JSON.stringify({ error: 'AI service temporarily unavailable' }) }
    }

    const data = await mistralRes.json()
    const aiResponse = data.choices?.[0]?.message?.content || '[]'

    let scenes
    try {
      const cleaned = aiResponse.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
      scenes = JSON.parse(cleaned)
      if (!Array.isArray(scenes)) scenes = []
      scenes = scenes.map((s, i) => ({
        id: i + 1,
        text1: s.text1 || '',
        text2: s.text2 || '',
        duration: Math.min(5, Math.max(2, s.duration || 3)),
        style: s.style || 'minimal',
        visualPrompt: s.visualPrompt || 'abstract background'
      }))
      if (scenes.length === 0) scenes = fallbackScenes(text)
      // Cap total duration at 60s
      let totalDur = scenes.reduce((sum, s) => sum + s.duration, 0)
      while (totalDur > 60 && scenes.length > 1) {
        scenes.pop()
        totalDur = scenes.reduce((sum, s) => sum + s.duration, 0)
      }
    } catch (parseError) {
      console.error('JSON parse error:', parseError, 'Raw:', aiResponse)
      scenes = fallbackScenes(text)
    }

    // Fetch stock background videos for scenes without imageUrl
    const pexelsApiKey = process.env.PEXELS_API_KEY
    for (const scene of scenes) {
      if (imageUrl) {
        scene.backgroundType = 'product'
        scene.backgroundUrl = imageUrl
      } else {
        scene.backgroundType = 'stock'
        scene.backgroundUrl = null // Will be set on frontend with pexels search
      }
    }

    const styleColors = {
      bold: { bg: '#1a1a2e', accent: '#e94560', text: '#ffffff' },
      elegant: { bg: '#0f0f0f', accent: '#c9a96e', text: '#f5f5f5' },
      minimal: { bg: '#ffffff', accent: '#2d3436', text: '#2d3436' },
      dynamic: { bg: '#0a0a23', accent: '#00d2ff', text: '#ffffff' },
      warm: { bg: '#fff5e6', accent: '#e17055', text: '#2d3436' }
    }
    scenes = scenes.map(s => ({ ...s, colors: styleColors[s.style] || styleColors.minimal }))

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': 'https://happiness-eu.netlify.app',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization'
      },
      body: JSON.stringify({ scenes, totalDuration: scenes.reduce((sum, s) => sum + s.duration, 0) })
    }

  } catch (error) {
    console.error('TikTok video error:', error)
    return { statusCode: 500, body: JSON.stringify({ error: 'Internal server error' }) }
  }
}

function fallbackScenes(text) {
  const words = text.split(' ').filter(w => w.length > 3)
  const scenes = [
    { id: 1, text1: 'Kennst du das?', text2: words.slice(0, 3).join(' ') || 'Dein neuer Favorit', duration: 3, style: 'bold', visualPrompt: 'surprised happy person' },
    { id: 2, text1: words.slice(0, 2).join(' ') || 'Einzigartig', text2: 'Was dich auszeichnet', duration: 3, style: 'minimal', visualPrompt: 'product detail closeup' },
    { id: 3, text1: 'Jeder Moment zählt', text2: 'Mit Qualität, die begeistert', duration: 3, style: 'elegant', visualPrompt: 'happy lifestyle' },
    { id: 4, text1: words.slice(0, 3).join(' ') || 'Einfach besser', text2: 'Überzeug dich selbst', duration: 3, style: 'dynamic', visualPrompt: 'person using product' },
    { id: 5, text1: 'Jetzt entdecken', text2: 'Deine Reise beginnt hier', duration: 3, style: 'bold', visualPrompt: 'call to action modern' }
  ]
  return scenes
}
