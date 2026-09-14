import * as cheerio from 'cheerio';
import crypto from 'crypto';

const BROWSER_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9,de-DE,de;q=0.8,fr;q=0.7,es;q=0.7,*;q=0.5'
};

const LANG_MAP = {
  de: 'DEUTSCH (professionelles B2B-Deutsch)',
  en: 'ENGLISH (fluent, compelling, high-level B2B business English)',
  es: 'ESPAÑOL (español de negocios profesional y persuasivo)',
  fr: 'FRANÇAIS (français d affaires professionnel et percutant)',
  it: 'ITALIANO (italiano aziendale professionale e convincente)',
  nl: 'NEDERLANDS (professioneel zakelijk Nederlands)',
  el: 'ΕΛΛΗΝΙΚΑ (επαγγελματικά επιχειρηματικά ελληνικά)'
};

async function fetchWithTimeout(url, options = {}, timeoutMs = 8000) {
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

// ============================================================================
// LLM CALL (DeepSeek → Mistral → OpenRouter → OpenAI)
// ============================================================================
async function callLLM(prompt, temperature = 0.4) {
  const providers = [
    { url: 'https://api.deepseek.com/chat/completions', key: process.env.DEEPSEEK_API_KEY, model: 'deepseek-chat' },
    { url: 'https://api.mistral.ai/v1/chat/completions', key: process.env.MISTRAL_API_KEY || process.env.VITE_MISTRAL_API_KEY, model: 'mistral-small-latest' },
    { url: 'https://openrouter.ai/api/v1/chat/completions', key: process.env.OPENROUTER_API_KEY, model: 'google/gemma-4-26b-a4b-it:free' },
    { url: 'https://api.openai.com/v1/chat/completions', key: process.env.OPENAI_API_KEY, model: 'gpt-4o-mini' }
  ];

  for (const p of providers) {
    if (!p.key) continue;
    try {
      const res = await fetchWithTimeout(p.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${p.key}` },
        body: JSON.stringify({
          model: p.model,
          messages: [
            { role: 'system', content: 'You are a multi-language B2B Social Intelligence Engine. You always return valid JSON only, without markdown code blocks.' },
            { role: 'user', content: prompt }
          ],
          temperature,
          max_tokens: 1800
        })
      }, 9000);

      if (!res.ok) continue;
      const data = await res.json();
      const text = data.choices?.[0]?.message?.content || '';
      const cleaned = text.replace(/```(?:json)?/g, '').replace(/```/g, '').trim();
      try {
        return JSON.parse(cleaned);
      } catch (e) {
        return { raw: text };
      }
    } catch (e) {
      continue;
    }
  }
  return null;
}

// ============================================================================
// SOCIAL PROFILES EXTRACTION (Website Crawling)
// ============================================================================
async function extractSocialProfilesFromWebsite(websiteUrl) {
  const profiles = {
    linkedin: null,
    youtube: null,
    twitter: null,
    instagram: null,
    website: websiteUrl || null
  };

  if (!websiteUrl) return profiles;

  let targetUrl = websiteUrl.trim();
  if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
    targetUrl = 'https://' + targetUrl;
  }

  try {
    const res = await fetchWithTimeout(targetUrl, { headers: BROWSER_HEADERS }, 5000);
    if (res.ok) {
      const html = await res.text();
      const $ = cheerio.load(html);

      $('a[href]').each((_, el) => {
        const href = $(el).attr('href')?.trim();
        if (!href) return;

        // LinkedIn
        if (/linkedin\.com\/company\/[a-zA-Z0-9_-]+/i.test(href) && !profiles.linkedin) {
          const match = href.match(/https?:\/\/(www\.)?linkedin\.com\/company\/[a-zA-Z0-9_-]+/i);
          if (match) profiles.linkedin = { url: match[0], verified: true, source: 'website_link' };
        }
        // YouTube
        if (/youtube\.com\/(@|channel\/|c\/|user\/)[a-zA-Z0-9_.-]+/i.test(href) && !profiles.youtube) {
          const match = href.match(/https?:\/\/(www\.)?youtube\.com\/(@|channel\/|c\/|user\/)[a-zA-Z0-9_.-]+/i);
          if (match) profiles.youtube = { url: match[0], verified: true, source: 'website_link' };
        }
        // Twitter / X
        if (/(twitter\.com|x\.com)\/[a-zA-Z0-9_]+/i.test(href) && !profiles.twitter) {
          const match = href.match(/https?:\/\/(www\.)?(twitter\.com|x\.com)\/[a-zA-Z0-9_]+/i);
          if (match && !/intent|share/i.test(match[0])) {
            profiles.twitter = { url: match[0], verified: true, source: 'website_link' };
          }
        }
      });
    }
  } catch (e) {
    console.warn(`[Social Discovery] Crawl failed for ${targetUrl}:`, e.message);
  }

  return profiles;
}

// ============================================================================
// SEARCH ENGINE DISCOVERY (Tavily with Search Fallback)
// ============================================================================
async function searchWeb(query, options = {}) {
  const tavilyKey = process.env.TAVILY_API_KEY || process.env.VITE_TAVILY_API_KEY;
  if (tavilyKey) {
    try {
      const res = await fetchWithTimeout('https://api.tavily.com/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          api_key: tavilyKey,
          query,
          search_depth: 'advanced',
          max_results: options.maxResults || 6,
          include_answer: false
        })
      }, 8000);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.results)) {
          return data.results;
        }
      }
    } catch (e) {
      console.warn('[Social Search] Tavily search error:', e.message);
    }
  }
  return [];
}

// ============================================================================
// YOUTUBE ACTIVITY RETRIEVAL (RSS / Page / Search)
// ============================================================================
async function getYouTubeActivities(companyName, youtubeProfile) {
  const activities = [];

  // 1. Suche nach Videos des Unternehmens auf YouTube
  const ytSearchQuery = `site:youtube.com inurl:watch "${companyName}"`;
  const searchResults = await searchWeb(ytSearchQuery, { maxResults: 5 });

  for (const item of searchResults) {
    if (item.url && item.url.includes('youtube.com/watch')) {
      activities.push({
        id: crypto.createHash('md5').update(item.url).digest('hex'),
        platform: 'youtube',
        type: 'video',
        title: item.title?.replace(/ - YouTube$/i, '').trim() || 'Video',
        url: item.url,
        snippet: item.content || item.title || '',
        date: item.published_date || 'Recent',
        channel_name: companyName,
        verified: !!youtubeProfile?.verified
      });
    }
  }

  // 2. Falls ein YouTube-Kanal verlinkt ist, aber keine Videos über inurl:watch kamen:
  if (activities.length === 0 && youtubeProfile?.url) {
    const channelQuery = `"${companyName}" ${youtubeProfile.url}`;
    const channelResults = await searchWeb(channelQuery, { maxResults: 3 });
    for (const item of channelResults) {
      if (item.url && item.url.includes('youtube.com/watch')) {
        activities.push({
          id: crypto.createHash('md5').update(item.url).digest('hex'),
          platform: 'youtube',
          type: 'video',
          title: item.title?.replace(/ - YouTube$/i, '').trim() || 'Video',
          url: item.url,
          snippet: item.content || '',
          date: item.published_date || 'Recent',
          channel_name: companyName,
          verified: true
        });
      }
    }
  }

  return activities;
}

// ============================================================================
// LINKEDIN & PUBLIC ACTIVITY RETRIEVAL
// ============================================================================
async function getLinkedInAndPublicActivities(companyName, linkedinProfile) {
  const activities = [];

  const liQuery = `site:linkedin.com "${companyName}"`;
  const results = await searchWeb(liQuery, { maxResults: 4 });

  for (const item of results) {
    if (!item.url) continue;
    const isPost = item.url.includes('/posts/') || item.url.includes('/pulse/') || item.url.includes('/feed/update/');

    const matchesCompany = (item.title + ' ' + item.content).toLowerCase().includes(companyName.toLowerCase());

    if (matchesCompany && isPost) {
      activities.push({
        id: crypto.createHash('md5').update(item.url).digest('hex'),
        platform: 'linkedin',
        type: 'post',
        title: item.title?.replace(/ \| LinkedIn$/i, '').trim() || 'LinkedIn Post',
        url: item.url,
        snippet: item.content || '',
        date: item.published_date || 'Recent',
        author: companyName,
        verified: true
      });
    }
  }

  return activities;
}

// ============================================================================
// RELEVANCE SCORING & FILTERING VIA LLM (MULTILINGUAL)
// ============================================================================
async function scoreActivitiesWithLLM(activities, context, targetLang = 'de') {
  if (!activities || activities.length === 0) return [];

  const { companyName, trigger, offering } = context;
  const langPrompt = LANG_MAP[targetLang] || LANG_MAP['de'];

  const prompt = `Analyze the following verified social media activities of "${companyName}".
Context:
- Trigger Event / Opportunity: "${trigger?.title || trigger?.description || 'Business growth / expansion / software needs'}"
- Our Offering: "${offering?.offering_name || offering?.positioning || 'B2B Solution'}"

LANGUAGE INSTRUCTION: Write all explanation fields in ${langPrompt}.

Activities:
${JSON.stringify(activities.map(a => ({ id: a.id, platform: a.platform, title: a.title, snippet: a.snippet, date: a.date })), null, 2)}

Return a JSON array:
[
  {
    "id": "Activity-ID",
    "relevance_score": 85, // Integer 0 to 100
    "relevance_reason": "Clear concise explanation of why this activity provides a sales opportunity (1 sentence)",
    "topic_summary": "Short topic summary"
  }
]`;

  try {
    const scored = await callLLM(prompt, 0.2);
    if (Array.isArray(scored)) {
      return activities.map(act => {
        const match = scored.find(s => s.id === act.id);
        return {
          ...act,
          relevance_score: match?.relevance_score ?? 50,
          relevance_reason: match?.relevance_reason ?? 'Verified public company activity.',
          topic_summary: match?.topic_summary ?? act.title
        };
      }).sort((a, b) => b.relevance_score - a.relevance_score);
    }
  } catch (e) {
    console.warn('[Social Scoring] LLM scoring failed, using default order:', e.message);
  }

  return activities;
}

// ============================================================================
// OUTREACH GENERATOR (Comment + Direct Message — MULTILINGUAL)
// ============================================================================
async function generateSocialOutreach(params) {
  const { activity, companyName, trigger, offering, contact, targetLang = 'de', lang = 'de' } = params;

  const activeLangKey = targetLang && targetLang !== 'auto' ? targetLang : (lang || 'de');
  const targetLanguageStr = LANG_MAP[activeLangKey] || LANG_MAP['de'];

  const prompt = `You are an elite B2B Social Selling & Outreach Strategist in "NeXus Revenue OS".

CONTEXT:
- Target Company: "${companyName}"
- Target Decision Maker: "${contact?.name || 'Executive'}" (${contact?.role || 'Leader'})
- Verified Social Activity (${activity.platform}):
  * Title: "${activity.title}"
  * Excerpt/Content: "${activity.snippet}"
  * Date: "${activity.date}"
  * URL: "${activity.url}"
- Intent Signal / Trigger Event: "${trigger?.title || trigger?.description || 'Expansion / Modernization'}"
- Our Offering: "${offering?.offering_name || 'B2B Sales Intelligence'}" — ${offering?.positioning || ''}

CRITICAL LANGUAGE REQUIREMENT:
You MUST write all output fields (analysis, comment, direct_message, pitch_angle) strictly in:
👉 ${targetLanguageStr} 👈

TASKS:
1. Provide a 2-step analysis of the post:
   - post_summary: What does this post/video actually state?
   - relevance_explanation: Why is this relevant to our offering and the intent signal?
2. Generate a high-value PUBLIC COMMENT for the platform (${activity.platform}):
   - Directly and specifically address the topic of the post/video.
   - Deliver valuable industry insights.
   - Establish a natural, non-aggressive link to the challenges involved.
   - NO spam, NO pushy sales pitch ("We can help you..."), but demonstrable competence.
3. Generate a personalized DIRECT MESSAGE (LinkedIn InMail / DM):
   - Explicitly reference this specific post/video.
   - 3-4 sentences, respectful, clear hook, invitation to a brief peer exchange.

Return VALID JSON ONLY:
{
  "analysis": {
    "post_summary": "...",
    "relevance_explanation": "...",
    "recommended_action": "comment"
  },
  "comment": "Full comment text in ${activeLangKey}...",
  "direct_message": "Full direct message text in ${activeLangKey}...",
  "pitch_angle": "Strategic angle"
}`;

  const result = await callLLM(prompt, 0.4);
  return result;
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
    const { action, companyName, website, trigger, offering, contact, activity, targetLang, lang } = body;

    if (!companyName && !activity) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'companyName or activity required' }),
        headers: { 'Content-Type': 'application/json' }
      };
    }

    const activeLang = targetLang && targetLang !== 'auto' ? targetLang : (lang || 'de');

    // 1. ACTION: DISCOVER ACTIVITIES
    if (action === 'discover_activities') {
      let profiles = await extractSocialProfilesFromWebsite(website);

      if (!profiles.linkedin) {
        const liRes = await searchWeb(`site:linkedin.com/company "${companyName}"`, { maxResults: 1 });
        if (liRes.length > 0 && liRes[0].url.includes('linkedin.com/company/')) {
          profiles.linkedin = { url: liRes[0].url, verified: false, source: 'search' };
        }
      }

      if (!profiles.youtube) {
        const ytRes = await searchWeb(`site:youtube.com "${companyName}"`, { maxResults: 1 });
        if (ytRes.length > 0 && (ytRes[0].url.includes('youtube.com/@') || ytRes[0].url.includes('youtube.com/channel/'))) {
          profiles.youtube = { url: ytRes[0].url, verified: false, source: 'search' };
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
          website: profiles.website,
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
        targetLang: activeLang,
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
