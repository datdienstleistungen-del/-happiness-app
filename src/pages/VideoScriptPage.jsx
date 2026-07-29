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

async function extractFramesFromVideo(videoSrc, maxFrames = 6) {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video')
    video.crossOrigin = 'anonymous'
    video.muted = true
    video.preload = 'auto'

    video.onloadedmetadata = async () => {
      const duration = video.duration
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')

      const effectiveDuration = Math.min(duration, 60)
      const interval = effectiveDuration / maxFrames

      const maxW = 256
      const scale = Math.min(1, maxW / (video.videoWidth || 640))
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
          const dataUrl = canvas.toDataURL('image/jpeg', 0.4)
          frames.push(dataUrl)
        } catch (e) {
          console.warn('[extractFrames] Frame', i, 'failed:', e.message)
        }
      }

      video.src = ''
      resolve(frames)
    }

    video.onerror = () => reject(new Error('Video konnte nicht geladen werden. CORS-Beschränkungen möglich.'))

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
  const [adText, setAdText] = useState('')
  const [sceneAnalysis, setSceneAnalysis] = useState(null)
  const [generatedScript, setGeneratedScript] = useState('')
  const [scriptId, setScriptId] = useState(null)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState('')
  const [statusText, setStatusText] = useState('')
  const [hooks, setHooks] = useState([])
  const [selectedHook, setSelectedHook] = useState(null)
  const [hooksLoading, setHooksLoading] = useState(false)

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
      const frames = await extractFramesFromVideo(source, 3)

      if (frames.length === 0) {
        throw new Error('Keine Frames aus dem Video extrahiert werden.')
      }

      const totalSize = frames.reduce((sum, f) => sum + f.length, 0)
      console.log(`[VideoScript] ${frames.length} frames, total: ${(totalSize / 1024 / 1024).toFixed(1)}MB, each: ${(totalSize / frames.length / 1024).toFixed(0)}KB`)
      console.log('[VideoScript] Frame 0 preview:', frames[0]?.substring(0, 80))

      if (totalSize > 4 * 1024 * 1024) {
        throw new Error('Video ist zu groß für die automatische Analyse. Bitte versuche ein kürzeres Video (< 30 Sek.).')
      }

      setStatusText(`Video wird analysiert (${frames.length} Frames)...`)

      // Step 2: Send frames to analyze function
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token || ''
      console.log('[VideoScript] Auth token present:', !!token)

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

      console.log('[VideoScript] API response:', res.status, JSON.stringify(data).substring(0, 500))

      if (!res.ok) {
        const detail = data.details ? `\n${data.details}` : ''
        throw new Error((data.error || 'Analyse fehlgeschlagen') + detail)
      }
      setSceneAnalysis(data.scene_analysis)
      setStep(2)
    } catch (e) {
      console.error('[VideoScript] Analysis error:', e.message)
      setError(e.message || 'Fehler bei der Video-Analyse.')
      setStep(1)
    }
  }

  const handleGenerateHooks = async () => {
    if (!selectedGenre) return

    setStep(3)
    setStatusText('Hooks werden generiert...')
    setError('')
    setHooks([])
    setSelectedHook(null)
    setHooksLoading(true)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token || ''

      const res = await fetch('/api/generate-hooks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          genre: selectedGenre,
          premise: userPremise || undefined,
          scene_description: sceneAnalysis?.beats?.map(b => b.description).join(' | ') || undefined
        })
      })

      const data = await res.json()

      if (!res.ok) throw new Error(data.error || 'Hook-Generierung fehlgeschlagen')

      if (data.hooks && data.hooks.length > 0) {
        setHooks(data.hooks)
      } else {
        throw new Error(data.error || 'Keine Hooks generiert')
      }
    } catch (e) {
      console.error('[VideoScript] Hook generation error:', e.message)
      setError(e.message || 'Fehler bei der Hook-Generierung.')
      setStep(2)
    } finally {
      setHooksLoading(false)
    }
  }

  const handleSelectHookAndContinue = () => {
    if (!selectedHook) return
    handleGenerateScript()
  }

  const handleGenerateScript = async () => {
    if (!selectedGenre || !sceneAnalysis) return

    setStep(5)
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
          ad_text: adText || undefined,
          video_filename: videoFile?.name || 'video',
          selected_hook: selectedHook || undefined
        })
      })

      const data = await res.json()

      if (!res.ok) throw new Error(data.error || 'Generierung fehlgeschlagen')

      setGeneratedScript(data.script)
      setScriptId(data.script_id)
      setStep(6)
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
    setAdText('')
    setSceneAnalysis(null)
    setGeneratedScript('')
    setScriptId(null)
    setError('')
    setHooks([])
    setSelectedHook(null)
    setHooksLoading(false)
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
        <div className={`vsp-step ${step >= 3 ? 'active' : ''} ${step > 3 ? 'done' : ''}`}>
          <span>3</span> Hook
        </div>
        <div className={`vsp-step ${step >= 5 ? 'active' : ''} ${step > 5 ? 'done' : ''}`}>
          <span>4</span> Drehbuch
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

          <div className="vsp-field">
            <label>Werbung / Call-to-Action (optional)</label>
            <textarea
              value={adText}
              onChange={(e) => setAdText(e.target.value)}
              placeholder="z.B. 'Besuche uns unter www.beispiel.de — 20% Rabatt mit Code HAPPY20' oder 'Lade jetzt die App herunter'"
              rows={3}
            />
            <span className="vsp-hint">Dieser Text wird 1:1 im Drehbuch verwendet (als TTS-Stimme oder Text-Overlay)</span>
          </div>

          {selectedGenre && (
            <button className="vsp-btn vsp-btn-primary" onClick={handleGenerateHooks}>
              <Film size={16} /> Hooks generieren
            </button>
          )}
        </div>
      )}

      {/* STEP 3: Hook Selection */}
      {step === 3 && (
        <div className="vsp-hooks-section">
          {hooksLoading ? (
            <div className="vsp-loading">
              <Loader size={32} className="vsp-spinner" />
              <p>{statusText}</p>
            </div>
          ) : hooks.length > 0 ? (
            <>
              <h3>Wähle deinen Hook (Sekunde 0:00-0:01)</h3>
              <p className="vsp-hooks-hint">Der Hook entscheidet ob Zuschauer wegwischen oder bleiben. Wähle den stärksten.</p>

              <div className="vsp-hooks-grid">
                {hooks.map((hook, i) => (
                  <button
                    key={i}
                    className={`vsp-hook-card ${selectedHook === i ? 'active' : ''}`}
                    onClick={() => setSelectedHook(i)}
                  >
                    <div className="vsp-hook-number">#{i + 1}</div>
                    <div className="vsp-hook-trigger">{hook.trigger}</div>
                    <div className="vsp-hook-visual">
                      <strong>👁️ Szenen-Bild:</strong> {hook.visual}
                    </div>
                    <div className="vsp-hook-text">
                      <strong>📝 Text:</strong> {hook.text}
                    </div>
                    <div className="vsp-hook-audio">
                      <strong>🔊 Audio:</strong> {hook.audio}
                    </div>
                  </button>
                ))}
              </div>

              {selectedHook !== null && (
                <button className="vsp-btn vsp-btn-primary" onClick={handleSelectHookAndContinue} style={{ marginTop: '1.5rem' }}>
                  <ArrowRight size={16} /> Mit diesem Hook weiter → Drehbuch generieren
                </button>
              )}
            </>
          ) : (
            <div className="vsp-loading">
              <Loader size={32} className="vsp-spinner" />
              <p>Keine Hooks geladen. Versuche es erneut.</p>
              <button className="vsp-btn vsp-btn-secondary" onClick={() => setStep(2)}>← Zurück</button>
            </div>
          )}
        </div>
      )}

      {/* STEP 4: Analyzing */}
      {step === 4 && (
        <div className="vsp-loading">
          <Loader size={32} className="vsp-spinner" />
          <p>{statusText}</p>
        </div>
      )}

      {/* STEP 5: Generating */}
      {step === 5 && (
        <div className="vsp-loading">
          <Loader size={32} className="vsp-spinner" />
          <p>{statusText}</p>
        </div>
      )}

      {/* STEP 6: Result */}
      {step === 6 && generatedScript && (
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
