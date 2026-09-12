import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { 
  ArrowRight, Check, X, Shield, Search, Zap, 
  Sparkles, Building2, ChevronRight, ChevronDown, Lock,
  Globe, Terminal, Cpu, Database, Mail, Award
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
            <div className="nexus-brand">
              <div className="nexus-logo-box">N</div>
              <span className="nexus-brand-title">NeXus</span>
            </div>

            <nav className="nexus-nav">
              <a href="#radar" className="nexus-nav-link">Signal-Radar</a>
              <a href="#vergleich" className="nexus-nav-link">Der Unterschied</a>
              <a href="#features" className="nexus-nav-link">Deep Dives</a>
              <a href="#compliance" className="nexus-nav-link">DSGVO & Sicherheit</a>
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
              NeXus ersetzt veraltete Kontaktdatenbanken. Unsere KI überwacht Live-Trigger im Markt, verifiziert echte Entscheider auf Primärquellen und automatisiert die persönliche Erstansprache.
            </p>

            <div className="nexus-hero-cta-group">
              <button className="nexus-btn-primary-large" onClick={handleStartAnalysis}>
                <span>Kostenlose Lead-Analyse starten</span>
                <ArrowRight size={16} />
              </button>
              <button className="nexus-btn-secondary-large" onClick={() => {
                const el = document.getElementById('radar')
                el?.scrollIntoView({ behavior: 'smooth' })
              }}>
                Live-Signal-Radar ansehen
              </button>
            </div>

            <div className="nexus-trust-strip">
              <div className="nexus-trust-item">
                <Check size={14} className="nexus-trust-check" />
                <span>100% DSGVO-konform (Art. 6 Abs. 1 lit. f)</span>
              </div>
              <div className="nexus-trust-item">
                <Check size={14} className="nexus-trust-check" />
                <span>Kein E-Mail-Raten (Echte Web-Fakten)</span>
              </div>
              <div className="nexus-trust-item">
                <Check size={14} className="nexus-trust-check" />
                <span>Keine Kreditkarte erforderlich</span>
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

          {/* Section 2: Sovereign Feature-by-Feature Comparison Matrix Table */}
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

          {/* Section 3: High-Density Horizontal Feature Deep Dives */}
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
                      <span className="nexus-code-txt">High Fit Score: 94% matching your Offering</span>
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
                  Niemand reagiert mehr auf Standard-Kaltakquise-Mails. NeXus formuliert einen prägnanten, professionellen Einstieg, der genau auf das soeben identifizierte Kaufsignal Bezug nimmt.
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
                      <span className="nexus-pill-badge-mini">🎯 Trigger: Sales Expansion</span>
                      <span className="nexus-pill-badge-mini">⚡ Relevanz: 98%</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Section 4: Security & Compliance Grid */}
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

          {/* Section 5: Pricing Section */}
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

          {/* Section 6: Interactive FAQ Accordion */}
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
