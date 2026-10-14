import React, { useState, useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Radar, Search, ArrowRight, Building2, AlertCircle, RefreshCw, Briefcase, Globe, CheckCircle, Sparkles, User, Mail, Copy, HelpCircle, Brain, Clock, ExternalLink, Download } from 'lucide-react'
import { callContactIntelligence, runResearchPipeline } from '../lib/nexus-ai'
import { trackRadarScan } from '../lib/nexus-analytics'
import { supabase } from '../lib/supabase'
import { isPlaceholderCompany, computeTargetMatchScore, normalizeCompanyName, deduplicateAndMergeTriggers } from '../lib/nexus-validation'
import { formatEventDate, extractDomain } from '../lib/nexus-dates'
import NexusAnalysisResult from '../components/NexusAnalysisResult'
import SetupWizard from '../components/SetupWizard'
import UpgradeModal from '../components/UpgradeModal'
import { useLead } from '../context/LeadContext'
import { useLanguage } from '../i18n/translations.jsx'
import './NexusLeadRadarPage.css'

export { normalizeCompanyName, deduplicateAndMergeTriggers }

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
      
      // Alte spanische / veraltete / FERCAM Test-Daten aus dem Cache entfernen
      const sample = JSON.stringify(parsed || oldTriggers || '').toLowerCase()
      if (sample.includes('biopharma') || sample.includes('logichain') || sample.includes('innovación') || sample.includes('soluciones industriales') || sample.includes('estadounidense') || sample.includes('fercam') || sample.includes('troisdorf')) {
        localStorage.removeItem('nexus:radar_state')
        localStorage.removeItem('nexus:radar_triggers')
        localStorage.removeItem('nexus:radar_saved_leads')
        return { triggers: [], savedLeads: [], manualQuery: '', hasSearched: false, offeringId: null }
      }

      if (parsed) return parsed

      return { triggers: [], savedLeads: [], manualQuery: '', hasSearched: false, offeringId: null }
    } catch {
      return { triggers: [], savedLeads: [], manualQuery: '', hasSearched: false, offeringId: null }
    }
  })
  
  const [triggers, setTriggers] = useState(radarState.triggers || [])
  const [savedLeads, setSavedLeads] = useState(radarState.savedLeads || [])
  const [manualQuery, setManualQuery] = useState(radarState.manualQuery || '')
  const [hasSearched, setHasSearched] = useState(radarState.hasSearched || false)
  const [radarFilter, setRadarFilter] = useState('relevant') // 'relevant' (>=50) | 'all' | 'unclear' (<50)
  
  const [rawResult, setRawResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [showManualSearch, setShowManualSearch] = useState(false)
  const [wizardOpen, setWizardOpen] = useState(false)
  const [showUpgradeModal, setShowUpgradeModal] = useState(false)
  const [isLoadingContact, setIsLoadingContact] = useState({}) // Format: { [companyName]: boolean }
  const [copiedEmail, setCopiedEmail] = useState(null)

  // Chunked Scan State
  const [scanJobId, setScanJobId] = useState(null)
  const [scanStatus, setScanStatus] = useState(null) // null | 'starting' | 'running' | 'done' | 'error'
  const [scanProgress, setScanProgress] = useState({ current: 0, total: 0 })
  const [scanMessage, setScanMessage] = useState('')
  const [scanResults, setScanResults] = useState([])
  const scanPollingRef = useRef(null)

  // State Persistence: Save ALL state to localStorage on every change
  useEffect(() => {
    const stateToSave = { triggers, savedLeads, manualQuery, hasSearched, offeringId: activeOffering?.id || null }
    localStorage.setItem('nexus:radar_state', JSON.stringify(stateToSave))
  }, [triggers, savedLeads, manualQuery, hasSearched, activeOffering?.id])

  // Automatisch Trigger-Suche starten, sobald ein Offering aktiv ist oder gewechselt wurde
  useEffect(() => {
    if (activeOffering) {
      if (radarState?.offeringId && radarState.offeringId !== activeOffering.id) {
        // Altes Offering gewechselt -> Frischer Scan für das neue Angebot!
        setTriggers([])
        setSavedLeads([])
        setHasSearched(false)
        startChunkedScan()
      } else if (!loading && !hasSearched && !scanStatus) {
        startChunkedScan()
      }
    }
  }, [activeOffering?.id])

  const generateTriggersFromOffering = async (offering, force = false) => {
    if (!offering) return
    setLoading(true)
    setError(null)
    setHasSearched(true)
    if (force) {
      setTriggers([])
    }

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

    // Chunked Scan mit manueller Query starten
    setHasSearched(true)
    setShowManualSearch(false)
    startChunkedScan()
  }

  const handleWizardComplete = async (data) => {
    setWizardOpen(false)
    setTriggers([])
    
    // Wizard-Query als manuelle Query verwenden
    setManualQuery(data.customNiche || data.audienceProfile || '')
    startChunkedScan()
  }

  const parseTriggerResult = (result) => {
    // Helper für Zielgruppen-Match Heuristik
    const calcMatch = (t) => {
      const compName = (t.firmenname || t.company || '').trim();
      const isKnownVendor = /^(ricoh|canon|konica minolta|xerox|bechtle|computacenter)$/i.test(compName);
      if (isKnownVendor) return 25; // Anti-Ricoh Filter: Bekannte Großanbieter sind keine Käufer
      if (typeof t.target_group_match === 'number') return Math.max(0, Math.min(100, t.target_group_match));
      return t.prioritaet === 1 ? 88 : t.prioritaet === 2 ? 72 : 55;
    };

    // Wenn das Resultat bereits ein geparstes JSON-Objekt ist (vom neuen Backend)
    if (result && typeof result === 'object' && !Array.isArray(result)) {
      if (result.trigger_events && Array.isArray(result.trigger_events)) {
        return result.trigger_events
          .filter(t => !isPlaceholderCompany(t.firmenname || t.company))
          .map(t => {
            const emailFound = t.contact?.email || (typeof t.kontakt === 'string' && t.kontakt.includes('@') ? t.kontakt : (typeof t.email === 'string' && t.email.includes('@') ? t.email : null))
            return {
              company: t.firmenname || t.company || 'Unbekanntes Unternehmen',
              prioritaet: t.prioritaet || 99,
              target_group_match: calcMatch(t),
              match_reason: t.match_reason || '',
              bewertung: t.bewertung || '',
              signal: t.signal || t.beschreibung || t.event || '',
              psychologische_ansprache: t.psychologische_ansprache || '',
              quelle: t.quelle || null,
              published_at: t.published_at || new Date().toISOString(),
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
          return parsed.trigger_events
            .filter(t => !isPlaceholderCompany(t.firmenname || t.company))
            .map(t => {
              const emailFound = t.contact?.email || (typeof t.kontakt === 'string' && t.kontakt.includes('@') ? t.kontakt : (typeof t.email === 'string' && t.email.includes('@') ? t.email : null))
              return {
                company: t.firmenname || t.company || 'Unbekanntes Unternehmen',
                prioritaet: t.prioritaet || 99,
                target_group_match: calcMatch(t),
                match_reason: t.match_reason || '',
                bewertung: t.bewertung || '',
                signal: t.signal || t.beschreibung || t.event || '',
                psychologische_ansprache: t.psychologische_ansprache || '',
                quelle: t.quelle || null,
                published_at: t.published_at || new Date().toISOString(),
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
        if (current && !isPlaceholderCompany(current.company)) parsed.push(current)
        const comp = line.replace(/^[-#\d.]+\s*/, '').trim()
        current = {
          company: comp,
          signal: '',
          prioritaet: 99,
          target_group_match: calcMatch({ company: comp, prioritaet: 99 }),
          match_reason: '',
          quelle: null,
          published_at: new Date().toISOString(),
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
    if (current && !isPlaceholderCompany(current.company)) parsed.push(current)
    return parsed
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

    if (isPlaceholderCompany(trigger.company)) {
      alert("Test- und Platzhaltereinträge können nicht übernommen werden.")
      return
    }

    const companyData = {
      name: trigger.company,
      industry: (activeOffering.target_audience || '').split(/[,(]/)[0].trim() || 'Unbekannt',
      size: '',
      domain: trigger.domain || (trigger.quelle?.startsWith('http') ? extractDomain(trigger.quelle) : '')
    }
    
    const signalData = {
      signal_type: 'KI_DETECTED',
      content: trigger.signal || trigger.event || `Priorität: ${trigger.prioritaet}\n\nBewertung: ${trigger.bewertung}\n\nSignal: ${trigger.signal}\n\nPsychologie: ${trigger.psychologische_ansprache}`,
      source: trigger.quelle || 'NeXus Radar Scan',
      source_url: trigger.quelle?.startsWith('http') ? trigger.quelle : null,
      confidence_score: trigger.prioritaet === 1 ? 0.9 : trigger.prioritaet === 2 ? 0.7 : 0.5,
      target_group_match: trigger.target_group_match || 75
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

  // ============================================================================
  // CHUNKED SCAN: Start + Polling
  // ============================================================================

  const startChunkedScan = async (forceRefresh = false) => {
    if (!activeOffering) return

    // Sofort-Feedback: Button deaktivieren, Lade-Zustand anzeigen
    setScanStatus('starting')
    setScanMessage('Suche wird gestartet...')
    setScanProgress({ current: 0, total: 0 })
    setScanResults([])
    setError(null)
    setTriggers([])

    try {
      const branche = (activeOffering.target_audience || '').split(/[,(]/)[0].trim()
      const query = manualQuery || `${activeOffering.offering_name || ''} ${branche}`.trim()

      const res = await fetch('/.netlify/functions/nexus-radar-scan-start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
        },
        body: JSON.stringify({
          offering_id: activeOffering.id,
          query,
          branche,
          force_refresh: forceRefresh
        })
      })

      const data = await res.json()
      console.log('[ScanStart] Response:', data)

      if (data.error) {
        console.error('[ScanStart] Function error:', data.error)
        setScanStatus(null)
        setScanMessage('')
        setError(data.error)
        return
      }

      if (!res.ok) {
        console.error('[ScanStart] HTTP error:', res.status)
        setScanStatus(null)
        setScanMessage('')
        setError(`Server-Fehler (${res.status}). Scan konnte nicht gestartet werden.`)
        return
      }

      // 24h Cache Hit oder fertiger Job direkt übernehmen
      if (data.status === 'done' || data.is_cached) {
        setScanJobId(data.job_id)
        setScanStatus('done')
        setScanProgress({ current: data.total_steps || 1, total: data.total_steps || 1 })
        setScanMessage(data.message || 'Ergebnisse aus dem 24h-Cache geladen.')
        setScanResults(data.partial_results || [])

        const allTriggers = (data.partial_results || []).flatMap(r =>
          (r.triggers || [])
            .filter(t => !isPlaceholderCompany(t.firmenname || t.company))
            .map(t => {
              const isKnownVendor = /^(ricoh|canon|konica minolta|xerox|bechtle|computacenter)$/i.test((t.firmenname || '').trim());
              const matchScore = isKnownVendor ? 25 : (typeof t.target_group_match === 'number' ? t.target_group_match : (t.prioritaet === 1 ? 88 : t.prioritaet === 2 ? 72 : 55));
              return {
                company: t.firmenname || 'Unbekanntes Unternehmen',
                branche: t.branche || activeOffering?.target_industry || 'B2B',
                prioritaet: t.prioritaet || 99,
                target_group_match: matchScore,
                match_reason: t.match_reason || '',
                bewertung: t.bewertung || '',
                signal: t.signal || '',
                signal_kategorie: t.signal_kategorie || 'EXPANSION',
                event_date: t.event_date || null,
                evidence: t.evidence || t.match_reason || '',
                position: t.position || t.contact?.role || (typeof t.ansprechpartner === 'string' ? t.ansprechpartner : null) || 'Geschäftsführung / Vertriebsleitung',
                psychologische_ansprache: t.psychologische_ansprache || '',
                quelle: t.quelle || r.url || null,
                published_at: t.published_at || (r.extracted_at ? r.extracted_at.slice(0, 10) : null),
                ansprechpartner: {
                  name: t.contact?.name || t.ansprechpartner || null,
                  rolle: t.contact?.role || t.position || null,
                  email: t.contact?.email || (typeof t.kontakt === 'string' && t.kontakt.includes('@') ? t.kontakt : null),
                  email_status: t.contact?.email_status || ((t.contact?.email || (typeof t.kontakt === 'string' && t.kontakt.includes('@'))) ? 'FOUND' : 'UNKNOWN'),
                  confidence: t.contact?.confidence || null,
                  source_url: t.contact?.source_url || t.quelle || r.url || null
                }
              }
            })
        ).sort((a, b) => a.prioritaet - b.prioritaet);

        const deduplicated = deduplicateAndMergeTriggers(allTriggers);
        setTriggers(deduplicated);
        localStorage.setItem('nexus:radar_triggers', JSON.stringify(deduplicated));
        return;
      }

      if (data.status === 'already_running') {
        // Bestehenden Job übernehmen
        setScanJobId(data.job_id)
        setScanStatus('running')
        startPolling(data.job_id)
        return
      }

      if (data.status === 'no_results') {
        setScanStatus(null)
        setScanMessage('')
        setError(data.message || 'Keine Kandidaten-URLs gefunden.')
        return
      }

      if (data.job_id) {
        setScanJobId(data.job_id)
        setScanStatus('running')
        setScanProgress({ current: 0, total: data.total_steps })
        startPolling(data.job_id)
        return
      }

      // Kein job_id und kein bekannter Status → nicht endlos "Suche wird gestartet..." anzeigen
      console.error('[ScanStart] Unexpected response:', data)
      setScanStatus(null)
      setScanMessage('')
      setError('Scan-Start hat keine Job-ID geliefert. Bitte versuche es erneut.')
    } catch (e) {
      console.error('[ScanStart] Error:', e)
      setScanStatus(null)
      setError('Scan konnte nicht gestartet werden.')
    }
  }

  const startPolling = (jobId) => {
    // Altes Polling stoppen
    if (scanPollingRef.current) {
      clearInterval(scanPollingRef.current)
    }

    let consecutiveFailures = 0

    scanPollingRef.current = setInterval(async () => {
      try {
        const res = await fetch('/.netlify/functions/nexus-radar-scan-step', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
          },
          body: JSON.stringify({ job_id: jobId })
        })

        const data = await res.json()

        if (!res.ok || data.error) {
          consecutiveFailures++
          console.error('[ScanStep] Error response:', res.status, data.error || '')
          if (consecutiveFailures >= 8) {
            clearInterval(scanPollingRef.current)
            scanPollingRef.current = null
            setScanStatus(null)
            setScanMessage('')
            setError(data.error || `Scan-Step-Fehler (${res.status}).`)
          }
          return
        }

        consecutiveFailures = 0

        // State updaten
        setScanProgress({ current: data.current_step, total: data.total_steps })
        setScanMessage(data.last_message || '')
        setScanResults(data.partial_results || [])

        if (data.status === 'done') {
          clearInterval(scanPollingRef.current)
          scanPollingRef.current = null
          setScanStatus('done')

          // Trigger aus partial_results extrahieren
          const allTriggers = (data.partial_results || []).flatMap(r =>
            (r.triggers || [])
              .filter(t => !isPlaceholderCompany(t.firmenname || t.company))
              .map(t => {
                const isKnownVendor = /^(ricoh|canon|konica minolta|xerox|bechtle|computacenter)$/i.test((t.firmenname || '').trim());
                const matchScore = isKnownVendor ? 25 : (typeof t.target_group_match === 'number' ? t.target_group_match : (t.prioritaet === 1 ? 88 : t.prioritaet === 2 ? 72 : 55));
                return {
                  company: t.firmenname || 'Unbekanntes Unternehmen',
                  branche: t.branche || activeOffering?.target_industry || 'B2B',
                  prioritaet: t.prioritaet || 99,
                  target_group_match: matchScore,
                  match_reason: t.match_reason || '',
                  bewertung: t.bewertung || '',
                  signal: t.signal || '',
                  signal_kategorie: t.signal_kategorie || 'EXPANSION',
                  event_date: t.event_date || null,
                  evidence: t.evidence || t.match_reason || '',
                  position: t.position || (typeof t.ansprechpartner === 'string' ? t.ansprechpartner : null) || 'Geschäftsführung / Vertriebsleitung',
                  psychologische_ansprache: t.psychologische_ansprache || '',
                  quelle: t.quelle || r.url || null,
                  published_at: t.published_at || (r.extracted_at ? r.extracted_at.slice(0, 10) : null),
                  ansprechpartner: {
                    name: t.ansprechpartner || null,
                    rolle: t.position || null,
                    email: t.kontakt || null,
                    email_status: t.kontakt ? 'FOUND' : 'UNKNOWN',
                    confidence: null,
                    source_url: t.quelle || r.url || null
                  }
                };
              })
          ).sort((a, b) => a.prioritaet - b.prioritaet);
          const deduplicated = deduplicateAndMergeTriggers(allTriggers);
          setTriggers(deduplicated);
        }

        if (data.status === 'error') {
          clearInterval(scanPollingRef.current)
          scanPollingRef.current = null
          setScanStatus('error')
          setError(data.error_message || 'Scan abgebrochen.')

          // Was bisher gefunden wurde, trotzdem anzeigen
          const partialTriggers = (data.partial_results || []).flatMap(r =>
            (r.triggers || [])
              .filter(t => !isPlaceholderCompany(t.firmenname || t.company))
              .map(t => {
                const isKnownVendor = /^(ricoh|canon|konica minolta|xerox|bechtle|computacenter)$/i.test((t.firmenname || '').trim());
                const matchScore = isKnownVendor ? 25 : (typeof t.target_group_match === 'number' ? t.target_group_match : (t.prioritaet === 1 ? 88 : t.prioritaet === 2 ? 72 : 55));
                return {
                  company: t.firmenname || 'Unbekanntes Unternehmen',
                  branche: t.branche || activeOffering?.target_industry || 'B2B',
                  prioritaet: t.prioritaet || 99,
                  target_group_match: matchScore,
                  match_reason: t.match_reason || '',
                  bewertung: t.bewertung || '',
                  signal: t.signal || '',
                  signal_kategorie: t.signal_kategorie || 'EXPANSION',
                  event_date: t.event_date || null,
                  evidence: t.evidence || t.match_reason || '',
                  position: t.position || (typeof t.ansprechpartner === 'string' ? t.ansprechpartner : null) || 'Geschäftsführung / Vertriebsleitung',
                  psychologische_ansprache: t.psychologische_ansprache || '',
                  quelle: t.quelle || r.url || null,
                  published_at: t.published_at || (r.extracted_at ? r.extracted_at.slice(0, 10) : null),
                  ansprechpartner: {
                    name: t.ansprechpartner || null,
                    rolle: t.position || null,
                    email: t.kontakt || null,
                    email_status: t.kontakt ? 'FOUND' : 'UNKNOWN',
                    confidence: null,
                    source_url: t.quelle || r.url || null
                  }
                };
              })
          ).sort((a, b) => a.prioritaet - b.prioritaet)
          if (partialTriggers.length > 0) setTriggers(deduplicateAndMergeTriggers(partialTriggers));
        }
      } catch (e) {
        consecutiveFailures++
        console.error('[ScanStep] Polling error:', e)
        if (consecutiveFailures >= 8) {
          clearInterval(scanPollingRef.current)
          scanPollingRef.current = null
          setScanStatus(null)
          setScanMessage('')
          setError('Scan-Step liefert keine gültigen Antworten. Bitte versuche es erneut.')
        }
      }
    }, 500) // Alle 500ms pollen
  }

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (scanPollingRef.current) {
        clearInterval(scanPollingRef.current)
      }
    }
  }, [])

  // CSV-Export für Signal-Reports (Productised Service)
  const handleExportCsv = () => {
    const deduplicated = deduplicateAndMergeTriggers(triggers);
    const visibleTriggers = deduplicated.filter(t => {
      const match = computeTargetMatchScore(t.company, t.target_group_match);
      if (radarFilter === 'relevant') return match >= 50;
      if (radarFilter === 'unclear') return match < 50;
      return true;
    });

    if (visibleTriggers.length === 0) {
      alert('Keine Signale zum Exportieren vorhanden.');
      return;
    }

    const headers = [
      'Firma',
      'Branche',
      'Anlass (Signal)',
      'Kategorie',
      'Event-Datum',
      'Quellen-URL',
      'Beleg-Satz',
      'Ziel-Entscheiderrolle'
    ];

    const escapeCell = (val) => {
      if (val == null) return '""';
      // 1. In String konvertieren, Zeilenumbrüche durch Leerzeichen ersetzen
      let str = String(val).replace(/\r?\n/g, ' ');
      // 2. Nicht-druckbare ASCII-Steuerzeichen entfernen (außer normalem Leerzeichen)
      str = str.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
      // 3. Führende und abschließende Leerzeichen trimmen
      str = str.trim();
      // 4. OWASP CSV Formula Injection (CWE-1236) Neutralisierung:
      // Führende Zeichen '=', '+', '-', '@', '\t', '\r', '|', '%' werden durch
      // ein vorangestelltes Apostroph (') neutralisiert. Excel, Calc & Co. interpretieren
      // die Zelle dadurch zwingend als Text und führen keine Formeln, DDE-Befehle oder Hyperlinks aus.
      if (/^[=+\-@\t\r|%]/.test(str)) {
        str = `'` + str;
      }
      // 5. RFC 4180 Escaping: Doppelte Anführungszeichen verdoppeln und gesamte Zelle in Anführungszeichen fassen
      return `"${str.replace(/"/g, '""')}"`;
    };

    const rows = visibleTriggers.map(t => {
      // Striktes Ereignisdatum: Niemals stillschweigend auf Veröffentlichungsdatum oder Crawldatum zurückfallen
      const rawDate = t.event_date;
      let formattedDate = '';
      if (rawDate) {
        try {
          formattedDate = new Date(rawDate).toISOString().slice(0, 10);
        } catch {
          formattedDate = String(rawDate).slice(0, 10);
        }
      }

      const firma = t.company || 'Unbekannt';
      const branche = t.branche || activeOffering?.target_industry || 'B2B';
      const anlass = t.signal || '';
      const kategorie = t.signal_kategorie || 'EXPANSION';
      const quelle = t.quelle || '';
      const beleg = t.evidence || t.match_reason || '';
      const rolle = t.position || t.ansprechpartner?.rolle || 'Geschäftsführung / Vertriebsleitung';

      return [
        escapeCell(firma),
        escapeCell(branche),
        escapeCell(anlass),
        escapeCell(kategorie),
        escapeCell(formattedDate),
        escapeCell(quelle),
        escapeCell(beleg),
        escapeCell(rolle)
      ].join(';');
    });

    // UTF-8 BOM (\uFEFF) sichert einwandfreie deutsche Umlaute in Excel (Windows & Mac)
    const csvContent = '\uFEFF' + [headers.map(escapeCell).join(';'), ...rows].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const dateStr = new Date().toISOString().slice(0, 10);
    link.setAttribute('href', url);
    link.setAttribute('download', `NeXus-Signal-Report-${dateStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

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
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            {activeOffering && (
              <button 
                className="btn-secondary" 
                onClick={() => {
                  localStorage.removeItem('nexus:radar_state')
                  localStorage.removeItem('nexus:radar_triggers')
                  setTriggers([])
                  startChunkedScan(true)
                }} 
                style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 14px' }}
                disabled={loading || scanStatus === 'starting' || scanStatus === 'running'}
                title="Ergebnisse verwerfen und eine frische Live-Recherche starten"
              >
                <RefreshCw size={15} className={loading || scanStatus === 'starting' || scanStatus === 'running' ? 'spinning' : ''} /> {t('nexus.rescan', 'Radar neu scannen')}
              </button>
            )}
            <button className="btn-primary" onClick={() => setWizardOpen(true)} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Sparkles size={16} /> {t('nexus.setupAssistant', 'Setup-Assistent')}
            </button>
          </div>
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

      {/* Loading state (old pipeline) */}
      {loading && !scanStatus && (
        <div className="lead-radar-loading">
          <div className="nexus-spinner"></div>
          <p>{t('nexus.scanning')} "{activeOffering?.offering_name}"...</p>
        </div>
      )}

      {/* Chunked Scan Progress */}
      {(scanStatus === 'starting' || scanStatus === 'running') && (
        <div style={{
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border-light)',
          borderRadius: '12px',
          padding: '20px 24px',
          marginTop: '20px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
            {/* Pulsierender Punkt */}
            <div style={{
              width: '10px',
              height: '10px',
              borderRadius: '50%',
              background: '#3B82F6',
              animation: 'pulse 1.5s ease-in-out infinite'
            }} />
            <span style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)' }}>
              {scanMessage || 'Suche läuft...'}
            </span>
          </div>
          
          {/* Fortschrittsbalken */}
          {scanProgress.total > 0 && (
            <div style={{ marginBottom: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                <span>Schritt {scanProgress.current} von {scanProgress.total}</span>
                <span>{Math.round((scanProgress.current / scanProgress.total) * 100)}%</span>
              </div>
              <div style={{ height: '6px', background: 'var(--border-light)', borderRadius: '3px', overflow: 'hidden' }}>
                <div style={{
                  height: '100%',
                  background: 'linear-gradient(90deg, #3B82F6, #8B5CF6)',
                  borderRadius: '3px',
                  transition: 'width 0.3s ease',
                  width: `${(scanProgress.current / scanProgress.total) * 100}%`
                }} />
              </div>
            </div>
          )}

          {/* Fundene bisher */}
          {scanResults.length > 0 && (
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '8px' }}>
              {scanResults.filter(r => r.triggers?.length > 0).length} Quellen mit Signalen gefunden
            </div>
          )}
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
          <button onClick={() => { setError(null); setScanStatus(null); startChunkedScan() }}>
            <RefreshCw size={14} /> {t('nexus.rescan')}
          </button>
        </div>
      )}

      {/* Empty State (0 Results) — nur anzeigen wenn kein Scan aktiv läuft */}
      {triggers.length === 0 && !loading && !error && activeOffering && scanStatus !== 'starting' && scanStatus !== 'running' && (
        <div className="lead-radar-empty" style={{ textAlign: 'center', padding: '40px', background: 'var(--bg-secondary)', borderRadius: '12px', marginTop: '20px' }}>
          <h3>{t('nexus.noCurrentSignals', 'Keine aktuellen Signale gefunden')}</h3>
          <p>{t('nexus.noCurrentSignalsDesc', 'Für dein Angebot gab es in den letzten 14 Tagen keine relevanten News-Artikel.')}</p>
          <button 
            className="btn-primary" 
            style={{ marginTop: '15px' }}
            onClick={() => { setError(null); setScanStatus(null); startChunkedScan() }}
          >
            <RefreshCw size={14} style={{ marginRight: '8px' }} />
            {t('nexus.rescan', 'Nochmal scannen')}
          </button>
        </div>
      )}

      {/* Results */}
      {triggers.length > 0 && !loading && (
        <div className="lead-radar-results">
          <div className="results-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
            <h2>{triggers.length} {t('nexus.signalsFound')}</h2>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <button 
                className="btn-primary nexus-csv-export-btn"
                onClick={handleExportCsv}
                title="Diesen Signal-Report als CSV für Excel herunterladen"
                style={{ fontSize: '0.85rem', padding: '6px 14px', display: 'flex', alignItems: 'center', gap: '6px', background: 'linear-gradient(135deg, #38bdf8 0%, #0284c7 100%)', color: '#04101e', fontWeight: 600, borderRadius: '6px' }}
              >
                <Download size={13} /> {t('nexus.exportCsv', 'Report als CSV exportieren')}
              </button>
              <button 
                className="btn-secondary"
                onClick={() => {
                  localStorage.removeItem('nexus:radar_state')
                  localStorage.removeItem('nexus:radar_triggers')
                  setTriggers([])
                  setScanStatus(null)
                  setHasSearched(false)
                  startChunkedScan(true)
                }}
                style={{ fontSize: '0.85rem', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '6px' }}
                disabled={loading}
              >
                <RefreshCw size={13} className={loading ? 'spinning' : ''} /> {t('nexus.rescan', 'Neu scannen')}
              </button>
            </div>
          </div>

          {/* Baustelle 3: Filter für Zielgruppen-Match */}
          {(() => {
            const relevantTriggers = triggers.filter(t => computeTargetMatchScore(t.company, t.target_group_match) >= 50);
            const unclearTriggers = triggers.filter(t => computeTargetMatchScore(t.company, t.target_group_match) < 50);
            return (
              <div className="radar-filter-tabs">
                <button 
                  type="button"
                  className={`radar-filter-tab ${radarFilter === 'relevant' ? 'active' : ''}`}
                  onClick={() => setRadarFilter('relevant')}
                >
                  🎯 Relevante Leads ({relevantTriggers.length})
                </button>
                <button 
                  type="button"
                  className={`radar-filter-tab ${radarFilter === 'all' ? 'active' : ''}`}
                  onClick={() => setRadarFilter('all')}
                >
                  Alle ({triggers.length})
                </button>
                {unclearTriggers.length > 0 && (
                  <button 
                    type="button"
                    className={`radar-filter-tab ${radarFilter === 'unclear' ? 'active' : ''}`}
                    onClick={() => setRadarFilter('unclear')}
                    style={{ color: radarFilter === 'unclear' ? '#050608' : '#f87171' }}
                  >
                    ⚠️ Zielgruppe unklar ({unclearTriggers.length})
                  </button>
                )}
              </div>
            );
          })()}

          <div className="triggers-list">
            {triggers
              .filter(t => {
                const match = computeTargetMatchScore(t.company, t.target_group_match);
                if (radarFilter === 'relevant') return match >= 50;
                if (radarFilter === 'unclear') return match < 50;
                return true;
              })
              .map((trigger, index) => {
                const matchScore = computeTargetMatchScore(trigger.company, trigger.target_group_match);
                const dateInfo = formatEventDate(trigger.published_at || trigger.event_date);
                const domain = extractDomain(trigger.quelle);

                return (
                  <div key={index} className="trigger-card" style={{ opacity: trigger.prioritaet > 3 ? 0.6 : 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '8px' }}>
                      <div className="trigger-significance" style={{ 
                        background: trigger.prioritaet === 1 ? '#EF444420' : trigger.prioritaet === 2 ? '#F59E0B20' : '#3B82F620',
                        color: trigger.prioritaet === 1 ? '#EF4444' : trigger.prioritaet === 2 ? '#F59E0B' : '#3B82F6',
                        fontSize: '0.8rem',
                        fontWeight: 700,
                        padding: '4px 8px',
                        borderRadius: '6px',
                        display: 'inline-block'
                      }}>
                        {trigger.prioritaet === 1 ? 'HOHE PRIORITÄT' : trigger.prioritaet === 2 ? 'MITTLERE PRIORITÄT' : 'NIEDRIGE PRIORITÄT'}
                      </div>

                      {/* Baustelle 3: Zielgruppen-Match Score */}
                      {matchScore >= 70 ? (
                        <span className="badge-match-high" title={trigger.match_reason || 'Hohe Passgenauigkeit zum Zielkundenprofil'}>
                          <CheckCircle size={12} /> Zielgruppen-Match: {matchScore}%
                        </span>
                      ) : matchScore >= 50 ? (
                        <span className="badge-match-mid" title={trigger.match_reason || 'Guter Zielgruppen-Match'}>
                          <Sparkles size={12} /> Zielgruppen-Match: {matchScore}%
                        </span>
                      ) : (
                        <span className="badge-match-low" title={trigger.match_reason || 'Unternehmen ist möglicherweise Anbieter/Wettbewerber oder passt nicht zur Zielgruppe'}>
                          <AlertCircle size={12} /> Zielgruppe unklar ({matchScore}%)
                        </span>
                      )}
                    </div>

                    <h3 className="trigger-company">{trigger.company}</h3>

                    {trigger.signal_kategorie && (
                      <span style={{
                        display: 'inline-block',
                        padding: '2px 8px',
                        background: trigger.signal_kategorie === 'HIRING' ? '#05966920' :
                                    trigger.signal_kategorie === 'FUNDING' ? '#7c3aed20' :
                                    trigger.signal_kategorie === 'TECH_MIGRATION' ? '#2563eb20' :
                                    trigger.signal_kategorie === 'REGULATION' ? '#d9770620' :
                                    trigger.signal_kategorie === 'M_A' ? '#dc262620' : '#6b728020',
                        color: trigger.signal_kategorie === 'HIRING' ? '#059669' :
                               trigger.signal_kategorie === 'FUNDING' ? '#7c3aed' :
                               trigger.signal_kategorie === 'TECH_MIGRATION' ? '#2563eb' :
                               trigger.signal_kategorie === 'REGULATION' ? '#d97706' :
                               trigger.signal_kategorie === 'M_A' ? '#dc2626' : '#6b7280',
                        borderRadius: '6px',
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        marginBottom: '6px'
                      }}>
                        {trigger.signal_kategorie.replace('_', ' ')}
                      </span>
                    )}
                    
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

                      {/* Baustelle 2: Quelle-URL & Datum mit 90-Tage Verfall */}
                      <div className="trigger-meta-bar">
                        <div className="trigger-meta-left">
                          {trigger.quelle?.startsWith('http') ? (
                            <a 
                              href={trigger.quelle} 
                              target="_blank" 
                              rel="noopener noreferrer" 
                              className="trigger-source-link"
                              title={trigger.quelle}
                            >
                              <Globe size={13} />
                              <span>Quelle: {domain || 'Original-Beleg'}</span>
                              <ExternalLink size={12} />
                            </a>
                          ) : (
                            <div className="trigger-source-missing">
                              ⚠️ Keine Quelle verfügbar – Opportunity nicht testreif.
                            </div>
                          )}
                          
                          <div className="trigger-date-info">
                            <Clock size={13} />
                            <span>{dateInfo.formattedDate} ({dateInfo.relativeTime})</span>
                          </div>
                        </div>

                        {dateInfo.isExpired && (
                          <span className="badge-expired" title="Signal ist älter als 90 Tage">
                            🚨 Veraltet (&gt;90 Tage)
                          </span>
                        )}
                      </div>
                    </div>
                <div className="trigger-actions">
                  <button
                    type="button"
                    className="action-btn action-btn-secondary"
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontSize: '0.85rem', padding: '8px 12px' }}
                    onClick={() => {
                      const params = new URLSearchParams()
                      params.set('company', trigger.company)
                      if (trigger.signal) params.set('trigger', `${trigger.signal} | ${trigger.psychologische_ansprache || ''}`)
                      navigate(`/nexus/lead-intelligence?${params.toString()}`)
                    }}
                  >
                    <Brain size={14} />
                    <span>Lead Intelligence</span>
                  </button>
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
                    <button className="action-btn action-btn-primary" onClick={() => handleProcessSignal(trigger)}>
                      <ArrowRight size={16} />
                      {t('nexus.radar.saveToPipeline', 'In Pipeline übernehmen')}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
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
