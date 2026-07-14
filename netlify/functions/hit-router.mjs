// ──────────────────────────────────────────────────────────────
// H.I.T. — Happiness Intelligence Team
// Layer 1: Hybrid Intent & Goal Recognition (nur Logging)
// Plattform: Keyword-Erkennung (schnell, zuverlässig)
// Ziel: LLM-Call via Groq (parallel, non-blocking)
// ──────────────────────────────────────────────────────────────

const CHAT_URL = 'https://happiness-eu.netlify.app/.netlify/functions/chat'

// ── Plattform-Erkennung (Keyword-basiert) ──

const PLATFORMS = {
  tiktok: {
    keywords: ['tiktok', 'tik tok', 'video', 'reel', 'kurzvideo', 'hook', 'sound', 'trend'],
    patterns: [/tiktok/i, /video.*erstell/i, /reel/i, /kurzvideo/i, /kurzes.*video/i]
  },
  facebook: {
    keywords: ['facebook', 'fb', 'post', 'beitrag', 'gruppe', 'seite'],
    patterns: [/facebook/i, /\bfb\b/i, /post.*schreib/i]
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
  },
  marketplace: {
    keywords: ['kleinanzeige', 'anzeigen', 'markt', 'marktplatz', 'verkaufen', 'verkauf', 'gebraucht', 'biete', 'suche', 'abzugeben', 'zu verkaufen'],
    patterns: [/kleinanzeige/i, /anzeige.*schalt/i, /markt.*platz/i, /auf.*marktplatz/i, /gebucht/i, /biete.*an/i, /zu.*verkaufen/i, /abzugeben/i]
  }
}

function classifyPlatform(message) {
  if (!message) return { platform: 'unknown', confidence: 0 }
  const lower = message.toLowerCase()
  let detected = 'unknown'
  let bestScore = 0

  for (const [platform, config] of Object.entries(PLATFORMS)) {
    let score = 0
    for (const pattern of config.patterns) { if (pattern.test(lower)) score += 2 }
    for (const kw of config.keywords) { if (lower.includes(kw)) score += 1 }
    if (score > bestScore) { bestScore = score; detected = platform }
  }

  return { platform: detected, confidence: Math.min(bestScore / 6, 1) }
}

// ── Ziel-Erkennung (LLM via Groq, parallel) ──

const GOAL_PROMPT = `Intent-Klassifizierer. Kategorien:
- content_creation: Post, Video, Text erstellen
- feedback: Einschaetzung, Review, Verbesserung
- strategy: Optimieren, wachsen, strategisch angehen
- monetization: Geld verdienen, verkaufen, Einnahmen
- community: Vernetzen, Leute kennenlernen
- learning: Lernen, verstehen, erklaert bekommen
- general: Begruessung, Smalltalk, kein Ziel

Antworte NUR mit dem Kategorienamen.`

function classifyGoalWithKeywords(message) {
  if (!message) return { goal: 'general', confidence: 0.5, method: 'keyword' }
  const lower = message.toLowerCase()

  const GOALS = {
    content_creation: [/post.*erstell/i, /text.*schreib/i, /video.*mach/i, /content.*erstell/i, /caption/i, /skript/i, /hook/i, /tiktok/i, /instagram/i, /reel/i, /tweet/i, /linkedin.*post/i, /facebook.*post/i, /reddit.*post/i, /post.*schreib/i, /post.*vor/i, /teilen/i, /veröffentlichen/i, /posten/i],
    feedback: [/feedback/i, /review/i, /verbesser/i, /einschätzung/i, /verbesserung/i, /check/i, /bewert/i, /meinung/i],
    strategy: [/strateg/i, /wachstum/i, /optimier/i, /plan/i, /ziele/i, /ziel.*setz/i, /grow/i, /skalier/i],
    monetization: [/geld.*verdien/i, /verkauf/i, /einnahm/i, /monetar/i, /preis/i, /kosten/i, /abo/i, /premium/i, /geld/i, /verdien/i],
    community: [/community/i, /netzwerk/i, /freunde/i, /verbind/i, /kenneniern/i, /leute/i, /vernetz/i],
    learning: [/erklär/i, /lern/i, /versteh/i, /wie.*funktioniert/i, /wie.*geht/i, /tutorial/i, /hilf/i, /help/i, /frage/i],
  }

  for (const [goal, patterns] of Object.entries(GOALS)) {
    for (const p of patterns) {
      if (p.test(lower)) return { goal, confidence: 0.6, method: 'keyword' }
    }
  }
  return { goal: 'general', confidence: 0.3, method: 'keyword' }
}

