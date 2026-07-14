// ──────────────────────────────────────────────────────────────
// lead-scraper.mjs — Global Lead Radar Scraper v2
// Scheduled function: crawls Reddit RSS for creator frustration
// Inserts leads into Supabase leads table
// ──────────────────────────────────────────────────────────────

const SUPABASE_URL = 'https://irumowvmhvrofezwvnop.supabase.co'
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || ''

const RSS_FEEDS = [
  // 🇺🇸 North America — Gaming
  { url: 'https://www.reddit.com/r/Twitch/new/.rss?limit=25', continent: 'na', platform: 'twitch', lang: 'en', badge: 'Gamer' },
  { url: 'https://www.reddit.com/r/NewTubers/new/.rss?limit=25', continent: 'na', platform: 'reddit', lang: 'en', badge: 'Creator' },
  { url: 'https://www.reddit.com/r/letsplay/new/.rss?limit=25', continent: 'na', platform: 'reddit', lang: 'en', badge: 'Gamer' },
  { url: 'https://www.reddit.com/r/gaming/new/.rss?limit=25', continent: 'na', platform: 'reddit', lang: 'en', badge: 'Gamer' },

  // 🇺🇸 North America — Creator / Side-Hustle
  { url: 'https://www.reddit.com/r/SideHustle/new/.rss?limit=25', continent: 'na', platform: 'reddit', lang: 'en', badge: 'Business' },
  { url: 'https://www.reddit.com/r/Entrepreneur/new/.rss?limit=25', continent: 'na', platform: 'reddit', lang: 'en', badge: 'Business' },
  { url: 'https://www.reddit.com/r/LinkedInTips/new/.rss?limit=25', continent: 'eu', platform: 'reddit', lang: 'en', badge: 'Creator' },
  { url: 'https://www.reddit.com/r/content_marketing/new/.rss?limit=25', continent: 'na', platform: 'reddit', lang: 'en', badge: 'Creator' },

  // 🇪🇺 Europe — Creator / Freelancer
  { url: 'https://www.reddit.com/r/Freelance/new/.rss?limit=25', continent: 'eu', platform: 'reddit', lang: 'en', badge: 'Business' },
  { url: 'https://www.reddit.com/r/socialmedia/new/.rss?limit=25', continent: 'eu', platform: 'reddit', lang: 'en', badge: 'Creator' },
  { url: 'https://www.reddit.com/r/SmallYTChannel/new/.rss?limit=25', continent: 'eu', platform: 'reddit', lang: 'en', badge: 'Creator' },
  { url: 'https://www.reddit.com/r/PartneredYoutube/new/.rss?limit=25', continent: 'eu', platform: 'reddit', lang: 'en', badge: 'Creator' },

  // 🇧🇷 Latin America — Gaming
  { url: 'https://www.reddit.com/r/streaming/new/.rss?limit=25', continent: 'latam', platform: 'twitch', lang: 'en', badge: 'Gamer' },
  { url: 'https://www.reddit.com/r/YouTube_Startups/new/.rss?limit=25', continent: 'latam', platform: 'reddit', lang: 'en', badge: 'Creator' },

  // 🇦🇺 Asia-Pacific — Gaming
  { url: 'https://www.reddit.com/r/twitchstreams/new/.rss?limit=25', continent: 'apac', platform: 'twitch', lang: 'en', badge: 'Gamer' },
  { url: 'https://www.reddit.com/r/YouTubeGrowth/new/.rss?limit=25', continent: 'apac', platform: 'reddit', lang: 'en', badge: 'Creator' },
]

// ── Frustration Keywords (EN + DE) ──

const FRUSTRATION_KEYWORDS_EN = [
  // Gaming / Streaming
  'no viewers', 'zero viewers', '0 viewers', 'nobody watches', 'no one watches',
  'no subscribers', 'stuck at', 'not growing', 'no growth', 'losing subs',
  'streaming to nobody', 'waste of time', 'give up', 'is it worth', 'shadowbanned',
  'algorithm hates', 'nobody sees', 'no engagement', 'dead channel', 'no notifications',
  'nobody raid', 'no raids', 'no clips', 'not getting paid', 'no income',
  // Creator / Content
  'writing hooks', 'video title', 'social media strategy', 'how to market my',
  'need content ideas', 'stuck at 200 views', 'no ideas', 'content ideas',
  'writer block', 'burnout', 'creative block', 'no inspiration',
  'how to grow', 'tips for growing', 'stuck at 100', 'stuck at 500', 'stuck at 1000',
  'no brand deals', 'no sponsor', 'cannot monetize', 'no monetization',
  // Side-Hustle / Business
  'nobody buys', 'no clients', 'no sales', 'no leads', 'no traffic',
  'no orders', 'no revenue', 'no profit', 'not making money', 'wasted money',
  'failed launch', 'no engagement', 'low reach', 'no impressions',
]

