import { useState, useRef, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { useLanguage } from '../i18n/translations'
import './VideoMakerPage.css'

const TEMPLATES = [
  { id: 'motivation', label: 'Motivation', icon: '💪', desc: 'Kraftvolle Sprueche', colors: ['#FF6B6B', '#FF8E53'] },
  { id: 'dankbarkeit', label: 'Dankbarkeit', icon: '🙏', desc: 'Wertschaetzung', colors: ['#4ECDC4', '#44CF6C'] },
  { id: 'affirmation', label: 'Affirmationen', icon: '✨', desc: 'Positive Gedanken', colors: ['#A78BFA', '#818CF8'] },
  { id: 'wellness', label: 'Wellness', icon: '🧘', desc: 'Ruhe & Entspannung', colors: ['#2DD4BF', '#22D3EE'] },
  { id: 'fitness', label: 'Fitness', icon: '🏋️', desc: 'Training & Kraft', colors: ['#F97316', '#EF4444'] },
  { id: 'liebe', label: 'Liebe', icon: '❤️', desc: 'Gefuehle', colors: ['#EC4899', '#F43F5E'] },
]

const MUSIC_URLS = {
  epic: 'https://cdn.pixabay.com/audio/2022/10/14/audio_2af9e5748c.mp3',
  calm: 'https://cdn.pixabay.com/audio/2022/08/02/audio_884fe92c38.mp3',
  piano: 'https://cdn.pixabay.com/audio/2022/05/27/audio_1808fbf07a.mp3',
}

const SCENE_TEXTS = {
  motivation: [
    { t1: 'Du bist', t2: 'staerker als du denkst' },
    { t1: 'Jeder Tag', t2: 'ist eine neue Chance' },
    { t1: 'Glaube an', t2: 'dich selbst' },
    { t1: 'Deine Zeit', t2: 'ist jetzt' },
    { t1: 'Los gehts', t2: 'Happiness' },
  ],
  dankbarkeit: [
    { t1: 'Sei dankbar', t2: 'fuer das was du hast' },
    { t1: 'Jeder Moment', t2: 'ist ein Geschenk' },
    { t1: 'Kleines Glueck', t2: 'grosser Unterschied' },
    { t1: 'Danke', t2: 'fuer diesen Tag' },
    { t1: 'Happiness', t2: 'Dankbarkeit' },
  ],
  affirmation: [
    { t1: 'Ich bin', t2: 'genug so wie ich bin' },
    { t1: 'Ich verdiene', t2: 'Glueck und Erfolg' },
    { t1: 'Ich waechse', t2: 'jeden Tag' },
    { t1: 'Ich bin', t2: 'mein bestes Ich' },
    { t1: 'Happiness', t2: 'Affirmationen' },
  ],
  wellness: [
    { t1: 'Atme tief', t2: 'ein und aus' },
    { t1: 'Lass los', t2: 'was dich belastet' },
    { t1: 'Ruhe', t2: 'kommt von innen' },
    { t1: 'Dein Körper', t2: 'dankt es dir' },
    { t1: 'Happiness', t2: 'Wellness' },
  ],
  fitness: [
    { t1: 'Staerke', t2: 'kommt von innen' },
    { t1: 'Jeder Tropfen', t2: 'Schweiss zaehlt' },
    { t1: 'Gib alles', t2: 'heute' },
    { t1: 'Du bist', t2: 'unbesiegbar' },
    { t1: 'Happiness', t2: 'Fitness' },
  ],
  liebe: [
    { t1: 'Liebe', t2: 'ist die groesste Kraft' },
    { t1: 'Oeffne dein Herz', t2: 'fuer andere' },
    { t1: 'Gemeinsam', t2: 'sind wir staerker' },
    { t1: 'Du bist', t2: 'geliebt' },
    { t1: 'Happiness', t2: 'Liebe' },
  ],
}

function generateGradient(seed) {
  const palettes = [
    ['#667eea', '#764ba2'], ['#f093fb', '#f5576c'], ['#4facfe', '#00f2fe'],
    ['#43e97b', '#38f9d7'], ['#fa709a', '#fee140'], ['#a18cd1', '#fbc2eb'],
    ['#ffecd2', '#fcb69f'], ['#ff9a9e', '#fecfef'], ['#a1c4fd', '#c2e9fb'],
    ['#d4fc79', '#96e6a1'], ['#84fab0', '#8fd3f4'], ['#cfd9df', '#e2ebf0'],
  ]
  const p = palettes[seed % palettes.length]
  return `linear-gradient(135deg, ${p[0]}, ${p[1]})`
}

export default function VideoMakerPage() {
  const { t } = useLanguage()
  const { user } = useAuth()
  const audioRef = useRef(null)
  const canvasRef = useRef(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [progress, setProgress] = useState(0)
  const [status, setStatus] = useState('Bereit')
  const [videoCount, setVideoCount] = useState(0)
  const maxFreeVideos = 20

  const [scenes, setScenes] = useState([])
  const [activeScene, setActiveScene] = useState(0)
  const [selectedTemplate, setSelectedTemplate] = useState(null)
  const [selectedMusic, setSelectedMusic] = useState('none')
  const [textColor, setTextColor] = useState('#ffffff')
  const [fontSize, setFontSize] = useState(48)

  useEffect(() => {
    if (user) {
      const saved = parseInt(localStorage.getItem(`happiness_video_count_${user.id}`) || '0')
      setVideoCount(saved)
    }
  }, [user])

  const generateVideo = (templateId) => {
    const tmpl = TEMPLATES.find(t => t.id === templateId)
    if (!tmpl) return
    if (videoCount >= maxFreeVideos) {
      alert(`${maxFreeVideos} Videos erreicht. Upgrade!`)
      return
    }

    setIsGenerating(true)
    setSelectedTemplate(tmpl)

    setTimeout(() => {
      const texts = SCENE_TEXTS[templateId] || SCENE_TEXTS.motivation
      setScenes(texts.map((s, i) => ({
        ...s,
        gradient: generateGradient(i + templateId.length),
        duration: 4
      })))
      setVideoCount(prev => {
        const n = prev + 1
        if (user) localStorage.setItem(`happiness_video_count_${user.id}`, n.toString())
        return n
      })
      setIsGenerating(false)
    }, 500)
  }

  const playPreview = () => {
    if (scenes.length === 0) return
    setIsPlaying(true)

    if (selectedMusic !== 'none' && MUSIC_URLS[selectedMusic] && audioRef.current) {
      audioRef.current.src = MUSIC_URLS[selectedMusic]
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
      setActiveScene(i)
      setTimeout(() => play(i + 1), scenes[i].duration * 1000)
    }
    play(0)
  }

  const stopPreview = () => {
    setIsPlaying(false)
    audioRef.current?.pause()
    if (audioRef.current) audioRef.current.currentTime = 0
  }

  const exportVideo = async () => {
    if (scenes.length === 0) return
    setIsExporting(true)
    setProgress(0)

    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    canvas.width = 1080
    canvas.height = 1920

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
    }

    if (selectedMusic !== 'none' && MUSIC_URLS[selectedMusic] && audioRef.current) {
      audioRef.current.src = MUSIC_URLS[selectedMusic]
      audioRef.current.volume = 0.3
      audioRef.current.play().catch(() => {})
    }

    mr.start()

    for (let i = 0; i < scenes.length; i++) {
      setStatus(`Szene ${i+1}/${scenes.length}`)
      setActiveScene(i)
      await new Promise(resolve => {
        const start = Date.now()
        const dur = scenes[i].duration * 1000
        const animate = () => {
          const elapsed = Date.now() - start
          const p = Math.min(1, elapsed / dur)
          setProgress(((i + p) / scenes.length) * 100)

          const w = canvas.width
          const h = canvas.height

          const grad = ctx.createLinearGradient(0, 0, w, h)
          const colors = scenes[i].gradient.match(/#[a-f0-9]+/gi) || ['#9b59b6', '#3498db']
          grad.addColorStop(0, colors[0])
          grad.addColorStop(1, colors[1])
          ctx.fillStyle = grad
          ctx.fillRect(0, 0, w, h)

          ctx.fillStyle = 'rgba(0,0,0,0.4)'
          ctx.fillRect(0, 0, w, h)

          ctx.textAlign = 'center'
          ctx.shadowColor = 'rgba(0,0,0,0.9)'
          ctx.shadowBlur = 20

          ctx.fillStyle = textColor
          ctx.font = `bold ${fontSize * 2}px Arial`
          ctx.fillText(scenes[i].t1, w/2, h/2 - fontSize)

          ctx.font = `${fontSize * 1.2}px Arial`
          ctx.fillText(scenes[i].t2, w/2, h/2 + fontSize * 1.5)

          ctx.shadowBlur = 0
          ctx.fillStyle = selectedTemplate?.colors?.[0] || '#9b59b6'
          ctx.font = `bold ${fontSize}px Arial`
          ctx.fillText('Happiness', w/2, h - 120)

          if (p < 1) requestAnimationFrame(animate)
          else resolve()
        }
        animate()
      })
    }
    mr.stop()
    audioRef.current?.pause()
  }

  const remaining = maxFreeVideos - videoCount

  return (
    <div className="video-maker-page">
      <audio ref={audioRef} loop preload="auto" />
      <canvas ref={canvasRef} style={{ display: 'none' }} />

      <h1>🎬 Video Creator</h1>

      <div className="ai-section">
        <div className="ai-header">
          <span className="ai-badge">KI</span>
          <span>Erstelle echte Social-Media Videos</span>
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

      {scenes.length > 0 && (
        <div className="editor-section">
          <div className="editor-layout">
            <div className="preview-column">
              <div className="video-preview">
                {scenes.map((scene, i) => (
                  <div
                    key={i}
                    className={`preview-slide ${i === activeScene ? 'active' : ''}`}
                    style={{ background: scene.gradient }}
                  >
                    <div className="slide-overlay" />
                    <div className="slide-content">
                      <div className="slide-text1" style={{ color: textColor, fontSize: `${fontSize * 0.8}px` }}>
                        {scene.t1}
                      </div>
                      <div className="slide-text2" style={{ color: textColor, fontSize: `${fontSize * 0.5}px` }}>
                        {scene.t2}
                      </div>
                      <div className="slide-brand" style={{ color: selectedTemplate?.colors?.[0] }}>
                        Happiness
                      </div>
                    </div>
                  </div>
                ))}
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
                    style={{ background: s.gradient }}
                  >
                    <div className="timeline-clip-num">{i + 1}</div>
                    <div className="timeline-clip-text">{s.t1}</div>
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
                <h3>Design</h3>
                <div className="control-group">
                  <label>Textfarbe</label>
                  <input type="color" value={textColor} onChange={e => setTextColor(e.target.value)} />
                </div>
                <div className="control-group">
                  <label>Schriftgroesse</label>
                  <input type="range" min="24" max="72" value={fontSize} onChange={e => setFontSize(+e.target.value)} />
                </div>
                <h3>Musik</h3>
                <div className="music-grid">
                  <button className={`music-card ${selectedMusic === 'none' ? 'active' : ''}`} onClick={() => setSelectedMusic('none')}>🔇 Keine</button>
                  <button className={`music-card ${selectedMusic === 'epic' ? 'active' : ''}`} onClick={() => setSelectedMusic('epic')}>🎵 Epic</button>
                  <button className={`music-card ${selectedMusic === 'calm' ? 'active' : ''}`} onClick={() => setSelectedMusic('calm')}>🎶 Ruhig</button>
                  <button className={`music-card ${selectedMusic === 'piano' ? 'active' : ''}`} onClick={() => setSelectedMusic('piano')}>🎹 Piano</button>
                </div>
              </div>
            </div>
          </div>

          {isGenerating && (
            <div className="generating-overlay">
              <div className="generating-spinner" />
              <p>Video wird erstellt...</p>
            </div>
          )}
        </div>
      )}

      {scenes.length === 0 && !isGenerating && (
        <div className="empty-state">
          <div className="empty-icon">🎬</div>
          <h2>Erstelle echte Videos</h2>
          <p>Waehle ein Template oben und dein Video wird automatisch erstellt.<br/>5 Szenen mit professionellem Design.</p>
        </div>
      )}
    </div>
  )
}
