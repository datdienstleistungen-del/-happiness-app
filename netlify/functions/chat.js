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

    // Try vision-capable model first, fall back to text-only if unavailable
    const textModels = ['llama-3.3-70b-versatile', 'meta-llama/llama-4-scout-17b-16e-instruct', 'mixtral-8x7b-32768']
    const visionModels = ['llama-3.2-11b-vision-preview']
    const model = hasImage ? visionModels[0] : textModels[0]

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model,
        messages,
        max_completion_tokens: hasImage ? 4096 : 8192,
        temperature: 0.7
      })
    })

    if (!response.ok) {
      const error = await response.text()
      console.error('Groq API error for model', model, ':', error)

      // If vision model failed AND we have an image, try without the image
      if (hasImage) {
        const textMessages = messages.map(m => {
          if (Array.isArray(m.content)) {
            return { role: m.role, content: m.content.find(c => c.type === 'text')?.text || '' }
          }
          return m
        })
        const fallbackResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: textModels[0],
            messages: textMessages,
            max_completion_tokens: 8192,
            temperature: 0.7
          })
        })
        if (fallbackResponse.ok) {
          const fallbackData = await fallbackResponse.json()
          const aiResponse = fallbackData.choices[0]?.message?.content || ''
          return {
            statusCode: 200,
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*',
              'Access-Control-Allow-Headers': 'Content-Type'
            },
            body: JSON.stringify({
              response: aiResponse,
              imageNote: 'Bild konnte nicht analysiert werden – Nachricht wurde ohne Bild beantwortet.'
            })
          }
        }
      }

      return {
        statusCode: 502,
        body: JSON.stringify({ 
          error: 'AI service temporarily unavailable',
          details: error,
          model: model 
        })
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
    console.error('Chat function error:', error.message, error.stack)
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' })
    }
  }
}
