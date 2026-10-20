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

export const TRIGGER_CATEGORIES = [
  {
    id: 'clevel_vakanzen',
    number: 1,
    title: 'Führungskräftewechsel / C-Level Vakanzen',
    targetAudience: 'Headhunter / Interim',
    label: '1. Führungskräftewechsel / C-Level Vakanzen (Ziel: Headhunter / Interim)',
    searchQuery: 'Führungskräftewechsel C-Level Vakanz Vorstand Geschäftsführung Vertriebsleitung DACH',
    triggerType: 'Führungskräftewechsel / C-Level Vakanzen',
    primaryOperator: 'site:presseportal.de OR site:eqs-news.com "tritt zurück" OR "neuer Geschäftsführer" OR "Aufsichtsrat" OR "Vakanz"',
    crawlerQueries: {
      web: [
        'site:presseportal.de OR site:eqs-news.com "tritt zurück" OR "neuer Geschäftsführer" OR "Aufsichtsrat" OR "Vakanz"',
        '"neuer Geschäftsführer" (site:presseportal.de OR site:eqs-news.com)',
        '"tritt zurück" (Vorstand OR Geschäftsführer) (site:de OR site:at OR site:ch)',
        '"Vakanz" (Vertriebsleitung OR Geschäftsführung) (site:de OR site:at OR site:ch)'
      ],
      news: [
        'neuer Geschäftsführer',
        'tritt zurück Vorstand',
        'Vakanz Geschäftsführung',
        'neue Vertriebsleitung'
      ]
    }
  },
  {
    id: 'bau_kapazitaet',
    number: 2,
    title: 'Kapazitätserweiterung & Bau / Hallen (> 2.000 m²)',
    targetAudience: 'Industrie-Bauer / Logistik',
    label: '2. Kapazitätserweiterung & Bau / Hallen (> 2.000 m²) (Ziel: Industrie-Bauer / Logistik)',
    searchQuery: 'Neubau Industriehalle Werkserweiterung Logistikzentrum Gewerbebau DACH',
    triggerType: 'Kapazitätserweiterung & Bau / Hallen',
    primaryOperator: '"Spatenstich" OR "Richtfest" OR "Investition in Höhe von" OR "neues Logistikzentrum" OR "Neubau"',
    crawlerQueries: {
      web: [
        '"Spatenstich" OR "Richtfest" OR "Investition in Höhe von" OR "neues Logistikzentrum" OR "Neubau"',
        '("Spatenstich" OR "Richtfest") (site:de OR site:at OR site:ch)',
        '("neues Logistikzentrum" OR "Hallenbau") (site:de OR site:at OR site:ch)',
        '"Investition in Höhe von" Neubau (site:de OR site:at OR site:ch)'
      ],
      news: [
        'Spatenstich Neubau',
        'neues Logistikzentrum',
        'Richtfest Gewerbebau',
        'Investition in Höhe von Neubau'
      ]
    }
  },
  {
    id: 'm_and_a_nachfolge',
    number: 3,
    title: 'M&A / Übernahmen / Nachfolge im Mittelstand',
    targetAudience: 'M&A / IT-Integratoren',
    label: '3. M&A / Übernahmen / Nachfolge im Mittelstand (Ziel: M&A / IT-Integratoren)',
    searchQuery: 'Übernahme Unternehmensnachfolge Fusion M&A Mittelstand DACH',
    triggerType: 'M&A / Übernahmen / Nachfolge im Mittelstand',
    primaryOperator: '"übernimmt" OR "Mehrheitsbeteiligung" OR "Unternehmensnachfolge" OR "Fusion" OR "Asset Deal"',
    crawlerQueries: {
      web: [
        '"übernimmt" OR "Mehrheitsbeteiligung" OR "Unternehmensnachfolge" OR "Fusion" OR "Asset Deal"',
        '("Unternehmensnachfolge" OR "Mehrheitsbeteiligung") Mittelstand (site:de OR site:at OR site:ch)',
        '"übernimmt" (Mittelstand OR GmbH) (site:de OR site:at OR site:ch)',
        '("Asset Deal" OR "Fusion") (site:de OR site:at OR site:ch)'
      ],
      news: [
        'Unternehmensnachfolge Mittelstand',
        'übernimmt Mittelstand',
        'Mehrheitsbeteiligung',
        'Asset Deal Fusion'
      ]
    }
  },
  {
    id: 'insolvenz_sanierung',
    number: 4,
    title: 'Insolvenz in Eigenverwaltung / Sanierung',
    targetAudience: 'Sanierungsberater / Anwälte',
    label: '4. Insolvenz in Eigenverwaltung / Sanierung (Ziel: Sanierungsberater / Anwälte)',
    searchQuery: 'Insolvenz in Eigenverwaltung Schutzschirmverfahren Restrukturierung Sanierung DACH',
    triggerType: 'Insolvenz in Eigenverwaltung / Sanierung',
    primaryOperator: 'site:insolvenzbekanntmachungen.de OR "Schutzschirmverfahren" OR "Insolvenz in Eigenverwaltung" OR "Sanierungsexperte"',
    crawlerQueries: {
      web: [
        'site:insolvenzbekanntmachungen.de OR "Schutzschirmverfahren" OR "Insolvenz in Eigenverwaltung" OR "Sanierungsexperte"',
        '("Schutzschirmverfahren" OR "Insolvenz in Eigenverwaltung") (site:de OR site:at OR site:ch)',
        '("Sanierungsexperte" OR "Eigenverwaltung") (site:de OR site:at OR site:ch)',
        'site:insolvenzbekanntmachungen.de'
      ],
      news: [
        'Insolvenz in Eigenverwaltung',
        'Schutzschirmverfahren Sanierung',
        'Sanierungsexperte Eigenverwaltung',
        'Restrukturierung Eigenverwaltung'
      ]
    }
  },
  {
    id: 'stellenwachstum',
    number: 5,
    title: 'Exponentielles Stellenwachstum (5+ offene Rollen)',
    targetAudience: 'Recruiting-Agenturen',
    label: '5. Exponentielles Stellenwachstum (5+ offene Rollen) (Ziel: Recruiting-Agenturen)',
    searchQuery: 'Stellenanzeigen massiver Ausbau 5 offene Stellen Expansion Recruiting DACH',
    triggerType: 'Exponentielles Stellenwachstum (5+ offene Rollen)',
    primaryOperator: '"Wir stellen ein" OR "Expansionskurs"',
    crawlerQueries: {
      web: [
        '"Wir stellen ein" OR "Expansionskurs"',
        '("Wir stellen ein" OR "Expansionskurs") (site:linkedin.com/jobs OR site:stepstone.de OR site:indeed.com OR site:xing.com/jobs)',
        '("Wir stellen ein" OR "Expansionskurs") (site:de OR site:at OR site:ch)',
        '("5 offene Stellen" OR "massiver Ausbau") (site:de OR site:at OR site:ch)'
      ],
      news: [
        'Wir stellen ein Expansion',
        'Expansionskurs Stellen',
        'massiver Personalaufbau',
        'Stellenwachstum Expansion'
      ]
    }
  }
];

