// ============================================================================
// NeXus _shared/url-rules.mjs — URL-Blocklist fuer die Radar-Pipeline
// (Phase 5a, B1-Suchrauschen)
//
// Strukturelles Rauschen rausfiltern, bevor Treffer in nexus_radar_hits
// landen: Jobboersen/Karriere-Aggregatoren, Social Networks, Kleinanzeigen,
// Suchmaschinen-Ergebnisseiten. NICHT gefiltert: echte Nachrichten-Publisher
// (M&A/Expansion-Signale), Firmen-Websites — deren Relevanz entscheidet B2.
//
// Env: RADAR_BLOCKLIST (kommagetrennt) ERGAENZT die eingebaute Liste.
// Beispiel: RADAR_BLOCKLIST="beispiel.de,andere.example"
// ============================================================================

const DEFAULT_BLOCKED_DOMAINS = [
  // Jobboersen & Karriere-Aggregatoren (kein Unternehmens-Signal, sondern Marktplatz)
  'stepstone.de', 'stepstone.at', 'stepstone.co.uk',
  'indeed.com', 'indeed.de',
  'monster.de', 'monster.com',
  'jobware.de', 'karriere.de', 'karriere.at',
  'gehalt.de', 'absolventa.de',
  'kununu.com',
  'arbeitsagentur.de',
  // Social Networks (Profil-/Post-Rauschen, kaum crawelbar)
  'instagram.com', 'facebook.com', 'xing.com', 'linkedin.com',
  'tiktok.com', 'twitter.com', 'x.com',
  // Kleinanzeigen & Marktplaetze
  'kleinanzeigen.de', 'ebay-kleinanzeigen.de', 'quoka.de', 'markt.de',
  // Suchmaschinen-Ergebnisseiten (Zwischenlayer, kein Originalinhalt)
  'google.com', 'bing.com', 'google.de'
];

// Einmalig beim Laden: Defaults + Env-Ergaenzungen (dedupliziert, lowercase).
function buildBlockedDomains() {
  const set = new Set(DEFAULT_BLOCKED_DOMAINS.map(d => d.toLowerCase()));
  const envList = process.env.RADAR_BLOCKLIST || '';
  for (const part of envList.split(/[\s,;]+/)) {
    const d = part.trim().toLowerCase().replace(/^\.+/, '');
    if (d) set.add(d);
  }
  return set;
}

const BLOCKED_DOMAINS = buildBlockedDomains();

export function getBlockedDomains() {
  return [...BLOCKED_DOMAINS];
}

// true wenn die URL-Domain auf eine geblockte Domain zulaeuft
// (exakter Treffer oder Subdomain: jobs.stepstone.de -> stepstone.de).
export function isBlockedUrl(url) {
  if (!url) return true;
  try {
    const host = new URL(url).hostname.toLowerCase().replace(/^www\./, '');
    for (const d of BLOCKED_DOMAINS) {
      if (host === d || host.endsWith('.' + d)) return true;
    }
    return false;
  } catch {
    // Unparsebare URL: als Rauschen behandeln (nie ein Treffer wert)
    return true;
  }
}
