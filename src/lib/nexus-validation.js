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
 * Normalisiert einen Firmennamen durch Entfernen von Rechtsformen und Sonderzeichen.
 * @param {string} name 
 * @returns {string} normalisierter Name
 */
export function normalizeCompanyName(name) {
  if (!name || typeof name !== 'string') return '';
  return name
    .toLowerCase()
    .replace(/\(?haftungsbeschr[äa]nkt\)?/gi, '')
    .replace(/\b(gmbh\s*&\s*co\.?\s*kg|gmbh\s*&\s*co\s*kg|gmbh|ag|se|e\.?\s*k\.?|kg|ohg|ug|inc\.?|ltd\.?|corp\.?|llc)\b/gi, '')
    .replace(/[^a-z0-9äöüß]+/gi, ' ')
    .trim();
}

/**
 * Dedupliziert Trigger-Listen auf Unternehmensebene:
 * - Identische Ereignisse desselben Unternehmens (gleiches Datum/Kategorie) werden
 *   zu 1 Reporteintrag zusammengeführt (Quellen und Scores aggregiert).
 * - Unterschiedliche reale Ereignisse desselben Unternehmens bleiben als separate Signale erhalten.
 * @param {Array} rawTriggers 
 * @returns {Array} deduplizierte Trigger
 */
export function deduplicateAndMergeTriggers(rawTriggers) {
  if (!Array.isArray(rawTriggers)) return [];
  const map = new Map();

  for (const item of rawTriggers) {
    if (!item) continue;
    const compNorm = normalizeCompanyName(item.company || item.firmenname);
    if (!compNorm) continue;

    // Schlüssel: Kombination aus Firma und Ereignis (Datum + Kategorie),
    // damit ECHTE unterschiedliche Ereignisse derselben Firma erhalten bleiben!
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


