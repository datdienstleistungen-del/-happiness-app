/**
 * NeXus Domain Discovery & Verification Engine
 * 
 * 2-Stufen-Architektur mit gehärteter Verifikation:
 * Schritt 1 (kostenlos): Heuristisches Raten nach TLD-Hierarchie (.de/.com vor .io/.ai) + WAF/Bot-Detection + Content-Audit.
 * Schritt 2 (Absicherung): Mehrstufige Google Custom Search JSON API mit Directory/Review-Filter & Quota-Tracking (100/Tag).
 * Fallback: Ehrlich "nicht auffindbar" / "nicht sicher gefunden" (keine Verzeichnis-URLs, keine erfundenen Daten).
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

// Umfangreicher Filter für Social Media, Presse, HR, Bewertungsportale & Tool-Verzeichnisse
export const SKIP_DOMAINS = /linkedin|facebook|twitter|x\.com|instagram|youtube|glassdoor|indeed|xing|crunchbase|bloomberg|reuters|wallstreet|google|bing|yahoo|tavily|wikipedia|mondaq|handelsblatt|tagesschau|spiegel|zeit\.de|faz\.net|kununu|leadiq|zoominfo|apollo\.io|rocketreach|dnb\.com|owler|signalhire|lusha|northdata|firmenwissen|unternehmensregister|bundesanzeiger|stepstone|gelbeseiten|dasoertliche|ki-syndikat|futuretools|futurepedia|theresanaiforthat|g2\.com|capterra|trustpilot|omr\.com|provenexpert|softwareadvice|getapp|producthunt|alternativeto|saasworthy|sourceforge|trustradius|startupvalley|gruenderszene/i;

// Verzeichnis- & Review-Pfade auf Drittseiten ausschließen
export const DIRECTORY_PATH_PATTERNS = /\/(tools|tool|review|reviews|software|product|products|company|companies|directory|listing|profile|profiles|app|apps)\/[a-z0-9_-]+/i;

const BROWSER_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'de-DE,de;q=0.9,en-US;q=0.8,en;q=0.7',
  'Upgrade-Insecure-Requests': '1'
};

async function fetchWithTimeout(url, options = {}, timeoutMs = 4500) {
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
 * Normalisiert Firmennamen und erzeugt strukturierte Domain-Kandidaten nach TLD-Priorität
 */
export function generateDomainCandidates(companyName) {
  if (!companyName) return { tier1: [], tier2: [], tier3: [] };
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

  // TLD-Hierarchie: Tier 1 (.de, .com, .at, .ch) hat absolute Priorität vor Tier 2 (.eu, .org) und Tier 3 (.io, .ai)
  const tier1Tlds = ['.de', '.com', '.at', '.ch'];
  const tier2Tlds = ['.eu', '.org'];
  const tier3Tlds = ['.io', '.ai', '.app', '.co'];

  const tier1 = [];
  const tier2 = [];
  const tier3 = [];

  for (const base of baseNames) {
    for (const tld of tier1Tlds) tier1.push(`${base}${tld}`);
    for (const tld of tier2Tlds) tier2.push(`${base}${tld}`);
    for (const tld of tier3Tlds) tier3.push(`${base}${tld}`);
  }

  return {
    tier1: [...new Set(tier1)],
    tier2: [...new Set(tier2)],
    tier3: [...new Set(tier3)],
    all: [...new Set([...tier1, ...tier2, ...tier3])]
  };
}

/**
 * Gehärtete Prüfung eines Domain-Kandidaten (inkl. WAF/Cloudflare/Vercel Erkennung & Content-Audit)
 */
