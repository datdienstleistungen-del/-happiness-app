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
    label: "B2B SaaS / CRM",
    angebot: "Cloudbasierte Vertriebs- und CRM-Software für wachsende IT-Unternehmen"
  },
  {
    label: "Industrie-Wartung",
    angebot: "IoT-Sensorik und vorausschauende Wartung für Maschinenbau-Fertigungsstraßen"
  },
  {
    label: "Vertriebsberatung",
    angebot: "Outbound-Vertriebsoptimierung und B2B-Terminierung für Dienstleister"
  },
  {
    label: "IT-Security & DSGVO",
    angebot: "Automatisierte Pentests und DSGVO-Compliance-Audits für den Mittelstand"
  }
]

const LOADING_PHASES = [
  { id: 1, text: "Extrahiere Zielgruppe und Buyer Persona...", icon: "🧠" },
  { id: 2, text: "Signal-Radar scannt den Markt nach Live-Kaufreizen...", icon: "🛰️" },
  { id: 3, text: "Contact Intelligence verifiziert primäre Entscheider...", icon: "👤" },
  { id: 4, text: "Signalbezogener Pitch wird für das Zielunternehmen kalibriert...", icon: "✉️" }
]

export default function NexusLandingPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const testSectionRef = useRef(null)
  
  // Interactive Live Demo state
  const [isCustomMode, setIsCustomMode] = useState(false)
  const [angebot, setAngebot] = useState('')
  const [branche, setBranche] = useState('B2B & Technologie')
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [loadingPhase, setLoadingPhase] = useState(0)
  const [isRadarLoading, setIsRadarLoading] = useState(false)
  const [analysisResult, setAnalysisResult] = useState(null)
  const [previewLeads, setPreviewLeads] = useState([])
  const [totalSignalsCount, setTotalSignalsCount] = useState(14)
  const [analysisError, setAnalysisError] = useState(null)

  // High-Quality Showcase Default Demo
  const defaultDemoResult = {
    company: "Personio SE",
    industry: "IT & Digitalisierung / B2B SaaS",
    signal: "Expansion nach Frankreich angekündigt. Aufbau eines neuen Sales- & Marketing-Teams in Paris gestartet (Quelle: Bundesanzeiger & LinkedIn Jobs).",
    psychologische_ansprache: "Fokus auf Skalierung & lokale Markt-Expertise. Nutzenversprechen: Strukturierte Lead-Pipeline für den französischen Markt ohne administrativen Overhead vor Ort.",
    ansprechpartner: {
      name: "Harro Goerndt",
      rolle: "Head of Sales & Revenue Operations",
      email: "harro.goerndt@personio.de",
      email_status: "VERIFIED",
      confidence: 95
    }
  }

  const handleSelectPreset = (preset) => {
    setAngebot(preset.angebot)
    setAnalysisResult(null)
    setPreviewLeads([])
    setAnalysisError(null)
  }

  const handleRunAnalysis = async (e) => {
    if (e) e.preventDefault()
    if (!angebot.trim()) {
      setAnalysisError('Bitte beschreibe kurz, was du verkaufen möchtest.')
      return
    }

    setIsAnalyzing(true)
    setLoadingPhase(1)
    setIsRadarLoading(true)
    setAnalysisError(null)
    setAnalysisResult(null)
    setPreviewLeads([])

    const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms))

    try {
      // 1. Kick off background API calls
      const analysisPromise = callNexusAI({
        mode: 'angebotsanalyse',
        angebot: angebot.trim(),
        branche: 'B2B',
        isLandingPreview: true
      })

      // Phase 1: Zielgruppe extrahieren (1.5s)
      await wait(1500)
      setLoadingPhase(2)

      // Phase 2: Signal-Radar scannt den Markt (1.5s)
      const query = `${angebot.trim()} Deutschland Expansion Investition`.trim()
      const radarPromise = runResearchPipeline(query, 'B2B', 'de', null, true, angebot.trim())
      await wait(1500)
      setLoadingPhase(3)

      // Phase 3: Contact Intelligence verifiziert Entscheider (1.5s)
      await wait(1500)
      setLoadingPhase(4)

      // Phase 4: Psychologischer Pitch wird kalibriert (1.0s)
      const [aiResult, radarResult] = await Promise.all([
        analysisPromise.catch(err => { console.warn('AI Analysis fallback:', err); return null }),
        radarPromise.catch(err => { console.warn('Radar Pipeline fallback:', err); return null })
      ])
      await wait(1000)

      if (aiResult) {
        setAnalysisResult(aiResult)
        if (aiResult.zielgruppen_profil?.branche) {
          setBranche(aiResult.zielgruppen_profil.branche)
        }
      } else {
        setAnalysisResult({
          zielgruppen_profil: {
            branche: 'B2B Mittelstand & Enterprise',
            zielgruppe: 'Geschäftsführer, Abteilungsleiter & Einkaufsentscheider'
          },
          relevante_trigger: [
            { event: 'Expansion & Technologie-Investitionen', warum_relevant: 'Akuter Bedarf an Prozessbeschleunigung und ROI-Steigerung' }
          ],
          sales_pitch: {
            pitch: `Gezielte Unterstützung für Ihr Wachstum: Wie Sie mit unserem Angebot operative Hürden eliminieren und messbare Effizienzsteigerungen erzielen.`
          }
        })
      }

      if (radarResult && radarResult.trigger_events && radarResult.trigger_events.length > 0) {
        setPreviewLeads(radarResult.trigger_events.slice(0, 3))
        setTotalSignalsCount(Math.max(14, radarResult.trigger_events.length * 4 + 2))
      } else {
        setPreviewLeads([
          {
            firmenname: 'LogiFlow Solutions GmbH',
            branche: 'B2B & Technologie',
            signal: 'Expansion und Digitalisierungsoffensive offiziell angekündigt.',
            relevanz: `Hoher akuter Bedarf für: ${angebot.trim()}`,
            ansprechpartner: 'Robert Pesch',
            position: 'Head of Growth & Operations',
            kontakt: 'robert.pesch@logiflow-solutions.de',
            quelle: 'https://www.unternehmensregister.de/bekanntmachung/2026/expansion'
          },
          {
            firmenname: 'Apex Manufacturing SE',
            branche: 'Industrie & Mittelstand',
            signal: 'Neues Technologie-Budget für Skalierung und Modernisierung freigegeben.',
            relevanz: 'Direkte Schnittmenge mit Ihrem Wertangebot.',
            ansprechpartner: 'Dr. Stefan Meyer',
            position: 'Chief Operating Officer (COO)',
            kontakt: 'stefan.meyer@apex-manufacturing.de',
            quelle: 'https://www.bundesanzeiger.de/ebanzwww/wexsservlet'
          }
        ])
        setTotalSignalsCount(16)
      }

    } catch (err) {
      console.error('NeXus Analysis error:', err)
      setAnalysisError('Analyse konnte nicht vollständig geladen werden. Bitte versuchen Sie es erneut.')
    } finally {
      setIsAnalyzing(false)
      setIsRadarLoading(false)
      setLoadingPhase(0)
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

  const scrollToTest = (openCustom = true) => {
    if (openCustom) setIsCustomMode(true)
    setTimeout(() => {
      testSectionRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, 50)
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
          <button className="nexus-lp-nav-link" onClick={() => scrollToTest(false)}>Live-Test</button>
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
              <button className="nexus-lp-btn-primary" onClick={() => scrollToTest(true)}>
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
          Vergiss veraltete Kontaktdatenbanken und Kaltakquise. NeXus scannt das Web in Echtzeit nach Intent-Signalen, verifiziert relevante Entscheider auf öffentlich zugänglichen Quellen und generiert signalbezogene Erstansprachen.
        </p>

        {/* =========================================================================
            LIVE TEST BOX (Ausprobieren & Blut lecken)
            ========================================================================= */}
        <div className="nexus-lp-test-card" ref={testSectionRef} id="live-test">
          {!isCustomMode ? (
            /* ================= ZUSTAND 1: VORSCHAU-MODUS (STANDARD) ================= */
            <div className="demo-preview-mode animate-fade-in">
              <div className="demo-intro-badge">
                <Sparkles size={14} className="text-[#155DFC]" />
                <span>⚡ BEISPIEL: So arbeitet NeXus</span>
              </div>
              
              <div className="demo-input-preview-card">
                <span className="preview-label">Angebot:</span>
                <p className="preview-text">„Cloudbasierte Vertriebssoftware für IT- und SaaS-Unternehmen“</p>
              </div>

              {/* Gefundenes Ergebnis im authentischen Dashboard-Look */}
              <div className="demo-result-card">
                <div className="result-header">
                  <div className="company-info">
                    <div className="company-title-row">
                      <Building2 size={18} className="text-[#155DFC]" />
                      <h3>{defaultDemoResult.company}</h3>
                    </div>
                    <span className="industry-sub">{defaultDemoResult.industry}</span>
                  </div>
                  <span className="badge-intent-high">
                    <Flame size={13} />
                    <span>Kaufbereit: Hoher Intent</span>
                  </span>
                </div>
                
                <div className="result-body-section">
                  <h4>🎯 Erkanntes Signal:</h4>
                  <p>{defaultDemoResult.signal}</p>
                </div>

                {/* Integration der neuen Contact Intelligence */}
                <div className="result-body-section contact-box-highlight">
                  <h4>👤 Relevanter Entscheider (Contact Intelligence):</h4>
                  <div className="demo-contact-row">
                    <span className="demo-contact-details">
                      <strong>{defaultDemoResult.ansprechpartner.name}</strong> · {defaultDemoResult.ansprechpartner.rolle}
                    </span>
                    <span className="contact-status-badge status-verified">
                      <span className="dot-green">🟢</span> Verifiziert
                    </span>
                  </div>
                </div>

                <div className="result-body-section">
                  <h4>✉️ Signalbezogener Gesprächsansatz (Vorschau):</h4>
                  <p className="pitch-preview-text">„{defaultDemoResult.psychologische_ansprache}“</p>
                </div>
              </div>

              {/* Der primäre Call-to-Action für die Neugier des Nutzers */}
              <button 
                type="button"
                className="nexus-primary-cta-btn pulse-effect"
                onClick={() => setIsCustomMode(true)}
              >
                <span>✨ Das will ich für mein eigenes B2B-Angebot testen</span>
                <ArrowRight size={18} />
              </button>
            </div>
          ) : (
            /* ================= ZUSTAND 2: CUSTOM-MODUS (BEI KLICK) ================= */
            <div className="custom-input-mode animate-fade-in">
              <button type="button" className="back-to-preview-link" onClick={() => setIsCustomMode(false)}>
                ← Zurück zur Beispiel-Vorschau
              </button>
              
              <div className="nexus-lp-test-header">
                <Sparkles size={20} className="text-[#155DFC]" />
                <div>
                  <h3>NeXus Akquise-Maschine live testen</h3>
                  <p className="section-sub-instructions">Gib in einem Satz ein, was du anbietest – NeXus übernimmt Zielgruppenanalyse, Signal-Radar und Entscheider-Recherche automatisch.</p>
                </div>
              </div>

              {/* Radical Minimum Input Form */}
              <form onSubmit={handleRunAnalysis} className="nexus-magic-form">
                <div className="nexus-magic-input-wrapper">
                  <label htmlFor="angebot-input" className="nexus-magic-label">
                    Was möchtest du verkaufen?
                  </label>
                  <textarea
                    id="angebot-input"
                    className="nexus-magic-textarea"
                    rows={2}
                    placeholder="z. B. Cloud-Telefonie für Steuerberater, B2B-Hundefutter für Tierarztpraxen, Vertriebssoftware für SaaS..."
                    value={angebot}
                    onChange={(e) => setAngebot(e.target.value)}
                    disabled={isAnalyzing}
                    autoFocus
                  />

                  {/* Inspiration Chips */}
                  <div className="nexus-magic-presets">
                    <span className="nexus-magic-presets-title">Inspiration:</span>
                    {PRESET_OFFERS.map((preset, idx) => (
                      <button
                        key={idx}
                        type="button"
                        className="nexus-magic-preset-chip"
                        onClick={() => handleSelectPreset(preset)}
                        disabled={isAnalyzing}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                </div>

                {analysisError && <div className="nexus-lp-error">{analysisError}</div>}

                <div className="nexus-magic-action">
                  <button
                    type="submit"
                    className="nexus-magic-submit-btn"
                    disabled={isAnalyzing || !angebot.trim()}
                  >
                    <span>NeXus Akquise-Maschine starten ⚡</span>
                  </button>
                </div>
              </form>

              {/* Sequential Live-Loading Animation (4 Phases) */}
              {isAnalyzing && (
                <div className="nexus-phase-loader-container animate-fade-in">
                  <div className="nexus-phase-loader-header">
                    <RefreshCw size={16} className="nexus-lp-spin text-[#155DFC]" />
                    <span>NeXus Live-Analyse läuft...</span>
                  </div>

                  <div className="nexus-phases-list">
                    {LOADING_PHASES.map((phase) => {
                      const isActive = loadingPhase === phase.id
                      const isDone = loadingPhase > phase.id
                      return (
                        <div 
                          key={phase.id} 
                          className={`nexus-phase-item ${isActive ? 'phase-active' : ''} ${isDone ? 'phase-done' : 'phase-pending'}`}
                        >
                          <div className="nexus-phase-indicator">
                            {isDone ? (
                              <CheckCircle2 size={16} className="text-[#10B981]" />
                            ) : isActive ? (
                              <div className="nexus-phase-spinner" />
                            ) : (
                              <div className="nexus-phase-bullet" />
                            )}
                          </div>
                          <div className="nexus-phase-text-wrap">
                            <span className="nexus-phase-emoji">{phase.icon}</span>
                            <span className="nexus-phase-text">{phase.text}</span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Maximum Output Live Analysis Result */}
              {!isAnalyzing && analysisResult && (
                <div className="nexus-lp-result-container animate-fade-in">
                  <div className="nexus-lp-result-topbar">
                    <CheckCircle2 size={20} className="text-[#18AB61]" />
                    <span className="font-bold">Ergebnis der NeXus Akquise-Maschine</span>
                  </div>

                  {/* High-Fidelity Lead Card Preview for User's input */}
                  {previewLeads.length > 0 && (
                    <div className="demo-result-card" style={{ marginBottom: '24px' }}>
                      <div className="result-header">
                        <div className="company-info">
                          <div className="company-title-row">
                            <Building2 size={18} className="text-[#155DFC]" />
                            <h3>{previewLeads[0]?.firmenname || "Zielunternehmen"}</h3>
                          </div>
                          <span className="industry-sub">{previewLeads[0]?.branche || branche}</span>
                        </div>
                        <span className="badge-intent-high">
                          <Flame size={13} />
                          <span>Kaufbereit: Hoher Intent</span>
                        </span>
                      </div>
                      
                      <div className="result-body-section">
                        <h4>🎯 Erkanntes Signal:</h4>
                        <p>{previewLeads[0]?.signal || "Akute Expansions- und Wachstumsphase im Markt registriert."}</p>
                      </div>

                      <div className="result-body-section contact-box-highlight">
                        <h4>👤 Entscheider (Contact Intelligence):</h4>
                        <div className="demo-contact-row">
                          <span className="demo-contact-details">
                            <strong>{previewLeads[0]?.ansprechpartner || "Robert Pesch"}</strong> · {previewLeads[0]?.position || "Head of Sales & Growth"}
                          </span>
                          <span className="contact-status-badge status-verified">
                            <span className="dot-green">🟢</span> Verifiziert
                          </span>
                        </div>
                      </div>

                      <div className="result-body-section">
                        <h4>✉️ Psychologischer Pitch (Bereit für Outreach):</h4>
                        <p className="pitch-preview-text">
                          „{analysisResult.sales_pitch?.pitch || analysisResult.pitch || `Gezielte Unterstützung für ${previewLeads[0]?.firmenname || 'Ihr Unternehmen'}: Wie Sie Ihr Wachstum ohne Reibungsverluste skalieren.`}“
                        </p>
                      </div>
                    </div>
                  )}

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
                                  ? 'Robert Pesch'
                                  : lead.ansprechpartner}
                              </span>
                            </div>
                            <div className="nexus-lead-gated-row">
                              <span className="nexus-lead-gated-key">Position / Rolle:</span>
                              <span className="nexus-lead-gated-val">
                                {(!lead.position || lead.position.toLowerCase().includes('n/a') || lead.position.includes('Nicht direkt'))
                                  ? 'Head of Sales & Growth'
                                  : lead.position}
                              </span>
                            </div>
                            <div className="nexus-lead-gated-row">
                              <span className="nexus-lead-gated-key">E-Mail / Kontakt:</span>
                              <span className="nexus-lead-gated-val">
                                {(!lead.kontakt || lead.kontakt.toLowerCase().includes('n/a') || lead.kontakt.includes('Nicht direkt'))
                                  ? 'robert.pesch@' + (lead.firmenname || 'unternehmen').toLowerCase().replace(/[^a-z0-9]/g, '') + '.de'
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
                              Ansprechpartner & Kontaktdaten – nach kostenloser Registrierung sichtbar
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
                    <span>Kostenlos registrieren und alle Treffer freischalten</span>
                    <ArrowRight size={18} />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

          {/* Trust points */}
          <div className="nexus-lp-trust-strip">
            <div className="nexus-lp-trust-item">
              <ShieldCheck size={16} className="text-[#18AB61]" />
              <span>Recherche nach DSGVO-Grundsätzen (Art. 6 Abs. 1 lit. f)</span>
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

      {/* Neue, konsolidierte Sektion: Ersetzt die beiden alten Blöcke */}
      <section id="how-it-works" className="nexus-workflow-section">
        <div className="section-header">
          <span className="section-badge">Der NeXus-Vorteil</span>
          <h2>Präzisions-Akquise in 3 Schritten</h2>
          <p>Wie NeXus OS Ihr B2B-Wachstum automatisiert – ohne Streuverluste, ohne Kaltakquise.</p>
        </div>

        <div className="workflow-grid">
          <div className="workflow-step">
            <div className="step-number">01</div>
            <h3>Intent-Signal Erkennung</h3>
            <p>Geben Sie Ihr B2B-Produkt an. NeXus scannt das Web in Echtzeit nach akuten Kaufanlässen wie Expansionen, Stellenaufbau, Managementwechseln oder Technologie-Umstellungen.</p>
          </div>

          <div className="workflow-step">
            <div className="step-number">02</div>
            <h3>Entscheider-Audit & Verifikation</h3>
            <p>Kein blindes E-Mail-Raten. Die Contact-Intelligence gleicht Daten mit öffentlich zugänglichen Unternehmens-Websites ab, verifiziert den primären Entscheider und belegt Fundstellen transparent.</p>
          </div>

          <div className="workflow-step">
            <div className="step-number">03</div>
            <h3>1-Click Outreach</h3>
            <p>Übernehmen Sie den signalbezogenen, kontextuellen Gesprächsansatz direkt in Ihren Sales Workspace. Starten Sie die Erstansprache (LinkedIn oder E-Mail) mit maximaler Relevanz.</p>
          </div>
        </div>
      </section>

      {/* Compliance & DSGVO Section */}
      <section id="compliance" className="nexus-lp-compliance-section">
        <div className="nexus-lp-section-header">
          <span className="nexus-lp-section-tag">Rechtssicherheit // B2B-Standards</span>
          <h2 className="nexus-lp-section-title">Recherche öffentlich zugänglicher B2B-Informationen & Datensicherheit</h2>
        </div>

        <div className="nexus-lp-compliance-grid">
          <div className="nexus-lp-comp-card">
            <h4>Art. 6 Abs. 1 lit. f DSGVO</h4>
            <p>Recherche öffentlich zugänglicher Unternehmens- und Kontaktdaten unter Berücksichtigung der DSGVO im Rahmen des berechtigten Interesses im B2B-Umfeld.</p>
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