export function identifyTriggerCategory(input) {
  if (!input) return null;
  const str = String(input).trim().toLowerCase();

  const byId = TRIGGER_CATEGORIES.find(c => c.id.toLowerCase() === str);
  if (byId) return byId;

  if (str === '1' || str === 'kat 1' || str === 'kategorie 1') return TRIGGER_CATEGORIES[0];
  if (str === '2' || str === 'kat 2' || str === 'kategorie 2') return TRIGGER_CATEGORIES[1];
  if (str === '3' || str === 'kat 3' || str === 'kategorie 3') return TRIGGER_CATEGORIES[2];
  if (str === '4' || str === 'kat 4' || str === 'kategorie 4') return TRIGGER_CATEGORIES[3];
  if (str === '5' || str === 'kat 5' || str === 'kategorie 5') return TRIGGER_CATEGORIES[4];

  if (/\b(führungskräftewechsel|c-level|vakanz|vakanzen|vorstand|geschäftsführer|neuer geschäftsführer|tritt zurück|aufsichtsrat|headhunter|interim)\b/i.test(str)) {
    return TRIGGER_CATEGORIES[0];
  }
  if (/\b(kapazitätserweiterung|hallen|hallenbau|spatenstich|richtfest|logistikzentrum|neubau|gewerbebau|industriebau|werkserweiterung)\b/i.test(str)) {
    return TRIGGER_CATEGORIES[1];
  }
  if (/\b(m&a|m_and_a|übernahme|übernahmen|nachfolge|unternehmensnachfolge|mehrheitsbeteiligung|asset deal|fusion)\b/i.test(str)) {
    return TRIGGER_CATEGORIES[2];
  }
  if (/\b(insolvenz|eigenverwaltung|sanierung|schutzschirmverfahren|sanierungsberater|sanierungsexperte|insolvenzbekanntmachungen)\b/i.test(str)) {
    return TRIGGER_CATEGORIES[3];
  }
  if (/\b(stellenwachstum|offene rollen|offene stellen|stellenanzeigen|wir stellen ein|expansionskurs|recruiting)\b/i.test(str)) {
    return TRIGGER_CATEGORIES[4];
  }

  return null;
}

