import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Film, Download, Sparkles, Check, Copy, ArrowRight, Play, Pause } from 'lucide-react'
import { supabase } from '../lib/supabase'
import './VideoFinderPage.css'

const PRESET_CATEGORIES = [
  { id: 'satisfying', label: '🌊 Satisfying (ASMR)', query: 'satisfying' },
  { id: 'gaming', label: '🎮 Gaming / Loops', query: 'gaming' },
  { id: 'prank', label: '🎭 Pranks & Fails', query: 'prank' },
  { id: 'soccer', label: '⚽ Fußball-Clips', query: 'fussball' },
  { id: 'timelapse', label: '⏱️ Zeitraffer (Timelapse)', query: 'timelapse' },
  { id: 'sports', label: '🏂 Extremsport', query: 'extreme sports' },
  { id: 'comedy', label: '😂 Comedy & Funny', query: 'comedy' },
  { id: 'kurios', label: '🤯 Kuriositäten', query: 'kurios' }
]

const TONES = [
  { value: 'funny', label: '😂 Lustiger Kommentar (Reaktion)' },
  { value: 'facts', label: '🧠 Spannendes Storytelling (Fakten)' },
  { value: 'sarcastic', label: '😏 Ironisch & Sarkastisch' },
  { value: 'hyped', label: '🔥 Hype & Energiegeladen' }
]

