import { useState, useRef, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { 
  Upload, Film, Copy, Check, ArrowRight, Loader, AlertCircle, FileVideo, 
  Link as LinkIcon, Sparkles, Image as ImageIcon, Trash2, TrendingUp, 
  Users, Zap, MessageSquare, Play, RefreshCw, Layers
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useVideoScript } from '../context/VideoScriptContext'
import AuthModal from '../components/AuthModal'
import { useLanguage } from '../i18n/translations'
import './VideoScriptPage.css'

function getOrCreateVisitorId() {
  let vid = localStorage.getItem('hit_visitor_id')
  if (!vid) {
    vid = 'guest_' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)
    localStorage.setItem('hit_visitor_id', vid)
  }
  return vid
}

const GENRES = [
  { id: 'followup_tiktok_optimizer', emoji: '🚀', label: 'Folge-Video & TikTok Optimizer', desc: 'Demografie- & Algorithmus-Fokus für Part 2' },
  { id: 'comedy_prank', emoji: '🎭', label: 'Comedy / Prank', desc: 'Unterhaltung, Pointen, Reaktionen' },
  { id: 'werbevideo_marketing', emoji: '📢', label: 'Werbevideo', desc: 'Marketing, Produkt, Call-to-Action' },
  { id: 'lernvideo_kinder', emoji: '🧸', label: 'Lernvideo (Kinder)', desc: 'Einfach, spielerisch, freundlich' },
  { id: 'lernvideo_erwachsene', emoji: '🎓', label: 'Lernvideo (Erwachsene)', desc: 'Informativ, strukturiert, sachlich' }
]

const QUICK_PREMISE_SUGGESTIONS = [
  {
    title: '👩‍💼 Frauen 25–45 B2B-Start',
    text: 'Zielgruppe Frauen 25–45: Zeigen, wie man sich mit NeXus als Freelancerin ohne Startkapital und nur mit dem Smartphone ein stabiles B2B-Nebeneinkommen aufbaut.'
  },
  {
    title: '🔥 Viraler Follow-up (Part 2)',
    text: 'Follow-up: Ihr habt Part 1 eskalieren lassen! Hier ist die exakte 3-Schritte-Anleitung, wie NeXus Kaufsignale im Markt scannt und sofort verwertbare Leads liefert.'
  },
  {
    title: '⚡ 30s Live-Beweis / Demo',
    text: 'Live-Beweis: Zeigen, wie man in 30 Sekunden verdeckte Marktchancen (Expansionen, Finanzierungen) findet, bevor die Konkurrenz überhaupt davon weiß.'
  }
]

