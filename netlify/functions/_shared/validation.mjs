/**
 * NeXus Validation Helper
 * 
 * Verhindert das Einfügen und Verarbeiten von Mock-, Test- und Platzhalter-Einträgen.
 */

const PLACEHOLDER_PATTERNS = [
  'echter firmenname',
  'echter firmennamen',
  'musterfirma',
  'muster gmbh',
  'muster ag',
  'max mustermann',
  'musterunternehmen',
  'test',
  'test gmbh',
  'testfirma',
  'test ag',
  'test company',
  'beispiel',
  'beispiel gmbh',
  'beispielunternehmen',
  'example corp',
  'unbekannt',
  'unbekanntes unternehmen',
  'firma',
  'firmenname',
  'n/a',
  'null',
  'none',
  'keine angabe'
];

/**
 * Prüft, ob ein gegebener Firmenname ein Platzhalter oder Testeintrag ist.
 * @param {string} name 
 * @returns {boolean} true wenn Platzhalter
 */
export function isPlaceholderCompany(name) {
  if (!name || typeof name !== 'string') return true;
  const clean = name.trim().toLowerCase();
  if (clean.length < 2) return true;
  
  return PLACEHOLDER_PATTERNS.some(p => {
    return clean === p || 
           clean.startsWith(p + ' ') || 
           clean.endsWith(' ' + p) ||
           clean === p + ' aus dem quelltext' ||
           clean.includes('echter firmenname');
  });
}

const VENDOR_PATTERNS = [
  'ricoh', 'canon', 'konica minolta', 'xerox', 'bechtle', 'computacenter',
  'atlassian', 'lg electronics', 'lg', 'salesforce', 'hubspot', 'microsoft',
  'oracle', 'sap'
];

export function isVendorCompany(name) {
  if (!name || typeof name !== 'string') return false;
  const clean = name.trim().toLowerCase();
  return VENDOR_PATTERNS.some(v => clean.includes(v));
}

export function computeTargetMatchScore(companyName, rawScore = null) {
  if (isVendorCompany(companyName)) return 25;
  if (typeof rawScore === 'number' && !isNaN(rawScore)) return rawScore;
  return 75;
}

/**
 * Zentrale Schranke für Opportunities (Fail-Closed).
 * Stellt sicher, dass ein Lead zwingend:
 * 1. Kein Platzhalter ist (isPlaceholderCompany)
 * 2. Kein reiner Anbieter/Vendor ist (isVendorCompany)
 * 3. Nicht disqualifiziert ist (is_disqualified !== true && is_potential_buyer !== false)
 * 4. Einen Zielgruppen-/Lead-Score >= 50 aufweist
 * 5. Kein reines PR-/Speaker-Event ohne Anlass ist (purchase_intent_status !== 'PURE_MENTION')
 * 
 * Wirft einen Error, falls die Kriterien verletzt werden.
 */
export function assertQualifiedOpportunity(data = {}) {
  const compName = (data.company_name || data.company || data.name || data.firmenname || '').trim();
  
  if (compName && isPlaceholderCompany(compName)) {
    throw new Error(`Opportunity rejected: "${compName}" ist ein Platzhalter oder Test-Eintrag.`);
  }

  if (data.purchase_intent_status === 'PURE_MENTION') {
    throw new Error('Opportunity rejected: PURE_MENTION ist kein Kaufsignal.');
  }

  const isVendor = compName ? isVendorCompany(compName) : false;
  const rawScore = typeof data.lead_score === 'number' 
    ? data.lead_score 
    : (typeof data.target_group_match === 'number' 
        ? data.target_group_match 
        : (typeof data.trigger_score === 'number' ? data.trigger_score : (typeof data.relevance_score === 'number' ? data.relevance_score : 75)));
  
  const matchScore = isVendor ? 25 : rawScore;
  const isExplicitNonBuyer = data.is_potential_buyer === false;
  const isDisqualified = Boolean(data.is_disqualified || isExplicitNonBuyer || isVendor || matchScore < 50);

  if (isDisqualified) {
    const reason = isExplicitNonBuyer
      ? 'Kein potenzieller Käufer (is_potential_buyer: false)'
      : (isVendor
          ? `Bekannter IT/Hardware-Anbieter (${compName})`
          : (matchScore < 50
              ? `Score (${matchScore}) unter Mindestanforderung von 50`
              : 'Disqualifiziert'));
    throw new Error(`Opportunity rejected: ${reason}.`);
  }

  return true;
}

