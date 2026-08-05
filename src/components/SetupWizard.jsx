import { useState } from 'react'
import { X, Check, Sparkles, Zap, TrendingUp, AlertCircle, Clock, ArrowRight } from 'lucide-react'

const TRIGGER_EXAMPLES = [
  {
    icon: '🐕',
    product: 'Hundehalsbänder',
    triggers: [
      { event: 'Neuer Welpe im Haushalt', signal: 'Reddit: "Unser Welpe kommt nächste Woche"', type: 'Lebensereignis' },
      { event: 'Hund wächst aus dem Halsband', signal: 'Forum: "Welche Größe für 6-Monats-Hund?"', type: 'Schmerzpunkt' },
      { event: 'Regelung für Halsbänder', signal: 'News: "Pflichtkennzeichnung für Hunde wird Pflicht"', type: 'Deadline' },
    ],
  },
  {
    icon: '💻',
    product: 'Webdesign',
    triggers: [
      { event: 'Firma gründet sich', signal: 'LinkedIn: "Wir starten ein neues Projekt!"', type: 'Lebensereignis' },
      { event: 'Website ist veraltet', signal: 'Google: "Website wirkt unprofessionell"', type: 'Schmerzpunkt' },
      { event: 'Kampagne startet', signal: 'Upwork: "Need landing page ASAP"', type: 'Deadline' },
    ],
  },
  {
    icon: '📦',
    product: 'Büromöbel',
    triggers: [
      { event: 'Team wächst', signal: 'News: "Startup X stellt 20 neue Leute ein"', type: 'Lebensereignis' },
      { event: 'Alte Möbel kaputt', signal: 'Reddit: "Bürostuhl nach 5 Jahren durch"', type: 'Schmerzpunkt' },
      { event: 'Neues Büro', signal: 'News: "Firma zieht in größere Räume um"', type: 'Deadline' },
    ],
  },
]

export default function SetupWizard({ onComplete, onClose }) {
  const [step, setStep] = useState('input') // input, triggers, done
  const [whatSelling, setWhatSelling] = useState('')
  const [region, setRegion] = useState('de')

  const handleStart = () => {
    if (whatSelling.trim().length < 2) return
    setStep('triggers')
  }

  const handleFinish = () => {
    onComplete({
      userProduct: whatSelling,
      customNiche: whatSelling,
      region,
    })
  }

  const matchedExample = TRIGGER_EXAMPLES.find(ex =>
    whatSelling.toLowerCase().includes(ex.product.toLowerCase().split(' ')[0])
  )

  if (step === 'input') {
    return (
      <div className="wiz-overlay" onClick={onClose}>
        <div className="wiz-modal wiz-modal--input" onClick={e => e.stopPropagation()}>
          <button className="wiz-close" onClick={onClose}><X size={18} /></button>

          <div className="wiz-input-view">
            <div className="wiz-input-header">
              <div className="wiz-input-icon">
                <Zap size={28} />
              </div>
              <h2>Lead Radar</h2>
              <p>Wir finden für dich Leute die <strong>gerade</strong> das kaufen wollen was du verkaufst.</p>
            </div>

            <div className="wiz-input-field">
              <label>Was verkaufst du?</label>
              <input
                type="text"
                value={whatSelling}
                onChange={e => setWhatSelling(e.target.value)}
                placeholder="z.B. Hundehalsbänder, Webdesign, Büromöbel..."
                autoFocus
                onKeyDown={e => e.key === 'Enter' && handleStart()}
              />
            </div>

            <div className="wiz-input-region">
              <button
                className={`wiz-region-btn ${region === 'de' ? 'active' : ''}`}
                onClick={() => setRegion('de')}
              >🇩🇪 DE/AT</button>
              <button
                className={`wiz-region-btn ${region === 'us' ? 'active' : ''}`}
                onClick={() => setRegion('us')}
              >🇺🇸 USA</button>
              <button
                className={`wiz-region-btn ${region === 'eu' ? 'active' : ''}`}
                onClick={() => setRegion('eu')}
              >🇪🇺 EU</button>
            </div>

            <button className="wiz-btn wiz-btn-primary wiz-btn-full" onClick={handleStart} disabled={whatSelling.trim().length < 2}>
              <ArrowRight size={16} /> Weiter
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (step === 'triggers') {
    const example = matchedExample || TRIGGER_EXAMPLES[0]

    return (
      <div className="wiz-overlay" onClick={onClose}>
        <div className="wiz-modal wiz-modal--triggers" onClick={e => e.stopPropagation()}>
          <button className="wiz-close" onClick={onClose}><X size={18} /></button>

          <div className="wiz-triggers-view">
            <div className="wiz-triggers-header">
              <AlertCircle size={20} />
              <h3>Das sind die Trigger Events für "{whatSelling}"</h3>
              <p>Das Radar sucht genau nach diesen Momenten:</p>
            </div>

            <div className="wiz-triggers-list">
              {example.triggers.map((trigger, i) => (
                <div key={i} className="wiz-trigger-card" style={{ animationDelay: `${i * 0.1}s` }}>
                  <div className="wiz-trigger-top">
                    <span className="wiz-trigger-type">{trigger.type}</span>
                  </div>
                  <h4 className="wiz-trigger-event">{trigger.event}</h4>
                  <p className="wiz-trigger-signal">{trigger.signal}</p>
                </div>
              ))}
            </div>

            <div className="wiz-triggers-explain">
              <h4>So funktioniert es:</h4>
              <div className="wiz-triggers-flow">
                <div className="wiz-flow-step">
                  <span className="wiz-flow-num">1</span>
                  <span>Wir scannen Reddit, Upwork, News & Foren</span>
                </div>
                <div className="wiz-flow-step">
                  <span className="wiz-flow-num">2</span>
                  <span>Wir erkennen wenn jemand ein Trigger-Event erlebt</span>
                </div>
                <div className="wiz-flow-step">
                  <span className="wiz-flow-num">3</span>
                  <span>Du bekommst den Lead mit Kontext & Ansprechpartner</span>
                </div>
              </div>
            </div>

            <button className="wiz-btn wiz-btn-primary wiz-btn-full" onClick={handleFinish}>
              <Sparkles size={16} /> Radar starten
            </button>
          </div>
        </div>
      </div>
    )
  }

  return null
}
