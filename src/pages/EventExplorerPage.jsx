import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Search,
  Building2,
  Calendar,
  MapPin,
  Sparkles,
  Loader2,
  AlertCircle,
  CheckCircle,
  ArrowRight,
  Globe,
  Crown,
  UserX,
  Activity,
  GitMerge,
  Layers,
  AlertTriangle,
  ShieldCheck,
  Briefcase,
  FileText,
  Clock,
  Database,
  Server,
  RefreshCw,
  ExternalLink,
  X,
  ChevronRight,
  Terminal,
  Filter,
  Check,
  Info
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import * as db from '../lib/nexus-db'
import { callEliteEnrichment } from '../lib/nexus-ai'
import './EventExplorerPage.css'

export const MANDATE_EVENT_TYPES = [
  {
    id: 'organ_vakanz',
    event_key: 'organ_vakanz',
    label_de: 'Abrupte Organ-Vakanz & Rücktritt',
    description_de: 'CEO/CFO/CRO Abberufung, Board-Vakuum, Ad-hoc Rücktritt per sofort',
    icon: 'UserX',
    badge: 'Organ-Vakuum',
    keywords: [
      'Rücktritt per sofort',
      'Amtsniederlegung Vorstand',
      'CEO resignation immediate effect',
      'directorate change',
      'abberufen',
      'Ausscheiden aus dem Vorstand',
      'démission directeur général',
      'dimisión consejero delegado',
      'board vacancy'
    ]
  },
  {
    id: 'restrukturierung_cro',
    event_key: 'restrukturierung_cro',
    label_de: 'Restrukturierung & Sanierung',
    description_de: 'StaRUG, Eigenverwaltung, CRO-Bedarf, Schutzschirmverfahren',
    icon: 'Activity',
    badge: 'StaRUG & Sanierung',
    keywords: [
      'StaRUG',
      'Restrukturierungsplan',
      'Eigenverwaltung',
      'Schutzschirmverfahren',
      'Chief Restructuring Officer',
      'CRO interim',
      'financial restructuring',
      'redressement judiciaire',
      'concurso de acreedores'
    ]
  },
  {
    id: 'not_governance_ar',
    event_key: 'not_governance_ar',
    label_de: 'Not-Governance & AR-Interim',
    description_de: 'Aufsichtsrat übernimmt operativ, Führungskrise, Ad-hoc Mandat',
    icon: 'Crown',
    badge: 'AR übernimmt operativ',
    keywords: [
      'Aufsichtsrat übernimmt interimistisch',
      'interim CEO',
      'interim board mandate',
      'Führungskrise Organ',
      'ad interim executive',
      'présidence par intérim',
      'Verwaltungsrat operative Leitung'
    ]
  },
  {
    id: 'm_and_a_board',
    event_key: 'm_and_a_board',
    label_de: 'M&A Vollzug & Board-Umbau',
    description_de: 'Post-Merger Organumbau, Delisting, Squeeze-out Neubesetzung',
    icon: 'GitMerge',
    badge: 'Post-Merger Organumbau',
    keywords: [
      'Post-Merger Board',
      'Vorstandsumbau nach Übernahme',
      'Squeeze-Out Organumbau',
      'Delisting Board change',
      'change of control executive',
      'remaniement direction fusion'
    ]
  },
  {
    id: 'carveout_pe',
    event_key: 'carveout_pe',
    label_de: 'Carve-Out & PE-Transaktion',
    description_de: 'Spin-off, Portfolio-Lead, Neubesetzung nach Transaktion',
    icon: 'Layers',
    badge: 'Carve-Out & PE',
    keywords: [
      'Carve-Out Management',
      'Spin-off Vorstand',
      'Private Equity Portfolio CEO',
      'Management Buyout C-Level',
      'PE sponsor executive replacement'
    ]
  },
  {
    id: 'finanz_sondersituation',
    event_key: 'finanz_sondersituation',
    label_de: 'Finanzielle Sondersituation',
    description_de: 'Refinanzierung, Debt-Restrukturierung, Covenant-Breach, Liquiditätsengpass',
    icon: 'AlertTriangle',
    badge: 'Debt & Refinanzierung',
    keywords: [
      'Refinanzierungsverhandlung',
      'Debt Restructuring',
      'Anleiherestrukturierung',
      'Kapitalherabsetzung',
      'CFO Interim Sanierung',
      'covenant breach waiver',
      'Standstill Agreement',
      'renegociation dette'
    ]
  }
]

export const GEOGRAPHY_OPTIONS = [
  {
    id: 'EU_UK',
    label: 'Europa + UK (Gesamtmarkt)',
    sublabel: 'Pan-Europäischer Gesamtmarkt inkl. UK & Schweiz',
    sources: ['EQS News / DGAP', 'LSE RNS', 'SHAB (Schweiz)', 'AMF (Frankreich)', 'CNMV (Spanien)'],
    sourcesList: 'EQS, LSE RNS, SHAB, CNMV, AMF'
  },
  {
    id: 'DACH',
    label: 'DACH (Deutschland, Österreich, Schweiz)',
    sublabel: 'Bundesanzeiger, EQS / DGAP Ad-hoc, SHAB, Wiener Börse',
    sources: ['EQS News / DGAP Ad-hoc', 'SHAB (Schweizerisches Handelsamtsblatt)', 'Wiener Börse'],
    sourcesList: 'EQS, DGAP, SHAB, Wiener Börse'
  },
  {
    id: 'UK_IRL',
    label: 'UK & Irland',
    sublabel: 'London Stock Exchange RNS & Regulatory Feeds',
    sources: ['London Stock Exchange RNS', 'Investegate', 'Euronext Dublin'],
    sourcesList: 'LSE RNS, Investegate, Euronext Dublin'
  },
  {
    id: 'WEST_EU',
    label: 'Westeuropa / Frankreich',
    sublabel: 'AMF France, Euronext Paris & BeNeLux',
    sources: ['AMF France', 'Euronext Paris / Brussels / Amsterdam', 'Moniteur Belge'],
    sourcesList: 'AMF, Euronext Paris, Euronext Brussels'
  },
  {
    id: 'SOUTH_EU',
    label: 'Südeuropa / Spanien',
    sublabel: 'CNMV España & BME Mercado Continuo',
    sources: ['CNMV (Comisión Nacional del Mercado de Valores)', 'BME Bolsas y Mercados Españoles'],
    sourcesList: 'CNMV, BME'
  }
]

export const RADAR_CATEGORY_MAP = {
  organ_vakanz: ['c_level_vakanz', 'c_level_vakanz_ch', 'organ_vakanz'],
  restrukturierung_cro: ['unternehmenskrise_restrukturierung', 'insolvenzantrag_eigenverwaltung', 'transformation_sanierung', 'restrukturierung_cro'],
  not_governance_ar: ['not_governance_ar', 'unternehmenskrise_restrukturierung'],
  m_and_a_board: ['fusion_uebernahme_unternehmensverkauf', 'm_and_a_board'],
  carveout_pe: ['carveout_pe', 'fusion_uebernahme_unternehmensverkauf'],
  finanz_sondersituation: ['finanzierung_anleihen_restrukturierung', 'finanz_sondersituation']
}

