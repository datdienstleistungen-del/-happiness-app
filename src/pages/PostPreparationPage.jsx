import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { ArrowLeft, Copy, Check, ExternalLink, PenTool, MessageSquare } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { getChatEndpoint } from '../lib/hit'
import ShareBar from '../components/ShareBar'
import './PostPreparationPage.css'

const PLATFORMS = [
  {
    id: 'linkedin',
    label: 'LinkedIn',
    icon: '💼',
    color: '#0A66C2',
    prompt: `Rolle: LinkedIn-Content-Writer fuer Happiness (happiness-eu.netlify.app).
Aufgabe: Entwurf + Coach-Feedback in einen postfertigen LinkedIn-Post umwandeln.
Stil: Professionell, wertvoll, wie ein Profi der teilt. Kein KI-Sound.
Struktur: Hook, 3-5 Absätze, CTA am Ende. Happiness natürlich einbetten, z.B. "Ich nutze Happiness (happiness-eu.netlify.app) fuer ...".
Format: Fliesstext, kein Markdown. Nur den fertigen Text ausgeben.`
  },
  {
    id: 'reddit',
    label: 'Reddit',
    icon: '🔴',
    color: '#FF4500',
    prompt: `Rolle: Reddit-User der etwas teilt. Happiness (happiness-eu.netlify.app) ist die Plattform dahinter.
Aufgabe: Entwurf + Coach-Feedback in einen postfertigen Reddit-Post umwandeln.
Stil: Ehrlich, direkt, wie ein echter Community-User. Null Werbung. Reddit hasst Marketing.
Struktur: 1-3 Absätze, ohne Umschweife. Happiness natürlich erwaehnen, z.B. "Hab das auf Happiness gefunden".
Format: Fliesstext, kein Markdown. Nur den fertigen Text ausgeben.`
  },
  {
    id: 'x',
    label: 'X / Twitter',
    icon: '✖',
    color: '#000000',
    prompt: `Rolle: X/Twitter-Writer. Happiness (happiness-eu.netlify.app) ist die Plattform.
Aufgabe: Entwurf + Coach-Feedback in einen postfertigen Tweet umwandeln.
Stil: Zugespitzt, direkt. 250 Zeichen max.
Struktur: Ein Satz der hängenbleibt. "via @Happiness" am Ende wenn Platz.
Format: Klartext, kein Markdown. Nur den Tweet ausgeben.`
  },
  {
    id: 'instagram',
    label: 'Instagram',
    icon: '📷',
    color: '#E4405F',
    prompt: `Rolle: Instagram-Content-Writer fuer Happiness (happiness-eu.netlify.app).
Aufgabe: Entwurf + Coach-Feedback in eine postfertige Instagram-Caption umwandeln.
Stil: Visuell, inspirierend, kurz. Emoji am Anfang erlaubt.
Struktur: 2-4 Absätze, 5-8 Hashtags am Ende (immer #happiness). Happiness natürlich nennen, z.B. "Danke an Happiness fuer den Tipp".
Format: Fliesstext, kein Markdown. Nur den fertigen Text ausgeben.`
  },
  {
    id: 'facebook',
    label: 'Facebook',
    icon: '👤',
    color: '#1877F2',
    prompt: `Rolle: Facebook-Content-Writer fuer Happiness (happiness-eu.netlify.app).
Aufgabe: Entwurf + Coach-Feedback in einen postfertigen Facebook-Post umwandeln.
Stil: Warmherzig,社区-orientiert, wie ein Freund empfiehlt. Kein KI-Sound.
Struktur: Hook, 3-5 Absätze, CTA am Ende. Happiness natürlich erwaehnen, z.B. "Hab ich ueber Happiness entdeckt".
Format: Fliesstext, kein Markdown. Nur den fertigen Text ausgeben.`
  },
  {
    id: 'tiktok',
    label: 'TikTok',
    icon: '🎵',
    color: '#000000',
    prompt: `Rolle: TikTok-Content-Writer fuer Happiness (happiness-eu.netlify.app).
Aufgabe: Entwurf + Coach-Feedback in ein postfertiges TikTok-Skript umwandeln.
Stil: Locker, authentisch, viral-tauglich.
Struktur: 3-6 Sätze, Hook in den ersten 2 Sekunden. Happiness kurz erwaehnen, z.B. "Ich hab das auf Happiness gesehen".
Format: Klartext als Skript, kein Markdown. Nur das Skript ausgeben.`
  }
]

