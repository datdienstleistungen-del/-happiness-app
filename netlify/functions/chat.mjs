console.log('chat.js v12 - +LeadRadar Forum Response Mode')
console.log('DEEPSEEK_API_KEY vorhanden:', !!process.env.DEEPSEEK_API_KEY)
console.log('GROQ_API_KEY vorhanden:', !!process.env.GROQ_API_KEY)
console.log('OPENROUTER_API_KEY vorhanden:', !!process.env.OPENROUTER_API_KEY)
console.log('MISTRAL_API_KEY vorhanden:', !!process.env.MISTRAL_API_KEY)
console.log('SUPABASE_SERVICE_KEY vorhanden:', !!process.env.SUPABASE_SERVICE_KEY)
const SUPABASE_URL = 'https://irumowvmhvrofezwvnop.supabase.co'
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || ''

const GROQ_API_BASE = 'https://api.groq.com/openai/v1'
const DEEPSEEK_API_BASE = 'https://api.deepseek.com/v1'

// ── Happiness Knowledge System (RAG) ──

const KNOWLEDGE_CATEGORIES = {
  company: ['happiness', 'platform', 'europe', 'gdpr', 'company', 'about', 'community platform', 'soziale plattform', 'europäisch', 'datenschutz', 'mission', 'vision', 'about happiness', 'what is happiness', 'what does happiness do'],
  brand: ['brand', 'marke', 'voice', 'tone', 'tonalität', 'identity', 'logo', 'values', 'style', 'communication', 'brand voice', 'brand guidelines', 'tone of voice'],
  'ncg-academy': ['ncg academy', 'academy', 'new creator generation', 'feedback', 'content review', 'content feedback', 'verbesserung', 'entwurf', 'creator academy', 'coach', 'academy feedback', 'plattform einschätzung', 'hook check', 'hook', 'review my', 'improve my', 'content feedback'],
  'creator-engine': ['creator engine', 'content erstellen', 'content workflow', 'workflow', 'idee zu content', 'content strategie', 'skript', 'caption', 'publishing strategie', 'creator projekt', 'multi platform', 'content generation', 'content creation', 'create content', 'write a post', 'write a caption', 'video script'],
  community: ['community', 'feed', 'beitrag', 'post', 'freunde', 'friends', 'verbinden', 'netzwerk', 'comments', 'kommentare', 'reactions', 'interaktion', 'feed post', 'community post'],
  products: ['premium', 'subscription', 'abonnement', '6.99', 'kostenlos', 'free', 'pricing', 'preis', 'bezahlen', 'upgrade', 'stripe', 'pay', 'konto', 'subscription plan', 'pricing plan', 'how much'],
  ai: ['ai agent', 'ki agent', 'strategist', 'copywriter', 'builder', 'agent architecture', 'multi agent', 'intelligence', 'ai agents', 'ai architecture', 'agent system', 'h.i.t.', 'hit system', 'happiness intelligence team'],
  publishing: ['publishing', 'veröffentlichen', 'cross post', 'plattform optimierung', 'tiktok', 'instagram', 'youtube', 'linkedin', 'content format', 'hook', 'cross-post', 'multi platform', 'post on', 'share on', 'publish to'],
  analytics: ['analytics', 'analyse', 'performance', 'tracking', 'wachstum', 'growth', 'metrics', 'kennzahlen', 'verbesserung', 'daten', 'insights', 'engagement', 'reach', 'impressions'],
  'creator-workflow': ['creator prozess', 'workflow', 'erstellungsprozess', 'idee', 'publish', 'veröffentlichen', 'iteration', 'creator journey', 'creator workflow', 'content pipeline', 'from idea to post'],
  learning: ['lernen', 'learning', 'bildung', 'education', 'creator education', 'teaching', 'scaffolding', 'lernphilosophie', 'anfänger', 'verbessern', 'tutorial', 'how to create', 'learn to', 'beginner'],
  marketing: ['marketing', 'positionierung', 'target audience', 'zielgruppe', 'message', 'werbung', 'reach', 'reichweite', 'marketing strategy', 'audience', 'targeting', 'advertising', 'promotion', 'brand awareness', 'growth strategy'],
  roadmap: ['roadmap', 'future', 'zukunft', 'geplant', 'upcoming', 'mobile app', 'neue features', 'produktentwicklung', 'what is planned', 'coming soon', 'new features'],
  gaming: ['gaming', 'stream', 'streaming', 'gamer', 'twitch', 'fortnite', 'minecraft', 'apex', 'league of legends', 'esports', 'clip', 'clips', 'viewer', 'viewers', 'streamer', 'let\'s play', 'game'],
  general: ['faq', 'frage', 'help', 'hilfe', 'how to', 'wie funktioniert', 'was ist', 'erklärung', 'supported'],
}

