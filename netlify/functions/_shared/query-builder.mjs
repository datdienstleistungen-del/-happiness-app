// ============================================================================
// NeXus _shared/query-builder.mjs — Intelligente Such- und Query-Generierung
// (Phase 2B: Semantische Kern-Extraktion & Branchen-Anker-Integration)
//
// Beseitigt den positionalen Keyword-Kollaps auf Meta-Begriffe wie "Prozess"
// oder "Projekt". Nutzt semantische Extraktion (Heuristik-Fast-Path mit 0 LLM-Kosten
// und LLM-Fallback nur bei uneindeutiger Branche) und verankert jede Query
// an Branche + Produkt + Anlass.
// ============================================================================

import { callLLM } from './llm-core.mjs';

export const DACH_SITE_OPERATOR = '(site:de OR site:at OR site:ch)';
export const DACH_MEDIA_OPERATOR = '(site:presseportal.de OR site:openpr.de OR site:unternehmensregister.de OR site:handelsblatt.com OR site:wiwo.de OR site:manager-magazin.de OR site:bundesanzeiger.de OR site:eqs-news.com OR site:dgap.de)';

// Stoppwörter, die semantisch keinen Suchwert bieten
export const STOP_WORDS = new Set([
  'im', 'in', 'der', 'die', 'das', 'und', 'für', 'fuer', 'mit', 'von', 'aus', 'am', 'an', 'zu',
  'den', 'des', 'dem', 'bereich', 'branche', 'unternehmen', 'firmen', 'kunden', 'gmbh', 'ag',
  'ich', 'möchte', 'moechte', 'bieten', 'anbieten', 'neues', 'ein', 'eine', 'einen', 'einem',
  'unser', 'unsere', 'unseren', 'lösung', 'loesung', 'plattform', 'service', 'services'
]);

// Meta-Begriffe / operative Begriffe, die keine Branche darstellen und nicht
// als primäre Suchanker genutzt werden dürfen
export const META_WORDS = new Set([
  'prozess', 'prozesse', 'projekt', 'projekte', 'verwaltung', 'management', 'system', 'systeme',
  'digitalisierung', 'automatisierung', 'transformation', 'workflow', 'workflows', 'optimierung',
  'software', 'tool', 'tools', 'app', 'loesung', 'lösung', 'plattform', 'service', 'services'
]);

// Branchen-Muster für schnellen 0-Kosten Heuristik-Abgleich
const INDUSTRY_PATTERNS = [
  {
    branche: 'Logistik',
    pattern: /\b(logistik|spedition|speditionsunternehmen|fuhrpark|lagerhaltung|lagerlogistik|transportunternehmen|transportwesen|fracht|lieferkette|supply\s*chain)\b/i,
    defaultAnlass: 'Expansion'
  },
  {
    branche: 'Bau',
    pattern: /\b(bauunternehmen|baugewerbe|bausektor|bauwirtschaft|hochbau|tiefbau|tga|haustechnik|handwerk|handwerksbetriebe|generalunternehmer|bau|baustelle)\b/i,
    defaultAnlass: 'Neubau'
  },
  {
    branche: 'Fertigung',
    pattern: /\b(fertigung|fertigungsunternehmen|fertigungsbetrieb|maschinenbau|produktion|produktionsunternehmen|anlagenbau|metallverarbeitung|hersteller|industrie|werkzeugbau)\b/i,
    defaultAnlass: 'Standorterweiterung'
  },
  {
    branche: 'Recruiting',
    pattern: /\b(recruiting|personalwesen|personalvermittlung|personaldienstleister|headhunting|talent\s*acquisition|hr|fachkr[aä]fte|stellenbesetzung|mitarbeitergewinnung)\b/i,
    defaultAnlass: 'Personalaufbau'
  },
  {
    branche: 'Dokumentenverarbeitung',
    pattern: /\b(dokumentenverarbeitung|dokumentenmanagement|dms|belegverarbeitung|rechnungsverarbeitung|archivierung|ocr|posteingang)\b/i,
    defaultAnlass: 'Digitalisierung'
  },
  {
    branche: 'Vertrieb',
    pattern: /\b(b2b\s*sales|b2b-vertrieb|vertrieb|vertriebssoftware|sales|akquise|leadgenerierung|crm|marketing|vertriebssteuerung)\b/i,
    defaultAnlass: 'Expansion'
  },
  {
    branche: 'IT',
    pattern: /\b(it-dienstleister|systemhaus|cloud|cybersecurity|softwareentwicklung|msp|managed\s*services|it-service)\b/i,
    defaultAnlass: 'Investition'
  },
  {
    branche: 'Handel',
    pattern: /\b(gro[ßss]handel|einzelhandel|e-commerce|online-handel|retail|warenhaus)\b/i,
    defaultAnlass: 'Expansion'
  },
  {
    branche: 'Gesundheitswesen',
    pattern: /\b(gesundheitswesen|medizintechnik|klinik|kliniken|krankenhaus|pharma|gesundheit|pflege|pflegeheim)\b/i,
    defaultAnlass: 'Modernisierung'
  },
  {
    branche: 'Finanzen',
    pattern: /\b(finanzdienstleister|versicherung|banken|fintech|immobilien|real\s*estate)\b/i,
    defaultAnlass: 'Wachstum'
  }
];

