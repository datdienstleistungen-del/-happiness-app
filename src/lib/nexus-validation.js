/**
 * NeXus Frontend Validation Helper
 * 
 * Verhindert das Anzeigen und Verarbeiten von Mock-, Test- und Platzhalter-Einträgen
 * in der Produktivansicht (Lead Radar, Sales Workspace, Dashboard).
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

/**
 * Prüft, ob ein Unternehmen ein bekannter IT-/Hardware-/Software-Anbieter ist.
 * Anbieter sind in der Regel keine Käufer für Vertriebssoftware (Anti-Ricoh / Anti-Vendor Regel).
 */
export function isVendorCompany(name) {
  if (!name || typeof name !== 'string') return false;
  const clean = name.trim().toLowerCase();
  return VENDOR_PATTERNS.some(v => clean.includes(v));
}

/**
 * Berechnet den finalen Zielgruppen-Match (0-100).
 * Bekannte Anbieter erhalten maximal 25% (werden damit automatisch als "Zielgruppe unklar" gefiltert).
 */
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
 * 
 * Wirft einen Error, falls die Kriterien verletzt werden.
 * 
 * @param {Object} data 
 * @returns {boolean} true falls qualifiziert
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
        : (typeof data.trigger_score === 'number' ? data.trigger_score : 75));
  
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
 * 
 * @param {Object} trigger 
 * @param {Object} [options]
 * @returns {{ status: 'EXPLICIT_INTENT'|'TRIGGER_EVENT'|'PURE_MENTION', isQualified: boolean, reason: string }}
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
 * @param {string} name 
 * @returns {string} normalisierter Name
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
 * Bildet einen normalisierten, deterministischen und stabilen Composite Event Key
 * zur Identifikation desselben realen Ereignisses über Angebote und Scans hinweg.
 * 
 * Format: `<normalisierter_firmenname>::<erste_50_zeichen_event_fact>`
 * Beispiel: "deutsche aircraft::fabrikeröffnung am flughafen leipzig"
 * 
 * @param {Object} trigger 
 * @returns {string}
 */
/**
 * Extrahiert signifikante Wort-Tokens aus einem Text unter Ausschluss von Stoppwörtern
 * und generischen Wirtschaftsfloskeln.
 * 
 * @param {string} text 
 * @returns {Array<string>}
 */
export function extractFactTokens(text) {
  if (!text) return [];
  const stopWords = new Set([
    'im', 'in', 'der', 'die', 'das', 'und', 'für', 'fuer', 'mit', 'von', 'aus', 'am', 'an', 'zu',
    'den', 'des', 'dem', 'bereich', 'branche', 'unternehmen', 'firmen', 'kunden', 'gmbh', 'ag',
    'ein', 'eine', 'einen', 'einem', 'einer', 'eines', 'sich', 'ist', 'hat', 'wird', 'werden',
    'über', 'ueber', 'nach', 'vor', 'bei', 'zum', 'zur', 'vom', 'ins', 'dass', 'nicht', 'auch',
    'investition', 'investiert', 'millionen', 'euro', 'standort', 'plant', 'planten', 'geplant',
    'neues', 'neue', 'neuen', 'deutschland', 'ab', 'seit', 'jahr', 'jahren', 'gruppe', 'holding'
  ]);
  return String(text)
    .toLowerCase()
    .replace(/[^a-z0-9äöüß\s]/g, ' ')
    .split(/\s+/)
    .map(w => w.trim())
    .filter(w => w.length > 2 && !stopWords.has(w));
}

/**
 * Berechnet den Jaccard-Ähnlichkeitskoeffizienten zweier Token-Listen.
 * 
 * @param {Array<string>} tokensA 
 * @param {Array<string>} tokensB 
 * @returns {number}
 */
export function computeTokenSimilarity(tokensA = [], tokensB = []) {
  if (!tokensA.length || !tokensB.length) return 0;
  const setA = new Set(tokensA);
  const setB = new Set(tokensB);
  let intersection = 0;
  for (const t of setA) {
    if (setB.has(t)) intersection++;
  }
  const union = new Set([...setA, ...setB]).size;
  return union === 0 ? 0 : intersection / union;
}

/**
 * Erkennt die primäre fachliche Projekt-Domäne eines Textes (z.B. IT vs. Werk/Bau vs. Personal vs. M&A).
 */
