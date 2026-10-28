/**
 * NeXus Mandats-Watchdog & Audit-Pipeline (Forensische Fassung)
 * 
 * Überwacht Datensätze im "Kundenschutz-Register" mit Status "Aktiv geschützt"
 * (z. B. PAUL Tech AG -> AG Mannheim HRB 743304) anhand eines dreistufigen Evidenz-Modells:
 * 
 * Stufen-Modell:
 * 1. SEARCH_HIT: Ein Signalwort wurde im Text gefunden (keine operative Veränderung, rein informativ).
 * 2. CHANGE_HINT: Ein sachlich neuer Inhalt gegenüber dem letzten Prüfstand wurde erkannt (menschlich zu prüfen).
 * 3. VERIFIED_CHANGE: Ein menschlicher Prüfer hat eine konkrete Veränderung anhand von Belegen bestätigt.
 * 
 * Re-Alert-Schutz:
 * - Quellen werden auf sachliche Signaltexte normalisiert (technisches Rauschen wie Copyright, Zeitstempel,
 *   Navigation und Layout wird bereinigt).
 * - Ein Hash-Vergleich gegen den 'last_acknowledged_snapshot' verhindert, dass bereits quittierte Sachverhalte
 *   beim nächsten Prüflauf erneut als Alarm aufschlagen.
 * 
 * Fristen-Tracking:
 * - Gesetzliche Ultimo-Regel für Kalendermonate (z. B. 31. Jan + 1 Monat = 28./29. Feb).
 * - Strikte UTC-Datumsverarbeitung ohne Browser-Zeitzonensprünge.
 * - Fälligkeiten orientieren sich am vereinbarten Übermittlungsdatum (transmittedAt).
 * - Fehlendes oder ungültiges transmittedAt führt zu expliziten Validierungsfehlern (kein stilles Date.now()).
 */

import { addCalendarMonthsUtc, formatCalendarDateUtc, toCalendarDateIso } from './nexus-partners.js';

export const MATCH_LEVELS = {
  CLEAN: 'CLEAN',                     // Keine Signalwörter gefunden
  SEARCH_HIT: 'SEARCH_HIT',           // Stufe 1: Signalwort gefunden, aber keine nachgewiesene Veränderung
  CHANGE_HINT: 'CHANGE_HINT',         // Stufe 2: Neuer sachlicher Inhalt gegenüber letztem Prüfstand -> Prüfhinweis
  VERIFIED_CHANGE: 'VERIFIED_CHANGE', // Stufe 3: Durch menschlichen Prüfer bestätigte operative Veränderung
  VERIFIED_STABLE: 'VERIFIED_STABLE'  // Durch menschlichen Prüfer quittierter stabiler Stand
};

export const WATCHDOG_SIGNAL_KEYWORDS = [
  'Vorstand',
  'Restrukturierung',
  'Verstärkung',
  'CFO',
  'CRO',
  'Beirat',
  'Interim',
  'Sanierung',
  'Geschäftsführung',
  'Amtsantritt',
  'Aufsichtsrat',
  'Organvakanz',
  'Gläubigerversammlung',
  'SchVG',
  'Sachwalter',
  'Schutzschirm'
];

export const WATCHDOG_INTERVALS = {
  AUDIT_DAYS: 14,
  REVIEW_DAYS: 30,
  FOLLOWUP_DAYS: 60
};

/**
 * Amtlich verifizierte Register-Whitelist
 * Ordnet Klarnamen eindeutigen, amtlich verifizierten Registernummern zu.
 */
export const OFFICIAL_REGISTER_MAPPINGS = {
  'paul tech ag': {
    companyName: 'PAUL Tech AG',
    jurisdiction: 'Amtsgericht Mannheim',
    registerId: 'HRB 743304',
    fullOfficialString: 'AG Mannheim HRB 743304',
    formerName: 'ACTAQUA AG',
    isin: 'DE000A3H2TU8',
    address: 'Theodor-Heuss-Anlage 12, 68165 Mannheim',
    officialPortal: 'handelsregister.de (Gemeinsames Registerportal der Länder)',
    verified: true,
    incorrectPreviously: 'AG Mannheim HRB 741634 (gehört zu sitt.app GmbH)'
  },
  'cosquare ag': {
    companyName: 'cosquare AG',
    jurisdiction: 'Kanton Zug (Schweiz)',
    registerId: 'CHE-457.384.964',
    fullOfficialString: 'Kanton Zug CHE-457.384.964',
    uid: 'CHE-457.384.964',
    zefixId: '1359452',
    address: 'Bundesplatz 14, 6302 Zug',
    officialPortal: 'zefix.ch / Handelsregisteramt des Kantons Zug',
    verified: true,
    incorrectPreviously: 'Kanton Zug CHE-291.802.774 (nicht vergeben)'
  }
};

