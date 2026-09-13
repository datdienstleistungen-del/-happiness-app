/**
 * NeXus Domain Discovery & Verification Engine
 * 
 * 2-Stufen-Architektur:
 * Schritt 1 (kostenlos): Heuristisches Raten plausibler Domain-Kandidaten + HTTP-Verifikation (HEAD/GET).
 * Schritt 2 (Absicherung): Echte Google Custom Search JSON API (100 Gratis-Anfragen/Tag mit Quota-Tracking).
 * Fallback: Ehrlich "nicht auffindbar" (keine erfundenen Daten, kein Tavily).
 */

const GOOGLE_CSE_DAILY_LIMIT = 100;

// In-Memory Quota-Tracker mit automatischem Tageswechsel
let quotaState = {
  date: new Date().toISOString().slice(0, 10),
  usedToday: 0
};

export function getGoogleCseQuotaStatus() {
  const today = new Date().toISOString().slice(0, 10);
  if (quotaState.date !== today) {
    quotaState.date = today;
    quotaState.usedToday = 0;
  }
  return {
    date: quotaState.date,
    usedToday: quotaState.usedToday,
    limit: GOOGLE_CSE_DAILY_LIMIT,
    remaining: Math.max(0, GOOGLE_CSE_DAILY_LIMIT - quotaState.usedToday)
  };
}

export function recordGoogleCseUsage() {
  const status = getGoogleCseQuotaStatus();
  quotaState.usedToday += 1;
  const remaining = Math.max(0, GOOGLE_CSE_DAILY_LIMIT - quotaState.usedToday);
  console.log(`[GoogleCSE] 📊 Kontingent-Status: ${quotaState.usedToday}/${GOOGLE_CSE_DAILY_LIMIT} Anfragen verbraucht am ${quotaState.date} (Noch ${remaining} Gratis-Anfragen verbleibend).`);
  return quotaState.usedToday;
}

export const SKIP_DOMAINS = /linkedin|facebook|twitter|x\.com|instagram|youtube|glassdoor|indeed|xing|crunchbase|bloomberg|reuters|wallstreet|google|bing|yahoo|tavily|wikipedia|mondaq|handelsblatt|tagesschau|spiegel|zeit\.de|faz\.net|kununu|leadiq|zoominfo|apollo\.io|rocketreach|dnb\.com|owler|signalhire|lusha|northdata|firmenwissen|unternehmensregister|bundesanzeiger|stepstone|gelbeseiten|dasoertliche/i;

const BROWSER_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'de-DE,de;q=0.9,en-US;q=0.8,en;q=0.7'
};

async function fetchWithTimeout(url, options = {}, timeoutMs = 4000) {
  const controller = new AbortController();
  const abortId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(abortId);
    return res;
  } catch (e) {
    clearTimeout(abortId);
    throw e;
  }
}

/**
 * Normalisiert Firmennamen und erzeugt 2-6 hochplausible Domain-Kandidaten
 */
