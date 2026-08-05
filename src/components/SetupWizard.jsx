import { useState } from 'react'
import { X, ArrowRight, Check, Sparkles, Target, Globe, Zap, Search, TrendingUp } from 'lucide-react'

const PREVIEW_LEADS = {
  default: [
    { source: 'Upwork', title: 'Looking for custom dog collar manufacturer', budget: '$500-1000', signal: 'Buyer Intent' },
    { source: 'Reddit r/dogs', title: 'Best durable collars for large breeds?', budget: 'Organic', signal: 'Product Research' },
    { source: 'Google News', title: 'Pet industry growth: Collar market expanding 12% annually', budget: 'Market Data', signal: 'Trend Alert' },
  ],
  saas: [
    { source: 'Reddit r/SaaS', title: 'Need CRM for small team, budget under $50/mo', budget: 'Monthly', signal: 'Buyer Intent' },
    { source: 'IndieHackers', title: 'Looking for project management tool', budget: 'Open', signal: 'Product Research' },
    { source: 'Google Alerts', title: 'Company X raises Series A - hiring engineers', budget: 'Growth Signal', signal: 'Expansion' },
  ],
  services: [
    { source: 'LinkedIn', title: 'Marketing Manager seeking agency partner', budget: '$5k-10k/mo', signal: 'Buyer Intent' },
    { source: 'Reddit r/entrepreneur', title: 'Need help with brand strategy', budget: 'Open', signal: 'Product Research' },
    { source: 'Google News', title: 'Startup launches new product line', budget: 'Growth Signal', signal: 'Expansion' },
  ],
}

