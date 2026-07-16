import { useState } from 'react'
import { useLocation, useNavigate, Link } from 'react-router-dom'
import { ArrowLeft, Copy, Check, Sparkles, Share2, MessageCircle, Rocket } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { getChatEndpoint } from '../lib/hit'
import './PostPreparationPage.css'

const TONES = [
  {
    id: 'business',
    label: 'Business & Kleinanzeigen',
    icon: '💼',
    prompt: `Rolle: Du bist ein erfahrener Texter für professionelle Plattformen wie eBay Kleinanzeigen, LinkedIn undgeschäftliche Netzwerke.
Aufgabe: Schreibe einen fertigen, postfertigen Text basierend auf dem Entwurf. Absolut KEIN Gaming-Slang, KEINE umgangssprachlichen Ausdrücke.
Stil: Professionell, klar, überzeugend, gut strukturiert. Optimiert für direkte Kaufanfragen oder geschäftliche Kontaktaufnahme.
Struktur: Kurzer Hook, 2-3 Absätze mit klarem Nutzenversprechen, Call-to-Action am Ende.
Sprache: Hochwertiges Deutsch, keine Emojis, keine Ausrufezeichen-Overkill.
Format: Nur den fertigen Text ausgeben. Kein Meta-Kommentar, keine Analyse, keine Aufzählung von Verbesserungen.`
  },
  {
    id: 'gamer',
    label: 'Gamer & Streamer',
    icon: '🎮',
    prompt: `Rolle: Du bist ein authentischer Gamer und Streamer, der in der Community bekannt ist.
Aufgabe: Schreibe einen kurzen, prägnanten Post im echten Gamer-Slang. NUTZE DIESE KEYWORDS NATÜRLICH: Clutch, bodenlos, Rage-Quit, Highlight, Macher, Noob, Sweaten, Chat ist eskaliert.
Stil: Short, punchy, max. 4 Bullet Points. Wie ein echter Gamertweet, kein Marketing-Text.
Struktur: 1-2 Sätze Hook, 2-3 Bullet Points mit den Highlights, abschließender CTA oder Frage an die Community.
Format: Nur den fertigen Text ausgeben. Kein Meta-Kommentar, keine Analyse.`
  },
  {
    id: 'creative',
    label: 'Kreativ & Viral',
    icon: '✨',
    prompt: `Rolle: Du bist ein kreativer Content Creator für Instagram, TikTok und Lifestyle-Blogs.
Aufgabe: Schreibe einen emotionalen, viral-tauglichen Post mit starken Hooks und passenden Emojis.
Stil: Storytelling, emotional, eingängig. Optimiert für Likes, Shares und Kommentare.
Struktur: Aufmerksamkeitsstarke Hook-Zeile, 2-3 Absätze mit Story/Emotion, relevante Emojis, 5-8 Hashtags am Ende (immer #happiness).
Format: Nur den fertigen Text ausgeben. Kein Meta-Kommentar, keine Analyse.`
  }
]

