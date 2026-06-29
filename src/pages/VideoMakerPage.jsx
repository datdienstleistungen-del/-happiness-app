import { useState, useRef, useEffect, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'
import { useLanguage } from '../i18n/translations'
import { FFmpeg } from '@ffmpeg/ffmpeg'
import { fetchFile, toBlobURL } from '@ffmpeg/util'
import './VideoMakerPage.css'

const FILTERS = [
  { id: 'none', label: 'Original', css: 'none' },
  { id: 'warm', label: 'Waerme', css: 'sepia(0.3) saturate(1.4) brightness(1.1)' },
  { id: 'cold', label: 'Kalt', css: 'saturate(0.8) hue-rotate(20deg) brightness(1.05)' },
  { id: 'vintage', label: 'Vintage', css: 'sepia(0.5) contrast(1.1) brightness(0.9)' },
  { id: 'bw', label: 'S/W', css: 'grayscale(1) contrast(1.2)' },
  { id: 'vivid', label: 'Lebhaft', css: 'saturate(1.8) contrast(1.1) brightness(1.05)' },
  { id: 'film', label: 'Film', css: 'contrast(1.2) saturate(0.9) brightness(0.95) sepia(0.1)' },
  { id: 'dramatic', label: 'Dramatisch', css: 'contrast(1.4) brightness(0.85) saturate(0.7)' },
]

const isMobile = () => /Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)

const getAspectRatios = () => {
  const mobile = isMobile()
  return [
    { id: '16:9', label: 'Landscape (16:9)', width: mobile ? 1280 : 1920, height: mobile ? 720 : 1080 },
    { id: '9:16', label: 'Vertical (9:16)', width: mobile ? 720 : 1080, height: mobile ? 1280 : 1920 },
    { id: '1:1', label: 'Quadrat (1:1)', width: mobile ? 720 : 1080, height: mobile ? 720 : 1080 },
    { id: '4:5', label: 'Instagram (4:5)', width: mobile ? 720 : 1080, height: mobile ? 900 : 1350 },
  ]
}

