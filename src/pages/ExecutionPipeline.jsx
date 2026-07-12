import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Check, ArrowRight, Clock, Sparkles, AlertTriangle } from 'lucide-react'
import { useLanguage } from '../i18n/translations'
import './ExecutionPipeline.css'

function detectPlatform(goal) {
  const lower = goal.toLowerCase()
  if (/tiktok|tik\s*tok|kurzvideo|short\s*video|reel/.test(lower)) return 'tiktok'
  if (/facebook|fb|meta\s*post/.test(lower)) return 'facebook'
  if (/instagram|insta| reel|stories/.test(lower)) return 'instagram'
  if (/kleinanzeige|anzeige|verkaufe|biete|marktplatz|sell|offer/.test(lower)) return 'marketplace'
  if (/post|beitrag|content|text|caption|carousel|karussell/.test(lower)) return 'content'
  return 'unknown'
}

const STEPS_BY_PLATFORM = {
  tiktok: [
    { key: 'understand', duration: 1200 },
    { key: 'script', duration: 1800 },
    { key: 'create', duration: 1500 },
  ],
  facebook: [
    { key: 'understand', duration: 1200 },
    { key: 'research', duration: 1500 },
    { key: 'draft', duration: 1800 },
  ],
  instagram: [
    { key: 'understand', duration: 1200 },
    { key: 'research', duration: 1500 },
    { key: 'draft', duration: 1800 },
  ],
  content: [
    { key: 'understand', duration: 1200 },
    { key: 'research', duration: 1500 },
    { key: 'draft', duration: 1800 },
  ],
  marketplace: [
    { key: 'understand', duration: 1000 },
    { key: 'analyze', duration: 1200 },
    { key: 'prepare', duration: 1000 },
  ],
}

export default function ExecutionPipeline() {
  const { t } = useLanguage()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const goal = searchParams.get('goal') || ''
  const mode = searchParams.get('mode') || 'build'

  const [currentStep, setCurrentStep] = useState(0)
  const [completedSteps, setCompletedSteps] = useState([])
  const [finished, setFinished] = useState(false)
  const [notAvailable, setNotAvailable] = useState(false)

  const platform = detectPlatform(goal)
  const steps = STEPS_BY_PLATFORM[platform] || []

  useEffect(() => {
    if (!goal.trim()) {
      navigate('/')
      return
    }

    if (platform === 'unknown') {
      const timer = setTimeout(() => setNotAvailable(true), 800)
      return () => clearTimeout(timer)
    }

    let stepIndex = 0
    let elapsed = 0

    const runStep = () => {
      if (stepIndex >= steps.length) {
        setFinished(true)
        return
      }
      setCurrentStep(stepIndex)
      const dur = steps[stepIndex].duration
      elapsed += dur
      setTimeout(() => {
        setCompletedSteps(prev => [...prev, stepIndex])
        stepIndex++
        runStep()
      }, dur)
    }

    runStep()
  }, [goal])

  useEffect(() => {
    if (!finished) return

    const timer = setTimeout(() => {
      if (platform === 'tiktok') {
        navigate('/tiktok-video', { state: { postText: goal } })
      } else if (platform === 'facebook' || platform === 'instagram' || platform === 'content') {
        navigate('/creator-academy', { state: { draft: goal } })
      } else if (platform === 'marketplace') {
        navigate('/marketplace', { state: { form: { title: goal, description: goal, price: '', category: 'Sonstiges' }, startTab: 'create' } })
      }
    }, 600)

    return () => clearTimeout(timer)
  }, [finished, platform, goal, navigate])

  if (notAvailable) {
    return (
      <div className="ep-page">
        <div className="ep-card ep-unavailable">
          <div className="ep-unavailable-icon"><AlertTriangle size={32} /></div>
          <h2>Diese Funktion kommt bald.</h2>
          <p>H.I.T. kann dieses Ziel aktuell noch nicht direkt umsetzen.</p>
          <p className="ep-unavailable-hint">Du kannst es aber im <strong>AI Chat</strong> besprechen — H.I.T. hilft dir dort bei der Planung.</p>
          <div className="ep-unavailable-actions">
            <button className="ep-btn primary" onClick={() => navigate('/ai-chat', { state: { message: goal } })}>
              <Sparkles size={16} /> Im Chat besprechen
            </button>
            <button className="ep-btn secondary" onClick={() => navigate('/')}>Zurück zur Startseite</button>
          </div>
        </div>
      </div>
    )
  }

  const stepLabels = {
    understand: t('hp.step.understand') || 'Verstehe dein Ziel...',
    script: t('hp.step.script') || 'Skript wird geschrieben...',
    create: t('hp.step.create') || 'Content wird erstellt...',
    research: t('hp.step.research') || 'Passendes Wissen wird geladen...',
    draft: t('hp.step.draft') || 'Entwurf wird erstellt...',
    analyze: t('hp.step.analyze') || 'Anzeige wird analysiert...',
    prepare: t('hp.step.prepare') || 'Inserat wird vorbereitet...',
  }

  const stepIcons = {
    understand: '🎯',
    script: '📝',
    create: '🎬',
    research: '📚',
    draft: '✍️',
    analyze: '🔍',
    prepare: '📦',
  }

  return (
    <div className="ep-page">
      <div className="ep-card">
        <div className="ep-header">
          <div className="ep-header-brand">
            <span className="ep-hit-h">H</span><span className="ep-hit-rest">.I.T.</span>
          </div>
          <p className="ep-goal">"{goal}"</p>
        </div>

        <div className="ep-steps">
          {steps.map((step, i) => {
            const isCompleted = completedSteps.includes(i)
            const isCurrent = currentStep === i && !isCompleted
            const isPending = !isCompleted && !isCurrent

            return (
              <div key={step.key} className={`ep-step ${isCompleted ? 'done' : ''} ${isCurrent ? 'active' : ''} ${isPending ? 'pending' : ''}`}>
                <div className="ep-step-icon">
                  {isCompleted ? (
                    <div className="ep-step-check"><Check size={14} /></div>
                  ) : isCurrent ? (
                    <div className="ep-step-spinner">{stepIcons[step.key]}</div>
                  ) : (
                    <div className="ep-step-pending">{stepIcons[step.key]}</div>
                  )}
                </div>
                <div className="ep-step-text">
                  <span className="ep-step-label">{stepLabels[step.key]}</span>
                  {isCompleted && <span className="ep-step-done-label">Fertig</span>}
                  {isCurrent && <span className="ep-step-loading-dots"><span>.</span><span>.</span><span>.</span></span>}
                </div>
                {i < steps.length - 1 && <div className={`ep-step-line ${isCompleted ? 'done' : ''}`} />}
              </div>
            )
          })}
        </div>

        {finished && (
          <div className="ep-finished">
            <div className="ep-finished-icon">✅</div>
            <p>Weiterleitung...</p>
          </div>
        )}
      </div>
    </div>
  )
}
