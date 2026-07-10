import { useState, useRef, useEffect } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { getFFmpeg, downloadBlob } from '../lib/ffmpeg'
import { Sparkles, Download, Image as ImageIcon, ArrowLeft, X, Film, Check, CreditCard, Brain, AlertTriangle } from 'lucide-react'
import './TikTokVideoPage.css'

export default function TikTokVideoPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()

  const [text, setText] = useState(location.state?.postText || '')
  const [selectedImage, setSelectedImage] = useState(null)
  const [imagePreview, setImagePreview] = useState(null)
  const [scenes, setScenes] = useState(null)
  const [totalDuration, setTotalDuration] = useState(0)
  const [loading, setLoading] = useState(false)
  const [statusMsg, setStatusMsg] = useState('')
  const [videoBlob, setVideoBlob] = useState(null)
  const [videoUrl, setVideoUrl] = useState(null)
  const [freeVideoUsed, setFreeVideoUsed] = useState(0)
  const [isPremium, setIsPremium] = useState(false)
  const [showPaywall, setShowPaywall] = useState(false)
  const [error, setError] = useState('')
  const FREE_LIMIT = 3

  const fileInputRef = useRef(null)
  const videoRef = useRef(null)

  useEffect(() => {
    loadSettings()
  }, [user])

  useEffect(() => {
    if (searchParams.get('payment') === 'success') {
      setShowPaywall(false)
      setIsPremium(true)
    }
  }, [searchParams])

  useEffect(() => {
    return () => {
      if (videoUrl) URL.revokeObjectURL(videoUrl)
    }
  }, [videoUrl])

  const loadSettings = async () => {
    const { data } = await supabase
      .from('ai_settings')
      .select('is_premium, free_video_used')
      .eq('user_id', user.id)
      .single()
    if (data) {
      setIsPremium(data.is_premium || false)
      setFreeVideoUsed(data.free_video_used || 0)
    }
  }

  const handleImageSelect = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setSelectedImage(file)
    setImagePreview(URL.createObjectURL(file))
  }

  const clearImage = () => {
    setSelectedImage(null)
    if (imagePreview) URL.revokeObjectURL(imagePreview)
    setImagePreview(null)
  }

  const handleCheckout = async () => {
    try {
      const response = await fetch('/api/create-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, email: user.email }),
      })
      const data = await response.json()
      if (data.url) {
        window.location.href = data.url
      }
    } catch (error) {
      console.error('Checkout error:', error)
    }
  }

  const uploadImage = async () => {
    if (!selectedImage) return null
    const ext = selectedImage.name.split('.').pop() || 'jpg'
    const filePath = `tiktok/${user.id}/${Date.now()}.${ext}`
    const { error: uploadError } = await supabase.storage
      .from('community-images')
      .upload(filePath, selectedImage, { contentType: selectedImage.type })
    if (uploadError) {
      console.error('Upload error:', uploadError)
      return null
    }
    const { data: urlData } = supabase.storage
      .from('community-images')
      .getPublicUrl(filePath)
    return urlData.publicUrl
  }

  const loadBackgroundImage = (url) => {
    return new Promise((resolve, reject) => {
      const img = new Image()
      img.crossOrigin = 'anonymous'
      img.onload = () => resolve(img)
      img.onerror = () => reject(new Error('Failed to load image'))
      img.src = url
    })
  }

  const createVideo = async () => {
    if (!text.trim()) return
    if (!isPremium && freeVideoUsed >= FREE_LIMIT) {
      setShowPaywall(true)
      return
    }

    setLoading(true)
    setStatusMsg('Skript wird geschrieben...')
    setError('')
    setVideoBlob(null)
    if (videoUrl) URL.revokeObjectURL(videoUrl)
    setVideoUrl(null)

    try {
      const imageUrl = selectedImage ? await uploadImage() : null

      const token = (await supabase.auth.getSession()).data.session?.access_token
      const res = await fetch('/api/tiktok-video', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ text: text.trim(), imageUrl })
      })

      if (!res.ok) {
        const err = await res.json()
        if (res.status === 402) {
          setShowPaywall(true)
          return
        }
        throw new Error(err.error || 'Fehler bei der Video-Erstellung')
      }

      const data = await res.json()
      setScenes(data.scenes)
      setTotalDuration(data.totalDuration)
      setFreeVideoUsed(prev => prev + 1)

      setStatusMsg('Bilder werden geladen...')
      await renderVideo(data.scenes)
    } catch (err) {
      console.error('Create video error:', err)
      setError(err.message || 'Fehler bei der Video-Erstellung')
    } finally {
      setLoading(false)
    }
  }

  const renderVideo = async (scenes) => {
    const ffmpeg = await getFFmpeg()
    const W = 1080
    const H = 1920
    const FPS = 30

    const bgImages = []
    for (const scene of scenes) {
      if (scene.backgroundUrl) {
        try {
          const img = await loadBackgroundImage(scene.backgroundUrl)
          bgImages.push(img)
        } catch {
          bgImages.push(null)
        }
      } else {
        bgImages.push(null)
      }
    }

    setStatusMsg('Szenen werden gerendert...')

    const canvas = document.createElement('canvas')
    canvas.width = W
    canvas.height = H
    const ctx = canvas.getContext('2d')

    for (let i = 0; i < scenes.length; i++) {
      const scene = scenes[i]
      const { text1, text2, colors } = scene
      const bgImg = bgImages[i]

      if (bgImg) {
        const scale = Math.max(W / bgImg.naturalWidth, H / bgImg.naturalHeight)
        const sw = bgImg.naturalWidth * scale
        const sh = bgImg.naturalHeight * scale
        const sx = (sw - W) / 2
        const sy = (sh - H) / 2
        ctx.drawImage(bgImg, -sx, -sy, sw, sh)
        ctx.fillStyle = 'rgba(0, 0, 0, 0.35)'
        ctx.fillRect(0, 0, W, H)
      } else {
        ctx.fillStyle = colors.bg
        ctx.fillRect(0, 0, W, H)
      }

      const grad = ctx.createLinearGradient(0, H * 0.5, 0, H)
      grad.addColorStop(0, 'rgba(0,0,0,0)')
      grad.addColorStop(1, 'rgba(0,0,0,0.5)')
      ctx.fillStyle = grad
      ctx.fillRect(0, H * 0.5, W, H * 0.5)

      ctx.fillStyle = 'rgba(255,255,255,0.15)'
      ctx.font = '14px sans-serif'
      ctx.textAlign = 'right'
      ctx.textBaseline = 'top'
      ctx.fillText(`${scene.id}/${scenes.length}`, W - 24, 24)

      const fontSize1 = Math.min(72, Math.floor(W / Math.max(text1.length, 3)) * 1.2)
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillStyle = colors.text || '#ffffff'
      ctx.font = `bold ${fontSize1}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif`

      const words = text1.split(' ')
      const textY = H * 0.42
      if (words.length <= 3) {
        ctx.fillText(text1, W / 2, textY)
      } else {
        const mid = Math.ceil(words.length / 2)
        ctx.fillText(words.slice(0, mid).join(' '), W / 2, textY - fontSize1 * 0.6)
        ctx.fillText(words.slice(mid).join(' '), W / 2, textY + fontSize1 * 0.4)
      }

      if (text2) {
        const fontSize2 = Math.min(32, Math.floor(W / Math.max(text2.length, 3)) * 1.5)
        ctx.font = `400 ${fontSize2}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif`
        ctx.globalAlpha = 0.85
        ctx.fillText(text2, W / 2, H * 0.55)
        ctx.globalAlpha = 1
      }

      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'))
      const buffer = await blob.arrayBuffer()
      await ffmpeg.writeFile(`scene_${i}.png`, new Uint8Array(buffer))
    }

    setStatusMsg('Video wird komprimiert...')

    const filterParts = []
    const concatInputs = []
    const inputArgs = []

    scenes.forEach((scene, i) => {
      inputArgs.push('-i', `scene_${i}.png`)
      const frames = Math.round(scene.duration * FPS)
      filterParts.push(`[${i}:v]loop=loop=${frames - 1}:size=1,setpts=PTS-STARTPTS[v${i}]`)
      concatInputs.push(`[v${i}]`)
    })

    const filterComplex = filterParts.join(';') + ';' +
      concatInputs.join('') + `concat=n=${scenes.length}:v=1:a=0[out]`

    const args = [
      ...inputArgs,
      '-filter_complex', filterComplex,
      '-map', '[out]',
      '-r', String(FPS),
      '-c:v', 'libx264',
      '-preset', 'fast',
      '-crf', '23',
      '-pix_fmt', 'yuv420p',
      '-movflags', '+faststart',
      'output.mp4'
    ]

    await ffmpeg.exec(args)

    const data = await ffmpeg.readFile('output.mp4')
    const blob = new Blob([data.buffer], { type: 'video/mp4' })
    setVideoBlob(blob)
    setVideoUrl(URL.createObjectURL(blob))
    setStatusMsg('')

    for (let i = 0; i < scenes.length; i++) {
      await ffmpeg.deleteFile(`scene_${i}.png`).catch(() => {})
    }
    await ffmpeg.deleteFile('output.mp4').catch(() => {})
  }

  const remaining = FREE_LIMIT - freeVideoUsed

  return (
    <div className="tiktok-page">
      <div className="tiktok-header">
        <button className="tiktok-back" onClick={() => navigate(-1)}>
          <ArrowLeft size={20} />
        </button>
        <h1><Film size={22} /> TikTok Video Generator</h1>
      </div>

      <div className="tiktok-usage-bar">
        {isPremium ? (
          <span className="tiktok-usage-premium"><Check size={14} /> Premium — unbegrenzt Videos</span>
        ) : (
          <span className="tiktok-usage-count">Noch {remaining} von {FREE_LIMIT} kostenlosen Videos</span>
        )}
      </div>

      <div className="tiktok-content">
        {!scenes && !showPaywall && (
          <div className="tiktok-input-section">
            <div className="tiktok-input-group">
              <label className="tiktok-label">Beschreib dein Produkt / deine Idee in 2-3 Sätzen</label>
              <textarea
                className="tiktok-textarea"
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="z.B. 'Ich verkaufe handgemachte Kerzen aus Sojawachs. Sie duften nach Vanille und Lavendel und brennen 40 Stunden lang.'"
                rows={4}
                disabled={loading}
              />
            </div>

            <div className="tiktok-input-group">
              <label className="tiktok-label">Optional: Produktbild hochladen</label>
              <div className="tiktok-image-upload">
                {!imagePreview ? (
                  <div className="tiktok-upload-area" onClick={() => fileInputRef.current?.click()}>
                    <ImageIcon size={32} />
                    <span>Bild auswählen</span>
                  </div>
                ) : (
                  <div className="tiktok-image-preview">
                    <img src={imagePreview} alt="Produkt" />
                    <button className="tiktok-image-remove" onClick={clearImage}>
                      <X size={16} />
                    </button>
                  </div>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageSelect}
                  style={{ display: 'none' }}
                />
              </div>
            </div>

            <button
              className="btn btn-primary tiktok-create-btn"
              onClick={createVideo}
              disabled={!text.trim() || loading}
            >
              {loading ? (
                <span className="tiktok-loading-text">{statusMsg}</span>
              ) : (
                <><Sparkles size={18} /> Video erstellen</>
              )}
            </button>

            {error && (
              <div className="tiktok-error">
                <AlertTriangle size={16} /> {error}
              </div>
            )}
          </div>
        )}

        {showPaywall && (
          <div className="tiktok-paywall">
            <div className="tiktok-paywall-card">
              <div className="tiktok-paywall-icon"><Brain size={32} /></div>
              <h2>Kostenloses Kontingent aufgebraucht</h2>
              <p>Du hast alle {FREE_LIMIT} kostenlosen Videos genutzt.</p>
              <p className="tiktok-paywall-sub">Schalte Premium frei für unbegrenzte Videos:</p>
              <div className="tiktok-paywall-price">
                <span className="tiktok-price-amount">4,99 €</span>
                <span className="tiktok-price-period">/ Monat</span>
              </div>
              <button className="tiktok-paywall-btn stripe-btn" onClick={handleCheckout}>
                <CreditCard size={16} /> Jetzt upgraden
              </button>
              <div className="tiktok-paywall-benefits">
                <p><Check size={14} /> Unbegrenzt KI-Content-Feedback</p>
                <p><Check size={14} /> Unbegrenzt TikTok-Videos erstellen</p>
                <p><Check size={14} /> Unbegrenzt AI Chat Fragen</p>
              </div>
              <p className="tiktok-paywall-note">Sicher bezahlen mit Stripe.</p>
            </div>
          </div>
        )}

        {loading && (
          <div className="tiktok-loading">
            <div className="tiktok-spinner" />
            <p>{statusMsg}</p>
          </div>
        )}

        {scenes && !loading && !showPaywall && (
          <div className="tiktok-scenes-preview">
            <h3>Skript: {totalDuration}s Video ({scenes.length} Szenen)</h3>
            <div className="tiktok-scenes-list">
              {scenes.map((scene, i) => (
                <div key={i} className="tiktok-scene-card" style={{ borderLeftColor: scene.colors.accent }}>
                  <span className="tiktok-scene-num">{i + 1}</span>
                  <div className="tiktok-scene-text">
                    <span className="tiktok-scene-text1">{scene.text1}</span>
                    {scene.text2 && <span className="tiktok-scene-text2">{scene.text2}</span>}
                  </div>
                  <span className="tiktok-scene-dur">{scene.duration}s</span>
                  {scene.backgroundUrl && (
                    <img src={scene.backgroundUrl} alt="" className="tiktok-scene-thumb" />
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {videoUrl && !showPaywall && (
          <div className="tiktok-result">
            <h3>Dein Video</h3>
            <div className="tiktok-video-wrapper">
              <video
                ref={videoRef}
                src={videoUrl}
                controls
                playsInline
                className="tiktok-video-player"
              />
            </div>
            <div className="tiktok-result-actions">
              <button className="btn btn-primary" onClick={() => downloadBlob(videoBlob, `tiktok-video-${Date.now()}.mp4`)}>
                <Download size={18} /> Herunterladen
              </button>
              <button className="btn btn-outline" onClick={() => {
                setScenes(null)
                setVideoBlob(null)
                if (videoUrl) URL.revokeObjectURL(videoUrl)
                setVideoUrl(null)
                setError('')
              }}>
                Neues Video erstellen
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
