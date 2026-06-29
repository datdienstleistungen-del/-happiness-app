import { useState, useRef, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { useLanguage } from '../i18n/translations'
import './VideoMakerPage.css'

const TEMPLATES = [
  { id: 'motivation', label: 'Motivation', icon: '💪', desc: 'Kraftvolle Sprueche', query: 'mountain sunrise success', colors: ['#FF6B6B', '#FF8E53'] },
  { id: 'dankbarkeit', label: 'Dankbarkeit', icon: '🙏', desc: 'Wertschaetzung', query: 'nature forest peace', colors: ['#4ECDC4', '#44CF6C'] },
  { id: 'affirmation', label: 'Affirmationen', icon: '✨', desc: 'Positive Gedanken', query: 'sky clouds golden hour', colors: ['#A78BFA', '#818CF8'] },
  { id: 'wellness', label: 'Wellness', icon: '🧘', desc: 'Ruhe & Entspannung', query: 'yoga meditation beach', colors: ['#2DD4BF', '#22D3EE'] },
  { id: 'fitness', label: 'Fitness', icon: '🏋️', desc: 'Training & Kraft', query: 'gym workout fitness', colors: ['#F97316', '#EF4444'] },
  { id: 'liebe', label: 'Liebe', icon: '❤️', desc: 'Gefuehle', query: 'sunset couple love', colors: ['#EC4899', '#F43F5E'] },
]

const MUSIC_LIBRARY = [
  { id: 'none', label: 'Keine', icon: '🔇' },
  { id: 'epic', label: 'Epic', icon: '🎵' },
  { id: 'calm', label: 'Ruhig', icon: '🎶' },
  { id: 'piano', label: 'Piano', icon: '🎹' },
  { id: 'upbeat', label: 'Upbeat', icon: '🎸' },
]

const FALLBACK_SCENES = [
  { text1: 'Du bist', text2: 'staerker als du denkst', duration: 4 },
  { text1: 'Jeder Tag', text2: 'ist eine neue Chance', duration: 4 },
  { text1: 'Glaube an', text2: 'dich selbst', duration: 4 },
  { text1: 'Deine Zeit', text2: 'ist jetzt', duration: 4 },
  { text1: 'Los gehts', text2: 'Happiness', duration: 3 },
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
  const [activeScene, setActiveScene] = useState(0)
  const [images, setImages] = useState([])
  const [imagesLoaded, setImagesLoaded] = useState(false)

  const [selectedTemplate, setSelectedTemplate] = useState(null)
  const [selectedMusic, setSelectedMusic] = useState('none')
  const [textColor, setTextColor] = useState('#ffffff')
  const [textPos, setTextPos] = useState('center')
  const [fontSize, setFontSize] = useState(60)
  const [bgOpacity, setBgOpacity] = useState(50)

  useEffect(() => {
    if (user) {
      const saved = parseInt(localStorage.getItem(`happiness_video_count_${user.id}`) || '0')
      setVideoCount(saved)
    }
  }, [user])

  const loadRealImages = async (query) => {
    try {
      const res = await fetch('/.netlify/functions/search-images', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, count: 5 })
      })
      const data = await res.json()
      return data.images || []
    } catch {
      return []
    }
  }

  const waitForImages = (imageList) => {
    return Promise.all(
      imageList.map(img => new Promise((resolve) => {
        const el = new Image()
        el.crossOrigin = 'anonymous'
        el.onload = () => resolve(el)
        el.onerror = () => resolve(null)
        el.src = img.url
      }))
    )
  }

  const generateVideo = async (templateId) => {
    const tmpl = TEMPLATES.find(t => t.id === templateId)
    if (!tmpl) return
    if (videoCount >= maxFreeVideos) {
      alert(`${maxFreeVideos} kostenlose Videos erreicht. Upgrade auf Premium!`)
      return
    }

    setIsGenerating(true)
    setSelectedTemplate(tmpl)
    setStatus('Lade echte Bilder...')

    const imageList = await loadRealImages(tmpl.query)
    setImages(imageList)

    setStatus('Bilder werden vorbereitet...')
    const loaded = await waitForImages(imageList)
    setImages(loaded.filter(Boolean))
    setImagesLoaded(true)

    setStatus('KI generiert Texte...')
    try {
      const res = await fetch('/.netlify/functions/generate-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: tmpl.desc, template: templateId, language: navigator.language.split('-')[0] })
      })
      const data = await res.json()
      const aiScenes = (data.scenes || []).slice(0, 5).map((s, i) => ({
        text1: s.text1 || FALLBACK_SCENES[i]?.text1 || '',
        text2: s.text2 || FALLBACK_SCENES[i]?.text2 || '',
        duration: s.duration || 4
      }))
      while (aiScenes.length < 5) aiScenes.push(FALLBACK_SCENES[aiScenes.length] || { text1: '', text2: '', duration: 4 })
      setScenes(aiScenes)
    } catch {
      setScenes(FALLBACK_SCENES.map(s => ({ ...s })))
    }

    setVideoCount(prev => {
      const n = prev + 1
      if (user) localStorage.setItem(`happiness_video_count_${user.id}`, n.toString())
      return n
    })
    setIsGenerating(false)
  }

  const playMusic = () => {
    if (selectedMusic === 'none' || !audioRef.current) return
    audioRef.current.src = `/.netlify/functions/audio-proxy?id=${selectedMusic}`
    audioRef.current.volume = 0.3
    audioRef.current.play().catch(() => {})
  }

  const stopMusic = () => {
    audioRef.current?.pause()
    if (audioRef.current) audioRef.current.currentTime = 0
  }

  const playPreview = () => {
    if (scenes.length === 0 || images.length === 0) return
    setIsPlaying(true)
    playMusic()

    let idx = 0
    const play = (i) => {
      if (i >= scenes.length || !isPlaying) {
        setIsPlaying(false)
        stopMusic()
        return
      }
      setActiveScene(i)
      setTimeout(() => play(i + 1), (scenes[i].duration || 4) * 1000)
    }
    play(0)
  }

  const stopPreview = () => {
    setIsPlaying(false)
    stopMusic()
  }

  const drawToCanvas = (imgEl, scene, animProgress) => {
    const canvas = canvasRef.current
    if (!canvas || !imgEl) return
    const ctx = canvas.getContext('2d')
    canvas.width = 1920
    canvas.height = 1080

    ctx.save()
    const z = 1 + animProgress * 0.15
    ctx.translate(960, 540)
    ctx.scale(z, z)
    ctx.translate(-960, -540)
    ctx.drawImage(imgEl, 0, 0, 1920, 1080)
    ctx.restore()

    ctx.fillStyle = `rgba(0,0,0,${bgOpacity / 100})`
    ctx.fillRect(0, 0, 1920, 1080)

    const y = textPos === 'top' ? 270 : textPos === 'bottom' ? 810 : 540
    ctx.textAlign = 'center'
    ctx.shadowColor = 'rgba(0,0,0,0.9)'
    ctx.shadowBlur = 20

    if (scene?.text1) {
      ctx.fillStyle = textColor
      ctx.font = `bold ${fontSize * 3}px 'Segoe UI', Arial, sans-serif`
      ctx.fillText(scene.text1, 960, y - fontSize * 1.5)
    }
    if (scene?.text2) {
      ctx.fillStyle = textColor
      ctx.font = `${fontSize * 2}px 'Segoe UI', Arial, sans-serif`
      ctx.fillText(scene.text2, 960, y + fontSize * 1.5)
    }
    ctx.shadowBlur = 0
    ctx.fillStyle = selectedTemplate?.colors?.[0] || '#9b59b6'
    ctx.font = `bold ${fontSize}px 'Segoe UI', Arial, sans-serif`
    ctx.fillText('Happiness', 960, 1000)
  }

  const exportVideo = async () => {
    if (scenes.length === 0 || images.length === 0) return
    setIsExporting(true)
    setProgress(0)

    try {
      const stream = canvasRef.current.captureStream(30)
      const mr = new MediaRecorder(stream, { mimeType: 'video/webm' })
      const chunks = []
      mr.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data) }
      mr.onstop = () => {
        const blob = new Blob(chunks, { type: 'video/webm' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `happiness-${Date.now()}.webm`
        a.click()
        URL.revokeObjectURL(url)
        setIsExporting(false)
      }

      playMusic()
      mr.start()

      for (let i = 0; i < scenes.length; i++) {
        setStatus(`Szene ${i+1}/${scenes.length}`)
        setActiveScene(i)
        await new Promise(resolve => {
          const start = Date.now()
          const dur = (scenes[i].duration || 4) * 1000
          const img = images[i % images.length]
          const animate = () => {
            const p = Math.min(1, (Date.now() - start) / dur)
            drawToCanvas(img, scenes[i], p)
            setProgress(((i + p) / scenes.length) * 100)
            if (p < 1) requestAnimationFrame(animate)
            else resolve()
          }
          animate()
        })
      }
      mr.stop()
      stopMusic()
    } catch (e) {
      console.error(e)
      setIsExporting(false)
      stopMusic()
    }
  }

  const updateScene = (i, field, val) => {
    setScenes(prev => prev.map((s, idx) => idx === i ? { ...s, [field]: val } : s))
  }

  const remaining = maxFreeVideos - videoCount

  return (
    <div className="video-maker-page">
      <audio ref={audioRef} loop preload="auto" />
      <h1>🎬 Video Creator</h1>

      <div className="ai-section">
        <div className="ai-header">
          <span className="ai-badge">KI</span>
          <span>Echte Videos mit Stock-Footage</span>
          <span className="video-counter">{remaining}免费 uebrig</span>
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
      </div>

      {scenes.length > 0 && imagesLoaded && (
        <div className="editor-section">
          <div className="editor-layout">
            <div className="preview-column">
              <div className="video-preview">
                <div className="preview-slides">
                  {images.slice(0, scenes.length).map((img, i) => (
                    <div
                      key={i}
                      className={`preview-slide ${i === activeScene ? 'active' : ''}`}
                      style={{ backgroundImage: `url(${img.url})` }}
                    >
                      <div className="slide-overlay" style={{ opacity: bgOpacity / 100 }} />
                      <div className={`slide-text text-${textPos}`} style={{ color: textColor }}>
                        {scenes[i]?.text1 && (
                          <div className="slide-text1" style={{ fontSize: `${fontSize * 0.5}px` }}>
                            {scenes[i].text1}
                          </div>
                        )}
                        {scenes[i]?.text2 && (
                          <div className="slide-text2" style={{ fontSize: `${fontSize * 0.3}px` }}>
                            {scenes[i].text2}
                          </div>
                        )}
                        <div className="slide-brand" style={{ color: selectedTemplate?.colors?.[0] || '#9b59b6' }}>
                          Happiness
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="playback-controls">
                  <button className="play-btn" onClick={isPlaying ? stopPreview : playPreview}>
                    {isPlaying ? '⏸️' : '▶️'}
                  </button>
                  <span className="clip-counter">Szene {activeScene + 1}/{scenes.length}</span>
                </div>
              </div>

              <div className="timeline">
                {scenes.map((s, i) => (
                  <div
                    key={i}
                    className={`timeline-clip ${i === activeScene ? 'active' : ''}`}
                    onClick={() => setActiveScene(i)}
                  >
                    {images[i] && <div className="timeline-thumb" style={{ backgroundImage: `url(${images[i].url})` }} />}
                    <div className="timeline-clip-num">{i + 1}</div>
                    <div className="timeline-clip-text">{s.text1 || `Szene ${i+1}`}</div>
                  </div>
                ))}
              </div>

              <div className="export-row">
                <canvas ref={canvasRef} style={{ display: 'none' }} width={1920} height={1080} />
                <button className="btn btn-export" onClick={exportVideo} disabled={isExporting}>
                  {isExporting ? `⏳ ${Math.round(progress)}%` : '📥 Video herunterladen (1080p)'}
                </button>
              </div>
            </div>

            <div className="settings-column">
              <div className="settings-panel">
                <h3>Texte</h3>
                {scenes.map((s, i) => (
                  <div key={i} className={`scene-editor ${i === activeScene ? 'active' : ''}`}>
                    <label>Szene {i+1}</label>
                    <input type="text" placeholder="Haupttext" value={s.text1} onChange={e => updateScene(i, 'text1', e.target.value)} />
                    <input type="text" placeholder="Untertext" value={s.text2} onChange={e => updateScene(i, 'text2', e.target.value)} />
                    <input type="number" min="2" max="10" value={s.duration} onChange={e => updateScene(i, 'duration', +e.target.value || 4)} className="duration-input" />
                  </div>
                ))}
                <h3>Design</h3>
                <div className="control-group">
                  <label>Textfarbe</label>
                  <input type="color" value={textColor} onChange={e => setTextColor(e.target.value)} />
                </div>
                <div className="control-group">
                  <label>Schriftgroesse</label>
                  <input type="range" min="24" max="80" value={fontSize} onChange={e => setFontSize(+e.target.value)} />
                </div>
                <div className="control-group">
                  <label>Transparenz</label>
                  <input type="range" min="0" max="100" value={bgOpacity} onChange={e => setBgOpacity(+e.target.value)} />
                </div>
                <div className="control-group">
                  <label>Position</label>
                  <select value={textPos} onChange={e => setTextPos(e.target.value)}>
                    <option value="top">Oben</option>
                    <option value="center">Mitte</option>
                    <option value="bottom">Unten</option>
                  </select>
                </div>
                <h3>Musik</h3>
                <div className="music-grid">
                  {MUSIC_LIBRARY.map(m => (
                    <button key={m.id} className={`music-card ${selectedMusic === m.id ? 'active' : ''}`} onClick={() => setSelectedMusic(m.id)}>
                      <span className="music-icon">{m.icon}</span>
                      <span className="music-label">{m.label}</span>
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
          <p>Waehle ein Template. Die KI holt echte Stock-Bilder, generiert Texte und du bekommst ein fertiges Video.</p>
        </div>
      )}
    </div>
  )
}
