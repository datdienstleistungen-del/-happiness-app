import React, { useState, useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Radar, Search, ArrowRight, Building2, AlertCircle, RefreshCw, Briefcase, Globe, CheckCircle, Sparkles, User, Mail, Copy, HelpCircle, Brain, Clock, ExternalLink, Download } from 'lucide-react'
import { callContactIntelligence, runResearchPipeline } from '../lib/nexus-ai'
import { trackRadarScan } from '../lib/nexus-analytics'
import { supabase } from '../lib/supabase'
import { isPlaceholderCompany, computeTargetMatchScore, normalizeCompanyName, deduplicateAndMergeTriggers, buildCompositeEventKey, formatBusinessOpportunity, generateSignalReportCsv, TRIGGER_CATEGORIES } from '../lib/nexus-validation'
import { formatEventDate, extractDomain } from '../lib/nexus-dates'
import NexusAnalysisResult from '../components/NexusAnalysisResult'
import SetupWizard from '../components/SetupWizard'
import UpgradeModal from '../components/UpgradeModal'
import { useLead } from '../context/LeadContext'
import { useAuth } from '../context/AuthContext'
import { useLanguage } from '../i18n/translations.jsx'
import SignalPublishSection from '../components/SignalPublishSection'
import './NexusLeadRadarPage.css'

export { normalizeCompanyName, deduplicateAndMergeTriggers, buildCompositeEventKey }

