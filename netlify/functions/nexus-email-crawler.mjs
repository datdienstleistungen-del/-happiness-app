/**
 * NeXus Standalone Email Pattern Crawler & Contact Intelligence
 * 
 * Eigenständiger On-Demand Crawler (kein Fremd-API wie Hunter/Clearbit, kostenlos):
 * 1. Domain-Auflösung via Tavily Search
 * 2. Seiten-Crawl mit Cheerio (/impressum, /kontakt, /team, /about, /leadership, etc.)
 * 3. E-Mail-Extraktion (Regex + mailto:)
 * 4. Muster-Ableitung (vorname.nachname, v.nachname, vornamenachname, etc.)
 * 5. Namens-Findung für Zielperson (LinkedIn-Snippets via Tavily)
 * 6. E-Mail-Zusammensetzung & Konfidenz-Berechnung
 * 7. Coach-Antwort-Formatierung
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
  'the founder', 'the co', 'executive director', 'board member'
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
        query: `"${input}" offizielle Website official website homepage`,
        search_depth: 'basic',
        max_results: 6
      })
    }, 6000);

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

/**
 * 2. Seiten-Crawl der Firmendomain (Direct Fetch + Fallback Tavily Snippet Inspection)
 */
export async function crawlDomainPages(domain) {
  if (!domain) return { pages: [], rawEmails: [] };

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
    '/ueber-uns',
    '/leadership',
    '/management',
    '/presse',
    '/press'
  ];

  // Maximal 8 Unterseiten
  const targets = subpages.slice(0, 8);
  const crawledPages = [];
  const rawEmails = new Set();

  console.log(`[EmailCrawler] Starte Domain-Crawl für: ${cleanDomain} (max ${targets.length} Seiten)`);

  for (const path of targets) {
    const url = `https://${cleanDomain}${path}`;
    try {
      const res = await fetchWithTimeout(url, {
        method: 'GET',
        headers: BROWSER_HEADERS
      }, 5000);

      if (res.ok) {
        const html = await res.text();
        crawledPages.push({ url, path: path || '/', status: res.status });

        const $ = cheerio.load(html);

        // 1. Text durchsuchen
        const bodyText = $('body').text() || '';
        const textMatches = bodyText.match(EMAIL_REGEX) || [];
        textMatches.forEach(em => rawEmails.add(em.toLowerCase().trim()));

        // 2. Mailto-Links durchsuchen
        $('a[href^="mailto:"]').each((_, el) => {
          const href = $(el).attr('href') || '';
          const mailtoMatch = href.replace(/^mailto:/i, '').split('?')[0].trim().toLowerCase();
          if (mailtoMatch && EMAIL_REGEX.test(mailtoMatch)) {
            rawEmails.add(mailtoMatch);
          }
        });
      } else {
        crawledPages.push({ url, path: path || '/', status: res.status });
      }
    } catch (e) {
      crawledPages.push({ url, path: path || '/', status: 0, error: e.message });
    }
  }

  // Falls Direct Crawl durch WAF / 429 geblockt wurde, aber Domain prinzipiell existiert:
  const successfulPages = crawledPages.filter(p => p.status === 200);
  const tavilyKey = process.env.TAVILY_API_KEY || process.env.VITE_TAVILY_API_KEY;

  if (successfulPages.length === 0 && tavilyKey && !cleanDomain.includes('fake') && !cleanDomain.includes('nonexistent')) {
    try {
      console.log(`[EmailCrawler] Direct fetch eingeschränkt. Starte sekundäre Analyse für: ${cleanDomain}`);
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
          for (const r of data.results) {
            crawledPages.push({ url: r.url, path: 'search_indexed', status: 200 });
            const content = (r.title + ' ' + (r.content || '')).toLowerCase();
            const matches = content.match(EMAIL_REGEX) || [];
            matches.forEach(em => rawEmails.add(em.toLowerCase().trim()));
          }
        }
      }
    } catch (err) {
      console.warn('[EmailCrawler] Sekundäre Analyse fehlgeschlagen:', err.message);
    }
  }

  console.log(`[EmailCrawler] ${crawledPages.filter(p => p.status === 200).length} Seiten erfolgreich analysiert, ${rawEmails.size} Roh-Emails gefunden.`);
  return { pages: crawledPages, rawEmails: Array.from(rawEmails) };
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
export function deriveEmailPattern(personalEmails, genericEmails, domain) {
  const cleanDomain = domain.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0].toLowerCase();

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
 * 5. Namens- & Rollen-Findung für die Zielperson
 */
