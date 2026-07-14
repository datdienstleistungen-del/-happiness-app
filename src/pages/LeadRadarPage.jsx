import { useState, useEffect, useRef, useCallback } from 'react'
import { Radar, Zap, Copy, Check, Globe, ArrowLeft, Loader, Plus, X, ExternalLink, Radio, RotateCw } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { getChatEndpoint } from '../lib/hit'
import './LeadRadarPage.css'

const LIVE_FEEDS = [
  // 🇺🇸 North America
  { url: '/api/reddit-proxy/r/Twitch/new/.rss', continent: 'na', platform: 'twitch', lang: 'en', badge: 'Gamer' },
  { url: '/api/reddit-proxy/r/NewTubers/new/.rss', continent: 'na', platform: 'reddit', lang: 'en', badge: 'Creator' },
  { url: '/api/reddit-proxy/r/SideHustle/new/.rss', continent: 'na', platform: 'reddit', lang: 'en', badge: 'Business' },
  { url: '/api/reddit-proxy/r/CryptoCurrency/new/.rss', continent: 'na', platform: 'reddit', lang: 'en', badge: 'Trader' },
  { url: '/api/reddit-proxy/r/realestateinvesting/new/.rss', continent: 'na', platform: 'reddit', lang: 'en', badge: 'Real Estate' },

  // 🇪🇺 Europe
  { url: '/api/reddit-proxy/r/de_EDV/new/.rss', continent: 'eu', platform: 'reddit', lang: 'de', badge: 'Tech-EU' },
  { url: '/api/reddit-proxy/r/Finanzen/new/.rss', continent: 'eu', platform: 'reddit', lang: 'de', badge: 'Trader-EU' },
  { url: '/api/reddit-proxy/r/Immobilien/new/.rss', continent: 'eu', platform: 'reddit', lang: 'de', badge: 'Real Estate-EU' },

  // 🇧🇷 Latin America
  { url: '/api/reddit-proxy/r/investimentos/new/.rss', continent: 'latam', platform: 'reddit', lang: 'pt', badge: 'Trader-BR' },
  { url: '/api/reddit-proxy/r/brdev/new/.rss', continent: 'latam', platform: 'reddit', lang: 'pt', badge: 'Tech-BR' },

  // 🇦🇺 Asia-Pacific
  { url: '/api/reddit-proxy/r/AusFinance/new/.rss', continent: 'apac', platform: 'reddit', lang: 'en', badge: 'Trader-AU' },
  { url: '/api/reddit-proxy/r/gamedev/new/.rss', continent: 'apac', platform: 'reddit', lang: 'en', badge: 'Builder-Global' },
]

const CONTINENTS = [
  { id: 'na', label: 'North America', flag: '🇺🇸', platforms: 'Live Hubs', lang: 'en' },
  { id: 'eu', label: 'Europe', flag: '🇪🇺', platforms: 'Live Hubs', lang: 'de' },
  { id: 'latam', label: 'Latin America', flag: '🇧🇷', platforms: 'Live Hubs', lang: 'es' },
  { id: 'apac', label: 'Asia-Pacific', flag: '🇦🇺', platforms: 'Live Hubs', lang: 'en' },
]

const PLATFORMS = [
  { value: 'reddit', label: 'Reddit' },
  { value: 'facebook', label: 'Facebook' },
  { value: 'discord', label: 'Discord' },
  { value: 'twitch', label: 'Twitch' },
  { value: 'twitter', label: 'X / Twitter' },
  { value: 'forum', label: 'Forum' },
]

const CONTINENT_OPTIONS = [
  { value: 'na', label: '🇺🇸 US — North America' },
  { value: 'eu', label: '🇪🇺 EU — Europe' },
  { value: 'latam', label: '🇧🇷 BR — Latin America' },
  { value: 'apac', label: '🇦🇺 AU — Asia-Pacific' },
]

const LANG_OPTIONS = [
  { value: 'en', label: 'EN — English' },
  { value: 'de', label: 'DE — Deutsch' },
  { value: 'es', label: 'ES — Español' },
  { value: 'fr', label: 'FR — Français' },
  { value: 'pt', label: 'PT — Português' },
]

const PLATFORM_BADGES = {
  reddit: { color: '#FF4500', label: 'Reddit' },
  discord: { color: '#5865F2', label: 'Discord' },
  twitter: { color: '#1DA1F2', label: 'X / Twitter' },
  twitch: { color: '#9146FF', label: 'Twitch' },
  facebook: { color: '#1877F2', label: 'Facebook' },
  forum: { color: '#6B7280', label: 'Forum' },
}

