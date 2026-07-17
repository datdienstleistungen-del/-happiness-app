/**
 * Guided Questions Engine
 * 
 * H.I.T. stellt 3-5 intelligente Fragen, bevor Content erzeugt wird.
 * Jede Frage reduziert die Unsicherheit und bestimmt den nächsten Schritt.
 * 
 * flow: goal → questions → answers → master brief → content
 */

const AUDIENCE_QUESTIONS = {
  default: {
    question: 'Wer soll dein Ziel erreichen?',
    hint: 'Wen möchtest du ansprechen?',
    options: [
      { label: 'Familien', value: 'familien', icon: '👨‍👩‍👧‍👦' },
      { label: 'Paare', value: 'paare', icon: '💑' },
      { label: 'Geschäftsreisende', value: 'geschaeftsreisende', icon: '💼' },
      { label: 'Jugendliche (16-25)', value: 'jugendliche', icon: '🎯' },
      { label: 'Alle', value: 'alle', icon: '🌍' },
    ],
  },
  vermieter: {
    question: 'Wer soll dein Ferienhaus buchen?',
    hint: 'Welche Art von Gästen suchst du?',
    options: [
      { label: 'Familien', value: 'familien', icon: '👨‍👩‍👧‍👦' },
      { label: 'Paare', value: 'paare', icon: '💑' },
      { label: 'Geschäftsreisende', value: 'geschaeftsreisende', icon: '💼' },
      { label: 'Urlauber', value: 'urlauber', icon: '🏖️' },
      { label: 'Alle', value: 'alle', icon: '🌍' },
    ],
  },
  business: {
    question: 'Wen möchtest du mit deinem Business erreichen?',
    hint: 'Wer ist deine Zielgruppe?',
    options: [
      { label: 'Neukunden', value: 'neukunden', icon: '🆕' },
      { label: 'Bestehende Kunden', value: 'bestehende_kunden', icon: '🔄' },
      { label: 'B2B-Kunden', value: 'b2b', icon: '🏢' },
      { label: 'Lokale Kunden', value: 'lokal', icon: '📍' },
      { label: 'Alle', value: 'alle', icon: '🌍' },
    ],
  },
  creator: {
    question: 'Wer folgt dir oder soll dir folgen?',
    hint: 'Was für ein Publikum bauen wir auf?',
    options: [
      { label: 'Nische (spezifisch)', value: 'niche', icon: '🎯' },
      { label: 'Breit (allgemein)', value: 'breit', icon: '🌊' },
      { label: 'Lokal', value: 'lokal', icon: '📍' },
      { label: 'International', value: 'international', icon: '🌍' },
    ],
  },
}

const CHANNEL_QUESTIONS = {
  default: {
    question: 'Wo möchtest du die Menschen erreichen?',
    hint: 'Welche Kanäle sind dir wichtig?',
    options: [
      { label: 'Social Media', value: 'social_media', icon: '📱' },
      { label: 'Kleinanzeigen', value: 'kleinanzeigen', icon: '🏷️' },
      { label: 'Webseite', value: 'webseite', icon: '🌐' },
      { label: 'Alle Kanäle', value: 'alle', icon: '🚀' },
    ],
  },
  social_media: {
    question: 'Welche Plattformen?',
    hint: 'Mehrere möglich.',
    multiple: true,
    options: [
      { label: 'TikTok', value: 'tiktok', icon: '🎵' },
      { label: 'Instagram', value: 'instagram', icon: '📸' },
      { label: 'Facebook', value: 'facebook', icon: '👥' },
      { label: 'LinkedIn', value: 'linkedin', icon: '💼' },
      { label: 'YouTube', value: 'youtube', icon: '▶️' },
      { label: 'Reddit', value: 'reddit', icon: '💬' },
    ],
  },
}

const GOAL_QUESTIONS = {
  default: {
    question: 'Was ist dein wichtigstes Ziel?',
    hint: 'Was soll sich durch den Content verändern?',
    options: [
      { label: 'Mehr Anfragen', value: 'anfragen', icon: '📩' },
      { label: 'Mehr Buchungen', value: 'buchungen', icon: '📅' },
      { label: 'Bekanntheit', value: 'bekanntheit', icon: '🌟' },
      { label: 'Vertrauen aufbauen', value: 'vertrauen', icon: '🤝' },
      { label: 'Direkt verkaufen', value: 'verkaufen', icon: '💰' },
    ],
  },
  vermieter: {
    question: 'Was ist dein wichtigstes Ziel?',
    hint: 'Was soll der Content bewirken?',
    options: [
      { label: 'Mehr Buchungsanfragen', value: 'anfragen', icon: '📩' },
      { label: 'Höherer Preis', value: 'preis', icon: '💎' },
      { label: 'Schneller vermietet', value: 'schnell', icon: '⚡' },
      { label: 'Wiederkehrende Gäste', value: 'wiederkehr', icon: '🔄' },
    ],
  },
}

