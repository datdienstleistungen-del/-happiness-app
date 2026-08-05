import { useState } from 'react'
import { X, ArrowRight, ArrowLeft, Check, Globe, Building2, Target, Users, Zap } from 'lucide-react'

const STEPS = [
  { id: 'context', label: 'Einsatzkontext', icon: Building2 },
  { id: 'region', label: 'Zielregion', icon: Globe },
  { id: 'product', label: 'Produkt / Dienstleistung', icon: Target },
  { id: 'audience', label: 'Zielgruppe', icon: Users },
  { id: 'triggers', label: 'Trigger-Events', icon: Zap },
]

const DEPLOYMENT_CONTEXTS = [
  { id: 'own_sales', label: 'Eigenvertrieb', desc: 'Ich verkaufe eigene Produkte/Dienstleistungen direkt an Kunden' },
  { id: 'service_platform', label: 'Service-Plattform', desc: 'Ich biete eine Plattform/Dienstleistung für andere Unternehmen an' },
  { id: 'agency', label: 'Agentur', desc: 'Ich betreue Kunden und suche Leads für deren Geschäft' },
]

const REGIONS = [
  { id: 'us', label: '🇺🇸 USA', desc: 'Nordamerikanischer Markt, englischsprachig, B2B-fokussiert' },
  { id: 'eu_de', label: '🇩🇪 Deutschland/Österreich', desc: 'DACH-Raum, deutschsprachig, regulatorsche Besonderheiten' },
  { id: 'eu_west', label: '🇪🇺 Westeuropa', desc: 'EN/FR/ES, multilingual, EU-Regulierung' },
  { id: 'latam', label: '🇧🇷 Lateinamerika', desc: 'PT/ES, wachsender Markt, lokale Besonderheiten' },
  { id: 'apac', label: '🇦🇺 Asien-Pazifik', desc: 'EN, diverse Märkte, Zeitzonen-berücksichtigen' },
]

const PRODUCT_TYPES = [
  { id: 'saas', label: 'SaaS / Software', desc: 'Cloud-Lösungen, Apps, Plattformen' },
  { id: 'services', label: 'Dienstleistungen', desc: 'Beratung, Entwicklung, Marketing' },
  { id: 'physical', label: 'Physische Produkte', desc: 'Hardware, Materialien, Ausrüstung' },
  { id: 'education', label: 'Bildung / Training', desc: 'Kurse, Workshops, Zertifizierungen' },
  { id: 'logistics', label: 'Logistik / Supply Chain', desc: 'Transport, Lagerung, Versand' },
]

const TRIGGER_CATEGORIES = [
  { id: 'growth', label: '📈 Wachstum', examples: ['Neuer Standort', 'Team-Erweiterung', 'Investitionsrunde', 'Markteintritt'] },
  { id: 'pain', label: '🔥 Schmerzpunkte', examples: ['Technische Probleme', 'Compliance-Verstöße', 'Kundenbeschwerden', 'Systemausfälle'] },
  { id: 'change', label: '🔄 Veränderung', examples: ['Neuer CEO', 'Restrukturierung', 'Fusion/Übernahme', 'Strategiewechsel'] },
  { id: 'deadline', label: '⏰ Fristen', examples: ['Regulierung', 'Vertragsende', 'Budget-Zyklus', 'Zertifizierung'] },
]