const PRODUCT_PATTERNS = [
  { name: 'Software', pattern: /\b(software|saas|app|plattform|tool|tools|system|portal|cloud)\b/i },
  { name: 'DMS', pattern: /\b(dms|dokumentenmanagement|archiv)\b/i },
  { name: 'ERP', pattern: /\b(erp|warenwirtschaft|wawi)\b/i },
  { name: 'CRM', pattern: /\b(crm|kundenverwaltung)\b/i },
  { name: 'Beratung', pattern: /\b(beratung|consulting|agentur|dienstleistung)\b/i }
];

const ANLASS_PATTERNS = [
  { anlass: 'Neubau', pattern: /\b(neubau|spatenstich|neuer standort|werkserweiterung|hallenbau|standorterweiterung)\b/i },
  { anlass: 'Investition', pattern: /\b(investition|investiert|millionen investiert|finanzierungsrunde|kapitalerh[öo]hung)\b/i },
  { anlass: 'Personalaufbau', pattern: /\b(personalaufbau|schafft neue stellen|stellt ein|teamaufbau|mitarbeiteraufbau)\b/i },
  { anlass: 'Expansion', pattern: /\b(expansion|wachstum|standorter[öo]ffnung|markteintritt|[üu]bernahme|fusion)\b/i },
  { anlass: 'Digitalisierung', pattern: /\b(digitalisierung|modernisierung|systemwechsel|transformation|relaunch)\b/i }
];

/**
 * Extrahiert den reinen Volltext aus offering, manualQuery und branche.
 */
function extractFullOfferingText(offering, manualQuery, branche) {
  const parts = [];
  if (branche && typeof branche === 'string') parts.push(branche.trim());
  if (manualQuery && typeof manualQuery === 'string') parts.push(manualQuery.trim());
  if (typeof offering === 'string') {
    parts.push(offering.trim());
  } else if (offering && typeof offering === 'object') {
    if (offering.offering_name) parts.push(offering.offering_name);
    if (offering.target_audience) parts.push(offering.target_audience);
    if (offering.positioning) parts.push(offering.positioning);
    if (offering.ai_understanding) {
      if (typeof offering.ai_understanding === 'string') {
        parts.push(offering.ai_understanding);
      } else if (typeof offering.ai_understanding === 'object') {
        parts.push(JSON.stringify(offering.ai_understanding));
      }
    }
  }
  return parts.join(' ').trim();
}

/**
 * Bereinigt einen Text und extrahiert aussagekräftige Schlüsselbegriffe.
 */
export function extractCleanKeywords(text) {
  if (!text || typeof text !== 'string') return [];
  return text
    .split(/[/,\s;-]+/)
    .map(w => w.trim().replace(/^[^a-zA-Z0-9äöüÄÖÜß]+|[^a-zA-Z0-9äöüÄÖÜß]+$/g, ''))
    .filter(w => w.length > 2 && !STOP_WORDS.has(w.toLowerCase()));
}