function detectProjectDomain(text = '') {
  const t = String(text).toLowerCase();
  if (/\b(software|erp|crm|cloud|it-infrastruktur|relaunch|plattform|digitalisier|saas|app|ki-system|rechenzentrum)\b/i.test(t)) return 'IT';
  if (/\b(fabrik|werk|montage|fertigung|halle|neubau|bau|gebäude|spatenstich|richtfest|standorterweiterung|produktionslinie)\b/i.test(t)) return 'FACILITY';
  if (/\b(hiring|personal|stellen|mitarbeiter|team|geschäftsführer|vorstand|head of)\b/i.test(t)) return 'HR';
  if (/\b(übernahme|fusion|m_a|akquisition|joint venture|anteile|finanzierungsrunde|kapital|serie-[a-z])\b/i.test(t)) return 'FINANCE';
  return 'GENERAL';
}

/**
 * Bildet einen normalisierten, deterministischen und kollisionsfreien Composite Event Key.
 * Verhindert Kollisionen durch 50-Zeichen-Truncation, indem die signifikanten
 * Inhaltswörter (Ort, Ereignis, Zahl) berücksichtigt werden.
 * 
 * @param {Object} trigger 
 * @returns {string}
 */
export function buildCompositeEventKey(trigger) {
  if (!trigger || typeof trigger !== 'object') return '';
  const compNorm = normalizeCompanyName(trigger.company || trigger.firmenname || '');
  if (!compNorm) return '';

  const rawFact = String(trigger.event_fact || trigger.signal || trigger.beschreibung || trigger.event || '').trim();
  const tokens = extractFactTokens(rawFact);
  
  // Sortierte eindeutige Kern-Begriffe für deterministische Hash-Bildung
  const uniqueTokens = Array.from(new Set(tokens)).sort();
  const tokenSig = uniqueTokens.slice(0, 10).join('_');
  const factSignature = tokenSig || rawFact.toLowerCase().replace(/[^a-z0-9äöüß]/g, '').slice(0, 60);

  return `${compNorm}::${factSignature}`;
}

/**
 * Prüft konservativ, ob zwei Trigger zweifelsfrei dasselbe reale Ereignis beschreiben.
 * Kriterien (Fail-Separated):
 * 1. Zwingend identischer normalisierter Firmenname.
 * 2. Keine Datumsdivergenz (> 30 Kalendertage Abstand bei verifizierten Daten -> zwingend getrennt halten).
 * 3. Keine Projekt-Domänen-Kollision (z.B. IT/Software vs. Werksbau/Montage -> zwingend getrennt halten).
 * 4. Keine Phasenkontradiktion (z.B. Stellenabbau/Schließung vs. Werkeröffnung/Neubau -> zwingend getrennt halten).
 * 5. Kein Standortkonflikt (weder im Freitext noch in den HQ-Feldern).
 * 6. Identischer Composite Key ODER ausreichender semantischer Token-Overlap (Jaccard >= 0.40 auf bereinigten Fach-Tokens).
 * 
 * @param {Object} triggerA 
 * @param {Object} triggerB 
 * @returns {boolean}
 */