async function verifyCandidateHttp(domain, companyName, isTier1 = false) {
  const cleanComp = companyName
    .toLowerCase()
    .replace(/\b(gmbh|ag|se|kg|ug|llc|inc|ltd)\b/g, '')
    .replace(/[^a-z0-9äöüß]/g, '')
    .trim();

  const domainBase = domain.split('.')[0].replace(/[^a-z0-9]/g, '');

  for (const scheme of ['https', 'http']) {
    try {
      const url = `${scheme}://${domain}`;
      const res = await fetchWithTimeout(url, {
        method: 'GET',
        redirect: 'follow',
        headers: BROWSER_HEADERS
      }, 4000);

      const finalUrl = res.url || url;
      let finalHost = domain;
      try {
        finalHost = new URL(finalUrl).hostname.replace(/^www\./, '').toLowerCase();
      } catch {}

      if (SKIP_DOMAINS.test(finalHost)) continue;

      // 1. Fall: Domain ist live und liefert 200 OK
      if (res.ok) {
        const html = await res.text();
        const lowerHtml = html.toLowerCase();
        
        const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
        const titleText = titleMatch ? titleMatch[1].toLowerCase() : '';

        // Domain-Parking & Domain-Händler strikt ausschließen
        const isParked = /domain for sale|buy this domain|domain kaufen|sedo|dan\.com|godaddy|hugedomains|afternic/i.test(titleText) ||
                         /this domain is registered|kaufen sie diese domain/i.test(lowerHtml);
        if (isParked) continue;

        // Directory / Review-Portal Indikatoren
        const isDirectory = /software katalog|tool directory|best ai tools|review platform|vergleichsportal/i.test(titleText);
        if (isDirectory) continue;

        // Strenger Abgleich:
        // Bei Tier 1 (.de/.com) reicht exakte Namensübereinstimmung im Host + relevante Seite
        const isExactHostMatch = finalHost.split('.')[0].replace(/[^a-z0-9]/g, '') === cleanComp;
        const hasKeywordMatch = titleText.includes(cleanComp) || lowerHtml.slice(0, 3000).includes(cleanComp);
        const hasOfficialSignals = /impressum|kontakt|contact|about|über uns|ueber uns|datenschutz|privacy/i.test(lowerHtml);

        if (isExactHostMatch && (hasKeywordMatch || hasOfficialSignals)) {
          return {
            verified: true,
            domain: finalHost,
            finalUrl,
            title: titleMatch ? titleMatch[1].trim() : `${companyName} (Offizielle Website)`
          };
        }

        if (hasKeywordMatch && hasOfficialSignals) {
          return {
            verified: true,
            domain: finalHost,
            finalUrl,
            title: titleMatch ? titleMatch[1].trim() : `${companyName} (Offizielle Website)`
          };
        }
      }

      // 2. Fall: WAF / Bot-Protection (Status 429 / 403) bei exakter Tier 1 Domain (.com / .de)
      // Viele Enterprise- & Tech-Websites (z.B. Personio SE auf personio.com / personio.de) blockieren Node-Fetches mit Vercel/Cloudflare Checkpoint.
      if ((res.status === 429 || res.status === 403) && isTier1) {
        const html = await res.text().catch(() => '');
        const isWaf = /security checkpoint|cloudflare|just a moment|ddos-guard|imperva|akamai|bot protection/i.test(html) ||
                      res.headers.get('server')?.toLowerCase().includes('cloudflare') ||
                      res.headers.get('x-vercel-id');

        const isExactHost = domainBase === cleanComp;
        if (isWaf && isExactHost) {
          console.log(`[DomainDiscovery] 🛡️ WAF/Bot-Schutz erkannt auf geschützter Tier-1 Domain ${domain} (Status ${res.status}). Domain ist live und gehört zur Firma.`);
          return {
            verified: true,
            domain: finalHost,
            finalUrl: `https://${finalHost}`,
            title: `${companyName} (Offizielle Website — WAF-geschützt)`
          };
        }
      }
    } catch (e) {
      // Weiter zum nächsten Scheme oder Kandidaten
    }
  }

  return { verified: false };
}

/**
 * SCHRITT 1: Heuristisches Raten mit TLD-Priorität (Kostenlos)
 */
