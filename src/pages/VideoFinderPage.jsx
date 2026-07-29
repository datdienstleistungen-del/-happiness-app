import { useState } from 'react'
import './VideoFinderPage.css'

export default function VideoFinderPage() {
  const [goal, setGoal] = useState('')
  const [ideas, setIdeas] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [selectedIdea, setSelectedIdea] = useState(null)
  const [referenceVideos, setReferenceVideos] = useState([])
  const [referenceLoading, setReferenceLoading] = useState(false)

  const handleGenerateIdeas = async () => {
    if (!goal.trim()) return

    setLoading(true)
    setError('')
    setIdeas([])
    setSelectedIdea(null)
    setReferenceVideos([])

    try {
      const token = localStorage.getItem('supabase.auth.token')
      const res = await fetch('/api/generate-content-ideas', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          goal: goal.trim(),
          platform: 'tiktok',
          count: 8
        })
      })

      const data = await res.json()

      if (data.error) {
        setError(data.error)
      } else if (data.ideas && data.ideas.length > 0) {
        setIdeas(data.ideas)
      } else {
        setError('Keine Ideen generiert. Versuche es mit einer konkreteren Beschreibung.')
      }
    } catch (err) {
      setError('Fehler bei der Ideengenerierung')
    } finally {
      setLoading(false)
    }
  }

  const handleFindReferences = async (idea) => {
    setSelectedIdea(idea)
    setReferenceVideos([])
    setReferenceLoading(true)

    try {
      const token = localStorage.getItem('supabase.auth.token')
      const res = await fetch('/api/pexels-search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ query: idea.search_term, count: 6 })
      })

      const data = await res.json()
      setReferenceVideos(data.videos || [])
    } catch (err) {
      console.error('Reference search error:', err)
    } finally {
      setReferenceLoading(false)
    }
  }

  const handleCopyIdea = (idea) => {
    const text = `Hook: ${idea.hook}\n\nWas passiert: ${idea.content}\n\nWarum funktioniert es: ${idea.why_it_works}\n\nSuchbegriff für Referenz: ${idea.search_term}`
    navigator.clipboard.writeText(text)
  }

  return (
    <div className="vf-page">
      <div className="vf-hero">
        <div className="vf-hero-icon">💡</div>
        <h1 className="vf-hero-title">Ideenschmiede</h1>
        <p className="vf-hero-subtitle">
          Beschreibe dein Ziel und H.I.T. generiert konkrete Content-Ideen mit Hooks und Referenzen.
        </p>
      </div>

      <div className="vf-input-section">
        <div className="vf-input-wrapper">
          <textarea
            className="vf-textarea"
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            placeholder='z.B. "Ich mache Deko-Hacks für mein kleines Apartment" oder "Fitness-Tipps für Anfänger"'
            rows={3}
          />
          <button
            className="vf-generate-btn"
            onClick={handleGenerateIdeas}
            disabled={loading || !goal.trim()}
          >
            {loading ? (
              <>⏳ H.I.T. denkt nach...</>
            ) : (
              <>💡 Ideen generieren</>
            )}
          </button>
        </div>
      </div>

      {error && (
        <div className="vf-error">
          ⚠️ {error}
        </div>
      )}

      {ideas.length > 0 && (
        <div className="vf-ideas-section">
          <h2 className="vf-section-title">
            💡 Deine Content-Ideen
          </h2>

          <div className="vf-ideas-grid">
            {ideas.map((idea, index) => (
              <div
                key={index}
                className={`vf-idea-card ${selectedIdea === idea ? 'vf-idea-card--selected' : ''}`}
              >
                <div className="vf-idea-header">
                  <span className="vf-idea-number">#{index + 1}</span>
                  <span className={`vf-idea-difficulty vf-idea-difficulty--${(idea.difficulty || 'mittel').toLowerCase()}`}>
                    {idea.difficulty || 'Mittel'}
                  </span>
                </div>

                <div className="vf-idea-hook">
                  <span className="vf-hook-label">🎣 Hook (3 Sek.):</span>
                  <p className="vf-hook-text">{idea.hook}</p>
                </div>

                <div className="vf-idea-content">
                  <span className="vf-content-label">📝 Was passiert:</span>
                  <p className="vf-content-text">{idea.content}</p>
                </div>

                <div className="vf-idea-why">
                  <span className="vf-why-label">🧠 Warum funktioniert es:</span>
                  <p className="vf-why-text">{idea.why_it_works}</p>
                </div>

                <div className="vf-idea-actions">
                  <button
                    className="vf-action-btn vf-action-btn--primary"
                    onClick={() => handleFindReferences(idea)}
                  >
                    🔍 Referenz-Videos finden
                  </button>
                  <button
                    className="vf-action-btn vf-action-btn--secondary"
                    onClick={() => handleCopyIdea(idea)}
                  >
                    📋 Kopieren
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {selectedIdea && (
        <div className="vf-references-section">
          <h2 className="vf-section-title">
            🎬 Referenz-Videos für: "{selectedIdea.search_term}"
          </h2>

          {referenceLoading ? (
            <div className="vf-loading">
              <div className="vf-loading-spinner" />
              <p>Suche Referenz-Videos...</p>
            </div>
          ) : referenceVideos.length > 0 ? (
            <div className="vf-videos-grid">
              {referenceVideos.map((video, index) => (
                <div key={video.id || index} className="vf-video-card">
                  <div className="vf-video-thumb">
                    {video.thumbnail ? (
                      <img src={video.thumbnail} alt={`Video ${index + 1}`} />
                    ) : (
                      <div className="vf-video-placeholder">🎬</div>
                    )}
                    <span className="vf-video-duration">
                      {Math.floor((video.duration || 0) / 60)}:{String((video.duration || 0) % 60).padStart(2, '0')}
                    </span>
                    <span className={`vf-video-source vf-video-source--${video.source}`}>
                      {video.source === 'pexels' ? '📸 Pexels' : video.source === 'pixabay' ? '🎯 Pixabay' : '🏛️ Archive'}
                    </span>
                  </div>
                  <a
                    href={video.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="vf-video-download"
                  >
                    ⬇️ Video ansehen
                  </a>
                </div>
              ))}
            </div>
          ) : (
            <div className="vf-no-references">
              <p>Keine Referenz-Videos gefunden. Versuche einen anderen Suchbegriff.</p>
            </div>
          )}

          <div className="vf-reference-hint">
            💡 Nutze diese Videos als Inspiration für dein eigenes Video. Kopiere den Stil, nicht den Inhalt.
          </div>
        </div>
      )}

      {ideas.length === 0 && !loading && (
        <div className="vf-empty-state">
          <div className="vf-empty-icon">✨</div>
          <h3>Beschreibe dein Ziel</h3>
          <p>Je konkreter deine Beschreibung, desto besser werden die Ideen. Statt "Kochen" schreibe "Schnelle Rezepte für Studenten unter 10 Minuten".</p>
        </div>
      )}
    </div>
  )
}
