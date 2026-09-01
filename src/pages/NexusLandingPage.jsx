import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { 
  Target, Zap, Users, ArrowRight, CheckCircle, Sparkles,
  Building2, TrendingUp, BarChart3, Shield, Clock
} from 'lucide-react'
import { callNexusAI } from '../lib/nexus-ai'
import NexusAnalysisResult from '../components/NexusAnalysisResult'
import './NexusLandingPage.css'

const BRANCHEN = [
  "Bauwesen & Handwerk",
  "IT & Digitalisierung",
  "Marketing & Werbung",
  "Beratung & Coaching",
  "Immobilien",
  "Gastronomie & Tourismus",
  "Gesundheit & Pflege",
  "Bildung & Training",
  "Handel & E-Commerce",
  "Sonstiges"
]

export default function NexusLandingPage() {
  const navigate = useNavigate()
  const [step, setStep] = useState('landing') // landing | input | analyzing | result
  const [angebot, setAngebot] = useState('')
  const [branche, setBranche] = useState('')
  const [analyse, setAnalyse] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  const handleStartAnalysis = () => {
    setStep('input')
  }

  const handleSubmitOffer = async (e) => {
    e.preventDefault()
    if (!angebot.trim() || !branche) {
      setError('Bitte beschreibe dein Angebot und wähle eine Branche.')
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
    } catch (err) {
      console.error('Analyse Fehler:', err)
      setError('Es ist ein Fehler aufgetreten. Bitte versuche es erneut.')
      setStep('input')
    } finally {
      setLoading(false)
    }
  }

  const handleRegisterForMore = () => {
    // Save analysis to sessionStorage for after registration
    sessionStorage.setItem('nexus_pending_analysis', JSON.stringify({
      angebot,
      branche,
      analyse
    }))
    navigate('/register')
  }

  if (step === 'landing') {
    return (
      <div className="nexus-landing">
        <section className="nexus-hero">
          <div className="nexus-hero-content">
            <span className="nexus-badge">Sales Intelligence Platform</span>
            <h1>Verstehe deine Kunden.<br/>Schliesse mehr deals.</h1>
            <p className="nexus-hero-subtitle">
              NeXus analysiert deinen Markt, findet Kaufsignale und zeigt dir genau, 
              wann und wie du potenzielle Kunden ansprichst.
            </p>
            <button className="nexus-hero-cta" onClick={handleStartAnalysis}>
              <Sparkles size={20} />
              Kostenlose Angebotsanalyse starten
            </button>
            <p className="nexus-hero-hint">
              Kein Login nötig · Ergebnis in 30 Sekunden
            </p>
          </div>
          <div className="nexus-hero-visual">
            <div className="nexus-hero-card nexus-card-1">
              <Target size={24} color="#10B981" />
              <span>Lead Radar</span>
            </div>
            <div className="nexus-hero-card nexus-card-2">
              <Users size={24} color="#3B82F6" />
              <span>Kontakte</span>
            </div>
            <div className="nexus-hero-card nexus-card-3">
              <TrendingUp size={24} color="#8B5CF6" />
              <span>Chancen</span>
            </div>
          </div>
        </section>

        <section className="nexus-features">
          <div className="nexus-feature">
            <div className="nexus-feature-icon" style={{ background: '#10B98120', color: '#10B981' }}>
              <Target size={24} />
            </div>
            <h3>Triggererkennung</h3>
            <p>Finde heraus, wann Unternehmen bereit sind zu kaufen</p>
          </div>
          <div className="nexus-feature">
            <div className="nexus-feature-icon" style={{ background: '#3B82F620', color: '#3B82F6' }}>
              <BarChart3 size={24} />
            </div>
            <h3>Lead Intelligence</h3>
            <p>Detaillierte Analyse deiner Zielkunden</p>
          </div>
          <div className="nexus-feature">
            <div className="nexus-feature-icon" style={{ background: '#8B5CF620', color: '#8B5CF6' }}>
              <Zap size={24} />
            </div>
            <h3>Sales Workspace</h3>
            <p>Generiere personalisierte Nachrichten und Nachfass-Aktionen</p>
          </div>
        </section>

        <section className="nexus-social-proof">
          <div className="nexus-proof-item">
            <CheckCircle size={20} color="#10B981" />
            <span>Für jede Branche nutzbar</span>
          </div>
          <div className="nexus-proof-item">
            <CheckCircle size={20} color="#10B981" />
            <span>KI-gestützte Verkaufsstrategie</span>
          </div>
          <div className="nexus-proof-item">
            <CheckCircle size={20} color="#10B981" />
            <span>Ergebnis sofort anwendbar</span>
          </div>
        </section>
      </div>
    )
  }

  if (step === 'input') {
    return (
      <div className="nexus-input-page">
        <button className="nexus-back-btn" onClick={() => setStep('landing')}>
          ← Zurück
        </button>
        
        <div className="nexus-input-container">
          <div className="nexus-input-header">
            <Target size={32} color="var(--color-koralle)" />
            <h1>Was bietest du an?</h1>
            <p>Beschreibe dein Angebot und erhalte eine kostenlose KI-Analyse</p>
          </div>
          
          <form onSubmit={handleSubmitOffer} className="nexus-input-form">
            <div className="nexus-form-group">
              <label htmlFor="branche">Branche</label>
              <select 
                id="branche"
                value={branche}
                onChange={(e) => setBranche(e.target.value)}
                required
              >
                <option value="">Wähle deine Branche</option>
                {BRANCHEN.map(b => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            </div>
            
            <div className="nexus-form-group">
              <label htmlFor="angebot">Dein Angebot</label>
              <textarea 
                id="angebot"
                value={angebot}
                onChange={(e) => setAngebot(e.target.value)}
                placeholder="Beschreibe kurz und klar, was du anbietest, für wen und was es kostet. Je genauer, desto besser wird die Analyse."
                rows={6}
                required
              />
              <span className="nexus-form-hint">
                Beispiel: "Wir entwickeln individuelle Softwarelösungen für mittelständische Unternehmen. 
                Projektstart ab 15.000€. Unsere Kunden sind meist Firmen mit 50-200 Mitarbeitenden."
              </span>
            </div>
            
            {error && <div className="nexus-error">{error}</div>}
            
            <button type="submit" className="nexus-submit-btn">
              <Sparkles size={18} />
              Kostenlose Analyse starten
            </button>
          </form>
        </div>
      </div>
    )
  }

  if (step === 'analyzing') {
    return (
      <div className="nexus-analyzing">
        <div className="nexus-analyzing-content">
          <div className="nexus-analyzing-spinner"></div>
          <h2>Dein Angebot wird analysiert...</h2>
          <p>Die KI analysiert Markt, Wettbewerb und Verkaufschancen</p>
          <div className="nexus-analyzing-steps">
            <div className="nexus-step active">
              <div className="nexus-step-dot"></div>
              <span>Vertriebsmodell wird ermittelt</span>
            </div>
            <div className="nexus-step active">
              <div className="nexus-step-dot"></div>
              <span>Zielgruppen werden segmentiert</span>
            </div>
            <div className="nexus-step">
              <div className="nexus-step-dot"></div>
              <span>Trigger Events werden gesucht</span>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (step === 'result' && analyse) {
    return (
      <div className="nexus-result-page">
        <div className="nexus-result-header">
          <CheckCircle size={32} color="#10B981" />
          <h1>Deine kostenlose Angebotsanalyse</h1>
          <p>Hier ist dein erstes Ergebnis von NeXus</p>
        </div>
        
        <NexusAnalysisResult data={analyse} mode="angebotsanalyse" />
        
        <div className="nexus-result-cta">
          <div className="nexus-cta-card">
            <h3>Möchtest du mehr erfahren?</h3>
            <p>Registriere dich kostenlos und erhalte:</p>
            <ul>
              <li>Vollständige Lead Intelligence</li>
              <li>Persönliche Sales Workspace</li>
              <li>Automatische Trigger Benachrichtigungen</li>
              <li>Zugang zum Coach für Strategieberatung</li>
            </ul>
            <button className="nexus-register-btn" onClick={handleRegisterForMore}>
              <ArrowRight size={18} />
              Kostenlos registrieren
            </button>
            <p className="nexus-cta-hint">Keine Kreditkarte nötig · Sofortiger Zugang</p>
          </div>
        </div>
      </div>
    )
  }

  return null
}