export async function discoverDomainStep1(companyName) {
  console.log(`[DomainDiscovery] 🚀 Schritt 1 (Raten / Heuristik) für "${companyName}" gestartet...`);
  const candidates = generateDomainCandidates(companyName);

  // Phase 1: Tier 1 prüfen (.de, .com, .at, .ch)
  console.log(`[DomainDiscovery] Prüfe Tier-1 TLDs (.de/.com):`, candidates.tier1.join(', '));
  for (const candidate of candidates.tier1) {
    const check = await verifyCandidateHttp(candidate, companyName, true);
    if (check.verified) {
      console.log(`[DomainDiscovery] ✅ Schritt 1 ERFOLGREICH (Tier 1): "${check.domain}" bestätigt.`);
      return {
        domain: check.domain,
        url: check.finalUrl,
        title: check.title,
        source: 'step1_heuristic_tier1',
        step2Called: false
      };
    }
  }

  // Phase 2: Tier 2 (.eu, .org)
  for (const candidate of candidates.tier2) {
    const check = await verifyCandidateHttp(candidate, companyName, false);
    if (check.verified) {
      console.log(`[DomainDiscovery] ✅ Schritt 1 ERFOLGREICH (Tier 2): "${check.domain}" bestätigt.`);
      return {
        domain: check.domain,
        url: check.finalUrl,
        title: check.title,
        source: 'step1_heuristic_tier2',
        step2Called: false
      };
    }
  }

  // Phase 3: Tier 3 (.io, .ai) nur wenn KEIN Tier 1 / Tier 2 existiert
  for (const candidate of candidates.tier3) {
    const check = await verifyCandidateHttp(candidate, companyName, false);
    if (check.verified) {
      console.log(`[DomainDiscovery] ✅ Schritt 1 ERFOLGREICH (Tier 3): "${check.domain}" bestätigt.`);
      return {
        domain: check.domain,
        url: check.finalUrl,
        title: check.title,
        source: 'step1_heuristic_tier3',
        step2Called: false
      };
    }
  }

  console.log(`[DomainDiscovery] ⚠️ Schritt 1 ohne Treffer für "${companyName}".`);
  return null;
}

/**
 * Filtert Suchergebnisse gegen Verzeichnisse, Bewertungsportale und Aggregator-Pfade
 */
export function filterSearchResult(item) {
  if (!item) return null;
  const itemUrl = item.link || item.formattedUrl;
  if (!itemUrl) return null;

  try {
    const parsed = new URL(itemUrl);
    const host = parsed.hostname.replace(/^www\./, '').toLowerCase();

    // 1. Domain-Filter (Verzeichnisse & Social Media)
    if (SKIP_DOMAINS.test(host)) {
      console.log(`[GoogleCSE] ❌ Überspringe Verzeichnis/Portal-Domain: ${host} (${itemUrl})`);
      return null;
    }

    // 2. Pfad-Filter (z.B. /tools/tendigo, /review/myreach)
    if (DIRECTORY_PATH_PATTERNS.test(parsed.pathname)) {
      console.log(`[GoogleCSE] ❌ Überspringe Aggregator-Pfad: ${parsed.pathname} auf ${host}`);
      return null;
    }

    return {
      domain: host,
      url: itemUrl,
      title: item.title || '',
      snippet: item.snippet || ''
    };
  } catch {
    return null;
  }
}

