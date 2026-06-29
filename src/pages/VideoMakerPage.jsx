import { useState, useRef, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { useLanguage } from '../i18n/translations'
import './VideoMakerPage.css'

const TEMPLATES = [
  { id: 'motivation', label: 'Motivation', icon: '💪', desc: 'Kraftvolle Sprüche', colors: ['#FF6B6B', '#FF8E53'], bg: ['#1a1a2e', '#16213e', '#0f3460', '#533483', '#e94560'] },
  { id: 'dankbarkeit', label: 'Dankbarkeit', icon: '🙏', desc: 'Wertschätzung', colors: ['#4ECDC4', '#44CF6C'], bg: ['#2d6a4f', '#40916c', '#52b788', '#74c69d', '#95d5b2'] },
  { id: 'affirmation', label: 'Affirmationen', icon: '✨', desc: 'Positive Gedanken', colors: ['#A78BFA', '#818CF8'], bg: ['#2b2d42', '#3d405b', '#5c548e', '#7b6cf6', '#a78bfa'] },
  { id: 'wellness', label: 'Wellness', icon: '🧘', desc: 'Ruhe & Entspannung', colors: ['#2DD4BF', '#22D3EE'], bg: ['#023e8a', '#0077b6', '#0096c7', '#00b4d8', '#48cae4'] },
  { id: 'fitness', label: 'Fitness', icon: '🏋️', desc: 'Training & Kraft', colors: ['#F97316', '#EF4444'], bg: ['#6a040f', '#9d0208', '#d00000', '#dc2f02', '#f48c06'] },
  { id: 'liebe', label: 'Liebe', icon: '❤️', desc: 'Gefühle & Beziehung', colors: ['#EC4899', '#F43F5E'], bg: ['#590d22', '#800f2f', '#a4133c', '#c9184a', '#ff4d6d'] },
]

const MUSIC_LIBRARY = [
  { id: 'none', label: 'Keine', icon: '🔇', url: '' },
  { id: 'epic', label: 'Epic', icon: '🎵', url: 'https://cdn.pixabay.com/audio/2022/10/14/audio_2af9e5748c.mp3' },
  { id: 'calm', label: 'Ruhig', icon: '🎶', url: 'https://cdn.pixabay.com/audio/2022/08/02/audio_884fe92c38.mp3' },
  { id: 'piano', label: 'Piano', icon: '🎹', url: 'https://cdn.pixabay.com/audio/2022/05/27/audio_1808fbf07a.mp3' },
]

function createGradientImage(w, h, colors, index) {
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')

  const angle = (index * 45) * Math.PI / 180
  const x1 = w/2 + Math.cos(angle) * w/2
  const y1 = h/2 + Math.sin(angle) * h/2
  const x2 = w/2 - Math.cos(angle) * w/2
  const y2 = h/2 - Math.sin(angle) * h/2

  const gradient = ctx.createLinearGradient(x1, y1, x2, y2)
  colors.forEach((c, i) => gradient.addColorStop(i / (colors.length - 1), c))
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, w, h)

  const shapeCount = 3 + Math.floor(Math.random() * 4)
  for (let i = 0; i < shapeCount; i++) {
    ctx.beginPath()
    const x = Math.random() * w
    const y = Math.random() * h
    const r = 50 + Math.random() * 200
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fillStyle = `rgba(255,255,255,${0.03 + Math.random() * 0.07})`
    ctx.fill()
  }

  const img = new Image()
  img.src = canvas.toDataURL()
  return img
}