const CONTEXT_BADGES = {
  Gamer: { color: '#8B5CF6', label: '🎮 Gamer' },
  Creator: { color: '#F59E0B', label: '🎬 Creator' },
  Business: { color: '#10B981', label: '💼 Business' },
  Milestone: { color: '#EAB308', label: '⭐ Milestone' },
  'Advice-Seeker': { color: '#22C55E', label: '❓ Advice-Seeker' },
  'Privacy-First': { color: '#A855F7', label: '🔒 Privacy-First' },
  Builder: { color: '#F97316', label: '🛠️ Builder' },
  Trader: { color: '#00FF88', label: '📈 Trader' },
  'Real Estate': { color: '#1E40AF', label: '🏠 Real Estate' },
}

const LANG_BADGES = {
  en: { color: '#3B82F6', label: 'EN' },
  de: { color: '#F59E0B', label: 'DE' },
  es: { color: '#10B981', label: 'ES' },
  fr: { color: '#8B5CF6', label: 'FR' },
  pt: { color: '#EF4444', label: 'PT' },
}

const EMPTY_FORM = { platform: 'reddit', continent: 'na', lang: 'en', badge: 'Creator', source_url: '', text: '' }
const BADGE_OPTIONS = [
  { value: 'Gamer', label: '🎮 Gamer' }, { value: 'Creator', label: '🎬 Creator' },
  { value: 'Business', label: '💼 Business' }, { value: 'Milestone', label: '⭐ Milestone' },
  { value: 'Advice-Seeker', label: '❓ Advice-Seeker' }, { value: 'Privacy-First', label: '🔒 Privacy-First' },
  { value: 'Builder', label: '🛠️ Builder' }, { value: 'Trader', label: '📈 Trader' },
  { value: 'Real Estate', label: '🏠 Real Estate' },
]

