/**
 * NeXus Date & Timing Helpers
 * Berechnet Datumsformate, relative Altersangaben und prüft das 90-Tage Sales Window.
 */

export function formatEventDate(dateInput) {
  if (!dateInput) {
    return {
      formattedDate: 'Unbekannt',
      relativeTime: 'Kein Datum',
      daysAgo: null,
      isExpired: false
    };
  }

  const d = new Date(dateInput);
  if (isNaN(d.getTime())) {
    return {
      formattedDate: 'Ungültiges Datum',
      relativeTime: 'Kein Datum',
      daysAgo: null,
      isExpired: false
    };
  }

  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  const formattedDate = d.toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });

  let relativeTime = '';
  if (diffDays <= 0) {
    relativeTime = 'Heute';
  } else if (diffDays === 1) {
    relativeTime = 'Gestern';
  } else if (diffDays < 7) {
    relativeTime = `vor ${diffDays} Tagen`;
  } else if (diffDays < 30) {
    const weeks = Math.floor(diffDays / 7);
    relativeTime = `vor ${weeks} ${weeks === 1 ? 'Woche' : 'Wochen'}`;
  } else if (diffDays < 365) {
    const months = Math.floor(diffDays / 30);
    relativeTime = `vor ${months} ${months === 1 ? 'Monat' : 'Monaten'}`;
  } else {
    const years = Math.floor(diffDays / 365);
    relativeTime = `vor ${years} ${years === 1 ? 'Jahr' : 'Jahren'}`;
  }

  // Sales Window Regel für Lead-Broker Radar: Älter als 3 Tage (72h) = Veraltet
  const isExpired = diffDays > 3;

  return {
    formattedDate,
    relativeTime,
    daysAgo: diffDays,
    isExpired
  };
}

/**
 * Extrahiert eine lesbare Domain aus einer URL.
 */
export function extractDomain(url) {
  if (!url || typeof url !== 'string' || !url.startsWith('http')) return null;
  try {
    const u = new URL(url);
    return u.hostname.replace(/^www\./, '');
  } catch (e) {
    return url;
  }
}

/**
 * Frische-Ampel für den European Mandate Origination Desk:
 * - Grün (<= 24h): Brandneu / Sofort kontaktieren (Höchste Exklusivität)
 * - Gelb (24–48h): Akut / Voll verwertbar
 * - Rot (> 48h): Veraltet / Hohes Reputationsrisiko (Warnhinweis vor Weitergabe)
 */
export function getFreshnessTrafficLight(dateInput) {
  if (!dateInput) {
    return {
      color: 'red',
      level: 'stale',
      badgeClass: 'freshness-red',
      label: 'Veraltet (>48h)',
      sublabel: 'Hohes Reputationsrisiko / Kalter Kaffee',
      tooltip: 'Kein verifiziertes Datum vorhanden (>48h)',
      hoursAgo: 999,
      isStale: true
    };
  }

  const d = new Date(dateInput);
  if (isNaN(d.getTime())) {
    return {
      color: 'red',
      level: 'stale',
      badgeClass: 'freshness-red',
      label: 'Veraltet (>48h)',
      sublabel: 'Hohes Reputationsrisiko / Kalter Kaffee',
      tooltip: 'Datum nicht valide (>48h)',
      hoursAgo: 999,
      isStale: true
    };
  }

  const now = new Date();
  const diffHours = (now.getTime() - d.getTime()) / (1000 * 60 * 60);

  if (diffHours <= 24) {
    return {
      color: 'green',
      level: 'fresh',
      badgeClass: 'freshness-green',
      label: 'Brandneu (<=24h)',
      sublabel: 'Höchste Exklusivität / Sofort kontaktieren',
      tooltip: `Vor ${Math.max(0, Math.round(diffHours))}h – Brandneu`,
      hoursAgo: Math.max(0, Math.round(diffHours)),
      isStale: false
    };
  } else if (diffHours <= 48) {
    return {
      color: 'yellow',
      level: 'acute',
      badgeClass: 'freshness-yellow',
      label: 'Akut (24–48h)',
      sublabel: 'Voll verwertbar',
      tooltip: `Vor ${Math.round(diffHours)}h – Akut verwertbar`,
      hoursAgo: Math.round(diffHours),
      isStale: false
    };
  } else {
    return {
      color: 'red',
      level: 'stale',
      badgeClass: 'freshness-red',
      label: 'Veraltet (>48h)',
      sublabel: 'Hohes Reputationsrisiko / Kalter Kaffee',
      tooltip: `Vor ${Math.round(diffHours)}h – Kalter Kaffee`,
      hoursAgo: Math.round(diffHours),
      isStale: true
    };
  }
}