export function areSameEvent(triggerA, triggerB) {
  if (!triggerA || !triggerB) return false;

  // 1. Firmenabgleich
  const compA = normalizeCompanyName(triggerA.company || triggerA.firmenname || '');
  const compB = normalizeCompanyName(triggerB.company || triggerB.firmenname || '');
  if (!compA || !compB || compA !== compB) return false;

  const factA = String(triggerA.event_fact || triggerA.signal || '').trim();
  const factB = String(triggerB.event_fact || triggerB.signal || '').trim();

  // 2. Datums-Widerspruchsprüfung (> 30 Tage Abstand bei vorhandenen konkreten Daten -> unterschiedliche Ereignisse)
  if (triggerA.event_date && triggerB.event_date) {
    const timeA = new Date(triggerA.event_date).getTime();
    const timeB = new Date(triggerB.event_date).getTime();
    if (!isNaN(timeA) && !isNaN(timeB)) {
      const dayDiff = Math.abs(timeA - timeB) / (1000 * 60 * 60 * 24);
      if (dayDiff > 30) {
        return false;
      }
    }
  }

  // 3. Projekt-Domänenprüfung (z.B. Werksbau vs. IT-Einführung desselben Konzerns am selben Ort)
  const domainA = detectProjectDomain(`${factA} ${triggerA.signal_kategorie || ''}`);
  const domainB = detectProjectDomain(`${factB} ${triggerB.signal_kategorie || ''}`);
  if (domainA !== 'GENERAL' && domainB !== 'GENERAL' && domainA !== domainB) {
    return false; // Unterschiedliche Vorhaben zwingend getrennt halten!
  }

  // 4. Phasenkontradiktion (z.B. Stellenabbau / Schließung vs. Eröffnung / Neubau)
  const isNegA = /\b(schließ|abbau|gestrichen|reduzier|insolvenz|aufgabe)\b/i.test(factA);
  const isPosA = /\b(eröffn|spatenstich|richtfest|aufbau|invest|gründ|expansion|ausbau|wachstum)\b/i.test(factA);
  const isNegB = /\b(schließ|abbau|gestrichen|reduzier|insolvenz|aufgabe)\b/i.test(factB);
  const isPosB = /\b(eröffn|spatenstich|richtfest|aufbau|invest|gründ|expansion|ausbau|wachstum)\b/i.test(factB);
  if ((isNegA && isPosB) || (isPosA && isNegB)) {
    return false;
  }

  // 5. Standort-Konfliktprüfung (Umfassende DACH-Standortliste inkl. Mittelzentren)
  const hqCityA = String(triggerA.company_hq_city || '').toLowerCase().trim();
  const hqCityB = String(triggerB.company_hq_city || '').toLowerCase().trim();
  if (hqCityA && hqCityB && hqCityA !== hqCityB) {
    return false;
  }

  const tokensA = extractFactTokens(factA);
  const tokensB = extractFactTokens(factB);

  const knownCities = [
    'leipzig', 'dresden', 'berlin', 'münchen', 'hamburg', 'köln', 'frankfurt', 'stuttgart', 
    'irlbach', 'straubing', 'halle', 'erfurt', 'jena', 'chemnitz', 'magdeburg', 'hannover', 
    'nürnberg', 'augsburg', 'bremen', 'dortmund', 'essen', 'düsseldorf', 'kassel', 'karlsruhe', 
    'mannheim', 'freiburg', 'ulm', 'regensburg', 'ingolstadt', 'würzburg', 'wolfsburg', 'erlangen', 
    'amberg', 'graz', 'linz', 'salzburg', 'innsbruck', 'wien', 'zürich', 'basel', 'bern', 'genf'
  ];
  const citiesA = tokensA.filter(t => knownCities.includes(t));
  const citiesB = tokensB.filter(t => knownCities.includes(t));
  if (citiesA.length > 0 && citiesB.length > 0) {
    const hasCommonCity = citiesA.some(c => citiesB.includes(c));
    if (!hasCommonCity) {
      return false; // Unterschiedliche Orte derselben Firma -> ZWINGEND getrennt halten!
    }
  }

  // 6. Abgleich über Composite Event Key
  const keyA = buildCompositeEventKey(triggerA);
  const keyB = buildCompositeEventKey(triggerB);
  if (keyA && keyB && keyA === keyB) return true;

  // 7. Token-Ähnlichkeit auf den bereinigten Fachbegriffen
  const similarity = computeTokenSimilarity(tokensA, tokensB);
  return similarity >= 0.40;
}

/**
 * Dedupliziert Trigger-Listen anhand von Ereignisidentität (Firma + Event-Signatur):
 * - Dasselbe reale Ereignis wird auch über verschiedene Angebote/Scans hinweg nur 1x als Lead gezählt.
 * - Bewertungen und Hypothesen verschiedener Angebote gehen NICHT verloren, sondern werden in `all_evaluations` gesichert.
 * - Quellen und Belege werden vollständig in `all_sources` und `all_evidences` zusammengeführt.
 * - Widersprüchliche Ereignisdaten werden in `conflicting_dates` und `has_date_conflict` kenntlich gemacht.
 * - Im Zweifel werden unterschiedliche Ereignisse getrennt gehalten.
 * 
 * @param {Array} rawTriggers 
 * @param {Object} options
 * @returns {Array} deduplizierte Trigger
 */
