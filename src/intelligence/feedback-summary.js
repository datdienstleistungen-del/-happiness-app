/**
 * Feedback Summary Agent
 *
 * Nimmt das komplette Feedback und erstellt ein klares Fazit
 * mit konkreten Handlungsempfehlungen für den Creator.
 *
 * flow: feedback → summarize → { summary, mainProblem, keyImprovement, nextSteps, expectedEffect }
 */

const SUMMARY_PROMPT = `Du bist ein Content-Coach und analysierst Feedback für einen Creator.

Aufgabe: Erstelle ein kurzes, klares Fazit aus dem gegebenen Feedback.

Das Fazit muss enthalten:
1. Hauptproblem(e) — Was ist das Kernproblem des Contents?
2. Wichtigste Verbesserung — Was sollte zuerst geändert werden?
3. Konkrete nächste Schritte — 2-3 konkrete, umsetzbare Aktionen
4. Erwarteter Effekt — Was bringt die Verbesserung?

REGELN:
- Sei direkt und konkret. Keine Floskeln.
- Maximal 4-5 Sätze für das gesamte Fazit.
- Jeder nächste Schritt muss sofort umsetzbar sein.
- Antworte NUR mit validem JSON (kein Markdown, kein Text davor/danach).
- Keine erfundenen Statistiken oder Prozentzahlen.
- Tonalität: Sachlich, unterstützend, ehrlich.

JSON-Schema:
{
  "summary": "string — 1-2 Satz Zusammenfassung des Feedbacks",
  "mainProblem": "string — Das Hauptproblem in einem Satz",
  "keyImprovement": "string — Die wichtigste Verbesserung",
  "nextSteps": ["string — konkreter Schritt 1", "string — konkreter Schritt 2", "string — konkreter Schritt 3"],
  "expectedEffect": "string — Was die Verbesserung bringt"
}`

/**
 * Fasst das Feedback zusammen und erstellt Handlungsempfehlungen
 * @param {string} draft — Der ursprüngliche Entwurf
 * @param {string} feedback — Das generierte Feedback
 * @param {string} chatEndpoint — API-Endpoint
 * @param {string} token — Auth-Token (optional)
 * @returns {Promise<object>} Strukturiertes Fazit
 */
export async function summarizeFeedback(draft, feedback, chatEndpoint, token = '') {
  const headers = { 'Content-Type': 'application/json' }
  if (token) headers['Authorization'] = `Bearer ${token}`

  const message = `Hier ist der Content-Entwurf:\n\n"${draft}"\n\nUnd hier ist das Feedback dazu:\n\n${feedback}\n\nErstelle ein kurzes Fazit mit Hauptproblem, wichtigster Verbesserung, konkreten nächsten Schritten und erwartetem Effekt.`

  try {
    const response = await fetch(chatEndpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        message,
        systemPrompt: SUMMARY_PROMPT,
        history: []
      })
    })

    if (!response.ok) throw new Error(`API Fehler ${response.status}`)

    const data = await response.json()
    const raw = data.response || ''

    const jsonMatch = raw.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0])
      return normalizeSummary(parsed)
    }
  } catch (e) {
    console.warn('[FeedbackSummary] API failed, using fallback')
  }

  return fallbackSummary(feedback)
}

function normalizeSummary(data) {
  return {
    summary: data.summary || '',
    mainProblem: data.mainProblem || '',
    keyImprovement: data.keyImprovement || '',
    nextSteps: Array.isArray(data.nextSteps) ? data.nextSteps.slice(0, 3) : [],
    expectedEffect: data.expectedEffect || ''
  }
}

function fallbackSummary(feedback) {
  const text = feedback || ''
  const lower = text.toLowerCase()

  let mainProblem = 'Dein Content braucht noch etwas Feinschliff.'
  if (lower.includes('hook') || lower.includes('anfang') || lower.includes('einsteig')) {
    mainProblem = 'Der Einstieg (Hook) ist noch nicht stark genug, um Aufmerksamkeit zu halten.'
  } else if (lower.includes('zielgruppe') || lower.includes('target')) {
    mainProblem = 'Die Zielgruppe wird noch nicht direkt genug angesprochen.'
  } else if (lower.includes('cta') || lower.includes('call-to-action') || lower.includes('nächster schritt')) {
    mainProblem = 'Es fehlt ein klarer Call-to-Action für den Betrachter.'
  } else if (lower.includes('format') || lower.includes('länge') || lower.includes('struktur')) {
    mainProblem = 'Das Format oder die Struktur könnte optimiert werden.'
  }

  return {
    summary: 'Dein Content hat ein gutes Thema, braucht aber noch Optimierungen für maximale Wirkung.',
    mainProblem,
    keyImprovement: 'Starte mit einem stärkeren Hook in den ersten Sekunden oder Zeilen.',
    nextSteps: [
      'Formuliere einen überzeugenden Einstieg, der sofort Aufmerksamkeit erregt.',
      'Kläre die Kernaussage in maximal 1-2 Sätzen.',
      'Füge einen klaren Call-to-Action hinzu.'
    ],
    expectedEffect: 'Höhere Zuschauerbindung und bessere Interaktion mit deinem Content.'
  }
}

export default summarizeFeedback