export default function PostPreparationPage() {
  const { user } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()

  const draft = location.state?.draft || localStorage.getItem('happiness-draft') || ''

  const [activeTone, setActiveTone] = useState('business')
  const [rewrittenPost, setRewrittenPost] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const generateRewrite = async (toneId) => {
    if (loading) return
    setActiveTone(toneId)
    setLoading(true)
    setError('')
    setRewrittenPost('')

    const tone = TONES.find(t => t.id === toneId)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token || ''

      const message = `Entwurf:\n\n"${draft}"\n\nSchreibe den fertigen Post im gewählten Stil.`

      const response = await fetch(getChatEndpoint(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          message,
          systemPrompt: tone.prompt,
          userId: user?.id || '',
          history: []
        })
      })

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}))
        throw new Error(errData.error || `API Fehler ${response.status}`)
      }

      const data = await response.json()
      if (!data.response) {
        throw new Error('Leere Antwort von der KI')
      }
      setRewrittenPost(data.response)
    } catch (err) {
      console.error(`Generate ${toneId} error:`, err)
      const msg = err.message || ''
      if (msg.includes('limit') || msg.includes('429')) {
        setError('Zu viele Anfragen gerade. Bitte warte kurz und versuch es nochmal.')
      } else if (msg.includes('fetch') || msg.includes('network')) {
        setError('Keine Verbindung zum Server. Prüf dein Internet und versuch es nochmal.')
      } else {
        setError('Beim Generieren ist ein Fehler aufgetreten. Bitte versuch es nochmal.')
      }
    } finally {
      setLoading(false)
    }
  }

  if (!draft) {
    return (
      <div className="post-prep-page">
        <div className="post-prep-container">
          <div className="post-prep-header">
            <button className="post-prep-back" onClick={() => navigate(-1)}>
              <ArrowLeft size={18} /> Zurueck
            </button>
            <h1>Post vorbereiten</h1>
            <p className="post-prep-subtitle">Kein Entwurf vorhanden. Geh zurueck und starte von vorne.</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="post-prep-page">
      <div className="post-prep-container">
        <div className="post-prep-header">
          <button className="post-prep-back" onClick={() => navigate('/creator-academy')}>
            <ArrowLeft size={18} /> Zurueck zum Feedback
          </button>
          <h1>Post vorbereiten</h1>
          <p className="post-prep-subtitle">Waehle deinen Stil. Bekommst den fertigen Post. Direkt teilen.</p>
        </div>

        <div className="post-prep-content">
          <div className="post-prep-source">
            <div className="post-prep-source-section">
              <div className="post-prep-source-label">
                ✏️ Dein Entwurf
              </div>
              <div className="post-prep-source-text">{draft}</div>
            </div>
          </div>

          <div className="post-prep-tone-section">
            <div className="post-prep-tone-label">Stil waehlen:</div>
            <div className="post-prep-tone-buttons">
              {TONES.map(tone => (
                <button
                  key={tone.id}
                  className={`post-prep-tone-btn ${activeTone === tone.id ? 'active' : ''}`}
                  onClick={() => generateRewrite(tone.id)}
                  disabled={loading}
                >
                  <span className="post-prep-tone-icon">{tone.icon}</span>
                  <span className="post-prep-tone-text">{tone.label}</span>
                </button>
              ))}
            </div>
          </div>

          {loading && (
            <div className="post-prep-loading">
              <div className="post-prep-spinner" />
              <span>Post wird generiert...</span>
            </div>
          )}

          {rewrittenPost && !loading && (
            <div className="post-prep-result">
              <div className="post-prep-result-header">
                <Sparkles size={16} />
                <span>Dein fertiger Post (Schluesselfertig)</span>
              </div>
              <div className="post-prep-result-text">{rewrittenPost}</div>
              <div className="post-prep-result-actions">
                <CopyBtn text={rewrittenPost} />
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem', flexWrap: 'wrap' }}>
                <Link to="/community" className="btn btn-outline" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                  <MessageCircle size={14} /> Im Feed posten
                </Link>
                <Link to="/tiktok-video" state={{ postText: rewrittenPost }} className="btn btn-outline" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                  <Rocket size={14} /> Als Video
                </Link>
                <button
                  className="btn btn-outline"
                  onClick={() => {
                    if (navigator.share) {
                      navigator.share({ text: rewrittenPost }).catch(() => {})
                    }
                  }}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                >
                  <Share2 size={14} /> Teilen
                </button>
              </div>
            </div>
          )}

          {error && (
            <div className="post-prep-error">{error}</div>
          )}
        </div>
      </div>
    </div>
  )
}

function CopyBtn({ text }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      const textarea = document.createElement('textarea')
      textarea.value = text
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <button className="post-prep-copy-btn" onClick={handleCopy}>
      {copied ? <><Check size={14} /> Kopiert!</> : <><Copy size={14} /> Kopieren</>}
    </button>
  )
}
