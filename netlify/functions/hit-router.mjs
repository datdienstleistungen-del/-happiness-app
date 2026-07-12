// ──────────────────────────────────────────────────────────────
// H.I.T. — Happiness Intelligence Team
// Layer 1: Intent & Goal Recognition (nur Logging, kein Eingriff)
// ──────────────────────────────────────────────────────────────

const PLATFORMS = {
  tiktok: {
    keywords: ['tiktok', 'tik tok', 'video', 'reel', 'kurzvideo', 'hook', 'sound', 'trend'],
    patterns: [/tiktok/i, /video.*erstell/i, /reel/i, /kurzvideo/i, /kurzes.*video/i]
  },
  facebook: {
    keywords: ['facebook', 'fb', 'post', 'beitrag', 'gruppe', 'seite', 'kleinanzeige', 'markt', 'anzeigen'],
    patterns: [/facebook/i, /\bfb\b/i, /kleinanzeige/i, /markt.*platz/i, /anzeige.*schalt/i, /post.*schreib/i]
  },
  instagram: {
    keywords: ['instagram', 'ig', 'story', 'reel', 'post', 'grid', 'follower', 'hashtag'],
    patterns: [/instagram/i, /\big\b/i, /story/i, /reel/i, /hashtag/i]
  },
  youtube: {
    keywords: ['youtube', 'yt', 'video', 'kanal', 'subscriber', 'thumbnail', 'longform'],
    patterns: [/youtube/i, /\byt\b/i, /kanal.*wach/i, /subscriber/i, /longform/i]
  },
  linkedin: {
    keywords: ['linkedin', 'beruf', 'netzwerk', 'karriere', 'bewerbung', 'cv', 'lebenslauf'],
    patterns: [/linkedin/i, /beruflich/i, /karriere/i, /bewerbung/i, /lebenslauf/i]
  }
}

const GOALS = {
  content_creation: {
    keywords: ['erstellen', 'schreiben', 'posten', 'veröffentlichen', 'entwurf', 'idee', 'konzept', 'skript', 'caption', 'text'],
    patterns: [/content.*erstell/i, /post.*schreib/i, /etwas.*post/i, /entwurf/i, /idee/i, /skript/i, /caption/i]
  },
  feedback: {
    keywords: ['feedback', 'review', 'kritik', 'verbesserung', 'bewertung', 'einschätzung', 'meinung'],
    patterns: [/feedback/i, /review/i, /verbesser/i, /einschätzung/i, /was.*halst/i, /wie.*findest/i]
  },
  strategy: {
    keywords: ['strategie', 'plan', 'wachstum', 'reichweite', 'zielgruppe', 'marketing', 'positionierung', 'aufbau'],
    patterns: [/strategie/i, /plan.*mach/i, /wachstum/i, /reichweite/i, /zielgruppe/i, /aufbau/i]
  },
  monetization: {
    keywords: ['geld verdienen', 'monetarisierung', 'einnahmen', 'umsatz', 'preis', 'kosten', 'abo', 'premium', 'shop', 'verkaufen'],
    patterns: [/geld.*verdien/i, /monetari/i, /einnahm/i, /umsatz/i, /verkauf/i, /shop/i]
  },
  community: {
    keywords: ['community', 'freunde', 'vernetzen', 'kontakt', 'netzwerk', 'gruppe', 'zusammenhalt'],
    patterns: [/community/i, /freunde/i, /vernetz/i, /netzwerk/i, /gruppe/i]
  },
  learning: {
    keywords: ['lernen', 'verstehen', 'erklär', 'wie funktioniert', 'tutorial', 'anleitung', 'hilfe'],
    patterns: [/lern/i, /erkl[aä]r/i, /wie.*funktionier/i, /tutorial/i, /anleitung/i, /hilfe/i]
  }
}

function classifyIntent(message) {
  if (!message) return { platform: 'unknown', goal: 'unknown', confidence: 0 }

  const lower = message.toLowerCase()
  let detectedPlatform = 'unknown'
  let platformConfidence = 0
  let detectedGoal = 'unknown'
  let goalConfidence = 0

  for (const [platform, config] of Object.entries(PLATFORMS)) {
    let score = 0
    for (const pattern of config.patterns) {
      if (pattern.test(lower)) score += 2
    }
    for (const kw of config.keywords) {
      if (lower.includes(kw)) score += 1
    }
    if (score > platformConfidence) {
      platformConfidence = score
      detectedPlatform = platform
    }
  }

  for (const [goal, config] of Object.entries(GOALS)) {
    let score = 0
    for (const pattern of config.patterns) {
      if (pattern.test(lower)) score += 2
    }
    for (const kw of config.keywords) {
      if (lower.includes(kw)) score += 1
    }
    if (score > goalConfidence) {
      goalConfidence = score
      detectedGoal = goal
    }
  }

  const maxPlatformScore = 6
  const maxGoalScore = 6
  const confidence = Math.min(
    (platformConfidence + goalConfidence) / (maxPlatformScore + maxGoalScore),
    1
  )

  return {
    platform: detectedPlatform,
    platformConfidence: Math.min(platformConfidence / maxPlatformScore, 1),
    goal: detectedGoal,
    goalConfidence: Math.min(goalConfidence / maxGoalScore, 1),
    confidence
  }
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
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) }
  }

  const hitEnabled = process.env.HIT_ENABLED === 'true'
  if (!hitEnabled) {
    return { statusCode: 200, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify({ hit: false }) }
  }

  try {
    const body = JSON.parse(event.body)
    const { message } = body

    const intent = classifyIntent(message)

    console.log(`[H.I.T.] message: "${(message || '').substring(0, 80)}"`)
    console.log(`[H.I.T.] platform: ${intent.platform} (${Math.round(intent.platformConfidence * 100)}%)`)
    console.log(`[H.I.T.] goal: ${intent.goal} (${Math.round(intent.goalConfidence * 100)}%)`)
    console.log(`[H.I.T.] confidence: ${Math.round(intent.confidence * 100)}%`)

    const chatResponse = await fetch(`${event.headers.origin || 'https://happiness-eu.netlify.app'}/.netlify/functions/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': event.headers.authorization || ''
      },
      body: JSON.stringify(body)
    })

    const chatData = await chatResponse.json()

    return {
      statusCode: chatResponse.status,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({
        ...chatData,
        _hit: {
          enabled: true,
          platform: intent.platform,
          goal: intent.goal,
          confidence: Math.round(intent.confidence * 100)
        }
      })
    }
  } catch (error) {
    console.error('[H.I.T.] Error:', error.message)
    const chatResponse = await fetch(`${event.headers.origin || 'https://happiness-eu.netlify.app'}/.netlify/functions/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': event.headers.authorization || ''
      },
      body: event.body
    })
    const chatData = await chatResponse.json()
    return {
      statusCode: chatResponse.status,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify(chatData)
    }
  }
}
