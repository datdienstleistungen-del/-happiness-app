import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_KEY
const supabase = createClient(supabaseUrl, supabaseKey)

const GROQ_API_KEY = process.env.GROQ_API_KEY
const MISTRAL_API_KEY = process.env.MISTRAL_API_KEY
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY

const CORS_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization'
}

function buildSystemPrompt(hookRules, ideaText, contentGoal) {
  const rulesList = hookRules
    .map((r, i) => `${i + 1}. [${r.severity === 'critical' ? 'KRITISCH' : 'MODERAT'}] ${r.rule_text}`)
    .join('\n')

  const goalHint = contentGoal
    ? `\nDas User gewünschte Genre/Format: ${contentGoal}`
    : ''

  return `Du bewertest eine Content-Idee für Kurzvideos. Deine Aufgabe ist ein EHRLICHES, begründetes Urteil - kein reflexhaftes Lob, keine Zustimmung aus Höflichkeit.

VERBOTEN als Einstieg oder Formulierung, außer wenn Punkt 1+2 unten es tatsächlich hergeben:
"Spannende Idee!", "Das hat Potenzial!", "Coole Idee, aber..." und vergleichbare Lob-Floskeln vor der eigentlichen Analyse.

Prüfe die Idee gegen genau diese Kriterien, in dieser Reihenfolge:

1. HOOK-RULES:
${rulesList}
   Prüfe explizit, welche Regeln die Idee erfüllt und welche sie bricht.

2. FORMAT-SÄTTIGUNG: Ist dieses Konzept/dieser Twist in Kurzvideos bereits stark verbreitet und ausgelutscht? Nenne konkret, welches Format/Meme/Trend die Idee wiederholt, falls zutreffend.

3. MACHBARKEIT: Lässt sich die Idee realistisch mit einem gefundenen Stock-Video umsetzen (Video-Finder), oder braucht es zwingend einen Eigendreh? Falls Eigendreh nötig: was genau müsste gefilmt werden (wie viele Personen, welche Umgebung, welche Requisiten)?${goalHint}

Antworte NUR in diesem Format, kein Fließtext davor oder danach:

Urteil: [Trägt so wie es ist / Braucht Rework / Funktioniert nicht]
Begründung: [konkret, unter Bezug auf die gebrochenen/erfüllten Hook-Rules und die Sättigungs-Einschätzung, 2-4 Sätze]
Machbarkeit: [Video-Finder realistisch / Eigendreh nötig, dann was gebraucht wird]
Empfehlung: [NUR wenn Urteil = "Braucht Rework": ein einziger konkreter Dreh, der das Kernproblem löst. NUR wenn Urteil = "Funktioniert nicht": der eine Hauptgrund, ohne Beschönigung, ohne Trostpflaster-Sätze danach]

Regel für "Funktioniert nicht": Kein Trostpflaster-Satz danach wie "aber probier's trotzdem" oder "vielleicht klappt's ja doch". Ein klares Urteil bleibt klar. Wenn die Idee wirklich nichts taugt, sag das so.`
}

function parseVerdict(text) {
  const lines = text.trim().split('\n')
  const result = { verdict: '', justification: '', feasibility: '', recommendation: '' }

  for (const line of lines) {
    const trimmed = line.trim()
    if (trimmed.startsWith('Urteil:')) {
      const val = trimmed.replace('Urteil:', '').trim()
      if (val.includes('Trägt')) result.verdict = 'carries'
      else if (val.includes('Rework')) result.verdict = 'rework'
      else if (val.includes('nicht')) result.verdict = 'fails'
      else result.verdict = val
    } else if (trimmed.startsWith('Begründung:')) {
      result.justification = trimmed.replace('Begründung:', '').trim()
    } else if (trimmed.startsWith('Machbarkeit:')) {
      result.feasibility = trimmed.replace('Machbarkeit:', '').trim()
    } else if (trimmed.startsWith('Empfehlung:')) {
      result.recommendation = trimmed.replace('Empfehlung:', '').trim()
    }
  }

  return result
}

async function tryGroq(systemPrompt) {
  if (!GROQ_API_KEY) return null
  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${GROQ_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'openai/gpt-oss-120b',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: 'Bewerte diese Content-Idee.' }
        ],
        temperature: 0.3,
        max_tokens: 2048
      })
    })
    if (!res.ok) return null
    const data = await res.json()
    return data.choices?.[0]?.message?.content || null
  } catch (e) {
    console.error('[evaluate-idea] Groq failed:', e.message)
    return null
  }
}

