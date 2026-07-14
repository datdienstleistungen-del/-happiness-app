import { useState, useRef, useEffect } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import {
  Sparkles, ArrowLeft, Film, Check, AlertTriangle, ExternalLink,
  Smartphone, Monitor, RotateCcw, Clock, Mic, Image, ChevronDown, ChevronUp,
  Lightbulb, Zap, Share2, Globe, Video, MessageSquare, Hash
} from 'lucide-react'
import CopyButton from '../components/CopyButton'
import { trackRecipeGenerated, trackPlatformViewed, trackCapCutTriggered } from '../intelligence/analytics'
import './TikTokVideoPage.css'

const PLATFORMS = [
  { id: 'tiktok_instagram', label: 'TikTok / Instagram', icon: Hash, color: '#E4405F' },
  { id: 'linkedin_facebook', label: 'LinkedIn / Facebook', icon: Globe, color: '#0A66C2' },
  { id: 'youtube_shorts', label: 'YouTube Shorts', icon: Video, color: '#FF0000' },
  { id: 'reddit', label: 'Reddit', icon: MessageSquare, color: '#FF4500' }
]

const CHANNELS = [
  { name: 'TikTok', connected: false },
  { name: 'Instagram', connected: false },
  { name: 'YouTube', connected: false },
  { name: 'LinkedIn', connected: false },
  { name: 'Facebook', connected: false },
  { name: 'Reddit', connected: false }
]

const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)

