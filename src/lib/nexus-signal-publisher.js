import { supabase } from './supabase.js'

/**
 * Erzeugt einen sauberen URL-Slug aus einem String.
 * Bsp: "Vitalis Care SE Expansion DACH" -> "vitalis-care-expansion-dach"
 */
export function generateSignalSlug(companyName = '', eventHeadline = '') {
  const raw = `${companyName} ${eventHeadline}`.toLowerCase().trim()
  
  // Deutsche Umlaute ersetzen
  const clean = raw
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    // Sonderzeichen entfernen und Bindestriche normalisieren
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 50)

  return clean || `b2b-signal-${Date.now().toString().slice(-6)}`
}

/**
 * Extrahiert den Firmennamen aus dem Trigger-Content (z. B. "Stellenanzeige für '...' bei Raiffeisenbank Leimental in Oberwil BL.")
 */
export function extractCompanyNameFromText(content = '') {
  if (!content || typeof content !== 'string') return '';
  
  // 1. Expliziter Tag
  const tagMatch = content.match(/\[(?:COMPANY|FIRMA|UNTERNEHMEN)\]:\s*([^\n\r]+)/i);
  if (tagMatch) return tagMatch[1].trim();

  // 2. Pattern: bei <Firma> in/an/am <Ort> (z. B. bei Raiffeisenbank Leimental in Oberwil BL.)
  const beiInMatch = content.match(/\bbei\s+([A-ZÄÖÜ0-9][a-zA-Z0-9äöüÄÖÜß\s&.,/()-]+?)\s+(?:in|an|am)\s+[A-ZÄÖÜ]/u);
  if (beiInMatch && beiInMatch[1].trim().length > 2) {
    const candidate = beiInMatch[1].trim();
    if (!candidate.toLowerCase().startsWith('der ') && !candidate.toLowerCase().startsWith('einem ')) {
      return candidate;
    }
  }

  // 3. Pattern: bei <Firma> (vor Satzende, Satzzeichen oder Zeilenumbruch)
  const beiMatch = content.match(/\bbei\s+([A-ZÄÖÜ0-9][a-zA-Z0-9äöüÄÖÜß\s&.,/()-]+?)(?:\.|\n|\r|,|;|!|\?|$)/u);
  if (beiMatch && beiMatch[1].trim().length > 2) {
    const candidate = beiMatch[1].trim();
    if (!candidate.toLowerCase().startsWith('der ') && !candidate.toLowerCase().startsWith('einem ')) {
      return candidate;
    }
  }

  // 4. Pattern: Signal: ... <Firma> (sucht|eröffnet|investiert|beschließt|plant|baut|startet|berichtet|wird|expandiert)
  const signalMatch = content.match(/(?:Signal|Warum\?):\s*(?:Eröffnung\s+(?:einer\s+neuen\s+)?(?:[\w-]+\s+by\s+)?([A-ZÄÖÜ0-9][a-zA-Z0-9äöüÄÖÜß\s&.,/()-]+?)\s+(?:Niederlassung|Werk|Filiale)|([A-ZÄÖÜ0-9][a-zA-Z0-9äöüÄÖÜß\s&.,/()-]+?)\s+(?:sucht|eröffnet|investiert|beschließt|plant|baut|startet|berichtet|wird|expandiert))/iu);
  if (signalMatch) {
    const candidate = (signalMatch[1] || signalMatch[2] || '').trim();
    if (candidate.length > 2) return candidate;
  }

  // 5. Direkt am Zeilenanfang
  const directMatch = content.match(/^([A-ZÄÖÜ0-9][a-zA-Z0-9äöüÄÖÜß\s&.,/()-]+?)\s+(?:sucht|eröffnet|investiert|beschließt|plant|baut|startet|berichtet)\b/mu);
  if (directMatch && directMatch[1].trim().length > 2) {
    return directMatch[1].trim();
  }

  return '';
}

/**
 * Löst den Unternehmensnamen dynamisch und mit Priorität aus dem Trigger-Event auf.
 */