async function classifyGoalWithLLM(message, groqKey) {
  if (!message) return { goal: 'unknown', confidence: 0, method: 'none' }

  // Try Groq first
  if (groqKey) {
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 5000)

      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${groqKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'meta-llama/llama-4-scout-17b-16e-instruct',
          messages: [
            { role: 'system', content: GOAL_PROMPT },
            { role: 'user', content: message.substring(0, 500) }
          ],
          temperature: 0,
          max_tokens: 20
        }),
        signal: controller.signal
      })

      clearTimeout(timeout)

      if (res.ok) {
        const data = await res.json()
        const raw = (data.choices?.[0]?.message?.content || '').trim()
        return parseGoalResponse(raw)
      }
      console.warn(`[H.I.T.] Groq goal call failed: HTTP ${res.status}`)
    } catch (err) {
      if (err.name === 'AbortError') {
        console.warn('[H.I.T.] Groq goal call timed out (5s)')
      } else {
        console.warn('[H.I.T.] Groq goal call error:', err.message)
      }
    }
  }

  // Fallback: Mistral
  const mistralKey = process.env.MISTRAL_API_KEY
  if (mistralKey) {
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 8000)

      const res = await fetch('https://api.mistral.ai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${mistralKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'mistral-small-latest',
          messages: [
            { role: 'system', content: GOAL_PROMPT },
            { role: 'user', content: message.substring(0, 500) }
          ],
          temperature: 0,
          max_tokens: 20
        }),
        signal: controller.signal
      })

      clearTimeout(timeout)

      if (res.ok) {
        const data = await res.json()
        const raw = (data.choices?.[0]?.message?.content || '').trim()
        console.log('[H.I.T.] Goal classified via Mistral fallback')
        return parseGoalResponse(raw)
      }
      console.warn(`[H.I.T.] Mistral goal call failed: HTTP ${res.status}`)
    } catch (err) {
      console.warn('[H.I.T.] Mistral goal call error:', err.message)
    }
  }

  return { goal: 'unknown', confidence: 0, method: 'none' }
}

function parseGoalResponse(raw) {
  const rawLower = raw.toLowerCase().replace(/[`*_#\-]/g, '').trim()
  console.log(`[H.I.T.] LLM goal: "${raw}" → ${rawLower}`)

  const validGoals = ['content_creation', 'feedback', 'strategy', 'monetization', 'community', 'learning', 'general']

  let goal = validGoals.includes(rawLower) ? rawLower : null

  if (!goal) {
    for (const g of validGoals) {
      if (rawLower.includes(g)) { goal = g; break }
    }
  }

  if (!goal) goal = 'unknown'
  return { goal, confidence: goal === 'unknown' ? 0 : 0.8, method: 'llm' }
}

// ── Handler ──

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

  const hitEnabled = process.env.HIT_ENABLED === 'true' || process.env.VITE_HIT_ENABLED === 'true'
  if (!hitEnabled) {
    // Not enabled — forward directly to chat.mjs instead of returning empty
    console.log('[H.I.T.] Not enabled, forwarding to chat.mjs')
    const body = JSON.parse(event.body)
    try {
      const chatRes = await fetch(CHAT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': event.headers.authorization || '' },
        body: JSON.stringify(body)
      })
      const chatData = await chatRes.json()
      return {
        statusCode: chatRes.status,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type, Authorization' },
        body: JSON.stringify(chatData)
      }
    } catch (e) {
      return { statusCode: 500, body: JSON.stringify({ error: 'Chat forward failed: ' + e.message }) }
    }
  }

  try {
    const body = JSON.parse(event.body)
    const { message } = body
    const groqKey = process.env.GROQ_API_KEY

    // Plattform-Erkennung (instant, Keyword-basiert)
    const platformResult = classifyPlatform(message)

    console.log(`[H.I.T.] message: "${(message || '').substring(0, 80)}"`)
    console.log(`[H.I.T.] platform (keyword): ${platformResult.platform} (${Math.round(platformResult.confidence * 100)}%)`)

    // Parallele Ausführung: LLM Goal-Erkennung + Chat-Forward
    const [goalResult, chatResponse] = await Promise.all([
      classifyGoalWithLLM(message, groqKey).catch(err => {
        console.error('[H.I.T.] Goal classification failed:', err.message)
        return { goal: 'unknown', confidence: 0, method: 'llm_error' }
      }),
      fetch(CHAT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': event.headers.authorization || ''
        },
        body: JSON.stringify(body)
      }).catch(err => {
        console.error('[H.I.T.] Chat forward failed:', err.message)
        return null
      })
    ])

    // Ziel-Erkennung loggen
    console.log(`[H.I.T.] goal (llm): ${goalResult.goal} (${Math.round(goalResult.confidence * 100)}%) [${goalResult.method}]`)

    // Fallback: Wenn LLM kein Ziel erkennt, Keyword-basiert
    const finalGoal = goalResult.goal === 'unknown' || goalResult.confidence === 0
      ? classifyGoalWithKeywords(message)
      : goalResult

    if (finalGoal.method === 'keyword') {
      console.log(`[H.I.T.] goal (keyword fallback): ${finalGoal.goal} (${Math.round(finalGoal.confidence * 100)}%)`)
    }

    // Chat-Antwort verarbeiten
    if (!chatResponse) {
      return {
        statusCode: 502,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ error: 'Chat-Service nicht erreichbar' })
      }
    }

    const chatData = await chatResponse.json()

    return {
      statusCode: chatResponse.status,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({
        ...chatData,
        _hit: {
          enabled: true,
          platform: platformResult.platform,
          platformConfidence: Math.round(platformResult.confidence * 100),
          goal: finalGoal.goal,
          goalConfidence: Math.round(finalGoal.confidence * 100),
          goalMethod: finalGoal.method
        }
      })
    }
  } catch (error) {
    console.error('[H.I.T.] Error:', error.message)
    const chatResponse = await fetch(CHAT_URL, {
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
