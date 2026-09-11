/**
 * NeXus Contact Intelligence
 * 
 * Findet automatisch den passenden Ansprechpartner für eine Opportunity.
 * 
 * Pipeline: Role Inference → Targeted Crawl → Person Discovery → 
 *           Contact Ranking → Email Discovery → Save
 * 
 * WICHTIG: Keine Tavily-Aufrufe. Eigener Crawler mit DuckDuckGo/SearXNG.
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

// ============================================================================
// WEB SEARCH (DuckDuckGo → SearXNG, kein Tavily)
// ============================================================================

async function fetchWithTimeout(url, options = {}, timeoutMs = 8000) {
  const controller = new AbortController();
  const abortId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(abortId);
    return { res, abortId };
  } catch (e) {
    clearTimeout(abortId);
    throw e;
  }
}

async function searchDuckDuckGo(query) {
  try {
    const { res } = await fetchWithTimeout(
      `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`,
      { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' } },
      5000
    );
    if (!res.ok) return null;
    const html = await res.text();
    const results = [];
    
    // Find all result links (result__a)
    const linkRegex = /<a[^>]+class="result__a"[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;
    let match;
    
    while ((match = linkRegex.exec(html)) !== null && results.length < 5) {
      const href = match[1];
      const title = match[2].replace(/<[^>]*>/g, '').trim();
      
      // Extract actual URL from DuckDuckGo redirect
      let url = null;
      if (href.includes('uddg=')) {
        const uddgMatch = href.match(/uddg=([^&]*)/);
        if (uddgMatch) {
          url = decodeURIComponent(uddgMatch[1]);
        }
      } else if (href.startsWith('http')) {
        url = href;
      }
      
      // Find the next snippet (result__snippet) after this link
      const snippetRegex = /<a[^>]+class="result__snippet"[^>]*>([\s\S]*?)<\/a>/gi;
      snippetRegex.lastIndex = match.index + match[0].length;
      const snippetMatch = snippetRegex.exec(html);
      const snippet = snippetMatch ? snippetMatch[1].replace(/<[^>]*>/g, '').trim() : '';
      
      if (url && title) {
        results.push({ url, title, snippet });
      }
    }
    
    return results.length > 0 ? results : null;
  } catch (e) {
    return null;
  }
}

async function searchSearXNG(query) {
  const instances = ['https://searx.be', 'https://search.bus-hit.me', 'https://searxng.site'];
  for (const base of instances) {
    try {
      const { res } = await fetchWithTimeout(
        `${base}/search?q=${encodeURIComponent(query)}&format=json&categories=general`,
        {},
        5000
      );
      if (!res.ok) continue;
      const data = await res.json();
      if (data.results?.length > 0) {
        return data.results.slice(0, 5).map(r => ({
          url: r.url, title: r.title, snippet: r.content || ''
        }));
      }
    } catch (e) { continue; }
  }
  return null;
}

async function webSearch(query) {
  const ddg = await searchDuckDuckGo(query);
  if (ddg?.length > 0) return ddg;
  return await searchSearXNG(query);
}

// ============================================================================
// HTML PAGE FETCHING & PARSING
// ============================================================================

async function fetchPageText(url, maxChars = 5000) {
  try {
    const { res } = await fetchWithTimeout(url, {
      headers: { 
        'User-Agent': 'Mozilla/5.0 (compatible; NeXusBot/1.0)',
        'Accept': 'text/html,application/xhtml+xml'
      },
    }, 5000);
    if (!res.ok) return null;
    const html = await res.text();
    
    // Einfaches HTML→Text: Script/Style entfernen, Tags strippen
    let text = html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<nav[\s\S]*?<\/nav>/gi, '')
      .replace(/<footer[\s\S]*?<\/footer>/gi, '')
      .replace(/<header[\s\S]*?<\/header>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&#\d+;/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    
    return text.substring(0, maxChars);
  } catch (e) {
    return null;
  }
}

// ============================================================================
// PHASE 2: ROLE INFERENCE
// ============================================================================

async function inferTargetRole(context) {
  const { offering, company, opportunity, trigger, research } = context;
  
  const prompt = `Du bist ein B2B-Vertriebsexperte. Leite aus dem Geschäftskontext die ZIELROLLE für den richtigen Ansprechpartner ab.

KONTEXT:
- Angebot: ${offering?.offering_name || 'Unbekannt'}
- Positionierung: ${offering?.positioning || 'Unbekannt'}
- Zielgruppe: ${offering?.target_audience || 'Unbekannt'}
- Firma: ${company?.name || 'Unbekannt'}
- Branche: ${company?.industry || 'Unbekannt'}
- Firmengröße: ${company?.size || 'Unbekannt'}
- Trigger: ${trigger?.content || 'Kein Trigger'}
- Research: ${research?.summary || 'Kein Research'}

REGELN:
1. Die Zielrolle muss aus dem KONKRETEN Geschäftsanlass entstehen.
2. KEINE starren Regeln (SaaS→CEO, HR→CMO etc.)
3. Bei kleinen Firmen (<50 MA): CEO/Founder kann relevant sein
4. Bei großen Firmen: Spezialisierte Rolle bevorzugen
5. Der Trigger bestimmt die Rolle, nicht die Branche
6. Die Rolle MUSS so spezifisch sein, dass man bei LinkedIn danach suchen kann

WICHTIG: Gib NUR eine konkrete Rolle zurück (z.B. "VP Sales DACH" oder "Head of Marketing Midmarket"). 
KEINE generischen Rollen wie "Verantwortlicher" oder "Ansprechpartner".

Gib ein JSON zurück:
{
  "primary_role": "Konkrete Zielrolle (z.B. Head of Sales, VP Marketing)",
  "alternative_roles": ["Rolle 2", "Rolle 3"],
  "role_reason": "Warum gerade diese Rolle zum Trigger/Kontext passt (1-2 Sätze)",
  "confidence": 85
}`;

  return await callLLM(prompt, 0.3);
}

// ============================================================================
// PHASE 3: TARGETED CRAWLER — Direct Domain First
// ============================================================================

const TEAM_PAGE_PATTERNS = [
  /team/i, /about/i, /ueber-?uns/i, /ueber/i,
  /management/i, /leadership/i, /people/i, /staff/i,
  /geschaeftsfuehrung/i, /founder/i, /kontakt/i, /contact/i,
  /impressum/i, /unternehmen/i
];

const EXCLUDE_PAGE_PATTERNS = [
  /blog/i, /news/i, /presse/i, /press/i, /download/i,
  /faq/i, /hilfe/i, /help/i, /login/i, /register/i,
  /datenschutz/i, /privacy/i, /agb/i, /terms/i,
  /cookie/i, /sitemap/i, /rss/i
];

function isRelevantTeamPage(url) {
  const u = url.toLowerCase();
  const hasRelevant = TEAM_PAGE_PATTERNS.some(p => p.test(u));
  const hasExcluded = EXCLUDE_PAGE_PATTERNS.some(p => p.test(u));
  return hasRelevant && !hasExcluded;
}

async function crawlForContacts(companyName, companyDomain, targetRole, alternativeRoles) {
  const allCandidates = [];
  const pagesCrawled = [];
  
  if (!companyDomain) {
    console.log('[Crawler] No domain provided, using DuckDuckGo fallback');
    return await crawlViaSearch(companyName, targetRole);
  }
  
  // ========== PHASE A: Direct Domain Crawl ==========
  console.log(`[Crawler] Phase A: Direct crawl of ${companyDomain}`);
  
  // 1. Load homepage and extract internal links (single request!)
  const baseUrl = `https://${companyDomain}`;
  const homepageHtml = await fetchRawHtml(baseUrl);
  
  if (!homepageHtml) {
    console.log(`[Crawler] Homepage not reachable: ${baseUrl}`);
    return await crawlViaSearch(companyName, targetRole);
  }
  
  const homepageText = homepageHtml
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ').trim();
  
  console.log(`[Crawler] Homepage loaded: ${homepageText.length} chars`);
  
  // Extract all internal links from homepage
  const internalLinks = extractInternalLinks(homepageHtml, baseUrl);
  console.log(`[Crawler] Found ${internalLinks.length} internal links`);
  
  // 2. Identify relevant team/about pages
  const teamUrls = internalLinks
    .filter(url => {
      const u = url.toLowerCase();
      const isOnDomain = u.includes(companyDomain);
      const isRelevant = isRelevantTeamPage(url);
      const isExcluded = EXCLUDE_PAGE_PATTERNS.some(p => p.test(u));
      return isOnDomain && isRelevant && !isExcluded;
    });
  
  // Deduplicate and prioritize
  const uniqueTeamUrls = [...new Set(teamUrls)];
  console.log(`[Crawler] Found ${uniqueTeamUrls.length} team/about pages: ${uniqueTeamUrls.map(u => u.replace(baseUrl, '')).join(', ')}`);
  
  // Also try 3 most common paths if not found via links
  const commonPaths = ['/team', '/ueber-uns', '/about'];
  for (const path of commonPaths) {
    const url = baseUrl + path;
    if (!uniqueTeamUrls.some(u => u.toLowerCase() === url.toLowerCase())) {
      try {
        const { res } = await fetchWithTimeout(url, { method: 'HEAD' }, 2000);
        if (res.ok) {
          uniqueTeamUrls.push(url);
          console.log(`[Crawler] Found via common path: ${path}`);
        }
      } catch (e) { /* ignore */ }
    }
  }
  
  // 3. Crawl team pages (max 3) and extract persons via LLM (PARALLEL!)
  const pagesToCrawl = uniqueTeamUrls.slice(0, 3);
  
  const crawlPromises = pagesToCrawl.map(async (url) => {
    console.log(`[Crawler] Crawling: ${url}`);
    const text = await fetchPageText(url, 5000);
    if (!text || text.length < 200) {
      console.log(`  (skipped: too short or empty)`);
      return { url, persons: [] };
    }
    
    const persons = await extractPersonsViaLLM(text, companyName, targetRole, url);
    return { url, persons };
  });
  
  const results = await Promise.all(crawlPromises);
  
  for (const { url, persons } of results) {
    pagesCrawled.push(url);
    for (const p of persons) {
      p.source_url = url;
      p.company_validated = true;
      allCandidates.push(p);
      console.log(`  Found: ${p.name} (${p.role})`);
    }
  }
  
  console.log(`[Crawler] Phase A complete: ${allCandidates.length} candidates from ${pagesCrawled.length} pages`);
  
  // ========== PHASE B: DuckDuckGo Fallback ==========
  if (allCandidates.length === 0) {
    console.log('[Crawler] Phase B: DuckDuckGo fallback (no candidates from direct crawl)');
    const fallbackCandidates = await crawlViaSearch(companyName, targetRole);
    allCandidates.push(...fallbackCandidates);
  }
  
  console.log(`[Crawler] Total: ${allCandidates.length} validated candidates`);
  
  return {
    candidates: allCandidates,
    pagesCrawled,
    method: pagesCrawled.length > 0 ? 'direct_crawl' : 'search_fallback'
  };
}

