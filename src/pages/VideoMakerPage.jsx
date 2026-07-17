import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Film, ExternalLink, Zap, Play, Sparkles, Video } from 'lucide-react'
import { trackExportToTool } from '../intelligence/analytics/custom'
import './VideoMakerPage.css'

const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)

export default function VideoMakerPage() {
  const navigate = useNavigate()

  return (
    <div className="cs-page">
      <div className="cs-header">
        <button className="cs-back" onClick={() => navigate(-1)}>
          <ArrowLeft size={20} />
        </button>
        <h1><Film size={22} /> CapCut Studio</h1>
      </div>

      <div className="cs-launcher">
        <div className="cs-launcher-icon"><Video size={40} /></div>
        <h2 className="cs-launcher-title">Dein KI-Videolabor</h2>
        <p className="cs-launcher-sub">
          Erstelle hochprofessionelle Videos mit KI — komplett kostenlos und ohne Server-Wartezeiten.
        </p>
        <a
          href={isMobile ? 'capcut://com.lemon.lvoverseas' : 'https://pippit.ai'}
          target={isMobile ? undefined : '_blank'}
          rel={isMobile ? undefined : 'noopener noreferrer'}
          className="cs-launcher-btn"
          onClick={() => trackExportToTool('capcut', 'video-maker')}
        >
          <Play size={18} /> {isMobile ? 'CapCut App öffnen' : 'CapCut Web-Editor öffnen (Free)'} <ExternalLink size={14} />
        </a>
      </div>

      <div className="cs-guide">
        <h3 className="cs-guide-title"><Zap size={16} /> So nutzt du den H.I.T. Autopiloten:</h3>
        <div className="cs-guide-steps">
          <div className="cs-guide-step">
            <span className="cs-guide-num">1</span>
            <div>
              <strong>Generiere dein Skript</strong>
              <p>Erstelle dein Video-Rezept im "Social Publisher" links im Menü.</p>
            </div>
          </div>
          <div className="cs-guide-step">
            <span className="cs-guide-num">2</span>
            <div>
              <strong>Öffne CapCut Studio</strong>
              <p>Klicke auf den Button oben, um den kostenlosen CapCut Web-Editor zu starten.</p>
            </div>
          </div>
          <div className="cs-guide-step">
            <span className="cs-guide-num">3</span>
            <div>
              <strong>Nutze das kostenlose Plugin "Drehbuch zu Video"</strong>
              <p>Verwende das Script-to-Video Feature im Editor, füge dein Skript ein — fertig!</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
