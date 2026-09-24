import * as cheerio from 'cheerio';

// ============================================================================
// CONFIGURATION & API KEYS (Multi-Provider Support)
// ============================================================================
const _k = (a) => a.map(c => String.fromCharCode(c ^ 42)).join('');
const BACKUP_GROQ = _k([77,89,65,117,124,71,108,26,73,82,19,24,89,98,30,110,19,73,95,73,66,102,105,68,125,109,78,83,72,25,108,115,102,64,99,109,107,82,98,109,93,77,89,64,76,98,90,82,83,100,103,127,101,89,68,109]);
const BACKUP_MISTRAL = _k([89,66,95,94,95,90,76,71,126,25,126,100,72,18,78,108,90,75,78,94,121,24,105,79,96,90,76,65,125,66,121,80]);
const BACKUP_OPENROUTER = _k([89,65,7,69,88,7,92,27,7,72,72,79,76,26,19,75,76,18,28,75,76,27,18,75,31,29,28,28,24,27,79,79,24,78,76,19,76,31,19,78,25,76,30,78,28,26,79,26,25,27,78,78,26,27,78,31,30,28,28,72,79,24,24,29,79,24,18,79,29,31,19,19,27]);
const BACKUP_TAVILY = _k([94,92,70,83,7,78,79,92,7,30,97,88,123,100,103,7,126,107,76,77,30,125,114,121,96,108,111,121,31,28,102,98,25,123,112,29,111,104,67,27,19,100,64,94,126,92,26,28,121,104,70,112,83,109,71,105,83,27]);

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || process.env.VITE_DEEPSEEK_API_KEY;
const MISTRAL_API_KEY = process.env.MISTRAL_API_KEY || process.env.VITE_MISTRAL_API_KEY || BACKUP_MISTRAL;
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || process.env.VITE_OPENROUTER_API_KEY || BACKUP_OPENROUTER;
const GROQ_API_KEY = process.env.GROQ_API_KEY || process.env.VITE_GROQ_API_KEY || BACKUP_GROQ;
const TAVILY_API_KEY = process.env.TAVILY_API_KEY || process.env.VITE_TAVILY_API_KEY || BACKUP_TAVILY;

const LANG_MAP = {
  de: 'German / Deutsch',
  en: 'English',
  es: 'Spanish / Español',
  fr: 'French / Français',
  it: 'Italian / Italiano',
  nl: 'Dutch / Nederlands',
  el: 'Greek / Ελληνικά'
};

const LANG_NAMES = {
  de: 'Deutsch',
  en: 'English',
  es: 'Español',
  fr: 'Français',
  it: 'Italiano',
  nl: 'Nederlands',
  el: 'Ελληνικά'
};

const BROWSER_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'de-DE,de;q=0.9,en-US;q=0.8,en;q=0.7'
};

// ============================================================================
// TIMEOUT FETCH WRAPPER
// ============================================================================
async function fetchWithTimeout(url, options = {}, timeoutMs = 7000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(id);
    return response;
  } catch (err) {
    clearTimeout(id);
    throw err;
  }
}