export function deduplicateAndMergeTriggers(rawTriggers, { activeOfferingId = null } = {}) {
  if (!Array.isArray(rawTriggers)) return [];
  const mergedList = [];

  for (const item of rawTriggers) {
    if (!item) continue;
    const compositeKey = buildCompositeEventKey(item);
    if (!compositeKey || compositeKey === '::') continue;

    const sourceUrl = item.quelle || item.url || null;
    const itemSources = Array.isArray(item.all_sources) && item.all_sources.length > 0
      ? item.all_sources.filter(Boolean)
      : (sourceUrl ? [sourceUrl] : []);

    // Suche in bereits vorhandenen Ereignissen nach Übereinstimmung (per Key oder areSameEvent)
    let existing = mergedList.find(m => areSameEvent(m, item));

    if (!existing) {
      const newEntry = {
        ...item,
        composite_event_key: compositeKey,
        all_sources: [...itemSources],
        duplicate_count: 1,
        has_date_conflict: false,
        conflicting_dates: item.event_date ? [item.event_date] : [],
        all_evidences: item.evidence ? [{ text: item.evidence, quelle: sourceUrl, date: item.event_date }] : [],
        all_evaluations: [{
          offering_id: item.offering_id || null,
          branche: item.branche || null,
          target_group_match: item.target_group_match,
          business_opportunity: item.business_opportunity,
          bewertung: item.bewertung,
          match_reason: item.match_reason,
          quelle: sourceUrl
        }]
      };
      mergedList.push(newEntry);
    } else {
      existing.duplicate_count = (existing.duplicate_count || 1) + 1;

      // 1. Alle Quellen dedupliziert sammeln
      for (const s of itemSources) {
        if (s && !existing.all_sources.includes(s)) {
          existing.all_sources.push(s);
        }
      }

      // 2. Belege (Evidences) sammeln, keine überschreiben
      if (!existing.all_evidences) {
        existing.all_evidences = existing.evidence ? [{ text: existing.evidence, quelle: existing.quelle }] : [];
      }
      if (item.evidence && !existing.all_evidences.some(e => e.text === item.evidence)) {
        existing.all_evidences.push({
          text: item.evidence,
          quelle: sourceUrl,
          date: item.event_date || item.published_at
        });
      }
      if ((item.evidence || '').length > (existing.evidence || '').length) {
        existing.evidence = item.evidence;
      }

      // 3. Widersprüchliche Ereignisdaten erkennen & dokumentieren
      if (item.event_date && existing.event_date && item.event_date !== existing.event_date) {
        existing.has_date_conflict = true;
        if (!existing.conflicting_dates) {
          existing.conflicting_dates = [existing.event_date];
        }
        if (!existing.conflicting_dates.includes(item.event_date)) {
          existing.conflicting_dates.push(item.event_date);
        }
      }

      // 4. Angebots-Evaluationen (Hypothesen/Scores) sammeln, keine verwerfen
      if (!existing.all_evaluations) {
        existing.all_evaluations = [{
          offering_id: existing.offering_id || null,
          branche: existing.branche || null,
          target_group_match: existing.target_group_match,
          business_opportunity: existing.business_opportunity,
          bewertung: existing.bewertung,
          match_reason: existing.match_reason,
          quelle: existing.quelle
        }];
      }
      const itemEval = {
        offering_id: item.offering_id || null,
        branche: item.branche || null,
        target_group_match: item.target_group_match,
        business_opportunity: item.business_opportunity,
        bewertung: item.bewertung,
        match_reason: item.match_reason,
        quelle: sourceUrl
      };
      const isAlreadyInEvals = existing.all_evaluations.some(e =>
        (item.offering_id && e.offering_id === item.offering_id) ||
        (e.business_opportunity && e.business_opportunity === item.business_opportunity)
      );
      if (!isAlreadyInEvals) {
        existing.all_evaluations.push(itemEval);
      }

      // 5. Root-Lead bestimmen: Behalte besten Match-Score (oder aktives Offering)
      const itemScore = typeof item.target_group_match === 'number' ? item.target_group_match : 0;
      const existingScore = typeof existing.target_group_match === 'number' ? existing.target_group_match : 0;

      const isCurrentOfferingMatch = Boolean(activeOfferingId && item.offering_id === activeOfferingId && existing.offering_id !== activeOfferingId);

      if (isCurrentOfferingMatch || itemScore > existingScore) {
        const preservedSources = [...existing.all_sources];
        const preservedCount = existing.duplicate_count;
        const preservedEvidences = existing.all_evidences;
        const preservedEvals = existing.all_evaluations;
        const preservedConflict = existing.has_date_conflict;
        const preservedConfDates = existing.conflicting_dates;

        Object.assign(existing, item, {
          composite_event_key: existing.composite_event_key || compositeKey,
          all_sources: preservedSources,
          duplicate_count: preservedCount,
          all_evidences: preservedEvidences,
          all_evaluations: preservedEvals,
          has_date_conflict: preservedConflict,
          conflicting_dates: preservedConfDates
        });
      }

      // Metadaten-Nachführung falls noch fehlend
      if (!existing.event_date && item.event_date) {
        existing.event_date = item.event_date;
        existing.event_date_unverified = item.event_date_unverified;
      }
      if (!existing.published_at && item.published_at) {
        existing.published_at = item.published_at;
      }
      if (!existing.business_opportunity && item.business_opportunity) {
        existing.business_opportunity = item.business_opportunity;
      }
      if (!existing.pain_point && item.pain_point) {
        existing.pain_point = item.pain_point;
      }
      if (!existing.blind_company && item.blind_company) {
        existing.blind_company = item.blind_company;
      }
      if (!existing.blind_location && item.blind_location) {
        existing.blind_location = item.blind_location;
      }
      if (!existing.blind_quantity && item.blind_quantity) {
        existing.blind_quantity = item.blind_quantity;
      }
      if ((!existing.target_buyers || existing.target_buyers.length === 0) && item.target_buyers?.length > 0) {
        existing.target_buyers = item.target_buyers;
      }
    }
  }

  return mergedList.sort((a, b) => (a.prioritaet || 99) - (b.prioritaet || 99));
}