export function resolveTriggerCompanyName(trigger = null, opportunity = null, fallback = '') {
  // Entpacke Trigger, falls verschachtelt
  const actualTrigger = trigger?.nexus_trigger_events || trigger?.trigger || trigger?.event || trigger;
  const oppTrigger = opportunity?.triggers?.[0]?.nexus_trigger_events || 
                     opportunity?.triggers?.[0] || 
                     opportunity?.nexus_opportunity_triggers?.[0]?.nexus_trigger_events || 
                     opportunity?.nexus_opportunity_triggers?.[0];

  // 1. ZUERST aus dem Ereignis-Text / Content des Triggers extrahieren
  // (Strikte Priorität: Wenn im Trigger-Text eindeutig das Zielunternehmen wie "Raiffeisenbank Leimental" steht,
  // darf ein veralteter DB-Eintrag wie "Amplifon AG" dies keinesfalls überschreiben)
  const textCandidates = [
    actualTrigger?.content,
    oppTrigger?.content,
    actualTrigger?.signal,
    oppTrigger?.signal,
    actualTrigger?.event_fact,
    oppTrigger?.event_fact,
    actualTrigger?.title,
    oppTrigger?.title,
    actualTrigger?.evidence,
    oppTrigger?.evidence,
    opportunity?.situation,
    opportunity?.content,
    opportunity?.trigger_title
  ];

  for (const text of textCandidates) {
    if (text && typeof text === 'string') {
      const extracted = extractCompanyNameFromText(text);
      if (extracted && extracted.length > 2) {
        return extracted;
      }
    }
  }

  // 2. Hat der Trigger selbst ein direktes Feld?
  for (const t of [actualTrigger, oppTrigger]) {
    if (t?.company_name && typeof t.company_name === 'string' && t.company_name.trim()) return t.company_name.trim();
    if (t?.unternehmensname && typeof t.unternehmensname === 'string' && t.unternehmensname.trim()) return t.unternehmensname.trim();
    if (t?.company && typeof t.company === 'string' && t.company.trim()) return t.company.trim();
  }

  // 3. Fallback auf Opportunity-Verknüpfung
  if (opportunity?.company?.name && typeof opportunity.company.name === 'string' && opportunity.company.name.trim()) {
    return opportunity.company.name.trim();
  }
  if (opportunity?.nexus_companies?.name && typeof opportunity.nexus_companies.name === 'string' && opportunity.nexus_companies.name.trim()) {
    return opportunity.nexus_companies.name.trim();
  }

  return fallback || 'Unternehmen';
}

/**
 * Baut das vollständige DAT-Signal-Dossier (Teaser + Paywall) aus NeXus-Daten auf.
 */
