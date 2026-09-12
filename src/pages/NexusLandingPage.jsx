import React, { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { 
  ArrowRight, Check, X, Shield, Search, Zap, 
  Sparkles, Building2, ChevronRight, ChevronDown, Lock,
  Globe, Terminal, Cpu, Database, Mail, Award, Calculator,
  TrendingUp, Clock, Users, DollarSign, Target, CheckCircle2,
  FileCheck, ExternalLink, RefreshCw
} from 'lucide-react'
import { callNexusAI } from '../lib/nexus-ai'
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

const DEMO_SCENARIOS = [
  {
    id: 'saas',
    title: 'B2B SaaS & Tech',
    company: 'CloudScale Solutions GmbH',
    domain: 'cloudscale-solutions.de',
    meta: 'München · 85 Mitarbeiter · Series-A finanziert',
    signal: {
      type: 'Sales Expansion & Funding',
      badge: 'EXPANSION',
      headline: 'Series-A Finanzierung über 4,5 Mio. € & 8 neue Account Executives ausgeschrieben',
      source: 'Offizielle Pressemitteilung & Karriereseite',
      urgency: 'Sehr hoch (Budget verfügbar)',
      fitScore: '96%'
    },
    contact: {
      name: 'Dr. Stefan Heinrich',
      role: 'VP Global Sales Operations',
      sourceUrl: 'cloudscale-solutions.de/impressum',
      status: 'VERIFIED [IMPRESSUM]',
      emailStatus: 'FOUND',
      verificationDate: 'Live vor 14 Min verifiziert'
    },
    pitch: {
      subject: 'Skalierung Ihres 8-köpfigen AE-Teams im DACH-Markt',
      body: `Guten Tag Herr Dr. Heinrich,

ich habe gesehen, dass Sie bei CloudScale im Zuge der Series-A Finanzierung aktuell 8 neue Account Executives aufbauen. Bei schnellem Teamwachstum entstehen oft Engpässe in der Lead-Qualifizierung.

Wir unterstützen SaaS-Scaleups dabei, die Ramp-up-Zeit neuer Sales Reps durch automatisierte Kaufsignal-Erkennung um 40% zu verkürzen.

Wäre ein kurzer Austausch am Donnerstag um 10:00 Uhr für Sie von Interesse?`
    }
  },
  {
    id: 'industry',
    title: 'Industrie & Maschinenbau',
    company: 'Kärcher Automation & Robotics SE',
    domain: 'kaercher-automation.com',
    meta: 'Stuttgart · 1.400 Mitarbeiter · Maschinenbau',
    signal: {
      type: 'Kapazitätserweiterung & Digitalisierung',
      badge: 'TRANSFORMATION',
      headline: 'Neubau Produktionshalle 4 & Umstellung auf IoT-gestützte Fertigung',
      source: 'Geschäftsbericht & Handelsregister-Bekanntmachung',
      urgency: 'Hoch (Investitionszyklus Q3/Q4)',
      fitScore: '94%'
    },
    contact: {
      name: 'Alexander Voss',
      role: 'Leiter Digitale Transformation & Operations',
      sourceUrl: 'kaercher-automation.com/ueber-uns/management',
      status: 'VERIFIED [MANAGEMENT]',
      emailStatus: 'FOUND',
      verificationDate: 'Live vor 28 Min verifiziert'
    },
    pitch: {
      subject: 'IoT-Umstellung Produktionshalle 4 – Prozessabsicherung',
      body: `Guten Tag Herr Voss,

herzlichen Glückwunsch zum Spatenstich für Produktionshalle 4. Der Übergang zu vernetzten IoT-Fertigungsstraßen stellt viele Industrieunternehmen vor enorme Herausforderungen bei Schnittstellen und Monitoring.

Unsere Plattform sichert genau diese Übergangsphasen ab, sodass keine Stillstandzeiten in der Pilotphase entstehen.

Haben Sie 10 Minuten Zeit für einen kurzen Erfahrungsaustausch nächste Woche?`
    }
  },
  {
    id: 'consulting',
    title: 'Management Consulting',
    company: 'Consilio Advisory Group AG',
    domain: 'consilio-advisory.de',
    meta: 'Frankfurt a.M. · 320 Mitarbeiter · Strategieberatung',
    signal: {
      type: 'Managementwechsel & Restrukturierung',
      badge: 'LEADERSHIP',
      headline: 'Neuer Partner für Commercial Transformation & M&A ernannt',
      source: 'Wirtschaftswoche & LinkedIn Unternehmensupdate',
      urgency: 'Sofort (Neue Strategieagenda 100 Tage)',
      fitScore: '91%'
    },
    contact: {
      name: 'Dr. Markus Weber',
      role: 'Partner Commercial Strategy & Transactions',
      sourceUrl: 'consilio-advisory.de/team/partner',
      status: 'VERIFIED [PARTNER BOARD]',
      emailStatus: 'FOUND',
      verificationDate: 'Live vor 45 Min verifiziert'
    },
    pitch: {
      subject: 'Commercial Due Diligence Beschleunigung für Ihre 100-Tage-Agenda',
      body: `Guten Tag Herr Dr. Weber,

glückwunsch zur neuen Partnerrolle bei Consilio Advisory. Bei Neubesetzungen im Commercial-Bereich liegt der Fokus meist sofort auf beschleunigten Markteinblicken und datengestützter Pipeline-Validierung.

Wir liefern Management-Beratungen tagesaktuelle Marktsignale und Entscheider-Audits per API.

Sollen wir Ihnen einen Test-Export für Ihr aktuelles Fokussegment zusammenstellen?`
    }
  }
]

const FAQS = [
  {
    q: "Wie unterscheidet sich NeXus von klassischen B2B-Datenbanken wie Cognism oder ZoomInfo?",
    a: "Herkömmliche Anbieter verkaufen statische, oft Monate alte Datenbank-Auszüge ohne aktuellen Kaufanlass. NeXus hingegen scannt das Web in Echtzeit nach konkreten Kaufsignalen (z.B. Managementwechsel, Stellenausschreibungen, Expansionen) und crawlt die offiziellen Firmen-Websites live nach den aktuellen Entscheidern. Sie erhalten keine kalten Listen, sondern hochrelevante Intent-Leads mit konkretem Aufhänger."
  },
  {
    q: "Ist die Recherche und Erstansprache mit NeXus DSGVO-konform?",
    a: "Ja, zu 100%. NeXus arbeitet streng nach Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse im geschäftlichen B2B-Verkehr). Es werden ausschließlich öffentlich zugängliche Geschäfts- und Unternehmensdaten verarbeitet. Zu jedem erfassten Kontakt liefert NeXus einen transparenten Primärquellen-Nachweis."
  },
  {
    q: "Was bedeutet das Faktencheck-Prinzip (FOUND vs. UNKNOWN)?",
    a: "Im Gegensatz zu vielen KI-Tools 'errät' oder halluziniert NeXus niemals Namen oder E-Mail-Adressen. Wenn eine Information auf der offiziellen Website (z.B. Impressum, Teamseite, Pressemitteilung) gefunden und verifiziert wurde, wird sie als FOUND mit Quellenlink markiert. Ist keine offizielle Quelle auffindbar, wird der Lead transparent als UNKNOWN gekennzeichnet, um Fehlansprachen auszuschließen."
  },
  {
    q: "Wie funktioniert der interaktive ROI-Rechner?",
    a: "Der Rechner basiert auf empirischen Vertriebsdaten: Ein B2B-Vertriebler verbringt durchschnittlich 6-12 Stunden pro Woche mit manueller Lead-Recherche und Pitch-Formulierung. NeXus reduziert diese Zeit um über 80% und steigert die Terminquote durch signalbasiertes Timing um das 2- bis 3-fache."
  },
  {
    q: "Gibt es lange Vertragslaufzeiten?",
    a: "Nein. Wir verzichten bewusst auf teure 12-Monats-Jahresknebelverträge. Alle NeXus-Tarife sind flexibel monatlich kündbar."
  },
  {
    q: "Wie funktioniert die kostenlose Lead-Analyse?",
    a: "Geben Sie einfach Ihr B2B-Angebot und Ihre Zielbranche ein. Die NeXus-KI analysiert sekundenschnell Ihre Value Proposition, identifiziert relevante Trigger-Ereignisse und liefert Ihnen eine maßgeschneiderte Akquise-Strategie."
  }
]

export default function NexusLandingPage() {
  const navigate = useNavigate()
  const [step, setStep] = useState('landing') // landing | input | analyzing | result
  const [angebot, setAngebot] = useState('')
  const [branche, setBranche] = useState('')
  const [analyse, setAnalyse] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  const [openFaq, setOpenFaq] = useState(0)

  // Interactive Live Demo State
  const [activeScenarioId, setActiveScenarioId] = useState('saas')
  const activeScenario = useMemo(() => {
    return DEMO_SCENARIOS.find(s => s.id === activeScenarioId) || DEMO_SCENARIOS[0]
  }, [activeScenarioId])

  // Interactive ROI Calculator State
  const [teamSize, setTeamSize] = useState(3)
  const [dealValue, setDealValue] = useState(12000)
  const [hoursPerWeek, setHoursPerWeek] = useState(6)

  // Calculations
  const calculatedRoi = useMemo(() => {
    const hoursSavedPerRepPerMonth = hoursPerWeek * 3.5 // ~70-80% reduction
    const totalHoursSavedPerMonth = Math.round(teamSize * hoursSavedPerRepPerMonth)
    const costSavingsPerMonth = Math.round(totalHoursSavedPerMonth * 65) // 65€/h internal sales rep rate
    const additionalDealsPerYear = Math.round(teamSize * 1.5 * 10) / 10 // conservative 1.5 extra deals/rep/year
    const additionalPipelinePerMonth = Math.round((additionalDealsPerYear * dealValue) / 12)
    const monthlyInvestment = teamSize <= 1 ? 49 : teamSize <= 5 ? 232 : teamSize * 49
    const roiMultiplier = Math.round(((costSavingsPerMonth + additionalPipelinePerMonth) / (monthlyInvestment || 1)) * 10) / 10

    return {
      totalHoursSavedPerMonth,
      costSavingsPerMonth,
      additionalPipelinePerMonth,
      roiMultiplier: Math.max(roiMultiplier, 4.5)
    }
  }, [teamSize, dealValue, hoursPerWeek])

  const handleStartAnalysis = () => {
    setStep('input')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleSubmitOffer = async (e) => {
    e.preventDefault()
    if (!angebot.trim() || !branche) {
      setError('Bitte beschreiben Sie Ihr Angebot und wählen Sie eine Branche.')
      return
    }
    
    setStep('analyzing')
    setError(null)
    setLoading(true)
    
    try {
      const result = await callNexusAI({
        mode: 'angebotsanalyse',
        angebot: angebot,
        branche: branche
      })
      
      setAnalyse(result)
      setStep('result')
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (err) {
      console.error('Analyse Fehler:', err)
      setError('Es ist ein Fehler aufgetreten. Bitte versuchen Sie es erneut.')
      setStep('input')
    } finally {
      setLoading(false)
    }
  }

  const handleRegisterForMore = () => {
    sessionStorage.setItem('nexus_pending_analysis', JSON.stringify({
      angebot,
      branche,
      analyse
    }))
    navigate('/register')
  }

  if (step === 'landing') {
    return (
      <div className="nexus-framer-wrapper">
        <div className="nexus-framer-container">
          
          {/* Top Minimalist Header */}
          <header className="nexus-header">
            <div className="nexus-brand" onClick={() => navigate('/')}>
              <div className="nexus-logo-box">N</div>
              <span className="nexus-brand-title">NeXus <span className="nexus-brand-sub">Revenue OS</span></span>
            </div>

            <nav className="nexus-nav">
              <a href="#live-demo" className="nexus-nav-link">Live-Demo</a>
              <a href="#radar" className="nexus-nav-link">Signal-Radar</a>
              <a href="#vergleich" className="nexus-nav-link">Der Unterschied</a>
              <a href="#features" className="nexus-nav-link">Deep Dives</a>
              <a href="#calculator" className="nexus-nav-link">ROI-Rechner</a>
              <a href="#compliance" className="nexus-nav-link">DSGVO</a>
              <a href="#preise" className="nexus-nav-link">Preise</a>
              <a href="#faq" className="nexus-nav-link">FAQ</a>
            </nav>

            <div className="nexus-header-actions">
              <button className="nexus-btn-ghost" onClick={() => navigate('/login')}>
                Anmelden
              </button>
              <button className="nexus-btn-primary" onClick={handleStartAnalysis}>
                Kostenlos testen
              </button>
            </div>
          </header>

          {/* Hero Section */}
          <section className="nexus-hero-section">
            <div className="nexus-pill-badge">
              <span className="nexus-pill-dot"></span>
              <span>KI-native B2B-Akquise & Kaufsignal-Radar</span>
            </div>

            <h1 className="nexus-hero-heading">
              Von der Kaufsignal-Erkennung bis zum qualifizierten Termin.
            </h1>

            <p className="nexus-hero-description">
              NeXus ersetzt veraltete Kontaktdatenbanken. Unsere KI überwacht Live-Trigger im DACH-Markt, verifiziert echte Entscheider auf Primärquellen und automatisiert die hochpräzise Erstansprache.
            </p>

            <div className="nexus-hero-cta-group">
              <button className="nexus-btn-primary-large" onClick={handleStartAnalysis}>
                <span>Kostenlose Lead-Analyse starten</span>
                <ArrowRight size={16} />
              </button>
              <button className="nexus-btn-secondary-large" onClick={() => {
                const el = document.getElementById('live-demo')
                el?.scrollIntoView({ behavior: 'smooth' })
              }}>
                Interaktive Live-Demo testen
              </button>
            </div>

            <div className="nexus-trust-strip">
              <div className="nexus-trust-item">
                <Check size={14} className="nexus-trust-check" />
                <span>100% DSGVO-konform (Art. 6 Abs. 1 lit. f)</span>
              </div>
              <div className="nexus-trust-item">
                <Check size={14} className="nexus-trust-check" />
                <span>Kein E-Mail-Raten (Primärquellen-Beweis)</span>
              </div>
              <div className="nexus-trust-item">
                <Check size={14} className="nexus-trust-check" />
                <span>Keine Kreditkarte erforderlich</span>
              </div>
            </div>
          </section>

          {/* Section: Interactive Live Demo Playground */}
          <section id="live-demo" className="nexus-playground-section">
            <div className="nexus-section-header">
              <span className="nexus-section-tag">Interaktive Live-Demo // 3-Schritte Engine</span>
              <h2 className="nexus-section-heading">Erleben Sie NeXus in Aktion</h2>
              <p className="nexus-section-sub">
                Wählen Sie eine Branche und sehen Sie, wie NeXus aus einem Live-Websignal einen abschlussreifen Pitch generiert.
              </p>
            </div>

            <div className="nexus-scenario-tabs">
              {DEMO_SCENARIOS.map((scenario) => (
                <button
                  key={scenario.id}
                  className={`nexus-scenario-tab ${activeScenarioId === scenario.id ? 'active' : ''}`}
                  onClick={() => setActiveScenarioId(scenario.id)}
                >
                  <Building2 size={15} />
                  <span>{scenario.title}</span>
                </button>
              ))}
            </div>

            {/* Playground 3-Column Card Layout */}
            <div className="nexus-playground-card">
              <div className="nexus-playground-topbar">
                <div className="nexus-playground-company-info">
                  <div className="nexus-pg-dot-active"></div>
                  <strong>{activeScenario.company}</strong>
                  <span className="nexus-pg-meta-pill">{activeScenario.meta}</span>
                </div>
                <div className="nexus-pg-domain-badge">
                  <Globe size={12} />
                  <span>{activeScenario.domain}</span>
                </div>
              </div>

              <div className="nexus-playground-grid">
                {/* Step 1: Signal Radar */}
                <div className="nexus-pg-step-box">
                  <div className="nexus-pg-step-header">
                    <div className="nexus-pg-step-number">01</div>
                    <div>
                      <div className="nexus-pg-step-title">Signal-Radar</div>
                      <div className="nexus-pg-step-subtitle">Kaufsignal & Intent</div>
                    </div>
                  </div>

                  <div className="nexus-pg-step-body">
                    <div className="nexus-pg-tag-row">
                      <span className="nexus-tag-trigger">{activeScenario.signal.badge}</span>
                      <span className="nexus-pg-score-pill">Fit: {activeScenario.signal.fitScore}</span>
                    </div>

                    <h4 className="nexus-pg-signal-heading">{activeScenario.signal.type}</h4>
                    <p className="nexus-pg-signal-text">{activeScenario.signal.headline}</p>

                    <div className="nexus-pg-signal-meta-list">
                      <div className="nexus-pg-meta-row">
                        <span className="nexus-meta-lbl">Quelle:</span>
                        <span className="nexus-meta-val">{activeScenario.signal.source}</span>
                      </div>
                      <div className="nexus-pg-meta-row">
                        <span className="nexus-meta-lbl">Dringlichkeit:</span>
                        <span className="nexus-meta-val font-semibold text-[#155DFC]">{activeScenario.signal.urgency}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Step 2: Contact Fact-Check */}
                <div className="nexus-pg-step-box">
                  <div className="nexus-pg-step-header">
                    <div className="nexus-pg-step-number">02</div>
                    <div>
                      <div className="nexus-pg-step-title">Entscheider-Audit</div>
                      <div className="nexus-pg-step-subtitle">Faktencheck & Quelle</div>
                    </div>
                  </div>

                  <div className="nexus-pg-step-body">
                    <div className="nexus-pg-contact-card">
                      <div className="nexus-pg-contact-avatar">
                        {activeScenario.contact.name.charAt(0)}
                      </div>
                      <div>
                        <div className="nexus-pg-contact-name">{activeScenario.contact.name}</div>
                        <div className="nexus-pg-contact-role">{activeScenario.contact.role}</div>
                      </div>
                    </div>

                    <div className="nexus-pg-audit-box">
                      <div className="nexus-pg-audit-status">
                        <CheckCircle2 size={14} className="text-[#18AB61]" />
                        <span>{activeScenario.contact.status}</span>
                      </div>
                      <div className="nexus-pg-meta-row mt-2">
                        <span className="nexus-meta-lbl">Website-Audit:</span>
                        <span className="nexus-meta-val font-mono text-[11px]">{activeScenario.contact.sourceUrl}</span>
                      </div>
                      <div className="nexus-pg-meta-row">
                        <span className="nexus-meta-lbl">DSGVO Status:</span>
                        <span className="nexus-meta-val text-[#18AB61] font-semibold">Art. 6 Abs. 1 lit. f konform</span>
                      </div>
                    </div>

                    <div className="nexus-pg-time-badge">
                      <Clock size={12} />
                      <span>{activeScenario.contact.verificationDate}</span>
                    </div>
                  </div>
                </div>

                {/* Step 3: Psychological Outreach Pitch */}
                <div className="nexus-pg-step-box">
                  <div className="nexus-pg-step-header">
                    <div className="nexus-pg-step-number">03</div>
                    <div>
                      <div className="nexus-pg-step-title">Psychologischer Pitch</div>
                      <div className="nexus-pg-step-subtitle">Signal-basierter Erstkontakt</div>
                    </div>
                  </div>

                  <div className="nexus-pg-step-body">
                    <div className="nexus-pg-email-preview">
                      <div className="nexus-pg-email-subject">
                        <span className="nexus-meta-lbl">Betreff:</span>
                        <span className="font-semibold text-[#171717]">{activeScenario.pitch.subject}</span>
                      </div>
                      <div className="nexus-pg-email-content">
                        {activeScenario.pitch.body}
                      </div>
                    </div>

                    <button className="nexus-pg-action-btn" onClick={handleStartAnalysis}>
                      <span>Eigenes Angebot analysieren</span>
                      <ArrowRight size={14} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Live Signal Intelligence Table (Clay Style) */}
          <section id="radar" className="nexus-radar-section">
            <div className="nexus-section-header">
              <span className="nexus-section-tag">Echtzeit-Radar // DACH Enterprise</span>
              <h2 className="nexus-section-heading">Kaufsignale im Markt (Live-Auszug)</h2>
              <p className="nexus-section-sub">
                Aktuell erkannte und verifizierte Trigger-Ereignisse der letzten 60 Minuten.
              </p>
            </div>

            <div className="nexus-table-wrapper">
              <table className="nexus-table">
                <thead>
                  <tr>
                    <th>Unternehmen</th>
                    <th>Trigger-Kategorie</th>
                    <th>Erkanntes Signal</th>
                    <th>Verifizierter Entscheider</th>
                    <th>E-Mail-Status</th>
                    <th className="text-right">Aktion</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>
                      <div className="nexus-company-name">Kärcher B2B Solutions</div>
                      <div className="nexus-company-meta">kaercher.com · DACH · 1.200 MA</div>
                    </td>
                    <td>
                      <span className="nexus-tag-trigger">Sales Expansion</span>
                    </td>
                    <td className="nexus-signal-text">
                      12 neue Account Executives im DACH-Vertrieb ausgeschrieben
                    </td>
                    <td>
                      <div className="nexus-contact-name">Dr. Stefan Heinrich</div>
                      <div className="nexus-contact-role">VP Global Sales Operations</div>
                    </td>
                    <td>
                      <span className="nexus-status-found">FOUND [IMPRESSUM]</span>
                    </td>
                    <td className="text-right">
                      <button className="nexus-table-btn" onClick={handleStartAnalysis}>
                        Pitch ansehen →
                      </button>
                    </td>
                  </tr>

                  <tr>
                    <td>
                      <div className="nexus-company-name">LogiTech Dynamics SE</div>
                      <div className="nexus-company-meta">logitech-dynamics.de · 420 MA</div>
                    </td>
                    <td>
                      <span className="nexus-tag-trigger">Management Change</span>
                    </td>
                    <td className="nexus-signal-text">
                      Neuer CRO zur Neuausrichtung des B2B-Vertriebs ernannt
                    </td>
                    <td>
                      <div className="nexus-contact-name">Alexander Voss</div>
                      <div className="nexus-contact-role">Chief Revenue Officer</div>
                    </td>
                    <td>
                      <span className="nexus-status-found">FOUND [PRESSE]</span>
                    </td>
                    <td className="text-right">
                      <button className="nexus-table-btn" onClick={handleStartAnalysis}>
                        Pitch ansehen →
                      </button>
                    </td>
                  </tr>

                  <tr>
                    <td>
                      <div className="nexus-company-name">TechNova Solutions GmbH</div>
                      <div className="nexus-company-meta">technova-solutions.de · SaaS</div>
                    </td>
                    <td>
                      <span className="nexus-tag-trigger">Kapitalerhöhung</span>
                    </td>
                    <td className="nexus-signal-text">
                      Series-A Finanzierung über 4,5 Mio. EUR abgeschlossen
                    </td>
                    <td>
                      <div className="nexus-contact-name">Dr. Markus Weber</div>
                      <div className="nexus-contact-role">Geschäftsführung / GTM</div>
                    </td>
                    <td>
                      <span className="nexus-status-found">FOUND [TEAM]</span>
                    </td>
                    <td className="text-right">
                      <button className="nexus-table-btn" onClick={handleStartAnalysis}>
                        Pitch ansehen →
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          {/* Section: Sovereign Feature-by-Feature Comparison Matrix Table */}
          <section id="vergleich" className="nexus-matrix-section">
            <div className="nexus-section-header">
              <span className="nexus-section-tag">Der Unterschied // Direktvergleich</span>
              <h2 className="nexus-section-heading">Warum herkömmliche B2B-Listen scheitern</h2>
              <p className="nexus-section-sub">
                NeXus basiert auf Live-Intent und Primärquellen-Recherche — keine verstaubten statischen Datenbanken.
              </p>
            </div>

            <div className="nexus-matrix-container">
              <div className="nexus-matrix-table-wrap">
                <table className="nexus-matrix-table">
                  <thead>
                    <tr>
                      <th className="nexus-matrix-th-feature">Leistungsmerkmal</th>
                      <th className="nexus-matrix-th-nexus">
                        <div className="nexus-matrix-brand-head">
                          <span className="nexus-matrix-badge">KI-Nativ</span>
                          <span>NeXus Revenue OS</span>
                        </div>
                      </th>
                      <th className="nexus-matrix-th-legacy">
                        <span className="nexus-matrix-legacy-label">Klassische B2B-Datenbanken</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="nexus-matrix-feature-col">
                        <strong>Daten-Aktualität</strong>
                        <p>Wie frisch sind die Unternehmens- & Kontaktdaten?</p>
                      </td>
                      <td className="nexus-matrix-nexus-col">
                        <div className="nexus-matrix-check-row">
                          <Check size={16} className="nexus-icon-check" />
                          <span><strong>Live Web-Crawl in Echtzeit:</strong> Jede Anfrage wird direkt auf den Quellseiten verifiziert.</span>
                        </div>
                      </td>
                      <td className="nexus-matrix-legacy-col">
                        <div className="nexus-matrix-cross-row">
                          <X size={16} className="nexus-icon-cross" />
                          <span>Statische Datenbanken mit monatelang alten, veralteten Datensätzen.</span>
                        </div>
                      </td>
                    </tr>

                    <tr>
                      <td className="nexus-matrix-feature-col">
                        <strong>Kaufsignal-Erkennung</strong>
                        <p>Gibt es einen akuten geschäftlichen Kaufanlass?</p>
                      </td>
                      <td className="nexus-matrix-nexus-col">
                        <div className="nexus-matrix-check-row">
                          <Check size={16} className="nexus-icon-check" />
                          <span><strong>Automatische Intent-Trigger:</strong> Scannt Expansionen, Managementwechsel & Stellenausschreibungen.</span>
                        </div>
                      </td>
                      <td className="nexus-matrix-legacy-col">
                        <div className="nexus-matrix-cross-row">
                          <X size={16} className="nexus-icon-cross" />
                          <span>Keine Signalerkennung. Reine Kaltakquise ohne akuten Aufhänger.</span>
                        </div>
                      </td>
                    </tr>

                    <tr>
                      <td className="nexus-matrix-feature-col">
                        <strong>Faktencheck & Quellenbeweis</strong>
                        <p>Wie verlässlich sind Entscheider und E-Mail-Adressen?</p>
                      </td>
                      <td className="nexus-matrix-nexus-col">
                        <div className="nexus-matrix-check-row">
                          <Check size={16} className="nexus-icon-check" />
                          <span><strong>FOUND vs. UNKNOWN:</strong> Direkter Link zur Primärquelle (Impressum, Pressemitteilung, Team). 0% Halluzination.</span>
                        </div>
                      </td>
                      <td className="nexus-matrix-legacy-col">
                        <div className="nexus-matrix-cross-row">
                          <X size={16} className="nexus-icon-cross" />
                          <span>E-Mail-Heuristik & Vermutungen mit hoher Bounce-Rate.</span>
                        </div>
                      </td>
                    </tr>

                    <tr>
                      <td className="nexus-matrix-feature-col">
                        <strong>Outreach-Personalisierung</strong>
                        <p>Wie wird der Erstkontakt vorbereitet?</p>
                      </td>
                      <td className="nexus-matrix-nexus-col">
                        <div className="nexus-matrix-check-row">
                          <Check size={16} className="nexus-icon-check" />
                          <span><strong>1-Click KI-Pitch:</strong> Maßgeschneiderter Aufhänger exakt abgestimmt auf das erkannte Kaufsignal.</span>
                        </div>
                      </td>
                      <td className="nexus-matrix-legacy-col">
                        <div className="nexus-matrix-cross-row">
                          <X size={16} className="nexus-icon-cross" />
                          <span>Keine KI-Integration. Manuelles Verfassen generischer Standard-Pitches nötig.</span>
                        </div>
                      </td>
                    </tr>

                    <tr>
                      <td className="nexus-matrix-feature-col">
                        <strong>Vertragsmodell & Flexibilität</strong>
                        <p>Kostenstruktur und Laufzeiten</p>
                      </td>
                      <td className="nexus-matrix-nexus-col">
                        <div className="nexus-matrix-check-row">
                          <Check size={16} className="nexus-icon-check" />
                          <span><strong>Ab 49 € / Monat:</strong> Transparent, fair und jederzeit monatlich kündbar.</span>
                        </div>
                      </td>
                      <td className="nexus-matrix-legacy-col">
                        <div className="nexus-matrix-cross-row">
                          <X size={16} className="nexus-icon-cross" />
                          <span>Oft 5.000 € – 15.000 € Mindest-Jahresbindung mit Vorkasse.</span>
                        </div>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          {/* Section: Interactive ROI & Time-Savings Calculator */}
          <section id="calculator" className="nexus-calc-section">
            <div className="nexus-section-header">
              <span className="nexus-section-tag">Interaktiver ROI-Rechner // Value Proposition</span>
              <h2 className="nexus-section-heading">Berechnen Sie Ihren Vertriebserfolg mit NeXus</h2>
              <p className="nexus-section-sub">
                Sehen Sie direkt, wie viele Stunden Rechercheaufwand Sie einsparen und welche Pipeline NeXus für Ihr Team generiert.
              </p>
            </div>

            <div className="nexus-calc-container">
              <div className="nexus-calc-controls">
                <div className="nexus-slider-group">
                  <div className="nexus-slider-header">
                    <label>Vertriebsteam-Größe (Sales Reps)</label>
                    <span className="nexus-slider-val">{teamSize} Mitarbeiter</span>
                  </div>
                  <input 
                    type="range" 
                    min="1" 
                    max="20" 
                    value={teamSize}
                    onChange={(e) => setTeamSize(parseInt(e.target.value))}
                    className="nexus-slider"
                  />
                  <div className="nexus-slider-limits">
                    <span>1 Rep</span>
                    <span>10 Reps</span>
                    <span>20 Reps</span>
                  </div>
                </div>

                <div className="nexus-slider-group">
                  <div className="nexus-slider-header">
                    <label>Durchschnittlicher Deal-Wert (Customer Lifetime Value)</label>
                    <span className="nexus-slider-val">{dealValue.toLocaleString('de-DE')} €</span>
                  </div>
                  <input 
                    type="range" 
                    min="2000" 
                    max="50000" 
                    step="1000"
                    value={dealValue}
                    onChange={(e) => setDealValue(parseInt(e.target.value))}
                    className="nexus-slider"
                  />
                  <div className="nexus-slider-limits">
                    <span>2.000 €</span>
                    <span>25.000 €</span>
                    <span>50.000 €</span>
                  </div>
                </div>

                <div className="nexus-slider-group">
                  <div className="nexus-slider-header">
                    <label>Bisherige Recherchezeit pro Rep / Woche</label>
                    <span className="nexus-slider-val">{hoursPerWeek} Stunden</span>
                  </div>
                  <input 
                    type="range" 
                    min="2" 
                    max="15" 
                    value={hoursPerWeek}
                    onChange={(e) => setHoursPerWeek(parseInt(e.target.value))}
                    className="nexus-slider"
                  />
                  <div className="nexus-slider-limits">
                    <span>2 Std/Woche</span>
                    <span>8 Std/Woche</span>
                    <span>15 Std/Woche</span>
                  </div>
                </div>
              </div>

              <div className="nexus-calc-results">
                <div className="nexus-calc-kpi-card highlight">
                  <div className="nexus-kpi-top">
                    <TrendingUp size={20} className="text-[#155DFC]" />
                    <span className="nexus-kpi-label">Erwarteter ROI</span>
                  </div>
                  <div className="nexus-kpi-value">{calculatedRoi.roiMultiplier}x</div>
                  <div className="nexus-kpi-sub">Return on Investment pro Monat</div>
                </div>

                <div className="nexus-calc-kpi-card">
                  <div className="nexus-kpi-top">
                    <Clock size={20} className="text-[#18AB61]" />
                    <span className="nexus-kpi-label">Zeitersparnis Team</span>
                  </div>
                  <div className="nexus-kpi-value">{calculatedRoi.totalHoursSavedPerMonth} Std</div>
                  <div className="nexus-kpi-sub">Rechercheaufwand pro Monat eingespart</div>
                </div>

                <div className="nexus-calc-kpi-card">
                  <div className="nexus-kpi-top">
                    <DollarSign size={20} className="text-[#171717]" />
                    <span className="nexus-kpi-label">Zusätzliche Pipeline</span>
                  </div>
                  <div className="nexus-kpi-value">+{calculatedRoi.additionalPipelinePerMonth.toLocaleString('de-DE')} €</div>
                  <div className="nexus-kpi-sub">Monatlicher Pipeline-Zuwachs</div>
                </div>

                <button className="nexus-calc-cta-btn" onClick={handleStartAnalysis}>
                  <span>Diesen ROI jetzt mit NeXus realisieren</span>
                  <ArrowRight size={16} />
                </button>
              </div>
            </div>
          </section>

          {/* Section: High-Density Horizontal Feature Deep Dives */}
          <section id="features" className="nexus-deepdives-section">
            <div className="nexus-section-header">
              <span className="nexus-section-tag">Technologie & Pipeline</span>
              <h2 className="nexus-section-heading">Präzisions-Vertrieb in 3 Schichten</h2>
              <p className="nexus-section-sub">
                Modernste KI-Agenten übernehmen die aufwändigsten Recherche- und Vorbereitungsschritte.
              </p>
            </div>

            {/* Deep Dive 1: Signal Radar */}
            <div className="nexus-deepdive-row">
              <div className="nexus-deepdive-text">
                <div className="nexus-feature-num">01 // SIGNAL RADAR</div>
                <h3 className="nexus-deepdive-title">Timing ist 80% des Vertriebserfolgs</h3>
                <p className="nexus-deepdive-desc">
                  Unternehmen kaufen genau dann, wenn ein akuter Wechsel stattfindet: Ein neuer Vertriebsleiter wird ernannt, eine Finanzierungsrunde wird geschlossen oder neue Standorte werden eröffnet. NeXus überwacht diese Trigger kontinuierlich im Web.
                </p>
                <div className="nexus-deepdive-bullets">
                  <div className="nexus-bullet-item">
                    <Check size={14} className="nexus-bullet-check" />
                    <span>Live-Erkennung von Stellenanzeigen & Management-Changes</span>
                  </div>
                  <div className="nexus-bullet-item">
                    <Check size={14} className="nexus-bullet-check" />
                    <span>Kategorisierung nach Dringlichkeit und Budget-Indikatoren</span>
                  </div>
                </div>
              </div>

              <div className="nexus-deepdive-visual">
                <div className="nexus-terminal-box">
                  <div className="nexus-terminal-bar">
                    <span className="nexus-term-dot red"></span>
                    <span className="nexus-term-dot yellow"></span>
                    <span className="nexus-term-dot green"></span>
                    <span className="nexus-term-title">signal_radar_stream.log</span>
                  </div>
                  <div className="nexus-terminal-body">
                    <div className="nexus-stream-line">
                      <span className="nexus-code-time">14:02:19</span>
                      <span className="nexus-code-badge blue">TRIGGER</span>
                      <span className="nexus-code-txt">Kaercher B2B: 12 Sales Expansions detected</span>
                    </div>
                    <div className="nexus-stream-line">
                      <span className="nexus-code-time">14:02:22</span>
                      <span className="nexus-code-badge green">CRAWL</span>
                      <span className="nexus-code-txt">Domain verified: kaercher.com (HTTP 200)</span>
                    </div>
                    <div className="nexus-stream-line">
                      <span className="nexus-code-time">14:02:25</span>
                      <span className="nexus-code-badge purple">INTENT</span>
                      <span className="nexus-code-txt">High Fit Score: 96% matching your Offering</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Deep Dive 2: Fact-Check Contact Intelligence */}
            <div className="nexus-deepdive-row nexus-deepdive-reverse">
              <div className="nexus-deepdive-text">
                <div className="nexus-feature-num">02 // CONTACT INTELLIGENCE</div>
                <h3 className="nexus-deepdive-title">Echte Fakten statt KI-Halluzinationen</h3>
                <p className="nexus-deepdive-desc">
                  Andere Tools generieren E-Mail-Muster ins Blaue hinein. NeXus prüft jede Information auf der echten Unternehmenswebsite. Nur was im Impressum, auf offiziellen Teamseiten oder in autorisierten Pressemitteilungen nachweisbar ist, wird als verifiziert übergeben.
                </p>
                <div className="nexus-deepdive-bullets">
                  <div className="nexus-bullet-item">
                    <Check size={14} className="nexus-bullet-check" />
                    <span>Automatischer Impressums- & Domain-Faktencheck</span>
                  </div>
                  <div className="nexus-bullet-item">
                    <Check size={14} className="nexus-bullet-check" />
                    <span>Transparente FOUND- & UNKNOWN-Status-Indikatoren</span>
                  </div>
                </div>
              </div>

              <div className="nexus-deepdive-visual">
                <div className="nexus-factcheck-card">
                  <div className="nexus-fc-header">
                    <Shield size={16} className="text-[#18AB61]" />
                    <span className="font-mono text-xs font-bold text-[#171717]">VERIFICATION AUDIT TRAIL</span>
                  </div>
                  <div className="nexus-fc-item">
                    <div className="nexus-fc-label">Primary Source:</div>
                    <div className="nexus-fc-val font-mono">kaercher.com/de/impressum</div>
                  </div>
                  <div className="nexus-fc-item">
                    <div className="nexus-fc-label">Decider Found:</div>
                    <div className="nexus-fc-val font-bold">Dr. Stefan Heinrich (VP Sales Ops)</div>
                  </div>
                  <div className="nexus-fc-status-row">
                    <span className="nexus-status-found">VERIFIED SOURCE [LEGAL NOTICE]</span>
                    <span className="text-[11px] text-[#666666] font-mono">Latency: 480ms</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Deep Dive 3: 1-Click AI Outreach */}
            <div className="nexus-deepdive-row">
              <div className="nexus-deepdive-text">
                <div className="nexus-feature-num">03 // 1-CLICK OUTREACH</div>
                <h3 className="nexus-deepdive-title">Persönliche Erstansprache mit echtem Aufhänger</h3>
                <p className="nexus-deepdive-desc">
                  Niemand reagiert mehr auf generische Kaltakquise-Mails. NeXus formuliert einen prägnanten, professionellen Einstieg, der genau auf das soeben identifizierte Kaufsignal Bezug nimmt.
                </p>
                <div className="nexus-deepdive-bullets">
                  <div className="nexus-bullet-item">
                    <Check size={14} className="nexus-bullet-check" />
                    <span>Aufhänger direkt bezogen auf Expansion, Trigger oder Stellenausschreibung</span>
                  </div>
                  <div className="nexus-bullet-item">
                    <Check size={14} className="nexus-bullet-check" />
                    <span>Direkt bereit für E-Mail-Outreach oder LinkedIn Direct Message</span>
                  </div>
                </div>
              </div>

              <div className="nexus-deepdive-visual">
                <div className="nexus-pitch-preview">
                  <div className="nexus-pitch-bar">
                    <span className="nexus-pitch-tag font-mono">AI GENERATED OUTREACH PITCH</span>
                  </div>
                  <div className="nexus-pitch-body">
                    <p className="text-xs text-[#505050] leading-relaxed">
                      "Guten Tag Herr Dr. Heinrich,<br /><br />
                      ich habe gesehen, dass Sie bei Kärcher aktuell <strong>12 neue Account Executives</strong> für die DACH-Expansion aufbauen..."
                    </p>
                    <div className="nexus-pitch-badge-wrap">
                      <span className="nexus-pill-badge-mini">Trigger: Sales Expansion</span>
                      <span className="nexus-pill-badge-mini">Relevanz: 98%</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Section: Security & Compliance Grid */}
          <section id="compliance" className="nexus-compliance-section">
            <div className="nexus-section-header">
              <span className="nexus-section-tag">Rechtssicherheit // Made for DACH</span>
              <h2 className="nexus-section-heading">100% DSGVO-konform für den deutschen B2B-Vertrieb</h2>
              <p className="nexus-section-sub">
                Keine Rechtsrisiken. Vollständig im Einklang mit europäischem Datenschutzrecht.
              </p>
            </div>

            <div className="nexus-compliance-grid">
              <div className="nexus-comp-feature-card">
                <div className="nexus-comp-icon-box">
                  <Shield size={20} />
                </div>
                <h4>Art. 6 Abs. 1 lit. f DSGVO</h4>
                <p>Rechtskonforme Verarbeitung unter Wahrung des berechtigten Interesses im geschäftlichen B2B-Direktvertrieb.</p>
              </div>

              <div className="nexus-comp-feature-card">
                <div className="nexus-comp-icon-box">
                  <Globe size={20} />
                </div>
                <h4>Server in Frankfurt / EU</h4>
                <p>Ausschließlich europäische Rechenzentren (ISO 27001 zertifiziert) mit vollständiger Datenhoheit.</p>
              </div>

              <div className="nexus-comp-feature-card">
                <div className="nexus-comp-icon-box">
                  <Terminal size={20} />
                </div>
                <h4>Transparenter Quellennachweis</h4>
                <p>Jeder Kontaktpunkt ist mit der exakten Primärquelle (Website, Impressum) auditierbar hinterlegt.</p>
              </div>

              <div className="nexus-comp-feature-card">
                <div className="nexus-comp-icon-box">
                  <Lock size={20} />
                </div>
                <h4>Keine privaten Datenpools</h4>
                <p>Keine Speicherung oder Weitergabe unzulässiger privater Personendaten. Reine Unternehmenskommunikation.</p>
              </div>
            </div>
          </section>

          {/* Section: Pricing Section */}
          <section id="preise" className="nexus-pricing-section">
            <div className="nexus-section-header">
              <span className="nexus-section-tag">Preise</span>
              <h2 className="nexus-section-heading">Einfache, transparente Tarife</h2>
              <p className="nexus-section-sub">Keine versteckten Jahresverträge. Jederzeit monatlich kündbar.</p>
            </div>

            <div className="nexus-pricing-grid">
              <div className="nexus-price-card">
                <div className="nexus-price-header">
                  <h3>Free</h3>
                  <div className="nexus-price-amount">0 € <span>einmalig</span></div>
                  <p>Zum Kennenlernen und Testen der Datenqualität</p>
                </div>
                <ul className="nexus-price-features">
                  <li><Check size={14} /> 5 verifizierte Leads</li>
                  <li><Check size={14} /> Kaufsignal-Erkennung</li>
                  <li><Check size={14} /> DSGVO-Quellennachweis</li>
                </ul>
                <button className="nexus-price-btn-ghost" onClick={handleStartAnalysis}>
                  Kostenlos testen
                </button>
              </div>

              <div className="nexus-price-card nexus-price-card-featured">
                <div className="nexus-featured-badge">Empfohlen</div>
                <div className="nexus-price-header">
                  <h3>Pro</h3>
                  <div className="nexus-price-amount">49 € <span>/ Monat</span></div>
                  <p>Für aktive Vertriebler und wachsende Agenturen</p>
                </div>
                <ul className="nexus-price-features">
                  <li><Check size={14} /> 100 verifizierte Leads / Monat</li>
                  <li><Check size={14} /> Automatischer Signal-Radar</li>
                  <li><Check size={14} /> Contact Intelligence v3</li>
                  <li><Check size={14} /> KI-Pitch-Generator</li>
                  <li><Check size={14} /> Sales Coach Chat</li>
                </ul>
                <button className="nexus-price-btn-primary" onClick={() => navigate('/register')}>
                  Pro-Tarif starten
                </button>
              </div>

              <div className="nexus-price-card">
                <div className="nexus-price-header">
                  <h3>Enterprise</h3>
                  <div className="nexus-price-amount">232 € <span>/ Monat</span></div>
                  <p>Für Sales-Teams mit hohem Lead-Bedarf</p>
                </div>
                <ul className="nexus-price-features">
                  <li><Check size={14} /> 500 verifizierte Leads / Monat</li>
                  <li><Check size={14} /> Prioritäts-Radar & Webhooks</li>
                  <li><Check size={14} /> Unbegrenzter Sales Coach</li>
                  <li><Check size={14} /> Dedizierter Support</li>
                </ul>
                <button className="nexus-price-btn-ghost" onClick={() => navigate('/register')}>
                  Enterprise wählen
                </button>
              </div>
            </div>
          </section>

          {/* Section: Interactive FAQ Accordion */}
          <section id="faq" className="nexus-faq-section">
            <div className="nexus-section-header">
              <span className="nexus-section-tag">FAQ // Häufige Fragen</span>
              <h2 className="nexus-section-heading">Alles, was Sie wissen müssen</h2>
            </div>

            <div className="nexus-faq-container">
              {FAQS.map((faq, idx) => {
                const isOpen = openFaq === idx
                return (
                  <div 
                    key={idx} 
                    className={`nexus-faq-item ${isOpen ? 'open' : ''}`}
                    onClick={() => setOpenFaq(isOpen ? null : idx)}
                  >
                    <div className="nexus-faq-q">
                      <span>{faq.q}</span>
                      <ChevronDown size={18} className={`nexus-faq-arrow ${isOpen ? 'rotate' : ''}`} />
                    </div>
                    {isOpen && (
                      <div className="nexus-faq-a">
                        <p>{faq.a}</p>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </section>

          {/* Bottom CTA Banner */}
          <footer className="nexus-footer-cta">
            <h2 className="nexus-footer-title">Bereit, Ihren B2B-Vertrieb auf Autopilot zu setzen?</h2>
            <p className="nexus-footer-sub">
              Starten Sie noch heute mit Ihrer kostenlosen Angebotsanalyse.
            </p>
            <button className="nexus-btn-primary-large" onClick={handleStartAnalysis}>
              <span>Jetzt kostenlose Analyse starten</span>
              <ArrowRight size={16} />
            </button>
            <div className="nexus-footer-bottom-bar">
              <div className="nexus-footer-status">
                <span className="nexus-status-indicator"></span>
                <span>System Status: Alle Agenten in Frankfurt/EU aktiv</span>
              </div>
              <div className="nexus-footer-links">
                <a href="/impressum">Impressum</a>
                <a href="/datenschutz">Datenschutz</a>
                <a href="/agb">AGB</a>
              </div>
            </div>
          </footer>

        </div>
      </div>
    )
  }

  // --- Step 2: Instant Offering Analysis Input ---
  if (step === 'input') {
    return (
      <div className="nexus-framer-wrapper">
        <div className="nexus-framer-container p-6 md:p-12">
          <button className="nexus-back-link" onClick={() => setStep('landing')}>
            ← Zurück zur Übersicht
          </button>
          
          <div className="nexus-input-card">
            <div className="nexus-input-header">
              <span className="nexus-section-tag">Kostenlose Angebots-Analyse</span>
              <h1 className="nexus-input-title">Beschreiben Sie Ihr B2B-Angebot</h1>
              <p className="nexus-input-desc">
                Unsere KI analysiert Ihren Zielmarkt und ermittelt die optimalen Kaufsignal-Muster für Ihre Branche.
              </p>
            </div>
            
            <form onSubmit={handleSubmitOffer} className="nexus-form">
              <div className="nexus-form-field">
                <label htmlFor="branche">Branche / Zielmarkt</label>
                <select 
                  id="branche"
                  value={branche}
                  onChange={(e) => setBranche(e.target.value)}
                  required
                >
                  <option value="">Wählen Sie Ihre Zielbranche</option>
                  {BRANCHEN.map(b => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                </select>
              </div>
              
              <div className="nexus-form-field">
                <label htmlFor="angebot">Ihr Angebot & Zielkunden</label>
                <textarea 
                  id="angebot"
                  value={angebot}
                  onChange={(e) => setAngebot(e.target.value)}
                  placeholder="Beschreiben Sie kurz Ihr Produkt oder Ihre Dienstleistung, Ihre Zielgruppe und den typischen Nutzen. Beispiel: Wir optimieren Vertriebsprozesse für mittelständische Maschinenbauer und SaaS-Unternehmen ab 50 Mitarbeitenden."
                  rows={6}
                  required
                />
              </div>
              
              {error && <div className="nexus-form-error">{error}</div>}
              
              <button type="submit" className="nexus-btn-primary-large w-full justify-center">
                <span>Analyse jetzt starten</span>
                <ArrowRight size={16} />
              </button>
            </form>
          </div>
        </div>
      </div>
    )
  }

  // --- Step 3: Analyzing State ---
  if (step === 'analyzing') {
    return (
      <div className="nexus-framer-wrapper">
        <div className="nexus-framer-container p-12 text-center">
          <div className="nexus-analyzing-box">
            <div className="nexus-spinner"></div>
            <h2 className="text-xl font-bold text-[#171717] mt-6 mb-2">Ihr Markt wird analysiert...</h2>
            <p className="text-sm text-[#666666] mb-6">NeXus ermittelt die passenden Kaufsignale, Zielgruppen und Vertriebsstrategien.</p>
            
            <div className="nexus-progress-list">
              <div className="nexus-progress-step active">
                <span className="nexus-prog-dot"></span>
                <span>Vertriebsmodell & Value Proposition strukturieren</span>
              </div>
              <div className="nexus-progress-step active">
                <span className="nexus-prog-dot"></span>
                <span>Entscheider-Profile & Rollen identifizieren</span>
              </div>
              <div className="nexus-progress-step active">
                <span className="nexus-prog-dot"></span>
                <span>Kaufsignale & Trigger-Kategorien berechnen</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // --- Step 4: Analysis Result ---
  if (step === 'result' && analyse) {
    return (
      <div className="nexus-framer-wrapper">
        <div className="nexus-framer-container p-6 md:p-12">
          <div className="nexus-result-top">
            <span className="nexus-section-tag">Analyse Abgeschlossen</span>
            <h1 className="text-2xl md:text-3xl font-bold text-[#171717] mt-1 mb-2">
              Ihre NeXus Lead Intelligence
            </h1>
            <p className="text-sm text-[#666666]">
              Hier ist die maßgeschneiderte Vertriebsstrategie für Ihr Angebot:
            </p>
          </div>
          
          <div className="nexus-result-content">
            <NexusAnalysisResult data={analyse} mode="angebotsanalyse" />
          </div>
          
          <div className="nexus-result-register-banner">
            <div>
              <h3 className="text-lg font-bold text-[#171717]">Möchten Sie echte Leads zu diesem Angebot finden?</h3>
              <p className="text-sm text-[#666666] mt-1">
                Registrieren Sie sich kostenlos, um den automatischen Signal-Radar für Ihr Angebot zu aktivieren.
              </p>
            </div>
            <button className="nexus-btn-primary-large" onClick={handleRegisterForMore}>
              <span>Kostenlos registrieren</span>
              <ArrowRight size={16} />
            </button>
          </div>
        </div>
      </div>
    )
  }

  return null
}
