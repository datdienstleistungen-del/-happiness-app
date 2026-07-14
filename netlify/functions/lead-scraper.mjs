// ──────────────────────────────────────────────────────────────
// lead-scraper.mjs — Global Lead Radar Scraper v3
// Universal Target Acquisition: Frustration + Milestones + Advice + Privacy + Builders
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

  // ── NEW: Milestone / Win Celebrations ──
  { url: 'https://www.reddit.com/r/Twitchsuccess/new/.rss?limit=25', continent: 'na', platform: 'reddit', lang: 'en', badge: 'Milestone' },
  { url: 'https://www.reddit.com/r/PartneredYoutube/new/.rss?limit=25', continent: 'eu', platform: 'reddit', lang: 'en', badge: 'Milestone' },
  { url: 'https://www.reddit.com/r/SmallYTChannel/new/.rss?limit=25', continent: 'na', platform: 'reddit', lang: 'en', badge: 'Milestone' },

  // ── NEW: Advice / Beginner Questions ──
  { url: 'https://www.reddit.com/r/streamingadvice/new/.rss?limit=25', continent: 'na', platform: 'reddit', lang: 'en', badge: 'Advice-Seeker' },
  { url: 'https://www.reddit.com/r/AskReddit/new/.rss?limit=25', continent: 'na', platform: 'reddit', lang: 'en', badge: 'Advice-Seeker' },
  { url: 'https://www.reddit.com/r/youtubers/new/.rss?limit=25', continent: 'na', platform: 'reddit', lang: 'en', badge: 'Advice-Seeker' },
  { url: 'https://www.reddit.com/r/Creator/new/.rss?limit=25', continent: 'eu', platform: 'reddit', lang: 'en', badge: 'Advice-Seeker' },

  // ── NEW: Privacy / GDPR / Safe AI ──
  { url: 'https://www.reddit.com/r/privacy/new/.rss?limit=25', continent: 'na', platform: 'reddit', lang: 'en', badge: 'Privacy-First' },
  { url: 'https://www.reddit.com/r/degoogle/new/.rss?limit=25', continent: 'eu', platform: 'reddit', lang: 'en', badge: 'Privacy-First' },
  { url: 'https://www.reddit.com/r/privacytoolsIO/new/.rss?limit=25', continent: 'eu', platform: 'reddit', lang: 'en', badge: 'Privacy-First' },
  { url: 'https://www.reddit.com/r/europrivacy/new/.rss?limit=25', continent: 'eu', platform: 'reddit', lang: 'en', badge: 'Privacy-First' },

  // ── NEW: Builders / Modders / Technical ──
  { url: 'https://www.reddit.com/r/Minecraft/new/.rss?limit=25', continent: 'na', platform: 'reddit', lang: 'en', badge: 'Builder' },
  { url: 'https://www.reddit.com/r/Minecraftbuilds/new/.rss?limit=25', continent: 'na', platform: 'reddit', lang: 'en', badge: 'Builder' },
  { url: 'https://www.reddit.com/r/Modding/new/.rss?limit=25', continent: 'na', platform: 'reddit', lang: 'en', badge: 'Builder' },
  { url: 'https://www.reddit.com/r/gamedev/new/.rss?limit=25', continent: 'na', platform: 'reddit', lang: 'en', badge: 'Builder' },
  { url: 'https://www.reddit.com/r/unrealengine/new/.rss?limit=25', continent: 'eu', platform: 'reddit', lang: 'en', badge: 'Builder' },
  { url: 'https://www.reddit.com/r/Unity3D/new/.rss?limit=25', continent: 'eu', platform: 'reddit', lang: 'en', badge: 'Builder' },
]

// ── Frustration Keywords (EN + DE) ──

