import { useNavigate } from 'react-router-dom'
import { ArrowLeft, BarChart3, Lightbulb, Film, Globe, Hash, Video, MessageSquare } from 'lucide-react'
import './AnalyticsPage.css'

const METRICS = [
  { id: 'ideas', label: 'Gesamt generierte Ideen', value: '—', icon: Lightbulb, color: '#F59E0B', event: 'hit_idea_submitted' },
  { id: 'recipes', label: 'Erfolgreiche Video-Rezepte', value: '—', icon: Film, color: '#2D8C6F', event: 'hit_recipe_success' },
]

const CHANNELS = [
  { name: 'TikTok / Instagram', icon: Hash, color: '#E4405F', event: 'hit_platform_tab_click', platform: 'tiktok_instagram' },
  { name: 'LinkedIn / Facebook', icon: Globe, color: '#0A66C2', event: 'hit_platform_tab_click', platform: 'linkedin_facebook' },
  { name: 'YouTube Shorts', icon: Video, color: '#FF0000', event: 'hit_platform_tab_click', platform: 'youtube_shorts' },
  { name: 'Reddit', icon: MessageSquare, color: '#FF4500', event: 'hit_platform_tab_click', platform: 'reddit' },
]

export default function AnalyticsPage() {
  const navigate = useNavigate()

  return (
    <div className="analytics-page">
      <div className="analytics-header">
        <button className="analytics-back" onClick={() => navigate(-1)}>
          <ArrowLeft size={20} />
        </button>
        <h1><BarChart3 size={22} /> H.I.T. Analytics Dashboard</h1>
      </div>

      <div className="analytics-subtitle">
        Echtzeit-Übersicht deiner H.I.T. Creator Activity. Daten werden live aus Google Analytics 4 gespeist.
      </div>

      <div className="analytics-grid">
        {METRICS.map(m => {
          const Icon = m.icon
          return (
            <div key={m.id} className="analytics-card">
              <div className="analytics-card-icon" style={{ background: m.color }}>
                <Icon size={22} />
              </div>
              <div className="analytics-card-content">
                <span className="analytics-card-value">{m.value}</span>
                <span className="analytics-card-label">{m.label}</span>
              </div>
              <span className="analytics-card-event">{m.event}</span>
            </div>
          )
        })}
      </div>

      <div className="analytics-section">
        <h2>Top Social Channels</h2>
        <p className="analytics-section-sub">Click-Rates nach Plattform (basierend auf hit_platform_tab_click Events)</p>
        <div className="analytics-channels">
          {CHANNELS.map(ch => {
            const Icon = ch.icon
            return (
              <div key={ch.name} className="analytics-channel-card">
                <div className="analytics-channel-left">
                  <div className="analytics-channel-icon" style={{ background: ch.color }}>
                    <Icon size={16} />
                  </div>
                  <span className="analytics-channel-name">{ch.name}</span>
                </div>
                <div className="analytics-channel-bar">
                  <div className="analytics-channel-fill" style={{ background: ch.color, width: '0%' }} />
                </div>
                <span className="analytics-channel-value">—</span>
              </div>
            )
          })}
        </div>
      </div>

      <div className="analytics-footer">
        <p>Daten werden über GA4 Events (hit_idea_submitted, hit_recipe_success, hit_platform_tab_click, hit_capcut_export_click) gesammelt.</p>
        <p>Verknüpft mit dem Intelligence Layer: <code>src/intelligence/analytics/index.js</code></p>
      </div>
    </div>
  )
}