export default function SetupWizard({ onComplete, onClose }) {
  const [step, setStep] = useState(0)
  const [config, setConfig] = useState({
    deploymentContext: '',
    region: '',
    regionLabel: '',
    productType: '',
    productTypeLabel: '',
    customProduct: '',
    industry: '',
    audienceProfile: '',
    targetCompanies: '',
    triggerEvents: [],
    customTriggers: '',
  })

  const updateConfig = (key, value) => {
    setConfig(prev => ({ ...prev, [key]: value }))
  }

  const handleComplete = () => {
    // Build the final configuration
    const finalConfig = {
      userProduct: `${config.productTypeLabel || config.customProduct} — ${config.industry}`,
      customNiche: config.industry,
      deploymentContext: config.deploymentContext,
      region: config.region,
      regionLabel: config.regionLabel,
      productType: config.productType,
      audienceProfile: config.audienceProfile,
      targetCompanies: config.targetCompanies,
      triggerEvents: config.triggerEvents,
      customTriggers: config.customTriggers,
    }
    onComplete(finalConfig)
  }

  const canProceed = () => {
    switch (step) {
      case 0: return config.deploymentContext !== ''
      case 1: return config.region !== ''
      case 2: return config.productType !== '' || config.customProduct.trim() !== ''
      case 3: return config.audienceProfile.trim() !== ''
      case 4: return config.triggerEvents.length > 0 || config.customTriggers.trim() !== ''
      default: return false
    }
  }

  const renderStep = () => {
    switch (step) {
      case 0:
        return (
          <div className="wiz-step">
            <h3>1. Einsatzkontext</h3>
            <p>Wie nutzt du das Radar? Dies bestimmt welche Leads für dich relevant sind.</p>
            <div className="wiz-options">
              {DEPLOYMENT_CONTEXTS.map(ctx => (
                <button
                  key={ctx.id}
                  className={`wiz-option ${config.deploymentContext === ctx.id ? 'active' : ''}`}
                  onClick={() => updateConfig('deploymentContext', ctx.id)}
                >
                  <strong>{ctx.label}</strong>
                  <span>{ctx.desc}</span>
                </button>
              ))}
            </div>
          </div>
        )

      case 1:
        return (
          <div className="wiz-step">
            <h3>2. Zielregion</h3>
            <p>Wo sind deine Kunden? Regionale Marktbedingungen beeinflussen die Suche.</p>
            <div className="wiz-options">
              {REGIONS.map(reg => (
                <button
                  key={reg.id}
                  className={`wiz-option ${config.region === reg.id ? 'active' : ''}`}
                  onClick={() => { updateConfig('region', reg.id); updateConfig('regionLabel', reg.label) }}
                >
                  <strong>{reg.label}</strong>
                  <span>{reg.desc}</span>
                </button>
              ))}
            </div>
          </div>
        )

      case 2:
        return (
          <div className="wiz-step">
            <h3>3. Produkt / Dienstleistung</h3>
            <p>Was bietest du an? Wähle eine Kategorie oder beschreibe es selbst.</p>
            <div className="wiz-options">
              {PRODUCT_TYPES.map(pt => (
                <button
                  key={pt.id}
                  className={`wiz-option ${config.productType === pt.id ? 'active' : ''}`}
                  onClick={() => { updateConfig('productType', pt.id); updateConfig('productTypeLabel', pt.label) }}
                >
                  <strong>{pt.label}</strong>
                  <span>{pt.desc}</span>
                </button>
              ))}
            </div>
            <div className="wiz-field">
              <label>Branchenbezeichnung (z.B. "Autohändler", "Webdesign", "Logistik")</label>
              <input
                type="text"
                value={config.industry}
                onChange={e => updateConfig('industry', e.target.value)}
                placeholder="z.B. Immobilien, E-Commerce, Gesundheitswesen..."
              />
            </div>
          </div>
        )

      case 3:
        return (
          <div className="wiz-step">
            <h3>4. Zielgruppenprofil</h3>
            <p>Wer sind deine idealen Kunden? Beschreibe sie so genau wie möglich.</p>
            <div className="wiz-field">
              <label>Unternehmensgröße / -typ</label>
              <input
                type="text"
                value={config.targetCompanies}
                onChange={e => updateConfig('targetCompanies', e.target.value)}
                placeholder="z.B. KMU 10-50 Mitarbeiter, Startups, Konzerne..."
              />
            </div>
            <div className="wiz-field">
              <label>Entscheider / Ansprechpartner</label>
              <input
                type="text"
                value={config.audienceProfile}
                onChange={e => updateConfig('audienceProfile', e.target.value)}
                placeholder="z.B. Geschäftsführer, Einkaufsleiter, IT-Chef..."
              />
            </div>
          </div>
        )

      case 4:
        return (
          <div className="wiz-step">
            <h3>5. Trigger-Events</h3>
            <p>Welche Ereignisse signalisieren, dass ein Unternehmen gerade Bedarf hat?</p>
            <div className="wiz-checkboxes">
              {TRIGGER_CATEGORIES.map(cat => (
                <div key={cat.id} className="wiz-trigger-group">
                  <label className="wiz-checkbox-header">
                    <input
                      type="checkbox"
                      checked={config.triggerEvents.includes(cat.id)}
                      onChange={e => {
                        if (e.target.checked) {
                          updateConfig('triggerEvents', [...config.triggerEvents, cat.id])
                        } else {
                          updateConfig('triggerEvents', config.triggerEvents.filter(t => t !== cat.id))
                        }
                      }}
                    />
                    <strong>{cat.label}</strong>
                  </label>
                  <div className="wiz-trigger-examples">
                    {cat.examples.map(ex => (
                      <span key={ex} className="wiz-trigger-tag">{ex}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="wiz-field">
              <label>Eigene Trigger-Events (optional)</label>
              <input
                type="text"
                value={config.customTriggers}
                onChange={e => updateConfig('customTriggers', e.target.value)}
                placeholder="z.B. Betriebsschließung, Konkurs, Produktlaunch..."
              />
            </div>
          </div>
        )
    }
  }

  return (
    <div className="wiz-overlay" onClick={onClose}>
      <div className="wiz-modal" onClick={e => e.stopPropagation()}>
        <div className="wiz-header">
          <h2>NeXus Setup-Assistent</h2>
          <p>Schritt {step + 1} von {STEPS.length}: {STEPS[step].label}</p>
          <button className="wiz-close" onClick={onClose}><X size={18} /></button>
        </div>

        <div className="wiz-progress">
          {STEPS.map((s, i) => {
            const Icon = s.icon
            return (
              <div key={s.id} className={`wiz-progress-step ${i <= step ? 'active' : ''} ${i < step ? 'done' : ''}`}>
                <div className="wiz-progress-icon">
                  {i < step ? <Check size={14} /> : <Icon size={14} />}
                </div>
                <span className="wiz-progress-label">{s.label}</span>
              </div>
            )
          })}
        </div>

        <div className="wiz-body">
          {renderStep()}
        </div>

        <div className="wiz-footer">
          {step > 0 && (
            <button className="wiz-btn wiz-btn-secondary" onClick={() => setStep(step - 1)}>
              <ArrowLeft size={16} /> Zurück
            </button>
          )}
          <div style={{ flex: 1 }} />
          {step < STEPS.length - 1 ? (
            <button
              className="wiz-btn wiz-btn-primary"
              onClick={() => setStep(step + 1)}
              disabled={!canProceed()}
            >
              Weiter <ArrowRight size={16} />
            </button>
          ) : (
            <button
              className="wiz-btn wiz-btn-primary"
              onClick={handleComplete}
              disabled={!canProceed()}
            >
              <Check size={16} /> Konfiguration übernehmen
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