const FRUSTRATION_KEYWORDS_EN = [
  'no viewers', 'zero viewers', '0 viewers', 'nobody watches', 'no one watches',
  'no subscribers', 'stuck at', 'not growing', 'no growth', 'losing subs',
  'streaming to nobody', 'waste of time', 'give up', 'is it worth', 'shadowbanned',
  'algorithm hates', 'nobody sees', 'no engagement', 'dead channel', 'no notifications',
  'nobody raid', 'no raids', 'no clips', 'not getting paid', 'no income',
  'writing hooks', 'video title', 'social media strategy', 'how to market my',
  'need content ideas', 'stuck at 200 views', 'no ideas', 'content ideas',
  'writer block', 'burnout', 'creative block', 'no inspiration',
  'how to grow', 'tips for growing', 'stuck at 100', 'stuck at 500', 'stuck at 1000',
  'no brand deals', 'no sponsor', 'cannot monetize', 'no monetization',
  'nobody buys', 'no clients', 'no sales', 'no leads', 'no traffic',
  'no orders', 'no revenue', 'no profit', 'not making money', 'wasted money',
  'failed launch', 'no engagement', 'low reach', 'no impressions',
]

const FRUSTRATION_KEYWORDS_DE = [
  'keine viewer', 'keine Zuschauer', 'niemand schaut', 'kein Wachstum',
  'verliere subscriber', 'nicht gewachsen', 'shadowbanned', 'Algorithmus hasst',
  'niemand sieht', 'kein Engagement', 'totale Zuschauerzahl', 'kein Raid',
  'kein Einkommen', 'kein Geld', 'umsonst', 'Zeitverschwendung',
  'text schreiben', 'video titel', 'social media plan', 'wie vermarkten',
  'content ideen', 'schreibblockade', 'keine Ideen', 'kreativblock',
  'wie wachsen', 'festgehalten bei', 'keine Sponsoren', 'kein Brand Deal',
  'nicht monetarisierbar', 'keine Marken', 'keine Zusammenarbeit',
  'keine Kunden', 'keine Aufträge', 'kein Umsatz', 'kein Gewinn',
  'kein Verkauf', 'kein Traffic', 'keine Leads', 'gescheitert',
  'nicht rentabel', 'falsche Investition', 'kein Erfolg',
]

// ── NEW: Growth / Milestone Keywords ──

const MILESTONE_KEYWORDS_EN = [
  'finally hit', 'celebrating my', 'just reached', 'hit 100', 'hit 500', 'hit 1000',
  'hit 5000', 'hit 10000', 'first 1000', 'first subscriber', 'first follower',
  'just got partnered', 'just got monetized', 'stream anniversary', 'one year',
  'milestone reached', 'biggest day', 'personal best', 'record viewers', 'all time high',
  'never thought', 'dream come true', 'so grateful', 'thank you all', 'we did it',
]

const MILESTONE_KEYWORDS_DE = [
  'endlich geschafft', 'meilenstein', 'feiere ich', 'gerade erreicht',
  'ersten 100', 'ersten 1000', 'erster subscriber', 'erster follower',
  'gerade monetarisiert', 'stream jahrestag', 'jahr', 'persönlicher rekord',
  'nie gedacht', 'traum in erfüllung', 'so dankbar', 'danke an alle', 'geschafft',
]

// ── NEW: Advice / Beginner Keywords ──

const ADVICE_KEYWORDS_EN = [
  'how to start streaming', 'beginner tips needed', 'tips for beginners',
  'new to streaming', 'just started', 'first stream', 'how do i',
  'any advice', 'looking for tips', 'best equipment', 'what camera',
  'what mic', 'how to setup', 'where to start', 'beginner guide',
  'how to get followers', 'how to get viewers', 'best practices',
  'what software', 'how to edit', 'content strategy', 'how to grow',
]

const ADVICE_KEYWORDS_DE = [
  'wie anfangen', 'tipps für anfänger', 'neu beim streaming', 'gerade angefangen',
  'erster stream', 'wie kann ich', 'habt ihr tipps', 'suche nach rat',
  'beste ausstattung', 'welche kamera', 'welches mikrofon', 'wie einrichten',
  'wo anfangen', 'anfänger guide', 'wie follower bekommen', 'wie zuhörer bekommen',
  'beste vorgehensweise', 'welche software', 'wie schneiden ich', 'inhaltsstrategie',
]

