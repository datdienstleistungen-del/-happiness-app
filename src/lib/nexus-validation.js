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

