/**
 * NeXus Kooperationsverträge & Partner-Konditionen Desk
 * 
 * Verwaltet Kooperationspartner, individuelle Schutzfristen (Standard: 18 Monate, variabel auf 12M etc.)
 * sowie vertragliche Besonderheiten (Exklusivität, TIER-1 Fokus, Ansprechpartner, Vertragsdokumente).
 */

export const DEFAULT_PROTECTION_MONTHS = 18;

export const PROTECTION_DURATION_OPTIONS = [
  { value: 18, label: '18 Monate (Neuer Standard / Taskforce-Referenz)', isDefault: true },
  { value: 12, label: '12 Monate (Klassischer Standard)' },
  { value: 24, label: '24 Monate (Erweiterter Langzeitschutz)' },
  { value: 6, label: '6 Monate (Kurzfristige Probephase)' },
  { value: 'custom', label: 'Individuelle Monatsanzahl...' }
];

export const CONTRACT_STATUS_OPTIONS = [
  { id: 'AKTIV_GEZEICHNET', label: '✅ Aktiv gezeichnet', color: '#059669', bg: 'rgba(5, 150, 105, 0.1)' },
  { id: 'IN_ABSTIMMUNG', label: '📝 In Abstimmung / Entwurf', color: '#0284c7', bg: 'rgba(2, 132, 199, 0.1)' },
  { id: 'VERLAENGERUNG_ANSTEHEND', label: '⏳ Verlängerung anstehend', color: '#d97706', bg: 'rgba(217, 119, 6, 0.1)' },
  { id: 'ARCHIVIERT', label: '📁 Archiviert / Beendet', color: '#64748b', bg: 'rgba(100, 116, 139, 0.1)' }
];

export const DEFAULT_COOPERATION_PARTNERS = [
  {
    id: 'taskforce',
    name: 'taskforce - Management on Demand AG',
    shortName: 'taskforce',
    defaultProtectionMonths: 18,
    location: 'München, Deutschland 🇩🇪',
    contactPerson: 'Frank Sieger',
    role: 'Vorstand / Partner Management',
    email: 'frank.sieger@taskforce.net',
    phone: '+49 89 244 147 0',
    contractDate: '2026-01-15',
    contractStatus: 'AKTIV_GEZEICHNET',
    specialConditions: '18 Monate Käufer- & Kundenschutz verbindlich eingeführt. Vorrangiger Provider für TIER-1 CRO & Not-Governance Mandate.',
    contractRef: 'TF-DAT-2026-KV01',
    documentName: 'Kooperationsvertrag_Taskforce_2026_gezeichnet.pdf',
    documentUrl: null,
    updatedAt: '2026-10-28T18:00:00Z'
  },
  {
    id: 'topfifty',
    name: 'Top Fifty AG',
    shortName: 'Top Fifty',
    defaultProtectionMonths: 18,
    location: 'Baar / Zug, Schweiz 🇨🇭',
    contactPerson: 'Pierina Tannò',
    role: 'Senior Partnerin & Board Advisory',
    email: 'p.tanno@top50interim.com',
    phone: '+41 41 768 00 50',
    contractDate: '2026-03-01',
    contractStatus: 'AKTIV_GEZEICHNET',
    specialConditions: '14 Tage Exklusiv-Reservierung Schweiz, danach 18 Monate Kundenschutz nach Übermittlung.',
    contractRef: 'CH-ZG-2026-VR',
    documentName: 'Rahmenvertrag_TopFifty_Schweiz_2026.pdf',
    documentUrl: null,
    updatedAt: '2026-10-28T18:00:00Z'
  },
  {
    id: 'atreus',
    name: 'Atreus GmbH',
    shortName: 'Atreus',
    defaultProtectionMonths: 18,
    location: 'München, Deutschland 🇩🇪',
    contactPerson: 'Dr. Harald Linné',
    role: 'Director Restructuring & Transformation',
    email: 'linne@atreus.de',
    phone: '+49 89 452 249 0',
    contractDate: '2026-06-01',
    contractStatus: 'IN_ABSTIMMUNG',
    specialConditions: 'Standard-Kooperationsvertrag: 18 Monate Käuferschutz auf alle nachgewiesenen Primärsignale.',
    contractRef: 'ATR-DAT-2026-DE',
    documentName: 'Entwurf_Kooperationsvertrag_Atreus_2026.pdf',
    documentUrl: null,
    updatedAt: '2026-10-28T18:00:00Z'
  }
];

const STORAGE_KEY = 'nexus_cooperation_partners';

/**
 * Lädt alle hinterlegten Kooperationsverträge
 */
export function getCooperationPartners() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (e) {
    console.warn('[nexus-partners] Failed to parse local partners:', e);
  }
  // Initialisiere mit Defaults
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_COOPERATION_PARTNERS));
  } catch (e) {}
  return DEFAULT_COOPERATION_PARTNERS;
}

