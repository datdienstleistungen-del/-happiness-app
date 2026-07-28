import { useState, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Upload, Film, Copy, Check, ArrowRight, Loader, AlertCircle, FileVideo, Link as LinkIcon } from 'lucide-react'
import { supabase } from '../lib/supabase'
import './VideoScriptPage.css'

const GENRES = [
  { id: 'comedy_prank', emoji: '🎭', label: 'Comedy / Prank', desc: 'Unterhaltung, Pointen, Reaktionen' },
  { id: 'werbevideo_marketing', emoji: '📢', label: 'Werbevideo', desc: 'Marketing, Produkt, Call-to-Action' },
  { id: 'lernvideo_kinder', emoji: '🧒', label: 'Lernvideo (Kinder)', desc: 'Einfach, spielerisch, freundlich' },
  { id: 'lernvideo_erwachsene', emoji: '🎓', label: 'Lernvideo (Erwachsene)', desc: 'Informativ, strukturiert, sachlich' }
]

async function extractFramesFromVideo(videoSrc, maxFrames = 10) {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video')
    video.crossOrigin = 'anonymous'
    video.muted = true
    video.preload = 'auto'

    video.onloadedmetadata = async () => {
      const duration = video.duration
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')

      // Cap at 60 seconds
      const effectiveDuration = Math.min(duration, 60)
      const interval = effectiveDuration / maxFrames

      // Scale down to save bandwidth (max 512px wide)
      const scale = Math.min(1, 512 / (video.videoWidth || 640))
      canvas.width = Math.round((video.videoWidth || 640) * scale)
      canvas.height = Math.round((video.videoHeight || 360) * scale)

      const frames = []

      for (let i = 0; i < maxFrames; i++) {
        const time = i * interval
        try {
          video.currentTime = time
          await new Promise((res, rej) => {
            const timeout = setTimeout(() => rej(new Error('seek timeout')), 3000)
            video.onseeked = () => { clearTimeout(timeout); res() }
          })
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
          const dataUrl = canvas.toDataURL('image/jpeg', 0.7)
          frames.push(dataUrl)
        } catch (e) {
          console.warn('[extractFrames] Frame', i, 'failed:', e.message)
        }
      }

      video.src = ''
      resolve(frames)
    }

    video.onerror = () => reject(new Error('Video konnte nicht geladen werden'))

    if (videoSrc instanceof File) {
      video.src = URL.createObjectURL(videoSrc)
    } else {
      video.src = videoSrc
    }
  })
}