export default function VideoMakerPage() {
  const { t } = useLanguage()
  const { user } = useAuth()
  const videoRef = useRef(null)
  const fileInputRef = useRef(null)
  const audioInputRef = useRef(null)
  const timelineRef = useRef(null)

  const [videoFile, setVideoFile] = useState(null)
  const [videoUrl, setVideoUrl] = useState(null)
  const [videoDuration, setVideoDuration] = useState(0)
  const [videoLoaded, setVideoLoaded] = useState(false)
  const [videoError, setVideoError] = useState(null)

  const [trimStart, setTrimStart] = useState(0)
  const [trimEnd, setTrimEnd] = useState(100)
  const [currentTime, setCurrentTime] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)

  const [filter, setFilter] = useState('none')
  const [aspectRatio, setAspectRatio] = useState('16:9')

  const [textOverlays, setTextOverlays] = useState([])
  const [activeTextId, setActiveTextId] = useState(null)
  const [showTextPanel, setShowTextPanel] = useState(false)

  const [audioFile, setAudioFile] = useState(null)
  const [audioUrl, setAudioUrl] = useState(null)
  const [audioVolume, setAudioVolume] = useState(70)
  const [originalVolume, setOriginalVolume] = useState(100)

  const [brightness, setBrightness] = useState(100)
  const [contrast, setContrast] = useState(100)
  const [saturation, setSaturation] = useState(100)

  const [isExporting, setIsExporting] = useState(false)
  const [exportProgress, setExportProgress] = useState(0)
  const [activeTab, setActiveTab] = useState('trim')

  const ffmpegRef = useRef(null)
  const [ffmpegLoaded, setFfmpegLoaded] = useState(false)
  const [ffmpegLoading, setFfmpegLoading] = useState(false)

  const handleVideoUpload = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setVideoFile(file)
    const url = URL.createObjectURL(file)
    setVideoUrl(url)
    setVideoLoaded(false)
    setTextOverlays([])
    setFilter('none')
    setBrightness(100)
    setContrast(100)
    setSaturation(100)
  }

  const handleVideoLoaded = () => {
    const v = videoRef.current
    if (!v) return
    setVideoDuration(v.duration)
    setTrimEnd(100)
    setVideoLoaded(true)
    v.currentTime = 0
  }

  const handleTimeUpdate = () => {
    const v = videoRef.current
    if (!v) return
    setCurrentTime(v.currentTime)

    const startSec = (trimStart / 100) * videoDuration
    const endSec = (trimEnd / 100) * videoDuration
    if (v.currentTime >= endSec) {
      v.pause()
      setIsPlaying(false)
    }
  }

  const togglePlay = () => {
    const v = videoRef.current
    if (!v) return
    if (isPlaying) {
      v.pause()
    } else {
      const startSec = (trimStart / 100) * videoDuration
      if (v.currentTime < startSec || v.currentTime >= (trimEnd / 100) * videoDuration) {
        v.currentTime = startSec
      }
      v.play()
    }
    setIsPlaying(!isPlaying)
  }

  const seekTo = (e) => {
    const v = videoRef.current
    if (!v) return
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left
    const percent = x / rect.width
    v.currentTime = percent * videoDuration
  }

  const addTextOverlay = () => {
    const id = Date.now()
    setTextOverlays(prev => [...prev, {
      id,
      text: 'Text hier',
      x: 50,
      y: 50,
      fontSize: 36,
      color: '#ffffff',
      fontWeight: 'bold',
      opacity: 100,
      shadow: true,
    }])
    setActiveTextId(id)
    setShowTextPanel(true)
  }

  const updateTextOverlay = (id, field, value) => {
    setTextOverlays(prev => prev.map(t => t.id === id ? { ...t, [field]: value } : t))
  }

  const removeTextOverlay = (id) => {
    setTextOverlays(prev => prev.filter(t => t.id !== id))
    if (activeTextId === id) setActiveTextId(null)
  }

  const handleAudioUpload = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setAudioFile(file)
    setAudioUrl(URL.createObjectURL(file))
  }

  const getFilterCSS = () => {
    const f = FILTERS.find(fi => fi.id === filter)
    const custom = `brightness(${brightness / 100}) contrast(${contrast / 100}) saturate(${saturation / 100})`
    return f?.css !== 'none' ? `${f.css} ${custom}` : custom
  }

  const loadFFmpeg = async () => {
    if (ffmpegRef.current) return ffmpegRef.current
    setFfmpegLoading(true)
    const ffmpeg = new FFmpeg()
    ffmpegRef.current = ffmpeg
    
    ffmpeg.on('log', ({ message }) => {
      console.log('[FFmpeg]', message)
    })
    
    ffmpeg.on('progress', ({ progress }) => {
      setExportProgress(Math.round(progress * 100))
    })
    
    const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm'
    await ffmpeg.load({
      coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
      wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
    })
    
    setFfmpegLoaded(true)
    setFfmpegLoading(false)
    return ffmpeg
  }

  const downloadBlob = (blob) => {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `happiness-video-${Date.now()}.mp4`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  const exportVideo = async () => {
    if (!videoRef.current || !videoLoaded || !videoFile) return
    
    setIsExporting(true)
    setExportProgress(0)
    
    try {
      const ffmpeg = await loadFFmpeg()
      
      // Write input file
      await ffmpeg.writeFile('input.mp4', await fetchFile(videoFile))
      
      // Build filter chain
      const filters = []
      
      // Color adjustments
      const brightnessVal = (brightness - 100) / 200
      const contrastVal = contrast / 100
      const saturationVal = saturation / 100
      if (brightnessVal !== 0 || contrastVal !== 1 || saturationVal !== 1) {
        filters.push(`eq=brightness=${brightnessVal}:contrast=${contrastVal}:saturation=${saturationVal}`)
      }
      
      // Preset filter
      if (filter !== 'none') {
        const filterMap = {
          warm: 'colorbalance=rs=0.1:gs=0.05:bs=-0.1',
          cold: 'colorbalance=rs=-0.1:gs=0:bs=0.1',
          vintage: 'curves=vintage',
          bw: 'hue=s=0',
          vivid: 'eq=saturation=1.5',
          film: 'curves=vintage,eq=saturation=0.8',
          dramatic: 'eq=contrast=1.3:brightness=-0.05',
        }
        if (filterMap[filter]) filters.push(filterMap[filter])
      }
      
      // Text overlays as drawtext
      const cw = videoRef.current.videoWidth || 1920
      const ch = videoRef.current.videoHeight || 1080
      textOverlays.forEach(overlay => {
        const x = (overlay.x / 100) * cw
        const y = (overlay.y / 100) * ch
        const escaped = overlay.text.replace(/'/g, "\\'").replace(/:/g, "\\:")
        filters.push(`drawtext=text='${escaped}':x=${x}:y=${y}:fontsize=${overlay.fontSize * 2}:fontcolor=${overlay.color}:shadowcolor=black:shadowx=2:shadowy=2:alpha=${overlay.opacity / 100}`)
      })
      
      // Build FFmpeg args
      const startSec = (trimStart / 100) * videoDuration
      const endSec = (trimEnd / 100) * videoDuration
      
      const args = ['-i', 'input.mp4', '-ss', String(startSec), '-to', String(endSec)]
      
      if (filters.length > 0) {
        args.push('-vf', filters.join(','))
      }
      
      if (audioUrl && audioFile) {
        await ffmpeg.writeFile('audio.mp3', await fetchFile(audioFile))
        args.push('-i', 'audio.mp3', '-filter_complex', `amix=inputs=2:duration=first:volume=${audioVolume / 100}`, '-c:a', 'aac')
      }
      
      args.push('-c:v', 'libx264', '-preset', 'fast', '-crf', '23', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', 'output.mp4')
      
      await ffmpeg.exec(args)
      
      const data = await ffmpeg.readFile('output.mp4')
      const blob = new Blob([data.buffer], { type: 'video/mp4' })
      
      // Download or share
      if (isMobile() && navigator.share) {
        try {
          const file = new File([blob], 'happiness-video.mp4', { type: 'video/mp4' })
          await navigator.share({ files: [file], title: 'Happiness Video' })
        } catch (shareErr) {
          if (shareErr.name !== 'AbortError') {
            downloadBlob(blob)
          }
        }
      } else {
        downloadBlob(blob)
      }
      
      // Cleanup
      await ffmpeg.deleteFile('input.mp4')
      await ffmpeg.deleteFile('output.mp4')
      if (audioUrl) await ffmpeg.deleteFile('audio.mp3').catch(() => {})
      
    } catch (err) {
      console.error('Export failed:', err)
      setVideoError('Export fehlgeschlagen. Bitte versuche es mit einem kuerzeren Video.')
    } finally {
      setIsExporting(false)
    }
  }

  const formatTime = (sec) => {
    const m = Math.floor(sec / 60)
    const s = Math.floor(sec % 60)
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  return (
    <div className="editor-page">
      <div className="editor-header">
        <h1>Video Editor</h1>
        {videoLoaded && (
          <button className="btn btn-export" onClick={exportVideo} disabled={isExporting || ffmpegLoading}>
            {ffmpegLoading ? 'Video-Engine wird geladen...' : isExporting ? `Exportiere... ${Math.round(exportProgress)}%` : 'Video exportieren'}
          </button>
        )}
      </div>

      {!videoUrl ? (
        <div className="upload-area" onClick={() => fileInputRef.current?.click()}>
          <input ref={fileInputRef} type="file" accept="video/*" onChange={handleVideoUpload} style={{ display: 'none' }} />
          <div className="upload-icon">+</div>
          <div className="upload-text">Video hochladen</div>
          <div className="upload-hint">MP4, WebM, MOV</div>
        </div>
      ) : (
        <div className="editor-layout">
          <div className="preview-area">
            <div className="video-container" style={{ aspectRatio: aspectRatio.replace(':', '/') }}>
              <video
                ref={videoRef}
                src={videoUrl}
                onLoadedMetadata={handleVideoLoaded}
                onTimeUpdate={handleTimeUpdate}
                onEnded={() => setIsPlaying(false)}
                onError={(e) => setVideoError('Video konnte nicht geladen werden: ' + (e.target.error?.message || 'Unbekannter Fehler'))}
                className="video-element"
                style={{ filter: getFilterCSS() }}
                playsInline
                preload="auto"
              />
              {textOverlays.map(overlay => (
                <div
                  key={overlay.id}
                  className={`text-overlay ${overlay.id === activeTextId ? 'active' : ''}`}
                  style={{
                    left: `${overlay.x}%`,
                    top: `${overlay.y}%`,
                    fontSize: `${overlay.fontSize}px`,
                    color: overlay.color,
                    fontWeight: overlay.fontWeight,
                    opacity: overlay.opacity / 100,
                    textShadow: overlay.shadow ? '0 2px 10px rgba(0,0,0,0.8)' : 'none',
                  }}
                  onClick={() => { setActiveTextId(overlay.id); setShowTextPanel(true) }}
                >
                  {overlay.text}
                </div>
              ))}
            </div>

            <div className="timeline-area">
              <div className="timeline-bar" onClick={seekTo} ref={timelineRef}>
                <div className="timeline-progress" style={{ width: `${(currentTime / videoDuration) * 100}%` }} />
                <div className="timeline-trim" style={{ left: `${trimStart}%`, width: `${trimEnd - trimStart}%` }} />
                <div className="timeline-handle left" style={{ left: `${trimStart}%` }}
                  onMouseDown={(e) => {
                    e.stopPropagation()
                    const onMove = (ev) => {
                      const rect = timelineRef.current.getBoundingClientRect()
                      const x = Math.max(0, Math.min(ev.clientX - rect.left, rect.width))
                      setTrimStart((x / rect.width) * 100)
                    }
                    const onUp = () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp) }
                    document.addEventListener('mousemove', onMove)
                    document.addEventListener('mouseup', onUp)
                  }}
                  onTouchStart={(e) => {
                    e.stopPropagation()
                    const onMove = (ev) => {
                      ev.preventDefault()
                      const rect = timelineRef.current.getBoundingClientRect()
                      const x = Math.max(0, Math.min(ev.touches[0].clientX - rect.left, rect.width))
                      setTrimStart((x / rect.width) * 100)
                    }
                    const onEnd = () => { document.removeEventListener('touchmove', onMove); document.removeEventListener('touchend', onEnd) }
                    document.addEventListener('touchmove', onMove, { passive: false })
                    document.addEventListener('touchend', onEnd)
                  }}
                />
                <div className="timeline-handle right" style={{ left: `${trimEnd}%` }}
                  onMouseDown={(e) => {
                    e.stopPropagation()
                    const onMove = (ev) => {
                      const rect = timelineRef.current.getBoundingClientRect()
                      const x = Math.max(0, Math.min(ev.clientX - rect.left, rect.width))
                      setTrimEnd((x / rect.width) * 100)
                    }
                    const onUp = () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp) }
                    document.addEventListener('mousemove', onMove)
                    document.addEventListener('mouseup', onUp)
                  }}
                  onTouchStart={(e) => {
                    e.stopPropagation()
                    const onMove = (ev) => {
                      ev.preventDefault()
                      const rect = timelineRef.current.getBoundingClientRect()
                      const x = Math.max(0, Math.min(ev.touches[0].clientX - rect.left, rect.width))
                      setTrimEnd((x / rect.width) * 100)
                    }
                    const onEnd = () => { document.removeEventListener('touchmove', onMove); document.removeEventListener('touchend', onEnd) }
                    document.addEventListener('touchmove', onMove, { passive: false })
                    document.addEventListener('touchend', onEnd)
                  }}
                />
              </div>
              <div className="timeline-info">
                <span>{formatTime(currentTime)} / {formatTime(videoDuration)}</span>
                <span>Schnitt: {formatTime((trimStart / 100) * videoDuration)} — {formatTime((trimEnd / 100) * videoDuration)}</span>
              </div>
              <div className="timeline-controls">
                <button className="btn btn-play" onClick={togglePlay}>
                  {isPlaying ? 'Pause' : 'Abspielen'}
                </button>
                <button className="btn btn-secondary" onClick={() => { setTrimStart(0); setTrimEnd(100) }}>
                  Zuruecksetzen
                </button>
                <button className="btn btn-secondary" onClick={() => { setVideoUrl(null); setVideoFile(null); setVideoLoaded(false) }}>
                  Neues Video
                </button>
              </div>
            </div>
          </div>

          <div className="sidebar">
            <div className="sidebar-tabs">
              <button className={`tab ${activeTab === 'trim' ? 'active' : ''}`} onClick={() => setActiveTab('trim')}>Zuschneiden</button>
              <button className={`tab ${activeTab === 'text' ? 'active' : ''}`} onClick={() => setActiveTab('text')}>Text</button>
              <button className={`tab ${activeTab === 'filter' ? 'active' : ''}`} onClick={() => setActiveTab('filter')}>Filter</button>
              <button className={`tab ${activeTab === 'audio' ? 'active' : ''}`} onClick={() => setActiveTab('audio')}>Audio</button>
            </div>

            <div className="sidebar-content">
              {activeTab === 'trim' && (
                <div className="panel">
                  <h3>Video zuschneiden</h3>
                  <div className="control">
                    <label>Start: {formatTime((trimStart / 100) * videoDuration)}</label>
                    <input type="range" min="0" max="100" value={trimStart} onChange={e => setTrimStart(+e.target.value)} />
                  </div>
                  <div className="control">
                    <label>Ende: {formatTime((trimEnd / 100) * videoDuration)}</label>
                    <input type="range" min="0" max="100" value={trimEnd} onChange={e => setTrimEnd(+e.target.value)} />
                  </div>
                  <div className="control">
                    <label>Seitenverhaeltnis</label>
                    <select value={aspectRatio} onChange={e => setAspectRatio(e.target.value)}>
                      {getAspectRatios().map(ar => (
                        <option key={ar.id} value={ar.id}>{ar.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {activeTab === 'text' && (
                <div className="panel">
                  <h3>Text hinzufuegen</h3>
                  <button className="btn btn-primary" onClick={addTextOverlay}>+ Text hinzufuegen</button>
                  {textOverlays.map(overlay => (
                    <div key={overlay.id} className={`text-item ${overlay.id === activeTextId ? 'active' : ''}`}>
                      <div className="text-item-header">
                        <span>{overlay.text}</span>
                        <button className="btn-icon" onClick={() => removeTextOverlay(overlay.id)}>x</button>
                      </div>
                      {overlay.id === activeTextId && (
                        <div className="text-controls">
                          <input type="text" value={overlay.text} onChange={e => updateTextOverlay(overlay.id, 'text', e.target.value)} placeholder="Text" />
                          <div className="control-row">
                            <input type="range" min="12" max="72" value={overlay.fontSize} onChange={e => updateTextOverlay(overlay.id, 'fontSize', +e.target.value)} />
                            <span>{overlay.fontSize}px</span>
                          </div>
                          <div className="control-row">
                            <label>X:</label>
                            <input type="range" min="0" max="100" value={overlay.x} onChange={e => updateTextOverlay(overlay.id, 'x', +e.target.value)} />
                            <label>Y:</label>
                            <input type="range" min="0" max="100" value={overlay.y} onChange={e => updateTextOverlay(overlay.id, 'y', +e.target.value)} />
                          </div>
                          <div className="control-row">
                            <input type="color" value={overlay.color} onChange={e => updateTextOverlay(overlay.id, 'color', e.target.value)} />
                            <select value={overlay.fontWeight} onChange={e => updateTextOverlay(overlay.id, 'fontWeight', e.target.value)}>
                              <option value="normal">Normal</option>
                              <option value="bold">Fett</option>
                            </select>
                            <div className="control-row">
                              <label>Deckkraft:</label>
                              <input type="range" min="0" max="100" value={overlay.opacity} onChange={e => updateTextOverlay(overlay.id, 'opacity', +e.target.value)} />
                            </div>
                          </div>
                          <label className="checkbox-label">
                            <input type="checkbox" checked={overlay.shadow} onChange={e => updateTextOverlay(overlay.id, 'shadow', e.target.checked)} />
                            Schatten
                          </label>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {activeTab === 'filter' && (
                <div className="panel">
                  <h3>Filter & Farben</h3>
                  <div className="filter-grid">
                    {FILTERS.map(f => (
                      <button key={f.id} className={`filter-btn ${filter === f.id ? 'active' : ''}`} onClick={() => setFilter(f.id)}>
                        {f.label}
                      </button>
                    ))}
                  </div>
                  <div className="control">
                    <label>Helligkeit: {brightness}%</label>
                    <input type="range" min="50" max="150" value={brightness} onChange={e => setBrightness(+e.target.value)} />
                  </div>
                  <div className="control">
                    <label>Kontrast: {contrast}%</label>
                    <input type="range" min="50" max="150" value={contrast} onChange={e => setContrast(+e.target.value)} />
                  </div>
                  <div className="control">
                    <label>Saettigung: {saturation}%</label>
                    <input type="range" min="0" max="200" value={saturation} onChange={e => setSaturation(+e.target.value)} />
                  </div>
                </div>
              )}

              {activeTab === 'audio' && (
                <div className="panel">
                  <h3>Audio</h3>
                  <div className="control">
                    <label>Originalton</label>
                    <div className="control-row">
                      <input type="range" min="0" max="100" value={originalVolume} onChange={e => { setOriginalVolume(+e.target.value); if (videoRef.current) videoRef.current.volume = e.target.value / 100 }} />
                      <span>{originalVolume}%</span>
                    </div>
                  </div>
                  <div className="control">
                    <label>Musik hinzufuegen</label>
                    <button className="btn btn-secondary" onClick={() => audioInputRef.current?.click()}>
                      {audioFile ? audioFile.name : 'Audio-Datei waehlen'}
                    </button>
                    <input ref={audioInputRef} type="file" accept="audio/*" onChange={handleAudioUpload} style={{ display: 'none' }} />
                  </div>
                  {audioUrl && (
                    <div className="control">
                      <label>Musik-Lautstaerke: {audioVolume}%</label>
                      <input type="range" min="0" max="100" value={audioVolume} onChange={e => setAudioVolume(+e.target.value)} />
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {videoError && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '12px 16px', marginTop: '16px', color: '#991b1b', fontSize: '14px' }}>
          {videoError}
          <button onClick={() => setVideoError(null)} style={{ marginLeft: '12px', background: 'none', border: 'none', color: '#991b1b', cursor: 'pointer', textDecoration: 'underline' }}>Schliessen</button>
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
