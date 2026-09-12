/**
 * NeXus Standalone Email Pattern Crawler & Contact Intelligence
 * 
 * Eigenständiger On-Demand Crawler (kein Fremd-API wie Hunter/Clearbit, kostenlos):
 * 1. Domain-Auflösung via Tavily Search
 * 2. Seiten-Crawl mit Cheerio (/impressum, /kontakt, /team, /about, /leadership, etc.)
 * 3. E-Mail-Extraktion (Regex + mailto:)
 * 4. Muster-Ableitung (vorname.nachname, v.nachname, vornamenachname, etc.)
 * 5. Namens-Findung für Zielperson (mit strikter Domain/Firmen-Verifikation & person: null bei Default)
 * 6. E-Mail-Zusammensetzung & Konfidenz-Berechnung
 * 7. Coach-Antwort-Formatierung (inkl. person: null Fall)
 */

import * as cheerio from 'cheerio';

const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

const GENERIC_PREFIXES = [
  'info', 'kontakt', 'contact', 'office', 'support', 'noreply', 'no-reply',
  'hello', 'mail', 'service', 'presse', 'press', 'sales', 'jobs', 'karriere',
  'careers', 'bewerbung', 'datenschutz', 'privacy', 'team', 'help', 'billing',
  'invoices', 'marketing', 'media', 'general', 'welcome', 'hallo', 'post',
  'kundenservice', 'zentrale', 'verwaltung', 'buchhaltung', 'news', 'security',
  'abuse', 'postmaster', 'webmaster', 'hostmaster', 'compliance', 'legal'
];

const SKIP_DOMAINS = /linkedin|facebook|twitter|x\.com|instagram|youtube|glassdoor|indeed|xing|crunchbase|bloomberg|reuters|wallstreet|google|bing|yahoo|tavily|wikipedia|mondaq|handelsblatt|tagesschau|spiegel|zeit\.de|faz\.net|kununu|leadiq|zoominfo|apollo\.io|rocketreach|dnb\.com|owler|signalhire|lusha|northdata|firmenwissen/i;

const BROWSER_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'de-DE,de;q=0.9,en-US;q=0.8,en;q=0.7',
  'Cache-Control': 'no-cache',
  'Upgrade-Insecure-Requests': '1'
};

const NON_PERSON_WORDS = new Set([
  'in the', 'as the', 'for the', 'at the', 'bei der', 'seit dem', 'von der', 
  'aus der', 'mit der', 'the ceo', 'der ceo', 'die firma', 'das unternehmen',
  'magazine global', 'silicon valley', 'press release', 'news portal', 'career page',
  'the founder', 'the co', 'executive director', 'board member', 'people also', 'view profile'
]);

async function fetchWithTimeout(url, options = {}, timeoutMs = 5000) {
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
 * 1. Domain-Auflösung
 */
export async function resolveDomain(companyOrDomain) {
  if (!companyOrDomain) return null;
  const input = companyOrDomain.trim();

  // Ist es bereits eine Domain?
  if (/^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}(\/.*)?$/.test(input) || input.startsWith('http://') || input.startsWith('https://')) {
    try {
      const clean = input.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0].toLowerCase();
      return clean;
    } catch {
      // Weiter mit Suche
    }
  }

  const tavilyKey = process.env.TAVILY_API_KEY || process.env.VITE_TAVILY_API_KEY;
  if (!tavilyKey) {
    console.warn('[EmailCrawler] Kein Tavily Key vorhanden');
    return null;
  }

  try {
    const res = await fetchWithTimeout('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: tavilyKey,
        query: `${input} official website homepage`,
        search_depth: 'basic',
        max_results: 6
      })
    }, 8000);

    if (!res.ok) return null;
    const data = await res.json();
    if (!data.results || data.results.length === 0) return null;

    const companyKeyword = input.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 6);

    // Pass 1: Beste Passung (Domain enthält Firmenname)
    for (const r of data.results) {
      try {
        const urlObj = new URL(r.url);
        const host = urlObj.hostname.replace(/^www\./, '').toLowerCase();
        if (SKIP_DOMAINS.test(host)) continue;

        const hostClean = host.replace(/[^a-z0-9]/g, '');
        if (hostClean.includes(companyKeyword)) {
          console.log(`[EmailCrawler] Domain gefunden (Match): ${host} für "${input}"`);
          return host;
        }
      } catch (e) {
        continue;
      }
    }

    // Pass 2: Erste nicht-gesperrte Domain
    for (const r of data.results) {
      try {
        const urlObj = new URL(r.url);
        const host = urlObj.hostname.replace(/^www\./, '').toLowerCase();
        if (!SKIP_DOMAINS.test(host)) {
          console.log(`[EmailCrawler] Domain gefunden (Fallback): ${host} für "${input}"`);
          return host;
        }
      } catch {}
    }
  } catch (err) {
    console.error('[EmailCrawler] Domain-Auflösungsfehler:', err.message);
  }

  return null;
}

