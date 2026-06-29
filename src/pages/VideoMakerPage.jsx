import { useState, useRef, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { useLanguage } from '../i18n/translations'
import getStockImages from '../lib/stockImages'
import './VideoMakerPage.css'

const TEMPLATES = [
  { id: 'motivation', label: 'Motivation', icon: '💪', desc: 'Kraftvolle Sprüche', colors: ['#FF6B6B', '#FF8E53'] },
  { id: 'dankbarkeit', label: 'Dankbarkeit', icon: '🙏', desc: 'Wertschätzung', colors: ['#4ECDC4', '#44CF6C'] },
  { id: 'affirmation', label: 'Affirmationen', icon: '✨', desc: 'Positive Gedanken', colors: ['#A78BFA', '#818CF8'] },
  { id: 'wellness', label: 'Wellness', icon: '🧘', desc: 'Ruhe & Entspannung', colors: ['#2DD4BF', '#22D3EE'] },
  { id: 'fitness', label: 'Fitness', icon: '🏋️', desc: 'Training & Kraft', colors: ['#F97316', '#EF4444'] },
  { id: 'liebe', label: 'Liebe', icon: '❤️', desc: 'Gefühle & Beziehung', colors: ['#EC4899', '#F43F5E'] },
]

const MUSIC_LIBRARY = [
  { id: 'none', label: 'Keine Musik', icon: '🔇', url: '' },
  { id: 'motivation', label: 'Motivation Epic', icon: '🎵', url: 'https://cdn.pixabay.com/audio/2022/10/14/audio_2af9e5748c.mp3' },
  { id: 'calm', label: 'Ruhig & Entspannt', icon: '🎶', url: 'https://cdn.pixabay.com/audio/2022/08/02/audio_884fe92c38.mp3' },
  { id: 'upbeat', label: 'Upbeat & Energetisch', icon: '🎸', url: 'https://cdn.pixabay.com/audio/2023/10/30/audio_3713e23867.mp3' },
  { id: 'piano', label: 'Piano Gefühle', icon: '🎹', url: 'https://cdn.pixabay.com/audio/2022/05/27/audio_1808fbf07a.mp3' },
]

export default function VideoMakerPage() {
  const { t } = useLanguage()
  const { user } = useAuth()
  const canvasRef = useRef(null)
  const audioRef = useRef(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [progress, setProgress] = useState(0)
  const [status, setStatus] = useState('Bereit')
  const [videoCount, setVideoCount] = useState(0)
  const maxFreeVideos = 20

  const [scenes, setScenes] = useState([])
  const [activeSceneIndex, setActiveSceneIndex] = useState(0)
  const [imagesLoaded, setImagesLoaded] = useState(false)
  const [loadedImages, setLoadedImages] = useState([])

  const [aiPrompt, setAiPrompt] = useState('')
  const [selectedTemplate, setSelectedTemplate] = useState(null)
  const [selectedMusic, setSelectedMusic] = useState('none')
  const [textColor, setTextColor] = useState('#ffffff')
  const [textPosition, setTextPosition] = useState('center')
  const [fontSize, setFontSize] = useState(48)
  const [bgOpacity, setBgOpacity] = useState(60)
  const [kenBurnsStyle, setKenBurnsStyle] = useState('zoom-in')

  useEffect(() => {
    if (user) {
      const key = `happiness_video_count_${user.id}`
      const saved = parseInt(localStorage.getItem(key) || '0')
      setVideoCount(saved)
    }
  }, [user])

  const loadImages = async (imageUrls) => {
    const promises = imageUrls.map(url => {
      return new Promise((resolve) => {
        const img = new Image()
        img.crossOrigin = 'anonymous'
        img.onload = () => resolve(img)
        img.onerror = () => {
          const fallback = document.createElement('canvas')
          fallback.width = 1920
          fallback.height = 1080
          const ctx = fallback.getContext('2d')
          const gradient = ctx.createLinearGradient(0, 0, 1920, 1080)
          gradient.addColorStop(0, '#9b59b6')
          gradient.addColorStop(1, '#3498db')
          ctx.fillStyle = gradient
          ctx.fillRect(0, 0, 1920, 1080)
          const canvasImg = new Image()
          canvasImg.src = fallback.toDataURL()
          canvasImg.onload = () => resolve(canvasImg)
          canvasImg.onerror = () => resolve(null)
        }
        img.src = url
      })
    })
    return Promise.all(promises)
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
    setStatus('Bilder laden...')
    setSelectedTemplate(template)

    try {
      const category = template?.id || 'motivation'
      const imageUrls = getStockImages(category)

      setStatus('Bilder werden vorbereitet...')
      const images = await loadImages(imageUrls)
      setLoadedImages(images)

      setStatus('KI generiert Texte...')
      const aiResponse = await fetch('/.netlify/functions/generate-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, template: templateId, language: navigator.language.split('-')[0] })
      })
      const aiData = await aiResponse.json()

      const newScenes = (aiData.scenes || []).slice(0, images.length).map((s, i) => ({
        id: i + 1,
        text1: s.text1 || '',
        text2: s.text2 || '',
        imageIndex: i,
        duration: s.duration || 4
      }))

      while (newScenes.length < images.length) {
        newScenes.push({
          id: newScenes.length + 1,
          text1: '',
          text2: '',
          imageIndex: newScenes.length,
          duration: 4
        })
      }

      setScenes(newScenes)
      setImagesLoaded(true)
      setVideoCount(prev => {
        const newCount = prev + 1
        if (user) localStorage.setItem(`happiness_video_count_${user.id}`, newCount.toString())
        return newCount
      })
    } catch (error) {
      console.error('Generation error:', error)
      alert('Fehler bei der Generierung.')
    } finally {
      setIsGenerating(false)
    }
  }

  const drawScene = (sceneIndex, animationProgress = 1) => {
    const canvas = canvasRef.current
    if (!canvas || !loadedImages[sceneIndex]) return

    const ctx = canvas.getContext('2d')
    canvas.width = 1920
    canvas.height = 1080

    const img = loadedImages[sceneIndex]
    const scene = scenes[sceneIndex]

    ctx.save()

    let scale, offsetX, offsetY
    const imgAspect = img.width / img.height
    const canvasAspect = canvas.width / canvas.height

    if (imgAspect > canvasAspect) {
      scale = canvas.height / img.height
      offsetX = (canvas.width - img.width * scale) / 2
      offsetY = 0
    } else {
      scale = canvas.width / img.width
      offsetX = 0
      offsetY = (canvas.height - img.height * scale) / 2
    }

    if (kenBurnsStyle === 'zoom-in') {
      const zoom = 1 + (animationProgress * 0.15)
      ctx.translate(canvas.width / 2, canvas.height / 2)
      ctx.scale(zoom, zoom)
      ctx.translate(-canvas.width / 2, -canvas.height / 2)
    } else if (kenBurnsStyle === 'zoom-out') {
      const zoom = 1.15 - (animationProgress * 0.15)
      ctx.translate(canvas.width / 2, canvas.height / 2)
      ctx.scale(zoom, zoom)
      ctx.translate(-canvas.width / 2, -canvas.height / 2)
    } else if (kenBurnsStyle === 'pan-left') {
      const pan = animationProgress * 50
      ctx.translate(-pan, 0)
    } else if (kenBurnsStyle === 'pan-right') {
      const pan = animationProgress * 50
      ctx.translate(pan, 0)
    }

    ctx.drawImage(img, offsetX, offsetY, img.width * scale, img.height * scale)
    ctx.restore()

    ctx.fillStyle = `rgba(0,0,0,${bgOpacity / 100})`
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    const yCenter = textPosition === 'top' ? canvas.height * 0.25
      : textPosition === 'bottom' ? canvas.height * 0.75
      : canvas.height * 0.5

    ctx.textAlign = 'center'
    ctx.fillStyle = textColor
    ctx.shadowColor = 'rgba(0,0,0,0.9)'
    ctx.shadowBlur = 15

    if (scene?.text1) {
      ctx.font = `bold ${fontSize * 3}px 'Segoe UI', Arial, sans-serif`
      ctx.fillText(scene.text1, canvas.width / 2, yCenter - fontSize * 1.5)
    }

    if (scene?.text2) {
      ctx.font = `${fontSize * 1.8}px 'Segoe UI', Arial, sans-serif`
      ctx.fillText(scene.text2, canvas.width / 2, yCenter + fontSize * 1.5)
    }

    ctx.shadowBlur = 0

    ctx.font = `bold ${fontSize * 0.8}px 'Segoe UI', Arial, sans-serif`
    ctx.fillStyle = selectedTemplate?.colors?.[0] || '#9b59b6'
    ctx.fillText('Happiness', canvas.width / 2, canvas.height - 80)
  }

  useEffect(() => {
    if (scenes.length > 0 && loadedImages.length > 0 && activeSceneIndex < scenes.length) {
      drawScene(activeSceneIndex, 1)
    }
  }, [activeSceneIndex, scenes, loadedImages, textColor, fontSize, bgOpacity, textPosition, selectedTemplate, kenBurnsStyle])

  const playPreview = () => {
    if (scenes.length === 0) return
    setIsPlaying(true)
    setActiveSceneIndex(0)

    const music = MUSIC_LIBRARY.find(m => m.id === selectedMusic)
    if (music?.url && audioRef.current) {
      audioRef.current.src = music.url
      audioRef.current.volume = 0.3
      audioRef.current.play().catch(() => {})
    }

    let currentIdx = 0
    const playScene = (idx) => {
      if (idx >= scenes.length) {
        setIsPlaying(false)
        if (audioRef.current) {
          audioRef.current.pause()
          audioRef.current.currentTime = 0
        }
        return
      }

      setActiveSceneIndex(idx)
      const startTime = Date.now()
      const duration = (scenes[idx].duration || 4) * 1000

      const animate = () => {
        const elapsed = Date.now() - startTime
        const progress = Math.min(1, elapsed / duration)
        drawScene(idx, progress)
        if (progress < 1) {
          requestAnimationFrame(animate)
        } else {
          playScene(idx + 1)
        }
      }
      animate()
    }

    playScene(0)
  }

  const stopPreview = () => {
    setIsPlaying(false)
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.currentTime = 0
    }
  }

  const exportVideo = async () => {
    if (scenes.length === 0) return

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

        try {
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
        } catch (e) {
          console.warn('Audio mixing failed, exporting without audio')
        }
      }

      const mediaRecorder = new MediaRecorder(combinedStream, {
        mimeType: MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
          ? 'video/webm;codecs=vp9'
          : 'video/webm'
      })
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

      for (let i = 0; i < scenes.length; i++) {
        setStatus(`Szene ${i + 1} von ${scenes.length}...`)
        await new Promise(resolve => {
          setActiveSceneIndex(i)
          const startTime = Date.now()
          const duration = (scenes[i].duration || 4) * 1000

          const animate = () => {
            const elapsed = Date.now() - startTime
            const animProgress = Math.min(1, elapsed / duration)
            drawScene(i, animProgress)
            setProgress(((i + animProgress) / scenes.length) * 100)

            if (animProgress < 1) {
              requestAnimationFrame(animate)
            } else {
              resolve()
            }
          }
          animate()
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
    setScenes(prev => prev.map((s, i) => i === index ? { ...s, [field]: value } : s))
  }

  const remaining = maxFreeVideos - videoCount

  return (
    <div className="video-maker-page">
      <audio ref={audioRef} loop preload="auto" />
      <h1>🎬 Video Creator</h1>

      <div className="ai-section">
        <div className="ai-header">
          <span className="ai-badge">KI</span>
          <span>Echte Videos mit Stock-Bildern + Musik</span>
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

      {scenes.length > 0 && imagesLoaded && (
        <div className="editor-section">
          <div className="editor-layout">
            <div className="preview-column">
              <div className="video-preview">
                <canvas ref={canvasRef} className="preview-canvas" width={1920} height={1080} />
                <div className="playback-controls">
                  <button className="play-btn" onClick={isPlaying ? stopPreview : playPreview}>
                    {isPlaying ? '⏸️' : '▶️'}
                  </button>
                  <div className="clip-counter">
                    Szene {activeSceneIndex + 1} / {scenes.length}
                  </div>
                </div>
              </div>

              <div className="timeline">
                {scenes.map((scene, i) => (
                  <div
                    key={i}
                    className={`timeline-clip ${i === activeSceneIndex ? 'active' : ''}`}
                    onClick={() => { setActiveSceneIndex(i); drawScene(i, 1) }}
                  >
                    <div className="timeline-clip-number">{i + 1}</div>
                    <div className="timeline-clip-text">
                      {scene.text1 || `Szene ${i + 1}`}
                    </div>
                  </div>
                ))}
              </div>

              <div className="export-row">
                <button
                  className="btn btn-export"
                  onClick={exportVideo}
                  disabled={isExporting || scenes.length === 0}
                >
                  {isExporting ? `⏳ Exportiere... ${Math.round(progress)}%` : '📥 Video herunterladen (1080p)'}
                </button>
              </div>
            </div>

            <div className="settings-column">
              <div className="settings-panel">
                <h3>Text-Overlays</h3>
                {scenes.map((scene, i) => (
                  <div key={i} className={`scene-editor ${i === activeSceneIndex ? 'active' : ''}`}>
                    <label>Szene {i + 1}</label>
                    <input
                      type="text"
                      placeholder="Haupttext"
                      value={scene.text1}
                      onChange={(e) => updateSceneText(i, 'text1', e.target.value)}
                    />
                    <input
                      type="text"
                      placeholder="Untertext"
                      value={scene.text2}
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
                  <label>Transparenz</label>
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
                  <label>Bewegung</label>
                  <select value={kenBurnsStyle} onChange={(e) => setKenBurnsStyle(e.target.value)}>
                    <option value="zoom-in">Zoom rein</option>
                    <option value="zoom-out">Zoom raus</option>
                    <option value="pan-left">Nach links</option>
                    <option value="pan-right">Nach rechts</option>
                    <option value="none">Statisch</option>
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

      {scenes.length === 0 && !isGenerating && (
        <div className="empty-state">
          <div className="empty-icon">🎬</div>
          <h2>Erstelle echte Videos</h2>
          <p>Wähle ein Template oder gib ein Thema ein.<br/>Die KI generiert ein fertiges Video mit echten Stock-Bildern, Ken Burns Effekt und Musik.</p>
        </div>
      )}
    </div>
  )
}
