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
    return {
      statusCode: 405,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: 'Method not allowed' })
    }
  }

  let userId = null

  try {
    // 1. Authenticate user via Supabase token
    const authHeader = event.headers.authorization || ''
    const token = authHeader.replace('Bearer ', '')

    if (token && SUPABASE_SERVICE_KEY) {
      try {
        const authRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
          headers: { 'Authorization': `Bearer ${token}`, 'apikey': SUPABASE_SERVICE_KEY }
        })
        if (authRes.ok) {
          const userData = await authRes.json()
          userId = userData.id
        }
      } catch (e) {
        console.error('Moderation auth check failed:', e.message)
      }
    }

    // 2. Parse body
    const body = JSON.parse(event.body || '{}')
    const { image } = body

    if (!image) {
      return {
        statusCode: 200,
        headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
        body: JSON.stringify({ allowed: false, reason: 'Image data missing' })
      }
    }

    // 3. Prepare clean base64 data for Google Vision API
    let cleanBase64 = image
    if (image.startsWith('data:')) {
      const parts = image.split(',')
      if (parts.length > 1) {
        cleanBase64 = parts[1]
      }
    }

    const apiKey = process.env.GOOGLE_VISION_API_KEY
    if (!apiKey) {
      console.error('[IMAGE MODERATION ERROR] GOOGLE_VISION_API_KEY is not configured. Fail closed.')
      console.warn(`[IMAGE MODERATION REJECTED] User: ${userId || 'anonymous'}, Time: ${new Date().toISOString()}, Reason: API key not configured (fail closed)`)
      return {
        statusCode: 200,
        headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
        body: JSON.stringify({ allowed: false, reason: 'Moderations-Dienst nicht konfiguriert (fail closed)' })
      }
    }

    // 4. Call Google Cloud Vision API
    const visionUrl = `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`
    const response = await fetch(visionUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requests: [
          {
            image: { content: cleanBase64 },
            features: [{ type: 'SAFE_SEARCH_DETECTION' }]
          }
        ]
      })
    })

    if (!response.ok) {
      const errBody = await response.text().catch(() => '')
      console.error(`Google Vision API error ${response.status}:`, errBody)
      throw new Error(`Google Vision API returned status ${response.status}: ${errBody}`)
    }

    const data = await response.json()
    const annotation = data.responses?.[0]?.safeSearchAnnotation

    console.log('[MODERATION] SafeSearch result:', JSON.stringify(annotation))

    if (!annotation) {
      throw new Error('No safeSearchAnnotation in Google Vision response')
    }

    // 5. Evaluate SafeSearch levels
    // Levels: UNKNOWN, VERY_UNLIKELY, UNLIKELY, POSSIBLE, LIKELY, VERY_LIKELY
    const blockLevels = ['LIKELY', 'VERY_LIKELY']
    const isViolating =
      blockLevels.includes(annotation.adult) ||
      blockLevels.includes(annotation.violence) ||
      blockLevels.includes(annotation.racy) ||
      blockLevels.includes(annotation.medical)

    if (isViolating) {
      const reasons = []
      if (blockLevels.includes(annotation.adult)) reasons.push('adult')
      if (blockLevels.includes(annotation.violence)) reasons.push('violence')
      if (blockLevels.includes(annotation.racy)) reasons.push('racy')
      if (blockLevels.includes(annotation.medical)) reasons.push('medical')

      const reasonStr = `Violated SafeSearch policies: ${reasons.join(', ')}`
      
      // Log server-side warning with user_id and timestamp
      console.warn(`[IMAGE MODERATION REJECTED] User: ${userId || 'anonymous'}, Time: ${new Date().toISOString()}, Reason: ${reasonStr}`)

      return {
        statusCode: 200,
        headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
        body: JSON.stringify({ allowed: false, reason: reasonStr })
      }
    }

    // Allowed!
    return {
      statusCode: 200,
      headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
      body: JSON.stringify({ allowed: true })
    }

  } catch (error) {
    // Fail closed!
    console.error('[IMAGE MODERATION ERROR] Fail closed:', error.message)
    console.warn(`[IMAGE MODERATION REJECTED] User: ${userId || 'anonymous'}, Time: ${new Date().toISOString()}, Reason: Exception caught: ${error.message} (fail closed)`)
    
    return {
      statusCode: 200,
      headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
      body: JSON.stringify({ allowed: false, reason: `Moderation failed (fail closed): ${error.message}` })
    }
  }
}