async function extractFramesFromVideo(videoSrc, maxFrames = 4) {
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
  const { t, lang } = useLanguage()
  const fileInputRef = useRef(null)
  const analyticsInputRef = useRef(null)

  const {
    scriptStep: step, setScriptStep: setStep,
    scriptMode: mode = 'followup_optimizer', setScriptMode: setMode,
    scriptVideoUrl: videoUrl, setScriptVideoUrl: setVideoUrl,
    scriptVideoFile: videoFile, setScriptVideoFile: setVideoFile,
    scriptVideoPreview: videoPreview, setScriptVideoPreview: setVideoPreview,
    scriptAnalyticsImages: analyticsImages = [], setScriptAnalyticsImages: setAnalyticsImages,
    scriptAnalyticsNotes: analyticsNotes = '', setScriptAnalyticsNotes: setAnalyticsNotes,
    scriptInputMode: inputMode, setScriptInputMode: setInputMode,
    scriptSelectedGenre: selectedGenre = 'followup_tiktok_optimizer', setScriptSelectedGenre: setSelectedGenre,
    scriptUserPremise: userPremise, setScriptUserPremise: setUserPremise,
    scriptAdText: adText, setScriptAdText: setAdText,
    scriptSceneAnalysis: sceneAnalysis, setScriptSceneAnalysis: setSceneAnalysis,
    scriptGeneratedScript: generatedScript, setScriptGeneratedScript: setGeneratedScript,
    scriptId, setScriptId,
    scriptHooks: hooks = [], setScriptHooks: setHooks,
    scriptSelectedHook: selectedHook, setScriptSelectedHook: setSelectedHook
  } = useVideoScript()

  const [copied, setCopied] = useState(false)
  const [copiedHookIndex, setCopiedHookIndex] = useState(null)
  const [error, setError] = useState('')
  const [statusText, setStatusText] = useState('')
  const [hooksLoading, setHooksLoading] = useState(false)
  const [authModalOpen, setAuthModalOpen] = useState(false)
  const [pasteNotification, setPasteNotification] = useState('')

  // Global Paste Listener (Ctrl+V anywhere on page)
  useEffect(() => {
    const handleGlobalPaste = (e) => {
      const targetTag = e.target?.tagName?.toLowerCase()
      const isInput = targetTag === 'input' || targetTag === 'textarea'

      const items = e.clipboardData?.items
      if (!items) return

      let hasImage = false
      for (let i = 0; i < items.length; i++) {
        if (items[i].type && items[i].type.indexOf('image') !== -1) {
          hasImage = true
          const file = items[i].getAsFile()
          if (file) {
            const reader = new FileReader()
            reader.onload = (event) => {
              const dataUrl = event.target.result
              setAnalyticsImages(prev => {
                const current = Array.isArray(prev) ? prev : []
                if (current.length >= 5) {
                  setError('Maximal 5 Analytics-Screenshots möglich.')
                  return current
                }
                return [...current, dataUrl]
              })
              setPasteNotification('📸 Screenshot aus der Zwischenablage eingefügt!')
              setTimeout(() => setPasteNotification(''), 3000)
            }
            reader.readAsDataURL(file)
          }
        }
      }

      if (hasImage && !isInput) {
        e.preventDefault()
      }
    }

    window.addEventListener('paste', handleGlobalPaste)
    return () => window.removeEventListener('paste', handleGlobalPaste)
  }, [setAnalyticsImages])

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setVideoFile(file)
    setVideoPreview(URL.createObjectURL(file))
    setVideoUrl('')
    setError('')
  }

  const handleAnalyticsFileSelect = (e) => {
    const files = Array.from(e.target.files || [])
    if (!files.length) return

    files.forEach(file => {
      if (!file.type.startsWith('image/')) return
      const reader = new FileReader()
      reader.onload = (event) => {
        setAnalyticsImages(prev => {
          const current = Array.isArray(prev) ? prev : []
          if (current.length >= 5) return current
          return [...current, event.target.result]
        })
      }
      reader.readAsDataURL(file)
    })
    setError('')
  }

  const handleRemoveAnalyticsImage = (index) => {
    setAnalyticsImages(prev => (prev || []).filter((_, i) => i !== index))
  }

  const handleUrlChange = (val) => {
    setVideoUrl(val)
    setVideoFile(null)
    setVideoPreview(null)
    setError('')
  }

  // 1-Click Complete Pipeline for Follow-up & TikTok Optimization
  const handleGenerateFollowUpScript = async () => {
    if (!videoUrl && !videoFile && (!analyticsImages || analyticsImages.length === 0) && !userPremise) {
      setError('Bitte füge mindestens ein Video, einen Analytics-Screenshot oder deinen Wunsch fürs Folge-Video ein.')
      return
    }

    setStep(5)
    setError('')
    setStatusText('1/3: Video-Frames & Analytics werden analysiert...')

    try {
      let frames = []
      if (videoUrl || videoFile) {
        try {
          const source = videoUrl || videoFile
          frames = await extractFramesFromVideo(source, 3)
        } catch (err) {
          console.warn('[VideoScript] Frame extraction fallback:', err.message)
        }
      }

      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token || ''

      setStatusText('2/3: Zielgruppen- & Algorithmus-Muster werden erkannt...')

      // Step A: Vision & Analytics Analysis
      let analysisResult = { beats: [], analytics_insights: {} }
      if (frames.length > 0 || (analyticsImages && analyticsImages.length > 0)) {
        const analyzeRes = await fetch('/api/analyze-video-scene', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': token ? `Bearer ${token}` : ''
          },
          body: JSON.stringify({
            frames: frames.length > 0 ? frames : undefined,
            analytics_images: analyticsImages && analyticsImages.length > 0 ? analyticsImages : undefined,
            video_filename: videoFile?.name || videoUrl || 'video',
            visitor_id: getOrCreateVisitorId()
          })
        })

        if (analyzeRes.ok) {
          const analyzeData = await analyzeRes.json()
          analysisResult = analyzeData.scene_analysis || analysisResult
          setSceneAnalysis(analysisResult)
        }
      }

      setStatusText('3/3: ByteDance-optimiertes CapCut Master-Drehbuch wird geschrieben...')

      // Step B: Script Generation with Follow-up Strategy
      const scriptRes = await fetch('/api/generate-video-script', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token ? `Bearer ${token}` : ''
        },
        body: JSON.stringify({
          scene_analysis: analysisResult,
          content_goal: 'followup_tiktok_optimizer',
          user_premise: userPremise || 'Folge-Video zu Teil 1 mit Fokus auf hohe Verweildauer und Zielgruppen-Conversion',
          ad_text: analyticsNotes ? `TikTok-Zusatzdaten / Vorgaben: ${analyticsNotes}` : undefined,
          video_filename: videoFile?.name || 'video',
          visitor_id: getOrCreateVisitorId()
        })
      })

      const scriptData = await scriptRes.json()
      if (!scriptRes.ok) {
        throw new Error(scriptData.error || 'Drehbuch-Generierung fehlgeschlagen.')
      }

      setGeneratedScript(scriptData.script)
      setScriptId(scriptData.script_id || null)
      setStep(6)
    } catch (e) {
      console.error('[VideoScript] Follow-up flow error:', e.message)
      setError(e.message || 'Fehler bei der automatischen Generierung.')
      setStep(1)
    }
  }

  // Classic Step-by-Step Flow (For Standard Mode)
  const handleStartAnalysis = async () => {
    if (!videoUrl && !videoFile) {
      setError('Bitte wähle eine Videodatei oder gib eine Video-URL ein.')
      return
    }
    setStep(3)
    setStatusText('Frames werden extrahiert...')

    try {
      const source = videoUrl || videoFile
      const frames = await extractFramesFromVideo(source, 3)

      if (frames.length === 0) {
        throw new Error('Keine Frames aus dem Video extrahiert werden.')
      }

      setStatusText(`Video wird analysiert (${frames.length} Frames)...`)

      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token || ''

      const res = await fetch('/api/analyze-video-scene', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token ? `Bearer ${token}` : ''
        },
        body: JSON.stringify({
          frames,
          analytics_images: analyticsImages.length > 0 ? analyticsImages : undefined,
          video_filename: videoFile?.name || videoUrl || 'video',
          visitor_id: getOrCreateVisitorId()
        })
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Analyse fehlgeschlagen')

      setSceneAnalysis(data.scene_analysis)
      setStep(2)
    } catch (e) {
      console.error('[VideoScript] Analysis error:', e.message)
      setError('Fehler bei der Video-Analyse.')
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
          'Authorization': token ? `Bearer ${token}` : ''
        },
        body: JSON.stringify({
          genre: selectedGenre,
          premise: userPremise || undefined,
          scene_description: sceneAnalysis?.beats?.map(b => b.description).join(' | ') || undefined,
          visitor_id: getOrCreateVisitorId()
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
      setError('Fehler bei der Hook-Generierung.')
      setStep(2)
    } finally {
      setHooksLoading(false)
    }
  }

  const handleCopyHookText = async (hook, index) => {
    const textToCopy = `Hook #${index + 1} (${hook.trigger || ''})
🖼️ Szenen-Bild: ${hook.visual || ''}
💬 Text: ${hook.text || ''}
🔊 Audio: ${hook.audio || ''}`

    try {
      await navigator.clipboard.writeText(textToCopy)
      setCopiedHookIndex(index)
      setTimeout(() => setCopiedHookIndex(null), 2500)
    } catch {
      setCopiedHookIndex(index)
      setTimeout(() => setCopiedHookIndex(null), 2500)
    }
  }

  const handleSelectHookAndContinue = () => {
    if (selectedHook === null) return
    handleGenerateClassicScript(selectedHook)
  }

  const handleGenerateClassicScript = async (hookIdx = selectedHook) => {
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
          'Authorization': token ? `Bearer ${token}` : ''
        },
        body: JSON.stringify({
          scene_analysis: sceneAnalysis,
          content_goal: selectedGenre,
          user_premise: userPremise || undefined,
          ad_text: adText || undefined,
          video_filename: videoFile?.name || 'video',
          selected_hook: hookIdx !== null && hooks[hookIdx] ? hooks[hookIdx] : undefined,
          visitor_id: getOrCreateVisitorId()
        })
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Generierung fehlgeschlagen')

      setGeneratedScript(data.script)
      setScriptId(data.script_id)
      setStep(6)
    } catch (e) {
      console.error('[VideoScript] Generation error:', e.message)
      setError('Fehler bei der Drehbuch-Generierung.')
      setStep(2)
    }
  }

  const handleSaveScriptToDb = async (userId) => {
    if (!generatedScript || !sceneAnalysis) return null

    try {
      const { data, error } = await supabase
        .from('video_scripts')
        .insert({
          user_id: userId,
          video_filename: videoFile?.name || 'video',
          content_goal: selectedGenre,
          scene_analysis: sceneAnalysis,
          generated_script: generatedScript
        })
        .select()

      if (error) throw error
      if (data && data[0]) {
        setScriptId(data[0].id)
        return data[0].id
      }
    } catch (e) {
      console.error('[VideoScript] Error saving script to DB:', e.message)
    }
    return null
  }

  const handleSendToCapCut = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    const user = session?.user

    if (!user) {
      setAuthModalOpen(true)
    } else {
      await handleSaveScriptToDb(user.id)
      navigate('/capcut-studio')
    }
  }

  const handleAuthSuccess = async (authUser) => {
    await handleSaveScriptToDb(authUser.id)
    navigate('/capcut-studio')
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(generatedScript)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    } catch {
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    }
  }

  const handleReset = () => {
    setStep(1)
    setVideoUrl('')
    setVideoFile(null)
    setVideoPreview(null)
    setAnalyticsImages([])
    setAnalyticsNotes('')
    setSelectedGenre('followup_tiktok_optimizer')
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
      {/* Studio Header & Mode Selector */}
      <div className="vsp-header">
        <div className="vsp-badge-tag">⚡ NeXus Video & Algorithm Studio</div>
        <h1>{mode === 'followup_optimizer' ? 'Folge-Video & TikTok-Algorithmus Studio' : 'Klassisches Video-Drehbuch Studio'}</h1>
        <p>
          {mode === 'followup_optimizer' 
            ? 'Packe dein altes Video und TikTok-Analytics rein — NeXus analysiert beides und erstellt das virale Folge-Drehbuch für CapCut.'
            : 'Generiere professionelle Drehbücher und Hooks aus Rohmaterial für CapCut.'}
        </p>

        <div className="vsp-studio-tabs">
          <button 
            className={`vsp-studio-tab ${mode === 'followup_optimizer' ? 'active' : ''}`}
            onClick={() => { setMode('followup_optimizer'); setSelectedGenre('followup_tiktok_optimizer'); }}
          >
            <Sparkles size={16} /> Folge-Video & Analytics Optimizer (Part 2)
          </button>
          <button 
            className={`vsp-studio-tab ${mode === 'standard' ? 'active' : ''}`}
            onClick={() => { setMode('standard'); setSelectedGenre('werbevideo_marketing'); }}
          >
            <Film size={16} /> Klassisches Drehbuch aus Rohmaterial
          </button>
        </div>
      </div>

      {pasteNotification && (
        <div className="vsp-paste-alert">
          <Check size={16} /> {pasteNotification}
        </div>
      )}

      {error && (
        <div className="vsp-error">
          <AlertCircle size={16} />
          <span>{error}</span>
          <button onClick={() => setError('')}>×</button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODE 1: FOLGE-VIDEO & TIKTOK ALGORITHM OPTIMIZER (STEP 1)                */}
      {/* ========================================================================= */}
      {mode === 'followup_optimizer' && step === 1 && (
        <div className="vsp-optimizer-layout">
          {/* Card 1: Altes Video */}
          <div className="vsp-card">
            <div className="vsp-card-head">
              <div className="vsp-card-num">1</div>
              <div>
                <h3>Bisheriges Video einfügen</h3>
                <p>MP4/MOV hochladen oder Video-Link einfügen</p>
              </div>
            </div>

            <div className="vsp-mode-toggle" style={{ marginBottom: '12px' }}>
              <button
                className={`vsp-mode-btn ${inputMode === 'upload' ? 'active' : ''}`}
                onClick={() => setInputMode('upload')}
              >
                <Upload size={14} /> Video-Datei hochladen
              </button>
              <button
                className={`vsp-mode-btn ${inputMode === 'url' ? 'active' : ''}`}
                onClick={() => setInputMode('url')}
              >
                <LinkIcon size={14} /> Video-URL
              </button>
            </div>

            {inputMode === 'url' ? (
              <div className="vsp-field">
                <input
                  type="url"
                  value={videoUrl}
                  onChange={(e) => handleUrlChange(e.target.value)}
                  placeholder="https://... (TikTok oder direkter Video-Link)"
                />
              </div>
            ) : (
              <div
                className="vsp-upload-zone vsp-upload-compact"
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
                    <FileVideo size={28} />
                    <span>{videoFile?.name}</span>
                    <button onClick={(e) => { e.stopPropagation(); setVideoFile(null); setVideoPreview(null); }}>
                      Entfernen
                    </button>
                  </div>
                ) : (
                  <>
                    <Upload size={28} className="vsp-upload-icon" />
                    <p style={{ fontSize: '13px', fontWeight: '600' }}>Video auswählen oder hier ablegen</p>
                    <span>MP4, WebM, MOV</span>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Card 2: TikTok Analytics (Paste anywhere support) */}
          <div className="vsp-card">
            <div className="vsp-card-head">
              <div className="vsp-card-num">2</div>
              <div>
                <h3>TikTok Analytics & Demografie</h3>
                <p>Screenshots der Statistiken per <strong>Strg+V (Paste)</strong> oder Klick einfügen</p>
              </div>
            </div>

            <div 
              className="vsp-analytics-dropzone"
              onClick={() => analyticsInputRef.current?.click()}
            >
              <input
                ref={analyticsInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={handleAnalyticsFileSelect}
                style={{ display: 'none' }}
              />
              <div className="vsp-dropzone-content">
                <ImageIcon size={28} className="vsp-analytics-icon" />
                <p><strong>Screenshot(s) per Strg+V einfügen</strong> oder Datei wählen</p>
                <span>Demografie, Alter/Geschlecht, Views & Retention-Kurve</span>
              </div>
            </div>

            {analyticsImages && analyticsImages.length > 0 && (
              <div className="vsp-analytics-preview-grid">
                {analyticsImages.map((img, idx) => (
                  <div key={idx} className="vsp-analytics-thumb-wrap">
                    <img src={img} alt={`Analytics ${idx + 1}`} className="vsp-analytics-thumb" />
                    <button 
                      className="vsp-thumb-delete" 
                      onClick={(e) => { e.stopPropagation(); handleRemoveAnalyticsImage(idx); }}
                      title="Entfernen"
                    >
                      <Trash2 size={12} />
                    </button>
                    <span className="vsp-thumb-label">Statistik #{idx + 1}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="vsp-field" style={{ marginTop: '12px' }}>
              <label>Zusätzliche Analytics-Notizen (optional)</label>
              <input
                type="text"
                value={analyticsNotes}
                onChange={(e) => setAnalyticsNotes(e.target.value)}
                placeholder="z.B. 72% Frauen 25–34 Jahre, starker Einstieg aber Drop-off bei Sek. 14"
              />
            </div>
          </div>

          {/* Card 3: Ziel / Wunsch fürs Folge-Video */}
          <div className="vsp-card">
            <div className="vsp-card-head">
              <div className="vsp-card-num">3</div>
              <div>
                <h3>Was erwartest du vom Folge-Video?</h3>
                <p>Beschreibe dein Thema, Angebot oder die Kernbotschaft für Part 2</p>
              </div>
            </div>

            <div className="vsp-field">
              <textarea
                value={userPremise}
                onChange={(e) => setUserPremise(e.target.value)}
                placeholder="z.B. Ihr habt das letzte Video eskalieren lassen! Jetzt zeigen wir speziell für Frauen 25–45, wie man mit NeXus als Freelancerin ohne großes Startkapital B2B-Kunden gewinnt und mit dem Smartphone startet..."
                rows={4}
              />
            </div>

            <div className="vsp-preset-chips">
              <span className="vsp-chips-label">💡 Schnell-Vorschläge:</span>
              {QUICK_PREMISE_SUGGESTIONS.map((preset, pIdx) => (
                <button
                  key={pIdx}
                  type="button"
                  className="vsp-chip-btn"
                  onClick={() => setUserPremise(preset.text)}
                >
                  {preset.title}
                </button>
              ))}
            </div>
          </div>

          {/* Card 4: ByteDance Algorithmus Engine Status */}
          <div className="vsp-algorithm-banner">
            <div className="vsp-algo-head">
              <Zap size={20} className="vsp-algo-icon" />
              <strong>Aktive ByteDance / TikTok Algorithmus-Hebel:</strong>
            </div>
            <div className="vsp-algo-grid">
              <div className="vsp-algo-item">
                <TrendingUp size={16} />
                <div>
                  <strong>0–3s Scrollstopper</strong>
                  <span>Aggressiver Hook abgestimmt auf Zielgruppe</span>
                </div>
              </div>
              <div className="vsp-algo-item">
                <Play size={16} />
                <div>
                  <strong>Retention-Curve Booster</strong>
                  <span>Spannungsbogen in Sek. 8–12 gegen Absprünge</span>
                </div>
              </div>
              <div className="vsp-algo-item">
                <MessageSquare size={16} />
                <div>
                  <strong>ByteDance Loop CTA</strong>
                  <span>Kommentar- & Interaktions-Trigger am Ende</span>
                </div>
              </div>
            </div>
          </div>

          {/* Big Action Button */}
          <button 
            className="vsp-btn vsp-btn-primary vsp-btn-hero"
            onClick={handleGenerateFollowUpScript}
          >
            <Sparkles size={18} /> Folge-Drehbuch mit KI & Algorithmus generieren
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODE 2: CLASSIC STEPPING FLOW (FOR STANDARD MODE)                       */}
      {/* ========================================================================= */}
      {mode === 'standard' && (
        <>
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
                  <Upload size={16} /> Video hochladen
                </button>
              </div>

              {inputMode === 'url' ? (
                <div className="vsp-field">
                  <label>Video-URL</label>
                  <input
                    type="url"
                    value={videoUrl}
                    onChange={(e) => handleUrlChange(e.target.value)}
                    placeholder="https://... Video-URL"
                  />
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
                  placeholder="z.B. Es geht um einen Trick, den viele nicht kennen..."
                  rows={3}
                />
              </div>

              <div className="vsp-field">
                <label>Werbung / Call-to-Action (optional)</label>
                <textarea
                  value={adText}
                  onChange={(e) => setAdText(e.target.value)}
                  placeholder="z.B. Besuche www.nexus.de — Starte dein B2B Business"
                  rows={3}
                />
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
                  <div className="vsp-hooks-grid">
                    {hooks.map((hook, i) => (
                      <div
                        key={i}
                        className={`vsp-hook-card ${selectedHook === i ? 'active' : ''}`}
                        onClick={() => setSelectedHook(i)}
                      >
                        <div className="vsp-hook-card-header">
                          <div className="vsp-hook-number">Hook #{i + 1}</div>
                          {selectedHook === i ? (
                            <span className="vsp-indicator-selected"><Check size={12} /> Ausgewählt</span>
                          ) : (
                            <span className="vsp-indicator-unselected">Auswählen</span>
                          )}
                        </div>
                        <div className="vsp-hook-trigger">{hook.trigger}</div>
                        <div className="vsp-hook-visual"><strong>🖼️ Bild:</strong> {hook.visual}</div>
                        <div className="vsp-hook-text"><strong>💬 Text:</strong> {hook.text}</div>
                        <div className="vsp-hook-audio"><strong>🔊 Audio:</strong> {hook.audio}</div>

                        <div className="vsp-hook-card-actions" onClick={(e) => e.stopPropagation()}>
                          <button 
                            className="vsp-btn vsp-btn-secondary" 
                            onClick={(e) => { e.stopPropagation(); handleCopyHookText(hook, i); }}
                          >
                            {copiedHookIndex === i ? <><Check size={14} /> Kopiert</> : <><Copy size={14} /> Hook kopieren</>}
                          </button>
                          <button 
                            className="vsp-btn vsp-btn-primary" 
                            onClick={(e) => { e.stopPropagation(); setSelectedHook(i); handleGenerateClassicScript(i); }}
                          >
                            <Sparkles size={14} /> Drehbuch generieren
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {selectedHook !== null && (
                    <button className="vsp-btn vsp-btn-primary" onClick={handleSelectHookAndContinue} style={{ marginTop: '1.5rem', width: '100%', justifyContent: 'center' }}>
                      <ArrowRight size={16} /> Mit diesem Hook weiter → Drehbuch generieren
                    </button>
                  )}
                </>
              ) : (
                <div className="vsp-loading">
                  <Loader size={32} className="vsp-spinner" />
                  <p>Keine Hooks geladen.</p>
                  <button className="vsp-btn vsp-btn-secondary" onClick={() => setStep(2)}>← Zurück</button>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* ========================================================================= */}
      {/* LOADING STATES (STEPS 4 & 5)                                             */}
      {/* ========================================================================= */}
      {(step === 4 || step === 5) && (
        <div className="vsp-loading-card">
          <Loader size={36} className="vsp-spinner" />
          <h3>KI-Studio arbeitet...</h3>
          <p>{statusText || 'Drehbuch wird geschrieben...'}</p>
          <div className="vsp-progress-bar">
            <div className="vsp-progress-fill"></div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* STEP 6: DREHBUCH & CAPCUT RESULT                                         */}
      {/* ========================================================================= */}
      {step === 6 && generatedScript && (
        <div className="vsp-result">
          <div className="vsp-result-header">
            <Check size={24} className="vsp-result-check" />
            <div>
              <h3>🚀 Dein Algorithmus-optimiertes Drehbuch ist fertig!</h3>
              <p>Szene für Szene mit Visuals, Voiceover, Overlays und ByteDance-Hashtags formatiert.</p>
            </div>
          </div>

          <div className="vsp-script-output">
            <pre>{generatedScript}</pre>
          </div>

          <div className="vsp-result-actions">
            <button 
              className="vsp-btn vsp-btn-primary vsp-btn-large" 
              onClick={handleSendToCapCut}
            >
              <Film size={18} /> An CapCut Studio senden
            </button>
            <div className="vsp-result-secondary-row">
              <button className="vsp-btn vsp-btn-copy" onClick={handleCopy}>
                {copied ? <><Check size={16} /> Drehbuch kopiert!</> : <><Copy size={16} /> Ganzes Drehbuch kopieren</>}
              </button>
              <button className="vsp-btn vsp-btn-secondary" onClick={handleReset}>
                <RefreshCw size={16} /> Neues Drehbuch erstellen
              </button>
            </div>
          </div>
        </div>
      )}

      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        onSuccess={handleAuthSuccess}
        title="Melde dich an, um fortzufahren"
      />
    </div>
  )
}
