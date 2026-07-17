/**
 * H.I.T. Recommendations Engine
 *
 * Generiert strategische Empfehlungen, die den Nutzer überraschen.
 * Kategorien: Plattform, Timing, Strategie, Surprise
 *
 * flow: goal + analysis → recommendations[]
 */

const RECOMMENDATION_PROMPT = `Du bist H.I.T., ein strategischer Content-Berater.

Erstelle 3-5 konkrete Empfehlungen für den Nutzer.

Kategorien:
1. 📱 Plattform — welche Plattform ist am besten geeignet?
2. ⏰ Timing — wann veröffentlichen?
3. 💡 Strategie — was könnte der Nutzer übersehen?
4. 🎯 Unerwarteter Mehrwert — welche Plattform überrascht?

Regeln:
- Jede Empfehlung: kurze Überschrift (max 5 Wörter) + 1-2 Sätze Erklärung
- Nicht generisch. Konkret für dieses Ziel.
- Antworte NUR mit validem JSON

JSON-Schema:
{
  "recommendations": [
    {
      "type": "platform" | "timing" | "strategy" | "surprise",
      "icon": "📱" | "⏰" | "💡" | "🎯",
      "title": "string",
      "text": "string"
    }
  ]
}`

/**
 * Generiert strategische Empfehlungen
 * @param {string} goal - Das Ziel des Nutzers
 * @param {object} analysis - Das Analyse-Ergebnis aus goal-analyzer
 * @param {string} chatEndpoint - API-Endpoint
 * @param {string} token - Auth-Token (optional)
 * @returns {Promise<object[]>} Empfehlungen
 */
export async function generateRecommendations(goal, analysis, chatEndpoint, token = '') {
  const headers = { 'Content-Type': 'application/json' }
  if (token) headers['Authorization'] = `Bearer ${token}`

  const context = `Ziel: "${goal}"
Branche: ${analysis.industry}
Zielgruppe: ${analysis.targetAudience}
Top-Plattformen: ${analysis.topPlatforms.join(', ')}
Tonfall: ${analysis.tone}
Content-Score: ${analysis.contentScore}%`

  try {
    const response = await fetch(chatEndpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        message: `Erstelle Empfehlungen für:\n\n${context}`,
        systemPrompt: RECOMMENDATION_PROMPT,
        history: []
      })
    })

    if (!response.ok) throw new Error('API Fehler')

    const data = await response.json()
    const raw = data.response || ''

    const jsonMatch = raw.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0])
      if (Array.isArray(parsed.recommendations)) {
        return parsed.recommendations.slice(0, 5).map(normalizeRecommendation)
      }
    }
  } catch (e) {
    console.warn('[Recommendations] API failed, using fallback')
  }

  return fallbackRecommendations(analysis)
}

function normalizeRecommendation(rec) {
  return {
    type: rec.type || 'strategy',
    icon: rec.icon || '💡',
    title: rec.title || 'Tipp',
    text: rec.text || ''
  }
}

function fallbackRecommendations(analysis) {
  const recs = []

  if (analysis.topPlatforms?.length > 0) {
    const primary = analysis.topPlatforms[0]
    recs.push({
      type: 'platform',
      icon: '📱',
      title: 'Plattform-Empfehlung',
      text: `${platformName(primary)} passt am besten für dein Ziel "${analysis.goal}".`
    })
  }

  recs.push({
    type: 'timing',
    icon: '⏰',
    title: 'Beste Zeit',
    text: `Am besten postest du ${analysis.bestTime || 'Di-Do, 18-20 Uhr'}.`
  })

  if (analysis.targetAudience) {
    recs.push({
      type: 'strategy',
      icon: '💡',
      title: 'Tipp für dich',
      text: `Sprich deine Zielgruppe (${analysis.targetAudience}) direkt mit einer Frage an — das erhöht das Engagement.`
    })
  }

  recs.push({
    type: 'surprise',
    icon: '🎯',
    title: 'Unerwarteter Tipp',
    text: 'Google Business wird oft vergessen, ist aber für lokale Sichtbarkeit extrem effektiv.'
  })

  return recs
}

function platformName(key) {
  const names = {
    tiktok: 'TikTok',
    instagram: 'Instagram',
    facebook: 'Facebook',
    linkedin: 'LinkedIn',
    youtube: 'YouTube Shorts',
    twitter: 'X / Twitter',
    pinterest: 'Pinterest',
    reddit: 'Reddit',
    blog: 'Blog',
    newsletter: 'Newsletter',
    googleBusiness: 'Google Business',
    kleinanzeigen: 'Kleinanzeigen',
    podcast: 'Podcast'
  }
  return names[key] || key
}

export default generateRecommendations