const TONE_QUESTIONS = {
  question: 'Welchen Tonfall bevorzugst du?',
  hint: 'Wie soll sich der Content anfühlen?',
  options: [
    { label: 'Freundlich & Locker', value: 'freundlich', icon: '😊' },
    { label: 'Professionell', value: 'professionell', icon: '💼' },
    { label: 'Frech & Mutig', value: 'frech', icon: '🔥' },
    { label: 'Inspirierend', value: 'inspirierend', icon: '✨' },
    { label: 'Sachlich & Direkt', value: 'sachlich', icon: '🎯' },
  ],
}

const USP_QUESTIONS = {
  question: 'Was macht dich oder dein Angebot besonders?',
  hint: 'Was können andere nicht bieten?',
  type: 'text',
  placeholder: 'z.B. "Nur 5 Min vom Strand", "24/7 Support", "Das günstigste Angebot"',
}

/**
 * Detect context from user's goal to select appropriate question set
 */
function detectContext(goal) {
  const lower = goal.toLowerCase()
  
  if (/ferienhaus|urlaub|mieten|vermiet|haus|wohnung|appartement|zimmer/.test(lower)) return 'vermieter'
  if (/business|unternehmen|firma|geschäft|kunde|kunden|umsatz|produkt|dienstleistung/.test(lower)) return 'business'
  if (/tiktok|instagram|youtube|content|creator|community|folger|follow/.test(lower)) return 'creator'
  
  return 'default'
}

/**
 * Generate the question sequence based on goal context
 */
export function generateQuestionSequence(goal) {
  const context = detectContext(goal)
  const questions = []
  
  // Q1: Audience
  const audienceSet = AUDIENCE_QUESTIONS[context] || AUDIENCE_QUESTIONS.default
  questions.push({ id: 'audience', ...audienceSet })
  
  // Q2: Channel
  const channelSet = CHANNEL_QUESTIONS.default
  questions.push({ id: 'channel', ...channelSet })
  
  // If social media selected, ask which platforms
  questions.push({ id: 'platforms', ...CHANNEL_QUESTIONS.social_media, conditional: { after: 'channel', value: 'social_media' } })
  
  // Q3: Goal
  const goalSet = GOAL_QUESTIONS[context] || GOAL_QUESTIONS.default
  questions.push({ id: 'goal_type', ...goalSet })
  
  // Q4: Tone
  questions.push({ id: 'tone', ...TONE_QUESTIONS })
  
  // Q5: USP (text input)
  questions.push({ id: 'usp', ...USP_QUESTIONS })
  
  return questions
}

/**
 * Get the next question based on current answers
 */
export function getNextQuestion(questions, answers, currentIndex) {
  for (let i = currentIndex; i < questions.length; i++) {
    const q = questions[i]
    if (q.conditional) {
      const prevAnswer = answers[q.conditional.after]
      if (prevAnswer !== q.conditional.value) continue
    }
    return { question: q, index: i }
  }
  return null
}

/**
 * Build a rich Master Brief from guided answers
 * This replaces the generic "Erstelle einen Master-Brief" prompt
 */
export function buildMasterBriefFromAnswers(goal, answers) {
  const audience = answers.audience || 'Unbekannt'
  const channel = answers.channel || 'Social Media'
  const platforms = answers.platforms || []
  const goalType = answers.goal_type || 'Bekanntheit'
  const tone = answers.tone || 'Freundlich & Locker'
  const usp = answers.usp || ''
  
  const platformText = Array.isArray(platforms) ? platforms.join(', ') : platforms
  
  return {
    goal,
    audience,
    channel,
    platforms: platformText,
    goalType,
    tone,
    usp,
    summary: [
      `Ziel: ${goal}`,
      `Zielgruppe: ${audience}`,
      `Kanal: ${channel}${platformText ? ` (${platformText})` : ''}`,
      `Kernziel: ${goalType}`,
      `Tonfall: ${tone}`,
      usp ? `USP: ${usp}` : '',
    ].filter(Boolean).join('\n'),
  }
}