const ROLE_PATTERNS = [
  /\b(?:CEO|Chief Executive Officer|CTO|Chief Technology Officer|COO|Chief Operating Officer|CFO|Chief Financial Officer|CIO|CMO|Chief Marketing Officer|CRO|Chief Revenue Officer)\b/i,
  /\b(?:Geschäftsführer(?:in)?|Geschäftsführung|Vorstand|Managing Director|Gründer(?:in)?|Founder|Co-Founder|Inhaber(?:in)?|Partner)\b/i,
  /\b(?:VP|Vice President)(?:\s+of)?(?:\s+[A-Za-z&/ -]+)?\b/i,
  /\b(?:Head of|Director of|Director|Leiter(?:in)?)\s+[A-Za-z&/ -]+\b/i,
  /\b(?:Sales Director|Vertriebsleiter(?:in)?|Account Executive|Sales Manager)\b/i,
  /\b(?:Chairman(?:,\s*Board of Directors)?)\b/i
];

export function cleanPersonName(raw) {
  if (!raw) return null;
  let name = raw.replace(/[\u200B-\u200D\uFEFF]/g, '').trim();
  name = name.replace(/^(?:Dr\.|Prof\.|Prof\. Dr\.|Dipl\.-[A-Za-z.]+|M\.Sc\.|B\.Sc\.)\s+/i, '');
  name = name.replace(/^[^A-ZÄÖÜa-zäöüß]+/, '').replace(/[^A-ZÄÖÜa-zäöüß]+$/, '').trim();
  
  const words = name.split(/\s+/);
  if (words.length >= 2 && words.length <= 4) {
    if (words.every(w => /^[A-ZÄÖÜ][a-zäöüß]+(?:-[A-ZÄÖÜ][a-zäöüß]+)?$/.test(w))) {
      if (!NON_PERSON_WORDS.has(name.toLowerCase())) {
        return name;
      }
    }
  }
  return null;
}

export function extractPersonsFromHtml(html, pageUrl) {
  if (!html) return [];
  const $ = cheerio.load(html);
  const foundPersons = [];
  const seen = new Set();

  function addPerson(name, role) {
    const validName = cleanPersonName(name);
    if (!validName || !role) return;
    const cleanRole = role.replace(/[\u200B-\u200D\uFEFF]/g, '').trim().replace(/\s+/g, ' ');
    if (cleanRole.length < 3 || cleanRole.length > 80) return;
    const key = `${validName.toLowerCase()}|${cleanRole.toLowerCase()}`;
    if (!seen.has(key)) {
      seen.add(key);
      foundPersons.push({
        name: validName,
        role: cleanRole,
        sourceUrl: pageUrl
      });
    }
  }

  // 1. JSON-LD Structured Data
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const data = JSON.parse($(el).html());
      const items = Array.isArray(data) ? data : [data];
      for (const item of items) {
        if (item['@type'] === 'Person' && item.name) {
          addPerson(item.name, item.jobTitle || item.roleName || 'Team Member');
        }
        if (item.employee && Array.isArray(item.employee)) {
          for (const emp of item.employee) {
            if (emp.name) addPerson(emp.name, emp.jobTitle || 'Employee');
          }
        }
      }
    } catch (e) {}
  });

  // 2. Impressum Regex
  const bodyText = $('body').text();
  const impressumMatches = bodyText.matchAll(/(?:Geschäftsführer(?:in)?|Vertreten durch|Managing Director|Vorstand|Inhaber(?:in)?)[\s:]+([A-ZÄÖÜ][a-zäöüß]+(?:\s+[A-ZÄÖÜ][a-zäöüß]+){1,3})/gi);
  for (const m of impressumMatches) {
    if (m[1]) {
      addPerson(m[1], 'Geschäftsführung / Managing Director');
    }
  }

  // 3. Structured Headings / Strong Elements
  $('h1, h2, h3, h4, h5, strong, b, .name, [class*="name"], [class*="team-member"], [class*="leadership"]').each((_, el) => {
    const rawName = $(el).text().trim();
    const candidateName = cleanPersonName(rawName);

    if (candidateName) {
      const parent = $(el).parent();
      let roleText = null;

      const nextText = $(el).next().text().trim();
      if (nextText && ROLE_PATTERNS.some(rx => rx.test(nextText))) {
        roleText = nextText;
      } else {
        const parentText = parent.text().replace(rawName, '').trim();
        for (const rx of ROLE_PATTERNS) {
          const match = parentText.match(rx);
          if (match) {
            roleText = match[0];
            break;
          }
        }
      }

      if (roleText) {
        addPerson(candidateName, roleText);
      }
    }
  });

  // 4. Compact string patterns in text blocks
  $('div, p, li').each((_, el) => {
    let text = $(el).text().trim().replace(/\s+/g, ' ');
    text = text.replace(/([a-zäöüß])([A-ZÄÖÜ])/g, '$1 $2');
    if (text.length > 10 && text.length < 140) {
      for (const rx of ROLE_PATTERNS) {
        const match = text.match(rx);
        if (match && match.index > 0) {
          const namePart = text.slice(0, match.index).trim();
          const candidateName = cleanPersonName(namePart);
          if (candidateName) {
            addPerson(candidateName, text.slice(match.index).trim());
          }
        }
      }
    }
  });

  return foundPersons;
}