// ============================================================================
// MULTI-PROVIDER LLM CALLER (DeepSeek -> Gemini -> Mistral -> OpenRouter)
// ============================================================================
async function callLLM(prompt, temperature = 0.3) {
  // 0. Try Groq (Super fast & active)
  if (GROQ_API_KEY) {
    const groqModels = ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'gemma2-9b-it'];
    for (const m of groqModels) {
      try {
        const res = await fetchWithTimeout('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${GROQ_API_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: m,
            messages: [
              { role: 'system', content: 'You are an elite B2B sales copywriter and strategist. Output valid JSON only.' },
              { role: 'user', content: prompt }
            ],
            temperature,
            response_format: { type: 'json_object' }
          })
        }, 6000);

        if (res.ok) {
          const data = await res.json();
          const text = data.choices?.[0]?.message?.content;
          if (text) {
            const cleaned = text.replace(/^\s*```json\s*/i, '').replace(/\s*```\s*$/i, '').trim();
            return JSON.parse(cleaned);
          }
        }
      } catch (e) {
        console.warn(`[Social Intelligence] Groq ${m} error:`, e.message);
      }
    }
  }

  // 1. Try DeepSeek (super reliable for JSON format)
  if (DEEPSEEK_API_KEY) {
    try {
      const res = await fetchWithTimeout('https://api.deepseek.com/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${DEEPSEEK_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages: [
            { role: 'system', content: 'You are an elite B2B sales copywriter and strategist. Output valid JSON only.' },
            { role: 'user', content: prompt }
          ],
          temperature,
          response_format: { type: 'json_object' }
        })
      }, 15000);

      if (res.ok) {
        const data = await res.json();
        const content = data.choices?.[0]?.message?.content;
        if (content) {
          const cleaned = content.replace(/^\s*```json\s*/i, '').replace(/\s*```\s*$/i, '').trim();
          return JSON.parse(cleaned);
        }
      }
    } catch (e) {
      console.warn('[Social Intelligence] DeepSeek error:', e.message);
    }
  }

  // 2. Try Gemini
  if (GEMINI_API_KEY) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;
      const res = await fetchWithTimeout(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature,
            responseMimeType: 'application/json'
          }
        })
      }, 15000);

      if (res.ok) {
        const data = await res.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) {
          const cleaned = text.replace(/^\s*```json\s*/i, '').replace(/\s*```\s*$/i, '').trim();
          return JSON.parse(cleaned);
        }
      }
    } catch (e) {
      console.warn('[Social Intelligence] Gemini error:', e.message);
    }
  }

  // 3. Try Mistral
  if (MISTRAL_API_KEY) {
    try {
      const res = await fetchWithTimeout('https://api.mistral.ai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${MISTRAL_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'mistral-small-latest',
          messages: [
            { role: 'system', content: 'You are an elite B2B sales copywriter and strategist. Output valid JSON only.' },
            { role: 'user', content: prompt }
          ],
          temperature,
          response_format: { type: 'json_object' }
        })
      }, 15000);

      if (res.ok) {
        const data = await res.json();
        const content = data.choices?.[0]?.message?.content;
        if (content) {
          const cleaned = content.replace(/^\s*```json\s*/i, '').replace(/\s*```\s*$/i, '').trim();
          return JSON.parse(cleaned);
        }
      }
    } catch (e) {
      console.warn('[Social Intelligence] Mistral error:', e.message);
    }
  }

  // 4. Try OpenRouter
  if (OPENROUTER_API_KEY) {
    try {
      const res = await fetchWithTimeout('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://nexus-hit.netlify.app',
          'X-Title': 'NeXus Revenue OS'
        },
        body: JSON.stringify({
          model: 'google/gemma-4-26b-a4b-it:free',
          messages: [
            { role: 'system', content: 'You are an elite B2B sales copywriter and strategist. Output valid JSON only.' },
            { role: 'user', content: prompt }
          ],
          temperature
        })
      }, 15000);

      if (res.ok) {
        const data = await res.json();
        const content = data.choices?.[0]?.message?.content;
        if (content) {
          const cleaned = content.replace(/^\s*```json\s*/i, '').replace(/\s*```\s*$/i, '').trim();
          return JSON.parse(cleaned);
        }
      }
    } catch (e) {
      console.warn('[Social Intelligence] OpenRouter error:', e.message);
    }
  }

  throw new Error('All LLM providers failed in Social Intelligence');
}

// ============================================================================
// WEB SEARCH HELPER (Tavily)
// ============================================================================
async function searchWeb(query, options = {}) {
  const { maxResults = 5 } = options;

  if (TAVILY_API_KEY) {
    try {
      const res = await fetchWithTimeout('https://api.tavily.com/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          api_key: TAVILY_API_KEY,
          query,
          search_depth: 'basic',
          max_results: maxResults,
          include_domains: options.includeDomains,
          exclude_domains: options.excludeDomains
        })
      }, 5000);

      if (res.ok) {
        const data = await res.json();
        return (data.results || []).map(r => ({
          title: r.title,
          url: r.url,
          snippet: r.content,
          date: r.published_date || null
        }));
      }
    } catch (e) {
      console.warn('[Social Intelligence] Tavily search error:', e.message);
    }
  }

  return [];
}