export default function SetupWizard({ onComplete, onClose }) {
  const [step, setStep] = useState('intro') // intro, context, preview, done
  const [whatSelling, setWhatSelling] = useState('')
  const [region, setRegion] = useState('de')
  const [audience, setAudience] = useState('')

  const handleStart = () => {
    if (whatSelling.trim().length < 2) return
    setStep('context')
  }

  const handleContextDone = () => {
    setStep('preview')
  }

  const handleFinish = () => {
    const config = {
      userProduct: whatSelling,
      customNiche: whatSelling,
      region,
      audienceProfile: audience,
    }
    onComplete(config)
  }

  const getPreviewCategory = () => {
    const lower = whatSelling.toLowerCase()
    if (lower.includes('saas') || lower.includes('software') || lower.includes('app') || lower.includes('plattform')) return 'saas'
    if (lower.includes('beratung') || lower.includes('agentur') || lower.includes('dienstleistung') || lower.includes('marketing')) return 'services'
    return 'default'
  }

  if (step === 'intro') {
    return (
      <div className="wiz-overlay" onClick={onClose}>
        <div className="wiz-modal wiz-modal--intro" onClick={e => e.stopPropagation()}>
          <button className="wiz-close" onClick={onClose}><X size={18} /></button>

          <div className="wiz-intro">
            <div className="wiz-intro-icon">
              <Search size={32} />
            </div>
            <h2>Wir finden für dich</h2>
            <p className="wiz-intro-sub">
              Leute die <strong>gerade</strong> nach dem suchen was du verkaufst.
              Kein Raten. Keine Kaltschnapp-Leads. Nur warme Ansprechpartner.
            </p>

            <div className="wiz-intro-examples">
              <div className="wiz-intro-example">
                <span className="wiz-intro-emoji">🐕</span>
                <span>Du verkaufst <strong>Hundehalsbänder</strong>?</span>
                <span className="wiz-intro-result">→ Wir finden Reddit-Posts, Upwork-Jobs & News von Leuten die gerade suchen</span>
              </div>
              <div className="wiz-intro-example">
                <span className="wiz-intro-emoji">💻</span>
                <span>Du bietest <strong>Webdesign</strong> an?</span>
                <span className="wiz-intro-result">→ Wir finden "need website" Posts, Job-Angebote & Firmen die gerade wachsen</span>
              </div>
              <div className="wiz-intro-example">
                <span className="wiz-intro-emoji">📦</span>
                <span>Du verkaufst <strong>Büromöbel</strong>?</span>
                <span className="wiz-intro-result">→ Wir finden "new office" Posts, Unternehmensgründungen & Umzugs-News</span>
              </div>
            </div>

            <div className="wiz-intro-input">
              <label>Was verkaufst du genau?</label>
              <input
                type="text"
                value={whatSelling}
                onChange={e => setWhatSelling(e.target.value)}
                placeholder="z.B. Hundehalsbänder, Webdesign, Beratung..."
                autoFocus
                onKeyDown={e => e.key === 'Enter' && handleStart()}
              />
            </div>

            <button className="wiz-btn wiz-btn-primary wiz-btn-full" onClick={handleStart} disabled={whatSelling.trim().length < 2}>
              <Sparkles size={16} /> Zeig mir meine Leads
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (step === 'context') {
    return (
      <div className="wiz-overlay" onClick={onClose}>
        <div className="wiz-modal" onClick={e => e.stopPropagation()}>
          <button className="wiz-close" onClick={onClose}><X size={18} /></button>

          <div className="wiz-step">
            <h3>Einsatzkontext</h3>
            <p>Damit wir die <strong>richtigen</strong> Leads für dich finden:</p>

            <div className="wiz-options">
              <button
                className={`wiz-option ${region === 'de' ? 'active' : ''}`}
                onClick={() => setRegion('de')}
              >
                <strong>🇩🇪 Deutschland / Österreich</strong>
                <span>Deutschsprachige Quellen, DACH-Markt</span>
              </button>
              <button
                className={`wiz-option ${region === 'us' ? 'active' : ''}`}
                onClick={() => setRegion('us')}
              >
                <strong>🇺🇸 USA / Global</strong>
                <span>Englischsprachige Quellen, Weltmarkt</span>
              </button>
              <button
                className={`wiz-option ${region === 'eu' ? 'active' : ''}`}
                onClick={() => setRegion('eu')}
              >
                <strong>🇪🇺 Westeuropa</strong>
                <span>EN/FR/ES, EU-Regulierung</span>
              </button>
            </div>

            <div className="wiz-field">
              <label>Wer sind deine idealen Kunden? (optional)</label>
              <input
                type="text"
                value={audience}
                onChange={e => setAudience(e.target.value)}
                placeholder="z.B. Hundebesitzer, Startups, Firmen 10-50 MA..."
              />
            </div>
          </div>

          <div className="wiz-footer">
            <button className="wiz-btn wiz-btn-secondary" onClick={() => setStep('intro')}>Zurück</button>
            <div style={{ flex: 1 }} />
            <button className="wiz-btn wiz-btn-primary" onClick={handleContextDone}>
              <Check size={16} /> Leads anzeigen
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (step === 'preview') {
    const category = getPreviewCategory()
    const leads = PREVIEW_LEADS[category] || PREVIEW_LEADS.default

    return (
      <div className="wiz-overlay" onClick={onClose}>
        <div className="wiz-modal wiz-modal--preview" onClick={e => e.stopPropagation()}>
          <button className="wiz-close" onClick={onClose}><X size={18} /></button>

          <div className="wiz-preview">
            <div className="wiz-preview-header">
              <TrendingUp size={24} />
              <h3>So sehen deine Leads aus</h3>
              <p>Für: <strong>{whatSelling}</strong></p>
            </div>

            <div className="wiz-preview-list">
              {leads.map((lead, i) => (
                <div key={i} className="wiz-preview-lead">
                  <div className="wiz-preview-lead-top">
                    <span className="wiz-preview-source">{lead.source}</span>
                    <span className="wiz-preview-signal">{lead.signal}</span>
                  </div>
                  <p className="wiz-preview-title">{lead.title}</p>
                  <div className="wiz-preview-bottom">
                    <span className="wiz-preview-budget">{lead.budget}</span>
                    <span className="wiz-preview-time">gerade eben</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="wiz-preview-note">
              <Zap size={16} />
              <span>Dies ist eine Vorschau. Der echte Radar scannt ständig neue Quellen.</span>
            </div>

            <button className="wiz-btn wiz-btn-primary wiz-btn-full" onClick={handleFinish}>
              <Sparkles size={16} /> Radar aktivieren
            </button>
          </div>
        </div>
      </div>
    )
  }

  return null
}
