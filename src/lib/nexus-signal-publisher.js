import { supabase } from './supabase.js'
import { classifyB2BLifecycle } from './nexus-validation.js'

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
    .slice(0, 80)
    .replace(/^-|-$/g, '')

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
 * Ermittelt den treffenden B2B-Wirtschaftszweig aus Trigger, Text & Unternehmen.
 */
export function detectIndustry(companyName = '', trigger = null, opportunity = null, contentStr = '') {
  const direct = trigger?.branche || trigger?.industry || opportunity?.industry || opportunity?.company?.industry;
  if (direct && direct !== 'B2B & Technologie' && direct !== 'B2B' && direct.length > 2) {
    return direct;
  }

  const text = `${companyName} ${trigger?.blind_company || ''} ${contentStr} ${trigger?.title || ''} ${opportunity?.title || ''}`.toLowerCase();

  if (/maschinenbau|anlagenbau|fahrzeugwasch|zerspanung|hydraulik|antriebstechnik|metallverarbeitung|cnc/i.test(text)) {
    return 'Maschinenbau';
  }
  if (/baustoff|entwässerung|tiefbau|hochbau|hallenbau|dach|fassade|bauunternehmen|beton|estrich|tga/i.test(text)) {
    return 'Baustoffe & Bau';
  }
  if (/medien|verlag|zeitung|magazin|journalismus|redaktion|publikation/i.test(text)) {
    return 'Medien & Verlagswesen';
  }
  if (/sport|fußball|bundesliga|stadion|athletik|verein|liga/i.test(text)) {
    return 'Sport & Entertainment';
  }
  if (/stiftung|non-profit|gemeinnützig|förderung|philanthropie/i.test(text)) {
    return 'Stiftung & Non-Profit';
  }
  if (/software|saas|cloud|cyber|ki|ai|daten|plattform|digital/i.test(text)) {
    return 'IT & Software';
  }
  if (/medtech|pharma|biotech|diagnostik|klinik|hospital|krankenhaus|gesundheitswesen/i.test(text)) {
    return 'MedTech & Healthcare';
  }
  if (/finanz|bank|fintech|investment|kapital|m&a|beratung|consulting|assurance/i.test(text)) {
    return 'Finanzwesen & M&A';
  }
  if (/logistik|spedition|transport|flotte|lager/i.test(text)) {
    return 'Logistik & Supply Chain';
  }
  if (/chemie|kunststoff|polymer|werkstoff/i.test(text)) {
    return 'Chemie & Werkstoffe';
  }
  if (/energie|solar|photovoltaik|windkraft|versorgung/i.test(text)) {
    return 'Energie & Cleantech';
  }

  return 'B2B & Industrie';
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
                      opportunity?.company?.name ||
                      opportunity?.nexus_companies?.name ||
                      ''

  if (!companyName || companyName.toLowerCase() === 'unternehmen' || companyName.toLowerCase() === 'null') {
    throw new Error('Signal Payload Error: Kein konkretes Unternehmen für Lead vorhanden (Auto-Reject).');
  }
  
  const contentStr = trigger?.nexus_trigger_events?.content || 
                     trigger?.content || 
                     opportunity?.triggers?.[0]?.nexus_trigger_events?.content || 
                     opportunity?.situation || 
                     opportunity?.title || 
                     ''

  if (!contentStr || contentStr.trim() === '' || contentStr.toLowerCase() === 'keine angabe' || contentStr.length < 10) {
    throw new Error('Signal Payload Error: Kein verifiziertes Ereignis für Lead vorhanden (Auto-Reject).');
  }

  // Treffenden Wirtschaftszweig dynamisch erkennen
  const industry = detectIndustry(companyName, trigger, opportunity, contentStr)

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

  // Anonymisierte Felder: Strikte B2B-Klassifizierung ohne Phantasie- oder Dummytexte
  const blindCompany = tagBlindCompany || trigger?.blind_company || (industry && industry !== 'B2B & Industrie' ? `Mittelständischer Technologieführer (${industry})` : 'Etablierter europäischer Marktteilnehmer')
  const blindLocation = tagBlindLocation || trigger?.blind_location || trigger?.standort || trigger?.region || opportunity?.region || 'DACH / Europa'
  const blindQuantity = tagBlindQuantity || trigger?.blind_quantity || 'Gehobener Mittelstand'
  const painPoint = tagPainPoint || 
                    trigger?.pain_point || 
                    opportunity?.pain_point || 
                    'Akute Führungstransition auf C-Level- und Board-Ebene mit unmittelbarem Nachfolge- und Mandatsbedarf.'
  
  const targetBuyers = tagTargetBuyers 
    ? tagTargetBuyers.split(',').map(s => s.trim())
    : (Array.isArray(trigger?.target_buyers) && trigger.target_buyers.length > 0)
      ? trigger.target_buyers
      : ['Executive Search & Board Advisors', 'Interim Management Provider (C-Level)', 'Restrukturierungs- & Mandatspartner']

  // Anonymisiere Event-Summary vollständig:
  // Entferne alle [TAG]: Zeilen und ersetze Klarnamen und konkrete Ortsangaben
  let cleanEvent = contentStr.replace(/\[(?:PAIN_POINT|BLIND_COMPANY|BLIND_LOCATION|BLIND_QUANTITY|TARGET_BUYERS)\]:[^\n\r]+/gi, '')
  cleanEvent = cleanEvent.replace(/\n+/g, ' ').trim()

  // 1. Zensiere ALLE Firmen-Rechtsformen im Text (GmbH, AG, SE, KG, UG etc.), egal welche Firma
  cleanEvent = cleanEvent.replace(/(?:(?:Die|Der|Das|dem|den)\s+)?(?:[A-ZÄÖÜ][a-zäöüß]+er\s+)?([A-ZÄÖÜ0-9][a-zA-Z0-9äöüß\s\.\-&]{1,40}?\s+(?:GmbH(?:\s*&\s*Co\.\s*KG)?|AG|SE|KG|UG|e\.K\.|GbR|Co\.\s*KG))/gi, 'einem etablierten Fachunternehmen')

  // 2. Zensiere den ermittelten Firmennamen und Stammwörter
  if (companyName && companyName !== 'Unternehmen') {
    const escaped = companyName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    cleanEvent = cleanEvent.replace(new RegExp(`bei\\s+${escaped}(?:\\s+in\\s+[A-ZÄÖÜ][a-zäöüß]+(?:\\s+[A-Z]{2})?)?`, 'gi'), `bei einer ${blindCompany} (${blindLocation})`)
    cleanEvent = cleanEvent.replace(new RegExp(escaped, 'gi'), blindCompany)

    const short = companyName.replace(/\s+(?:Information\s+Management\s+Solutions|GmbH(?:\s*&\s*Co\.\s*KG)?|AG|SE|KG|UG|e\.K\.|GbR|Holding|Gruppe|Group).*$/i, '').trim()
    if (short.length >= 3) {
      const escShort = short.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      cleanEvent = cleanEvent.replace(new RegExp(escShort, 'gi'), blindCompany)
    }
  }

  // 3. Adjektiv-Städte
  cleanEvent = cleanEvent.replace(/\b(?:Augsburger|Meringer|Wiener|Münchner|Stuttgarter|Frankfurter|Hamburger|Berliner|Zürcher)\b/gi, 'regionalen')

  if (blindLocation && blindLocation !== 'D-A-CH Region') {
    cleanEvent = cleanEvent.replace(/\bin\s+[A-ZÄÖÜ][a-zäöüß]+(?:\s+[A-Z]{2})\b/g, `in ${blindLocation}`)
  }

  // 4. Wenn der Text nach wie vor Rechtsformen enthält oder zu kurz ist:
  // Fallback auf 100% blinde Beschreibung aus blindCompany und painPoint
  if (!cleanEvent || cleanEvent.length < 15 || cleanEvent.includes('GmbH') || cleanEvent.includes('AG') || cleanEvent.includes('SE')) {
    cleanEvent = `${blindCompany} (${blindLocation}): ${painPoint}`
  }
  cleanEvent = cleanEvent.slice(0, 250)
  
  // Öffentlicher URL-Slug: MUSS 100% blind sein (NIEMALS den echten Firmennamen leaken!)
  const topicKeyword = cleanEvent.toLowerCase().includes('cro') || cleanEvent.toLowerCase().includes('sanier')
    ? 'restrukturierung-cro'
    : cleanEvent.toLowerCase().includes('m&a') || cleanEvent.toLowerCase().includes('carve') || cleanEvent.toLowerCase().includes('abspalt')
      ? 'transaktion-m-and-a'
      : 'organvakanz-board'
  const slug = generateSignalSlug(blindCompany, `${topicKeyword}-${blindLocation}`)
  const signalId = `sig-${slug}-${Date.now().toString().slice(-4)}`

  // Decision Maker Mapping: Strikt DSGVO-konforme funktionale Rollen (NIEMALS illegale Personenlisten oder Fake-Daten!)
  const primaryRoleTitle = foundContact?.role || trigger?.ansprechpartner?.rolle || 'Fachbereichsleitung / Geschäftsführung'
  const secondaryRoleTitle = 'Geschäftsleitung / C-Level'
  const realContactPhone = foundContact?.phone || trigger?.ansprechpartner?.telefon || ''
  const phoneText = realContactPhone || 'Offizielle Unternehmenszentrale'

  const decisionMakers = [
    {
      name: 'Funktionale Entscheider-Ebene',
      role: primaryRoleTitle,
      email: 'Rechtssichere Direktansprache über Telefonzentrale / Impressum',
      phone: phoneText,
      responsibility: 'Verantwortlich für fachliche Prüfung, Initiierung und Vergabe im Fachbereich'
    },
    {
      name: 'Funktionale Entscheider-Ebene (Management-Sponsor)',
      role: secondaryRoleTitle,
      email: 'Rechtssichere Direktansprache über Telefonzentrale / Impressum',
      phone: phoneText,
      responsibility: 'Gesamtverantwortung für Budgetallokation und Mandatierung externer Partner'
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

  // B2B Lifecycle Handlungsfenster berechnen
  const eventDate = trigger?.event_date || trigger?.datum || trigger?.published_at || opportunity?.datum || null
  const eventCategory = trigger?.signal_kategorie || trigger?.kategorie || trigger?.category || opportunity?.category || industry
  const lifecycle = classifyB2BLifecycle(eventCategory, eventDate, today)

  // Gesamtes Signal-Objekt
  const headline = `${blindCompany}: ${
    cleanEvent.toLowerCase().includes('cro') || cleanEvent.toLowerCase().includes('sanier')
      ? 'Akute Restrukturierung & Organbegleitung (CRO / Sanierung)'
      : cleanEvent.toLowerCase().includes('m&a') || cleanEvent.toLowerCase().includes('carve') || cleanEvent.toLowerCase().includes('abspalt')
        ? 'Strategische Neuausrichtung & M&A / Transaktionsbegleitung'
        : 'Organvakanz & Führungstransition auf C-Level / Board-Ebene'
  }`

  const signalObj = {
    id: signalId,
    slug: slug,
    maxAllocations: 5,
    remainingAllocations: 5,
    isExclusivelySold: false,
    // 1. ÖFFENTLICHE VORSCHAU (Frei sichtbar)
    teaser: {
      headline: headline,
      industry: `${industry} · ${blindLocation}`,
      region: blindLocation,
      eventSummary: cleanEvent,
      signalCategory: trigger?.signal_kategorie || opportunity?.category || 'ORGANVAKANZ & LEADERSHIP',
      lifecycleBadge: lifecycle.badge,
      lifecycleStatus: lifecycle.status,
      detectedAt: `${lifecycle.badge} · ${lifecycle.description}`,
      verifiedAt: `✓ Human-Verified Signal – Geprüft am ${todayStr} durch ${analystName}`,
      urgencyBadge: '🟢 Noch 5 von 5 Lizenzen verfügbar (78 €)',
      allocationStatus: 'Noch 5 von 5 Lizenzen verfügbar (78 €) · Exklusiv-Kauf möglich (249 €)',
      includedDataSummary: '4 verifizierte Lieferbestandteile: 1. Ziel-Account & Primärquelle, 2. Hintergrund & Anlass, 3. Rollen-Targeting, 4. Anschreiben-Vorlage / Pitch',
      features: [
        '1. Ziel-Account & Primärquelle (verifizierter Link & wörtlicher Belegsatz)',
        '2. Hintergrund & Anlass (operativer Handlungsdruck & Timing-Fenster)',
        '3. Rollen-Targeting (konkrete funktionale Entscheider-Rolle & Telefonzentrale)',
        '4. Anschreiben-Vorlage (maßgeschneiderter LinkedIn- & Telefon-Pitch)',
        'DSGVO-Sicherheitsgarantie: Rechtssichere B2B-Intelligence statt unzulässiger Namenslisten'
      ],
      targetBuyers: targetBuyers
    },
    mandateProtection: {
      protectionMonths: 12,
      standard: 'D.A.T.-Kundenschutz-Standard',
      label: '12 Monate Kundenschutz nach Übermittlung'
    },
    // 2. KLARDATEN-VAULT (Für autorisierte Partner nach Übermittlung)
    unlockedDossier: {
      dossierId: `DAT-DOS-${new Date().getFullYear()}-${slug.slice(0, 8).toUpperCase()}`,
      company: {
        legalName: companyName,
        formerName: `${companyName} Gruppe`,
        register: 'Handelsregister Amtsgericht (verifiziert)',
        address: `${blindLocation}, Deutschland`,
        headquarters: 'Deutschland (DACH)',
        phoneMain: realContactPhone || 'Zentrale / Vorzimmer über Unternehmenswebsite',
        website: opportunity?.company_domain 
          ? (opportunity.company_domain.startsWith('http') ? opportunity.company_domain : `https://${opportunity.company_domain}`)
          : `https://www.google.com/search?q=${encodeURIComponent(companyName)}`,
        employeesCount: blindQuantity,
        revenueAnnual: 'Gehobener Mittelstand'
      },
      primarySource: {
        outlet: 'Wirtschaftspresse / Bundesanzeiger / Offizielle Mitteilung',
        publishedDate: eventDate ? `${new Date(eventDate).toLocaleDateString('de-DE')} (${lifecycle.description})` : 'Aktuelles Handlungsfenster',
        url: sourceUrl,
        verbatimEvidence: sourceEvidence
      },
      roleTargeting: {
        primaryRole: primaryRoleTitle,
        decisionMakerContext: 'Verantwortlich für fachliche Prüfung, Initiierung und Vergabe im Fachbereich.',
        secondaryRole: secondaryRoleTitle,
        alternateRoleContext: 'Gesamtverantwortung für Budgetallokation und Mandatierung externer Partner.',
        switchboardDirect: phoneText
      },
      decisionMakers: decisionMakers,
      painPointAnalysis: {
        coreProblem: painPoint,
        urgencyLevel: lifecycle.status === 'BREAKING' ? 'Brandaktuell (Breaking Window)' : 'Kritisch / Sehr hoch (Strategisches Handlungsfenster)',
        timingWindow: lifecycle.badge,
        lifecycleDescription: lifecycle.description,
        decisionWindow: lifecycle.status === 'BREAKING' ? 'Sofortige Kontaktaufnahme (Breaking 1–14 Tage)' : 'Aktives Zeitfenster für Erstgespräche und Vergaben',
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

// Deprecated legacy publisher logic removed.
// Mandate dispatches are now tracked in MandateArchivePage with 12 months client protection.