export default function NexusLeadRadarPage() {
  const { t, lang } = useLanguage()
  const { user } = useAuth() || {}
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
  const [selectedRadarCategory, setSelectedRadarCategory] = useState(
    activeOffering?.ai_understanding?.category_id || ''
  )
  const [hasSearched, setHasSearched] = useState(radarState.hasSearched || false)
  const [radarFilter, setRadarFilter] = useState('relevant') // 'relevant' (>=50) | 'all' | 'unclear' (<50)

  const handleSelectCategory = (cat) => {
    if (selectedRadarCategory === cat.id) {
      setSelectedRadarCategory('')
      setManualQuery('')
    } else {
      setSelectedRadarCategory(cat.id)
      setManualQuery(cat.searchQuery)
    }
  }
  
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
  const isPollingRef = useRef(false)

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
      const deduplicated = deduplicateAndMergeTriggers(parsed)
      setTriggers(deduplicated)
      trackRadarScan(branche, deduplicated?.length || 0, true)
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
      const isKnownVendor = /\b(ricoh|canon|konica minolta|xerox|bechtle|computacenter)\b/i.test(compName);
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
            const intentStatus = t.purchase_intent_status || 'TRIGGER_EVENT'
            const bo = formatBusinessOpportunity(t.business_opportunity || t.relevanz, intentStatus)
            const isUnverifiedDate = Boolean(t.event_date_unverified || !t.event_date)
            return {
              company: t.firmenname || t.company || 'Unbekanntes Unternehmen',
              prioritaet: t.prioritaet || 99,
              target_group_match: calcMatch(t),
              match_reason: t.match_reason || '',
              bewertung: t.bewertung || '',
              signal: t.signal || t.beschreibung || t.event || '',
              event_fact: t.event_fact || t.signal || '',
              business_opportunity: bo,
              purchase_intent_status: intentStatus,
              event_date: isUnverifiedDate ? null : (t.event_date || null),
              event_date_unverified: isUnverifiedDate,
              evidence: t.evidence || '',
              signal_kategorie: t.signal_kategorie || '',
              dach_status: t.dach_status || '',
              psychologische_ansprache: t.psychologische_ansprache || '',
              quelle: t.quelle || null,
              all_sources: Array.isArray(t.all_sources) && t.all_sources.length > 0 ? t.all_sources : (t.quelle ? [t.quelle] : []),
              published_at: t.published_at || null,
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
              const intentStatus = t.purchase_intent_status || 'TRIGGER_EVENT'
              const bo = formatBusinessOpportunity(t.business_opportunity || t.relevanz, intentStatus)
              const isUnverifiedDate = Boolean(t.event_date_unverified || !t.event_date)
              return {
                company: t.firmenname || t.company || 'Unbekanntes Unternehmen',
                prioritaet: t.prioritaet || 99,
                target_group_match: calcMatch(t),
                match_reason: t.match_reason || '',
                bewertung: t.bewertung || '',
                signal: t.signal || t.beschreibung || t.event || '',
                event_fact: t.event_fact || t.signal || '',
                business_opportunity: bo,
                purchase_intent_status: intentStatus,
                event_date: isUnverifiedDate ? null : (t.event_date || null),
                event_date_unverified: isUnverifiedDate,
                evidence: t.evidence || '',
                signal_kategorie: t.signal_kategorie || '',
                dach_status: t.dach_status || '',
                psychologische_ansprache: t.psychologische_ansprache || '',
                quelle: t.quelle || null,
                all_sources: Array.isArray(t.all_sources) && t.all_sources.length > 0 ? t.all_sources : (t.quelle ? [t.quelle] : []),
                published_at: t.published_at || null,
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
    
    let content = trigger.signal || trigger.event || `Priorität: ${trigger.prioritaet}\n\nBewertung: ${trigger.bewertung}\n\nSignal: ${trigger.signal}\n\nPsychologie: ${trigger.psychologische_ansprache}`;
    if (trigger.pain_point && !content.includes('[PAIN_POINT]:')) {
      content = `${content}\n\n[PAIN_POINT]: ${trigger.pain_point}`;
    }
    if (trigger.blind_company && !content.includes('[BLIND_COMPANY]:')) {
      content = `${content}\n\n[BLIND_COMPANY]: ${trigger.blind_company}`;
    }
    if (trigger.blind_location && !content.includes('[BLIND_LOCATION]:')) {
      content = `${content}\n\n[BLIND_LOCATION]: ${trigger.blind_location}`;
    }
    if (trigger.blind_quantity && !content.includes('[BLIND_QUANTITY]:')) {
      content = `${content}\n\n[BLIND_QUANTITY]: ${trigger.blind_quantity}`;
    }
    if (Array.isArray(trigger.target_buyers) && trigger.target_buyers.length > 0 && !content.includes('[TARGET_BUYERS]:')) {
      content = `${content}\n\n[TARGET_BUYERS]: ${trigger.target_buyers.join(', ')}`;
    }

    const signalData = {
      signal_type: 'KI_DETECTED',
      content,
      source: trigger.quelle || 'NeXus Radar Scan',
      source_url: trigger.quelle?.startsWith('http') ? trigger.quelle : null,
      confidence_score: trigger.prioritaet === 1 ? 0.9 : trigger.prioritaet === 2 ? 0.7 : 0.5,
      target_group_match: trigger.target_group_match || 75,
      pain_point: trigger.pain_point || '',
      blind_company: trigger.blind_company || '',
      blind_location: trigger.blind_location || '',
      blind_quantity: trigger.blind_quantity || '',
      target_buyers: Array.isArray(trigger.target_buyers) ? trigger.target_buyers : []
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
          category_id: selectedRadarCategory || activeOffering?.ai_understanding?.category_id || null,
          force_refresh: forceRefresh,
          max_age_days: activeOffering?.ai_understanding?.max_age_days || activeOffering?.max_age_days || 14
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
              const compName = (t.firmenname || t.company || '').trim();
              const isKnownVendor = /\b(ricoh|canon|konica minolta|xerox|bechtle|computacenter)\b/i.test(compName);
              const rawScore = typeof t.target_group_match === 'number' ? t.target_group_match : (t.prioritaet === 1 ? 88 : t.prioritaet === 2 ? 72 : 55);
              const matchScore = isKnownVendor ? 25 : rawScore;
              const isExplicitNonBuyer = t.is_potential_buyer === false || isKnownVendor || matchScore < 50;
              const isInvalidDach = t.dach_status === 'FOREIGN_MENTIONED' || t.dach_status === 'DACH_UNVERIFIED';
              const isDisqualified = isExplicitNonBuyer || isInvalidDach;
              const exclusionReason = isKnownVendor
                ? 'Wettbewerber/Anbieter (kein Käufer)'
                : (t.is_potential_buyer === false
                  ? 'Kein potenzieller Käufer'
                  : (matchScore < 50
                    ? 'Zielgruppen-Match unter 50%'
                    : (isInvalidDach ? 'Kein DACH-Standort verifiziert' : null)));

              return {
                company: t.firmenname || t.company || 'Unbekanntes Unternehmen',
                branche: t.branche || activeOffering?.target_industry || 'B2B',
                prioritaet: t.prioritaet || 99,
                target_group_match: matchScore,
                is_potential_buyer: !isExplicitNonBuyer,
                is_disqualified: isDisqualified,
                exclusion_reason: exclusionReason,
                match_reason: t.match_reason || '',
                bewertung: t.bewertung || '',
                signal: t.signal || '',
                signal_kategorie: t.signal_kategorie || 'EXPANSION',
                event_fact: t.event_fact || t.signal || '',
                business_opportunity: formatBusinessOpportunity(t.business_opportunity || t.relevanz, t.purchase_intent_status),
                purchase_intent_status: t.purchase_intent_status || 'TRIGGER_EVENT',
                event_date: t.event_date_unverified ? null : (t.event_date || null),
                event_date_unverified: Boolean(t.event_date_unverified || !t.event_date),
                evidence: t.evidence || t.match_reason || '',
                position: t.position || t.contact?.role || (typeof t.ansprechpartner === 'string' ? t.ansprechpartner : null) || 'Geschäftsführung / Vertriebsleitung',
                psychologische_ansprache: t.psychologische_ansprache || '',
                pain_point: t.pain_point || '',
                blind_company: t.blind_company || '',
                blind_location: t.blind_location || '',
                blind_quantity: t.blind_quantity || '',
                target_buyers: Array.isArray(t.target_buyers) ? t.target_buyers : [],
                quelle: t.quelle || r.url || null,
                all_sources: Array.isArray(t.all_sources) && t.all_sources.length > 0 ? t.all_sources : (t.quelle || r.url ? [t.quelle || r.url] : []),
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
      clearTimeout(scanPollingRef.current)
      scanPollingRef.current = null
    }

    let consecutiveFailures = 0

    const pollNextStep = async () => {
      if (isPollingRef.current) return
      isPollingRef.current = true

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
            scanPollingRef.current = null
            setScanStatus(null)
            setScanMessage('')
            setError(data.error || `Scan-Step-Fehler (${res.status}).`)
            return
          }
          // Bei temporärem Fehler nach Pause erneut anfragen
          scanPollingRef.current = setTimeout(pollNextStep, 2000)
          return
        }

        consecutiveFailures = 0

        // State updaten
        setScanProgress({ current: data.current_step, total: data.total_steps })
        setScanMessage(data.last_message || '')
        setScanResults(data.partial_results || [])

        if (data.status === 'done') {
          scanPollingRef.current = null
          setScanStatus('done')

          // Trigger aus partial_results extrahieren
          const allTriggers = (data.partial_results || []).flatMap(r =>
            (r.triggers || [])
              .filter(t => !isPlaceholderCompany(t.firmenname || t.company))
              .map(t => {
                const compName = (t.firmenname || t.company || '').trim();
                const isKnownVendor = /\b(ricoh|canon|konica minolta|xerox|bechtle|computacenter)\b/i.test(compName);
                const rawScore = typeof t.target_group_match === 'number' ? t.target_group_match : (t.prioritaet === 1 ? 88 : t.prioritaet === 2 ? 72 : 55);
                const matchScore = isKnownVendor ? 25 : rawScore;
                const isExplicitNonBuyer = t.is_potential_buyer === false || isKnownVendor || matchScore < 50;
                const isInvalidDach = t.dach_status === 'FOREIGN_MENTIONED' || t.dach_status === 'DACH_UNVERIFIED';
                const isDisqualified = isExplicitNonBuyer || isInvalidDach;
                const exclusionReason = isKnownVendor
                  ? 'Wettbewerber/Anbieter (kein Käufer)'
                  : (t.is_potential_buyer === false
                    ? 'Kein potenzieller Käufer'
                    : (matchScore < 50
                      ? 'Zielgruppen-Match unter 50%'
                      : (isInvalidDach ? 'Kein DACH-Standort verifiziert' : null)));

                return {
                  company: t.firmenname || t.company || 'Unbekanntes Unternehmen',
                  branche: t.branche || activeOffering?.target_industry || 'B2B',
                  prioritaet: t.prioritaet || 99,
                  target_group_match: matchScore,
                  is_potential_buyer: !isExplicitNonBuyer,
                  is_disqualified: isDisqualified,
                  exclusion_reason: exclusionReason,
                  match_reason: t.match_reason || '',
                  bewertung: t.bewertung || '',
                  signal: t.signal || '',
                  signal_kategorie: t.signal_kategorie || 'EXPANSION',
                  event_fact: t.event_fact || t.signal || '',
                  business_opportunity: formatBusinessOpportunity(t.business_opportunity || t.relevanz, t.purchase_intent_status),
                  purchase_intent_status: t.purchase_intent_status || 'TRIGGER_EVENT',
                  event_date: t.event_date_unverified ? null : (t.event_date || null),
                  event_date_unverified: Boolean(t.event_date_unverified || !t.event_date),
                  evidence: t.evidence || t.match_reason || '',
                  position: t.position || (typeof t.ansprechpartner === 'string' ? t.ansprechpartner : null) || 'Geschäftsführung / Vertriebsleitung',
                  psychologische_ansprache: t.psychologische_ansprache || '',
                  pain_point: t.pain_point || '',
                  blind_company: t.blind_company || '',
                  blind_location: t.blind_location || '',
                  blind_quantity: t.blind_quantity || '',
                  target_buyers: Array.isArray(t.target_buyers) ? t.target_buyers : [],
                  quelle: t.quelle || r.url || null,
                  all_sources: Array.isArray(t.all_sources) && t.all_sources.length > 0 ? t.all_sources : (t.quelle || r.url ? [t.quelle || r.url] : []),
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
          return
        }

        if (data.status === 'error') {
          scanPollingRef.current = null
          setScanStatus('error')
          setError(data.error_message || 'Scan abgebrochen.')

          // Was bisher gefunden wurde, trotzdem anzeigen
          const partialTriggers = (data.partial_results || []).flatMap(r =>
            (r.triggers || [])
              .filter(t => !isPlaceholderCompany(t.firmenname || t.company))
              .map(t => {
                const compName = (t.firmenname || t.company || '').trim();
                const isKnownVendor = /\b(ricoh|canon|konica minolta|xerox|bechtle|computacenter)\b/i.test(compName);
                const rawScore = typeof t.target_group_match === 'number' ? t.target_group_match : (t.prioritaet === 1 ? 88 : t.prioritaet === 2 ? 72 : 55);
                const matchScore = isKnownVendor ? 25 : rawScore;
                const isExplicitNonBuyer = t.is_potential_buyer === false || isKnownVendor || matchScore < 50;
                const isInvalidDach = t.dach_status === 'FOREIGN_MENTIONED' || t.dach_status === 'DACH_UNVERIFIED';
                const isDisqualified = isExplicitNonBuyer || isInvalidDach;
                const exclusionReason = isKnownVendor
                  ? 'Wettbewerber/Anbieter (kein Käufer)'
                  : (t.is_potential_buyer === false
                    ? 'Kein potenzieller Käufer'
                    : (matchScore < 50
                      ? 'Zielgruppen-Match unter 50%'
                      : (isInvalidDach ? 'Kein DACH-Standort verifiziert' : null)));

                return {
                  company: t.firmenname || t.company || 'Unbekanntes Unternehmen',
                  branche: t.branche || activeOffering?.target_industry || 'B2B',
                  prioritaet: t.prioritaet || 99,
                  target_group_match: matchScore,
                  is_potential_buyer: !isExplicitNonBuyer,
                  is_disqualified: isDisqualified,
                  exclusion_reason: exclusionReason,
                  match_reason: t.match_reason || '',
                  bewertung: t.bewertung || '',
                  signal: t.signal || '',
                  signal_kategorie: t.signal_kategorie || 'EXPANSION',
                  event_fact: t.event_fact || t.signal || '',
                  business_opportunity: formatBusinessOpportunity(t.business_opportunity || t.relevanz, t.purchase_intent_status),
                  purchase_intent_status: t.purchase_intent_status || 'TRIGGER_EVENT',
                  event_date: t.event_date_unverified ? null : (t.event_date || null),
                  event_date_unverified: Boolean(t.event_date_unverified || !t.event_date),
                  evidence: t.evidence || t.match_reason || '',
                  position: t.position || (typeof t.ansprechpartner === 'string' ? t.ansprechpartner : null) || 'Geschäftsführung / Vertriebsleitung',
                  psychologische_ansprache: t.psychologische_ansprache || '',
                  pain_point: t.pain_point || '',
                  blind_company: t.blind_company || '',
                  blind_location: t.blind_location || '',
                  blind_quantity: t.blind_quantity || '',
                  target_buyers: Array.isArray(t.target_buyers) ? t.target_buyers : [],
                  quelle: t.quelle || r.url || null,
                  all_sources: Array.isArray(t.all_sources) && t.all_sources.length > 0 ? t.all_sources : (t.quelle || r.url ? [t.quelle || r.url] : []),
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
          return
        }

        // Job läuft noch: nächsten Step erst 1000ms nach Erhalt dieser Antwort anfragen
        scanPollingRef.current = setTimeout(pollNextStep, 1000)
      } catch (e) {
        consecutiveFailures++
        console.error('[ScanStep] Polling error:', e)
        if (consecutiveFailures >= 8) {
          scanPollingRef.current = null
          setScanStatus(null)
          setScanMessage('')
          setError('Scan-Step liefert keine gültigen Antworten. Bitte versuche es erneut.')
          return
        }
        scanPollingRef.current = setTimeout(pollNextStep, 2000)
      } finally {
        isPollingRef.current = false
      }
    }

    // Erstes Polling sofort starten
    pollNextStep()
  }

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (scanPollingRef.current) {
        clearTimeout(scanPollingRef.current)
        scanPollingRef.current = null
      }
    }
  }, [])

  // CSV-Export für Signal-Reports (Productised Service)
  const handleExportCsv = () => {
    const deduplicated = deduplicateAndMergeTriggers(triggers, { activeOfferingId: activeOffering?.id });
    const visibleTriggers = deduplicated.filter(t => {
      const match = computeTargetMatchScore(t.company, t.target_group_match);
      const isDisq = Boolean(t.is_disqualified || match < 50 || t.is_potential_buyer === false);
      if (radarFilter === 'relevant') return !isDisq && match >= 50;
      if (radarFilter === 'unclear') return isDisq || match < 50;
      // Im 'all'-Modus nur verifizierte, qualifizierte Leads exportieren
      return !isDisq && match >= 50;
    });

    if (visibleTriggers.length === 0) {
      alert('Keine Signale zum Exportieren vorhanden.');
      return;
    }

    const csvContent = generateSignalReportCsv(visibleTriggers, { activeOffering });
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

      {/* 5 B2B-Kern-Kategorien Bar für punktgenaues Crawlen mit spezifischen Operatoren */}
      {activeOffering && (
        <div className="radar-category-bar" style={{
          background: 'linear-gradient(135deg, rgba(17, 24, 39, 0.95) 0%, rgba(15, 23, 42, 0.95) 100%)',
          border: '1px solid rgba(56, 189, 248, 0.25)',
          borderRadius: '12px',
          padding: '14px 18px',
          marginTop: '16px',
          marginBottom: '8px',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
          boxShadow: '0 4px 16px rgba(0, 0, 0, 0.25)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
            <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Sparkles size={14} color="#38bdf8" />
              <span>Ziel-Crawler nach B2B-Kaufkategorie ausrichten (Spezifische Search-Operatoren):</span>
            </span>
            <span style={{ fontSize: '0.72rem', color: selectedRadarCategory ? '#10b981' : '#94a3b8', fontFamily: 'monospace', fontWeight: 600 }}>
              {selectedRadarCategory ? '✓ 100% fokussierte B2B-Suchoperatoren aktiv' : 'Standard-Suche (Kategorie wählen zum Verfeinern)'}
            </span>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {TRIGGER_CATEGORIES.map(cat => {
              const isActive = selectedRadarCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => {
                    handleSelectCategory(cat);
                  }}
                  disabled={scanStatus === 'starting' || scanStatus === 'running'}
                  style={{
                    padding: '7px 13px',
                    fontSize: '0.78rem',
                    borderRadius: '8px',
                    background: isActive ? 'linear-gradient(135deg, rgba(56, 189, 248, 0.25) 0%, rgba(2, 132, 199, 0.25) 100%)' : 'rgba(255, 255, 255, 0.04)',
                    border: `1px solid ${isActive ? '#38bdf8' : 'rgba(255, 255, 255, 0.08)'}`,
                    color: isActive ? '#38bdf8' : '#cbd5e1',
                    fontWeight: isActive ? 700 : 500,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <span>{cat.number}. {cat.title}</span>
                  {isActive && <span style={{ fontSize: '0.68rem', color: '#10b981', fontWeight: 700 }}>✓</span>}
                </button>
              );
            })}
          </div>
        </div>
      )}

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
          <button onClick={() => { setError(null); setScanStatus(null); startChunkedScan(true) }}>
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
            onClick={() => { setError(null); setScanStatus(null); startChunkedScan(true) }}
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
                const isDisq = Boolean(t.is_disqualified || match < 50 || t.is_potential_buyer === false);
                if (radarFilter === 'relevant') return !isDisq && match >= 50;
                if (radarFilter === 'unclear') return isDisq || match < 50;
                return true;
              })
              .map((trigger, index) => {
                const matchScore = computeTargetMatchScore(trigger.company, trigger.target_group_match);
                const isDisqualified = Boolean(trigger.is_disqualified || matchScore < 50 || trigger.is_potential_buyer === false);
                const dateInfo = formatEventDate(trigger.published_at || trigger.event_date);
                const domain = extractDomain(trigger.quelle);

                return (
                  <div key={index} className="trigger-card" style={{ opacity: isDisqualified ? 0.65 : (trigger.prioritaet > 3 ? 0.6 : 1), border: isDisqualified ? '1px dashed rgba(239, 68, 68, 0.4)' : undefined }}>
                    
                    {/* Header: Status-Badges, Firmenname & Quick Actions */}
                    <div className="trigger-card-top">
                      <div className="trigger-card-info">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '4px' }}>
                          <div className="trigger-significance" style={{ 
                            background: isDisqualified ? '#6b728020' : (trigger.prioritaet === 1 ? '#EF444420' : trigger.prioritaet === 2 ? '#F59E0B20' : '#3B82F620'),
                            color: isDisqualified ? '#6b7280' : (trigger.prioritaet === 1 ? '#EF4444' : trigger.prioritaet === 2 ? '#F59E0B' : '#3B82F6'),
                            fontSize: '0.8rem',
                            fontWeight: 700,
                            padding: '4px 8px',
                            borderRadius: '6px',
                            display: 'inline-block'
                          }}>
                            {isDisqualified ? 'UNGEPRÜFTER ROHFUND / AUSSCHLUSS' : (trigger.prioritaet === 1 ? 'HOHE PRIORITÄT' : trigger.prioritaet === 2 ? 'MITTLERE PRIORITÄT' : 'NIEDRIGE PRIORITÄT')}
                          </div>

                          {/* Baustelle 3: Zielgruppen-Match Score */}
                          {!isDisqualified && matchScore >= 70 ? (
                            <span className="badge-match-high" title={trigger.match_reason || 'Hohe Passgenauigkeit zum Zielkundenprofil'}>
                              <CheckCircle size={12} /> Zielgruppen-Match: {matchScore}%
                            </span>
                          ) : !isDisqualified && matchScore >= 50 ? (
                            <span className="badge-match-mid" title={trigger.match_reason || 'Guter Zielgruppen-Match'}>
                              <Sparkles size={12} /> Zielgruppen-Match: {matchScore}%
                            </span>
                          ) : (
                            <span style={{
                              background: '#ef444415',
                              color: '#dc2626',
                              border: '1px solid #ef444430',
                              borderRadius: '6px',
                              padding: '3px 8px',
                              fontSize: '0.75rem',
                              fontWeight: 700,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px'
                            }} title={trigger.exclusion_reason || trigger.match_reason || 'Kandidat erfüllt verbindliche Käuferkriterien nicht'}>
                              <AlertCircle size={12} /> Ausgeschlossen ({trigger.exclusion_reason || `Match: ${matchScore}%`})
                            </span>
                          )}

                          {trigger.signal_kategorie && (
                            <span style={{
                              display: 'inline-block',
                              padding: '3px 8px',
                              background: trigger.signal_kategorie === 'HIRING' ? '#05966920' :
                                          trigger.signal_kategorie === 'FUNDING' ? '#7c3aed20' :
                                          trigger.signal_kategorie === 'TECH_MIGRATION' ? '#2563eb20' :
                                          trigger.signal_kategorie === 'REGULATION' ? '#d9770620' :
                                          trigger.signal_kategorie === 'M_A' ? '#dc262620' : 'rgba(56, 189, 248, 0.15)',
                              color: trigger.signal_kategorie === 'HIRING' ? '#059669' :
                                     trigger.signal_kategorie === 'FUNDING' ? '#7c3aed' :
                                     trigger.signal_kategorie === 'TECH_MIGRATION' ? '#2563eb' :
                                     trigger.signal_kategorie === 'REGULATION' ? '#d97706' :
                                     trigger.signal_kategorie === 'M_A' ? '#dc2626' : '#38bdf8',
                              borderRadius: '6px',
                              fontSize: '0.74rem',
                              fontWeight: 700
                            }}>
                              {trigger.signal_kategorie.replace(/_/g, ' ')}
                            </span>
                          )}
                        </div>

                        <h3 className="trigger-company">{trigger.company}</h3>

                        {trigger.bewertung && (
                          <p className="trigger-rating" style={{ fontStyle: 'italic', color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>
                            "{trigger.bewertung}"
                          </p>
                        )}
                      </div>

                      {/* Header Actions */}
                      <div className="trigger-actions">
                        <button
                          type="button"
                          className="action-btn action-btn-secondary"
                          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontSize: '0.85rem', padding: '8px 12px' }}
                          onClick={() => {
                            const params = new URLSearchParams()
                            params.set('company', trigger.company)
                            if (trigger.signal) params.set('trigger', `${trigger.signal} | ${trigger.psychologische_ansprache || ''}`)
                            if (trigger.pain_point) params.set('pain_point', trigger.pain_point)
                            navigate(`/nexus/lead-intelligence?${params.toString()}`)
                          }}
                        >
                          <Brain size={14} />
                          <span>Lead Intelligence</span>
                        </button>
                        {(Array.isArray(savedLeads) ? savedLeads.includes(trigger.company) : Boolean(savedLeads?.[trigger.company])) ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
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
                        ) : isDisqualified ? (
                          <button 
                            type="button"
                            className="action-btn action-btn-secondary" 
                            style={{ opacity: 0.65, cursor: 'not-allowed', background: 'rgba(239, 68, 68, 0.08)', color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.25)', fontSize: '0.85rem' }} 
                            disabled
                            title={trigger.exclusion_reason || 'Kandidat erfüllt verbindliche Käuferkriterien nicht'}
                          >
                            <AlertCircle size={14} />
                            <span>Nicht qualifiziert</span>
                          </button>
                        ) : (
                          <button className="action-btn action-btn-primary" onClick={() => handleProcessSignal(trigger)}>
                            <ArrowRight size={16} />
                            {t('nexus.radar.saveToPipeline', 'In Pipeline übernehmen')}
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="trigger-body" style={{ width: '100%', boxSizing: 'border-box' }}>
                      <p className="trigger-desc">{trigger.signal}</p>

                      {trigger.business_opportunity && (
                        <div className="trigger-opportunity-box" style={{
                          margin: '10px 0',
                          padding: '10px 12px',
                          borderRadius: '8px',
                          background: trigger.business_opportunity.startsWith('[Hypothese]') ? 'rgba(234, 179, 8, 0.08)' : 'rgba(59, 130, 246, 0.08)',
                          borderLeft: trigger.business_opportunity.startsWith('[Hypothese]') ? '3px solid #eab308' : '3px solid #3b82f6',
                          fontSize: '0.88rem',
                          lineHeight: 1.45
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                            {trigger.business_opportunity.startsWith('[Hypothese]') ? (
                              <span style={{
                                background: '#eab308',
                                color: '#1a1a1a',
                                fontSize: '0.68rem',
                                fontWeight: 800,
                                padding: '2px 6px',
                                borderRadius: '4px',
                                letterSpacing: '0.04em'
                              }}>
                                HYPOTHESE
                              </span>
                            ) : (
                              <span style={{
                                background: '#3b82f6',
                                color: '#ffffff',
                                fontSize: '0.68rem',
                                fontWeight: 800,
                                padding: '2px 6px',
                                borderRadius: '4px',
                                letterSpacing: '0.04em'
                              }}>
                                KAUFABSICHT
                              </span>
                            )}
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                              {trigger.business_opportunity.startsWith('[Hypothese]') ? 'Abgeleitete Vertriebschance (kein Quelltext-Fakt)' : 'Bestätigter Bedarf'}
                            </span>
                          </div>
                          <p style={{ margin: 0, color: 'var(--text-primary)' }}>
                            {trigger.business_opportunity.replace(/^\[Hypothese\]\s*/, '')}
                          </p>
                        </div>
                      )}

                      {trigger.pain_point && (
                        <div className="trigger-pain-box" style={{
                          margin: '10px 0',
                          padding: '10px 12px',
                          borderRadius: '8px',
                          background: 'rgba(245, 158, 11, 0.08)',
                          borderLeft: '3px solid #f59e0b',
                          fontSize: '0.88rem',
                          lineHeight: 1.45
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                            <span style={{
                              background: '#f59e0b',
                              color: '#1a1a1a',
                              fontSize: '0.68rem',
                              fontWeight: 800,
                              padding: '2px 6px',
                              borderRadius: '4px',
                              letterSpacing: '0.04em'
                            }}>
                              PAIN POINT (ENDKÄUFER)
                            </span>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                              Konkreter Schmerzpunkt
                            </span>
                          </div>
                          <p style={{ margin: 0, color: 'var(--text-primary)' }}>
                            {trigger.pain_point}
                          </p>
                        </div>
                      )}

                      {(trigger.blind_company || trigger.blind_location || trigger.blind_quantity || (Array.isArray(trigger.target_buyers) && trigger.target_buyers.length > 0)) && (
                        <div className="trigger-blind-box" style={{
                          margin: '10px 0',
                          padding: '10px 12px',
                          borderRadius: '8px',
                          background: 'rgba(56, 189, 248, 0.07)',
                          borderLeft: '3px solid #0284c7',
                          fontSize: '0.88rem',
                          lineHeight: 1.45
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px', flexWrap: 'wrap', gap: '6px' }}>
                            <span style={{
                              background: '#0284c7',
                              color: '#ffffff',
                              fontSize: '0.68rem',
                              fontWeight: 800,
                              padding: '2px 6px',
                              borderRadius: '4px',
                              letterSpacing: '0.04em'
                            }}>
                              BLIND PROFILE &amp; MATCHMAKING
                            </span>
                            {trigger.blind_location && (
                              <span style={{ fontSize: '0.75rem', color: '#38bdf8', fontWeight: 600 }}>
                                📍 {trigger.blind_location}
                              </span>
                            )}
                          </div>
                          {trigger.blind_company && (
                            <div style={{ margin: '0 0 6px 0', color: 'var(--text-primary)', fontWeight: 600 }}>
                              🏢 {trigger.blind_company}
                              {trigger.blind_quantity && (
                                <span style={{ color: 'var(--text-secondary)', fontWeight: 400, marginLeft: '6px' }}>
                                  ({trigger.blind_quantity})
                                </span>
                              )}
                            </div>
                          )}
                          {Array.isArray(trigger.target_buyers) && trigger.target_buyers.length > 0 && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', marginTop: '6px' }}>
                              <span style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Target Buyers:</span>
                              {trigger.target_buyers.map((tb, idx) => (
                                <span key={idx} style={{
                                  background: 'rgba(56, 189, 248, 0.15)',
                                  color: '#38bdf8',
                                  fontSize: '0.72rem',
                                  padding: '1px 7px',
                                  borderRadius: '12px',
                                  border: '1px solid rgba(56, 189, 248, 0.3)',
                                  fontWeight: 500
                                }}>
                                  {tb}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                      
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

                          {/* Weitere Quellen aufklappbar anzeigen */}
                          {Array.isArray(trigger.all_sources) && trigger.all_sources.filter(s => s && s !== trigger.quelle).length > 0 && (
                            <details className="trigger-extra-sources" style={{ margin: '0' }}>
                              <summary style={{
                                cursor: 'pointer',
                                fontSize: '0.78rem',
                                color: '#38bdf8',
                                fontWeight: 600,
                                userSelect: 'none',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                background: 'rgba(56, 189, 248, 0.08)',
                                padding: '4px 8px',
                                borderRadius: '6px',
                                border: '1px solid rgba(56, 189, 248, 0.2)'
                              }}>
                                <span>Weitere Quellen: {trigger.all_sources.filter(s => s && s !== trigger.quelle).length}</span>
                              </summary>
                              <div style={{
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '4px',
                                marginTop: '6px',
                                paddingLeft: '8px',
                                borderLeft: '2px solid rgba(56, 189, 248, 0.3)'
                              }}>
                                {trigger.all_sources.filter(s => s && s !== trigger.quelle).map((srcUrl, sIdx) => {
                                  const extraDomain = extractDomain(srcUrl);
                                  return (
                                    <a
                                      key={sIdx}
                                      href={srcUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="trigger-source-link"
                                      style={{ fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                                      title={srcUrl}
                                    >
                                      <Globe size={11} />
                                      <span>{extraDomain || srcUrl}</span>
                                      <ExternalLink size={10} />
                                    </a>
                                  );
                                })}
                              </div>
                            </details>
                          )}
                          
                          {trigger.event_date_unverified ? (
                            <div className="trigger-date-info" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                              <span style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                color: '#d97706',
                                background: 'rgba(217, 119, 6, 0.12)',
                                padding: '2px 6px',
                                borderRadius: '4px',
                                fontSize: '0.75rem',
                                fontWeight: 600
                              }}>
                                <AlertCircle size={12} color="#d97706" />
                                Datum nicht verifiziert
                              </span>
                              {trigger.published_at && (
                                <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                                  Veröffentlicht am: {formatEventDate(trigger.published_at).formattedDate}
                                </span>
                              )}
                            </div>
                          ) : (
                            <div className="trigger-date-info">
                              <Clock size={13} />
                              <span>{dateInfo.formattedDate} ({dateInfo.relativeTime})</span>
                            </div>
                          )}
                          {trigger.has_date_conflict && trigger.conflicting_dates && trigger.conflicting_dates.length > 1 && (
                            <div style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              color: '#b45309',
                              background: '#fef3c7',
                              padding: '2px 6px',
                              borderRadius: '4px',
                              fontSize: '0.72rem',
                              fontWeight: 600
                            }} title={`Abweichende Fundstellen in Artikeln: ${trigger.conflicting_dates.join(', ')}`}>
                              <AlertCircle size={11} color="#b45309" />
                              <span>Datumskonflikt ({trigger.conflicting_dates.join(' vs. ')})</span>
                            </div>
                          )}
                        </div>

                        {dateInfo.isExpired && (
                          <span className="badge-expired" title="Signal ist älter als 90 Tage">
                            🚨 Veraltet (&gt;90 Tage)
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Human-Verified Freigabe & Veröffentlichung auf dat-dat.de (Arbeitsfeld 100% Breite) */}
                    <div className="trigger-publish-container" style={{ width: '100%', boxSizing: 'border-box', marginTop: '14px' }}>
                      <SignalPublishSection
                        trigger={trigger}
                        userId={user?.id}
                      />
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