/**
 * Normalisiert die geschäftliche Chance (business_opportunity).
 * Stellt sicher, dass bei allem außer expliziter Kaufabsicht (EXPLICIT_INTENT)
 * das Präfix "[Hypothese]" vorangestellt ist. Verhindert doppelte Präfixe.
 * 
 * @param {string} opportunity 
 * @param {string} purchaseIntentStatus 
 * @returns {string}
 */
export function formatBusinessOpportunity(opportunity = '', purchaseIntentStatus = 'TRIGGER_EVENT') {
  if (opportunity == null) return '';
  let text = String(opportunity).trim();
  if (!text) return '';

  if (purchaseIntentStatus === 'EXPLICIT_INTENT') {
    // Bei belegter Kaufabsicht kein Hypothese-Präfix
    return text.replace(/^\[Hypothese\]\s*/i, '');
  }
  // Bei allem anderen ZWINGEND als Hypothese kennzeichnen
  if (!text.startsWith('[Hypothese]')) {
    return `[Hypothese] ${text}`;
  }
  return text;
}

/**
 * Erzeugt den CSV-Inhalt für den Signal-Report inklusive OWASP-Schutz und BOM.
 * Schreibt das Feld business_opportunity inklusive "[Hypothese]" in die CSV.
 * Enthält die 5-Schritte-Assets: Blind Company, Blind Location, Blind Quantity,
 * Target Buyers und Pain Point.
 * 
 * @param {Array} triggers
 * @param {Object} options
 * @returns {string}
 */
