import { useState, useEffect } from 'react'
import { Sparkles, Play, Film, MessageSquare, RotateCcw, X, ArrowRight, HelpCircle } from 'lucide-react'
import './MockStudioExplainer.css'

export default function MockStudioExplainer({ onStartTour }) {
  const [isVisible, setIsVisible] = useState(() => {
    return localStorage.getItem('hit_hide_explainer') !== 'true'
  })
  const [animationStep, setAnimationStep] = useState(0) // 0: typing, 1: loading, 2: results
  const [typedText, setTypedText] = useState('')

  const fullText = 'Erstelle ein Video über epische Fußball-Fails ⚽'

  // Visibility check
  if (!isVisible) return null

  // Typing animation effect
  useEffect(() => {
    if (animationStep !== 0) {
      setTypedText('')
      return
    }

    let i = 0
    setTypedText('')
    const interval = setInterval(() => {
      if (i < fullText.length) {
        setTypedText(prev => prev + fullText.charAt(i))
        i++
      } else {
        clearInterval(interval)
        // Move to loading step after typing is complete (plus brief delay)
        setTimeout(() => {
          setAnimationStep(1)
        }, 1200)
      }
    }, 60)

    return () => clearInterval(interval)
  }, [animationStep])

  // Animation cycle loop
  useEffect(() => {
    if (animationStep === 1) {
      // Show loading spinner for 2 seconds, then transition to results
      const timer = setTimeout(() => {
        setAnimationStep(2)
      }, 2000)
      return () => clearTimeout(timer)
    }

    if (animationStep === 2) {
      // Show results for 8 seconds, then reset loop back to typing
      const timer = setTimeout(() => {
        setAnimationStep(0)
      }, 8000)
      return () => clearTimeout(timer)
    }
  }, [animationStep])

  const handleDismiss = () => {
    setIsVisible(false)
    localStorage.setItem('hit_hide_explainer', 'true')
  }

  return (
    <div className="mse-container">
      <div className="mse-header">
        <div className="mse-badge">
          <Sparkles size={13} className="mse-sparkle-icon" />
          <span>H.I.T. Workflow-Demo</span>
        </div>
        <button className="mse-close-btn" onClick={handleDismiss} title="Vorschau dauerhaft ausblenden">
          <X size={15} />
        </button>
      </div>

      <div className="mse-workspace">
        {/* Step 0: Typing Simulation */}
        {animationStep === 0 && (
          <div className="mse-screen mse-typing-screen">
            <div className="mse-card">
              <div className="mse-card-header">Was möchtest du erreichen?</div>
              <div className="mse-textarea-mock">
                <span>{typedText}</span>
                <span className="mse-cursor">|</span>
              </div>
              <div className="mse-btn-row">
                <button className={`mse-primary-btn ${typedText.length === fullText.length ? 'mse-btn-active' : ''}`}>
                  <Play size={12} fill="currentColor" /> H.I.T. starten
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Step 1: Loading Simulation */}
        {animationStep === 1 && (
          <div className="mse-screen mse-loading-screen">
            <div className="mse-spinner"></div>
            <div className="mse-status-text">H.I.T. sucht passende Clips...</div>
            <div className="mse-progress-bar">
              <div className="mse-progress-fill"></div>
            </div>
          </div>
        )}

        {/* Step 2: Results Simulation */}
        {animationStep === 2 && (
          <div className="mse-screen mse-results-screen">
            <div className="mse-results-grid">
              {/* Left Column: Co-Pilot Mock */}
              <div className="mse-result-col mse-copilot-col">
                <div className="mse-sub-header">🤖 H.I.T. Co-Pilot</div>
                <div className="mse-chat-msg">
                  Hallo! Ich habe die ideale Video-Strategie für deinen Ziel-Fokus "Fußball-Fails" erstellt. Ich habe eine fesselnde Anekdote recherchiert und als psychologische Metapher eingebaut. Schau dir das fertige Skript rechts an!
                </div>
              </div>

              {/* Right Column: Script Mock */}
              <div className="mse-result-col mse-script-col">
                <div className="mse-sub-header">🎬 Aktuelles Skript (TikTok)</div>
                <div className="mse-script-block">
                  <div className="mse-block-title">Hook (0-3s)</div>
                  <div className="mse-block-desc">"Das passiert, wenn Fußballer denken, sie wären Messi..." ⚽💥</div>
                </div>
                <div className="mse-script-block">
                  <div className="mse-block-title">Footage & Quellen</div>
                  <div className="mse-links-row">
                    <span className="mse-mock-link">🔗 TikTok: "Football Fails"</span>
                    <span className="mse-mock-link">▶️ YouTube: "Funny Football"</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Outro CTA Overlay */}
            <div className="mse-cta-overlay">
              <div className="mse-cta-box">
                <div className="mse-cta-title">Bereit, H.I.T. zu testen?</div>
                <p className="mse-cta-text">Nutze unsere 1-Minuten-Tour, um direkt durchzustarten.</p>
                <button className="mse-cta-btn" onClick={onStartTour}>
                  Tour starten <ArrowRight size={13} style={{ marginLeft: '4px' }} />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
