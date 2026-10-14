// ============================================================================
// NeXus _shared/query-builder.mjs — Intelligente Such- und Query-Generierung
// (Phase 2A: Beseitigung des Keyword-Kollapses & Signalstrategien-Integration)
//
// Verhindert den fatalen Kollaps auf das erste Einzelwort (z.B. "B2B"),
// nutzt vorhandene nexus_signal_strategies und erzeugt bei Fehlen einen
// differenzierten, branchenspezifischen Fallback mit mehreren Suchachsen.
// ============================================================================

export const DACH_SITE_OPERATOR = '(site:de OR site:at OR site:ch)';
export const DACH_MEDIA_OPERATOR = '(site:presseportal.de OR site:openpr.de OR site:unternehmensregister.de OR site:handelsblatt.com OR site:wiwo.de OR site:manager-magazin.de OR site:bundesanzeiger.de OR site:eqs-news.com OR site:dgap.de)';

// Stoppwörter, die semantisch keinen Suchwert bieten
const STOP_WORDS = new Set([
  'im', 'in', 'der', 'die', 'das', 'und', 'für', 'fuer', 'mit', 'von', 'aus', 'am', 'an', 'zu',
  'den', 'des', 'dem', 'bereich', 'branche', 'unternehmen', 'firmen', 'kunden', 'gmbh', 'ag',
  'ich', 'möchte', 'moechte', 'bieten', 'anbieten', 'neues', 'ein', 'eine', 'einen', 'einem',
  'unser', 'unsere', 'unseren', 'lösung', 'loesung', 'plattform', 'service', 'services'
]);

/**
 * Bereinigt einen Text und extrahiert aussagekräftige Schlüsselbegriffe,
 * OHNE auf ein einziges Wort zu verkürzen.
 */
export function extractCleanKeywords(text) {
  if (!text || typeof text !== 'string') return [];
  return text
    .split(/[/,\s;-]+/)
    .map(w => w.trim().replace(/^[^a-zA-Z0-9äöüÄÖÜß]+|[^a-zA-Z0-9äöüÄÖÜß]+$/g, ''))
    .filter(w => w.length > 2 && !STOP_WORDS.has(w.toLowerCase()));
}

/**
 * Leitet Kern-Kontextbegriffe aus dem Offering ab (mindestens 2-4 Begriffe).
 * Verhindert, dass "B2B SaaS" auf "B2B" kollabiert.
 */
export function extractOfferingContext(offering, manualQuery, branche) {
  const parts = [];
  if (manualQuery && typeof manualQuery === 'string') {
    parts.push(...extractCleanKeywords(manualQuery));
  }
  if (offering?.offering_name) {
    parts.push(...extractCleanKeywords(offering.offering_name));
  }
  if (offering?.target_audience) {
    parts.push(...extractCleanKeywords(offering.target_audience));
  }
  if (branche) {
    parts.push(...extractCleanKeywords(branche));
  }
  if (offering?.positioning) {
    parts.push(...extractCleanKeywords(offering.positioning));
  }

  // Deduplizieren unter Beibehaltung der Reihenfolge
  const seen = new Set();
  const unique = [];
  for (const p of parts) {
    const lower = p.toLowerCase();
    if (!seen.has(lower)) {
      seen.add(lower);
      unique.push(p);
    }
  }

  // Falls "b2b" als einziges Wort bliebe, mit Folge-Begriffen anreichern
  if (unique.length === 1 && unique[0].toLowerCase() === 'b2b') {
    unique.push('Vertrieb', 'Marketing');
  }

  return unique;
}

/**
 * Filtert und normalisiert Suchabfragen aus vorhandenen nexus_signal_strategies.
 */
export function extractQueriesFromStrategies(signalStrategies) {
  if (!Array.isArray(signalStrategies) || signalStrategies.length === 0) return [];
  const queries = [];
  const seen = new Set();

  for (const s of signalStrategies) {
    if (!Array.isArray(s.search_queries)) continue;
    for (const sq of s.search_queries) {
      const qStr = typeof sq === 'string' ? sq : sq?.query;
      if (!qStr || typeof qStr !== 'string') continue;
      const clean = qStr.trim();
      if (clean.length < 5) continue;

      const norm = clean.toLowerCase();
      if (!seen.has(norm)) {
        seen.add(norm);
        queries.push(clean);
      }
    }
  }
  return queries;
}

/**
 * Baut die finalen Suchabfragen für Bing News und DuckDuckGo auf.
 * Berücksichtigt vorhandene Strategien ODER erzeugt einen differenzierten Fallback.
 */