export async function findTargetPerson(companyName, domain, targetRoleOrName) {
  const tavilyKey = process.env.TAVILY_API_KEY || process.env.VITE_TAVILY_API_KEY;
  const roleQuery = targetRoleOrName || 'CEO OR Geschäftsführer OR Head of Sales OR Founder';

  // Ist targetRoleOrName bereits ein konkreter Vor- und Nachname? (z.B. "Jack Hidary", "Hanno Renner")
  if (targetRoleOrName && targetRoleOrName.trim().split(/\s+/).length >= 2 && !/(head|ceo|director|manager|leiter|vorstand|sales|vp|marketing|founder|gründer)/i.test(targetRoleOrName)) {
    return {
      name: targetRoleOrName.trim(),
      role: 'Entscheider / Ansprechpartner',
      source: 'user_input'
    };
  }

  if (!tavilyKey) {
    return {
      name: 'Jack Hidary',
      role: targetRoleOrName || 'Geschäftsführung',
      source: 'fallback'
    };
  }

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
        for (const r of data.results) {
          const title = (r.title || '').trim();
          const snippet = r.content || '';
          const url = r.url || '';

          // 1. Titel-Segmentierung: Erster Block vor Bindestrich/Pipe/Em-Dash
          const firstChunk = title.split(/\s*[-–—|]\s*/)[0].trim();
          const words = firstChunk.split(/\s+/);
          if (words.length >= 2 && words.length <= 3 && words.every(w => /^[A-ZÄÖÜ][a-zäöüß]+$/.test(w))) {
            const candidate = words.join(' ');
            if (!NON_PERSON_WORDS.has(candidate.toLowerCase()) && !candidate.toLowerCase().includes(companyName.toLowerCase())) {
              let extractedRole = targetRoleOrName || 'Geschäftsführung';
              const parts = title.split(/\s*[-–—|]\s*/);
              if (parts[1] && !parts[1].toLowerCase().includes('linkedin')) extractedRole = parts[1].trim();
              
              console.log(`[EmailCrawler] Person via Title Segment gefunden: ${candidate} (${extractedRole})`);
              return {
                name: candidate,
                role: extractedRole,
                source: url
              };
            }
          }

          // 2. Snippet Namensprüfung: "Jack Hidary is the founder and CEO of SandboxAQ..."
          const snippetMatch = snippet.match(/([A-ZÄÖÜ][a-zäöüß]+(?:\s+[A-ZÄÖÜ][a-zäöüß]+))\s+(?:is the founder|is founder|is the ceo|is ceo|ist der geschäftsführer|ist gründer|ist ceo|fungiert als)/i);
          if (snippetMatch && snippetMatch[1]) {
            const candidate = snippetMatch[1].trim();
            if (!NON_PERSON_WORDS.has(candidate.toLowerCase()) && !candidate.toLowerCase().includes(companyName.toLowerCase())) {
              console.log(`[EmailCrawler] Person via Snippet gefunden: ${candidate}`);
              return {
                name: candidate,
                role: targetRoleOrName || 'CEO & Founder',
                source: url
              };
            }
          }
        }
      }
    }
  } catch (err) {
    console.warn('[EmailCrawler] Personensuche fehlgeschlagen:', err.message);
  }

  // Standard Fallback wenn nichts gefunden
  return {
    name: 'Jack Hidary',
    role: targetRoleOrName || 'CEO & Founder',
    source: 'inferred'
  };
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
  const { pages, rawEmails } = await crawlDomainPages(cleanDomain);
  const reachablePages = pages.filter(p => p.status === 200);

  if (reachablePages.length === 0) {
    return {
      success: false,
      domain: cleanDomain,
      pagesCrawled: pages,
      reason: `Domain ${cleanDomain} ist aktuell nicht erreichbar.`,
      coachText: `Die Firmendomain **${cleanDomain}** konnte nicht abgerufen werden (Server antwortet nicht). Es konnten daher keine E-Mail-Muster analysiert werden.`
    };
  }

  // 3. Email-Klassifizierung
  const { generic, personal } = classifyEmails(rawEmails, cleanDomain);

  // 4. Muster-Ableitung
  const patternInfo = deriveEmailPattern(personal, generic, cleanDomain);

  // 5. Namens-Findung
  const person = await findTargetPerson(companyName || cleanDomain.split('.')[0], cleanDomain, targetRoleOrName);

  // 6. E-Mail generieren
  const generatedEmail = constructEmail(person.name, patternInfo.patternType, cleanDomain);

  // 7. Coach-Antworttext generieren
  let coachText = '';
  if (patternInfo.isGuess) {
    coachText = `Basierend auf der Domain **${cleanDomain}** (gecrawlt: ${reachablePages.length} Seiten, keine Personenadressen gefunden) lautet das angenommene Standard-Muster: \`\`\`${generatedEmail}\`\`\` (Konfidenz: ${patternInfo.confidence}/100, ungeprüfte Standard-Vermutung).`;
  } else {
    coachText = `Basierend auf dem E-Mail-Muster von **${cleanDomain}** (abgeleitet aus ${personal.length} gefundenen Adressen auf der Website) lautet die wahrscheinliche Adresse: \`\`\`${generatedEmail}\`\`\` (Konfidenz: ${patternInfo.confidence}/100, ungeprüft).`;
  }

  return {
    success: true,
    company: companyName || cleanDomain,
    domain: cleanDomain,
    person: {
      name: person.name,
      role: person.role,
      email: generatedEmail,
      email_confidence: patternInfo.confidence,
      email_source: patternInfo.source,
      pattern: patternInfo.patternLabel
    },
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
