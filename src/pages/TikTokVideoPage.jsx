import { useState, useRef, useEffect } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import {
  Sparkles, ArrowLeft, Film, Check, AlertTriangle, ExternalLink,
  Smartphone, Monitor, Copy, RotateCcw, Clock, Mic, Image, ChevronDown, ChevronUp, Lightbulb, Zap
} from 'lucide-react'
import CopyButton from '../components/CopyButton'
import './TikTokVideoPage.css'

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

  return (
    <div className="ccp-page">
      <div className="ccp-header">
        <button className="ccp-back" onClick={() => navigate(-1)}>
          <ArrowLeft size={20} />
        </button>
        <h1><Film size={22} /> CapCut Rezept-Generator</h1>
      </div>

      <div className="ccp-hero">
        <div className="ccp-hero-icon"><Zap size={28} /></div>
        <h2>Video-Skript & Prompts in Sekunden</h2>
        <p className="ccp-hero-sub">
          Beschreib dein Thema, und die KI erstellt dir ein komplettes Video-Rezept mit Voiceover-Skript
          und visuellen Prompts für CapCut. Kostenloser, professioneller Endresultat.
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
          <span className="ccp-step-text">In CapCut einfügen</span>
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
          <p className="ccp-loading-sub">Die KI schreibt dein Skript und die visuellen Prompts</p>
        </div>
      )}

      {recipe && (
        <div className="ccp-result">
          <div className="ccp-result-header">
            <h2 className="ccp-result-title">{recipe.video_title}</h2>
            <div className="ccp-result-meta">
              <span>{recipe.scenes.length} Szenen</span>
              <span>•</span>
              <span>{duration}s Video</span>
            </div>
          </div>

          <div className="ccp-section">
            <div className="ccp-section-header">
              <Mic size={18} />
              <h3>Voiceover-Skript</h3>
              <CopyButton text={recipe.voiceover_script} label="Ganzes Skript kopieren" />
            </div>
            <div className="ccp-script-box">
              <p className="ccp-script-text">{recipe.voiceover_script}</p>
            </div>
          </div>

          <div className="ccp-section">
            <div className="ccp-section-header">
              <Image size={18} />
              <h3>Szenen & Prompts</h3>
            </div>
            <div className="ccp-scenes-list">
              {recipe.scenes.map((scene, i) => (
                <SceneCard key={i} scene={scene} index={i} />
              ))}
            </div>
          </div>

          <div className="ccp-section">
            <div className="ccp-section-header">
              <ExternalLink size={18} />
              <h3>In CapCut öffnen</h3>
            </div>
            <div className="ccp-capcut-links">
              <a
                href="capcut://"
                className="ccp-capcut-btn mobile"
                onClick={() => {
                  try { gtag('event', 'capcut_open_mobile', { source: 'capcut_recipe' }) } catch {}
                }}
              >
                <Smartphone size={20} />
                <div>
                  <span className="ccp-capcut-label">Am Smartphone öffnen</span>
                  <span className="ccp-capcut-sub">Öffnet die CapCut-App direkt</span>
                </div>
              </a>
              <a
                href="https://capcut.com"
                target="_blank"
                rel="noopener noreferrer"
                className="ccp-capcut-btn desktop"
                onClick={() => {
                  try { gtag('event', 'capcut_open_web', { source: 'capcut_recipe' }) } catch {}
                }}
              >
                <Monitor size={20} />
                <div>
                  <span className="ccp-capcut-label">Im Web-Browser öffnen (Free)</span>
                  <span className="ccp-capcut-sub">capcut.com im neuen Tab</span>
                </div>
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
                <p><strong>Voiceover-Skript kopieren</strong> — Klick auf "Kopieren" oben und füge den Text in CapCut's Text-to-Speech ein.</p>
              </div>
              <div className="ccp-guide-step">
                <span className="ccp-guide-num">2</span>
                <p><strong>Prompts für Bilder verwenden</strong> — Kopiere jeden Prompt und generiere damit Bilder in Midjourney, DALL-E oder CapCut's KI-Generator.</p>
              </div>
              <div className="ccp-guide-step">
                <span className="ccp-guide-num">3</span>
                <p><strong>In CapCut zusammensetzen</strong> — Füge Bilder, Voiceover und Musik zusammen und exportiere dein fertiges Video.</p>
              </div>
            </div>
          </div>

          <div className="ccp-result-actions">
            <button
              className="ccp-btn-outline"
              onClick={() => {
                setRecipe(null)
                setError('')
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
