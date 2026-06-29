exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    }
  }

  try {
    const { message, systemPrompt, userId, history, imageUrl } = JSON.parse(event.body)

    const apiKey = process.env.GROQ_API_KEY

    if (!apiKey) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'GROQ_API_KEY not configured' })
      }
    }

    const hasImage = !!imageUrl

    // Build messages array
    const messages = [
      { role: 'system', content: systemPrompt || 'Du bist ein guter Freund und Assistent.' }
    ]

    // Add history (last 20 messages for context)
    if (history && Array.isArray(history)) {
      const recentHistory = history.slice(-20)
      for (const msg of recentHistory) {
        messages.push({ role: msg.role, content: msg.content })
      }
    }

    // Add current user message (with or without image)
    if (hasImage) {
      messages.push({
        role: 'user',
        content: [
          { type: 'text', text: message },
          { type: 'image_url', image_url: { url: imageUrl } }
        ]
      })
    } else {
      messages.push({ role: 'user', content: message })
    }

    const model = hasImage ? 'llama-3.2-11b-vision-preview' : 'llama-3.3-70b-versatile'

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model,
        messages,
        max_tokens: 4096,
        temperature: 0.7
      })
    })

    if (!response.ok) {
      const error = await response.text()
      console.error('Groq API error for model', model, ':', error)
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'AI service temporarily unavailable' })
      }
    }

    const data = await response.json()
    const aiResponse = data.choices[0]?.message?.content || 'Entschuldigung, ich konnte keine Antwort generieren.'

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
    console.error('Chat function error:', error)
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' })
    }
  }
}
