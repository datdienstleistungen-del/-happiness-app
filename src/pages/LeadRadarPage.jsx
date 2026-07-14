import { useState, useEffect } from 'react'
import { Radar, Zap, Copy, Check, Globe, ArrowLeft, Loader, Plus, X, ExternalLink } from 'lucide-react'
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
}

const LANG_BADGES = {
  en: { color: '#3B82F6', label: 'EN' },
  de: { color: '#F59E0B', label: 'DE' },
  es: { color: '#10B981', label: 'ES' },
  fr: { color: '#8B5CF6', label: 'FR' },
  pt: { color: '#EF4444', label: 'PT' },
}

const EMPTY_FORM = {
  platform: 'reddit',
  continent: 'na',
  lang: 'en',
  badge: 'Creator',
  source_url: '',
  text: '',
}

const BADGE_OPTIONS = [
  { value: 'Gamer', label: '🎮 Gamer' },
  { value: 'Creator', label: '🎬 Creator' },
  { value: 'Business', label: '💼 Business' },
  { value: 'Milestone', label: '⭐ Milestone' },
  { value: 'Advice-Seeker', label: '❓ Advice-Seeker' },
  { value: 'Privacy-First', label: '🔒 Privacy-First' },
  { value: 'Builder', label: '🛠️ Builder' },
]

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

      if (error) throw error
      setLeads(data || [])
    } catch (e) {
      console.error('[LeadRadar] Fetch error:', e)
      setLeads([])
    } finally {
      setLoading(false)
    }
  }

  async function handleSaveLead(e) {
    e.preventDefault()
    if (!form.text.trim()) {
      setSaveError('Post text is required.')
      return
    }
    setSaving(true)
    setSaveError('')
    try {
      const { error } = await supabase.from('leads').insert({
        platform: form.platform,
        continent: form.continent,
        lang: form.lang,
        badge: form.badge,
        source_url: form.source_url.trim() || null,
        text: form.text.trim(),
        status: 'new',
        created_by: user?.id || null,
      })
      if (error) throw error
      setModalOpen(false)
      setForm(EMPTY_FORM)
      fetchLeads()
    } catch (err) {
      console.error('[LeadRadar] Insert error:', err)
      setSaveError(err.message || 'Failed to save lead.')
    } finally {
      setSaving(false)
    }
  }

  async function generateResponse(lead) {
    if (generating[lead.id]) return
    setGenerating(prev => ({ ...prev, [lead.id]: true }))
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token || ''
      const badge = lead.badge || 'Creator'

      let emotionDirective = ''
      if (badge === 'Milestone') {
        emotionDirective = `This user is CELEBRATING a personal milestone. You MUST start your response with enthusiastic congratulations. Be genuinely excited for them. Then naturally connect their win to how Happiness supports growing creators.`
      } else if (badge === 'Advice-Seeker') {
        emotionDirective = `This user is a BEGINNER seeking advice. You MUST provide a clear, simplified 3-step action plan BEFORE mentioning Happiness. Number the steps. Be encouraging and patient. Keep technical jargon minimal.`
      } else if (badge === 'Privacy-First') {
        emotionDirective = `This user cares deeply about PRIVACY and DATA PROTECTION. You MUST acknowledge their privacy concerns first, then explain how Happiness is GDPR-compliant, EU-hosted, and privacy-first. Use specific terms like 'no tracking', 'encrypted', 'EU servers'.`
      } else if (badge === 'Builder') {
        emotionDirective = `This user is a CREATIVE BUILDER (modder, map-maker, game developer). You MUST acknowledge their technical work first, then explain how Happiness helps builders share and monetize their creations.`
      } else if (badge === 'Gamer') {
        emotionDirective = `This user is a GAMER or STREAMER. Be casual, empathetic about the grind. Use gaming language naturally.`
      } else {
        emotionDirective = `This user is a CONTENT CREATOR or BUSINESS PROFESSIONAL. Be professional but warm, focused on growth and practical value.`
      }

      const systemPrompt = `Du bist ein Community-Outreach-Spezialist von Happiness Plattform.
SPRACHE: Antworte AUSSCHLIESSLICH auf ${lead.lang === 'de' ? 'Deutsch' : lead.lang === 'es' ? 'Spanisch' : lead.lang === 'fr' ? 'Französisch' : 'Englisch'}.

KONTEXT-BADGE: ${badge}

STILREGELN:
- Keine Floskeln, keine langen Einleitungen.
- Hilfreich, empathisch, lösungsorientiert.
- Maximal 3-4 Sätze.
- Erwähne Happiness NUR dezent und organisch wenn passend.

EMOTIONALE ANPASSUNG:
${emotionDirective}`

      const response = await fetch(getChatEndpoint(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          message: `User on ${lead.platform || 'Reddit'} (${badge}) writes:\n\n"${lead.text}"\n\nRespond directly and helpfully.`,
          systemPrompt,
          language: lead.lang || 'en',
          badge,
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
        <button className="lr-add-btn" onClick={() => { setForm({ ...EMPTY_FORM, continent: activeContinent }); setSaveError(''); setModalOpen(true) }}>
          <Plus size={16} /> Add Live Lead
        </button>
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
          <span>Scanning live feeds...</span>
        </div>
      ) : leads.length === 0 ? (
        <div className="lr-empty">
          <div className="lr-empty-radar">
            <Radar size={48} className="lr-radar-pulse" />
          </div>
          <h2>🛰️ Global Radar scanning...</h2>
          <p>Waiting for the next live creator request from Reddit/Discord.</p>
          <p className="lr-empty-sub">Leads appear here in real-time as they are detected across platforms.</p>
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
                {lead.badge && CONTEXT_BADGES[lead.badge] && (
                  <span
                    className="lr-context-badge"
                    style={{ background: CONTEXT_BADGES[lead.badge].color }}
                  >
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

      {modalOpen && (
        <div className="lr-modal-overlay" onClick={() => setModalOpen(false)}>
          <div className="lr-modal" onClick={e => e.stopPropagation()}>
            <div className="lr-modal-header">
              <h2>Add Live Lead</h2>
              <button className="lr-modal-close" onClick={() => setModalOpen(false)}>
                <X size={18} />
              </button>
            </div>
            <form className="lr-modal-form" onSubmit={handleSaveLead}>
              <div className="lr-form-row">
                <label>
                  <span>Platform</span>
                  <select value={form.platform} onChange={e => setForm(p => ({ ...p, platform: e.target.value }))}>
                    {PLATFORMS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                  </select>
                </label>
                <label>
                  <span>Continent</span>
                  <select value={form.continent} onChange={e => setForm(p => ({ ...p, continent: e.target.value }))}>
                    {CONTINENT_OPTIONS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                </label>
                <label>
                  <span>Language</span>
                  <select value={form.lang} onChange={e => setForm(p => ({ ...p, lang: e.target.value }))}>
                    {LANG_OPTIONS.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
                  </select>
                </label>
                <label>
                  <span>Context</span>
                  <select value={form.badge} onChange={e => setForm(p => ({ ...p, badge: e.target.value }))}>
                    {BADGE_OPTIONS.map(b => <option key={b.value} value={b.value}>{b.label}</option>)}
                  </select>
                </label>
              </div>
              <label className="lr-form-full">
                <span>Source URL</span>
                <input
                  type="url"
                  placeholder="https://reddit.com/r/..."
                  value={form.source_url}
                  onChange={e => setForm(p => ({ ...p, source_url: e.target.value }))}
                />
              </label>
              <label className="lr-form-full">
                <span>Post Text</span>
                <textarea
                  rows={5}
                  placeholder="Paste the creator's exact complaint here..."
                  value={form.text}
                  onChange={e => setForm(p => ({ ...p, text: e.target.value }))}
                  required
                />
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
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      const ta = document.createElement('textarea')
      ta.value = text
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <button className="lr-copy-btn" onClick={handleCopy}>
      {copied ? <><Check size={12} /> Copied!</> : <><Copy size={12} /> Copy Reply</>}
    </button>
  )
}