async function crawlViaSearch(companyName, targetRole) {
  const candidates = [];
  
  const queries = [
    `${companyName} Geschäftsführer team`,
    `${companyName} ${targetRole}`
  ];
  
  for (const query of queries) {
    const results = await webSearch(query);
    if (!results) continue;
    
    for (const r of results) {
      if (isJobUrl(r.url)) continue;
      
      // Only use if URL belongs to the company's own domain
      // OR if snippet explicitly mentions the company name with a person
      const urlLower = r.url.toLowerCase();
      const isCompanyUrl = urlLower.includes(companyName.toLowerCase().replace(/\s+/g, ''));
      
      if (!isCompanyUrl) continue; // Skip external sources in fallback
      
      const text = await fetchPageText(r.url, 6000);
      if (!text) continue;
      
      const persons = await extractPersonsViaLLM(text, companyName, targetRole, r.url);
      for (const p of persons) {
        p.source_url = r.url;
        p.company_validated = true;
        candidates.push(p);
      }
    }
  }
  
  return candidates;
}

async function fetchRawHtml(url) {
  try {
    const { res } = await fetchWithTimeout(url, {
      headers: { 
        'User-Agent': 'Mozilla/5.0 (compatible; NeXusBot/1.0)',
        'Accept': 'text/html,application/xhtml+xml'
      },
    }, 5000);
    if (!res.ok) return '';
    return await res.text();
  } catch (e) {
    return '';
  }
}

