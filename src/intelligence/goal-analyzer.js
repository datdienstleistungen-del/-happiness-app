/**
 * Goal Analyzer
 *
 * H.I.T. analysiert das Ziel des Nutzers und entscheidet automatisch:
 * - Branche, Zielgruppe, Plattformen, Content-Typ, Tonalität
 * - Content-Score, geschätzte Arbeitszeitersparnis
 * - Strategische Empfehlungen (überraschender Mehrwert)
 *
 * flow: goal → analyze → { analysis, recommendations }
 */

const ANALYSIS_PROMPT = `Du bist H.I.T., ein strategischer Content-Berater für ein Creator Operating System.

Analysiere das Ziel des Nutzers und erstelle eine vollständige Strategie.

Regeln:
- Antworte NUR mit validem JSON (kein Markdown, kein Text davor/danach)
- Content-Chance: 0-100 (basiert auf Ziel-Klarheit, Zielgruppe, Content-Typ)
- Arbeitszeit gespart: realistisch (pro Plattform ~30-45 Min Bearbeitungszeit)
- Top 3 Plattformen: die BESTEN für dieses Ziel (nicht alle)
- Alle 12 Plattformen: sinnvolle Reihenfolge
- Surprise-Empfehlung: etwas, woran der Nutzer nicht gedacht hätte

JSON-Schema:
{
  "goal": "string — das Ziel des Nutzers",
  "industry": "string — Branche/Geschäftsfeld",
  "targetAudience": "string — Zielgruppe",
  "contentScore": number,
  "savedTime": "string — z.B. ≈ 2 Stunden",
  "topPlatforms": ["string — die 3 besten Plattformen"],
  "allPlatforms": ["string — alle 12 in sinnvoller Reihenfolge"],
  "contentTypes": { "plattform": "content-typ" },
  "tone": "string — Tonalität",
  "hooks": ["string — 3 Hook-Vorschläge"],
  "hashtags": ["string — 10 relevante Hashtags"],
  "bestTime": "string — beste Veröffentlichungszeit",
  "videoRecommended": { "yes": boolean, "reason": "string" },
  "surpriseRecommendation": "string — unerwarteter Tipp"
}`

/**
 * Analysiert das Ziel des Nutzers via LLM
 * @param {string} goal - Das Ziel des Nutzers
 * @param {string} chatEndpoint - API-Endpoint
 * @param {string} token - Auth-Token (optional)
 * @returns {Promise<object>} Analyse-Ergebnis
 */
export async function analyzeGoal(goal, chatEndpoint, token = '') {
  try {
    const headers = { 'Content-Type': 'application/json' }
    if (token) headers['Authorization'] = `Bearer ${token}`

    const response = await fetch(chatEndpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        message: `Ziel des Nutzers: "${goal}"\n\nErstelle eine vollständige Content-Strategie.`,
        systemPrompt: ANALYSIS_PROMPT,
        history: []
      })
    })

    if (!response.ok) {
      console.warn(`[GoalAnalyzer] API returned ${response.status}, using fallback`)
      return fallbackAnalysis(goal)
    }

    const data = await response.json()
    const raw = data.response || ''

    try {
      const jsonMatch = raw.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0])
        return normalizeAnalysis(parsed, goal)
      }
    } catch (e) {
      console.warn('[GoalAnalyzer] JSON parse failed, using fallback')
    }

    return fallbackAnalysis(goal)
  } catch (err) {
    console.warn('[GoalAnalyzer] API call failed, using fallback:', err.message)
    return fallbackAnalysis(goal)
  }
}

/**
 * Normalisiert das LLM-Ergebnis auf ein einheitliches Schema
 */
function normalizeAnalysis(parsed, goal) {
  return {
    goal: parsed.goal || goal,
    industry: parsed.industry || 'Allgemein',
    targetAudience: parsed.targetAudience || 'Allgemein',
    contentScore: clamp(parsed.contentScore || 75, 0, 100),
    savedTime: parsed.savedTime || '≈ 1 Stunde',
    topPlatforms: Array.isArray(parsed.topPlatforms)
      ? parsed.topPlatforms.slice(0, 3)
      : ['instagram', 'facebook', 'linkedin'],
    allPlatforms: Array.isArray(parsed.allPlatforms)
      ? parsed.allPlatforms
      : ['instagram', 'facebook', 'linkedin', 'tiktok', 'youtube', 'twitter', 'pinterest', 'reddit', 'blog', 'newsletter', 'googleBusiness', 'kleinanzeigen'],
    contentTypes: parsed.contentTypes || {},
    tone: parsed.tone || 'Freundlich, professionell',
    hooks: Array.isArray(parsed.hooks) ? parsed.hooks.slice(0, 3) : [],
    hashtags: Array.isArray(parsed.hashtags) ? parsed.hashtags.slice(0, 10) : [],
    bestTime: parsed.bestTime || 'Di-Do, 18-20 Uhr',
    videoRecommended: parsed.videoRecommended || { yes: false, reason: 'Nicht spezifiziert' },
    surpriseRecommendation: parsed.surpriseRecommendation || ''
  }
}

/**
 * Fallback-Analyse wenn LLM nicht verfügbar
 */
function fallbackAnalysis(goal) {
  const lower = goal.toLowerCase()

  let industry = 'Allgemein'
  let targetAudience = 'Allgemein'
  let topPlatforms = ['instagram', 'facebook', 'linkedin']

  if (/kunden|geschäft|business|verkauf|produkt/i.test(lower)) {
    industry = 'Business'
    targetAudience = 'Potenzielle Kunden'
    topPlatforms = ['instagram', 'googleBusiness', 'facebook']
  } else if (/vermiet|ferienhaus|wohnung|immobil/i.test(lower)) {
    industry = 'Immobilien'
    targetAudience = 'Mieter/Käufer'
    topPlatforms = ['kleinanzeigen', 'facebook', 'instagram']
  } else if (/event|veranstaltung|party|konzert/i.test(lower)) {
    industry = 'Events'
    targetAudience = 'Teilnehmer'
    topPlatforms = ['instagram', 'facebook', 'tiktok']
  } else if (/bewerb|mitarbeiter|team|job/i.test(lower)) {
    industry = 'HR'
    targetAudience = 'Bewerber'
    topPlatforms = ['linkedin', 'instagram', 'facebook']
  } else if (/community|follower|reichweite|audience/i.test(lower)) {
    industry = 'Creator'
    targetAudience = 'Followers'
    topPlatforms = ['tiktok', 'instagram', 'youtube']
  }

  return {
    goal,
    industry,
    targetAudience,
    contentScore: 72,
    savedTime: '≈ 1,5 Stunden',
    topPlatforms,
    allPlatforms: ['instagram', 'facebook', 'linkedin', 'tiktok', 'youtube', 'twitter', 'pinterest', 'reddit', 'blog', 'newsletter', 'googleBusiness', 'kleinanzeigen'],
    contentTypes: {},
    tone: 'Freundlich, professionell',
    hooks: [
      'Was viele übersehen...',
      'Der größte Fehler bei...',
      'So geht es richtig...'
    ],
    hashtags: ['#happiness', '#content', '#marketing', '#business', '#creator'],
    bestTime: 'Di-Do, 18-20 Uhr',
    videoRecommended: { yes: false, reason: 'Nicht genügend Informationen' },
    surpriseRecommendation: 'Google Business wird oft übersehen, ist aber für lokale Sichtbarkeit extrem effektiv.'
  }
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value))
}

export default analyzeGoal
