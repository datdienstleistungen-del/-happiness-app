export const handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    }
  }

  try {
    const { message, systemPrompt, userId, history, imageBase64, imageUrl } = JSON.parse(event.body)

    const apiKey = process.env.MISTRAL_API_KEY
    if (!apiKey) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'MISTRAL_API_KEY is not configured in environment variables.' })
      }
    }

    const MODEL = 'pixtral-large-latest'

    const messages = []
    messages.push({ role: 'system', content: systemPrompt || 'Du bist ein erfahrener Mentor, guter Freund und kluger Ratgeber.' })

    if (history && Array.isArray(history)) {
      for (const msg of history.slice(-20)) {
        messages.push({
          role: msg.role === 'assistant' ? 'assistant' : 'user',
          content: msg.content
        })
      }
    }

    // Bild als base64 direkt vom Frontend oder via URL fetchen
    let imgData = imageBase64
    if (!imgData && imageUrl) {
      try {
        const imgRes = await fetch(imageUrl)
        if (imgRes.ok) {
          const buf = await imgRes.arrayBuffer()
          const b64 = Buffer.from(buf).toString('base64')
          const mime = imgRes.headers.get('content-type') || 'image/jpeg'
          imgData = `data:${mime};base64,${b64}`
        }
      } catch (e) {
        console.error('Image fetch error:', e)
      }
    }

    let userContent
    if (imgData) {
      userContent = [
        { type: 'text', text: message || 'Was siehst du auf diesem Bild?' },
        { type: 'image_url', image_url: { url: imgData } }
      ]
    }

    if (!userContent) {
      userContent = message || 'Hallo'
    }

    messages.push({ role: 'user', content: userContent })

    const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: MODEL,
        messages: messages,
        temperature: 0.7,
        max_tokens: 4096
      })
    })

    const data = await response.json()

    if (!response.ok) {
      return {
        statusCode: 502,
        body: JSON.stringify({
          error: 'AI service error',
          details: data.error?.message || JSON.stringify(data)
        })
      }
    }

    const aiResponse = data.choices?.[0]?.message?.content || 'Entschuldigung, ich konnte keine Antwort generieren.'

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type'
      },
      body: JSON.stringify({ response: aiResponse })
    }

  } catch (error) {
    console.error('Chat function error:', error.message, error.stack)
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' })
    }
  }
}
