import { useState } from 'react'
import { X, Zap, ArrowRight, ArrowLeft, Loader, Target, Globe, Briefcase, Users, BrainCircuit, CheckCircle } from 'lucide-react'
import { callNexusAI } from '../lib/nexus-ai'

export default function SetupWizard({ onComplete, onClose }) {
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  
  // State for all steps
  const [context, setContext] = useState('eigenvertrieb') // 'eigenvertrieb' or 'agentur'
  const [region, setRegion] = useState('eu')
  const [category, setCategory] = useState('software')
  const [product, setProduct] = useState('')
  const [audience, setAudience] = useState('')
  
  // State for AI results
  const [hypotheses, setHypotheses] = useState([])
  const [selectedHypotheses, setSelectedHypotheses] = useState([])

  const handleNext = () => setStep(s => s + 1)
  const handlePrev = () => setStep(s => s - 1)

  const handleGenerate = async () => {
    setLoading(true)
    try {
      const res = await callNexusAI({
        mode: 'trigger_hypotheses',
        context: context === 'eigenvertrieb' ? 'Ich verkaufe mein eigenes Produkt.' : 'Ich suche Leads für meine Kunden (Agentur).',
        region: region === 'na' ? 'USA' : region === 'eu' ? 'Europa' : region === 'latam' ? 'Lateinamerika' : 'Asien',
        category,
        product,
        audience
      })
      
      if (res && res.hypotheses) {
        setHypotheses(res.hypotheses)
        // Select top 2 by default
        setSelectedHypotheses(res.hypotheses.slice(0, 2).map(h => h.title))
        setStep(5)
      } else {
        alert("Konnte keine Hypothesen generieren. Bitte versuche es noch einmal.")
      }
    } catch (err) {
      console.error(err)
      alert("Fehler bei der KI-Generierung: " + err.message)
    } finally {
      setLoading(false)
    }
  }

  const toggleHypothesis = (title) => {
    if (selectedHypotheses.includes(title)) {
      setSelectedHypotheses(selectedHypotheses.filter(t => t !== title))
    } else {
      setSelectedHypotheses([...selectedHypotheses, title])
    }
  }

  const handleFinish = () => {
    // Gather all keywords from selected hypotheses
    const keywordsToUse = []
    hypotheses.forEach(h => {
      if (selectedHypotheses.includes(h.title)) {
        keywordsToUse.push(...h.keywords)
      }
    })
    
    // Create a safe search query string. If multiple words, wrap in quotes.
    const cleanKeywords = keywordsToUse.map(k => k.includes(' ') ? `"${k}"` : k)
    const finalKeywords = cleanKeywords.join(' OR ') || product
    
    onComplete({
      userProduct: product,
      customNiche: finalKeywords,
      region,
      audienceProfile: audience
    })
  }

  return (
    <div className="wiz-overlay" onClick={onClose}>
      <div className="wiz-modal wiz-modal-large" onClick={e => e.stopPropagation()}>
        <button className="wiz-close" onClick={onClose}><X size={18} /></button>

        <div className="wiz-progress">
          {[1,2,3,4,5].map(num => (
            <div key={num} className={`wiz-dot ${step >= num ? 'active' : ''}`} />
          ))}
        </div>

        <div className="wiz-content">
          
          {step === 1 && (
            <div className="wiz-step fade-in">
              <div className="wiz-icon"><Briefcase size={28} /></div>
              <h2>Einsatzkontext</h2>
              <p>Wie nutzt du das Radar?</p>
              
              <div className="wiz-options">
                <div 
                  className={`wiz-card ${context === 'eigenvertrieb' ? 'selected' : ''}`}
                  onClick={() => setContext('eigenvertrieb')}
                >
                  <h4>Eigenvertrieb</h4>
                  <p>Ich verkaufe mein eigenes Produkt oder Dienstleistung direkt an Kunden.</p>
                </div>
                <div 
                  className={`wiz-card ${context === 'agentur' ? 'selected' : ''}`}
                  onClick={() => setContext('agentur')}
                >
                  <h4>Service-Plattform / Agentur</h4>
                  <p>Ich suche Leads für meine Kunden oder Mandanten.</p>
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="wiz-step fade-in">
              <div className="wiz-icon"><Globe size={28} /></div>
              <h2>Zielregion</h2>
              <p>Wo suchst du nach Leads?</p>
              
              <div className="wiz-options-grid">
                <button className={`wiz-reg ${region === 'eu' ? 'on' : ''}`} onClick={() => setRegion('eu')}>🇪🇺 Europa (EU/DE)</button>
                <button className={`wiz-reg ${region === 'na' ? 'on' : ''}`} onClick={() => setRegion('na')}>🇺🇸 USA (NA)</button>
                <button className={`wiz-reg ${region === 'latam' ? 'on' : ''}`} onClick={() => setRegion('latam')}>🇧🇷 Lateinamerika</button>
                <button className={`wiz-reg ${region === 'apac' ? 'on' : ''}`} onClick={() => setRegion('apac')}>🇦🇺 Asien-Pazifik</button>
              </div>

              {region === 'na' && (
                <div className="wiz-hint">
                  <strong>🇺🇸 Hinweis zum US-Markt:</strong> Der Vertriebsansatz ist direkter und aggressiver. Trigger-Events finden sich oft in Job Boards, Funding-News und sehr offenen Social Media Diskussionen.
                </div>
              )}
              {region === 'eu' && (
                <div className="wiz-hint">
                  <strong>🇪🇺 Hinweis zum EU-Markt:</strong> Sehr DSGVO-fokussiert. Pitches müssen zurückhaltender und wertstiftender sein. Trigger-Events verstecken sich oft in B2B-Foren und PR-Mitteilungen.
                </div>
              )}
            </div>
          )}

          {step === 3 && (
            <div className="wiz-step fade-in">
              <div className="wiz-icon"><Target size={28} /></div>
              <h2>Produkt & Kategorie</h2>
              <p>Was genau wird verkauft?</p>
              
              <select className="wiz-input" value={category} onChange={e => setCategory(e.target.value)}>
                <option value="software">Software / SaaS / IT</option>
                <option value="beratung">Consulting / Beratung</option>
                <option value="handwerk">Physisches Produkt / Handwerk / Bau</option>
                <option value="marketing">Marketing / Agenturdienstleistung</option>
                <option value="sonstiges">Sonstiges</option>
              </select>

              <input
                className="wiz-input"
                type="text"
                value={product}
                onChange={e => setProduct(e.target.value)}
                placeholder="Was genau? (z.B. Maßgefertigte Treppen, B2B CRM)"
                autoFocus
              />
            </div>
          )}

          {step === 4 && (
            <div className="wiz-step fade-in">
              <div className="wiz-icon"><Users size={28} /></div>
              <h2>Zielgruppenprofil</h2>
              <p>Wen willst du erreichen?</p>
              
              <textarea
                className="wiz-input"
                value={audience}
                onChange={e => setAudience(e.target.value)}
                placeholder="z.B. Geschäftsführer im Mittelstand (50-200 Mitarbeiter), Handwerksbetriebe..."
                rows={3}
                autoFocus
              />
            </div>
          )}

          {step === 5 && (
            <div className="wiz-step fade-in">
              <div className="wiz-icon"><BrainCircuit size={28} /></div>
              <h2>Trigger-Hypothesen</h2>
              <p>Die KI hat folgende hochspezifische Kaufsignale abgeleitet. Wähle die besten aus:</p>
              
              <div className="wiz-hypotheses">
                {hypotheses.map((h, i) => (
                  <div 
                    key={i} 
                    className={`wiz-hyp-card ${selectedHypotheses.includes(h.title) ? 'selected' : ''}`}
                    onClick={() => toggleHypothesis(h.title)}
                  >
                    <div className="wiz-hyp-header">
                      <h4>{h.title}</h4>
                      {selectedHypotheses.includes(h.title) && <CheckCircle size={18} color="#10B981" />}
                    </div>
                    <p className="wiz-hyp-reason">{h.reason}</p>
                    <div className="wiz-hyp-keywords">
                      <strong>Keywords:</strong> {h.keywords.join(', ')}
                    </div>
                    <span className="wiz-hyp-priority">Prio: {h.priority}/100</span>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>

        <div className="wiz-footer">
          {step > 1 && (
            <button className="wiz-btn-secondary" onClick={handlePrev} disabled={loading}>
              <ArrowLeft size={16} /> Zurück
            </button>
          )}
          
          {step < 4 && (
            <button className="wiz-btn-primary" onClick={handleNext} disabled={
              (step === 3 && product.trim().length < 2)
            }>
              Weiter <ArrowRight size={16} />
            </button>
          )}

          {step === 4 && (
            <button className="wiz-btn-primary" onClick={handleGenerate} disabled={loading || audience.trim().length < 2}>
              {loading ? <><Loader size={16} className="spin" /> KI generiert...</> : <><BrainCircuit size={16} /> Trigger generieren</>}
            </button>
          )}

          {step === 5 && (
            <button className="wiz-btn-primary" onClick={handleFinish} disabled={selectedHypotheses.length === 0}>
              <Zap size={16} /> Radar starten
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