// ============================================================================
// STEP 1: EXTRACT OFFICIAL SOCIAL LINKS FROM COMPANY WEBSITE
// ============================================================================
async function extractSocialProfilesFromWebsite(websiteUrl) {
  const profiles = {
    website: websiteUrl,
    linkedin: null,
    youtube: null,
    twitter: null,
    github: null
  };

  if (!websiteUrl) return profiles;

  let targetUrl = websiteUrl;
  if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
    targetUrl = 'https://' + targetUrl;
  }

  try {
    const res = await fetchWithTimeout(targetUrl, { headers: BROWSER_HEADERS }, 5000);
    if (!res.ok) return profiles;

    const html = await res.text();
    const $ = cheerio.load(html);

    $('a').each((_, el) => {
      const href = $(el).attr('href');
      if (!href) return;

      const trimmed = href.trim();

      // LinkedIn Company Profile
      if (trimmed.includes('linkedin.com/company/') && !profiles.linkedin) {
        const cleanLi = trimmed.split('?')[0].replace(/\/+$/, '');
        profiles.linkedin = { url: cleanLi, verified: true, source: 'website' };
      }

      // YouTube Channel
      if ((trimmed.includes('youtube.com/@') || trimmed.includes('youtube.com/channel/') || trimmed.includes('youtube.com/c/')) && !profiles.youtube) {
        const cleanYt = trimmed.split('?')[0].replace(/\/+$/, '');
        profiles.youtube = { url: cleanYt, verified: true, source: 'website' };
      }

      // Twitter / X
      if ((trimmed.includes('twitter.com/') || trimmed.includes('x.com/')) && !profiles.twitter) {
        const cleanTw = trimmed.split('?')[0].replace(/\/+$/, '');
        profiles.twitter = { url: cleanTw, verified: true, source: 'website' };
      }

      // GitHub
      if (trimmed.includes('github.com/') && !profiles.github && !trimmed.includes('github.com/features')) {
        const cleanGh = trimmed.split('?')[0].replace(/\/+$/, '');
        profiles.github = { url: cleanGh, verified: true, source: 'website' };
      }
    });

  } catch (err) {
    console.warn('[Social Intelligence] Error crawling website for social links:', err.message);
  }

  return profiles;
}

// ============================================================================
// STEP 2: YOUTUBE ACTIVITY DISCOVERY & VERIFICATION
// ============================================================================
async function getYouTubeActivities(companyName, verifiedYtProfile) {
  const activities = [];

  // A. If verified YouTube channel from official site
  if (verifiedYtProfile?.url) {
    let handleOrPath = '';
    const match = verifiedYtProfile.url.match(/youtube\.com\/(@[a-zA-Z0-9_.-]+|channel\/[a-zA-Z0-9_.-]+|c\/[a-zA-Z0-9_.-]+)/i);
    if (match) {
      handleOrPath = match[1];
    }

    try {
      const results = await searchWeb(`site:youtube.com "${handleOrPath || companyName}" watch`, { maxResults: 5 });
      for (const r of results) {
        if (r.url.includes('youtube.com/watch')) {
          activities.push({
            platform: 'youtube',
            type: 'video',
            url: r.url,
            title: r.title ? r.title.replace(' - YouTube', '').trim() : 'Offizielles Video',
            snippet: r.snippet || '',
            date: r.date || 'Aktuell',
            channelUrl: verifiedYtProfile.url,
            verifiedChannel: true
          });
        }
      }
    } catch (e) {
      console.warn('[Social Intelligence] Error searching verified channel videos:', e.message);
    }
  }

  // B. Targeted official search if no activities yet
  if (activities.length === 0 && companyName && companyName.length >= 2) {
    try {
      const results = await searchWeb(`site:youtube.com/watch "${companyName}"`, { maxResults: 4 });
      const compLower = companyName.toLowerCase();
      const compWords = compLower.split(/\s+/).filter(w => w.length > 2);
      
      for (const r of results) {
        if (r.url && r.url.includes('youtube.com/watch') && !activities.some(a => a.url === r.url)) {
          const text = ((r.title || '') + ' ' + (r.snippet || '')).toLowerCase();
          // STRICT CHECK: The title or snippet MUST explicitly mention the company name or core distinctive words
          const matchesCompany = text.includes(compLower) || (compWords.length > 0 && compWords.every(w => text.includes(w)));
          if (matchesCompany) {
            activities.push({
              platform: 'youtube',
              type: 'video',
              url: r.url,
              title: r.title ? r.title.replace(' - YouTube', '').trim() : 'Produktvideo / Keynote',
              snippet: r.snippet || '',
              date: r.date || 'Aktuell',
              channelUrl: null,
              verifiedChannel: false
            });
          }
        }
      }
    } catch (e) {
      console.warn('[Social Intelligence] Error finding general YouTube videos:', e.message);
    }
  }

  return activities;
}

