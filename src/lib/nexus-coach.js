/**
 * NeXus Coach Module
 * 
 * Context Builder + System-Prompt-Trennung für den Sales Coach.
 * Trennt sauber: Basis-Prompt | NeXus-Wissen | Vertriebswissen | Aktueller Kontext
 */

import { getOpportunityContext } from './nexus-db'

// ============================================================================
// 1. CONTEXT BUILDER — Nur relevante Daten für den Coach
// ============================================================================

/**
 * Baut den Kontext für den Coach aus den verfügbaren Daten.
 * Lädt fehlende Daten (Kontakte, Research, Activities) aus der DB.
 * 
 * @param {object} params
 * @param {object} params.opportunity - Die aktuelle Opportunity (aus LeadContext)
 * @param {object} params.offering - Das aktive Offering (aus LeadContext)
 * @param {array}  params.triggers - Trigger Events für diese Firma (aus LeadContext)
 * @returns {Promise<object>} Aufbereiteter Kontext für den Coach
 */
export async function buildCoachContext({ opportunity, offering, triggers }) {
  if (!opportunity) return null

  const company = opportunity.nexus_companies || {}
  
  // Lade vollen Kontext aus der DB (Kontakte, Research, Activities)
  let dbContext = {}
  try {
    dbContext = await getOpportunityContext(opportunity.id) || {}
  } catch (err) {
    console.warn('[CoachContext] Could not load opportunity context:', err.message)
  }

  // Kontakte aufbereiten
  const contacts = (dbContext.contacts || []).map(c => ({
    name: [c.first_name, c.last_name].filter(Boolean).join(' ') || 'Unbekannt',
    role: c.role || 'Unbekannt',
    email: c.email || null,
    phone: c.phone || null,
    linkedin: c.linkedin_url || null,
    is_primary: c.is_primary || false,
  }))

  // Research aufbereiten
  const research = dbContext.research || null
  const researchSummary = research?.result_json ? summarizeResearch(research.result_json) : null

  // Activities aufbereiten (letzte 5)
  const activities = (dbContext.activities || []).slice(-5).map(a => ({
    type: a.activity_type || a.type,
    description: a.description || a.content,
    date: a.created_at || a.timestamp,
  }))

  // Trigger Events aufbereiten
  const triggerList = (triggers || []).map(t => ({
    content: t.content,
    source: t.source || 'Unbekannt',
    confidence: t.confidence_score,
    date: t.created_at,
  }))

  return {
    company: {
      name: company.name || 'Unbekannt',
      industry: company.industry || null,
      domain: company.domain || null,
      size: company.size || null,
      website: company.website || null,
    },
    offering: offering ? {
      name: offering.offering_name || offering.name,
      positioning: offering.positioning,
      target_audience: offering.target_audience,
      usps: offering.usps || [],
    } : null,
    triggers: triggerList,
    contacts,
    research: researchSummary,
    activities,
    opportunity: {
      stage: opportunity.pipeline_stage,
      source: opportunity.source,
      score: opportunity.ai_score || opportunity.score,
      created: opportunity.created_at,
    },
  }
}

/**
 * Fasst Research-Ergebnisse in ein paar Sätzen zusammen
 */
function summarizeResearch(resultJson) {
  if (typeof resultJson === 'string') {
    try { resultJson = JSON.parse(resultJson) } catch { return resultJson }
  }
  if (!resultJson) return null

  // Falls das Research-Objekt eine Struktur wie { summary, sources, insights } hat
  if (resultJson.summary) return resultJson.summary
  if (resultJson.insights) return resultJson.insights
  if (resultJson.analysis) return resultJson.analysis
  
  // Fallback: Ersten sinnvollen String-Wert nehmen
  for (const val of Object.values(resultJson)) {
    if (typeof val === 'string' && val.length > 20) return val
  }
  return null
}

// ============================================================================
// 2. SYSTEM-PROMPT BUILDER — Saubere Trennung in Schichten
// ============================================================================

/**
 * Baut den System-Prompt für den Coach auf.
 * Schichten: Basis | NeXus-Wissen | Vertriebswissen | Kontext | Grounding
 * 
 * @param {object} context - Aus buildCoachContext()
 * @param {string|null} quickAction - Aktive Quick-Action (pitch, einwand, followup, analyse)
 * @returns {string} Der vollständige System-Prompt
 */
export function buildCoachSystemPrompt(context, quickAction = null) {
  const layers = [
    BASE_PROMPT,
    NEXUS_KNOWLEDGE,
    SALES_KNOWLEDGE,
    buildContextLayer(context),
    GROUNDING_RULES,
    quickAction ? getQuickActionInstruction(quickAction) : '',
  ]

  return layers.filter(Boolean).join('\n\n')
}

// ============================================================================
// 3. PROMPT-LAYERS — Sauber getrennt und wartbar
// ============================================================================