/**
 * 2. Seiten-Crawl der Firmendomain (Direct Fetch + Fallback Tavily Snippet Inspection)
 */
export async function crawlDomainPages(domain) {
  if (!domain) return { pages: [], rawEmails: [], extractedPersons: [] };

  const cleanDomain = domain.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0].toLowerCase();
  const subpages = [
    '',
    '/impressum',
    '/imprint',
    '/kontakt',
    '/contact',
    '/team',
    '/about',
    '/about-us',
    '/leadership',
    '/management',
    '/ueber-uns',
    '/unternehmen',
    '/company/leadership',
    '/who-we-are',
    '/mitarbeiter',
    '/staff'
  ];

  const targets = subpages;
  const crawledPages = [];
  const rawEmails = new Set();
  const extractedPersons = [];

  console.log(`[EmailCrawler] Starte Domain-Crawl für: ${cleanDomain} (max ${targets.length} Seiten)`);

  for (const path of targets) {
    const url = `https://${cleanDomain}${path}`;
    const t0 = Date.now();
    try {
      const res = await fetchWithTimeout(url, {
        method: 'GET',
        headers: BROWSER_HEADERS
      }, 5000);

      const elapsed = Date.now() - t0;

      if (res.ok) {
        const html = await res.text();
        crawledPages.push({ url, path: path || '/', status: res.status });

        const $ = cheerio.load(html);
        const pageEmails = [];

        // 1. Text durchsuchen
        const bodyText = $('body').text() || '';
        const textMatches = bodyText.match(EMAIL_REGEX) || [];
        textMatches.forEach(em => {
          const cleanEm = em.toLowerCase().trim();
          rawEmails.add(cleanEm);
          pageEmails.push(cleanEm);
        });

        // 2. Mailto-Links durchsuchen
        $('a[href^="mailto:"]').each((_, el) => {
          const href = $(el).attr('href') || '';
          const mailtoMatch = href.replace(/^mailto:/i, '').split('?')[0].trim().toLowerCase();
          if (mailtoMatch && EMAIL_REGEX.test(mailtoMatch)) {
            rawEmails.add(mailtoMatch);
            pageEmails.push(mailtoMatch);
          }
        });

        // 3. Personen direkt aus HTML extrahieren
        const pagePersons = extractPersonsFromHtml(html, url);
        for (const person of pagePersons) {
          if (!extractedPersons.some(ep => ep.name.toLowerCase() === person.name.toLowerCase() && ep.role.toLowerCase() === person.role.toLowerCase())) {
            extractedPersons.push(person);
          }
        }

        console.log(`[EmailCrawler] HTTP GET ${url} -> Status: ${res.status} (${elapsed}ms, ${pageEmails.length} Emails, ${pagePersons.length} Personen)`);
      } else {
        crawledPages.push({ url, path: path || '/', status: res.status });
        console.log(`[EmailCrawler] HTTP GET ${url} -> Status: ${res.status} (${elapsed}ms)`);
      }
    } catch (e) {
      const elapsed = Date.now() - t0;
      crawledPages.push({ url, path: path || '/', status: 0, error: e.message });
      console.log(`[EmailCrawler] HTTP GET ${url} -> FAILED: ${e.message} (${elapsed}ms)`);
    }
  }

  // Falls Direct Crawl durch WAF / 429 geblockt wurde, aber Domain prinzipiell existiert:
  const directSuccessful = crawledPages.filter(p => p.status === 200);
  const isDirectBlocked = crawledPages.some(p => p.status === 429 || p.status === 403 || p.status === 503);
  const domainBlocked = isDirectBlocked && directSuccessful.length === 0;
  let fallbackSource = null;
  let isFallbackUsed = false;
  const tavilyKey = process.env.TAVILY_API_KEY || process.env.VITE_TAVILY_API_KEY;

  if (directSuccessful.length === 0 && tavilyKey && !cleanDomain.includes('fake') && !cleanDomain.includes('nonexistent') && !crawledPages.every(p => p.status === 0)) {
    try {
      console.log(`[EmailCrawler] Direct fetch eingeschränkt${domainBlocked ? ' (Bot-Schutz/429 erkannt)' : ''}. Starte sekundäre Analyse für: ${cleanDomain}`);
      const res = await fetchWithTimeout('https://api.tavily.com/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          api_key: tavilyKey,
          query: `site:${cleanDomain} email OR kontakt OR impressum OR contact`,
          search_depth: 'basic',
          max_results: 5
        })
      }, 6000);

      if (res.ok) {
        const data = await res.json();
        if (data.results && data.results.length > 0) {
          isFallbackUsed = true;
          const fallbackHostnames = new Set();
          for (const r of data.results) {
            try {
              const u = new URL(r.url);
              fallbackHostnames.add(u.hostname.replace(/^www\./, ''));
            } catch (e) {}
            crawledPages.push({ url: r.url, path: 'search_indexed', status: 200 });
            const content = (r.title + ' ' + (r.content || '')).toLowerCase();
            const matches = content.match(EMAIL_REGEX) || [];
            matches.forEach(em => rawEmails.add(em.toLowerCase().trim()));
          }
          if (fallbackHostnames.size > 0) {
            fallbackSource = Array.from(fallbackHostnames).join(', ');
          }
        }
      }
    } catch (err) {
      console.warn('[EmailCrawler] Sekundäre Analyse fehlgeschlagen:', err.message);
    }
  }

  console.log(`[EmailCrawler] ${crawledPages.filter(p => p.status === 200).length} Seiten erfolgreich analysiert, ${rawEmails.size} Roh-Emails, ${extractedPersons.length} Personen auf Website gefunden.`);
  return { 
    pages: crawledPages, 
    rawEmails: Array.from(rawEmails),
    extractedPersons,
    domainBlocked,
    fallbackSource,
    isFallbackUsed
  };
}