function extractInternalLinks(html, baseUrl) {
  const links = [];
  const urlObj = new URL(baseUrl);
  const domain = urlObj.hostname;
  
  const regex = /href="([^"]*)"/gi;
  let match;
  while ((match = regex.exec(html)) !== null) {
    let href = match[1];
    if (href.startsWith('/')) {
      href = baseUrl + href;
    } else if (!href.startsWith('http')) {
      continue;
    }
    // Only keep internal links
    try {
      const linkUrl = new URL(href);
      if (linkUrl.hostname.includes(domain.replace('www.', ''))) {
        // Remove hash and trailing slash
        const clean = linkUrl.origin + linkUrl.pathname.replace(/\/$/, '');
        links.push(clean);
      }
    } catch (e) { /* skip invalid URLs */ }
  }
  
  return [...new Set(links)];
}

async function extractPersonsViaLLM(pageText, companyName, targetRole, sourceUrl) {
  // Text bereinigen
  const cleanText = pageText
    .replace(/Newsletter/gi, '')
    .replace(/Cookie[- ]Einstellungen/gi, '')
    .replace(/Privatsphäre/gi, '')
    .replace(/Datenschutz/gi, '')
    .replace(/Zum Inhalt springen/gi, '')
    .replace(/© \d{4}[^\.]*/gi, '')
    .replace(/Linkedin|Youtube|Spotify/gi, '')
    .replace(/\+\d{1,3}[\s\d\-()]+/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  
  if (cleanText.length < 100) return [];
  
  const prompt = `Du bist ein personnelcher Researcher. Extrahiere PERSONEN von der Firmenwebsite.

FIRMA: ${companyName}
GESUCHTE ROLLE: ${targetRole}
QUELLE: ${sourceUrl}

TEXT DER WEBSEITE:
${cleanText.substring(0, 4000)}

STRENGE REGELN:
1. NUR vollständige plausible Personennamen (Vor- + Nachname)
2. KEINE Textfragmente ("Officer and", "be the", "GmbH staff")
3. KEINE Firmennamen oder Produktnamen
4. KEINE Satzfragmente als Namen
5. Jede Person MUSS eine klare Position/Rolle haben
6. Die Person MUSS zur Firma ${companyName} gehören (nicht zu einer anderen Firma)
7. Quelle ist die angegebene URL

Gib ein JSON Array zurück:
[{"name": "Vorname Nachname", "role": "Position", "evidence": "Zitat aus dem Text das die Person belegt"}]

Wenn du KEINE klaren Personen findest, gib ein leeres Array zurück: []`;

  const result = await callLLM(prompt, 0.1);
  if (!result) return [];
  
  let persons = [];
  if (Array.isArray(result)) persons = result;
  else if (result.persons && Array.isArray(result.persons)) persons = result.persons;
  else if (result.raw) {
    try { 
      const parsed = JSON.parse(result.raw); 
      if (Array.isArray(parsed)) persons = parsed; 
    } catch(e) {}
  }
  
  // Validate: must have name (2+ words), role, and evidence
  return persons.filter(p => {
    if (!p.name || !p.role || !p.evidence) return false;
    const name = p.name.trim();
    const role = p.role.trim();
    // Name must be 2+ words, each 2+ chars
    const nameParts = name.split(/\s+/);
    if (nameParts.length < 2) return false;
    if (nameParts.some(part => part.length < 2)) return false;
    // Role must be meaningful (not a sentence fragment)
    if (role.length < 3 || role.length > 80) return false;
    // Evidence must be meaningful
    if (!p.evidence || p.evidence.length < 10) return false;
    return true;
  }).map(p => ({
    name: p.name.trim(),
    role: p.role.trim(),
    evidence: p.evidence.trim(),
    confidence: 80
  }));
}

// ============================================================================
// PHASE 5: CONTACT RANKING
// ============================================================================

async function rankContacts(candidates, context) {
  if (candidates.length === 0) return [];
  if (candidates.length === 1) return [{ ...candidates[0], rank_score: 90 }];
  
  const prompt = `Du bist ein Vertriebsexperte. Bewerte die gefundenen Kontaktkandidaten für eine B2B-Chance.

KONTEXT:
- Angebot: ${context.offering?.offering_name || 'Unbekannt'}
- Zielrolle: ${context.targetRole || 'Unbekannt'}
- Trigger: ${context.trigger?.content || 'Kein Trigger'}
- Firma: ${context.company?.name || 'Unbekannt'}

KANDIDATEN:
${candidates.map((c, i) => `${i + 1}. ${c.name} — ${c.role || 'Rolle unbekannt'} (Quelle: ${c.source_url || 'direkt'}, company_validated: ${c.company_validated ? 'ja' : 'nein'})`).join('\n')}

BEWERTUNGSKRITERIEN (in Reihenfolge):
1. Company Validated (stammt die Person von der eigenen Firmenseite?)
2. Role Fit (passt die Rolle zur Zielrolle?)
3. Evidence Quality (ist die Evidenz überzeugend?)
4. Opportunity Fit (passt die Person zum Angebot?)

WICHTIG: Nur validierte Personen (company_validated=true) bewerten. Externe Quellen ablehnen.

Gib ein JSON Array zurück, sortiert nach Score (höchster zuerst):
[
  { "index": 0, "rank_score": 95, "reason": "Kurze Begründung" },
  { "index": 1, "rank_score": 82, "reason": "..." }
]

Nur relevante Kandidaten (Score > 40).`;

  const result = await callLLM(prompt, 0.2);
  if (!result?.rankings) return candidates.map((c, i) => ({ ...c, rank_score: 90 - i * 10 }));
  
  return result.rankings
    .filter(r => r.rank_score > 40)
    .map(r => ({
      ...candidates[r.index],
      rank_score: r.rank_score,
      rank_reason: r.reason
    }));
}

// ============================================================================
// PHASE 6: EMAIL DISCOVERY — No Construction, Only Found or Unknown
// ============================================================================

async function discoverEmails(rankedContacts, companyName, companyDomain) {
  for (const contact of rankedContacts) {
    contact.email_status = 'UNKNOWN';
    contact.email = null;
    contact.email_source = null;
    
    // Only search on the company's own domain and public sources
    if (!companyDomain) continue;
    
    // Search for publicly listed email on company pages
    const searchQueries = [
      `"${contact.name}" site:${companyDomain}`,
      `"${contact.name}" "${companyName}" email`
    ];
    
    for (const query of searchQueries) {
      const results = await webSearch(query);
      if (!results) continue;
      
      for (const r of results) {
        // Only accept emails from the company's own domain
        const urlLower = r.url.toLowerCase();
        const isOnCompanySite = urlLower.includes(companyDomain);
        
        const emailMatch = (r.snippet + ' ' + r.title).match(
          /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g
        );
        
        if (emailMatch?.length > 0) {
          for (const email of emailMatch) {
            const emailDomain = email.split('@')[1]?.toLowerCase();
            // Only accept if from company domain
            if (emailDomain && emailDomain.includes(companyDomain.replace('www.', ''))) {
              contact.email = email;
              contact.email_status = 'FOUND';
              contact.email_source = r.url;
              break;
            }
          }
          if (contact.email_status === 'FOUND') break;
        }
      }
      if (contact.email_status === 'FOUND') break;
    }
  }
  
  return rankedContacts;
}

// ============================================================================
// EMAIL PATTERN-GUESSING
// ============================================================================

function generateEmailPatterns(name, domain) {
  if (!name || !domain) return [];
  
  const parts = name.trim().split(/\s+/);
  if (parts.length < 2) return [];
  
  const vorname = parts[0].toLowerCase();
  const nachname = parts[parts.length - 1].toLowerCase();
  
  const normalize = (str) => str
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]/g, '');
  
  const v = normalize(vorname);
  const n = normalize(nachname);
  
  const cleanDomain = domain.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0].toLowerCase();
  
  const patterns = [
    { pattern: '{vorname}.{nachname}', email: `${v}.${n}@${cleanDomain}`, confidence: 90 },
    { pattern: '{v}.{nachname}', email: `${v[0]}.${n}@${cleanDomain}`, confidence: 80 },
    { pattern: '{vorname}{nachname}', email: `${v}${n}@${cleanDomain}`, confidence: 70 },
    { pattern: '{vorname}_{nachname}', email: `${v}_${n}@${cleanDomain}`, confidence: 65 },
    { pattern: '{nachname}.{vorname}', email: `${n}.${v}@${cleanDomain}`, confidence: 60 },
    { pattern: '{nachname}{vorname}', email: `${n}${v}@${cleanDomain}`, confidence: 50 },
    { pattern: '{vorname}', email: `${v}@${cleanDomain}`, confidence: 40 },
  ];
  
  return patterns.map(p => ({
    email: p.email,
    pattern: p.pattern,
    confidence: p.confidence,
    method: 'pattern_guessing'
  }));
}