/**
 * SCHRITT 2: Mehrstufige Google Custom Search JSON API (100 Gratis-Anfragen / Tag)
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

  if (!apiKey || !cx) {
    console.warn(`[GoogleCSE] ⚠️ GOOGLE_SEARCH_API_KEY oder GOOGLE_SEARCH_ENGINE_ID (CX) nicht konfiguriert.`);
    return { error: 'NOT_CONFIGURED', reason: 'Google Custom Search API Key / CX nicht in Umgebung hinterlegt.' };
  }

  // Mehrstufige Suchstrategie für Startups & nischige Firmen
  const queryStages = [
    `"${companyName}" offizielle Website`,
    `"${companyName}" Impressum`,
    `"${companyName}" Software OR Tool OR Kontakt`
  ];

  for (let stageIdx = 0; stageIdx < queryStages.length; stageIdx++) {
    const currentQuota = getGoogleCseQuotaStatus();
    if (currentQuota.usedToday >= currentQuota.limit) {
      console.warn(`[GoogleCSE] ⚠️ Kontingent während mehrstufiger Suche erreicht.`);
      break;
    }

    const searchQuery = queryStages[stageIdx];
    recordGoogleCseUsage();
    console.log(`[GoogleCSE] 🔍 Stufe ${stageIdx + 1}/${queryStages.length}: "${searchQuery}" (Verbrauch: ${quotaState.usedToday}/${GOOGLE_CSE_DAILY_LIMIT})`);

    const searchUrl = `https://www.googleapis.com/customsearch/v1?key=${encodeURIComponent(apiKey)}&cx=${encodeURIComponent(cx)}&q=${encodeURIComponent(searchQuery)}&num=5`;

    try {
      const res = await fetchWithTimeout(searchUrl, { headers: { 'Accept': 'application/json' } }, 7000);
      if (!res.ok) {
        const errBody = await res.text().catch(() => '');
        console.error(`[GoogleCSE] API Error (${res.status}): ${errBody}`);
        continue;
      }

      const data = await res.json();
      if (!data.items || data.items.length === 0) {
        console.log(`[GoogleCSE] Keine Treffer für Stufe ${stageIdx + 1} ("${searchQuery}")`);
        continue;
      }

      // Treffer filtern
      for (const item of data.items) {
        const valid = filterSearchResult(item);
        if (valid) {
          console.log(`[GoogleCSE] ✅ Echte Firmen-Domain gefunden: ${valid.domain} (Titel: "${valid.title}", Link: ${valid.url})`);
          return {
            domain: valid.domain,
            url: valid.url,
            title: valid.title,
            snippet: valid.snippet,
            query: searchQuery,
            source: 'step2_google_cse',
            stage: stageIdx + 1,
            step2Called: true,
            rawItem: item
          };
        }
      }

      console.log(`[GoogleCSE] Stufe ${stageIdx + 1} lieferte nur Aggregatoren/Verzeichnisse. Starte nächste Suchstufe...`);
    } catch (err) {
      console.error(`[GoogleCSE] Fehler in Suchstufe ${stageIdx + 1}:`, err.message);
    }
  }

  console.log(`[GoogleCSE] ❌ Alle Suchstufen für "${companyName}" ergaben keine verifizierte Firmen-Domain.`);
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

  // 1. Schritt 1 (Kostenlos via Raten / TLD-Hierarchie)
  const step1Result = await discoverDomainStep1(input);
  if (step1Result && step1Result.domain) {
    return {
      domain: step1Result.domain,
      url: step1Result.url,
      title: step1Result.title,
      status: 'VERIFIED',
      source: step1Result.source,
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
      stage: step2Result.stage,
      step2Called: true,
      quota: getGoogleCseQuotaStatus()
    };
  }

  // 3. Ehrlicher Fallback: Nicht auffindbar
  console.log(`[DomainDiscovery] ❌ Weder Schritt 1 noch Schritt 2 konnten eine offizielle Website für "${input}" finden. Status: nicht sicher gefunden.`);
  return {
    domain: null,
    status: 'NOT_FOUND',
    reason: step2Result?.error === 'NOT_CONFIGURED' ? 'Google Search API nicht konfiguriert' : 'nicht sicher gefunden (nur Verzeichnisse oder keine Website auffindbar)',
    step2Called: true,
    quota: getGoogleCseQuotaStatus()
  };
}
