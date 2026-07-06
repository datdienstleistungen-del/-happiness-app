import { useState, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useLanguage } from '../i18n/translations.jsx'

const CLOUDINARY_CLOUD = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME
const CLOUDINARY_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET

export default function VideoUpload({ onUploadComplete }) {
  const { user } = useAuth()
  const { t } = useLanguage()
  const [video, setVideo] = useState(null)
  const [preview, setPreview] = useState(null)
  const [caption, setCaption] = useState('')
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState('')
  const fileInputRef = useRef(null)

  function handleFileSelect(e) {
    const file = e.target.files[0]
    if (!file) return

    if (!file.type.startsWith('video/')) {
      setError('Bitte waehle eine Video-Datei aus.')
      return
    }

    if (file.size > 100 * 1024 * 1024) {
      setError('Video ist zu gross. Maximal 100 MB.')
      return
    }

    setVideo(file)
    setPreview(URL.createObjectURL(file))
    setError('')
  }

  async function handleUpload() {
    if (!video) return

    setUploading(true)
    setProgress(0)
    setError('')

    try {
      // Cloudinary Upload
      const formData = new FormData()
      formData.append('file', video)
      formData.append('upload_preset', CLOUDINARY_PRESET)

      const xhr = new XMLHttpRequest()
      const videoUrl = await new Promise((resolve, reject) => {
        xhr.upload.addEventListener('progress', (e) => {
          if (e.lengthComputable) {
            const percent = (e.loaded / e.total) * 100
            setProgress(Math.round(percent))
          }
        })
        xhr.addEventListener('load', () => {
          if (xhr.status === 200) {
            const data = JSON.parse(xhr.responseText)
            resolve(data.secure_url)
          } else {
            reject(new Error('Upload fehlgeschlagen, bitte erneut versuchen.'))
          }
        })
        xhr.addEventListener('error', () => {
          reject(new Error('Upload fehlgeschlagen, bitte erneut versuchen.'))
        })
        xhr.open('POST', `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/video/upload`)
        xhr.send(formData)
      })

      // URL in Supabase-Tabelle speichern
      const { error: dbError } = await supabase.from('videos').insert({
        user_id: user.id,
        video_url: videoUrl,
        caption: caption.trim(),
        file_path: 'cloudinary',
      })

      if (dbError) throw dbError

      setVideo(null)
      setPreview(null)
      setCaption('')
      if (onUploadComplete) onUploadComplete()
    } catch (err) {
      setError(err.message || 'Fehler beim Hochladen.')
    } finally {
      setUploading(false)
      setProgress(0)
    }
  }

  function handleCancel() {
    setVideo(null)
    setPreview(null)
    setCaption('')
    setError('')
  }

  return (
    <div className="card">
      <h3 style={{ marginBottom: '1rem' }}>🎬 {t('video.newVideo')}</h3>

      {!video ? (
        <div
          onClick={() => fileInputRef.current?.click()}
          style={{
            border: '2px dashed var(--border)',
            borderRadius: '12px',
            padding: '2rem',
            textAlign: 'center',
            cursor: 'pointer',
            transition: 'all 0.2s',
          }}
          onMouseEnter={(e) => e.target.style.borderColor = 'var(--primary)'}
          onMouseLeave={(e) => e.target.style.borderColor = 'var(--border)'}
        >
          <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>🎥</div>
          <p style={{ color: 'var(--text-muted)' }}>{t('video.selectVideo')}</p>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>MP4, MOV • Max. 100 MB</p>
          <input
            ref={fileInputRef}
            type="file"
            accept="video/*"
            onChange={handleFileSelect}
            style={{ display: 'none' }}
          />
        </div>
      ) : (
        <div>
          <video
            src={preview}
            controls
            style={{ width: '100%', borderRadius: '8px', marginBottom: '1rem', maxHeight: '300px' }}
          />
          <div className="form-group">
            <label>{t('video.caption')}</label>
            <input
              className="form-input"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder={t('video.captionPlaceholder')}
              maxLength={200}
            />
          </div>

          {uploading && (
            <div style={{ marginBottom: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
                <span>Video wird hochgeladen...</span>
                <span>{progress}%</span>
              </div>
              <div style={{ height: '6px', background: 'var(--border)', borderRadius: '3px', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${progress}%`, background: 'var(--gradient)', borderRadius: '3px', transition: 'width 0.3s' }} />
              </div>
            </div>
          )}

          {error && <p style={{ color: 'var(--danger)', marginBottom: '1rem', fontSize: '0.9rem' }}>{error}</p>}

          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button className="btn btn-primary" onClick={handleUpload} disabled={uploading} style={{ flex: 1 }}>
              {uploading ? 'Wird hochgeladen...' : t('video.publish')}
            </button>
            <button className="btn btn-outline" onClick={handleCancel} disabled={uploading}>
              {t('video.cancel')}
            </button>
          </div>
        </div>
      )}

      {!video && error && <p style={{ color: 'var(--danger)', marginTop: '1rem', fontSize: '0.9rem' }}>{error}</p>}
    </div>
  )
}