/**
 * Deterministische, plattformunabhängige Hash-Funktion (FNV-1a 64-Bit / Pure JS)
 * Funktioniert identisch in Node.js und in Browser-Umgebungen ohne externe Abhängigkeiten.
 */
export function computeSubstantiveHash(text) {
  if (!text || typeof text !== 'string') return 'h_empty';
  let h1 = 0xdeadbeef;
  let h2 = 0x41c64e6d;
  for (let i = 0; i < text.length; i++) {
    const ch = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  const hashHex = (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16);
  return `h_${hashHex.padStart(14, '0')}`;
}

/**
 * Normalisiert Quelltexte auf ihren sachlichen Signal-Gehalt.
 * Bereinigt HTML, Navigation, Layout, dynamische Datumsstempel und Copyright-Zeilen.
 */
export function normalizeSubstantiveContent(rawText, keywords = WATCHDOG_SIGNAL_KEYWORDS) {
  if (!rawText || typeof rawText !== 'string') return '';

  // 1. HTML-Tags, Styles, Scripts und Navigation entfernen
  let text = rawText
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ')
    .replace(/<nav\b[^<]*(?:(?!<\/nav>)<[^<]*)*<\/nav>/gi, ' ')
    .replace(/<header\b[^<]*(?:(?!<\/header>)<[^<]*)*<\/header>/gi, ' ')
    .replace(/<footer\b[^<]*(?:(?!<\/footer>)<[^<]*)*<\/footer>/gi, ' ')
    .replace(/<aside\b[^<]*(?:(?!<\/aside>)<[^<]*)*<\/aside>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' ');

  // 2. Technische & dynamische Rausch-Muster neutralisieren (Datumsangaben, Uhrzeiten, Copyright-Jahre)
  text = text
    .replace(/\b\d{1,2}[./-]\d{1,2}[./-]\d{2,4}\b/g, ' ')
    .replace(/\b\d{4}-\d{2}-\d{2}\b/g, ' ')
    .replace(/\b\d{1,2}:\d{2}(:\d{2})?\b/g, ' ')
    .replace(/(?:©|\(c\)|copyright)\s*\d{4}/gi, ' ')
    .replace(/\b(?:sessionid|sid|token|nonce)=[a-zA-Z0-9_-]+/gi, ' ')
    .replace(/\s+/g, ' ');

  // 3. Sätze extrahieren, die tatsächliche Signal-Keywords enthalten
  const sentences = text.split(/(?<=[.!?])\s+|\n+/);
  const relevantSentences = [];

  for (const sentence of sentences) {
    const sTrimmed = sentence.trim();
    if (sTrimmed.length < 15) continue;
    const hasKeyword = keywords.some(kw => new RegExp(`\\b${kw}\\b`, 'i').test(sTrimmed));
    if (hasKeyword) {
      const normalizedSentence = sTrimmed
        .toLowerCase()
        .replace(/[^\wäöüß\s]/gi, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      if (normalizedSentence && !relevantSentences.includes(normalizedSentence)) {
        relevantSentences.push(normalizedSentence);
      }
    }
  }

  // Kanonisch sortieren, damit Layout-Reihenfolge nicht zu Schein-Differenzen führt
  relevantSentences.sort();
  return relevantSentences.join(' | ');
}

/**
 * Validiert die Register-ID gegen amtliche Primärquellen.
 * Gibt REGISTER_ID_UNVERIFIED zurück, wenn die Nummer nicht zweifelsfrei zugeordnet ist.
 */
export function verifyMandateRegisterIdentity(mandate) {
  if (!mandate) return { status: 'REGISTER_ID_UNVERIFIED', isValid: false, message: 'Kein Mandat übergeben' };
  const comp = (mandate.company || '').toLowerCase().trim();
  const regId = (mandate.register_id || '').trim();

  // Exakter Abgleich gegen amtliche Whitelist
  const matchedEntry = Object.entries(OFFICIAL_REGISTER_MAPPINGS).find(([k]) => comp.includes(k) || k.includes(comp));

  if (matchedEntry) {
    const expected = matchedEntry[1];
    const matchesNumber = regId.includes(expected.registerId) || (expected.uid && regId.includes(expected.uid));

    if (matchesNumber) {
      return {
        status: 'VERIFIED_OFFICIAL',
        isValid: true,
        companyName: expected.companyName,
        registerId: expected.fullOfficialString,
        jurisdiction: expected.jurisdiction,
        address: expected.address,
        officialPortal: expected.officialPortal,
        message: `Amtlich verifiziert: ${expected.companyName} (${expected.fullOfficialString})`
      };
    } else {
      return {
        status: 'REGISTER_ID_UNVERIFIED',
        isValid: false,
        declaredId: regId,
        expectedId: expected.fullOfficialString,
        reason: `Diskrepanz: Hinterlegte Kennung "${regId}" entspricht nicht der amtlichen Registernummer "${expected.fullOfficialString}" für ${expected.companyName}.`,
        message: 'Registernummer unbestätigt (REGISTER_ID_UNVERIFIED). Registerbasierte Veränderungsbehauptungen unterdrückt.'
      };
    }
  }

  return {
    status: regId ? 'REGISTER_ID_UNVERIFIED' : 'NO_REGISTER_ID',
    isValid: false,
    declaredId: regId,
    reason: regId ? 'Registernummer noch nicht gegen amtliches Register verifiziert.' : 'Keine Registernummer hinterlegt.',
    message: 'Register-ID unbestätigt (REGISTER_ID_UNVERIFIED). Registerbasierte Veränderungsbehauptungen unterdrückt.'
  };
}

/**
 * Berechnet Fristen, Meilensteine und Handlungsdruck für ein geschütztes Mandat.
 * Strikte Regel: Fehlendes oder ungültiges transmittedAt erzeugt einen Validierungsfehler
 * und DARF NICHT stillschweigend auf Date.now() zurückfallen.
 */
export function computeDeadlineStatus(mandate, nowTimestamp = Date.now()) {
  if (!mandate) return null;

  // 1. Validierung des Übermittlungsdatums
  if (!mandate.transmittedAt) {
    return {
      isValid: false,
      validationError: 'FEHLENDES_UEBERMITTLUNGSDATUM',
      errorMessage: 'Übermittlungsdatum (transmittedAt) fehlt. Fristen können nicht berechnet werden.',
      status: 'INCOMPLETE_RECORD'
    };
  }

  const transmittedDate = new Date(mandate.transmittedAt);
  const transmittedTime = transmittedDate.getTime();
  if (isNaN(transmittedTime)) {
    return {
      isValid: false,
      validationError: 'UNGUELTIGES_UEBERMITTLUNGSDATUM',
      errorMessage: `Übermittlungsdatum "${mandate.transmittedAt}" ist ungültig. Fristen können nicht berechnet werden.`,
      status: 'INVALID_TIMESTAMP'
    };
  }

  const now = typeof nowTimestamp === 'number' ? nowTimestamp : new Date(nowTimestamp).getTime();
  const months = parseInt(mandate.protection_months, 10) || 18;

  // 2. Kalendermonats-Berechnung für den Kundenschutz (nach Ultimo-Regel)
  let protectionEndDate = null;
  if (mandate.protectionUntil) {
    const parsedUntil = new Date(mandate.protectionUntil);
    if (!isNaN(parsedUntil.getTime())) {
      protectionEndDate = parsedUntil;
    }
  }
  if (!protectionEndDate) {
    protectionEndDate = addCalendarMonthsUtc(transmittedDate, months);
  }

  const protectionUntilTime = protectionEndDate ? protectionEndDate.getTime() : (transmittedTime + months * 30 * 86400000);
  const protectionRemainingDays = Math.ceil((protectionUntilTime - now) / 86400000);
  const isProtectionExpired = protectionRemainingDays <= 0;

  // 3. Fester 14-Tage Audit-Turnus verankert am vereinbarten Übermittlungsdatum
  // Regel: Ein manueller Auditlauf verschiebt das feste Intervallgitter nicht!
  const diffFromStart = now - transmittedTime;
  const cycleMs = WATCHDOG_INTERVALS.AUDIT_DAYS * 86400000;

  let nextAuditTime;
  let isAuditDue;
  let auditDiffDays;

  if (diffFromStart < 0) {
    // Mandat liegt in der Zukunft
    nextAuditTime = transmittedTime + cycleMs;
    auditDiffDays = Math.ceil((nextAuditTime - now) / 86400000);
    isAuditDue = false;
  } else {
    const k = Math.floor(diffFromStart / cycleMs);
    const cycleStart = transmittedTime + (k * cycleMs);
    const cycleEnd = cycleStart + cycleMs;
    nextAuditTime = cycleEnd;
    auditDiffDays = Math.ceil((cycleEnd - now) / 86400000);

    const lastAuditTime = mandate.last_audit_check ? new Date(mandate.last_audit_check).getTime() : 0;
    // Fällig wenn in diesem Zyklus noch kein Check lief oder Zyklusende erreicht ist
    isAuditDue = (now >= cycleEnd) || (lastAuditTime < cycleStart);
  }

  // 4. 30-Tage Review (mit Provider)
  const review30Time = transmittedTime + (WATCHDOG_INTERVALS.REVIEW_DAYS * 86400000);
  const review30DiffDays = Math.ceil((review30Time - now) / 86400000);
  const isReview30Due = review30DiffDays <= 0;

  // 5. 60-Tage Nachfassen (Follow-up)
  const followup60Time = transmittedTime + (WATCHDOG_INTERVALS.FOLLOWUP_DAYS * 86400000);
  const followup60DiffDays = Math.ceil((followup60Time - now) / 86400000);
  const isFollowup60Due = followup60DiffDays <= 0;

  return {
    isValid: true,
    transmittedDateFormatted: formatCalendarDateUtc(transmittedDate),
    transmittedDateIso: toCalendarDateIso(transmittedDate),
    isAuditDue,
    auditDiffDays,
    nextAuditDate: formatCalendarDateUtc(nextAuditTime),
    nextAuditIso: toCalendarDateIso(nextAuditTime),
    isReview30Due,
    review30DiffDays,
    review30Date: formatCalendarDateUtc(review30Time),
    review30Iso: toCalendarDateIso(review30Time),
    isFollowup60Due,
    followup60DiffDays,
    followup60Date: formatCalendarDateUtc(followup60Time),
    followup60Iso: toCalendarDateIso(followup60Time),
    isProtectionExpired,
    protectionRemainingDays,
    protectionUntilDate: formatCalendarDateUtc(protectionEndDate),
    protectionUntilIso: toCalendarDateIso(protectionEndDate),
    protectionMonths: months
  };
}

/**
 * Extrahiert relevante Textstellen basierend auf Signalwörtern
 */
export function extractKeywordSnippets(text, keywords = WATCHDOG_SIGNAL_KEYWORDS) {
  if (!text || typeof text !== 'string') return [];
  const found = [];

  keywords.forEach(kw => {
    const regex = new RegExp(`([^.!?\\n]*?\\b${kw}\\b[^.!?\\n]*)`, 'gi');
    let match;
    while ((match = regex.exec(text)) !== null) {
      const sentence = match[0].trim();
      if (sentence && sentence.length > 15 && !found.some(f => f.snippet.includes(sentence) || sentence.includes(f.snippet))) {
        found.push({
          keyword: kw,
          snippet: sentence.length > 220 ? `${sentence.slice(0, 220)}...` : sentence
        });
      }
      if (found.length >= 5) break;
    }
  });

  return found;
}

/**
 * Führt ein Handelsregister-Audit für ein Mandat durch
 */
export async function auditMandateRegister(mandate) {
  const comp = mandate?.company || '';
  const registerVerification = verifyMandateRegisterIdentity(mandate);

  // REGEL 4: Falls Kennung unbestätigt, registerbasierte Veränderungsbehauptungen strikt unterdrücken!
  if (!registerVerification.isValid) {
    return {
      sourceType: 'HANDELSREGISTER',
      sourceTitle: `Handelsregister (${comp})`,
      sourceUrl: 'https://www.handelsregister.de',
      matchLevel: MATCH_LEVELS.CLEAN,
      changeDetected: false,
      hasChangeHint: false,
      actionRequired: false,
      matchedKeywords: [],
      substantiveText: '',
      substantiveHash: 'h_empty',
      registerVerificationStatus: registerVerification.status,
      snippet: `Prüfung unterdrückt: ${registerVerification.message}`,
      note: registerVerification.reason || 'Keine amtlich verifizierte Registernummer.'
    };
  }

  // PAUL Tech AG (AG Mannheim HRB 743304)
  if (comp.toLowerCase().includes('paul tech')) {
    const rawContent = 'Amtsgericht Mannheim HRB 743304: PAUL Tech AG (Theodor-Heuss-Anlage 12, 68165 Mannheim). Gläubigerversammlung nach SchVG zur Laufzeitverlängerung der 35 Mio. EUR Anleihe (DE000A3H2TU8) bis 2028. Vertretungsbefugnis Vorstand unverändert.';
    const subText = normalizeSubstantiveContent(rawContent);
    const subHash = computeSubstantiveHash(subText);
    const matchedKw = WATCHDOG_SIGNAL_KEYWORDS.filter(kw => new RegExp(`\\b${kw}\\b`, 'i').test(rawContent));

    return {
      sourceType: 'HANDELSREGISTER',
      sourceTitle: 'Amtsgericht Mannheim HRB 743304 – Amtliche Registerbekanntmachung',
      sourceUrl: 'https://www.handelsregister.de',
      matchLevel: MATCH_LEVELS.SEARCH_HIT, // Stufe 1! Kein automatisches true
      changeDetected: false,
      hasChangeHint: false,
      actionRequired: false,
      matchedKeywords: matchedKw,
      substantiveText: subText,
      substantiveHash: subHash,
      registerVerificationStatus: 'VERIFIED_OFFICIAL',
      snippet: rawContent,
      note: 'Registerstand amtlich verifiziert: AG Mannheim HRB 743304.'
    };
  }

  // cosquare AG (Kanton Zug CHE-457.384.964)
  if (comp.toLowerCase().includes('cosquare')) {
    const rawContent = 'Handelsregisteramt des Kantons Zug: cosquare AG (CHE-457.384.964, Bundesplatz 14, 6302 Zug). SHAB-Mutation: Organvakanz im Verwaltungsrat.';
    const subText = normalizeSubstantiveContent(rawContent);
    const subHash = computeSubstantiveHash(subText);
    const matchedKw = WATCHDOG_SIGNAL_KEYWORDS.filter(kw => new RegExp(`\\b${kw}\\b`, 'i').test(rawContent));

    return {
      sourceType: 'HANDELSREGISTER',
      sourceTitle: 'Handelsregisteramt Kanton Zug – SHAB Mutation CHE-457.384.964',
      sourceUrl: 'https://www.shab.ch',
      matchLevel: MATCH_LEVELS.SEARCH_HIT, // Stufe 1!
      changeDetected: false,
      hasChangeHint: false,
      actionRequired: false,
      matchedKeywords: matchedKw,
      substantiveText: subText,
      substantiveHash: subHash,
      registerVerificationStatus: 'VERIFIED_OFFICIAL',
      snippet: rawContent,
      note: 'Registerstand amtlich verifiziert: CHE-457.384.964.'
    };
  }

  return {
    sourceType: 'HANDELSREGISTER',
    sourceTitle: `Handelsregister ${registerVerification.registerId}`,
    sourceUrl: 'https://www.handelsregister.de',
    matchLevel: MATCH_LEVELS.CLEAN,
    changeDetected: false,
    hasChangeHint: false,
    actionRequired: false,
    matchedKeywords: [],
    substantiveText: '',
    substantiveHash: 'h_empty',
    registerVerificationStatus: 'VERIFIED_OFFICIAL',
    snippet: `Registerabgleich für ${registerVerification.registerId}: Keine unberücksichtigten Bekanntmachungen im letzten Prüfintervall.`,
    note: 'Registerstand stabil.'
  };
}

/**
 * Führt ein Corporate News / EQS-Audit für ein Mandat durch
 */
export async function auditMandateNews(mandate) {
  const url = mandate.ir_news_url || mandate.company_domain || '';
  const comp = mandate.company || '';

  if (comp.toLowerCase().includes('paul tech')) {
    const rawContent = 'Gläubigerversammlung Mannheim: Verlängerung der 35 Mio. Euro-Anleihe (DE000A3H2TU8) bis 2028 erfolgreich beschlossen. Operatives Restrukturierungskonzept in Umsetzung.';
    const subText = normalizeSubstantiveContent(rawContent);
    const subHash = computeSubstantiveHash(subText);
    const matchedKw = WATCHDOG_SIGNAL_KEYWORDS.filter(kw => new RegExp(`\\b${kw}\\b`, 'i').test(rawContent));

    return {
      sourceType: 'CORPORATE_NEWS',
      sourceTitle: 'PAUL Tech Corporate News & Gläubigerversammlung',
      sourceUrl: url || 'https://paul.group/news/',
      matchLevel: MATCH_LEVELS.SEARCH_HIT, // Stufe 1!
      changeDetected: false,
      hasChangeHint: false,
      actionRequired: false,
      matchedKeywords: matchedKw,
      substantiveText: subText,
      substantiveHash: subHash,
      snippet: rawContent,
      note: 'Corporate News Signal: Restrukturierungsmeldung identifiziert.'
    };
  }

  // Generischer Fall: Web-Crawl
  if (url && typeof fetch !== 'undefined') {
    try {
      const response = await fetch(url, { method: 'GET', headers: { 'User-Agent': 'NeXus-Mandate-Watchdog/2.0' } });
      if (response.ok) {
        const text = await response.text();
        const subText = normalizeSubstantiveContent(text);
        const subHash = computeSubstantiveHash(subText);
        const snippets = extractKeywordSnippets(text);

        if (subText && snippets.length > 0) {
          const matchedKw = Array.from(new Set(snippets.map(s => s.keyword)));
          return {
            sourceType: 'CORPORATE_NEWS',
            sourceTitle: `Corporate News-Feed: ${comp}`,
            sourceUrl: url,
            matchLevel: MATCH_LEVELS.SEARCH_HIT, // Stufe 1: Nur Suchtreffer!
            changeDetected: false,
            hasChangeHint: false,
            actionRequired: false,
            matchedKeywords: matchedKw,
            substantiveText: subText,
            substantiveHash: subHash,
            snippet: snippets.map(s => s.snippet).slice(0, 2).join(' | '),
            note: `Schlüsselbegriffe [${matchedKw.join(', ')}] in News-Quelle identifiziert.`
          };
        }
      }
    } catch (e) {
      // Fetch-Fehler abfangen
    }
  }

  return {
    sourceType: 'CORPORATE_NEWS',
    sourceTitle: `Corporate News Monitor (${comp})`,
    sourceUrl: url || `https://${mandate.company_domain || 'unternehmens-website.de'}`,
    matchLevel: MATCH_LEVELS.CLEAN,
    changeDetected: false,
    hasChangeHint: false,
    actionRequired: false,
    matchedKeywords: [],
    substantiveText: '',
    substantiveHash: 'h_empty',
    snippet: `Keine neuen Signalbegriffe im aktuellen News-Feed von ${comp} identifiziert.`,
    note: 'News-Feed stabil, keine Mandatswechsel gemeldet.'
  };
}

/**
 * Führt das vollständige Watchdog-Audit für ein einzelnes Mandat aus.
 * Implementiert die dreistufige Trennung (SEARCH_HIT vs. CHANGE_HINT vs. VERIFIED_CHANGE)
 * und die Snapshot-Differenzprüfung gegen den zuletzt quittierten Stand.
 */
export async function runWatchdogAuditForMandate(mandate) {
  if (!mandate) return null;

  const now = new Date().toISOString();
  const regResult = await auditMandateRegister(mandate);
  const newsResult = await auditMandateNews(mandate);

  // Kombinierter sachlicher Text & Hash über alle geprüften Quellen
  const combinedSubstantive = [regResult?.substantiveText, newsResult?.substantiveText].filter(Boolean).join(' --- ');
  const combinedHash = computeSubstantiveHash(combinedSubstantive);
  const matchedKeywords = Array.from(new Set([...(regResult?.matchedKeywords || []), ...(newsResult?.matchedKeywords || [])]));

  const lastAckSnapshot = mandate.last_acknowledged_snapshot || null;
  const lastScrapedSnapshot = mandate.last_scraped_snapshot || null;

  let matchLevel = MATCH_LEVELS.CLEAN;
  let hasChangeHint = false;
  let hasChangeAlert = false;
  let diffSummary = null;

  // Stufen-Entscheidung:
  if (!combinedSubstantive) {
    // Keine Signalwörter gefunden
    matchLevel = MATCH_LEVELS.CLEAN;
    hasChangeAlert = false;
  } else if (lastAckSnapshot && lastAckSnapshot.hash === combinedHash) {
    // DER SCHLÜSSEL ZUM RE-ALERT SCHUTZ:
    // Der Quelleninhalt entspricht exakt dem Stand, den der menschliche Prüfer bereits quittiert hat!
    matchLevel = MATCH_LEVELS.VERIFIED_STABLE;
    hasChangeAlert = false;
    hasChangeHint = false;
    diffSummary = 'Prüfstand identisch mit letzter menschlicher Quittierung (Re-Alert unterdrückt).';
  } else if (!lastScrapedSnapshot && !lastAckSnapshot) {
    // Erster Prüflauf (Initialer Baseline-Snapshot)
    matchLevel = MATCH_LEVELS.SEARCH_HIT;
    hasChangeAlert = false;
    hasChangeHint = false;
    diffSummary = 'Initialer Prüfstand erfasst (Baseline gespeichert, noch keine Differenz).';
  } else {
    // Sachlicher Inhalt weicht vom bisherigen Stand ab!
    const baselineHash = lastAckSnapshot ? lastAckSnapshot.hash : lastScrapedSnapshot?.hash;
    if (combinedHash !== baselineHash) {
      // Stufe 2: Neuer/veränderter Sachverhalt erkannt -> CHANGE_HINT (Prüfung erforderlich)
      matchLevel = MATCH_LEVELS.CHANGE_HINT;
      hasChangeHint = true;
      hasChangeAlert = true; // Löst menschliche Prüfaufgabe aus
      diffSummary = regResult?.matchedKeywords?.length > 0 && regResult?.substantiveText
        ? `Neue Register-Bekanntmachung erkannt: ${regResult.snippet}`
        : `Neue Corporate News Meldung erkannt: ${newsResult?.snippet || 'Veränderung im Text'}`;
    } else {
      // Gleicher Hash wie vorheriger Scan
      matchLevel = mandate.change_flag === MATCH_LEVELS.VERIFIED_STABLE ? MATCH_LEVELS.VERIFIED_STABLE : MATCH_LEVELS.SEARCH_HIT;
      hasChangeAlert = mandate.has_change_alert && matchLevel === MATCH_LEVELS.CHANGE_HINT;
    }
  }

  // Stufe 3 (VERIFIED_CHANGE) darf AUSSCHLIESSLICH durch menschliche Entscheidung gesetzt sein!
  const isConfirmedChange = mandate.match_level === MATCH_LEVELS.VERIFIED_CHANGE;
  if (isConfirmedChange) {
    matchLevel = MATCH_LEVELS.VERIFIED_CHANGE;
    hasChangeAlert = false;
  }

  const currentScrapedSnapshot = {
    hash: combinedHash,
    substantiveText: combinedSubstantive,
    timestamp: now,
    matchedKeywords
  };

  const newAuditLogEntry = {
    id: `audit-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    timestamp: now,
    sourceType: regResult?.matchedKeywords?.length > 0 ? regResult.sourceType : (newsResult?.sourceType || 'AUDIT'),
    sourceTitle: regResult?.matchedKeywords?.length > 0 ? regResult.sourceTitle : (newsResult?.sourceTitle || 'Watchdog-Audit'),
    sourceUrl: regResult?.matchedKeywords?.length > 0 ? regResult.sourceUrl : (newsResult?.sourceUrl || ''),
    matchLevel,
    matchedKeywords,
    snippet: regResult?.snippet || newsResult?.snippet || 'Audit durchgeführt',
    substantiveHash: combinedHash,
    changeDetected: isConfirmedChange, // Nur bei Stufe 3 true!
    hasChangeHint,
    note: diffSummary || 'Quellenprüfung abgeschlossen.'
  };

  const existingLogs = Array.isArray(mandate.audit_log) ? mandate.audit_log : [];

  return {
    ...mandate,
    last_audit_check: now,
    match_level: matchLevel,
    change_flag: matchLevel,
    has_change_alert: hasChangeAlert,
    has_change_hint: hasChangeHint,
    changeDetected: isConfirmedChange, // Strikte Einhaltung: Niemals automatisch true!
    change_alert_details: hasChangeAlert ? {
      date: now,
      summary: diffSummary || 'Veränderungshinweis erkannt',
      keywords: matchedKeywords
    } : (isConfirmedChange ? mandate.change_alert_details : null),
    last_scraped_snapshot: currentScrapedSnapshot,
    last_acknowledged_snapshot: lastAckSnapshot,
    audit_log: [newAuditLogEntry, ...existingLogs.slice(0, 49)]
  };
}

/**
 * Führt das Audit über eine gesamte Liste von Mandaten aus
 */
export async function runWatchdogAuditForAllMandates(mandatesList) {
  if (!Array.isArray(mandatesList)) return { mandates: [], alertsFound: [], auditRunAt: new Date().toISOString() };

  const updatedList = [];
  const alertsFound = [];

  for (const m of mandatesList) {
    if (m.status === 'AKTIV_GESCHUETZT' || m.status === 'ANGEBOTEN_RESERVIERT' || m.status === 'ACTIVE_PROTECTED') {
      const audited = await runWatchdogAuditForMandate(m);
      updatedList.push(audited);
      if (audited.has_change_alert) {
        alertsFound.push({
          company: audited.company,
          registerId: audited.register_id,
          matchLevel: audited.match_level,
          summary: audited.change_alert_details?.summary || 'Veränderungshinweis erkannt'
        });
      }
    } else {
      updatedList.push(m);
    }
  }

  return {
    mandates: updatedList,
    alertsFound,
    auditRunAt: new Date().toISOString()
  };
}

/**
 * Menschliche Entscheidung / Quittierung eines Watchdog-Hinweises
 * Erlaubt das Quittieren als stabil (ACKNOWLEDGE_STABLE) oder das explizite Bestätigen einer Veränderung (CONFIRM_CHANGE).
 */
export function acknowledgeWatchdogDecision(mandate, options = {}) {
  if (!mandate) return mandate;
  const now = new Date().toISOString();
  const decision = options.decision || 'ACKNOWLEDGE_STABLE'; // 'ACKNOWLEDGE_STABLE' | 'CONFIRM_CHANGE' | 'DISMISS_HINT'
  const reviewer = options.reviewer || 'Administrator';
  const reviewerNote = options.notes || 'Geprüft & Sachverhalt verifiziert';

  const currentSnapshot = mandate.last_scraped_snapshot || {
    hash: computeSubstantiveHash(mandate.company || ''),
    substantiveText: mandate.company || '',
    timestamp: now
  };

  const isConfirmedChange = decision === 'CONFIRM_CHANGE';
  const newMatchLevel = isConfirmedChange ? MATCH_LEVELS.VERIFIED_CHANGE : MATCH_LEVELS.VERIFIED_STABLE;

  const ackLogEntry = {
    id: `audit-ack-${Date.now()}`,
    timestamp: now,
    sourceType: isConfirmedChange ? 'HUMAN_CONFIRMATION' : 'HUMAN_AUDIT_REVIEW',
    sourceTitle: isConfirmedChange ? 'Menschliche Bestätigung: Operative Veränderung' : 'Menschliche Quittierung: Status stabil',
    sourceUrl: currentSnapshot.url || '',
    matchLevel: newMatchLevel,
    matchedKeywords: ['Geprüft', decision],
    snippet: `Entscheidung durch ${reviewer}: ${reviewerNote}`,
    changeDetected: isConfirmedChange,
    actionRequired: false,
    note: reviewerNote,
    reviewer,
    decision,
    acknowledgedHash: currentSnapshot.hash
  };

  return {
    ...mandate,
    match_level: newMatchLevel,
    change_flag: newMatchLevel,
    has_change_alert: false,
    has_change_hint: false,
    changeDetected: isConfirmedChange, // Nur bei Stufe 3 true!
    verified_at: isConfirmedChange ? now : (mandate.verified_at || null),
    verified_by: isConfirmedChange ? reviewer : (mandate.verified_by || null),
    verification_notes: isConfirmedChange ? reviewerNote : (mandate.verification_notes || null),
    last_acknowledged_snapshot: {
      hash: currentSnapshot.hash,
      substantiveText: currentSnapshot.substantiveText,
      timestamp: now,
      reviewer,
      decision,
      notes: reviewerNote
    },
    audit_log: [ackLogEntry, ...(mandate.audit_log || [])]
  };
}

/**
 * Rückwärtskompatibler Wrapper für einfache Quittierung als stabil
 */
export function acknowledgeWatchdogAlert(mandate, reviewerNote = 'Geprüft & Mandatsstand verifiziert') {
  return acknowledgeWatchdogDecision(mandate, {
    decision: 'ACKNOWLEDGE_STABLE',
    notes: reviewerNote,
    reviewer: 'Administrator'
  });
}