const BASE_PROMPT = `Du bist NeXus Sales Coach — ein erfahrener B2B-Vertriebsexperte.
Du hilfst dem Nutzer (Verkäufer), seine Leads in Abschlüsse zu verwandeln.

DEIN VERHALTEN:
- Antworte IMMER auf Deutsch.
- Schreibe wie ein ECHTER MENSCH in einem Chat — natürlich, direkt, auf Augenhöhe.
- Nutze Fließtext, natürliche Sätze und weiche Übergänge.
- Fasse dich KNAPP: Maximal 3-5 prägnante Sätze pro Antwort.
- Wenn du mehr Platz brauchst, nutze strukturierte Listen.

VERBOTEN:
- NIEMALS mit JSON, Key-Value-Paaren oder starren Datenstrukturen antworten.
- NIEMALS "Firma: X", "Score: Y" o.ä. als Fließtext ausgeben.
- NIEMALS ausweichen oder generische Floskeln verwenden.`

const NEXUS_KNOWLEDGE = `---
WAS IST NeXus?
NeXus ist ein Sales Operating System mit folgender Architektur:
1. Angebotsanalyse → definiert Offering & Zielgruppe
2. Lead Radar → findet Kaufsignale (Trigger Events) im Markt
3. Opportunity → Lead-Akte mit allen Informationen
4. Sales Workspace → Pipeline-Management & Aktivitäten

WICHTIGE BEGRIFFE:
- Signal vs. Trigger: Ein Signal ist ein Fakt (z.B. "Firma baut neue Halle"). Ein Trigger ist die Interpretation ("Bedarf an unseren Dienstleistungen").
- Offering: Das Verkaufsangebot des Nutzers (Value Proposition + Zielgruppe).
- Opportunity: Ein konkreter Verkaufschance mit Company, Trigger, Kontakt.

GRENZEN VON NeXus:
- NeXus hat KEINE Integrationen zu HubSpot, Salesforce, Hunter.io oder ähnlichen Tools.
- NeXus ist ein eigenständiges System — kein Plugin für andere Tools.
- NeXus liefert CHANCEN, keine Garantien. Es sind plausible Begründungen, warum man einen Lead ansprechen sollte.
---`

const SALES_KNOWLEDGE = `---
VERTRIEBS-WISSEN (Best Practices):

GRUNDREGELN FÜR B2B-VERTRIEB:
1. Immer personalisieren. Niemals "Sehr geehrte Damen und Herren" bei bekanntem Ansprechpartner.
2. Trigger als Aufhänger nutzen — nicht "wir bieten X an", sondern "Ihr habt Problem Y, wir können helfen".
3. Einwandbehandlung: Zuerst verstehen, dann adressieren. NIEMALS leugnen oder drängeln.
4. Follow-up nach 3-5 Tagen, nicht aggressiv, sondern wertschätzend.

PITCH-STRUKTUR (B2B):
1. Aufhänger: Bezug auf Trigger/Signal
2. Problem: Welches Bedürfnis entsteht durch das Signal?
3. Lösung: Wie lösen wir genau dieses Problem?
4. Nutzen: Konkreter Mehrwert (Zeit, Geld, Risiko)
5. Call-to-Action: Weicher next step

EINWAND-BEHANDLUNG:
- "Ist zu teuer" → Nutzen vs. Kosten aufzeigen, nicht preisgeben
- "Kein Bedarf" → Nachfragen, ob Timing falsch ist oder Bedarf nicht erkannt
- "Kennen wir schon" → Differenzierung klarmachen, ohne Konkurrenz schlecht zu machen

FOLLOW-UP-REGELN:
- Nie "wollen Sie nochmal telefonieren?"
- Immer einen konkreten Mehrwert bieten (neue Erkenntnis, Case Study, Angebot)
- Zeitlichen Bezug herstellen ("seit unserem letzten Gespräch...")
---`

const GROUNDING_RULES = `
---
GROUNDING-PRINZIP (Fakten vs. Interpretation):
Trenne IMMER zwischen:
- FAKT: Was ist nachweislich passiert? (z.B. "Firma X hat Stelle Y ausgeschrieben")
- INTERPRETATION: Was könnte das bedeuten? (z.B. "Das könnte auf Bedarf an Z hindeuten")
- EMPFEHLUNG: Was sollte der Nutzer tun? (z.B. "Ich würde empfehlen, Kontakt aufzunehmen")

Kennzeichne Unsicherheiten explizit:
- "Meines Wissens nach..." / "Basierend auf den verfügbaren Daten..."
- "Es könnte sein, dass..." / "Eine mögliche Interpretation ist..."

Erfinde KEINE Fakten. Wenn du etwas nicht weißt, sage es direkt.
---`

// ============================================================================
// 4. CONTEXT LAYER — Dynamisch je nach Situation
// ============================================================================

