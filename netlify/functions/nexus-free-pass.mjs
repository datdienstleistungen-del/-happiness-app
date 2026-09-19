import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY

const PASS_DURATION_HOURS = 24
const PASS_DURATION_SECONDS = PASS_DURATION_HOURS * 3600

export async function handler(event) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json'
  }

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' }
  }

  try {
    const rawIp = event.headers['x-nf-client-connection-ip'] ||
                  event.headers['client-ip'] ||
                  event.headers['x-forwarded-for'] ||
                  '127.0.0.1'
    const clientIp = rawIp.split(',')[0].trim()

    const now = new Date()
    let passRecord = null

    if (SUPABASE_URL && SUPABASE_ANON_KEY) {
      const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
      try {
        const { data, error } = await supabase
          .from('nexus_free_passes')
          .select('*')
          .eq('ip_address', clientIp)
          .maybeSingle()

        if (!error && data) {
          passRecord = data
        } else if (!error && !data) {
          const expiresAt = new Date(now.getTime() + PASS_DURATION_SECONDS * 1000)
          const { data: newRecord } = await supabase
            .from('nexus_free_passes')
            .insert({
              ip_address: clientIp,
              started_at: now.toISOString(),
              expires_at: expiresAt.toISOString(),
              created_at: now.toISOString()
            })
            .select()
            .maybeSingle()
          passRecord = newRecord || { started_at: now.toISOString(), expires_at: expiresAt.toISOString() }
        }
      } catch (dbErr) {
        console.warn('Supabase free pass table fallback:', dbErr.message)
      }
    }

    if (!passRecord) {
      const defaultExpires = new Date(now.getTime() + PASS_DURATION_SECONDS * 1000)
      passRecord = {
        started_at: now.toISOString(),
        expires_at: defaultExpires.toISOString()
      }
    }

    const expiresAt = new Date(passRecord.expires_at)
    const remainingSeconds = Math.max(0, Math.floor((expiresAt.getTime() - now.getTime()) / 1000))
    const isExpired = remainingSeconds <= 0
    const isActive = remainingSeconds > 0

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        ip: clientIp,
        started_at: passRecord.started_at,
        expires_at: passRecord.expires_at,
        remaining_seconds: remainingSeconds,
        is_active: isActive,
        is_expired: isExpired,
        duration_hours: PASS_DURATION_HOURS
      })
    }
  } catch (err) {
    console.error('nexus-free-pass error:', err)
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        remaining_seconds: PASS_DURATION_SECONDS,
        is_active: true,
        is_expired: false,
        duration_hours: PASS_DURATION_HOURS
      })
    }
  }
}
