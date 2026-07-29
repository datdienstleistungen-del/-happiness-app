import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Lightbulb, ArrowRight, RotateCcw, X, Loader, Check, AlertTriangle, XCircle, Search } from 'lucide-react'
import { supabase } from '../lib/supabase'
import './IdeenschmiedePage.css'

const GENRES = [
  { id: 'comedy_prank', label: 'Comedy / Prank' },
  { id: 'werbevideo_marketing', label: 'Werbevideo' },
  { id: 'lernvideo_kinder', label: 'Lernvideo (Kinder)' },
  { id: 'lernvideo_erwachsene', label: 'Lernvideo (Erwachsene)' }
]

export default function IdeenschmiedePage() {
  const navigate = useNavigate()
  const [idea, setIdea] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')

  const handleEvaluate = async () => {
    if (!idea.trim() || loading) return

    setLoading(true)
    setError('')
    setResult(null)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token || ''

      const res = await fetch('/api/evaluate-idea', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          idea_text: idea.trim()
        })
      })

      const data = await res.json()

      if (!res.ok) throw new Error(data.error || 'Bewertung fehlgeschlagen')

      setResult(data)
    } catch (e) {
      console.error('[Ideenschmiede] Error:', e.message)
      setError(e.message || 'Fehler bei der Ideen-Bewertung.')
    } finally {
      setLoading(false)
    }
  }

  const handleGoToVideoFinder = () => {
    navigate('/video-finder')
  }

  const handleGoToVideoScript = () => {
    navigate('/video-script', { state: { premisse: idea.trim() } })
  }

  const handleNewIdea = () => {
    setIdea('')
    setResult(null)
    setError('')
  }

  const getVerdictConfig = (verdict) => {
    switch (verdict) {
      case 'carries':
        return {
          className: 'verdict-carries',
          icon: <Check size={24} />,
          label: 'Trägt so wie es ist'
        }
      case 'rework':
        return {
          className: 'verdict-rework',
          icon: <AlertTriangle size={24} />,
          label: 'Braucht Rework'
        }
      case 'fails':
        return {
          className: 'verdict-fails',
          icon: <XCircle size={24} />,
          label: 'Funktioniert nicht'
        }
      default:
        return {
          className: 'verdict-unknown',
          icon: <AlertTriangle size={24} />,
          label: 'Unbekanntes Urteil'
        }
    }
  }

  return (
    <div className="is-page">
      <div className="is-header">
        <h1><Lightbulb size={24} /> Ideenschmiede</h1>
        <p>Beschreib deine Content-Idee. Kein Lob, kein Beschönigen — ein ehrliches Urteil, ob sie trägt.</p>
      </div>

      {/* Input Section */}
      {!result && (
        <div className="is-input-section">
          <div className="is-field">
            <label>Deine Idee</label>
            <textarea
              value={idea}
              onChange={(e) => setIdea(e.target.value)}
              placeholder="Beschreib deine Idee, so roh wie sie gerade ist..."
              rows={4}
              disabled={loading}
            />
          </div>

          {error && (
            <div className="is-error">
              <X size={16} />
              <span>{error}</span>
            </div>
          )}

          <button
            className="is-btn is-btn-primary"
            onClick={handleEvaluate}
            disabled={!idea.trim() || loading}
          >
            {loading ? (
              <>
                <Loader size={16} className="is-spinner" />
                Wird geprüft...
              </>
            ) : (
              <>
                <Lightbulb size={16} />
                Idee prüfen
              </>
            )}
          </button>
        </div>
      )}

      {/* Result Section */}
      {result && (
        <div className="is-result">
          {/* Verdict Badge */}
          <div className={`is-verdict ${getVerdictConfig(result.verdict).className}`}>
            <span className="is-verdict-icon">
              {getVerdictConfig(result.verdict).icon}
            </span>
            <span className="is-verdict-label">
              {getVerdictConfig(result.verdict).label}
            </span>
          </div>

          {/* Justification */}
          <div className="is-section">
            <h3>Begründung</h3>
            <p>{result.justification}</p>
          </div>

          {/* Feasibility */}
          <div className="is-section">
            <h3>Machbarkeit</h3>
            <p>{result.feasibility}</p>
          </div>

          {/* Recommendation (only for rework/fails) */}
          {result.recommendation && (result.verdict === 'rework' || result.verdict === 'fails') && (
            <div className="is-section is-recommendation">
              <h3>{result.verdict === 'rework' ? 'Verbesserungsvorschlag' : 'Hauptgrund'}</h3>
              <p>{result.recommendation}</p>
            </div>
          )}

          {/* Actions based on verdict */}
          <div className="is-actions">
            {result.verdict === 'carries' && (
              <>
                <button className="is-btn is-btn-success" onClick={handleGoToVideoScript}>
                  <ArrowRight size={16} /> Zum Video-Drehbuch
                </button>
                <button className="is-btn is-btn-secondary" onClick={handleGoToVideoFinder}>
                  <Search size={16} /> Stock-Videos suchen
                </button>
              </>
            )}

            {result.verdict === 'rework' && (
              <>
                <button className="is-btn is-btn-primary" onClick={() => { setIdea(idea + ' ' + result.recommendation); setResult(null); }}>
                  <RotateCcw size={16} /> Idee anpassen
                </button>
                <button className="is-btn is-btn-secondary" onClick={handleNewIdea}>
                  <X size={16} /> Neue Idee
                </button>
              </>
            )}

            {result.verdict === 'fails' && (
              <button className="is-btn is-btn-secondary" onClick={handleNewIdea}>
                <X size={16} /> Neue Idee eingeben
              </button>
            )}
          </div>

          {/* Rules checked info */}
          <div className="is-meta">
            {result.rules_checked} Hook-Rules geprüft
          </div>
        </div>
      )}
    </div>
  )
}
