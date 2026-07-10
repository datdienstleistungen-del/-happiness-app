import { Mistral } from '@mistralai/mistralai'

const SUPABASE_URL = 'https://irumowvmhvrofezwvnop.supabase.co'
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || ''

export const handler = async (event) => {
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

  try {
    const authHeader = event.headers.authorization || ''
    const token = authHeader.replace('Bearer ', '')
    if (!token) {
      return { statusCode: 401, body: JSON.stringify({ error: 'Nicht authentifiziert' }) }
    }

    let userId = null
    try {
      const authRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
        headers: { 'Authorization': `Bearer ${token}`, 'apikey': SUPABASE_SERVICE_KEY }
      })
      if (authRes.ok) {
        const userData = await authRes.json()
        userId = userData.id
      }
    } catch (e) {
      console.error('Auth check failed:', e.message)
    }

    const { message, systemPrompt, history, imageBase64 } = JSON.parse(event.body)
    if (imageBase64) {
      console.log('imageBase64 type:', typeof imageBase64, 'prefix:', imageBase64.substring(0, 50))
    }

    // --- Creator Academy usage limit check ---
    let caSettings = null
    const isCreatorAcademy = systemPrompt && systemPrompt.includes('New Creator Generation Academy')
    if (isCreatorAcademy && userId) {
      const settingsRes = await fetch(
        `${SUPABASE_URL}/rest/v1/ai_settings?user_id=eq.${userId}&select=is_premium,free_content_used`,
        {
          headers: {
            'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
            'apikey': SUPABASE_SERVICE_KEY,
            'Accept': 'application/json'
          }
        }
      )
      const settingsData = await settingsRes.json()
      caSettings = Array.isArray(settingsData) ? settingsData[0] : settingsData

      if (caSettings && !caSettings.is_premium && (caSettings.free_content_used || 0) >= 5) {
        return {
          statusCode: 402,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          },
          body: JSON.stringify({ error: 'Kostenloses Kontingent aufgebraucht', code: 'limit_reached' })
        }
      }
    }

    const apiKey = process.env.MISTRAL_API_KEY
    if (!apiKey) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'MISTRAL_API_KEY nicht konfiguriert' })
      }
    }

    const MODEL = 'mistral-small-latest'

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

    let userContent
    if (imageBase64) {
      userContent = [
        { type: 'text', text: message || 'Analysiere dieses Bild.' },
        { type: 'image_url', image_url: imageBase64 }
      ]
    } else {
      userContent = message || 'Hallo'
    }

    messages.push({ role: 'user', content: userContent })

    const mistral = new Mistral({ apiKey })
    const result = await mistral.chat.complete({
      model: MODEL,
      messages,
      temperature: 0.7,
      max_tokens: 4096
    })

    const aiResponse = result.choices?.[0]?.message?.content || 'Entschuldigung, ich konnte keine Antwort generieren.'

    // --- Increment Creator Academy counter ---
    if (isCreatorAcademy && caSettings && !caSettings.is_premium) {
      await fetch(
        `${SUPABASE_URL}/rest/v1/ai_settings?user_id=eq.${userId}`,
        {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
            'apikey': SUPABASE_SERVICE_KEY,
            'Content-Type': 'application/json',
            'Prefer': 'return=minimal'
          },
          body: JSON.stringify({
            free_content_used: (caSettings.free_content_used || 0) + 1
          })
        }
      )
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ response: aiResponse })
    }

  } catch (error) {
    console.error('Chat function error:', error.message, error.stack)
    const errorMessage = error.message || 'Internal server error'
    return {
      statusCode: error.statusCode || 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        error: errorMessage,
        code: errorMessage.includes('does not support image input') ? 'image_not_supported' : undefined
      })
    }
  }
}
