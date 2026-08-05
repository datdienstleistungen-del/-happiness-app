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
  { value: 'business', label: 'B2B Job Boards (z.B. Upwork)' },
  { value: 'forum', label: 'Google News / PR' },
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
  forum: { color: '#6B7280', label: 'Google News' },
  business: { color: '#F59E0B', label: 'Upwork / B2B' },
}

const CONTEXT_BADGES = {
  'Global Search': { color: '#0EA5E9', label: '🌍 Global Search' },
  'News Radar': { color: '#EF4444', label: '📰 News Radar' },
  'Job Board': { color: '#10B981', label: '💼 Job Board' },
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

const EMPTY_FORM = { platform: 'reddit', continent: 'na', lang: 'en', badge: 'Business', source_url: '', text: '' }
const BADGE_OPTIONS = [
  { value: 'Global Search', label: '🌍 Global Search' },
  { value: 'News Radar', label: '📰 News Radar' },
  { value: 'Job Board', label: '💼 Job Board' },
  { value: 'Business', label: '💼 Business' },
  { value: 'Privacy-First', label: '🔒 Privacy-First' },
  { value: 'Trader', label: '📈 Trader' },
  { value: 'Real Estate', label: '🏠 Real Estate' },
]

function cleanText(str) {
  if (!str) return '';
  let cleaned = str;
  cleaned = cleaned.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
                   .replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ');
  cleaned = cleaned.replace(/<[^>]*>?/gm, '');
  return cleaned;
}

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

// ── BLACKLIST: Subreddits/Themen die NIEMALS als Lead gelten ──
const SUBREDDIT_BLACKLIST = [
  // Gesundheit / Medizin
  'askdocs', 'medical', 'health', 'healthcare', 'doctor', 'nurses',
  'pharmacy', 'medicine', 'diabetes', 'cancer', 'mentalhealth',
  'anxiety', 'depression', 'ptsd', 'bipolar', 'adhd', 'autism',
  'chronicpain', 'chronicillness', 'fibromyalgia', 'endometriosis',
  'prediabetes', 'bloodpressure', 'heart', 'stroke', 'covid19',
  // Persönliche Hilfe / Verletzliche Inhalte
  'relationship_advice', 'relationships', 'dating', 'dating_advice',
  'marriage', 'divorce', 'custody', 'parenting',
  'suicidewatch', 'depression_help', 'anxiety_help', 'selfharm',
  'ptsd', 'survivor', 'abuse', 'domesticviolence',
  'addiction', 'stopdrinking', 'leaves', 'quitweed', 'nosurf',
  // Recht / Klagen (persönlich)
  'legaladvice', 'legal', 'law', 'lawsuit',
  // Subreddits die persönliche Hilfe suchen
  'assistance', 'randomkindness', 'gofundme', 'donationrequest',
  'borrow', 'randomactsofpizza',
]

// ── POSITIVLISTE: Kommerzielle Indikatoren ──
const COMMERCIAL_SIGNALS_EN = [
  'looking for', 'need a', 'hiring', 'job opening', 'position available',
  'freelancer needed', 'contractor', 'budget', 'pricing', 'quote',
  'business proposal', 'partnership', 'collaboration', 'sponsor',
  'advertising', 'marketing budget', 'campaign', 'roi', 'conversion',
  'b2b', 'saas', 'startup', 'founding', 'investor', 'funding',
  'revenue', 'profit', 'sales funnel', 'lead generation',
  'service provider', 'agency', 'consultant', 'freelance',
  'product launch', 'market research', 'competitor analysis',
  'client', 'customer acquisition', 'retention',
  'api', 'integration', 'platform', 'tool', 'software',
  'e-commerce', 'shopify', 'amazon seller', 'dropshipping',
  'brand deal', 'sponsorship', 'influencer marketing',
]
const COMMERCIAL_SIGNALS_DE = [
  'suche', 'brauche', 'stelle', 'einstellung', 'jobangebot',
  'freelancer', 'auftragnehmer', 'budget', 'preis', 'kostenvoranschlag',
  'geschäftsangebot', 'partnerschaft', 'zusammenarbeit', 'sponsoring',
  'werbung', 'marketing', 'kampagne', 'gewinn', 'umsatz',
  'b2b', 'saas', 'startup', 'investor', 'finanzierung',
  'dienstleister', 'berater', 'freelancer',
  'produktlaunch', 'marktforschung', 'wettbewerbsanalyse',
  'kunde', 'kundengewinnung', 'bindung',
  'api', 'integration', 'plattform', 'tool', 'software',
  'e-commerce', 'shopify', 'amazon', 'dropshipping',
  'markenpartnerschaft', 'sponsoring', 'influencer',
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

const KW_FRUSTRATION_PT = [
  'não consigo', 'desisti', 'estou frustrado', 'não funciona', 'cansado de', 'saturado',
  'perdi tudo', 'não aguento', 'frustração', 'odesio', 'odeio', 'não suporto',
]
const KW_MILESTONE_PT = [
  'consegui', 'cheguei', 'alcancei', 'meu primeiro', 'meta batida', 'atingi',
  'primeiros 100', 'primeiros 1000', 'parceiro', 'monetizou', 'ano de stream',
  'recorde', 'nunca achei', 'sonho realizado', 'obrigado a todos', 'fizemos',
]
const KW_ADVICE_PT = [
  'como fazer', 'alguém me ajuda', 'dica', 'conselho', 'preciso de ajuda',
  'como posso', 'qual a melhor', 'estou começando', 'dicas para', 'tutorial',
]
const KW_PRIVACY_PT = [
  'privacidade', 'dados pessoais', 'rgpd', 'lgpd', 'proteção de dados',
  'anonimato', 'conta fake', 'sem mostrar rosto', 'sem revelar identidade',
]
const KW_BUILDER_PT = [
  'construindo', 'montei', 'fiz sozinho', 'homem', 'trabalho braçal',
  'obra', 'reforma', 'construção', 'marceneiro', 'eletricista', 'pedreiro',
]
const KW_TRADER_PT = [
  'criptomoeda', 'bitcoin', 'investimento', 'bolsa', 'ações', 'day trade',
  'forex', 'renda passiva', 'carteira', 'bull', 'bear', 'altcoin', 'staking',
]
const KW_REALESTATE_PT = [
  'imóvel', 'imóveis', 'aluguel', 'comprar apartamento', 'financiamento',
  'corretor', 'venda de imóvel', 'casa própria', 'obra', 'reforma',
]

const ALL_KEYWORDS = [
  ...KW_FRUSTRATION_EN, ...KW_FRUSTRATION_DE, ...KW_FRUSTRATION_PT,
  ...KW_MILESTONE_EN, ...KW_MILESTONE_DE, ...KW_MILESTONE_PT,
  ...KW_ADVICE_EN, ...KW_ADVICE_DE, ...KW_ADVICE_PT,
  ...KW_PRIVACY_EN, ...KW_PRIVACY_DE, ...KW_PRIVACY_PT,
  ...KW_BUILDER_EN, ...KW_BUILDER_DE, ...KW_BUILDER_PT,
  ...KW_TRADER_EN, ...KW_TRADER_DE, ...KW_TRADER_PT,
  ...KW_REALESTATE_EN, ...KW_REALESTATE_DE, ...KW_REALESTATE_PT,
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

// ── Blacklist-Check: Ist der Post aus einer gesperrten Quelle? ──
function isBlacklisted(text, sourceUrl) {
  const lowerText = text.toLowerCase()
  const lowerUrl = (sourceUrl || '').toLowerCase()

  // Subreddit-Blacklist prüfen
  for (const sub of SUBREDDIT_BLACKLIST) {
    if (lowerUrl.includes(`r/${sub}`) || lowerUrl.includes(`reddit.com/${sub}`)) {
      return true
    }
  }

  // Persönliche/medizinische Keywords im Text
  const personalKeywords = [
    'diagnose', 'diagnosis', 'symptoms', 'doctor said', 'arzt said',
    'cancer', 'tumor', 'blood test', 'bluttest', 'biopsy',
    'my relationship', 'mein partner', 'my husband', 'my wife',
    'my boyfriend', 'my girlfriend', 'mein freund', 'meine freundin',
    'i want to die', 'ich will sterben', 'suicidal', 'selbstmord',
    'self harm', 'selbstverletzung', 'overdose', 'überdosis',
    'addicted', 'süchtig', 'withdrawal', 'entzug',
    'abusive', 'misshandlung', 'domestic violence', 'häusliche gewalt',
    'please help me', 'hilf mir bitte', 'desperate', 'verzweifelt',
    'my child', 'mein kind', 'my baby', 'mein baby',
    'pregnancy', 'schwangerschaft', 'miscarriage', 'fehlgeburt',
    'sue', 'klage', 'lawsuit', 'gericht', 'court',
  ]

  for (const kw of personalKeywords) {
    if (lowerText.includes(kw)) return true
  }

  return false
}

// ── Positiv-Check: Enthält der Post kommerzielle Signale? ──
function hasCommercialSignal(text) {
  return matchesAny(text, COMMERCIAL_SIGNALS_EN, COMMERCIAL_SIGNALS_DE)
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
  const tagRegex = /<(?:entry|item)>([\s\S]*?)<\/(?:entry|item)>/gi
  let m
  while ((m = tagRegex.exec(xml)) !== null) {
    const b = m[1]
    const t = (s) => { const r = new RegExp(`<${s}[^>]*>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?<\\/${s}>`, 'i'); const x = b.match(r); return x ? x[1].trim() : '' }
    const title = t('title')
    const content = t('content') || t('summary') || t('description')
    const link = t('link') || (b.match(/<link[^>]*href="([^"]+)"/i) || [])[1] || ''
    const pubDate = t('pubDate') || t('published') || t('updated') || ''
    if (title || content) entries.push({ title, content, link, pubDate })
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

function interleaveByPlatform(entries) {
  const byPlatform = {}
  for (const e of entries) {
    const p = e.platform || 'unknown'
    if (!byPlatform[p]) byPlatform[p] = []
    byPlatform[p].push(e)
  }
  const platforms = Object.keys(byPlatform)
  if (platforms.length <= 1) return entries
  const result = []
  let changed = true
  while (changed) {
    changed = false
    for (const p of platforms) {
      if (byPlatform[p].length > 0) {
        result.push(byPlatform[p].shift())
        changed = true
      }
    }
  }
  return result
}

export default function LeadRadarPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [activeContinent, setActiveContinent] = useState('na')
  const [customNiche, setCustomNiche] = useState('')
  const [userProduct, setUserProduct] = useState('')
  const [maxAgeDays, setMaxAgeDays] = useState('7')
  const [leads, setLeads] = useState([])
  const [loading, setLoading] = useState(true)
  const [isPremium, setIsPremium] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [generating, setGenerating] = useState({})
  const [responses, setResponses] = useState({})
  const [cooldowns, setCooldowns] = useState({})
  const [modalOpen, setModalOpen] = useState(false)
  const [configModalOpen, setConfigModalOpen] = useState(false)
  const [guideModalOpen, setGuideModalOpen] = useState(false)
  const [scanSources, setScanSources] = useState({ upwork: true, news: true, reddit: true })
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [radarActive, setRadarActive] = useState(false)
  const radarLoopRef = useRef(null)
  const radarFnRef = useRef(null)
  const [radarStats, setRadarStats] = useState({ fetched: 0, matched: 0, inserted: 0 })
  const existingUrlsRef = useRef(new Set())
  const newLeadIdsRef = useRef(new Set())
  const audioRef = useRef(null)

  useEffect(() => { fetchLeads() }, [activeContinent])

  useEffect(() => {
    return () => { if (radarLoopRef.current) clearTimeout(radarLoopRef.current) }
  }, [])

  useEffect(() => {
    async function fetchAccess() {
      if (!user) return
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
      if (profile?.role === 'admin') setIsAdmin(true)
      
      const { data: settings } = await supabase.from('ai_settings').select('is_premium').eq('user_id', user.id).single()
      if (settings?.is_premium) setIsPremium(true)
    }
    fetchAccess()
  }, [user])

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

    const sq = encodeURIComponent(customNiche.trim() || 'business')
    
    let searchLang = 'en'
    let searchGl = 'US'
    let searchCeid = 'US:en'
    if (activeContinent === 'eu') { searchLang = 'de'; searchGl = 'DE'; searchCeid = 'DE:de' }
    else if (activeContinent === 'latam') { searchLang = 'pt'; searchGl = 'BR'; searchCeid = 'BR:pt-419' }
    
    const feedsForTab = []
    
    if (scanSources.reddit) {
      feedsForTab.push({
        url: `/.netlify/functions/rss-proxy?url=` + encodeURIComponent(`https://www.reddit.com/search.rss?q=${sq}&sort=new`),
        continent: activeContinent, platform: 'reddit', lang: searchLang, badge: 'Global Search'
      })
    }
    if (scanSources.news) {
      feedsForTab.push({
        url: `/.netlify/functions/rss-proxy?url=` + encodeURIComponent(`https://news.google.com/rss/search?q=${sq}&hl=${searchLang}&gl=${searchGl}&ceid=${searchCeid}`),
        continent: activeContinent, platform: 'forum', lang: searchLang, badge: 'News Radar'
      })
    }
    if (scanSources.upwork) {
      feedsForTab.push({
        url: `/.netlify/functions/rss-proxy?url=` + encodeURIComponent(`https://www.upwork.com/ab/feed/jobs/rss?q=${sq}`),
        continent: activeContinent, platform: 'business', lang: searchLang, badge: 'Job Board'
      })
    }

    console.log('[LeadRadar] Live scan started —', feedsForTab.length, 'dynamic feeds for', activeContinent)

    let totalFetched = 0, totalMatched = 0, totalInserted = 0
    const matchedEntries = []

    for (let i = 0; i < feedsForTab.length; i++) {
      const feed = feedsForTab[i]
      try {
        if (i > 0) await new Promise(r => setTimeout(r, 1500))

        let xml = null

        try {
          const c = new AbortController()
          const t = setTimeout(() => c.abort(), 8000)
          let r = await fetch(feed.url, { signal: c.signal, headers: { 'Accept': '*/*' } })
          
          if (!r.ok) {
             console.log('[LeadRadar] Primary proxy failed, trying fallback...')
             const originalUrl = new URLSearchParams(feed.url.split('?')[1]).get('url')
             r = await fetch(`https://api.allorigins.win/raw?url=${encodeURIComponent(originalUrl)}`, { signal: c.signal })
          }

          clearTimeout(t)
          if (r.ok) {
            xml = await r.text()
            console.log('[LeadRadar] Proxy OK:', feed.badge, xml.length, 'bytes')
          }
        } catch (err) {
          console.warn('[LeadRadar] Proxy fetch failed:', err)
        }

        if (!xml) { console.warn('[LeadRadar] Skip:', feed.badge, 'fetch failed'); continue }
        const entries = extractEntries(xml)
        totalFetched += entries.length

        for (const entry of entries) {
          const fullText = `${entry.title} ${entry.content}`.trim()
          const plainText = fullText.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim().slice(0, 2000)
          if (plainText.length < 20) continue

          // ── BLACKLIST: Gesperrte Quellen/Inhalte ──
          const sourceUrl = entry.link || feed.url
          if (isBlacklisted(plainText, sourceUrl)) {
            console.log('[LeadRadar] Blacklisted:', sourceUrl?.slice(0, 80))
            continue
          }

          let isMatch = false
          if (customNiche.trim().length > 0) {
            // Keyword-MATCH: Text muss das Keyword enthalten ODER kommerzielle Signale haben
            const lowerText = plainText.toLowerCase()
            const keyword = customNiche.trim().toLowerCase()
            const keywordInText = lowerText.includes(keyword)
            const hasCommercial = hasCommercialSignal(plainText)

            // Nur akzeptieren wenn: Keyword im Text ODER kommerzieller Kontext
            if (keywordInText || hasCommercial) {
              isMatch = true
            } else {
              console.log('[LeadRadar] No match:', keyword, 'not in text, no commercial signal')
              continue
            }
          } else {
            isMatch = matchesAny(plainText, KW_FRUSTRATION_EN, KW_FRUSTRATION_DE, KW_FRUSTRATION_PT, KW_MILESTONE_EN, KW_MILESTONE_DE, KW_MILESTONE_PT, KW_ADVICE_EN, KW_ADVICE_DE, KW_ADVICE_PT, KW_PRIVACY_EN, KW_PRIVACY_DE, KW_PRIVACY_PT, KW_BUILDER_EN, KW_BUILDER_DE, KW_BUILDER_PT, KW_TRADER_EN, KW_TRADER_DE, KW_TRADER_PT, KW_REALESTATE_EN, KW_REALESTATE_DE, KW_REALESTATE_PT)
          }
          if (!isMatch) continue

          let parsedDate = null
          if (entry.pubDate) {
            const pd = new Date(entry.pubDate)
            if (!isNaN(pd.getTime())) {
              parsedDate = pd
              if (maxAgeDays !== 'all') {
                const ageDays = (Date.now() - pd.getTime()) / (1000 * 60 * 60 * 24)
                if (ageDays > parseInt(maxAgeDays)) { console.log('[LeadRadar] Too old skip:', ageDays); continue }
              }
            }
          }

          totalMatched++
          if (existingUrlsRef.current.has(sourceUrl)) { console.log('[LeadRadar] Dedup skip:', sourceUrl.slice(0, 80)); continue }

          matchedEntries.push({
            platform: feed.platform,
            continent: feed.continent,
            lang: feed.lang,
            badge: detectBadge(plainText, feed.badge),
            source_url: sourceUrl,
            text: plainText,
            pubDate: parsedDate ? parsedDate.toISOString() : null,
            status: 'new',
          })
        }
      } catch (err) {
        console.warn('[LeadRadar] Feed error:', feed.url, err.message)
      }
    }

    const interleaved = interleaveByPlatform(matchedEntries)
    console.log('[LeadRadar] Interleaved', interleaved.length, 'entries by platform')

    for (const entry of interleaved) {
      try {
        let insertError = null
        const { error: e1 } = await supabase.from('leads').insert(entry)
        if (e1) {
          const { error: e2 } = await supabase.from('leads').insert({
            platform: entry.platform, continent: entry.continent, lang: entry.lang,
            source_url: entry.source_url, text: entry.text, status: 'new',
          })
          if (e2) insertError = e2
        }
        if (insertError) { console.warn('[LeadRadar] Insert skip:', insertError.message); continue }

        existingUrlsRef.current.add(entry.source_url)
        totalInserted++
        const newLead = { ...entry, id: 'live-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6), created_at: new Date().toISOString(), _isNew: true }
        newLeadIdsRef.current.add(newLead.id)
        setLeads(prev => [newLead, ...prev])
        playAlert()
      } catch (err) {
        console.warn('[LeadRadar] Batch insert error:', err.message)
      }
    }

    setRadarStats({ fetched: totalFetched, matched: totalMatched, inserted: totalInserted })
    console.log(`[LeadRadar] Scan done: ${totalFetched} fetched, ${totalMatched} matched, ${totalInserted} new — next scan in 60s`)

    radarLoopRef.current = setTimeout(() => {
      radarLoopRef.current = null
      setRadarActive(false)
      setTimeout(() => radarFnRef.current(), 500)
    }, 60000)
  }, [radarActive, activeContinent, customNiche, maxAgeDays, scanSources, userProduct])

  radarFnRef.current = runLiveRadar

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
    if (cooldowns[lead.platform]) {
      const remaining = Math.ceil((cooldowns[lead.platform] - Date.now()) / 1000)
      if (remaining > 0) {
        setResponses(prev => ({ ...prev, [lead.id]: `Pacing Warning: To prevent platform blockages, please wait ${remaining} seconds before pasting the next response to this specific network.` }))
        return
      }
    }
    setGenerating(prev => ({ ...prev, [lead.id]: true }))
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token || ''
      const badge = lead.badge || 'Creator'
      const b2bStrategyMap = {
        'News Radar': 'Nutze das Trigger-Event (z.B. Eröffnungen/PR). Wecke leise den Zweifel, ob der konstante Lead-Flow dafür schon 100% gesichert ist.',
        'Job Board': 'Dieser User hat Budget (sucht Leute). Pitche, wie NeXus (Lead Radar) manuellen Aufwand und teure Personalkosten bei der Akquise drastisch senkt.',
        'Global Search': 'Spiegele den Kern des Posts. Deute subtil an, dass verpasste Markt-Chancen (FOMO) unweigerlich zur geschäftlichen Stagnation und Isolation führen, wenn man technologisch den Anschluss verliert.',
        Business: 'Spiegele den Kern des Posts. Deute subtil an, dass verpasste Markt-Chancen (FOMO) unweigerlich zur geschäftlichen Stagnation und Isolation führen, wenn man technologisch den Anschluss verliert.',
      }
      const systemPrompt = `Du bist ein elitärer B2B-Sales-Psychologe. Dein Ziel ist es, folgendes Produkt / Angebot zu verkaufen: "${userProduct || 'NeXus Lead Radar'}".
SPRACHE: Antworte AUSSCHLIESSLICH auf ${lead.lang === 'de' ? 'Deutsch' : 'Englisch'}.
ZIELGRUPPE: B2B (Unternehmen, Händler, Agenturen, Selbstständige). 
REGELN:
- ABSOLUTES VERBOT: Erwähne NIEMALS Happiness, CapCut, Video-Schnitt oder Social Media Tutorials. Das ist strikt verboten!
- Sei hochprofessionell, messerscharf und ROI-fokussiert.
- Avocado Diaboli Strategie: Greife das Thema des Users subtil auf. Schüre psychologisches FOMO (Fear of Missing Out) und deute an, dass geschäftlicher Misserfolg oft in harter Isolation endet. 
- Erlösung: Positioniere das Angebot ("${userProduct || 'NeXus Lead Radar'}") beiläufig als das exklusive Werkzeug oder die perfekte Lösung, die den Schmerz des Leads sofort beseitigt.
- Max 3-4 Sätze. Kein verzweifelter Verkäufer-Slang, sondern ein souveränes "Du brauchst uns, wir nicht dich"-Mindset. Biete dezent ein Gespräch an.
STRATEGIE-FOKUS FÜR DIESE QUELLE (${badge}): ${b2bStrategyMap[badge] || b2bStrategyMap['Global Search']}`
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
      setCooldowns(prev => ({ ...prev, [lead.platform]: Date.now() + 90000 }))
      setTimeout(() => setCooldowns(prev => { const n = { ...prev }; delete n[lead.platform]; return n }), 91000)
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
          onClick={radarActive ? stopRadar : () => setConfigModalOpen(true)}
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
        <button className="lr-tab" style={{ border: '1px solid #10B981', background: 'rgba(16, 185, 129, 0.05)' }} onClick={() => setGuideModalOpen(true)}>
          <span className="lr-tab-flag">📖</span>
          <span className="lr-tab-label">Gebrauchsanweisung</span>
          <span className="lr-tab-platforms">NeXus Quickstart</span>
        </button>
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
          {leads.map((lead, idx) => {
            const hasFullAccess = isAdmin || isPremium;
            const isBlurred = !hasFullAccess && idx >= 3;

            return (
            <div key={lead.id} className={`lr-card ${newLeadIdsRef.current.has(lead.id) ? 'lr-card-new' : ''} ${isBlurred ? 'lr-card-blurred' : ''}`}>
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
              <p className="lr-card-text">{cleanText(lead.text)}</p>
              {lead.source_url && (
                <a href={isBlurred ? '#' : lead.source_url} target="_blank" rel="noopener noreferrer" className="lr-card-link">
                  <ExternalLink size={12} /> View original post
                </a>
              )}
              {lead.pubDate && <div className="lr-date" style={{ fontSize: '0.75rem', color: '#9CA3AF', marginTop: '6px' }}>Gefunden: {new Date(lead.pubDate).toLocaleDateString()}</div>}
              <button className="lr-generate-btn" onClick={() => isBlurred ? null : generateResponse(lead)} disabled={generating[lead.id] || isBlurred}>
                {generating[lead.id] ? <><Loader size={14} className="lr-spinner" /> Generating...</> : <><Zap size={14} /> Generate Global Helper Response</>}
              </button>
              {cooldowns[lead.platform] && !isBlurred && (
                <div className="lr-pacing-warning">
                  Pacing Warning: To prevent platform blockages, please wait {Math.ceil((cooldowns[lead.platform] - Date.now()) / 1000)} seconds before pasting the next response to {lead.platform}.
                </div>
              )}
              {responses[lead.id] && !isBlurred && (
                <div className="lr-response">
                  <div className="lr-response-text">{responses[lead.id]}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '12px' }}>
                    <CopyButton text={responses[lead.id]} />
                    <a href={`mailto:?subject=Kooperationsanfrage&body=${encodeURIComponent(responses[lead.id])}`} className="lr-btn-email" style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', background: 'rgba(59, 130, 246, 0.2)', border: '1px solid #3B82F6', color: '#3B82F6', borderRadius: '4px', textDecoration: 'none', fontSize: '0.85rem', cursor: 'pointer' }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>
                      Per E-Mail senden
                    </a>
                  </div>
                </div>
              )}
            </div>
          )})}
        </div>
      )}

      {/* PAYWALL OVERLAY */}
      {leads.length > 3 && !isAdmin && !isPremium && (
        <div className="lr-paywall-overlay">
          <div className="lr-paywall-content">
            <ShieldAlert size={48} className="lr-paywall-icon" />
            <h3>{leads.length - 3} weitere, warme B2B-Leads gefunden.</h3>
            <p>Deine Konkurrenz ruft diese Leads vielleicht genau in diesem Moment an. Upgrade auf NeXus Pro, um das Radar freizuschalten.</p>
            <a href={`https://buy.stripe.com/4gM28kaPN05Mac45F1gUM00?client_reference_id=${user?.id}`} className="lr-paywall-btn" target="_blank" rel="noopener noreferrer">
              NeXus Pro aktivieren (29,90€ / Monat)* <ArrowRight size={18} />
            </a>
            <p style={{ marginTop: '12px', fontSize: '0.85rem', color: '#9CA3AF' }}>*Limitiertes Early-Bird-Angebot (Regulär 99,00€).</p>
          </div>
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
      {configModalOpen && (
        <div className="lr-modal-overlay" onClick={() => setConfigModalOpen(false)}>
          <div className="lr-modal" onClick={e => e.stopPropagation()}>
            <div className="lr-modal-header">
              <h3>Radar Scan Configuration</h3>
              <button onClick={() => setConfigModalOpen(false)}><X size={16} /></button>
            </div>
            <div className="lr-modal-form" style={{ display: 'flex', flexDirection: 'column', gap: '20px', padding: '20px' }}>
                <label className="lr-form-full" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <span style={{ fontSize: '0.9rem', color: '#E5E7EB', fontWeight: '500' }}>Was verkaufst du? (Dein Angebot für die KI)</span>
                  <input type="text" placeholder="z.B. B2B Logistik in 85 Länder..." value={userProduct} onChange={e => setUserProduct(e.target.value)} style={{ width: '100%', boxSizing: 'border-box', padding: '10px 14px', fontSize: '1rem', background: '#1E293B', border: '1px solid #334155', color: '#F8FAFC', borderRadius: '6px' }} />
                </label>
                
                <label className="lr-form-full" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <span style={{ fontSize: '0.9rem', color: '#E5E7EB', fontWeight: '500' }}>Such-Keyword / Nische</span>
                  <input type="text" placeholder="e.g. Autohändler, Webdesign, Real Estate" value={customNiche} onChange={e => setCustomNiche(e.target.value)} style={{ width: '100%', boxSizing: 'border-box', padding: '10px 14px', fontSize: '1rem', background: '#1E293B', border: '1px solid #334155', color: '#F8FAFC', borderRadius: '6px' }} />
                </label>
                
                <div className="lr-form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <span style={{ fontSize: '0.9rem', color: '#E5E7EB', fontWeight: '500' }}>Zielregion (Continent)</span>
                    <select value={activeContinent} onChange={e => setActiveContinent(e.target.value)} style={{ width: '100%', boxSizing: 'border-box', padding: '10px 14px', fontSize: '1rem', background: '#1E293B', border: '1px solid #334155', color: '#F8FAFC', borderRadius: '6px' }}>
                      <option value="na">North America (US/CA)</option>
                      <option value="eu">Europe (DE/EU)</option>
                      <option value="latam">Latin America (BR/PT)</option>
                      <option value="apac">Asia-Pacific (AU)</option>
                    </select>
                  </label>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <span style={{ fontSize: '0.9rem', color: '#E5E7EB', fontWeight: '500' }}>Erscheinungseingrenzung (Zeitfilter)</span>
                    <select value={maxAgeDays} onChange={e => setMaxAgeDays(e.target.value)} style={{ width: '100%', boxSizing: 'border-box', padding: '10px 14px', fontSize: '1rem', background: '#1E293B', border: '1px solid #334155', color: '#F8FAFC', borderRadius: '6px' }}>
                      <option value="1">Letzte 24 Stunden</option>
                      <option value="7">Letzte 7 Tage</option>
                      <option value="30">Letzte 30 Tage</option>
                      <option value="all">Alle (Kein Filter)</option>
                    </select>
                  </label>
                </div>

                <div className="lr-form-full" style={{ marginTop: '10px' }}>
                  <span style={{ fontSize: '0.9rem', color: '#9CA3AF', marginBottom: '10px', display: 'block' }}>Datenquellen:</span>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', background: '#0F172A', padding: '12px', borderRadius: '8px', border: '1px solid #1E293B', marginBottom: '8px' }}>
                    <input type="checkbox" checked={scanSources.upwork} onChange={e => setScanSources(prev => ({...prev, upwork: e.target.checked}))} />
                    <span style={{ color: '#E5E7EB' }}>💼 B2B Job Boards (Upwork)</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', background: '#0F172A', padding: '12px', borderRadius: '8px', border: '1px solid #1E293B', marginBottom: '8px' }}>
                    <input type="checkbox" checked={scanSources.news} onChange={e => setScanSources(prev => ({...prev, news: e.target.checked}))} />
                    <span style={{ color: '#E5E7EB' }}>📰 Trigger Events (Google News)</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', background: '#0F172A', padding: '12px', borderRadius: '8px', border: '1px solid #1E293B' }}>
                    <input type="checkbox" checked={scanSources.reddit} onChange={e => setScanSources(prev => ({...prev, reddit: e.target.checked}))} />
                    <span style={{ color: '#E5E7EB' }}>🌍 Global Social Search (Reddit)</span>
                  </label>
                </div>

                <button className="lr-form-submit" onClick={() => { setConfigModalOpen(false); runLiveRadar(); }} style={{ marginTop: '10px', height: '52px', fontSize: '16px', fontWeight: 'bold' }}>
                  🚀 Speichern & Radar Starten
                </button>
              </div>
          </div>
        </div>
      )}

      {guideModalOpen && (
        <div className="lr-modal-overlay">
          <div className="lr-modal" style={{ maxWidth: '800px', maxHeight: '85vh', overflowY: 'auto' }}>
            <div className="lr-modal-header">
              <h3>NeXus Quickstart-Guide</h3>
              <button onClick={() => setGuideModalOpen(false)}><X size={16} /></button>
            </div>
            <div className="lr-modal-body" style={{ lineHeight: '1.6', color: '#E5E7EB', padding: '20px' }}>
              <p>Vergiss klassische Kaltakquise. Ab sofort kontaktierst du niemanden mehr auf gut Glück. Du nutzt <strong>Trigger-Events</strong>. Hier ist die genaue Anleitung, wie du mit NeXus täglich warme Leads generierst und abschließt.</p>
              
              <h4 style={{ color: '#F3F4F6', marginTop: '20px', borderBottom: '1px solid #374151', paddingBottom: '8px' }}>Grundregel: Was ist ein "Trigger-Event"?</h4>
              <p>Ein Trigger-Event ist ein Auslöser im Netz, der anzeigt, dass ein Unternehmen genau jetzt Bedarf an einer Lösung hat. NeXus sucht nicht nach Leuten, die rufen: "Ich brauche Produkt X!" (da ist die Konkurrenz bereits riesig). NeXus sucht nach Signalen: Ein neuer Manager wird eingestellt, in einem Forum wird über ein technisches Problem geklagt, oder ein Unternehmen expandiert.</p>
              
              <h4 style={{ color: '#F3F4F6', marginTop: '20px', borderBottom: '1px solid #374151', paddingBottom: '8px' }}>1. Radar & KI konfigurieren (Der Setup-Scan)</h4>
              <p>Klicke oben rechts auf das kleine Zahnrad ⚙️ (Einstellungen). Trage bei "Was verkaufst du?" dein eigenes Angebot ein (z.B. "B2B Software", "Logistik"). Die KI nutzt dieses Feld, um später deine Pitches zu schreiben! Dann wählst du deine Zielregion und klickst auf "Start Live Radar".</p>

              <h4 style={{ color: '#F3F4F6', marginTop: '20px', borderBottom: '1px solid #374151', paddingBottom: '8px' }}>2. Leads richtig lesen (Die Badges)</h4>
              <p>Das Radar spuckt dir Leads aus. <strong>News Radar:</strong> PR-Artikel, perfekt für Glückwünsche zur Expansion. <strong>Forum:</strong> Direkte Frustration eines Nutzers – extrem wertvoll, du kennst den Schmerzpunkt.</p>

              <h4 style={{ color: '#F3F4F6', marginTop: '20px', borderBottom: '1px solid #374151', paddingBottom: '8px' }}>3. Den KI-Pitch generieren (Der magische Button)</h4>
              <p>Schreibe keine Standard-Nachricht! Klicke auf den Button ⚡ "Generate Global Helper Response". Die KI analysiert den Kontext des Leads und schreibt dir eine hochpsychologische Vertriebsnachricht, die exakt dein Produkt als Lösung positioniert.</p>

              <h4 style={{ color: '#F3F4F6', marginTop: '20px', borderBottom: '1px solid #374151', paddingBottom: '8px' }}>4. Akquise durchführen</h4>
              <p>Klicke auf "View original post", recherchiere den Namen des Autors oder Managers, suche ihn auf LinkedIn und schicke ihm exakt den Text, den NeXus für dich generiert hat. Du nutzt Gratulationen und Schmerzpunkte als Hebel, um ein Gespräch anzufangen.</p>
            </div>
            <div className="lr-modal-footer">
              <button className="lr-btn-cancel" onClick={() => setGuideModalOpen(false)}>Verstanden</button>
            </div>
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