const FRUSTRATION_KEYWORDS_DE = [
  // Gaming / Streaming
  'keine viewer', 'keine Zuschauer', 'niemand schaut', 'kein Wachstum',
  'verliere subscriber', 'nicht gewachsen', 'shadowbanned', 'Algorithmus hasst',
  'niemand sieht', 'kein Engagement', 'totale Zuschauerzahl', 'kein Raid',
  'kein Einkommen', 'kein Geld', 'umsonst', 'Zeitverschwendung',
  // Creator / Content
  'text schreiben', 'video titel', 'social media plan', 'wie vermarkten',
  'content ideen', 'schreibblockade', 'keine Ideen', 'kreativblock',
  'wie wachsen', 'festgehalten bei', 'keine Sponsoren', 'kein Brand Deal',
  'nicht monetarisierbar', 'keine Marken', 'keine Zusammenarbeit',
  // Freelancer / Business
  'keine Kunden', 'keine Aufträge', 'kein Umsatz', 'kein Gewinn',
  'kein Verkauf', 'kein Traffic', 'keine Leads', 'gescheitert',
  'nicht rentabel', 'falsche Investition', 'kein Erfolg',
]

const ALL_KEYWORDS = [...FRUSTRATION_KEYWORDS_EN, ...FRUSTRATION_KEYWORDS_DE]

// ── RSS XML Parsing (lightweight, no dependencies) ──

function extractEntries(xml) {
  const entries = []
  const itemRegex = /<entry>([\s\S]*?)<\/entry>/gi
  let match
  while ((match = itemRegex.exec(xml)) !== null) {
    const block = match[1]
    const title = extractTag(block, 'title')
    const content = extractTag(block, 'content') || extractTag(block, 'summary') || ''
    const link = extractTag(block, 'link') || ''
    const published = extractTag(block, 'published') || extractTag(block, 'updated') || ''
    if (title || content) {
      entries.push({ title: title || '', content: content || '', link, published })
    }
  }
  return entries
}

function extractTag(xml, tag) {
  const regex = new RegExp(`<${tag}[^>]*>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?<\\/${tag}>`, 'i')
  const m = xml.match(regex)
  return m ? m[1].trim() : ''
}

// ── Keyword Matching ──

function matchesFrustration(text) {
  const lower = text.toLowerCase()
  for (const kw of ALL_KEYWORDS) {
    if (lower.includes(kw)) return true
  }
  return false
}

// ── Deduplication ──

async function fetchExistingUrls() {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/leads?select=source_url&limit=1000&order=created_at.desc`,
    {
      headers: {
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
      }
    }
  )
  if (!res.ok) return new Set()
  const data = await res.json()
  return new Set(data.map(l => l.source_url).filter(Boolean))
}

async function insertLead(lead) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/leads`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Prefer': 'return=minimal',
    },
    body: JSON.stringify(lead),
  })
  return res.ok
}

// ── Main Handler ──

export default async function handler(request) {
  // Only allow scheduled or manual triggers
  if (request && request.method === 'GET') {
    const auth = request.headers?.authorization || ''
    if (!auth.includes(SUPABASE_SERVICE_KEY)) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
    }
  }

  console.log(`[LeadScraper] Starting scrape run at ${new Date().toISOString()}`)

  const existingUrls = await fetchExistingUrls()
  let totalFetched = 0
  let totalInserted = 0
  let totalSkipped = 0

  for (const feed of RSS_FEEDS) {
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 10000)

      const res = await fetch(feed.url, {
        signal: controller.signal,
        headers: { 'User-Agent': 'HappinessLeadRadar/1.0' },
      })
      clearTimeout(timeout)

      if (!res.ok) {
        console.warn(`[LeadScraper] RSS ${res.status}: ${feed.url}`)
        continue
      }

      const xml = await res.text()
      const entries = extractEntries(xml)
      totalFetched += entries.length

      for (const entry of entries) {
        const fullText = `${entry.title} ${entry.content}`.trim()
        if (!matchesFrustration(fullText)) continue

        const sourceUrl = entry.link || feed.url
        if (existingUrls.has(sourceUrl)) {
          totalSkipped++
          continue
        }

        const plainText = fullText
          .replace(/<[^>]*>/g, '')
          .replace(/\s+/g, ' ')
          .trim()
          .slice(0, 2000)

        const inserted = await insertLead({
          platform: feed.platform,
          continent: feed.continent,
          lang: feed.lang,
          source_url: sourceUrl,
          text: plainText,
          status: 'new',
          badge: feed.badge || null,
        })

        if (inserted) {
          existingUrls.add(sourceUrl)
          totalInserted++
        }
      }
    } catch (err) {
      console.warn(`[LeadScraper] Feed error (${feed.url}):`, err.message)
    }
  }

  const summary = `Scraped ${totalFetched} entries, inserted ${totalInserted} new leads, skipped ${totalSkipped} duplicates`
  console.log(`[LeadScraper] ${summary}`)

  return new Response(JSON.stringify({
    success: true,
    fetched: totalFetched,
    inserted: totalInserted,
    skipped: totalSkipped,
    timestamp: new Date().toISOString(),
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}