// ── 100+ Keywords (EN + DE) ──
const KW_FRUSTRATION_EN = [
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
  'failed launch', 'low reach', 'no impressions',
]
const KW_FRUSTRATION_DE = [
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
const KW_MILESTONE_EN = [
  'finally hit', 'celebrating my', 'just reached', 'hit 100', 'hit 500', 'hit 1000',
  'hit 5000', 'hit 10000', 'first 1000', 'first subscriber', 'first follower',
  'just got partnered', 'just got monetized', 'stream anniversary', 'one year',
  'milestone reached', 'biggest day', 'personal best', 'record viewers', 'all time high',
  'never thought', 'dream come true', 'so grateful', 'thank you all', 'we did it',
]
const KW_MILESTONE_DE = [
  'endlich geschafft', 'meilenstein', 'feiere ich', 'gerade erreicht',
  'ersten 100', 'ersten 1000', 'erster subscriber', 'erster follower',
  'gerade monetarisiert', 'stream jahrestag', 'jahr', 'persönlicher rekord',
  'nie gedacht', 'traum in erfüllung', 'so dankbar', 'danke an alle', 'geschafft',
]
const KW_ADVICE_EN = [
  'how to start streaming', 'beginner tips needed', 'tips for beginners',
  'new to streaming', 'just started', 'first stream', 'how do i',
  'any advice', 'looking for tips', 'best equipment', 'what camera',
  'what mic', 'how to setup', 'where to start', 'beginner guide',
  'how to get followers', 'how to get viewers', 'best practices',
  'what software', 'how to edit', 'content strategy',
]
const KW_ADVICE_DE = [
  'wie anfangen', 'tipps für anfänger', 'neu beim streaming', 'gerade angefangen',
  'erster stream', 'wie kann ich', 'habt ihr tipps', 'suche nach rat',
  'beste ausstattung', 'welche kamera', 'welches mikrofon', 'wie einrichten',
  'wo anfangen', 'anfänger guide', 'wie follower bekommen', 'wie zuhörer bekommen',
  'beste vorgehensweise', 'welche software', 'wie schneiden ich', 'inhaltsstrategie',
]
const KW_PRIVACY_EN = [
  'gdpr alternative', 'gdpr compliant', 'privacy friendly', 'data protection',
  'no tracking', 'no ads', 'open source', 'european alternative', 'eu based',
  'gdpr compliant ai', 'safe ai', 'private ai', 'no data collection',
  'where is my data', 'who has my data', 'data privacy', 'encrypt',
]
const KW_PRIVACY_DE = [
  'dsgvo ki alternative', 'dsgvo konform', 'datenschutzfreundlich', 'datenschutz',
  'kein tracking', 'keine werbung', 'open source', 'europäische alternative',
  'eu basiert', 'datenschutz konforme ki', 'sichere ki', 'private ki',
  'keine datenerfassung', 'wo sind meine daten', 'datenschutz', 'verschlüsseln',
]
const KW_BUILDER_EN = [
  'check out my map', 'built this custom', 'made this mod', 'my build',
  'just finished building', 'custom map', 'mod showcase', 'my creation',
  'built in minecraft', 'designed this', 'my project', 'my game',
  'my asset', 'free download', 'work in progress', 'wip', 'progress shot',
]
const KW_BUILDER_DE = [
  'meine map', 'server erstellt', 'mein mod', 'mein build',
  'fertig gebaut', 'custom map', 'mod showcase', 'meine kreation',
  'gebaut in minecraft', 'designed', 'mein projekt', 'mein spiel',
  'mein asset', 'kostenloser download', 'in arbeit', 'fortschritt',
]

const KW_TRADER_EN = [
  'daytrading', 'crypto signal', 'chart analysis', 'bitcoin trend',
  'get telegram members', 'tradingview', 'trading signals', 'forex signal',
  'crypto trading', 'altcoin', 'bull run', 'bear market', 'hodl',
  'portfolio growth', 'passive income trading', 'crypto portfolio',
  'technical analysis', 'price target', 'entry point', 'stop loss',
  'leveraged trading', 'futures trading', 'options trading', 'day trade',
]
const KW_TRADER_DE = [
  'daytrading', 'krypto signal', 'chart analyse', 'bitcoin trend',
  'telegram mitglieder', 'tradingview', 'handelssignale', 'forex signale',
  'kryptohandel', 'altcoin', 'bullenlauf', 'bärenmarkt', 'hodl',
  'portfolio wachstum', 'krypto portfolio', 'technische analyse',
  'preisziel', 'einstiegspunkt', 'stop loss', 'gehebelter handel',
]

const KW_REALESTATE_EN = [
  'real estate marketing', 'property listing', 'fix and flip',
  'house tour reel', 'exposé text', 'real estate agent', 'property showcase',
  'home buyer', 'first time buyer', 'mortgage rate', 'property investment',
  'luxury listing', 'open house', 'virtual tour', 'staging tips',
  'real estate social media', 'property content', 'listing description',
]
const KW_REALESTATE_DE = [
  'immobilien makler', 'immobilien vermarktung', 'objekt beschreibung',
  'haus tour', 'exposé text', 'immobilien makler', 'grundstück verkaufen',
  'hausbau', 'erstes haus', 'baufinanzierung', 'immobilien investition',
  'luxus immobilie', 'besichtigung', 'virtuelle tour', 'immobilien social media',
]

const ALL_KEYWORDS = [
  ...KW_FRUSTRATION_EN, ...KW_FRUSTRATION_DE,
  ...KW_MILESTONE_EN, ...KW_MILESTONE_DE,
  ...KW_ADVICE_EN, ...KW_ADVICE_DE,
  ...KW_PRIVACY_EN, ...KW_PRIVACY_DE,
  ...KW_BUILDER_EN, ...KW_BUILDER_DE,
  ...KW_TRADER_EN, ...KW_TRADER_DE,
  ...KW_REALESTATE_EN, ...KW_REALESTATE_DE,
]

function matchesAny(text, ...arrays) {
  const lower = text.toLowerCase()
  for (const arr of arrays) {
    for (const kw of arr) {
      if (lower.includes(kw)) return true
    }
  }
  return false
}

function detectBadge(text, feedBadge) {
  const lower = text.toLowerCase()
  if (matchesAny(lower, KW_TRADER_EN, KW_TRADER_DE)) return 'Trader'
  if (matchesAny(lower, KW_REALESTATE_EN, KW_REALESTATE_DE)) return 'Real Estate'
  if (matchesAny(lower, KW_MILESTONE_EN, KW_MILESTONE_DE)) return 'Milestone'
  if (matchesAny(lower, KW_ADVICE_EN, KW_ADVICE_DE)) return 'Advice-Seeker'
  if (matchesAny(lower, KW_PRIVACY_EN, KW_PRIVACY_DE)) return 'Privacy-First'
  if (matchesAny(lower, KW_BUILDER_EN, KW_BUILDER_DE)) return 'Builder'
  return feedBadge || 'Creator'
}

function extractEntries(xml) {
  const entries = []
  const regex = /<entry>([\s\S]*?)<\/entry>/gi
  let m
  while ((m = regex.exec(xml)) !== null) {
    const b = m[1]
    const t = (s) => { const r = new RegExp(`<${s}[^>]*>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?<\\/${s}>`, 'i'); const x = b.match(r); return x ? x[1].trim() : '' }
    const title = t('title')
    const content = t('content') || t('summary')
    const link = t('link')
    if (title || content) entries.push({ title, content, link })
  }
  return entries
}

function playAlert() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.frequency.setValueAtTime(880, ctx.currentTime)
    osc.frequency.exponentialRampToValueAtTime(1320, ctx.currentTime + 0.1)
    gain.gain.setValueAtTime(0.15, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3)
    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + 0.3)
  } catch {}
}