/**
 * Gemeinsame Qualifizierungsregel für die Kaufabsicht (Fail-Closed):
 * - EXPLICIT_INTENT darf nicht allein durch ein KI-Label bestätigt werden.
 * - Erfordert ein substanzielles Zitat (evidence >= 15 Zeichen) mit explizitem Beschaffungs-/Ausschreibungsbezug
 *   sowie eine überprüfbare Quellen-URL (http...).
 * - Ohne belegten Beschaffungsbezug fällt der Status auf TRIGGER_EVENT zurück.
 * - PURE_MENTION wird als nicht qualifiziert eingestuft.
 */
export function validatePurchaseIntent(trigger = {}, options = {}) {
  const rawStatus = (trigger.purchase_intent_status || 'TRIGGER_EVENT').trim().toUpperCase();

  if (rawStatus === 'PURE_MENTION') {
    return {
      status: 'PURE_MENTION',
      isQualified: false,
      reason: 'Reine Erwähnung / PR ohne operatives Veränderungsereignis oder Kaufabsicht.'
    };
  }

  if (rawStatus === 'EXPLICIT_INTENT') {
    const evidence = String(trigger.evidence || trigger.buyer_evidence || '').trim();
    const sourceUrl = String(trigger.quelle || trigger.source_url || trigger.url || '').trim();

    if (!evidence || evidence.length < 15) {
      return {
        status: 'TRIGGER_EVENT',
        isQualified: true,
        reason: 'Downgrade auf TRIGGER_EVENT: Kein substanzielles Zitat als Beschaffungsbeleg vorhanden.'
      };
    }

    if (!sourceUrl || !sourceUrl.startsWith('http')) {
      return {
        status: 'TRIGGER_EVENT',
        isQualified: true,
        reason: 'Downgrade auf TRIGGER_EVENT: Keine überprüfbare Quellen-URL vorhanden.'
      };
    }

    const PROCUREMENT_PATTERN = /\b(ausschreibung|schreibt.*aus|ausgeschrieben|vergabe|vergibt|beschaffung|sucht.*(agentur|dienstleister|software|partner|anbieter|beratung)|anfrage|angebot.*(einreichen|abgeben)|tender|rfq|request for proposal|procurement)\b/i;
    if (!PROCUREMENT_PATTERN.test(evidence)) {
      return {
        status: 'TRIGGER_EVENT',
        isQualified: true,
        reason: 'Downgrade auf TRIGGER_EVENT: Zitat belegt ein Ereignis, jedoch keinen expliziten Beschaffungsbedarf.'
      };
    }

    if (options.sourceText && typeof options.sourceText === 'string') {
      if (!options.sourceText.includes(evidence)) {
        return {
          status: 'TRIGGER_EVENT',
          isQualified: true,
          reason: 'Downgrade auf TRIGGER_EVENT: Zitat konnte im Quellentext nicht verifiziert werden.'
        };
      }
    }

    return {
      status: 'EXPLICIT_INTENT',
      isQualified: true,
      reason: 'Expliziter Beschaffungsbedarf durch Zitat und Quelle belegt.'
    };
  }

  return {
    status: 'TRIGGER_EVENT',
    isQualified: true,
    reason: 'Operatives Veränderungsereignis (TRIGGER_EVENT).'
  };
}

/**
 * Normalisiert einen Firmennamen durch Entfernen von Rechtsformen und Sonderzeichen.
 */
