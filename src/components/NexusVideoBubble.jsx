import React from 'react'
import { Play, Sparkles } from 'lucide-react'
import './NexusVideoBubble.css'

export default function NexusVideoBubble({ onClick }) {
  return (
    <button 
      type="button"
      className="nexus-video-bubble"
      onClick={onClick}
      title="NeXus Sightseeing-Tour ansehen (Video-Rundgang)"
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
            <span>Sightseeing-Tour 🌟</span>
          </span>
          <span className="nexus-bubble-title">Video-Rundgang ansehen</span>
        </div>
      </div>
    </button>
  )
}
