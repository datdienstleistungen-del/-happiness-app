/**
 * NeXus Contact Intelligence
 * 
 * Findet automatisch den passenden Ansprechpartner für eine Opportunity.
 * 
 * Pipeline: Domain Discovery → Targeted Crawl → Person Discovery → Email Discovery → Save
 * 
 * Email-Status:
 *   FOUND   = öffentlich auf Website/Quelle gefunden
 *   UNKNOWN = nicht öffentlich auffindbar
 * 
 * Kein Pattern-Guessing als echte Adresse. Kein SMTP-Probing.
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

// ============================================================================
// DOMAIN DISCOVERY + VERIFICATION
// ============================================================================

function getCompanyNameVariants(companyName) {
  const lower = companyName.toLowerCase();
  const variants = new Set([lower]);
  
  // Umlaut variants: Kärcher → kaercher, karcher
  const umlautMap = { 'ä': 'ae', 'ö': 'oe', 'ü': 'ue', 'ß': 'ss' };
  let withoutUmlauts = lower;
  for (const [umlaut, replacement] of Object.entries(umlautMap)) {
    withoutUmlauts = withoutUmlauts.replace(new RegExp(umlaut, 'g'), replacement);
  }
  variants.add(withoutUmlauts);
  variants.add(lower.replace(/[^a-z0-9]/g, ''));
  variants.add(withoutUmlauts.replace(/[^a-z0-9]/g, ''));
  
  return [...variants].filter(v => v.length >= 3);
}

async function verifyDomain(domain, companyName) {
  console.log(`[DomainVerify] Checking: ${domain} for "${companyName}"`);
  
  const companyVariants = getCompanyNameVariants(companyName);
  
  // Step 1: Check if domain is reachable (try https then http)
  let finalUrl = null;
  let pageTitle = '';
  let pageText = '';
  let httpStatus = 0;
  
  for (const scheme of ['https', 'http']) {
    try {
      const { res } = await fetchWithTimeout(`${scheme}://${domain}`, {
        method: 'GET',
        redirect: 'follow',
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36', 'Accept': 'text/html' }
      }, 5000);
      
      httpStatus = res.status;
      if (res.ok) {
        finalUrl = res.url;
        const html = await res.text();
        
        // Extract title
        const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
        pageTitle = titleMatch ? titleMatch[1].replace(/\s+/g, ' ').trim() : '';
        
        // Extract meta description
        const metaMatch = html.match(/<meta[^>]*name="description"[^>]*content="([^"]*)"/i);
        const metaDesc = metaMatch ? metaMatch[1].toLowerCase() : '';
        
        // Extract text for company name check
        pageText = html
          .replace(/<script[\s\S]*?<\/script>/gi, '')
          .replace(/<style[\s\S]*?<\/style>/gi, '')
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()
          .substring(0, 5000);
        
        console.log(`[DomainVerify] ${scheme}://${domain} → HTTP ${httpStatus} (final: ${finalUrl})`);
        console.log(`[DomainVerify] Title: "${pageTitle.substring(0, 80)}"`);
        break;
      }
    } catch (e) { continue; }
  }
  
  if (!finalUrl) {
    console.log(`[DomainVerify] ${domain} NOT reachable`);
    return { verified: false, confidence: 0, reason: 'not reachable', status: 'discovery' };
  }
  
  // Step 2: Check if redirected to different domain
  let redirectedToDifferentDomain = false;
  try {
    const finalHostname = new URL(finalUrl).hostname.replace(/^www\./, '');
    const checkHostname = domain.replace(/^www\./, '');
    if (finalHostname !== checkHostname && !finalHostname.endsWith('.' + checkHostname) && !checkHostname.endsWith('.' + finalHostname)) {
      redirectedToDifferentDomain = true;
      console.log(`[DomainVerify] Redirected to different domain: ${finalHostname}`);
    }
  } catch {}
  
  // Step 3: Check if company name appears on page
  const titleLower = pageTitle.toLowerCase();
  const textLower = pageText.toLowerCase();
  
  let companyMentionScore = 0;
  let companyFoundIn = [];
  
  for (const variant of companyVariants) {
    if (titleLower.includes(variant)) {
      companyMentionScore += 10;
      companyFoundIn.push(`title(${variant})`);
    }
    // Check first 1000 chars of text (header area) more heavily
    if (textLower.substring(0, 1000).includes(variant)) {
      companyMentionScore += 5;
      companyFoundIn.push(`header(${variant})`);
    }
    // Check full text
    if (textLower.includes(variant)) {
      companyMentionScore += 2;
      companyFoundIn.push(`text(${variant})`);
    }
  }
  
  // Step 4: Check for official company signals
  const officialSignals = [
    /impressum/i, /geschäftsführer/i, /management/i, /leadership/i,
    /vorstand/i, /team/i, /über uns/i, /about us/i, /unternehmen/i
  ];
  const hasOfficialSignal = officialSignals.some(p => p.test(pageText));
  
  // Step 5: Check for non-official signals (aggregator, news, etc.)
  const nonOfficialPatterns = [
    /linkedin\.com/i, /facebook\.com/i, /twitter\.com/i, /x\.com/i,
    /glassdoor/i, /indeed/i, /xing\.com/i,
    /wikipedia/i, /mondaq/i, /bloomberg/i, /reuters/i
  ];
  const isNonOfficial = nonOfficialPatterns.some(p => p.test(finalUrl));
  
  // Calculate final confidence
  let confidence = 0;
  
  // CRITICAL: If company name NOT found on page at all, cap confidence
  // A domain without ANY company mention cannot be the official company site
  if (companyMentionScore === 0) {
    console.log(`[DomainVerify] REJECTED: Company name "${companyName}" not found on page at all`);
    return {
      verified: false,
      confidence: 0,
      reason: `company name "${companyName}" not found on page`,
      status: 'discovery',
      finalUrl,
      pageTitle,
      companyMentionScore: 0,
      companyFoundIn: []
    };
  }
  
  // Company name matching (strongest signal)
  if (companyMentionScore >= 10) confidence += 40; // In title
  else if (companyMentionScore >= 5) confidence += 25; // In header
  else if (companyMentionScore >= 2) confidence += 10; // In text
  
  // Official signals
  if (hasOfficialSignal) confidence += 15;
  
  // Not a non-official source
  if (!isNonOfficial) confidence += 15;
  
  // No redirect to different domain
  if (!redirectedToDifferentDomain) confidence += 15;
  
  // HTTP status OK
  if (httpStatus === 200) confidence += 5;
  
  const verified = confidence >= 50;
  console.log(`[DomainVerify] Score: ${confidence} (${verified ? 'VERIFIED' : 'FAILED'})`);
  console.log(`[DomainVerify] Company mentions: ${companyFoundIn.join(', ') || 'none'}`);
  
  return {
    verified,
    confidence,
    reason: verified ? 'verified' : `low confidence (${confidence})`,
    status: verified ? 'verified' : 'discovery',
    finalUrl,
    pageTitle,
    companyMentionScore,
    companyFoundIn
  };
}

async function discoverDomain(companyName) {
  console.log(`[DomainDiscovery] Searching domain for: "${companyName}"`);
  
  // Try multiple query variants for better coverage
  const queries = [
    `"${companyName}" official website`,
    `"${companyName}" homepage`,
  ];
  
  const allCandidates = [];
  
  for (const query of queries) {
    const results = await webSearch(query);
    if (!results) {
      console.log(`[DomainDiscovery] No results for: ${query}`);
      continue;
    }
    
    console.log(`[DomainDiscovery] Query "${query}" → ${results.length} results`);
    
    const skipDomains = /linkedin|facebook|twitter|x\.com|instagram|youtube|glassdoor|indeed|xing|crunchbase|bloomberg|reuters|wallstreet|google|bing|yahoo|tavily|wikipedia|mondaq|sunzinet|handelsblatt|tagesschau/i;
    
    for (const r of results) {
      try {
        const urlObj = new URL(r.url);
        const hostname = urlObj.hostname.replace(/^www\./, '');
        
        if (skipDomains.test(hostname)) {
          console.log(`[DomainDiscovery] SKIP (aggregator): ${hostname}`);
          continue;
        }
        
        const parts = hostname.split('.');
        if (parts.length < 2) continue;
        const baseDomain = parts.slice(-2).join('.');
        
        if (skipDomains.test(baseDomain)) continue;
        
        // Score candidate
        const companyLower = companyName.toLowerCase().replace(/[^a-z0-9]/g, '');
        const domainLower = hostname.replace(/[^a-z0-9]/g, '');
        
        let score = 0;
        if (domainLower.includes(companyLower)) score += 10;
        if (r.title.toLowerCase().includes(companyName.toLowerCase())) score += 5;
        if (parts.length === 2) score += 2;
        
        // Check for duplicates
        if (!allCandidates.some(c => c.domain === baseDomain)) {
          allCandidates.push({ domain: baseDomain, score, url: r.url, title: r.title });
          console.log(`[DomainDiscovery] Candidate: ${baseDomain} (score ${score}) from ${r.url}`);
        }
      } catch (e) { continue; }
    }
  }
  
  if (allCandidates.length === 0) {
    console.log('[DomainDiscovery] No candidates found');
    return null;
  }
  
  // Sort by score
  allCandidates.sort((a, b) => b.score - a.score);
  console.log(`[DomainDiscovery] ${allCandidates.length} candidates, verifying top 3...`);
  
  // Verify each candidate until one passes
  for (const c of allCandidates.slice(0, 3)) {
    console.log(`[DomainDiscovery] Verifying: ${c.domain}`);
    const verification = await verifyDomain(c.domain, companyName);
    
    if (verification.verified) {
      console.log(`[DomainDiscovery] VERIFIED: ${c.domain} (confidence ${verification.confidence})`);
      return {
        domain: c.domain,
        confidence: verification.confidence,
        status: 'verified',
        source: verification.finalUrl,
        pageTitle: verification.pageTitle
      };
    } else {
      console.log(`[DomainDiscovery] NOT verified: ${c.domain} — ${verification.reason}`);
    }
  }
  
  console.log('[DomainDiscovery] No domain passed verification');
  return null;
}

// ============================================================================
// EMAIL DISCOVERY (from company website)
// ============================================================================

async function discoverEmailFromWebsite(domain, personFirstName, personLastName) {
  console.log(`[EmailDiscovery] Crawling ${domain} for emails of ${personFirstName} ${personLastName}`);
  
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  const personEmails = [];
  const allEmails = [];
  
  // Pages to check: imprint, contact, team, about
  const pagesToCheck = [
    `https://${domain}/impressum`,
    `https://${domain}/kontakt`,
    `https://${domain}/contact`,
    `https://${domain}/team`,
    `https://${domain}/ueber-uns`,
    `https://${domain}/about`,
    `https://${domain}/management`,
  ];
  
  // Also try homepage
  pagesToCheck.unshift(`https://${domain}`);
  
  for (const url of pagesToCheck) {
    if (personEmails.length > 0) break; // Found enough
    
    try {
      const text = await fetchPageText(url, 5000);
      if (!text || text.length < 100) continue;
      
      // Extract ALL emails from page
      const emails = text.match(emailRegex) || [];
      
      // Filter: must look like a real business email (not image/noise)
      const validEmails = emails.filter(e => {
        const lower = e.toLowerCase();
        // Skip image placeholders, test addresses
        if (/\.(png|jpg|gif|svg|webp|jpeg)/i.test(lower)) return false;
        if (/test@|example@|email@|mail@|noreply|no-reply|donotreply/i.test(lower)) return false;
        if (lower.length > 50) return false;
        return true;
      });
      
      // Check if any email matches the person
      for (const email of validEmails) {
        const emailLower = email.toLowerCase();
        const firstNameLower = personFirstName.toLowerCase().replace(/[^a-z]/g, '');
        const lastNameLower = personLastName.toLowerCase().replace(/[^a-z]/g, '');
        
        // Direct match: first.last@, firstlast@, f.last@, first.l@, etc.
        if (emailLower.includes(firstNameLower) && emailLower.includes(lastNameLower)) {
          personEmails.push({ email, source: url, confidence: 95 });
          console.log(`[EmailDiscovery] MATCH: ${email} on ${url}`);
          break;
        }
        
        allEmails.push({ email, source: url });
      }
    } catch (e) { continue; }
  }
  
  // If person-specific email found, return it
  if (personEmails.length > 0) {
    return { email: personEmails[0].email, status: 'FOUND', source: personEmails[0].source, confidence: personEmails[0].confidence };
  }
  
  // If we found ANY business email on the site, that confirms the domain has email infrastructure
  // but we still can't construct the person's email
  if (allEmails.length > 0) {
    console.log(`[EmailDiscovery] Found ${allEmails.length} emails on site, none matching person`);
  }
  
  return { email: null, status: 'UNKNOWN', source: null, confidence: null };
}

// ============================================================================
// WEB SEARCH (Tavily → DuckDuckGo → SearXNG)
// ============================================================================

async function fetchWithTimeout(url, options = {}, timeoutMs = 5000) {
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

async function searchTavily(query) {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) return null;
  try {
    const { res } = await fetchWithTimeout('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: apiKey,
        query,
        max_results: 5,
        search_depth: 'basic'
      })
    }, 5000);
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.results?.length) return null;
    return data.results.map(r => ({
      url: r.url,
      title: r.title || '',
      snippet: r.content || ''
    }));
  } catch (e) {
    console.log('[Search] Tavily failed:', e.message);
    return null;
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
    
    const linkRegex = /<a[^>]+class="result__a"[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;
    let match;
    
    while ((match = linkRegex.exec(html)) !== null && results.length < 5) {
      const href = match[1];
      const title = match[2].replace(/<[^>]*>/g, '').trim();
      
      let url = null;
      if (href.includes('uddg=')) {
        const uddgMatch = href.match(/uddg=([^&]*)/);
        if (uddgMatch) {
          url = decodeURIComponent(uddgMatch[1]);
        }
      } else if (href.startsWith('http')) {
        url = href;
      }
      
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
  // Tavily first (most reliable from cloud servers)
  const tavily = await searchTavily(query);
  if (tavily?.length > 0) return tavily;
  
  const ddg = await searchDuckDuckGo(query);
  if (ddg?.length > 0) return ddg;
  
  return await searchSearXNG(query);
}

// ============================================================================
// HTML PAGE FETCHING & PARSING
// ============================================================================

async function fetchPageText(url, maxChars = 3000) {
  try {
    const { res } = await fetchWithTimeout(url, {
      headers: { 
        'User-Agent': 'Mozilla/5.0 (compatible; NeXusBot/1.0)',
        'Accept': 'text/html,application/xhtml+xml'
      },
    }, 2000);
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

// ============================================================================
// SEMANTIC WEBSITE NAVIGATION
// ============================================================================

// HIGH VALUE: Person/Führung — Anker-Text mit diesen Keywords → sehr wahrscheinlich Entscheider-Seite
// WICHTIG: \b (Word Boundary) verhindert False Positives wie "s team" in "steam"
const PERSON_KEYWORDS_HIGH = [
  /\bgeschäftsführer\b/i, /\bvorstand\b/i, /\bmanagement\b/i, /\bleadership\b/i, /\bexecutive\b/i,
  /\bteam\b/i, /\bmitarbeiter\b/i, /\bansprechpartner\b/i, /\bkontakt\b/i,
  /\bfounder\b/i, /\bowner\b/i, /\bpartner\b/i,
  /\bceo\b/i, /\bcto\b/i, /\bcfo\b/i, /\bcoo\b/i, /\bcmo\b/i,
  /\bdirektor\b/i, /\bhead\b/i, /\bleiter\b/i, /\bchef\b/i, /\bpresident\b/i, /\bvp\b/i, /\bvice\b/i,
  /\bperson\b/i, /\bpeople\b/i, /\bstaff\b/i,
  // Role signals in anchor: "Vertrieb", "Sales", etc. indicate the person page of a role
  /\bsales\b/i, /\bvertrieb\b/i, /\bmarketing\b/i, /\bfinance\b/i, /\beinkauf\b/i, /\bprocurement\b/i,
  /\bpersonal\b/i, /\bhr\b/i, /\bentwicklung\b/i, /\btechnik\b/i, /\bit\b/i,
];

// MEDIUM VALUE: Unternehmen/Über-uns — kann Leadership-Infos enthalten
const COMPANY_KEYWORDS = [
  /\büber uns\b/i, /\babout\b/i, /\bunternehmen\b/i, /\bprofil\b/i, /\bfirma\b/i,
  /\bgeschichte\b/i, /\bhistory\b/i, /\bwerte\b/i, /\bvalues\b/i, /\bmission\b/i,
  /\bimpressum\b/i, // Enthält oft Geschäftsführer
];

// LOW VALUE: Produkt, Blog, News — selten Personen-Infos
const LOW_VALUE_KEYWORDS = [
  /\bblog\b/i, /\bnews\b/i, /\bpresse\b/i, /\bpress\b/i, /\bdownload\b/i, /\bmediathek\b/i,
  /\bfaq\b/i, /\bhilfe\b/i, /\bhelp\b/i, /\blogin\b/i, /\bregister\b/i, /\banmelden\b/i,
  /\bdatenschutz\b/i, /\bprivacy\b/i, /\bagb\b/i, /\bterms\b/i,
  /\bcookie\b/i, /\bsitemap\b/i, /\brss\b/i, /\bkarriere\b/i, /\bjobs\b/i, /\bstellenangebote\b/i,
  /\bprodukt\b/i, /\bproduct\b/i, /\blösung\b/i, /\bsolution\b/i, /\bpreis\b/i, /\bprice\b/i,
  /\bwarenkorb\b/i, /\bcart\b/i, /\bbestellung\b/i, /\border\b/i,
  /\breferenz\b/i, /\bcase\b/i, /\bportfolio\b/i, /\bprojekt\b/i,
];

function scoreLinkBySemantics(url, anchorText, companyName) {
  const urlLower = url.toLowerCase();
  const anchorLower = (anchorText || '').toLowerCase();
  const companyLower = companyName.toLowerCase().replace(/[^a-z0-9]/g, '');
  const domainFromUrl = (() => { try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return ''; } })();
  const domainLower = domainFromUrl.replace(/[^a-z0-9]/g, '');
  
  let score = 0;
  
  // Step 1: Check for LOW VALUE → immediate rejection for most pages
  if (LOW_VALUE_KEYWORDS.some(p => p.test(urlLower))) return -10;
  if (LOW_VALUE_KEYWORDS.some(p => p.test(anchorLower))) return -10;
  
  // Step 2: HIGH VALUE PERSON/LEADERSHIP keywords — strongest signal
  // Anchor text with leadership keywords = very likely to be a person/management page
  const personHitsAnchor = PERSON_KEYWORDS_HIGH.filter(p => p.test(anchorLower)).length;
  const personHitsUrl = PERSON_KEYWORDS_HIGH.filter(p => p.test(urlLower)).length;
  
  if (personHitsAnchor >= 2) score += 15; // "Geschäftsführer Team" = very strong
  else if (personHitsAnchor === 1) score += 10; // "Management" = strong
  
  if (personHitsUrl >= 2) score += 8;
  else if (personHitsUrl === 1) score += 5;
  
  // Step 3: MEDIUM VALUE COMPANY/ABOUT keywords
  const companyHitsAnchor = COMPANY_KEYWORDS.filter(p => p.test(anchorLower)).length;
  const companyHitsUrl = COMPANY_KEYWORDS.filter(p => p.test(urlLower)).length;
  
  if (companyHitsAnchor >= 1) score += 6; // "Über uns" = medium
  if (companyHitsUrl >= 1) score += 4;
  
  // Step 4: URL structure bonuses
  try {
    const path = new URL(url).pathname;
    const pathDepth = path.split('/').filter(p => p).length;
    // Short paths are more likely main navigation pages
    if (pathDepth <= 1) score += 3; // "/" or "/team" = very likely important
    else if (pathDepth <= 2) score += 1;
  } catch {}
  
  // Step 5: Anchor text quality
  if (anchorLower.length > 2 && anchorLower.length < 30) score += 1;
  
  // Step 6: Internal link bonus
  if (domainLower === companyLower || domainLower.endsWith('.' + companyLower)) {
    score += 2;
  }
  
  // Step 7: Company name in anchor (rare but very strong signal)
  if (anchorLower.includes(companyLower)) score += 5;
  
  return score;
}

function extractLinksWithAnchorText(html, baseUrl) {
  const links = [];
  const urlObj = new URL(baseUrl);
  const domain = urlObj.hostname;
  
  // Match both href and anchor text
  const linkRegex = /<a[^>]+href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;
  let match;
  while ((match = linkRegex.exec(html)) !== null) {
    let href = match[1];
    const anchorHtml = match[2];
    
    // Clean anchor text (strip HTML tags)
    const anchorText = anchorHtml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    
    // Skip empty anchor text
    if (!anchorText || anchorText.length < 2) continue;
    
    // Resolve relative URLs
    if (href.startsWith('/')) {
      href = baseUrl + href;
    } else if (!href.startsWith('http')) {
      continue;
    }
    
    // Only keep internal links
    try {
      const linkUrl = new URL(href);
      if (linkUrl.hostname.includes(domain.replace('www.', ''))) {
        const clean = linkUrl.origin + linkUrl.pathname.replace(/\/$/, '');
        links.push({ url: clean, anchorText });
      }
    } catch (e) { /* skip invalid URLs */ }
  }
  
  // Deduplicate by URL, keep best anchor text
  const seen = new Map();
  for (const l of links) {
    if (!seen.has(l.url) || l.anchorText.length > seen.get(l.url).anchorText.length) {
      seen.set(l.url, l);
    }
  }
  
  return [...seen.values()];
}

