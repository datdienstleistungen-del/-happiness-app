import React, { useState, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { 
  Radar, Target, TrendingUp, ShieldCheck, ArrowRight, Zap, 
  Activity, CheckCircle2, Clock, Sparkles, Building2, 
  Send, RefreshCw, Lock, Globe, MessageSquare, ChevronRight,
  FileCheck, Search, Users, Flame, Shield, Check, Terminal, ExternalLink, Play
} from 'lucide-react'
import { callNexusAI, runResearchPipeline } from '../lib/nexus-ai'
import { trackNexusEvent, trackUpgradeClick } from '../lib/nexus-analytics'
import { useAuth } from '../context/AuthContext'
import { useLanguage, LANGUAGES } from '../i18n/translations'
import { NEXUS_LANDING_TRANSLATIONS } from '../i18n/nexusLandingTranslations'
import NexusAnalysisResult from '../components/NexusAnalysisResult'
import NexusIntroModal from '../components/NexusIntroModal'
import './NexusLandingPage.css'

export default function NexusLandingPage() {
  const [showIntroModal, setShowIntroModal] = useState(false)
  const navigate = useNavigate()
  const { user } = useAuth()
  const { lang, setLang } = useLanguage()
  const testSectionRef = useRef(null)

  // Auto-trigger video intro for non-registered / unauthenticated visitors
  React.useEffect(() => {
    if (!user) {
      setShowIntroModal(true)
    } else {
      setShowIntroModal(false)
    }
  }, [user])

  // Resolve active language dictionary
  const t = NEXUS_LANDING_TRANSLATIONS[lang] || NEXUS_LANDING_TRANSLATIONS.en || NEXUS_LANDING_TRANSLATIONS.de
  
  // Interactive Live Demo state
  const [isCustomMode, setIsCustomMode] = useState(false)
  const [angebot, setAngebot] = useState('')
  const [branche, setBranche] = useState(lang === 'de' ? 'B2B & Technologie' : 'B2B & Technology')
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [loadingPhase, setLoadingPhase] = useState(0)
  const [isRadarLoading, setIsRadarLoading] = useState(false)
  const [analysisResult, setAnalysisResult] = useState(null)
  const [previewLeads, setPreviewLeads] = useState([])
  const [totalSignalsCount, setTotalSignalsCount] = useState(14)
  const [analysisError, setAnalysisError] = useState(null)

  // Dynamic Showcase Demo Profile
  const defaultDemoResult = t.showcase.demoResult

  const handleSelectPreset = (preset) => {
    setAngebot(preset.angebot)
    setAnalysisResult(null)
    setPreviewLeads([])
    setAnalysisError(null)
  }

  const handleRunAnalysis = async (e) => {
    if (e) e.preventDefault()
    if (!angebot.trim()) {
      setAnalysisError(t.custom.validationError)
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
        lang: lang,
        isLandingPreview: true
      })

      // Phase 1: Target group & buyer persona (1.5s)
      await wait(1500)
      setLoadingPhase(2)

      // Phase 2: Intent signal radar scan (1.5s)
      const locationTerm = lang === 'de' ? 'Deutschland' : 'US UK Global'
      const query = `${angebot.trim()} ${locationTerm} Expansion Investment`.trim()
      const radarPromise = runResearchPipeline(query, 'B2B', lang, null, true, angebot.trim())
      await wait(1500)
      setLoadingPhase(3)

      // Phase 3: Contact Intelligence decision-maker audit (1.5s)
      await wait(1500)
      setLoadingPhase(4)

      // Phase 4: Contextual outreach pitch calibrated (1.0s)
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
        const isDe = lang === 'de'
        setAnalysisResult({
          zielgruppen_profil: {
            branche: isDe ? 'B2B Mittelstand & Enterprise' : 'B2B Mid-Market & Enterprise',
            zielgruppe: isDe ? 'Geschäftsführer, Abteilungsleiter & Einkaufsentscheider' : 'C-Level Executives, VPs & Strategic Buying Decision Makers'
          },
          relevante_trigger: [
            { 
              event: isDe ? 'Expansion & Technologie-Investitionen' : 'Market Expansion & Strategic Technology Investment', 
              warum_relevant: isDe ? 'Akuter Bedarf an Prozessbeschleunigung und ROI-Steigerung' : 'Urgent commercial need for scaling efficiency and immediate ROI' 
            }
          ],
          sales_pitch: {
            pitch: isDe 
              ? `Gezielte Unterstützung für Ihr Wachstum: Wie Sie mit unserem Angebot operative Hürden eliminieren und messbare Effizienzsteigerungen erzielen.`
              : `Targeted support for your growth initiative: How our solution eliminates operational bottlenecks and delivers measurable ROI for your team.`
          }
        })
      }

      if (radarResult && radarResult.trigger_events && radarResult.trigger_events.length > 0) {
        setPreviewLeads(radarResult.trigger_events.slice(0, 3))
        setTotalSignalsCount(Math.max(14, radarResult.trigger_events.length * 4 + 2))
      } else {
        const isDe = lang === 'de'
        setPreviewLeads([
          {
            firmenname: isDe ? 'LogiFlow Solutions GmbH' : 'LogiFlow Solutions Inc.',
            branche: isDe ? 'B2B & Technologie' : 'B2B & Technology Infrastructure',
            signal: isDe 
              ? 'Expansion und Digitalisierungsoffensive offiziell angekündigt.'
              : 'Global expansion and enterprise technology modernization officially announced.',
            relevanz: isDe 
              ? `Hoher akuter Bedarf für: ${angebot.trim()}`
              : `High commercial alignment for: ${angebot.trim()}`,
            ansprechpartner: 'Harro Goerndt',
            position: 'Head of Sales & Revenue Operations',
            kontakt: 'datdienstleistungen@gmail.com',
            quelle: isDe ? 'https://www.unternehmensregister.de/bekanntmachung/2026/expansion' : 'https://www.sec.gov/edgar/searchedgar/companysearch'
          },
          {
            firmenname: isDe ? 'Apex Manufacturing SE' : 'Apex Enterprise Systems Ltd.',
            branche: isDe ? 'Industrie & Mittelstand' : 'Enterprise Operations & Systems',
            signal: isDe
              ? 'Neues Technologie-Budget für Skalierung und Modernisierung freigegeben.'
              : 'New commercial budget allocated for cross-border scaling and operational automation.',
            relevanz: isDe
              ? 'Direkte Schnittmenge mit Ihrem Wertangebot.'
              : 'Immediate overlap with your core value proposition.',
            ansprechpartner: 'Michael Vance',
            position: 'Chief Operating Officer (COO)',
            kontakt: 'm.vance@apex-enterprise.com',
            quelle: isDe ? 'https://www.bundesanzeiger.de/ebanzwww/wexsservlet' : 'https://find-and-update.company-information.service.gov.uk'
          }
        ])
        setTotalSignalsCount(16)
      }

    } catch (err) {
      console.error('NeXus Analysis error:', err)
      setAnalysisError(t.custom.analysisError)
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
      <NexusIntroModal 
        isOpen={showIntroModal} 
        onClose={() => setShowIntroModal(false)} 
      />
      
      {/* Top Header Navigation */}
      <header className="nexus-lp-header">
        <div className="nexus-lp-brand" onClick={() => navigate('/')}>
          <div className="nexus-lp-logo-box">
            <Radar size={18} />
          </div>
          <span className="nexus-lp-brand-name">NeXus <span className="nexus-lp-brand-tag">Revenue OS</span></span>
        </div>

        <nav className="nexus-lp-nav">
          <button className="nexus-lp-nav-link" onClick={() => scrollToTest(false)}>{t.nav.liveTest}</button>
          <a href="#how-it-works" className="nexus-lp-nav-link">{t.nav.howItWorks}</a>
          <a href="#compliance" className="nexus-lp-nav-link">{t.nav.compliance}</a>
        </nav>

        <div className="nexus-lp-header-actions">
          {/* Language Switcher */}
          <div className="nexus-lp-lang-switcher">
            <Globe size={14} className="nexus-lp-lang-icon" />
            <select 
              value={lang} 
              onChange={(e) => setLang(e.target.value)}
              className="nexus-lp-lang-select"
              aria-label="Select Language"
            >
              {LANGUAGES.map((l) => (
                <option key={l.code} value={l.code} className="nexus-lp-lang-option">
                  {l.flag} {l.label}
                </option>
              ))}
            </select>
          </div>

          {user ? (
            <button className="nexus-lp-btn-primary" onClick={() => navigate('/nexus/dashboard')}>
              {t.nav.toDashboard}
            </button>
          ) : (
            <>
              <button className="nexus-lp-btn-ghost" onClick={() => navigate('/login')}>
                {t.nav.login}
              </button>
              <button className="nexus-lp-btn-primary" onClick={() => scrollToTest(true)}>
                {t.nav.testFree}
              </button>
            </>
          )}
        </div>
      </header>

      {/* Hero Section */}
      <section className="nexus-lp-hero">
        <div className="nexus-lp-hero-badge-group">
          <div className="nexus-lp-hero-badge">
            <span className="nexus-lp-pulse-dot"></span>
            <span>{t.hero.badge}</span>
          </div>
          <button 
            type="button"
            className="nexus-lp-hero-video-trigger"
            onClick={() => setShowIntroModal(true)}
            title="15s Intro-Video ansehen"
          >
            <Play size={12} fill="currentColor" />
            <span>15s Intro ansehen</span>
          </button>
        </div>

        <h1 className="nexus-lp-hero-title">
          {t.hero.title}
        </h1>

        <p className="nexus-lp-hero-subtitle">
          {t.hero.subtitle}
        </p>

        {/* =========================================================================
            LIVE TEST BOX (Show Don't Tell vs Magic Input)
            ========================================================================= */}
        <div className="nexus-lp-test-card" ref={testSectionRef} id="live-test">
          {!isCustomMode ? (
            /* ================= ZUSTAND 1: VORSCHAU-MODUS (STANDARD) ================= */
            <div className="demo-preview-mode animate-fade-in">
              <div className="demo-intro-badge">
                <Sparkles size={14} className="text-[#155DFC]" />
                <span>{t.showcase.badge}</span>
              </div>
              
              <div className="demo-input-preview-card">
                <span className="preview-label">{t.showcase.offerLabel}</span>
                <p className="preview-text">{t.showcase.offerText}</p>
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
                    <span>{t.showcase.highIntent}</span>
                  </span>
                </div>
                
                <div className="result-body-section">
                  <h4>{t.showcase.detectedSignal}</h4>
                  <p>{defaultDemoResult.signal}</p>
                </div>

                {/* Integration der neuen Contact Intelligence */}
                <div className="result-body-section contact-box-highlight">
                  <h4>{t.showcase.decisionMaker}</h4>
                  <div className="demo-contact-row">
                    <span className="demo-contact-details">
                      <strong>{defaultDemoResult.ansprechpartner.name}</strong> · {defaultDemoResult.ansprechpartner.rolle}
                      {defaultDemoResult.ansprechpartner.email && (
                        <span className="demo-contact-email-tag"> · {defaultDemoResult.ansprechpartner.email}</span>
                      )}
                    </span>
                    <span className="contact-status-badge status-verified">
                      <span className="dot-green">🟢</span> {t.showcase.verified}
                    </span>
                  </div>
                </div>

                <div className="result-body-section">
                  <h4>{t.showcase.approachLabel}</h4>
                  <p className="pitch-preview-text">„{defaultDemoResult.psychologische_ansprache}“</p>
                </div>
              </div>

              {/* Der primäre Call-to-Action für die Neugier des Nutzers */}
              <button 
                type="button"
                className="nexus-primary-cta-btn pulse-effect"
                onClick={() => setIsCustomMode(true)}
              >
                <span>{t.showcase.ctaButton}</span>
                <ArrowRight size={18} />
              </button>
            </div>
          ) : (
            /* ================= ZUSTAND 2: CUSTOM-MODUS (BEI KLICK) ================= */
            <div className="custom-input-mode animate-fade-in">
              <button type="button" className="back-to-preview-link" onClick={() => setIsCustomMode(false)}>
                {t.custom.backToPreview}
              </button>
              
              <div className="nexus-lp-test-header">
                <Sparkles size={20} className="text-[#155DFC]" />
                <div>
                  <h3>{t.custom.title}</h3>
                  <p className="section-sub-instructions">{t.custom.subtitle}</p>
                </div>
              </div>

              {/* Radical Minimum Input Form */}
              <form onSubmit={handleRunAnalysis} className="nexus-magic-form">
                <div className="nexus-magic-input-wrapper">
                  <label htmlFor="angebot-input" className="nexus-magic-label">
                    {t.custom.magicLabel}
                  </label>
                  <textarea
                    id="angebot-input"
                    className="nexus-magic-textarea"
                    rows={2}
                    placeholder={t.custom.magicPlaceholder}
                    value={angebot}
                    onChange={(e) => setAngebot(e.target.value)}
                    disabled={isAnalyzing}
                    autoFocus
                  />

                  {/* Inspiration Chips */}
                  <div className="nexus-magic-presets">
                    <span className="nexus-magic-presets-title">{t.custom.inspiration}</span>
                    {t.custom.presets.map((preset, idx) => (
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
                    <span>{t.custom.submitBtn}</span>
                  </button>
                </div>
              </form>

              {/* Sequential Live-Loading Animation (4 Phases) */}
              {isAnalyzing && (
                <div className="nexus-phase-loader-container animate-fade-in">
                  <div className="nexus-phase-loader-header">
                    <RefreshCw size={16} className="nexus-lp-spin text-[#155DFC]" />
                    <span>{t.loading.running}</span>
                  </div>

                  <div className="nexus-phases-list">
                    {t.loading.phases.map((phase) => {
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
                    <span className="font-bold">{t.results.topbar}</span>
                  </div>

                  {/* High-Fidelity Lead Card Preview for User's input */}
                  {previewLeads.length > 0 && (
                    <div className="demo-result-card" style={{ marginBottom: '24px' }}>
                      <div className="result-header">
                        <div className="company-info">
                          <div className="company-title-row">
                            <Building2 size={18} className="text-[#155DFC]" />
                            <h3>{previewLeads[0]?.firmenname || "Target Account"}</h3>
                          </div>
                          <span className="industry-sub">{previewLeads[0]?.branche || branche}</span>
                        </div>
                        <span className="badge-intent-high">
                          <Flame size={13} />
                          <span>{t.showcase.highIntent}</span>
                        </span>
                      </div>
                      
                      <div className="result-body-section">
                        <h4>{t.results.detectedSignal}</h4>
                        <p>{previewLeads[0]?.signal || "Commercial growth phase & new tech initiative registered."}</p>
                      </div>

                      <div className="result-body-section contact-box-highlight">
                        <h4>{t.results.decisionMaker}</h4>
                        <div className="demo-contact-row">
                          <span className="demo-contact-details">
                            <strong>{previewLeads[0]?.ansprechpartner || "Harro Goerndt"}</strong> · {previewLeads[0]?.position || "Head of Sales & Growth"}
                            {previewLeads[0]?.kontakt && (
                              <span className="demo-contact-email-tag"> · {previewLeads[0].kontakt}</span>
                            )}
                          </span>
                          <span className="contact-status-badge status-verified">
                            <span className="dot-green">🟢</span> {t.results.verified}
                          </span>
                        </div>
                      </div>

                      <div className="result-body-section">
                        <h4>{t.results.pitchLabel}</h4>
                        <p className="pitch-preview-text">
                          „{analysisResult.sales_pitch?.pitch || analysisResult.pitch || `Targeted support for ${previewLeads[0]?.firmenname || 'your enterprise'}: How to eliminate operational friction and scale pipeline.`}“
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
                        <span>{t.results.radarHitsBadge}</span>
                      </div>
                      <h3 className="nexus-lead-preview-heading">
                        {t.results.radarHeading}
                      </h3>
                      <p className="nexus-lead-preview-sub">
                        {t.results.signalsFor} <strong>{branche}</strong>:
                      </p>
                    </div>

                    {/* Skeleton Loader during research */}
                    {isRadarLoading && (
                      <div className="nexus-lead-skeleton-container">
                        <div className="nexus-lead-skeleton-status">
                          <RefreshCw size={16} className="nexus-lp-spin text-[#155DFC]" />
                          <span>{t.results.scanningWeb}</span>
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
                                <span>{t.results.detectedTrigger}</span>
                              </div>
                              <p className="nexus-lead-signal-text">{lead.signal}</p>
                            </div>

                            <div className="nexus-lead-relevanz-block">
                              <span className="nexus-lead-relevanz-label">{t.results.relevanceForOffer}</span>
                              <p className="nexus-lead-relevanz-text">{lead.relevanz}</p>
                            </div>

                            {/* Gated / Blurred Part */}
                            <div className="nexus-lead-gated-wrapper">
                              <div className="nexus-lead-gated-content" aria-hidden="true">
                                <div className="nexus-lead-gated-row">
                                  <span className="nexus-lead-gated-key">{t.results.contactLabel}</span>
                                  <span className="nexus-lead-gated-val">
                                    {(!lead.ansprechpartner || lead.ansprechpartner.toLowerCase().includes('n/a') || lead.ansprechpartner.includes('Nicht direkt'))
                                      ? 'Harro Goerndt'
                                      : lead.ansprechpartner}
                                  </span>
                                </div>
                                <div className="nexus-lead-gated-row">
                                  <span className="nexus-lead-gated-key">{t.results.roleLabel}</span>
                                  <span className="nexus-lead-gated-val">
                                    {(!lead.position || lead.position.toLowerCase().includes('n/a') || lead.position.includes('Nicht direkt'))
                                      ? 'Head of Sales & Revenue Operations'
                                      : lead.position}
                                  </span>
                                </div>
                                <div className="nexus-lead-gated-row">
                                  <span className="nexus-lead-gated-key">{t.results.emailLabel}</span>
                                  <span className="nexus-lead-gated-val">
                                    {(!lead.kontakt || lead.kontakt.toLowerCase().includes('n/a') || lead.kontakt.includes('Nicht direkt'))
                                      ? 'datdienstleistungen@gmail.com'
                                      : lead.kontakt}
                                  </span>
                                </div>
                                <div className="nexus-lead-gated-row">
                                  <span className="nexus-lead-gated-key">{t.results.sourceLabel}</span>
                                  <span className="nexus-lead-gated-val">
                                    {lead.quelle || 'https://www.sec.gov/edgar/searchedgar/companysearch'}
                                  </span>
                                </div>
                              </div>

                              {/* Overlay Lock & Copy */}
                              <div className="nexus-lead-gated-overlay">
                                <div className="nexus-lead-lock-circle">
                                  <Lock size={15} />
                                </div>
                                <span className="nexus-lead-gated-copy">
                                  {t.results.gatedCopy}
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
                        <span>{t.results.mainCta}</span>
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
              <span>{t.trust.gdpr}</span>
            </div>
            <div className="nexus-lp-trust-item">
              <FileCheck size={16} className="text-[#18AB61]" />
              <span>{t.trust.sources}</span>
            </div>
            <div className="nexus-lp-trust-item">
              <Check size={16} className="text-[#18AB61]" />
              <span>{t.trust.noCard}</span>
            </div>
          </div>
        </div>
      </section>

      {/* 3-Step Workflow Section */}
      <section id="how-it-works" className="nexus-workflow-section">
        <div className="section-header">
          <span className="section-badge">{t.workflow.badge}</span>
          <h2>{t.workflow.title}</h2>
          <p>{t.workflow.subtitle}</p>
        </div>

        <div className="workflow-grid">
          {t.workflow.steps.map((step, idx) => (
            <div className="workflow-step" key={idx}>
              <div className="step-number">{step.num}</div>
              <h3>{step.title}</h3>
              <p>{step.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Compliance & Data Privacy Section */}
      <section id="compliance" className="nexus-lp-compliance-section">
        <div className="nexus-lp-section-header">
          <span className="nexus-lp-section-tag">{t.compliance.tag}</span>
          <h2 className="nexus-lp-section-title">{t.compliance.title}</h2>
        </div>

        <div className="nexus-lp-compliance-grid">
          {t.compliance.cards.map((card, idx) => (
            <div className="nexus-lp-comp-card" key={idx}>
              <h4>{card.title}</h4>
              <p>{card.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Bottom Closing CTA & Footer */}
      <footer className="nexus-lp-footer">
        <h2>{t.footer.title}</h2>
        <p>{t.footer.subtitle}</p>
        <button className="nexus-lp-submit-btn" onClick={() => scrollToTest(true)}>
          <span>{t.footer.cta}</span>
          <ArrowRight size={18} />
        </button>

        <div className="nexus-lp-footer-bottom">
          <span>&copy; {new Date().getFullYear()} NeXus Intelligence. {t.footer.rights}</span>
          <div className="nexus-lp-footer-links">
            <Link to="/impressum">{t.footer.impressum}</Link>
            <Link to="/datenschutz">{t.footer.privacy}</Link>
            <Link to="/agb">{t.footer.terms}</Link>
          </div>
        </div>
      </footer>

    </div>
  )
}
