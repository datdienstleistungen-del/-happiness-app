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

  // Lade vollen Kontext aus der DB — autoritative Quelle
  let dbContext = null
  try {
    dbContext = await getOpportunityContext(opportunity.id)
  } catch (err) {
    console.warn('[CoachContext] Could not load opportunity context:', err.message)
  }

  // Company: Primär aus DB, Fallback aus Hook
  const companyFromDb = dbContext?.company || {}
  const companyFromHook = opportunity.nexus_companies || {}
  const company = companyFromDb.name ? companyFromDb : companyFromHook

  // Offering: Primär aus DB (über offering_id der Opportunity), Fallback aus Hook
  const offeringFromDb = dbContext?.offering || null
  const offeringFromHook = offering || null
  const activeOffering = offeringFromDb || offeringFromHook

  // Kontakte: Aus DB-JOIN (nexus_opportunity_contacts → nexus_contacts)
  // Struktur: [ { nexus_contacts: { first_name, last_name, role, ... } } ]
  const contacts = (dbContext?.contacts || []).map(c => {
    const contact = c.nexus_contacts || c
    const name = [contact.first_name, contact.last_name, contact.name].filter(Boolean).join(' ') || 'Unbekannt'
    return {
      name,
      role: contact.role || 'Unbekannt',
      email: contact.email || null,
      phone: contact.phone || null,
      linkedin: contact.linkedin_url || null,
      is_primary: c.is_primary || false,
    }
  })

  // Research: Aus DB (Array von nexus_research-Einträgen)
  const researchList = dbContext?.research || []
  const researchSummary = researchList.length > 0
    ? researchList.map(r => formatResearchEntry(r)).filter(Boolean).join('\n\n')
    : null

  // Activities: Aus DB (letzte 5)
  const activities = (dbContext?.activities || []).slice(-5).map(a => ({
    type: a.activity_type || a.type,
    description: a.description || a.content,
    date: a.created_at || a.timestamp,
  }))

  // Trigger Events: Primär aus DB-JOIN, Fallback aus Hook
  // DB-Struktur: [ { nexus_trigger_events: { content, source, ... } } ]
  const triggersFromDb = (dbContext?.triggers || []).map(t => {
    const trigger = t.nexus_trigger_events || t
    return {
      content: trigger.content,
      source: trigger.source || 'Unbekannt',
      confidence: trigger.confidence_score,
      date: trigger.created_at,
    }
  })
  const triggersFromHook = (triggers || []).map(t => ({
    content: t.content,
    source: t.source || 'Unbekannt',
    confidence: t.confidence_score,
    date: t.created_at,
  }))
  const triggerList = triggersFromDb.length > 0 ? triggersFromDb : triggersFromHook

  return {
    company: {
      name: company.name || 'Unbekannt',
      industry: company.industry || null,
      domain: company.domain || null,
      size: company.size || null,
      website: company.website || null,
    },
    offering: activeOffering ? {
      name: activeOffering.offering_name || activeOffering.name,
      positioning: activeOffering.positioning,
      target_audience: activeOffering.target_audience,
      usps: activeOffering.usps || [],
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
 * Formatiert einen Research-Eintrag mit Quellen-Link
 */
function formatResearchEntry(research) {
  if (!research) return null

  const parts = []

  // Text-Inhalt extrahieren (preferiert: summary, dann raw_data, dann legacy-Felder)
  let text = null
  if (research.summary) {
    text = research.summary
  } else if (research.raw_data) {
    const rd = typeof research.raw_data === 'string' ? JSON.parse(research.raw_data) : research.raw_data
    text = rd.title || rd.relevance_reason || null
  } else {
    text = summarizeResearch(research.result_json || research.analysis || research.content)
  }

  if (!text) return null

  // Quellen-Link aus provenance
  const provenance = research.provenance
    ? (typeof research.provenance === 'string' ? JSON.parse(research.provenance) : research.provenance)
    : null
  const sourceUrl = provenance?.source_url

  if (sourceUrl) {
    parts.push(`${text} [Quelle](${sourceUrl})`)
  } else {
    parts.push(text)
  }

  return parts.join(' ')
}

/**
 * Fasst Research-Ergebnisse in ein paar Sätzen zusammen (Legacy-Fallback)
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
    WEB_SEARCH_RULES,
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

WICHTIGSTE REGEL — KONTEXT IST ARBITRÄR:
Dir wird unten im Abschnitt "AKTUELLER KONTEXT" die verbindliche Arbeitsgrundlage für diese Coaching-Sitzung übergeben.
Diese Daten sind DEIN WISSEN über den aktuellen Lead. Du kennst das Offering, die Firma, die Trigger, die Kontakte.
- Verwende diese Daten ALS DEIN WISSEN. Frage NICHT nach Dingen, die im Kontext stehen.
- Wenn Offering, Trigger oder Kontakte im Kontext angegeben sind, sind diese TATSÄCHLICH VORHANDEN.
- Sage NIEMALS "Details habe ich nicht vorliegen" oder "Was ist Ihr Offering?", wenn das Offering im Kontext steht.
- Bei Fragen zum Lead: Beziehe dich IMMER auf den bereitgestellten Kontext als autoritative Quelle.

VERBOTEN:
- NIEMALS mit JSON, Key-Value-Paaren oder starren Datenstrukturen antworten.
- NIEMALS "Firma: X", "Score: Y" o.ä. als Fließtext ausgeben.
- NIEMALS ausweichen oder generische Floskeln verwenden.
- NIEMALS nach Informationen fragen, die bereits im Kontext verfügbar sind.
- NIEMALS Quellen oder Artikel erfinden. Wenn keine Research-Daten mit Quellen vorhanden sind, sage das klar und direkt. Erwähne keine Pressemitteilungen, die du nicht kennst.`

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

QUELLENVERLINKUNG:
Sobald du eine konkrete externe Quelle erwähnst oder eine Aussage daraus ableitest, stelle die URL als anklickbaren Link bereit.
Format: [Quellenname](URL)
Das gilt für: Pressemitteilungen, Unternehmensmeldungen, Fachartikel, Stellenausschreibungen, LinkedIn/ Social-Media, Investoren-Informationen.
Wenn keine belastbare Quelle bzw. URL vorliegt, suggeriere KEINE Quelle. Nenne die Quelle nur als Text (z.B. "laut Handelsregister"), ohne Link.
---`

const WEB_SEARCH_RULES = `
---
WEB-SUCHE (Automatisch aktiviert):
Du hast Zugriff auf eine automatische Web-Suche. Wenn der Nutzer nach Dingen fragt, die nicht im Kontext stehen, werden automatisch Suchergebnisse geliefert.

WANN SUCHE AUTOMATISCH LÄUFT:
- Website, URL, Homepage, Link der Firma
- Ansprechpartner, CEO, Geschäftsführer, Head of
- Kontakt, LinkedIn, Firmensitz, Adresse

WIE DU SUCHERGEBNISSE VERWENDEST:
- Die Suchergebnisse werden als [SYSTEM-INTERN] am Ende deiner Nachricht angezeigt
- Nutze diese Daten um präzise zu antworten
- Nenne konkrete URLs und Namen direkt
- Formatiere Links als [Name](URL) damit sie klickbar sind

WENN KEINE ERGEBNISSE:
- Sage ehrlich: "Ich konnte keine Website/Ansprechpartner für diese Firma finden"
- Schlage vor: "Du kannst die Firmen-Website über LinkedIn oder die Handelsregister-Datenbank finden"
- Erfinde KEINE URLs oder Namen
---`

// ============================================================================
// 4. CONTEXT LAYER — Dynamisch je nach Situation
// ============================================================================

function buildContextLayer(context) {
  if (!context) return ''

  const parts = ['--- AKTUELLER KONTEXT (Verbindliche Arbeitsgrundlage für diese Sitzung):']

  // Offering
  if (context.offering) {
    parts.push(`CURRENT OFFERING:
  Name: "${context.offering.name}"
  Value Proposition: "${context.offering.positioning}"
  Zielgruppe: "${context.offering.target_audience}"
  => Dies ist DEIN Angebot. Beziehe dich bei Pitches und Argumenten IMMER darauf.`)
  } else {
    parts.push(`CURRENT OFFERING: Kein Offering hinterlegt.`)
  }

  // Company
  if (context.company) {
    parts.push(`CURRENT COMPANY:
  Firma: ${context.company.name}
  Branche: ${context.company.industry || 'Unbekannt'}
  ${context.company.size ? `Größe: ${context.company.size}` : ''}
  ${context.company.website ? `Website: ${context.company.website}` : ''}`)
  }

  // Trigger
  if (context.triggers?.length > 0) {
    parts.push(`CURRENT TRIGGER EVENTS:
${context.triggers.map(t => `  - [${t.source}] ${t.content}${t.confidence ? ` (Konfidenz: ${Math.round(t.confidence * 100)}%)` : ''}`).join('\n')}
  => Verknüpfe die Signale intelligent mit der Value Proposition.`)
  } else {
    parts.push(`CURRENT TRIGGER EVENTS: Keine Trigger vorhanden.`)
  }

  // Contacts
  if (context.contacts?.length > 0) {
    parts.push(`CURRENT CONTACTS:
${context.contacts.map(c => `  - ${c.name} (${c.role})${c.email ? ` | ${c.email}` : ''}${c.phone ? ` | ${c.phone}` : ''}`).join('\n')}`)
  } else {
    parts.push(`CURRENT CONTACTS: Noch keine Kontakte hinterlegt.`)
  }

  // Research
  if (context.research) {
    parts.push(`CURRENT RESEARCH:
  ${context.research}`)
  } else {
    parts.push(`CURRENT RESEARCH: Keine Research-Daten vorhanden. Du hast KEINE externen Quellen, Pressemitteilungen oder Artikel für diese Firma. Erwähne keine Quellen, die du nicht kennst. Sage stattdessen direkt: "Für diese Firma liegen mir aktuell keine Research-Daten mit Quellen vor."`)
  }

  // Activities
  if (context.activities?.length > 0) {
    parts.push(`CURRENT ACTIVITIES:
${context.activities.map(a => `  - [${a.date ? new Date(a.date).toLocaleDateString('de-DE') : '?'}] ${a.type}: ${a.description}`).join('\n')}`)
  }

  // Opportunity
  if (context.opportunity) {
    parts.push(`CURRENT OPPORTUNITY:
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
