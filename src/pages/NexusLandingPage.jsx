import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { 
  Radar, Target, TrendingUp, ShieldCheck, ArrowRight, Zap, 
  Activity, CheckCircle2, Clock, Sparkles, Building2, 
  Send, RefreshCw, Lock, Globe, MessageSquare, ChevronRight,
  FileCheck, Search, Users, Flame
} from 'lucide-react'
import { callNexusAI } from '../lib/nexus-ai'
import { useAuth } from '../context/AuthContext'
import './NexusLandingPage.css'

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
  
  // Interactive Live Demo state
  const [angebot, setAngebot] = useState('')
  const [branche, setBranche] = useState('IT & Digitalisierung / B2B SaaS')
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
      setAnalysisError('Bitte beschreiben Sie kurz Ihr Angebot oder wählen Sie ein Beispiel.')
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

  return (
    <div className="nexus-page">
      
      {/* Navigation Header */}
      <nav className="nexus-nav">
        <div className="nexus-logo" onClick={() => navigate('/')} style={{ cursor: 'pointer' }}>
          <Radar size={28} className="nexus-accent" />
          <span>NeXus</span>
        </div>

        <div className="nexus-nav-links">
          {user ? (
            <Link to="/nexus/dashboard" className="nexus-btn-primary">
              Zum Dashboard
            </Link>
          ) : (
            <Link to="/login" className="nexus-btn-primary">
              Anmelden
            </Link>
          )}
        </div>
      </nav>

      {/* Hero Section */}
      <header className="nexus-hero">
        <div className="nexus-badge">Kaltakquise ist tot</div>
        <h1>
          Deine Konkurrenz nutzt <span className="nexus-accent-text">KI-Radar</span>,<br/>
          während du noch Copy-Paste machst.
        </h1>
        <p className="nexus-subtitle">
          98% der generischen Kaltakquise-Nachrichten werden ignoriert. NeXus scannt das Web in Echtzeit nach B2B-Unternehmen, <strong>die genau jetzt akuten Bedarf an deinem Angebot haben</strong>, und formuliert die psychologisch treffende Erstansprache.
        </p>

        {/* =========================================================================
            INTERACTIVE LIVE TEST BOX ("Blut lecken" - Ausprobieren direkt auf der Seite)
            ========================================================================= */}
        <div className="nexus-live-test-card" id="live-test">
          <div className="nexus-live-test-header">
            <div className="nexus-live-pulse-dot"></div>
            <h3>NeXus Live-Analyse: Teste dein eigenes B2B-Angebot</h3>
          </div>
          <p className="nexus-live-test-sub">
            Gib dein Angebot ein oder wähle ein Beispiel. Die NeXus-KI ermittelt sofort deine idealen Entscheider, aktuelle Kaufsignale im Markt und den perfekten Einstiegs-Pitch:
          </p>

          {/* Preset Buttons */}
          <div className="nexus-presets-row">
            <span className="nexus-presets-label">Beispiele:</span>
            {PRESET_OFFERS.map((p, idx) => (
              <button 
                key={idx}
                type="button"
                className="nexus-preset-btn"
                onClick={() => handleSelectPreset(p)}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Form */}
          <form onSubmit={handleRunAnalysis} className="nexus-live-form">
            <textarea
              className="nexus-live-textarea"
              rows={3}
              placeholder="z. B. Wir entwickeln maßgeschneiderte KI-Lösungen zur Dokumentenverarbeitung für mittelständische Steuerberater und Rechtsanwaltskanzleien..."
              value={angebot}
              onChange={(e) => setAngebot(e.target.value)}
              disabled={isAnalyzing}
            />

            {analysisError && <div className="nexus-live-error">{analysisError}</div>}

            <div className="nexus-live-actions">
              <button 
                type="submit" 
                className="nexus-btn-huge"
                disabled={isAnalyzing || !angebot.trim()}
              >
                {isAnalyzing ? (
                  <>
                    <RefreshCw size={20} className="nexus-spinner-icon" />
                    <span>NeXus analysiert dein Angebot...</span>
                  </>
                ) : (
                  <>
                    <span>NeXus Live-Analyse starten</span>
                    <ArrowRight size={20} />
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Live Analysis Output */}
          {analysisResult && (
            <div className="nexus-live-result-box">
              <div className="nexus-result-header-bar">
                <CheckCircle2 size={20} className="text-[#18AB61]" />
                <span className="font-bold">Analyse abgeschlossen für: {branche}</span>
              </div>

              <div className="nexus-result-grid">
                {/* Block 1: Zielgruppe & Entscheider */}
                <div className="nexus-result-card">
                  <div className="nexus-result-card-title">
                    <Users size={18} className="text-[#F59E0B]" />
                    <span>Identifizierte Entscheider</span>
                  </div>
                  <div className="nexus-result-card-body">
                    {analysisResult.zielgruppe?.rollen ? (
                      <ul className="nexus-result-list">
                        {analysisResult.zielgruppe.rollen.map((r, i) => (
                          <li key={i}>{r}</li>
                        ))}
                      </ul>
                    ) : (
                      <p>{typeof analysisResult.zielgruppe === 'string' ? analysisResult.zielgruppe : 'Geschäftsführung, Bereichsleiter, VP Operations & IT-Entscheider.'}</p>
                    )}
                  </div>
                </div>

                {/* Block 2: Relevante Kaufsignale */}
                <div className="nexus-result-card">
                  <div className="nexus-result-card-title">
                    <Activity size={18} className="text-[#F59E0B]" />
                    <span>Relevante Kaufsignal-Muster</span>
                  </div>
                  <div className="nexus-result-card-body">
                    {analysisResult.kaufsignale?.length ? (
                      <ul className="nexus-result-list">
                        {analysisResult.kaufsignale.map((s, i) => (
                          <li key={i}><strong>{s.kategorie || 'Trigger'}:</strong> {s.beschreibung || s}</li>
                        ))}
                      </ul>
                    ) : (
                      <ul className="nexus-result-list">
                        <li><strong>Expansion:</strong> Stellenausschreibungen und Teamausbau.</li>
                        <li><strong>Managementwechsel:</strong> Neubesetzung in Führungspositionen.</li>
                        <li><strong>Modernisierung:</strong> Umstellung auf neue Technologien & Compliance.</li>
                      </ul>
                    )}
                  </div>
                </div>

                {/* Block 3: Psychologischer Erstkontakt-Pitch */}
                <div className="nexus-result-card nexus-result-card-full">
                  <div className="nexus-result-card-title">
                    <Zap size={18} className="text-[#F59E0B]" />
                    <span>Psychologisch optimierter Erstkontakt-Pitch</span>
                  </div>
                  <div className="nexus-result-pitch-body">
                    {analysisResult.strategie?.pitch || analysisResult.pitch || analysisResult.ansprache ? (
                      <p>{analysisResult.strategie?.pitch || analysisResult.pitch || analysisResult.ansprache}</p>
                    ) : (
                      <p>
                        "Guten Tag [Name],<br /><br />
                        ich habe gesehen, dass Sie aktuell den Bereich [Bereich] bei [Unternehmen] strategisch neu aufstellen. Bei ähnlichen Unternehmen führt dieser Übergang häufig zu Engpässen in der Effizienz.<br /><br />
                        Mit {angebot.slice(0, 80)}... helfen wir Entscheidern, diese Phase ohne Reibungsverluste zu meistern.<br /><br />
                        Wäre ein 10-minütiger Ideenaustausch dazu für Sie von Interesse?"
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Conversion CTA inside result */}
              <div className="nexus-result-cta-banner">
                <div className="nexus-result-cta-text">
                  <h4>Möchtest du echte Leads zu diesen Kaufsignalen erhalten?</h4>
                  <p>Registriere dich jetzt kostenlos, um den automatischen Signal-Radar für dein Angebot zu aktivieren.</p>
                </div>
                <button className="nexus-btn-primary" onClick={handleRegisterWithResult}>
                  <span>Kostenlos registrieren & Radar aktivieren</span>
                  <ArrowRight size={18} />
                </button>
              </div>
            </div>
          )}

          <div className="nexus-guarantee-strip">
            <span><ShieldCheck size={16} /> 100% DSGVO-konform (Art. 6 Abs. 1 lit. f)</span>
            <span><FileCheck size={16} /> Verifizierte Primärquellen</span>
            <span><Lock size={16} /> Keine Kreditkarte erforderlich</span>
          </div>
        </div>
      </header>

      {/* 3 Core Pillars */}
      <section className="nexus-features">
        <div className="nexus-feature-card">
          <Target size={32} className="nexus-icon" />
          <h3>Laser-Fokus</h3>
          <p>Finde Vorstände, Entscheider oder Fachbereichsleiter exakt in der Sekunde, in der sie im Web oder in Bekanntmachungen akuten Bedarf signalisieren.</p>
        </div>
        <div className="nexus-feature-card">
          <Activity size={32} className="nexus-icon" />
          <h3>Echtzeit-Trigger</h3>
          <p>Warum Wochen warten? NeXus alarmiert dich bei Trigger-Events (z. B. Expansionen, Managementwechsel, Budgetfreigaben), bevor deine Konkurrenz überhaupt davon erfährt.</p>
        </div>
        <div className="nexus-feature-card">
          <Zap size={32} className="nexus-icon" />
          <h3>KI-Sales-Psychologie</h3>
          <p>Lass unsere elitäre Sales-KI den perfekten Eisbrecher formulieren. Subtil, extrem konvertierend und psychologisch exakt auf das konkrete Signal abgestimmt.</p>
        </div>
      </section>

      {/* Step-by-Step Product Explanation */}
      <section className="nexus-manual">
        <h2>So funktioniert NeXus: Von der Erkennung bis zum Termin</h2>
        <p className="nexus-manual-sub">
          Vergiss klassische Kaltakquise. Ab sofort kontaktierst du niemanden mehr auf gut Glück. 
          Du nutzt <strong>Trigger-Events</strong>. Hier ist die genaue Anleitung, wie du mit NeXus täglich warme Leads generierst und abschließt.
        </p>

        <div className="nexus-manual-steps">
          <div className="nexus-step">
            <div className="nexus-step-number"><Target size={22} color="#000" /></div>
            <div className="nexus-step-content">
              <h4>Grundregel: Was ist ein „Trigger-Event“?</h4>
              <p>Ein Trigger-Event ist ein Auslöser im Web, der anzeigt, dass ein Unternehmen <em>genau jetzt</em> Bedarf an einer Lösung hat. NeXus sucht nicht nach Leuten, die rufen: „Ich brauche Produkt X!“ (da ist der Wettbewerb schon da). NeXus sucht nach Intent-Signalen: Ein neuer Manager wird eingestellt, eine Finanzierung wird gemeldet, oder ein Unternehmen expandiert in neue Standorte.</p>
            </div>
          </div>
          
          <div className="nexus-step">
            <div className="nexus-step-number">1</div>
            <div className="nexus-step-content">
              <h4>Radar & KI konfigurieren (Der Setup-Scan)</h4>
              <p>Du gibst der KI in den Einstellungen dein Angebot und deine Zielbranche an. NeXus scannt ab sofort in Echtzeit News-Feeds, Fachportale und Register nach passenden Kaufanlässen für deine Dienstleistung oder dein Produkt.</p>
            </div>
          </div>

          <div className="nexus-step">
            <div className="nexus-step-number">2</div>
            <div className="nexus-step-content">
              <h4>Leads & Signal-Audit richtig lesen</h4>
              <p>Das Radar liefert dir vorqualifizierte Leads mit transparentem Status (FOUND vs. UNKNOWN). Du siehst sofort den Primärquellen-Nachweis aus dem Impressum oder der Pressemitteilung – 100% DSGVO-konform ohne Spekulationen.</p>
            </div>
          </div>

          <div className="nexus-step">
            <div className="nexus-step-number">3</div>
            <div className="nexus-step-content">
              <h4>Den KI-Pitch generieren (1-Click Outreach)</h4>
              <p>Schreibe keine Standard-Mails mehr. Mit einem Klick analysiert die NeXus-KI den Kontext des Signals und formuliert einen maßgeschneiderten Einstieg, der den Schmerzpunkt des Entscheiders exakt adressiert.</p>
            </div>
          </div>

          <div className="nexus-step">
            <div className="nexus-step-number">4</div>
            <div className="nexus-step-content">
              <h4>Akquise durchführen (Copy, Paste, Close)</h4>
              <p>Nutze die generierte Nachricht auf LinkedIn oder per E-Mail. Da du mit einem echten Anlass und echtem Mehrwert startest, liegt deine Antwort- und Terminquote um ein Vielfaches höher als bei herkömmlicher Kaltakquise.</p>
            </div>
          </div>
        </div>

        <div className="nexus-cta-group" style={{ marginTop: '48px' }}>
          <button className="nexus-btn-huge" onClick={() => {
            const el = document.getElementById('live-test')
            el?.scrollIntoView({ behavior: 'smooth' })
          }}>
            <span>Eigenes Angebot jetzt oben live testen</span>
            <ArrowRight size={20} />
          </button>
        </div>
      </section>

      {/* Social Proof & Closing Section */}
      <section className="nexus-social-proof">
        <h2>Die smarte Elite skaliert lautlos. Du auch?</h2>
        <p>Wer technologisch den Anschluss verliert, verliert den Markt. Teste jetzt NeXus für dein Angebot und starte in die signalbasierte B2B-Akquise.</p>
        <button className="nexus-btn-secondary" onClick={() => navigate(user ? '/nexus/dashboard' : '/register')}>
          Kostenlosen Zugang erstellen
        </button>
      </section>
      
      {/* Footer */}
      <footer className="nexus-footer">
        <p>&copy; {new Date().getFullYear()} NeXus Intelligence. B2B Sales Engine.</p>
        <div className="nexus-footer-links">
          <Link to="/impressum">Impressum</Link>
          <Link to="/datenschutz">Datenschutz</Link>
        </div>
      </footer>

    </div>
  )
}
