import { useState, useEffect, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Rocket, Target, Sparkles, Share2, ChevronRight, Check } from 'lucide-react'
import InstallButton from '../components/InstallButton'
import Logo from '../components/Logo'
import './LandingPage.css'

const DEMO_POST = `🥗 5 Gewohnheiten, die dein Leben verändern

1️⃣ Morgens 2 Liter Wasser trinken
Dein Körper startet durch. Konzentration steigt ab 9 Uhr.

2️⃣ 10 Minuten Bewegung vor der Arbeit
Kein Fitnessstudio nötig. Stretching reicht.

3️⃣ Handy 1 Stunde vor dem Schlafen weg
Schlafqualität verbessert sich sofort.

4️⃣ Jeden Tag 1 Seite lesen
Wissen wächst, Stress sinkt.

5️⃣ Abends 3 Dinge aufschreiben, für die du dankbar bist
Gratitude = Mindset-Shift.

💡 Probier es 7 Tage aus. Dein Körper wird es dir danken.

#gesundheit #gewohnheiten #minimalismus #gesundleben #mindset`

const DEMO_GOAL = 'TikTok-Post über 5 gesunde Gewohnheiten erstellen'

const SIMULATED_STEPS = [
  { label: 'Ziel analysieren', duration: 1200 },
  { label: 'Content-Strategie planen', duration: 800 },
  { label: 'Skript schreiben', duration: 1500 },
  { label: 'Hashtags & Optimierung', duration: 600 },
  { label: 'Ergebnis zusammenfassen', duration: 400 },
]