function buildContextLayer(context) {
  if (!context) return ''

  const parts = ['--- AKTUELLER KONTEXT:']

  // Offering
  if (context.offering) {
    parts.push(`PRODUKT/ANGEBOT:
  Name: "${context.offering.name}"
  Value Proposition: "${context.offering.positioning}"
  Zielgruppe: "${context.offering.target_audience}"
  => Beziehe dich bei Pitches IMMER auf diesen Wert.`)
  }

  // Company
  if (context.company) {
    parts.push(`ZIELUNTERNEHMEN:
  Firma: ${context.company.name}
  Branche: ${context.company.industry || 'Unbekannt'}
  ${context.company.size ? `Größe: ${context.company.size}` : ''}
  ${context.company.website ? `Website: ${context.company.website}` : ''}`)
  }

  // Trigger
  if (context.triggers?.length > 0) {
    parts.push(`KAUFSIGNALE (Trigger Events):
${context.triggers.map(t => `  - [${t.source}] ${t.content}${t.confidence ? ` (Konfidenz: ${Math.round(t.confidence * 100)}%)` : ''}`).join('\n')}
  => Verknüpfe die Signale intelligent mit der Value Proposition.`)
  }

  // Contacts
  if (context.contacts?.length > 0) {
    parts.push(`KONTAKTE:
${context.contacts.map(c => `  - ${c.name} (${c.role})${c.email ? ` | ${c.email}` : ''}${c.phone ? ` | ${c.phone}` : ''}`).join('\n')}`)
  } else {
    parts.push(`KONTAKTE: Noch keine Kontakte hinterlegt.`)
  }

  // Research
  if (context.research) {
    parts.push(`RESEARCH-ERGEBNISSE:
  ${context.research}`)
  }

  // Activities
  if (context.activities?.length > 0) {
    parts.push(`BISHERIGE AKTIONEN:
${context.activities.map(a => `  - [${a.date ? new Date(a.date).toLocaleDateString('de-DE') : '?'}] ${a.type}: ${a.description}`).join('\n')}`)
  }

  // Opportunity
  if (context.opportunity) {
    parts.push(`OPPORTUNITY-STATUS:
  Stage: ${context.opportunity.stage || 'Unbekannt'}
  Score: ${context.opportunity.score || 'N/A'}
  Erstellt: ${context.opportunity.created ? new Date(context.opportunity.created).toLocaleDateString('de-DE') : 'Unbekannt'}`)
  }

  parts.push('---')
  return parts.join('\n')
}

// ============================================================================
// 5. QUICK-ACTION INSTRUKTIONEN
// ============================================================================

function getQuickActionInstruction(actionId) {
  const instructions = {
    pitch: `MODUS: SALES PITCH
Der Nutzer möchte einen personalisierten Verkaufspitch erstellen.
Konzentriere dich auf:
1. Trigger als Aufhänger nutzen
2. Problem → Lösung → Nutzen Struktur
3. Konkreten Call-to-Action am Ende
4. Tonalität: Professionell, menschlich, auf Augenhöhe`,

    einwand: `MODUS: EINWAND BEHANDELN
Der Nutzer hat einen Einwand vom Kunden erhalten.
Vorgehen:
1. Einwand verstehen und validieren ("Das verstehe ich")
2. Nicht leugnen oder drängeln
3. Perspektive wechseln ("Wenn ich an Ihrer Stelle wäre...")
4. Konkreten Lösungsansatz bieten`,

    followup: `MODUS: FOLLOW-UP VORSCHLAG
Der Nutzer braucht eine Idee für die nächste Aktion.
Vorgehen:
1. Bezug zum letzten Kontakt herstellen
2. Neuen Mehrwert bieten (nicht "wollen wir nochmal reden")
3. Konkreten, kleinen next step vorschlagen
4. Zeitrahmen vorschlagen`,

    analyse: `MODUS: LEAD ANALYSE
Der Nutzer möchte den Lead verstehen.
Vorgehen:
1. Company-Informationen zusammenfassen
2. Trigger Events bewerten (Signifikanz)
3. Passung Offering ↔ Company einschätzen
4. Konkrete nächste Schritte empfehlen`,
  }

  return instructions[actionId] || ''
}

// ============================================================================
// 6. HELPER — Context formatieren für UI-Anzeige
// ============================================================================

/**
 * Gibt eine kurze Zusammenfassung des Kontexts für die UI zurück
 */
export function getContextSummary(context) {
  if (!context) return null

  const parts = []
  if (context.company?.name) parts.push(context.company.name)
  if (context.offering?.name) parts.push(context.offering.name)
  if (context.triggers?.length > 0) parts.push(`${context.triggers.length} Trigger`)
  if (context.contacts?.length > 0) parts.push(`${context.contacts.length} Kontakt(e)`)

  return parts.length > 0 ? parts.join(' · ') : null
}

/**
 * Gibt den Kontext als strukturierte Nachricht für den User zurück
 */
export function formatContextForUser(context) {
  if (!context) return 'Kein Lead ausgewählt.'

  const lines = []
  if (context.company?.name) {
    lines.push(`**Unternehmen:** ${context.company.name}${context.company.industry ? ` (${context.company.industry})` : ''}`)
  }
  if (context.offering?.name) {
    lines.push(`**Offering:** ${context.offering.name}`)
  }
  if (context.triggers?.length > 0) {
    lines.push(`**Trigger:** ${context.triggers.map(t => t.content).join('; ')}`)
  }
  if (context.contacts?.length > 0) {
    lines.push(`**Kontakte:** ${context.contacts.map(c => `${c.name} (${c.role})`).join(', ')}`)
  }

  return lines.join('\n') || 'Keine spezifischen Daten für diesen Lead.'
}