export default function LeadRadarPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [activeContinent, setActiveContinent] = useState('na')
  const [leads, setLeads] = useState([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState({})
  const [responses, setResponses] = useState({})
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [radarActive, setRadarActive] = useState(false)
  const radarLoopRef = useRef(null)
  const [radarStats, setRadarStats] = useState({ fetched: 0, matched: 0, inserted: 0 })
  const existingUrlsRef = useRef(new Set())
  const newLeadIdsRef = useRef(new Set())
  const audioRef = useRef(null)

  useEffect(() => { fetchLeads() }, [activeContinent])

  useEffect(() => {
    return () => { if (radarLoopRef.current) clearTimeout(radarLoopRef.current) }
  }, [])

  async function fetchLeads() {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('leads')
        .select('*')
        .eq('continent', activeContinent)
        .order('created_at', { ascending: false })
        .limit(50)
      if (error) throw error
      setLeads(data || [])
      existingUrlsRef.current = new Set((data || []).map(l => l.source_url).filter(Boolean))
    } catch (e) {
      console.error('[LeadRadar] Fetch error:', e)
      setLeads([])
    } finally {
      setLoading(false)
    }
  }

  // ── Client-Side Live Radar ──
  const stopRadar = useCallback(() => {
    if (radarLoopRef.current) { clearInterval(radarLoopRef.current); radarLoopRef.current = null }
    setRadarActive(false)
    console.log('[LeadRadar] Radar stopped by user')
  }, [])

  const runLiveRadar = useCallback(async () => {
    if (radarActive) return
    setRadarActive(true)
    setRadarStats({ fetched: 0, matched: 0, inserted: 0 })

    const feedsForTab = LIVE_FEEDS.filter(f => f.continent === activeContinent)
    console.log('[LeadRadar] Live scan started —', feedsForTab.length, 'feeds for', activeContinent)

    let totalFetched = 0, totalMatched = 0, totalInserted = 0

    for (let i = 0; i < feedsForTab.length; i++) {
      const feed = feedsForTab[i]
      try {
        if (i > 0) await new Promise(r => setTimeout(r, 1500))

        const subreddit = feed.url.match(/\/r\/([^/]+)\//)?.[1] || 'unknown'
        const directUrl = `https://www.reddit.com/r/${subreddit}/new/.rss`
        const proxyUrl = feed.url

        let xml = null

        // Try direct client-side fetch first (Reddit RSS sometimes allows CORS)
        try {
          const c1 = new AbortController()
          const t1 = setTimeout(() => c1.abort(), 6000)
          const r1 = await fetch(directUrl, { signal: c1.signal, headers: { 'Accept': '*/*' } })
          clearTimeout(t1)
          if (r1.ok) {
            xml = await r1.text()
            console.log('[LeadRadar] Direct OK:', subreddit, xml.length, 'bytes')
          }
        } catch (_) { /* direct failed, try proxy */ }

        // Fallback to Netlify proxy
        if (!xml) {
          try {
            const c2 = new AbortController()
            const t2 = setTimeout(() => c2.abort(), 8000)
            const r2 = await fetch(proxyUrl, { signal: c2.signal, headers: { 'Accept': '*/*' } })
            clearTimeout(t2)
            if (r2.ok) {
              xml = await r2.text()
              console.log('[LeadRadar] Proxy OK:', subreddit, xml.length, 'bytes')
            }
          } catch (_) { /* both failed */ }
        }

          if (!xml) { console.warn('[LeadRadar] Skip:', subreddit, 'both methods failed'); continue }
        const entries = extractEntries(xml)
        totalFetched += entries.length

        for (const entry of entries) {
          const fullText = `${entry.title} ${entry.content}`.trim()
          const plainText = fullText.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim().slice(0, 2000)
          if (plainText.length < 20) continue
          if (!matchesAny(plainText, KW_FRUSTRATION_EN, KW_FRUSTRATION_DE, KW_MILESTONE_EN, KW_MILESTONE_DE, KW_ADVICE_EN, KW_ADVICE_DE, KW_PRIVACY_EN, KW_PRIVACY_DE, KW_BUILDER_EN, KW_BUILDER_DE, KW_TRADER_EN, KW_TRADER_DE, KW_REALESTATE_EN, KW_REALESTATE_DE)) continue

          totalMatched++
          const sourceUrl = entry.link || feed.url
          if (existingUrlsRef.current.has(sourceUrl)) continue

          const detectedBadge = detectBadge(plainText, feed.badge)
          let { error } = await supabase.from('leads').insert({
            platform: feed.platform,
            continent: feed.continent,
            lang: feed.lang,
            badge: detectedBadge,
            source_url: sourceUrl,
            text: plainText,
            status: 'new',
          })
          if (error && error.message.includes('badge')) {
            const retry = await supabase.from('leads').insert({
              platform: feed.platform,
              continent: feed.continent,
              lang: feed.lang,
              source_url: sourceUrl,
              text: plainText,
              status: 'new',
            })
            if (retry.error) { console.warn('[LeadRadar] Insert skip:', retry.error.message); continue }
          } else if (error) {
            console.warn('[LeadRadar] Insert skip:', error.message); continue
          }

          existingUrlsRef.current.add(sourceUrl)
          totalInserted++

          const newLead = {
            id: 'live-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
            platform: feed.platform,
            continent: feed.continent,
            lang: feed.lang,
            badge: detectedBadge,
            source_url: sourceUrl,
            text: plainText,
            status: 'new',
            created_at: new Date().toISOString(),
            _isNew: true,
          }
          newLeadIdsRef.current.add(newLead.id)
          setLeads(prev => [newLead, ...prev])
          playAlert()
          setRadarStats({ fetched: totalFetched, matched: totalMatched, inserted: totalInserted })
        }
      } catch (err) {
        console.warn('[LeadRadar] Feed error:', feed.url, err.message)
      }
    }

    setRadarStats({ fetched: totalFetched, matched: totalMatched, inserted: totalInserted })
    console.log(`[LeadRadar] Scan done: ${totalFetched} fetched, ${totalMatched} matched, ${totalInserted} new — next scan in 60s`)

    radarLoopRef.current = setTimeout(() => {
      radarLoopRef.current = null
      setRadarActive(false)
      setTimeout(() => runLiveRadar(), 500)
    }, 60000)
  }, [radarActive, activeContinent, runLiveRadar])

  async function handleSaveLead(e) {
    e.preventDefault()
    if (!form.text.trim()) { setSaveError('Post text is required.'); return }
    setSaving(true); setSaveError('')
    try {
      const { error } = await supabase.from('leads').insert({
        platform: form.platform, continent: form.continent, lang: form.lang,
        badge: form.badge, source_url: form.source_url.trim() || null,
        text: form.text.trim(), status: 'new', created_by: user?.id || null,
      })
      if (error) throw error
      setModalOpen(false); setForm(EMPTY_FORM); fetchLeads()
    } catch (err) {
      setSaveError(err.message || 'Failed to save lead.')
    } finally { setSaving(false) }
  }

  async function generateResponse(lead) {
    if (generating[lead.id]) return
    setGenerating(prev => ({ ...prev, [lead.id]: true }))
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token || ''
      const badge = lead.badge || 'Creator'
      const emotionMap = {
        Milestone: 'This user is CELEBRATING a personal milestone. Start with enthusiastic congratulations.',
        'Advice-Seeker': 'This user is a BEGINNER seeking advice. Provide a numbered 3-step guide first.',
        'Privacy-First': 'This user cares about PRIVACY. Acknowledge their concern, then mention GDPR compliance.',
        Builder: 'This user is a CREATIVE BUILDER. Acknowledge their technical work first.',
        Trader: 'This user is a TRADER or CRYPTO ENTHUSIAST. Use high-energy, fast-paced language. Focus on FOMO, trends, and market momentum. Be sharp and decisive.',
        'Real Estate': 'This user is in REAL ESTATE. Use trust-building, emotional storytelling. Focus on property value, dream homes, and high-ticket investment confidence.',
        Gamer: 'This user is a GAMER or STREAMER. Be casual, empathetic, use gaming language.',
        Creator: 'This user is a CONTENT CREATOR. Be professional but warm, growth-focused.',
        Business: 'This user is a BUSINESS PROFESSIONAL. Be ROI-focused and practical.',
      }
      const systemPrompt = `Du bist ein Community-Outreach-Spezialist von Happiness.
SPRACHE: Antworte AUSSCHLIESSLICH auf ${lead.lang === 'de' ? 'Deutsch' : 'Englisch'}.
BADGE: ${badge}
STIL: Keine Floskeln. Max 3-4 Sätze. Happiness nur dezent erwähnen.
EMOTION: ${emotionMap[badge] || emotionMap.Creator}`
      const response = await fetch(getChatEndpoint(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          message: `User on ${lead.platform} (${badge}): "${lead.text}"`,
          systemPrompt, language: lead.lang || 'en', badge, userId: user?.id || '', history: []
        })
      })
      if (!response.ok) throw new Error(`API ${response.status}`)
      const data = await response.json()
      setResponses(prev => ({ ...prev, [lead.id]: data.response || 'No response generated.' }))
    } catch (err) {
      setResponses(prev => ({ ...prev, [lead.id]: 'Error: ' + err.message }))
    } finally { setGenerating(prev => ({ ...prev, [lead.id]: false })) }
  }

  return (
    <div className="lr-page">
      <div className="lr-header">
        <button className="lr-back" onClick={() => navigate(-1)}><ArrowLeft size={18} /></button>
        <div className="lr-title"><Radar size={22} /><h1>Global Lead Radar</h1></div>
        <span className="lr-badge">{leads.length} leads</span>
        <button
          className={`lr-radar-btn ${radarActive ? 'active' : ''}`}
          onClick={radarActive ? stopRadar : runLiveRadar}
        >
          {radarActive ? <><Loader size={14} className="lr-spinner" /> Scanning... (Stop)</> : <><Radio size={14} /> Live Radar</>}
        </button>
        <button className="lr-add-btn" onClick={() => { setForm({ ...EMPTY_FORM, continent: activeContinent }); setSaveError(''); setModalOpen(true) }}>
          <Plus size={16} /> Add Live Lead
        </button>
      </div>

      {radarStats.inserted > 0 && (
        <div className="lr-radar-stats">
          <RotateCw size={14} /> {radarStats.inserted} new leads injected live
        </div>
      )}

      <div className="lr-tabs">
        {CONTINENTS.map(c => (
          <button key={c.id} className={`lr-tab ${activeContinent === c.id ? 'active' : ''}`} onClick={() => setActiveContinent(c.id)}>
            <span className="lr-tab-flag">{c.flag}</span>
            <span className="lr-tab-label">{c.label}</span>
            <span className="lr-tab-platforms">{c.platforms}</span>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="lr-loading"><Loader size={24} className="lr-spinner" /><span>Loading leads...</span></div>
      ) : leads.length === 0 ? (
        <div className="lr-empty">
          <div className={`lr-empty-radar ${radarActive ? 'lr-empty-radar-active' : ''}`} onClick={radarActive ? stopRadar : runLiveRadar}>
            <Radar size={48} className={`lr-radar-pulse ${radarActive ? 'lr-spinner' : ''}`} />
          </div>
          <h2>🛰️ Global Radar scanning...</h2>
          <p>{radarActive ? 'Scanning feeds now — auto-repeats every 60s. Click to stop.' : 'Click the radar icon or button below to scan live feeds.'}</p>
          <p className="lr-empty-sub">{LIVE_FEEDS.filter(f => f.continent === activeContinent).length} active feeds for this region — all client-side.</p>
          <button className="lr-empty-scan-btn" onClick={radarActive ? stopRadar : runLiveRadar}>
            {radarActive ? <><Loader size={14} className="lr-spinner" /> ⏹ Stop Radar</> : <><Radio size={14} /> ⚡ Start Live Radar</>}
          </button>
        </div>
      ) : (
        <div className="lr-grid">
          {leads.map(lead => (
            <div key={lead.id} className={`lr-card ${newLeadIdsRef.current.has(lead.id) ? 'lr-card-new' : ''}`}>
              <div className="lr-card-top">
                <span className="lr-platform-badge" style={{ background: (PLATFORM_BADGES[lead.platform] || PLATFORM_BADGES.reddit).color }}>
                  {(PLATFORM_BADGES[lead.platform] || PLATFORM_BADGES.reddit).label}
                </span>
                <span className="lr-lang-badge" style={{ background: (LANG_BADGES[lead.lang] || LANG_BADGES.en).color }}>
                  {(LANG_BADGES[lead.lang] || LANG_BADGES.en).label}
                </span>
                {lead.badge && CONTEXT_BADGES[lead.badge] && (
                  <span className="lr-context-badge" style={{ background: CONTEXT_BADGES[lead.badge].color }}>
                    {CONTEXT_BADGES[lead.badge].label}
                  </span>
                )}
              </div>
              <p className="lr-card-text">{lead.text}</p>
              {lead.source_url && (
                <a href={lead.source_url} target="_blank" rel="noopener noreferrer" className="lr-card-link">
                  <ExternalLink size={12} /> View original post
                </a>
              )}
              <button className="lr-generate-btn" onClick={() => generateResponse(lead)} disabled={generating[lead.id]}>
                {generating[lead.id] ? <><Loader size={14} className="lr-spinner" /> Generating...</> : <><Zap size={14} /> Generate Global Helper Response</>}
              </button>
              {responses[lead.id] && (
                <div className="lr-response">
                  <div className="lr-response-text">{responses[lead.id]}</div>
                  <CopyButton text={responses[lead.id]} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {modalOpen && (
        <div className="lr-modal-overlay" onClick={() => setModalOpen(false)}>
          <div className="lr-modal" onClick={e => e.stopPropagation()}>
            <div className="lr-modal-header">
              <h2>Add Live Lead</h2>
              <button className="lr-modal-close" onClick={() => setModalOpen(false)}><X size={18} /></button>
            </div>
            <form className="lr-modal-form" onSubmit={handleSaveLead}>
              <div className="lr-form-row">
                <label><span>Platform</span>
                  <select value={form.platform} onChange={e => setForm(p => ({ ...p, platform: e.target.value }))}>
                    {PLATFORMS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                  </select>
                </label>
                <label><span>Continent</span>
                  <select value={form.continent} onChange={e => setForm(p => ({ ...p, continent: e.target.value }))}>
                    {CONTINENT_OPTIONS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                </label>
                <label><span>Language</span>
                  <select value={form.lang} onChange={e => setForm(p => ({ ...p, lang: e.target.value }))}>
                    {LANG_OPTIONS.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
                  </select>
                </label>
                <label><span>Context</span>
                  <select value={form.badge} onChange={e => setForm(p => ({ ...p, badge: e.target.value }))}>
                    {BADGE_OPTIONS.map(b => <option key={b.value} value={b.value}>{b.label}</option>)}
                  </select>
                </label>
              </div>
              <label className="lr-form-full"><span>Source URL</span>
                <input type="url" placeholder="https://reddit.com/r/..." value={form.source_url} onChange={e => setForm(p => ({ ...p, source_url: e.target.value }))} />
              </label>
              <label className="lr-form-full"><span>Post Text</span>
                <textarea rows={5} placeholder="Paste the creator's exact complaint here..." value={form.text} onChange={e => setForm(p => ({ ...p, text: e.target.value }))} required />
              </label>
              {saveError && <div className="lr-form-error">{saveError}</div>}
              <button className="lr-form-submit" type="submit" disabled={saving}>
                {saving ? <><Loader size={14} className="lr-spinner" /> Saving...</> : <><Radar size={14} /> Save to Database</>}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false)
  const handleCopy = async () => {
    try { await navigator.clipboard.writeText(text) } catch {
      const ta = document.createElement('textarea'); ta.value = text
      document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta)
    }
    setCopied(true); setTimeout(() => setCopied(false), 2000)
  }
  return (
    <button className="lr-copy-btn" onClick={handleCopy}>
      {copied ? <><Check size={12} /> Copied!</> : <><Copy size={12} /> Copy Reply</>}
    </button>
  )
}
