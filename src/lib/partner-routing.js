/**
 * NeXus Partner Routing & Dispatch Tracking Engine
 * 
 * Verwaltet das Provider- & Boutiquen-Verzeichnis (DACH-Raum),
 * steuert die Best-Match Vorschlagslogik (Prio 1: taskforce AG)
 * und überwacht die 48h-Versandsperre mit Kollisionswarnung.
 */

import providerData from '../../data/partners/provider_directory.json';

export const PROVIDERS = providerData.providers || [];
export const ACTIVE_CONTRACT_PARTNER_ID = providerData.active_contract_partner_id || 'taskforce';

/**
 * Liefert alle hinterlegten Provider
 */
export function getProviderDirectory() {
  return PROVIDERS;
}

/**
 * Sucht einen Provider anhand seiner ID oder seines Namens
 */
export function getProviderById(idOrName) {
  if (!idOrName) return null;
  const query = String(idOrName).toLowerCase().trim();
  return PROVIDERS.find(p => 
    p.id.toLowerCase() === query || 
    p.name.toLowerCase().includes(query) || 
    p.short_name.toLowerCase().includes(query)
  ) || null;
}

/**
 * Filtert Provider nach TIER (TIER_1, TIER_2, TIER_3)
 */
export function getProvidersByTier(tier) {
  return PROVIDERS.filter(p => p.tier === tier);
}

/**
 * Best-Match Vorschlags-Logik:
 * Ermittelt automatisch den optimalen Partner für ein Signal/Mandat.
 * 
 * Regeln:
 * 1. Spezial-Fälle (Healthcare / Klinik wie Bruckmühl) -> Direkt Curacon / WMC (TIER 3)
 * 2. Distressed M&A / Asset-Verwertung -> Direkt CVM Capital / FalkenSteg
 * 3. International / UK -> BIE Executive
 * 4. Prio 1 Standard immer: taskforce AG (einziger aktiver Vertragspartner)
 * 
 * @param {object} lead - Das Mandat / die Opportunity
 * @param {string} [excludedPartnerId] - Optional: Provider ausschließen (z. B. nach 48h Timeout)
 * @returns {object} { partner, rationale, matchScore, isSpecialtyMatch, tier }
 */
export function recommendPartnerForLead(lead, excludedPartnerId = null) {
  if (!lead) {
    const defaultP = getProviderById(ACTIVE_CONTRACT_PARTNER_ID);
    return {
      partner: defaultP,
      rationale: 'Standard-Empfehlung: taskforce AG (Rechtsverbindlicher Rahmenvertrag, 18M Schutz)',
      matchScore: 95,
      isSpecialtyMatch: false,
      tier: defaultP?.tier || 'TIER_1'
    };
  }

  const textToScan = [
    lead.company || lead.nexus_companies?.name || '',
    lead.title || '',
    lead.situation || '',
    lead.strategic_angle || '',
    lead.category || '',
    lead.notes || '',
    Array.isArray(lead.tags) ? lead.tags.join(' ') : ''
  ].join(' ').toLowerCase();

  // ── 1. REGEL: HEALTHCARE & KLINIKEN (Spezial-Boutique Nische) ──
  const isHealthcare = [
    'reha', 'klinik', 'krankenhaus', 'healthcare', 'gesundheit',
    'pflege', 'medizin', 'wohnstift', 'hospital', 'geriatri', 'bruckmühl'
  ].some(k => textToScan.includes(k));

  if (isHealthcare && excludedPartnerId !== 'curacon-wmc') {
    const curacon = getProviderById('curacon-wmc');
    if (curacon) {
      return {
        partner: curacon,
        rationale: '🎯 Spezial-Boutique (TIER 3): Klinik-, Reha- & Healthcare-Mandate erfordern spezifische Branchen-Expertise (Krankenhausreform / Pflegesatzverhandlung).',
        matchScore: 98,
        isSpecialtyMatch: true,
        tier: 'TIER_3'
      };
    }
  }

  // ── 2. REGEL: REINE ASSET-VERWERTUNG / ZERSCHLAGUNG ──
  const isAssetLiquidation = [
    'verwertung', 'asset-verkauf', 'maschinenverwertung', 'zerschlagung',
    'anlagevermögen', 'verwertungsgesellschaft'
  ].some(k => textToScan.includes(k));

  if (isAssetLiquidation && excludedPartnerId !== 'cvm-capital') {
    const cvm = getProviderById('cvm-capital');
    if (cvm) {
      return {
        partner: cvm,
        rationale: '🎯 Spezial-Boutique (TIER 3): Akute Asset-Verwertung und sondersituationsbezogene Verwertungsauktionen.',
        matchScore: 92,
        isSpecialtyMatch: true,
        tier: 'TIER_3'
      };
    }
  }

  // ── 3. REGEL: GROSS-PROVIDER TASKFORCE AG (PRIO 1 AKTIVER VERTRAG) ──
  if (excludedPartnerId !== ACTIVE_CONTRACT_PARTNER_ID) {
    const taskforce = getProviderById(ACTIVE_CONTRACT_PARTNER_ID);
    if (taskforce) {
      return {
        partner: taskforce,
        rationale: '👑 Exklusiv-Vertragspartner (TIER 1): 18 Monate Kundenschutz, 5% Provision, priorisierte Bearbeitung für Vorstand, CRO & StaRUG.',
        matchScore: 95,
        isSpecialtyMatch: false,
        tier: 'TIER_1'
      };
    }
  }

  // ── 4. FALLBACK: ZWEITVERWERTUNG NACH TASKFORCE TIMEOUT ──
  // Wenn taskforce ausgeschlossen wurde (z. B. nach 48h ohne Rückmeldung):
  if (textToScan.includes('starug') || textToScan.includes('schutzschirm') || textToScan.includes('eigenverwaltung')) {
    const falkensteg = getProviderById('falkensteg');
    if (falkensteg && excludedPartnerId !== 'falkensteg') {
      return {
        partner: falkensteg,
        rationale: '🏢 Zweitverwertung (TIER 2): FalkenSteg ist spezialisiert auf StaRUG-, Eigenverwaltungs- & Schutzschirmverfahren.',
        matchScore: 88,
        isSpecialtyMatch: false,
        tier: 'TIER_2'
      };
    }
  }

  const fp = getProviderById('fp-executive');
  if (fp && excludedPartnerId !== 'fp-executive') {
    return {
      partner: fp,
      rationale: '🏢 Zweitverwertung (TIER 2): F&P Executive Solutions – führende Sozietät für mittelständische Krisenmandate & Turnaround.',
      matchScore: 85,
      isSpecialtyMatch: false,
      tier: 'TIER_2'
    };
  }

  const atreus = getProviderById('atreus');
  return {
    partner: atreus || PROVIDERS[0],
    rationale: 'Groß-Provider (TIER 1): Alternative Groß-Transformation & Sanierung.',
    matchScore: 80,
    isSpecialtyMatch: false,
    tier: 'TIER_1'
  };
}

