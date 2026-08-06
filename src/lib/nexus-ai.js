/**
 * NeXus AI Client
 * 
 * Frontend-Client für die NeXus AI Function.
 * Nutzt die bestehende Multi-Provider Infrastruktur von Happiness.
 */

const NEXUS_AI_URL = '/.netlify/functions/nexus-ai'

/**
 * Ruft die NeXus AI Function auf
 * @param {string} mode - Der Modus (angebotsanalyse, trigger_detection, etc.)
 * @param {string} message - Die Nutzereingabe
 * @param {object} context - Optionale Zusatzinfos
 * @param {number} temperature - Optionale Temperatur (0-1)
 * @returns {Promise<{response: string, provider: string, model: string}>}
 */
export async function callNexusAI(mode, message, context = null, temperature = 0.3) {
  const token = localStorage.getItem('supabase_token') || ''
  
  const res = await fetch(NEXUS_AI_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ mode, message, context, temperature })
  })

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Unbekannter Fehler' }))
    throw new Error(error.error || `HTTP ${res.status}`)
  }

  return res.json()
}

/**
 * Analysiert ein Angebot und leitet das Vertriebsmodell ab
 */
export async function analysiereAngebot(angebotsbeschreibung) {
  return callNexusAI(
    'angebotsanalyse',
    `Analysiere folgendes Angebot und leite das vollständige Vertriebsmodell ab:\n\n${angebotsbeschreibung}`,
    null,
    0.3
  )
}

/**
 * Erkennt Trigger Events in einem Text
 */
export async function erkenneTrigger(text, quelle = 'unbekannt') {
  return callNexusAI(
    'trigger_detection',
    `Analysiere folgenden Text auf Trigger Events, die auf Kaufbereitschaft hinweisen:\n\nText:\n${text}\n\nQuelle: ${quelle}`,
    null,
    0.2
  )
}

/**
 * Analysiert einen Lead detailliert
 */
export async function analysiereLead(lead) {
  const leadInfo = [
    `Firmenname: ${lead.firmenname}`,
    lead.branche ? `Branche: ${lead.branche}` : '',
    lead.standort ? `Standort: ${lead.standort}` : '',
    lead.website ? `Website: ${lead.website}` : '',
    lead.trigger_event ? `Trigger Event: ${lead.trigger_event}` : '',
    lead.signifikanz ? `Signifikanz: ${lead.signifikanz}` : ''
  ].filter(Boolean).join('\n')

  return callNexusAI(
    'lead_intelligence',
    `Analysiere folgendes Unternehmen detailliert:\n\n${leadInfo}`,
    null,
    0.3
  )
}

/**
 * Generiert einen personalisierten Pitch
 */
export async function generierePitch(lead, intelligence) {
  const context = {
    firmenname: lead.firmenname,
    branche: lead.branche,
    trigger_event: lead.trigger_event,
    schmerzpunkte: intelligence?.schmerzpunkte || [],
    pitch: intelligence?.pitch || {}
  }

  return callNexusAI(
    'sales_pitch',
    `Erstelle einen personalisierten Pitch für ${lead.firmenname}.`,
    context,
    0.7
  )
}

/**
 * Schlägt eine Follow-up-Aktion vor
 */
export async function schlageFollowUp(lead, letzteAktion) {
  const context = {
    firmenname: lead.firmenname,
    status: lead.status,
    letzte_aktion: letzteAktion
  }

  return callNexusAI(
    'follow_up',
    `Schlage die beste nächste Follow-up-Aktion für ${lead.firmenname} vor.`,
    context,
    0.5
  )
}

/**
 * Behandelt einen Einwand
 */
export async function behandleEinwand(lead, einwand) {
  const context = {
    firmenname: lead.firmenname,
    branche: lead.branche
  }

  return callNexusAI(
    'einwandbehandlung',
    `Kunde (${lead.firmenname}) sagt: "${einwand}"\n\nWie sollte der Vertriebsmitarbeiter reagieren?`,
    context,
    0.5
  )
}

/**
 * Generiert eine Forum-Antwort
 */
export async function generiereForumAntwortbeitrag(post, quelle) {
  return callNexusAI(
    'forum_response',
    `Verfasse eine hilfreiche Antwort auf folgenden Forum-Beitrag:\n\n${post}\n\nQuelle: ${quelle}`,
    null,
    0.6
  )
}