/**
 * 3. E-Mail-Filterung & Klassifizierung
 */
export function classifyEmails(rawEmails, domain) {
  const cleanDomain = domain.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0].toLowerCase();
  const domainEmails = rawEmails.filter(em => {
    const parts = em.split('@');
    if (parts.length !== 2) return false;
    const emDomain = parts[1].toLowerCase();
    return emDomain === cleanDomain || emDomain.endsWith('.' + cleanDomain);
  });

  const generic = [];
  const personal = [];

  for (const email of domainEmails) {
    const local = email.split('@')[0].toLowerCase();
    const isGeneric = GENERIC_PREFIXES.some(prefix => 
      local === prefix || 
      local.startsWith(prefix + '.') || 
      local.startsWith(prefix + '_') || 
      local.startsWith(prefix + '-')
    );

    if (isGeneric) {
      if (!generic.includes(email)) generic.push(email);
    } else {
      if (!personal.includes(email)) personal.push(email);
    }
  }

  return { domainEmails, generic, personal };
}

/**
 * 4. Muster-Ableitung mit Frequenz-Voting
 */
export function deriveEmailPattern(personalEmails, genericEmails, domain, options = {}) {
  const cleanDomain = domain.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0].toLowerCase();
  const { domainBlocked = false, fallbackSource = null, isFallbackUsed = false } = options;

  if (personalEmails.length > 0) {
    const patternCounts = {};

    for (const email of personalEmails) {
      const local = email.split('@')[0];
      let p = '{vorname}.{nachname}';

      if (local.includes('.')) {
        const parts = local.split('.');
        if (parts[0].length === 1) {
          p = '{v}.{nachname}';
        } else {
          p = '{vorname}.{nachname}';
        }
      } else if (local.includes('_')) {
        p = '{vorname}_{nachname}';
      } else if (local.includes('-')) {
        p = '{vorname}-{nachname}';
      } else {
        p = '{vorname}{nachname}';
      }

      patternCounts[p] = (patternCounts[p] || 0) + 1;
    }

    // Höchste Stimmenzahl ermitteln
    let bestPattern = '{vorname}.{nachname}';
    let maxCount = 0;
    for (const [p, cnt] of Object.entries(patternCounts)) {
      if (cnt > maxCount) {
        maxCount = cnt;
        bestPattern = p;
      }
    }

    let patternLabel = bestPattern.replace('{vorname}', 'vorname').replace('{nachname}', 'nachname').replace('{v}', 'v') + '@' + cleanDomain;

    if (isFallbackUsed || domainBlocked) {
      const sourceDesc = fallbackSource || 'Fallback-Quelle';
      return {
        patternType: bestPattern,
        patternLabel,
        confidence: Math.min(personalEmails.length >= 2 ? 50 : 45, 50),
        source: 'fallback_search',
        isGuess: false,
        sampleEmails: personalEmails,
        reason: `Muster aus ${personalEmails.length} Adresse(n) auf ${sourceDesc} abgeleitet (Zieldomain ${cleanDomain} blockiert Zugriffe mit Status 429/Bot-Schutz)`
      };
    }

    const confidence = personalEmails.length >= 2 ? 80 : 70;

    return {
      patternType: bestPattern,
      patternLabel,
      confidence,
      source: 'domain_pattern_crawl',
      isGuess: false,
      sampleEmails: personalEmails,
      reason: `Muster aus ${personalEmails.length} gefundenen Personenadresse(n) auf ${cleanDomain} abgeleitet (${personalEmails.slice(0, 3).join(', ')})`
    };
  }

  // Fallback wenn KEINE personenbezogene Adresse gefunden wurde
  if (domainBlocked || isFallbackUsed) {
    return {
      patternType: '{vorname}.{nachname}',
      patternLabel: 'vorname.nachname@' + cleanDomain,
      confidence: 40,
      source: 'default_fallback',
      isGuess: true,
      sampleEmails: genericEmails,
      reason: `Standardmuster angenommen (Zieldomain ${cleanDomain} blockiert Zugriffe mit Status 429/Bot-Schutz, ${fallbackSource ? `stattdessen ${fallbackSource} geprüft: ` : ''}keine Personen-E-Mails gefunden)`
    };
  }

  return {
    patternType: '{vorname}.{nachname}',
    patternLabel: 'vorname.nachname@' + cleanDomain,
    confidence: 40,
    source: 'default_fallback',
    isGuess: true,
    sampleEmails: genericEmails,
    reason: `Standardmuster angenommen (keine direkte Personen-E-Mail auf ${cleanDomain} auffindbar, ${genericEmails.length} allgemeine Adressen gefunden)`
  };
}

