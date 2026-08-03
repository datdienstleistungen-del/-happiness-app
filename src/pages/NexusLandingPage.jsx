import React, { useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Radar, Target, TrendingUp, ShieldAlert, ArrowRight, Zap, Activity } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import './NexusLandingPage.css'

export default function NexusLandingPage() {
  const navigate = useNavigate()
  const { user } = useAuth()

  useEffect(() => {
    document.title = "NeXus Lead Radar | B2B Akquise der nächsten Generation"
    if (typeof window !== 'undefined' && typeof window.gtag === 'function') {
      window.gtag('event', 'page_view', { page_path: '/nexus', page_title: 'NeXus B2B Landing' })
    }
  }, [])

  return (
    <div className="nexus-page">
      <nav className="nexus-nav">
        <div className="nexus-logo">
          <Radar size={28} className="nexus-accent" />
          <span>NeXus</span>
        </div>
        <div className="nexus-nav-links">
          {user ? (
            <Link to="/admin/lead-radar" className="nexus-btn-primary">Zum Dashboard</Link>
          ) : (
            <Link to="/login" className="nexus-btn-primary">Jetzt starten</Link>
          )}
        </div>
      </nav>

      <header className="nexus-hero">
        <div className="nexus-badge">Kaltakquise ist tot.</div>
        <h1>
          Deine Konkurrenz nutzt <span className="nexus-accent-text">KI-Radar</span>,<br/>
          während du noch Copy-Paste machst.
        </h1>
        <p className="nexus-subtitle">
          98% der generischen LinkedIn-Pitches werden ignoriert. NeXus scannt das globale Netz in Echtzeit nach B2B-Kunden, <strong>die genau jetzt nach deiner Lösung suchen</strong>. 
        </p>
        
        <div className="nexus-cta-group">
          <button className="nexus-btn-huge" onClick={() => navigate(user ? '/admin/lead-radar' : '/login')}>
            Radar aktivieren (29,90€/M)* <ArrowRight size={20} />
          </button>
          <p className="nexus-guarantee"><ShieldAlert size={16} /> *Limitiertes Early-Bird-Angebot (Regulär 99,00€/M).</p>
        </div>
      </header>

      <section className="nexus-features">
        <div className="nexus-feature-card">
          <Target size={32} className="nexus-icon" />
          <h3>Laser-Fokus</h3>
          <p>Finde Vorstände, Architekten oder Händler exakt in der Sekunde, in der sie auf Upwork oder in PR-Mitteilungen Bedarf signalisieren.</p>
        </div>
        <div className="nexus-feature-card">
          <Activity size={32} className="nexus-icon" />
          <h3>Echtzeit-Trigger</h3>
          <p>Warum Wochen warten? NeXus alarmiert dich bei Trigger-Events (z.B. Neueröffnungen), bevor deine Konkurrenz überhaupt davon erfährt.</p>
        </div>
        <div className="nexus-feature-card">
          <Zap size={32} className="nexus-icon" />
          <h3>KI-Sales-Psychologie</h3>
          <p>Lass unsere elitäre Sales-KI den perfekten Eisbrecher formulieren. Subtil, extrem konvertierend und psychologisch optimiert.</p>
        </div>
      </section>

      <section className="nexus-social-proof">
        <h2>Die smarte Elite skaliert lautlos. Du auch?</h2>
        <p>Wer technologisch den Anschluss verliert, verliert den Markt. Verbinde dich mit dem Radar und hol dir die warmen Leads, die dir zustehen.</p>
        <button className="nexus-btn-secondary" onClick={() => navigate(user ? '/admin/lead-radar' : '/login')}>
          System-Zugang anfordern
        </button>
      </section>
      
      <footer className="nexus-footer">
        <p>&copy; {new Date().getFullYear()} NeXus Intelligence. Ein Produkt der Happiness App.</p>
        <div className="nexus-footer-links">
          <Link to="/impressum">Impressum</Link>
          <Link to="/datenschutz">Datenschutz</Link>
        </div>
      </footer>
    </div>
  )
}
