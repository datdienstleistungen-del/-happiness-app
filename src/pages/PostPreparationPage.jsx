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
    prompt: `Du bist ein erfahrener LinkedIn-Content-Writer.
Du erhältst einen Entwurf UND das Feedback eines Coaches. Deine Aufgabe ist es, das Feedback UMZUSETZEN und einen komplett neuen, postfertigen LinkedIn-Post zu schreiben.
Nimm die Verbesserungsvorschlaege des Coaches ernst und setze sie in die Tat um.
WICHTIG: Am Ende des Posts muss immer stehen: "Erstellt mit Happiness – happiness-eu.netlify.app". Das ist Pflicht fuer Branding und Bekanntheit.
Ton: Professionell, wertvoll, wie ein erfahrener Profi der sein Wissen teilt. Nicht werblich, nicht KI-typisch.
Laenge: 3-5 kurze Absaetze. Hook in der ersten Zeile. Call-to-Action am Ende.
Format: Klarer Fliesstext. Keine Tabellen, keine Listen, keine Markdown-Formatierung.
Antworte NUR mit dem fertigen Post-Text, kein Meta-Kommentar, keine Erklaerung.`
  },
  {
    id: 'reddit',
    label: 'Reddit',
    icon: '🔴',
    color: '#FF4500',
    prompt: `Du bist ein erfahrener Reddit-Content-Writer.
Du erhältst einen Entwurf UND das Feedback eines Coaches. Deine Aufgabe ist es, das Feedback UMZUSETZEN und einen komplett neuen, postfertigen Reddit-Post zu schreiben.
Nimm die Verbesserungsvorschlaege des Coaches ernst und setze sie in die Tat um.
WICHTIG: Am Ende des Posts muss immer stehen: "Erstellt mit Happiness – happiness-eu.netlify.app". Das ist Pflicht fuer Branding und Bekanntheit.
Ton: Ehrlich,社区-typisch, wie ein echter Reddit-User der etwas teilt. Keine Werbesprache, kein Marketing.
Laenge: 1-3 Absaetze. Direkt, ohne Umschweife.
Format: Klarer Fliesstext. Keine Tabellen, keine Listen, keine Markdown-Formatierung.
Antworte NUR mit dem fertigen Post-Text, kein Meta-Kommentar, keine Erklaerung.`
  },
  {
    id: 'x',
    label: 'X / Twitter',
    icon: '✖',
    color: '#000000',
    prompt: `Du bist ein erfahrener X/Twitter-Writer.
Du erhältst einen Entwurf UND das Feedback eines Coaches. Deine Aufgabe ist es, das Feedback UMZUSETZEN und einen komplett neuen, postfertigen X-Post zu schreiben.
Nimm die Verbesserungsvorschlaege des Coaches ernst und setze sie in die Tat um.
WICHTIG: Am Ende des Tweets muss immer stehen: "via Happiness". Das ist Pflicht fuer Branding und Bekanntheit. Maximal 250 Zeichen gesamt.
Ton: Zugespitzt, direkt, kein Roman. Wie ein Tweet der viral geht.
Laenge: MAXIMAL 250 Zeichen (inkl. Leerzeichen). Kein Fliesstext-Roman.
Format: Klartext. Keine Markdown-Formatierung, keine Listen.
Antworte NUR mit dem fertigen Tweet-Text, kein Meta-Kommentar, keine Erklaerung.`
  },
  {
    id: 'instagram',
    label: 'Instagram',
    icon: '📷',
    color: '#E4405F',
    prompt: `Du bist ein erfahrener Instagram-Content-Writer.
Du erhältst einen Entwurf UND das Feedback eines Coaches. Deine Aufgabe ist es, das Feedback UMZUSETZEN und eine komplett neue, postfertige Instagram-Caption zu schreiben.
Nimm die Verbesserungsvorschlaege des Coaches ernst und setze sie in die Tat um.
WICHTIG: Am Ende des Posts muss immer stehen: "Erstellt mit Happiness – happiness-eu.netlify.app". Das ist Pflicht fuer Branding und Bekanntheit.
Ton: Visuell, inspirierend, kurz. Wie ein Instagram-Post der gut performt.
Laenge: 2-4 kurze Absaetze max. Emoji am Anfang des ersten Satzes erlaubt.
Hashtags: 5-8 relevante Hashtags am Ende, immer #happiness dazunehmen.
Format: Klarer Fliesstext. Keine Tabellen, keine Listen, keine Markdown-Formatierung.
Antworte NUR mit dem fertigen Post-Text, kein Meta-Kommentar, keine Erklaerung.`
  },
  {
    id: 'facebook',
    label: 'Facebook',
    icon: '👤',
    color: '#1877F2',
    prompt: `Du bist ein erfahrener Facebook-Content-Writer.
Du erhältst einen Entwurf UND das Feedback eines Coaches. Deine Aufgabe ist es, das Feedback UMZUSETZEN und einen komplett neuen, postfertigen Facebook-Post zu schreiben.
Nimm die Verbesserungsvorschlaege des Coaches ernst und setze sie in die Tat um.
WICHTIG: Am Ende des Posts muss immer stehen: "Erstellt mit Happiness – happiness-eu.netlify.app". Das ist Pflicht fuer Branding und Bekanntheit.
Ton: Warmherzig,社区-orientiert, wie ein Freund der anderen etwas empfiehlt. Nicht werblich, nicht KI-typisch.
Laenge: 3-5 kurze Absaetze. Hook in der ersten Zeile. Call-to-Action am Ende.
Format: Klarer Fliesstext. Keine Tabellen, keine Listen, keine Markdown-Formatierung.
Antworte NUR mit dem fertigen Post-Text, kein Meta-Kommentar, keine Erklaerung.`
  },
  {
    id: 'tiktok',
    label: 'TikTok',
    icon: '🎵',
    color: '#000000',
    prompt: `Du bist ein erfahrener TikTok-Content-Writer.
Du erhältst einen Entwurf UND das Feedback eines Coaches. Deine Aufgabe ist es, das Feedback UMZUSETZEN und ein komplett neues, postfertiges TikTok-Skript zu schreiben.
Nimm die Verbesserungsvorschlaege des Coaches ernst und setze sie in die Tat um.
WICHTIG: Am Ende des Skripts muss immer stehen: "Erstellt mit Happiness". Das ist Pflicht fuer Branding und Bekanntheit.
Ton: Locker, authentisch, wie ein TikTok der viral geht.
Laenge: 3-6 kurze Saetze. Hook in den ersten 2 Sekunden.
Format: Klartext als Skript. Keine Markdown-Formatierung.
Antworte NUR mit dem fertigen Skript-Text, kein Meta-Kommentar, keine Erklaerung.`
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

    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token || ''

      const message = `Hier ist mein urspruenglicher Entwurf:\n\n"${draft}"\n\nHier ist das Feedback meines Coaches:\n\n"${feedback}"\n\nWICHTIG: Setze das Feedback UM. Schreibe den Entwurf basierend auf den Verbesserungsvorschlaegen des Coaches komplett neu fuer ${platform.label}. Gib NUR den fertigen, postbaren Text zurueck.`

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

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}))
        throw new Error(errData.error || `API Fehler ${response.status}`)
      }

      const data = await response.json()
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