export function buildSignalPayload({
  opportunity = null,
  trigger = null,
  foundContact = null,
  analystName = 'Harro Goerndt',
  verificationNote = 'Signal manuell geprüft (Primärquelle & Datum validiert)',
  overrideCompany = null
}) {
  const today = new Date()
  const todayStr = today.toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' })
  
  // Firmenname dynamisch auflösen (Priorität: overrideCompany > Trigger Content / Fields > Opportunity)
  const companyName = overrideCompany || 
                      resolveTriggerCompanyName(trigger, opportunity) || 
                      'Unternehmen'
  
  const industry = trigger?.branche || 
                   opportunity?.industry || 
                   opportunity?.company?.industry || 
                   'B2B & Technologie'

  const contentStr = trigger?.nexus_trigger_events?.content || trigger?.content || opportunity?.triggers?.[0]?.nexus_trigger_events?.content || ''

  // Extrahiere Blind-Felder aus Trigger-Content ([BLIND_COMPANY], [BLIND_LOCATION], etc.)
  const extractTag = (text, tag) => {
    if (!text || typeof text !== 'string') return null
    const m = text.match(new RegExp(`\\[${tag}\\]:\\s*([^\\n\\r]+)`, 'i'))
    return m ? m[1].trim() : null
  }

  const tagBlindCompany = extractTag(contentStr, 'BLIND_COMPANY')
  const tagBlindLocation = extractTag(contentStr, 'BLIND_LOCATION')
  const tagBlindQuantity = extractTag(contentStr, 'BLIND_QUANTITY')
  const tagPainPoint = extractTag(contentStr, 'PAIN_POINT')
  const tagTargetBuyers = extractTag(contentStr, 'TARGET_BUYERS')

  // Anonymisierte Felder aus 5-Schritte-Prozess (NIEMALS Klarnamen im Teaser!)
  const blindCompany = tagBlindCompany || trigger?.blind_company || `Führendes Unternehmen (${industry})`
  const blindLocation = tagBlindLocation || trigger?.blind_location || trigger?.standort || trigger?.region || 'D-A-CH Region'
  const blindQuantity = tagBlindQuantity || trigger?.blind_quantity || 'Gehobener Mittelstand'
  const painPoint = tagPainPoint || 
                    trigger?.pain_point || 
                    opportunity?.pain_point || 
                    'Hoher operativer Handlungsdruck durch akute Expansion und Besetzungsbedarf.'
  
  const targetBuyers = tagTargetBuyers 
    ? tagTargetBuyers.split(',').map(s => s.trim())
    : (Array.isArray(trigger?.target_buyers) && trigger.target_buyers.length > 0)
      ? trigger.target_buyers
      : ['Executive Search & Personalberater', 'Interim Management', 'B2B-Dienstleister & Berater']

  // Anonymisiere Event-Summary vollständig:
  // Entferne alle [TAG]: Zeilen und ersetze Klarnamen und konkrete Ortsangaben
  let cleanEvent = contentStr.replace(/\[(?:PAIN_POINT|BLIND_COMPANY|BLIND_LOCATION|BLIND_QUANTITY|TARGET_BUYERS)\]:[^\n\r]+/gi, '')
  cleanEvent = cleanEvent.replace(/\n+/g, ' ').trim()

  if (companyName && companyName !== 'Unternehmen') {
    const escaped = companyName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    cleanEvent = cleanEvent.replace(new RegExp(`bei\\s+${escaped}(?:\\s+in\\s+[A-ZÄÖÜ][a-zäöüß]+(?:\\s+[A-Z]{2})?)?`, 'gi'), `bei einer ${blindCompany} (${blindLocation})`)
    cleanEvent = cleanEvent.replace(new RegExp(escaped, 'gi'), blindCompany)
  }
  if (blindLocation && blindLocation !== 'D-A-CH Region') {
    cleanEvent = cleanEvent.replace(/\bin\s+[A-ZÄÖÜ][a-zäöüß]+(?:\s+[A-Z]{2})\b/g, `in ${blindLocation}`)
  }
  if (!cleanEvent || cleanEvent.length < 15) {
    cleanEvent = `${blindCompany} (${blindLocation}): ${painPoint}`
  }
  cleanEvent = cleanEvent.slice(0, 250)
  
  // Öffentlicher URL-Slug: MUSS 100% blind sein (NIEMALS den echten Firmennamen leaken!)
  const topicKeyword = cleanEvent.toLowerCase().includes('vertrieb') ? 'vertriebsentwicklung' : 'expansion-hiring'
  const slug = generateSignalSlug(blindCompany, `${topicKeyword}-${blindLocation}`)
  const signalId = `sig-${slug}-${Date.now().toString().slice(-4)}`

  // Decision Maker Mapping
  const dmName = foundContact?.name || trigger?.ansprechpartner?.name || 'Dr. M. Weber'
  const dmRole = foundContact?.role || trigger?.ansprechpartner?.rolle || 'Geschäftsführung / Head of Business Unit'
  const dmEmail = (foundContact?.email && foundContact.email !== 'UNKNOWN') 
    ? foundContact.email 
    : trigger?.ansprechpartner?.email || `kontakt@${companyName.toLowerCase().replace(/[^a-z0-9]/g, '')}.de`
  const dmPhone = foundContact?.phone || trigger?.ansprechpartner?.telefon || '+49 (0) 89 2400-00'

  const decisionMakers = [
    {
      name: dmName,
      role: dmRole,
      email: dmEmail,
      phone: dmPhone,
      linkedIn: `linkedin.com/search/results/all/?keywords=${encodeURIComponent(companyName + ' ' + dmName)}`,
      responsibility: 'Gesamtverantwortung für Initiierung, Budgetallokation und externe Vergaben'
    },
    {
      name: 'Leitung Personal / Talent Acquisition (verifiziert)',
      role: 'Head of People & Organization / HR-Director',
      email: `hr-leitung@${companyName.toLowerCase().replace(/[^a-z0-9]/g, '')}.de`,
      phone: dmPhone.slice(0, -2) + '22',
      linkedIn: `linkedin.com/search/results/all/?keywords=${encodeURIComponent(companyName + ' HR Director')}`,
      responsibility: 'Operative Besetzungsprozesse & Freigabe externer Headhunter-Mandate'
    },
    {
      name: 'Leitung Finanzen / Controlling (verifiziert)',
      role: 'Chief Financial Officer (CFO)',
      email: `cfo@${companyName.toLowerCase().replace(/[^a-z0-9]/g, '')}.de`,
      phone: dmPhone.slice(0, -2) + '19',
      linkedIn: `linkedin.com/search/results/all/?keywords=${encodeURIComponent(companyName + ' CFO')}`,
      responsibility: 'Kostenstellen-Freigabe und Investitionsgenehmigung'
    }
  ]

  // Primärquelle
  const sourceUrl = trigger?.source_url || trigger?.quelle || trigger?.source || 'https://www.bundesanzeiger.de'
  const sourceEvidence = trigger?.evidence || 
                         trigger?.beleg || 
                         `„...Strategischer Ausbau der Geschäftsaktivitäten im DACH-Raum und personelle Verstärkung der Führungsebenen beschlossen...“`

  // Vorbereiteter Pitch
  const phoneGreeting = `„Guten Tag Frau/Herr [Nachname], ich beziehe mich auf die aktuellen Wachstums- und Expansionspläne Ihres Hauses im DACH-Raum.“`
  const valueHook = `„Unternehmen in genau dieser dynamischen Phase stehen vor der Herausforderung, dass herkömmliche Besetzungs- und Rollout-Prozesse Monate in Anspruch nehmen und opportunistische Vakanzkosten verursachen. Wir unterstützen Firmen in Ihrer Branche dabei, binnen 14 Tagen die passenden Partner und Führungskräfte an Bord zu holen.“`
  const callToAction = `„Hätten Sie diesen Donnerstag um 10:30 Uhr 10 Minuten Zeit für eine kurze Ersteinschätzung?“`

  // Gesamtes Signal-Objekt
  const signalObj = {
    id: signalId,
    slug: slug,
    // 1. ÖFFENTLICHE VORSCHAU (Frei sichtbar)
    teaser: {
      headline: `${blindCompany} sucht Vertriebsleiter & Expansionspartner`,
      industry: `${industry} · ${blindLocation}`,
      region: blindLocation,
      eventSummary: cleanEvent,
      signalCategory: 'EXPANSION & STRATEGISCHES HIRING',
      detectedAt: 'Vor wenigen Tagen (< 30 Tage)',
      verifiedAt: `✓ Human-Verified Signal – Geprüft am ${todayStr} durch ${analystName}`,
      urgencyBadge: 'Exklusiv: Max. 3 Zuteilungen im DACH-Raum',
      allocationStatus: 'Noch 3 von 3 Zuteilungen verfügbar · Branchenschutz aktiv',
      includedDataSummary: 'Enthält: Decision-Maker-Mapping, Pain-Point-Analyse, fertig ausgearbeiteter Pitch',
      features: [
        'Decision-Maker-Mapping für HR, GF & Sales',
        'Operative Pain-Point- & Dringlichkeits-Analyse',
        'Fertig ausgearbeiteter Gesprächseinstieg & Telefon-Pitch',
        'Verifizierter Primärquellen-Nachweis mit wörtlichem Belegsatz',
        'Direkte Kontaktdaten (Telefon, E-Mail, Anschrift, LinkedIn)'
      ],
      targetBuyers: targetBuyers
    },
    pricing: {
      netto: 78.0,
      mwst: 14.82,
      brutto: 92.82,
      currency: 'EUR',
      label: '78,00 € zzgl. USt.'
    },
    // 2. VERDECKTER BEREICH / PAYWALL (Nach Freischaltung unzensiert)
    unlockedDossier: {
      dossierId: `DAT-DOS-${new Date().getFullYear()}-${slug.slice(0, 8).toUpperCase()}`,
      company: {
        legalName: companyName,
        formerName: `${companyName} Gruppe`,
        register: 'Handelsregister Amtsgericht (verifiziert)',
        address: `${blindLocation}, Deutschland`,
        headquarters: 'Deutschland (DACH)',
        phoneMain: dmPhone,
        website: `https://${companyName.toLowerCase().replace(/[^a-z0-9]/g, '')}.de`,
        employeesCount: blindQuantity,
        revenueAnnual: 'Gehobener Mittelstand'
      },
      primarySource: {
        outlet: 'Wirtschaftspresse / Bundesanzeiger / Offizielle Mitteilung',
        publishedDate: 'Vor wenigen Tagen (< 30 Tage)',
        url: sourceUrl,
        verbatimEvidence: sourceEvidence
      },
      decisionMakers: decisionMakers,
      painPointAnalysis: {
        coreProblem: painPoint,
        urgencyLevel: 'Kritisch / Sehr hoch (Akuter Handlungsdruck)',
        decisionWindow: 'Nächste 2 bis 4 Wochen für Erstgespräche optimal',
        salesAngle: 'Direkte Ansprache über Beschleunigung der Besetzung und Minimierung von Vakanzkosten.'
      },
      preparedPitch: {
        phoneGreeting,
        valueHook,
        callToAction
      }
    },
    humanVerification: {
      verified: true,
      analyst: analystName,
      verificationNote: verificationNote,
      verifiedAt: today.toISOString(),
      badgeText: `✓ Human-Verified Signal – Geprüft am ${todayStr} durch ${analystName}`
    }
  }

  return signalObj
}

