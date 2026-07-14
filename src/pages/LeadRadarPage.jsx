import { useState, useEffect } from 'react'
import { Radar, Zap, Copy, Check, Globe, ArrowLeft, Loader } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { getChatEndpoint } from '../lib/hit'
import './LeadRadarPage.css'

const CONTINENTS = [
  { id: 'na', label: 'North America', flag: '🇺🇸', platforms: 'Reddit / X', lang: 'en' },
  { id: 'eu', label: 'Europe', flag: '🇪🇺', platforms: 'Forums / FB', lang: 'de' },
  { id: 'latam', label: 'Latin America', flag: '🇧🇷', platforms: 'Discord', lang: 'es' },
  { id: 'apac', label: 'Asia-Pacific', flag: '🇦🇺', platforms: 'Gaming Boards', lang: 'en' },
]

const PLATFORM_BADGES = {
  reddit: { color: '#FF4500', label: 'Reddit' },
  discord: { color: '#5865F2', label: 'Discord' },
  twitter: { color: '#1DA1F2', label: 'X / Twitter' },
  twitch: { color: '#9146FF', label: 'Twitch' },
  facebook: { color: '#1877F2', label: 'Facebook' },
  forum: { color: '#6B7280', label: 'Forum' },
  other: { color: '#9CA3AF', label: 'Other' },
}

const LANG_BADGES = {
  en: { color: '#3B82F6', label: 'EN' },
  de: { color: '#F59E0B', label: 'DE' },
  es: { color: '#10B981', label: 'ES' },
  fr: { color: '#8B5CF6', label: 'FR' },
  pt: { color: '#EF4444', label: 'PT' },
}

