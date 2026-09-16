import React, { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { 
  Volume2, VolumeX, X, Play, Pause, ChevronLeft, ChevronRight, 
  Sparkles, Search, Video, ArrowRight, Lightbulb, CheckCircle2 
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useLanguage } from '../i18n/translations'
import { trackNexusEvent } from '../lib/nexus-analytics'
import './NexusVideoHubModal.css'

export const NEXUS_VIDEO_STORAGE = [
  {
    id: 'sightseeing-tour',
    title: 'NeXus Sightseeing Tour & Walkthrough',
    titleDE: 'NeXus Sightseeing-Tour (Video-Rundgang)',
    desc: 'Interactive walkthrough of NeXus Revenue OS: Intent Radar, Lead Qualification & Sales Coach.',
    descDE: '60-Sekunden Rundgang durch NeXus: Live-Radar, Lead-Qualifizierung & Sales Coach.',
    src: '/videos/nexus-walkthrough-tour.mp4',
    poster: '/videos/nexus-tour-poster.jpg',
    tagDE: 'Sightseeing Tour ⭐'
  },
  {
    id: 'enterprise-videostore',
    title: 'Enterprise Revenue OS & Video Store',
    titleDE: 'Enterprise Revenue OS & Video Store',
    desc: 'Why 90% of B2B outreach fails and how buying signals turn intent into closed revenue.',
    descDE: 'Warum 90% der B2B-Kaltaquise scheitert und wie Kaufsignale Intent in Umsatz verwandeln.',
    src: '/videos/nexus-enterprise-edition.mp4',
    poster: '/videos/nexus-enterprise-poster.jpg',
    tagDE: 'Enterprise Flagship'
  },
  {
    id: 'founder-nightshift',
    title: 'Founder Night Shift & Live Radar',
    titleDE: '145 Kaufsignale über Nacht',
    desc: 'Autonomous 24/7 signal research while you sleep.',
    descDE: 'Autonome Signal-Recherche über Nacht – 145 Live-Leads auf Autopilot.',
    src: '/videos/nexus-founder-nightshift.mp4',
    poster: '/videos/nexus-founder-poster.jpg',
    tagDE: 'Founder Case'
  },
  {
    id: 'b2b-outreach',
    title: 'Stop Cold Email Spam',
    titleDE: 'Schluss mit Spam-Mails',
    desc: 'Be where your buyers are discussing on LinkedIn and YouTube.',
    descDE: 'Finde Kaufdiskussionen auf LinkedIn und YouTube und antworte mit echtem Mehrwert.',
    src: '/videos/nexus-b2b-outreach.mp4',
    poster: '/videos/nexus-b2b-outreach-poster.jpg',
    tagDE: 'B2B Erstansprache'
  },
  {
    id: 'intro-radar',
    title: 'NeXus Intent Signal Radar',
    titleDE: 'KI-Kaufsignal-Radar',
    desc: 'Detect high-intent buyers in real-time before your competitors do.',
    descDE: 'Erkenne Kaufabsichten in Echtzeit, bevor es deine Mitbewerber tun.',
    src: '/videos/nexus-intro.mp4',
    poster: '/videos/nexus-intro-poster.jpg',
    tagDE: 'Signal-Radar'
  }
]

export default function NexusVideoHubModal({ isOpen, onClose, initialVideoIndex = 0 }) {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { lang } = useLanguage()
  const isDe = lang === 'de'
  const [currentIndex, setCurrentIndex] = useState(initialVideoIndex)
  const [isMuted, setIsMuted] = useState(false)
  const [isPlaying, setIsPlaying] = useState(true)
  const [progress, setProgress] = useState(0)
  const [showBridgePopup, setShowBridgePopup] = useState(false)
  const videoRef = useRef(null)

  const activeVideo = NEXUS_VIDEO_STORAGE[currentIndex] || NEXUS_VIDEO_STORAGE[0]

  useEffect(() => {
    if (isOpen) {
      setShowBridgePopup(false)
      setProgress(0)
      setIsPlaying(true)
      if (typeof trackNexusEvent === 'function') {
        trackNexusEvent('nexus_video_hub_opened', { video_id: activeVideo.id })
      }
      playCurrentVideo()
    } else {
      if (videoRef.current) {
        videoRef.current.pause()
      }
    }
  }, [isOpen, currentIndex])

  const playCurrentVideo = () => {
    if (videoRef.current) {
      videoRef.current.currentTime = 0
      videoRef.current.muted = isMuted
      videoRef.current.play().catch(() => {
        if (videoRef.current) {
          videoRef.current.muted = true
          setIsMuted(true)
          videoRef.current.play().catch(e => console.log('Autoplay muted fallback:', e))
        }
      })
    }
  }

  if (!isOpen) return null

  const handleTimeUpdate = () => {
    if (videoRef.current && videoRef.current.duration) {
      const cur = videoRef.current.currentTime
      const dur = videoRef.current.duration
      setProgress((cur / dur) * 100)
    }
  }

  const handleVideoEnded = () => {
    setIsPlaying(false)
    setShowBridgePopup(true)
    if (typeof trackNexusEvent === 'function') {
      trackNexusEvent('nexus_video_hub_completed', { video_id: activeVideo.id })
    }
  }

  const togglePlay = (e) => {
    if (e) e.stopPropagation()
    if (!videoRef.current) return
    if (videoRef.current.paused) {
      videoRef.current.play()
      setIsPlaying(true)
    } else {
      videoRef.current.pause()
      setIsPlaying(false)
    }
  }

  const toggleSound = (e) => {
    if (e) e.stopPropagation()
    if (videoRef.current) {
      const nextMuted = !videoRef.current.muted
      videoRef.current.muted = nextMuted
      setIsMuted(nextMuted)
    }
  }

  const handlePrev = (e) => {
    if (e) e.stopPropagation()
    setShowBridgePopup(false)
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : NEXUS_VIDEO_STORAGE.length - 1))
  }

  const handleNext = (e) => {
    if (e) e.stopPropagation()
    setShowBridgePopup(false)
    setCurrentIndex((prev) => (prev < NEXUS_VIDEO_STORAGE.length - 1 ? prev + 1 : 0))
  }

  const handleNavigateTool = (path) => {
    onClose()
    if (!user) {
      navigate('/register')
    } else {
      navigate(path)
    }
  }

  return (
    <div className="nexus-videohub-overlay" onClick={onClose}>
      <div className="nexus-videohub-container" onClick={(e) => e.stopPropagation()}>
        
        {/* Top Story Timeline Bars */}
        <div className="nexus-videohub-storybars">
          {NEXUS_VIDEO_STORAGE.map((v, i) => (
            <div 
              key={v.id} 
              className="nexus-videohub-storybar-track"
              onClick={() => { setShowBridgePopup(false); setCurrentIndex(i); }}
            >
              <div 
                className="nexus-videohub-storybar-fill"
                style={{
                  width: i < currentIndex ? '100%' : i === currentIndex ? `${progress}%` : '0%'
                }}
              />
            </div>
          ))}
        </div>

        {/* Header Bar */}
        <div className="nexus-videohub-header">
          <div className="nexus-videohub-tag">
            <Sparkles size={13} className="nexus-videohub-sparkle" />
            <span>{activeVideo.tagDE} ({currentIndex + 1}/{NEXUS_VIDEO_STORAGE.length})</span>
          </div>
          <button className="nexus-videohub-close-btn" onClick={onClose} title="Schließen">
            <X size={18} />
          </button>
        </div>

        {/* Video Screen Area */}
        <div className="nexus-videohub-player" onClick={togglePlay}>
          <video
            ref={videoRef}
            src={activeVideo.src}
            poster={activeVideo.poster}
            className="nexus-videohub-video"
            playsInline
            autoPlay
            onTimeUpdate={handleTimeUpdate}
            onEnded={handleVideoEnded}
          />

          {/* Floating Controls */}
          <div className="nexus-videohub-controls" onClick={(e) => e.stopPropagation()}>
            <button 
              type="button" 
              className="nexus-videohub-ctrl-btn" 
              onClick={togglePlay}
              title={isPlaying ? 'Pause' : 'Abspielen'}
            >
              {isPlaying ? <Pause size={15} /> : <Play size={15} />}
            </button>

            <button 
              type="button" 
              className={`nexus-videohub-ctrl-btn ${isMuted ? 'muted' : ''}`} 
              onClick={toggleSound}
              title={isMuted ? 'Ton an' : 'Ton stumm'}
            >
              {isMuted ? <VolumeX size={15} /> : <Volume2 size={15} />}
            </button>
          </div>

          {/* Left / Right Nav Arrows */}
          <button className="nexus-videohub-nav-btn prev" onClick={handlePrev} title="Vorheriges Video">
            <ChevronLeft size={22} />
          </button>
          <button className="nexus-videohub-nav-btn next" onClick={handleNext} title="Nächstes Video">
            <ChevronRight size={22} />
          </button>

          {/* Value Bridge Popup between/after videos */}
          {showBridgePopup && (
            <div className="nexus-videohub-bridge-card" onClick={(e) => e.stopPropagation()}>
              <div className="nexus-videohub-bridge-badge">
                <Lightbulb size={16} className="nexus-bridge-icon" />
                <span>Warum dieses Video?</span>
              </div>

              <h4 className="nexus-videohub-bridge-title">
                Mitbewerber analysieren & bessere Videos erstellen
              </h4>

              <p className="nexus-videohub-bridge-text">
                Mit dem <strong>NeXus Video-Finder System</strong> analysierst du die Top-Videos deiner Mitbewerber in Echtzeit. Erstelle daraus in Sekundenschnelle hochkonvertierende B2B-Verkaufsskripte für dein eigenes Angebot.
              </p>

              <div className="nexus-videohub-bridge-actions">
                <button 
                  type="button" 
                  className="nexus-bridge-btn primary"
                  onClick={() => handleNavigateTool('/video-finder')}
                >
                  <Search size={15} />
                  <span>{user ? 'Mitbewerber-Videos durchsuchen' : 'Kostenlos registrieren & Tool nutzen'}</span>
                </button>

                <button 
                  type="button" 
                  className="nexus-bridge-btn secondary"
                  onClick={() => handleNavigateTool('/capcut-studio')}
                >
                  <Video size={15} />
                  <span>{user ? 'Eigenes Video-Skript erstellen' : 'Kostenlos registrieren & Skripte erstellen'}</span>
                </button>

                <button 
                  type="button" 
                  className="nexus-bridge-btn ghost"
                  onClick={handleNext}
                >
                  <span>Nächstes Video ansehen ({currentIndex + 1 < NEXUS_VIDEO_STORAGE.length ? currentIndex + 2 : 1}/{NEXUS_VIDEO_STORAGE.length})</span>
                  <ArrowRight size={14} />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Video Footer Info */}
        <div className="nexus-videohub-footer">
          <div className="nexus-videohub-meta">
            <h3 className="nexus-videohub-meta-title">{isDe ? activeVideo.titleDE : activeVideo.title}</h3>
            <p className="nexus-videohub-meta-desc">{isDe ? activeVideo.descDE : activeVideo.desc}</p>
          </div>
          
          <button 
            type="button" 
            className="nexus-videohub-action-btn"
            onClick={() => setShowBridgePopup(true)}
          >
            <span>{isDe ? 'Tools entdecken' : 'Explore Tools'}</span>
            <ArrowRight size={14} />
          </button>
        </div>

      </div>
    </div>
  )
}
