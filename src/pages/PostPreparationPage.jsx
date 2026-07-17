import { useState, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { ArrowLeft, Copy, Check, Sparkles, Share2, MessageCircle, Rocket, PenTool, HelpCircle } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { getChatEndpoint } from '../lib/hit'
import { trackCopyAction, trackPublishConfirmed } from '../intelligence/analytics/custom'
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

  const draft = location.state?.draft || ''
  const fromPage = location.state?.from || 'dashboard'
  const platform = location.state?.platform || 'content'

  const [activeTone, setActiveTone] = useState('business')
  const [rewrittenPost, setRewrittenPost] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [posted, setPosted] = useState(false)
  const [published, setPublished] = useState(false)

  const goBack = () => {
    if (fromPage === 'pipeline') navigate('/')
    else if (fromPage === 'chat') navigate('/ai-chat')
    else if (fromPage === 'academy') navigate('/creator-academy')
    else navigate(-1)
  }

  const postToFeed = async () => {
    if (!rewrittenPost || !user) return
    try {
      await supabase.from('posts').insert({
        user_id: user.id,
        content: rewrittenPost
      })
      setPosted(true)
    } catch (err) {
      console.error('Post failed:', err)
    }
  }

  const handlePublishConfirm = () => {
    trackPublishConfirmed(draft || rewrittenPost, platform)
    setPublished(true)
  }

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
            <button className="post-prep-back" onClick={goBack}>
              <ArrowLeft size={18} /> Zurueck
            </button>
            <h1>Post vorbereiten</h1>
            <p className="post-prep-subtitle">Kein Entwurf vorhanden. Starte mit einem neuen Ziel.</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="post-prep-page">
      <div className="post-prep-container">
        <div className="post-prep-header">
          <button className="post-prep-back" onClick={goBack}>
            <ArrowLeft size={18} /> Zurueck
          </button>
          <h1>Post vorbereiten</h1>
          <p className="post-prep-subtitle">Waehle deinen Stil. Bekommst den fertigen Post. Direkt posten oder teilen.</p>
        </div>

        <div className="post-prep-how-it-works">
          <HelpCircle size={14} />
          <span><strong>So geht's:</strong> Waehle unten einen Stil — die KI schreibt dir den fertigen Post. Dann kopieren und posten.</span>
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
            <div className="post-prep-tone-label">Schritt 1: Stil waehlen</div>
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
                <span>Schritt 2: Dein fertiger Post</span>
              </div>
              <div className="post-prep-result-text">{rewrittenPost}</div>
              <div className="post-prep-result-actions">
                <CopyBtn text={rewrittenPost} platform={platform} />
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem', flexWrap: 'wrap' }}>
                {!posted ? (
                  <button
                    className="btn btn-primary"
                    onClick={postToFeed}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                  >
                    <MessageCircle size={14} /> Jetzt posten
                  </button>
                ) : (
                  <button
                    className="btn btn-outline"
                    onClick={() => navigate('/community')}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                  >
                    <MessageCircle size={14} /> Im Feed ansehen
                  </button>
                )}
                <button
                  className="btn btn-outline"
                   onClick={() => navigate('/capcut-studio', { state: { postText: rewrittenPost } })}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                >
                  <Rocket size={14} /> Als Video
                </button>
                <button
                  className="btn btn-outline"
                  onClick={() => navigate('/creator-academy', { state: { draft: rewrittenPost } })}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                >
                  <PenTool size={14} /> Weiter verbessern
                </button>
                {navigator.share && (
                  <button
                    className="btn btn-outline"
                    onClick={() => navigator.share({ text: rewrittenPost }).catch(() => {})}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                  >
                    <Share2 size={14} /> Teilen
                  </button>
                )}
                {!published ? (
                  <button
                    className="btn btn-outline"
                    onClick={handlePublishConfirm}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#16a34a', borderColor: '#16a34a' }}
                  >
                    <Check size={14} /> Veröffentlicht markieren
                  </button>
                ) : (
                  <span style={{ color: '#16a34a', fontSize: '0.85rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    <Check size={14} /> Als veröffentlicht markiert
                  </span>
                )}
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

function CopyBtn({ text, platform }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      trackCopyAction(platform || 'content')
      setTimeout(() => setCopied(false), 2000)
    } catch {
      const textarea = document.createElement('textarea')
      textarea.value = text
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
      setCopied(true)
      trackCopyAction(platform || 'content')
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <button className="post-prep-copy-btn" onClick={handleCopy}>
      {copied ? <><Check size={14} /> Kopiert!</> : <><Copy size={14} /> Kopieren</>}
    </button>
  )
}