export function normalizeCompanyName(name) {
  if (!name || typeof name !== 'string') return '';
  return name
    .toLowerCase()
    .replace(/\(?haftungsbeschr[äa]nkt\)?/gi, '')
    // 1. Ausgeschriebene deutsche und internationale Rechtsformen
    .replace(/\b(aktiengesellschaft|gesellschaft mit beschr[äa]nkter haftung|kommanditgesellschaft auf aktien|kommanditgesellschaft|offene handelsgesellschaft|eingetragene genossenschaft|eingetragener verein|partnerschaftsgesellschaft(\s*mbb)?|corporation)\b/gi, '')
    // 2. Mehrteilige Rechtsformen mit Vorläufer (z.B. SE + Co. KG, GmbH & Co. KGaA, Stiftung & Co. KGaA)
    .replace(/\b(gmbh|se|ag|stiftung)\s*(&|\+|und)?\s*co\.?\s*(kgaa|kg)?\b/gi, '')
    // 3. Freistehende '& Co. KG', '+ Co. KG', '& Co.' (NUR mit vorausgehendem & / + / und ODER folgendem KG/KGaA!)
    // WICHTIG: Schützt "Co-Working", "Co-Invest" vor Beschädigung!
    .replace(/(&|\+|und)\s*\bco\.?\s*(kgaa|kg)?\b/gi, '')
    .replace(/\bco\.?\s*(kgaa|kg)\b/gi, '')
    .replace(/\bco\.?\s*,?\s*ltd\.?\b/gi, '')
    // 4. Einzelne Rechtsform-Kürzel national und international (inkl. gepunkteter Kürzel)
    .replace(/\b(gmbh|ag|se|kgaa|kg|ohg|ug|e\.?\s*k\.?|e\.?\s*kfr\.?|e\.?\s*kfm\.?|e\.?\s*v\.?|eg|partg(\s*mbb)?|inc\.?|ltd\.?|corp\.?|llc|p\.?l\.?c\.?|s\.?a\.?r\.?l\.?|b\.?v\.?|n\.?v\.?|s\.?r\.?l\.?|s\.?p\.?a\.?|s\.?a\.?)(\b|$)/gi, '')
    // 5. Sonderzeichen und Whitespace säubern (Unicode \p{L} für alle europäischen Alphabete)
    .replace(/[^\p{L}0-9]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Dedupliziert Trigger-Listen auf Unternehmensebene:
 * - Identische Ereignisse desselben Unternehmens (gleiches Datum/Kategorie) werden
 *   zu 1 Reporteintrag zusammengeführt (Quellen und Scores aggregiert).
 * - Unterschiedliche reale Ereignisse desselben Unternehmens bleiben als separate Signale erhalten.
 */
export function deduplicateAndMergeTriggers(rawTriggers) {
  if (!Array.isArray(rawTriggers)) return [];
  const map = new Map();

  for (const item of rawTriggers) {
    if (!item) continue;
    const compNorm = normalizeCompanyName(item.company || item.firmenname);
    if (!compNorm) continue;

    const eventKey = `${item.event_date || ''}_${item.signal_kategorie || ''}`;
    const compositeKey = `${compNorm}::${eventKey}`;

    if (!map.has(compositeKey)) {
      map.set(compositeKey, {
        ...item,
        all_sources: item.quelle ? [item.quelle] : []
      });
    } else {
      const existing = map.get(compositeKey);
      if (item.quelle && !existing.all_sources.includes(item.quelle)) {
        existing.all_sources.push(item.quelle);
      }
      if ((item.target_group_match || 0) > (existing.target_group_match || 0)) {
        existing.target_group_match = item.target_group_match;
      }
      if ((item.evidence || '').length > (existing.evidence || '').length) {
        existing.evidence = item.evidence;
      }
    }
  }

  return Array.from(map.values()).sort((a, b) => (a.prioritaet || 99) - (b.prioritaet || 99));
}


