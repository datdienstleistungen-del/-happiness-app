import { useState, useEffect, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Rocket, Target, Sparkles, Share2, ChevronRight, Check } from 'lucide-react'
import { trackDemoStarted, trackDemoCompleted } from '../intelligence/analytics'
import { useLanguage } from '../i18n/translations.jsx'
import InstallButton from '../components/InstallButton'
import Logo from '../components/Logo'
import ShowcaseSection from '../components/ShowcaseSection'
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
  const { t } = useLanguage()
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
    trackDemoStarted(demoGoal.trim())
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
        trackDemoCompleted(demoGoal.trim())
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
        <p className="landing-tagline">{t('landing.tagline')}</p>
        <div className="landing-input-wrap">
          <input
            className="landing-input"
            type="text"
            value={demoGoal}
            onChange={(e) => setDemoGoal(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && startDemo()}
            placeholder={t('dashboard.hitPlaceholder')}
            disabled={phase !== 'input'}
          />
          <button className="btn btn-primary" onClick={startDemo} disabled={phase !== 'input' || !demoGoal.trim()}>
            <Rocket size={16} style={{ marginRight: 6, verticalAlign: 'text-bottom' }} />
            {phase === 'input' ? t('landing.tryNow') : t('landing.demoWorking')}
          </button>
        </div>
        <div className="landing-actions" style={{ marginTop: '1rem' }}>
          <Link to="/register" className="btn btn-outline">{t('landing.register')}</Link>
          <Link to="/login" className="btn btn-outline">{t('landing.login')}</Link>
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
              {phase === 'running' ? t('landing.demoWorking') :
               phase === 'typing' ? t('landing.demoScripting') :
               t('landing.demoDone')}
            </span>
            {phase === 'done' && (
              <button className="demo-reset" onClick={resetDemo}>{t('landing.demoReset')}</button>
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
              <p>{t('landing.demoCta')}</p>
              <Link to="/register" className="btn btn-primary">
                <Sparkles size={16} style={{ marginRight: 6, verticalAlign: 'text-bottom' }} />
                {t('landing.startFree')}
              </Link>
            </div>
          )}
        </div>
      )}

      {/* How it works */}
      <div className="what-we-are">
        <h2>{t('landing.howItWorks')}</h2>
        <div className="what-we-are-content">
          <div className="what-we-are-workflow">
            <div className="what-we-are-steps">
              <div className="landing-step">
                <span className="landing-step-icon">🎯</span>
                <strong>{t('landing.step1Title')}</strong>
                <p>{t('landing.step1Desc')}</p>
              </div>
              <span className="step-arrow">&rarr;</span>
              <div className="landing-step">
                <span className="landing-step-icon">🧠</span>
                <strong>{t('landing.step2Title')}</strong>
                <p>{t('landing.step2Desc')}</p>
              </div>
              <span className="step-arrow">&rarr;</span>
              <div className="landing-step">
                <span className="landing-step-icon">🚀</span>
                <strong>{t('landing.step3Title')}</strong>
                <p>{t('landing.step3Desc')}</p>
              </div>
            </div>
            <p className="what-we-are-tagline">{t('landing.tagline2')}</p>
          </div>

          <div className="what-we-are-cta">
            <p>{t('landing.dsgvo')}</p>
            <Link to="/register" className="btn btn-primary">{t('landing.tryFree')}</Link>
          </div>
        </div>
      </div>

      {/* Showcase: Show, don't tell */}
      <ShowcaseSection />

      {/* Platforms */}
      <div className="landing-platforms">
        <h2>{t('landing.platforms')}</h2>
        <div className="platform-grid">
          {[
            { name: 'TikTok', icon: '🎵' },
            { name: 'Instagram', icon: '📸' },
            { name: 'LinkedIn', icon: '💼' },
            { name: 'Facebook', icon: '👥' },
            { name: 'Reddit', icon: '🔴' },
            { name: 'Pinterest', icon: '📌' },
            { name: 'YouTube', icon: '▶️' },
            { name: 'E-Mail', icon: '✉️' },
            { name: 'Podcast', icon: '🎙️' },
            { name: 'Kleinanzeigen', icon: '🏷️' },
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
