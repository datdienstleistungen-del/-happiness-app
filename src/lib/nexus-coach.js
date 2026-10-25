/**
 * NeXus DealCoach Module
 * 
 * Context Builder + System-Prompt-Trennung für den DealCoach.
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

const LANGUAGE_NAMES = {
  de: 'Deutsch',
  en: 'English',
  es: 'Español',
  fr: 'Français',
  it: 'Italiano',
  nl: 'Nederlands',
  el: 'Ελληνικά (Greek)'
};

// Verhindert Halluzinationen von Zahlen und Referenzen, die den Vertriebler blamieren und NeXus verbrennen.
const WAHRHEITSREGEL = `WAHRHEITSREGEL:
Du darfst NUR Aussagen treffen, die durch den übergebenen Kontext (Trigger, Angebot, Ansprechpartner, Quellen) belegt sind. 

STRENG VERBOTEN:
- Erfundene Zahlen ("15 % Steigerung", "6 Wochen kürzer")
- Erfundene Referenzen ("bei Siemens, Bosch, Telekom")
- Erfundene Ergebnisse ("in vergleichbaren Projekten")
- Erfundene Zeitangaben ("innerhalb von zwei Wochen")
- Erfundene Kunden ("unser Kunde XY")
- Erfundene Fallstudien ("ein ähnlicher Fall zeigte...")

ERLAUBT:
- Aussagen, die direkt aus dem Trigger abgeleitet sind
- Aussagen, die direkt aus dem Angebot abgeleitet sind
- Allgemeine Formulierungen ohne konkrete Zahlen: "Wir haben Erfahrung mit ähnlichen Fällen", "Wir können Ihnen eine Übersicht schicken, wie wir dort vorgehen"
- Wenn echte Zahlen im Kontext stehen: Diese dürfen zitiert werden

BEI UNSICHERHEIT:
Wenn du keine belegten Zahlen hast, formuliere ohne Zahlen. 
Lieber vage und ehrlich als konkret und erfunden.`;

/**
 * Baut den System-Prompt für den Coach auf.
 * Schichten: WAHRHEITSREGEL | Basis | NeXus-Wissen | Vertriebswissen | Kontext | Grounding
 * 
 * @param {object} context - Aus buildCoachContext()
 * @param {string|null} quickAction - Aktive Quick-Action (pitch, einwand, followup, analyse)
 * @param {string} lang - Die gewählte Sprache des Nutzers (z.B. 'en', 'de', 'es', etc.)
 * @returns {string} Der vollständige System-Prompt
 */
export function buildCoachSystemPrompt(context, quickAction = null, lang = 'de') {
  const layers = [
    WAHRHEITSREGEL,
    getBasePrompt(lang),
    NEXUS_KNOWLEDGE,
    MANDATE_GOVERNANCE_KNOWLEDGE,
    MANDATE_OUTREACH_KNOWLEDGE,
    buildContextLayer(context),
    GROUNDING_RULES,
    WEB_SEARCH_RULES,
    quickAction ? getQuickActionInstruction(quickAction) : '',
  ]

  return layers.filter(Boolean).join('\n\n')
}

// ============================================================================
// 3. PROMPT-LAYERS — Mandate Origination & Governance Desk
// ============================================================================

