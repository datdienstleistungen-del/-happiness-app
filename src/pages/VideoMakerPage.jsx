import { useState, useRef, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { useLanguage } from '../i18n/translations'
import './VideoMakerPage.css'

export default function VideoMakerPage() {
  const { t } = useLanguage()
  const { user } = useAuth()
  const canvasRef = useRef(null)
  const [isRecording, setIsRecording] = useState(false)
  const [progress, setProgress] = useState(0)
  const [status, setStatus] = useState('Bereit')
  const [scenes, setScenes] = useState([
    { id: 1, text1: 'Willkommen', text2: 'bei Happiness', duration: 3 },
    { id: 2, text1: 'Dein Video', text2: 'wartet auf dich', duration: 3 }
  ])
  const [bgColor, setBgColor] = useState('#0f0f23')
  const [textColor, setTextColor] = useState('#ffffff')
  const [accentColor, setAccentColor] = useState('#9b59b6')

  const [aiPrompt, setAiPrompt] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [videoCount, setVideoCount] = useState(0)
  const maxFreeVideos = 20

  useEffect(() => {
    if (user) {
      const key = `happiness_video_count_${user.id}`
      const saved = parseInt(localStorage.getItem(key) || '0')
      setVideoCount(saved)
    }
  }, [user])

  const templates = [
    { id: 'motivation', label: 'Motivation', icon: '💪', desc: 'Kraftvolle Sprüche für deinen Tag' },
    { id: 'dankbarkeit', label: 'Dankbarkeit', icon: '🙏', desc: 'Wertschätzung für das Leben' },
    { id: 'affirmation', label: 'Affirmationen', icon: '✨', desc: 'Positive Gedanken verstärken' },
    { id: null, label: 'Frei', icon: '✍️', desc: 'Eigenes Thema eingeben' }
  ]

  const generateVideo = async (template = null) => {
    const prompt = template ? template : aiPrompt
    if (!template && !aiPrompt.trim()) return

    if (videoCount >= maxFreeVideos) {
      alert(`Du hast ${maxFreeVideos} kostenlose Videos erreicht. Upgrade auf Premium für unbegrenzte Videos!`)
      return
    }

    setIsGenerating(true)
    try {
      const response = await fetch('/.netlify/functions/generate-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: aiPrompt,
          template: template,
          language: navigator.language.startsWith('de') ? 'de' : 'en'
        })
      })

      if (!response.ok) throw new Error('Generation failed')

      const data = await response.json()

      if (data.scenes && data.scenes.length > 0) {
        setScenes(data.scenes)
        setVideoCount(prev => {
          const newCount = prev + 1
          if (user) localStorage.setItem(`happiness_video_count_${user.id}`, newCount.toString())
          return newCount
        })
      }
    } catch (error) {
      console.error('AI generation error:', error)
      alert('Fehler bei der Generierung. Bitte versuche es erneut.')
    } finally {
      setIsGenerating(false)
    }
  }

  const drawScene = (scene, progress) => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')

    ctx.fillStyle = bgColor
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    ctx.fillStyle = textColor
    ctx.textAlign = 'center'

    const scale = 0.5 + (progress * 0.5)
    const alpha = Math.min(1, progress * 2)

    ctx.globalAlpha = alpha

    ctx.font = `bold ${80 * scale}px 'Segoe UI', sans-serif`
    ctx.fillText(scene.text1, canvas.width / 2, canvas.height / 2 - 50)

    ctx.font = `${60 * scale}px 'Segoe UI', sans-serif`
    ctx.fillText(scene.text2, canvas.width / 2, canvas.height / 2 + 50)

    ctx.globalAlpha = 1

    ctx.fillStyle = accentColor
    ctx.font = 'bold 40px Segoe UI, sans-serif'
    ctx.fillText('Happiness', canvas.width / 2, canvas.height - 100)
  }

  useEffect(() => {
    if (scenes.length > 0) drawScene(scenes[0], 1)
  }, [scenes, bgColor, textColor, accentColor])

  const addScene = () => {
    const newId = Math.max(...scenes.map(s => s.id), 0) + 1
    setScenes([...scenes, { id: newId, text1: '', text2: '', duration: 3 }])
  }

  const deleteScene = (id) => {
    setScenes(scenes.filter(s => s.id !== id))
  }

  const updateScene = (id, field, value) => {
    setScenes(scenes.map(s => s.id === id ? { ...s, [field]: value } : s))
  }

  const animateScene = (scene, duration) => {
    return new Promise((resolve) => {
      const startTime = Date.now()
      const animate = () => {
        const elapsed = Date.now() - startTime
        const progress = Math.min(1, elapsed / (duration * 1000))
        drawScene(scene, progress)
        const sceneIndex = scenes.findIndex(s => s.id === scene.id)
        const overallProgress = ((sceneIndex + progress) / scenes.length) * 100
        setProgress(overallProgress)
        if (progress < 1) requestAnimationFrame(animate)
        else resolve()
      }
      animate()
    })
  }

  const startRecording = async () => {
    if (scenes.length === 0) {
      alert('Bitte mindestens eine Szene hinzufügen!')
      return
    }

    setIsRecording(true)
    setStatus(t('videoMaker.recording'))

    const canvas = canvasRef.current
    const stream = canvas.captureStream(30)
    const mediaRecorder = new MediaRecorder(stream, { mimeType: 'video/webm' })
    const recordedChunks = []

    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) recordedChunks.push(event.data)
    }

    mediaRecorder.onstop = () => {
      const blob = new Blob(recordedChunks, { type: 'video/webm' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'happiness-video.webm'
      a.click()
      URL.revokeObjectURL(url)
      setStatus(t('videoMaker.saved'))
      setProgress(100)
      setIsRecording(false)
    }

    mediaRecorder.start()
    for (let i = 0; i < scenes.length; i++) {
      setStatus(`${t('videoMaker.scene')} ${i + 1} ${t('videoMaker.sceneOf')} ${scenes.length}`)
      await animateScene(scenes[i], scenes[i].duration)
    }
    mediaRecorder.stop()
  }

  const remaining = maxFreeVideos - videoCount

  return (
    <div className="video-maker-page">
      <h1>🎬 {t('videoMaker.title')}</h1>

      <div className="ai-section">
        <div className="ai-header">
          <span className="ai-badge">KI</span>
          <span>Video mit KI generieren</span>
          <span className="video-counter">{remaining} kostenlose Videos übrig</span>
        </div>

        <div className="template-grid">
          {templates.map(tmpl => (
            <button
              key={tmpl.id || 'free'}
              className={`template-card ${isGenerating ? 'disabled' : ''}`}
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
            placeholder="Oder gib ein Thema ein... z.B. 'Mach mich stark für morgen'"
            value={aiPrompt}
            onChange={(e) => setAiPrompt(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !isGenerating && generateVideo(null)}
            disabled={isGenerating}
          />
          <button
            className="btn btn-ai-generate"
            onClick={() => generateVideo(null)}
            disabled={isGenerating || !aiPrompt.trim()}
          >
            {isGenerating ? '⏳ Generiere...' : '✨ Generieren'}
          </button>
        </div>
      </div>

      <div className="video-maker-container">
        <div className="preview-section">
          <h3>{t('videoMaker.preview')}</h3>
          <canvas
            ref={canvasRef}
            width={1080}
            height={1920}
            className="video-canvas"
          />
        </div>

        <div className="controls-section">
          <div className="color-row">
            <div className="control-group">
              <label>{t('videoMaker.bgColor')}</label>
              <input type="color" value={bgColor} onChange={(e) => setBgColor(e.target.value)} />
            </div>
            <div className="control-group">
              <label>{t('videoMaker.textColor')}</label>
              <input type="color" value={textColor} onChange={(e) => setTextColor(e.target.value)} />
            </div>
            <div className="control-group">
              <label>{t('videoMaker.accentColor')}</label>
              <input type="color" value={accentColor} onChange={(e) => setAccentColor(e.target.value)} />
            </div>
          </div>

          <div className="action-buttons">
            <button className="btn btn-primary" onClick={addScene}>
              {t('videoMaker.addScene')}
            </button>
            <button className="btn btn-success" onClick={startRecording} disabled={isRecording}>
              {isRecording ? t('videoMaker.recording') : t('videoMaker.record')}
            </button>
          </div>

          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${progress}%` }} />
          </div>
          <div className="status-text">{status}</div>
        </div>
      </div>

      <div className="scenes-section">
        <h3>Szenen ({scenes.length})</h3>
        {scenes.map((scene, index) => (
          <div key={scene.id} className="scene-card">
            <div className="scene-header">
              <span className="scene-number">{t('videoMaker.scene')} {index + 1}</span>
              <button className="btn-delete" onClick={() => deleteScene(scene.id)}>🗑️</button>
            </div>
            <div className="scene-inputs">
              <input
                type="text"
                placeholder="Text Zeile 1"
                value={scene.text1}
                onChange={(e) => updateScene(scene.id, 'text1', e.target.value)}
              />
              <input
                type="text"
                placeholder="Text Zeile 2"
                value={scene.text2}
                onChange={(e) => updateScene(scene.id, 'text2', e.target.value)}
              />
              <input
                type="number"
                placeholder={t('videoMaker.duration')}
                value={scene.duration}
                min="1"
                max="10"
                onChange={(e) => updateScene(scene.id, 'duration', parseInt(e.target.value) || 3)}
                className="duration-input"
              />
            </div>
          </div>
        ))}
      </div>

      <div className="tips-section">
        <h3>{t('videoMaker.tips')}</h3>
        <ul>
          <li>{t('videoMaker.tip1')}</li>
          <li>{t('videoMaker.tip2')}</li>
          <li>{t('videoMaker.tip3')}</li>
          <li>{t('videoMaker.tip4')}</li>
        </ul>
      </div>
    </div>
  )
}