/**
 * B2B Opportunity Lifecycle Matrix (Kategorie-spezifische Handlungsfenster):
 * 1. C-Level / Vakanzen: Breaking: 1–14 Tage | Hot Window: 15–90 Tage | Ab Tag 91: Expired
 * 2. Expansion / Bau: Breaking: 1–30 Tage | Hot Window: 31–150 Tage | Ab Tag 151: Expired
 * 3. M&A / Nachfolge: Breaking: 1–30 Tage | Hot Window: 31–120 Tage | Ab Tag 121: Expired
 * 4. Sanierung / Eigenverwaltung: Breaking: 1–14 Tage | Hot Window: 15–90 Tage | Ab Tag 91: Expired
 * 5. Stellenwachstum (5+): Breaking: 1–14 Tage | Hot Window: 15–45 Tage | Ab Tag 46: Expired
 */
export const B2B_LIFECYCLE_WINDOWS = {
  clevel_vakanzen: {
    id: 'clevel_vakanzen',
    name: 'C-Level / Vakanzen',
    categoryNumber: 1,
    breakingDays: 14,
    hotWindowDays: 90,
    maxExpiredDays: 90
  },
  bau_kapazitaet: {
    id: 'bau_kapazitaet',
    name: 'Expansion / Bau',
    categoryNumber: 2,
    breakingDays: 30,
    hotWindowDays: 150,
    maxExpiredDays: 150
  },
  m_and_a_nachfolge: {
    id: 'm_and_a_nachfolge',
    name: 'M&A / Nachfolge',
    categoryNumber: 3,
    breakingDays: 30,
    hotWindowDays: 120,
    maxExpiredDays: 120
  },
  insolvenz_sanierung: {
    id: 'insolvenz_sanierung',
    name: 'Sanierung / Eigenverwaltung',
    categoryNumber: 4,
    breakingDays: 14,
    hotWindowDays: 90,
    maxExpiredDays: 90
  },
  stellenwachstum: {
    id: 'stellenwachstum',
    name: 'Stellenwachstum (5+)',
    categoryNumber: 5,
    breakingDays: 14,
    hotWindowDays: 45,
    maxExpiredDays: 45
  }
};

export function getCategoryLifecycleConfig(categoryInput) {
  const identified = identifyTriggerCategory(categoryInput);
  if (identified && B2B_LIFECYCLE_WINDOWS[identified.id]) {
    return B2B_LIFECYCLE_WINDOWS[identified.id];
  }

  const catStr = String(categoryInput || '').toLowerCase();
  if (catStr.includes('bau') || catStr.includes('halle') || catStr.includes('kapazität') || catStr === '2' || catStr.includes('expansion')) {
    return B2B_LIFECYCLE_WINDOWS.bau_kapazitaet;
  }
  if (catStr.includes('m&a') || catStr.includes('übernahme') || catStr.includes('nachfolge') || catStr.includes('fusion') || catStr === '3') {
    return B2B_LIFECYCLE_WINDOWS.m_and_a_nachfolge;
  }
  if (catStr.includes('insolvenz') || catStr.includes('sanierung') || catStr.includes('schutzschirm') || catStr.includes('eigenverwaltung') || catStr === '4') {
    return B2B_LIFECYCLE_WINDOWS.insolvenz_sanierung;
  }
  if (catStr.includes('stellen') || catStr.includes('hiring') || catStr.includes('recruiting') || catStr === '5') {
    return B2B_LIFECYCLE_WINDOWS.stellenwachstum;
  }
  return B2B_LIFECYCLE_WINDOWS.clevel_vakanzen;
}