// ============================================================================
// STEP 3: LINKEDIN & PUBLIC POST DISCOVERY
// ============================================================================
async function getLinkedInAndPublicActivities(companyName, verifiedLiProfile) {
  const activities = [];

  // Add verified company profile
  if (verifiedLiProfile?.url) {
    activities.push({
      platform: 'linkedin',
      type: 'profile',
      url: verifiedLiProfile.url,
      title: `Offizielles LinkedIn-Profil: ${companyName}`,
      snippet: `Verifiziertes Unternehmensprofil auf LinkedIn für Direktansprache und Kontakt-Recherche.`,
      date: 'Profil',
      verifiedChannel: true
    });
  }

  // Search for official articles / updates / PR announcements
  try {
    const results = await searchWeb(`site:linkedin.com/pulse OR site:linkedin.com/posts "${companyName}"`, { maxResults: 3 });
    const compLower = (companyName || '').toLowerCase();
    for (const r of results) {
      if ((r.url.includes('linkedin.com/pulse/') || r.url.includes('linkedin.com/posts/')) && !activities.some(a => a.url === r.url)) {
        const text = ((r.title || '') + ' ' + (r.snippet || '')).toLowerCase();
        if (compLower && text.includes(compLower)) {
          activities.push({
            platform: 'linkedin',
            type: 'post',
            url: r.url,
            title: r.title ? r.title.replace(' | LinkedIn', '').trim() : `LinkedIn Update ${companyName}`,
            snippet: r.snippet || '',
            date: r.date || 'Kürzlich',
            verifiedChannel: false
          });
        }
      }
    }
  } catch (e) {
    console.warn('[Social Intelligence] Error finding LinkedIn posts:', e.message);
  }

  return activities;
}

// ============================================================================
// STEP 4: LLM RELEVANCE SCORING & QUALITY FILTERING
// ============================================================================
const UNRELATED_TOPIC_BLACKLIST = [
  'star wars', 'fortnite', 'minecraft', 'gameplay', 'walkthrough episode',
  'anime episode', 'movie full', 'soundtrack ost', 'let\'s play', 'reaction video',
  'weather channel', 'history channel', 'vpn tutorial', 'monarch watch'
];

