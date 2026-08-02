export const handler = async (event) => {
  const CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  }

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: CORS_HEADERS, body: '' }
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Method not allowed' }) }
  }

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    return { statusCode: 500, headers: CORS_HEADERS, body: JSON.stringify({ error: 'TTS-Dienst ist nicht konfiguriert (OPENAI_API_KEY fehlt).' }) }
  }

  try {
    let body = {}
    try { body = JSON.parse(event.body || '{}') } catch { body = {} }
    
    // Fallback to nova if no voice provided
    const { text, voice = 'nova' } = body
    if (!text || text.trim().length === 0) {
      return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Text ist erforderlich' }) }
    }

    const res = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'tts-1',
        input: text,
        voice: voice // options: alloy, echo, fable, onyx, nova, shimmer
      })
    })

    if (!res.ok) {
      const errText = await res.text()
      console.error('[TTS] OpenAI Error:', errText)
      return { statusCode: res.status, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Fehler bei der Spracherstellung.' }) }
    }

    const arrayBuffer = await res.arrayBuffer()
    const base64Audio = Buffer.from(arrayBuffer).toString('base64')

    return {
      statusCode: 200,
      headers: {
        ...CORS_HEADERS,
        'Content-Type': 'audio/mpeg'
      },
      isBase64Encoded: true,
      body: base64Audio
    }
  } catch (err) {
    console.error('[TTS] Server Error:', err.message)
    return { statusCode: 500, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Interner Server-Fehler' }) }
  }
}