// ============================================================================
// LLM CALL
// ============================================================================

async function callLLM(prompt, temperature = 0.3) {
  const providers = [
    { url: 'https://api.deepseek.com/chat/completions', key: process.env.DEEPSEEK_API_KEY, model: 'deepseek-v4-flash' },
    { url: 'https://api.mistral.ai/v1/chat/completions', key: process.env.MISTRAL_API_KEY, model: 'mistral-small-latest' },
    { url: 'https://openrouter.ai/api/v1/chat/completions', key: process.env.OPENROUTER_API_KEY, model: 'google/gemma-4-26b-a4b-it:free' },
    { url: 'https://api.openai.com/v1/chat/completions', key: process.env.OPENAI_API_KEY, model: 'gpt-4o-mini' }
  ];
  
  for (const p of providers) {
    if (!p.key) continue;
    try {
      const { res } = await fetchWithTimeout(p.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${p.key}` },
        body: JSON.stringify({
          model: p.model,
          messages: [
            { role: 'system', content: 'Du gibst IMMER valides JSON zurück, ohne Markdown-Blöcke.' },
            { role: 'user', content: prompt }
          ],
          temperature,
          max_tokens: 1500
        })
      }, 8000);
      
      if (!res.ok) continue;
      const data = await res.json();
      const text = data.choices?.[0]?.message?.content || '';
      
      // JSON parsen
      const cleaned = text.replace(/```(?:json)?/g, '').replace(/```/g, '').trim();
      try { return JSON.parse(cleaned); } catch(e) { return { raw: text }; }
    } catch (e) { continue; }
  }
  return null;
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type, Authorization' } };
  }
  
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }
  
  // 20s hard limit for Netlify Free-Tier (26s max)
  const startTime = Date.now();
  const HARD_LIMIT_MS = 20000;
  
  try {
    const { companyId, opportunityId, offering, company, trigger, research } = JSON.parse(event.body);
    
    if (!companyId || !opportunityId) {
      return { statusCode: 400, body: JSON.stringify({ error: 'companyId and opportunityId required' }) };
    }
    
    console.log(`[ContactIntel] Starting for company ${companyId}, opp ${opportunityId}`);
    
    // Auth check
    const authHeader = event.headers.authorization;
    if (!authHeader) {
      return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };
    }
    
    const userSupabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });
    const { data: { user }, error: authError } = await userSupabase.auth.getUser();
    if (authError || !user) {
      return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };
    }
    
    // Prüfe ob Contact bereits existiert
    const serviceClient = createClient(supabaseUrl, supabaseKey);
    const { data: existingContacts } = await serviceClient
      .from('nexus_opportunity_contacts')
      .select('contact_id, nexus_contacts(*)')
      .eq('opportunity_id', opportunityId);
    
    if (existingContacts?.length > 0 && existingContacts[0].nexus_contacts?.first_name) {
      return { 
        statusCode: 200, 
        body: JSON.stringify({ 
          status: 'already_exists',
          contact: existingContacts[0].nexus_contacts,
          message: 'Contact already exists for this opportunity'
        }) 
      };
    }
    
    // Phase 2: Role Inference (skip if timeout approaching)
    let targetRole = 'Geschäftsführer';
    let alternativeRoles = [];
    let roleReason = '';
    let roleConfidence = 70;
    
    if (Date.now() - startTime < HARD_LIMIT_MS - 12000) {
      console.log('[ContactIntel] Phase 2: Role Inference');
      try {
        const roleResult = await inferTargetRole({ offering, company, trigger, research });
        targetRole = roleResult?.primary_role || 'Geschäftsführer';
        alternativeRoles = roleResult?.alternative_roles || [];
        roleReason = roleResult?.role_reason || '';
        roleConfidence = roleResult?.confidence || 70;
      } catch(e) {
        console.log('[ContactIntel] Role inference failed, using default:', e.message);
      }
    } else {
      console.log('[ContactIntel] Skipping role inference (timeout approaching)');
    }
    
    // Phase 3: Targeted Crawl
    if (Date.now() - startTime >= HARD_LIMIT_MS - 8000) {
      console.log('[ContactIntel] Timeout approaching, returning early');
      return {
        statusCode: 200,
        body: JSON.stringify({
          status: 'timeout',
          targetRole,
          roleReason,
          message: 'Zeitlimit erreicht - bitte Control Flow neu starten'
        })
      };
    }
    
    console.log('[ContactIntel] Phase 3: Targeted Crawl');
    const companyDomain = company?.domain || null;
    const crawlResult = await crawlForContacts(
      company?.name || 'Unbekannt', 
      companyDomain, 
      targetRole, 
      alternativeRoles
    );
    
    const candidates = crawlResult.candidates || [];
    const pagesCrawled = crawlResult.pagesCrawled || [];
    const crawlMethod = crawlResult.method || 'unknown';
    
    console.log(`[ContactIntel] Found ${candidates.length} candidates via ${crawlMethod} (${pagesCrawled.length} pages crawled)`);
    
    if (candidates.length === 0) {
      return {
        statusCode: 200,
        body: JSON.stringify({
          status: 'no_candidates',
          targetRole,
          roleReason,
          pagesCrawled,
          crawlMethod,
          message: 'Keine passenden Ansprechpartner gefunden'
        })
      };
    }
    
    // Phase 5: Contact Ranking (skip if timeout approaching)
    let ranked = candidates;
    if (Date.now() - startTime < HARD_LIMIT_MS - 5000) {
      console.log('[ContactIntel] Phase 5: Contact Ranking');
      ranked = await rankContacts(candidates, { offering, company, trigger, targetRole });
    }
    
    // Phase 6: Email Discovery (skip if timeout approaching)
    let withEmails = ranked;
    if (Date.now() - startTime < HARD_LIMIT_MS - 3000) {
      console.log('[ContactIntel] Phase 6: Email Discovery');
      withEmails = await discoverEmails(ranked.slice(0, 5), company?.name, companyDomain);
    }
    
    // Phase 7: Save
    console.log('[ContactIntel] Phase 7: Save');
    const best = withEmails[0];
    
    if (best && best.name && best.name !== 'unbekannt') {
      // Name aufteilen in first_name + last_name
      const nameParts = best.name.trim().split(/\s+/);
      const firstName = nameParts[0] || '';
      const lastName = nameParts.slice(1).join(' ') || '';
      
      // Contact in DB speichern
      const { data: savedContact, error: saveError } = await serviceClient
        .from('nexus_contacts')
        .insert({
          user_id: user.id,
          company_id: companyId,
          first_name: firstName,
          last_name: lastName,
          role: best.role || targetRole,
          email: best.email || null,
          email_confidence: best.email ? (best.email_status === 'FOUND' ? 95 : null) : null,
          email_source: best.email ? (best.email_status === 'FOUND' ? 'website' : null) : null,
          linkedin_url: null
        })
        .select()
        .single();
      
      if (!saveError && savedContact) {
        // Link to opportunity
        await serviceClient
          .from('nexus_opportunity_contacts')
          .upsert({
            opportunity_id: opportunityId,
            contact_id: savedContact.id,
            role_in_opportunity: targetRole,
            is_primary: true
          }, { onConflict: 'opportunity_id,contact_id' });
        
        best.id = savedContact.id;
        
        // Phase 8: Email Research (Pattern-Guessing) wenn keine E-Mail vorhanden
        if (!best.email && companyDomain) {
          console.log('[ContactIntel] Phase 8: Email Research (Pattern-Guessing)');
          try {
            const emailCandidates = generateEmailPatterns(best.name, companyDomain);
            if (emailCandidates.length > 0) {
              best.email = emailCandidates[0].email;
              best.email_confidence = 'guessed';
              best.email_source = 'pattern_guessing';
              
              // Update contact with guessed email
              await serviceClient
                .from('nexus_contacts')
                .update({
                  email: best.email,
                  email_confidence: emailCandidates[0].confidence,
                  email_source: 'pattern_guessing'
                })
                .eq('id', savedContact.id);
              
              console.log(`[ContactIntel] Email guessed: ${best.email}`);
            }
          } catch (e) {
            console.log('[ContactIntel] Email research failed:', e.message);
          }
        }
      }
    }
    
    return {
      statusCode: 200,
      body: JSON.stringify({
        status: 'found',
        primary: best,
        alternatives: withEmails.slice(1, 4),
        targetRole,
        roleReason,
        roleConfidence
      })
    };
    
  } catch (e) {
    console.error('[ContactIntel] Error:', e);
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};
