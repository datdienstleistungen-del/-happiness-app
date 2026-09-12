import React, { useState, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { 
  Radar, Target, TrendingUp, ShieldCheck, ArrowRight, Zap, 
  Activity, CheckCircle2, Clock, Sparkles, Building2, 
  Send, RefreshCw, Lock, Globe, MessageSquare, ChevronRight,
  FileCheck, Search, Users, Flame, Shield, Check, Terminal
} from 'lucide-react'
import { callNexusAI } from '../lib/nexus-ai'
import { useAuth } from '../context/AuthContext'
import NexusAnalysisResult from '../components/NexusAnalysisResult'
import './NexusLandingPage.css'

const BRANCHEN = [
  "IT & Digitalisierung / B2B SaaS",
  "Beratung, Consulting & Coaching",
  "Industrie, Maschinenbau & Automation",
  "Marketing, PR & Lead Generation",
  "Logistik, Transport & Supply Chain",
  "Gesundheitswesen, MedTech & Pharma",
  "Bauwesen, Architektur & Immobilien",
  "Finanzdienstleistung & FinTech",
  "Handel, E-Commerce & Distribution",
  "Sonstige B2B-Dienstleistung"
]

const PRESET_OFFERS = [
  {
    label: "B2B SaaS / Tech",
    branche: "IT & Digitalisierung / B2B SaaS",
    angebot: "Wir bieten eine cloudbasierte Software zur Automatisierung von Vertriebs- und Reporting-Prozessen für mittelständische Unternehmen."
  },
  {
    label: "Industrie & Automation",
    branche: "Industrie, Maschinenbau & Automation",
    angebot: "Wir liefern IoT-Sensorik und vorausschauende Wartung für Fertigungsstraßen im mittelständischen Maschinenbau."
  },
  {
    label: "Vertriebs- & Managementberatung",
    branche: "Beratung, Consulting & Coaching",
    angebot: "Wir optimieren B2B-Vertriebsteams, verkürzen den Sales-Cycle und bauen skalierbare Outbound-Prozesse auf."
  },
  {
    label: "IT-Security & DSGVO",
    branche: "IT & Digitalisierung / B2B SaaS",
    angebot: "Wir führen automatisierte Pentests und DSGVO-Audits für Unternehmen mit 50 bis 500 Mitarbeitenden durch."
  }
]

export default function NexusLandingPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const testSectionRef = useRef(null)
  
  // Interactive Live Demo state
  const [angebot, setAngebot] = useState('')
  const [branche, setBranche] = useState(BRANCHEN[0])
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [analysisResult, setAnalysisResult] = useState(null)
  const [analysisError, setAnalysisError] = useState(null)

  const handleSelectPreset = (preset) => {
    setAngebot(preset.angebot)
    setBranche(preset.branche)
    setAnalysisResult(null)
    setAnalysisError(null)
  }

  const handleRunAnalysis = async (e) => {
    if (e) e.preventDefault()
    if (!angebot.trim()) {
      setAnalysisError('Bitte beschreiben Sie kurz Ihr Angebot oder wählen Sie eines der Beispiele oben aus.')
      return
    }

    setIsAnalyzing(true)
    setAnalysisError(null)

    try {
      const result = await callNexusAI({
        mode: 'angebotsanalyse',
        angebot: angebot.trim(),
        branche: branche
      })
      
      setAnalysisResult(result)
    } catch (err) {
      console.error('NeXus Analysis error:', err)
      setAnalysisError('Analyse konnte nicht durchgeführt werden. Bitte versuchen Sie es erneut.')
    } finally {
      setIsAnalyzing(false)
    }
  }

  const handleRegisterWithResult = () => {
    sessionStorage.setItem('nexus_pending_analysis', JSON.stringify({
      angebot,
      branche,
      analyse: analysisResult
    }))
    navigate('/register')
  }

  const scrollToTest = () => {
    testSectionRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <div className="nexus-lp-wrapper">
      
      {/* Top Header Navigation */}
      <header className="nexus-lp-header">
        <div className="nexus-lp-brand" onClick={() => navigate('/')}>
          <div className="nexus-lp-logo-box">
            <Radar size={18} />
          </div>
          <span className="nexus-lp-brand-name">NeXus <span className="nexus-lp-brand-tag">Revenue OS</span></span>
        </div>

        <nav className="nexus-lp-nav">
          <button className="nexus-lp-nav-link" onClick={scrollToTest}>Live-Test</button>
          <a href="#how-it-works" className="nexus-lp-nav-link">So funktioniert's</a>
          <a href="#compliance" className="nexus-lp-nav-link">DSGVO & Sicherheit</a>
        </nav>

        <div className="nexus-lp-header-actions">
          {user ? (
            <button className="nexus-lp-btn-primary" onClick={() => navigate('/nexus/dashboard')}>
              Zum Dashboard
            </button>
          ) : (
            <>
              <button className="nexus-lp-btn-ghost" onClick={() => navigate('/login')}>
                Anmelden
              </button>
              <button className="nexus-lp-btn-primary" onClick={scrollToTest}>
                Kostenlos testen
              </button>
            </>
          )}
        </div>
      </header>

      {/* Hero Section */}
      <section className="nexus-lp-hero">
        <div className="nexus-lp-hero-badge">
          <span className="nexus-lp-pulse-dot"></span>
          <span>B2B Sales Intelligence & Kaufsignal-Radar</span>
        </div>

        <h1 className="nexus-lp-hero-title">
          Finde B2B-Kunden im exakten Moment des Kaufbedarfs.
        </h1>

        <p className="nexus-lp-hero-subtitle">
          Vergiss veraltete Kontaktdatenbanken und Kaltakquise. NeXus scannt das Web in Echtzeit nach Intent-Signalen, verifiziert echte Entscheider auf offiziellen Quellseiten und generiert psychologisch treffende Erstansprachen.
        </p>

        {/* =========================================================================
            LIVE TEST BOX (Ausprobieren & Blut lecken)
            ========================================================================= */}
        <div className="nexus-lp-test-card" ref={testSectionRef} id="live-test">
          <div className="nexus-lp-test-header">
            <Sparkles size={20} className="text-[#155DFC]" />
            <div>
              <h3>Testen Sie NeXus jetzt mit Ihrem eigenen B2B-Angebot</h3>
              <p>Erleben Sie live, wie NeXus Ihre Zielgruppe, relevante Kaufsignale im Markt und den optimalen Pitch berechnet.</p>
            </div>
          </div>

          {/* Quick Preset Buttons */}
          <div className="nexus-lp-presets">
            <span className="nexus-lp-presets-title">Beispiel wählen:</span>
            {PRESET_OFFERS.map((preset, idx) => (
              <button
                key={idx}
                type="button"
                className="nexus-lp-preset-chip"
                onClick={() => handleSelectPreset(preset)}
              >
                {preset.label}
              </button>
            ))}
          </div>

          {/* Input Form */}
          <form onSubmit={handleRunAnalysis} className="nexus-lp-form">
            <div className="nexus-lp-form-row">
              <label htmlFor="branche-select" className="nexus-lp-label">Zielbranche / Marktsegment:</label>
              <select
                id="branche-select"
                className="nexus-lp-select"
                value={branche}
                onChange={(e) => setBranche(e.target.value)}
                disabled={isAnalyzing}
              >
                {BRANCHEN.map((b) => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            </div>

            <div className="nexus-lp-form-row">
              <label htmlFor="angebot-input" className="nexus-lp-label">Ihr Angebot & Nutzenversprechen:</label>
              <textarea
                id="angebot-input"
                className="nexus-lp-textarea"
                rows={4}
                placeholder="z. B. Wir entwickeln cloudbasierte Software zur Automatisierung von Vertriebsprozessen für mittelständische Unternehmen ab 50 Mitarbeitenden..."
                value={angebot}
                onChange={(e) => setAngebot(e.target.value)}
                disabled={isAnalyzing}
              />
            </div>

            {analysisError && <div className="nexus-lp-error">{analysisError}</div>}

            <div className="nexus-lp-form-action">
              <button
                type="submit"
                className="nexus-lp-submit-btn"
                disabled={isAnalyzing || !angebot.trim()}
              >
                {isAnalyzing ? (
                  <>
                    <RefreshCw size={18} className="nexus-lp-spin" />
                    <span>NeXus KI analysiert Ihr Angebot...</span>
                  </>
                ) : (
                  <>
                    <span>Kostenlose NeXus-Analyse starten</span>
                    <ArrowRight size={18} />
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Live Analysis Output */}
          {analysisResult && (
            <div className="nexus-lp-result-container">
              <div className="nexus-lp-result-topbar">
                <CheckCircle2 size={20} className="text-[#18AB61]" />
                <span className="font-bold">Analyse-Ergebnis für Ihr Angebot ({branche})</span>
              </div>

              <div className="nexus-lp-result-body">
                <NexusAnalysisResult data={analysisResult} mode="angebotsanalyse" />
              </div>

              {/* Next Step CTA */}
              <div className="nexus-lp-result-cta">
                <div>
                  <h4>Möchten Sie echte Leads zu diesen Kaufsignalen erhalten?</h4>
                  <p>Aktivieren Sie den automatischen Signal-Radar, um täglich frische Intent-Leads für Ihr Angebot zu überwachen.</p>
                </div>
                <button className="nexus-lp-btn-primary" onClick={handleRegisterWithResult}>
                  <span>Kostenlos registrieren & Radar aktivieren</span>
                  <ArrowRight size={16} />
                </button>
              </div>
            </div>
          )}

          {/* Trust points */}
          <div className="nexus-lp-trust-strip">
            <div className="nexus-lp-trust-item">
              <ShieldCheck size={16} className="text-[#18AB61]" />
              <span>100% DSGVO-konform (Art. 6 Abs. 1 lit. f)</span>
            </div>
            <div className="nexus-lp-trust-item">
              <FileCheck size={16} className="text-[#18AB61]" />
              <span>Echte Primärquellen-Verifikation</span>
            </div>
            <div className="nexus-lp-trust-item">
              <Check size={16} className="text-[#18AB61]" />
              <span>Keine Kreditkarte erforderlich</span>
            </div>
          </div>
        </div>
      </section>

      {/* 3 Core Pillars */}
      <section className="nexus-lp-pillars-section">
        <div className="nexus-lp-section-header">
          <span className="nexus-lp-section-tag">Technologie & Methodik</span>
          <h2 className="nexus-lp-section-title">Präzisions-Akquise in 3 Schritten</h2>
          <p className="nexus-lp-section-sub">So unterscheidet sich NeXus von herkömmlicher Kaltakquise und statischen Adresslisten.</p>
        </div>

        <div className="nexus-lp-pillars-grid">
          <div className="nexus-lp-pillar-card">
            <div className="nexus-lp-pillar-icon">
              <Target size={24} />
            </div>
            <h3>1. Intent-Signal Erkennung</h3>
            <p>NeXus überwacht das Web kontinuierlich nach akuten Kaufanlässen: Expansionen, Managementwechsel, Stellenaufbau oder Technologie-Umstellungen.</p>
          </div>

          <div className="nexus-lp-pillar-card">
            <div className="nexus-lp-pillar-icon">
              <Shield size={24} />
            </div>
            <h3>2. Entscheider-Audit (0% Halluzination)</h3>
            <p>Keine E-Mail-Heuristiken ins Blaue. NeXus prüft die offizielle Website, das Impressum und Pressemitteilungen auf echte, verifizierte Ansprechpartner.</p>
          </div>

          <div className="nexus-lp-pillar-card">
            <div className="nexus-lp-pillar-icon">
              <Zap size={24} />
            </div>
            <h3>3. Psychologische Message Engine</h3>
            <p>Unsere KI formuliert einen persönlichen Aufhänger, der exakt auf das erkannte Trigger-Ereignis Bezug nimmt. Höhere Relevanz, spürbar mehr Termine.</p>
          </div>
        </div>
      </section>

      {/* How it works Detailed Guide */}
      <section id="how-it-works" className="nexus-lp-guide-section">
        <div className="nexus-lp-section-header">
          <span className="nexus-lp-section-tag">Produkt-Workflow</span>
          <h2 className="nexus-lp-section-title">Wie Sie mit NeXus arbeiten</h2>
        </div>

        <div className="nexus-lp-guide-steps">
          <div className="nexus-lp-step-item">
            <div className="nexus-lp-step-num">01</div>
            <div className="nexus-lp-step-content">
              <h4>Angebot & Zielmarkt definieren</h4>
              <p>Geben Sie Ihr B2B-Produkt oder Ihre Dienstleistung an. Die KI ermittelt Ihre Buyer Persona und die passenden Signal-Muster im Markt.</p>
            </div>
          </div>

          <div className="nexus-lp-step-item">
            <div className="nexus-lp-step-num">02</div>
            <div className="nexus-lp-step-content">
              <h4>Signal-Radar laufen lassen</h4>
              <p>Der Radar scannt das Web kontinuierlich. Sobald ein Zielunternehmen ein Trigger-Signal aussendet, landet der Lead in Ihrem Workspace.</p>
            </div>
          </div>

          <div className="nexus-lp-step-item">
            <div className="nexus-lp-step-num">03</div>
            <div className="nexus-lp-step-content">
              <h4>1-Click Outreach versenden</h4>
              <p>Übernehmen Sie den fertig generierten, signalbezogenen Pitch für LinkedIn Direct Message oder E-Mail und vereinbaren Sie den qualifizierten Termin.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Compliance & DSGVO Section */}
      <section id="compliance" className="nexus-lp-compliance-section">
        <div className="nexus-lp-section-header">
          <span className="nexus-lp-section-tag">Rechtssicherheit // Made in Germany</span>
          <h2 className="nexus-lp-section-title">100% DSGVO-konform für den B2B-Vertrieb</h2>
        </div>

        <div className="nexus-lp-compliance-grid">
          <div className="nexus-lp-comp-card">
            <h4>Art. 6 Abs. 1 lit. f DSGVO</h4>
            <p>Vollständig rechtskonforme Verarbeitung geschäftlicher Kontaktdaten im Rahmen des berechtigten Interesses im B2B-Direktvertrieb.</p>
          </div>

          <div className="nexus-lp-comp-card">
            <h4>Server in Frankfurt / EU</h4>
            <p>Ausschließlich europäische ISO-27001-zertifizierte Rechenzentren mit strengster Datenhoheit.</p>
          </div>

          <div className="nexus-lp-comp-card">
            <h4>Transparenter Quellennachweis</h4>
            <p>Jeder gefundene Kontaktpunkt ist mit dem offiziellen Primärquellen-Link (z. B. Impressum) lückenlos belegt.</p>
          </div>
        </div>
      </section>

      {/* Bottom Closing CTA */}
      <footer className="nexus-lp-footer">
        <h2>Bereit, Ihren B2B-Vertrieb auf Autopilot zu setzen?</h2>
        <p>Testen Sie NeXus jetzt mit Ihrem eigenen Angebot.</p>
        <button className="nexus-lp-submit-btn" onClick={scrollToTest}>
          <span>Jetzt kostenlose Analyse starten</span>
          <ArrowRight size={18} />
        </button>

        <div className="nexus-lp-footer-bottom">
          <span>&copy; {new Date().getFullYear()} NeXus Intelligence. Alle Rechte vorbehalten.</span>
          <div className="nexus-lp-footer-links">
            <Link to="/impressum">Impressum</Link>
            <Link to="/datenschutz">Datenschutz</Link>
            <Link to="/agb">AGB</Link>
          </div>
        </div>
      </footer>

    </div>
  )
}
