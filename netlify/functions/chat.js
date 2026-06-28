exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    }
  }

  try {
    const { message, systemPrompt, userId } = JSON.parse(event.body)

    const apiKey = process.env.GROQ_API_KEY

    if (!apiKey) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'GROQ_API_KEY not configured' })
      }
    }

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: systemPrompt || 'Du bist Happiness AI, ein freundlicher europäischer Assistent.' },
          { role: 'user', content: message }
        ],
        max_tokens: 1024,
        temperature: 0.7
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