export function generateSignalReportCsv(triggers = [], { activeOffering = null } = {}) {
  const headers = [
    'Firma',
    'Branche',
    'Blind Company (Anonymisiert)',
    'Blind Location (Region)',
    'Blind Quantity (Fuzzy-Größe)',
    'Target Buyers (Matchmaking)',
    'Pain Point (Endkäufer)',
    'Anlass (Signal)',
    'Geschäftliche Chance (Hypothese)',
    'Kategorie',
    'Event-Datum',
    'Ereignisdatum verifiziert',
    'Veröffentlichungsdatum',
    'Quellen-URL',
    'Anzahl Quellen',
    'Weitere Quellen',
    'Beleg-Satz',
    'Ziel-Entscheiderrolle',
    'Prüfstatus',
    'Prüfnotizen'
  ];

  const escapeCell = (val) => {
    if (val == null) return '""';
    let str = String(val).replace(/\r?\n/g, ' ');
    str = str.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
    str = str.trim();
    if (/^[=+\-@\t\r|%]/.test(str)) {
      str = `'` + str;
    }
    return `"${str.replace(/"/g, '""')}"`;
  };

  const rows = triggers.map(t => {
    const isVerified = !t.event_date_unverified && Boolean(t.event_date);
    const verifiziertText = isVerified 
      ? (t.has_date_conflict ? 'Teilweise (Datumskonflikt)' : 'Ja') 
      : 'Nein';

    let formattedEventDate = '';
    if (isVerified && t.event_date) {
      try {
        formattedEventDate = new Date(t.event_date).toISOString().slice(0, 10);
      } catch {
        formattedEventDate = String(t.event_date).slice(0, 10);
      }
    }

    if (t.has_date_conflict && t.conflicting_dates && t.conflicting_dates.length > 1) {
      const otherDates = t.conflicting_dates.filter(d => d !== t.event_date);
      if (otherDates.length > 0) {
        formattedEventDate = formattedEventDate 
          ? `${formattedEventDate} (Abweichend: ${otherDates.join(', ')})` 
          : `Abweichende Daten: ${t.conflicting_dates.join(', ')}`;
      }
    }

    let formattedPubDate = '';
    const rawPubDate = t.published_at;
    if (rawPubDate) {
      try {
        formattedPubDate = new Date(rawPubDate).toISOString().slice(0, 10);
      } catch {
        formattedPubDate = String(rawPubDate).slice(0, 10);
      }
    }

    const firma = t.company || t.firmenname || 'Unbekannt';
    const branche = t.branche || activeOffering?.target_industry || 'B2B';
    const anlass = t.signal || t.event_fact || '';
    const boRaw = t.business_opportunity || t.relevanz || '';
    let chance = formatBusinessOpportunity(boRaw, t.purchase_intent_status);
    
    // Falls zusätzliche Hypothesen anderer Angebote vorhanden sind:
    if (Array.isArray(t.all_evaluations) && t.all_evaluations.length > 1) {
      const otherEvals = t.all_evaluations
        .map(e => formatBusinessOpportunity(e.business_opportunity, e.purchase_intent_status))
        .filter(bo => bo && bo !== chance);
      if (otherEvals.length > 0) {
        chance += ` | Weitere Hypothesen: ${otherEvals.join('; ')}`;
      }
    }

    const kategorie = t.signal_kategorie || 'EXPANSION';
    const quelle = t.quelle || '';
    const beleg = t.evidence || t.match_reason || '';
    const rolle = t.position || t.ansprechpartner?.rolle || 'Geschäftsführung / Vertriebsleitung';

    // Quellen & weitere Quellen ermitteln
    const allUrls = Array.from(new Set([quelle, ...(t.all_sources || [])].filter(Boolean)));
    const anzahlQuellen = Math.max(allUrls.length, Array.isArray(t.all_sources) ? t.all_sources.length : (t.duplicate_count || 1));
    const additionalUrls = allUrls.filter(u => u !== quelle);
    const weitereQuellen = anzahlQuellen > 1 ? (additionalUrls.length > 0 ? additionalUrls.join(', ') : (t.all_sources || []).slice(1).join(', ')) : '';

    let pruefstatus = 'Ungeprüft';
    if (t.review_status === 'reviewed') {
      pruefstatus = 'Geprüft';
    } else if (t.review_status === 'rejected') {
      pruefstatus = 'Abgelehnt';
    }
    const pruefnotizen = t.review_notes || '';

    // Metadaten für Lead Brokerage & 5-Schritte-Assets
    const extractMeta = (tag) => {
      if (typeof t.content !== 'string') return '';
      const match = t.content.match(new RegExp(`\\[${tag}\\]:\\s*([^\\n\\r]+)`, 'i'));
      return match ? match[1].trim() : '';
    };

    const blindCompany = t.blind_company || extractMeta('BLIND_COMPANY') || '';
    const blindLocation = t.blind_location || extractMeta('BLIND_LOCATION') || '';
    const blindQuantity = t.blind_quantity || extractMeta('BLIND_QUANTITY') || '';
    const painPoint = t.pain_point || extractMeta('PAIN_POINT') || '';

    let targetBuyersStr = '';
    if (Array.isArray(t.target_buyers) && t.target_buyers.length > 0) {
      targetBuyersStr = t.target_buyers.join(', ');
    } else if (typeof t.target_buyers === 'string' && t.target_buyers) {
      targetBuyersStr = t.target_buyers;
    } else {
      targetBuyersStr = extractMeta('TARGET_BUYERS');
    }

    return [
      escapeCell(firma),
      escapeCell(branche),
      escapeCell(blindCompany),
      escapeCell(blindLocation),
      escapeCell(blindQuantity),
      escapeCell(targetBuyersStr),
      escapeCell(painPoint),
      escapeCell(anlass),
      escapeCell(chance),
      escapeCell(kategorie),
      escapeCell(formattedEventDate),
      escapeCell(verifiziertText),
      escapeCell(formattedPubDate),
      escapeCell(quelle),
      escapeCell(anzahlQuellen),
      escapeCell(weitereQuellen),
      escapeCell(beleg),
      escapeCell(rolle),
      escapeCell(pruefstatus),
      escapeCell(pruefnotizen)
    ].join(';');
  });

  return '\uFEFF' + [headers.map(escapeCell).join(';'), ...rows].join('\r\n');
}