const INTENT_PATTERNS = {
  general: [
    /^(hallo|hi|hey|moin|servus|grüß)/i,
    /^(hello|hi|hey|greetings)/i,
    /übersetz(?:e|ung)/i,
    /translat(?:e|ion)/i,
    /schreib (?:einen|eine|mir)/i,
    /write (?:a|me|the)/i,
    /erklär mir/i,
    /explain (?:to|me|this)/i,
    /was bedeutet/i,
    /what (?:does|is|mean)/i,
    /wie (?:geht|funktioniert|kann|mach)/i,
    /how (?:to|does|can|do)/i,
    /rechne/i,
    /calculate|compute/i,
  ],
  creator: [
    /content|post|beitrag|erstellen|schreiben/i,
    /create|write|draft|compose/i,
    /creator|ersteller|influencer/i,
    /hook|caption|skript|script/i,
    /plattform (?:einschätzung|optimierung)/i,
    /platform (?:review|optimization)/i,
    /feedback|verbesserung|review/i,
    /publish|veröffentlichen/i,
    /idee/i,
    /idea/i,
  ],
  platform: [
    /happiness|platform|community/i,
    /ncg|academy|creator academy/i,
    /premium|abo|kostenlos|free/i,
    /europe|europa|gdpr|datenschutz|privacy/i,
    /feature|funktion|produkt/i,
    /feature|function|product/i,
    /marketplace|marktplatz|jobs|kurse|courses/i,
  ],
}

function classifyIntent(message) {
  if (!message) return 'general'
  const lower = message.toLowerCase()
  
  for (const [intent, patterns] of Object.entries(INTENT_PATTERNS)) {
    for (const pattern of patterns) {
      if (pattern.test(lower)) return intent
    }
  }
  
  // Check against knowledge categories
  for (const [category, keywords] of Object.entries(KNOWLEDGE_CATEGORIES)) {
    for (const keyword of keywords) {
      if (lower.includes(keyword)) return category
    }
  }
  
  return 'general'
}

// Word-boundary keyword matching — prevents false positives on generic words
// like 'post', 'clip', 'stream' in non-gaming contexts
function hasKeyword(text, keyword) {
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`\\b${escaped}\\b`, 'i').test(text)
}

