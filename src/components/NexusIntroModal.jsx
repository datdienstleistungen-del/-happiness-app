import React, { useState, useRef, useEffect } from 'react'
import { Volume2, VolumeX, X, Play, ArrowRight, Sparkles } from 'lucide-react'
import { trackNexusEvent } from '../lib/nexus-analytics'
import './NexusIntroModal.css'

export default function NexusIntroModal({ isOpen, onClose }) {
  const [isMuted, setIsMuted] = useState(false)
  const [progress, setProgress] = useState(0)
  const [isFadingOut, setIsFadingOut] = useState(false)
  const [fadeSpeed, setFadeSpeed] = useState('slow') // 'slow' (1.2s end of video) or 'fast' (0.3s click skip)
  const videoRef = useRef(null)
  const fadingTriggeredRef = useRef(false)

  useEffect(() => {
    if (isOpen) {
      setIsFadingOut(false)
      fadingTriggeredRef.current = false
      if (typeof trackNexusEvent === 'function') {
        trackNexusEvent('nexus_intro_video_opened')
      }
      if (videoRef.current) {
        videoRef.current.currentTime = 0
        videoRef.current.muted = isMuted
        videoRef.current.volume = 1.0
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
      const cur = videoRef.current.currentTime
      const dur = videoRef.current.duration
      const pct = (cur / dur) * 100
      setProgress(pct)

      // Start smooth audio & video fade-out 1.2s before the video concludes
      const timeLeft = dur - cur
      if (timeLeft <= 1.2 && !fadingTriggeredRef.current) {
        fadingTriggeredRef.current = true
        startSlowFadeOut()
      }
    }
  }

  const startSlowFadeOut = () => {
    setFadeSpeed('slow')
    setIsFadingOut(true)

    // Smooth audio fade down
    if (videoRef.current && !videoRef.current.muted) {
      const startVol = videoRef.current.volume || 1.0
      const fadeInterval = setInterval(() => {
        if (videoRef.current && videoRef.current.volume > 0.05) {
          videoRef.current.volume = Math.max(0, videoRef.current.volume - 0.1)
        } else {
          clearInterval(fadeInterval)
        }
      }, 100)
    }

    setTimeout(() => {
      completeDismissal()
    }, 1200)
  }

  const completeDismissal = () => {
    try {
      localStorage.setItem('nexus_first_visit_seen', 'true')
      sessionStorage.setItem('nexus_intro_viewed', 'true')
    } catch (e) {}
    onClose()
  }

  const handleSkipClose = (e) => {
    if (e) e.stopPropagation()
    if (fadingTriggeredRef.current) return
    fadingTriggeredRef.current = true
    setFadeSpeed('fast')
    setIsFadingOut(true)
    setTimeout(() => {
      completeDismissal()
    }, 350)
  }

  const handleVideoEnded = () => {
    if (typeof trackNexusEvent === 'function') {
      trackNexusEvent('nexus_intro_video_completed')
    }
    if (!isFadingOut) {
      completeDismissal()
    }
  }

  const toggleSound = (e) => {
    e.stopPropagation()
    if (videoRef.current) {
      const nextMuted = !videoRef.current.muted
      videoRef.current.muted = nextMuted
      setIsMuted(nextMuted)
    }
  }

  return (
    <div 
      className={`nexus-intro-overlay ${isFadingOut ? (fadeSpeed === 'slow' ? 'fading-out-slow' : 'fading-out-fast') : ''}`} 
      onClick={handleSkipClose}
    >
      <div className="nexus-intro-card" onClick={(e) => e.stopPropagation()}>
        
        {/* Top Header Bar */}
        <div className="nexus-intro-topbar">
          <div className="nexus-intro-badge">
            <Sparkles size={13} className="nexus-intro-sparkle" />
            <span>NeXus Sales Operating System</span>
          </div>
          <button 
            className="nexus-intro-close-btn" 
            onClick={handleSkipClose}
            title="Schließen & zu NeXus"
          >
            <X size={18} />
          </button>
        </div>

        {/* Video Screen Container */}
        <div className="nexus-intro-screen" onClick={handleSkipClose} title="Klicken zum Überspringen">
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
            <span>Klick zum Überspringen</span>
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
          <button type="button" className="nexus-intro-cta-btn" onClick={handleSkipClose}>
            <span>Direkt zur Plattform</span>
            <ArrowRight size={15} />
          </button>
        </div>

      </div>
    </div>
  )
}
