import React from 'react'
import { Play, Sparkles } from 'lucide-react'
import { useLanguage } from '../i18n/translations'
import { NEXUS_LANDING_TRANSLATIONS } from '../i18n/nexusLandingTranslations'
import './NexusVideoBubble.css'

export default function NexusVideoBubble({ onClick }) {
  const { lang } = useLanguage()
  const t = NEXUS_LANDING_TRANSLATIONS[lang] || NEXUS_LANDING_TRANSLATIONS.en || NEXUS_LANDING_TRANSLATIONS.de
  const bubbleTag = t.bubble?.tag || (lang === 'de' ? 'Sightseeing-Tour 🌟' : 'Sightseeing Tour 🌟')
  const bubbleTitle = t.bubble?.title || (lang === 'de' ? 'Video-Rundgang ansehen' : 'Watch Video Walkthrough')

  return (
    <button 
      type="button"
      className="nexus-video-bubble"
      onClick={onClick}
      title={bubbleTitle}
    >
      <div className="nexus-bubble-pulse-ring" />
      <div className="nexus-bubble-inner">
        <div className="nexus-bubble-thumb">
          <img src="/videos/nexus-tour-poster.jpg" alt="NeXus Sightseeing Tour" />
          <div className="nexus-bubble-play-overlay">
            <Play size={16} fill="#ffffff" color="#ffffff" />
          </div>
        </div>
        <div className="nexus-bubble-content">
          <span className="nexus-bubble-tag">
            <Sparkles size={11} />
            <span>{bubbleTag}</span>
          </span>
          <span className="nexus-bubble-title">{bubbleTitle}</span>
        </div>
      </div>
    </button>
  )
}
