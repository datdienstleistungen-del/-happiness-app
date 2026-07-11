import { useState, useEffect } from 'react'
import { Rocket, Send, Check, AlertTriangle, Lightbulb, MessageSquare, PenTool, CreditCard, Brain } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { useLanguage } from '../i18n/translations'
import './CreatorAcademyPage.css'
import { useSearchParams } from 'react-router-dom'
import CopyButton from '../components/CopyButton'

export default function CreatorAcademyPage() {
  const { user } = useAuth()
  const { t } = useLanguage()
  const [searchParams] = useSearchParams()
  const [draft, setDraft] = useState('')
  const [feedback, setFeedback] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isPosting, setIsPosting] = useState(false)
  const [posted, setPosted] = useState(false)
  const [error, setError] = useState('')
  const [freeContentUsed, setFreeContentUsed] = useState(0)
  const [isPremium, setIsPremium] = useState(false)
  const [showPaywall, setShowPaywall] = useState(false)
  const FREE_LIMIT = 5

  useEffect(() => {
    loadSettings()
  }, [user])

  useEffect(() => {
    if (searchParams.get('payment') === 'success') {
      setShowPaywall(false)
      setIsPremium(true)
    }
  }, [searchParams])

  const loadSettings = async () => {
    const { data } = await supabase
      .from('ai_settings')
      .select('is_premium, free_content_used')
      .eq('user_id', user.id)
      .single()
    if (data) {
      setIsPremium(data.is_premium || false)
      setFreeContentUsed(data.free_content_used || 0)
    }
  }

  const getFeedback = async () => {
    if (!draft.trim() || isLoading) return
    if (!isPremium && freeContentUsed >= FREE_LIMIT) {
      setShowPaywall(true)
      return
    }
    setIsLoading(true)
    setFeedback(null)
    setError('')
    setPosted(false)

    const systemPrompt = `Du bist der Coach der New Creator Generation Academy auf Happiness.

WICHTIGSTE REGEL: Pruefe zuerst, ob die Eingabe ein fertiger Content-Entwurf ist (Text, Caption, Video-Idee zum Posten) oder eine allgemeine Frage/Strategie-Anfrage.

NUR bei einem echten Entwurf wende das 3-Punkte-Feedback-Schema an:
1. Plattform-Einschaetzung: Fuer welche Plattform(en) eignet sich dieser Content am ehesten und warum
2. Hook-Check: Wuerde der Anfang zum Weiterschauen/-lesen bewegen?
3. Konkreter Verbesserungsvorschlag, orientiert an dem, was auf der Zielplattform nachweislich funktioniert

Bewertungsgrundlage:
- Hook-Staerke in den ersten 1-2 Sekunden/Zeilen (haelt der Anfang zum Weiterscrollen ab?)
- Klarheit der Kernaussage innerhalb der ersten Saetze
- Emotionale oder neugierig machende Wirkung
- Format-Eignung (eignet sich der Inhalt eher fuer kurze Videos, Karussell-Posts, reinen Text?)
- Call-to-Action: gibt es einen klaren naechsten Schritt fuer den Betrachter?

Bei einer allgemeinen Frage (z.B. "wie positioniere ich mein Produkt auf TikTok?") gib stattdessen kurze, ehrliche Strategie-Hinweise – und weise darauf hin, dass die Academy am meisten bringt, wenn ein konkreter Entwurf eingereicht wird ("Formulier doch mal einen ersten Post dazu, dann geb ich dir gezieltes Feedback").

Gib IMMER klar zu erkennen, dass dies eine EINSCHAETZUNG nach bekannten Mustern ist, KEINE Erfolgsgarantie. Nutze Formulierungen wie 'wuerde vermutlich', 'nach typischen Mustern', 'aehnliche Hooks performen oft gut, aber...'. Erfinde keine konkreten Zahlen oder Statistiken, die du nicht belegen kannst.

NIEMALS erfundene Prozentzahlen oder Statistiken verwenden ("90% der Accounts...") – das ist ein Hard-Stopp, keine Ausnahme.

NIEMALS erfundene persoenliche Anekdoten oder Ich-Erzaelungen als Beispieltext vorschlagen, die der Nutzer als eigene, reale Geschichte posten koennte. Das ist Irrefuehrung der Zielgruppe des Nutzers und nicht erlaubt. Falls eine persoenliche Geschichte als Stilmittel empfohlen wird: nur als STRUKTUR-VORSCHLAG kennzeichnen (z.B. "eine Geschichte in diesem Aufbau: Ausgangslage -> Zweifel -> Schritt -> Ergebnis"), NIEMALS als ausformulierter, fertiger Ich-Text mit erfundenen Details (Zahlen, Zeitangaben, Ereignisse). Weise den Nutzer aktiv darauf hin, dass er seine EIGENE echte Erfahrung in diese Struktur einsetzen soll.

TONALITAET: Sachlich, direkt, ruhig. Keine Ausrufezeichen-Kaskaden, keine uebertriebenen Emojis, keine Hype-Anreden. Der Coach ist ein nuechterner, ehrlicher Sparringspartner, kein Motivationscoach. Kein "🔥", kein "Super mega geil!!!", kein "Heyyy!".

Sei direkt und konkret, keine Floskeln, kein uebertriebenes Lob.
Antworte immer auf Deutsch. Formatierung mit Markdown (fett, kursiv, Listen).`

    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token || ''

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
          body: JSON.stringify({
            message: `Hier ist mein Content-Entwurf fuer die Happiness Community:\n\n"${draft}"\n\nBitte gib mir eine Plattform-Einschaetzung, Hook-Check und Verbesserungsvorschlag.`,
            systemPrompt,
          userId: user.id,
          history: []
        })
      })

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}))
        if (response.status === 402) {
          setShowPaywall(true)
          setIsLoading(false)
          return
        }
        throw new Error(errData.error || `API Fehler ${response.status}`)
      }

      const data = await response.json()
      setFeedback(data.response)
      gtag('event', 'content_generated', { source: 'creator_academy' })
      setFreeContentUsed(prev => prev + 1)
    } catch (err) {
      console.error('Feedback error:', err)
      setError(err.message || 'Fehler beim Abrufen des Feedbacks.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleCheckout = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token || ''
      const response = await fetch('/api/create-checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ userId: user.id, email: user.email }),
      })
      const data = await response.json()
      if (data.url) {
        window.location.href = data.url
      }
    } catch (error) {
      console.error('Checkout error:', error)
    }
  }

  const publishPost = async () => {
    if (!draft.trim() || isPosting) return
    setIsPosting(true)
    setError('')

    try {
      const { error: insertError } = await supabase.from('posts').insert({
        user_id: user.id,
        content: draft.trim(),
      })

      if (insertError) throw insertError
      setPosted(true)
      gtag('event', 'project_saved', { source: 'creator_academy' })
    } catch (err) {
      console.error('Post error:', err)
      setError(err.message || 'Fehler beim Veröffentlichen.')
    } finally {
      setIsPosting(false)
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      getFeedback()
    }
  }

  const remaining = FREE_LIMIT - freeContentUsed

  return (
    <div className="creator-academy-page">
      <div className="ca-container">
        <div className="ca-header">
          <div className="ca-header-icon"><Rocket size={28} /></div>
          <div>
            <h1>New Creator Generation Academy</h1>
            <p className="ca-subtitle">Schreib einen Entwurf. Hol dir Feedback. Veröffentliche.</p>
          </div>
        </div>

        <div className="ca-usage-bar">
          {isPremium ? (
            <span className="ca-usage-premium"><Check size={14} /> Premium — unbegrenzt Feedback</span>
          ) : (
            <span className="ca-usage-count">Noch {remaining} von {FREE_LIMIT} kostenlosen Feedbacks</span>
          )}
        </div>

        <div className="ca-main">
          <div className="ca-input-section">
            <label className="ca-label">
              <PenTool size={16} />
              Dein Post-Entwurf
            </label>
            <textarea
              className="ca-textarea"
              value={draft}
              onChange={(e) => { try { if (draft.length === 0) gtag('event', 'idea_started', { source: 'creator_academy' }); } catch {} setDraft(e.target.value); }}
              onKeyDown={handleKeyDown}
              placeholder="Schreib hier deinen Post...&#10;&#10;Was möchtest du mit der Community teilen? Eine Idee, eine Geschichte, ein Tipp?"
              rows={8}
            />
            <div className="ca-input-footer">
              <span className="ca-char-count">{draft.length} Zeichen</span>
              <span className="ca-hint">Strg+Enter für Feedback</span>
            </div>

            <div className="ca-actions">
              <button
                className="ca-btn ca-btn-primary"
                onClick={getFeedback}
                disabled={!draft.trim() || isLoading}
              >
                {isLoading ? (
                  <span className="ca-spinner" />
                ) : (
                  <><Lightbulb size={16} /> Feedback holen</>
                )}
              </button>
              <button
                className="ca-btn ca-btn-publish"
                onClick={publishPost}
                disabled={!draft.trim() || isPosting || posted}
              >
                {isPosting ? (
                  <span className="ca-spinner" />
                ) : posted ? (
                  <><Check size={16} /> Veröffentlicht!</>
                ) : (
                  <><Send size={16} /> So posten</>
                )}
              </button>
            </div>

            {error && (
              <div className="ca-error">
                <AlertTriangle size={16} /> {error}
              </div>
            )}

            {posted && (
              <div className="ca-success">
                <Check size={16} /> Dein Post ist live! Schau im Feed vorbei.
              </div>
            )}
          </div>

          {showPaywall && (
            <div className="ca-paywall">
              <div className="ca-paywall-card">
                <div className="ca-paywall-icon"><Brain size={32} /></div>
                <h2>Kostenloses Kontingent aufgebraucht</h2>
                <p>Du hast alle {FREE_LIMIT} kostenlosen Feedbacks genutzt.</p>
                <p className="ca-paywall-sub">Schalte Premium frei für unbegrenztes Feedback:</p>
                <div className="ca-paywall-price">
                  <span className="ca-price-amount">6,99 €</span>
                  <span className="ca-price-period">/ Monat</span>
                </div>
                <button className="ca-paywall-btn stripe-btn" onClick={handleCheckout}>
                  <CreditCard size={16} /> Jetzt upgraden
                </button>
                <div className="ca-paywall-benefits">
                  <p><Check size={14} /> Unbegrenzt KI-Content-Feedback</p>
                  <p><Check size={14} /> Unbegrenzt TikTok-Videos erstellen</p>
                  <p><Check size={14} /> Unbegrenzt AI Chat Fragen</p>
                </div>
                <p className="ca-paywall-note">Sicher bezahlen mit Stripe.</p>
              </div>
            </div>
          )}

          {feedback && !showPaywall && (
            <div className="ca-feedback-section">
              <div className="ca-feedback-header">
                <MessageSquare size={18} />
                <h2>Dein Feedback</h2>
              </div>
              <div className="ca-feedback-content">
                <div dangerouslySetInnerHTML={{ __html: formatFeedback(feedback) }} />
              </div>
              <CopyButton text={feedback} className="ca-copy-btn" />
              <div className="ca-feedback-tip">
                <Lightbulb size={14} />
                <span>Tipp: Übernimm die Verbesserungen in deinen Entwurf und frag erneut nach Feedback.</span>
              </div>
              <div className="ca-feedback-disclaimer">
                Einschaetzung basierend auf bekannten Plattform-Mustern, keine Erfolgsgarantie.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function formatFeedback(text) {
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/### (.*?)(\n|$)/g, '<h3>$1</h3>')
    .replace(/## (.*?)(\n|$)/g, '<h3>$1</h3>')
    .replace(/# (.*?)(\n|$)/g, '<h3>$1</h3>')
    .replace(/^[-*] (.*?)(\n|$)/gm, '<li>$1</li>')
    .replace(/(<li>.*?<\/li>\n?)+/g, (match) => `<ul>${match}</ul>`)
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n/g, '<br/>')
    .replace(/^(.+)$/gm, (line) => {
      if (line.startsWith('<')) return line
      return line
    })
    .replace(/^(?!<[hlu])(.+)$/gm, '<p>$1</p>')
    .replace(/<p><\/p>/g, '')
    .replace(/<p>(<h[23]>)/g, '$1')
    .replace(/(<\/h[23]>)<\/p>/g, '$1')
    .replace(/<p>(<ul>)/g, '$1')
    .replace(/(<\/ul>)<\/p>/g, '$1')
}
