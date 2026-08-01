import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.VITE_SUPABASE_URL
const CORS_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization'
}

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: CORS_HEADERS, body: '' }
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Method not allowed' }) }
  }

  const authHeader = event.headers.authorization || ''
  const token = authHeader.replace('Bearer ', '')

  try {
    let user = null
    if (token) {
      const authResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
        headers: { 'Authorization': `Bearer ${token}`, 'apikey': process.env.VITE_SUPABASE_ANON_KEY }
      }).then(r => r.json())

      user = authResponse?.id ? authResponse : authResponse?.data?.user
      if (!user) {
        return { statusCode: 401, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Ungültiges Token' }) }
      }
    }

    let body = {}
    try { body = JSON.parse(event.body || '{}') } catch { body = {} }

    const { visitor_id } = body
    if (!visitor_id) {
      return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: 'visitor_id ist erforderlich' }) }
    }

    const supabaseKey = process.env.SUPABASE_SERVICE_KEY
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Insert or update consent
    const consentPayload = {
      visitor_id,
      user_id: user ? user.id : null,
      consented_at: new Date().toISOString()
    }

    const { data, error } = await supabase
      .from('coach_consent')
      .insert(consentPayload)
      .select()

    if (error) {
      console.error('[coach-consent] Database error:', error.message)
      return { statusCode: 500, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Fehler beim Speichern der Einwilligung' }) }
    }

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({ success: true, consent: data[0] })
    }
  } catch (e) {
    console.error('[coach-consent] Unexpected error:', e.message)
    return { statusCode: 500, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Interner Server-Fehler' }) }
  }
}