function getBasePrompt(lang = 'de') {
  const targetLanguage = LANGUAGE_NAMES[lang] || 'Deutsch';
  const currentYear = new Date().getFullYear();
  return `Du bist NeXus DealCoach — der hochspezialisierte Sparringspartner für Executive Mandate, Interim Management (C-Level/Board), Organ-Vakanzen und Restrukturierungs-Governance im europäischen Markt.
ZEITSTAND & HEUTIGES JAHR: ${currentYear}. (Beziehe Recherchen und Zeithorizonte immer auf ${currentYear}, niemals veraltete Jahreszahlen).
Du kennst den NeXus Mandate Origination Desk bis ins kleinste Detail und lieferst sofort einsatzbereite, hochdiskrete Ergebnisse für Aufsichtsräte, Gesellschafter, Beiräte und Vorstände.

DEIN VERHALTEN & SPRACHREGEL:
- Antworte IMMER in der Sprache des Nutzers: ${targetLanguage}.
- Tonalität: Diskret, analytisch, auf Organ- und Aufsichtsratsebene ("Board-Level"). Keine flapsigen Floskeln, kein "Kaltakquise-Sprech".
- Bei Organvakanzen (CEO, CFO, CRO, COO, Aufsichtsrat) steht immer die Governance-Kontinuität, der Vakuum-Handlungsdruck und die Notlösung im Fokus.
- Keine langen Meta-Vorträge – erstelle direkt den fertigen Text, die Vakanz-Analyse, die Budget-Kalkulation oder die Ansprache.

MANDATS-RECHERCHE & BOARD-ANSPRACHE:
- Wenn der Nutzer nach Verantwortlichen fragt (z. B. Aufsichtsratsvorsitzender, Gesellschafter, Nominierungsausschuss):
  1. Liefere direkte, anklickbare LinkedIn- und Such-Links in einer sauberen Tabelle.
  2. Nenne die exakte Gremienrolle (z. B. Vorsitzender des Prüfungsausschusses, Lead Independent Director).
  3. Beispiel für das Tabellen-Format:
     | Gremium / Organ | Funktion | Relevanz für Mandat | 1-Klick Recherche | Diskreter Ansprache-Winkel |
     |---|---|---|---|---|
     | Aufsichtsrat / Board | AR-Vorsitzender / Nominierungsausschuss | Entscheider über Interim-CEO / CRO | [Suche](https://www.google.com/search?q=FIRMA+Aufsichtsrat) | Not-Governance & temporäre Amtsübernahme |

VERBOTEN:
- NIEMALS generische Floskeln ("Wie kann ich helfen?") oder Ratschläge für Kaltakquise / Social Media Influencing.
- NIEMALS erfundene Zahlen oder Referenzen (siehe WAHRHEITSREGEL).
- Keine Verweise auf Video-Editing, CapCut, TikTok oder Consumer-Content.`;
}

const NEXUS_KNOWLEDGE = `---
WAS IST DER NeXus MANDATE ORIGINATION DESK?
NeXus ist die führende Plattform zur automatisierten Identifikation und Vorbereitung von europäischen C-Level- und Board-Mandaten.
Es überwacht europäische Primärquellen (DACH EQS, UK LSE RNS, Schweiz SHAB, Südeuropa CNMV & AMF) mit einem strikten 48-Stunden-Zeitfenster auf Organ-Vakanzen, Amtsniederlegungen, Restrukturierungen und Not-Governance-Bedarf.

KERNMODULE:
1. NeXus Dashboard (/nexus/dashboard):
   - Zentrale Steuerungszentrale für Pipeline-Übersicht, Konversionsraten, aktive Opportunities und Mandatsstatistiken.
2. Mandatsereignisse (/nexus/events):
   - Strukturierte Überwachung europäischer Primärquellen im strikten 48h-Zeitfenster.
3. Mandats-Archiv (/nexus/mandats-archiv):
   - Tracking- und Nachweis-Tabelle für übermittelte Mandate mit 12 Monaten Kundenschutz.
4. Sales Workspace (/nexus/sales-workspace):
   - Zentrales Opportunity-Cockpit mit integriertem DealCoach-Audit (Stufe 2), Vakuum-Check und Frische-Ampel:
     * DealCoach Prüf-Panel: Automatische Einstufung in Tier 1 Top (Großunternehmen/Börse) vs. Tier 2 Mid (Mittelstand).
     * Human-in-the-Loop Prüfung: Vorlage in Harros Prüf-Inbox zur Chefsache-Freigabe.
     * Aktion (Outreach): Maßgeschneiderte Direktansprache für Mandatsanlässe.
5. DealCoach (/coach):
   - Intelligenter Sparringspartner für Mandatsakquise, Einwandbehandlung, Organ-Vakanzanalyse und Verhandlungsstrategie.

GRENZEN VON NeXus:
- NeXus liefert fundierte Chancen und Echtzeit-Signale, keine Erfolgsgarantien.
- Menschliche Endabnahme (Harro Goerndt) vor jedem externen Mandatsversand.
---`;