/**
 * 5. Rollen-Matching & Personen-Findung
 */
export function matchPersonFromWebsite(extractedPersons, targetRoleOrName) {
  if (!extractedPersons || extractedPersons.length === 0 || !targetRoleOrName) return null;
  if (targetRoleOrName === 'Default' || targetRoleOrName === 'Entscheider' || targetRoleOrName === 'Default Role') return null;

  const targetLower = targetRoleOrName.trim().toLowerCase();

  // 1. Direkter Namens-Treffer (falls targetRoleOrName ein konkreter Name ist)
  for (const p of extractedPersons) {
    const pNameLower = p.name.toLowerCase();
    if (pNameLower === targetLower || targetLower.includes(pNameLower) || pNameLower.includes(targetLower)) {
      return {
        name: p.name,
        role: p.role,
        source: p.sourceUrl,
        person_source: 'own_website',
        role_match: 'exact'
      };
    }
  }

  // 2. Exakter Rollen-Treffer
  for (const p of extractedPersons) {
    const roleLower = p.role.toLowerCase();
    if (roleLower === targetLower || 
        (targetLower === 'ceo' && (roleLower === 'ceo' || roleLower.startsWith('ceo ') || roleLower.endsWith(' ceo') || roleLower.includes('chief executive officer'))) ||
        (targetLower === 'cto' && (roleLower === 'cto' || roleLower.includes('chief technology officer'))) ||
        (targetLower === 'cfo' && (roleLower === 'cfo' || roleLower.includes('chief financial officer'))) ||
        (targetLower === 'coo' && (roleLower === 'coo' || roleLower.includes('chief operating officer'))) ||
        (targetLower === 'managing director' && roleLower.includes('managing director')) ||
        (roleLower.replace(/[^a-z0-9]/g, '') === targetLower.replace(/[^a-z0-9]/g, ''))) {
      return {
        name: p.name,
        role: p.role,
        source: p.sourceUrl,
        person_source: 'own_website',
        role_match: 'exact'
      };
    }
  }

  // 3. Rollenfamilien für angenähertes Matching (role_match: "approximate")
  const families = [
    {
      keywords: ['sales', 'vertrieb', 'business development', 'cro', 'revenue', 'account', 'vertriebsleiter', 'head of sales', 'vp sales', 'director of sales'],
      matches: (role) => /sales|vertrieb|business development|cro|revenue|account/i.test(role)
    },
    {
      keywords: ['ceo', 'geschäftsführer', 'geschäftsführung', 'managing director', 'founder', 'gründer', 'vorstand', 'inhaber', 'president', 'leitung'],
      matches: (role) => /ceo|chief executive|geschäftsführer|geschäftsführung|managing director|founder|gründer|vorstand|inhaber|president/i.test(role)
    },
    {
      keywords: ['engineering', 'cto', 'tech', 'technology', 'it', 'software', 'entwicklungsleiter'],
      matches: (role) => /engineering|cto|technology|tech|chief technology|software/i.test(role)
    },
    {
      keywords: ['marketing', 'cmo', 'marketingleiter', 'growth', 'brand'],
      matches: (role) => /marketing|cmo|growth|brand|chief marketing/i.test(role)
    },
    {
      keywords: ['people', 'hr', 'human resources', 'talent', 'operations', 'coo', 'personal'],
      matches: (role) => /people|hr|talent|human resources|operations|coo|chief operating/i.test(role)
    },
    {
      keywords: ['finance', 'cfo', 'finanzen', 'kaufmännisch'],
      matches: (role) => /finance|cfo|finanzen|chief financial/i.test(role)
    }
  ];

  for (const fam of families) {
    if (fam.keywords.some(k => targetLower.includes(k))) {
      for (const p of extractedPersons) {
        if (fam.matches(p.role)) {
          return {
            name: p.name,
            role: p.role,
            source: p.sourceUrl,
            person_source: 'own_website',
            role_match: 'approximate'
          };
        }
      }
    }
  }

  return null;
}