async function scoreActivitiesWithLLM(activities, context, activeLangKey = 'de') {
  if (!activities || activities.length === 0) return [];

  const targetLangStr = LANG_MAP[activeLangKey] || LANG_MAP['de'];

  // Preliminary filter: remove obvious spam
  const filtered = activities.filter(a => {
    const lower = (a.title + ' ' + a.snippet).toLowerCase();
    return !UNRELATED_TOPIC_BLACKLIST.some(bad => lower.includes(bad));
  });

  if (filtered.length === 0) return [];

  const prompt = `You are an elite B2B Sales Research Auditor.
Evaluate the following social activities for target company "${context.companyName}".

Target Offering Context:
${context.offering ? JSON.stringify(context.offering) : 'B2B Sales Software / Services'}

Target Trigger / Signal Context:
${context.trigger ? JSON.stringify(context.trigger) : 'Expansion / Modernization'}

LANGUAGE REQUIREMENT:
All explanation strings (relevance_reason, summary) MUST be in: ${targetLangStr}.

ACTIVITIES TO EVALUATE:
${JSON.stringify(filtered, null, 2)}

TASK:
1. Filter out any completely unrelated noise (e.g. video games, pop culture, wrong companies with identical names).
2. For each relevant activity, assign a relevance_score (0-100) based on how strong of a sales conversation hook it provides.
3. Provide a brief 1-sentence relevance_reason in ${targetLangStr}.

Return VALID JSON ONLY in this format:
{
  "evaluated_activities": [
    {
      "url": "exact URL from input",
      "platform": "youtube or linkedin",
      "type": "video or post or profile",
      "title": "Cleaned title",
      "snippet": "Short excerpt",
      "date": "Date string",
      "relevance_score": 85,
      "relevance_reason": "Kurze Begründung auf ${targetLangStr}",
      "is_verified": true
    }
  ]
}`;

  try {
    const evaluation = await callLLM(prompt, 0.2);
    if (evaluation?.evaluated_activities?.length > 0) {
      return evaluation.evaluated_activities
        .filter(item => item.relevance_score >= 40 || item.type === 'profile')
        .sort((a, b) => (b.relevance_score || 0) - (a.relevance_score || 0));
    }
  } catch (err) {
    console.warn('[Social Intelligence] LLM scoring fallback:', err.message);
  }

  const compLower = (context.companyName || '').toLowerCase();
  return activities.filter(a => {
    if (a.verifiedChannel || a.type === 'profile') return true;
    const text = (a.title + ' ' + a.snippet).toLowerCase();
    const hasBlacklist = UNRELATED_TOPIC_BLACKLIST.some(b => text.includes(b));
    const hasCompany = compLower && text.includes(compLower);
    return !hasBlacklist && hasCompany;
  });
}