/**
 * Klassifiziert ein B2B-Kaufsignal automatisch anhand seines Lebenszyklus:
 * - 🟢 Brandaktuell (Breaking)
 * - 🔵 Strategisches Handlungsfenster (Hoher Aktionsdruck)
 * - ❌ Expired (Veraltet / Handlungsfenster geschlossen)
 */
export function classifyB2BLifecycle(categoryInput, dateInput, now = new Date()) {
  const config = getCategoryLifecycleConfig(categoryInput);

  if (!dateInput) {
    return {
      status: 'HOT_WINDOW',
      badge: '🔵 Strategisches Handlungsfenster (Hoher Aktionsdruck)',
      daysAgo: null,
      isActionable: true,
      phase: 'hot',
      categoryName: config.name,
      maxExpiredDays: config.maxExpiredDays,
      description: 'Aktives B2B-Handlungsfenster'
    };
  }

  const dateObj = new Date(dateInput);
  if (isNaN(dateObj.getTime())) {
    return {
      status: 'HOT_WINDOW',
      badge: '🔵 Strategisches Handlungsfenster (Hoher Aktionsdruck)',
      daysAgo: null,
      isActionable: true,
      phase: 'hot',
      categoryName: config.name,
      maxExpiredDays: config.maxExpiredDays,
      description: 'Aktives B2B-Handlungsfenster'
    };
  }

  const nowDate = now instanceof Date ? now : new Date();
  const diffMs = nowDate.getTime() - dateObj.getTime();
  const daysAgo = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));

  if (daysAgo <= config.breakingDays) {
    return {
      status: 'BREAKING',
      badge: '🟢 Brandaktuell (Breaking)',
      daysAgo,
      isActionable: true,
      phase: 'breaking',
      categoryName: config.name,
      maxExpiredDays: config.maxExpiredDays,
      description: `Ereignis vor ${daysAgo} Tagen (Brandaktuell ≤ ${config.breakingDays} Tage)`
    };
  } else if (daysAgo <= config.hotWindowDays) {
    return {
      status: 'HOT_WINDOW',
      badge: '🔵 Strategisches Handlungsfenster (Hoher Aktionsdruck)',
      daysAgo,
      isActionable: true,
      phase: 'hot',
      categoryName: config.name,
      maxExpiredDays: config.maxExpiredDays,
      description: `Ereignis vor ${daysAgo} Tagen (Aktives Verkaufsfenster ${config.breakingDays + 1}–${config.hotWindowDays} Tage)`
    };
  } else {
    return {
      status: 'EXPIRED',
      badge: '❌ Expired (Veraltet)',
      daysAgo,
      isActionable: false,
      phase: 'expired',
      categoryName: config.name,
      maxExpiredDays: config.maxExpiredDays,
      description: `Älter als ${config.maxExpiredDays} Tage (${daysAgo} Tage her) – Zeitfenster geschlossen`,
      rejectionReason: `Älter als ${config.maxExpiredDays} Tage für ${config.name} (Ereignis vor ${daysAgo} Tagen)`
    };
  }
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
    .replace(/\b(gmbh|ag|se|kgaa|kg|ohg|ug|e\.?\s*k\.?|e\.?\s*kfr\.?|e\.?\s*kfm\.?|e\.?\s*v\.?|eg|partg(\s*mbb)?|inc\.?|ltd\.?|corp\.?|llc|p\.?l\.?c\.?|s\.?a\.?r\.?l\.?|b\.?v\.?|n\.?v\.?|s\.?r\.?l\.?|s\.?p\.?a\.?|s\.?a\.?|s\.?l\.?)(\b|$)/gi, '')
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


