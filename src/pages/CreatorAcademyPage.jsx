import { useState } from 'react'
import { Rocket, Send, Check, AlertTriangle, Lightbulb, MessageSquare, PenTool } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { useLanguage } from '../i18n/translations'
import './CreatorAcademyPage.css'

export default function CreatorAcademyPage() {
  const { user } = useAuth()
  const { t } = useLanguage()
  const [draft, setDraft] = useState('')
  const [feedback, setFeedback] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isPosting, setIsPosting] = useState(false)
  const [posted, setPosted] = useState(false)
  const [error, setError] = useState('')

  const getFeedback = async () => {
    if (!draft.trim() || isLoading) return
    setIsLoading(true)
    setFeedback(null)
    setError('')
    setPosted(false)

    const systemPrompt = `Du bist der Coach der New Creator Generation Academy auf Happiness. Deine Aufgabe: Bewerte eingereichte Content-Entwuerfe (Text, Caption, Video-Idee) danach, wie sie sich auf grossen Plattformen wie TikTok, Instagram und YouTube Shorts schlagen wuerden – basierend auf bekannten Mustern:
- Hook-Staerke in den ersten 1-2 Sekunden/Zeilen (haelt der Anfang zum Weiterscrollen ab?)
- Klarheit der Kernaussage innerhalb der ersten Saetze
- Emotionale oder neugierig machende Wirkung
- Format-Eignung (eignet sich der Inhalt eher fuer kurze Videos, Karussell-Posts, reinen Text?)
- Call-to-Action: gibt es einen klaren naechsten Schritt fuer den Betrachter?

Gib IMMER klar zu erkennen, dass dies eine EINSCHAETZUNG nach bekannten Mustern ist, KEINE Erfolgsgarantie. Nutze Formulierungen wie 'wuerde vermutlich', 'nach typischen Mustern', 'aehnliche Hooks performen oft gut, aber...'. Erfinde keine konkreten Zahlen oder Statistiken, die du nicht belegen kannst.

Struktur der Antwort:
1. Plattform-Einschaetzung: Fuer welche Plattform(en) eignet sich dieser Content am ehesten und warum
2. Hook-Check: Wuerde der Anfang zum Weiterschauen/-lesen bewegen?
3. Konkreter Verbesserungsvorschlag, orientiert an dem, was auf der Zielplattform nachweislich funktioniert

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
        throw new Error(errData.error || `API Fehler ${response.status}`)
      }

      const data = await response.json()
      setFeedback(data.response)
    } catch (err) {
      console.error('Feedback error:', err)
      setError(err.message || 'Fehler beim Abrufen des Feedbacks.')
    } finally {
      setIsLoading(false)
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

        <div className="ca-main">
          <div className="ca-input-section">
            <label className="ca-label">
              <PenTool size={16} />
              Dein Post-Entwurf
            </label>
            <textarea
              className="ca-textarea"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
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

          {feedback && (
            <div className="ca-feedback-section">
              <div className="ca-feedback-header">
                <MessageSquare size={18} />
                <h2>Dein Feedback</h2>
              </div>
              <div className="ca-feedback-content">
                <div dangerouslySetInnerHTML={{ __html: formatFeedback(feedback) }} />
              </div>
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