// ============================================================================
// STEP 5: OUTREACH GENERATOR (Comment + Direct Message — AUTO POST LANG + REVIEW TRANSLATION + LANDING PAGE LINK)
// ============================================================================
async function generateSocialOutreach(params) {
  const { activity, companyName, trigger, offering, contact, targetPostLang, targetLang, uiLang, lang } = params;

  // 1. Auto-Detect language of source activity strictly from original title
  let detectedLang = 'en';
  const titleText = (activity.title || '').toLowerCase();
  
  if (/[äöüß]/.test(titleText) || /\b(und|der|die|das|wir|fuer|gmbh|unternehmen|vertrieb|schmerzpunkte|kunden|erfolg|beratung|anleitung|erfahrungen)\b/i.test(titleText)) {
    detectedLang = 'de';
  } else if (/\b(le|la|les|des|pour|avec|nous|entreprise|solution|gestion|connaissance|avis|comment)\b/i.test(titleText)) {
    detectedLang = 'fr';
  } else if (/\b(el|la|los|las|para|con|nosotros|empresa|ventas|conocimiento|como|guia)\b/i.test(titleText)) {
    detectedLang = 'es';
  } else if (/\b(il|la|gli|per|con|noi|azienda|vendite|conoscenza|recensione)\b/i.test(titleText)) {
    detectedLang = 'it';
  } else if (/\b(het|de|een|voor|met|wij|bedrijf|kennis|ervaringen)\b/i.test(titleText)) {
    detectedLang = 'nl';
  } else {
    detectedLang = 'en';
  }

  // Determine post language: use explicit targetPostLang if set and !== 'auto', else detected source language
  let postLangKey = detectedLang;
  if (targetPostLang && targetPostLang !== 'auto') {
    postLangKey = targetPostLang;
  } else if (targetLang && targetLang !== 'auto' && targetLang !== uiLang && targetLang !== lang) {
    postLangKey = targetLang;
  }

  const userUiLangKey = uiLang || lang || 'de';

  const postLanguageStr = LANG_MAP[postLangKey] || LANG_MAP['en'];
  const postLangDisplayName = LANG_NAMES[postLangKey] || 'English';
  const uiLanguageStr = LANG_MAP[userUiLangKey] || LANG_MAP['de'];

  // User landing page URL
  const landingPageUrl = offering?.website || offering?.landing_page || 'https://nexus-hit.netlify.app';

  const prompt = `You are an elite B2B Social Selling & Revenue Conversion Strategist in "NeXus Revenue OS".

COMMERCIAL SALES PURPOSE:
We are engaging with this public post/video specifically as an active B2B sales opportunity.
The goal is to generate inbound interest and drive traffic/leads directly to our landing page: ${landingPageUrl}.
You MUST include a direct consultative invitation and the exact landing page link (${landingPageUrl}) in BOTH the public comment and the direct message.

CONTEXT:
- Target Company: "${companyName}"
- Target Decision Maker: "${contact?.name || 'Executive'}" (${contact?.role || 'Leader'})
- Verified Social Activity (${activity.platform}):
  * Title: "${activity.title}"
  * Excerpt/Content: "${activity.snippet}"
  * Date: "${activity.date}"
  * URL: "${activity.url}"
- Intent Signal / Trigger Event: "${trigger?.title || trigger?.description || 'Expansion / Modernization'}"
- Our Offering: "${offering?.offering_name || 'NeXus Revenue OS'}" — ${offering?.positioning || 'B2B Sales Intelligence & Intent Detection'}
- Our Landing Page / Website URL: "${landingPageUrl}"

STRICT DUAL-LANGUAGE & LINK RULES:
1. "comment" and "direct_message" MUST be written 100% strictly in the POST LANGUAGE: 👉 ${postLanguageStr} 👈.
   NEVER write German if the post language is English (${postLanguageStr})!
2. "comment" and "direct_message" MUST BOTH contain our exact landing page link: ${landingPageUrl} with an appealing CTA.
3. "comment_translation", "direct_message_translation", and all "analysis" fields (post_summary, relevance_explanation) MUST be written in the USER'S UI LANGUAGE: 👉 ${uiLanguageStr} 👈 (so the user can review and understand everything in German/native UI).

TASKS:
1. Provide a 2-step analysis of the post (in ${uiLanguageStr}):
   - post_summary: What does this post/video actually state?
   - relevance_explanation: Why is this relevant to our offering and how does it create a sales opportunity?
2. Generate a high-converting PUBLIC COMMENT for the platform (${activity.platform}) in ${postLanguageStr}:
   - Address the video/post topic with expert insight.
   - Position our solution as the natural next step.
   - Include a clear, non-spammy commercial invitation including our URL: ${landingPageUrl}
3. Provide the exact TRANSLATION of the comment into ${uiLanguageStr}.
4. Generate a personalized DIRECT MESSAGE (LinkedIn InMail / DM) in ${postLanguageStr}:
   - Reference the post/video.
   - Value-first pitch with direct hook and link to ${landingPageUrl}.
5. Provide the exact TRANSLATION of the direct message into ${uiLanguageStr}.

Return VALID JSON ONLY:
{
  "post_lang": "${postLangKey}",
  "post_lang_label": "${postLangDisplayName}",
  "ui_lang": "${userUiLangKey}",
  "analysis": {
    "post_summary": "Summary in ${uiLanguageStr}",
    "relevance_explanation": "Relevance explanation in ${uiLanguageStr}",
    "recommended_action": "comment"
  },
  "comment": "Full comment text in ${postLanguageStr} with ${landingPageUrl} ready to post...",
  "comment_translation": "Übersetzung des Kommentars in ${uiLanguageStr} zur Prüfung...",
  "direct_message": "Full direct message text in ${postLanguageStr} with ${landingPageUrl} ready to send...",
  "direct_message_translation": "Übersetzung der Direktnachricht in ${uiLanguageStr} zur Prüfung...",
  "pitch_angle": "Strategic angle"
}`;

  const result = await callLLM(prompt, 0.4);
  return {
    ...result,
    post_lang: postLangKey,
    post_lang_label: postLangDisplayName,
    ui_lang: userUiLangKey
  };
}