/**
 * Leitet Kern-Kontextbegriffe aus dem Offering ab.
 * Filtert Meta-Begriffe (Prozess, Projekt, Verwaltung) heraus, damit diese
 * nicht vor echten Branchen- und Domänenbegriffen landen.
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
  const domainWords = [];
  const metaWords = [];

  for (const p of parts) {
    const lower = p.toLowerCase();
    if (!seen.has(lower)) {
      seen.add(lower);
      if (META_WORDS.has(lower)) {
        metaWords.push(p);
      } else {
        domainWords.push(p);
      }
    }
  }

  // Echte Domänen-Begriffe haben immer Vorrang vor Meta-Begriffen
  const combined = [...domainWords, ...metaWords];

  // Falls "b2b" als einziges Wort bliebe, mit Folge-Begriffen anreichern
  if (combined.length === 1 && combined[0].toLowerCase() === 'b2b') {
    combined.push('Vertrieb', 'Marketing');
  }

  return combined;
}

/**
 * Synchroner Fast-Path zur semantischen Kern-Extraktion (0 LLM-Kosten).
 * Erkennt Standard-Branchen, Produkte und Anlässe regelbasiert.
 */
export function extractSemanticCoreSync(offering, branche = '', manualQuery = '') {
  const text = extractFullOfferingText(offering, manualQuery, branche);
  
  // 1. Wenn branche-Feld explizit vorhanden ist, hat es Vorrang
  let determinedBranche = '';
  let defaultAnlass = 'Investition';

  if (branche && typeof branche === 'string' && branche.trim().length > 0) {
    determinedBranche = branche.trim();
  } else {
    // 2. Regelbasierter Branchen-Abgleich
    for (const ind of INDUSTRY_PATTERNS) {
      if (ind.pattern.test(text)) {
        determinedBranche = ind.branche;
        defaultAnlass = ind.defaultAnlass;
        break;
      }
    }
  }

  // 3. Produkt erkennen
  let determinedProdukt = 'Software';
  for (const prod of PRODUCT_PATTERNS) {
    if (prod.pattern.test(text)) {
      determinedProdukt = prod.name;
      break;
    }
  }

  // 4. Anlass erkennen
  let determinedAnlass = defaultAnlass;
  for (const anl of ANLASS_PATTERNS) {
    if (anl.pattern.test(text)) {
      determinedAnlass = anl.anlass;
      break;
    }
  }

  const isAmbiguous = !determinedBranche;
  if (!determinedBranche) {
    // Falls keine Branche ermittelt werden konnte: bestmöglichen Domänenbegriff ermitteln
    const kw = extractOfferingContext(offering, manualQuery, branche);
    determinedBranche = kw[0] || 'Mittelstand';
  }

  return {
    branche: determinedBranche,
    produkt: determinedProdukt,
    anlass: determinedAnlass,
    isAmbiguous,
    source: isAmbiguous ? 'fallback' : (branche ? 'explicit_branche' : 'heuristic')
  };
}

/**
 * 1. Neue Funktion: extractSemanticCore(offering, branche, manualQuery)
 * Nutzt einen Heuristik-Fast-Path (0 Kosten) und greift nur bei uneindeutiger
 * Branche auf callLLM() mit kurzem JSON-Prompt zurück.
 * Liefert ein decorated Promise zurück, sodass sowohl sync als auch async
 * Aufrufe stabil funktionieren.
 */
