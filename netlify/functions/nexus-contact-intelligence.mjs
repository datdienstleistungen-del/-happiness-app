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
  
  // Strip legal entity suffixes: GmbH, AG, SE, KG, etc.
  const stripped = lower
    .replace(/\b(gmbh|ag|se|kg|ohg|ug|gbr|partg|llc|inc|corp|ltd|sas|sarl|bv|ab|oy|as)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (stripped.length >= 3 && stripped !== lower) {
    variants.add(stripped);
    variants.add(stripped.replace(/[^a-z0-9]/g, ''));
    // Also umlaut variants of stripped
    let strippedUmlauts = stripped;
    for (const [umlaut, replacement] of Object.entries(umlautMap)) {
      strippedUmlauts = strippedUmlauts.replace(new RegExp(umlaut, 'g'), replacement);
    }
    variants.add(strippedUmlauts);
    variants.add(strippedUmlauts.replace(/[^a-z0-9]/g, ''));
  }
  
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

async function inferTargetContactRole(context) {
  const { offering, company, opportunity, trigger, research } = context;
  
  const companySize = company?.size || company?.employees || 'Unbekannt';
  const sizeNum = parseInt(String(companySize).replace(/[^0-9]/g, ''), 10) || 0;
  const triggerContent = trigger?.content || trigger?.description || 'Kein Trigger';
  const offeringDesc = offering?.offering_name || offering?.description || 'Unbekannt';
  const positioning = offering?.positioning || '';
  const targetAudience = offering?.target_audience || '';
  const researchSummary = research?.summary || 'Kein Research vorhanden';
  
  const prompt = `Du bist ein B2B-Vertriebsexperte. Bestimme die KONKRETE Zielrolle für den richtigen Ansprechpartner.

=== KERNFRAGE ===
"Welche FUNKTION in diesem Unternehmen ist aufgrund dieses konkreten Geschäftsanlasses wahrscheinlich für dieses Angebot ZUSTÄNDIG?"

NICHT: "Wer ist die wichtigste Person der Firma?"
NICHT: "Wer ist der Geschäftsführer?"

=== KONTEXT ===
Angebot: ${offeringDesc}
Positionierung: ${positioning}
Zielgruppe des Angebots: ${targetAudience}
Firma: ${company?.name || 'Unbekannt'}
Branche: ${company?.industry || 'Unbekannt'}
Unternehmensgröße: ${companySize} Mitarbeiter (geschätzt: ${sizeNum > 0 ? sizeNum : 'unbekannt'})
Trigger / Anlass: ${triggerContent}
Research: ${researchSummary}

=== STRIKTE REGELN ===

REGEL 1 — ABGELEITET AUS GESCHÄFTSANLASS:
Die Zielrolle MUSS aus Offering + Trigger + Company Size abgeleitet werden.
KEIN statisches Mapping wie SaaS→CEO, Industrie→Facility Manager, Marketing→CMO.

REGEL 2 — COMPANY SIZE ENTSCHEIDEND:
- Kleine Unternehmen (< 30 MA): Geschäftsführer/Founder KANN primär sein, wenn er wahrscheinlich direkt für das Thema zuständig ist (z.B. GF verkauft selbst bei 12 MA).
- Mittlere Unternehmen (30-200 MA): Meist spezialisierte Rolle (Head of Sales, Head of HR etc.)
- Große Unternehmen (> 200 MA): IMMER spezialisierte Rolle. CEO ist NICHT primär.

REGEL 3 — TRIGGER BESTIMMT ROLLE:
- "Unternehmen baut Vertriebsteam" → Head of Sales, Sales Director, VP Sales
- "Unternehmen sucht HR-Kräfte" → Head of HR, HR Director, Talent Acquisition
- "Unternehmen baut neue Halle" → Head of Procurement, Project Manager, Plant Manager
- "Unternehmen braucht Marketing" → Head of Marketing, CMO, Marketing Director
- "Kleines Startup (12 MA) braucht Vertrieb" → Geschäftsführer, Founder (direkt zuständig)

REGEL 4 — CEO/FOUNDER:
CEO/Founder ist NUR dann primäre Zielrolle wenn:
- Company Size < 30 MA UND
- Der GF nachweislich selbst für die Funktion verantwortlich ist (z.B. GF führt Vertrieb bei 12 MA)
Sonst: CEO in excluded_as_primary.

REGEL 5 — SPEZIFISCH:
Die Rolle MUSS so spezifisch sein, dass man gezielt danach suchen kann.
"Management" ist zu vage. "Head of Sales" ist gut.

REGEL 6 — MEHRERE TITEL:
Liste 6-10 konkrete Titel der Zielrolle auf, sortiert nach Wahrscheinlichkeit.
Berücksichtige internationale Titel (DE + EN).

=== ERWARTETES JSON ===
{
  "primary_function": "Sales / HR / Procurement / Marketing / etc.",
  "primary_role_titles": ["Head of Sales", "Sales Director", "VP Sales", "Vertriebsleiter", "Director Sales", "Head of Revenue", "Sales Manager", "Leiter Vertrieb"],
  "secondary_functions": ["HR", "Recruiting"],
  "secondary_role_titles": ["Head of HR", "HR Director", "Talent Acquisition", "Recruiting Manager"],
  "reason": "2-3 Sätze warum genau diese Funktion zum Geschäftsanlass passt",
  "excluded_as_primary": ["CEO", "CFO", "CTO", "Geschäftsführer"],
  "confidence": 85
}

WICHTIG: Die excluded_as_primary Liste MUSS Rollen enthalten, die für diesen konkreten Geschäftsanlass NICHT primär relevant sind.
Bei großem Unternehmen (>100 MA) mit spezialisierter Sales/HR-Funktion: CEO MUSS in excluded_as_primary stehen.`;

  return await callLLM(prompt, 0.3);
}

// ============================================================================
// PHASE 3: TARGETED CRAWLER — Direct Domain First
// ============================================================================

// ============================================================================
// DEEP SEMANTIC CRAWL v4 — Category Classification
// ============================================================================

// LEADERSHIP: Direkte Personen-/Führungs-Seiten — Diese Seiten sind Endziel
const LEADERSHIP_KEYWORDS = [
  /\bmanagement\b/i, /\bleadership\b/i, /\bexecutive\b/i, /\bboard\b/i,
  /\bvorstand\b/i, /\bgeschäftsführung\b/i, /\bgeschäftsführer\b/i,
  /\bunternehmensleitung\b/i, /\bfirmenleitung\b/i,
  /\bceo\b/i, /\bcto\b/i, /\bcfo\b/i, /\bcoo\b/i, /\bcmo\b/i,
  /\bfounder\b/i, /\bowner\b/i, /\bpartner\b/i,
  /\bhead\b/i, /\bvp\b/i, /\bvice\b/i, /\bchief\b/i, /\bpresident\b/i,
  /\bmanagement board\b/i, /\bexecutive board\b/i, /\bexecutive team\b/i,
  /\bour people\b/i, /\bunser team\b/i, /\bunsere menschen\b/i,
  /\bmitarbeiter\b/i, /\bteam\b/i, /\bpeople\b/i, /\bstaff\b/i,
];

// CORPORATE HUB: Übersichts-Seiten — Einstiegspunkte, NICHT Endziel
const CORP_HUB_KEYWORDS = [
  /\bunternehmen\b/i, /\bcompany\b/i, /\babout\b/i, /\bcorporate\b/i,
  /\büber uns\b/i, /\babout us\b/i, /\büber mich\b/i,
  /\profil\b/i, /\bfirma\b/i, /\bgeschichte\b/i, /\bhistory\b/i,
  /\bwerte\b/i, /\bvalues\b/i, /\bmission\b/i, /\bvision\b/i,
  /\bimpressum\b/i, /\blegal\b/i,
];

// PERSON SEARCH: Person-bezogene Keywords in Link-Text (für Hub-Suche)
const PERSON_SEARCH_KEYWORDS = [
  /\bgeschäftsführer\b/i, /\bvorstand\b/i, /\bmanagement\b/i, /\bleadership\b/i,
  /\bteam\b/i, /\bmitarbeiter\b/i, /\bansprechpartner\b/i, /\bkontakt\b/i,
  /\bfounder\b/i, /\bowner\b/i, /\bpartner\b/i,
  /\bceo\b/i, /\bcto\b/i, /\bcfo\b/i, /\bcoo\b/i, /\bcmo\b/i,
  /\bdirektor\b/i, /\bhead\b/i, /\bleiter\b/i, /\bchef\b/i,
  /\bpresident\b/i, /\bvp\b/i, /\bvice\b/i, /\bchief\b/i,
  /\bperson\b/i, /\bpeople\b/i, /\bstaff\b/i,
  /\bsales\b/i, /\bvertrieb\b/i, /\bmarketing\b/i, /\bfinance\b/i,
  /\beinkauf\b/i, /\bprocurement\b/i, /\bpersonal\b/i, /\bhr\b/i,
  /\bentwicklung\b/i, /\btechnik\b/i, /\bit\b/i,
];

function categorizeLinkSemantic(url, anchorText) {
  const urlLower = url.toLowerCase();
  const anchorLower = (anchorText || '').toLowerCase();
  
  // Exclude news/press articles from leadership category
  const isNewsArticle = /\/media-information\/|\/news\//i.test(urlLower) ||
    /\bhat veröffentlicht\b/i.test(anchorLower) ||
    /\bhas published\b/i.test(anchorLower) ||
    /\bregistered a revenue\b/i.test(anchorLower) ||
    /\bim jahr \d{4}\b/i.test(anchorLower) ||
    /\bin \d{4},?\s/i.test(anchorLower) ||
    /\bstellt .+ vor\b/i.test(anchorLower) ||
    /\bpublished its\b/i.test(anchorLower);
  
  const isLeadership = !isNewsArticle && (
    LEADERSHIP_KEYWORDS.some(p => p.test(anchorLower)) || LEADERSHIP_KEYWORDS.some(p => p.test(urlLower))
  );
  const isCorpHub = CORP_HUB_KEYWORDS.some(p => p.test(anchorLower)) || CORP_HUB_KEYWORDS.some(p => p.test(urlLower));
  
  if (isLeadership) return 'leadership';
  if (isCorpHub) return 'corp_hub';
  return 'other';
}

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

function scoreLinkBySemantics(url, anchorText, companyName, parentContext = null, targetRoleTitles = []) {
  const urlLower = url.toLowerCase();
  const anchorLower = (anchorText || '').toLowerCase();
  const companyLower = companyName.toLowerCase().replace(/[^a-z0-9]/g, '');
  const domainFromUrl = (() => { try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return ''; } })();
  const domainLower = domainFromUrl.replace(/[^a-z0-9]/g, '');
  
  let score = 0;
  
  // Step 1: Check for LOW VALUE → immediate rejection
  if (LOW_VALUE_KEYWORDS.some(p => p.test(urlLower))) return -10;
  if (LOW_VALUE_KEYWORDS.some(p => p.test(anchorLower))) return -10;
  
  // Step 1.5: TARGET ROLE MATCH — highest priority signal
  if (targetRoleTitles.length > 0) {
    const roleMatchAnchor = targetRoleTitles.filter(t => anchorLower.includes(t.toLowerCase())).length;
    const roleMatchUrl = targetRoleTitles.filter(t => urlLower.includes(t.toLowerCase())).length;
    if (roleMatchAnchor >= 1) {
      score += 30;
      console.log(`  [Score] +30 target-role-match-in-anchor: "${anchorText}"`);
    }
    if (roleMatchUrl >= 1) {
      score += 15;
      console.log(`  [Score] +15 target-role-match-in-url`);
    }
  }
  
  // Step 2: LEADERSHIP keywords — strongest signal (Endziel)
  const leadershipHitsAnchor = LEADERSHIP_KEYWORDS.filter(p => p.test(anchorLower)).length;
  const leadershipHitsUrl = LEADERSHIP_KEYWORDS.filter(p => p.test(urlLower)).length;
  if (leadershipHitsAnchor >= 2) score += 20;
  else if (leadershipHitsAnchor === 1) score += 15;
  if (leadershipHitsUrl >= 2) score += 10;
  else if (leadershipHitsUrl === 1) score += 7;
  
  // Step 3: CORPORATE HUB keywords — medium signal (Einstiegspunkt)
  const hubHitsAnchor = CORP_HUB_KEYWORDS.filter(p => p.test(anchorLower)).length;
  const hubHitsUrl = CORP_HUB_KEYWORDS.filter(p => p.test(urlLower)).length;
  if (hubHitsAnchor >= 1) score += 8;
  if (hubHitsUrl >= 1) score += 5;
  
  // Step 4: PERSON SEARCH keywords (for finding hubs from homepage)
  const personHits = PERSON_SEARCH_KEYWORDS.filter(p => p.test(anchorLower)).length;
  if (personHits >= 2) score += 12;
  else if (personHits === 1) score += 8;
  
  // Step 5: PARENT CONTEXT —如果 parent ist ein Corporate Hub, boost child significantly
  if (parentContext) {
    const parentCategory = parentContext.category;
    const parentTitle = (parentContext.pageTitle || '').toLowerCase();
    const parentAnchor = (parentContext.anchorText || '').toLowerCase();
    
    // If parent is a Corporate Hub, child links are more likely to contain leadership info
    if (parentCategory === 'corp_hub') {
      score += 8;
      console.log(`  [Score] +8 parent-is-corp-hub`);
    }
    
    // If parent title contains leadership keywords, even stronger boost
    if (LEADERSHIP_KEYWORDS.some(p => p.test(parentTitle))) {
      score += 5;
      console.log(`  [Score] +5 parent-title-leadership`);
    }
    
    // If parent anchor text was a person-search keyword
    if (PERSON_SEARCH_KEYWORDS.some(p => p.test(parentAnchor))) {
      score += 3;
      console.log(`  [Score] +3 parent-anchor-person`);
    }
    
    // If parent already identified as leadership category, strong boost
    if (parentCategory === 'leadership') {
      score += 12;
      console.log(`  [Score] +12 parent-is-leadership`);
    }
  }
  
  // Step 6: URL structure bonuses
  try {
    const path = new URL(url).pathname;
    const pathDepth = path.split('/').filter(p => p).length;
    if (pathDepth <= 1) score += 3;
    else if (pathDepth <= 2) score += 1;
  } catch {}
  
  // Step 7: Anchor text quality
  if (anchorLower.length > 2 && anchorLower.length < 30) score += 1;
  
  // Step 8: Internal link bonus
  if (domainLower === companyLower || domainLower.endsWith('.' + companyLower)) {
    score += 2;
  }
  
  // Step 9: Company name in anchor
  if (anchorLower.includes(companyLower)) score += 5;
  
  return score;
}