const DEFAULT_SCENES = [
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
  const [activeSceneIndex, setActiveSceneIndex] = useState(0)
  const [bgImages, setBgImages] = useState([])

  const [selectedTemplate, setSelectedTemplate] = useState(null)
  const [selectedMusic, setSelectedMusic] = useState('none')
  const [textColor, setTextColor] = useState('#ffffff')
  const [textPosition, setTextPosition] = useState('center')
  const [fontSize, setFontSize] = useState(60)
  const [bgOpacity, setBgOpacity] = useState(50)
  const [kenBurns, setKenBurns] = useState('zoom-in')

  useEffect(() => {
    if (user) {
      const saved = parseInt(localStorage.getItem(`happiness_video_count_${user.id}`) || '0')
      setVideoCount(saved)
    }
  }, [user])

  const generateVideo = async (templateId) => {
    const template = TEMPLATES.find(t => t.id === templateId)
    if (!template) return
    if (videoCount >= maxFreeVideos) {
      alert(`${maxFreeVideos} kostenlose Videos erreicht. Upgrade auf Premium!`)
      return
    }

    setIsGenerating(true)
    setSelectedTemplate(template)
    setStatus('Bilder erstellen...')

    const images = template.bg.map((_, i) => createGradientImage(1920, 1080, template.bg, i))
    setBgImages(images)

    setStatus('KI generiert Texte...')
    try {
      const response = await fetch('/.netlify/functions/generate-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: template.desc, template: templateId, language: navigator.language.split('-')[0] })
      })
      const data = await response.json()
      const aiScenes = (data.scenes || []).slice(0, 5).map((s, i) => ({
        text1: s.text1 || DEFAULT_SCENES[i]?.text1 || '',
        text2: s.text2 || DEFAULT_SCENES[i]?.text2 || '',
        duration: s.duration || 4
      }))
      while (aiScenes.length < 5) aiScenes.push(DEFAULT_SCENES[aiScenes.length] || { text1: '', text2: '', duration: 4 })
      setScenes(aiScenes)
    } catch {
      setScenes(DEFAULT_SCENES.map(s => ({ ...s })))
    }

    setVideoCount(prev => {
      const n = prev + 1
      if (user) localStorage.setItem(`happiness_video_count_${user.id}`, n.toString())
      return n
    })
    setIsGenerating(false)
    setStatus('Fertig!')
  }

  const drawScene = (idx, animProgress = 1) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    canvas.width = 1920
    canvas.height = 1080

    if (bgImages[idx]) {
      ctx.save()
      if (kenBurns === 'zoom-in') {
        const z = 1 + animProgress * 0.2
        ctx.translate(960, 540)
        ctx.scale(z, z)
        ctx.translate(-960, -540)
      } else if (kenBurns === 'zoom-out') {
        const z = 1.2 - animProgress * 0.2
        ctx.translate(960, 540)
        ctx.scale(z, z)
        ctx.translate(-960, -540)
      } else if (kenBurns === 'pan-left') {
        ctx.translate(-animProgress * 80, 0)
      } else if (kenBurns === 'pan-right') {
        ctx.translate(animProgress * 80, 0)
      }
      ctx.drawImage(bgImages[idx], 0, 0, 1920, 1080)
      ctx.restore()
    } else {
      const g = ctx.createLinearGradient(0, 0, 1920, 1080)
      g.addColorStop(0, selectedTemplate?.colors?.[0] || '#9b59b6')
      g.addColorStop(1, selectedTemplate?.colors?.[1] || '#3498db')
      ctx.fillStyle = g
      ctx.fillRect(0, 0, 1920, 1080)
    }

    ctx.fillStyle = `rgba(0,0,0,${bgOpacity / 100})`
    ctx.fillRect(0, 0, 1920, 1080)

    const y = textPosition === 'top' ? 270 : textPosition === 'bottom' ? 810 : 540
    const scene = scenes[idx]

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

  useEffect(() => {
    if (scenes.length > 0 && bgImages.length > 0 && activeSceneIndex < scenes.length) {
      drawScene(activeSceneIndex, 1)
    }
  }, [activeSceneIndex, scenes, bgImages, textColor, fontSize, bgOpacity, textPosition, selectedTemplate, kenBurns])

  const playPreview = () => {
    if (scenes.length === 0) return
    setIsPlaying(true)

    const music = MUSIC_LIBRARY.find(m => m.id === selectedMusic)
    if (music?.url && audioRef.current) {
      audioRef.current.src = music.url
      audioRef.current.volume = 0.3
      audioRef.current.play().catch(() => {})
    }

    let idx = 0
    const play = (i) => {
      if (i >= scenes.length) {
        setIsPlaying(false)
        audioRef.current?.pause()
        return
      }
      setActiveSceneIndex(i)
      const start = Date.now()
      const dur = (scenes[i].duration || 4) * 1000
      const animate = () => {
        const p = Math.min(1, (Date.now() - start) / dur)
        drawScene(i, p)
        if (p < 1) requestAnimationFrame(animate)
        else play(i + 1)
      }
      animate()
    }
    play(0)
  }

  const stopPreview = () => {
    setIsPlaying(false)
    audioRef.current?.pause()
    audioRef.current && (audioRef.current.currentTime = 0)
  }

  const exportVideo = async () => {
    if (scenes.length === 0) return
    setIsExporting(true)
    setProgress(0)

    try {
      const canvas = canvasRef.current
      const stream = canvas.captureStream(30)
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
        setStatus('Fertig!')
      }
      mr.start()

      for (let i = 0; i < scenes.length; i++) {
        setStatus(`Szene ${i+1}/${scenes.length}`)
        await new Promise(resolve => {
          setActiveSceneIndex(i)
          const start = Date.now()
          const dur = (scenes[i].duration || 4) * 1000
          const animate = () => {
            const p = Math.min(1, (Date.now() - start) / dur)
            drawScene(i, p)
            setProgress(((i + p) / scenes.length) * 100)
            if (p < 1) requestAnimationFrame(animate)
            else resolve()
          }
          animate()
        })
      }
      mr.stop()
    } catch (e) {
      console.error(e)
      setIsExporting(false)
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
          <span>Echte Videos mit Stock-Bildern + Musik</span>
          <span className="video-counter">{remaining}免费 übrig</span>
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

      {scenes.length > 0 && (
        <div className="editor-section">
          <div className="editor-layout">
            <div className="preview-column">
              <div className="video-preview">
                <canvas ref={canvasRef} className="preview-canvas" width={1920} height={1080} />
                <div className="playback-controls">
                  <button className="play-btn" onClick={isPlaying ? stopPreview : playPreview}>
                    {isPlaying ? '⏸️' : '▶️'}
                  </button>
                  <span className="clip-counter">Szene {activeSceneIndex + 1}/{scenes.length}</span>
                </div>
              </div>
              <div className="timeline">
                {scenes.map((s, i) => (
                  <div
                    key={i}
                    className={`timeline-clip ${i === activeSceneIndex ? 'active' : ''}`}
                    onClick={() => { setActiveSceneIndex(i); drawScene(i, 1) }}
                  >
                    <div className="timeline-clip-num">{i + 1}</div>
                    <div className="timeline-clip-text">{s.text1 || `Szene ${i+1}`}</div>
                  </div>
                ))}
              </div>
              <div className="export-row">
                <button className="btn btn-export" onClick={exportVideo} disabled={isExporting}>
                  {isExporting ? `⏳ ${Math.round(progress)}%` : '📥 Video herunterladen (1080p)'}
                </button>
              </div>
            </div>
            <div className="settings-column">
              <div className="settings-panel">
                <h3>Texte</h3>
                {scenes.map((s, i) => (
                  <div key={i} className={`scene-editor ${i === activeSceneIndex ? 'active' : ''}`}>
                    <label>Szene {i+1}</label>
                    <input type="text" placeholder="Haupttext" value={s.text1} onChange={e => updateScene(i, 'text1', e.target.value)} />
                    <input type="text" placeholder="Untertext" value={s.text2} onChange={e => updateScene(i, 'text2', e.target.value)} />
                    <input type="number" min="2" max="10" value={s.duration} onChange={e => updateScene(i, 'duration', parseInt(e.target.value) || 4)} placeholder="Sek" className="duration-input" />
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
                  <select value={textPosition} onChange={e => setTextPosition(e.target.value)}>
                    <option value="top">Oben</option>
                    <option value="center">Mitte</option>
                    <option value="bottom">Unten</option>
                  </select>
                </div>
                <div className="control-group">
                  <label>Bewegung</label>
                  <select value={kenBurns} onChange={e => setKenBurns(e.target.value)}>
                    <option value="zoom-in">Zoom rein</option>
                    <option value="zoom-out">Zoom raus</option>
                    <option value="pan-left">Nach links</option>
                    <option value="pan-right">Nach rechts</option>
                    <option value="none">Statisch</option>
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
          <p>Waehle ein Template oben. Die KI generiert Texte, du siehst echte Bilder mit Bewegung und kannst Musik waehlen.</p>
        </div>
      )}
    </div>
  )
}
