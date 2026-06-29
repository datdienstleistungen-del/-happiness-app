import { useState, useRef, useEffect, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'
import { useLanguage } from '../i18n/translations'
import './VideoMakerPage.css'

const TEMPLATES = [
  { id: 'motivation', label: 'Motivation', icon: '💪', desc: 'Kraftvolle Sprüche', colors: ['#FF6B6B', '#FF8E53'], query: 'motivation success' },
  { id: 'dankbarkeit', label: 'Dankbarkeit', icon: '🙏', desc: 'Wertschätzung', colors: ['#4ECDC4', '#44CF6C'], query: 'nature peace' },
  { id: 'affirmation', label: 'Affirmationen', icon: '✨', desc: 'Positive Gedanken', colors: ['#A78BFA', '#818CF8'], query: 'sky clouds' },
  { id: 'wellness', label: 'Wellness', icon: '🧘', desc: 'Ruhe & Entspannung', colors: ['#2DD4BF', '#22D3EE'], query: 'meditation wellness' },
  { id: 'fitness', label: 'Fitness', icon: '🏋️', desc: 'Training & Kraft', colors: ['#F97316', '#EF4444'], query: 'fitness workout' },
  { id: 'liebe', label: 'Liebe', icon: '❤️', desc: 'Gefühle & Beziehung', colors: ['#EC4899', '#F43F5E'], query: 'love couple' },
]

const MUSIC_LIBRARY = [
  { id: 'none', label: 'Keine Musik', icon: '🔇', url: '' },
  { id: 'motivation', label: 'Motivation Epic', icon: '🎵', url: 'https://cdn.pixabay.com/audio/2022/10/14/audio_2af9e5748c.mp3' },
  { id: 'calm', label: 'Ruhig & Entspannt', icon: '🎶', url: 'https://cdn.pixabay.com/audio/2022/08/02/audio_884fe92c38.mp3' },
  { id: 'upbeat', label: 'Upbeat & Energetisch', icon: '🎸', url: 'https://cdn.pixabay.com/audio/2023/10/30/audio_3713e23867.mp3' },
  { id: 'piano', label: 'Piano Gefühle', icon: '🎹', url: 'https://cdn.pixabay.com/audio/2022/05/27/audio_1808fbf07a.mp3' },
  { id: 'ambient', label: 'Ambient Atmosphere', icon: '🌊', url: 'https://cdn.pixabay.com/audio/2022/01/20/audio_d1718ab41b.mp3' },
  { id: 'corporate', label: 'Professionell', icon: '💼', url: 'https://cdn.pixabay.com/audio/2023/01/27/audio_08ed025164.mp3' },
]

export default function VideoMakerPage() {
  const { t } = useLanguage()
  const { user } = useAuth()
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const audioRef = useRef(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [progress, setProgress] = useState(0)
  const [status, setStatus] = useState('Bereit')
  const [videoCount, setVideoCount] = useState(0)
  const maxFreeVideos = 20

  const [clips, setClips] = useState([])
  const [activeClipIndex, setActiveClipIndex] = useState(0)
  const [currentClip, setCurrentClip] = useState(null)

  const [aiPrompt, setAiPrompt] = useState('')
  const [selectedTemplate, setSelectedTemplate] = useState(null)

  const [sceneTexts, setSceneTexts] = useState([
    { text1: '', text2: '' },
    { text1: '', text2: '' },
    { text1: '', text2: '' },
    { text1: '', text2: '' },
    { text1: '', text2: '' },
  ])

  const [transition, setTransition] = useState('fade')
  const [selectedMusic, setSelectedMusic] = useState('none')
  const [textColor, setTextColor] = useState('#ffffff')
  const [textPosition, setTextPosition] = useState('center')
  const [fontSize, setFontSize] = useState(48)
  const [bgOpacity, setBgOpacity] = useState(60)

  useEffect(() => {
    if (user) {
      const key = `happiness_video_count_${user.id}`
      const saved = parseInt(localStorage.getItem(key) || '0')
      setVideoCount(saved)
    }
  }, [user])

  const searchClips = async (query) => {
    try {
      const response = await fetch('/.netlify/functions/pexels-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, count: 5 })
      })
      const data = await response.json()
      return data.videos || []
    } catch (error) {
      console.error('Clip search error:', error)
      return []
    }
  }

  const generateVideo = async (templateId = null) => {
    const template = templateId ? TEMPLATES.find(t => t.id === templateId) : null
    const prompt = template ? template.desc : aiPrompt

    if (!prompt.trim()) return
    if (videoCount >= maxFreeVideos) {
      alert(`Du hast ${maxFreeVideos} kostenlose Videos erreicht. Upgrade auf Premium!`)
      return
    }

    setIsGenerating(true)
    setStatus('Suche Stock-Clips...')
    setSelectedTemplate(template)

    try {
      const query = template?.query || prompt
      const foundClips = await searchClips(query)

      if (foundClips.length === 0) {
        alert('Keine Clips gefunden. Versuche ein anderes Thema.')
        setIsGenerating(false)
        return
      }

      setStatus('KI generiert Texte...')
      const aiResponse = await fetch('/.netlify/functions/generate-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, template: templateId, language: navigator.language.split('-')[0] })
      })
      const aiData = await aiResponse.json()

      const newSceneTexts = (aiData.scenes || []).slice(0, foundClips.length).map(s => ({
        text1: s.text1 || '',
        text2: s.text2 || ''
      }))

      while (newSceneTexts.length < foundClips.length) {
        newSceneTexts.push({ text1: '', text2: '' })
      }

      setClips(foundClips)
      setSceneTexts(newSceneTexts)
      setVideoCount(prev => {
        const newCount = prev + 1
        if (user) localStorage.setItem(`happiness_video_count_${user.id}`, newCount.toString())
        return newCount
      })

      setStatus('Clips laden...')
    } catch (error) {
      console.error('Generation error:', error)
      alert('Fehler bei der Generierung.')
    } finally {
      setIsGenerating(false)
    }
  }

  const loadClip = useCallback((index) => {
    if (index < 0 || index >= clips.length) return
    setActiveClipIndex(index)
    const clip = clips[index]
    setCurrentClip(clip)

    if (videoRef.current) {
      videoRef.current.src = clip.url
      videoRef.current.load()
      videoRef.current.play().catch(() => {})
    }
  }, [clips])

  useEffect(() => {
    if (clips.length > 0 && !currentClip) {
      loadClip(0)
    }
  }, [clips, currentClip, loadClip])

  const drawTextOverlay = () => {
    const canvas = canvasRef.current
    const video = videoRef.current
    if (!canvas || !video || video.readyState < 2) return

    const ctx = canvas.getContext('2d')
    canvas.width = video.videoWidth || 1920
    canvas.height = video.videoHeight || 1080

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

    ctx.fillStyle = `rgba(0,0,0,${bgOpacity / 100})`
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    const scene = sceneTexts[activeClipIndex] || { text1: '', text2: '' }
    const yCenter = textPosition === 'top' ? canvas.height * 0.3
      : textPosition === 'bottom' ? canvas.height * 0.7
      : canvas.height * 0.5

    ctx.textAlign = 'center'
    ctx.fillStyle = textColor

    if (scene.text1) {
      ctx.font = `bold ${fontSize * 2}px 'Segoe UI', sans-serif`
      ctx.shadowColor = 'rgba(0,0,0,0.8)'
      ctx.shadowBlur = 10
      ctx.fillText(scene.text1, canvas.width / 2, yCenter - fontSize)
      ctx.shadowBlur = 0
    }

    if (scene.text2) {
      ctx.font = `${fontSize * 1.2}px 'Segoe UI', sans-serif`
      ctx.shadowColor = 'rgba(0,0,0,0.8)'
      ctx.shadowBlur = 10
      ctx.fillText(scene.text2, canvas.width / 2, yCenter + fontSize * 1.5)
      ctx.shadowBlur = 0
    }

    ctx.font = `bold ${fontSize * 0.6}px 'Segoe UI', sans-serif`
    ctx.fillStyle = selectedTemplate?.colors?.[0] || '#9b59b6'
    ctx.fillText('Happiness', canvas.width / 2, canvas.height - 60)
  }

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    let animFrame
    const renderLoop = () => {
      if (video.readyState >= 2) {
        drawTextOverlay()
      }
      animFrame = requestAnimationFrame(renderLoop)
    }

    video.addEventListener('play', () => {
      renderLoop()
    })

    video.addEventListener('ended', () => {
      if (activeClipIndex < clips.length - 1) {
        loadClip(activeClipIndex + 1)
      } else {
        setIsPlaying(false)
        setStatus('Fertig!')
      }
    })

    return () => {
      cancelAnimationFrame(animFrame)
    }
  }, [activeClipIndex, clips, sceneTexts, textColor, fontSize, bgOpacity, textPosition, selectedTemplate])

  const playPreview = () => {
    if (clips.length === 0) return
    setIsPlaying(true)
    loadClip(0)

    const music = MUSIC_LIBRARY.find(m => m.id === selectedMusic)
    if (music?.url && audioRef.current) {
      audioRef.current.src = music.url
      audioRef.current.volume = 0.3
      audioRef.current.play().catch(() => {})
    }
  }

  const stopPreview = () => {
    setIsPlaying(false)
    if (videoRef.current) {
      videoRef.current.pause()
    }
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.currentTime = 0
    }
  }

  const exportVideo = async () => {
    if (clips.length === 0) return

    setIsExporting(true)
    setProgress(0)
    setStatus('Exportiere Video...')

    try {
      const canvas = canvasRef.current
      const videoStream = canvas.captureStream(30)

      const music = MUSIC_LIBRARY.find(m => m.id === selectedMusic)
      let combinedStream = videoStream

      if (music?.url && audioRef.current) {
        audioRef.current.src = music.url
        audioRef.current.volume = 0.3

        const audioCtx = new AudioContext()
        const source = audioCtx.createMediaElementSource(audioRef.current)
        const dest = audioCtx.createMediaStreamDestination()
        source.connect(dest)
        source.connect(audioCtx.destination)

        combinedStream = new MediaStream([
          ...videoStream.getTracks(),
          ...dest.stream.getTracks()
        ])

        audioRef.current.play().catch(() => {})
      }

      const mediaRecorder = new MediaRecorder(combinedStream, { mimeType: 'video/webm;codecs=vp9' })
      const chunks = []

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data)
      }

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'video/webm' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `happiness-video-${Date.now()}.webm`
        a.click()
        URL.revokeObjectURL(url)
        setStatus('Video exportiert! ✅')
        setProgress(100)
        setIsExporting(false)

        if (audioRef.current) {
          audioRef.current.pause()
          audioRef.current.currentTime = 0
        }
      }

      mediaRecorder.start()

      for (let i = 0; i < clips.length; i++) {
        setStatus(`Clip ${i + 1} von ${clips.length}...`)
        await new Promise(resolve => {
          loadClip(i)
          const video = videoRef.current
          const onPlay = () => {
            video.removeEventListener('playing', onPlay)
            const duration = Math.min(clips[i].duration || 5, 8)
            setTimeout(() => {
              setProgress(((i + 1) / clips.length) * 100)
              resolve()
            }, duration * 1000)
          }
          video.addEventListener('playing', onPlay)
          video.play().catch(() => {
            setTimeout(resolve, 3000)
          })
        })
      }

      mediaRecorder.stop()
    } catch (error) {
      console.error('Export error:', error)
      setStatus('Export fehlgeschlagen')
      setIsExporting(false)
    }
  }

  const updateSceneText = (index, field, value) => {
    setSceneTexts(prev => {
      const newTexts = [...prev]
      while (newTexts.length <= index) newTexts.push({ text1: '', text2: '' })
      newTexts[index] = { ...newTexts[index], [field]: value }
      return newTexts
    })
  }

  const remaining = maxFreeVideos - videoCount

  return (
    <div className="video-maker-page">
      <audio ref={audioRef} loop preload="auto" />
      <h1>🎬 Video Creator</h1>

      <div className="ai-section">
        <div className="ai-header">
          <span className="ai-badge">KI</span>
          <span>Echte Videos mit Stock-Footage generieren</span>
          <span className="video-counter">{remaining}免费 Videos übrig</span>
        </div>

        <div className="template-grid">
          {TEMPLATES.map(tmpl => (
            <button
              key={tmpl.id}
              className={`template-card ${selectedTemplate?.id === tmpl.id ? 'active' : ''} ${isGenerating ? 'disabled' : ''}`}
              onClick={() => generateVideo(tmpl.id)}
              disabled={isGenerating}
            >
              <span className="template-icon">{tmpl.icon}</span>
              <span className="template-label">{tmpl.label}</span>
              <span className="template-desc">{tmpl.desc}</span>
            </button>
          ))}
        </div>

        <div className="ai-prompt-row">
          <input
            type="text"
            className="ai-prompt-input"
            placeholder="Oder gib ein Thema ein... z.B. 'Morgenroutine für Erfolg'"
            value={aiPrompt}
            onChange={(e) => setAiPrompt(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !isGenerating && generateVideo()}
            disabled={isGenerating}
          />
          <button
            className="btn btn-ai-generate"
            onClick={() => generateVideo()}
            disabled={isGenerating || !aiPrompt.trim()}
          >
            {isGenerating ? '⏳ Generiere...' : '✨ Video erstellen'}
          </button>
        </div>
      </div>

      {clips.length > 0 && (
        <div className="editor-section">
          <div className="editor-layout">
            <div className="preview-column">
              <div className="video-preview">
                <video
                  ref={videoRef}
                  className="preview-video"
                  playsInline
                  muted
                />
                <canvas
                  ref={canvasRef}
                  className="preview-canvas"
                />
                <div className="playback-controls">
                  <button className="play-btn" onClick={isPlaying ? stopPreview : playPreview}>
                    {isPlaying ? '⏸️' : '▶️'}
                  </button>
                  <div className="clip-counter">
                    Clip {activeClipIndex + 1} / {clips.length}
                  </div>
                </div>
              </div>

              <div className="timeline">
                {clips.map((clip, i) => (
                  <div
                    key={i}
                    className={`timeline-clip ${i === activeClipIndex ? 'active' : ''}`}
                    onClick={() => loadClip(i)}
                  >
                    <div className="timeline-clip-number">{i + 1}</div>
                    <div className="timeline-clip-text">
                      {sceneTexts[i]?.text1 || `Clip ${i + 1}`}
                    </div>
                  </div>
                ))}
              </div>

              <div className="export-row">
                <button
                  className="btn btn-export"
                  onClick={exportVideo}
                  disabled={isExporting || clips.length === 0}
                >
                  {isExporting ? `⏳ Exportiere... ${Math.round(progress)}%` : '📥 Video herunterladen (1080p)'}
                </button>
              </div>
            </div>

            <div className="settings-column">
              <div className="settings-panel">
                <h3>Text-Overlays</h3>
                {clips.map((clip, i) => (
                  <div key={i} className={`scene-editor ${i === activeClipIndex ? 'active' : ''}`}>
                    <label>Clip {i + 1}</label>
                    <input
                      type="text"
                      placeholder="Haupttext"
                      value={sceneTexts[i]?.text1 || ''}
                      onChange={(e) => updateSceneText(i, 'text1', e.target.value)}
                    />
                    <input
                      type="text"
                      placeholder="Untertext"
                      value={sceneTexts[i]?.text2 || ''}
                      onChange={(e) => updateSceneText(i, 'text2', e.target.value)}
                    />
                  </div>
                ))}

                <h3>Design</h3>
                <div className="control-group">
                  <label>Textfarbe</label>
                  <input type="color" value={textColor} onChange={(e) => setTextColor(e.target.value)} />
                </div>
                <div className="control-group">
                  <label>Schriftgröße</label>
                  <input type="range" min="24" max="80" value={fontSize} onChange={(e) => setFontSize(parseInt(e.target.value))} />
                  <span>{fontSize}px</span>
                </div>
                <div className="control-group">
                  <label>Hintergrund-Transparenz</label>
                  <input type="range" min="0" max="100" value={bgOpacity} onChange={(e) => setBgOpacity(parseInt(e.target.value))} />
                  <span>{bgOpacity}%</span>
                </div>
                <div className="control-group">
                  <label>Textposition</label>
                  <select value={textPosition} onChange={(e) => setTextPosition(e.target.value)}>
                    <option value="top">Oben</option>
                    <option value="center">Mitte</option>
                    <option value="bottom">Unten</option>
                  </select>
                </div>
                <div className="control-group">
                  <label>Übergang</label>
                  <select value={transition} onChange={(e) => setTransition(e.target.value)}>
                    <option value="fade">Fade</option>
                    <option value="slide">Slide</option>
                    <option value="zoom">Zoom</option>
                    <option value="none">Keiner</option>
                  </select>
                </div>

                <h3>Musik</h3>
                <div className="music-grid">
                  {MUSIC_LIBRARY.map(music => (
                    <button
                      key={music.id}
                      className={`music-card ${selectedMusic === music.id ? 'active' : ''}`}
                      onClick={() => setSelectedMusic(music.id)}
                    >
                      <span className="music-icon">{music.icon}</span>
                      <span className="music-label">{music.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {isGenerating && (
            <div className="generating-overlay">
              <div className="generating-spinner" />
              <p>{status}</p>
            </div>
          )}
        </div>
      )}

      {clips.length === 0 && !isGenerating && (
        <div className="empty-state">
          <div className="empty-icon">🎬</div>
          <h2>Erstelle echte Videos</h2>
          <p>Wähle ein Template oder gib ein Thema ein.<br/>Die KI generiert ein fertiges Video mit Stock-Footage, Text-Overlay und Musik.</p>
        </div>
      )}
    </div>
  )
}
