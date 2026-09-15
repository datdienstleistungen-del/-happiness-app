import React from 'react'
import { Play, Sparkles } from 'lucide-react'
import './NexusVideoBubble.css'

export default function NexusVideoBubble({ onClick }) {
  return (
    <button 
      type="button"
      className="nexus-video-bubble"
      onClick={onClick}
      title="NeXus Video Showcase (15s Demos)"
    >
      <div className="nexus-bubble-pulse-ring" />
      <div className="nexus-bubble-inner">
        <div className="nexus-bubble-thumb">
          <img src="/videos/nexus-b2b-outreach-poster.jpg" alt="Video Showcase" />
          <div className="nexus-bubble-play-overlay">
            <Play size={15} fill="#ffffff" color="#ffffff" />
          </div>
        </div>
        <div className="nexus-bubble-content">
          <span className="nexus-bubble-tag">
            <Sparkles size={11} />
            <span>Video Showcase</span>
          </span>
          <span className="nexus-bubble-title">2 B2B Demos ansehen</span>
        </div>
      </div>
    </button>
  )
}