export default function LandingPage() {
  const navigate = useNavigate()
  const [demoGoal, setDemoGoal] = useState(DEMO_GOAL)
  const [phase, setPhase] = useState('input') // input | running | typing | done
  const [currentStep, setCurrentStep] = useState(0)
  const [typedText, setTypedText] = useState('')
  const [stepComplete, setStepComplete] = useState([])
  const typeRef = useRef(null)
  const stepIndexRef = useRef(0)

  useEffect(() => {
    return () => { if (typeRef.current) clearTimeout(typeRef.current) }
  }, [])

  const startDemo = () => {
    if (!demoGoal.trim()) return
    setPhase('running')
    setCurrentStep(0)
    setStepComplete([])
    setTypedText('')
    stepIndexRef.current = 0
    runStep(0)
  }

  const runStep = (idx) => {
    if (idx >= SIMULATED_STEPS.length) {
      setPhase('typing')
      typeDemo()
      return
    }
    setCurrentStep(idx)
    setStepComplete(prev => [...prev.slice(0, idx)])
    setTimeout(() => {
      setStepComplete(prev => [...prev, idx])
      runStep(idx + 1)
    }, SIMULATED_STEPS[idx].duration)
  }

  const typeDemo = () => {
    let i = 0
    const chars = DEMO_POST.split('')
    const typeNext = () => {
      if (i >= chars.length) {
        setPhase('done')
        return
      }
      const chunk = chars.slice(i, i + 2).join('')
      setTypedText(prev => prev + chunk)
      i += 2
      typeRef.current = setTimeout(typeNext, 12)
    }
    typeNext()
  }

  const resetDemo = () => {
    setPhase('input')
    setTypedText('')
    setStepComplete([])
    setCurrentStep(0)
    if (typeRef.current) clearTimeout(typeRef.current)
  }

  return (
    <div className="container">
      {/* Hero */}
      <div className="hero landing-hero">
        <h1><Logo /></h1>
        <p className="landing-tagline">Dein AI Creator Operating System. Du nennst das Ziel. H.I.T. baut den Workflow.</p>
        <div className="landing-input-wrap">
          <input
            className="landing-input"
            type="text"
            value={demoGoal}
            onChange={(e) => setDemoGoal(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && startDemo()}
            placeholder="Was möchtest du heute erreichen?"
            disabled={phase !== 'input'}
          />
          <button className="btn btn-primary" onClick={startDemo} disabled={phase !== 'input' || !demoGoal.trim()}>
            <Rocket size={16} style={{ marginRight: 6, verticalAlign: 'text-bottom' }} />
            {phase === 'input' ? 'Ausprobieren' : 'H.I.T. arbeitet...'}
          </button>
        </div>
        <div className="landing-actions" style={{ marginTop: '1rem' }}>
          <Link to="/register" className="btn btn-outline">Kostenlos registrieren</Link>
          <Link to="/login" className="btn btn-outline">Anmelden</Link>
        </div>
        <div className="landing-install">
          <InstallButton variant="hero" />
        </div>
      </div>

      {/* Live Demo */}
      {(phase === 'running' || phase === 'typing' || phase === 'done') && (
        <div className="demo-panel">
          <div className="demo-header">
            <div className="demo-brand">
              <span className="hit-letter">H</span>
              <span className="hit-rest">.I.T.</span>
            </div>
            <span className="demo-status">
              {phase === 'running' ? 'H.I.T. arbeitet...' :
               phase === 'typing' ? 'Skript wird geschrieben...' :
               'Fertig!'}
            </span>
            {phase === 'done' && (
              <button className="demo-reset" onClick={resetDemo}>Neu starten</button>
            )}
          </div>

          {/* Steps */}
          {phase === 'running' && (
            <div className="demo-steps">
              {SIMULATED_STEPS.map((step, i) => (
                <div key={i} className={`demo-step ${stepComplete.includes(i) ? 'done' : ''} ${currentStep === i && !stepComplete.includes(i) ? 'active' : ''}`}>
                  <div className="demo-step-dot">
                    {stepComplete.includes(i) ? <Check size={12} /> :
                     currentStep === i ? <span className="demo-spinner" /> :
                     <span>{i + 1}</span>}
                  </div>
                  <span className="demo-step-label">{step.label}</span>
                </div>
              ))}
            </div>
          )}

          {/* Typewriter output */}
          {(phase === 'typing' || phase === 'done') && (
            <div className="demo-output">
              <div className="demo-output-text">
                {typedText}
                {phase === 'typing' && <span className="demo-cursor">|</span>}
              </div>
            </div>
          )}

          {/* CTA */}
          {phase === 'done' && (
            <div className="demo-cta">
              <p>Dies ist nur eine Vorschau. Registriere dich kostenlos für das volle Erlebnis mit echtem KI-Feedback, Video-Erstellung und Veröffentlichung.</p>
              <Link to="/register" className="btn btn-primary">
                <Sparkles size={16} style={{ marginRight: 6, verticalAlign: 'text-bottom' }} />
                Kostenlos starten
              </Link>
            </div>
          )}
        </div>
      )}

      {/* How it works */}
      <div className="what-we-are">
        <h2>So funktioniert H.I.T.</h2>
        <div className="what-we-are-content">
          <div className="what-we-are-workflow">
            <div className="what-we-are-steps">
              <div className="landing-step">
                <span className="landing-step-icon">🎯</span>
                <strong>Du beschreibst dein Ziel</strong>
                <p>"TikTok über gesunde Gewohnheiten erstellen"</p>
              </div>
              <span className="step-arrow">&rarr;</span>
              <div className="landing-step">
                <span className="landing-step-icon">🧠</span>
                <strong>H.I.T. erstellt einen Plan</strong>
                <p>Skript, Visuals, Musik — alles automatisch</p>
              </div>
              <span className="step-arrow">&rarr;</span>
              <div className="landing-step">
                <span className="landing-step-icon">🚀</span>
                <strong>Du postest</strong>
                <p>Ergebnis kopieren oder direkt veröffentlichen</p>
              </div>
            </div>
            <p className="what-we-are-tagline">Kein Tool-Wechsel. Keine Sackgassen.</p>
          </div>

          <div className="what-we-are-cta">
            <p>Deine Daten bleiben in Europa. DSGVO-konform. Kostenloser Start.</p>
            <Link to="/register" className="btn btn-primary">Kostenlos ausprobieren</Link>
          </div>
        </div>
      </div>

      {/* Platforms */}
      <div className="landing-platforms">
        <h2>Unterstützte Plattformen</h2>
        <div className="platform-grid">
          {[
            { name: 'TikTok', icon: '🎵' },
            { name: 'Instagram', icon: '📸' },
            { name: 'LinkedIn', icon: '💼' },
            { name: 'Facebook', icon: '👥' },
            { name: 'Reddit', icon: '🔴' },
            { name: 'X / Twitter', icon: '𝕏' },
          ].map(p => (
            <div key={p.name} className="platform-card">
              <span className="platform-icon">{p.icon}</span>
              <span className="platform-name">{p.name}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