async function tryMistral(systemPrompt) {
  if (!MISTRAL_API_KEY) return null
  try {
    const res = await fetch('https://api.mistral.ai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${MISTRAL_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'mistral-small-latest',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: 'Bewerte diese Content-Idee.' }
        ],
        temperature: 0.3,
        max_tokens: 2048
      })
    })
    if (!res.ok) return null
    const data = await res.json()
    return data.choices?.[0]?.message?.content || null
  } catch (e) {
    console.error('[evaluate-idea] Mistral failed:', e.message)
    return null
  }
}

async function tryOpenRouter(systemPrompt) {
  if (!OPENROUTER_API_KEY) return null
  try {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://happiness-eu.netlify.app',
        'X-Title': 'Happiness Idea Evaluation'
      },
      body: JSON.stringify({
        model: 'google/gemma-4-26b-a4b-it:free',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: 'Bewerte diese Content-Idee.' }
        ],
        temperature: 0.3,
        max_tokens: 2048
      })
    })
    if (!res.ok) return null
    const data = await res.json()
    return data.choices?.[0]?.message?.content || null
  } catch (e) {
    console.error('[evaluate-idea] OpenRouter failed:', e.message)
    return null
  }
}

async function tryDeepSeek(systemPrompt) {
  if (!DEEPSEEK_API_KEY) return null
  try {
    const res = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${DEEPSEEK_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'deepseek-v4-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: 'Bewerte diese Content-Idee.' }
        ],
        temperature: 0.3,
        max_tokens: 2048
      })
    })
    if (!res.ok) return null
    const data = await res.json()
    return data.choices?.[0]?.message?.content || null
  } catch (e) {
    console.error('[evaluate-idea] DeepSeek failed:', e.message)
    return null
  }
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
  if (!token) {
    return { statusCode: 401, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Nicht authentifiziert' }) }
  }

  try {
    const authResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: { 'Authorization': `Bearer ${token}`, 'apikey': process.env.VITE_SUPABASE_ANON_KEY }
    }).then(r => r.json())

    const user = authResponse?.id ? authResponse : authResponse?.data?.user
    if (!user) {
      return { statusCode: 401, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Ungültiges Token' }) }
    }

    let body = {}
    try { body = JSON.parse(event.body || '{}') } catch { body = {} }

    const { idea_text, content_goal } = body

    if (!idea_text || !idea_text.trim()) {
      return {
        statusCode: 400,
        headers: CORS_HEADERS,
        body: JSON.stringify({ error: 'idea_text ist erforderlich' })
      }
    }

    // 1. Load active hook rules from Supabase
    const { data: rules, error: rulesError } = await supabase
      .from('hook_rules')
      .select('*')
      .eq('is_active', true)
      .order('severity', { ascending: true })

    if (rulesError) {
      console.error('[evaluate-idea] Failed to load hook_rules:', rulesError.message)
      return {
        statusCode: 500,
        headers: CORS_HEADERS,
        body: JSON.stringify({ error: 'Hook-Rules konnten nicht geladen werden' })
      }
    }

    if (!rules || rules.length === 0) {
      return {
        statusCode: 500,
        headers: CORS_HEADERS,
        body: JSON.stringify({ error: 'Keine aktiven Hook-Rules vorhanden' })
      }
    }

    // 2. Build system prompt with dynamic rules
    const systemPrompt = buildSystemPrompt(rules, idea_text, content_goal)

    // 3. Fallback chain: Groq → Mistral → OpenRouter → DeepSeek
    let response = null

    response = await tryGroq(systemPrompt)
    if (response) console.log('[evaluate-idea] Success via Groq')

    if (!response) {
      response = await tryMistral(systemPrompt)
      if (response) console.log('[evaluate-idea] Success via Mistral')
    }

    if (!response) {
      response = await tryOpenRouter(systemPrompt)
      if (response) console.log('[evaluate-idea] Success via OpenRouter')
    }

    if (!response) {
      response = await tryDeepSeek(systemPrompt)
      if (response) console.log('[evaluate-idea] Success via DeepSeek')
    }

    if (!response) {
      return {
        statusCode: 502,
        headers: CORS_HEADERS,
        body: JSON.stringify({ error: 'Idee konnte nicht bewertet werden. Alle KI-Modelle sind momentan nicht erreichbar.' })
      }
    }

    // 4. Parse structured verdict
    const parsed = parseVerdict(response)

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        verdict: parsed.verdict,
        justification: parsed.justification,
        feasibility: parsed.feasibility,
        recommendation: parsed.recommendation,
        raw_response: response,
        rules_checked: rules.length
      })
    }
  } catch (e) {
    console.error('[evaluate-idea] Unexpected error:', e.message)
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: 'Interner Fehler bei der Ideen-Bewertung' })
    }
  }
}
