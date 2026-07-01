exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    }
  }

  try {
    const { message, systemPrompt, userId, history, imageUrl } = JSON.parse(event.body)

    // First try GEMINI_API_KEY, fallback to legacy GROQ_API_KEY if they haven't switched yet
    const apiKey = process.env.GEMINI_API_KEY
    
    if (!apiKey) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'GEMINI_API_KEY is not configured in environment variables.' })
      }
    }

    // Convert image URL to base64 inlineData for Gemini (as Gemini API doesn't accept public URLs directly in REST)
    let imagePart = null
    if (imageUrl) {
      try {
        const imgRes = await fetch(imageUrl)
        if (imgRes.ok) {
          const buffer = await imgRes.arrayBuffer()
          const base64Data = Buffer.from(buffer).toString('base64')
          const mimeType = imgRes.headers.get('content-type') || 'image/jpeg'
          imagePart = {
            inlineData: {
              data: base64Data,
              mimeType: mimeType
            }
          }
        } else {
          console.error(`Failed to fetch image from URL: ${imageUrl}, status: ${imgRes.status}`)
        }
      } catch (err) {
        console.error('Error fetching image for Gemini conversion:', err)
      }
    }

    // Build Gemini contents history array
    const contents = []

    // Map history to Gemini format (roles: 'user' or 'model')
    if (history && Array.isArray(history)) {
      const recentHistory = history.slice(-20)
      for (const msg of recentHistory) {
        contents.push({
          role: msg.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: msg.content }]
        })
      }
    }

    // Append the current user message (with optional inline image data)
    const currentUserParts = [{ text: message || '' }]
    if (imagePart) {
      currentUserParts.push(imagePart)
    }

    contents.push({
      role: 'user',
      parts: currentUserParts
    })

    // Call Google Gemini API (gemini-2.0-flash is multimodal and free-tier capable)
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`

    const response = await fetch(geminiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents,
        systemInstruction: {
          parts: [{ text: systemPrompt || 'Du bist ein erfahrener Mentor, guter Freund und kluger Ratgeber.' }]
        },
        generationConfig: {
          temperature: 0.7
        }
      })
    })

    const data = await response.json()

    if (!response.ok) {
      console.error('Gemini API Error:', data)
      return {
        statusCode: 502,
        body: JSON.stringify({
          error: 'Gemini AI service error',
          details: data.error?.message || JSON.stringify(data)
        })
      }
    }

    const aiResponse = data.candidates?.[0]?.content?.parts?.[0]?.text || 'Entschuldigung, ich konnte keine Antwort generieren.'

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