export default function VideoFinderPage() {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [videos, setVideos] = useState([])
  const [loading, setLoading] = useState(false)
  const [selectedVideo, setSelectedVideo] = useState(null)
  
  // Script generation states
  const [selectedTone, setSelectedTone] = useState('funny')
  const [customInstructions, setCustomInstructions] = useState('')
  const [generatingScript, setGeneratingScript] = useState(false)
  const [generatedScript, setGeneratedScript] = useState(null)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState('')

  // Search on mount with default category
  useEffect(() => {
    handleSearch('satisfying')
  }, [])

  async function handleSearch(searchQuery) {
    const term = searchQuery || query
    if (!term.trim()) return
    
    setLoading(true)
    setError('')
    setSelectedVideo(null)
    setGeneratedScript(null)
    
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token || ''
      
      const res = await fetch('/api/pexels-search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ query: term, count: 12 })
      })

      if (!res.ok) throw new Error(`HTTP-Fehler ${res.status}`)
      
      const data = await res.json()
      setVideos(data.videos || [])
    } catch (e) {
      console.error('[Video Search Error]', e)
      setError('Fehler bei der Videosuche. Bitte versuche es noch einmal.')
    } finally {
      setLoading(false)
    }
  }

  async function generateScriptForVideo() {
    if (!selectedVideo || generatingScript) return
    
    setGeneratingScript(true)
    setError('')
    setGeneratedScript(null)

    const toneLabel = TONES.find(t => t.value === selectedTone)?.label || 'Unterhaltsam'
    const systemPrompt = `Du bist H.I.T., ein weltklasse Retention-Coach und Skriptschreiber für TikTok- und Shorts-Videos.
Deine Aufgabe ist es, für ein gegebenes Video (Thema: "${query || 'Unterhaltung'}") ein unterhaltsames, virales Videoskript zu schreiben.
Der gewünschte Tonfall ist: "${toneLabel}".
${customInstructions ? `Zusätzliche Anweisungen des Users: "${customInstructions}"` : ''}

Erstelle ein vollständiges Skript in deutscher Sprache.

Strukturiere deine Antwort zwingend als JSON mit folgender Struktur:
{
  "video_title": "Ein kurzer, catchy Titel (max 60 Zeichen)",
  "voiceover_script": "Der vollständige Sprechtext des Videos. Teile ihn in kurze, sprechbare Sätze auf (ca. 100-120 Wörter).",
  "publishing_payload": {
    "tiktok_instagram": {
      "hook": "Der Hook-Satz (die ersten 3 Sekunden)",
      "description": "Die Video-Beschreibung inkl. passender Hashtags"
    }
  },
  "scenes": [
    {
      "timestamp": "00:00 - 00:05",
      "spoken_text": "Der erste Teil des Sprechtexts"
    },
    {
      "timestamp": "00:05 - 00:15",
      "spoken_text": "Der zweite Teil des Sprechtexts"
    },
    {
      "timestamp": "00:15 - 00:30",
      "spoken_text": "Der dritte Teil des Sprechtexts"
    }
  ]
}

Antworte AUSSCHLIESSLICH mit dem validen JSON-Objekt. Schreibe keinen anderen Text davor oder danach.`;

    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token || ''
      const userRes = await supabase.auth.getUser()
      const userId = userRes.data.user?.id

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          message: `Erstelle das Skript für das ausgewählte Video.`,
          systemPrompt,
          userId,
          history: [],
          videoEditor: 'capcut'
        })
      })

      if (!res.ok) throw new Error(`HTTP-Fehler ${res.status}`)

      const resData = await res.json()
      let cleaned = resData.response || ''
      // Basic JSON cleanup
      cleaned = cleaned.replace(/^```json\n?/i, '').replace(/```\s*$/g, '').trim()
      
      const parsedRecipe = JSON.parse(cleaned)
      setGeneratedScript(parsedRecipe)
    } catch (e) {
      console.error('[Script Generation Error]', e)
      setError('Skript-Generierung fehlgeschlagen. Bitte versuche es noch einmal.')
    } finally {
      setGeneratingScript(false)
    }
  }

  const handleCopyScript = () => {
    if (!generatedScript) return
    const textToCopy = `${generatedScript.video_title}\n\n${generatedScript.voiceover_script}`
    navigator.clipboard.writeText(textToCopy)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleSendToCapCut = () => {
    if (!generatedScript || !selectedVideo) return
    
    // Structure the recipe so that TikTokVideoPage.jsx recognizes it immediately
    const recipeToImport = {
      video_title: generatedScript.video_title,
      voiceover_script: generatedScript.voiceover_script,
      // Map scenes and include visual prompt for each
      scenes: generatedScript.scenes.map((s, i) => ({
        timestamp: s.timestamp,
        spoken_text: s.spoken_text,
        visual_prompt: `cinematic shot, stock video of ${query || 'action'}, photorealistic, 4k, --ar 9:16`
      })),
      publishing_payload: generatedScript.publishing_payload
    }

    navigate('/capcut-studio', {
      state: {
        postText: generatedScript.video_title,
        pipelineResult: {
          recipe: recipeToImport
        }
      }
    })
  }

  return (
    <div className="vf-container">
      <div className="vf-main-content">
        {/* Header Section */}
        <div className="vf-header">
          <h2>🔍 Video Finder & Skript-Generator</h2>
          <p>Suche nach viralen Clip-Kategorien, lade sie herunter und generiere ein passendes Skript für deinen Kanal.</p>
        </div>

        {/* Search & Tags Area */}
        <div className="vf-search-panel">
          <div className="vf-search-bar">
            <Search size={18} className="vf-search-icon" />
            <input
              type="text"
              placeholder="Z. B. Pranks, Fußball, Fails, Katzen..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            />
            <button className="vf-search-btn" onClick={() => handleSearch()}>
              Suchen
            </button>
          </div>

          <div className="vf-quick-tags">
            {PRESET_CATEGORIES.map(cat => (
              <button
                key={cat.id}
                className="vf-tag-btn"
                onClick={() => {
                  setQuery(cat.query)
                  handleSearch(cat.query)
                }}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {error && <div className="vf-error-banner">{error}</div>}

        {/* Videos Grid */}
        {loading ? (
          <div className="vf-loading-state">
            <div className="vf-spinner"></div>
            <p>Passende Clips werden gesucht...</p>
          </div>
        ) : videos.length === 0 ? (
          <div className="vf-empty-state">
            <Film size={48} />
            <p>Keine Clips gefunden. Starte eine neue Suche.</p>
          </div>
        ) : (
          <div className="vf-grid">
            {videos.map(video => (
              <VideoCard
                key={video.id}
                video={video}
                isSelected={selectedVideo?.id === video.id}
                onSelect={setSelectedVideo}
              />
            ))}
          </div>
        )}
      </div>

      {/* Details & Script Sidebar Panel */}
      {selectedVideo && (
        <div className="vf-sidebar-panel">
          <div className="vf-sidebar-header">
            <h3>Videodetails & Skript</h3>
            <button className="vf-close-sidebar" onClick={() => setSelectedVideo(null)}>×</button>
          </div>

          <div className="vf-sidebar-body">
            {/* Selected Video Player */}
            <div className="vf-player-wrapper">
              <video
                key={selectedVideo.url}
                src={selectedVideo.url}
                controls
                playsInline
                className="vf-large-player"
              />
            </div>

            <div className="vf-action-section">
              <a
                href={selectedVideo.url}
                download={`hit_clip_${selectedVideo.id}.mp4`}
                target="_blank"
                rel="noreferrer"
                className="vf-download-action-btn"
              >
                <Download size={16} /> Clip herunterladen (MP4)
              </a>
            </div>

            {/* Script parameters */}
            <div className="vf-generator-setup">
              <label>Tonalität des Skripts</label>
              <select value={selectedTone} onChange={(e) => setSelectedTone(e.target.value)}>
                {TONES.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>

              <label>Spezielle Anweisungen (optional)</label>
              <textarea
                placeholder="Z. B. 'Fokus auf den Gesichtsausdruck lenken' oder 'Keine Emojis verwenden'..."
                value={customInstructions}
                onChange={(e) => setCustomInstructions(e.target.value)}
              />

              <button
                className="vf-generate-script-btn"
                onClick={generateScriptForVideo}
                disabled={generatingScript}
              >
                <Sparkles size={16} />
                {generatingScript ? 'Generiere Skript...' : 'KI-Skript erstellen'}
              </button>
            </div>

            {/* Generated Script Display */}
            {generatingScript && (
              <div className="vf-script-loading">
                <div className="vf-script-shimmer"></div>
                <p>KI formuliert das Skript...</p>
              </div>
            )}

            {generatedScript && (
              <div className="vf-script-output-card">
                <div className="vf-script-output-header">
                  <h4>✍️ {generatedScript.video_title}</h4>
                  <button className="vf-copy-script-icon" onClick={handleCopyScript} title="Kopieren">
                    {copied ? <Check size={16} style={{ color: '#10b981' }} /> : <Copy size={16} />}
                  </button>
                </div>

                <div className="vf-script-output-body">
                  <div className="vf-meta-badge">
                    <strong>Hook (0-3s):</strong> {generatedScript.publishing_payload?.tiktok_instagram?.hook}
                  </div>
                  <p className="vf-script-text">{generatedScript.voiceover_script}</p>
                </div>

                <button className="vf-export-capcut-btn" onClick={handleSendToCapCut}>
                  An CapCut Studio senden <ArrowRight size={16} />
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// Local VideoCard Component for Hover Previews
function VideoCard({ video, onSelect, isSelected }) {
  const videoRef = useRef(null)
  const [isHovered, setIsHovered] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)

  const handleMouseEnter = () => {
    setIsHovered(true)
    if (videoRef.current) {
      videoRef.current.play().then(() => setIsPlaying(true)).catch(() => {})
    }
  }

  const handleMouseLeave = () => {
    setIsHovered(false)
    if (videoRef.current) {
      videoRef.current.pause()
      videoRef.current.currentTime = 0
      setIsPlaying(false)
    }
  }

  return (
    <div
      className={`vf-video-card ${isSelected ? 'selected' : ''}`}
      onClick={() => onSelect(video)}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div className="vf-video-wrapper">
        <video
          ref={videoRef}
          src={video.url}
          poster={video.thumbnail}
          muted
          loop
          playsInline
        />
        <div className={`vf-play-overlay ${isPlaying ? 'playing' : ''}`}>
          {isPlaying ? <Pause size={24} /> : <Play size={24} />}
        </div>
        <span className="vf-duration-tag">{video.duration}s</span>
      </div>
      <div className="vf-card-footer">
        <span className="vf-resolution-tag">{video.width}x{video.height}</span>
        <a
          href={video.url}
          download={`clip_${video.id}.mp4`}
          target="_blank"
          rel="noreferrer"
          className="vf-card-download"
          onClick={(e) => e.stopPropagation()}
          title="Herunterladen"
        >
          <Download size={14} />
        </a>
      </div>
    </div>
  )
}
