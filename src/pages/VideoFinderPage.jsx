import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Film, Download, Sparkles, Check, Copy, ArrowRight, Play, Pause } from 'lucide-react'
import { supabase } from '../lib/supabase'
import './VideoFinderPage.css'

const PRESET_CATEGORIES = [
  { id: 'satisfying', label: '🌊 Satisfying (ASMR)', query: 'satisfying' },
  { id: 'gaming', label: '🎮 Gaming / Loops', query: 'gaming' },
  { id: 'prank', label: '🎭 Pranks & Fails', query: 'prank' },
  { id: 'soccer', label: '⚽ Fußball-Clips', query: 'football' },
  { id: 'timelapse', label: '⏱️ Zeitraffer (Timelapse)', query: 'timelapse' },
  { id: 'sports', label: '🏂 Extremsport', query: 'extreme sports' },
  { id: 'comedy', label: '😂 Comedy & Funny', query: 'comedy' },
  { id: 'kurios', label: '🤯 Kuriositäten', query: 'unusual strange' }
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
  const [pexelsSearched, setPexelsSearched] = useState(false)
  const [selectedVideo, setSelectedVideo] = useState(null)

  const [selectedTone, setSelectedTone] = useState('funny')
  const [customInstructions, setCustomInstructions] = useState('')
  const [generatingScript, setGeneratingScript] = useState(false)
  const [generatedScript, setGeneratedScript] = useState(null)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState('')

  const [activeSource, setActiveSource] = useState('pexels')
  const [importedUrl, setImportedUrl] = useState('')
  const [topic, setTopic] = useState('')

  const [archiveVideos, setArchiveVideos] = useState([])
  const [archiveLoading, setArchiveLoading] = useState(false)
  const [archiveQuery, setArchiveQuery] = useState('')
  const [archiveSearched, setArchiveSearched] = useState(false)

  const [mixkitVideos, setMixkitVideos] = useState([])
  const [mixkitLoading, setMixkitLoading] = useState(false)
  const [mixkitQuery, setMixkitQuery] = useState('')
  const [mixkitSearched, setMixkitSearched] = useState(false)

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
      setPexelsSearched(true)

      // Silent usage logging
      supabase.auth.getUser().then(({ data: { user } }) => {
        if (user) {
          supabase.from('usage_events').insert({
            user_id: user.id,
            event_type: 'video_finder_used'
          }).then()
        }
      }).catch(() => {})
    } catch (e) {
      console.error('[Video Search Error]', e)
      setError('Fehler bei der Videosuche. Bitte versuche es noch einmal.')
    } finally {
      setLoading(false)
    }
  }

  const searchExternal = (platform) => {
    const term = query.trim() || 'viral clip'
    let url = ''
    if (platform === 'youtube') {
      url = `https://www.youtube.com/results?search_query=${encodeURIComponent(term)}+shorts`
    } else {
      url = `https://www.tiktok.com/search?q=${encodeURIComponent(term)}`
    }
    window.open(url, '_blank')
  }

  const handleImportVideo = () => {
    if (!importedUrl.trim()) {
      setError('Bitte füge eine Video-URL ein.')
      return
    }
    if (!topic.trim()) {
      setError('Bitte gib an, worum es in dem Video geht (Thema).')
      return
    }
    setError('')

    const mockVideo = {
      id: 'viral-import',
      url: importedUrl,
      title: topic,
      duration: 15,
      width: 1080,
      height: 1920
    }

    setSelectedVideo(mockVideo)
  }

  async function generateScriptForVideo() {
    if (!selectedVideo || generatingScript) return

    setGeneratingScript(true)
    setError('')
    setGeneratedScript(null)

    const toneLabel = TONES.find(t => t.value === selectedTone)?.label || 'Unterhaltsam'
    const scriptTopic = activeSource === 'viral' ? topic : (query || 'Unterhaltung')

    const systemPrompt = `Du bist H.I.T., ein weltklasse Retention-Coach und Skriptschreiber für TikTok- und Shorts-Videos.
Deine Aufgabe ist es, für ein gegebenes Video (Thema: "${scriptTopic}") ein unterhaltsames, virales Videoskript zu schreiben.
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

Antworte AUSSCHLIESSLICH mit dem validen JSON-Objekt. Schreibe keinen anderen Text davor oder danach.`

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
      cleaned = cleaned.replace(/^```json\n?/i, '').replace(/```\s*$/g, '').trim()

      const parsedRecipe = JSON.parse(cleaned)
      setGeneratedScript(parsedRecipe)

      // Silent usage logging
      if (userId) {
        supabase.from('usage_events').insert({
          user_id: userId,
          event_type: 'script_generated'
        }).then()
      }
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

    const scriptTopic = activeSource === 'viral' ? topic : (query || 'Action')

    const recipeToImport = {
      video_title: generatedScript.video_title,
      voiceover_script: generatedScript.voiceover_script,
      scenes: generatedScript.scenes.map((s, i) => ({
        timestamp: s.timestamp,
        spoken_text: s.spoken_text,
        visual_prompt: `cinematic shot, stock video of ${scriptTopic}, photorealistic, 4k, --ar 9:16`
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

  async function handleArchiveSearch(searchQuery) {
    const term = searchQuery || archiveQuery
    if (!term.trim()) return

    setArchiveLoading(true)
    setError('')
    setSelectedVideo(null)
    setGeneratedScript(null)

    try {
      const res = await fetch('/api/archive-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: term, count: 12 })
      })

      if (!res.ok) throw new Error(`HTTP-Fehler ${res.status}`)

      const data = await res.json()
      setArchiveVideos(data.videos || [])
      setArchiveSearched(true)

      // Silent usage logging
      supabase.auth.getUser().then(({ data: { user } }) => {
        if (user) {
          supabase.from('usage_events').insert({
            user_id: user.id,
            event_type: 'video_finder_used'
          }).then()
        }
      }).catch(() => {})
    } catch (e) {
      console.error('[Archive Search Error]', e)
      setError('Fehler bei der Internet Archive Suche. Bitte versuche es noch einmal.')
    } finally {
      setArchiveLoading(false)
    }
  }

  async function handleMixkitSearch(searchQuery) {
    const term = searchQuery || mixkitQuery
    if (!term.trim()) return

    setMixkitLoading(true)
    setError('')
    setSelectedVideo(null)
    setGeneratedScript(null)

    try {
      const res = await fetch('/api/mixkit-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: term, count: 12 })
      })

      if (!res.ok) throw new Error(`HTTP-Fehler ${res.status}`)

      const data = await res.json()
      setMixkitVideos(data.videos || [])
      setMixkitSearched(true)

      // Silent usage logging
      supabase.auth.getUser().then(({ data: { user } }) => {
        if (user) {
          supabase.from('usage_events').insert({
            user_id: user.id,
            event_type: 'video_finder_used'
          }).then()
        }
      }).catch(() => {})
    } catch (e) {
      console.error('[Mixkit Search Error]', e)
      setError('Fehler bei der Mixkit Suche. Bitte versuche es noch einmal.')
    } finally {
      setMixkitLoading(false)
    }
  }

  return (
    <div className="vf-container">
      <div className="vf-main-content">
        <div className="vf-header">
          <h2>🔍 Video Finder & Skript-Generator</h2>
          <p>Suche nach viralen Clip-Kategorien, lade sie herunter und generiere ein passendes Skript für deinen Kanal.</p>
        </div>

        <div className="vf-tabs">
          <button
            className={`vf-tab-btn-source ${activeSource === 'pexels' ? 'active' : ''}`}
            onClick={() => { setActiveSource('pexels'); setSelectedVideo(null); setGeneratedScript(null); setError('') }}
          >
            📸 Pexels Stock-Archiv
          </button>
          <button
            className={`vf-tab-btn-source ${activeSource === 'viral' ? 'active' : ''}`}
            onClick={() => { setActiveSource('viral'); setSelectedVideo(null); setGeneratedScript(null); setError('') }}
          >
            🚀 Viral-Finder (YouTube / TikTok)
          </button>
          <button
            className={`vf-tab-btn-source ${activeSource === 'archive' ? 'active' : ''}`}
            onClick={() => { setActiveSource('archive'); setSelectedVideo(null); setGeneratedScript(null); setError('') }}
          >
            🏛️ Internet Archive
          </button>
          <button
            className={`vf-tab-btn-source ${activeSource === 'mixkit' ? 'active' : ''}`}
            onClick={() => { setActiveSource('mixkit'); setSelectedVideo(null); setGeneratedScript(null); setError('') }}
          >
            📱 Mixkit
          </button>
        </div>

        {activeSource === 'pexels' && (
          <>
            <div className="vf-search-panel">
              <div className="vf-search-bar">
                <Search size={18} className="vf-search-icon" />
                <input
                  type="text"
                  placeholder="Was suchst du? (DE oder EN funktioniert)"
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
                    onClick={() => { setQuery(cat.query); handleSearch(cat.query) }}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>

            {error && <div className="vf-error-banner">{error}</div>}

            {loading ? (
              <div className="vf-loading-state">
                <div className="vf-spinner"></div>
                <p>Passende Clips werden gesucht...</p>
              </div>
            ) : videos.length === 0 ? (
              <div className="vf-empty-state">
                <Film size={48} />
                <p>
                  {pexelsSearched
                    ? 'Keine Videos zu diesem Suchbegriff gefunden. Bitte versuche es mit anderen Begriffen.'
                    : 'Gib einen Suchbegriff ein oder klicke auf eine Kategorie.'}
                </p>
              </div>
            ) : (
              <div className="vf-grid">
                {videos.map(video => (
                  <VideoCard key={video.id} video={video} isSelected={selectedVideo?.id === video.id} onSelect={setSelectedVideo} />
                ))}
              </div>
            )}
          </>
        )}

        {activeSource === 'viral' && (
          <div className="vf-viral-container">
            <div className="vf-viral-intro">
              <h3>Finde virale Clips direkt an der Quelle</h3>
              <p>Such auf YouTube oder TikTok nach hochaktiven Inhalten, kopiere den Link und füge ihn unten ein.</p>
              <div className="vf-external-search-wrap">
                <div className="vf-external-search-input-group">
                  <input type="text" placeholder="Suchbegriff..." value={query} onChange={(e) => setQuery(e.target.value)} />
                  <button className="vf-ext-btn yt" onClick={() => searchExternal('youtube')}>🌐 YouTube Shorts</button>
                  <button className="vf-ext-btn tt" onClick={() => searchExternal('tiktok')}>📱 TikTok</button>
                </div>
              </div>
            </div>
            <div className="vf-importer-box">
              <h4>🔗 Video-Link importieren</h4>
              {error && <div className="vf-error-banner">{error}</div>}
              <div className="vf-importer-fields">
                <div className="vf-importer-field">
                  <label>1. Video-URL</label>
                  <input type="text" placeholder="z. B. https://www.youtube.com/shorts/..." value={importedUrl} onChange={(e) => setImportedUrl(e.target.value)} />
                </div>
                <div className="vf-importer-field">
                  <label>2. Worum geht es? (Thema)</label>
                  <input type="text" placeholder="z. B. Hund rutscht auf Banane aus..." value={topic} onChange={(e) => setTopic(e.target.value)} />
                </div>
              </div>
              <button className="vf-import-btn" onClick={handleImportVideo}>Video verknüpfen & Skript schreiben</button>
            </div>
          </div>
        )}

        {activeSource === 'archive' && (
          <div className="vf-viral-container">
            <div className="vf-viral-intro">
              <h3>🏛️ Internet Archive — Public Domain Videos</h3>
              <p>Kostenlose, rechtlich sichere Videos. Alle Inhalte sind Public Domain oder Creative Commons.</p>
              <div style={{ background: '#ecfdf5', border: '1px solid #10b981', borderRadius: '8px', padding: '10px 14px', fontSize: '0.85rem', marginTop: '0.75rem', color: '#065f46' }}>
                <strong>Tipp:</strong> Die meisten Archiv-Videos sind Querformat (16:9). In CapCut auf 9:16 stellen und heranzoomen.
              </div>
              <div className="vf-search-bar" style={{ marginTop: '1rem' }}>
                <Search size={18} className="vf-search-icon" />
                <input type="text" placeholder="z. B. nature, space, vintage, cooking..." value={archiveQuery} onChange={(e) => setArchiveQuery(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleArchiveSearch()} />
                <button className="vf-search-btn" onClick={() => handleArchiveSearch()}>Durchsuchen</button>
              </div>
              <div className="vf-quick-tags" style={{ marginTop: '0.75rem' }}>
                {[{ label: '🌍 Nature', query: 'nature' }, { label: '🚀 Space', query: 'space' }, { label: '🎬 Vintage', query: 'vintage' }, { label: '🍳 Cooking', query: 'cooking' }, { label: '🐾 Animals', query: 'animals' }, { label: '🏙️ City', query: 'city' }].map(cat => (
                  <button key={cat.query} className="vf-tag-btn" onClick={() => { setArchiveQuery(cat.query); handleArchiveSearch(cat.query) }}>{cat.label}</button>
                ))}
              </div>
            </div>
            {error && <div className="vf-error-banner">{error}</div>}
            {archiveLoading ? (
              <div className="vf-loading-state"><div className="vf-spinner"></div><p>Internet Archive wird durchsucht...</p></div>
            ) : archiveVideos.length === 0 ? (
              <div className="vf-empty-state">
                <Film size={48} />
                <p>
                  {archiveSearched
                    ? 'Keine freien Public Domain Videos zu diesem Suchbegriff gefunden. Bitte versuche es mit englischen Schlagwörtern.'
                    : 'Suche nach Public Domain Videos.'}
                </p>
              </div>
            ) : (
              <div className="vf-grid">
                {archiveVideos.map(video => (
                  <ArchiveVideoCard key={video.id} video={video} isSelected={selectedVideo?.id === video.id} onSelect={setSelectedVideo} />
                ))}
              </div>
            )}
          </div>
        )}

        {activeSource === 'mixkit' && (
          <div className="vf-viral-container">
            <div className="vf-viral-intro">
              <h3>📱 Mixkit — Kostenlose Stock-Videos</h3>
              <p>Hochwertige, kostenlose Videos. Viele bereits im vertikalen 9:16-Format.</p>
              <div className="vf-search-bar" style={{ marginTop: '1rem' }}>
                <Search size={18} className="vf-search-icon" />
                <input type="text" placeholder="z. B. laptop, coffee, fitness, city..." value={mixkitQuery} onChange={(e) => setMixkitQuery(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleMixkitSearch()} />
                <button className="vf-search-btn" onClick={() => handleMixkitSearch()}>Suchen</button>
              </div>
              <div className="vf-quick-tags" style={{ marginTop: '0.75rem' }}>
                {[{ label: '💻 Tech', query: 'laptop' }, { label: '☕ Lifestyle', query: 'coffee' }, { label: '💪 Fitness', query: 'fitness' }, { label: '🏙️ City', query: 'city' }, { label: '🌿 Nature', query: 'nature' }, { label: '🎨 Creative', query: 'creative' }].map(cat => (
                  <button key={cat.query} className="vf-tag-btn" onClick={() => { setMixkitQuery(cat.query); handleMixkitSearch(cat.query) }}>{cat.label}</button>
                ))}
              </div>
            </div>
            {error && <div className="vf-error-banner">{error}</div>}
            {mixkitLoading ? (
              <div className="vf-loading-state"><div className="vf-spinner"></div><p>Mixkit wird durchsucht...</p></div>
            ) : mixkitVideos.length === 0 ? (
              <div className="vf-empty-state">
                <Film size={48} />
                <p>
                  {mixkitSearched
                    ? 'Keine Mixkit-Videos zu diesem Suchbegriff gefunden. Bitte versuche es mit englischen Schlagwörtern.'
                    : 'Suche nach kostenlosen Stock-Videos.'}
                </p>
              </div>
            ) : (
              <div className="vf-grid">
                {mixkitVideos.map(video => (
                  <MixkitVideoCard key={video.id} video={video} isSelected={selectedVideo?.id === video.id} onSelect={setSelectedVideo} />
                ))}
              </div>
            )}
            <div style={{ marginTop: '2rem', padding: '1.25rem', background: '#fff', borderRadius: '14px', border: '1px solid #e5e7eb' }}>
              <h4 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '0.75rem' }}>🔗 Weitere rechtlich sichere Quellen</h4>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                <a href="https://coverr.co" target="_blank" rel="noreferrer" className="vf-tag-btn" style={{ textDecoration: 'none' }}>Coverr</a>
                <a href="https://www.dareful.com" target="_blank" rel="noreferrer" className="vf-tag-btn" style={{ textDecoration: 'none' }}>Dareful (4K CC)</a>
              </div>
            </div>
          </div>
        )}
      </div>

      {selectedVideo && (
        <div className="vf-sidebar-panel">
          <div className="vf-sidebar-header">
            <h3>Videodetails & Skript</h3>
            <button className="vf-close-sidebar" onClick={() => setSelectedVideo(null)}>×</button>
          </div>
          <div className="vf-sidebar-body">
            <div className="vf-player-wrapper">
              {selectedVideo.source === 'archive' ? (
                <div className="vf-import-placeholder">
                  <Film size={40} className="vf-placeholder-icon" />
                  <p className="vf-placeholder-title">{selectedVideo.title}</p>
                  {selectedVideo.hasVideo ? (
                    <video key={selectedVideo.url} src={selectedVideo.url} controls playsInline className="vf-large-player" />
                  ) : (
                    <a href={selectedVideo.detailsUrl} target="_blank" rel="noreferrer" className="vf-open-link-btn">🏛️ Im Internet Archive ansehen</a>
                  )}
                </div>
              ) : selectedVideo.source === 'mixkit' ? (
                <video key={selectedVideo.url} src={selectedVideo.url} controls playsInline className="vf-large-player" />
              ) : selectedVideo.id === 'viral-import' ? (
                <div className="vf-import-placeholder">
                  <Film size={40} className="vf-placeholder-icon" />
                  <p className="vf-placeholder-title">{selectedVideo.title}</p>
                  <a href={selectedVideo.url} target="_blank" rel="noreferrer" className="vf-open-link-btn">🌐 Original-Video öffnen</a>
                </div>
              ) : (
                <video key={selectedVideo.url} src={selectedVideo.url} controls playsInline className="vf-large-player" />
              )}
            </div>

            <div className="vf-action-section">
              {selectedVideo.source === 'archive' ? (
                selectedVideo.hasVideo ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', width: '100%' }}>
                    <a href={selectedVideo.url} download={`archive_${selectedVideo.id}.mp4`} target="_blank" rel="noreferrer" className="vf-download-action-btn"><Download size={16} /> Video herunterladen</a>
                    <span style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '2px', lineHeight: '1.2' }}>
                      * Tipp: Falls das Video im neuen Tab abspielt, klicke im Player auf die drei Punkte (...) und wähle "Herunterladen" oder nutze Rechtsklick &rarr; "Video speichern unter".
                    </span>
                  </div>
                ) : (
                  <a href={selectedVideo.downloadUrl} target="_blank" rel="noreferrer" className="vf-download-action-btn"><Download size={16} /> Automatischer Download nicht möglich (hier manuell wählen)</a>
                )
              ) : selectedVideo.source === 'mixkit' ? (
                <a href={selectedVideo.url} download={`mixkit_${selectedVideo.id}.mp4`} target="_blank" rel="noreferrer" className="vf-download-action-btn"><Download size={16} /> Video herunterladen</a>
              ) : selectedVideo.id !== 'viral-import' ? (
                <a href={selectedVideo.url} download={`clip_${selectedVideo.id}.mp4`} target="_blank" rel="noreferrer" className="vf-download-action-btn"><Download size={16} /> Clip herunterladen</a>
              ) : null}
            </div>

            <div className="vf-generator-setup">
              <label>Tonalität des Skripts</label>
              <select value={selectedTone} onChange={(e) => setSelectedTone(e.target.value)}>
                {TONES.map(t => (<option key={t.value} value={t.value}>{t.label}</option>))}
              </select>
              <label>Spezielle Anweisungen (optional)</label>
              <textarea placeholder="z. B. 'Fokus auf Gesichtsausdruck' oder 'Keine Emojis'..." value={customInstructions} onChange={(e) => setCustomInstructions(e.target.value)} />
              <button className="vf-generate-script-btn" onClick={generateScriptForVideo} disabled={generatingScript}>
                <Sparkles size={16} />
                {generatingScript ? 'Generiere Skript...' : 'KI-Skript erstellen'}
              </button>
            </div>

            {generatingScript && (
              <div className="vf-script-loading"><div className="vf-script-shimmer"></div><p>KI formuliert das Skript...</p></div>
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
                  <div className="vf-meta-badge"><strong>Hook (0-3s):</strong> {generatedScript.publishing_payload?.tiktok_instagram?.hook}</div>
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

function VideoCard({ video, onSelect, isSelected }) {
  const videoRef = useRef(null)
  const [isPlaying, setIsPlaying] = useState(false)

  const handleMouseEnter = () => {
    if (videoRef.current) videoRef.current.play().then(() => setIsPlaying(true)).catch(() => {})
  }
  const handleMouseLeave = () => {
    if (videoRef.current) { videoRef.current.pause(); videoRef.current.currentTime = 0; setIsPlaying(false) }
  }

  return (
    <div className={`vf-video-card ${isSelected ? 'selected' : ''}`} onClick={() => onSelect(video)} onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
      <div className="vf-video-wrapper">
        <video ref={videoRef} src={video.url} poster={video.thumbnail} muted loop playsInline />
        <div className={`vf-play-overlay ${isPlaying ? 'playing' : ''}`}>
          {isPlaying ? <Pause size={24} /> : <Play size={24} />}
        </div>
        <span className="vf-duration-tag">{video.duration}s</span>
      </div>
      <div className="vf-card-footer">
        <span className="vf-resolution-tag">{video.width}x{video.height}</span>
        <a href={video.url} download={`clip_${video.id}.mp4`} target="_blank" rel="noreferrer" className="vf-card-download" onClick={(e) => e.stopPropagation()} title="Herunterladen">
          <Download size={14} />
        </a>
      </div>
    </div>
  )
}

function ArchiveVideoCard({ video, onSelect, isSelected }) {
  return (
    <div className={`vf-video-card ${isSelected ? 'selected' : ''}`} onClick={() => onSelect(video)} style={{ cursor: 'pointer' }}>
      <div className="vf-video-wrapper" style={{ background: '#1a1a2e', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', padding: '1rem' }}>
          <Film size={32} style={{ color: '#10b981', marginBottom: '0.5rem' }} />
          <p style={{ color: '#fff', fontSize: '0.8rem', margin: 0 }}>{video.hasVideo ? '▶️ Video verfügbar' : '🏛️ Public Domain'}</p>
        </div>
      </div>
      <div className="vf-card-footer" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '4px' }}>
        <span style={{ fontWeight: 700, fontSize: '0.85rem' }}>{video.title.substring(0, 50)}{video.title.length > 50 ? '...' : ''}</span>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {video.date && <span className="vf-resolution-tag">{video.date.substring(0, 4)}</span>}
          {video.rating > 0 && <span className="vf-resolution-tag">⭐ {video.rating.toFixed(1)}</span>}
        </div>
      </div>
    </div>
  )
}

function MixkitVideoCard({ video, onSelect, isSelected }) {
  const videoRef = useRef(null)
  const [isPlaying, setIsPlaying] = useState(false)

  const handleMouseEnter = () => { if (videoRef.current) videoRef.current.play().then(() => setIsPlaying(true)).catch(() => {}) }
  const handleMouseLeave = () => { if (videoRef.current) { videoRef.current.pause(); videoRef.current.currentTime = 0; setIsPlaying(false) } }

  return (
    <div className={`vf-video-card ${isSelected ? 'selected' : ''}`} onClick={() => onSelect(video)} onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave} style={{ cursor: 'pointer' }}>
      <div className="vf-video-wrapper">
        {video.thumbnail ? (
          <img src={video.thumbnail} alt={video.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', background: '#1a1a2e' }}>
            <Film size={32} style={{ color: '#10b981' }} />
          </div>
        )}
        <div className={`vf-play-overlay ${isPlaying ? 'playing' : ''}`}>
          {isPlaying ? <Pause size={24} /> : <Play size={24} />}
        </div>
        {video.isVertical && (
          <span style={{ position: 'absolute', top: '8px', left: '8px', background: '#10b981', color: '#fff', fontSize: '0.65rem', fontWeight: 700, padding: '2px 6px', borderRadius: '4px' }}>9:16</span>
        )}
        {video.duration > 0 && <span className="vf-duration-tag">{video.duration}s</span>}
      </div>
      <div className="vf-card-footer" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '4px' }}>
        <span style={{ fontWeight: 700, fontSize: '0.85rem' }}>{video.title.substring(0, 45)}{video.title.length > 45 ? '...' : ''}</span>
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          <span className="vf-resolution-tag">{video.width}x{video.height}</span>
          {video.tags?.slice(0, 2).map(tag => (<span key={tag} className="vf-resolution-tag">{tag}</span>))}
        </div>
      </div>
    </div>
  )
}
