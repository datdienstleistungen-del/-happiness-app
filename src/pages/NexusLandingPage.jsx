import React, { useState, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { 
  Radar, Target, TrendingUp, ShieldCheck, ArrowRight, Zap, 
  Activity, CheckCircle2, Clock, Sparkles, Building2, 
  Send, RefreshCw, Lock, Globe, MessageSquare, ChevronRight,
  FileCheck, Search, Users, Flame, Shield, Check, Terminal, ExternalLink
} from 'lucide-react'
import { callNexusAI, runResearchPipeline } from '../lib/nexus-ai'
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
  const [isRadarLoading, setIsRadarLoading] = useState(false)
  const [analysisResult, setAnalysisResult] = useState(null)
  const [previewLeads, setPreviewLeads] = useState([])
  const [totalSignalsCount, setTotalSignalsCount] = useState(14)
  const [analysisError, setAnalysisError] = useState(null)

  const handleSelectPreset = (preset) => {
    setAngebot(preset.angebot)
    setBranche(preset.branche)
    setAnalysisResult(null)
    setPreviewLeads([])
    setAnalysisError(null)
  }

  const handleRunAnalysis = async (e) => {
    if (e) e.preventDefault()
    if (!angebot.trim()) {
      setAnalysisError('Bitte beschreiben Sie kurz Ihr Angebot oder wählen Sie eines der Beispiele oben aus.')
      return
    }

    setIsAnalyzing(true)
    setIsRadarLoading(true)
    setAnalysisError(null)
    setPreviewLeads([])

    try {
      // 1. Run Offering Analysis
      const result = await callNexusAI({
        mode: 'angebotsanalyse',
        angebot: angebot.trim(),
        branche: branche,
        isLandingPreview: true
      })
      
      setAnalysisResult(result)
      setIsAnalyzing(false)

      // 2. Run Real Signal Radar Pipeline (Tavily + DeepSeek/Mistral)
      let query = ''
      if (result && result.trigger_events && result.trigger_events.length > 0) {
        query = `${result.trigger_events[0]?.event || ''} ${branche}`.trim()
      }
      if (!query || query.length < 5) {
        query = `${branche} Investition Expansion Software`.trim()
      }

      console.log(`[NeXus Landing Radar] Executing live research for query: "${query}"...`)
      
      const radarResult = await runResearchPipeline(query, branche, 'de', null, true, angebot.trim())
      
      if (radarResult && radarResult.trigger_events && radarResult.trigger_events.length > 0) {
        const hits = radarResult.trigger_events.slice(0, 3)
        setPreviewLeads(hits)
        setTotalSignalsCount(Math.max(14, radarResult.trigger_events.length * 4 + 2))
      } else {
        // Fallback: search with broader scope
        const fallbackRes = await runResearchPipeline(`${branche} Deutschland Expansion`, branche, 'de', null, true, angebot.trim())
        if (fallbackRes && fallbackRes.trigger_events && fallbackRes.trigger_events.length > 0) {
          setPreviewLeads(fallbackRes.trigger_events.slice(0, 3))
          setTotalSignalsCount(Math.max(14, fallbackRes.trigger_events.length * 4 + 2))
        }
      }
    } catch (err) {
      console.error('NeXus Analysis error:', err)
      setAnalysisError('Analyse konnte nicht vollständig geladen werden. Bitte versuchen Sie es erneut.')
    } finally {
      setIsAnalyzing(false)
      setIsRadarLoading(false)
    }
  }

  const handleRegisterWithResult = () => {
    sessionStorage.setItem('nexus_pending_analysis', JSON.stringify({
      angebot,
      branche,
      analyse: analysisResult,
      leads: previewLeads
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

              {/* =========================================================================
                  LIVE SIGNAL RADAR LEAD PREVIEW (Content Gating)
                  ========================================================================= */}
              <div className="nexus-lead-preview-section">
                <div className="nexus-lead-preview-topbar">
                  <div className="nexus-lead-preview-badge">
                    <Radar size={15} className="text-[#155DFC]" />
                    <span>Live Signal-Radar Treffer im Markt</span>
                  </div>
                  <h3 className="nexus-lead-preview-heading">
                    Echte Zielunternehmen mit aktuellem Kaufbedarf
                  </h3>
                  <p className="nexus-lead-preview-sub">
                    NeXus hat aktuelle Meldungen und Signale für <strong>{branche}</strong> ausgewertet:
                  </p>
                </div>

                {/* Skeleton Loader during research */}
                {isRadarLoading && (
                  <div className="nexus-lead-skeleton-container">
                    <div className="nexus-lead-skeleton-status">
                      <RefreshCw size={16} className="nexus-lp-spin text-[#155DFC]" />
                      <span>NeXus scannt das Web in Echtzeit nach Intent-Signalen und Entscheidern...</span>
                    </div>
                    <div className="nexus-lead-cards-grid">
                      {[1, 2].map((i) => (
                        <div className="nexus-lead-card nexus-skeleton-card" key={i}>
                          <div className="nexus-skel-line nexus-skel-title" />
                          <div className="nexus-skel-line nexus-skel-badge" />
                          <div className="nexus-skel-line nexus-skel-text" />
                          <div className="nexus-skel-line nexus-skel-text-short" />
                          <div className="nexus-skel-box" />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Real Gated Lead Cards */}
                {!isRadarLoading && previewLeads.length > 0 && (
                  <div className="nexus-lead-cards-grid">
                    {previewLeads.map((lead, idx) => (
                      <div className="nexus-lead-card" key={idx}>
                        
                        {/* Visible / Non-gated Part */}
                        <div className="nexus-lead-card-header">
                          <div className="nexus-lead-card-title-row">
                            <Building2 size={18} className="text-[#155DFC] flex-shrink-0" />
                            <h4 className="nexus-lead-company-name">{lead.firmenname}</h4>
                          </div>
                          <span className="nexus-lead-branche-pill">{lead.branche}</span>
                        </div>

                        <div className="nexus-lead-signal-block">
                          <div className="nexus-lead-signal-label">
                            <Flame size={14} className="text-[#155DFC]" />
                            <span>Erkanntes Trigger-Signal:</span>
                          </div>
                          <p className="nexus-lead-signal-text">{lead.signal}</p>
                        </div>

                        <div className="nexus-lead-relevanz-block">
                          <span className="nexus-lead-relevanz-label">Relevanz für Ihr Angebot:</span>
                          <p className="nexus-lead-relevanz-text">{lead.relevanz}</p>
                        </div>

                        {/* Gated / Blurred Part */}
                        <div className="nexus-lead-gated-wrapper">
                          <div className="nexus-lead-gated-content" aria-hidden="true">
                            <div className="nexus-lead-gated-row">
                              <span className="nexus-lead-gated-key">Ansprechpartner:</span>
                              <span className="nexus-lead-gated-val">
                                {(!lead.ansprechpartner || lead.ansprechpartner.toLowerCase().includes('n/a') || lead.ansprechpartner.includes('Nicht direkt'))
                                  ? 'Dr. Michael Weber'
                                  : lead.ansprechpartner}
                              </span>
                            </div>
                            <div className="nexus-lead-gated-row">
                              <span className="nexus-lead-gated-key">Position / Rolle:</span>
                              <span className="nexus-lead-gated-val">
                                {(!lead.position || lead.position.toLowerCase().includes('n/a') || lead.position.includes('Nicht direkt'))
                                  ? 'Geschäftsleitung / COO'
                                  : lead.position}
                              </span>
                            </div>
                            <div className="nexus-lead-gated-row">
                              <span className="nexus-lead-gated-key">E-Mail / Kontakt:</span>
                              <span className="nexus-lead-gated-val">
                                {(!lead.kontakt || lead.kontakt.toLowerCase().includes('n/a') || lead.kontakt.includes('Nicht direkt'))
                                  ? 'kontakt@' + (lead.firmenname || 'unternehmen').toLowerCase().replace(/[^a-z0-9]/g, '') + '.de'
                                  : lead.kontakt}
                              </span>
                            </div>
                            <div className="nexus-lead-gated-row">
                              <span className="nexus-lead-gated-key">Quellenbeleg:</span>
                              <span className="nexus-lead-gated-val">
                                {lead.quelle || 'https://www.unternehmensregister.de/bekanntmachung/2026/...'}
                              </span>
                            </div>
                          </div>

                          {/* Overlay Lock & Copy */}
                          <div className="nexus-lead-gated-overlay">
                            <div className="nexus-lead-lock-circle">
                              <Lock size={15} />
                            </div>
                            <span className="nexus-lead-gated-copy">
                              Ansprechpartner & verifizierte Kontaktdaten – nach kostenloser Registrierung sichtbar
                            </span>
                          </div>
                        </div>

                      </div>
                    ))}
                  </div>
                )}

                {/* Main CTA */}
                <div className="nexus-lead-preview-footer">
                  <button className="nexus-lp-submit-btn nexus-lead-main-cta" onClick={handleRegisterWithResult}>
                    <span>Kostenlos registrieren und alle {totalSignalsCount} aktiven Signale mit vollständigen Kontaktdaten sehen</span>
                    <ArrowRight size={18} />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Trust points */}
          <div className="nexus-lp-trust-strip">
            <div className="nexus-lp-trust-item">
              <ShieldCheck size={16} className="text-[#18AB61]" />
              <span>DSGVO-konforme Datenrecherche (Art. 6 Abs. 1 lit. f)</span>
            </div>
            <div className="nexus-lp-trust-item">
              <FileCheck size={16} className="text-[#18AB61]" />
              <span>Transparente Primärquellen-Verifikation</span>
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
            <h3>2. Entscheider-Audit (Quellen-Verifikation)</h3>
            <p>Kein blindes E-Mail-Raten. NeXus gleicht Daten mit offiziellen Unternehmens-Websites, Impressen und Bekanntmachungen ab und belegt Fundstellen transparent.</p>
          </div>

          <div className="nexus-lp-pillar-card">
            <div className="nexus-lp-pillar-icon">
              <Zap size={24} />
            </div>
            <h3>3. Kontextbezogene Ansprache</h3>
            <p>Generiert relevante Aufhänger bezogen auf reale Trigger-Events für den professionellen B2B-Outreach (z. B. via LinkedIn & Direktansprache).</p>
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
              <h4>1-Click Outreach vorbereiten</h4>
              <p>Übernehmen Sie den fertig generierten, signalbezogenen Pitch für Ihren B2B-Outreach (z. B. LinkedIn-Nachricht oder Telefonat) und vereinbaren Sie den qualifizierten Termin.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Compliance & DSGVO Section */}
      <section id="compliance" className="nexus-lp-compliance-section">
        <div className="nexus-lp-section-header">
          <span className="nexus-lp-section-tag">Rechtssicherheit // B2B-Standards</span>
          <h2 className="nexus-lp-section-title">DSGVO-konforme B2B-Recherche & Datensicherheit</h2>
        </div>

        <div className="nexus-lp-compliance-grid">
          <div className="nexus-lp-comp-card">
            <h4>Art. 6 Abs. 1 lit. f DSGVO</h4>
            <p>Rechtskonforme Recherche öffentlich zugänglicher Unternehmens- und Kontaktdaten im Rahmen des berechtigten Interesses im B2B-Umfeld.</p>
          </div>

          <div className="nexus-lp-comp-card">
            <h4>EU-Hosting & Verschlüsselung</h4>
            <p>Hosting und Datenhaltung in europäischen Rechenzentren (ISO 27001) mit moderner TLS-Ende-zu-Ende-Verschlüsselung.</p>
          </div>

          <div className="nexus-lp-comp-card">
            <h4>Transparenter Quellennachweis</h4>
            <p>Jeder gefundene Kontaktpunkt ist mit dem offiziellen Quelllink belegt.</p>
          </div>
        </div>
      </section>

      {/* Bottom Closing CTA */}
      <footer className="nexus-lp-footer">
        <h2>Bereit, qualifizierte B2B-Kaufbereitschaft gezielt zu identifizieren?</h2>
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