export default function TikTokVideoPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()

  const [topic, setTopic] = useState(location.state?.postText || '')
  const [duration, setDuration] = useState(30)
  const [recipe, setRecipe] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [activePlatform, setActivePlatform] = useState('tiktok_instagram')

  const pipelineUsed = useRef(false)
  useEffect(() => {
    const pipelineResult = location.state?.pipelineResult
    if (pipelineResult?.recipe && !pipelineUsed.current) {
      pipelineUsed.current = true
      setTopic(location.state?.postText || '')
      setRecipe(pipelineResult.recipe)
    }
  }, [])

  const sanitize = (input) => {
    return input.replace(/<[^>]*>/g, '').trim().substring(0, 2000)
  }

  const generateRecipe = async () => {
    if (!topic.trim() || topic.trim().length < 3) return

    setLoading(true)
    setError('')
    setRecipe(null)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token || ''

      const res = await fetch('/api/capcut-recipe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          topic: sanitize(topic),
          duration
        })
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Unbekannter Fehler' }))
        throw new Error(err.error || `Fehler (${res.status})`)
      }

      const data = await res.json()
      setRecipe(data)
      trackRecipeGenerated(data.video_title, duration)
    } catch (err) {
      console.error('[CapCut] Recipe error:', err)
      const msg = err.message || ''
      if (msg.includes('429') || msg.includes('ausgelastet')) {
        setError('Zu viele Anfragen. Bitte warte kurz und versuch es nochmal.')
      } else if (msg.includes('fetch') || msg.includes('network')) {
        setError('Keine Verbindung zum Server. Prüf dein Internet.')
      } else {
        setError(err.error || 'Rezept konnte nicht generiert werden. Bitte versuch es nochmal.')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      generateRecipe()
    }
  }

  const getPlatformContent = (platform, payload) => {
    if (!payload) return null
    const data = payload[platform]
    if (!data) return null

    switch (platform) {
      case 'tiktok_instagram':
        return (
          <>
            <div className="ccp-platform-field">
              <label>Hook (Text-Overlay)</label>
              <div className="ccp-platform-value">{data.hook}</div>
              <CopyButton text={data.hook} label="Hook kopieren" />
            </div>
            <div className="ccp-platform-field">
              <label>Description / Caption</label>
              <div className="ccp-platform-value ccp-platform-value--pre">{data.description}</div>
              <CopyButton text={data.description} label="Caption kopieren" />
            </div>
          </>
        )
      case 'linkedin_facebook':
        return (
          <>
            <div className="ccp-platform-field">
              <label>Headline</label>
              <div className="ccp-platform-value">{data.headline}</div>
              <CopyButton text={data.headline} label="Headline kopieren" />
            </div>
            <div className="ccp-platform-field">
              <label>Beitragstext</label>
              <div className="ccp-platform-value ccp-platform-value--pre">{data.body_text}</div>
              <CopyButton text={data.body_text} label="Text kopieren" />
            </div>
          </>
        )
      case 'youtube_shorts':
        return (
          <>
            <div className="ccp-platform-field">
              <label>Titel (max 60 Zeichen)</label>
              <div className="ccp-platform-value">{data.title}</div>
              <CopyButton text={data.title} label="Titel kopieren" />
            </div>
            <div className="ccp-platform-field">
              <label>Beschreibung</label>
              <div className="ccp-platform-value ccp-platform-value--pre">{data.description}</div>
              <CopyButton text={data.description} label="Beschreibung kopieren" />
            </div>
          </>
        )
      case 'reddit':
        return (
          <>
            <div className="ccp-platform-field">
              <label>Post-Titel</label>
              <div className="ccp-platform-value">{data.title}</div>
              <CopyButton text={data.title} label="Titel kopieren" />
            </div>
            <div className="ccp-platform-field">
              <label>Beitragstext</label>
              <div className="ccp-platform-value ccp-platform-value--pre">{data.body_text}</div>
              <CopyButton text={data.body_text} label="Text kopieren" />
            </div>
          </>
        )
      default:
        return null
    }
  }

  return (
    <div className="ccp-page">
      <div className="ccp-header">
        <button className="ccp-back" onClick={() => navigate(-1)}>
          <ArrowLeft size={20} />
        </button>
        <h1><Film size={22} /> H.I.T. Social Publisher</h1>
      </div>

      {!recipe && !loading && (
        <div className="ccp-banner">
          <Zap size={18} />
          <div>
            <strong>H.I.T. Direkt-Posting aktiv:</strong> Dein Skript wird automatisch an CapCut übergeben.
            Nach dem automatischen Videoschnitt kannst du es mit einem Klick sofort auf deinen Kanälen veröffentlichen.
          </div>
        </div>
      )}

      <div className="ccp-hero">
        <div className="ccp-hero-icon"><Zap size={28} /></div>
        <h2>Content Engine & Social Publisher</h2>
        <p className="ccp-hero-sub">
          Beschreib dein Thema — die KI erstellt dir ein CapCut-Rezept mit Voiceover-Skript,
          visuellen Prompts und plattformspezifischen Publishing-Payloads für alle deine Kanäle.
        </p>
      </div>

      <div className="ccp-steps">
        <div className="ccp-step">
          <div className="ccp-step-num">1</div>
          <span className="ccp-step-text">Thema eingeben</span>
        </div>
        <div className="ccp-step-arrow">→</div>
        <div className="ccp-step">
          <div className="ccp-step-num">2</div>
          <span className="ccp-step-text">Rezept generieren</span>
        </div>
        <div className="ccp-step-arrow">→</div>
        <div className="ccp-step">
          <div className="ccp-step-num">3</div>
          <span className="ccp-step-text">Posten auf allen Kanälen</span>
        </div>
      </div>

      {!recipe && !loading && (
        <div className="ccp-input-section">
          <div className="ccp-input-group">
            <label className="ccp-label">
              <Lightbulb size={16} /> Worum geht es in deinem Video?
            </label>
            <textarea
              className="ccp-textarea"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="z.B. '5 Tipps für ein glücklicheres Leben' oder 'Mein Produkt: Handgemachte Kerzen aus Sojawachs'"
              rows={3}
            />
          </div>

          <div className="ccp-input-group">
            <label className="ccp-label">
              <Clock size={16} /> Videolänge
            </label>
            <div className="ccp-duration-options">
              {[15, 30, 45, 60].map(d => (
                <button
                  key={d}
                  className={`ccp-duration-btn ${duration === d ? 'active' : ''}`}
                  onClick={() => setDuration(d)}
                >
                  {d}s
                </button>
              ))}
            </div>
          </div>

          <button
            className="ccp-generate-btn"
            onClick={generateRecipe}
            disabled={!topic.trim() || topic.trim().length < 3 || loading}
          >
            <Sparkles size={18} /> Rezept generieren
          </button>

          {error && (
            <div className="ccp-error">
              <AlertTriangle size={16} /> {error}
            </div>
          )}
        </div>
      )}

      {loading && (
        <div className="ccp-loading">
          <div className="ccp-spinner" />
          <p className="ccp-loading-text">Rezept wird generiert...</p>
          <p className="ccp-loading-sub">Die KI schreibt dein Skript, Prompts & Publishing-Payloads</p>
        </div>
      )}

      {recipe && (
        <div className="ccp-result">
          <div className="ccp-result-header">
            <h2 className="ccp-result-title">{recipe.video_title}</h2>
            <div className="ccp-result-meta">
              <span>{recipe.scenes.length} Szenen</span>
              <span>·</span>
              <span>{duration}s Video</span>
              <span>·</span>
              <span>4 Plattformen</span>
            </div>
          </div>

          <div className="ccp-banner ccp-banner--success">
            <Zap size={18} />
            <div>
              <strong>H.I.T. Direkt-Posting aktiv:</strong> Dein Skript wird automatisch an CapCut übergeben.
              Nach dem automatischen Videoschnitt kannst du es mit einem Klick sofort auf deinen Kanälen
              (TikTok, Instagram, YouTube, LinkedIn, Facebook, Reddit) veröffentlichen.
            </div>
          </div>

          <div className="ccp-section">
            <div className="ccp-section-header">
              <Mic size={18} />
              <h3>Master Video Script</h3>
              <CopyButton text={recipe.voiceover_script} label="Ganzes Skript kopieren" />
            </div>
            <div className="ccp-script-box">
              <p className="ccp-script-text">{recipe.voiceover_script}</p>
            </div>
          </div>

          {recipe.publishing_payload && (
            <div className="ccp-section">
              <div className="ccp-section-header">
                <Share2 size={18} />
                <h3>Publishing Package</h3>
              </div>

              <div className="ccp-platform-tabs">
                {PLATFORMS.map(p => {
                  const Icon = p.icon
                  return (
                    <button
                      key={p.id}
                      className={`ccp-platform-tab ${activePlatform === p.id ? 'active' : ''}`}
                      onClick={() => { setActivePlatform(p.id); trackPlatformViewed(p.id) }}
                      style={activePlatform === p.id ? { borderColor: p.color, color: p.color } : {}}
                    >
                      <Icon size={14} />
                      <span>{p.label}</span>
                    </button>
                  )
                })}
              </div>

              <div className="ccp-platform-content">
                {getPlatformContent(activePlatform, recipe.publishing_payload)}
              </div>
            </div>
          )}

          <div className="ccp-section">
            <div className="ccp-section-header">
              <Image size={18} />
              <h3>Szenen & Visual Prompts</h3>
            </div>
            <div className="ccp-scenes-list">
              {recipe.scenes.map((scene, i) => (
                <SceneCard key={i} scene={scene} index={i} />
              ))}
            </div>
          </div>

          <div className="ccp-section ccp-action-hub">
            <div className="ccp-section-header">
              <Zap size={18} />
              <h3>H.I.T. Direct Action Hub</h3>
            </div>

            <a
              href={isMobile ? 'capcut://com.lemon.lvoverseas' : 'https://pippit.ai'}
              target={isMobile ? undefined : '_blank'}
              rel={isMobile ? undefined : 'noopener noreferrer'}
              className="ccp-action-primary"
              onClick={() => trackCapCutTriggered()}
            >
              <Video size={20} />
              <div>
                <span className="ccp-action-label">Video via CapCut-Autopilot erstellen & sofort posten</span>
                <span className="ccp-action-sub">Skript + Prompts in CapCut einfügen → Video exportieren → Auf Kanälen posten</span>
              </div>
              <ExternalLink size={16} />
            </a>

            <div className="ccp-free-guard">
              H.I.T. Free-Tipp: CapCut bietet im Editor manchmal ein Upgrade an. Du kannst die Videoerstellung mit dem kostenlosen Modell "Seedance Mini" einfach ohne Abo fortsetzen!
            </div>

            <div className="ccp-channels">
              <span className="ccp-channels-label">Kanäle:</span>
              {CHANNELS.map(ch => (
                <span key={ch.name} className="ccp-channel-badge">
                  <span className="ccp-channel-dot" />
                  {ch.name}
                </span>
              ))}
            </div>

            <div className="ccp-capcut-links-secondary">
              <a href="capcut://" className="ccp-capcut-btn-sm mobile">
                <Smartphone size={16} /> Smartphone
              </a>
              <a href="https://capcut.com" target="_blank" rel="noopener noreferrer" className="ccp-capcut-btn-sm desktop">
                <Monitor size={16} /> Web-Browser
              </a>
            </div>
            <p className="ccp-capcut-hint">Tipp: In CapCut einfach auf "Neues Video" klicken, um den kostenlosen Editor zu nutzen.</p>
          </div>

          <div className="ccp-section">
            <div className="ccp-section-header">
              <Lightbulb size={18} />
              <h3>So geht's</h3>
            </div>
            <div className="ccp-guide">
              <div className="ccp-guide-step">
                <span className="ccp-guide-num">1</span>
                <p><strong>Skript kopieren</strong> — Klick auf "Kopieren" und füge den Text in CapCut's Text-to-Speech ein.</p>
              </div>
              <div className="ccp-guide-step">
                <span className="ccp-guide-num">2</span>
                <p><strong>Prompts für Bilder</strong> — Kopiere jeden Prompt und generiere damit Bilder in Midjourney, DALL-E oder CapCut's KI-Generator.</p>
              </div>
              <div className="ccp-guide-step">
                <span className="ccp-guide-num">3</span>
                <p><strong>In CapCut zusammensetzen</strong> — Füge Bilder, Voiceover und Musik zusammen und exportiere dein Video.</p>
              </div>
              <div className="ccp-guide-step">
                <span className="ccp-guide-num">4</span>
                <p><strong>Publishing-Texte nutzen</strong> — Kopiere die plattformspezifischen Captions und poste dein Video auf allen Kanälen.</p>
              </div>
            </div>
          </div>

          <div className="ccp-result-actions">
            <button
              className="ccp-btn-outline"
              onClick={() => {
                setRecipe(null)
                setError('')
                setActivePlatform('tiktok_instagram')
              }}
            >
              <RotateCcw size={16} /> Neues Rezept generieren
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function SceneCard({ scene, index }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="ccp-scene-card">
      <div className="ccp-scene-header" onClick={() => setExpanded(!expanded)}>
        <div className="ccp-scene-left">
          <span className="ccp-scene-num">{index + 1}</span>
          <div className="ccp-scene-info">
            <span className="ccp-scene-timestamp">{scene.timestamp}</span>
            <span className="ccp-scene-spoken">{scene.spoken_text.substring(0, 60)}{scene.spoken_text.length > 60 ? '...' : ''}</span>
          </div>
        </div>
        {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </div>

      {expanded && (
        <div className="ccp-scene-body">
          <div className="ccp-scene-section">
            <h4>Gesprochener Text</h4>
            <p>{scene.spoken_text}</p>
          </div>
          <div className="ccp-scene-section">
            <div className="ccp-scene-prompt-header">
              <h4>Visueller Prompt</h4>
              <CopyButton text={scene.visual_prompt} label="Prompt kopieren" />
            </div>
            <div className="ccp-scene-prompt">
              <code>{scene.visual_prompt}</code>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
