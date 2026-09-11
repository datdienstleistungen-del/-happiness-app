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

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

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
      { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; NeXusBot/1.0)' } },
      8000
    );
    if (!res.ok) return null;
    const html = await res.text();
    const results = [];
    const regex = /<a[^>]+class="result__a"[^>]*href="([^"]*)"[^>]*>([^<]*)<\/a>[\s\S]*?<a[^>]+class="result__snippet"[^>]*>([\s\S]*?)<\/a>/gi;
    let match;
    while ((match = regex.exec(html)) !== null && results.length < 5) {
      const url = match[1].replace(/.*uddg=/, '').replace(/&.*/, '');
      const title = match[2].replace(/<[^>]*>/g, '').trim();
      const snippet = match[3].replace(/<[^>]*>/g, '').trim();
      if (url && title) results.push({ url, title, snippet });
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

async function crawlForContacts(companyName, companyDomain, targetRole, alternativeRoles) {
  const allCandidates = [];
  
  // 1. Suche nach Team/Management-Seiten
  const searchQueries = [
    `${companyName} team management ${targetRole}`,
    `${companyName} ${targetRole} LinkedIn`,
    `${companyName} Geschäftsführung team`,
    `site:${companyDomain || companyName} team OR management OR about`
  ];
  
  const searchResults = [];
  for (const query of searchQueries) {
    const results = await webSearch(query);
    if (results) searchResults.push(...results);
  }
  
  // 2. Sammle relevante URLs
  const relevantUrls = [];
  for (const r of searchResults) {
    const urlLower = r.url.toLowerCase();
    if (urlLower.includes('team') || urlLower.includes('about') || 
        urlLower.includes('management') || urlLower.includes('leadership') ||
        urlLower.includes('ueber') || urlLower.includes('kontakt') ||
        urlLower.includes('impressum') || urlLower.includes('contact')) {
      relevantUrls.push(r.url);
    }
    // Auch Snippets mit Personennamen checken
    const nameMatch = r.snippet.match(/([A-ZÄÖÜ][a-zäöüß]+ [A-ZÄÖÜ][a-zäöüß]+)/g);
    if (nameMatch) {
      for (const name of nameMatch) {
        if (name.length > 4 && name.length < 40 && !name.includes('http')) {
          allCandidates.push({
            name: name.trim(),
            role: extractRoleFromText(r.snippet, name),
            source: r.url,
            snippet: r.snippet,
            confidence: 60
          });
        }
      }
    }
  }
  
  // 3. Crawle die wichtigsten Seiten
  const urlsToCrawl = companyDomain 
    ? prioritizeUrls(relevantUrls, companyDomain).slice(0, 5)
    : relevantUrls.slice(0, 3);
  
  for (const url of urlsToCrawl) {
    const text = await fetchPageText(url, 6000);
    if (!text) continue;
    
    // Suche nach Personennamen und Rollen
    const persons = extractPersonsFromText(text, targetRole, alternativeRoles);
    for (const p of persons) {
      p.source = url;
      allCandidates.push(p);
    }
  }
  
  // 4. Deduplizierung
  return deduplicateCandidates(allCandidates);
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

function extractPersonsFromText(text, targetRole, alternativeRoles) {
  const candidates = [];
  const allRoles = [targetRole, ...(alternativeRoles || [])].filter(Boolean);
  
  // Pattern: Name + Rolle in der Nähe
  const nameRolePatterns = [
    // "Max Mustermann, CEO"
    /([A-ZÄÖÜ][a-zäöüß]+ [A-ZÄÖÜ][a-zäöüß\-]+)[,\s]+([A-ZÄÖÜ][A-Za-zäöüß\s\-]{2,40})/g,
    // "CEO Max Mustermann"
    /(CEO|CTO|CFO|COO|CMO|CRO|VP [A-ZÄÖÜ][a-zäöüß]+|Head of [A-ZÄÖÜ][A-Za-zäöüß\s]+|Director [A-ZÄÖÜ][A-Za-zäöüß\s]+|Geschäftsführer|Managing Director|Founder|Co-Founder)[\s:]+([A-ZÄÖÜ][a-zäöüß]+ [A-ZÄÖÜ][a-zäöüß\-]+)/gi
  ];
  
  for (const pattern of nameRolePatterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      let name, role;
      if (allRoles.some(r => match[1]?.toLowerCase().includes(r?.toLowerCase()))) {
        name = match[2]; role = match[1];
      } else {
        name = match[1]; role = match[2];
      }
      
      if (name && name.length > 4 && name.length < 40) {
        const relevance = calculateRoleRelevance(role, allRoles);
        candidates.push({
          name: name.trim(),
          role: role?.trim() || null,
          source: null,
          snippet: text.substring(Math.max(0, match.index - 100), match.index + match[0].length + 100),
          confidence: relevance
        });
      }
    }
  }
  
  return candidates;
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
