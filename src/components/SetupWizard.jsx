import { useState } from 'react'
import { X, Zap, ArrowRight } from 'lucide-react'

export default function SetupWizard({ onComplete, onClose }) {
  const [whatSelling, setWhatSelling] = useState('')
  const [region, setRegion] = useState('de')

  const handleStart = () => {
    if (whatSelling.trim().length < 2) return
    onComplete({
      userProduct: whatSelling,
      customNiche: whatSelling,
      region,
    })
  }

  return (
    <div className="wiz-overlay" onClick={onClose}>
      <div className="wiz-modal" onClick={e => e.stopPropagation()}>
        <button className="wiz-close" onClick={onClose}><X size={18} /></button>

        <div className="wiz-content">
          <div className="wiz-icon">
            <Zap size={28} />
          </div>
          <h2>Was verkaufst du?</h2>
          <p>Das Radar findet automatisch Leute die gerade danach suchen.</p>

          <input
            type="text"
            value={whatSelling}
            onChange={e => setWhatSelling(e.target.value)}
            placeholder="z.B. Hundehalsbänder, Webdesign, Beratung..."
            autoFocus
            onKeyDown={e => e.key === 'Enter' && handleStart()}
          />

          <div className="wiz-regions">
            <button className={`wiz-reg ${region === 'de' ? 'on' : ''}`} onClick={() => setRegion('de')}>🇩🇪 DE</button>
            <button className={`wiz-reg ${region === 'us' ? 'on' : ''}`} onClick={() => setRegion('us')}>🇺🇸 USA</button>
            <button className={`wiz-reg ${region === 'eu' ? 'on' : ''}`} onClick={() => setRegion('eu')}>🇪🇺 EU</button>
          </div>

          <button className="wiz-go" onClick={handleStart} disabled={whatSelling.trim().length < 2}>
            <ArrowRight size={16} /> Radar starten
          </button>
        </div>
      </div>
    </div>
  )
}
