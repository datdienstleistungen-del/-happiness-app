import { useState, useEffect } from 'react'
import { Check, ArrowRight, ArrowLeft, X } from 'lucide-react'
import './OnboardingTour.css'

export default function OnboardingTour({ active, onEnd, onStepAction }) {
  const [currentStep, setCurrentStep] = useState(0)
  const [coords, setCoords] = useState(null)

  const steps = [
    {
      target: '.pe-input-wrap',
      title: '1. Video-Ziel eingeben',
      text: 'Trage hier deine Idee ein (z. B. "Fußball-Fails"). Klicke auf "Weiter", damit H.I.T. das Beispiel startet!'
    },
    {
      target: '.pe-recommended',
      title: '2. Plattform-Strategie',
      text: 'H.I.T. analysiert deine Idee und empfiehlt dir die besten Kanäle. Klicke auf "Weiter", um die Skripte zu erstellen.'
    },
    {
      target: '.pe-generating-card',
      title: '3. Content-Erstellung',
      text: 'H.I.T. erstellt nun die Skripte für deine Plattformen im Hintergrund. Bitte gedulde dich einen Moment...'
    },
    {
      target: '.pe-preview-section',
      title: '4. Dein fertiges Skript',
      text: 'Hier findest du das fertige Skript. Direkt darunter findest du Links zu passenden Video-Quellen.'
    },
    {
      target: '.pe-chat-history, .pe-copilot-input-area',
      title: '5. Skript anpassen',
      text: 'Du möchtest Änderungen? Sag dem Co-Piloten einfach im Chat, was du ändern willst (z. B. "Mach es witziger"). Er überarbeitet das Skript in Sekunden.'
    },
    {
      target: '.nah-grid',
      title: '6. Projekt in CapCut öffnen',
      text: 'Lade die Clips herunter und öffne das fertige CapCut-Projekt, um dein Video fertigzustellen!'
    }
  ]

  useEffect(() => {
    if (!active) return

    const updateCoords = () => {
      const step = steps[currentStep]
      if (!step) return

      const element = document.querySelector(step.target)
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' })
        
        // Wait for scroll transition to finish
        const timeout = setTimeout(() => {
          const rect = element.getBoundingClientRect()
          setCoords({
            top: rect.top + window.scrollY,
            left: rect.left + window.scrollX,
            width: rect.width,
            height: rect.height
          })
        }, 150)
        return () => clearTimeout(timeout)
      } else {
        setCoords(null)
      }
    }

    updateCoords()
    const timer = setTimeout(updateCoords, 400)

    window.addEventListener('resize', updateCoords)
    window.addEventListener('scroll', updateCoords)

    return () => {
      clearTimeout(timer)
      window.removeEventListener('resize', updateCoords)
      window.removeEventListener('scroll', updateCoords)
    }
  }, [currentStep, active])

  // Automatically advance step if the targeted element becomes available and we are in a loading state
  useEffect(() => {
    if (!active || coords) return
    const step = steps[currentStep]
    if (!step) return

    const interval = setInterval(() => {
      const element = document.querySelector(step.target)
      if (element) {
        const rect = element.getBoundingClientRect()
        setCoords({
          top: rect.top + window.scrollY,
          left: rect.left + window.scrollX,
          width: rect.width,
          height: rect.height
        })
      }
    }, 500)

    return () => clearInterval(interval)
  }, [currentStep, active, coords])

  if (!active) return null

  const step = steps[currentStep]

  const handleNext = () => {
    if (onStepAction) {
      onStepAction(currentStep, 'next')
    }
    if (currentStep < steps.length - 1) {
      setCurrentStep(prev => prev + 1)
      setCoords(null) // Reset coords for next step to avoid flicker
    } else {
      onEnd()
    }
  }

  const handleBack = () => {
    if (onStepAction) {
      onStepAction(currentStep, 'back')
    }
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1)
      setCoords(null)
    }
  }

  // Calculate tooltip placement
  const tooltipTop = coords ? coords.top + coords.height + 15 : 0
  const tooltipLeft = coords ? Math.max(10, coords.left + (coords.width / 2) - 150) : 0

  const tooltipStyle = coords
    ? {
        top: `${tooltipTop}px`,
        left: `${tooltipLeft}px`,
        position: 'absolute'
      }
    : {
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        position: 'fixed',
        zIndex: 100001
      }

  return (
    <>
      {coords ? (
        <div 
          className="ot-highlight" 
          style={{
            top: `${coords.top}px`,
            left: `${coords.left}px`,
            width: `${coords.width}px`,
            height: `${coords.height}px`
          }}
        />
      ) : (
        <div className="ot-backdrop" onClick={onEnd} />
      )}

      {/* Tooltip bubble */}
      <div 
        className="ot-tooltip"
        style={tooltipStyle}
      >
        <button className="ot-close-btn" onClick={onEnd} title="Tour beenden">
          <X size={14} />
        </button>

        <div className="ot-content">
          <h4 className="ot-title">{step.title}</h4>
          <p className="ot-text">
            {step.text}
            {!coords && (
              <span style={{ display: 'block', marginTop: '10px', fontWeight: 'bold', color: 'var(--color-mint, #10b981)', fontSize: '0.78rem' }}>
                ⏳ Bitte warten... (H.I.T. verarbeitet deine Eingabe)
              </span>
            )}
          </p>
        </div>

        <div className="ot-footer">
          <span className="ot-progress">{currentStep + 1} / {steps.length}</span>
          <div className="ot-buttons">
            {currentStep > 0 && (
              <button className="ot-btn ot-btn-secondary" onClick={handleBack}>
                <ArrowLeft size={12} /> Zurück
              </button>
            )}
            <button className="ot-btn ot-btn-primary" onClick={handleNext} disabled={!coords && currentStep !== 0 && currentStep !== 2}>
              {currentStep === steps.length - 1 ? (
                <>Fertig <Check size={12} style={{ marginLeft: '4px' }} /></>
              ) : (
                <>Weiter <ArrowRight size={12} style={{ marginLeft: '4px' }} /></>
              )}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
