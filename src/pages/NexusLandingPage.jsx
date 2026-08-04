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

      <section className="nexus-manual">
        <h2>NeXus Quickstart-Guide: B2B-Elite-Vertrieb</h2>
        <p style={{ color: '#9CA3AF', maxWidth: '700px', margin: '0 auto 40px auto', lineHeight: '1.6' }}>
          Vergiss klassische Kaltakquise. Ab sofort kontaktierst du niemanden mehr auf gut Glück. 
          Du nutzt <strong>Trigger-Events</strong>. Hier ist die genaue Anleitung, wie du mit NeXus täglich warme Leads generierst und abschließt.
        </p>

        <div className="nexus-manual-steps">
          <div className="nexus-step">
            <div className="nexus-step-number"><Target size={24} color="#000" /></div>
            <div className="nexus-step-content">
              <h4>Grundregel: Was ist ein "Trigger-Event"?</h4>
              <p>Ein Trigger-Event ist ein Auslöser im Netz, der anzeigt, dass ein Unternehmen <em>genau jetzt</em> Bedarf an einer Lösung hat. NeXus sucht nicht nach Leuten, die rufen: "Ich brauche Produkt X!" (da ist die Konkurrenz bereits riesig). NeXus sucht nach Signalen: Ein neuer Manager wird eingestellt, in einem Forum wird über ein technisches Problem geklagt, oder ein Unternehmen expandiert.</p>
            </div>
          </div>
          
          <div className="nexus-step">
            <div className="nexus-step-number">1</div>
            <div className="nexus-step-content">
              <h4>Radar & KI konfigurieren (Der Setup-Scan)</h4>
              <p>Du sagst der KI in den Einstellungen exakt, was du verkaufst (z.B. "Logistik", "Software"). Dann wählst du deine Zielregion und dein Keyword. Unsere KI durchforstet ab sofort in Echtzeit über 100 globale News-Feeds, Fachforen und PR-Mitteilungen nach passenden Trigger-Events für dein Angebot.</p>
            </div>
          </div>

          <div className="nexus-step">
            <div className="nexus-step-number">2</div>
            <div className="nexus-step-content">
              <h4>Leads richtig lesen (Die Badges)</h4>
              <p>Das Radar spuckt dir die Leads als Karten aus. <strong>News Radar:</strong> Perfekt für Glückwünsche zur Expansion. <strong>Forum:</strong> Eine direkte Frustration eines Nutzers – extrem wertvoll. <strong>Job Board:</strong> Zeigt an, dass ein Unternehmen umstrukturiert. Du siehst den Schmerz des Kunden auf den ersten Blick.</p>
            </div>
          </div>

          <div className="nexus-step">
            <div className="nexus-step-number">3</div>
            <div className="nexus-step-content">
              <h4>Den KI-Pitch generieren (Der magische Button)</h4>
              <p>Schreibe keine Standard-Nachrichten mehr! Mit einem Klick auf den ⚡ Blitz-Button analysiert unsere Sales-KI den exakten Kontext des Leads und schreibt dir in Sekunden eine maßgeschneiderte, hochpsychologische Vertriebsnachricht, die den Lead lobt und unaufdringlich exakt dein Produkt als Lösung anbietet.</p>
            </div>
          </div>

          <div className="nexus-step">
            <div className="nexus-step-number">4</div>
            <div className="nexus-step-content">
              <h4>Akquise durchführen (Copy, Paste, Close)</h4>
              <p>Klicke auf den Link zur Originalquelle, recherchiere den Namen des erwähnten Managers oder Autors, suche ihn auf LinkedIn und schicke ihm exakt den Text, den NeXus für dich generiert hat. Du nutzt Gratulationen und Schmerzpunkte als Hebel, um ein Gespräch anzufangen. Ganz ohne Konkurrenz.</p>
            </div>
          </div>
        </div>
        
        <div className="nexus-cta-group" style={{ marginTop: '50px' }}>
          <button className="nexus-btn-huge" onClick={() => navigate(user ? '/admin/lead-radar' : '/login')}>
            Radar jetzt aktivieren (29,90€/M)* <ArrowRight size={20} />
          </button>
          <p className="nexus-guarantee"><ShieldAlert size={16} /> *Limitiertes Early-Bird-Angebot (Regulär 99,00€/M).</p>
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
