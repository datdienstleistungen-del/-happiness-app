import { createClient } from '@supabase/supabase-js'
import { callLLM } from './_shared/llm-core.mjs'

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_KEY
const supabase = createClient(supabaseUrl, supabaseKey)

const CORS_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization'
}

function buildSystemPrompt(hookRules, ideaText, contentGoal) {
  const rulesList = hookRules
    .map((r, i) => {
      const text = r.rule_text || r.rule || ''
      const sev = r.severity === 'critical' ? 'KRITISCH' : 'MODERAT'
      const weight = r.weight ? ` (Gewicht: ${r.weight}/10)` : ''
      return `${i + 1}. [${sev}]${weight} ${text}`
    })
    .join('\n')

  const goalHint = contentGoal
    ? `\nDas User gewünschte Genre/Format: ${contentGoal}`
    : ''

  return `Du bewertest eine Content-Idee für Kurzvideos (TikTok, Reels, Shorts). Deine Aufgabe ist ein EHRLICHES, begründetes Urteil - kein reflexhaftes Lob, aber auch keine Ungerechtigkeit.

WICHTIG: Jede IDEE die ein konkretes Szenario, eine Handlung oder ein visuelles Konzept beschreibt, ist eine gültige Idee. "Hund schaut vom Balkon und sieht Katze" IST eine konkrete Idee — bewerte sie danach, was Potenzial hat, nicht danach was fehlt.

Prüfe die Idee gegen genau diese Kriterien, in dieser Reihenfolge:

1. HOOK-RULES:
${rulesList}
   Prüfe explizit, welche Regeln die Idee erfüllt und welche sie bricht.

2. FORMAT-SÄTTIGUNG: Ist dieses Konzept/dieser Twist in Kurzvideos bereits stark verbreitet und ausgelutscht? Nenne konkret, welches Format/Meme/Trend die Idee wiederholt, falls zutreffend.

3. MACHBARKEIT: Lässt sich die Idee realistisch umsetzen? Braucht es einen Eigendreh, oder reichen Stock-Bilder/Found Footage? Was genau müsste gefilmt werden?${goalHint}

Antworte NUR in diesem Format, kein Fließtext davor oder danach:

Urteil: [Trägt so wie es ist / Braucht Rework / Funktioniert nicht]
Begründung: [konkret, unter Bezug auf die gebrochenen/erfüllten Hook-Rules und die Sättigungs-Einschätzung, 2-4 Sätze]
Machbarkeit: [einfach umsetzbar / Eigendreh nötig — was genau gebraucht wird]
Empfehlung: [NUR wenn Urteil = "Braucht Rework": ein einziger konkreter Dreh, der das Kernproblem löst. NUR wenn Urteil = "Funktioniert nicht": der eine Hauptgrund]

Wenn die Idee gut ist, SAG DASS AUCH. "Trägt so wie es ist" ist ein validdektor und keine Ausnahme.`
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

async function evaluateIdea(systemPrompt) {
  // Kette Groq -> Mistral -> OpenRouter -> DeepSeek via _shared/llm-core.mjs.
  // Wirft, wenn alle Provider versagen (Handler antwortet mit 502).
  const { text, provider } = await callLLM(
    [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: 'Bewerte diese Content-Idee.' }
    ],
    {
      providers: ['groq', 'mistral', 'openrouter', 'deepseek'],
      temperature: 0.3,
      max_tokens: 2048,
      xTitle: 'Happiness Idea Evaluation',
      totalBudgetMs: 20000,
    }
  )
  console.log(`[evaluate-idea] Success via ${provider}`)
  return text
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

    // 1. Load active hook rules from Supabase (try both column names)
    let rules = []
    let rulesError = null

    const result1 = await supabase
      .from('hook_rules')
      .select('*')
      .eq('active', true)
      .order('weight', { ascending: false })

    if (result1.error) {
      const result2 = await supabase
        .from('hook_rules')
        .select('*')
        .eq('is_active', true)
      if (!result2.error) rules = result2.data || []
      else rulesError = result2.error
    } else {
      rules = result1.data || []
    }

    if (rulesError) {
      console.error('[evaluate-idea] Failed to load hook_rules:', rulesError.message)
    }

    // If no rules table or empty, use built-in defaults
    if (!rules || rules.length === 0) {
      rules = [
        { rule_text: 'Hook muss in den ersten 1-3 Sekunden Konflikt, Neugier oder Schock erzeugen', severity: 'critical', weight: 10 },
        { rule_text: 'Kein "Hallo ich bin..." oder langsamer Einstieg', severity: 'critical', weight: 9 },
        { rule_text: 'Keine generischen Hooks wie "Wer kennt das nicht..."', severity: 'critical', weight: 8 },
        { rule_text: 'Pattern Interrupt: Iwas muss in 0.5 Sekunden den Zuschauer überraschen', severity: 'critical', weight: 8 },
        { rule_text: 'Specific beats generic: Konkret > Abstrakt', severity: 'moderate', weight: 7 },
        { rule_text: 'Setup → Conflict → Payoff Struktur einhalten', severity: 'moderate', weight: 7 },
        { rule_text: 'Kein YouTube-Tutorial-Stil ("In diesem Video zeige ich euch...")', severity: 'critical', weight: 9 },
        { rule_text: 'Starkes Statement oder kontroverse Meinung > harmonischer Einstieg', severity: 'moderate', weight: 6 }
      ]
      console.log('[evaluate-idea] Using built-in default rules (no hook_rules table found)')
    }

    // 2. Build system prompt with dynamic rules
    const systemPrompt = buildSystemPrompt(rules, idea_text, content_goal)

    // 3. Kette: Groq -> Mistral -> OpenRouter -> DeepSeek (via _shared/llm-core.mjs)
    let response = null
    try {
      response = await evaluateIdea(systemPrompt)
    } catch (e) {
      console.error('[evaluate-idea] all providers failed:', e.message)
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
