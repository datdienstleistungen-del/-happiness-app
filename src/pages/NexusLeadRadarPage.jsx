import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Radar, Search, ArrowRight, Building2, AlertCircle, RefreshCw, Briefcase, Globe, CheckCircle, Sparkles, User, Mail, Copy, HelpCircle } from 'lucide-react'
import { callNexusAI, runResearchPipeline, callContactIntelligence } from '../lib/nexus-ai'
import { trackRadarScan } from '../lib/nexus-analytics'
import { supabase } from '../lib/supabase'
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
      
      // Alte spanische / ausländische Test-Daten aus dem Cache entfernen
      const sample = JSON.stringify(parsed || oldTriggers || '').toLowerCase()
      if (sample.includes('biopharma') || sample.includes('logichain') || sample.includes('innovación') || sample.includes('soluciones industriales') || sample.includes('estadounidense')) {
        localStorage.removeItem('nexus:radar_state')
        localStorage.removeItem('nexus:radar_triggers')
        localStorage.removeItem('nexus:radar_saved_leads')
        return { triggers: [], savedLeads: [], manualQuery: '', hasSearched: false }
      }

      // MIGRATION ERZWINGEN: Wenn wir noch alte Leads haben, aber der neue State leer ist
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
  const [isLoadingContact, setIsLoadingContact] = useState({}) // Format: { [companyName]: boolean }
  const [copiedEmail, setCopiedEmail] = useState(null)

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
      // Bevorzugt: Signal-Strategien aus DB (generiert von nexus-generate-strategies)
      let query = ''
      try {
        const { data: strats } = await supabase
          .from('nexus_signal_strategies')
          .select('search_queries')
          .eq('offering_id', offering.id)
        
        if (strats && strats.length > 0) {
          const allQueries = strats.flatMap(s => (s.search_queries || []).map(sq => sq.query).filter(Boolean))
          if (allQueries.length > 0) {
            query = allQueries[0] // Beste Query nehmen
          }
        }
      } catch (e) {
        console.warn('Signal-Strategien konnten nicht geladen werden:', e)
      }

      // Fallback: bereinigter Offering-Name + Target Audience
      if (!query) {
        const audience = (offering.target_audience || '').split(/[,(]/)[0].trim()
        const name = (offering.offering_name || '').replace(/ich möchte|ein neues|verkaufen/gi, '').trim()
        query = [name, audience].filter(Boolean).join(' ') || 'B2B Leads'
      }

      // Always use the live research pipeline now ("Fenster zur Welt")
      const branche = (offering.target_audience || '').split(/[,(]/)[0].trim()
      let result = await runResearchPipeline(query, branche, lang, offering.id)

      const parsed = parseTriggerResult(result)
      setTriggers(parsed)
      trackRadarScan(branche, parsed?.length || 0, true)
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
      const branche = (activeOffering?.target_audience || '').split(/[,(]/)[0].trim()
      const result = await runResearchPipeline(
        manualQuery, 
        branche, 
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
          const emailFound = t.contact?.email || (typeof t.kontakt === 'string' && t.kontakt.includes('@') ? t.kontakt : (typeof t.email === 'string' && t.email.includes('@') ? t.email : null))
          return {
            company: t.firmenname || t.company || 'Unbekanntes Unternehmen',
            prioritaet: t.prioritaet || 99,
            bewertung: t.bewertung || '',
            signal: t.signal || t.beschreibung || t.event || '',
            psychologische_ansprache: t.psychologische_ansprache || '',
            quelle: t.quelle || 'KI-Analyse',
            ansprechpartner: {
              name: t.contact?.name || t.ansprechpartner || null,
              rolle: t.contact?.role || t.position || null,
              email: emailFound,
              email_status: t.contact?.email_status || (emailFound ? 'FOUND' : 'UNKNOWN'),
              confidence: t.contact?.confidence || null,
              source_url: t.contact?.source_url || t.quelle || null
            }
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
            const emailFound = t.contact?.email || (typeof t.kontakt === 'string' && t.kontakt.includes('@') ? t.kontakt : (typeof t.email === 'string' && t.email.includes('@') ? t.email : null))
            return {
              company: t.firmenname || t.company || 'Unbekanntes Unternehmen',
              prioritaet: t.prioritaet || 99,
              bewertung: t.bewertung || '',
              signal: t.signal || t.beschreibung || t.event || '',
              psychologische_ansprache: t.psychologische_ansprache || '',
              quelle: t.quelle || 'KI-Analyse',
              ansprechpartner: {
                name: t.contact?.name || t.ansprechpartner || null,
                rolle: t.contact?.role || t.position || null,
                email: emailFound,
                email_status: t.contact?.email_status || (emailFound ? 'FOUND' : 'UNKNOWN'),
                confidence: t.contact?.confidence || null,
                source_url: t.contact?.source_url || t.quelle || null
              }
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
          quelle: 'KI-Analyse',
          ansprechpartner: {
            name: null,
            rolle: null,
            email: null,
            email_status: 'UNKNOWN',
            confidence: null,
            source_url: null
          }
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
      quelle: 'KI-Analyse',
      ansprechpartner: {
        name: null,
        rolle: null,
        email: null,
        email_status: 'UNKNOWN',
        confidence: null,
        source_url: null
      }
    }]
  }

  const handleFetchContact = async (trigger) => {
    const companyName = trigger.company
    setIsLoadingContact(prev => ({ ...prev, [companyName]: true }))

    try {
      const res = await callContactIntelligence({
        company: { name: companyName },
        offering: activeOffering,
        trigger: trigger.signal
      })

      if (res && res.status === 'found' && res.primary) {
        const contact = res.primary
        setTriggers(prevTriggers => 
          prevTriggers.map(t => {
            if (t.company === companyName) {
              return {
                ...t,
                ansprechpartner: {
                  name: contact.name || null,
                  rolle: contact.role || null,
                  email: contact.email || null,
                  email_status: contact.email_status || (contact.email ? 'FOUND' : 'UNKNOWN'),
                  confidence: contact.confidence || contact.rank_score || null,
                  source_url: contact.source_url || null
                }
              }
            }
            return t
          })
        )
      } else {
        setTriggers(prevTriggers => 
          prevTriggers.map(t => {
            if (t.company === companyName) {
              return {
                ...t,
                ansprechpartner: {
                  name: null,
                  rolle: null,
                  email: null,
                  email_status: 'NO_MATCH',
                  confidence: null,
                  source_url: null
                }
              }
            }
            return t
          })
        )
      }
    } catch (error) {
      console.error(`Crawl fehlgeschlagen für ${companyName}:`, error)
    } finally {
      setIsLoadingContact(prev => ({ ...prev, [companyName]: false }))
    }
  }

  const getStatusLabel = (status, confidence) => {
    switch (status?.toUpperCase()) {
      case 'VERIFIED':
      case 'FOUND':
        return 'Verifiziert'
      case 'PATTERN':
      case 'PREDICTED':
        return confidence ? `Muster (${confidence}%)` : 'Muster abgeleitet'
      case 'LOADING':
        return 'Crawl läuft...'
      case 'NO_MATCH':
        return 'Kein Treffer'
      case 'UNKNOWN':
      default:
        return 'Nicht ermittelt'
    }
  }

  const copyToClipboard = (text) => {
    if (!text) return
    navigator.clipboard.writeText(text)
      .then(() => {
        setCopiedEmail(text)
        setTimeout(() => setCopiedEmail(null), 2000)
      })
      .catch(err => {
        console.error('Fehler beim Kopieren in die Zwischenablage: ', err)
      })
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
      industry: (activeOffering.target_audience || '').split(/[,(]/)[0].trim() || 'Unbekannt',
      size: '',
      domain: ''
    }
    
    const signalData = {
      signal_type: 'KI_DETECTED',
      content: trigger.event || `Priorität: ${trigger.prioritaet}\n\nBewertung: ${trigger.bewertung}\n\nSignal: ${trigger.signal}\n\nPsychologie: ${trigger.psychologische_ansprache}`,
      source: 'NeXus Radar Scan',
      confidence_score: trigger.prioritaet === 1 ? 0.9 : trigger.prioritaet === 2 ? 0.7 : 0.5
    }

    const contactData = trigger.ansprechpartner || null

    try {
      const opp = await processSignalToOpportunity(activeOffering.id, companyData, signalData, contactData)
      if (opp && opp.id) {
        setSavedLeads(prev => {
          if (Array.isArray(prev)) {
            return [...prev, trigger.company]
          }
          return { ...prev, [trigger.company]: opp.id }
        })
      } else {
        setSavedLeads(prev => Array.isArray(prev) ? [...prev, trigger.company] : { ...prev, [trigger.company]: true })
      }
    } catch (err) {
      console.error(err)
      alert(t('nexus.errorPipeline'))
    }
  }

  return (
    <div className="lead-radar-page">
      <header className="page-header" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
        <button 
          className="btn-back-link" 
          onClick={() => navigate('/nexus/dashboard')}
          style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 12px', fontSize: '0.9rem' }}
        >
          <ArrowRight size={14} style={{ transform: 'rotate(180deg)' }} /> {t('nexus.backToDashboard', 'Zurück zum Dashboard')}
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
            <Sparkles size={16} /> {t('nexus.setupAssistant', 'Setup-Assistent')}
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
          <h3>{t('nexus.noCurrentSignals', 'Keine aktuellen Signale gefunden')}</h3>
          <p>{t('nexus.noCurrentSignalsDesc', 'Für dein Angebot gab es in den letzten 14 Tagen keine relevanten News-Artikel.')}</p>
          <button 
            className="btn-primary" 
            style={{ marginTop: '15px' }}
            onClick={() => { setError(null); generateTriggersFromOffering(activeOffering) }}
          >
            <RefreshCw size={14} style={{ marginRight: '8px' }} />
            {t('nexus.rescan', 'Nochmal scannen')}
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
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  padding: '4px 8px',
                  borderRadius: '6px',
                  display: 'inline-block',
                  marginBottom: '8px'
                }}>
                  {trigger.prioritaet === 1 ? 'HOHE PRIORITÄT' : trigger.prioritaet === 2 ? 'MITTLERE PRIORITÄT' : 'NIEDRIGE PRIORITÄT'}
                </div>
                <h3 className="trigger-company">{trigger.company}</h3>
                
                {trigger.bewertung && (
                  <p className="trigger-rating" style={{ fontStyle: 'italic', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                    "{trigger.bewertung}"
                  </p>
                )}

                <div className="trigger-body">
                  <p className="trigger-desc">{trigger.signal}</p>
                  
                  {trigger.psychologische_ansprache && (
                    <div className="trigger-strategy" style={{ background: 'var(--bg-elevated)', padding: '10px', borderRadius: '8px', marginTop: '10px' }}>
                      <strong style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', color: 'var(--color-koralle)' }}>
                        <Sparkles size={14} /> {t('nexus.psychologyPitch', 'Psychologischer Hebel:')}
                      </strong>
                      <p style={{ margin: '4px 0 0 0', fontSize: '0.9rem' }}>{trigger.psychologische_ansprache}</p>
                    </div>
                  )}

                  {/* Echte Ansprechpartner / Kontakt-Intelligence Box */}
                  <div className="trigger-contact-box">
                    <div className="trigger-contact-main">
                      <div className="trigger-contact-person">
                        <div className="contact-avatar-icon">
                          <User size={15} />
                        </div>
                        {trigger.ansprechpartner?.name ? (
                          <div className="contact-name-role">
                            <span className="contact-name">{trigger.ansprechpartner.name}</span>
                            {trigger.ansprechpartner.rolle && (
                              <span className="contact-role" title={trigger.ansprechpartner.rolle}>
                                · {trigger.ansprechpartner.rolle}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="contact-empty">{t('nexus.noContactAssigned', 'Kein Ansprechpartner zugeordnet')}</span>
                        )}
                      </div>

                      {/* Status-Badge */}
                      <span className={`contact-status-badge status-${trigger.ansprechpartner?.email_status?.toLowerCase() || 'unknown'}`}>
                        {(trigger.ansprechpartner?.email_status === 'VERIFIED' || trigger.ansprechpartner?.email_status === 'FOUND') && <CheckCircle size={12} />}
                        {(trigger.ansprechpartner?.email_status === 'PATTERN' || trigger.ansprechpartner?.email_status === 'PREDICTED') && <Sparkles size={12} />}
                        {(trigger.ansprechpartner?.email_status === 'UNKNOWN' || trigger.ansprechpartner?.email_status === 'NO_MATCH' || !trigger.ansprechpartner?.email_status) && <HelpCircle size={12} />}
                        {getStatusLabel(trigger.ansprechpartner?.email_status, trigger.ansprechpartner?.confidence)}
                      </span>
                    </div>

                    {/* Contact Actions / E-Mail Row */}
                    <div className="trigger-contact-footer">
                      {trigger.ansprechpartner?.email ? (
                        <div className="contact-email-wrapper">
                          <button 
                            type="button"
                            className="contact-copy-email-btn"
                            onClick={() => copyToClipboard(trigger.ansprechpartner.email)}
                            title={t('nexus.wsClipboard', 'In Zwischenablage kopieren')}
                          >
                            <Mail size={13} />
                            <span>{trigger.ansprechpartner.email}</span>
                            {copiedEmail === trigger.ansprechpartner.email ? (
                              <span className="copy-badge">{t('nexus.wsBtnCopied', 'Kopiert!')}</span>
                            ) : (
                              <Copy size={12} className="copy-icon" />
                            )}
                          </button>
                        </div>
                      ) : (
                        <button 
                          type="button"
                          className="contact-fetch-btn"
                          disabled={isLoadingContact[trigger.company]}
                          onClick={() => handleFetchContact(trigger)}
                        >
                          {isLoadingContact[trigger.company] ? (
                            <>
                              <RefreshCw size={13} className="spin" />
                              <span>{t('nexus.radar.researchingWeb', 'Recherchiere Website & Impressum...')}</span>
                            </>
                          ) : (
                            <>
                              <Search size={13} />
                              <span>{t('nexus.radar.fetchContact', 'Ansprechpartner & E-Mail ermitteln')}</span>
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
                <div className="trigger-actions">
                  {(Array.isArray(savedLeads) ? savedLeads.includes(trigger.company) : Boolean(savedLeads?.[trigger.company])) ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%' }}>
                      <button className="action-btn action-btn-primary" style={{ background: '#10B981', borderColor: '#10B981', cursor: 'default' }} disabled>
                        <CheckCircle size={16} />
                        {t('nexus.radar.saved', 'Übernommen')}
                      </button>
                      <button 
                        type="button"
                        className="action-btn action-btn-secondary" 
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontSize: '0.85rem', padding: '8px 12px' }}
                        onClick={() => {
                          const oppId = (!Array.isArray(savedLeads) && savedLeads?.[trigger.company]) || null
                          navigate(oppId ? `/nexus/workspace?opportunityId=${oppId}` : '/nexus/workspace')
                        }}
                      >
                        <span>{t('nexus.radar.openWorkspace', 'Im Sales Workspace öffnen')}</span>
                        <ArrowRight size={14} />
                      </button>
                    </div>
                  ) : (
                    <button className="action-btn action-btn-primary" onClick={() => handleProcessSignal({
                      company: trigger.company,
                      prioritaet: trigger.prioritaet,
                      bewertung: trigger.bewertung,
                      signal: trigger.signal,
                      psychologische_ansprache: trigger.psychologische_ansprache,
                      ansprechpartner: trigger.ansprechpartner,
                      event: `Priorität: ${trigger.prioritaet}\n\nBewertung: ${trigger.bewertung}\n\nSignal: ${trigger.signal}\n\nPsychologie: ${trigger.psychologische_ansprache}`
                    })}>
                      <ArrowRight size={16} />
                      {t('nexus.radar.saveToPipeline', 'In Pipeline übernehmen')}
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
