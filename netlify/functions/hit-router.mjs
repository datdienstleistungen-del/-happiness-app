// ──────────────────────────────────────────────────────────────
// H.I.T. — Happiness Intelligence Team
// Layer 1: Hybrid Intent & Goal Recognition (nur Logging)
// Plattform: Keyword-Erkennung (schnell, zuverlässig)
// Ziel: LLM-Call via Groq (parallel, non-blocking)
// ──────────────────────────────────────────────────────────────

const SUPABASE_URL = 'https://irumowvmhvrofezwvnop.supabase.co'
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

const GOAL_PROMPT = `Du bist ein Intent-Klassifizierer. Analysiere die folgende Nutzernachricht und klassifiziere das Hauptziel in EINER dieser Kategorien:

- content_creation: Der Nutzer möchte Content erstellen (Post, Video, Text, etc.)
- feedback: Der Nutzer möchte Feedback oder eine Einschätzung zu etwas bekommen
- strategy: Der Nutzer möchte etwas optimieren, wachsen lassen, oder strategisch angehen
- monetization: Der Nutzer möchte Geld verdienen, verkaufen, oder Einnahmen generieren
- community: Der Nutzer möchte sich vernetzen, Leute kennenlernen, oder Community aufbauen
- learning: Der Nutzer möchte etwas lernen, verstehen, oder erklärt bekommen
- general: Kein spezifisches Ziel erkennbar (Begrüßung, Smalltalk, etc.)

Antworte NUR mit dem Kategorienamen, nichts anders. Kein Text, keine Erklärung.`

async function classifyGoalWithLLM(message, groqKey) {
    if (!groqKey || !message) {
      console.log(`[H.I.T.] LLM goal skip: groqKey=${groqKey ? 'set' : 'missing'}, message=${message ? 'set' : 'missing'}`)
      return { goal: 'unknown', confidence: 0, method: 'none' }
    }

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 5000)

    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${groqKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'openai/gpt-oss-20b',
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

    if (!res.ok) {
      console.warn(`[H.I.T.] LLM goal call failed: HTTP ${res.status}`)
      return { goal: 'unknown', confidence: 0, method: 'llm_error' }
    }

    const data = await res.json()
    const raw = (data.choices?.[0]?.message?.content || '').trim()
    const rawLower = raw.toLowerCase().replace(/[`*_#\-]/g, '').trim()

    console.log(`[H.I.T.] LLM raw response: "${raw}" | cleaned: "${rawLower}"`)
    console.log(`[H.I.T.] LLM raw charCodes: [${[...raw].map(c => c.charCodeAt(0)).join(',')}]`)

    const validGoals = ['content_creation', 'feedback', 'strategy', 'monetization', 'community', 'learning', 'general']

    // Exakter Match
    let goal = validGoals.includes(rawLower) ? rawLower : null

    // Fuzzy: Enthält das Zielwort irgendwo in der Antwort?
    if (!goal) {
      for (const g of validGoals) {
        if (rawLower.includes(g)) { goal = g; break }
      }
    }

    // Fuzzy: Deutsche Begriffe als Fallback
    if (!goal) {
      const germanMap = {
        content_creation: ['erstellen', 'posten', 'content', 'text', 'caption', 'skript', 'idee', 'entwurf', 'veröffentlichen'],
        feedback: ['feedback', 'review', 'kritik', 'meinung', 'einschätzung', 'bewertung'],
        strategy: ['strategie', 'optimieren', 'wachstum', 'reichweite', 'zielgruppe', 'plan', 'positionierung', 'aufbau'],
        monetization: ['geld', 'verdienen', 'einnahmen', 'umsatz', 'monetarisierung', 'verkaufen', 'preis'],
        community: ['community', 'vernetzen', 'netzwerk', 'zusammenhalt', 'gruppe', 'freunde'],
        learning: ['lernen', 'verstehen', 'erklär', 'tutorial', 'anleitung', 'hilfe', 'wie funktioniert']
      }
      for (const [g, words] of Object.entries(germanMap)) {
        if (words.some(w => rawLower.includes(w))) { goal = g; break }
      }
    }

    if (!goal) goal = 'unknown'
    return { goal, confidence: goal === 'unknown' ? 0 : 0.8, method: 'llm', raw: raw.substring(0, 100) }
  } catch (err) {
    if (err.name === 'AbortError') {
      console.warn('[H.I.T.] LLM goal call timed out (5s)')
    } else {
      console.warn('[H.I.T.] LLM goal call error:', err.message)
    }
    return { goal: 'unknown', confidence: 0, method: 'llm_error' }
  }
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

  const hitEnabled = process.env.HIT_ENABLED === 'true'
  if (!hitEnabled) {
    return { statusCode: 200, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify({ hit: false }) }
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
          goal: goalResult.goal,
          goalConfidence: Math.round(goalResult.confidence * 100),
          goalMethod: goalResult.method,
          llmRaw: goalResult.raw || null
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