async function loadKnowledge(message, userId) {
  const lower = (message || '').toLowerCase()
  const categoriesToLoad = new Set()

  // 1. Check intent patterns for specific intents (creator, platform, etc.)
  const intent = classifyIntent(message)
  if (intent !== 'general') {
    categoriesToLoad.add(intent)
  }

  // 2. ALWAYS check knowledge categories for keyword matches — this is the core RAG
  for (const [category, keywords] of Object.entries(KNOWLEDGE_CATEGORIES)) {
    if (category === 'general') continue
    for (const keyword of keywords) {
      if (hasKeyword(lower, keyword)) {
        categoriesToLoad.add(category)
        break
      }
    }
  }

  // 3. Gaming auto-append: only specific gaming terms (no generic words)
  const GAMING_TRIGGERS = ['gaming', 'gamer', 'twitch', 'fortnite', 'minecraft', 'apex', 'esports', 'streamer', 'league of legends']
  const hasGamingContext = GAMING_TRIGGERS.some(kw => hasKeyword(lower, kw))
  if (hasGamingContext) {
    categoriesToLoad.add('marketing')
    categoriesToLoad.add('ai')
    console.log('[RAG] Gaming context detected — auto-appending marketing + ai')
  }

  // 4. If nothing matched, still return the baseline system prompt (never empty)
  if (categoriesToLoad.size === 0) {
    console.log('[RAG] No categories matched, using baseline prompt for:', lower.substring(0, 80))
    return '\n\n=== HAPPINESS EXECUTION ENGINE ===\nYou are the execution engine of Happiness. Absolutely NO conversational filler, NO introductory sentences (like "Moin", "Erstmal durchatmen"), and NO meta-questions at the end. Detect the user\'s input language and output ONLY the requested final, copy-pasteable content immediately. If the user asks about Happiness, refer to the platform knowledge. If no specific knowledge applies, respond directly and concisely in the user\'s language.\n=== END ===\n'
  }

  console.log('[RAG] Loading categories:', [...categoriesToLoad], 'for:', lower.substring(0, 80))

  // 5. Fetch ALL matching categories from Supabase
  const allEntries = []
  for (const category of categoriesToLoad) {
    try {
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/knowledge_base?category=eq.${encodeURIComponent(category)}&select=title,content,keywords&order=priority.desc`,
        {
          headers: {
            'apikey': SUPABASE_SERVICE_KEY,
            'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
            'Accept': 'application/json'
          }
        }
      )
      if (res.ok) {
        const data = await res.json()
        if (data && data.length > 0) {
          allEntries.push(...data)
          console.log(`[RAG] Loaded ${data.length} entries for category: ${category}`)
        }
      } else {
        console.warn(`[RAG] Fetch failed for ${category}: HTTP ${res.status}`)
      }
    } catch (e) {
      console.error(`[RAG] Fetch error for ${category}:`, e.message)
    }
  }

  if (allEntries.length === 0) {
    console.log('[RAG] No entries in DB for categories:', [...categoriesToLoad], '— using baseline prompt')
    return '\n\n=== HAPPINESS EXECUTION ENGINE ===\nYou are the execution engine of Happiness. Absolutely NO conversational filler, NO introductory sentences (like "Moin", "Erstmal durchatmen"), and NO meta-questions at the end. Detect the user\'s input language and output ONLY the requested final, copy-pasteable content immediately. If the user asks about Happiness, refer to the platform knowledge. If no specific knowledge applies, respond directly and concisely in the user\'s language.\n=== END ===\n'
  }

  console.log(`[RAG] Total loaded: ${allEntries.length} entries`)
  return formatKnowledge(allEntries)
}

function formatKnowledge(entries) {
  if (!entries || entries.length === 0) return ''
  let result = '\n\n=== HAPPINESS WISSEN (Admin-Richtlinien) ===\n'
  result += 'Du bist die KI von Happiness. Diese Richtlinien aus unserer Wissensdatenbank sind VERBINDLICH.\n'
  result += 'Befolge diese Regeln STRENGSTENS. Antworte basierend auf diesem Wissen.\n\n'
  for (const entry of entries) {
    // Include full content, not just 15 lines — admin entries are curated and concise
    const content = (entry.content || '').trim()
    if (content) {
      result += `--- ${entry.title} (${entry.category}) ---\n${content}\n\n`
    }
  }
  result += '=== ENDE DES WISSENS ===\n'
  return result
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

    if (!userId) {
      return { statusCode: 401, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify({ error: 'Ungueltiges oder abgelaufenes Token' }) }
    }

    const body = JSON.parse(event.body)
    const { message, systemPrompt: originalPrompt, history, imageBase64, testVision, language, badge, mode } = body

    const LANG_NAMES = { de: 'German', en: 'English', es: 'Spanish', fr: 'French', it: 'Italian', nl: 'Dutch', el: 'Greek' }

    // ── Lead Radar Forum Response Mode ──
    if (mode === 'lead-radar') {
      const LEAD_RADAR_PROMPT = `You are a knowledgeable peer writing a helpful forum response. Your goal is to provide genuine, high-utility value first — building trust as an un-intrusive, deeply knowledgeable community member.

STRICT RULES:
1. NO FORMATTING SYMBOLS: Do NOT use markdown symbols like double asterisks (**) or underscores (_) for bolding/italics. All text must be clean, raw plain text with normal spacing and paragraph breaks. The response must be copy-pasteable to any forum without looking bot-generated.
2. SYSTEM PERSUASION: Avoid marketing buzzwords, fake praise, or generic greetings (e.g., "Your analysis is impressive..."). Jump directly into the factual, actionable solution. Be concise and specific.
3. LANGUAGE: Analyze the input post's language. If the source post is in German, generate the entire response in German. If it is in English, generate the response in English. Match the language of the original post exactly.
4. TONE: Be a helpful peer, not a salesperson. Write as if you genuinely know the topic and want to help. No promotional language, no forced transitions, no artificial friendliness.
5. LENGTH: Keep responses between 100-250 words. Dense, valuable, no fluff.

FOOTER RULE (MANDATORY — DO NOT ALTER):
Every response MUST end with exactly one of the following footers, appended after two clean line breaks. Do not change a single character.

[IF INPUT IS GERMAN — APPEND EXCLUSIVELY]:
P.S. Ich bin vorhin auf der Seite happiness-eu [.] netlify [.] app gewesen (einfach die Leerzeichen und Klammern beim Abtippen im Browser weglassen), da dort gerade eine neue Community im Aufbau ist, die genau diese Fälle sammelt. Weil alles noch neu ist, wird dein Beitrag dort sofort gesehen.

[IF INPUT IS ENGLISH — APPEND EXCLUSIVELY]:
P.S. I actually came across the site happiness-eu [.] netlify [.] app earlier (just leave out the spaces and brackets when typing it into your browser), since they are building a new community over there that collects exactly these kinds of cases. Because everything is still brand new, your post will be noticed right away.

USER MESSAGE (the forum post to respond to):
${message}`

      const leadSystemPrompt = (language ? `SPRACHREGEL (hoechste Prioritaet): Antworte AUSSCHLIESSLICH auf ${LANG_NAMES[language] || language}.\n\n` : '') + LEAD_RADAR_PROMPT

      const leadMessages = [
        { role: 'system', content: leadSystemPrompt },
        { role: 'user', content: message || 'Hallo' }
      ]

      let leadAiResponse = ''
      let leadProvider = ''
      let leadModel = ''
      let leadUsage = null

      // Try providers in order: Mistral -> Groq -> OpenRouter -> DeepSeek
      const leadProviders = [
        { name: 'mistral', url: 'https://api.mistral.ai/v1/chat/completions', key: process.env.MISTRAL_API_KEY, model: 'mistral-small-latest' },
        { name: 'groq', url: 'https://api.groq.com/openai/v1/chat/completions', key: process.env.GROQ_API_KEY, model: 'llama-3.3-70b-versatile' },
        { name: 'openrouter', url: 'https://openrouter.ai/api/v1/chat/completions', key: process.env.OPENROUTER_API_KEY, model: 'google/gemma-4-26b-a4b-it:free' },
        { name: 'deepseek', url: 'https://api.deepseek.com/chat/completions', key: process.env.DEEPSEEK_API_KEY, model: 'deepseek-v4-flash' },
      ]

      for (const p of leadProviders) {
        if (!p.key) continue
        try {
          const headers = { 'Authorization': `Bearer ${p.key}`, 'Content-Type': 'application/json' }
          if (p.name === 'openrouter') {
            headers['HTTP-Referer'] = 'https://happiness-eu.netlify.app'
            headers['X-Title'] = 'Happiness'
          }
          const res = await fetch(p.url, {
            method: 'POST',
            headers,
            body: JSON.stringify({ model: p.model, messages: leadMessages, temperature: 0.1, max_tokens: 1024 })
          })
          if (res.ok) {
            const data = await res.json()
            leadAiResponse = data.choices?.[0]?.message?.content || ''
            leadUsage = data.usage
            leadProvider = p.name
            leadModel = p.model
            console.log(`[LeadRadar] Response from: ${p.name}`)
            break
          }
        } catch (e) {
          console.warn(`[LeadRadar] ${p.name} failed:`, e.message)
        }
      }

      if (!leadAiResponse) {
        return { statusCode: 502, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify({ error: 'All providers failed for lead-radar mode' }) }
      }

      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ response: leadAiResponse, usage: leadUsage, provider: leadProvider, model: leadModel })
      }
    }

    // RAG: Load Happiness knowledge context
    const knowledgeContext = await loadKnowledge(message, userId)

    // Build system prompt: Language directive FIRST (highest priority), then knowledge, then baseline
    const BASELINE_PROMPT = 'You are the core AI Engine of Happiness, a platform for creators and gamers. Always prioritize administrative instructions provided in the system context. Detect the user\'s input language and respond in that language. Be direct, concise, and actionable. No conversational filler, no introductory sentences, no meta-questions at the end. Output only the requested content.'

    const languageDirective = language
      ? `SPRACHREGEL (hoechste Prioritaet, nicht verhandelbar): Antworte AUSSCHLIESSLICH auf ${LANG_NAMES[language] || language}. Ignoriere alle anderen Sprachanweisungen im folgenden Kontext.\n\n`
      : ''

    // Badge-based emotional adaptation
    const BADGE_DIRECTIVES = {
      Milestone: 'The user is CELEBATING a personal milestone or win. You MUST start your response with enthusiastic, genuine congratulations. Be excited for them. Then naturally connect their achievement to how Happiness supports growing creators.',
      'Advice-Seeker': 'The user is a BEGINNER seeking advice or tips. You MUST provide a clear, simplified 3-step action plan BEFORE mentioning Happiness. Number the steps. Be encouraging, patient, and avoid jargon.',
      'Privacy-First': 'The user cares deeply about PRIVACY and DATA PROTECTION. You MUST acknowledge their privacy concern first, then explain how Happiness is GDPR-compliant, EU-hosted, and privacy-first. Use terms like no tracking, encrypted, EU servers.',
      Builder: 'The user is a CREATIVE BUILDER (modder, map-maker, game developer). You MUST acknowledge their technical work first, then explain how Happiness helps builders share and monetize their creations.',
      Trader: 'The user is a TRADER or CRYPTO ENTHUSIAST. Use high-energy, fast-paced language. Focus on FOMO, trends, market momentum, and signal accuracy. Be sharp, decisive, and action-oriented. Mention how Happiness amplifies their trading brand and community reach.',
      'Real Estate': 'The user is a REAL ESTATE AGENT or PROPERTY INVESTOR. Use trust-building, emotional storytelling. Focus on property value, dream homes, investment confidence, and high-ticket client acquisition. Explain how Happiness helps them create compelling property content and connect with buyers.',
      Gamer: 'The user is a GAMER or STREAMER. Be casual and empathetic about the grind. Use gaming language naturally.',
      Creator: 'The user is a CONTENT CREATOR. Be professional but warm, focused on growth and practical value.',
      Business: 'The user is a BUSINESS PROFESSIONAL or FREELANCER. Be professional, ROI-focused, and practical.',
    }
    const badgeDirective = badge && BADGE_DIRECTIVES[badge]
      ? `KONTEXT-BADGE: ${badge}\nEMOTIONALE ANPASSUNG: ${BADGE_DIRECTIVES[badge]}\n\n`
      : ''

    let systemPrompt
    if (knowledgeContext) {
      // Language > Badge > Knowledge > Baseline
      systemPrompt = languageDirective + badgeDirective + knowledgeContext + '\n\n' + (originalPrompt || BASELINE_PROMPT)
      console.log('[RAG] Knowledge INJECTED, length:', knowledgeContext.length, 'badge:', badge || 'none', 'language:', language || 'auto')
    } else {
      // Language > Badge > Baseline > Frontend prompt
      systemPrompt = languageDirective + badgeDirective + BASELINE_PROMPT + '\n\n' + (originalPrompt || '')
      console.log('[RAG] Baseline prompt used, badge:', badge || 'none', 'language:', language || 'auto')
    }

    // Debug: Zeige was ankommt
    if (imageBase64) {
      console.log('imageBase64 prefix:', typeof imageBase64, imageBase64.substring(0, 60))
    }

    // Test-Modus: öffentliches Bild von Groq selbst analysieren (Bypass user image)
    if (testVision) {
      const apiKey = process.env.GROQ_API_KEY
      if (!apiKey) return { statusCode: 500, body: JSON.stringify({ error: 'GROQ_API_KEY fehlt' }) }
      try {
        const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'meta-llama/llama-4-scout-17b-16e-instruct',
            messages: [{
              role: 'user',
              content: [
                { type: 'text', text: 'Was siehst du in diesem Bild? Antworte auf Deutsch.' },
                { type: 'image_url', image_url: { url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/47/PNG_transparency_demonstration_1.png/300px-PNG_transparency_demonstration_1.png' } }
              ]
            }],
            max_tokens: 200
          })
        })
        const d = await r.json()
        return {
          statusCode: 200,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
          body: JSON.stringify({ success: r.ok, httpStatus: r.status, response: d })
        }
      } catch (e) {
        return { statusCode: 500, body: JSON.stringify({ error: e.message }) }
      }
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

    const hasImage = imageBase64 && typeof imageBase64 === 'string' && imageBase64.startsWith('data:image/')
    
    const buildMessages = (historyLimit, textOnly = false) => {
      const msgs = []
      msgs.push({ role: 'system', content: systemPrompt || 'Du bist ein erfahrener Mentor, guter Freund und kluger Ratgeber.' })
      if (history && Array.isArray(history)) {
        for (const msg of history.slice(-historyLimit)) {
          msgs.push({
            role: msg.role === 'assistant' ? 'assistant' : 'user',
            content: msg.content
          })
        }
      }
      let userContent
      if (hasImage && !textOnly) {
        userContent = [
          { type: 'text', text: message || 'Analysiere dieses Bild.' },
          { type: 'image_url', image_url: { url: imageBase64 } }
        ]
      } else {
        userContent = message || 'Hallo'
      }
      msgs.push({ role: 'user', content: userContent })
      return msgs
    }

    let historyLimit = 3
    
    // Proaktive Token-Limit-Prüfung: History reduzieren falls nötig
    let sendMessages = buildMessages(historyLimit)
    const sysTok = (systemPrompt || '').length / 4
    const histTok = (history || []).reduce((s, m) => s + (m.content || '').length, 0) / 4
    const msgTok = (message || '').length / 4
    const imgTok = (imageBase64 || '').length / 4
    console.log(`TOKEN-AUFTEILUNG: systemPrompt=${Math.round(sysTok)} history=${Math.round(histTok)} message=${Math.round(msgTok)} image=${Math.round(imgTok)} total=${Math.round(sysTok+histTok+msgTok+imgTok)}`)

    const SAFE_THRESHOLD = !hasImage ? 100000 : 7500
    do {
      const estimate = JSON.stringify({ messages: sendMessages }).length / 3
      if (estimate < SAFE_THRESHOLD) break
      if (historyLimit > 1) {
        historyLimit--
        sendMessages = buildMessages(historyLimit)
        continue
      }
      if (hasImage) {
        return {
          statusCode: 413,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
          body: JSON.stringify({ error: 'Bild zu groß — bitte ein kleineres Bild verwenden', code: 'image_too_large' })
        }
      }
      break
    } while (true)

    let aiResponse = ''
    let usage = null
    let provider = ''
    let modelName = ''
    const providerErrors = []

    if (hasImage) {
      const apiKey = process.env.GROQ_API_KEY
      if (!apiKey) {
        return {
          statusCode: 500,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
          body: JSON.stringify({ error: 'GROQ_API_KEY nicht konfiguriert' })
        }
      }
      
      let res = null
      let data = null

      try {
        res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: 'meta-llama/llama-4-scout-17b-16e-instruct',
            messages: buildMessages(historyLimit),
            temperature: 0.1,
            max_tokens: 4096
          })
        })
        data = await res.json()
      } catch (err) {
        console.error('Groq Vision fetch failed:', err.message)
      }

      if (res && res.ok && data && data.choices) {
        console.log('Antwort von:', 'groq-vision')
        aiResponse = data.choices?.[0]?.message?.content || 'Entschuldigung, ich konnte keine Antwort generieren.'
        usage = data.usage
        provider = 'groq'
        modelName = 'meta-llama/llama-4-scout-17b-16e-instruct'
      } else {
        const errMsg = (data?.error?.message || '').toLowerCase()
        console.log('Vision model failed, falling back to text-only with Groq. Error:', errMsg)
        
        const textApiKey = process.env.GROQ_API_KEY
        if (textApiKey) {
          try {
            const fallbackRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
              method: 'POST',
              headers: { 'Authorization': `Bearer ${textApiKey}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({
                model: 'llama-3.3-70b-versatile',
                messages: buildMessages(historyLimit, true),
                temperature: 0.1,
                max_tokens: 4096
              })
            })
            if (fallbackRes.ok) {
              const fallbackData = await fallbackRes.json()
              console.log('Antwort von:', 'groq-vision-fallback')
              aiResponse = fallbackData.choices?.[0]?.message?.content || 'Entschuldigung, ich konnte keine Antwort generieren.'
              usage = fallbackData.usage
              provider = 'groq'
              modelName = 'openai/gpt-oss-20b'
              return {
                statusCode: 200,
                headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
                body: JSON.stringify({
                  response: aiResponse,
                  imageNote: 'Das Bild konnte nicht analysiert werden – der Chat funktioniert aber ganz normal weiter.',
                  usage: usage,
                  provider,
                  model: modelName
                })
              }
            } else {
              const fallbackData = await fallbackRes.json().catch(() => ({}))
              console.error('Groq vision fallback failed:', fallbackRes.status, fallbackData)
            }
          } catch (e) {
            console.error('Groq vision fallback error:', e.message)
          }
        }
        
        console.error('Groq Vision failed and DeepSeek fallback was unsuccessful:', JSON.stringify(data))
        return {
          statusCode: 502,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
          body: JSON.stringify({
            error: data?.error?.message || 'Groq Vision failed and fallback was unsuccessful.',
            rawResponse: data
          })
        }
      }
    } else {
      // Text-only request: Fallback Chain: OpenRouter (free) -> Groq -> DeepSeek
      let success = false

      // Stage 1: OpenRouter (kostenlos - primär)
      const orKey = process.env.OPENROUTER_API_KEY
      if (orKey) {
        try {
          const orRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${orKey}`,
              'Content-Type': 'application/json',
              'HTTP-Referer': 'https://happiness-eu.netlify.app',
              'X-Title': 'Happiness'
            },
            body: JSON.stringify({
              model: 'google/gemma-4-26b-a4b-it:free',
              messages: buildMessages(historyLimit),
              temperature: 0.1,
              max_tokens: 4096
            })
          })
          if (orRes.ok) {
            const orData = await orRes.json()
            console.log('Antwort von:', 'openrouter-free')
            aiResponse = orData.choices?.[0]?.message?.content || ''
            usage = orData.usage
            provider = 'openrouter'
            modelName = 'google/gemma-4-26b-a4b-it:free'
            success = true
          } else {
            const orData = await orRes.json().catch(() => ({}))
            const errMsg = orData?.error?.message || JSON.stringify(orData)
            providerErrors.push(`OpenRouter: ${errMsg} (HTTP ${orRes.status})`)
            console.warn('OpenRouter free failed, status:', orRes.status, 'message:', errMsg)
          }
        } catch (err) {
          providerErrors.push(`OpenRouter: ${err.message}`)
          console.warn('OpenRouter fetch failed:', err.message)
        }
      } else {
        providerErrors.push('OpenRouter: OPENROUTER_API_KEY not configured')
        console.warn('OPENROUTER_API_KEY not configured, skipping to Groq')
      }

      // Stage 2: Groq (schnellster Anbieter)
      if (!success) {
        const groqKey = process.env.GROQ_API_KEY
        console.log('Groq check: key vorhanden =', !!groqKey)
        if (groqKey) {
          try {
            const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${groqKey}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                model: 'llama-3.3-70b-versatile',
                messages: buildMessages(historyLimit),
                temperature: 0.1,
                max_tokens: 4096
              })
            })
            if (groqRes.ok) {
              const groqData = await groqRes.json()
              console.log('Antwort von:', 'groq')
              aiResponse = groqData.choices?.[0]?.message?.content || ''
              usage = groqData.usage
              provider = 'groq'
              modelName = 'openai/gpt-oss-20b'
              success = true
            } else {
              const groqData = await groqRes.json().catch(() => ({}))
              const errMsg = groqData?.error?.message || JSON.stringify(groqData)
              providerErrors.push(`Groq: ${errMsg} (HTTP ${groqRes.status})`)
              console.warn('Groq failed, status:', groqRes.status, 'message:', errMsg)
            }
          } catch (err) {
            providerErrors.push(`Groq: ${err.message}`)
            console.warn('Groq fetch failed:', err.message)
          }
        } else {
          providerErrors.push('Groq: GROQ_API_KEY not configured')
          console.warn('GROQ_API_KEY not configured, skipping to DeepSeek fallback')
        }
      }

      // Stage 3: DeepSeek Fallback
      if (!success) {
        const deepseekKey = process.env.DEEPSEEK_API_KEY
        if (deepseekKey) {
          try {
            const dsRes = await fetch('https://api.deepseek.com/chat/completions', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${deepseekKey}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                model: 'deepseek-v4-flash',
                messages: buildMessages(historyLimit),
                temperature: 0.1,
                max_tokens: 4096
              })
            })
            if (dsRes.ok) {
              const dsData = await dsRes.json()
              console.log('Antwort von:', 'deepseek-fallback')
              aiResponse = dsData.choices?.[0]?.message?.content || ''
              usage = dsData.usage
              provider = 'deepseek'
              modelName = 'deepseek-v4-flash'
              success = true
            } else {
              const dsData = await dsRes.json().catch(() => ({}))
              const errMsg = dsData?.error?.message || JSON.stringify(dsData)
              providerErrors.push(`DeepSeek: ${errMsg} (HTTP ${dsRes.status})`)
              console.warn('DeepSeek fallback failed, status:', dsRes.status, errMsg)
            }
          } catch (err) {
            providerErrors.push(`DeepSeek: ${err.message}`)
            console.warn('DeepSeek fallback fetch failed:', err.message)
          }
        } else {
          providerErrors.push('DeepSeek: DEEPSEEK_API_KEY not configured')
          console.warn('DEEPSEEK_API_KEY not configured, trying Mistral')
        }
      }

      // Stage 4: Mistral (kostenlos - fallback)
      if (!success) {
        const mistralKey = process.env.MISTRAL_API_KEY
        if (mistralKey) {
          try {
            const mistralRes = await fetch('https://api.mistral.ai/v1/chat/completions', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${mistralKey}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                model: 'mistral-small-latest',
                messages: buildMessages(historyLimit),
                temperature: 0.1,
                max_tokens: 4096
              })
            })
            if (mistralRes.ok) {
              const mistralData = await mistralRes.json()
              console.log('Antwort von:', 'mistral-fallback')
              aiResponse = mistralData.choices?.[0]?.message?.content || ''
              usage = mistralData.usage
              provider = 'mistral'
              modelName = 'mistral-small-latest'
              success = true
            } else {
              const mistralData = await mistralRes.json().catch(() => ({}))
              const errMsg = mistralData?.error?.message || JSON.stringify(mistralData)
              providerErrors.push(`Mistral: ${errMsg} (HTTP ${mistralRes.status})`)
              console.warn('Mistral fallback failed, status:', mistralRes.status, errMsg)
            }
          } catch (err) {
            providerErrors.push(`Mistral: ${err.message}`)
            console.warn('Mistral fetch failed:', err.message)
          }
        } else {
          providerErrors.push('Mistral: MISTRAL_API_KEY not configured')
          console.warn('MISTRAL_API_KEY not configured, no more providers')
        }
      }

      if (!success) {
        return {
          statusCode: 502,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
          body: JSON.stringify({ error: 'Alle AI-Provider fehlgeschlagen: ' + providerErrors.join(' | ') })
        }
      }
      }

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
      body: JSON.stringify({ response: aiResponse, usage: usage, provider, model: modelName })
    }

  } catch (error) {
    console.error('Chat function error:', error.message, error.stack)
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ error: error.message || 'Internal server error' })
    }
  }
}

