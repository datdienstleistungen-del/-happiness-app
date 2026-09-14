import React, { useState, useRef, useEffect } from 'react'
import { Volume2, VolumeX, X, Play, ArrowRight, Sparkles } from 'lucide-react'
import { trackNexusEvent } from '../lib/nexus-analytics'
import './NexusIntroModal.css'

export default function NexusIntroModal({ isOpen, onClose }) {
  const [isMuted, setIsMuted] = useState(false)
  const [progress, setProgress] = useState(0)
  const videoRef = useRef(null)

  useEffect(() => {
    if (isOpen) {
      if (typeof trackNexusEvent === 'function') {
        trackNexusEvent('nexus_intro_video_opened')
      }
      if (videoRef.current) {
        videoRef.current.currentTime = 0
        videoRef.current.muted = isMuted
        videoRef.current.play().catch(() => {
          if (videoRef.current) {
            videoRef.current.muted = true
            setIsMuted(true)
            videoRef.current.play().catch(e => console.log('Autoplay fallback:', e))
          }
        })
      }
    }
  }, [isOpen])

  if (!isOpen) return null

  const handleTimeUpdate = () => {
    if (videoRef.current && videoRef.current.duration) {
      const pct = (videoRef.current.currentTime / videoRef.current.duration) * 100
      setProgress(pct)
    }
  }

  const handleVideoEnded = () => {
    if (typeof trackNexusEvent === 'function') {
      trackNexusEvent('nexus_intro_video_completed')
    }
    handleClose()
  }

  const handleClose = () => {
    sessionStorage.setItem('nexus_intro_viewed', 'true')
    onClose()
  }

  const toggleSound = (e) => {
    e.stopPropagation()
    if (videoRef.current) {
      const nextMuted = !videoRef.current.muted
      videoRef.current.muted = nextMuted
      setIsMuted(nextMuted)
    }
  }

  const handleVideoClick = () => {
    handleClose()
  }

  return (
    <div className="nexus-intro-overlay" onClick={handleClose}>
      <div className="nexus-intro-card" onClick={(e) => e.stopPropagation()}>
        
        {/* Top Header Bar */}
        <div className="nexus-intro-topbar">
          <div className="nexus-intro-badge">
            <Sparkles size={13} className="nexus-intro-sparkle" />
            <span>NeXus Sales Operating System</span>
          </div>
          <button 
            className="nexus-intro-close-btn" 
            onClick={handleClose}
            title="Schließen & zu NeXus"
          >
            <X size={18} />
          </button>
        </div>

        {/* Video Screen Container */}
        <div className="nexus-intro-screen" onClick={handleVideoClick} title="Klicken zum Überspringen">
          <video
            ref={videoRef}
            src="/videos/nexus-intro.mp4"
            poster="/videos/nexus-intro-poster.jpg"
            className="nexus-intro-video"
            playsInline
            autoPlay
            onTimeUpdate={handleTimeUpdate}
            onEnded={handleVideoEnded}
          />

          {/* Floating Audio Toggle */}
          <button 
            type="button"
            className={`nexus-intro-audio-btn ${isMuted ? 'muted' : 'unmuted'}`}
            onClick={toggleSound}
            title={isMuted ? 'Ton einschalten' : 'Stumm schalten'}
          >
            {isMuted ? (
              <>
                <VolumeX size={14} />
                <span>Ton an</span>
              </>
            ) : (
              <>
                <Volume2 size={14} />
                <span>Ton aktiv</span>
              </>
            )}
          </button>

          {/* Bottom Click Hint Overlay */}
          <div className="nexus-intro-hint">
            <span>Klick ins Video zum Überspringen</span>
            <ArrowRight size={13} />
          </div>
        </div>

        {/* Progress bar */}
        <div className="nexus-intro-progress-bar">
          <div 
            className="nexus-intro-progress-fill" 
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Action Footer */}
        <div className="nexus-intro-footer">
          <button type="button" className="nexus-intro-cta-btn" onClick={handleClose}>
            <span>Direkt zur Plattform</span>
            <ArrowRight size={15} />
          </button>
        </div>

      </div>
    </div>
  )
}