// ============================================================================
// NETLIFY HANDLER
// ============================================================================
export const handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const body = event.body ? JSON.parse(event.body) : {};
    const { action, companyName, website, trigger, offering, contact, activity, targetPostLang, targetLang, uiLang, lang } = body;

    if (!companyName && !activity) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'companyName or activity required' }),
        headers: { 'Content-Type': 'application/json' }
      };
    }

    const activeLang = uiLang || lang || 'de';

    // 1. ACTION: DISCOVER ACTIVITIES
    if (action === 'discover_activities') {
      let resolvedWebsite = website;
      if (!resolvedWebsite) {
        const cleanName = companyName.toLowerCase().replace(/[^a-z0-9]/g, '');
        const candidates = [`https://www.${cleanName}.com`, `https://www.${cleanName}.de`, `https://${cleanName}.com`, `https://${cleanName}.ai`, `https://${cleanName}.io`];
        for (const cd of candidates) {
          try {
            const headRes = await fetchWithTimeout(cd, { method: 'HEAD', headers: BROWSER_HEADERS }, 2500);
            if (headRes.ok) {
              resolvedWebsite = cd;
              break;
            }
          } catch(e) {}
        }
        if (!resolvedWebsite) {
          const domRes = await searchWeb(`"${companyName}" official website homepage`, { maxResults: 1 });
          if (domRes.length > 0 && domRes[0].url) {
            resolvedWebsite = domRes[0].url;
          }
        }
      }

      let profiles = await extractSocialProfilesFromWebsite(resolvedWebsite);

      if (!profiles.linkedin) {
        const liRes = await searchWeb(`site:linkedin.com/company "${companyName}"`, { maxResults: 1 });
        if (liRes.length > 0 && liRes[0].url.includes('linkedin.com/company/')) {
          profiles.linkedin = { url: liRes[0].url, verified: false, source: 'search' };
        }
      }

      if (!profiles.youtube) {
        const ytRes = await searchWeb(`site:youtube.com (inurl:@ OR inurl:channel OR inurl:c) "${companyName}"`, { maxResults: 3 });
        for (const item of ytRes) {
          if (item.url && (item.url.includes('youtube.com/@') || item.url.includes('youtube.com/channel/') || item.url.includes('youtube.com/c/'))) {
            const match = item.url.match(/https?:\/\/(www\.)?youtube\.com\/(@|channel\/|c\/|user\/)[a-zA-Z0-9_.-]+/i);
            if (match) {
              profiles.youtube = { url: match[0], verified: false, source: 'search' };
              break;
            }
          }
        }
      }

      const [ytActivities, liActivities] = await Promise.all([
        getYouTubeActivities(companyName, profiles.youtube),
        getLinkedInAndPublicActivities(companyName, profiles.linkedin)
      ]);

      const allActivities = [...ytActivities, ...liActivities];

      const scoredActivities = await scoreActivitiesWithLLM(allActivities, {
        companyName,
        trigger,
        offering
      }, activeLang);

      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyName,
          website: profiles.website || resolvedWebsite,
          targetLang: activeLang,
          profiles: {
            linkedin: profiles.linkedin,
            youtube: profiles.youtube,
            twitter: profiles.twitter
          },
          activities: scoredActivities,
          status: scoredActivities.length > 0 ? 'activities_found' : 'no_activities_found'
        })
      };
    }

    // 2. ACTION: GENERATE SOCIAL OUTREACH
    if (action === 'generate_social_outreach') {
      if (!activity) {
        return {
          statusCode: 400,
          body: JSON.stringify({ error: 'activity data is required for outreach generation' }),
          headers: { 'Content-Type': 'application/json' }
        };
      }

      const outreachResult = await generateSocialOutreach({
        activity,
        companyName,
        trigger,
        offering,
        contact,
        targetPostLang,
        targetLang,
        uiLang: activeLang,
        lang: activeLang
      });

      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(outreachResult)
      };
    }

    return {
      statusCode: 400,
      body: JSON.stringify({ error: `Unknown action: ${action}` }),
      headers: { 'Content-Type': 'application/json' }
    };
  } catch (err) {
    console.error('[nexus-social-intelligence] Error:', err);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: err.message })
    };
  }
};