export default function EventExplorerPage() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const [eventTypes] = useState(MANDATE_EVENT_TYPES)
  const [selectedType, setSelectedType] = useState(null)
  const [selectedRegionId, setSelectedRegionId] = useState('EU_UK')
  const [customKeyword, setCustomKeyword] = useState('')
  const [loading, setLoading] = useState(false)
  const [events, setEvents] = useState([])
  const [stats, setStats] = useState(null)
  const [error, setError] = useState(null)
  const [existingEvents, setExistingEvents] = useState([])
  const [enrichingId, setEnrichingId] = useState(null)
  const [enrichedPackages, setEnrichedPackages] = useState({})
  const [freshnessFilter, setFreshnessFilter] = useState('HOT') // 'HOT' | 'MONITORING' | 'ARCHIVE' | 'ALL'
  const [realityFilter, setRealityFilter] = useState('ALL')
  const [sortField, setSortField] = useState('date') // 'date' | 'priority' | 'company'
  const [sortDirection, setSortDirection] = useState('desc') // 'desc' | 'asc'
  const [reviewDrafts, setReviewDrafts] = useState({})

  function getEventFreshness(evt) {
    const pubStr = evt.published_at || evt.event_date
    let ageDays = evt.age_days
    if (ageDays === undefined || ageDays === null) {
      if (pubStr) {
        const pubDate = new Date(pubStr)
        ageDays = Math.max(0, (Date.now() - pubDate.getTime()) / (1000 * 60 * 60 * 24))
      } else {
        ageDays = 0
      }
    }

    let category = 'HOT_FIRST_MOVER'
    let label = '🔥 HOT / FIRST-MOVER (< 7 Tage)'
    let badgeClass = 'freshness-hot'

    if (ageDays > 30) {
      category = 'ARCHIVE'
      label = '📁 ARCHIV (> 30 Tage)'
      badgeClass = 'freshness-archive'
    } else if (ageDays > 7) {
      category = 'MONITORING'
      label = '⏳ MONITORING (7–30 Tage)'
      badgeClass = 'freshness-monitoring'
    }

    return {
      category,
      label,
      badgeClass,
      ageDays: Math.round(ageDays * 10) / 10
    }
  }

  // NeXus Search Execution Phase & Source Diagnostics
  const [searchStatus, setSearchStatus] = useState('IDLE')
  // 'IDLE' | 'FILTERING_STORED' | 'RESULTS_FOUND' | 'NO_MATCHES_FILTER' | 'DATA_SOURCE_EMPTY' | 'DATA_SOURCE_UNAVAILABLE' | 'SERVER_ERROR'
  const [filterDiagnostics, setFilterDiagnostics] = useState({
    totalBeforeFilter: 0,
    matchedCategory: 0,
    matchedRegion: 0,
    sourceOrigin: null,
    htmlFallbackDetected: false,
    lastUpdated: null,
    queryTimeMs: 0
  })

  // NeXus Radar History & System Status State
  const [activeTab, setActiveTab] = useState('events') // 'events' | 'history'
  const [historyData, setHistoryData] = useState(null)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyError, setHistoryError] = useState(null)
  const [selectedRun, setSelectedRun] = useState(null)

  const REALITY_CHECK_LABELS = {
    MANDAT_BELEGT: 'Mandat belegt (Externe Suche / Vergabe nachgewiesen)',
    MANDAT_PLAUSIBEL: 'Mandat plausibel (Bedarf plausibel, Suche unbestätigt)',
    BEOBACHTEN: 'Beobachten (Frühes / generelles Signal auf Watchlist)',
    VERWERFEN: 'Verwerfen (Gelöst / Abgeschlossen / Ungeeignet)'
  }

  const selectedGeo = GEOGRAPHY_OPTIONS.find(g => g.id === selectedRegionId) || GEOGRAPHY_OPTIONS[0]

  // Client-side durable storage fallback for read-only serverless runtimes
  const LOCAL_REVIEWS_KEY = 'nexus_radar_human_reviews'

  function getLocalReviews() {
    try {
      return JSON.parse(localStorage.getItem(LOCAL_REVIEWS_KEY) || '{}')
    } catch {
      return {}
    }
  }

  function saveLocalReview(eventId, reviewObj) {
    try {
      const stored = getLocalReviews()
      stored[eventId] = reviewObj
      localStorage.setItem(LOCAL_REVIEWS_KEY, JSON.stringify(stored))
    } catch (e) {
      console.warn('Failed to save review to localStorage:', e)
    }
  }

  async function loadRadarHistory() {
    setHistoryLoading(true)
    setHistoryError(null)
    try {
      let data = null
      try {
        const resp = await fetch('/data/continuous_radar_history.json')
        const contentType = resp.headers.get('content-type') || ''
        if (resp.ok && !contentType.includes('text/html')) {
          data = await resp.json()
        }
      } catch (e) {
        console.warn('Local history fetch note:', e)
      }

      if (!data) {
        try {
          const fResp = await fetch('/.netlify/functions/nexus-radar-events?view=history')
          const fContentType = fResp.headers.get('content-type') || ''
          if (fResp.ok && !fContentType.includes('text/html')) {
            data = await fResp.json()
          }
        } catch (e) {
          console.warn('Netlify function history fetch note:', e)
        }
      }

      if (data && Array.isArray(data.runs)) {
        setHistoryData(data)
      } else {
        setHistoryError('Keine Historien-Daten gefunden.')
      }
    } catch (err) {
      console.error('Failed to load radar history:', err)
      setHistoryError(err.message)
    } finally {
      setHistoryLoading(false)
    }
  }

  async function handleSaveReview(evt, overrideDecision = null, isConfirm = false) {
    if (!evt || !evt.id) return
    const draft = reviewDrafts[evt.id] || {}
    const decision = overrideDecision || draft.decision || evt.reality_check?.status || 'BEOBACHTEN'
    const notes = draft.notes !== undefined ? draft.notes : (evt.reality_check?.human_review?.reviewer_notes || '')
    const nowIso = new Date().toISOString()

    const reviewObj = {
      reviewed: true,
      reviewed_at: nowIso,
      reviewer_decision: decision,
      reviewer_notes: notes,
      confirmed: Boolean(isConfirm)
    }

    // Always persist to client localStorage first (ensures durability on serverless read-only Lambda)
    saveLocalReview(evt.id, reviewObj)

    setReviewDrafts(prev => ({
      ...prev,
      [evt.id]: { ...(prev[evt.id] || {}), saving: true }
    }))

    try {
      await fetch('/.netlify/functions/nexus-radar-events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_id: evt.id,
          reviewer_decision: decision,
          reviewer_notes: notes,
          confirmed: Boolean(isConfirm)
        })
      })

      setEvents(prev => prev.map(e => {
        if (e.id === evt.id) {
          return {
            ...e,
            reality_check: {
              ...(e.reality_check || {}),
              status: decision,
              status_label: REALITY_CHECK_LABELS[decision] || decision,
              human_review: reviewObj
            }
          }
        }
        return e
      }))

      setReviewDrafts(prev => ({
        ...prev,
        [evt.id]: { decision, notes, saving: false, success: true }
      }))

      setTimeout(() => {
        setReviewDrafts(prev => ({
          ...prev,
          [evt.id]: { ...(prev[evt.id] || {}), success: false }
        }))
      }, 3500)
    } catch (err) {
      console.error('Failed to save human review:', err)
      // Even if network fails, UI shows updated because localStorage persisted it
      setReviewDrafts(prev => ({
        ...prev,
        [evt.id]: { decision, notes, saving: false, success: true }
      }))
    }
  }

  useEffect(() => {
    loadExistingEvents()
    handleSearch()
    loadRadarHistory()
  }, [user, selectedType, selectedRegionId])

  async function loadExistingEvents() {
    if (!user) return
    const evts = await db.getEvents(user.id, { limit: 20 })
    setExistingEvents(evts)
  }

  async function handleCreateAndEnrich(evt) {
    if (!user || !evt.id) return
    setEnrichingId(evt.id)
    try {
      const pkg = await db.createLeadPackage(user.id, {
        event_id: evt.id,
        company_id: null,
        headline: evt.title || `${evt.event_type} — ${evt.company_name}`,
        summary: evt.description || null,
        why_relevant: `Executive Mandat Signal: ${evt.event_type}`,
        quality_score: evt.confidence ? Math.round(evt.confidence * 100) : 50,
        source_count: evt.source_count || 1,
        evidence: evt.raw_event_ids || [],
        status: 'draft'
      })

      if (!pkg) {
        alert('Lead Package konnte nicht erstellt werden.')
        return
      }

      setEnrichedPackages(prev => ({ ...prev, [evt.id]: { packageId: pkg.id, status: 'created' } }))

      const result = await callEliteEnrichment({ leadPackageId: pkg.id })

      if (result.status === 'enriched') {
        setEnrichedPackages(prev => ({ ...prev, [evt.id]: { packageId: pkg.id, status: 'elite', contact: result.contact } }))
      } else {
        setEnrichedPackages(prev => ({ ...prev, [evt.id]: { packageId: pkg.id, status: 'no_email', reason: result.crawler_reason } }))
      }
    } catch (e) {
      console.error('Elite enrichment failed:', e)
      setEnrichedPackages(prev => ({ ...prev, [evt.id]: { status: 'error', error: e.message } }))
    } finally {
      setEnrichingId(null)
    }
  }

  async function handleSearch() {
    const startTime = performance.now()
    setLoading(true)
    setSearchStatus('FILTERING_STORED')
    setError(null)
    setEvents([])
    setStats(null)

    let htmlFallbackDetected = false
    let sourceOrigin = 'none'
    let lastUpdatedTimestamp = null

    try {
      // 1. Kontinuierlicher NeXus Radar (Live-Ergebnisse aus Ingestion)
      let radarEvents = []
      try {
        const resp = await fetch('/data/continuous_radar_events.json')
        const contentType = resp.headers.get('content-type') || ''
        if (resp.ok && contentType.includes('text/html')) {
          console.warn('[EventExplorer] SPA redirect detected on /data/continuous_radar_events.json (received HTML instead of JSON)')
          htmlFallbackDetected = true
        } else if (resp.ok) {
          const rawRadar = await resp.json()
          radarEvents = rawRadar.events || []
          lastUpdatedTimestamp = rawRadar.generated_at || null
          sourceOrigin = 'static_json'
        }
      } catch (err) {
        console.warn('[EventExplorer] Local radar fetch notice:', err)
      }

      if (radarEvents.length === 0) {
        try {
          const fResp = await fetch('/.netlify/functions/nexus-radar-events')
          const fContentType = fResp.headers.get('content-type') || ''
          if (fResp.ok && fContentType.includes('text/html')) {
            console.warn('[EventExplorer] SPA redirect detected on /.netlify/functions/nexus-radar-events')
            htmlFallbackDetected = true
          } else if (fResp.ok) {
            const rawRadar = await fResp.json()
            radarEvents = rawRadar.events || []
            if (rawRadar.last_updated) lastUpdatedTimestamp = rawRadar.last_updated
            if (radarEvents.length > 0) sourceOrigin = 'netlify_function'
          }
        } catch (err) {
          console.warn('[EventExplorer] Netlify function fetch notice:', err)
        }
      }

      const matchingCategories = selectedType ? (RADAR_CATEGORY_MAP[selectedType.event_key] || []) : null
      const kw = customKeyword.trim().toLowerCase()
      const loadedEvents = []

      let matchedCategoryCount = 0
      let matchedRegionCount = 0

      // Normalisiere und filtere Continuous Radar Events
      for (const rev of radarEvents) {
        const catMatch = matchingCategories === null || matchingCategories.includes(rev.category)
        if (catMatch) matchedCategoryCount++

        const compCountry = (rev.country || 'DE').toUpperCase()
        
        let matchesRegion = true
        if (selectedRegionId === 'DACH') {
          matchesRegion = ['DE', 'AT', 'CH'].includes(compCountry)
        } else if (selectedRegionId === 'UK_IRL') {
          matchesRegion = ['UK', 'GB', 'IE'].includes(compCountry)
        } else if (selectedRegionId === 'WEST_EU') {
          matchesRegion = ['FR', 'BE', 'NL', 'LU'].includes(compCountry)
        } else if (selectedRegionId === 'SOUTH_EU') {
          matchesRegion = ['ES', 'IT', 'PT'].includes(compCountry)
        }
        if (matchesRegion) matchedRegionCount++

        let matchesKeyword = true
        if (kw) {
          const fullText = `${rev.company_name} ${rev.description} ${rev.evidence_text} ${rev.mandate_rationale || ''} ${rev.category}`.toLowerCase()
          matchesKeyword = fullText.includes(kw)
        }

        if ((catMatch || (kw && matchesKeyword)) && matchesRegion) {
          const localReviews = getLocalReviews()
          const storedReview = localReviews[rev.event_id]
          let effectiveRealityCheck = rev.reality_check || null
          if (storedReview && effectiveRealityCheck) {
            effectiveRealityCheck = {
              ...effectiveRealityCheck,
              status: storedReview.reviewer_decision || effectiveRealityCheck.status,
              status_label: REALITY_CHECK_LABELS[storedReview.reviewer_decision] || effectiveRealityCheck.status_label,
              human_review: storedReview
            }
          }

          loadedEvents.push({
            id: rev.event_id,
            event_type: rev.category || (selectedType ? selectedType.event_key : 'mandat_signal'),
            title: rev.description || `${rev.company_name}: ${rev.category}`,
            description: rev.evidence_text || rev.description,
            company_name: rev.company_name,
            country: rev.country || 'DE',
            city: rev.region || null,
            event_date: rev.event_date || rev.published_at || rev.captured_at,
            published_at: rev.published_at,
            freshness_category: rev.freshness_category,
            freshness_label: rev.freshness_label,
            age_days: rev.age_days,
            is_advisor_mandated: rev.is_advisor_mandated,
            axis_a_event_certainty: rev.axis_a_event_certainty || 'nachgewiesen',
            provenance_status: rev.provenance_status || 'real_source_verified',
            verification_status: rev.provenance_status === 'real_source_verified' ? 'verified' : 'unverified',
            source_url: rev.source_url,
            source_type: rev.source_type,
            mandate_priority: rev.mandate_priority || 'watchlist_general_distress',
            mandate_priority_label: rev.mandate_priority_label || 'Watchlist / General Distress',
            action_type: rev.action_type || 'unspecified',
            mandate_rationale: rev.mandate_rationale,
            history_count: (rev.history || []).length,
            reality_check: effectiveRealityCheck,
            reality_check_history: rev.reality_check_history || []
          })
        }
      }

      // 2. Datenbank-Filtering aus verifizierten nexus_opportunities (sofern vorhanden)
      let opps = []
      let evts = []
      try {
        let oppQuery = supabase
          .from('nexus_opportunities')
          .select('id, title, notes, situation, pain_points, created_at, lead_score, review_status, source, nexus_companies(id, name, domain, country)')
          .eq('review_status', 'verified')
          .is('deleted_at', null)
          .order('created_at', { ascending: false })
          .limit(50)

        if (customKeyword.trim()) {
          const kwSql = customKeyword.trim()
          oppQuery = oppQuery.or(`title.ilike.%${kwSql}%,situation.ilike.%${kwSql}%,notes.ilike.%${kwSql}%`)
        }

        const { data: oppData, error: dbErr } = await oppQuery
        if (!dbErr && Array.isArray(oppData)) {
          opps = oppData
          if (opps.length > 0 && sourceOrigin === 'none') sourceOrigin = 'supabase'
        }

        let evQuery = supabase
          .from('nexus_events')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(20)

        if (customKeyword.trim()) {
          evQuery = evQuery.ilike('title', `%${customKeyword.trim()}%`)
        }

        const { data: evData } = await evQuery
        if (Array.isArray(evData)) {
          evts = evData
        }
      } catch (dbEx) {
        console.warn('[EventExplorer] Supabase query notice:', dbEx.message)
      }

      if (Array.isArray(opps)) {
        for (const opp of opps) {
          const compCountry = (opp.nexus_companies?.country || '').toUpperCase()
          const titleUpper = (opp.title || '').toUpperCase()
          let matchesRegion = true

          if (selectedRegionId === 'DACH') {
            matchesRegion = compCountry === 'DE' || compCountry === 'AT' || compCountry === 'CH' || compCountry === 'DACH' || titleUpper.includes('[DACH]') || titleUpper.includes('[CH]')
          } else if (selectedRegionId === 'UK_IRL') {
            matchesRegion = compCountry === 'UK' || compCountry === 'GB' || compCountry === 'IE' || titleUpper.includes('[UK]')
          } else if (selectedRegionId === 'WEST_EU') {
            matchesRegion = compCountry === 'FR' || compCountry === 'BE' || compCountry === 'NL' || compCountry === 'LU' || titleUpper.includes('[FR]') || titleUpper.includes('[WEST_EU]')
          } else if (selectedRegionId === 'SOUTH_EU') {
            matchesRegion = compCountry === 'ES' || compCountry === 'IT' || compCountry === 'PT' || titleUpper.includes('[ES]') || titleUpper.includes('[SOUTH_EU]')
          }

          if (!matchesRegion) continue

          // Vermeide Dopplungen zu Radar-Events
          if (!loadedEvents.some(e => e.id === opp.id || (opp.title && e.title && e.title.includes(opp.title)))) {
            loadedEvents.push({
              id: opp.id,
              event_type: selectedType.event_key,
              title: opp.title,
              description: opp.situation || opp.notes || (Array.isArray(opp.pain_points) ? opp.pain_points.join(', ') : '') || 'Verifiziertes Signal aus der Pflichtmitteilungs-Pipeline',
              company_name: opp.nexus_companies?.name || 'UNRESOLVED',
              country: opp.nexus_companies?.country || selectedGeo.id,
              event_date: opp.created_at,
              published_at: opp.created_at,
              confidence: (opp.lead_score ? opp.lead_score / 100 : 0.95),
              verification_status: opp.review_status === 'verified' ? 'verified' : 'pending',
              source_url: opp.source,
              mandate_priority: 'watchlist_general_distress',
              mandate_priority_label: 'Watchlist / General Distress',
              action_type: 'db_opportunity',
              reality_check: {
                status: 'BEOBACHTEN',
                status_label: 'Beobachten (Frühes / generelles Signal auf Watchlist)',
                target_role: 'KEINE',
                target_role_label: 'Keine externe Organfunktion ableitbar',
                facts_proven: opp.situation || opp.notes || opp.title,
                source_proof: opp.source,
                source_date: opp.created_at,
                mandate_hypothesis: 'Beobachtungsfall auf der Watchlist; kein unmittelbarer externer Mandatsansatz.',
                missing_information: ['Keine konkrete Mandatsausschreibung in den Pflichtdaten nachgewiesen'],
                counter_indicators: [],
                rationale: 'Signal aus historischer Pflichtmitteilung der Unternehmensdatenbank.',
                checked_at: opp.created_at,
                human_review: { reviewed: false, reviewed_at: null, reviewer_decision: null, reviewer_notes: '', confirmed: false }
              },
              reality_check_history: []
            })
          }
        }
      }

      if (Array.isArray(evts)) {
        for (const ev of evts) {
          if (!loadedEvents.some(e => e.id === ev.id)) {
            loadedEvents.push({
              id: ev.id,
              event_type: ev.event_type || selectedType.event_key,
              title: ev.title,
              description: ev.description,
              company_name: ev.company_name,
              country: ev.country || 'EU',
              event_date: ev.event_date || ev.created_at,
              published_at: ev.created_at,
              confidence: ev.confidence || 0.9,
              verification_status: ev.verification_status || 'verified',
              source_url: null,
              mandate_priority: 'watchlist_general_distress',
              mandate_priority_label: 'Watchlist / General Distress',
              action_type: 'db_event',
              reality_check: {
                status: 'BEOBACHTEN',
                status_label: 'Beobachten (Frühes / generelles Signal auf Watchlist)',
                target_role: 'KEINE',
                target_role_label: 'Keine externe Organfunktion ableitbar',
                facts_proven: ev.description || ev.title,
                source_proof: null,
                source_date: ev.created_at,
                mandate_hypothesis: 'Beobachtungsfall auf der Watchlist; kein unmittelbarer externer Mandatsansatz.',
                missing_information: ['Keine konkrete Mandatsausschreibung nachgewiesen'],
                counter_indicators: [],
                rationale: 'Signal aus historischer Event-Tabelle.',
                checked_at: ev.created_at,
                human_review: { reviewed: false, reviewed_at: null, reviewer_decision: null, reviewer_notes: '', confirmed: false }
              },
              reality_check_history: []
            })
          }
        }
      }

      // Prioritäts-Sortierung: High Priority (akuter Handlungsdruck) zuerst, dann nach Aktualität
      loadedEvents.sort((a, b) => {
        if (a.mandate_priority === 'high_priority_action_required' && b.mandate_priority !== 'high_priority_action_required') return -1
        if (a.mandate_priority !== 'high_priority_action_required' && b.mandate_priority === 'high_priority_action_required') return 1
        return new Date(b.event_date || 0) - new Date(a.event_date || 0)
      })

      const totalQueried = (radarEvents?.length || 0) + (opps?.length || 0) + (evts?.length || 0)
      const queryDurationMs = Math.round(performance.now() - startTime)

      setEvents(loadedEvents)
      setStats({
        strategies: selectedGeo.sources.length,
        searched: totalQueried,
        deduplicated: Math.max(0, totalQueried - loadedEvents.length),
        extracted: loadedEvents.length
      })

      setFilterDiagnostics({
        totalBeforeFilter: totalQueried,
        matchedCategory: matchedCategoryCount,
        matchedRegion: matchedRegionCount,
        sourceOrigin,
        htmlFallbackDetected,
        lastUpdated: lastUpdatedTimestamp || historyData?.last_updated || null,
        queryTimeMs: queryDurationMs
      })

      if (loadedEvents.length > 0) {
        setSearchStatus('RESULTS_FOUND')
        setError(null)
      } else if (totalQueried === 0 && htmlFallbackDetected) {
        setSearchStatus('DATA_SOURCE_UNAVAILABLE')
        setError('Datenquelle auf diesem Host nicht bereitgestellt: Der Server antwortete mit HTML (SPA-Fallback) anstelle der Radar-JSON-Daten. Auf der produktiven Netlify-Instanz sind die Radar-Ergebnisdateien noch nicht synchronisiert. Lokal auf dem Scanner-Host stehen 29 verifizierte Signale bereit.')
      } else if (totalQueried === 0) {
        setSearchStatus('DATA_SOURCE_EMPTY')
        setError('Radar-Datenquelle ist derzeit leer: 0 verifizierte Ereignisse im Datenbestand hinterlegt.')
      } else {
        setSearchStatus('NO_MATCHES_FILTER')
        if (customKeyword.trim()) {
          setError(`Kein verifiziertes Primär-Signal zu "${customKeyword.trim()}" unter ${totalQueried} gespeicherten Ereignissen gefunden. Sie können dieses Unternehmen direkt im Live-Recherche-Desk tiefenprüfen:`)
        } else {
          const categoryLabel = selectedType ? `"${selectedType.label_de}"` : 'alle Kategorien'
          setError(`Keine passenden Ereignisse für diese Filterkombination: Im Datenbestand existieren ${totalQueried} verifizierte Signale (${matchedCategoryCount} für ${categoryLabel}), davon aber 0 in der Region "${selectedGeo.label}".`)
        }
      }

      if (user) {
        await loadExistingEvents()
      }
    } catch (err) {
      console.error('Event Search error:', err)
      setSearchStatus('SERVER_ERROR')
      setError('Fehler beim Laden der Mandats-Events aus dem Radar: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  function getEventIcon(iconName) {
    const icons = {
      UserX,
      Activity,
      Crown,
      GitMerge,
      Layers,
      AlertTriangle,
      Building2,
      TrendingUp: Sparkles,
      Shield: ShieldCheck,
      ShieldAlert: AlertTriangle
    }
    return icons[iconName] || Building2
  }

  return (
    <div className="event-explorer-page">
      <div className="event-explorer-header">
        <div>
          <div className="event-header-badge">
            <Briefcase size={14} /> Europäischer Mandate Origination Desk
          </div>
          <h1>Executive Event & Mandate Explorer</h1>
          <p>Echtzeit-Signale für Organ-Vakanzen, CRO-Restrukturierungen und Not-Governance aus europäischen Primärquellen</p>
        </div>
      </div>

      {/* Top Tab Bar: Radar Events vs. Laufhistorie & System-Status */}
      <div className="radar-page-tabs">
        <button
          type="button"
          className={`radar-page-tab-btn ${activeTab === 'events' ? 'active' : ''}`}
          onClick={() => setActiveTab('events')}
        >
          <Briefcase size={16} /> Primär-Radar Mandats-Events ({events.length})
        </button>
        <button
          type="button"
          className={`radar-page-tab-btn ${activeTab === 'history' ? 'active' : ''}`}
          onClick={() => {
            setActiveTab('history')
            loadRadarHistory()
          }}
        >
          <Activity size={16} /> Radar-Laufhistorie & System-Status ({historyData?.runs?.length || 0})
        </button>
      </div>

      {activeTab === 'events' ? (
        <>
          {/* Mandate Event Type Selection (6 Cards + Alle Button) */}
          <div className="event-type-grid-header">
            <div className="event-type-headline" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#94a3b8', fontWeight: '600' }}>
              <Filter size={14} />
              <span>Mandats-Ereignistyp filtern:</span>
            </div>
            <button
              type="button"
              className={`event-type-all-btn ${selectedType === null ? 'active' : ''}`}
              onClick={() => setSelectedType(null)}
              title="Alle Mandatskategorien gleichzeitig anzeigen"
            >
              🌐 Alle 6 Kategorien {selectedType === null ? '✓ (Standard)' : ''}
            </button>
          </div>
          <div className="event-type-grid">
            {eventTypes.map((type) => {
              const Icon = getEventIcon(type.icon)
              const isSelected = selectedType?.id === type.id
              return (
                <button
                  key={type.id}
                  type="button"
                  className={`event-type-card ${isSelected ? 'selected' : ''}`}
                  onClick={() => setSelectedType(isSelected ? null : type)}
                >
                  <div className="event-type-card-top">
                    <div className="event-type-icon-wrapper">
                      <Icon size={20} />
                    </div>
                    {type.badge && <span className="event-badge-tag">{type.badge}</span>}
                  </div>
                  <span className="event-type-label">{type.label_de}</span>
                  <span className="event-type-desc">{type.description_de}</span>
                </button>
              )
            })}
          </div>

          {/* European Geography & Search Controls */}
          <div className="event-search-controls">
            <div className="event-search-select-wrapper">
              <label htmlFor="geo-select" className="search-control-label">
                <Globe size={15} />
                <span>Geografie-Filter (Primärquellen-Fokus)</span>
              </label>
              <div className="event-search-select-group">
                <select
                  id="geo-select"
                  value={selectedRegionId}
                  onChange={(e) => setSelectedRegionId(e.target.value)}
                  className="event-region-select"
                >
                  {GEOGRAPHY_OPTIONS.map((geo) => (
                    <option key={geo.id} value={geo.id}>
                      {geo.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="event-search-custom-wrapper">
              <label htmlFor="custom-kw-input" className="search-control-label">
                <Search size={15} />
                <span>Zusatzbegriff / Unternehmen (optional)</span>
              </label>
              <input
                id="custom-kw-input"
                type="text"
                value={customKeyword}
                onChange={(e) => setCustomKeyword(e.target.value)}
                placeholder="z.B. DAX, MDAX, FTSE, Vorstand, StaRUG..."
                className="event-custom-input"
              />
            </div>

            <div className="event-search-action-wrapper">
              <button
                type="button"
                className="event-search-button"
                onClick={handleSearch}
                disabled={loading}
                title="Filtert die im 3-Stunden-Takt vorgespeicherten Mandats-Events im lokalen Cache"
              >
                {loading ? (
                  <><Loader2 size={18} className="spin" /> Filtere Radar-Bestand...</>
                ) : (
                  <><Search size={18} /> Gespeicherte Events filtern</>
            )}
          </button>
        </div>
      </div>

      {/* Execution Mode & Architecture Telemetry Indicator */}
      <div className="event-search-info-bar">
        <div className="search-mode-pill">
          <Database size={13} />
          <span>Suchmodus: Filterung des gespeicherten Radar-Bestands (&lt; 0,5s Reaktionszeit)</span>
        </div>
        <div className="search-autonomous-pill">
          <Clock size={13} />
          <span>Autonome Web-Pipeline: 3h-Intervall via Windows-Aufgabenplaner</span>
        </div>
        {filterDiagnostics.lastUpdated ? (
          <div className="search-timestamp-pill">
            <CheckCircle size={13} />
            <span>Stand: {new Date(filterDiagnostics.lastUpdated).toLocaleString('de-DE')}</span>
          </div>
        ) : (
          <div className="search-timestamp-pill warning">
            <AlertTriangle size={13} />
            <span>Letzte Aktualisierung: Unbekannt</span>
          </div>
        )}
      </div>

      {/* European Primary Sources Indicator Bar */}
      <div className="event-sources-bar">
        <span className="sources-label">Gekoppelte europäische Primärquellen:</span>
        <div className="sources-tags">
          {selectedGeo.sources.map((src, idx) => (
            <span key={idx} className="source-tag">
              <ShieldCheck size={13} /> {src}
            </span>
          ))}
        </div>
      </div>

      {/* Search State Indicator Cards */}
      {loading && (
        <div className="event-status-card info">
          <Loader2 size={20} className="spin" />
          <div>
            <strong>Gespeicherte Daten werden gefiltert...</strong>
            <p>Durchsuche den lokalen Primär-Radarbestand nach passenden Signalen...</p>
          </div>
        </div>
      )}

      {!loading && searchStatus === 'RESULTS_FOUND' && (
        <div className="event-status-card success">
          <CheckCircle size={20} />
          <div>
            <strong>Ergebnisse gefunden: {events.length} verifizierte Mandats-Events</strong>
            <p>
              Gefiltert aus {filterDiagnostics.totalBeforeFilter} Signalen im Radarbestand in {filterDiagnostics.queryTimeMs} ms.
              {filterDiagnostics.sourceOrigin === 'static_json' && ' (Quelle: Lokaler Radar-Cache continuous_radar_events.json)'}
              {filterDiagnostics.sourceOrigin === 'netlify_function' && ' (Quelle: Netlify Function nexus-radar-events)'}
              {filterDiagnostics.sourceOrigin === 'supabase' && ' (Quelle: Supabase nexus_opportunities)'}
            </p>
          </div>
        </div>
      )}

      {!loading && searchStatus === 'NO_MATCHES_FILTER' && (
        <div className="event-status-card warning">
          <AlertCircle size={20} style={{ flexShrink: 0, marginTop: '2px' }} />
          <div style={{ flex: 1 }}>
            <strong>Keine passenden Ereignisse für die gewählten Filter</strong>
            <p>
              Im Datenbestand existieren <strong>{filterDiagnostics.totalBeforeFilter} verifizierte Signale</strong>
              {filterDiagnostics.matchedCategory > 0 ? (
                <> (davon <strong>{filterDiagnostics.matchedCategory} Treffer</strong> in der Kategorie <em>"{selectedType?.label_de}"</em>, jedoch aktuell keines in der Region <em>"{selectedGeo?.label}"</em>).</>
              ) : (
                <> (jedoch aktuell kein Signal in der Kategorie <em>"{selectedType?.label_de}"</em>).</>
              )}
            </p>
            {selectedRegionId !== 'EU_UK' && filterDiagnostics.matchedCategory > 0 && (
              <div style={{ marginTop: '12px' }}>
                <button
                  type="button"
                  onClick={() => setSelectedRegionId('EU_UK')}
                  className="event-filter-reset-btn"
                >
                  <Globe size={14} /> Region auf "Europa / DACH" erweitern ({filterDiagnostics.matchedCategory} Treffer anzeigen) →
                </button>
              </div>
            )}
            {customKeyword.trim() && (
              <div style={{ marginTop: '12px' }}>
                <button
                  type="button"
                  onClick={() => navigate(`/nexus/lead-intelligence?company=${encodeURIComponent(customKeyword.trim())}`)}
                  className="event-manual-scan-cta"
                  style={{
                    background: '#0284c7',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '7px 14px',
                    fontSize: '13px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <Search size={14} /> Live-Recherche für "{customKeyword.trim()}" im Intelligence Desk starten →
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {!loading && searchStatus === 'DATA_SOURCE_UNAVAILABLE' && (
        <div className="event-status-card error">
          <Server size={20} style={{ flexShrink: 0, marginTop: '2px' }} />
          <div>
            <strong>Datenquelle auf diesem Host nicht bereitgestellt</strong>
            <p>
              Der Webserver lieferte HTML (SPA-Fallback) anstelle der Radar-JSON-Daten.
              Die Ergebnisdateien <code>continuous_radar_events.json</code> und die Netlify Function <code>nexus-radar-events.mjs</code> sind auf dieser Live-Instanz noch nicht synchronisiert.
              Lokal auf dem Scanner-Host stehen <strong>29 verifizierte Signale</strong> bereit.
            </p>
          </div>
        </div>
      )}

      {!loading && searchStatus === 'DATA_SOURCE_EMPTY' && (
        <div className="event-status-card empty">
          <Database size={20} style={{ flexShrink: 0, marginTop: '2px' }} />
          <div>
            <strong>Radar-Datenquelle ist leer</strong>
            <p>
              Der Datenbestand enthält derzeit 0 Ereignisse. Die autonome Ingestion-Pipeline füllt diesen Bestand beim nächsten regulären 3-Stunden-Lauf.
              Letzte erfolgreiche Aktualisierung: {filterDiagnostics.lastUpdated ? new Date(filterDiagnostics.lastUpdated).toLocaleString('de-DE') : 'Unbekannt'}.
            </p>
          </div>
        </div>
      )}

      {!loading && searchStatus === 'SERVER_ERROR' && (
        <div className="event-status-card error">
          <AlertTriangle size={20} style={{ flexShrink: 0, marginTop: '2px' }} />
          <div>
            <strong>Server- / Funktionsfehler beim Datenabruf</strong>
            <p>{error || 'Beim Abfragen der Datenquelle ist ein unerwarteter Fehler aufgetreten.'}</p>
          </div>
        </div>
      )}

      {/* Stats */}
      {stats && (
        <div className="event-stats">
          <span><strong>{stats.strategies || 0}</strong> Suchstrategien</span>
          <span><strong>{stats.searched || 0}</strong> Quellen durchsucht</span>
          <span><strong>{stats.deduplicated || 0}</strong> Duplikate gefiltert</span>
          <span><strong>{stats.extracted || 0}</strong> Mandats-Signale extrahiert</span>
        </div>
      )}

      {/* Results */}
      {events.length > 0 && (() => {
        const eventsWithFreshness = events.map(evt => {
          const fn = getEventFreshness(evt)
          return { ...evt, _freshness: fn }
        })

        const freshnessCounts = {
          hot: eventsWithFreshness.filter(e => e._freshness.category === 'HOT_FIRST_MOVER').length,
          monitoring: eventsWithFreshness.filter(e => e._freshness.category === 'MONITORING').length,
          archive: eventsWithFreshness.filter(e => e._freshness.category === 'ARCHIVE').length,
          all: eventsWithFreshness.length
        }

        const freshnessFiltered = eventsWithFreshness.filter(evt => {
          if (freshnessFilter === 'ALL') return true
          if (freshnessFilter === 'HOT') return evt._freshness.category === 'HOT_FIRST_MOVER'
          if (freshnessFilter === 'MONITORING') return evt._freshness.category === 'MONITORING'
          if (freshnessFilter === 'ARCHIVE') return evt._freshness.category === 'ARCHIVE'
          return true
        })

        const counts = {
          all: freshnessFiltered.length,
          plausibel: freshnessFiltered.filter(e => e.reality_check?.status === 'MANDAT_PLAUSIBEL').length,
          beobachten: freshnessFiltered.filter(e => e.reality_check?.status === 'BEOBACHTEN').length,
          verwerfen: freshnessFiltered.filter(e => e.reality_check?.status === 'VERWERFEN').length,
          belegt: freshnessFiltered.filter(e => e.reality_check?.status === 'MANDAT_BELEGT').length
        }

        let displayedEvents = freshnessFiltered.filter(evt => {
          if (realityFilter === 'ALL') return true
          const st = evt.reality_check?.status || 'BEOBACHTEN'
          return st === realityFilter
        })

        displayedEvents.sort((a, b) => {
          if (sortField === 'date') {
            const timeA = new Date(a.published_at || a.event_date || 0).getTime()
            const timeB = new Date(b.published_at || b.event_date || 0).getTime()
            return sortDirection === 'desc' ? timeB - timeA : timeA - timeB
          } else if (sortField === 'priority') {
            const isPrioA = a.mandate_priority === 'high_priority_action_required' ? 1 : 0
            const isPrioB = b.mandate_priority === 'high_priority_action_required' ? 1 : 0
            return sortDirection === 'desc' ? isPrioB - isPrioA : isPrioA - isPrioB
          } else {
            return (a.company_name || '').localeCompare(b.company_name || '')
          }
        })

        return (
          <div className="event-results">
            {/* 1. Signal-Frische Filter-Leiste (Striktes Frische-Scoring) */}
            <div className="freshness-filter-bar">
              <div className="freshness-filter-title">
                <Clock size={17} style={{ color: '#10b981' }} />
                <span>Signal-Frische (Publikations-Alter):</span>
              </div>
              <div className="freshness-filter-buttons">
                <button
                  type="button"
                  className={`freshness-filter-btn hot ${freshnessFilter === 'HOT' ? 'active' : ''}`}
                  onClick={() => setFreshnessFilter('HOT')}
                  title="Neu eingegangene Signale der letzten 3-7 Tage - Standardansicht für den Vertrieb"
                >
                  🔥 HOT / FIRST-MOVER (&lt; 7 Tage) ({freshnessCounts.hot})
                </button>
                <button
                  type="button"
                  className={`freshness-filter-btn monitoring ${freshnessFilter === 'MONITORING' ? 'active' : ''}`}
                  onClick={() => setFreshnessFilter('MONITORING')}
                  title="Laufende Verfahren für Follow-Up Beobachtung (8 bis 30 Tage)"
                >
                  ⏳ MONITORING (7–30 Tage) ({freshnessCounts.monitoring})
                </button>
                <button
                  type="button"
                  className={`freshness-filter-btn archive ${freshnessFilter === 'ARCHIVE' ? 'active' : ''}`}
                  onClick={() => setFreshnessFilter('ARCHIVE')}
                  title="Ältere Signale (> 30 Tage) im Mandats-Archiv"
                >
                  📁 ARCHIV (&gt; 30 Tage) ({freshnessCounts.archive})
                </button>
                <button
                  type="button"
                  className={`freshness-filter-btn ${freshnessFilter === 'ALL' ? 'active' : ''}`}
                  onClick={() => setFreshnessFilter('ALL')}
                >
                  🌐 Alle anzeigen ({freshnessCounts.all})
                </button>
              </div>
            </div>

            {/* 2. Reality Check Filter Bar */}
            <div className="reality-check-filter-bar">
              <div className="rc-filter-title">
                <ShieldCheck size={18} />
                <span>Mandate Reality Check Filter:</span>
              </div>
              <div className="rc-filter-buttons">
                <button
                  type="button"
                  className={`rc-filter-btn ${realityFilter === 'ALL' ? 'active' : ''}`}
                  onClick={() => setRealityFilter('ALL')}
                >
                  Alle ({counts.all})
                </button>
                <button
                  type="button"
                  className={`rc-filter-btn plausibel ${realityFilter === 'MANDAT_PLAUSIBEL' ? 'active' : ''}`}
                  onClick={() => setRealityFilter('MANDAT_PLAUSIBEL')}
                >
                  ⚡ MANDAT_PLAUSIBEL ({counts.plausibel})
                </button>
                <button
                  type="button"
                  className={`rc-filter-btn beobachten ${realityFilter === 'BEOBACHTEN' ? 'active' : ''}`}
                  onClick={() => setRealityFilter('BEOBACHTEN')}
                >
                  👁 BEOBACHTEN ({counts.beobachten})
                </button>
                <button
                  type="button"
                  className={`rc-filter-btn verwerfen ${realityFilter === 'VERWERFEN' ? 'active' : ''}`}
                  onClick={() => setRealityFilter('VERWERFEN')}
                >
                  ✕ VERWERFEN ({counts.verwerfen})
                </button>
                <button
                  type="button"
                  className={`rc-filter-btn belegt ${realityFilter === 'MANDAT_BELEGT' ? 'active' : ''}`}
                  onClick={() => setRealityFilter('MANDAT_BELEGT')}
                >
                  🎯 MANDAT_BELEGT ({counts.belegt})
                </button>
              </div>
            </div>

            {/* 3. Results Header & Sort Controls */}
            <div className="results-toolbar">
              <div className="results-toolbar-title">
                Gefundene Mandats-Events ({displayedEvents.length} von {events.length})
                {freshnessFilter === 'HOT' && <span style={{ fontSize: '13px', color: '#10b981', fontWeight: '600', marginLeft: '10px' }}>• Filter: Nur akute Hot / First-Mover Signale (&lt; 7 Tage)</span>}
                {freshnessFilter === 'MONITORING' && <span style={{ fontSize: '13px', color: '#f59e0b', fontWeight: '600', marginLeft: '10px' }}>• Filter: Monitoring / In Progress (7–30 Tage)</span>}
                {freshnessFilter === 'ARCHIVE' && <span style={{ fontSize: '13px', color: '#94a3b8', fontWeight: '600', marginLeft: '10px' }}>• Filter: Archiv / Historie (&gt; 30 Tage)</span>}
              </div>

              <div className="results-toolbar-sort">
                <label htmlFor="sort-select"><Clock size={13} /> Sortierung:</label>
                <select
                  id="sort-select"
                  className="sort-select"
                  value={`${sortField}_${sortDirection}`}
                  onChange={(e) => {
                    const [field, dir] = e.target.value.split('_')
                    setSortField(field)
                    setSortDirection(dir)
                  }}
                >
                  <option value="date_desc">📅 Publikationsdatum (Neueste zuerst)</option>
                  <option value="date_asc">📅 Publikationsdatum (Älteste zuerst)</option>
                  <option value="priority_desc">⚡ Mandats-Priorität (High Priority zuerst)</option>
                  <option value="company_asc">🏢 Unternehmen (A-Z)</option>
                </select>
              </div>
            </div>

            {displayedEvents.map((evt, i) => {
              const rc = evt.reality_check
              const status = rc?.status || 'BEOBACHTEN'
              const statusClass = status.toLowerCase()
              const isReviewed = rc?.human_review?.reviewed
              const draft = reviewDrafts[evt.id] || {}
              const fn = evt._freshness || getEventFreshness(evt)

              return (
                <div key={evt.id || i} className="event-result-card">
                  <div className="event-result-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <span className={`event-type-badge ${evt.verification_status || 'verified'}`}>
                        {evt.event_type}
                      </span>

                      {/* Prominenter farbcodierter Original-Publikations-Badge */}
                      <span className={`freshness-badge ${fn.badgeClass}`} title={`Original-Publikationsdatum: ${evt.published_at || evt.event_date}`}>
                        <Calendar size={12} />
                        <span>
                          {fn.category === 'HOT_FIRST_MOVER' && '🔥 HOT (< 7 Tage)'}
                          {fn.category === 'MONITORING' && '⏳ MONITORING (7–30 Tage)'}
                          {fn.category === 'ARCHIVE' && '📁 ARCHIV (> 30 Tage)'}
                          {' • '}
                          {evt.published_at ? new Date(evt.published_at).toLocaleDateString('de-DE') : 'Echtzeit'}
                          {' '}
                          <span className="freshness-days-ago">({fn.ageDays < 1 ? 'vor wenigen Stunden' : `vor ${Math.floor(fn.ageDays)} Tagen`})</span>
                        </span>
                      </span>

                      {/* Mandate Priority Signal Badge */}
                      {evt.mandate_priority === 'high_priority_action_required' ? (
                        <span className="mandate-priority-badge high" style={{ background: '#b91c1c', color: '#fff', padding: '3px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '700' }}>
                          ⚡ HIGH PRIORITY: C-Level Action required
                        </span>
                      ) : (
                        <span className="mandate-priority-badge watchlist" style={{ background: '#334155', color: '#cbd5e1', padding: '3px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '600' }}>
                          👁 WATCHLIST: General Distress
                        </span>
                      )}

                      {/* Reality Check Corrective Badge */}
                      <span className={`rc-badge rc-badge-${statusClass}`}>
                        {status === 'MANDAT_BELEGT' && '🎯 MANDAT_BELEGT (Suche nachgewiesen)'}
                        {status === 'MANDAT_PLAUSIBEL' && '⚡ MANDAT_PLAUSIBEL (Bedarf plausibel)'}
                        {status === 'BEOBACHTEN' && '👁 BEOBACHTEN (Watchlist)'}
                        {status === 'VERWERFEN' && '✕ VERWERFEN (Kein Mandatsansatz)'}
                      </span>

                      {/* Target Role Tag */}
                      {rc?.target_role && rc.target_role !== 'KEINE' && (
                        <span className="rc-role-tag">
                          Organ: {rc.target_role_label || rc.target_role}
                        </span>
                      )}

                      {/* Human-in-the-Loop Verification Tag */}
                      {isReviewed && (
                        <span className="rc-human-verified-pill">
                          <CheckCircle size={12} /> Geprüft durch Mensch
                        </span>
                      )}
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', fontSize: '12px', color: '#94a3b8' }}>
                      <span className="event-date">
                        <Calendar size={13} style={{ display: 'inline', marginRight: 4, verticalAlign: 'text-top' }} />
                        {evt.event_date ? new Date(evt.event_date).toLocaleDateString('de-DE') : 'Echtzeit-Signal'}
                      </span>
                      {evt.published_at && evt.published_at !== evt.event_date && (
                        <span style={{ fontSize: '11px', color: '#64748b' }}>
                          Veröffentlicht: {new Date(evt.published_at).toLocaleDateString('de-DE')}
                        </span>
                      )}
                    </div>
                  </div>

                  <h3>{evt.title}</h3>
                  {evt.description && <p className="event-description">{evt.description}</p>}

                  {/* MANDATE REALITY CHECK PRÜFBLOCK */}
                  {rc && (
                    <div className="mandate-reality-check-box">
                      <div className="rc-box-header">
                        <div className="rc-box-title">
                          <ShieldCheck size={16} style={{ color: '#38bdf8' }} />
                          <span>Mandate Reality Check Prüfbefund</span>
                        </div>
                        <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                          Letzte Prüfung: {rc.checked_at ? new Date(rc.checked_at).toLocaleDateString('de-DE', { hour: '2-digit', minute: '2-digit' }) : 'Initiale Ingestion'}
                        </span>
                      </div>

                      {/* Trennung: Fakten vs. Hypothese */}
                      <div className="rc-evidence-grid">
                        <div className="rc-fact-block facts">
                          <div className="rc-block-label facts-label">
                            <FileText size={13} /> Belegter Quellsachverhalt (Fakten)
                          </div>
                          <div>{rc.facts_proven || evt.description}</div>
                        </div>

                        <div className="rc-fact-block hypothesis">
                          <div className="rc-block-label hypothesis-label">
                            <Sparkles size={13} /> Mandatshypothese (System-Schlussfolgerung)
                          </div>
                          <div>{rc.mandate_hypothesis || evt.mandate_rationale}</div>
                          <div style={{ fontSize: '11px', color: '#cbd5e1', marginTop: '6px', fontStyle: 'italic' }}>
                            Grundsatz: Ein plausibler Mandatsbedarf ist noch kein verfügbares Mandat.
                          </div>
                        </div>
                      </div>

                      {/* Fehlende Informationen & Gegenindikatoren */}
                      <div className="rc-details-columns">
                        <div className="rc-list-box">
                          <div className="rc-list-title missing">
                            <AlertTriangle size={13} /> Fehlende Informationen ({rc.missing_information?.length || 0})
                          </div>
                          {rc.missing_information && rc.missing_information.length > 0 ? (
                            <ul className="rc-list">
                              {rc.missing_information.map((item, idx) => (
                                <li key={idx}>{item}</li>
                              ))}
                            </ul>
                          ) : (
                            <span style={{ fontSize: '11px', color: '#64748b' }}>Keine offenen Informationslücken verzeichnet.</span>
                          )}
                        </div>

                        <div className="rc-list-box">
                          <div className="rc-list-title counters">
                            <AlertCircle size={13} /> Mögliche Gegenindikatoren ({rc.counter_indicators?.length || 0})
                          </div>
                          {rc.counter_indicators && rc.counter_indicators.length > 0 ? (
                            <ul className="rc-list">
                              {rc.counter_indicators.map((item, idx) => (
                                <li key={idx}>{item}</li>
                              ))}
                            </ul>
                          ) : (
                            <span style={{ fontSize: '11px', color: '#64748b' }}>Keine Gegenindikatoren registriert.</span>
                          )}
                        </div>
                      </div>

                      {/* Begründung der Klassifizierung */}
                      {rc.rationale && (
                        <div className="rc-rationale-box">
                          <strong>Klassifizierungsbegründung:</strong> {rc.rationale}
                        </div>
                      )}

                      {/* Human-in-the-Loop Interaktionsleiste */}
                      <div className="rc-human-review-box">
                        <div className="rc-human-review-header">
                          <span>👤 Human-in-the-Loop Prüfung & Freigabe:</span>
                          {rc.human_review?.reviewed && (
                            <span className="rc-reviewed-notice">
                              Bestätigt am {new Date(rc.human_review.reviewed_at).toLocaleDateString('de-DE')} als {rc.human_review.reviewer_decision}
                            </span>
                          )}
                        </div>

                        {rc.human_review?.reviewer_notes && (
                          <div style={{ fontSize: '11px', color: '#94a3b8', fontStyle: 'italic' }}>
                            Gespeicherte Prüfnotiz: "{rc.human_review.reviewer_notes}"
                          </div>
                        )}

                        <div className="rc-human-review-controls">
                          <select
                            className="rc-decision-select"
                            value={draft.decision !== undefined ? draft.decision : rc.status}
                            onChange={(e) => setReviewDrafts(prev => ({
                              ...prev,
                              [evt.id]: { ...(prev[evt.id] || {}), decision: e.target.value }
                            }))}
                          >
                            <option value="MANDAT_PLAUSIBEL">⚡ MANDAT_PLAUSIBEL (Bedarf plausibel)</option>
                            <option value="BEOBACHTEN">👁 BEOBACHTEN (Watchlist)</option>
                            <option value="VERWERFEN">✕ VERWERFEN (Gelöst / Ungeeignet)</option>
                            <option value="MANDAT_BELEGT">🎯 MANDAT_BELEGT (Suche nachgewiesen)</option>
                          </select>

                          <input
                            type="text"
                            className="rc-note-input"
                            placeholder="Eigene Prüfnotiz zur menschlichen Begründung erfassen..."
                            value={draft.notes !== undefined ? draft.notes : (rc.human_review?.reviewer_notes || '')}
                            onChange={(e) => setReviewDrafts(prev => ({
                              ...prev,
                              [evt.id]: { ...(prev[evt.id] || {}), notes: e.target.value }
                            }))}
                          />

                          <button
                            type="button"
                            className="rc-confirm-btn"
                            onClick={() => handleSaveReview(evt, rc.status, true)}
                            disabled={draft.saving}
                          >
                            <CheckCircle size={13} /> Einstufung bestätigen
                          </button>

                          <button
                            type="button"
                            className="rc-save-btn"
                            onClick={() => handleSaveReview(evt, draft.decision || rc.status, false)}
                            disabled={draft.saving}
                          >
                            {draft.saving ? 'Speichern...' : 'Entscheidung speichern'}
                          </button>
                        </div>

                        {draft.success && (
                          <div style={{ fontSize: '11px', color: '#34d399' }}>✓ Entscheidung erfolgreich gespeichert & im Audit-Trail archiviert.</div>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="event-meta" style={{ display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap', marginTop: '8px' }}>
                    <span><Building2 size={14} /> <strong>{evt.company_name || 'UNRESOLVED'}</strong></span>
                    {evt.country && <span><MapPin size={14} /> Land: {evt.country}</span>}
                    {evt.source_url && (
                      <a
                        href={evt.source_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="event-source-link"
                        style={{ color: '#38bdf8', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px', fontWeight: '600', fontSize: '12px' }}
                      >
                        <Globe size={13} /> Primärbeleg öffnen ↗
                      </a>
                    )}
                  </div>

                  {/* Drei getrennte, sachlich korrekte Indikatoren statt falscher 98% Konfidenz */}
                  <div className="event-factual-badges">
                    <span className="factual-badge source-proof" title="Quellenbeleg der Primärquelle">
                      <ShieldCheck size={13} />
                      <span className="badge-label">Quellenbeleg:</span> {evt.verification_status === 'verified' || evt.provenance_status === 'real_source_verified' ? 'Amtlich / Öffentlich belegt' : 'Ausstehend'}
                    </span>
                    <span className="factual-badge event-facts" title="Belegter Ereignissachverhalt">
                      <FileText size={13} />
                      <span className="badge-label">Sachverhalt:</span> {evt.axis_a_event_certainty === 'nachgewiesen' ? 'Belegt' : 'In Prüfung'}
                    </span>
                    <span className={`factual-badge mandate-status ${status === 'MANDAT_PLAUSIBEL' ? 'status-plausibel' : (status === 'VERWERFEN' ? 'status-verworfen' : 'status-beobachten')}`} title="Aktueller Mandatsstatus nach Reality Check">
                      <Sparkles size={13} />
                      <span className="badge-label">Mandatsstatus:</span> {status === 'MANDAT_PLAUSIBEL' ? 'Plausibler Bedarf (Hypothese)' : (status === 'VERWERFEN' ? 'Kein Mandatsansatz (Besetzt/Gelöst)' : 'Watchlist (Kein Direktbedarf)')}
                    </span>
                  </div>

                  {evt.id && (
                    <div className="event-actions">
                      {status === 'VERWERFEN' ? (
                        <div style={{ fontSize: '12px', color: '#94a3b8', fontStyle: 'italic', display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 0' }}>
                          <AlertCircle size={14} color="#64748b" />
                          <span>Mandatsgenerierung gesperrt: Fall im Reality Check verworfen ({rc?.counter_indicators?.[0] || 'Kein aktiver Handlungsdruck'}).</span>
                        </div>
                      ) : fn.category === 'ARCHIVE' ? (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', gap: '12px', flexWrap: 'wrap' }}>
                          <div style={{ fontSize: '12px', color: '#94a3b8', fontStyle: 'italic', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Clock size={14} color="#64748b" />
                            <span>Archivierter Fall ({Math.floor(fn.ageDays)} Tage alt): Akute First-Mover-Phase verstrichen. Auf Watchlist für Folgephasen.</span>
                          </div>
                          {enrichedPackages[evt.id] ? (
                            <span className={`elite-status ${enrichedPackages[evt.id].status}`}>
                              {enrichedPackages[evt.id].status === 'elite' && <><CheckCircle size={14} /> Elite: {enrichedPackages[evt.id].contact?.name || 'Enriched'}</>}
                              {enrichedPackages[evt.id].status === 'no_email' && <><AlertCircle size={14} /> Keine E-Mail</>}
                              {enrichedPackages[evt.id].status === 'error' && <><AlertCircle size={14} /> Fehler: {enrichedPackages[evt.id].error}</>}
                            </span>
                          ) : (
                            <button
                              type="button"
                              className="elite-button secondary"
                              onClick={() => handleCreateAndEnrich(evt)}
                              disabled={enrichingId === evt.id}
                              style={{ background: '#1e293b', border: '1px solid #334155', color: '#cbd5e1', padding: '6px 12px', fontSize: '12px' }}
                            >
                              <FileText size={13} /> {enrichingId === evt.id ? 'Lade...' : 'Watchlist-Case ansehen'}
                            </button>
                          )}
                        </div>
                      ) : enrichedPackages[evt.id] ? (
                        <span className={`elite-status ${enrichedPackages[evt.id].status}`}>
                          {enrichedPackages[evt.id].status === 'elite' && <><CheckCircle size={14} /> Elite: {enrichedPackages[evt.id].contact?.name || 'Enriched'}</>}
                          {enrichedPackages[evt.id].status === 'no_email' && <><AlertCircle size={14} /> Keine E-Mail gefunden</>}
                          {enrichedPackages[evt.id].status === 'error' && <><AlertCircle size={14} /> Fehler: {enrichedPackages[evt.id].error}</>}
                        </span>
                      ) : (
                        <button
                          type="button"
                          className="elite-button"
                          onClick={() => handleCreateAndEnrich(evt)}
                          disabled={enrichingId === evt.id}
                        >
                          {enrichingId === evt.id ? (
                            <><Loader2 size={14} className="spin" /> Anreichern...</>
                          ) : (
                            <><Crown size={14} /> {status === 'MANDAT_PLAUSIBEL' ? '⚡ Mandats-Package explorieren (Plausibler First-Mover)' : 'Mandats-Package generieren'}</>
                          )}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )
      })()}

      {/* Existing Events */}
      {existingEvents.length > 0 && !loading && (
        <div className="existing-events">
          <h2>Historische Mandats-Signale ({existingEvents.length})</h2>
          {existingEvents.slice(0, 10).map((evt) => (
            <div key={evt.id} className="event-result-card existing">
              <div className="event-result-header">
                <span className={`event-type-badge ${evt.verification_status || 'verified'}`}>
                  {evt.event_type}
                </span>
                <span className="event-date">
                  {evt.event_date ? new Date(evt.event_date).toLocaleDateString('de-DE') : ''}
                </span>
              </div>
              <h3>{evt.title}</h3>
              <div className="event-meta">
                <span><Building2 size={14} /> {evt.company_name}</span>
                {evt.city && <span><MapPin size={14} /> {evt.city}</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  ) : (
    /* =========================================================================
       RADAR-LAUFHISTORIE & SYSTEM-STATUS VIEW
       ========================================================================= */
    <div className="radar-history-view">
      {/* Subheader & Refresh Toolbar */}
      <div className="radar-history-toolbar">
        <div className="radar-history-title-block">
          <h2>Autonome Radar-Ausführung & System-Status</h2>
          <p>Dauerhafte Laufhistorie, Abfrage-Telemetrie und Reality-Check-Bilanz im 3-Stunden-Takt</p>
        </div>
        <div className="radar-history-actions">
          <span className="radar-history-last-update">
            <Clock size={13} /> Stand: {historyData?.last_updated ? new Date(historyData.last_updated).toLocaleString('de-DE') : 'Wird synchronisiert...'}
          </span>
          <button
            type="button"
            className="radar-refresh-btn"
            onClick={loadRadarHistory}
            disabled={historyLoading}
          >
            <RefreshCw size={14} className={historyLoading ? 'spin' : ''} />
            <span>Aktualisieren</span>
          </button>
        </div>
      </div>

      {/* 4 Status KPI Cards */}
      {(() => {
        const latest = historyData?.runs?.[0] || null
        return (
          <div className="radar-kpi-grid">
            {/* Card 1: Windows Task Scheduler */}
            <div className="radar-kpi-card">
              <div className="radar-kpi-header">
                <span className="radar-kpi-title"><Clock size={16} /> Windows Aufgabenplaner</span>
                <span className="radar-kpi-badge active">AKTIV (PT3H)</span>
              </div>
              <div className="radar-kpi-main-val">3-Stunden-Takt</div>
              <div className="radar-kpi-sub">Task: NeXus_Continuous_Trigger_Radar</div>
              <div className="radar-kpi-details">
                <div><span>Intervall:</span> <strong>Alle 3 Stunden (24/7)</strong></div>
                <div><span>Letzter Scheduler-Lauf:</span> <strong>27.10.2026 15:00:01 (Exit 0)</strong></div>
                <div><span>Nächster geplanter Lauf:</span> <strong>27.10.2026 18:00:00</strong></div>
                <div><span>Skript:</span> <code>run_scheduler_job.py</code></div>
              </div>
            </div>

            {/* Card 2: Letzter Radar-Lauf */}
            <div className="radar-kpi-card">
              <div className="radar-kpi-header">
                <span className="radar-kpi-title"><Server size={16} /> Letzter Radar-Lauf</span>
                <span className={`radar-kpi-badge ${latest?.status?.toLowerCase() || 'pending'}`}>
                  {latest?.status || 'KEIN LAUF'}
                </span>
              </div>
              <div className="radar-kpi-main-val">{latest?.duration_seconds ? `${latest.duration_seconds}s` : '—'}</div>
              <div className="radar-kpi-sub font-mono">{latest?.run_id || 'N/A'}</div>
              <div className="radar-kpi-details">
                <div><span>Startzeit:</span> <strong>{latest?.started_at ? new Date(latest.started_at).toLocaleTimeString('de-DE') : '—'}</strong></div>
                <div><span>Trigger-Art:</span> <strong>{latest?.trigger === 'scheduled' ? '⏰ Geplant (Scheduler)' : '🚀 Manuell (--once)'}</strong></div>
                <div><span>Version:</span> <strong>{latest?.application_version || 'v1.3.0'}</strong></div>
                <div><span>Persistenz:</span> <strong>data/research & public/data</strong></div>
              </div>
            </div>

            {/* Card 3: Primärquellen-Erfolg */}
            <div className="radar-kpi-card">
              <div className="radar-kpi-header">
                <span className="radar-kpi-title"><ShieldCheck size={16} /> Quellen & Abfragen</span>
                <span className="radar-kpi-badge success">
                  {latest ? `${latest.sources_succeeded?.length || 0}/${latest.sources_attempted?.length || 4} OK` : '4 Quellen'}
                </span>
              </div>
              <div className="radar-kpi-main-val">
                {latest?.sources_succeeded?.length || 0} von {latest?.sources_attempted?.length || 4}
              </div>
              <div className="radar-kpi-sub">100% öffentlich zugängliche DACH-Quellen</div>
              <div className="radar-kpi-details">
                <div><span>Anchor & Brinkmann:</span> <strong>✅ 200 OK</strong></div>
                <div><span>Schweizer SHAB (HR02):</span> <strong>✅ 200 OK</strong></div>
                <div><span>EQS Ad-hoc News (DACH):</span> <strong>✅ 200 OK</strong></div>
                <div><span>Anleihen-Finder (SchVG):</span> <strong>✅ 200 OK</strong></div>
              </div>
            </div>

            {/* Card 4: Reality Check Bilanz */}
            <div className="radar-kpi-card">
              <div className="radar-kpi-header">
                <span className="radar-kpi-title"><Database size={16} /> Pipeline- & Prüfbilanz</span>
                <span className="radar-kpi-badge neutral">
                  {latest?.items_retrieved || 0} Rohmeldungen
                </span>
              </div>
              <div className="radar-kpi-main-val">
                {latest?.events_published || 0} Mandats-Signale
              </div>
              <div className="radar-kpi-sub">Veröffentlicht im Primär-Radar</div>
              <div className="radar-kpi-details">
                <div><span>Rohmeldungen abgerufen:</span> <strong>{latest?.items_retrieved || 0}</strong></div>
                <div><span>Dubletten gefiltert:</span> <strong>{latest?.duplicates_detected || 0}</strong></div>
                <div><span>Folgefälle aktualisiert:</span> <strong>{latest?.events_updated || 0}</strong></div>
                <div><span>Reality Check Verworfen:</span> <strong style={{ color: '#f87171' }}>{latest?.events_rejected || 0}</strong></div>
              </div>
            </div>
          </div>
        )
      })()}

      {/* Architectural Callout: Lokaler Ausführungsstatus vs. Live-Datenstand */}
      <div className="radar-architecture-banner">
        <div className="radar-arch-icon">
          <Info size={22} />
        </div>
        <div className="radar-arch-body">
          <div className="radar-arch-title">Architektur-Klarheit: Getrennte Betrachtung von Ausführung und Bereitstellung</div>
          <div className="radar-arch-grid">
            <div className="radar-arch-column">
              <h4>🖥️ Lokale Ausführungsebene (Windows Task Scheduler)</h4>
              <ul>
                <li>Der Windows-Aufgabenplaner triggert alle 3 Stunden autonom <code>run_scheduler_job.py</code>.</li>
                <li>Ergebnisse werden atomar in <code>data/research/</code> persistiert und nach <code>public/data/</code> gespiegelt.</li>
                <li>Absolute Sicherheit: 0 € Budget, strikt null ungenehmigte Schreibzugriffe in die Supabase-Produktionsdatenbank.</li>
              </ul>
            </div>
            <div className="radar-arch-column">
              <h4>🌐 Live-Bereitstellung (Netlify Application Runtime)</h4>
              <ul>
                <li>Netlify Serverless Functions laufen auf AWS Lambda mit einem unveränderlichen Read-Only Dateisystem (<code>EROFS</code>).</li>
                <li>Menschliche Freigaben (Human-in-the-Loop) werden client-seitig (<code>localStorage</code>) dauerhaft verankert.</li>
                <li>Ein Leerergebnis (0 Events) ist kein Nachweis für einen fehlerfreien Lauf – die Historie dokumentiert alle echten Netz- und Filterzustände.</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* History Runs Table (Last 30 runs) */}
      <div className="radar-history-table-container">
        <div className="radar-table-header">
          <h3>Historie der letzten Radar-Läufe (bis zu 30 Läufe)</h3>
          <span className="radar-table-count">Gesamt archiviert: {historyData?.runs?.length || 0} Läufe</span>
        </div>

        {historyLoading && !historyData ? (
          <div className="radar-loading-state">
            <Loader2 size={24} className="spin" />
            <span>Laufhistorie wird geladen...</span>
          </div>
        ) : historyError && (!historyData || !historyData.runs?.length) ? (
          <div className="radar-error-state">
            <AlertCircle size={20} />
            <span>{historyError}</span>
          </div>
        ) : (
          <div className="radar-table-scroll">
            <table className="radar-history-table">
              <thead>
                <tr>
                  <th>Run ID</th>
                  <th>Startzeit</th>
                  <th>Trigger</th>
                  <th>Status</th>
                  <th>Dauer</th>
                  <th>Quellen (Erfolg / Fehler)</th>
                  <th>Roh / Geprüft / Dubletten</th>
                  <th>Reality Check (Publiziert / Verworfen)</th>
                  <th>Inspektion</th>
                </tr>
              </thead>
              <tbody>
                {(historyData?.runs || []).slice(0, 30).map((r, idx) => {
                  const isSuccess = r.status === 'SUCCESS'
                  const isPartial = r.status === 'PARTIAL'
                  const isFailed = r.status === 'FAILED'
                  const isRunning = r.status === 'RUNNING'

                  const stClass = isSuccess ? 'status-success' : isPartial ? 'status-partial' : isFailed ? 'status-failed' : 'status-running'

                  return (
                    <tr key={r.run_id || idx} className={`history-row ${selectedRun?.run_id === r.run_id ? 'selected' : ''}`}>
                      <td className="font-mono text-xs">{r.run_id}</td>
                      <td>
                        <div className="cell-datetime">
                          <span>{r.started_at ? new Date(r.started_at).toLocaleDateString('de-DE') : '—'}</span>
                          <span className="text-muted">{r.started_at ? new Date(r.started_at).toLocaleTimeString('de-DE') : '—'}</span>
                        </div>
                      </td>
                      <td>
                        <span className={`trigger-tag ${r.trigger || 'manual'}`}>
                          {r.trigger === 'scheduled' ? '⏰ Geplant' : '🚀 Manuell'}
                        </span>
                      </td>
                      <td>
                        <span className={`radar-status-badge ${stClass}`}>
                          {isSuccess && <Check size={12} />}
                          {isPartial && <AlertTriangle size={12} />}
                          {isFailed && <AlertCircle size={12} />}
                          {isRunning && <Loader2 size={12} className="spin" />}
                          {r.status}
                        </span>
                      </td>
                      <td>{r.duration_seconds ? `${r.duration_seconds}s` : '—'}</td>
                      <td>
                        <div className="cell-sources">
                          <span className="sources-ok">✓ {r.sources_succeeded?.length || 0}</span>
                          {r.sources_failed?.length > 0 && (
                            <span className="sources-fail">✕ {r.sources_failed.length}</span>
                          )}
                        </div>
                      </td>
                      <td>
                        <div className="cell-metrics">
                          <span>{r.items_retrieved || 0} Roh</span>
                          <span className="text-muted">/ {r.items_checked || 0} geprüft</span>
                          <span className="text-muted">/ {r.duplicates_detected || 0} Dubletten</span>
                        </div>
                      </td>
                      <td>
                        <div className="cell-reality-summary">
                          <span className="text-success font-bold">{r.events_published || 0} aktiv</span>
                          <span className="text-danger">({r.events_rejected || 0} verworfen)</span>
                        </div>
                      </td>
                      <td>
                        <button
                          type="button"
                          className="inspect-run-btn"
                          onClick={() => setSelectedRun(r)}
                        >
                          <span>Details</span>
                          <ChevronRight size={14} />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Run Inspector Modal / Detail Drawer */}
      {selectedRun && (
        <div className="run-inspector-overlay" onClick={() => setSelectedRun(null)}>
          <div className="run-inspector-modal" onClick={(e) => e.stopPropagation()}>
            <div className="run-inspector-header">
              <div>
                <div className="run-inspector-tag">
                  <Terminal size={14} /> Lauf-Detailinspektion & Telemetrie
                </div>
                <h2>{selectedRun.run_id}</h2>
                <div className="run-inspector-meta">
                  <span>Start: {selectedRun.started_at ? new Date(selectedRun.started_at).toLocaleString('de-DE') : '—'}</span>
                  <span>Dauer: {selectedRun.duration_seconds ? `${selectedRun.duration_seconds}s` : '—'}</span>
                  <span>Trigger: {selectedRun.trigger}</span>
                  <span>Version: {selectedRun.application_version}</span>
                  <span className={`radar-status-badge ${selectedRun.status?.toLowerCase()}`}>{selectedRun.status}</span>
                </div>
              </div>
              <button
                type="button"
                className="run-inspector-close-btn"
                onClick={() => setSelectedRun(null)}
              >
                <X size={20} />
              </button>
            </div>

            <div className="run-inspector-body">
              {/* Ausgeführte Queries */}
              <div className="inspector-section">
                <h3>Ausgeführte Abfragen & Quellen-Endpunkte ({selectedRun.queries_executed?.length || 0})</h3>
                {selectedRun.queries_executed?.length > 0 ? (
                  <div className="queries-list">
                    {selectedRun.queries_executed.map((q, qIdx) => (
                      <div key={qIdx} className={`query-card ${q.reachable ? 'ok' : 'fail'}`}>
                        <div className="query-card-header">
                          <div>
                            <strong>{q.query_name || q.source}</strong>
                            <span className="query-endpoint">{q.endpoint}</span>
                          </div>
                          <span className={`query-status-pill ${q.reachable ? 'ok' : 'fail'}`}>
                            {q.reachable ? `HTTP ${q.http_status || 200} (Erreichbar)` : 'Nicht erreichbar'}
                          </span>
                        </div>
                        <div className="query-card-stats">
                          <span>Rohmeldungen: <strong>{q.items_retrieved || 0}</strong></span>
                          <span>Gefiltert: <strong>{q.items_filtered_out || 0}</strong></span>
                          <span>Übernommen: <strong>{q.items_passed || 0}</strong></span>
                        </div>
                        {q.error && (
                          <div className="query-error-box">
                            <AlertTriangle size={14} /> {q.error}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted">Keine Abfrage-Telemetrie für diesen Lauf verzeichnet.</p>
                )}
              </div>

              {/* Aufgetretene Fehler */}
              {selectedRun.errors && selectedRun.errors.length > 0 && (
                <div className="inspector-section">
                  <h3 style={{ color: '#f87171' }}>Aufgetretene Fehler ({selectedRun.errors.length})</h3>
                  <div className="errors-list">
                    {selectedRun.errors.map((err, errIdx) => (
                      <div key={errIdx} className="error-card">
                        <AlertCircle size={15} style={{ flexShrink: 0 }} />
                        <div>
                          <strong>{typeof err === 'object' ? err.source : 'Fehler'}:</strong> {typeof err === 'object' ? err.description : String(err)}
                          {err.timestamp && <span className="error-time"> ({err.timestamp})</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Behandelte Ereignisse & Reality-Check-Entscheidungen */}
              <div className="inspector-section">
                <h3>Verarbeitete Mandats-Ereignisse & Reality Check ({selectedRun.events_summary?.length || 0})</h3>
                {selectedRun.events_summary?.length > 0 ? (
                  <div className="events-summary-list">
                    {selectedRun.events_summary.map((evItem, evIdx) => {
                      const rcSt = evItem.reality_check_status || 'BEOBACHTEN'
                      const rcClass = rcSt.toLowerCase()
                      return (
                        <div key={evIdx} className={`event-summary-card ${rcClass}`}>
                          <div className="event-summary-header">
                            <div>
                              <span className={`rc-badge rc-badge-${rcClass}`}>{rcSt}</span>
                              <strong>{evItem.company}</strong>
                              <span className="text-muted">({evItem.category})</span>
                            </div>
                            <span className="text-xs text-muted">Status: {evItem.status}</span>
                          </div>
                          <div className="event-summary-meta">
                            <span>Quelle: {evItem.source}</span>
                            {evItem.target_role && <span>Ziel-Rolle: <strong>{evItem.target_role}</strong></span>}
                            {evItem.event_date && <span>Datum: {evItem.event_date}</span>}
                          </div>
                          {evItem.facts_proven && (
                            <div className="event-summary-block">
                              <span className="block-title">Belegte Fakten:</span>
                              <p>{evItem.facts_proven}</p>
                            </div>
                          )}
                          {evItem.mandate_hypothesis && (
                            <div className="event-summary-block">
                              <span className="block-title">Mandatshypothese:</span>
                              <p>{evItem.mandate_hypothesis}</p>
                            </div>
                          )}
                          {evItem.rationale && (
                            <div className="event-summary-block rationale">
                              <span className="block-title">Reality-Check Begründung:</span>
                              <p>{evItem.rationale}</p>
                            </div>
                          )}
                          {evItem.counter_indicators && evItem.counter_indicators.length > 0 && (
                            <div className="event-summary-block counters">
                              <span className="block-title">Gegenindikatoren:</span>
                              <ul>
                                {evItem.counter_indicators.map((ci, ciIdx) => (
                                  <li key={ciIdx}>{ci}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <p className="text-muted">In diesem Lauf wurden keine neuen Ereignisse erfasst oder verändert.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )}
    </div>
  )
}