export async function extractSemanticCore(offering, branche = '', manualQuery = '') {
  const syncCore = extractSemanticCoreSync(offering, branche, manualQuery);

  // Wenn branche vorhanden ist oder Heuristik eindeutig ist: sofort ohne LLM auflösen (0 Kosten)
  if (!syncCore.isAmbiguous) {
    const p = Promise.resolve(syncCore);
    Object.assign(p, syncCore);
    return p;
  }

  // LLM nur aufrufen, wenn keine eindeutige Branche erkennbar ist
  const text = extractFullOfferingText(offering, manualQuery, branche);
  try {
    const systemPrompt = 'Lies dieses Angebot. Bestimme: (a) die Branche, (b) das Produkt, (c) den Anlass. Antworte als JSON: { "branche": "...", "produkt": "...", "anlass": "..." }';
    const llmRes = await callLLM([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `Angebot:\n${text.slice(0, 400)}` }
    ], {
      profile: 'free',
      jsonMode: true,
      max_tokens: 120,
      temperature: 0.2
    });

    const jsonMatch = (llmRes?.text || '').match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      if (parsed.branche) {
        const core = {
          branche: String(parsed.branche).trim(),
          produkt: String(parsed.produkt || syncCore.produkt || 'Software').trim(),
          anlass: String(parsed.anlass || syncCore.anlass || 'Investition').trim(),
          isAmbiguous: false,
          source: 'llm'
        };
        const p = Promise.resolve(core);
        Object.assign(p, core);
        return p;
      }
    }
  } catch (err) {
    console.warn('[extractSemanticCore] LLM-Aufruf fehlgeschlagen, nutze Heuristik-Fallback:', err?.message || err);
  }

  const p = Promise.resolve(syncCore);
  Object.assign(p, syncCore);
  return p;
}

/**
 * 2. Neue Funktion: buildSearchAnchors(core)
 * Baut die Suchanker aus dem semantischen Kern.
 * Primärer Anker: branche (z.B. "Logistik")
 * Sekundärer Anker: produkt (z.B. "Software")
 * Anlass-Anker: anlass (z.B. "Neubau", "Expansion")
 * Beispiel: "Logistik Software Neubau Deutschland"
 */