/**
 * Liefert den nächsten Folge-Partner für die Zweitverwertung
 * nach Ablauf des 48h-Zeitfensters.
 */
export function getNextPartnerForReroute(currentPartnerId, lead) {
  return recommendPartnerForLead(lead, currentPartnerId);
}

/**
 * Berechnet den exakten 48h-Versand- und Sperrstatus für ein Mandat.
 * 
 * Mögliche Statuswerte:
 * - 'NONE': Noch nicht versendet, frei für Erstversand
 * - 'SENT_PENDING': Versendet, innerhalb der 48h-Frist (BLOCKIERT)
 * - 'NO_RESPONSE_RELEASED': 48h ohne Bestätigung verstrichen (FREIGEGEBEN FÜR ZWEITVERWERTUNG)
 * - 'CONFIRMED': Vom Provider mandatiert / bestätigt
 * 
 * @param {object} lead - Mandat / Opportunity
 * @returns {object} Tracking-Status-Objekt
 */
export function getOutreachTrackingStatus(lead) {
  if (!lead) {
    return {
      status: 'NONE',
      isSentPending: false,
      isLocked48h: false,
      isExpired48h: false,
      remainingHours: 0,
      remainingMinutes: 0,
      partnerId: null,
      partnerName: null,
      partner: null,
      sentAt: null,
      expiresAt: null,
      badgeText: '',
      badgeColor: '#64748b',
      nextRecommendedPartner: null
    };
  }

  // 1. Extrahiere gespeicherte Versanddaten aus Lead-Objekt oder Tags
  let outreachStatus = lead.outreach_status || null;
  let sentToPartnerId = lead.sent_to_partner_id || null;
  let sentAtIso = lead.sent_at || null;
  let expiresAtIso = lead.expires_at || null;

  // Fallback aus review_notes oder metadata prüfen falls direkt in DB persistiert
  if (!outreachStatus && typeof lead.review_notes === 'string') {
    if (lead.review_notes.includes('SENT_PENDING') || lead.review_notes.includes('Angeboten an')) {
      outreachStatus = 'SENT_PENDING';
      const mPartner = lead.review_notes.match(/(?:an|Partner:?)\s*([A-Za-z0-9\-_ &]+)/i);
      if (mPartner) {
        const foundP = getProviderById(mPartner[1]);
        if (foundP) sentToPartnerId = foundP.id;
      }
    }
  }

  // Fallback aus tags prüfen
  if (Array.isArray(lead.tags)) {
    if (lead.tags.includes('SENT_PENDING') || lead.tags.includes('outreach_sent') || lead.tags.includes('contacted')) {
      if (!outreachStatus) outreachStatus = 'SENT_PENDING';
    }
    lead.tags.forEach(t => {
      if (t.startsWith('sent_to:')) sentToPartnerId = t.replace('sent_to:', '');
      if (t.startsWith('sent_at:')) sentAtIso = t.replace('sent_at:', '');
    });
  }

  // Wenn noch nie versendet wurde
  if (!outreachStatus || outreachStatus === 'NONE') {
    return {
      status: 'NONE',
      isSentPending: false,
      isLocked48h: false,
      isExpired48h: false,
      remainingHours: 0,
      remainingMinutes: 0,
      partnerId: null,
      partnerName: null,
      partner: null,
      sentAt: null,
      expiresAt: null,
      badgeText: 'Bereit zum Erstversand',
      badgeColor: '#10b981',
      nextRecommendedPartner: recommendPartnerForLead(lead).partner
    };
  }

  // Wenn bereits fest mandatiert / bestätigt
  if (outreachStatus === 'CONFIRMED' || lead.review_status === 'verified' && lead.pipeline_stage === 'dispatched') {
    const partner = getProviderById(sentToPartnerId || 'taskforce');
    return {
      status: 'CONFIRMED',
      isSentPending: false,
      isLocked48h: false,
      isExpired48h: false,
      remainingHours: 0,
      remainingMinutes: 0,
      partnerId: partner?.id || 'taskforce',
      partnerName: partner?.short_name || partner?.name || 'taskforce AG',
      partner,
      sentAt: sentAtIso,
      expiresAt: expiresAtIso,
      badgeText: `✅ Mandat aktiv bei ${partner?.short_name || 'Partner'}`,
      badgeColor: '#059669',
      nextRecommendedPartner: null
    };
  }

  // Berechne 48-Stunden-Frist
  const now = Date.now();
  const sentTime = sentAtIso ? new Date(sentAtIso).getTime() : (lead.updated_at ? new Date(lead.updated_at).getTime() : now);
  const expiresTime = expiresAtIso ? new Date(expiresAtIso).getTime() : (sentTime + 48 * 3600 * 1000);
  
  const diffMs = expiresTime - now;
  const isLocked48h = diffMs > 0;
  const isExpired48h = diffMs <= 0;

  const partner = getProviderById(sentToPartnerId || 'taskforce') || PROVIDERS[0];
  const partnerName = partner?.short_name || partner?.name || 'Provider';

  if (isLocked48h) {
    const remainingHours = Math.floor(diffMs / (3600 * 1000));
    const remainingMinutes = Math.floor((diffMs % (3600 * 1000)) / (60 * 1000));
    
    let timeLabel = `${remainingHours}h`;
    if (remainingHours === 0) {
      timeLabel = `${remainingMinutes}m`;
    } else if (remainingMinutes > 0 && remainingHours < 6) {
      timeLabel = `${remainingHours}h ${remainingMinutes}m`;
    }

    return {
      status: 'SENT_PENDING',
      isSentPending: true,
      isLocked48h: true,
      isExpired48h: false,
      remainingHours,
      remainingMinutes,
      partnerId: partner.id,
      partnerName,
      partner,
      sentAt: new Date(sentTime).toISOString(),
      expiresAt: new Date(expiresTime).toISOString(),
      badgeText: `⚠️ VERSANDT AN ${partnerName.toUpperCase()} (Wartet auf Rückmeldung - Noch ${timeLabel})`,
      badgeColor: '#eab308',
      nextRecommendedPartner: null
    };
  } else {
    // 48h ohne Bestätigung verstrichen -> Schweigen = Freigabe für Zweitverwertung
    const nextPartnerRec = getNextPartnerForReroute(partner.id, lead);
    return {
      status: 'NO_RESPONSE_RELEASED',
      isSentPending: false,
      isLocked48h: false,
      isExpired48h: true,
      remainingHours: 0,
      remainingMinutes: 0,
      partnerId: partner.id,
      partnerName,
      partner,
      sentAt: new Date(sentTime).toISOString(),
      expiresAt: new Date(expiresTime).toISOString(),
      badgeText: `🔄 Keine Rückmeldung nach 48h von ${partnerName} – Freigegeben für Zweitverwertung`,
      badgeColor: '#f97316',
      nextRecommendedPartner: nextPartnerRec.partner
    };
  }
}