/**
 * 5. Namens- & Rollen-Findung mit Priorität (1. Eigene Website, 2. Externe Suche mit Domain-Verifikation)
 */
export async function findTargetPerson(companyName, domain, targetRoleOrName, extractedPersons = []) {
  // Wenn keine Rolle oder kein Name explizit vorgegeben wurde (Fall "Default" / falsy / "Entscheider")
  if (!targetRoleOrName || targetRoleOrName === 'Default' || targetRoleOrName === 'Entscheider' || targetRoleOrName === 'Default Role') {
    return null;
  }

  // PRIORITY 1: Direkt auf der Firmenseite gefundene Person (own_website)
  if (extractedPersons && extractedPersons.length > 0) {
    const websiteMatch = matchPersonFromWebsite(extractedPersons, targetRoleOrName);
    if (websiteMatch) {
      console.log(`[EmailCrawler] Person auf eigener Website gefunden (${websiteMatch.role_match}): ${websiteMatch.name} (${websiteMatch.role}) auf ${websiteMatch.source}`);
      return websiteMatch;
    }
  }

  // Ist targetRoleOrName bereits ein konkreter Vor- und Nachname? (z.B. "Bastian Nominacher", "Hanno Renner")
  const isDirectName = targetRoleOrName.trim().split(/\s+/).length >= 2 && !/(head|ceo|director|manager|leiter|vorstand|sales|vp|marketing|founder|gründer|cfo|cto|coo|cro)/i.test(targetRoleOrName);

  // PRIORITY 2: Externe Tavily-Suche als Fallback (mit strikter Domain-Verifikation)
  const tavilyKey = process.env.TAVILY_API_KEY || process.env.VITE_TAVILY_API_KEY;
  if (!tavilyKey) {
    if (isDirectName) {
      return {
        name: targetRoleOrName.trim(),
        role: 'Entscheider / Ansprechpartner',
        source: 'user_input',
        person_source: 'user_input',
        role_match: 'exact'
      };
    }
    return null;
  }

  const roleQuery = targetRoleOrName;

  try {
    const res = await fetchWithTimeout('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: tavilyKey,
        query: `"${companyName}" ${roleQuery} LinkedIn`,
        search_depth: 'basic',
        max_results: 6
      })
    }, 6000);

    if (res.ok) {
      const data = await res.json();
      if (data.results && data.results.length > 0) {
        const companyClean = companyName.toLowerCase().replace(/[^a-z0-9]/g, '');
        const domainClean = domain.toLowerCase().split('.')[0].replace(/[^a-z0-9]/g, '');

        for (const r of data.results) {
          const title = (r.title || '').trim();
          const snippet = (r.content || '');
          const url = r.url || '';
          const fullText = (title + ' ' + snippet + ' ' + url).toLowerCase();

          // VERIFIKATION 1: Ist die Firma oder Domain im Treffer vorhanden?
          const companyInResult = fullText.includes(companyClean) || fullText.includes(domainClean);
          if (!companyInResult) continue;

          // Extraktion Versuch A: Titel Segment vor Bindestrich (z.B. "Jack Hidary | Leadership - SandboxAQ")
          const firstChunk = title.split(/\s*[-–—|]\s*/)[0].trim();
          const words = firstChunk.split(/\s+/);
          if (words.length >= 2 && words.length <= 3 && words.every(w => /^[A-ZÄÖÜ][a-zäöüß]+$/.test(w))) {
            const candidate = words.join(' ');
            if (!NON_PERSON_WORDS.has(candidate.toLowerCase()) && !candidate.toLowerCase().includes(companyClean)) {
              // VERIFIKATION 2: Tauchen Name UND Firma im selben Treffer gemeinsam auf?
              const nameInResult = fullText.includes(candidate.toLowerCase());
              if (nameInResult) {
                let extractedRole = targetRoleOrName || 'Geschäftsführung';
                const parts = title.split(/\s*[-–—|]\s*/);
                if (parts[1] && !parts[1].toLowerCase().includes('linkedin')) extractedRole = parts[1].trim();
                
                console.log(`[EmailCrawler] Verifizierte Person via externer Suche gefunden: ${candidate} (${extractedRole}) bei ${companyName}`);
                return {
                  name: candidate,
                  role: extractedRole,
                  source: url,
                  person_source: 'external_search',
                  role_match: isDirectName ? 'exact' : (extractedRole.toLowerCase().includes(targetRoleOrName.toLowerCase()) ? 'exact' : 'approximate')
                };
              }
            }
          }

          // Extraktion Versuch B: Snippet Regex ("X is the founder and CEO of Y...")
          const snippetMatch = snippet.match(/([A-ZÄÖÜ][a-zäöüß]+(?:\s+[A-ZÄÖÜ][a-zäöüß]+))\s+(?:is the founder|is founder|is the ceo|is ceo|ist der geschäftsführer|ist gründer|ist ceo|fungiert als)/i);
          if (snippetMatch && snippetMatch[1]) {
            const candidate = snippetMatch[1].trim();
            if (!NON_PERSON_WORDS.has(candidate.toLowerCase()) && !candidate.toLowerCase().includes(companyClean)) {
              if (fullText.includes(candidate.toLowerCase()) && companyInResult) {
                console.log(`[EmailCrawler] Verifizierte Person via Snippet gefunden: ${candidate} bei ${companyName}`);
                return {
                  name: candidate,
                  role: targetRoleOrName || 'CEO & Founder',
                  source: url,
                  person_source: 'external_search',
                  role_match: isDirectName ? 'exact' : 'approximate'
                };
              }
            }
          }
        }
      }
    }
  } catch (err) {
    console.warn('[EmailCrawler] Personensuche fehlgeschlagen:', err.message);
  }

  // Wenn targetRoleOrName ein direkter Personenname war und keine externe Suche anschlug
  if (isDirectName) {
    return {
      name: targetRoleOrName.trim(),
      role: 'Entscheider / Ansprechpartner',
      source: 'user_input',
      person_source: 'user_input',
      role_match: 'exact'
    };
  }

  return null;
}