export function buildSearchAnchors(core = {}) {
  const branche = (core?.branche || '').trim() || 'Unternehmen';
  const produkt = (core?.produkt || '').trim() || 'Software';
  const anlass = (core?.anlass || '').trim() || 'Investition';

  return {
    branche,
    produkt,
    anlass,
    example: `${branche} ${produkt} ${anlass} Deutschland`,
    primary: branche,
    secondary: produkt,
    trigger: anlass
  };
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
 * Wandelt einen Suchbegriff in eine einfache, natürliche Phrase für Bing News um:
 * Entfernt boolesche Operatoren, Klammern, Anführungszeichen und site:-Direktiven,
 * da Bing News RSS (cc=DE&setlang=de) solche Operatoren nicht verarbeiten kann.
 */
export function simplifyForBingNews(q) {
  if (!q || typeof q !== 'string') return '';
  const cleaned = q
    .replace(/\(site:[^)]+\)/gi, '')
    .replace(/site:\S+/gi, '')
    .replace(/[-+&]/g, ' ')
    .replace(/\b(OR|AND|NOT)\b/g, ' ')
    .replace(/[()"\[\]]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!cleaned) return '';
  if (!/\b(deutschland|österreich|schweiz|dach)\b/i.test(cleaned)) {
    return `${cleaned} Deutschland`;
  }
  return cleaned;
}

/**
 * 3. Integration in buildDachScanQueries()
 * - Wenn branche-Feld vorhanden: nutze es direkt als primären Anker.
 * - Wenn nicht: rufe extractSemanticCore() auf.
 * - Baue Queries immer mit Branchenanker + Produkt + Anlass.
 *
 * Gibt ein synchron destrukturierbares Objekt zurück, das zugleich ein aufgelöstes
 * Promise ist (volle Abwärtskompatibilität für synchrone und asynchrone Aufrufer).
 */
export function buildDachScanQueries({ offering, signalStrategies = [], manualQuery = '', branche = '' } = {}) {
  // 1. Semantischen Kern ermitteln
  const core = extractSemanticCoreSync(offering, branche, manualQuery);
  const anchors = buildSearchAnchors(core);

  const strategyQueries = extractQueriesFromStrategies(signalStrategies);

  // Fall A: Vorhandene konkrete Signal-Strategien nutzen
  if (strategyQueries.length > 0) {
    const newsQueries = [];
    const ddgQueries = [];

    strategyQueries.forEach((q, idx) => {
      // Für Web/DDG: DACH-Fokus mit site-Operator
      const dachQuery = q.includes('site:') || q.includes('Deutschland') || q.includes('DACH')
        ? q
        : `${q} ${DACH_SITE_OPERATOR}`;

      // Für Bing News: Einfache, bereinigte deutsche Phrase ohne boolesche Operatoren
      if (idx % 2 === 0 && newsQueries.length < 4) {
        const cleanNewsQ = simplifyForBingNews(q);
        if (cleanNewsQ.length >= 3) {
          newsQueries.push(cleanNewsQ);
        }
      }
      ddgQueries.push({ q: dachQuery, type: 'STRATEGY' });
    });

    // Ergänze eine Wirtschaftsmedien-Query mit Branchenanker falls Platz
    if (ddgQueries.length < 6) {
      ddgQueries.push({ q: `"${anchors.branche}" ${DACH_MEDIA_OPERATOR}`, type: 'NEWS' });
    }

    // Sicherstellen, dass mindestens 3 News-Queries existieren (immer mit Branchenanker!)
    if (newsQueries.length < 3) {
      newsQueries.push(`${anchors.branche} Investition Deutschland`);
      if (newsQueries.length < 3) {
        newsQueries.push(`${anchors.branche} ${anchors.anlass} Deutschland`);
      }
    }

    const result = {
      newsQueries: newsQueries.slice(0, 4),
      ddgQueries: ddgQueries.slice(0, 7),
      strategySource: 'nexus_signal_strategies',
      semanticCore: core
    };

    const promise = Promise.resolve(result);
    Object.assign(promise, result);
    return promise;
  }

  // Fall B: Definierter Fallback aus semantischem Kern (Branchenanker + Produkt + Anlass)
  const brancheTerm = anchors.branche;
  const produktTerm = anchors.produkt;
  const anlassTerm = anchors.anlass;

  // 1. Achse: Digitale Systemtransformation & Modernisierung (mit Branche & Produkt)
  const techQuery = `"${brancheTerm}" "${produktTerm}" ("Digitalisierung" OR "Modernisierung" OR "Systemwechsel" OR "Einführung") ${DACH_SITE_OPERATOR}`;

  // 2. Achse: Reale Kapazitätserweiterung & Neubau
  const expansionQuery = `"${brancheTerm}" ("Neubau" OR "neuer Standort" OR "Spatenstich" OR "Werkserweiterung" OR "Expansion") ${DACH_SITE_OPERATOR}`;

  // 3. Achse: Investitionen & Wachstumsfinanzierung
  const investmentQuery = `"${brancheTerm}" ("Investition" OR "Millionen investiert" OR "Finanzierungsrunde" OR "Wachstumskurs") ${DACH_SITE_OPERATOR}`;

  // 4. Achse: Strategischer Personalaufbau / Führungskräfte
  const leadershipQuery = `"${brancheTerm}" ("schafft neue Stellen" OR "Personalaufbau" OR "Geschäftsführer" OR "stellt ein") ${DACH_SITE_OPERATOR} -site:stepstone.de -site:indeed.com`;

  // 5. Achse: Renommierte DACH-Wirtschaftsmedien & Ad-hoc
  const mediaQuery = `"${brancheTerm}" (Expansion OR Übernahme OR Investition OR Neubau) ${DACH_MEDIA_OPERATOR}`;

  // Für Bing News: Einfache, hochrelevante deutsche Phrasen ohne boolesche Klammern / site:-Operatoren
  // IMMER mit Branchenanker + Produkt + Anlass
  const newsQueries = [
    `${brancheTerm} ${produktTerm} ${anlassTerm} Deutschland`.replace(/\s+/g, ' ').trim(),
    `${brancheTerm} Investition Deutschland`,
    `${brancheTerm} Neubau Spatenstich Deutschland`,
    `${brancheTerm} Expansion Standort Deutschland`
  ];

  const ddgQueries = [
    { q: techQuery, type: 'TECH_MIGRATION' },
    { q: expansionQuery, type: 'EXPANSION' },
    { q: investmentQuery, type: 'INVESTMENT' },
    { q: leadershipQuery, type: 'HIRING' },
    { q: mediaQuery, type: 'NEWS' }
  ];

  const result = {
    newsQueries,
    ddgQueries,
    strategySource: 'offering_fallback',
    semanticCore: core
  };

  const promise = Promise.resolve(result);
  Object.assign(promise, result);
  return promise;
}