export default function PostPreparationPage() {
  const { user } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const draft = location.state?.draft || ''
  const feedback = location.state?.feedback || ''

  const [generatedPosts, setGeneratedPosts] = useState({})
  const [loading, setLoading] = useState({})
  const [error, setError] = useState('')

  const generatePost = async (platform) => {
    if (loading[platform.id]) return
    setLoading(prev => ({ ...prev, [platform.id]: true }))
    setError('')
    console.log(`Generating ${platform.label}...`)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token || ''

      const message = `Entwurf:\n\n"${draft}"\n\nCoach-Feedback:\n\n"${feedback}"\n\nAufgabe: Feedback umsetzen, neuen postfertigen Text fuer ${platform.label} schreiben.`

      const response = await fetch(getChatEndpoint(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          message,
          systemPrompt: platform.prompt,
          userId: user?.id || '',
          history: []
        })
      })

      console.log(`${platform.label} response:`, response.status)
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}))
        console.error(`API Error ${response.status}:`, errData)
        throw new Error(errData.error || `API Fehler ${response.status}`)
      }

      const data = await response.json()
      if (!data.response) {
        console.error('Empty response:', data)
        throw new Error('Leere Antwort von der KI')
      }
      setGeneratedPosts(prev => ({ ...prev, [platform.id]: data.response }))
    } catch (err) {
      console.error(`Generate ${platform.id} error:`, err)
      setError(`Fehler bei ${platform.label}: ${err.message}`)
    } finally {
      setLoading(prev => ({ ...prev, [platform.id]: false }))
    }
  }

  return (
    <div className="post-prep-page">
      <div className="post-prep-container">
        <div className="post-prep-header">
          <button className="post-prep-back" onClick={() => navigate('/creator-academy')}>
            <ArrowLeft size={18} /> Zurück zum Feedback
          </button>
          <h1>Post vorbereiten</h1>
          <p className="post-prep-subtitle">Klick eine Plattform. Bekommst den fertigen Post. Direkt teilen.</p>
        </div>

        <div className="post-prep-content">
          <div className="post-prep-source">
            <div className="post-prep-source-section">
              <div className="post-prep-source-label">
                <PenTool size={14} /> Dein Entwurf
              </div>
              <div className="post-prep-source-text">{draft}</div>
            </div>
            <div className="post-prep-source-section">
              <div className="post-prep-source-label">
                <MessageSquare size={14} /> Feedback
              </div>
              <div className="post-prep-source-text">{feedback}</div>
            </div>
          </div>

          <div className="post-prep-platforms">
            {PLATFORMS.map(platform => (
              <div key={platform.id} className="post-prep-platform">
                <button
                  className="post-prep-platform-btn"
                  onClick={() => generatePost(platform)}
                  disabled={loading[platform.id]}
                  style={{ borderColor: platform.color }}
                >
                  <span className="post-prep-platform-icon">{platform.icon}</span>
                  <span className="post-prep-platform-label">{platform.label}</span>
                  {loading[platform.id] && <span className="post-prep-spinner" />}
                </button>

                {generatedPosts[platform.id] && (
                  <div className="post-prep-result">
                    <div className="post-prep-result-text">
                      {generatedPosts[platform.id]}
                    </div>
                    <div className="post-prep-result-actions">
                      <CopyButton text={generatedPosts[platform.id]} />
                      <ShareBar text={generatedPosts[platform.id]} title={`${platform.label} Post`} />
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {error && (
            <div className="post-prep-error">{error}</div>
          )}
        </div>
      </div>
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