function extractLinksWithAnchorText(html, baseUrl) {
  const links = [];
  const urlObj = new URL(baseUrl);
  const domain = urlObj.hostname;
  const origin = urlObj.origin; // scheme + host only, no path
  
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
    
    // Skip anchors, javascript, mailto
    if (href.startsWith('#') || href.startsWith('javascript:') || href.startsWith('mailto:')) continue;
    
    // Resolve relative URLs — use origin (not full baseUrl) for absolute paths
    if (href.startsWith('/')) {
      href = origin + href;
    } else if (!href.startsWith('http')) {
      // Relative path like "about.html" — resolve against current page directory
      try {
        const basePath = urlObj.pathname.substring(0, urlObj.pathname.lastIndexOf('/') + 1);
        href = origin + basePath + href;
      } catch { continue; }
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
  const crawlLog = []; // For detailed reporting
  
  if (!companyDomain) {
    console.log('[Crawler] No domain provided, using search fallback');
    const searchCandidates = await crawlViaSearch(companyName, targetRole, alternativeRoles, companyDomain);
    return {
      candidates: searchCandidates,
      pagesCrawled: [],
      method: 'search_fallback',
      crawlLog: []
    };
  }
  
  // ========== PHASE A: Deep Semantic Website Navigation ==========
  console.log(`[Crawler] Phase A: Deep semantic crawl of ${companyDomain}`);
  
  const baseUrl = `https://${companyDomain}`;
  const homepageHtml = await fetchRawHtml(baseUrl);
  
  if (!homepageHtml) {
    console.log(`[Crawler] Homepage not reachable: ${baseUrl}`);
    return await crawlViaSearch(companyName, targetRole, alternativeRoles, companyDomain);
  }
  
  // ========== LEVEL 0: Homepage ==========
  console.log(`\n[Crawler] === LEVEL 0: Homepage ===`);
  
  const homepageText = homepageHtml
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ').trim();
  
  console.log(`[Crawler] Homepage loaded: ${homepageText.length} chars`);
  pagesCrawled.push(baseUrl);
  crawlLog.push({ url: baseUrl, level: 0, category: 'homepage', score: 0, parentAnchor: null, parentTitle: null });
  
  // Extract all internal links with anchor text
  const linksWithAnchor = extractLinksWithAnchorText(homepageHtml, baseUrl);
  console.log(`[Crawler] Found ${linksWithAnchor.length} internal links on homepage`);
  
  // Score each link by semantic relevance (no parent context for level 0)
  const scoredLinks = linksWithAnchor
    .map(l => {
      const category = categorizeLinkSemantic(l.url, l.anchorText);
      const score = scoreLinkBySemantics(l.url, l.anchorText, companyName, null, alternativeRoles);
      return { ...l, score, category };
    })
    .filter(l => l.score > 0)
    .sort((a, b) => b.score - a.score);
  
  console.log(`[Crawler] Scored links (top 10):`);
  scoredLinks.slice(0, 10).forEach(l => {
    const path = new URL(l.url).pathname || '/';
    console.log(`  [${l.score}] [${l.category}] ${l.anchorText.substring(0, 40)} → ${path}`);
  });
  
  // ========== LEVEL 1: Hub Pages (3-5 most relevant) ==========
  console.log(`\n[Crawler] === LEVEL 1: Hub Pages ===`);
  
  const hubLinks = scoredLinks
    .filter(l => l.category === 'corp_hub' || l.category === 'leadership')
    .slice(0, 5); // Max 5 hubs
  
  if (hubLinks.length === 0) {
    // Fallback: take top 3 any-category links
    hubLinks.push(...scoredLinks.slice(0, 3));
  }
  
  console.log(`[Crawler] Selected ${hubLinks.length} hub pages`);
  
  // Crawl hub pages sequentially (not parallel) to stay within time budget
  const childLinks = [];
  
  for (const hub of hubLinks) {
    if (startTime && Date.now() - startTime > 16000) {
      console.log(`[Crawler] Timeout approaching, skipping hub: ${hub.url}`);
      break;
    }
    
    console.log(`\n[Crawler] Crawling hub: [${hub.score}] ${hub.anchorText} → ${new URL(hub.url).pathname}`);
    
    const hubHtml = await fetchRawHtml(hub.url);
    if (!hubHtml) {
      console.log(`  (hub not reachable)`);
      continue;
    }
    
    pagesCrawled.push(hub.url);
    crawlLog.push({ 
      url: hub.url, level: 1, category: hub.category, score: hub.score,
      parentAnchor: null, parentTitle: null 
    });
    
    // Extract links from hub page
    const hubLinksInner = extractLinksWithAnchorText(hubHtml, hub.url);
    console.log(`  Found ${hubLinksInner.length} links on hub page`);
    
    // Get hub page title for parent context
    let hubTitle = '';
    try {
      const titleMatch = hubHtml.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
      hubTitle = titleMatch ? titleMatch[1].replace(/\s+/g, ' ').trim() : '';
    } catch {}
    
    // Score child links with parent context
    const parentContext = {
      category: hub.category,
      pageTitle: hubTitle,
      anchorText: hub.anchorText
    };
    
    const scoredChildren = hubLinksInner
      .map(l => {
        const category = categorizeLinkSemantic(l.url, l.anchorText);
        const score = scoreLinkBySemantics(l.url, l.anchorText, companyName, parentContext, alternativeRoles);
        return { ...l, score, category, parentUrl: hub.url, parentAnchor: hub.anchorText, parentTitle: hubTitle, parentCategory: hub.category };
      })
      .filter(l => l.score > 0 && !pagesCrawled.includes(l.url)) // Skip already-crawled
      .sort((a, b) => b.score - a.score);
    
    console.log(`  Top child links:`);
    scoredChildren.slice(0, 5).forEach(l => {
      const path = new URL(l.url).pathname || '/';
      console.log(`    [${l.score}] [${l.category}] ${l.anchorText.substring(0, 40)} → ${path} (parent: ${l.parentCategory})`);
    });
    
    // Add top children to crawl queue (max 8 total across all hubs)
    childLinks.push(...scoredChildren.slice(0, 8 - childLinks.length));
  }
  
  // ========== LEVEL 2: Child Pages (Leadership/Person Detail Pages) ==========
  console.log(`\n[Crawler] === LEVEL 2: Detail Pages (${childLinks.length} candidates) ===`);
  
  // Sort children by score, take top ones
  childLinks.sort((a, b) => b.score - a.score);
  const topChildren = childLinks.slice(0, 8);
  
  // Extract persons from each child page
  for (const child of topChildren) {
    if (startTime && Date.now() - startTime > 18000) {
      console.log(`[Crawler] Timeout approaching, skipping: ${child.url}`);
      break;
    }
    
    // Skip if already crawled
    if (pagesCrawled.includes(child.url)) continue;
    
    console.log(`\n[Crawler] Crawling child: [${child.score}] ${child.anchorText} → ${new URL(child.url).pathname}`);
    console.log(`  Parent: [${child.parentCategory}] ${child.parentAnchor}`);
    
    const childHtml = await fetchRawHtml(child.url);
    if (!childHtml) {
      console.log(`  (child not reachable)`);
      continue;
    }
    
    pagesCrawled.push(child.url);
    crawlLog.push({ 
      url: child.url, level: 2, category: child.category, score: child.score,
      parentAnchor: child.parentAnchor, parentTitle: child.parentTitle, parentCategory: child.parentCategory 
    });
    
    // Extract text and try to find persons
    const childText = childHtml
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
      .replace(/\s+/g, ' ').trim();
    
    if (childText.length < 200) {
      console.log(`  (skipped: too short, ${childText.length} chars)`);
      continue;
    }
    
    console.log(`  Page text: ${childText.length} chars`);
    
    // Try to extract persons
    const persons = await extractPersonsViaLLM(childText, companyName, targetRole, child.url);
    
    if (persons.length > 0) {
      console.log(`  ✓ Found ${persons.length} persons:`);
      for (const p of persons) {
        p.source_url = child.url;
        p.company_validated = true;
        allCandidates.push(p);
        console.log(`    ${p.name} (${p.role})`);
      }
    } else {
      console.log(`  ✗ No persons found on this page`);
      // Log page content for debugging
      console.log(`  Page title: "${childText.substring(0, 100)}..."`);
    }
    
    // If we have enough candidates, stop
    if (allCandidates.length >= 3) break;
  }
  
  console.log(`\n[Crawler] Phase A complete: ${allCandidates.length} candidates from ${pagesCrawled.length} pages`);
  console.log(`[Crawler] Crawl path: ${crawlLog.map(l => `${l.category}(${new URL(l.url).pathname})`).join(' → ')}`);
  
  // ========== PHASE B: Search Fallback ==========
  if (allCandidates.length === 0) {
    console.log('[Crawler] Phase B: Search fallback (no candidates from direct crawl)');
    const fallbackCandidates = await crawlViaSearch(companyName, targetRole, alternativeRoles, companyDomain);
    allCandidates.push(...fallbackCandidates);
  }
  
  console.log(`[Crawler] Total: ${allCandidates.length} validated candidates`);
  
  return {
    candidates: allCandidates,
    pagesCrawled,
    method: pagesCrawled.length > 0 ? 'deep_semantic_crawl' : 'search_fallback',
    crawlLog
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

async function crawlViaSearch(companyName, targetRole, searchRoles = [], companyDomain = null) {
  const candidates = [];
  const roles = searchRoles.length > 0 ? searchRoles : [targetRole];
  
  // Generate targeted search queries using actual domain
  const queries = [];
  const domain = companyDomain || companyName.toLowerCase().replace(/[^a-z0-9]/g, '') + '.com';
  
  // Primary: site-specific queries with actual domain (most valuable)
  for (const role of roles.slice(0, 4)) {
    queries.push(`site:${domain} "${role}"`);
  }
  
  // Secondary: general queries with company name + role
  for (const role of roles.slice(0, 3)) {
    queries.push(`"${companyName}" "${role}"`);
  }
  
  // Fallback: broader team/management query
  queries.push(`site:${domain} team OR management OR contact`);
  
  console.log(`  [Search] Generated ${queries.length} queries for ${roles.length} roles (domain: ${domain})`);
  
  // Execute queries in parallel
  const allResults = [];
  const queryPromises = queries.slice(0, 8).map(async (q) => {
    console.log(`  [Search] Query: ${q}`);
    try {
      const results = await webSearch(q);
      if (results) allResults.push(...results);
    } catch (e) {
      console.log(`  [Search] Query failed: ${e.message}`);
    }
  });
  await Promise.all(queryPromises);
  
  if (allResults.length === 0) {
    console.log('  [Search] No results from any query');
    return candidates;
  }
  console.log(`  [Search] Got ${allResults.length} total results`);
  
  // Deduplicate URLs, filter jobs, prioritize company domain
  const seenUrls = new Set();
  const allUrls = allResults
    .filter(r => {
      if (seenUrls.has(r.url)) return false;
      if (isJobUrl(r.url)) return false;
      seenUrls.add(r.url);
      return true;
    });
  
  // Sort: company domain pages first, then others
  const domainBase = domain.replace(/^www\./, '');
  allUrls.sort((a, b) => {
    const aOnDomain = a.url.toLowerCase().includes(domainBase) ? 0 : 1;
    const bOnDomain = b.url.toLowerCase().includes(domainBase) ? 0 : 1;
    return aOnDomain - bOnDomain;
  });
  
  const urls = allUrls.slice(0, 6);
  
  console.log(`  [Search] ${urls.length} URLs to fetch (${allUrls.filter(r => r.url.toLowerCase().includes(domainBase)).length} on company domain)`);
  
  const pagePromises = urls.map(async (r) => {
    console.log(`  [Search] Fetching: ${r.url}`);
    const text = await fetchPageText(r.url, 4000);
    if (!text || text.length < 200) {
      console.log(`  [Search] Skipped ${r.url} (text=${text?.length || 0})`);
      return [];
    }
    console.log(`  [Search] Extracting persons from ${r.url} (${text.length} chars)`);
    const persons = await extractPersonsViaLLM(text, companyName, targetRole, r.url);
    return persons.map(p => {
      p.source_url = r.url;
      const urlLower = r.url.toLowerCase();
      p.company_validated = urlLower.includes(domainBase) || urlLower.includes(companyName.toLowerCase().replace(/\s+/g, ''));
      console.log(`  [Search] Found: ${p.name} (${p.role}) validated=${p.company_validated}`);
      return p;
    });
  });
  
  const results2 = await Promise.all(pagePromises);
  for (const persons of results2) {
    candidates.push(...persons);
    if (candidates.length >= 5) break;
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
${cleanText.substring(0, 2500)}

STRENGE REGELN:
1. NUR vollständige plausible Personennamen (Vor- + Nachname)
2. KEINE Textfragmente ("Officer and", "be the", "GmbH staff")
3. KEINE Firmennamen oder Produktnamen
4. KEINE Satzfragmente als Namen
5. Jede Person MUSS eine klare Position/Rolle haben
6. Die Person MUSS zur Firma ${companyName} gehören (nicht zu einer anderen Firma)
7. Quelle ist die angegebene URL
8. ORDNE jede Person einer Abteilung zu (Sales, HR, Management, Marketing, IT, Finance, Operations, etc.)

Gib ein JSON Array zurück:
[{"name": "Vorname Nachname", "role": "Position", "department": "Abteilung", "evidence": "Zitat aus dem Text das die Person belegt"}]

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
    // Filter out generic/low-value roles
    const roleLower = role.toLowerCase();
    if (['mitarbeiter', 'employee', 'staff', 'team', 'member'].some(g => roleLower === g)) return false;
    return true;
  }).map(p => ({
    name: p.name.trim(),
    role: p.role.trim(),
    department: (p.department || '').trim(),
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
- Primäre Titel: ${(context.primaryRoleTitles || []).join(', ')}
- Sekundäre Titel: ${(context.secondaryRoleTitles || []).join(', ')}
- Ausgeschlossene Titel: ${(context.excludedRoles || []).join(', ')}
- Trigger: ${context.trigger?.content || 'Kein Trigger'}
- Firma: ${context.company?.name || 'Unbekannt'}

KANDIDATEN:
${candidates.map((c, i) => `${i + 1}. ${c.name} — ${c.role || 'Rolle unbekannt'} (${c.department || 'Abteilung unbekannt'}) (Quelle: ${c.source_url || 'direkt'}, company_validated: ${c.company_validated ? 'ja' : 'nein'})`).join('\n')}

BEWERTUNGSKRITERIEN (in Reihenfolge):
1. ROLE MATCH: Passt die Rolle zu den primären Titeln? (Höchste Priorität)
2. COMPANY VALIDATED: Stammt die Person von der eigenen Firmenseite?
3. DEPARTMENT MATCH: Passt die Abteilung zur Zielrolle?
4. EVIDENCE QUALITY: Ist die Evidenz überzeugend?
5. OPPORTUNITY FIT: Passt die Person zum Angebot?

STRIKTE REGELN:
- CEO/Geschäftsführer DARF NICHT automatisch auf Platz 1 landen, wenn eine spezialisierte Rolle (Sales, HR, etc.) vorhanden ist.
- Personen aus excluded_as_primary MÜSSEN einen Score unter 50 bekommen.
- company_validated=true ist ein starker Bonus (+15).
- Externe Quellen (LinkedIn, Xing) sind weniger vertrauenswürdig als eigene Firmenseiten.

Gib ein JSON Array zurück, sortiert nach Score (höchster zuerst):
[
  { "index": 0, "rank_score": 95, "reason": "Kurze Begründung" },
  { "index": 1, "rank_score": 82, "reason": "..." }
]

Nur relevante Kandidaten (Score > 40).`;

  const result = await callLLM(prompt, 0.2);
  
  // LLM fallback: heuristic scoring
  if (!result?.rankings) {
    console.log('[Ranking] LLM failed, using heuristic ranking');
    return candidates
      .map(c => {
        let score = 50;
        const roleLower = (c.role || '').toLowerCase();
        const deptLower = (c.department || '').toLowerCase();
        
        // Strong boost for matching primary roles
        if ((context.primaryRoleTitles || []).some(t => roleLower.includes(t.toLowerCase()))) score += 30;
        // Boost for matching secondary roles
        if ((context.secondaryRoleTitles || []).some(t => roleLower.includes(t.toLowerCase()))) score += 15;
        // Boost for matching department
        if ((context.primaryRoleTitles || []).some(t => deptLower.includes(t.toLowerCase().split(' ')[0]))) score += 10;
        // Penalty for excluded roles
        if ((context.excludedRoles || []).some(t => roleLower.includes(t.toLowerCase()))) score -= 40;
        // Boost for company validated
        if (c.company_validated) score += 15;
        // Penalty for generic Geschäftsführer when specialized roles expected
        if (roleLower.includes('geschäftsführer') || roleLower.includes('ceo')) {
          if ((context.primaryRoleTitles || []).length > 0 && 
              !(context.primaryRoleTitles || []).some(t => t.toLowerCase().includes('geschäftsführer'))) {
            score -= 25;
          }
        }
        return { ...c, rank_score: Math.max(0, Math.min(100, score)) };
      })
      .filter(c => c.rank_score > 40)
      .sort((a, b) => b.rank_score - a.rank_score);
  }
  
  return result.rankings
    .filter(r => r.rank_score > 40)
    .map(r => ({
      ...candidates[r.index],
      rank_score: r.rank_score,
      rank_reason: r.reason
    }));
}

// ============================================================================
// PHASE 7: CALL LLM
// ============================================================================
// LLM CALL
// ============================================================================

async function callLLM(prompt, temperature = 0.3) {
  const providers = [
    { url: 'https://api.deepseek.com/chat/completions', key: process.env.DEEPSEEK_API_KEY, model: 'deepseek-chat' },
    { url: 'https://api.mistral.ai/v1/chat/completions', key: process.env.MISTRAL_API_KEY, model: 'mistral-small-latest' }
  ];
  
  for (const p of providers) {
    if (!p.key) { console.log(`[callLLM] SKIP ${p.model}: no API key`); continue; }
    try {
      console.log(`[callLLM] Trying ${p.model}...`);
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
      }, 15000);
      
      if (!res.ok) {
        const errBody = await res.text().catch(() => '');
        console.log(`[callLLM] ${p.model} HTTP ${res.status}: ${errBody.substring(0, 200)}`);
        continue;
      }
      const data = await res.json();
      const text = data.choices?.[0]?.message?.content || '';
      console.log(`[callLLM] ${p.model} responded (${text.length} chars)`);
      
      // JSON parsen
      const cleaned = text.replace(/```(?:json)?/g, '').replace(/```/g, '').trim();
      try { return JSON.parse(cleaned); } catch(e) { return { raw: text }; }
    } catch (e) { 
      console.log(`[callLLM] ${p.model} exception: ${e.message}`);
      continue; 
    }
  }
  console.log('[callLLM] All providers failed, returning null');
  return null;
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type, Authorization' } };
  }
  
  // Temporary diagnostic: GET request shows env var status
  if (event.httpMethod === 'GET') {
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        DEEPSEEK_API_KEY: !!process.env.DEEPSEEK_API_KEY,
        MISTRAL_API_KEY: !!process.env.MISTRAL_API_KEY,
        TAVILY_API_KEY: !!process.env.TAVILY_API_KEY,
        SUPABASE_SERVICE_KEY: !!process.env.SUPABASE_SERVICE_KEY,
        VITE_SUPABASE_URL: !!process.env.VITE_SUPABASE_URL,
      })
    };
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
    
    // Phase 1: Target Contact Role Inference (LLM)
    console.log('[ContactIntel] Phase 1: Target Contact Role Inference');
    let targetRoleInference;
    try {
      targetRoleInference = await inferTargetContactRole({ offering, company, opportunity, trigger, research });
    } catch (e) {
      console.error('[ContactIntel] Role inference LLM failed:', e.message);
      targetRoleInference = null;
    }
    
    // Extract role titles from LLM result
    // Smart fallback based on company size (NOT hardcoded Geschäftsführer)
    let targetRole = '';
    let primaryRoleTitles = [];
    let secondaryRoleTitles = [];
    let excludedRoles = [];
    let roleReason = '';
    let roleConfidence = 50;
    
    if (targetRoleInference && !targetRoleInference.raw) {
      targetRole = targetRoleInference.primary_role_titles?.[0] || '';
      primaryRoleTitles = targetRoleInference.primary_role_titles || [];
      secondaryRoleTitles = targetRoleInference.secondary_role_titles || [];
      excludedRoles = targetRoleInference.excluded_as_primary || [];
      roleReason = targetRoleInference.reason || '';
      roleConfidence = targetRoleInference.confidence || 50;
      console.log(`[ContactIntel] Target role (LLM): ${targetRole}`);
      console.log(`[ContactIntel] Primary titles: ${primaryRoleTitles.join(', ')}`);
      console.log(`[ContactIntel] Secondary titles: ${secondaryRoleTitles.join(', ')}`);
      console.log(`[ContactIntel] Excluded: ${excludedRoles.join(', ')}`);
      console.log(`[ContactIntel] Reason: ${roleReason}`);
    } else if (targetRoleInference?.raw) {
      console.log(`[ContactIntel] LLM returned raw (unparseable): ${targetRoleInference.raw.substring(0, 200)}`);
    } else {
      console.log(`[ContactIntel] LLM returned null — all providers failed`);
      // Size-based fallback: NEVER default to Geschäftsführer for large companies
      const sizeNum = parseInt(String(company?.size || company?.employees || '0').replace(/[^0-9]/g, ''), 10) || 0;
      const targetAudience = (offering?.target_audience || '').toLowerCase();
      const triggerContent = (trigger?.content || trigger?.description || '').toLowerCase();
      
      // Try to infer from trigger + target_audience keywords
      const combinedContext = `${targetAudience} ${triggerContent}`;
      
      if (combinedContext.includes('einkauf') || combinedContext.includes('procurement') || combinedContext.includes('beschaffung')) {
        targetRole = 'Einkaufsleiter';
        primaryRoleTitles = ['Head of Procurement', 'Einkaufsleiter', 'Purchasing Manager', 'Procurement Director', 'Leiter Beschaffung'];
      } else if (combinedContext.includes('marketing') || combinedContext.includes('werbung') || combinedContext.includes('brand')) {
        targetRole = 'Marketing Director';
        primaryRoleTitles = ['Head of Marketing', 'CMO', 'Marketing Director', 'Marketing Manager', 'Leiter Marketing'];
      } else if (combinedContext.includes('it') || combinedContext.includes('technik') || combinedContext.includes('digitalisierung') || combinedContext.includes('software')) {
        targetRole = 'IT-Leiter';
        primaryRoleTitles = ['CTO', 'Head of IT', 'IT-Director', 'IT-Leiter', 'Leiter Technik'];
      } else if (combinedContext.includes('hr') || combinedContext.includes('personal') || combinedContext.includes('recruiting') || combinedContext.includes('einstellung')) {
        targetRole = 'Personalleitung';
        primaryRoleTitles = ['Head of HR', 'HR Director', 'Personalleitung', 'HR Manager', 'Leiter Personal'];
      } else if (combinedContext.includes('vertrieb') || combinedContext.includes('sales') || combinedContext.includes('absatz')) {
        targetRole = 'Vertriebsleiter';
        primaryRoleTitles = ['Head of Sales', 'Sales Director', 'VP Sales', 'Vertriebsleiter', 'Director Sales'];
      } else {
        // No keyword match: use size-based role selection
        if (sizeNum > 0 && sizeNum < 30) {
          // Small company: GF may be relevant
          targetRole = 'Geschäftsführer';
          primaryRoleTitles = ['Geschäftsführer', 'CEO', 'Managing Director', 'Founder', 'Inhaber'];
          roleReason = 'Fallback: Kleines Unternehmen (<30 MA) — Geschäftsführung wahrscheinlich direkt zuständig';
        } else if (sizeNum >= 30 && sizeNum < 200) {
          // Mid-size: try general management, but exclude CEO for specialized functions
          targetRole = 'Geschäftsführer';
          primaryRoleTitles = ['Geschäftsführer', 'CEO', 'Managing Director'];
          excludedRoles = ['CFO', 'CTO', 'COO'];
          roleReason = 'Fallback: Mittelgroßes Unternehmen — eine spezialisierte Rolle wäre besser, aber LLM nicht verfügbar';
        } else {
          // Large company or unknown: DO NOT default to CEO
          targetRole = 'Geschäftsführer';
          primaryRoleTitles = ['Geschäftsführer', 'CEO', 'Managing Director'];
          excludedRoles = ['CFO', 'CTO', 'COO', 'Vorstand'];
          roleReason = 'Fallback: Großes/unbekanntes Unternehmen — CEO als Last Resort, spezialisierte Rolle wäre besser';
        }
      }
      
      if (!roleReason) {
        roleReason = 'Fallback-Heuristik (LLM-Inference fehlgeschlagen)';
      }
      console.log(`[ContactIntel] Target role (heuristic fallback): ${targetRole}`);
      console.log(`[ContactIntel] Reason: ${roleReason}`);
    }
    
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
    // Build search roles list: primary + secondary titles
    const allSearchRoles = [...primaryRoleTitles, ...secondaryRoleTitles].filter(Boolean);
    console.log(`[ContactIntel] Search roles: ${allSearchRoles.join(', ')}`);
    
    const crawlResult = await crawlForContacts(
      company?.name || 'Unbekannt', 
      companyDomain, 
      targetRole, 
      allSearchRoles,
      startTime
    );
    
    const candidates = crawlResult.candidates || [];
    const pagesCrawled = crawlResult.pagesCrawled || [];
    const crawlMethod = crawlResult.method || 'unknown';
    
    console.log(`[ContactIntel] Found ${candidates.length} candidates via ${crawlMethod} (${pagesCrawled.length} pages crawled)`);
    
    // Debug: Log all candidates
    candidates.forEach((c, i) => {
      console.log(`[ContactIntel] Candidate ${i + 1}: ${c.name} — ${c.role || 'unknown role'} (validated: ${c.company_validated}, source: ${c.source_url || 'unknown'})`);
    });
    
    if (candidates.length === 0) {
      return {
        statusCode: 200,
        body: JSON.stringify({
          status: 'NO_MATCHING_PERSON_FOUND',
          targetRole,
          primaryRoleTitles,
          secondaryRoleTitles,
          excludedRoles,
          roleReason,
          roleConfidence,
          pagesCrawled,
          crawlMethod,
          debug: {
            searchedRoles: allSearchRoles,
            pagesInvestigated: pagesCrawled.length,
            candidatesFound: 0,
            reason: 'Keine Personen mit passenden Rollen auf den untersuchten Seiten gefunden'
          }
        })
      };
    }
    
    // Phase 5+8: Person Matching + Final Ranking
    console.log('[ContactIntel] Phase 5+8: Person Matching & Ranking');
    let rankedCandidates;
    try {
      rankedCandidates = await rankContacts(candidates, {
        offering,
        company,
        targetRole,
        primaryRoleTitles,
        secondaryRoleTitles,
        excludedRoles,
        trigger,
        research
      });
    } catch (e) {
      console.error('[ContactIntel] Ranking LLM failed, using heuristic ranking:', e.message);
      // Heuristic ranking: prefer role match, then company validated
      rankedCandidates = candidates
        .map(c => {
          let score = 50;
          const roleLower = (c.role || '').toLowerCase();
          // Boost for matching primary roles
          if (primaryRoleTitles.some(t => roleLower.includes(t.toLowerCase()))) score += 30;
          // Boost for matching secondary roles
          if (secondaryRoleTitles.some(t => roleLower.includes(t.toLowerCase()))) score += 15;
          // Penalty for excluded roles
          if (excludedRoles.some(t => roleLower.includes(t.toLowerCase()))) score -= 40;
          // Boost for company validated
          if (c.company_validated) score += 10;
          // Penalty for generic roles
          if (roleLower.includes('geschäftsführer') && primaryRoleTitles.length > 0 && !primaryRoleTitles.some(t => t.toLowerCase().includes('geschäftsführer'))) score -= 20;
          return { ...c, rank_score: Math.max(0, Math.min(100, score)) };
        })
        .sort((a, b) => b.rank_score - a.rank_score);
    }
    
    // Filter out low-score candidates and excluded roles
    const validCandidates = rankedCandidates.filter(c => {
      if (c.rank_score < 30) return false;
      const roleLower = (c.role || '').toLowerCase();
      if (excludedRoles.some(t => roleLower.includes(t.toLowerCase()))) return false;
      return true;
    });
    
    if (validCandidates.length === 0) {
      console.log('[ContactIntel] No candidates survived ranking filter');
      return {
        statusCode: 200,
        body: JSON.stringify({
          status: 'NO_MATCHING_PERSON_FOUND',
          targetRole,
          primaryRoleTitles,
          secondaryRoleTitles,
          excludedRoles,
          roleReason,
          roleConfidence,
          pagesCrawled,
          crawlMethod,
          debug: {
            searchedRoles: allSearchRoles,
            pagesInvestigated: pagesCrawled.length,
            candidatesFound: candidates.length,
            candidatesAfterRanking: 0,
            reason: `Alle ${candidates.length} Kandidaten wurden aussortiert (Score < 30 oder ausgeschlossene Rolle)`
          }
        })
      };
    }
    
    const best = validCandidates[0];
    console.log(`[ContactIntel] Best candidate: ${best.name} (${best.role}) — Score: ${best.rank_score}`);
    if (validCandidates.length > 1) {
      console.log(`[ContactIntel] Alternatives: ${validCandidates.slice(1, 4).map(c => `${c.name} (${c.role}, Score: ${c.rank_score})`).join(', ')}`);
    }
    
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
        primary: {
          ...best,
          rank_score: best.rank_score || 80
        },
        alternatives: validCandidates.slice(1, 4).map(c => ({
          name: c.name,
          role: c.role,
          evidence: c.evidence,
          source_url: c.source_url,
          company_validated: c.company_validated,
          rank_score: c.rank_score
        })),
        targetRole,
        primaryRoleTitles,
        secondaryRoleTitles,
        roleReason,
        roleConfidence,
        debug: {
          searchedRoles: allSearchRoles,
          pagesInvestigated: pagesCrawled.length,
          candidatesFound: candidates.length,
          candidatesAfterRanking: validCandidates.length,
          bestScore: best.rank_score
        }
      })
    };
    
  } catch (e) {
    console.error('[ContactIntel] Error:', e);
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};
