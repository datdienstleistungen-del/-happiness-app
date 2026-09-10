import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Radar, Search, ArrowRight, Building2, AlertCircle, RefreshCw, Briefcase, Globe, CheckCircle } from 'lucide-react'
import { callNexusAI, runResearchPipeline } from '../lib/nexus-ai'
import NexusAnalysisResult from '../components/NexusAnalysisResult'
import SetupWizard from '../components/SetupWizard'
import UpgradeModal from '../components/UpgradeModal'
import { useLead } from '../context/LeadContext'
import { useLanguage } from '../i18n/translations.jsx'
import './NexusLeadRadarPage.css'

export default function NexusLeadRadarPage() {
  const { t, lang } = useLanguage()
  const navigate = useNavigate()
  const { offerings, processSignalToOpportunity } = useLead()
  
  // Nimm automatisch das neueste Angebot (Index 0, da nach Datum sortiert)
  const activeOffering = offerings && offerings.length > 0 ? offerings[0] : null
  
  const [radarState, setRadarState] = useState(() => {
    try {
      const cachedState = localStorage.getItem('nexus:radar_state')
      let parsed = cachedState ? JSON.parse(cachedState) : null
      
      const oldTriggers = localStorage.getItem('nexus:radar_triggers')
      const oldSaved = localStorage.getItem('nexus:radar_saved_leads')
      
      // MIGRATION ERZWINGEN: Wenn wir noch alte Leads haben, aber der neue State leer ist
      // (z.B. weil er fälschlicherweise durch einen Refresh leer angelegt wurde)
      if (oldTriggers && (!parsed || !parsed.triggers || parsed.triggers.length === 0)) {
        return {
          triggers: JSON.parse(oldTriggers),
          savedLeads: oldSaved ? JSON.parse(oldSaved) : [],
          manualQuery: '',
          hasSearched: true
        }
      }

      if (parsed) return parsed

      return { triggers: [], savedLeads: [], manualQuery: '', hasSearched: false }
    } catch {
      return { triggers: [], savedLeads: [], manualQuery: '', hasSearched: false }
    }
  })
  
  const [triggers, setTriggers] = useState(radarState.triggers)
  const [savedLeads, setSavedLeads] = useState(radarState.savedLeads)
  const [manualQuery, setManualQuery] = useState(radarState.manualQuery)
  const [hasSearched, setHasSearched] = useState(radarState.hasSearched)
  
  const [rawResult, setRawResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [showManualSearch, setShowManualSearch] = useState(false)
  const [wizardOpen, setWizardOpen] = useState(false)
  const [showUpgradeModal, setShowUpgradeModal] = useState(false)

  // State Persistence: Save ALL state to localStorage on every change
  useEffect(() => {
    const stateToSave = { triggers, savedLeads, manualQuery, hasSearched }
    localStorage.setItem('nexus:radar_state', JSON.stringify(stateToSave))
  }, [triggers, savedLeads, manualQuery, hasSearched])

  // Automatisch Trigger-Suche starten, sobald ein Offering aktiv ist UND noch nie gesucht wurde
  useEffect(() => {
    if (activeOffering && !loading && !hasSearched) {
      generateTriggersFromOffering(activeOffering)
    }
  }, [activeOffering]) // trigger-Abhängigkeit absichtlich weggelassen, entscheidet nur hasSearched

  const generateTriggersFromOffering = async (offering) => {
    setLoading(true)
    setError(null)
    setHasSearched(true)
    // WICHTIG: Alte Triggers NICHT löschen (setTriggers([])), damit sie nicht im LocalStorage
    // überschrieben werden, falls der Nutzer während der Ladezeit die Seite verlässt!

    try {
      const triggerModel = offering.trigger_model || []
      const icpData = offering.icp_data || {}
      const branche = (icpData.branchen && icpData.branchen.length > 0) ? icpData.branchen[0] : ''

      let query = ''
      if (triggerModel && triggerModel.length > 0) {
        query = triggerModel.map(te => te.event).join(' OR ')
      } else {
        // Fallback: If no triggers exist, don't send the full sentence to Tavily (it will return 0 results).
        // Send a cleaned up, short version instead.
        const cleaned = offering.offering_name.replace(/ich möchte|ein neues|verkaufen/gi, '').trim()
        query = cleaned || offering.offering_name.split(' ').slice(0, 3).join(' ')
      }

      // Always use the live research pipeline now ("Fenster zur Welt")
      let result = await runResearchPipeline(query, branche, lang, offering.id)

      const parsed = parseTriggerResult(result)
      setTriggers(parsed)
    } catch (err) {
      console.error('Lead Radar Fehler:', err)
      if (err.name === 'RateLimitError') {
        setShowUpgradeModal(true)
      } else {
        setError(`Fehler bei der Radar-Analyse: ${err?.message || 'Unbekannt'}. Bitte versuche es erneut.`)
      }
    } finally {
      setLoading(false)
    }
  }

  const handleManualSearch = async (e) => {
    e.preventDefault()
    if (!manualQuery.trim()) return

    setLoading(true)
    setError(null)
    setRawResult(null)
    setHasSearched(true)

    try {
      // Nutze die ECHTE Pipeline (Tavily + Mistral), keine Halluzinationen mehr!
      const result = await runResearchPipeline(
        manualQuery, 
        activeOffering?.icp_data?.branchen?.[0] || '', 
        lang,
        activeOffering?.id
      )

      setRawResult(result)
      const parsed = parseTriggerResult(result)
      setTriggers(parsed)
      setShowManualSearch(false)
    } catch (err) {
      console.error('Lead Radar Fehler:', err)
      if (err.name === 'RateLimitError') {
        setShowUpgradeModal(true)
      } else {
        setError('Fehler bei der Suche. Bitte versuche es erneut.')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleWizardComplete = async (data) => {
    setWizardOpen(false)
    setLoading(true)
    setError(null)
    setTriggers([])
    
    try {
      // Nutze die vom Wizard generierten, hochspezifischen Trigger-Keywords für die Tavily-Suche
      const result = await runResearchPipeline(data.customNiche, data.audienceProfile, lang, activeOffering?.id)
      const parsed = parseTriggerResult(result)
      setTriggers(parsed)
    } catch (err) {
      console.error('Wizard Radar Fehler:', err)
      if (err.name === 'RateLimitError') {
        setShowUpgradeModal(true)
      } else {
        setError(`Fehler bei der Radar-Analyse: ${err?.message || 'Unbekannt'}. Bitte versuche es erneut.`)
      }
    } finally {
      setLoading(false)
    }
  }

  const parseTriggerResult = (result) => {
    // Wenn das Resultat bereits ein geparstes JSON-Objekt ist (vom neuen Backend)
    if (result && typeof result === 'object' && !Array.isArray(result)) {
      if (result.trigger_events && Array.isArray(result.trigger_events)) {
        return result.trigger_events.map(t => {
          return {
            company: t.firmenname || t.company || 'Unbekanntes Unternehmen',
            prioritaet: t.prioritaet || 99,
            bewertung: t.bewertung || '',
            signal: t.signal || t.beschreibung || t.event || '',
            psychologische_ansprache: t.psychologische_ansprache || '',
            quelle: 'KI-Analyse'
          }
        }).sort((a, b) => a.prioritaet - b.prioritaet)
      }
      return [] 
    }

    // Try to parse as JSON first (falls es als String ankommt)
    if (typeof result === 'string') {
      const jsonMatch = result.match(/```(?:json)?\s*([\s\S]*?)```/)
      const jsonStr = jsonMatch ? jsonMatch[1] : result
      try {
        const parsed = JSON.parse(jsonStr.trim())
        if (parsed.trigger_events && Array.isArray(parsed.trigger_events)) {
          return parsed.trigger_events.map(t => {
            return {
              company: t.firmenname || t.company || 'Unbekanntes Unternehmen',
              prioritaet: t.prioritaet || 99,
              bewertung: t.bewertung || '',
              signal: t.signal || t.beschreibung || t.event || '',
              psychologische_ansprache: t.psychologische_ansprache || '',
              quelle: 'KI-Analyse'
            }
          }).sort((a, b) => a.prioritaet - b.prioritaet)
        }
      } catch {
        // Not JSON, parse as text
      }
    }

    // Fallback: parse as text
    const lines = result.split('\n').filter(line => line.trim())
    const parsed = []
    let current = null

    for (const line of lines) {
      if (line.match(/^(###|\d\.|\-)/)) {
        if (current) parsed.push(current)
        current = {
          company: line.replace(/^[-#\d.]+\s*/, '').trim(),
          signal: '',
          prioritaet: 99,
          quelle: 'KI-Analyse'
        }
      } else if (current && !current.signal) {
        current.signal = line.trim()
      }
    }
    if (current) parsed.push(current)

    return parsed.length > 0 ? parsed : [{ 
      company: 'Analyse-Ergebnis', 
      signal: result.substring(0, 200) + '...', 
      prioritaet: 99,
      quelle: 'KI-Analyse'
    }]
  }

  const getSignificanceColor = (signifikanz) => {
    switch (signifikanz?.toLowerCase()) {
      case 'hoch': return '#10B981'
      case 'mittel': return '#F59E0B'
      case 'niedrig': return '#6B7280'
      default: return '#3B82F6'
    }
  }

  const handleProcessSignal = async (trigger) => {
    if (!activeOffering) {
      alert("Es muss ein Angebot aktiv sein, um eine Opportunity zu erstellen.")
      return
    }

    const companyData = {
      name: trigger.company,
      industry: activeOffering.icp_data?.branchen?.[0] || 'Unbekannt',
      size: '',
      domain: ''
    }
    
    const signalData = {
      signal_type: 'KI_DETECTED',
      content: trigger.event,
      source: 'NeXus Radar Scan',
      confidence_score: trigger.signifikanz === 'hoch' ? 0.9 : trigger.signifikanz === 'mittel' ? 0.6 : 0.3
    }

    try {
      await processSignalToOpportunity(activeOffering.id, companyData, signalData)
      setSavedLeads(prev => [...prev, trigger.company])
    } catch (err) {
      console.error(err)
      alert(t('nexus.errorPipeline'))
    }
  }

  return (
    <div className="lead-radar-page">
      <header className="page-header" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
        <button 
          className="btn-secondary" 
          onClick={() => navigate('/nexus/dashboard')}
          style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 12px', fontSize: '0.9rem' }}
        >
          <ArrowRight size={14} style={{ transform: 'rotate(180deg)' }} /> Zurück zum Dashboard
        </button>
        <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
          <div className="header-title" style={{ margin: 0 }}>
            <Radar className="header-icon pulse-icon" size={28} />
            <h1>{t('nexus.leadRadar')} <span style={{fontSize: '0.5em', color: 'var(--text-secondary)'}}>(v2.1)</span></h1>
            <p>
              {activeOffering 
                ? `${t('nexus.scanAuto')} ${activeOffering.offering_name}`
                : t('nexus.findTriggers')
              }
            </p>
          </div>
          <button className="btn-primary" onClick={() => setWizardOpen(true)} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            ✨ Setup-Assistent
          </button>
        </div>
      </header>

      {/* No Offering State */}
      {!activeOffering && !loading && (
        <div className="lead-radar-manual">
          <div className="manual-info">
            <Briefcase size={48} color="var(--text-secondary)" />
            <h3>{t('nexus.noOfferingFound')}</h3>
            <p>{t('nexus.defineOfferingFirst')}</p>
            <button 
              className="btn-primary" 
              style={{ marginTop: '20px' }}
              onClick={() => navigate('/nexus/angebotsanalyse')}
            >
              {t('nexus.toOfferingAnalysis')}
            </button>
          </div>
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="lead-radar-loading">
          <div className="nexus-spinner"></div>
          <p>{t('nexus.scanning')} "{activeOffering?.offering_name}"...</p>
        </div>
      )}
      
      <UpgradeModal 
        isOpen={showUpgradeModal} 
        onClose={() => setShowUpgradeModal(false)} 
      />

      {/* Error state */}
      {error && (
        <div className="error-message">
          <AlertCircle size={16} />
          {error}
          <button onClick={() => { setError(null); generateTriggersFromOffering(activeOffering) }}>
            <RefreshCw size={14} /> {t('nexus.rescan')}
          </button>
        </div>
      )}

      {/* Empty State (0 Results) */}
      {triggers.length === 0 && !loading && !error && activeOffering && (
        <div className="lead-radar-empty" style={{ textAlign: 'center', padding: '40px', background: 'var(--bg-secondary)', borderRadius: '12px', marginTop: '20px' }}>
          <h3>Keine aktuellen Signale gefunden</h3>
          <p>Für dein Angebot "{activeOffering?.offering_name}" gab es in den letzten 14 Tagen keine relevanten News-Artikel.</p>
          <button 
            className="btn-primary" 
            style={{ marginTop: '15px' }}
            onClick={() => { setError(null); generateTriggersFromOffering(activeOffering) }}
          >
            <RefreshCw size={14} style={{ marginRight: '8px' }} />
            Nochmal scannen
          </button>
        </div>
      )}

      {/* Results */}
      {triggers.length > 0 && !loading && (
        <div className="lead-radar-results">
          <div className="results-header">
            <h2>{triggers.length} {t('nexus.signalsFound')}</h2>
          </div>
          <div className="triggers-list">
            {triggers.map((trigger, index) => (
              <div key={index} className="trigger-card" style={{ opacity: trigger.prioritaet > 3 ? 0.6 : 1 }}>
                <div className="trigger-significance" style={{ 
                  background: trigger.prioritaet === 1 ? '#EF444420' : trigger.prioritaet === 2 ? '#F59E0B20' : '#3B82F620',
                  color: trigger.prioritaet === 1 ? '#EF4444' : trigger.prioritaet === 2 ? '#F59E0B' : '#3B82F6',
                  fontSize: '1.2rem',
                  fontWeight: 'bold'
                }}>
                  #{trigger.prioritaet}
                </div>
                <div className="trigger-content">
                  <h3>{trigger.company}</h3>
                  {trigger.bewertung && (
                    <div style={{ marginBottom: '12px', padding: '8px', background: 'var(--bg-secondary)', borderRadius: '6px', borderLeft: trigger.prioritaet === 1 ? '3px solid #EF4444' : '3px solid #3B82F6' }}>
                      <strong style={{ display: 'block', marginBottom: '4px', fontSize: '0.8rem', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>Bewertung</strong>
                      <p style={{ margin: 0, fontSize: '0.9rem' }}>{trigger.bewertung}</p>
                    </div>
                  )}
                  {trigger.psychologische_ansprache && (
                    <div style={{ marginBottom: '12px', padding: '8px', background: '#10B98110', borderRadius: '6px', borderLeft: '3px solid #10B981' }}>
                      <strong style={{ display: 'block', marginBottom: '4px', fontSize: '0.8rem', textTransform: 'uppercase', color: '#10B981' }}>🧠 Psychologische Ansprache</strong>
                      <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-primary)' }}>{trigger.psychologische_ansprache}</p>
                    </div>
                  )}
                  <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}><strong>Signal:</strong> {trigger.signal}</p>
                </div>
                <div className="trigger-actions">
                  {savedLeads.includes(trigger.company) ? (
                    <button className="action-btn action-btn-primary" style={{ background: '#10B981', borderColor: '#10B981' }} disabled>
                      <CheckCircle size={16} />
                      Übernommen
                    </button>
                  ) : (
                    <button className="action-btn action-btn-primary" onClick={() => handleProcessSignal({
                      company: trigger.company,
                      event: `Priorität: ${trigger.prioritaet}\n\nBewertung: ${trigger.bewertung}\n\nSignal: ${trigger.signal}\n\nPsychologie: ${trigger.psychologische_ansprache}`
                    })}>
                      <ArrowRight size={16} />
                      In Pipeline übernehmen
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {wizardOpen && (
        <SetupWizard
          onComplete={handleWizardComplete}
          onClose={() => setWizardOpen(false)}
        />
      )}
    </div>
  )
}