/**
 * Speichert die gesamte Partner-Liste
 */
export function saveCooperationPartners(partners) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(partners));
    window.dispatchEvent(new Event('nexus_partners_updated'));
    return true;
  } catch (e) {
    console.error('[nexus-partners] Error saving partners:', e);
    return false;
  }
}

/**
 * Fügt einen neuen Vertrag hinzu oder aktualisiert einen bestehenden
 */
export function savePartnerContract(partnerData) {
  const current = getCooperationPartners();
  const id = partnerData.id || `partner_${Date.now()}`;
  const months = parseInt(partnerData.defaultProtectionMonths, 10) || DEFAULT_PROTECTION_MONTHS;

  const updatedEntry = {
    ...partnerData,
    id,
    defaultProtectionMonths: months,
    updatedAt: new Date().toISOString()
  };

  const existingIndex = current.findIndex(p => p.id === id || p.name?.toLowerCase() === partnerData.name?.toLowerCase());
  let nextList = [];
  if (existingIndex >= 0) {
    nextList = [...current];
    nextList[existingIndex] = { ...nextList[existingIndex], ...updatedEntry };
  } else {
    nextList = [updatedEntry, ...current];
  }

  saveCooperationPartners(nextList);
  return updatedEntry;
}

/**
 * Löscht einen Partnervertrag
 */
export function deletePartnerContract(partnerId) {
  const current = getCooperationPartners();
  const filtered = current.filter(p => p.id !== partnerId);
  saveCooperationPartners(filtered);
  return filtered;
}

/**
 * Findet einen Partner anhand ID oder Name
 */
export function getPartnerByNameOrId(query) {
  if (!query) return null;
  const partners = getCooperationPartners();
  const qLower = query.toLowerCase().trim();
  return partners.find(p => p.id === query || p.name?.toLowerCase().includes(qLower) || p.shortName?.toLowerCase() === qLower) || null;
}

/**
 * Berechnet das Kalendermonats-Enddatum nach der gesetzlichen Ultimo-Regel (z. B. BGB § 188 Abs. 3 / OR Art. 77).
 * Existiert der Ausgangstag im Zielmonat nicht (z. B. 31. Januar + 1 Monat), endet die Frist mit Ablauf des
 * letzten Tages dieses Monats (28. Februar bzw. 29. Februar in Schaltjahren).
 * 
 * Verwendet strikt UTC-Komponenten, um Browser-Zeitzonensprünge auszuschließen.
 * Gibt bei fehlendem oder ungültigem Datum strikt null zurück (kein stiller Fallback auf Date.now()).
 */
export function addCalendarMonthsUtc(dateInput, monthsToAdd) {
  if (!dateInput) return null;
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return null;

  const m = parseInt(monthsToAdd, 10);
  if (isNaN(m)) return null;

  const startYear = d.getUTCFullYear();
  const startMonth = d.getUTCMonth();
  const startDay = d.getUTCDate();
  const hours = d.getUTCHours();
  const minutes = d.getUTCMinutes();
  const seconds = d.getUTCSeconds();
  const ms = d.getUTCMilliseconds();

  // Zielmonat und -jahr berechnen
  const totalMonths = startMonth + m;
  const targetYear = startYear + Math.floor(totalMonths / 12);
  const targetMonth = ((totalMonths % 12) + 12) % 12;

  // Letzter Tag des Zielmonats (Tag 0 des Folgemonats liefert den letzten Tag des Zielmonats)
  const daysInTargetMonth = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();

  // Ultimo-Regel: Falls Starttag größer als Tage im Zielmonat, auf Monatsende kappen
  const targetDay = Math.min(startDay, daysInTargetMonth);

  return new Date(Date.UTC(targetYear, targetMonth, targetDay, hours, minutes, seconds, ms));
}

/**
 * Formatiert ein Datum zeitzonensicher als deutsches Kalenderdatum (DD.MM.YYYY) basierend auf UTC.
 */
export function formatCalendarDateUtc(dateInput) {
  if (!dateInput) return '';
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return '';
  const day = String(d.getUTCDate()).padStart(2, '0');
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const year = d.getUTCFullYear();
  return `${day}.${month}.${year}`;
}

/**
 * Wandelt ein Datum zeitzonensicher in ISO-Kalenderdatum (YYYY-MM-DD) basierend auf UTC um.
 */
export function toCalendarDateIso(dateInput) {
  if (!dateInput) return '';
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return '';
  const day = String(d.getUTCDate()).padStart(2, '0');
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const year = d.getUTCFullYear();
  return `${year}-${month}-${day}`;
}