const MANDATE_GOVERNANCE_KNOWLEDGE = `---
GOVERNANCE- & MANDATS-EXPERTISE (C-LEVEL & BOARD LEVEL):

1. VAKUUM-CHECK & HANDLUNGSDRUCK:
   - Ist der Posten (CEO, CFO, CRO, Vorstand) per sofort vakant?
   - Liegt ein unplanmäßiger Abgang, eine fristlose Abberufung oder plötzliche Amtsniederlegung vor?
   - Handlungsdruck hoch: Ein Aufsichtsrat oder Beirat übernimmt interimistisch -> Mandatsbedarf für echten Interim-Vorstand binnen 30-90 Tagen extrem hoch.
   - Handlungsdruck niedrig: Geordnete Pensionierung mit 6-12 Monaten Vorlauf und interner Nachfolge -> Kein Interim-Mandat.

2. TIER-KLASSIFIZIERUNG & BUDGETS:
   - TIER 1 TOP: Großunternehmen / Börse / Enterprise:
     * Typische Rollen: Interim-CEO, CFO, CRO, Aufsichtsratsmandat
     * Tagessatz: 2.800 € – 3.800 €
     * Mandatsbudget (6–9 Monate): 150.000 € – 320.000 €
   - TIER 2 MID: Mittelstand ab 20 Mio. € Umsatz:
     * Typische Rollen: Interim-GF, CFO, PMO Restrukturierung, Sanierungsleitung
     * Tagessatz: 2.200 € – 2.800 €
     * Mandatsbudget (3–6 Monate): 80.000 € – 150.000 €

3. NOT-GOVERNANCE & RESTRUKTURIERUNG:
   - StaRUG (Unternehmensstabilisierungs- und -restrukturierungsgesetz)
   - Schutzschirmverfahren / Eigenverwaltung (§ 270 InsO)
   - Unverzügliche Bestellung eines CRO (Chief Restructuring Officer)
   - Vorbereitung eines anonymisierten Blind-Profils für Dealflow-Partner.
---`;