export function generateDomainCandidates(companyName) {
  if (!companyName) return [];
  const clean = companyName.toLowerCase().trim();

  // Strip Rechtsformen und Zusätze
  const stripped = clean
    .replace(/\b(gmbh & co\.?\s*kg|gmbh & co\.?\s*kgaa|gmbh|ag|se|kg|ug|ohg|gbr|partg|llc|inc|corp|ltd|sas|sarl|bv|ab|oy|as|holding|gruppe|group)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();

  const umlautMap = { 'ä': 'ae', 'ö': 'oe', 'ü': 'ue', 'ß': 'ss' };
  let noUmlauts = stripped;
  for (const [u, r] of Object.entries(umlautMap)) {
    noUmlauts = noUmlauts.replace(new RegExp(u, 'g'), r);
  }

  const alphaOnly = noUmlauts.replace(/[^a-z0-9]/g, '');
  const hyphenated = noUmlauts.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

  const baseNames = new Set([alphaOnly, hyphenated].filter(n => n && n.length >= 2));
  
  // Auch die ersten 2 Wörter probieren wenn Name sehr lang ist
  const words = noUmlauts.split(/\s+/).filter(w => w.length >= 2);
  if (words.length >= 2) {
    baseNames.add(words.slice(0, 2).join('-'));
    baseNames.add(words.slice(0, 2).join(''));
  }

  const tlds = ['.de', '.com', '.io', '.ai', '.eu'];
  const candidates = [];

  for (const base of baseNames) {
    for (const tld of tlds) {
      candidates.push(`${base}${tld}`);
    }
  }

  return [...new Set(candidates)].slice(0, 8);
}

/**
 * Prüft ob eine HTTP-Antwort plausibel die Firmenwebsite darstellt
 */
async function verifyCandidateHttp(domain, companyName) {
  const companyKeywords = companyName
    .toLowerCase()
    .replace(/\b(gmbh|ag|se|kg|ug|llc|inc|ltd)\b/g, '')
    .replace(/[^a-z0-9äöüß]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length >= 3);

  for (const scheme of ['https', 'http']) {
    try {
      const url = `${scheme}://${domain}`;
      const res = await fetchWithTimeout(url, {
        method: 'GET',
        redirect: 'follow',
        headers: BROWSER_HEADERS
      }, 4000);

      if (res.ok) {
        const finalUrl = res.url;
        let finalHost = domain;
        try {
          finalHost = new URL(finalUrl).hostname.replace(/^www\./, '').toLowerCase();
        } catch {}

        if (SKIP_DOMAINS.test(finalHost)) continue;

        const html = await res.text();
        const lowerHtml = html.toLowerCase();
        
        // Titel und Text prüfen
        const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
        const titleText = titleMatch ? titleMatch[1].toLowerCase() : '';

        // Mindestens ein Kern-Keyword muss im Titel oder Content vorkommen
        const hasKeywordMatch = companyKeywords.some(kw => titleText.includes(kw) || lowerHtml.includes(kw));

        // Offizielle Signale prüfen (Impressum, Kontakt, About)
        const hasOfficialSignals = /impressum|kontakt|contact|about|über uns|ueber uns|datenschutz/i.test(lowerHtml);

        // Parked Domain / Domain Seller ausschließen
        const isParked = /domain for sale|buy this domain|domain kaufen|sedo|dan\.com|godaddy/i.test(titleText);

        if (!isParked && (hasKeywordMatch || hasOfficialSignals)) {
          return {
            verified: true,
            domain: finalHost,
            finalUrl,
            title: titleMatch ? titleMatch[1].trim() : ''
          };
        }
      }
    } catch (e) {
      // Nächster Scheme oder nächster Kandidat
    }
  }

  return { verified: false };
}

/**
 * SCHRITT 1: Heuristisches Raten + HTTP-Check (Kostenlos)
 */
export async function discoverDomainStep1(companyName) {
  console.log(`[DomainDiscovery] 🚀 Schritt 1 (Raten / Heuristik) für "${companyName}" gestartet...`);
  const candidates = generateDomainCandidates(companyName);
  console.log(`[DomainDiscovery] Schritt 1 prüft Kandidaten:`, candidates.slice(0, 4).join(', '));

  for (const candidate of candidates) {
    const check = await verifyCandidateHttp(candidate, companyName);
    if (check.verified) {
      console.log(`[DomainDiscovery] ✅ Schritt 1 ERFOLGREICH: "${check.domain}" bestätigt (Titel: "${check.title.slice(0, 60)}")`);
      return {
        domain: check.domain,
        url: check.finalUrl,
        title: check.title,
        source: 'step1_heuristic',
        step2Called: false
      };
    }
  }

  console.log(`[DomainDiscovery] ⚠️ Schritt 1 ohne Treffer für "${companyName}".`);
  return null;
}

/**
 * SCHRITT 2: Google Custom Search JSON API (100 Gratis-Anfragen / Tag)
 */
export async function discoverDomainStep2(companyName) {
  const quota = getGoogleCseQuotaStatus();
  console.log(`[DomainDiscovery] 🛰️ Schritt 2 (Google Custom Search JSON API) für "${companyName}" initiiert.`);

  if (quota.usedToday >= quota.limit) {
    console.warn(`[GoogleCSE] ⚠️ Tageskontingent (${quota.limit}/Tag) für heute (${quota.date}) bereits erreicht.`);
    return null;
  }

  const apiKey = process.env.GOOGLE_SEARCH_API_KEY || 
                 process.env.GOOGLE_CSE_KEY || 
                 process.env.GOOGLE_API_KEY || 
                 process.env.GOOGLE_CUSTOM_SEARCH_KEY;

  const cx = process.env.GOOGLE_SEARCH_ENGINE_ID || 
             process.env.GOOGLE_SEARCH_CX || 
             process.env.GOOGLE_CSE_ID || 
             process.env.GOOGLE_CUSTOM_SEARCH_CX;

  const searchQuery = `"${companyName}" offizielle Website`;

  if (!apiKey || !cx) {
    console.warn(`[GoogleCSE] ⚠️ GOOGLE_SEARCH_API_KEY oder GOOGLE_SEARCH_ENGINE_ID (CX) nicht in Umgebung konfiguriert.`);
    return null;
  }

  // Quota zählen
  recordGoogleCseUsage();
  console.log(`[GoogleCSE] 🔍 Google API Request: query="${searchQuery}" (CX: ${cx.slice(0, 6)}...)`);

  const searchUrl = `https://www.googleapis.com/customsearch/v1?key=${encodeURIComponent(apiKey)}&cx=${encodeURIComponent(cx)}&q=${encodeURIComponent(searchQuery)}&num=5`;

  try {
    const res = await fetchWithTimeout(searchUrl, { headers: { 'Accept': 'application/json' } }, 7000);
    if (!res.ok) {
      const errBody = await res.text().catch(() => '');
      console.error(`[GoogleCSE] API Error (${res.status}): ${errBody}`);
      return null;
    }

    const data = await res.json();
    if (!data.items || data.items.length === 0) {
      console.log(`[GoogleCSE] Keine Suchergebnisse für "${searchQuery}"`);
      return null;
    }

    for (const item of data.items) {
      try {
        const itemUrl = item.link || item.formattedUrl;
        if (!itemUrl) continue;
        const host = new URL(itemUrl).hostname.replace(/^www\./, '').toLowerCase();

        if (SKIP_DOMAINS.test(host)) {
          console.log(`[GoogleCSE] Überspringe Verzeichnis/Social-Treffer: ${host}`);
          continue;
        }

        console.log(`[GoogleCSE] ✅ Schritt 2 Treffer: ${host} (Titel: "${item.title}", Link: ${itemUrl})`);
        return {
          domain: host,
          url: itemUrl,
          title: item.title,
          snippet: item.snippet,
          query: searchQuery,
          source: 'step2_google_cse',
          step2Called: true,
          rawItem: item
        };
      } catch (err) {
        continue;
      }
    }
  } catch (err) {
    console.error(`[GoogleCSE] Fehler bei Ausführung:`, err.message);
  }

  return null;
}

/**
 * HAUPTFUNKTION: Gesamte 2-Stufen-Pipeline mit ehrlichem Fallback
 */
export async function resolveCompanyWebsite(companyOrDomain) {
  if (!companyOrDomain) return { domain: null, status: 'NOT_FOUND', reason: 'Kein Name übergeben', step2Called: false };
  const input = companyOrDomain.trim();

  // Ist es bereits eine gültige Domain?
  if (/^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}(\/.*)?$/.test(input) || input.startsWith('http://') || input.startsWith('https://')) {
    try {
      const cleanHost = input.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0].toLowerCase();
      return {
        domain: cleanHost,
        url: `https://${cleanHost}`,
        title: input,
        status: 'DIRECT_INPUT',
        source: 'direct_input',
        step2Called: false,
        quota: getGoogleCseQuotaStatus()
      };
    } catch {}
  }

  // 1. Schritt 1 (Kostenlos via Raten / Heuristik)
  const step1Result = await discoverDomainStep1(input);
  if (step1Result && step1Result.domain) {
    return {
      domain: step1Result.domain,
      url: step1Result.url,
      title: step1Result.title,
      status: 'VERIFIED',
      source: 'step1_heuristic',
      step2Called: false,
      quota: getGoogleCseQuotaStatus()
    };
  }

  // 2. Schritt 2 (Google Custom Search JSON API Fallback)
  const step2Result = await discoverDomainStep2(input);
  if (step2Result && step2Result.domain) {
    return {
      domain: step2Result.domain,
      url: step2Result.url,
      title: step2Result.title,
      query: step2Result.query,
      rawItem: step2Result.rawItem,
      status: 'VERIFIED',
      source: 'step2_google_cse',
      step2Called: true,
      quota: getGoogleCseQuotaStatus()
    };
  }

  // 3. Ehrlicher Fallback: Nicht auffindbar
  console.log(`[DomainDiscovery] ❌ Weder Schritt 1 noch Schritt 2 konnten eine offizielle Website für "${input}" finden. Status: nicht auffindbar.`);
  return {
    domain: null,
    status: 'NOT_FOUND',
    reason: 'Website nicht auffindbar',
    step2Called: true,
    quota: getGoogleCseQuotaStatus()
  };
}