/**
 * Berechnet das Enddatum des Kundenschutzes basierend auf Startdatum und Monatsanzahl.
 * Gibt null zurück, wenn kein gültiges Startdatum übergeben wurde.
 */
export function calculateProtectionEndDate(startDate, months = DEFAULT_PROTECTION_MONTHS) {
  if (!startDate) return null;
  return addCalendarMonthsUtc(startDate, months);
}

/**
 * Verbindliches Kanonisches Mandats-Statusmodell (Single Source of Truth)
 */
export const MANDATE_STATUS = Object.freeze({
  ANGEBOTEN_RESERVIERT: 'ANGEBOTEN_RESERVIERT',
  AKTIV_GESCHUETZT: 'AKTIV_GESCHUETZT',
  IN_VERHANDLUNG: 'IN_VERHANDLUNG',
  MANDATIERT: 'MANDATIERT',
  ABGELAUFEN: 'ABGELAUFEN',
  STORNIERT: 'STORNIERT'
});

/**
 * Bekannte Legacy- und Sprach-Aliase, die deterministisch auf das kanonische Statusmodell abgebildet werden.
 */
export const MANDATE_STATUS_ALIASES = Object.freeze({
  'ACTIVE_PROTECTED': MANDATE_STATUS.AKTIV_GESCHUETZT,
  'MANDATED': MANDATE_STATUS.MANDATIERT,
  'EXPIRED': MANDATE_STATUS.ABGELAUFEN,
  'OFFERED_RESERVED': MANDATE_STATUS.ANGEBOTEN_RESERVIERT
});

/**
 * Fehlerklasse für unbekannte oder ungültige Mandatsstatuswerte.
 * Verhindert das stillschweigende Durchwinken oder fehlerhafte Zuordnen ungültiger Werte.
 */
export class InvalidMandateStatusError extends Error {
  constructor(status, message) {
    const detailMsg = message || `Unbekannter oder ungültiger Mandatsstatus: '${status}'. Erlaubte Werte: ${Object.values(MANDATE_STATUS).join(', ')}`;
    super(detailMsg);
    this.name = 'InvalidMandateStatusError';
    this.rawStatus = status;
  }
}

/**
 * Prüft, ob ein Statuswert bereits ein gültiger kanonischer Statuswert ist.
 * 
 * @param {any} rawStatus 
 * @returns {boolean}
 */
export function isValidMandateStatus(rawStatus) {
  if (typeof rawStatus !== 'string') return false;
  const trimmed = rawStatus.trim().toUpperCase();
  return Object.values(MANDATE_STATUS).includes(trimmed);
}

/**
 * Normalisiert einen Mandatsstatus deterministisch auf das kanonische Statusmodell.
 * 
 * Regeln:
 * 1. Bereits gültige kanonische Statuswerte bleiben unverändert.
 * 2. Bekannte Legacy-Werte werden explizit transformiert:
 *    - ACTIVE_PROTECTED -> AKTIV_GESCHUETZT
 *    - MANDATED -> MANDATIERT
 *    - EXPIRED -> ABGELAUFEN
 *    - OFFERED_RESERVED -> ANGEBOTEN_RESERVIERT
 * 3. Whitespace und Groß-/Kleinschreibung werden tolerant bereinigt.
 * 4. Unbekannte oder nicht-stringbasierte Werte werden NIEMALS stillschweigend
 *    umgewandelt, sondern lösen eine nachvollziehbare InvalidMandateStatusError-Ausnahme aus.
 * 
 * @param {string} rawStatus 
 * @returns {string} Kanonischer Statuswert aus MANDATE_STATUS
 * @throws {InvalidMandateStatusError} wenn der Status ungültig oder unbekannt ist
 */
export function normalizeMandateStatus(rawStatus) {
  if (typeof rawStatus !== 'string') {
    throw new InvalidMandateStatusError(
      rawStatus,
      `Ungültiger Typ für Mandatsstatus: Erwartet wurde ein String, erhalten: ${rawStatus === null ? 'null' : typeof rawStatus}`
    );
  }

  const trimmed = rawStatus.trim().toUpperCase();
  if (!trimmed) {
    throw new InvalidMandateStatusError(rawStatus, 'Ungültiger Mandatsstatus: Der übergebene Status ist leer.');
  }

  // 1. Bereits gültiger kanonischer Statuswert
  if (Object.values(MANDATE_STATUS).includes(trimmed)) {
    return trimmed;
  }

  // 2. Bekannte Legacy-Zuordnungen
  if (MANDATE_STATUS_ALIASES[trimmed]) {
    return MANDATE_STATUS_ALIASES[trimmed];
  }

  // 3. Unbekannter oder nicht unterstützter Statuswert -> nachvollziehbar zurückweisen
  throw new InvalidMandateStatusError(rawStatus);
}

