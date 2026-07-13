const SUPABASE_URL = 'https://irumowvmhvrofezwvnop.supabase.co'
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || ''

async function moderateWithGoogle(cleanBase64, apiKey) {
  const visionUrl = `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`
  const response = await fetch(visionUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      requests: [{
        image: { content: cleanBase64 },
        features: [{ type: 'SAFE_SEARCH_DETECTION' }]
      }]
    })
  })

  if (!response.ok) {
    const errBody = await response.text().catch(() => '')
    throw new Error(`Google Vision API error ${response.status}: ${errBody}`)
  }

  const data = await response.json()
  const annotation = data.responses?.[0]?.safeSearchAnnotation
  if (!annotation) throw new Error('No safeSearchAnnotation in response')

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
    return { allowed: false, reason: `Violated SafeSearch policies: ${reasons.join(', ')}` }
  }

  return { allowed: true }
}

async function moderateWithGroq(cleanBase64, imageMimeType) {
  const groqKey = process.env.GROQ_API_KEY
  if (!groqKey) throw new Error('No Groq API key available')

  const dataUrl = `data:${imageMimeType};base64,${cleanBase64}`

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${groqKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'meta-llama/llama-4-scout-17b-16e-instruct',
      messages: [{
        role: 'user',
        content: [
          {
            type: 'text',
            text: 'Analyze this image for content policy violations. Is this image safe for a general audience social media platform? Look for: nudity, sexual content, graphic violence, gore, hate symbols, or other inappropriate content.\n\nReply with ONLY a JSON object in this exact format:\n{"safe": true/false, "reason": "brief explanation if unsafe"}'
          },
          {
            type: 'image_url',
            image_url: { url: dataUrl }
          }
        ]
      }],
      max_tokens: 150,
      temperature: 0.1
    })
  })

  if (!response.ok) {
    const errBody = await response.text().catch(() => '')
    throw new Error(`Groq Vision API error ${response.status}: ${errBody}`)
  }

  const result = await response.json()
  const content = result.choices?.[0]?.message?.content || ''

  const jsonMatch = content.match(/\{[\s\S]*?\}/)
  if (!jsonMatch) throw new Error('Could not parse Groq Vision response')

  const parsed = JSON.parse(jsonMatch[0])
  if (parsed.safe) {
    return { allowed: true }
  }
  return { allowed: false, reason: parsed.reason || 'Violated content policy (Groq Vision)' }
}

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

    const body = JSON.parse(event.body || '{}')
    const { image } = body

    if (!image) {
      return {
        statusCode: 200,
        headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
        body: JSON.stringify({ allowed: false, reason: 'Image data missing' })
      }
    }

    let cleanBase64 = image
    let imageMimeType = 'image/jpeg'
    if (image.startsWith('data:')) {
      const parts = image.split(',')
      if (parts.length > 1) {
        cleanBase64 = parts[1]
        const mimeMatch = image.match(/data:(.*?);/)
        if (mimeMatch) imageMimeType = mimeMatch[1]
      }
    }

    const blockSize = cleanBase64.length * 0.75
    if (blockSize > 4 * 1024 * 1024) {
      return {
        statusCode: 200,
        headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
        body: JSON.stringify({ allowed: false, reason: 'Image too large (max 4MB)' })
      }
    }

    const googleKey = process.env.GOOGLE_VISION_API_KEY

    // Try Google Vision first
    if (googleKey) {
      try {
        const result = await moderateWithGoogle(cleanBase64, googleKey)
        console.log('[MODERATION] Google Vision result:', JSON.stringify(result))
        return {
          statusCode: 200,
          headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
          body: JSON.stringify(result)
        }
      } catch (googleError) {
        console.warn('[MODERATION] Google Vision failed, falling back to Groq Vision:', googleError.message)
      }
    }

    // Fallback: Groq Vision
    try {
      const result = await moderateWithGroq(cleanBase64, imageMimeType)
      console.log('[MODERATION] Groq Vision result:', JSON.stringify(result))
      return {
        statusCode: 200,
        headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
        body: JSON.stringify(result)
      }
    } catch (groqError) {
      console.error('[MODERATION] Groq Vision also failed:', groqError.message)
    }

    // Both failed — fail open to not block users
    console.warn(`[IMAGE MODERATION] Both providers failed — failing open. User: ${userId || 'anonymous'}`)
    return {
      statusCode: 200,
      headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
      body: JSON.stringify({ allowed: true, reason: 'Moderation unavailable — passed through' })
    }

  } catch (error) {
    console.error('[IMAGE MODERATION ERROR]', error.message)
    return {
      statusCode: 200,
      headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
      body: JSON.stringify({ allowed: true, reason: 'Moderation error — passed through' })
    }
  }
}