// ── NEW: Privacy Keywords ──

const PRIVACY_KEYWORDS_EN = [
  'gdpr alternative', 'gdpr compliant', 'privacy friendly', 'data protection',
  'no tracking', 'no ads', 'open source', 'european alternative', 'eu based',
  'gdpr compliant ai', 'safe ai', 'private ai', 'no data collection',
  'where is my data', 'who has my data', 'data privacy', 'encrypt',
]

const PRIVACY_KEYWORDS_DE = [
  'dsgvo ki alternative', 'dsgvo konform', 'datenschutzfreundlich', 'datenschutz',
  'kein tracking', 'keine werbung', 'open source', 'europäische alternative',
  'eu basiert', 'datenschutz konforme ki', 'sichere ki', 'private ki',
  'keine datenerfassung', 'wo sind meine daten', 'datenschutz', 'verschlüsseln',
]

// ── NEW: Builder / Modder Keywords ──

const BUILDER_KEYWORDS_EN = [
  'check out my map', 'built this custom', 'made this mod', 'my build',
  'just finished building', 'custom map', 'mod showcase', 'my creation',
  'built in minecraft', 'designed this', 'my project', 'my game',
  'my asset', 'free download', 'work in progress', 'wip', 'progress shot',
]

const BUILDER_KEYWORDS_DE = [
  'meine map', 'server erstellt', 'mein mod', 'mein build',
  'fertig gebaut', 'custom map', 'mod showcase', 'meine kreation',
  'gebaut in minecraft', 'designed', 'mein projekt', 'mein spiel',
  'mein asset', 'kostenloser download', 'in arbeit', 'fortschritt',
]

const ALL_KEYWORDS = [
  ...FRUSTRATION_KEYWORDS_EN, ...FRUSTRATION_KEYWORDS_DE,
  ...MILESTONE_KEYWORDS_EN, ...MILESTONE_KEYWORDS_DE,
  ...ADVICE_KEYWORDS_EN, ...ADVICE_KEYWORDS_DE,
  ...PRIVACY_KEYWORDS_EN, ...PRIVACY_KEYWORDS_DE,
  ...BUILDER_KEYWORDS_EN, ...BUILDER_KEYWORDS_DE,
]

// ── Badge Auto-Detection ──

function detectBadge(text, feedBadge) {
  const lower = text.toLowerCase()
  if (matchesAny(lower, MILESTONE_KEYWORDS_EN, MILESTONE_KEYWORDS_DE)) return 'Milestone'
  if (matchesAny(lower, ADVICE_KEYWORDS_EN, ADVICE_KEYWORDS_DE)) return 'Advice-Seeker'
  if (matchesAny(lower, PRIVACY_KEYWORDS_EN, PRIVACY_KEYWORDS_DE)) return 'Privacy-First'
  if (matchesAny(lower, BUILDER_KEYWORDS_EN, BUILDER_KEYWORDS_DE)) return 'Builder'
  return feedBadge || 'Creator'
}

function matchesAny(lower, ...arrays) {
  for (const arr of arrays) {
    for (const kw of arr) {
      if (lower.includes(kw)) return true
    }
  }
  return false
}

// ── RSS XML Parsing ──

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
    `${SUPABASE_URL}/rest/v1/leads?select=source_url&limit=2000&order=created_at.desc`,
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
  if (request && request.method === 'GET') {
    const auth = request.headers?.authorization || ''
    if (!auth.includes(SUPABASE_SERVICE_KEY)) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
    }
  }

  console.log(`[LeadScraper] Starting scrape run v3 at ${new Date().toISOString()}`)

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
        headers: { 'User-Agent': 'HappinessLeadRadar/2.0' },
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

        const detectedBadge = detectBadge(plainText, feed.badge)

        const inserted = await insertLead({
          platform: feed.platform,
          continent: feed.continent,
          lang: feed.lang,
          source_url: sourceUrl,
          text: plainText,
          status: 'new',
          badge: detectedBadge,
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