async function crawlForContacts(companyName, companyDomain, targetRole, alternativeRoles, startTime) {
  const allCandidates = [];
  const pagesCrawled = [];
  
  if (!companyDomain) {
    console.log('[Crawler] No domain provided, using search fallback');
    const searchCandidates = await crawlViaSearch(companyName, targetRole);
    return {
      candidates: searchCandidates,
      pagesCrawled: [],
      method: 'search_fallback'
    };
  }
  
  // ========== PHASE A: Semantic Website Navigation ==========
  console.log(`[Crawler] Phase A: Semantic crawl of ${companyDomain}`);
  
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
  
  // Extract all internal links with anchor text
  const linksWithAnchor = extractLinksWithAnchorText(homepageHtml, baseUrl);
  console.log(`[Crawler] Found ${linksWithAnchor.length} internal links`);
  
  // Score each link by semantic relevance
  const scoredLinks = linksWithAnchor
    .map(l => ({
      ...l,
      score: scoreLinkBySemantics(l.url, l.anchorText, companyName)
    }))
    .filter(l => l.score > 0)
    .sort((a, b) => b.score - a.score);
  
  console.log(`[Crawler] Top semantic links:`);
  scoredLinks.slice(0, 5).forEach(l => {
    const path = new URL(l.url).pathname || '/';
    console.log(`  [${l.score}] ${l.anchorText.substring(0, 40)} → ${path}`);
  });
  
  // Crawl top 3 most relevant pages (PARALLEL)
  const pagesToCrawl = scoredLinks.slice(0, 3).map(l => l.url);
  
  // Always include homepage as fallback
  if (!pagesToCrawl.includes(baseUrl)) {
    pagesToCrawl.push(baseUrl);
  }
  
  const crawlPromises = pagesToCrawl.map(async (url) => {
    if (startTime && Date.now() - startTime > 18000) {
      console.log(`[Crawler] Timeout approaching, skipping: ${url}`);
      return { url, persons: [] };
    }
    console.log(`[Crawler] Crawling: ${url}`);
    const text = await fetchPageText(url, 3000);
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
  
  // ========== PHASE B: Search Fallback ==========
  if (allCandidates.length === 0) {
    console.log('[Crawler] Phase B: Search fallback (no candidates from direct crawl)');
    const fallbackCandidates = await crawlViaSearch(companyName, targetRole);
    allCandidates.push(...fallbackCandidates);
  }
  
  console.log(`[Crawler] Total: ${allCandidates.length} validated candidates`);
  
  return {
    candidates: allCandidates,
    pagesCrawled,
    method: pagesCrawled.length > 0 ? 'semantic_crawl' : 'search_fallback'
  };
}

function isJobUrl(url) {
  const u = url.toLowerCase();
  return /jobs?\.(linkedin|indeed|xing|glassdoor)/i.test(u) ||
    /\/jobs?\//i.test(u) ||
    /\/stellenangebote/i.test(u) ||
    /\/karriere/i.test(u) ||
    /\/bewerbung/i.test(u);
}

async function crawlViaSearch(companyName, targetRole) {
  const candidates = [];
  
  const query = `"${companyName}" ${targetRole} site`;
  console.log(`  [Search] Query: ${query}`);
  const results = await webSearch(query);
  if (!results || results.length === 0) {
    console.log('  [Search] No results from webSearch');
    return candidates;
  }
  console.log(`  [Search] Got ${results.length} results`);
  
  // Take only first 3 non-job URLs, fetch in PARALLEL
  const urls = results.filter(r => !isJobUrl(r.url)).slice(0, 3);
  console.log(`  [Search] ${urls.length} URLs after job-filter`);
  
  const pagePromises = urls.map(async (r) => {
    console.log(`  [Search] Fetching: ${r.url}`);
    const text = await fetchPageText(r.url, 3000);
    if (!text || text.length < 200) {
      console.log(`  [Search] Skipped ${r.url} (text=${text?.length || 0})`);
      return [];
    }
    console.log(`  [Search] Extracting persons from ${r.url} (${text.length} chars)`);
    const persons = await extractPersonsViaLLM(text, companyName, targetRole, r.url);
    return persons.map(p => {
      p.source_url = r.url;
      const urlLower = r.url.toLowerCase();
      const nameWords = companyName.toLowerCase().replace(/[^a-z0-9]/g, '');
      p.company_validated = urlLower.includes(nameWords) || urlLower.includes(companyName.toLowerCase().replace(/\s+/g, ''));
      console.log(`  [Search] Found: ${p.name} (${p.role}) validated=${p.company_validated}`);
      return p;
    });
  });
  
  const results2 = await Promise.all(pagePromises);
  for (const persons of results2) {
    candidates.push(...persons);
    if (candidates.length >= 3) break;
  }
  
  console.log(`  [Search] Final candidates: ${candidates.length}`);
  return candidates;
}

async function fetchRawHtml(url) {
  try {
    const { res } = await fetchWithTimeout(url, {
      headers: { 
        'User-Agent': 'Mozilla/5.0 (compatible; NeXusBot/1.0)',
        'Accept': 'text/html,application/xhtml+xml'
      },
    }, 3000);
    if (!res.ok) return '';
    return await res.text();
  } catch (e) {
    return '';
  }
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
${cleanText.substring(0, 2000)}

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

// Email patterns removed — only FOUND/UNKNOWN, no guessing

// ============================================================================
// LLM CALL
// ============================================================================

async function callLLM(prompt, temperature = 0.3) {
  const providers = [
    { url: 'https://api.deepseek.com/chat/completions', key: process.env.DEEPSEEK_API_KEY, model: 'deepseek-v4-flash' },
    { url: 'https://api.mistral.ai/v1/chat/completions', key: process.env.MISTRAL_API_KEY, model: 'mistral-small-latest' }
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
      }, 5000);
      
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
    
    // Phase 2: Role — simple heuristic, NO LLM call (saves 5-8s)
    let targetRole = 'Geschäftsführer';
    const companyName = company?.name || '';
    const offeringName = offering?.offering_name || '';
    const targetAudience = offering?.target_audience || '';
    // Simple heuristic: if target_audience mentions specific roles, use them
    if (targetAudience.toLowerCase().includes('einkauf') || targetAudience.toLowerCase().includes('procurement')) {
      targetRole = 'Einkaufsleiter';
    } else if (targetAudience.toLowerCase().includes('marketing')) {
      targetRole = 'Marketing Director';
    } else if (targetAudience.toLowerCase().includes('it') || targetAudience.toLowerCase().includes('technik')) {
      targetRole = 'IT-Leiter';
    } else if (targetAudience.toLowerCase().includes('hr') || targetAudience.toLowerCase().includes('personal')) {
      targetRole = 'Personalleitung';
    }
    console.log(`[ContactIntel] Target role (heuristic): ${targetRole}`);
    
    // Phase 3: Targeted Crawl — max 1 page, fast
    if (Date.now() - startTime >= HARD_LIMIT_MS - 8000) {
      console.log('[ContactIntel] Timeout approaching, returning early');
      return {
        statusCode: 200,
        body: JSON.stringify({
          status: 'timeout',
          targetRole,
          message: 'Zeitlimit erreicht - bitte erneut versuchen'
        })
      };
    }
    
    console.log('[ContactIntel] Phase 3: Targeted Crawl');
    let companyDomain = company?.domain || null;
    let domainStatus = company?.domain_status || null;
    
    // Phase 2.5: Domain Discovery — if no domain, try to find it
    if (!companyDomain) {
      console.log('[ContactIntel] Phase 2.5: Domain Discovery + Verification');
      try {
        const discovery = await discoverDomain(company?.name || 'Unbekannt');
        if (discovery && discovery.domain) {
          companyDomain = discovery.domain;
          domainStatus = discovery.status || 'verified';
          // Save verified domain back to company
          await serviceClient
            .from('nexus_companies')
            .update({ 
              domain: discovery.domain,
              domain_status: domainStatus 
            })
            .eq('id', companyId);
          console.log(`[ContactIntel] Domain verified and saved: ${discovery.domain} (confidence: ${discovery.confidence}, status: ${domainStatus})`);
        }
      } catch (e) {
        console.log('[ContactIntel] Domain discovery failed:', e.message);
      }
    } else if (!domainStatus || domainStatus === 'discovery') {
      // Domain exists but from pre-verification era or still discovery → re-verify
      console.log(`[ContactIntel] Re-verifying existing domain: ${companyDomain} (status: ${domainStatus || 'unknown'})`);
      try {
        const verification = await verifyDomain(companyDomain, company?.name || '');
        if (verification.verified) {
          domainStatus = 'verified';
          await serviceClient
            .from('nexus_companies')
            .update({ domain_status: 'verified' })
            .eq('id', companyId);
          console.log(`[ContactIntel] Existing domain verified: ${companyDomain} (confidence: ${verification.confidence})`);
        } else {
          // Domain failed verification → clear it, try discovery
          console.log(`[ContactIntel] Existing domain FAILED verification (${verification.reason}), clearing and re-discovering`);
          companyDomain = null;
          domainStatus = null;
          await serviceClient
            .from('nexus_companies')
            .update({ domain: null, domain_status: null })
            .eq('id', companyId);
          // Re-run discovery
          try {
            const discovery = await discoverDomain(company?.name || 'Unbekannt');
            if (discovery && discovery.domain) {
              companyDomain = discovery.domain;
              domainStatus = discovery.status || 'verified';
              await serviceClient
                .from('nexus_companies')
                .update({ domain: discovery.domain, domain_status: domainStatus })
                .eq('id', companyId);
              console.log(`[ContactIntel] New domain found: ${discovery.domain}`);
            }
          } catch (e2) {
            console.log('[ContactIntel] Re-discovery failed:', e2.message);
          }
        }
      } catch (e) {
        console.log('[ContactIntel] Re-verification failed:', e.message);
      }
    }
    const crawlResult = await crawlForContacts(
      company?.name || 'Unbekannt', 
      companyDomain, 
      targetRole, 
      [],
      startTime
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
          pagesCrawled,
          crawlMethod,
          message: 'Keine passenden Ansprechpartner gefunden'
        })
      };
    }
    
    // Skip ranking LLM — just use first candidate (saves 5-8s)
    const best = candidates[0];
    console.log(`[ContactIntel] Best candidate: ${best.name} (${best.role})`);
    
    // Skip email web search — use pattern guessing only (saves 3-5s)
    
    // Phase 7: Save
    console.log('[ContactIntel] Phase 7: Save');
    
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
          status: 'new',
          email: best.email || null,
          email_confidence: best.email ? (best.email_status === 'FOUND' ? 95 : null) : null,
          email_source: best.email ? (best.email_status === 'FOUND' ? 'website' : null) : null,
          linkedin_url: null
        })
        .select()
        .single();
      
      if (!saveError && savedContact) {
        // Link to opportunity
        const { error: linkError } = await serviceClient
          .from('nexus_opportunity_contacts')
          .upsert({
            opportunity_id: opportunityId,
            contact_id: savedContact.id,
            role_in_opportunity: targetRole,
            is_primary: true
          }, { onConflict: 'opportunity_id,contact_id' });
        
        if (linkError) console.error('[ContactIntel] Link error:', linkError.message);
        
        best.id = savedContact.id;
        
        // Phase 8: Email Discovery — crawl company website for public emails
        if (!best.email && companyDomain) {
          console.log('[ContactIntel] Phase 8: Email Discovery');
          try {
            const emailResult = await discoverEmailFromWebsite(companyDomain, firstName, lastName);
            if (emailResult.email && emailResult.status === 'FOUND') {
              best.email = emailResult.email;
              best.email_status = 'FOUND';
              best.email_source = 'website';
              
              // Update contact with found email
              await serviceClient
                .from('nexus_contacts')
                .update({
                  email: emailResult.email,
                  email_confidence: emailResult.confidence,
                  email_source: 'website',
                  email_verified_at: new Date().toISOString()
                })
                .eq('id', savedContact.id);
              
              console.log(`[ContactIntel] Email found: ${emailResult.email} (source: ${emailResult.source})`);
            } else {
              console.log('[ContactIntel] No public email found for this person');
            }
          } catch (e) {
            console.log('[ContactIntel] Email discovery failed:', e.message);
          }
        }
      }
    }
    
    return {
      statusCode: 200,
      body: JSON.stringify({
        status: 'found',
        primary: best,
        alternatives: candidates.slice(1, 4),
        targetRole,
        roleReason: '',
        roleConfidence: 70
      })
    };
    
  } catch (e) {
    console.error('[ContactIntel] Error:', e);
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};
