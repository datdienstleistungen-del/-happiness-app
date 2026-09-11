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

async function fetchWithTimeout(url, options = {}, timeoutMs = 10000) {
  const controller = new AbortController();
  const abortId = setTimeout(() => controller.abort(), timeoutMs);
  const raceId = setTimeout(() => controller.abort(), timeoutMs + 2000);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(abortId); clearTimeout(raceId);
    return { res, abortId, raceId };
  } catch (e) {
    clearTimeout(abortId); clearTimeout(raceId);
    throw e;
  }
}

async function searchDuckDuckGo(query) {
  try {
    const { res } = await fetchWithTimeout(
      `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`,
      { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' } },
      8000
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
        8000
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

async function fetchPageText(url, maxChars = 8000) {
  try {
    const { res } = await fetchWithTimeout(url, {
      headers: { 
        'User-Agent': 'Mozilla/5.0 (compatible; NeXusBot/1.0)',
        'Accept': 'text/html,application/xhtml+xml'
      },
    }, 10000);
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

function extractLinks(html, baseUrl) {
  const links = [];
  const regex = /href="([^"]*)"/gi;
  let match;
  while ((match = regex.exec(html)) !== null) {
    let href = match[1];
    if (href.startsWith('/')) {
      try { href = new URL(href, baseUrl).href; } catch(e) { continue; }
    }
    if (href.startsWith('http')) links.push(href);
  }
  return [...new Set(links)];
}

function prioritizeUrls(urls, companyDomain) {
  const priorityPatterns = [
    /team/i, /management/i, /about/i, /ueber-?uns/i, /ueber/i,
    /leadership/i, /people/i, /staff/i, /mitarbeiter/i,
    /geschaeftsfuehrung/i, /founder/i, /CEO/i,
    /contact/i, /kontakt/i, /impressum/i,
    /sales/i, /hr/i, /karriere/i, /jobs/i, /career/i
  ];
  
  return urls.sort((a, b) => {
    const aDomain = new URL(a).hostname;
    const bDomain = new URL(b).hostname;
    const aOnSite = aDomain.includes(companyDomain) ? 0 : 1;
    const bOnSite = bDomain.includes(companyDomain) ? 0 : 1;
    if (aOnSite !== bOnSite) return aOnSite - bOnSite;
    
    const aScore = priorityPatterns.findIndex(p => p.test(a));
    const bScore = priorityPatterns.findIndex(p => p.test(b));
    return (aScore === -1 ? 99 : aScore) - (bScore === -1 ? 99 : bScore);
  });
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
// PHASE 3: TARGETED CRAWLER
// ============================================================================

const JOB_URL_PATTERNS = [
  /linkedin\.com\/jobs/i,
  /indeed\.com/i,
  /glassdoor\.com/i,
  /stepstone\.de/i,
  /monster\.de/i,
  /jobs\.ch/i,
  /karriere\.at/i,
  /absolventa\.de/i,
  /kununu\.com/i,
  /glassdoor\./i,
  /linkedin\.com\/pulse/i,
  /linkedin\.com\/feed/i
];

function isJobUrl(url) {
  return JOB_URL_PATTERNS.some(p => p.test(url));
}

async function crawlForContacts(companyName, companyDomain, targetRole, alternativeRoles) {
  const allCandidates = [];
  
  // 1. Gezielte Suche nach Team/Management-Seiten (KEINE Job-Suchen)
  const searchQueries = [
    `${companyName} team management`,
    `${companyName} Geschäftsführung leadership`,
    `${companyName} about us team`,
    `${companyName} ansprechpartner kontakt`
  ];
  
  // Wenn Domain bekannt: Direkt auf die eigene Seite suchen
  if (companyDomain) {
    searchQueries.unshift(`site:${companyDomain} team OR management OR about OR leadership`);
  }
  
  const searchResults = [];
  for (const query of searchQueries) {
    const results = await webSearch(query);
    console.log(`[Crawler] Query "${query}": ${results?.length || 0} raw results`);
    if (results) {
      for (const r of results) {
        console.log(`  - ${r.url.substring(0, 80)}... | job=${isJobUrl(r.url)}`);
      }
      // Job-Links sofort rausfiltern
      const filtered = results.filter(r => !isJobUrl(r.url));
      searchResults.push(...filtered);
    }
  }
  
  console.log(`[Crawler] ${searchResults.length} results after job-filter`);
  
  // 2. Sammle relevante URLs (Team/About/Management-Seiten)
  const relevantUrls = [];
  for (const r of searchResults) {
    const urlLower = r.url.toLowerCase();
    // Bevorzuge: team, about, management, leadership, impressum, kontakt
    // Vermeide: jobs, karriere, stellenangebote, blog, news
    if ((urlLower.includes('team') || urlLower.includes('about') || 
         urlLower.includes('management') || urlLower.includes('leadership') ||
         urlLower.includes('ueber') || urlLower.includes('impressum') ||
         urlLower.includes('kontakt') || urlLower.includes('contact')) &&
        !urlLower.includes('job') && !urlLower.includes('karriere') &&
        !urlLower.includes('stelle') && !urlLower.includes('blog')) {
      relevantUrls.push(r.url);
    }
  }
  
  // 3. LLM-basierte Person-Extraktion aus Snippets (nur bei eindeutigen Namen)
  // Nur wenn der Snippet explizit eine Person + Rolle nennt
  for (const r of searchResults) {
    // Prüfe ob Snippet eine echte Person mit Rolle enthält
    // Pattern: "Max Mustermann, CEO" oder "CEO Max Mustermann"
    const explicitPersonMatch = r.snippet.match(
      /([A-ZÄÖÜ][a-zäöüß]+ [A-ZÄÖÜ][a-zäöüß\-]+)[,\s]+((?:CEO|CTO|CFO|COO|CMO|CRO|VP|Head of|Geschäftsführer|Managing Director|Founder|Co-Founder|Director|Leiter|Vorstand)[^\.,]{0,40})/i
    );
    if (explicitPersonMatch) {
      const name = explicitPersonMatch[1].trim();
      const role = explicitPersonMatch[2].trim();
      if (name.length > 4 && name.length < 40 && !isJobUrl(r.url)) {
        allCandidates.push({
          name,
          role,
          source: r.url,
          snippet: r.snippet.substring(0, 200),
          confidence: 70
        });
      }
    }
  }
  
  console.log(`[Crawler] ${allCandidates.length} candidates from snippets`);
  
  // 4. Crawle die wichtigsten Team/About-Seiten
  const urlsToCrawl = companyDomain 
    ? prioritizeUrls(relevantUrls, companyDomain).slice(0, 5)
    : relevantUrls.slice(0, 3);
  
  for (const url of urlsToCrawl) {
    if (isJobUrl(url)) continue;
    
    const text = await fetchPageText(url, 6000);
    if (!text) continue;
    
    // LLM-basierte Person-Extraktion
    const persons = await extractPersonsViaLLM(text, companyName, targetRole);
    for (const p of persons) {
      p.source = url;
      allCandidates.push(p);
    }
  }
  
  console.log(`[Crawler] Total candidates: ${allCandidates.length}`);
  
  // 5. Deduplizierung
  return deduplicateCandidates(allCandidates);
}

async function extractPersonsViaLLM(pageText, companyName, targetRole) {
  // Text bereinigen: Navigation, Footer, Cookie-Banner entfernen
  const cleanText = pageText
    .replace(/Newsletter/gi, '')
    .replace(/News[- ]letter/gi, '')
    .replace(/Cookie[- ]Einstellungen/gi, '')
    .replace(/Privatsphäre/gi, '')
    .replace(/Datenschutz/gi, '')
    .replace(/Anmelden/gi, '')
    .replace(/Zum Inhalt springen/gi, '')
    .replace(/© \d{4}[^\.]*/gi, '')
    .replace(/Linkedin|Youtube|Spotify/gi, '')
    .replace(/Rückruf|Anfragen/gi, '')
    .replace(/\d{2}\.\d{2}\.\d{4}/g, '')  // dates
    .replace(/\+\d{1,3}[\s\d\-()]+/g, '')  // phone numbers
    .replace(/Mo - Do[^\.]*\./gi, '')  // office hours
    .replace(/\s+/g, ' ')
    .trim();
  
  // Nur den relevanten Teil senden (erste 3000 Zeichen)
  const relevantText = cleanText.substring(0, 3000);
  
  const prompt = `Du bist ein personnelcher Researcher. Finde alle PERSONEN auf dieser Firmenwebsite.

Firma: ${companyName}
Gesuchte Zielrolle: ${targetRole}

TEXT DER WEBSEITE:
${relevantText}

WICHTIG: 
- Lies den Text genau durch und finde alle Personennamen (Vor- + Nachname)
- Finde die zugehörige Position/Rolle jeder Person
- Schau besonders nach: Gründer, Geschäftsführer, CEO, Head of, Leiter, Director
- NUR echte Personen, KEINE Firma oder Produkte

Gib ein JSON Array zurück:
[{"name": "Vorname Nachname", "role": "Position"}]

Wenn du Personen findest, gib sie alle zurück. Sonst ein leeres Array: []`;

  const result = await callLLM(prompt, 0.1);
  if (!result) return [];
  
  // Handle different response formats
  if (Array.isArray(result)) return result.filter(p => p.name && p.role);
  if (result.persons && Array.isArray(result.persons)) return result.persons.filter(p => p.name && p.role);
  if (result.raw) {
    try {
      const parsed = JSON.parse(result.raw);
      if (Array.isArray(parsed)) return parsed.filter(p => p.name && p.role);
    } catch(e) {}
  }
  return [];
}

function extractRoleFromText(text, name) {
  const rolePatterns = [
    new RegExp(`${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[\\s,–\\-]+([A-ZÄÖÜ][A-Za-zäöüß\\s,–\\-]{2,40})`, 'i'),
    new RegExp(`([A-ZÄÖÜ][A-Za-zäöüß\\s,–\\-]{2,30})[\\s,–\\-]+${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i')
  ];
  
  for (const pattern of rolePatterns) {
    const match = text.match(pattern);
    if (match) {
      const role = match[1].trim();
      if (role.length > 3 && role.length < 50 && 
          !role.match(/^(der|die|das|den|dem|des|ein|eine|einem|einen|einer|und|oder|mit|von|bei|für|in|an|auf|ist|sind|war|hat|wird|kann|uns|Ihre|Ihr|our|the|and|or|for|at|in|is|are|was|has|will|can)$/i)) {
        return role;
      }
    }
  }
  return null;
}

function calculateRoleRelevance(foundRole, targetRoles) {
  if (!foundRole || !targetRoles?.length) return 50;
  
  const found = foundRole.toLowerCase();
  for (const target of targetRoles) {
    if (!target) continue;
    const t = target.toLowerCase();
    if (found === t) return 95;
    if (found.includes(t) || t.includes(found)) return 85;
    // Ähnliche Rollen
    const synonyms = {
      'head of sales': ['vp sales', 'sales director', 'vertriebsleiter', 'leiter vertrieb'],
      'ceo': ['geschäftsführer', 'founder', 'managing director', 'inhaber'],
      'cmo': ['vp marketing', 'marketing director', 'leiter marketing'],
      'chro': ['vp hr', 'hr director', 'leiter personal']
    };
    for (const [key, syns] of Object.entries(synonyms)) {
      if ((found.includes(key) || syns.some(s => found.includes(s))) &&
          (t.includes(key) || syns.some(s => t.includes(s)))) {
        return 80;
      }
    }
  }
  return 40;
}

function deduplicateCandidates(candidates) {
  const seen = new Map();
  for (const c of candidates) {
    const key = c.name.toLowerCase().replace(/[^a-zäöüß]/g, '');
    if (seen.has(key)) {
      const existing = seen.get(key);
      if (c.confidence > existing.confidence) seen.set(key, c);
    } else {
      seen.set(key, c);
    }
  }
  return [...seen.values()];
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
${candidates.map((c, i) => `${i + 1}. ${c.name} — ${c.role || 'Rolle unbekannt'} (Quelle: ${c.source || 'direkt'})`).join('\n')}

BEWERTUNGSKRITERIEN:
1. Role Fit (passt die Rolle zur Zielrolle?)
2. Opportunity Fit (passt die Rolle zum Angebot?)
3. Trigger Fit (ist die Rolle bei diesem Trigger relevant?)
4. Source Confidence (ist die Quelle verlässlich?)

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
// PHASE 6: EMAIL DISCOVERY
// ============================================================================

async function discoverEmails(rankedContacts, companyName, companyDomain) {
  for (const contact of rankedContacts) {
    // 1. Suche nach公开 angegebener E-Mail
    const searchQueries = [
      `"${contact.name}" email ${companyName}`,
      `"${contact.name}" @${companyDomain || companyName}`,
      `"${contact.name}" Kontakt E-Mail`
    ];
    
    for (const query of searchQueries) {
      const results = await webSearch(query);
      if (!results) continue;
      
      for (const r of results) {
        const emailMatch = (r.snippet + ' ' + r.title).match(
          /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g
        );
        if (emailMatch?.length > 0) {
          // Finde die wahrscheinlichste E-Mail für diese Person
          const nameParts = contact.name.toLowerCase().split(/\s+/);
          const bestEmail = emailMatch.find(e => {
            const local = e.split('@')[0];
            return nameParts.some(p => local.includes(p)) || 
                   local.match(/^[a-z]\.?([a-z]+\.?){1,3}$/);
          }) || emailMatch[0];
          
          contact.email = bestEmail;
          contact.email_source = 'found';
          contact.email_status = 'FOUND';
          break;
        }
      }
      if (contact.email) break;
    }
    
    // 2. Inferiere E-Mail wenn nicht gefunden
    if (!contact.email && companyDomain) {
      const nameParts = contact.name.toLowerCase().split(/\s+/);
      const first = nameParts[0] || '';
      const last = nameParts[nameParts.length - 1] || '';
      
      // Häufige Patterns
      const patterns = [
        `${first}.${last}@${companyDomain}`,
        `${first[0]}${last}@${companyDomain}`,
        `${first}@${companyDomain}`,
        `${first}.${last[0]}@${companyDomain}`
      ];
      
      contact.email = patterns[0];
      contact.email_source = 'inferred';
      contact.email_status = 'INFERRED';
    }
    
    if (!contact.email) {
      contact.email_status = 'UNKNOWN';
    }
  }
  
  return rankedContacts;
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
          max_tokens: 2000
        })
      }, 30000);
      
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
    
    if (existingContacts?.length > 0 && existingContacts[0].nexus_contacts?.name) {
      return { 
        statusCode: 200, 
        body: JSON.stringify({ 
          status: 'already_exists',
          contact: existingContacts[0].nexus_contacts,
          message: 'Contact already exists for this opportunity'
        }) 
      };
    }
    
    // Phase 2: Role Inference
    console.log('[ContactIntel] Phase 2: Role Inference');
    const roleResult = await inferTargetRole({ offering, company, trigger, research });
    const targetRole = roleResult?.primary_role || 'Geschäftsführer';
    const alternativeRoles = roleResult?.alternative_roles || [];
    const roleReason = roleResult?.role_reason || '';
    
    // Phase 3: Targeted Crawl
    console.log('[ContactIntel] Phase 3: Targeted Crawl');
    const companyDomain = company?.domain || null;
    const candidates = await crawlForContacts(
      company?.name || 'Unbekannt', 
      companyDomain, 
      targetRole, 
      alternativeRoles
    );
    
    console.log(`[ContactIntel] Found ${candidates.length} candidates`);
    
    if (candidates.length === 0) {
      return {
        statusCode: 200,
        body: JSON.stringify({
          status: 'no_candidates',
          targetRole,
          roleReason,
          message: 'Keine passenden Ansprechpartner gefunden'
        })
      };
    }
    
    // Phase 5: Contact Ranking
    console.log('[ContactIntel] Phase 5: Contact Ranking');
    const ranked = await rankContacts(candidates, { offering, company, trigger, targetRole });
    
    // Phase 6: Email Discovery
    console.log('[ContactIntel] Phase 6: Email Discovery');
    const withEmails = await discoverEmails(ranked.slice(0, 5), company?.name, companyDomain);
    
    // Phase 7: Save
    console.log('[ContactIntel] Phase 7: Save');
    const best = withEmails[0];
    
    if (best && best.name && best.name !== 'unbekannt') {
      // Contact in DB speichern
      const { data: savedContact, error: saveError } = await serviceClient
        .from('nexus_contacts')
        .insert({
          user_id: user.id,
          company_id: companyId,
          name: best.name,
          role: best.role || targetRole,
          email: best.email || null,
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
        roleConfidence: roleResult?.confidence || 70
      })
    };
    
  } catch (e) {
    console.error('[ContactIntel] Error:', e);
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};