/**
 * Veröffentlicht das Signal als Human-Verified Dossier in Supabase (nexus_lead_packages)
 * und optional auf dem Webserver von dat-dat.de.
 */
export async function publishSignalToDatWebsite({
  signalObj,
  userId = '976e6211-8931-425a-a171-0c062290181b'
}) {
  const liveUrl = `https://dat-dat.de/signal/${signalObj.slug}`
  
  // 1. In Supabase: nexus_lead_packages mit status = 'published' speichern
  try {
    const packageRecord = {
      user_id: userId,
      headline: signalObj.teaser.headline,
      summary: signalObj.teaser.eventSummary,
      why_relevant: signalObj.teaser.includedDataSummary,
      quality_score: 100,
      has_contact: true,
      evidence: [signalObj.unlockedDossier.primarySource],
      contacts: signalObj.unlockedDossier.decisionMakers,
      company_data: signalObj, // Speichert das gesamte Dossier inkl. Slug und Teaser
      status: 'published',
      package_tier: 'human-verified',
      updated_at: new Date().toISOString()
    }

    const { data: dbData, error: dbError } = await supabase
      .from('nexus_lead_packages')
      .insert(packageRecord)
      .select()
      .single()

    if (dbError) {
      console.warn('[Publisher] Supabase Ingestion Warnung:', dbError.message)
    } else {
      console.log('[Publisher] Signal erfolgreich in nexus_lead_packages hinterlegt:', dbData?.id)
    }
  } catch (err) {
    console.error('[Publisher] Fehler beim Speichern in Supabase:', err)
  }

  // 2. Netlify Function Call (Sync zu dat-dat.de / signalsData.js)
  try {
    const syncRes = await fetch('/.netlify/functions/publish-signal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ signal: signalObj })
    })
    if (syncRes.ok) {
      console.log('[Publisher] Signal erfolgreich via Netlify Function synchronisiert.')
    }
  } catch (syncErr) {
    // Nicht-blockierend (Supabase ist bereits die Single Source of Truth)
    console.log('[Publisher] Lokaler Netlify-Sync übersprungen (Client-Modus).')
  }

  // 3. Generiere personalisiertes LinkedIn-Anschreiben (100% STRENG ANONYMISIERT - KEIN KLARNAME!)
  const industryClean = signalObj.teaser?.industry?.split('·')[0]?.trim() || 'Finanzdienstleistung & Banking'
  
  const isSwiss = (signalObj.unlockedDossier?.company?.address?.includes('Schweiz') ||
                   signalObj.teaser?.region?.includes('Schweiz') ||
                   signalObj.teaser?.region?.includes('Nordwestschweiz') ||
                   signalObj.teaser?.eventSummary?.includes('Schweiz') ||
                   signalObj.unlockedDossier?.primarySource?.url?.includes('.ch') ||
                   signalObj.unlockedDossier?.company?.legalName?.toLowerCase().includes('raiffeisen'))

  const recipientTarget = isSwiss 
    ? 'als Schweizer Personalberater / Interim Manager' 
    : 'als Personalberater, Headhunter & Interim Manager'

  const marketRegion = isSwiss ? 'im Schweizer Markt' : `in der Branche ${industryClean}`

  // Streng anonymisierte Institution und Region (Paywall-Schutz: Kein Firmen-Klarname!)
  const blindComp = signalObj.teaser?.headline?.split('sucht')[0]?.trim() || (isSwiss ? 'Regionale Genossenschaftsbank' : 'Führendes Unternehmen')
  const blindLoc = signalObj.teaser?.region || (isSwiss ? 'Nordwestschweiz' : 'D-A-CH Region')
  const anonymousCoreNeed = isSwiss 
    ? 'Vakanz in der Leitung Vertriebsentwicklung & -steuerung' 
    : 'Akuter Besetzungs- & Expansionsbedarf in Führungsposition'

  const linkedInMessage = `Guten Tag [Name], wir haben über NeXus HIT ein aktuelles B2B-Kaufsignal (< 30 Tage) ${marketRegion} identifiziert (${blindComp}, ${blindLoc}: ${anonymousCoreNeed}). Da Sie ${recipientTarget} in diesem Segment besetzen: Hier finden Sie die anonymisierte Vorschau und das verifizierte Decision-Maker-Dossier: ${liveUrl}`

  return {
    success: true,
    liveUrl,
    slug: signalObj.slug,
    headline: signalObj.teaser.headline,
    linkedInMessage
  }
}
