import { useState, useRef, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { useLanguage } from '../i18n/translations'
import './FotostoryPage.css'

const TRANSITIONS = [
  { id: 'fade', label: 'Ueberblenden' },
  { id: 'slide-left', label: 'Links' },
  { id: 'slide-right', label: 'Rechts' },
  { id: 'slide-up', label: 'Oben' },
  { id: 'zoom', label: 'Zoom' },
  { id: 'none', label: 'Keiner' },
]

const MUSIC_URLS = {
  none: '',
  epic: 'https://cdn.pixabay.com/audio/2022/10/14/audio_2af9e5748c.mp3',
  calm: 'https://cdn.pixabay.com/audio/2022/08/02/audio_884fe92c38.mp3',
  piano: 'https://cdn.pixabay.com/audio/2022/05/27/audio_1808fbf07a.mp3',
}

export default function FotostoryPage() {
  const { t } = useLanguage()
  const { user } = useAuth()
  const canvasRef = useRef(null)
  const audioRef = useRef(null)
  const fileInputRef = useRef(null)
  const [slides, setSlides] = useState([])
  const [activeSlide, setActiveSlide] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [exportProgress, setExportProgress] = useState(0)
  const [transition, setTransition] = useState('fade')
  const [transitionDuration, setTransitionDuration] = useState(0.5)
  const [slideDuration, setSlideDuration] = useState(3)
  const [music, setMusic] = useState('none')
  const [textOverlays, setTextOverlays] = useState({})
  const [activeTextSlide, setActiveTextSlide] = useState(null)

  const handleFiles = (e) => {
    const files = Array.from(e.target.files || [])
    const imageFiles = files.filter(f => f.type.startsWith('image/'))
    const newSlides = imageFiles.map((file, i) => ({
      id: Date.now() + i,
      file,
      url: URL.createObjectURL(file),
      duration: slideDuration,
      text: '',
      textX: 50,
      textY: 80,
      textSize: 24,
      textColor: '#ffffff',
      textShadow: true,
    }))
    setSlides(prev => [...prev, ...newSlides])
  }

  const removeSlide = (id) => {
    setSlides(prev => prev.filter(s => s.id !== id))
    if (activeSlide >= slides.length - 1) {
      setActiveSlide(Math.max(0, slides.length - 2))
    }
  }

  const moveSlide = (from, to) => {
    if (to < 0 || to >= slides.length) return
    const arr = [...slides]
    const [item] = arr.splice(from, 1)
    arr.splice(to, 0, item)
    setSlides(arr)
    setActiveSlide(to)
  }

  const updateSlide = (id, field, value) => {
    setSlides(prev => prev.map(s => s.id === id ? { ...s, [field]: value } : s))
  }

  const drawSlide = (ctx, slide, canvasW, canvasH, progress = 1, nextSlide = null, transProgress = 0) => {
    const img = new Image()
    img.src = slide.url

    return new Promise(resolve => {
      img.onload = () => {
        ctx.clearRect(0, 0, canvasW, canvasH)

        const imgRatio = img.width / img.height
        const canvasRatio = canvasW / canvasH
        let sw, sh, sx, sy

        if (imgRatio > canvasRatio) {
          sh = canvasH
          sw = sh * imgRatio
          sx = (canvasW - sw) / 2
          sy = 0
        } else {
          sw = canvasW
          sh = sw / imgRatio
          sx = 0
          sy = (canvasH - sh) / 2
        }

        if (nextSlide && transProgress > 0) {
          const nextImg = new Image()
          nextImg.src = nextSlide.url
          nextImg.onload = () => {
            let nextSw, nextSh, nextSx, nextSy
            const nextRatio = nextImg.width / nextImg.height
            if (nextRatio > canvasRatio) {
              nextSh = canvasH
              nextSw = nextSh * nextRatio
              nextSx = (canvasW - nextSw) / 2
              nextSy = 0
            } else {
              nextSw = canvasW
              nextSh = nextSw / nextRatio
              nextSx = 0
              nextSy = (canvasH - nextSh) / 2
            }

            if (transition === 'fade') {
              ctx.globalAlpha = 1 - transProgress
              ctx.drawImage(img, sx, sy, sw, sh)
              ctx.globalAlpha = transProgress
              ctx.drawImage(nextImg, nextSx, nextSy, nextSw, nextSh)
              ctx.globalAlpha = 1
            } else if (transition === 'slide-left') {
              const offset = transProgress * canvasW
              ctx.drawImage(img, sx - offset, sy, sw, sh)
              ctx.drawImage(nextImg, nextSx + canvasW - offset, nextSy, nextSw, nextSh)
            } else if (transition === 'slide-right') {
              const offset = transProgress * canvasW
              ctx.drawImage(img, sx + offset, sy, sw, sh)
              ctx.drawImage(nextImg, nextSx - canvasW + offset, nextSy, nextSw, nextSh)
            } else if (transition === 'slide-up') {
              const offset = transProgress * canvasH
              ctx.drawImage(img, sx, sy - offset, sw, sh)
              ctx.drawImage(nextImg, nextSx, nextSy + canvasH - offset, nextSw, nextSh)
            } else if (transition === 'zoom') {
              const scale = 1 + transProgress * 0.2
              ctx.drawImage(img, sx, sy, sw, sh)
              ctx.save()
              ctx.globalAlpha = transProgress
              ctx.translate(canvasW / 2, canvasH / 2)
              ctx.scale(scale, scale)
              ctx.translate(-canvasW / 2, -canvasH / 2)
              ctx.drawImage(nextImg, nextSx, nextSy, nextSw, nextSh)
              ctx.restore()
              ctx.globalAlpha = 1
            } else {
              ctx.drawImage(img, sx, sy, sw, sh)
              if (transProgress > 0.5) {
                ctx.drawImage(nextImg, nextSx, nextSy, nextSw, nextSh)
              }
            }

            if (slide.text && transProgress < 0.5) {
              ctx.textAlign = 'center'
              ctx.fillStyle = slide.textColor
              if (slide.textShadow) {
                ctx.shadowColor = 'rgba(0,0,0,0.8)'
                ctx.shadowBlur = 8
              }
              ctx.font = `bold ${slide.textSize * 3}px 'Segoe UI', Arial, sans-serif`
              ctx.fillText(slide.text, (slide.textX / 100) * canvasW, (slide.textY / 100) * canvasH)
              ctx.shadowBlur = 0
            }

            resolve()
          }
        } else {
          ctx.drawImage(img, sx, sy, sw, sh)

          if (slide.text) {
            ctx.textAlign = 'center'
            ctx.fillStyle = slide.textColor
            if (slide.textShadow) {
              ctx.shadowColor = 'rgba(0,0,0,0.8)'
              ctx.shadowBlur = 8
            }
            ctx.font = `bold ${slide.textSize * 3}px 'Segoe UI', Arial, sans-serif`
            ctx.fillText(slide.text, (slide.textX / 100) * canvasW, (slide.textY / 100) * canvasH)
            ctx.shadowBlur = 0
          }

          resolve()
        }
      }
      img.onerror = () => resolve()
    })
  }

  const playPreview = async () => {
    if (slides.length === 0) return
    setIsPlaying(true)

    if (music !== 'none' && MUSIC_URLS[music] && audioRef.current) {
      audioRef.current.src = MUSIC_URLS[music]
      audioRef.current.volume = 0.3
      audioRef.current.play().catch(() => {})
    }

    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    canvas.width = 1920
    canvas.height = 1080

    for (let i = 0; i < slides.length; i++) {
      setActiveSlide(i)
      const slide = slides[i]
      const dur = (slide.duration || slideDuration) * 1000

      if (i < slides.length - 1 && transition !== 'none') {
        const transDur = transitionDuration * 1000
        const mainDur = dur - transDur

        await new Promise(resolve => {
          const start = Date.now()
          const animate = () => {
            const elapsed = Date.now() - start
            if (elapsed < mainDur) {
              drawSlide(ctx, slide, canvas.width, canvas.height)
              requestAnimationFrame(animate)
            } else {
              resolve()
            }
          }
          animate()
        })

        await new Promise(resolve => {
          const start = Date.now()
          const animate = () => {
            const elapsed = Date.now() - start
            const p = Math.min(1, elapsed / transDur)
            drawSlide(ctx, slide, canvas.width, canvas.height, 1, slides[i + 1], p)
            if (p < 1) requestAnimationFrame(animate)
            else resolve()
          }
          animate()
        })
      } else {
        await new Promise(resolve => {
          const start = Date.now()
          const animate = () => {
            const elapsed = Date.now() - start
            if (elapsed < dur) {
              drawSlide(ctx, slide, canvas.width, canvas.height)
              requestAnimationFrame(animate)
            } else {
              resolve()
            }
          }
          animate()
        })
      }
    }

    setIsPlaying(false)
    audioRef.current?.pause()
    if (audioRef.current) audioRef.current.currentTime = 0
  }

  const stopPreview = () => {
    setIsPlaying(false)
    audioRef.current?.pause()
    if (audioRef.current) audioRef.current.currentTime = 0
  }

  const exportVideo = async () => {
    if (slides.length === 0) return
    setIsExporting(true)
    setExportProgress(0)

    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    canvas.width = 1920
    canvas.height = 1080

    const stream = canvas.captureStream(30)
    const mr = new MediaRecorder(stream, {
      mimeType: MediaRecorder.isTypeSupported('video/webm;codecs=vp9') ? 'video/webm;codecs=vp9' : 'video/webm'
    })
    const chunks = []
    mr.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data) }
    mr.onstop = () => {
      const blob = new Blob(chunks, { type: 'video/webm' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `fotostory-${Date.now()}.webm`
      a.click()
      URL.revokeObjectURL(url)
      setIsExporting(false)
      audioRef.current?.pause()
    }

    if (music !== 'none' && MUSIC_URLS[music] && audioRef.current) {
      audioRef.current.src = MUSIC_URLS[music]
      audioRef.current.volume = 0.3
      audioRef.current.play().catch(() => {})
    }

    mr.start()

    const totalSlides = slides.length
    for (let i = 0; i < totalSlides; i++) {
      const slide = slides[i]
      const dur = (slide.duration || slideDuration) * 1000
      setActiveSlide(i)

      if (i < totalSlides - 1 && transition !== 'none') {
        const transDur = transitionDuration * 1000
        const mainDur = dur - transDur

        await new Promise(resolve => {
          const start = Date.now()
          const animate = () => {
            const elapsed = Date.now() - start
            setExportProgress(((i + elapsed / dur) / totalSlides) * 100)
            if (elapsed < mainDur) {
              drawSlide(ctx, slide, canvas.width, canvas.height)
              requestAnimationFrame(animate)
            } else resolve()
          }
          animate()
        })

        await new Promise(resolve => {
          const start = Date.now()
          const animate = () => {
            const elapsed = Date.now() - start
            const p = Math.min(1, elapsed / transDur)
            drawSlide(ctx, slide, canvas.width, canvas.height, 1, slides[i + 1], p)
            setExportProgress(((i + (mainDur + elapsed) / dur) / totalSlides) * 100)
            if (p < 1) requestAnimationFrame(animate)
            else resolve()
          }
          animate()
        })
      } else {
        await new Promise(resolve => {
          const start = Date.now()
          const animate = () => {
            const elapsed = Date.now() - start
            setExportProgress(((i + elapsed / dur) / totalSlides) * 100)
            if (elapsed < dur) {
              drawSlide(ctx, slide, canvas.width, canvas.height)
              requestAnimationFrame(animate)
            } else resolve()
          }
          animate()
        })
      }
    }

    mr.stop()
    audioRef.current?.pause()
  }

  const getTotalDuration = () => {
    return slides.reduce((sum, s) => sum + (s.duration || slideDuration), 0)
  }

  return (
    <div className="editor-page">
      <audio ref={audioRef} loop preload="auto" />
      <canvas ref={canvasRef} style={{ display: 'none' }} />

      <div className="editor-header">
        <h1>Fotostory</h1>
        {slides.length > 0 && (
          <div className="header-actions">
            <span className="duration-label">{slides.length} Fotos / {getTotalDuration().toFixed(1)}s</span>
            <button className="btn btn-secondary" onClick={isPlaying ? stopPreview : playPreview}>
              {isPlaying ? 'Stop' : 'Abspielen'}
            </button>
            <button className="btn btn-export" onClick={exportVideo} disabled={isExporting}>
              {isExporting ? `Exportiere... ${Math.round(exportProgress)}%` : 'Video exportieren'}
            </button>
          </div>
        )}
      </div>

      {slides.length === 0 ? (
        <div className="upload-area" onClick={() => fileInputRef.current?.click()}>
          <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={handleFiles} style={{ display: 'none' }} />
          <div className="upload-icon">+</div>
          <div className="upload-text">Fotos auswaehlen</div>
          <div className="upload-hint">Mehrere Fotos gleichzeitig auswaehlen</div>
        </div>
      ) : (
        <div className="editor-layout">
          <div className="preview-area">
            <div className="canvas-container">
              <canvas ref={canvasRef} width={1920} height={1080} className="preview-canvas" />
            </div>

            <div className="filmstrip">
              {slides.map((slide, i) => (
                <div
                  key={slide.id}
                  className={`filmstrip-item ${i === activeSlide ? 'active' : ''}`}
                  onClick={() => setActiveSlide(i)}
                >
                  <img src={slide.url} className="filmstrip-thumb" />
                  <div className="filmstrip-num">{i + 1}</div>
                  <button className="filmstrip-remove" onClick={(e) => { e.stopPropagation(); removeSlide(slide.id) }}>x</button>
                  <div className="filmstrip-duration">{slide.duration || slideDuration}s</div>
                </div>
              ))}
              <div className="filmstrip-add" onClick={() => fileInputRef.current?.click()}>
                <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={handleFiles} style={{ display: 'none' }} />
                +
              </div>
            </div>
          </div>

          <div className="sidebar">
            <div className="sidebar-tabs">
              <button className={`tab ${activeSlide >= 0 && !activeTextSlide ? 'active' : ''}`} onClick={() => setActiveTextSlide(null)}>Einstellungen</button>
              <button className={`tab ${activeTextSlide ? 'active' : ''}`} onClick={() => setActiveTextSlide(slides[activeSlide]?.id || null)}>Text</button>
            </div>

            <div className="sidebar-content">
              {!activeTextSlide ? (
                <div className="panel">
                  <h3>Ueberblenden</h3>
                  <div className="control">
                    <label>Art</label>
                    <select value={transition} onChange={e => setTransition(e.target.value)}>
                      {TRANSITIONS.map(tr => (
                        <option key={tr.id} value={tr.id}>{tr.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="control">
                    <label>Dauer: {transitionDuration}s</label>
                    <input type="range" min="0.1" max="2" step="0.1" value={transitionDuration} onChange={e => setTransitionDuration(+e.target.value)} />
                  </div>

                  <h3>Foto-Dauer</h3>
                  <div className="control">
                    <label>{slideDuration}s pro Foto</label>
                    <input type="range" min="1" max="10" step="0.5" value={slideDuration} onChange={e => setSlideDuration(+e.target.value)} />
                  </div>

                  <h3>Musik</h3>
                  <div className="music-grid">
                    <button className={`music-card ${music === 'none' ? 'active' : ''}`} onClick={() => setMusic('none')}>Keine</button>
                    <button className={`music-card ${music === 'epic' ? 'active' : ''}`} onClick={() => setMusic('epic')}>Epic</button>
                    <button className={`music-card ${music === 'calm' ? 'active' : ''}`} onClick={() => setMusic('calm')}>Ruhig</button>
                    <button className={`music-card ${music === 'piano' ? 'active' : ''}`} onClick={() => setMusic('piano')}>Piano</button>
                  </div>

                  {slides.length > 0 && (
                    <>
                      <h3>Aktuelles Foto</h3>
                      <div className="control">
                        <label>Dauer: {slides[activeSlide]?.duration || slideDuration}s</label>
                        <input
                          type="range" min="1" max="10" step="0.5"
                          value={slides[activeSlide]?.duration || slideDuration}
                          onChange={e => updateSlide(slides[activeSlide].id, 'duration', +e.target.value)}
                        />
                      </div>
                      <div className="control-row">
                        <button className="btn btn-secondary" onClick={() => moveSlide(activeSlide, activeSlide - 1)} disabled={activeSlide === 0}>Zurueck</button>
                        <button className="btn btn-secondary" onClick={() => moveSlide(activeSlide, activeSlide + 1)} disabled={activeSlide === slides.length - 1}>Weiter</button>
                      </div>
                    </>
                  )}
                </div>
              ) : (
                <div className="panel">
                  <h3>Text auf Foto</h3>
                  {slides[activeSlide] && (
                    <>
                      <div className="control">
                        <label>Text</label>
                        <input
                          type="text"
                          value={slides[activeSlide].text}
                          onChange={e => updateSlide(slides[activeSlide].id, 'text', e.target.value)}
                          placeholder="Text eingeben..."
                        />
                      </div>
                      <div className="control">
                        <label>Groesse: {slides[activeSlide].textSize}px</label>
                        <input type="range" min="12" max="64" value={slides[activeSlide].textSize} onChange={e => updateSlide(slides[activeSlide].id, 'textSize', +e.target.value)} />
                      </div>
                      <div className="control-row">
                        <label>X</label>
                        <input type="range" min="0" max="100" value={slides[activeSlide].textX} onChange={e => updateSlide(slides[activeSlide].id, 'textX', +e.target.value)} />
                      </div>
                      <div className="control-row">
                        <label>Y</label>
                        <input type="range" min="0" max="100" value={slides[activeSlide].textY} onChange={e => updateSlide(slides[activeSlide].id, 'textY', +e.target.value)} />
                      </div>
                      <div className="control-row">
                        <input type="color" value={slides[activeSlide].textColor} onChange={e => updateSlide(slides[activeSlide].id, 'textColor', e.target.value)} />
                        <label className="checkbox-label">
                          <input type="checkbox" checked={slides[activeSlide].textShadow} onChange={e => updateSlide(slides[activeSlide].id, 'textShadow', e.target.checked)} />
                          Schatten
                        </label>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {isExporting && (
        <div className="export-overlay">
          <div className="export-box">
            <div className="export-bar">
              <div className="export-fill" style={{ width: `${exportProgress}%` }} />
            </div>
            <p>Video wird exportiert... {Math.round(exportProgress)}%</p>
          </div>
        </div>
      )}
    </div>
  )
}