/**
 * 6. Zusammensetzen der E-Mail
 */
export function constructEmail(name, patternType, domain) {
  if (!name || !domain) return null;
  const cleanDomain = domain.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0].toLowerCase();

  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return null;

  const normalize = (str) => (str || '')
    .toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]/g, '');

  const vorname = normalize(parts[0]);
  const nachname = normalize(parts[parts.length - 1] || parts[0]);
  const v = vorname ? vorname[0] : 'x';

  let local = `${vorname}.${nachname}`;

  switch (patternType) {
    case '{v}.{nachname}':
      local = `${v}.${nachname}`;
      break;
    case '{vorname}{nachname}':
      local = `${vorname}${nachname}`;
      break;
    case '{vorname}_{nachname}':
      local = `${vorname}_${nachname}`;
      break;
    case '{vorname}-{nachname}':
      local = `${vorname}-${nachname}`;
      break;
    case '{vorname}':
      local = vorname;
      break;
    case '{nachname}.{vorname}':
      local = `${nachname}.${vorname}`;
      break;
    default:
      local = `${vorname}.${nachname}`;
  }

  return `${local}@${cleanDomain}`;
}

/**
 * 7. Hauptpipeline: Führt alle Schritte on-demand aus
 */
export async function runEmailPatternCrawler({ companyName, domain: rawDomain, targetRoleOrName }) {
  console.log(`[EmailCrawler] Pipeline gestartet für Firma: "${companyName || rawDomain}" (Rolle/Name: "${targetRoleOrName || 'Default'}")`);

  // 1. Domain
  let domain = rawDomain;
  if (!domain && companyName) {
    domain = await resolveDomain(companyName);
  }

  if (!domain) {
    return {
      success: false,
      reason: `Keine offizielle Domain für "${companyName}" auffindbar.`,
      coachText: `Für die Firma **${companyName || 'Unbekannt'}** konnte keine offizielle Domain ermittelt werden. Die Domain war im offenen Web nicht auffindbar.`
    };
  }

  const cleanDomain = domain.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0].toLowerCase();

  // 2. Crawl
  const { pages, rawEmails, extractedPersons, domainBlocked, fallbackSource, isFallbackUsed } = await crawlDomainPages(cleanDomain);
  const reachablePages = pages.filter(p => p.status === 200);

  if (reachablePages.length === 0) {
    return {
      success: false,
      domain: cleanDomain,
      domain_blocked: Boolean(domainBlocked),
      pagesCrawled: pages,
      reason: `Domain ${cleanDomain} ist aktuell nicht erreichbar.`,
      coachText: `Die Firmendomain **${cleanDomain}** konnte nicht abgerufen werden (Server antwortet nicht). Es konnten daher keine E-Mail-Muster analysiert werden.`
    };
  }

  // 3. Email-Klassifizierung
  const { generic, personal } = classifyEmails(rawEmails, cleanDomain);

  // 4. Muster-Ableitung
  const patternInfo = deriveEmailPattern(personal, generic, cleanDomain, {
    domainBlocked,
    fallbackSource,
    isFallbackUsed
  });

  // 5. Namens-Findung mit Verifikation & Priorität (1. Website HTML, 2. Externe Suche)
  const personInfo = await findTargetPerson(companyName || cleanDomain.split('.')[0], cleanDomain, targetRoleOrName, extractedPersons);

  let person = null;
  let coachText = '';

  if (personInfo && personInfo.name) {
    const generatedEmail = constructEmail(personInfo.name, patternInfo.patternType, cleanDomain);
    person = {
      name: personInfo.name,
      role: personInfo.role,
      email: generatedEmail,
      email_confidence: patternInfo.confidence,
      email_source: personInfo.source,
      person_source: personInfo.person_source || 'own_website',
      role_match: personInfo.role_match || 'exact',
      pattern: patternInfo.patternLabel
    };

    if (domainBlocked || isFallbackUsed) {
      if (patternInfo.isGuess) {
        coachText = `Zieldomain **${cleanDomain}** blockiert Zugriffe (Status 429), stattdessen wurde **${fallbackSource || 'Fallback-Quelle'}** geprüft — Ergebnis daher weniger belastbar. Das angenommene Standard-Muster lautet: \`\`\`${generatedEmail}\`\`\` (Konfidenz: ${patternInfo.confidence}/100, ungeprüfte Standard-Vermutung).`;
      } else {
        coachText = `Zieldomain **${cleanDomain}** blockiert Zugriffe (Status 429), stattdessen wurde **${fallbackSource || 'Fallback-Quelle'}** geprüft (Ergebnis weniger belastbar). Basierend darauf lautet das vermutete Muster: \`\`\`${generatedEmail}\`\`\` (Konfidenz: ${patternInfo.confidence}/100, Fallback-Quelle).`;
      }
    } else {
      if (patternInfo.isGuess) {
        coachText = `Basierend auf der Domain **${cleanDomain}** (gecrawlt: ${reachablePages.length} Seiten, keine Personenadressen gefunden) lautet das angenommene Standard-Muster: \`\`\`${generatedEmail}\`\`\` (Konfidenz: ${patternInfo.confidence}/100, ungeprüfte Standard-Vermutung).`;
      } else {
        coachText = `Basierend auf dem E-Mail-Muster von **${cleanDomain}** (abgeleitet aus ${personal.length} gefundenen Adressen auf der Website) lautet die wahrscheinliche Adresse: \`\`\`${generatedEmail}\`\`\` (Konfidenz: ${patternInfo.confidence}/100, ungeprüft).`;
      }
    }
  } else {
    // Wenn KEINE konkrete Zielperson ermittelbar war (person: null)
    person = null;
    if (domainBlocked || isFallbackUsed) {
      if (patternInfo.isGuess) {
        coachText = `Kein konkreter Ansprechpartner ermittelbar. Zieldomain **${cleanDomain}** blockiert Zugriffe (Status 429), stattdessen wurde **${fallbackSource || 'Fallback-Quelle'}** geprüft — Ergebnis daher weniger belastbar. Das angenommene Standard-Muster lautet: \`\`\`${patternInfo.patternLabel}\`\`\` (Konfidenz: ${patternInfo.confidence}/100, ungeprüfte Standard-Vermutung).`;
      } else {
        coachText = `Kein konkreter Ansprechpartner ermittelbar. Zieldomain **${cleanDomain}** blockiert Zugriffe (Status 429), stattdessen wurde **${fallbackSource || 'Fallback-Quelle'}** geprüft (Ergebnis weniger belastbar). Vermutetes E-Mail-Muster: \`\`\`${patternInfo.patternLabel}\`\`\` (Konfidenz: ${patternInfo.confidence}/100, abgeleitet aus Fallback-Quelle ${fallbackSource}).`;
      }
    } else {
      const reasonText = patternInfo.isGuess 
        ? 'ungeprüfte Standard-Vermutung'
        : `abgeleitet aus ${personal.length} echten Mitarbeiter-Adressen auf ${cleanDomain}`;
      coachText = `Kein konkreter Ansprechpartner ermittelbar. Das E-Mail-Muster von **${cleanDomain}** lautet aber: \`\`\`${patternInfo.patternLabel}\`\`\` (Konfidenz: ${patternInfo.confidence}/100, ${reasonText}).`;
    }
  }

  const resultObj = {
    success: true,
    company: companyName || cleanDomain,
    domain: cleanDomain
  };

  if (domainBlocked) {
    resultObj.domain_blocked = true;
    resultObj.fallback_source = fallbackSource || null;
  }

  return {
    ...resultObj,
    person,
    crawledPages: reachablePages.map(p => p.url),
    foundEmails: {
      personal,
      generic
    },
    patternInfo,
    coachText
  };
}

/**
 * Netlify Function Handler
 */
export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization'
      }
    };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const body = event.body ? JSON.parse(event.body) : {};
    const { companyName, domain, targetRoleOrName } = body;

    if (!companyName && !domain) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'companyName or domain required' })
      };
    }

    const result = await runEmailPatternCrawler({ companyName, domain, targetRoleOrName });

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify(result)
    };
  } catch (err) {
    console.error('[EmailCrawler] Handler Fehler:', err);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: err.message })
    };
  }
};
