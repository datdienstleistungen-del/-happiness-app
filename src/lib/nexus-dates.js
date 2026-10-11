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

  // Sales Window Regel: Älter als 90 Tage = Veraltet
  const isExpired = diffDays > 90;

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
