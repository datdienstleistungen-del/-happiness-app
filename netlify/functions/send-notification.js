import { createClient } from '@supabase/supabase-js'

const ONESIGNAL_APP_ID = process.env.VITE_ONESIGNAL_APP_ID || process.env.ONESIGNAL_APP_ID || ''
const ONESIGNAL_REST_KEY = process.env.ONESIGNAL_REST_API_KEY || ''

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) }
  }

  const authHeader = event.headers.authorization || ''
  const token = authHeader.replace('Bearer ', '')
  if (!token) {
    return { statusCode: 401, body: JSON.stringify({ error: 'Nicht authentifiziert' }) }
  }

  try {
    const { data: { user } } = await supabase.auth.getUser(token)
    if (!user || user.role === 'anon') {
      return { statusCode: 403, body: JSON.stringify({ error: 'Kein Zugriff' }) }
    }

    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
    if (!profile || profile.role !== 'admin') {
      return { statusCode: 403, body: JSON.stringify({ error: 'Kein Admin-Zugriff' }) }
    }

    if (!ONESIGNAL_APP_ID || !ONESIGNAL_REST_KEY) {
      return { statusCode: 500, body: JSON.stringify({ error: 'OneSignal nicht konfiguriert' }) }
    }

    const { title, message, url, segment } = JSON.parse(event.body)

    if (!title || !message) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Titel und Nachricht erforderlich' }) }
    }

    const payload = {
      app_id: ONESIGNAL_APP_ID,
      contents: { en: message },
      headings: { en: title },
      url: url || 'https://happiness-eu.netlify.app',
    }

    if (segment) {
      payload.filters = [{ field: 'tag', key: 'language', relation: '=', value: segment }]
    }

    const response = await fetch('https://onesignal.com/api/v1/notifications', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${ONESIGNAL_REST_KEY}`,
      },
      body: JSON.stringify(payload),
    })

    const result = await response.json()

    if (result.id) {
      return { statusCode: 200, body: JSON.stringify({ success: true, id: result.id, recipients: result.recipients }) }
    } else {
      return { statusCode: 500, body: JSON.stringify({ error: result.errors?.[0] || 'Unbekannter Fehler' }) }
    }
  } catch (error) {
    console.error('OneSignal error:', error)
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) }
  }
}