export function buildDachScanQueries({ offering, signalStrategies = [], manualQuery = '', branche = '' } = {}) {
  const strategyQueries = extractQueriesFromStrategies(signalStrategies);

  // Fall A: Vorhandene konkrete Signal-Strategien nutzen
  if (strategyQueries.length > 0) {
    const newsQueries = [];
    const ddgQueries = [];

    strategyQueries.forEach((q, idx) => {
      // Stellen sicher, dass DACH-Fokus vorhanden ist
      const dachQuery = q.includes('site:') || q.includes('Deutschland') || q.includes('DACH')
        ? q
        : `${q} ${DACH_SITE_OPERATOR}`;

      if (idx % 2 === 0 && newsQueries.length < 4) {
        newsQueries.push(dachQuery);
      }
      ddgQueries.push({ q: dachQuery, type: 'STRATEGY' });
    });

    // Ergänze eine Wirtschaftsmedien-Query falls Platz
    if (ddgQueries.length < 6) {
      const kwList = extractOfferingContext(offering, manualQuery, branche);
      const focusWord = kwList[0] || 'Mittelstand';
      ddgQueries.push({ q: `"${focusWord}" ${DACH_MEDIA_OPERATOR}`, type: 'NEWS' });
    }

    return {
      newsQueries: newsQueries.slice(0, 4),
      ddgQueries: ddgQueries.slice(0, 7),
      strategySource: 'nexus_signal_strategies'
    };
  }

  // Fall B: Definierter Fallback aus Offering-Kontext (Multi-Achsen-Suche)
  const contextWords = extractOfferingContext(offering, manualQuery, branche);
  
  // Kombiniere die wichtigsten 2-3 Fachbegriffe (z.B. ["Vertrieb", "Marketing"] oder ["Logistik", "Spedition"])
  const domainTerms = contextWords.filter(w => w.toLowerCase() !== 'b2b').slice(0, 3);
  const primaryTopic = domainTerms[0] || contextWords[0] || 'Unternehmen';
  const secondaryTopic = domainTerms[1] || 'Vertrieb';
  const combinedContext = domainTerms.length >= 2 ? `("${primaryTopic}" OR "${secondaryTopic}")` : `"${primaryTopic}"`;

  // 1. Achse: Digitale Systemtransformation & Relaunch (passend für Software/SaaS/Tools)
  const isSoftwareContext = contextWords.some(w => /software|saas|it|digital|marketing|vertrieb|crm|erp|shop/i.test(w));
  
  const techQuery = isSoftwareContext
    ? `("neuer B2B-Shop" OR "digitaler Vertrieb" OR "Relaunch" OR "Vertriebsplattform") ${DACH_SITE_OPERATOR}`
    : `${combinedContext} ("Modernisierung" OR "Digitalisierung" OR "Systemwechsel") ${DACH_SITE_OPERATOR}`;

  // 2. Achse: Reale Kapazitätserweiterung & Neubau
  const expansionQuery = `${combinedContext} ("Neubau" OR "neuer Standort" OR "Spatenstich" OR "Werkserweiterung") ${DACH_SITE_OPERATOR}`;

  // 3. Achse: Investitionen & Wachstumsfinanzierung
  const investmentQuery = `${combinedContext} ("Investition" OR "Millionen investiert" OR "Finanzierungsrunde" OR "Wachstumskurs") ${DACH_SITE_OPERATOR}`;

  // 4. Achse: Strategischer Führungskräfteaufbau
  const leadershipQuery = isSoftwareContext
    ? `("Head of Sales" OR "Head of Marketing" OR "Vertriebsleiter") ("stellt ein" OR "baut Team aus" OR "neue Stellen") ${DACH_SITE_OPERATOR} -site:stepstone.de -site:indeed.com`
    : `${combinedContext} ("schafft neue Stellen" OR "Personalaufbau" OR "Geschäftsführer") ${DACH_SITE_OPERATOR} -site:stepstone.de -site:indeed.com`;

  // 5. Achse: Renommierte DACH-Wirtschaftsmedien & Ad-hoc
  const mediaQuery = `${combinedContext} (Expansion OR Übernahme OR Investition) ${DACH_MEDIA_OPERATOR}`;

  const newsQueries = [
    `${primaryTopic} expandiert (Deutschland OR Österreich OR Schweiz)`,
    expansionQuery,
    investmentQuery
  ];

  const ddgQueries = [
    { q: techQuery, type: 'TECH_MIGRATION' },
    { q: expansionQuery, type: 'EXPANSION' },
    { q: investmentQuery, type: 'INVESTMENT' },
    { q: leadershipQuery, type: 'HIRING' },
    { q: mediaQuery, type: 'NEWS' }
  ];

  return {
    newsQueries,
    ddgQueries,
    strategySource: 'offering_fallback'
  };
}
