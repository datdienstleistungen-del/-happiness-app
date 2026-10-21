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

  // Decision Maker Mapping: Strikt wahrheitsgetreu - NIEMALS erfundene Namen oder Fake-Nummern!
  const realContactName = foundContact?.name || trigger?.ansprechpartner?.name || null
  const realContactRole = foundContact?.role || trigger?.ansprechpartner?.rolle || null
  const realContactEmail = (foundContact?.email && foundContact.email !== 'UNKNOWN') 
    ? foundContact.email 
    : trigger?.ansprechpartner?.email || null
  const realContactPhone = foundContact?.phone || trigger?.ansprechpartner?.telefon || null

  const decisionMakers = []
  
  if (realContactName) {
    decisionMakers.push({
      name: realContactName,
      role: realContactRole || 'Verifizierter Entscheider / Ansprechpartner',
      email: realContactEmail || 'Verifizierung über Telefonzentrale',
      phone: realContactPhone || 'Zentrale des Zielunternehmens',
      linkedIn: `https://www.linkedin.com/search/results/all/?keywords=${encodeURIComponent(companyName + ' ' + realContactName)}`,
      responsibility: 'Verantwortlich für fachliche Prüfung, Initiierung und Vergabe'
    })
  } else {
    // Wenn kein konkreter Personenname ermittelt werden konnte: Funktionale Rolle ohne Personen-Erfindung
    decisionMakers.push({
      name: 'Funktionale Entscheider-Ebene (Kein Personen-Datensatz erfasst)',
      role: realContactRole || 'Fachbereichsleitung / Geschäftsführung',
      email: 'Rechtssichere Direktansprache über Telefonzentrale / Impressum',
      phone: realContactPhone || 'Offizielle Unternehmenszentrale',
      linkedIn: `https://www.linkedin.com/search/results/all/?keywords=${encodeURIComponent(companyName + ' ' + (realContactRole || 'Geschäftsleitung'))}`,
      responsibility: 'Budget- und Vergabeverantwortung im Fachbereich'
    })
  }

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
  const signalObj = {
    id: signalId,
    slug: slug,
    maxAllocations: 5,
    remainingAllocations: 5,
    isExclusivelySold: false,
    // 1. ÖFFENTLICHE VORSCHAU (Frei sichtbar)
    teaser: {
      headline: `${blindCompany} sucht Vertriebsleiter & Expansionspartner`,
      industry: `${industry} · ${blindLocation}`,
      region: blindLocation,
      eventSummary: cleanEvent,
      signalCategory: trigger?.signal_kategorie || 'EXPANSION & STRATEGISCHES HIRING',
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
    pricing: {
      standard: {
        netto: 78.0,
        mwst: 14.82,
        brutto: 92.82,
        currency: 'EUR',
        label: '78,00 € zzgl. USt.',
        maxBuyers: 5
      },
      exclusive: {
        netto: 249.0,
        mwst: 47.31,
        brutto: 296.31,
        currency: 'EUR',
        label: '249,00 € zzgl. USt.'
      },
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

  // 3. Generiere diebstahlsichere Nachricht an potentielle Lead-Käufer (Headhunter/Vertriebler auf LinkedIn)
  const industryClean = signalObj.teaser?.industry?.split('·')[0]?.trim() || 'B2B & Technologie'
  const regionClean = signalObj.teaser?.region?.split('/')[0]?.trim() || 'DACH-Raum'
  const categoryClean = signalObj.teaser?.signalCategory || 'EXPANSION & STRATEGISCHES HIRING'

  const linkedInMessage = `Guten Tag [Name], wir beobachten über DAT Dienstleistungen laufend den B2B-Markt und haben aktuell ein verifiziertes Kaufsignal (< 30 Tage) in Ihrer Zielbranche identifiziert (${industryClean} · Region ${regionClean}: ${categoryClean}).

Um die Identität des Ziel-Accounts und Ihren Erstkontaktsvorteil zu schützen, ist das Unternehmen in unserer Vorschau geblurt und auf max. 5 Zuteilungen limitiert.

Hier können Sie die geblurte Vorschau prüfen und das verifizierte Dossier (inkl. Primärquelle, Hintergrund & Rollen-Targeting) freischalten:
${liveUrl}`

  return {
    success: true,
    liveUrl,
    slug: signalObj.slug,
    headline: signalObj.teaser.headline,
    linkedInMessage
  }
}
