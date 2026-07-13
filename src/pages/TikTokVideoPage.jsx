import { useState, useRef, useEffect } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { getFFmpeg, downloadBlob } from '../lib/ffmpeg'
import { Sparkles, Download, Image as ImageIcon, ArrowLeft, X, Film, Check, CreditCard, Brain, AlertTriangle, Share2, ExternalLink, Copy, QrCode } from 'lucide-react'
import CopyButton from '../components/CopyButton'
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
  const [voiceover, setVoiceover] = useState(false)
  const [voice, setVoice] = useState('de-DE-KatjaNeural')
  const [music, setMusic] = useState(false)
  const [musicMood, setMusicMood] = useState('motivation')
  const [pipelineScenes, setPipelineScenes] = useState(null)
  const [platformCaptions, setPlatformCaptions] = useState({})
  const [generatingCaptions, setGeneratingCaptions] = useState(false)
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

  const pipelineUsed = useRef(false)
  useEffect(() => {
    const pipelineResult = location.state?.pipelineResult
    if (pipelineResult?.scenes && !pipelineUsed.current) {
      pipelineUsed.current = true
      setText(location.state?.postText || '')
      setPipelineScenes(pipelineResult.scenes)
      setTotalDuration(pipelineResult.totalDuration || 0)
    }
  }, [])

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
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token || ''
      const response = await fetch('/api/create-checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ userId: user.id, email: user.email }),
      })
      const data = await response.json().catch(() => null)
      if (data?.url) {
        window.location.href = data.url
      } else if (response.status === 502) {
        setError('Das Zahlungssystem hat gerade Probleme. Bitte versuch es in ein paar Minuten nochmal.')
      } else {
        setError('Beim Checkout ist ein Fehler aufgetreten. Bitte versuch es nochmal.')
      }
    } catch (error) {
      console.error('Checkout error:', error)
      setError('Keine Verbindung zum Server. Prüf dein Internet und versuch es nochmal.')
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

  const loadBackgroundImage = (url, timeoutMs = 8000) => {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Image load timeout')), timeoutMs)
      const img = new Image()
      img.crossOrigin = 'anonymous'
      img.onload = () => { clearTimeout(timer); resolve(img) }
      img.onerror = () => { clearTimeout(timer); reject(new Error('Failed to load image')) }
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
      let scenesToUse = pipelineScenes

      if (scenesToUse) {
        console.log('[createVideo] Using pipeline scenes, skipping API call', { count: scenesToUse.length })
        setScenes(scenesToUse)
        setFreeVideoUsed(prev => prev + 1)
      } else {
        if (selectedImage) {
          setStatusMsg('Bild wird moderiert...')
          const imageBase64 = await new Promise((resolve, reject) => {
            const reader = new FileReader()
            reader.onload = () => resolve(reader.result)
            reader.onerror = reject
            reader.readAsDataURL(selectedImage)
          })
          
          const token = (await supabase.auth.getSession()).data.session?.access_token
          const modRes = await fetch('/api/moderate-image', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ image: imageBase64 })
          })
          const modData = await modRes.json()
          console.log('Moderation result:', modData)
          if (!modRes.ok || !modData.allowed) {
            throw new Error(modData.reason || 'Dieses Bild kann nicht verwendet werden.')
          }
        }

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
          const err = await res.json().catch(() => ({ error: 'Unbekannter Fehler' }))
          if (res.status === 402) {
            setShowPaywall(true)
            setLoading(false)
            return
          }
          throw new Error(err.error || `Fehler bei der Video-Erstellung (${res.status})`)
        }

        const data = await res.json()
        scenesToUse = data.scenes
        setScenes(data.scenes)
        setTotalDuration(data.totalDuration)
        setFreeVideoUsed(prev => prev + 1)
      }

      let audioBuffers = null
      if (voiceover) {
        setStatusMsg('Voiceover wird generiert...')
        audioBuffers = []
        for (let i = 0; i < scenesToUse.length; i++) {
          const scene = scenesToUse[i]
          const spokenText = `${scene.text1}. ${scene.text2 || ''}`
          setStatusMsg(`Voiceover Szene ${i + 1}/${scenesToUse.length}...`)
          try {
            const audioRes = await fetch('/api/tts', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ text: spokenText.trim(), voice, rate: '+10%' })
            })
            if (audioRes.ok) {
              const audioBlob = await audioRes.blob()
              audioBuffers.push(audioBlob)
            } else {
              audioBuffers.push(null)
            }
          } catch {
            audioBuffers.push(null)
          }
        }
      }

      let musicBuffer = null
      if (music) {
        setStatusMsg('Hintergrundmusik wird geladen...')
        try {
          const musicRes = await fetch('/api/music', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: text.trim(), mood: musicMood })
          })
          if (musicRes.ok) {
            const musicData = await musicRes.json()
            setStatusMsg(`Musik: "${musicData.name}" wird geladen...`)
            const trackRes = await fetch(musicData.url)
            if (trackRes.ok) {
              musicBuffer = await trackRes.blob()
            }
          }
        } catch (e) {
          console.error('Music fetch error:', e)
        }
      }

      setStatusMsg('Bilder werden geladen...')
      await renderVideo(scenesToUse, audioBuffers, musicBuffer)
      setPipelineScenes(null)
    } catch (err) {
      console.error('Create video error:', err)
      const msg = err.message || ''
      if (msg.includes('limit') || msg.includes('429')) {
        setError('Zu viele Anfragen gerade. Bitte warte kurz und versuch es nochmal.')
      } else if (msg.includes('fetch') || msg.includes('network')) {
        setError('Keine Verbindung zum Server. Prüf dein Internet und versuch es nochmal.')
      } else {
        setError('Bei der Video-Erstellung ist ein Fehler aufgetreten. Bitte versuch es nochmal.')
      }
    } finally {
      setLoading(false)
    }
  }

  const renderVideo = async (scenes, audioBuffers = null, musicBuffer = null) => {
    console.log('[renderVideo] START', { scenes: scenes.length, hasAudio: !!audioBuffers, hasMusic: !!musicBuffer })
    setStatusMsg('Video-Engine wird geladen...')
    const ffmpeg = await getFFmpeg()
    console.log('[renderVideo] FFmpeg loaded OK')
    const W = 1080
    const H = 1920
    const FPS = 30

    setStatusMsg(`${scenes.length} Bilder werden parallel geladen...`)
    const bgImages = await Promise.all(scenes.map(async (scene) => {
      if (scene.backgroundUrl) {
        try {
          return await loadBackgroundImage(scene.backgroundUrl)
        } catch {
          return null
        }
      }
      return null
    }))

    console.log('[renderVideo] Images loaded', { loaded: bgImages.filter(Boolean).length, total: bgImages.length })
    setStatusMsg('Szenen werden gerendert...')

    const canvas = document.createElement('canvas')
    canvas.width = W
    canvas.height = H
    const ctx = canvas.getContext('2d')

    for (let i = 0; i < scenes.length; i++) {
      setStatusMsg(`Szene ${i + 1}/${scenes.length} wird gerendert...`)
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

    const hasAudio = audioBuffers && audioBuffers.some(b => b !== null)
    const hasMusic = musicBuffer !== null
    const filterParts = []
    const concatInputs = []
    const inputArgs = []
    let inputIdx = 0

    scenes.forEach((scene, i) => {
      inputArgs.push('-loop', '1', '-t', String(scene.duration), '-i', `scene_${i}.png`)
      filterParts.push(`[${i}:v]setpts=PTS-STARTPTS[v${i}]`)
      concatInputs.push(`[v${i}]`)
      inputIdx++
    })

    if (hasMusic) {
      const mb = await musicBuffer.arrayBuffer()
      await ffmpeg.writeFile('music.mp3', new Uint8Array(mb))
      inputArgs.push('-i', 'music.mp3')
      const musicIdx = inputIdx++
      filterParts.push(`[${musicIdx}:a]volume=0.15,afade=t=in:st=0:d=2,afade=t=out:st=${totalDuration - 2}:d=2[music]`)
    }

    const isValidMp3 = (buf) => {
      if (buf.length < 2) return false
      const view = new Uint8Array(buf)
      return view[0] === 0xFF && (view[1] & 0xE0) === 0xE0
    }

    if (hasAudio) {
      for (let i = 0; i < scenes.length; i++) {
        if (audioBuffers[i]) {
          const ab = await audioBuffers[i].arrayBuffer()
          if (isValidMp3(ab)) {
            await ffmpeg.writeFile(`audio_${i}.mp3`, new Uint8Array(ab))
            inputArgs.push('-i', `audio_${i}.mp3`)
          } else {
            console.warn(`[renderVideo] Invalid MP3 for scene ${i}, skipping voice`)
            inputArgs.push('-f', 'lavfi', '-i', `anullsrc=r=24000:cl=mono:d=${scenes[i].duration}`)
          }
        } else {
          inputArgs.push('-f', 'lavfi', '-i', `anullsrc=r=24000:cl=mono:d=${scenes[i].duration}`)
        }
        inputIdx++
      }

      const audioInputs = scenes.map((_, i) => `[${inputIdx - scenes.length + i}:a]`)
      filterParts.push(`${audioInputs.join('')}concat=n=${scenes.length}:v=0:a=1[voice]`)

      if (hasMusic) {
        filterParts.push('[voice][music]amix=inputs=2:duration=longest:dropout_transition=0[aout]')
      } else {
        filterParts.push('[voice]acopy[aout]')
      }
    } else if (hasMusic) {
      filterParts.push('[music]acopy[aout]')
    }

    const videoFilter = concatInputs.join('') + `concat=n=${scenes.length}:v=1:a=0[vout]`

    let finalFilter = filterParts.join(';') + ';' + videoFilter

    if (hasAudio || hasMusic) {
      const args = [
        ...inputArgs,
        '-filter_complex', finalFilter,
        '-map', '[vout]', '-map', '[aout]',
        '-r', String(FPS),
        '-c:v', 'libx264', '-preset', 'fast', '-crf', '23',
        '-c:a', 'aac', '-b:a', '128k',
        '-pix_fmt', 'yuv420p',
        '-movflags', '+faststart',
        '-shortest',
        'output.mp4'
      ]
      console.log('[renderVideo] FFmpeg exec (with audio)', { argCount: args.length })
      await ffmpeg.exec(args)
      console.log('[renderVideo] FFmpeg exec DONE (with audio)')
    } else {
      const noAudioFilter = concatInputs.join('') + `concat=n=${scenes.length}:v=1:a=0[out]`
      const noAudioComplex = filterParts.join(';') + ';' + noAudioFilter
      const args = [
        ...inputArgs,
        '-filter_complex', noAudioComplex,
        '-map', '[out]',
        '-r', String(FPS),
        '-c:v', 'libx264', '-preset', 'fast', '-crf', '23',
        '-pix_fmt', 'yuv420p',
        '-movflags', '+faststart',
        'output.mp4'
      ]
      console.log('[renderVideo] FFmpeg exec (no audio)', { argCount: args.length })
      await ffmpeg.exec(args)
      console.log('[renderVideo] FFmpeg exec DONE (no audio)')
    }

    const data = await ffmpeg.readFile('output.mp4')
    const blob = new Blob([data.buffer], { type: 'video/mp4' })
    console.log('[renderVideo] Video ready', { sizeKB: Math.round(blob.size / 1024) })
    setVideoBlob(blob)
    gtag('event', 'content_generated', { source: 'tiktok_video' })
    setVideoUrl(URL.createObjectURL(blob))
    setStatusMsg('')
    setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 200)

    for (let i = 0; i < scenes.length; i++) {
      await ffmpeg.deleteFile(`scene_${i}.png`).catch(() => {})
      await ffmpeg.deleteFile(`audio_${i}.mp3`).catch(() => {})
    }
    await ffmpeg.deleteFile('music.mp3').catch(() => {})
    await ffmpeg.deleteFile('output.mp4').catch(() => {})

    generatePlatformCaptions(text)
  }

  const DEPLOY_PLATFORMS = [
    { id: 'tiktok', label: 'TikTok', icon: '🎵', color: '#000000', url: 'https://www.tiktok.com/upload', hashtags: '#fyp #viral #trending #happiness #wellbeing' },
    { id: 'instagram', label: 'Instagram Reels', icon: '📷', color: '#E4405F', url: 'https://www.instagram.com/', hashtags: '#reels #fyp #happiness #wellness #selfcare #motivation' },
    { id: 'youtube', label: 'YouTube Shorts', icon: '▶️', color: '#FF0000', url: 'https://studio.youtube.com/channel/videos', hashtags: '#shorts #youtubeshorts #fyp #happiness' },
    { id: 'facebook', label: 'Facebook Reel', icon: '👤', color: '#1877F2', url: 'https://www.facebook.com/reels/', hashtags: '#reels #fyp #happiness #wellbeing' },
    { id: 'x', label: 'X / Twitter', icon: '✖', color: '#000000', url: 'https://twitter.com/compose/tweet', hashtags: '#fyp #happiness' }
  ]

  const generatePlatformCaptions = async (videoText) => {
    setGeneratingCaptions(true)
    const captions = {}
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token || ''

      for (const platform of DEPLOY_PLATFORMS) {
        try {
          const response = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({
              message: `Erstelle eine kurze, knackige Caption fuer einen ${platform.label}-Post basierend auf diesem Video-Text:\n\n"${videoText}"\n\nRegeln: Max 150 Zeichen, emoticon am Anfang, ${platform.hashtags} am Ende. Deutsch. Kein Markdown.`,
              systemPrompt: 'Du bist ein Social-Media-Experte. Schreibe kurze, mitreissende Captions.',
              userId: user?.id || '',
              history: []
            })
          })
          if (response.ok) {
            const data = await response.json()
            captions[platform.id] = data.response || ''
          } else {
            captions[platform.id] = `Neues Video von Happiness 🎬✨\n\n${videoText.substring(0, 100)}...\n\n${platform.hashtags}`
          }
        } catch {
          captions[platform.id] = `Neues Video von Happiness 🎬✨\n\n${videoText.substring(0, 100)}...\n\n${platform.hashtags}`
        }
      }
    } catch {
      for (const platform of DEPLOY_PLATFORMS) {
        captions[platform.id] = `Neues Video von Happiness 🎬✨\n\n${videoText.substring(0, 100)}...\n\n${platform.hashtags}`
      }
    }
    setPlatformCaptions(captions)
    setGeneratingCaptions(false)
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
                onChange={(e) => { try { if (text.length === 0) gtag('event', 'idea_started', { source: 'tiktok_video' }); } catch {} setText(e.target.value); }}
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

            <div className="tiktok-voiceover-group">
              <div className="tiktok-voiceover-header">
                <label className="tiktok-label" style={{ margin: 0 }}>🎙️ Voiceover (Text-to-Speech)</label>
                <button
                  className={`tiktok-toggle ${voiceover ? 'active' : ''}`}
                  onClick={() => setVoiceover(!voiceover)}
                  type="button"
                >
                  <span className="tiktok-toggle-thumb" />
                </button>
              </div>
              {voiceover && (
                <div className="tiktok-voiceover-options">
                  <label className="tiktok-sublabel">Stimme wählen:</label>
                  <select className="tiktok-voice-select" value={voice} onChange={e => setVoice(e.target.value)}>
                    <option value="de-DE-KatjaNeural">Katja — Weiblich, klar</option>
                    <option value="de-DE-ConradNeural">Conrad — Männlich, ruhig</option>
                    <option value="de-DE-AmalaNeural">Amala — Weiblich, jung</option>
                    <option value="de-DE-KillianNeural">Killian — Männlich, jung</option>
                  </select>
                </div>
              )}
            </div>

            <div className="tiktok-voiceover-group">
              <div className="tiktok-voiceover-header">
                <label className="tiktok-label" style={{ margin: 0 }}>🎵 Hintergrundmusik</label>
                <button
                  className={`tiktok-toggle ${music ? 'active' : ''}`}
                  onClick={() => setMusic(!music)}
                  type="button"
                >
                  <span className="tiktok-toggle-thumb" />
                </button>
              </div>
              {music && (
                <div className="tiktok-voiceover-options">
                  <label className="tiktok-sublabel">Stimmung wählen:</label>
                  <select className="tiktok-voice-select" value={musicMood} onChange={e => setMusicMood(e.target.value)}>
                    <option value="motivation">Motivierend</option>
                    <option value="calm">Ruhig & Entspannt</option>
                    <option value="upbeat">Fröhlich & Energiereich</option>
                    <option value="dramatic">Dramatisch & Episch</option>
                  </select>
                </div>
              )}
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
                <p className="tiktok-paywall-note">Promotionspreis — ab 6,99 €/Monat nach einem Monat.</p>
            </div>
          </div>
        )}

        {loading && (
          <div className="tiktok-loading">
            <div className="tiktok-spinner" />
            <p>{statusMsg}</p>
          </div>
        )}

        {videoUrl && !showPaywall && (
          <div className="tiktok-result">
            <div className="tiktok-result-ready">
              <Check size={20} /> Video ist fertig!
            </div>

            <div className="tiktok-video-wrapper">
              <video
                ref={videoRef}
                src={videoUrl}
                controls
                playsInline
                className="tiktok-video-player"
              />
            </div>

            <button className="btn btn-primary tiktok-download-main" onClick={() => { gtag('event', 'project_saved', { source: 'tiktok_video' }); downloadBlob(videoBlob, `tiktok-video-${Date.now()}.mp4`); }}>
              <Download size={18} /> Video herunterladen
            </button>

            <div className="tiktok-deploy-section">
              <h3 className="tiktok-deploy-title"><Share2 size={18} /> Caption für deine Plattform</h3>
              <p className="tiktok-deploy-subtitle">Kopier die Caption, geh zur Plattform und lad das Video hoch.</p>
              {generatingCaptions && (
                <div className="tiktok-deploy-loading">Captions werden generiert...</div>
              )}
              {DEPLOY_PLATFORMS.map(platform => (
                <div key={platform.id} className="tiktok-deploy-card" style={{ borderLeftColor: platform.color }}>
                  <div className="tiktok-deploy-header">
                    <span className="tiktok-deploy-icon">{platform.icon}</span>
                    <span className="tiktok-deploy-label">{platform.label}</span>
                    <a
                      href={platform.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="tiktok-deploy-open"
                      onClick={() => gtag('event', 'deploy_click', { platform: platform.id, source: 'tiktok_video' })}
                    >
                      Öffnen →
                    </a>
                  </div>
                  {platformCaptions[platform.id] && (
                    <div className="tiktok-deploy-caption">
                      <div className="tiktok-deploy-caption-text">{platformCaptions[platform.id]}</div>
                      <button
                        className="tiktok-deploy-copy"
                        onClick={async () => {
                          try { await navigator.clipboard.writeText(platformCaptions[platform.id]) } catch {
                            const ta = document.createElement('textarea')
                            ta.value = platformCaptions[platform.id]
                            document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta)
                          }
                        }}
                      >
                        <Copy size={14} /> Kopieren
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="tiktok-result-actions">
              <button className="btn btn-outline" onClick={() => {
                setScenes(null)
                setVideoBlob(null)
                setPlatformCaptions({})
                if (videoUrl) URL.revokeObjectURL(videoUrl)
                setVideoUrl(null)
                setError('')
                setPipelineScenes(null)
                pipelineUsed.current = false
              }}>
                Neues Video erstellen
              </button>
            </div>

            {scenes && (
              <details className="tiktok-scenes-collapsible">
                <summary>Skript ansehen ({scenes.length} Szenen, {totalDuration}s)</summary>
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
              </details>
            )}
          </div>
        )}

        {scenes && !loading && !showPaywall && !videoUrl && (
          <div className="tiktok-scenes-preview">
            {error && (
              <div className="tiktok-error">
                <AlertTriangle size={16} /> {error}
                <button className="btn btn-primary" style={{ marginTop: '12px' }} onClick={async () => {
                  setError('')
                  setLoading(true)
                  try {
                    await renderVideo(scenes)
                  } catch (err) {
                    console.error('Retry render error:', err)
                    setError('Video konnte nicht gerendert werden. Bitte versuch es nochmal.')
                  } finally {
                    setLoading(false)
                  }
                }}>
                  Nochmal versuchen
                </button>
              </div>
            )}
            <div className="tiktok-scenes-header">
              <h3>Skript: {totalDuration}s Video ({scenes.length} Szenen) {voiceover && <span className="tiktok-voiceover-badge">🎙️ Voiceover</span>} {music && <span className="tiktok-voiceover-badge" style={{ background: '#6d28d9' }}>🎵 Musik</span>}</h3>
              <CopyButton
                text={scenes.map((s, i) => `${i + 1}. ${s.text1}${s.text2 ? ` — ${s.text2}` : ''} (${s.duration}s)`).join('\n')}
                label="Kopieren"
              />
            </div>
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


      </div>
    </div>
  )
}