export default function LeadRadarPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [activeContinent, setActiveContinent] = useState('na')
  const [leads, setLeads] = useState([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState({})
  const [responses, setResponses] = useState({})

  useEffect(() => { fetchLeads() }, [activeContinent])

  async function fetchLeads() {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('leads')
        .select('*')
        .eq('continent', activeContinent)
        .order('created_at', { ascending: false })
        .limit(50)

      if (error) {
        console.warn('[LeadRadar] Query failed, using demo data:', error.message)
        setLeads(getDemoLeads(activeContinent))
      } else {
        setLeads(data && data.length > 0 ? data : getDemoLeads(activeContinent))
      }
    } catch (e) {
      console.warn('[LeadRadar] Connection failed, using demo data')
      setLeads(getDemoLeads(activeContinent))
    } finally {
      setLoading(false)
    }
  }

  async function generateResponse(lead) {
    if (generating[lead.id]) return
    setGenerating(prev => ({ ...prev, [lead.id]: true }))

    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token || ''

      const systemPrompt = `Du bist ein Community-Outreach-Spezialist von Happiness. 
Antworte KURZ und DIREKT im Ton der Plattform des Users. 
Keine Floskeln, keine langen Einleitungen. 
Hilfreich, empathisch, lösungsorientiert.
Sprache: ${lead.lang || 'en'}.
Maximal 3-4 Sätze.`

      const response = await fetch(getChatEndpoint(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          message: `Ein User auf ${lead.platform || 'Reddit'} schreibt:\n\n"${lead.text}"\n\nAntworte direkt und hilfreich. Erwähne Happiness nur dezent wenn passend.`,
          systemPrompt,
          language: lead.lang || 'en',
          userId: user?.id || '',
          history: []
        })
      })

      if (!response.ok) throw new Error(`API ${response.status}`)
      const data = await response.json()

      setResponses(prev => ({ ...prev, [lead.id]: data.response || 'No response generated.' }))
    } catch (err) {
      console.error('[LeadRadar] Generate error:', err)
      setResponses(prev => ({ ...prev, [lead.id]: 'Error: ' + err.message }))
    } finally {
      setGenerating(prev => ({ ...prev, [lead.id]: false }))
    }
  }

  return (
    <div className="lr-page">
      <div className="lr-header">
        <button className="lr-back" onClick={() => navigate(-1)}>
          <ArrowLeft size={18} />
        </button>
        <div className="lr-title">
          <Radar size={22} />
          <h1>Global Lead Radar</h1>
        </div>
        <span className="lr-badge">{leads.length} leads</span>
      </div>

      <div className="lr-tabs">
        {CONTINENTS.map(c => (
          <button
            key={c.id}
            className={`lr-tab ${activeContinent === c.id ? 'active' : ''}`}
            onClick={() => setActiveContinent(c.id)}
          >
            <span className="lr-tab-flag">{c.flag}</span>
            <span className="lr-tab-label">{c.label}</span>
            <span className="lr-tab-platforms">{c.platforms}</span>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="lr-loading">
          <Loader size={24} className="lr-spinner" />
          <span>Loading leads...</span>
        </div>
      ) : leads.length === 0 ? (
        <div className="lr-empty">
          <Globe size={40} />
          <p>No leads found for this region.</p>
          <p className="lr-empty-sub">Leads will appear here when scraped from the configured platforms.</p>
        </div>
      ) : (
        <div className="lr-grid">
          {leads.map(lead => (
            <div key={lead.id} className="lr-card">
              <div className="lr-card-top">
                <span
                  className="lr-platform-badge"
                  style={{ background: (PLATFORM_BADGES[lead.platform] || PLATFORM_BADGES.other).color }}
                >
                  {(PLATFORM_BADGES[lead.platform] || PLATFORM_BADGES.other).label}
                </span>
                <span
                  className="lr-lang-badge"
                  style={{ background: (LANG_BADGES[lead.lang] || LANG_BADGES.en).color }}
                >
                  {(LANG_BADGES[lead.lang] || LANG_BADGES.en).label}
                </span>
              </div>

              <p className="lr-card-text">{lead.text}</p>

              {lead.url && (
                <a href={lead.url} target="_blank" rel="noopener noreferrer" className="lr-card-link">
                  View original post →
                </a>
              )}

              <button
                className="lr-generate-btn"
                onClick={() => generateResponse(lead)}
                disabled={generating[lead.id]}
              >
                {generating[lead.id] ? (
                  <><Loader size={14} className="lr-spinner" /> Generating...</>
                ) : (
                  <><Zap size={14} /> Generate Global Helper Response</>
                )}
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
    </div>
  )
}

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      const ta = document.createElement('textarea')
      ta.value = text
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <button className="lr-copy-btn" onClick={handleCopy}>
      {copied ? <><Check size={12} /> Copied!</> : <><Copy size={12} /> Copy Reply</>}
    </button>
  )
}

function getDemoLeads(continent) {
  const demo = {
    na: [
      { id: 'd1', platform: 'reddit', lang: 'en', text: "Streaming to 0 viewers for 6 months. I post every day, use tags, raid others... nothing works. Is it even worth continuing?", url: '#', continent: 'na' },
      { id: 'd2', platform: 'twitter', lang: 'en', text: "Just started my creator journey and I'm completely lost. How do you even get your first 100 followers without begging?", url: '#', continent: 'na' },
      { id: 'd3', platform: 'twitch', lang: 'en', text: "My YouTube shorts get 5 views max. I see people with worse content blowing up. What am I doing wrong?", url: '#', continent: 'na' },
    ],
    eu: [
      { id: 'd4', platform: 'reddit', lang: 'de', text: "Ich poste seit 3 Monaten auf TikTok und habe immer noch keine 100 Follower. Die Algorithmus-Hinweise bringen nichts. Jemand Tipps?", url: '#', continent: 'eu' },
      { id: 'd5', platform: 'facebook', lang: 'de', text: "Wie bekomme ich mehr Engagement auf LinkedIn? Meine Beiträge erreichen niemanden obwohl ich qualitativen Content mache.", url: '#', continent: 'eu' },
    ],
    latam: [
      { id: 'd6', platform: 'discord', lang: 'es', text: "Llevo meses creando contenido y nada crece. Siento que todo el mundo tiene un secreto que yo no sé. ¿Alguien más se siente así?", url: '#', continent: 'latam' },
      { id: 'd7', platform: 'discord', lang: 'pt', text: "Comecei a criar conteúdo mas não sei como crescer. Alguém pode me ajudar com dicas reais?", url: '#', continent: 'latam' },
    ],
    apac: [
      { id: 'd8', platform: 'forum', lang: 'en', text: "Gaming content in SEA is so saturated. Every game has 1000 creators already. How do you stand out in 2026?", url: '#', continent: 'apac' },
    ],
  }
  return demo[continent] || []
}