const MANDATE_OUTREACH_KNOWLEDGE = `---
MANDATS-AKQUISE & BOARD-LEVEL OUTREACH BEST PRACTICES:

1. ANSPRACHE-STRUKTUR (C-LEVEL / BOARD LEVEL):
   - Niemals marktschreierisch oder aggressiv. Diskret, präzise und partnerschaftlich.
   - Aufhänger: Das konkrete Ereignis (Ad-hoc-Meldung, Organwechsel, Not-Governance-Bedarf).
   - Problem: Die drohende Führungslücke / Übergangszeit bis zur Festanstellung.
   - Lösung: Sofortige Handlungsfähigkeit durch erfahrenen C-Level Interim Manager (Start binnen 48–72 Stunden).
   - Call-to-Action: Vertrauliches Sondierungsgespräch mit dem Aufsichtsratsvorsitzenden / Gesellschafter.

2. EINWANDBEHANDLUNG IM MANDATSBEREICH:
   - "Wir haben eine interne Übergangslösung (AR springt ein)" -> Bestätigen und anbieten: "Gerade um den Aufsichtsrat zeitnah wieder in seine Kontrollfunktion zu entlasten, stehen wir für die operative Überbrückung bereit."
   - "Tagessatz / Budget ist zu hoch" -> Gegenüberstellung: Kosten einer unbesetzten Schlüsselposition vs. Risikominimierung und sofortige Stabilität.
   - "Headhunter sucht bereits Festanstellung" -> Aufzeigen: Executive Search dauert 6–9 Monate. Der Interim Manager sichert das Tagesgeschäft und übergibt geordnet an den Nachfolger.
---`;

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
    vakuum: `MODUS: VAKUUM- & ORGAN-AUDIT
Der Nutzer möchte prüfen, ob bei diesem Unternehmen ein akuter Mandatsbedarf durch eine Organ-Vakanz besteht.
Vorgehen:
1. Prüfe die Organebene: Handelt es sich um CEO, CFO, CRO, COO oder Aufsichtsrat?
2. Vakuum-Check: Droht sofortiger Stillstand / Führungslosigkeit oder gibt es eine geordnete Nachfolge?
3. Notlösung prüfen: Springt ein Aufsichtsrat temporär ein? Gibt es Anzeichen für akute Not-Governance?
4. Urteil fällen: Einstufung in TIER 1 TOP, TIER 2 MID oder REJECTED mit klarer Begründung.`,

    pitch: `MODUS: C-LEVEL MANDATS-PITCH
Der Nutzer benötigt eine diskrete, hochkarätige Erstansprache für ein konkretes Mandat auf Organebene.
Halte dich strikt an die Board-Level Struktur (maximal 120 Wörter):
1. Diskret auf das Ereignis (Ad-hoc-Meldung, Amtsniederlegung) Bezug nehmen.
2. Den konkreten Nutzen für die Überbrückung der Führungslücke (sofortige Handlungsfähigkeit binnen 48-72h) aufzeigen.
3. Unverbindlichen, diskreten Austausch (Sondierungsgespräch mit AR/Gesellschafter) vorschlagen.
Beachte strikt die WAHRHEITSREGEL: Keine erfundenen Zahlen oder Referenzen!`,

    governance: `MODUS: NOT-GOVERNANCE & RESTRUKTURIERUNG
Der Nutzer analysiert ein Krisen- oder Restrukturierungsszenario (z.B. StaRUG, CEO-Abberufung, Sanierungsdruck).
Vorgehen:
1. Rechtlichen und operativen Handlungsdruck analysieren (StaRUG, Schutzschirm, Liquiditätsdruck).
2. Notwendige Sofortmaßnahmen für den Aufsichtsrat / Beirat skizzieren.
3. Anforderungsprofil für einen CRO oder Sanierungs-Geschäftsführer definieren.
4. Meilensteine für die ersten 30-90 Tage aufstellen.`,

    budget: `MODUS: TIER 1 / TIER 2 BUDGET-CHECK
Der Nutzer möchte das realistische Honorar- und Budget-Band für das Mandat ermitteln.
Vorgehen:
1. Einordnung nach Unternehmensgröße (Konzern / Börse = Tier 1 vs. Gehobener Mittelstand = Tier 2).
2. Empfohlenen Tagessatzbereich angeben (Tier 1: 2.800 € – 3.800 €, Tier 2: 2.200 € – 2.800 €).
3. Gesamtmandatsvolumen bei typischer Laufzeit (3–9 Monate) berechnen (150k–320k € bzw. 80k–150k €).
4. ROI-Argumentation gegenüber Gesellschaftern formulieren.`,

    dossier: `MODUS: BLIND-PROFIL & DEALFLOW-DOSSIER
Der Nutzer möchte ein anonymisiertes Mandats-Dossier erstellen, das an Partner und Mandats-Investoren weitergegeben werden kann, ohne die Identität des Unternehmens vor NDA-Unterzeichnung preiszugeben.
Vorgehen:
1. Erstelle ein prägnantes Blind-Profil (Branche, Umsatzgröße, Region, Vakanz-Anlass).
2. Hebe den konkreten Handlungsdruck und die Zielsetzung hervor.
3. Formuliere ein Teaser-Format für Partner, das Neugier weckt und höchste Diskretion wahrt.`,

    // Abwärtskompatibilität für alte Aufrufe
    einwand: `MODUS: EINWAND BEHANDELN
Der Nutzer hat einen Einwand von einem Aufsichtsrat, Gesellschafter oder Entscheider erhalten.
Vorgehen: Einwand sachlich validieren, Gegenüberstellung Risiko des Stillstands vs. Mandatsinvestition aufzeigen.`,

    followup: `MODUS: MANDATS-FOLLOW-UP
Der Nutzer benötigt ein diskretes Nachfassen für eine laufende Organbesetzung.`,

    analyse: `MODUS: MANDATS-ANALYSE
Der Nutzer möchte den Mandatsfall ganzheitlich analysieren (Organebene, Dringlichkeit, Handlungsdruck).`,
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