export default function VideoScriptPage() {
  const navigate = useNavigate()
  const fileInputRef = useRef(null)
  const videoRef = useRef(null)

  const [step, setStep] = useState(1)
  const [videoUrl, setVideoUrl] = useState('')
  const [videoFile, setVideoFile] = useState(null)
  const [videoPreview, setVideoPreview] = useState(null)
  const [inputMode, setInputMode] = useState('url')
  const [selectedGenre, setSelectedGenre] = useState(null)
  const [userPremise, setUserPremise] = useState('')
  const [sceneAnalysis, setSceneAnalysis] = useState(null)
  const [generatedScript, setGeneratedScript] = useState('')
  const [scriptId, setScriptId] = useState(null)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState('')
  const [statusText, setStatusText] = useState('')

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setVideoFile(file)
    setVideoPreview(URL.createObjectURL(file))
    setVideoUrl('')
    setError('')
  }

  const handleUrlChange = (val) => {
    setVideoUrl(val)
    setVideoFile(null)
    setVideoPreview(null)
    setError('')
  }

  const handleStartAnalysis = async () => {
    if (!videoUrl && !videoFile) {
      setError('Bitte gib eine Video-URL ein oder lade eine Datei hoch.')
      return
    }
    setStep(3)
    setStatusText('Frames werden extrahiert...')

    try {
      // Step 1: Extract frames in browser
      const source = videoUrl || videoFile
      const frames = await extractFramesFromVideo(source, 10)

      if (frames.length === 0) {
        throw new Error('Keine Frames aus dem Video extrahiert werden.')
      }

      setStatusText(`Video wird analysiert (${frames.length} Frames)...`)

      // Step 2: Send frames to analyze function
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token || ''

      const res = await fetch('/api/analyze-video-scene', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          frames,
          video_filename: videoFile?.name || videoUrl || 'video'
        })
      })

      const data = await res.json()

      if (!res.ok) throw new Error(data.error || 'Analyse fehlgeschlagen')

      setSceneAnalysis(data.scene_analysis)
      setStep(2)
    } catch (e) {
      console.error('[VideoScript] Analysis error:', e.message)
      setError(e.message || 'Fehler bei der Video-Analyse.')
      setStep(1)
    }
  }

  const handleGenerateScript = async () => {
    if (!selectedGenre || !sceneAnalysis) return

    setStep(4)
    setStatusText('Drehbuch wird geschrieben...')
    setError('')

    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token || ''

      const res = await fetch('/api/generate-video-script', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          scene_analysis: sceneAnalysis,
          content_goal: selectedGenre,
          user_premise: userPremise || undefined,
          video_filename: videoFile?.name || 'video'
        })
      })

      const data = await res.json()

      if (!res.ok) throw new Error(data.error || 'Generierung fehlgeschlagen')

      setGeneratedScript(data.script)
      setScriptId(data.script_id)
      setStep(5)
    } catch (e) {
      console.error('[VideoScript] Generation error:', e.message)
      setError(e.message || 'Fehler bei der Drehbuch-Generierung.')
      setStep(2)
    }
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(generatedScript)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    } catch {
      const textarea = document.createElement('textarea')
      textarea.value = generatedScript
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    }
  }

  const handleReset = () => {
    setStep(1)
    setVideoUrl('')
    setVideoFile(null)
    setVideoPreview(null)
    setSelectedGenre(null)
    setUserPremise('')
    setSceneAnalysis(null)
    setGeneratedScript('')
    setScriptId(null)
    setError('')
  }

  return (
    <div className="vsp-page">
      <div className="vsp-header">
        <h1>Video-Drehbuch</h1>
        <p>Lade ein Video hoch und erhalte ein zeitgetaggtes Drehbuch für CapCut EditPilot.</p>
      </div>

      {/* Step indicator */}
      <div className="vsp-steps">
        <div className={`vsp-step ${step >= 1 ? 'active' : ''} ${step > 1 ? 'done' : ''}`}>
          <span>1</span> Video
        </div>
        <div className={`vsp-step ${step >= 2 ? 'active' : ''} ${step > 2 ? 'done' : ''}`}>
          <span>2</span> Genre
        </div>
        <div className={`vsp-step ${step >= 4 ? 'active' : ''} ${step > 4 ? 'done' : ''}`}>
          <span>3</span> Drehbuch
        </div>
      </div>

      {error && (
        <div className="vsp-error">
          <AlertCircle size={16} />
          <span>{error}</span>
          <button onClick={() => setError('')}>×</button>
        </div>
      )}

      {/* STEP 1: Video Input */}
      {step === 1 && (
        <div className="vsp-input-section">
          <div className="vsp-mode-toggle">
            <button
              className={`vsp-mode-btn ${inputMode === 'url' ? 'active' : ''}`}
              onClick={() => setInputMode('url')}
            >
              <LinkIcon size={16} /> URL eingeben
            </button>
            <button
              className={`vsp-mode-btn ${inputMode === 'upload' ? 'active' : ''}`}
              onClick={() => setInputMode('upload')}
            >
              <Upload size={16} /> Datei hochladen
            </button>
          </div>

          {inputMode === 'url' ? (
            <div className="vsp-field">
              <label>Video-URL</label>
              <input
                type="url"
                value={videoUrl}
                onChange={(e) => handleUrlChange(e.target.value)}
                placeholder="https://www.pexels.com/video/..."
              />
              <span className="vsp-hint">Füge eine Video-URL ein (z.B. von Pexels, YouTube oder einem anderen Quelle)</span>
            </div>
          ) : (
            <div
              className="vsp-upload-zone"
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="video/*"
                onChange={handleFileSelect}
                style={{ display: 'none' }}
              />
              {videoPreview ? (
                <div className="vsp-upload-preview">
                  <FileVideo size={32} />
                  <span>{videoFile?.name}</span>
                  <button onClick={(e) => { e.stopPropagation(); setVideoFile(null); setVideoPreview(null); }}>
                    Entfernen
                  </button>
                </div>
              ) : (
                <>
                  <Upload size={40} className="vsp-upload-icon" />
                  <p>Klicke hier, um ein Video auszuwählen</p>
                  <span>MP4, WebM, MOV — max. 60 Sek.</span>
                </>
              )}
            </div>
          )}

          {(videoUrl || videoFile) && (
            <button className="vsp-btn vsp-btn-primary" onClick={handleStartAnalysis}>
              <ArrowRight size={16} /> Video analysieren
            </button>
          )}
        </div>
      )}

      {/* STEP 2: Genre Selection */}
      {step === 2 && sceneAnalysis && (
        <div className="vsp-genre-section">
          <p className="vsp-analysis-ok">
            <Check size={16} /> Video analysiert — {sceneAnalysis.beats?.length || 0} Szenen erkannt
          </p>

          <div className="vsp-genre-grid">
            {GENRES.map(g => (
              <button
                key={g.id}
                className={`vsp-genre-card ${selectedGenre === g.id ? 'active' : ''}`}
                onClick={() => setSelectedGenre(g.id)}
              >
                <span className="vsp-genre-emoji">{g.emoji}</span>
                <strong>{g.label}</strong>
                <span className="vsp-genre-desc">{g.desc}</span>
              </button>
            ))}
          </div>

          <div className="vsp-field">
            <label>Hast du eine bestimmte Idee / Prämisse? (optional)</label>
            <textarea
              value={userPremise}
              onChange={(e) => setUserPremise(e.target.value)}
              placeholder="z.B. 'Es geht um einen Trick, den viele nicht kennen' oder 'Reaktion auf etwas Überraschendes'"
              rows={3}
            />
          </div>

          {selectedGenre && (
            <button className="vsp-btn vsp-btn-primary" onClick={handleGenerateScript}>
              <Film size={16} /> Drehbuch generieren
            </button>
          )}
        </div>
      )}

      {/* STEP 3: Analyzing */}
      {step === 3 && (
        <div className="vsp-loading">
          <Loader size={32} className="vsp-spinner" />
          <p>{statusText}</p>
        </div>
      )}

      {/* STEP 4: Generating */}
      {step === 4 && (
        <div className="vsp-loading">
          <Loader size={32} className="vsp-spinner" />
          <p>{statusText}</p>
        </div>
      )}

      {/* STEP 5: Result */}
      {step === 5 && generatedScript && (
        <div className="vsp-result">
          <div className="vsp-result-header">
            <Check size={20} className="vsp-result-check" />
            <div>
              <h3>Drehbuch fertig</h3>
              <p>Kopiere dieses Drehbuch zusammen mit deinem Video in den EditPilot-Chat von CapCut (unten rechts im Editor).</p>
            </div>
          </div>

          <div className="vsp-script-output">
            <pre>{generatedScript}</pre>
          </div>

          <div className="vsp-result-actions">
            <button className="vsp-btn vsp-btn-copy" onClick={handleCopy}>
              {copied ? <><Check size={16} /> Kopiert!</> : <><Copy size={16} /> In Zwischenablage kopieren</>}
            </button>
            <button className="vsp-btn vsp-btn-secondary" onClick={handleReset}>
              Neues Video
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
