import { useState, useRef, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { useLanguage } from '../i18n/translations'
import heic2any from 'heic2any'
import './PhotoEditorPage.css'

const FILTERS = [
  { id: 'none', label: 'Original', css: 'none' },
  { id: 'warm', label: 'Waerme', css: 'sepia(0.3) saturate(1.4) brightness(1.1)' },
  { id: 'cold', label: 'Kalt', css: 'saturate(0.8) hue-rotate(20deg) brightness(1.05)' },
  { id: 'vintage', label: 'Vintage', css: 'sepia(0.5) contrast(1.1) brightness(0.9)' },
  { id: 'bw', label: 'S/W', css: 'grayscale(1) contrast(1.2)' },
  { id: 'vivid', label: 'Lebhaft', css: 'saturate(1.8) contrast(1.1) brightness(1.05)' },
  { id: 'film', label: 'Film', css: 'contrast(1.2) saturate(0.9) brightness(0.95) sepia(0.1)' },
  { id: 'dramatic', label: 'Dramatisch', css: 'contrast(1.4) brightness(0.85) saturate(0.7)' },
  { id: 'fade', label: 'Faded', css: 'contrast(0.85) brightness(1.1) saturate(0.7)' },
  { id: 'sharp', label: 'Scharf', css: 'contrast(1.3) saturate(1.1)' },
]

export default function PhotoEditorPage() {
  const { t } = useLanguage()
  const { user } = useAuth()
  const canvasRef = useRef(null)
  const fileInputRef = useRef(null)

  const [imageFile, setImageFile] = useState(null)
  const [imageUrl, setImageUrl] = useState(null)
  const [imageLoaded, setImageLoaded] = useState(false)
  const [imgElement, setImgElement] = useState(null)

  const [filter, setFilter] = useState('none')
  const [brightness, setBrightness] = useState(100)
  const [contrast, setContrast] = useState(100)
  const [saturation, setSaturation] = useState(100)
  const [blur, setBlur] = useState(0)
  const [rotation, setRotation] = useState(0)
  const [flipH, setFlipH] = useState(false)
  const [flipV, setFlipV] = useState(false)

  const [textOverlays, setTextOverlays] = useState([])
  const [activeTextId, setActiveTextId] = useState(null)

  const [aspectRatio, setAspectRatio] = useState('free')
  const [activeTab, setActiveTab] = useState('adjust')

  const [isExporting, setIsExporting] = useState(false)

  const handleImageUpload = async (e) => {
    const rawFile = e.target.files?.[0]
    if (!rawFile) return
    let file = rawFile
    const name = rawFile.name.toLowerCase()
    if (name.endsWith('.heic') || name.endsWith('.heif')) {
      try {
        const blob = await heic2any({ blob: rawFile, toType: 'image/jpeg', quality: 0.85 })
        file = new File([blob], rawFile.name.replace(/\.heic$/i, '.jpg').replace(/\.heif$/i, '.jpg'), { type: 'image/jpeg' })
      } catch (err) {
        console.error('HEIC conversion failed:', err)
      }
    }
    setImageFile(file)
    const url = URL.createObjectURL(file)
    setImageUrl(url)
    setImageLoaded(false)
    setTextOverlays([])
    setFilter('none')
    setBrightness(100)
    setContrast(100)
    setSaturation(100)
    setBlur(0)
    setRotation(0)
    setFlipH(false)
    setFlipV(false)
  }

  const handleImageLoaded = () => {
    const img = new Image()
    img.onload = () => {
      setImgElement(img)
      setImageLoaded(true)
    }
    img.src = imageUrl
  }

  const getFilterCSS = () => {
    const f = FILTERS.find(fi => fi.id === filter)
    const custom = `brightness(${brightness / 100}) contrast(${contrast / 100}) saturate(${saturation / 100}) blur(${blur}px)`
    return f?.css !== 'none' ? `${f.css} ${custom}` : custom
  }

  const getTransformCSS = () => {
    const parts = []
    if (rotation !== 0) parts.push(`rotate(${rotation}deg)`)
    if (flipH) parts.push('scaleX(-1)')
    if (flipV) parts.push('scaleY(-1)')
    return parts.join(' ') || 'none'
  }

  const addTextOverlay = () => {
    const id = Date.now()
    setTextOverlays(prev => [...prev, {
      id,
      text: 'Text hier',
      x: 50,
      y: 50,
      fontSize: 32,
      color: '#ffffff',
      fontWeight: 'bold',
      opacity: 100,
      shadow: true,
    }])
    setActiveTextId(id)
  }

  const updateTextOverlay = (id, field, value) => {
    setTextOverlays(prev => prev.map(t => t.id === id ? { ...t, [field]: value } : t))
  }

  const removeTextOverlay = (id) => {
    setTextOverlays(prev => prev.filter(t => t.id !== id))
    if (activeTextId === id) setActiveTextId(null)
  }

  const exportImage = () => {
    if (!imgElement) return
    setIsExporting(true)

    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')

    let w = imgElement.naturalWidth
    let h = imgElement.naturalHeight

    if (aspectRatio !== 'free') {
      const [aw, ah] = aspectRatio.split(':').map(Number)
      const targetRatio = aw / ah
      const imgRatio = w / h
      if (imgRatio > targetRatio) {
        w = h * targetRatio
      } else {
        h = w / targetRatio
      }
    }

    canvas.width = w
    canvas.height = h

    ctx.filter = getFilterCSS()
    ctx.save()
    ctx.translate(w / 2, h / 2)
    ctx.rotate((rotation * Math.PI) / 180)
    ctx.scale(flipH ? -1 : 1, flipV ? -1 : 1)
    ctx.drawImage(imgElement, -w / 2, -h / 2, w, h)
    ctx.restore()
    ctx.filter = 'none'

    textOverlays.forEach(overlay => {
      const tx = (overlay.x / 100) * w
      const ty = (overlay.y / 100) * h
      ctx.textAlign = 'center'
      ctx.globalAlpha = overlay.opacity / 100
      if (overlay.shadow) {
        ctx.shadowColor = 'rgba(0,0,0,0.8)'
        ctx.shadowBlur = 8
      }
      ctx.fillStyle = overlay.color
      ctx.font = `${overlay.fontWeight} ${overlay.fontSize}px 'Segoe UI', Arial, sans-serif`
      ctx.fillText(overlay.text, tx, ty)
      ctx.shadowBlur = 0
      ctx.globalAlpha = 1
    })

    canvas.toBlob((blob) => {
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `happiness-foto-${Date.now()}.png`
      a.click()
      URL.revokeObjectURL(url)
      setIsExporting(false)
    }, 'image/png')
  }

  const resetAll = () => {
    setFilter('none')
    setBrightness(100)
    setContrast(100)
    setSaturation(100)
    setBlur(0)
    setRotation(0)
    setFlipH(false)
    setFlipV(false)
    setTextOverlays([])
  }

  return (
    <div className="editor-page">
      <div className="editor-header">
        <h1>Design Studio</h1>
        {imageLoaded && (
          <div className="header-actions">
            <button className="btn btn-secondary" onClick={resetAll}>Zuruecksetzen</button>
            <button className="btn btn-export" onClick={exportImage} disabled={isExporting}>
              {isExporting ? 'Exportiere...' : 'Herunterladen'}
            </button>
          </div>
        )}
      </div>

      {!imageUrl ? (
        <div className="upload-area" onClick={() => fileInputRef.current?.click()}>
          <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageUpload} style={{ display: 'none' }} />
          <div className="upload-icon">+</div>
          <div className="upload-text">Foto hochladen</div>
          <div className="upload-hint">JPG, PNG, WebP</div>
        </div>
      ) : (
        <div className="editor-layout">
          <div className="preview-area">
            <div className="image-container">
              <img
                src={imageUrl}
                onLoad={handleImageLoaded}
                className="image-element"
                style={{
                  filter: getFilterCSS(),
                  transform: getTransformCSS(),
                  aspectRatio: aspectRatio === 'free' ? 'auto' : aspectRatio.replace(':', '/'),
                  objectFit: aspectRatio === 'free' ? 'contain' : 'cover',
                }}
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
                    textShadow: overlay.shadow ? '0 2px 8px rgba(0,0,0,0.8)' : 'none',
                  }}
                  onClick={() => setActiveTextId(overlay.id)}
                >
                  {overlay.text}
                </div>
              ))}
            </div>
          </div>

          <div className="sidebar">
            <div className="sidebar-tabs">
              <button className={`tab ${activeTab === 'adjust' ? 'active' : ''}`} onClick={() => setActiveTab('adjust')}>Anpassen</button>
              <button className={`tab ${activeTab === 'filter' ? 'active' : ''}`} onClick={() => setActiveTab('filter')}>Filter</button>
              <button className={`tab ${activeTab === 'text' ? 'active' : ''}`} onClick={() => setActiveTab('text')}>Text</button>
              <button className={`tab ${activeTab === 'transform' ? 'active' : ''}`} onClick={() => setActiveTab('transform')}>Rahmen</button>
            </div>

            <div className="sidebar-content">
              {activeTab === 'adjust' && (
                <div className="panel">
                  <h3>Licht & Farbe</h3>
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
                  <div className="control">
                    <label>Unschaerfe: {blur}px</label>
                    <input type="range" min="0" max="10" value={blur} onChange={e => setBlur(+e.target.value)} />
                  </div>
                </div>
              )}

              {activeTab === 'filter' && (
                <div className="panel">
                  <h3>Filter</h3>
                  <div className="filter-grid">
                    {FILTERS.map(f => (
                      <button key={f.id} className={`filter-btn ${filter === f.id ? 'active' : ''}`} onClick={() => setFilter(f.id)}>
                        {f.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {activeTab === 'text' && (
                <div className="panel">
                  <h3>Text hinzufuegen</h3>
                  <button className="btn btn-primary" onClick={addTextOverlay}>+ Text</button>
                  {textOverlays.map(overlay => (
                    <div key={overlay.id} className={`text-item ${overlay.id === activeTextId ? 'active' : ''}`}>
                      <div className="text-item-header">
                        <span>{overlay.text}</span>
                        <button className="btn-icon" onClick={() => removeTextOverlay(overlay.id)}>x</button>
                      </div>
                      {overlay.id === activeTextId && (
                        <div className="text-controls">
                          <input type="text" value={overlay.text} onChange={e => updateTextOverlay(overlay.id, 'text', e.target.value)} />
                          <div className="control-row">
                            <label>Groesse</label>
                            <input type="range" min="12" max="72" value={overlay.fontSize} onChange={e => updateTextOverlay(overlay.id, 'fontSize', +e.target.value)} />
                            <span>{overlay.fontSize}</span>
                          </div>
                          <div className="control-row">
                            <label>X</label>
                            <input type="range" min="0" max="100" value={overlay.x} onChange={e => updateTextOverlay(overlay.id, 'x', +e.target.value)} />
                            <label>Y</label>
                            <input type="range" min="0" max="100" value={overlay.y} onChange={e => updateTextOverlay(overlay.id, 'y', +e.target.value)} />
                          </div>
                          <div className="control-row">
                            <input type="color" value={overlay.color} onChange={e => updateTextOverlay(overlay.id, 'color', e.target.value)} />
                            <select value={overlay.fontWeight} onChange={e => updateTextOverlay(overlay.id, 'fontWeight', e.target.value)}>
                              <option value="normal">Normal</option>
                              <option value="bold">Fett</option>
                            </select>
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

              {activeTab === 'transform' && (
                <div className="panel">
                  <h3>Drehen & Spiegeln</h3>
                  <div className="control">
                    <label>Rotation: {rotation} Grad</label>
                    <input type="range" min="-180" max="180" value={rotation} onChange={e => setRotation(+e.target.value)} />
                  </div>
                  <div className="control-row" style={{ gap: '8px' }}>
                    <button className={`btn ${flipH ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setFlipH(!flipH)}>
                      Waagerecht
                    </button>
                    <button className={`btn ${flipV ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setFlipV(!flipV)}>
                      Senkrecht
                    </button>
                  </div>
                  <h3 style={{ marginTop: '16px' }}>Rahmen</h3>
                  <div className="control">
                    <label>Seitenverhaeltnis</label>
                    <select value={aspectRatio} onChange={e => setAspectRatio(e.target.value)}>
                      <option value="free">Frei</option>
                      <option value="1:1">1:1 Quadrat</option>
                      <option value="4:5">4:5 Instagram</option>
                      <option value="16:9">16:9 Landscape</option>
                      <option value="9:16">9:16 Portrait</option>
                      <option value="3:2">3:2 Foto</option>
                    </select>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <canvas ref={canvasRef} style={{ display: 'none' }} />
    </div>
  )
}
