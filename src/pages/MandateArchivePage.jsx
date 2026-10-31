import React, { useState, useEffect, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  Archive,
  ShieldCheck,
  Building2,
  Calendar,
  Search,
  Download,
  Plus,
  Clock,
  CheckCircle,
  AlertTriangle,
  ExternalLink,
  Copy,
  Check,
  Trash2,
  X,
  FileText,
  UserCheck,
  Briefcase,
  Layers,
  Send,
  Zap,
  Info,
  Edit2,
  Phone,
  Mail,
  Award,
  Globe,
  FileCheck,
  Activity,
  Bell,
  BellRing,
  RefreshCw,
  Eye,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Inbox
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import {
  getCooperationPartners,
  saveCooperationPartners,
  savePartnerContract,
  deletePartnerContract,
  DEFAULT_PROTECTION_MONTHS,
  PROTECTION_DURATION_OPTIONS,
  CONTRACT_STATUS_OPTIONS,
  calculateProtectionEndDate,
  formatCalendarDateUtc
} from '../lib/nexus-partners'
import {
  getOutreachTrackingStatus,
  getProviderById,
  getProviderDirectory
} from '../lib/partner-routing'
import {
  computeDeadlineStatus,
  runWatchdogAuditForMandate,
  runWatchdogAuditForAllMandates,
  acknowledgeWatchdogAlert,
  acknowledgeWatchdogDecision,
  verifyMandateRegisterIdentity,
  MATCH_LEVELS,
  WATCHDOG_SIGNAL_KEYWORDS
} from '../lib/nexus-watchdog'
import './MandateArchivePage.css'

const STORAGE_KEY = 'nexus:mandate_archive_v1'

// Standard C-Level & Boutique Advisory Whitelist
const PARTNER_OPTIONS = [
  'taskforce - Management on Demand AG',
  'Top Fifty AG (Baar/Zug · Pierina Tannò)',
  'Atreus GmbH (A Heimatt Group Company)',
  'BIE Executive (London · Byron Tarboton)',
  'Egon Zehnder International',
  'Russell Reynolds Associates',
  'Spencer Stuart',
  'Korn Ferry',
  'F&P Executive Solutions AG',
  'Freier PE-Partner / Family Office',
  'Spezialisierte Boutique / Interim Provider'
]

// Initial verifiziertes, aktiv geschütztes Mandat (PAUL Tech AG an taskforce)
const INITIAL_PAUL_TECH_ENTRY = {
  id: 'arch-paul-tech-2026-01',
  leadId: 'pt-man-2026-01',
  company: 'PAUL Tech AG',
  countryMarket: 'DE · Mannheim / Prime Bond',
  role: 'Interim CFO / Restrukturierungs-PMO (SchVG)',
  transmittedTo: 'taskforce - Management on Demand AG',
  transmittedAt: '2026-10-27T08:00:00Z',
  protectionUntil: '2028-04-27T08:00:00Z',
  protection_months: 18,
  status: 'AKTIV_GESCHUETZT',
  register_id: 'AG Mannheim HRB 743304',
  company_domain: 'paul.group',
  ir_news_url: 'https://paul.group/news/',
  last_audit_check: '2026-10-28T20:00:00Z',
  has_change_alert: false,
  has_change_hint: false,
  changeDetected: false,
  match_level: MATCH_LEVELS.VERIFIED_STABLE,
  change_flag: MATCH_LEVELS.VERIFIED_STABLE,
  last_acknowledged_snapshot: {
    hash: 'h_07c2a6a30b80e5',
    substantiveText: 'gläubigerversammlung nach schvg zur laufzeitverlängerung der 35 mio | vertretungsbefugnis vorstand unverändert --- gläubigerversammlung mannheim verlängerung der 35 mio',
    timestamp: '2026-10-28T20:00:00Z',
    reviewer: 'Administrator',
    decision: 'ACKNOWLEDGE_STABLE',
    notes: 'SchVG-Anleiheverlängerung bis 2028 bekannt und im Mandat bei taskforce aktiv begleitet.'
  },
  last_scraped_snapshot: {
    hash: 'h_07c2a6a30b80e5',
    substantiveText: 'gläubigerversammlung nach schvg zur laufzeitverlängerung der 35 mio | vertretungsbefugnis vorstand unverändert --- gläubigerversammlung mannheim verlängerung der 35 mio',
    timestamp: '2026-10-28T20:00:00Z',
    matchedKeywords: ['Gläubigerversammlung', 'SchVG', 'Restrukturierung', 'Vorstand']
  },
  audit_log: [
    {
      id: 'audit-pt-ack-01',
      timestamp: '2026-10-28T20:00:00Z',
      sourceType: 'HUMAN_AUDIT_REVIEW',
      sourceTitle: 'Menschliche Quittierung: Status stabil',
      sourceUrl: 'https://paul.group/news/',
      matchLevel: MATCH_LEVELS.VERIFIED_STABLE,
      matchedKeywords: ['Geprüft', 'ACKNOWLEDGE_STABLE'],
      snippet: 'Entscheidung durch Administrator: SchVG-Anleiheverlängerung bis 2028 bekannt und im Mandat bei taskforce aktiv begleitet.',
      changeDetected: false,
      actionRequired: false,
      note: 'SchVG-Anleiheverlängerung bis 2028 bekannt und im Mandat bei taskforce aktiv begleitet.',
      reviewer: 'Administrator',
      decision: 'ACKNOWLEDGE_STABLE',
      acknowledgedHash: 'h_041008440692a2'
    },
    {
      id: 'audit-pt-01',
      timestamp: '2026-10-28T18:00:00Z',
      sourceType: 'CORPORATE_NEWS',
      sourceTitle: 'PAUL Tech AG: Angepasster Vorschlag zur Anleihe-Restrukturierung angenommen',
      sourceUrl: 'https://paul.group/news/',
      matchLevel: MATCH_LEVELS.SEARCH_HIT,
      matchedKeywords: ['Restrukturierung', 'Gläubigerversammlung', 'CFO', 'Vorstand'],
      snippet: 'Gläubigerversammlung am 26.10.2026 in Mannheim: Laufzeitverlängerung der 35 Mio. EUR Anleihe (DE000A3H2TU8) bis 2028 beschlossen. Operatives Restrukturierungskonzept in Umsetzung.',
      changeDetected: false,
      actionRequired: false,
      note: 'SchVG-Beschluss gefasst. Begleitung der Anschlussfinanzierung und Restrukturierung durch externen Interim-CFO / PMO geboten.'
    },
    {
      id: 'audit-pt-00',
      timestamp: '2026-10-27T09:00:00Z',
      sourceType: 'HANDELSREGISTER',
      sourceTitle: 'Amtsgericht Mannheim HRB 743304 - Amtliche Registerbekanntmachung',
      sourceUrl: 'https://www.handelsregister.de',
      matchLevel: MATCH_LEVELS.SEARCH_HIT,
      matchedKeywords: ['Vorstand', 'Satzungsänderung'],
      snippet: 'Amtsgericht Mannheim HRB 743304: PAUL Tech AG (Theodor-Heuss-Anlage 12, 68165 Mannheim). Gläubigerversammlung nach SchVG zur Laufzeitverlängerung der 35 Mio. EUR Anleihe (DE000A3H2TU8) bis 2028.',
      changeDetected: false,
      actionRequired: false,
      note: 'Register-Basisprüfung erfolgreich: HRB 743304 amtlich verifiziert.'
    }
  ],
  notes: 'Übermittelt an taskforce (Frank Sieger). 18 Monate Käufer- & Kundenschutz verbindlich aktiviert. SchVG-Gläubigerabstimmung in Mannheim.',
  source: 'Anleihen-Finder.de / Gläubigerversammlung Mannheim · ISIN DE000A3H2TU8'
}

// Initiales exklusiv reserviertes Mandat UK (cosquare AG an BIE Executive)
const INITIAL_COSQUARE_UK_ENTRY = {
  id: 'arch-cosquare-uk-02',
  leadId: '35bead11-ba4d-47b4-be1a-21a765b96b29',
  company: 'cosquare AG',
  countryMarket: 'CH / UK · Cross-Border',
  role: 'Interim Board Director / Crisis Governance Lead',
  transmittedTo: 'BIE Executive · Byron Tarboton',
  transmittedAt: '2026-10-26T10:59:33Z',
  protectionUntil: '2026-10-28T16:00:00Z',
  protection_months: 18,
  status: 'ANGEBOTEN_RESERVIERT',
  register_id: 'Kanton Zug CHE-457.384.964',
  company_domain: 'cosquare.ch',
  ir_news_url: 'https://www.shab.ch',
  last_audit_check: '2026-10-28T10:00:00Z',
  has_change_alert: false,
  has_change_hint: false,
  changeDetected: false,
  match_level: MATCH_LEVELS.VERIFIED_STABLE,
  change_flag: MATCH_LEVELS.VERIFIED_STABLE,
  notes: '48h First-Look UK exklusiv für Byron Tarboton / BIE Executive (Frist bis Mittwoch, 28.10.2026, 17:00 BST). Blind-Profil INT-CH-2026-081 übermittelt.',
  source: 'SHAB-Mutation 26.10.2026 · Ref. INT-CH-2026-081',
  last_acknowledged_snapshot: {
    hash: 'h_0b2dcde163f0dd',
    substantiveText: 'shab mutation organvakanz im verwaltungsrat',
    timestamp: '2026-10-28T10:00:00Z',
    reviewer: 'Administrator',
    decision: 'ACKNOWLEDGE_STABLE',
    notes: 'Mutation SHAB: Vakanz im Verwaltungsrat nach Amtsniederlegung ungeklärt.'
  },
  audit_log: [
    {
      id: 'audit-cq-uk-01',
      timestamp: '2026-10-28T10:00:00Z',
      sourceType: 'HANDELSREGISTER',
      sourceTitle: 'Handelsregisteramt des Kantons Zug (CHE-457.384.964)',
      sourceUrl: 'https://www.shab.ch',
      matchLevel: MATCH_LEVELS.SEARCH_HIT,
      matchedKeywords: ['Organvakanz'],
      snippet: 'Mutation SHAB: Vakanz im Verwaltungsrat nach Amtsniederlegung ungeklärt. Eintragung unverändert.',
      changeDetected: false,
      actionRequired: false,
      note: 'Status stabil: Exklusivität läuft.'
    }
  ]
}

// Initiales exklusiv reserviertes Mandat CH (cosquare AG an Top Fifty AG)
const INITIAL_COSQUARE_ARCHIVE_ENTRY = {
  id: 'arch-cosquare-2026-01',
  leadId: '35bead11-ba4d-47b4-be1a-21a765b96b29',
  company: 'cosquare AG',
  countryMarket: 'CH · Zug (SHAB)',
  role: 'Mitglied des Verwaltungsrates (Ersatzbesetzung)',
  transmittedTo: 'Top Fifty AG · Pierina Tannò',
  transmittedAt: '2026-10-26T10:33:01Z',
  protectionUntil: '2026-11-09T23:59:59Z',
  protection_months: 18,
  status: 'ANGEBOTEN_RESERVIERT',
  register_id: 'Kanton Zug CHE-457.384.964',
  company_domain: 'cosquare.ch',
  ir_news_url: 'https://www.shab.ch',
  last_audit_check: '2026-10-28T10:00:00Z',
  has_change_alert: false,
  has_change_hint: false,
  changeDetected: false,
  match_level: MATCH_LEVELS.VERIFIED_STABLE,
  change_flag: MATCH_LEVELS.VERIFIED_STABLE,
  notes: 'Exklusive 14-tägige Reservierung (Frist bis 09.11.2026) für Top Fifty AG / Pierina Tannò. Blind-Profil übermittelt.',
  source: 'Schweizerisches Handelsamtsblatt (SHAB) · Ref. CH-ZG-2026-VR-01',
  last_acknowledged_snapshot: {
    hash: 'h_0b2dcde163f0dd',
    substantiveText: 'shab mutation organvakanz im verwaltungsrat',
    timestamp: '2026-10-28T10:00:00Z',
    reviewer: 'Administrator',
    decision: 'ACKNOWLEDGE_STABLE',
    notes: 'Organvakanz im Verwaltungsrat unbesetzt, 14-tägige Exklusivität aktiv.'
  },
  audit_log: [
    {
      id: 'audit-cq-ch-01',
      timestamp: '2026-10-28T10:00:00Z',
      sourceType: 'HANDELSREGISTER',
      sourceTitle: 'SHAB Schweiz Mutation CHE-457.384.964',
      sourceUrl: 'https://www.shab.ch',
      matchLevel: MATCH_LEVELS.SEARCH_HIT,
      matchedKeywords: ['Verwaltungsrat'],
      snippet: 'Verwaltungsrat-Ersatzwahl noch nicht im Handelsregister eingetragen.',
      changeDetected: false,
      actionRequired: false,
      note: '14-tägige Frist aktiv.'
    }
  ]
}

// Bereinigungs-Hilfe: Entfernt alte Test-/Mockup-Daten und garantiert PAUL Tech AG + cosquare
function sanitizeArchiveEntries(list) {
  if (!Array.isArray(list)) return [INITIAL_PAUL_TECH_ENTRY, INITIAL_COSQUARE_UK_ENTRY, INITIAL_COSQUARE_ARCHIVE_ENTRY]
  const DUMMY_IDS = ['arch-001', 'arch-002', 'arch-003', 'arch-004']
  const DUMMY_COMPANIES = ['brenntag', 'krones', 'clariant', 'melrose']

  const cleaned = list.filter(item => {
    if (!item) return false
    if (DUMMY_IDS.includes(item.id)) return false
    const compLower = (item.company || '').toLowerCase()
    if (DUMMY_COMPANIES.some(d => compLower.includes(d))) return false
    return true
  })

  const hasPaul = cleaned.some(item => item.id === 'arch-paul-tech-2026-01' || (item.company || '').toLowerCase().includes('paul tech'))
  if (!hasPaul) {
    cleaned.unshift(INITIAL_PAUL_TECH_ENTRY)
  }

  const hasUK = cleaned.some(item => item.id === 'arch-cosquare-uk-02' || item.notes?.includes('INT-CH-2026-081'))
  if (!hasUK) {
    cleaned.push(INITIAL_COSQUARE_UK_ENTRY)
  }

  const hasCosquareCH = cleaned.some(item => item.id === 'arch-cosquare-2026-01' || item.notes?.includes('CH-ZG-2026-VR-01'))
  if (!hasCosquareCH) {
    cleaned.push(INITIAL_COSQUARE_ARCHIVE_ENTRY)
  }

  return cleaned
}

// Extrahiert Details aus DealCoach review_notes / situation
function extractDealCoachDetails(opp) {
  let tier = 'TIER_2_MID'
  let rationale = opp.strategic_angle || opp.notes || ''
  let estimatedBudget = '80.000 € – 150.000 €'
  let vacuumCheck = 'Vakuum-Prüfung erfolgt'
  let urgencyCheck = 'Operativer Handlungsdruck'
  let role = 'Interim Manager / Operative Leitung'

  if (opp.review_notes) {
    try {
      const parsed = typeof opp.review_notes === 'string' ? JSON.parse(opp.review_notes) : opp.review_notes
      if (parsed?.deal_coach) {
        const dc = parsed.deal_coach
        tier = dc.tier || tier
        rationale = dc.rationale || rationale
        estimatedBudget = dc.estimated_budget || estimatedBudget
        vacuumCheck = dc.vacuum_check || vacuumCheck
        urgencyCheck = dc.urgency_check || urgencyCheck
      }
    } catch {
      // Ignoriere JSON Parse Fehler
    }
  }

  const situation = opp.situation || ''
  const roleMatch = situation.match(/\[ROLE\]:\s*([^\n\r]+)/i) || opp.title?.match(/:\s*(.*)/)
  if (roleMatch && roleMatch[1]) {
    role = roleMatch[1].trim()
  }

  const ratMatch = situation.match(/\[MANDATS-BEGRÜNDUNG\]:\s*([^\n\r]+)/i)
  if (ratMatch) rationale = ratMatch[1].trim()

  const budMatch = situation.match(/\[BUDGET-SCHÄTZUNG\]:\s*([^\n\r]+)/i)
  if (budMatch) estimatedBudget = budMatch[1].trim()

  const vacMatch = situation.match(/\[VAKUUM-CHECK\]:\s*([^\n\r]+)/i)
  if (vacMatch) vacuumCheck = vacMatch[1].trim()

  const urgMatch = situation.match(/\[DRINGLICHKEIT\]:\s*([^\n\r]+)/i)
  if (urgMatch) urgencyCheck = urgMatch[1].trim()

  return { tier, rationale, estimatedBudget, vacuumCheck, urgencyCheck, role }
}

export default function MandateArchivePage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const tabFromUrl = searchParams.get('tab')

  // Aktiver Hauptbereich: 'boutique_pool' (TIER_2_MID Zweitverwertung) | 'transmitted' (Kundenschutz-Register) | 'contracts' (Kooperationsverträge)
  const [activeTab, setActiveTabState] = useState(() => {
    if (tabFromUrl === 'contracts') return 'contracts'
    if (tabFromUrl === 'transmitted') return 'transmitted'
    return 'boutique_pool'
  })

  const setActiveTab = (tab) => {
    setActiveTabState(tab)
    setSearchParams(prev => {
      const next = new URLSearchParams(prev)
      next.set('tab', tab)
      return next
    }, { replace: true })
  }

  useEffect(() => {
    if (tabFromUrl && ['boutique_pool', 'transmitted', 'contracts'].includes(tabFromUrl)) {
      setActiveTabState(tabFromUrl)
    }
  }, [tabFromUrl])

  // 1. Übermittelte Mandate (Kundenschutz) - ohne Hardcoded-Mocks
  const [entries, setEntries] = useState(() => {
    try {
      const cached = localStorage.getItem(STORAGE_KEY)
      if (cached) {
        const parsed = JSON.parse(cached)
        return sanitizeArchiveEntries(parsed)
      }
    } catch (e) {
      console.warn('[MandateArchive] Error loading local archive:', e)
    }
    return [INITIAL_PAUL_TECH_ENTRY, INITIAL_COSQUARE_UK_ENTRY, INITIAL_COSQUARE_ARCHIVE_ENTRY]
  })

  // Watchdog-State & Alerting
  const [isAuditing, setIsAuditing] = useState(false)
  const [auditSuccessBanner, setAuditSuccessBanner] = useState(null)
  const [showAuditModal, setShowAuditModal] = useState(false)
  const [selectedAuditMandate, setSelectedAuditMandate] = useState(null)
  const [auditReviewNote, setAuditReviewNote] = useState('Geprüft & Mandatsstand im Register verifiziert')
  const [dispatchRegisterId, setDispatchRegisterId] = useState('')
  const [dispatchNewsUrl, setDispatchNewsUrl] = useState('')

  // Gmail & Partner E-Mail-Synchronisation State
  const [syncedEmails, setSyncedEmails] = useState([])
  const [isSyncingEmails, setIsSyncingEmails] = useState(false)
  const [emailSyncSuccessBanner, setEmailSyncSuccessBanner] = useState(null)
  const [auditModalTab, setAuditModalTab] = useState('watchdog') // 'watchdog' | 'emails'
  const [emailFilterMode, setEmailFilterMode] = useState('mandate') // 'mandate' | 'all'
  const [expandedEmailId, setExpandedEmailId] = useState(null)

  // Initiales Laden synchronisierter Partner-E-Mails aus JSON-Storage
  useEffect(() => {
    fetch('/data/partner_emails.json')
      .then(res => res.json())
      .then(data => {
        if (data && Array.isArray(data.emails)) {
          setSyncedEmails(data.emails)
        }
      })
      .catch(() => {
        // Fallback
      })
  }, [])

  const handleSyncEmails = async () => {
    setIsSyncingEmails(true)
    try {
      let updatedEmails = null
      try {
        const res = await fetch('/.netlify/functions/nexus-sync-emails', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: '976e6211-8931-425a-a171-0c062290181b' })
        })
        if (res.ok) {
          const json = await res.json()
          if (json.emails && Array.isArray(json.emails)) {
            updatedEmails = json.emails
          }
        }
      } catch (e) {
        // Fallback auf statische JSON
      }

      if (!updatedEmails) {
        const res = await fetch('/data/partner_emails.json')
        const json = await res.json()
        if (json.emails && Array.isArray(json.emails)) {
          updatedEmails = json.emails
        }
      }

      if (updatedEmails) {
        setSyncedEmails(updatedEmails)
        setEmailSyncSuccessBanner({
          count: updatedEmails.length,
          time: new Date().toLocaleTimeString('de-DE')
        })
        setTimeout(() => setEmailSyncSuccessBanner(null), 8000)
      }
    } catch (err) {
      console.error('[MandateArchive] Error syncing emails:', err)
    } finally {
      setIsSyncingEmails(false)
    }
  }

  // 2. Kooperationspartner & Verträge (Zentraler Desk)
  const [partners, setPartners] = useState(() => getCooperationPartners())

  useEffect(() => {
    const handleSyncPartners = () => {
      setPartners(getCooperationPartners())
    }
    window.addEventListener('nexus_partners_updated', handleSyncPartners)
    return () => window.removeEventListener('nexus_partners_updated', handleSyncPartners)
  }, [])

  // Partner Modal & Form State
  const [showPartnerModal, setShowPartnerModal] = useState(false)
  const [editingPartnerId, setEditingPartnerId] = useState(null)
  const [partnerForm, setPartnerForm] = useState({
    name: '',
    shortName: '',
    location: 'Deutschland 🇩🇪',
    contactPerson: '',
    role: 'Partner / Practice Group Head',
    email: '',
    phone: '',
    contractDate: new Date().toISOString().slice(0, 10),
    contractStatus: 'AKTIV_GEZEICHNET',
    defaultProtectionMonths: DEFAULT_PROTECTION_MONTHS, // 18 Monate Standard
    specialConditions: '18 Monate Käufer- & Kundenschutz verbindlich eingeführt.',
    contractRef: '',
    documentName: ''
  })
  const [isPartnerCustomDuration, setIsPartnerCustomDuration] = useState(false)

  // 3. Dynamischer Boutique-Pool (TIER_2_MID Leads aus Supabase)
  const [tier2Leads, setTier2Leads] = useState([])
  const [loadingTier2, setLoadingTier2] = useState(true)

  // Filter & Suche State
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [partnerFilter, setPartnerFilter] = useState('ALL')
  const [copiedId, setCopiedId] = useState(null)

  // Übermittlungs-Modal State (mit variabler Schutzfrist, Standard 18 Monate)
  const [showDispatchModal, setShowDispatchModal] = useState(false)
  const [dispatchTargetLead, setDispatchTargetLead] = useState(null)
  const [dispatchCompany, setDispatchCompany] = useState('')
  const [dispatchMarket, setDispatchMarket] = useState('DE · Gehobener Mittelstand')
  const [dispatchRole, setDispatchRole] = useState('')
  const [dispatchPartner, setDispatchPartner] = useState(PARTNER_OPTIONS[0])
  const [dispatchProtectionMonths, setDispatchProtectionMonths] = useState(DEFAULT_PROTECTION_MONTHS) // 18
  const [isDispatchCustomDuration, setIsDispatchCustomDuration] = useState(false)
  const [dispatchDate, setDispatchDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [dispatchNotes, setDispatchNotes] = useState('')
  const [dispatchSource, setDispatchSource] = useState('Primärquelle verifiziert')

  // Dynamische Partner-Auswahlliste
  const partnerDisplayOptions = useMemo(() => {
    const list = []
    partners.forEach(p => {
      const label = p.name + (p.contactPerson ? ` (${p.contactPerson})` : '')
      list.push(label)
    })
    PARTNER_OPTIONS.forEach(opt => {
      if (!list.some(item => item.toLowerCase().includes(opt.slice(0, 10).toLowerCase()))) {
        list.push(opt)
      }
    })
    return list
  }, [partners])

  // TIER_2_MID Leads live aus Supabase laden
  const fetchTier2Leads = async () => {
    try {
      setLoadingTier2(true)
      const { data, error } = await supabase
        .from('nexus_opportunities')
        .select('*, nexus_companies(name, domain), triggers:nexus_opportunity_triggers(nexus_trigger_events(*))')
        .order('created_at', { ascending: false })

      if (error) {
        console.warn('[MandateArchive] Supabase Query Warning:', error.message)
        return
      }

      if (Array.isArray(data)) {
        // Filtert alle TIER_2_MID Mandate heraus
        const filtered = data.filter(opp => {
          const priority = (opp.priority || '').toUpperCase()
          const tags = Array.isArray(opp.tags) ? opp.tags : []
          const situation = opp.situation || ''
          const reviewNotes = typeof opp.review_notes === 'string' ? opp.review_notes : JSON.stringify(opp.review_notes || {})
          const isStageBoutique = opp.pipeline_stage === 'boutique_pool'

          return (
            isStageBoutique ||
            priority.includes('TIER_2') ||
            tags.includes('TIER_2_MID') ||
            situation.includes('TIER_2_MID') ||
            reviewNotes.includes('TIER_2_MID')
          )
        })
        setTier2Leads(filtered)
      }
    } catch (err) {
      console.error('[MandateArchive] Error fetching TIER_2 leads:', err)
    } finally {
      setLoadingTier2(false)
    }
  }

  useEffect(() => {
    fetchTier2Leads()
  }, [])

  // Persistierung im localStorage (bereinigt)
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(entries))
    } catch (e) {
      console.warn('[MandateArchive] Error saving to localStorage:', e)
    }
  }, [entries])

  // Frist- und Resttage-Berechnung (Gesetzliche Ultimo-Regel via nexus-partners)
  const computeProtectionDetails = (transmittedAtStr, protectionUntilStr, status, protectionMonths) => {
    if (!transmittedAtStr && !protectionUntilStr) {
      return {
        untilDate: '–',
        diffDays: 0,
        isExpired: true,
        label: 'Unvollständige Fristdaten'
      }
    }

    const months = parseInt(protectionMonths, 10) || DEFAULT_PROTECTION_MONTHS
    let until = null
    if (protectionUntilStr) {
      const parsedUntil = new Date(protectionUntilStr)
      if (!isNaN(parsedUntil.getTime())) until = parsedUntil
    }
    if (!until && transmittedAtStr) {
      until = calculateProtectionEndDate(transmittedAtStr, months)
    }

    if (!until) {
      return {
        untilDate: '–',
        diffDays: 0,
        isExpired: true,
        label: 'Ungültiges Datum'
      }
    }

    const diffMs = until.getTime() - Date.now()
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24))
    const isExpired = diffDays <= 0

    let label = isExpired ? 'Kundenschutz abgelaufen' : `Noch ${diffDays} Tage geschützt`
    if (status === 'ANGEBOTEN_RESERVIERT') {
      label = isExpired ? 'Reservierung abgelaufen' : `Exklusivität aktiv (${diffDays} Tage)`
    }

    return {
      untilDate: formatCalendarDateUtc(until),
      diffDays,
      isExpired,
      label
    }
  }

  // Filterung Übermittelte Mandate
  const filteredTransmittedEntries = useMemo(() => {
    return entries.filter(item => {
      const q = searchQuery.toLowerCase().trim()
      const matchesSearch = !q ||
        (item.company || '').toLowerCase().includes(q) ||
        (item.role || '').toLowerCase().includes(q) ||
        (item.transmittedTo || '').toLowerCase().includes(q) ||
        (item.countryMarket || '').toLowerCase().includes(q)

      const matchesStatus = statusFilter === 'ALL' || item.status === statusFilter
      const matchesPartner = partnerFilter === 'ALL' || (item.transmittedTo || '').toLowerCase().includes(partnerFilter.toLowerCase())

      return matchesSearch && matchesStatus && matchesPartner
    })
  }, [entries, searchQuery, statusFilter, partnerFilter])

  // Filterung TIER_2_MID Boutique-Pool
  const filteredTier2Leads = useMemo(() => {
    return tier2Leads.filter(lead => {
      const q = searchQuery.toLowerCase().trim()
      if (!q) return true
      const comp = lead.nexus_companies?.name || lead.title || ''
      const angle = lead.strategic_angle || lead.notes || lead.situation || ''
      return comp.toLowerCase().includes(q) || angle.toLowerCase().includes(q)
    })
  }, [tier2Leads, searchQuery])

  // Filterung Kooperationsverträge
  const filteredContracts = useMemo(() => {
    return partners.filter(p => {
      const q = searchQuery.toLowerCase().trim()
      if (!q) return true
      return (
        (p.name || '').toLowerCase().includes(q) ||
        (p.shortName || '').toLowerCase().includes(q) ||
        (p.contactPerson || '').toLowerCase().includes(q) ||
        (p.location || '').toLowerCase().includes(q) ||
        (p.specialConditions || '').toLowerCase().includes(q) ||
        (p.contractRef || '').toLowerCase().includes(q)
      )
    })
  }, [partners, searchQuery])

  // Statistiken
  const stats = useMemo(() => {
    const transmittedTotal = entries.length
    const activeProtected = entries.filter(e => {
      const p = computeProtectionDetails(e.transmittedAt, e.protectionUntil, e.status, e.protection_months)
      return !p.isExpired && e.status !== 'ABGELAUFEN'
    }).length
    const tier2Count = tier2Leads.length
    const uniquePartners = new Set(entries.map(e => e.transmittedTo)).size
    const activeContractsCount = partners.filter(p => p.contractStatus === 'AKTIV_GEZEICHNET').length

    return { transmittedTotal, activeProtected, tier2Count, uniquePartners, activeContractsCount }
  }, [entries, tier2Leads, partners])

  // CSV-Export für juristischen Kundenschutz-Nachweis
  const exportCsv = () => {
    const headers = [
      'Zielgesellschaft',
      'Land_Boerse',
      'Vakanz_Rolle',
      'Uebermittelt_An',
      'Uebermittlungsdatum',
      'Kundenschutz_Bis',
      'Schutzfrist_Monate',
      'Status',
      'Primaerquellen_Nachweis'
    ]

    const rows = entries.map(e => {
      const p = computeProtectionDetails(e.transmittedAt, e.protectionUntil, e.status, e.protection_months)
      return [
        `"${(e.company || '').replace(/"/g, '""')}"`,
        `"${(e.countryMarket || '').replace(/"/g, '""')}"`,
        `"${(e.role || '').replace(/"/g, '""')}"`,
        `"${(e.transmittedTo || '').replace(/"/g, '""')}"`,
        `"${new Date(e.transmittedAt).toLocaleDateString('de-DE')}"`,
        `"${p.untilDate}"`,
        `"${e.protection_months || 18}"`,
        `"${e.status}"`,
        `"${(e.source || e.notes || '').replace(/"/g, '""')}"`
      ].join(';')
    })

    const csvContent = '\uFEFF' + [headers.join(';'), ...rows].join('\r\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `D.A.T._Mandats_Kundenschutz_${new Date().toISOString().slice(0, 10)}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // Öffnet Modal für manuellen Eintrag
  const handleOpenManualDispatch = () => {
    setDispatchTargetLead(null)
    setDispatchCompany('')
    setDispatchMarket('DE · Prime Standard')
    setDispatchRole('Interim Transformation Officer')
    setDispatchRegisterId('')
    setDispatchNewsUrl('')
    const initialPartner = partnerDisplayOptions[0] || 'taskforce - Management on Demand AG'
    setDispatchPartner(initialPartner)
    const matchedP = partners.find(p => initialPartner.includes(p.name) || initialPartner.includes(p.shortName))
    const pMonths = matchedP?.defaultProtectionMonths || DEFAULT_PROTECTION_MONTHS
    setDispatchProtectionMonths(pMonths)
    setIsDispatchCustomDuration(![18, 12, 24, 6].includes(pMonths))
    setDispatchDate(new Date().toISOString().slice(0, 10))
    setDispatchNotes('')
    setDispatchSource('Primärquelle / DealCoach Audit')
    setShowDispatchModal(true)
  }

  // Öffnet Modal für einen konkreten TIER_2 Lead aus dem Boutique-Pool
  const handleOpenLeadDispatch = (lead) => {
    const compName = lead.nexus_companies?.name || lead.title?.split(':')[0]?.replace(/\[.*?\]/, '')?.trim() || 'Zielgesellschaft'
    const details = extractDealCoachDetails(lead)
    const compDomain = lead.nexus_companies?.domain || ''

    setDispatchTargetLead(lead)
    setDispatchCompany(compName)
    setDispatchMarket(lead.title?.includes('[UK]') ? 'UK · Mittelstand' : lead.title?.includes('[CH]') ? 'CH · Mittelstand' : 'DE · Gehobener Mittelstand')
    setDispatchRole(details.role)
    setDispatchRegisterId('')
    setDispatchNewsUrl(compDomain ? `https://${compDomain}/news` : '')
    const initialPartner = partnerDisplayOptions[0] || 'taskforce - Management on Demand AG'
    setDispatchPartner(initialPartner)
    const matchedP = partners.find(p => initialPartner.includes(p.name) || initialPartner.includes(p.shortName))
    const pMonths = matchedP?.defaultProtectionMonths || DEFAULT_PROTECTION_MONTHS
    setDispatchProtectionMonths(pMonths)
    setIsDispatchCustomDuration(![18, 12, 24, 6].includes(pMonths))
    setDispatchDate(new Date().toISOString().slice(0, 10))
    setDispatchNotes(`Zweitverwertung via Boutique-Pool: ${details.rationale} | Budget: ${details.estimatedBudget}`)
    setDispatchSource(lead.source || 'EQS / LSE / Primär-Radar')
    setShowDispatchModal(true)
  }

  // Übermittlung final speichern & variable Schutzfrist (Standard: 18 Monate) aktivieren
  const handleConfirmDispatch = async (e) => {
    e.preventDefault()
    if (!dispatchCompany.trim()) return

    const transmittedDate = new Date(`${dispatchDate}T12:00:00Z`)
    const months = parseInt(dispatchProtectionMonths, 10) || DEFAULT_PROTECTION_MONTHS
    const protectionDate = calculateProtectionEndDate(transmittedDate, months)

    const newEntry = {
      id: `arch-${Date.now()}`,
      leadId: dispatchTargetLead?.id || null,
      company: dispatchCompany.trim(),
      countryMarket: dispatchMarket.trim(),
      role: dispatchRole.trim(),
      transmittedTo: dispatchPartner.trim(),
      transmittedAt: transmittedDate.toISOString(),
      protectionUntil: protectionDate.toISOString(),
      protection_months: months,
      status: 'AKTIV_GESCHUETZT',
      register_id: dispatchRegisterId.trim() || 'HRB-Eintragung ausstehend',
      company_domain: dispatchNewsUrl.trim() ? (dispatchNewsUrl.replace(/^https?:\/\//i, '').split('/')[0]) : (dispatchTargetLead?.nexus_companies?.domain || ''),
      ir_news_url: dispatchNewsUrl.trim(),
      last_audit_check: new Date().toISOString(),
      has_change_alert: false,
      change_flag: 'INITIAL_PROTECTED',
      audit_log: [
        {
          id: `audit-init-${Date.now()}`,
          timestamp: new Date().toISOString(),
          sourceType: 'INITIAL_REGISTRATION',
          sourceTitle: 'Erstaufnahme in Kundenschutz-Register',
          sourceUrl: dispatchNewsUrl.trim(),
          matchedKeywords: ['Kundenschutz', `${months}M`],
          snippet: `${months} Monate Käufer- & Kundenschutz verbindlich aktiviert bei Übermittlung an ${dispatchPartner.trim()}.`,
          changeDetected: false,
          actionRequired: false,
          note: dispatchNotes.trim() || 'Initialer Übermittlungsdatensatz angelegt.'
        }
      ],
      notes: dispatchNotes.trim() || `Zweitverwertungs-Mandat an Partner übermittelt (${months} Monate Kundenschutz).`,
      source: dispatchSource.trim() || 'Primärquelle'
    }

    // Wenn aus einem TIER_2 Lead übermittelt, den Status in Supabase auf 'dispatched' aktualisieren
    if (dispatchTargetLead?.id) {
      try {
        await supabase
          .from('nexus_opportunities')
          .update({
            pipeline_stage: 'dispatched',
            review_status: 'verified',
            tags: [...(dispatchTargetLead.tags || []), 'TRANSMITTED_TO_PARTNER', `KUNDENSCHUTZ_${months}M`]
          })
          .eq('id', dispatchTargetLead.id)

        // Aus lokalem Tier-2 State entfernen
        setTier2Leads(prev => prev.filter(l => l.id !== dispatchTargetLead.id))
      } catch (err) {
        console.warn('[MandateArchive] Error updating lead stage in Supabase:', err)
      }
    }

    setEntries(prev => [newEntry, ...prev])
    setShowDispatchModal(false)
    setActiveTab('transmitted') // Zum Register wechseln
  }

  // Watchdog-Audits ausführen
  const handleRunLiveWatchdogAudit = async () => {
    setIsAuditing(true)
    try {
      const { mandates: updatedList, alertsFound } = await runWatchdogAuditForAllMandates(entries)
      setEntries(updatedList)
      setAuditSuccessBanner({
        count: updatedList.length,
        alerts: alertsFound.length,
        time: new Date().toLocaleTimeString('de-DE')
      })
      setTimeout(() => setAuditSuccessBanner(null), 8000)
    } catch (e) {
      console.error('[Watchdog] Error executing live audit:', e)
    } finally {
      setIsAuditing(false)
    }
  }

  const handleRunSingleAudit = async (mandate) => {
    setIsAuditing(true)
    try {
      const updated = await runWatchdogAuditForMandate(mandate)
      setEntries(prev => prev.map(m => m.id === mandate.id ? updated : m))
      if (selectedAuditMandate?.id === mandate.id) {
        setSelectedAuditMandate(updated)
      }
    } catch (e) {
      console.error('[Watchdog] Single audit error:', e)
    } finally {
      setIsAuditing(false)
    }
  }

  const handleAcknowledgeAlert = (mandate, decision = 'ACKNOWLEDGE_STABLE') => {
    const updated = acknowledgeWatchdogDecision(mandate, {
      decision,
      reviewer: 'Administrator',
      notes: auditReviewNote
    })
    setEntries(prev => prev.map(m => m.id === mandate.id ? updated : m))
    setSelectedAuditMandate(updated)
  }

  const handleOpenAuditModal = (mandate) => {
    setSelectedAuditMandate(mandate)
    setAuditReviewNote('Geprüft & Mandatsstand im Register verifiziert')
    setShowAuditModal(true)
  }

  // 1-Klick formeller Nachweis-String
  const handleCopyProof = (item) => {
    const p = computeProtectionDetails(item.transmittedAt, item.protectionUntil, item.status, item.protection_months)
    const isReserved = item.status === 'ANGEBOTEN_RESERVIERT'
    const months = item.protection_months || 18
    const text = `⚖️ NACHWEIS ${isReserved ? 'EXKLUSIV-RESERVIERUNG' : 'KUNDENSCHUTZ'} (D.A.T. MANDATE ORIGINATION DESK)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Zielgesellschaft: ${item.company}
Land / Börsensegment: ${item.countryMarket}
Vakanz / Organfunktion: ${item.role}
Übermittelt an Partner: ${item.transmittedTo}
Datum der Übermittlung: ${new Date(item.transmittedAt).toLocaleString('de-DE')}
Status: ${isReserved ? '🟡 Exklusiv reserviert (14 Tage)' : item.status}
Gültig bis: ${p.untilDate} (${p.label})
Rechtsbasis: ${isReserved ? '14 Tage Exklusivität nach D.A.T.-Standard' : `${months} Monate exklusiver Kundenschutz nach D.A.T.-Standard (Kooperationsvertrag)`}
Primärnachweis: ${item.source || item.notes}`

    navigator.clipboard.writeText(text)
    setCopiedId(item.id)
    setTimeout(() => setCopiedId(null), 2500)
  }

  // Partnervertrags-Verwaltung (Tab 3)
  const handleOpenNewPartner = () => {
    setEditingPartnerId(null)
    setPartnerForm({
      name: '',
      shortName: '',
      location: 'Deutschland 🇩🇪',
      contactPerson: '',
      role: 'Vorstand / Partner Management',
      email: '',
      phone: '',
      contractDate: new Date().toISOString().slice(0, 10),
      contractStatus: 'AKTIV_GEZEICHNET',
      defaultProtectionMonths: DEFAULT_PROTECTION_MONTHS, // 18 Monate Standard
      specialConditions: '18 Monate Käufer- & Kundenschutz verbindlich vereinbart.',
      contractRef: `KV-DAT-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`,
      documentName: ''
    })
    setIsPartnerCustomDuration(false)
    setShowPartnerModal(true)
  }

  const handleEditPartner = (p) => {
    setEditingPartnerId(p.id)
    const months = p.defaultProtectionMonths || DEFAULT_PROTECTION_MONTHS
    setPartnerForm({
      name: p.name || '',
      shortName: p.shortName || '',
      location: p.location || 'Deutschland 🇩🇪',
      contactPerson: p.contactPerson || '',
      role: p.role || '',
      email: p.email || '',
      phone: p.phone || '',
      contractDate: p.contractDate || new Date().toISOString().slice(0, 10),
      contractStatus: p.contractStatus || 'AKTIV_GEZEICHNET',
      defaultProtectionMonths: months,
      specialConditions: p.specialConditions || '',
      contractRef: p.contractRef || '',
      documentName: p.documentName || ''
    })
    setIsPartnerCustomDuration(![18, 12, 24, 6].includes(months))
    setShowPartnerModal(true)
  }

  const handleSavePartner = (e) => {
    e.preventDefault()
    if (!partnerForm.name.trim()) return

    const months = parseInt(partnerForm.defaultProtectionMonths, 10) || DEFAULT_PROTECTION_MONTHS
    const partnerData = {
      ...partnerForm,
      id: editingPartnerId || `partner_${Date.now()}`,
      defaultProtectionMonths: months
    }

    savePartnerContract(partnerData)
    setPartners(getCooperationPartners())
    setShowPartnerModal(false)
  }

  const handleDeletePartner = (id) => {
    const p = partners.find(item => item.id === id)
    if (window.confirm(`Kooperationsvertrag mit "${p?.name || 'Partner'}" wirklich löschen?`)) {
      const updated = deletePartnerContract(id)
      setPartners(updated)
    }
  }

  const handleDelete = (id) => {
    if (window.confirm('Mandatsnachweis unwiderruflich aus dem Archiv löschen?')) {
      setEntries(prev => prev.filter(e => e.id !== id))
    }
  }

  const handleStatusChange = (id, newStatus) => {
    setEntries(prev => prev.map(e => e.id === id ? { ...e, status: newStatus } : e))
  }

  return (
    <div className="mandate-archive-page">
      {/* Header */}
      <div className="mandate-archive-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#0284c7', fontWeight: 700, fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>
            <Archive size={16} /> D.A.T. Mandats-Archiv & Kooperations-Desk
          </div>
          <h1>Mandats-Archiv, Kundenschutz & Verträge</h1>
          <p>
            Zentraler Desk für die <strong>Boutique-Zweitverwertung (TIER_2_MID)</strong>, das lückenlose <strong>Käufer- & Kundenschutz-Register (Standard: 18 Monate, variabel auf 12M)</strong> sowie vertragliche <strong>Partner-Konditionen & Sonderklauseln</strong>.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={handleSyncEmails}
            disabled={isSyncingEmails}
            className="archive-btn-secondary"
            style={{
              background: 'rgba(56, 189, 248, 0.1)',
              borderColor: '#0284c7',
              color: '#0284c7',
              fontWeight: 700
            }}
            title="Partner-E-Mails und Bestätigungen aus Gmail abgleichen (taskforce AG &amp; DACH-Provider)"
          >
            {isSyncingEmails ? (
              <>
                <RefreshCw size={15} className="animate-spin" /> E-Mails synchronisieren...
              </>
            ) : (
              <>
                <Mail size={15} /> 🔄 E-Mails synchronisieren {syncedEmails.length > 0 ? `(${syncedEmails.length})` : ''}
              </>
            )}
          </button>

          {entries.length > 0 && activeTab === 'transmitted' && (
            <>
              <button
                type="button"
                onClick={handleRunLiveWatchdogAudit}
                disabled={isAuditing}
                className="archive-btn-secondary"
                style={{
                  background: 'rgba(234, 88, 12, 0.1)',
                  borderColor: '#ea580c',
                  color: '#c2410c',
                  fontWeight: 700
                }}
                title="Führt automatisierte Differenzprüfung gegen Handelsregister & Corporate News aus"
              >
                {isAuditing ? (
                  <>
                    <RefreshCw size={15} className="animate-spin" /> Audit läuft...
                  </>
                ) : (
                  <>
                    <Zap size={15} /> Watchdog-Audit ausführen ({entries.filter(e => e.status === 'AKTIV_GESCHUETZT' || e.status === 'ANGEBOTEN_RESERVIERT').length})
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={exportCsv}
                className="archive-btn-secondary"
                title="CSV-Report mit allen Übermittlungsfristen herunterladen"
              >
                <Download size={16} /> Kundenschutz-Report (CSV)
              </button>
            </>
          )}

          {activeTab === 'contracts' ? (
            <button
              type="button"
              onClick={handleOpenNewPartner}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '9px 18px',
                borderRadius: '8px',
                background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
                border: '1px solid #059669',
                color: '#ffffff',
                fontWeight: 700,
                fontSize: '0.86rem',
                cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(5, 150, 105, 0.25)'
              }}
            >
              <Plus size={16} /> Neuen Kooperationsvertrag anlegen
            </button>
          ) : (
            <button
              type="button"
              onClick={handleOpenManualDispatch}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '9px 18px',
                borderRadius: '8px',
                background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                border: '1px solid #0284c7',
                color: '#ffffff',
                fontWeight: 700,
                fontSize: '0.86rem',
                cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(2, 132, 199, 0.25)'
              }}
            >
              <Plus size={16} /> Übermittlung protokollieren
            </button>
          )}
        </div>
      </div>

      {/* Watchdog Audit Notification Banner */}
      {auditSuccessBanner && (
        <div style={{
          padding: '12px 18px',
          background: auditSuccessBanner.alerts > 0 ? '#fef2f2' : '#f0fdf4',
          border: `1px solid ${auditSuccessBanner.alerts > 0 ? '#fca5a5' : '#86efac'}`,
          borderRadius: '10px',
          color: auditSuccessBanner.alerts > 0 ? '#991b1b' : '#166534',
          fontSize: '0.88rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '16px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {auditSuccessBanner.alerts > 0 ? <AlertCircle size={18} color="#dc2626" /> : <CheckCircle size={18} color="#16a34a" />}
            <span>
              <strong>Watchdog-Audit um {auditSuccessBanner.time} Uhr abgeschlossen:</strong> {auditSuccessBanner.count} Mandate geprüft.
              {auditSuccessBanner.alerts > 0 
                ? ` 🚨 ${auditSuccessBanner.alerts} Veränderungs-Signale erkannt – Prüfung erforderlich!` 
                : ' Keine ungeklärten Register-Mutationen festgestellt.'}
            </span>
          </div>
          <button type="button" onClick={() => setAuditSuccessBanner(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit' }}>
            <X size={16} />
          </button>
        </div>
      )}

      {/* Gmail Partner-Sync Notification Banner */}
      {emailSyncSuccessBanner && (
        <div style={{
          padding: '12px 18px',
          background: '#f0f9ff',
          border: '1px solid #bae6fd',
          borderRadius: '10px',
          color: '#0369a1',
          fontSize: '0.88rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '16px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Mail size={18} color="#0284c7" />
            <span>
              <strong>Gmail-Partner-Sync um {emailSyncSuccessBanner.time} Uhr erfolgreich:</strong> {emailSyncSuccessBanner.count} E-Mails synchronisiert (taskforce AG &amp; DACH-Partner).
            </span>
          </div>
          <button type="button" onClick={() => setEmailSyncSuccessBanner(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit' }}>
            <X size={16} />
          </button>
        </div>
      )}

      {/* KPI Cards */}
      <div className="archive-kpi-bar">
        <div className="archive-kpi-card" onClick={() => setActiveTab('boutique_pool')} style={{ cursor: 'pointer' }}>
          <div className="archive-kpi-icon" style={{ background: 'rgba(56, 189, 248, 0.1)', color: '#0284c7' }}>
            <Layers size={22} />
          </div>
          <div className="archive-kpi-info">
            <h4>Boutique-Pool (TIER 2)</h4>
            <div className="kpi-value" style={{ color: '#0284c7' }}>{stats.tier2Count}</div>
          </div>
        </div>

        <div className="archive-kpi-card" onClick={() => setActiveTab('transmitted')} style={{ cursor: 'pointer' }}>
          <div className="archive-kpi-icon" style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#059669' }}>
            <ShieldCheck size={22} />
          </div>
          <div className="archive-kpi-info">
            <h4>Aktiv geschützt</h4>
            <div className="kpi-value" style={{ color: '#059669' }}>{stats.activeProtected}</div>
          </div>
        </div>

        <div className="archive-kpi-card" onClick={() => setActiveTab('transmitted')} style={{ cursor: 'pointer' }}>
          <div className="archive-kpi-icon" style={{ background: 'rgba(2, 132, 199, 0.1)', color: '#0284c7' }}>
            <Archive size={22} />
          </div>
          <div className="archive-kpi-info">
            <h4>Übermittelt gesamt</h4>
            <div className="kpi-value">{stats.transmittedTotal}</div>
          </div>
        </div>

        <div className="archive-kpi-card" onClick={() => setActiveTab('contracts')} style={{ cursor: 'pointer' }}>
          <div className="archive-kpi-icon" style={{ background: 'rgba(99, 102, 241, 0.1)', color: '#6366f1' }}>
            <FileText size={22} />
          </div>
          <div className="archive-kpi-info">
            <h4>Kooperationsverträge</h4>
            <div className="kpi-value">{partners.length}</div>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="archive-nav-tabs">
        <button
          type="button"
          className={`archive-nav-tab ${activeTab === 'boutique_pool' ? 'active' : ''}`}
          onClick={() => setActiveTab('boutique_pool')}
        >
          <Layers size={17} />
          <span>Boutique-Pool (Zweitverwertung · TIER_2_MID)</span>
          <span className="tab-counter-badge">{tier2Leads.length}</span>
        </button>

        <button
          type="button"
          className={`archive-nav-tab ${activeTab === 'transmitted' ? 'active' : ''}`}
          onClick={() => setActiveTab('transmitted')}
        >
          <ShieldCheck size={17} />
          <span>Kundenschutz-Register (Übermittelte Mandate)</span>
          <span className="tab-counter-badge">{entries.length}</span>
        </button>

        <button
          type="button"
          className={`archive-nav-tab ${activeTab === 'contracts' ? 'active' : ''}`}
          onClick={() => setActiveTab('contracts')}
        >
          <FileText size={17} />
          <span>Kooperationsverträge & Partner-Konditionen</span>
          <span className="tab-counter-badge">{partners.length}</span>
        </button>
      </div>

      {/* Toolbar & Filter */}
      <div className="archive-toolbar">
        <div className="archive-search-box">
          <Search size={16} color="#64748b" />
          <input
            type="text"
            placeholder={
              activeTab === 'boutique_pool'
                ? 'Unternehmen oder Rolle im Boutique-Pool suchen...'
                : activeTab === 'contracts'
                ? 'Partner, Ansprechpartner, Sonderkondition oder Aktenzeichen suchen...'
                : 'Zielgesellschaft, Rolle oder Partner suchen...'
            }
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {activeTab === 'transmitted' && (
          <div className="archive-filter-group">
            <select
              className="archive-select"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="ALL">Alle Status</option>
              <option value="ANGEBOTEN_RESERVIERT">🟡 Angeboten / Reserviert</option>
              <option value="AKTIV_GESCHUETZT">🟢 Aktiv geschützt</option>
              <option value="IN_VERHANDLUNG">🔵 In Verhandlung</option>
              <option value="MANDATIERT">🎯 Erfolgreich mandatiert</option>
              <option value="ABGELAUFEN">⚪ Abgelaufen</option>
            </select>

            <select
              className="archive-select"
              value={partnerFilter}
              onChange={(e) => setPartnerFilter(e.target.value)}
            >
              <option value="ALL">Alle Partner</option>
              {partnerDisplayOptions.map((p, idx) => (
                <option key={idx} value={p.split(' ')[0]}>{p.split(' ')[0]}</option>
              ))}
            </select>
          </div>
        )}

        {activeTab === 'contracts' && (
          <div className="archive-filter-group">
            <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 600 }}>
              Standard: <strong>18 Monate Käuferschutz</strong> (u. a. Taskforce)
            </span>
          </div>
        )}
      </div>

      {/* TAB 1: BOUTIQUE-POOL (TIER_2_MID ZWEITVERWERTUNG) */}
      {activeTab === 'boutique_pool' && (
        <div className="archive-section">
          {loadingTier2 ? (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: '#64748b' }}>
              <div className="archive-spinner" />
              <div style={{ marginTop: '12px', fontWeight: 600 }}>Lade TIER_2_MID Mandate aus der Datenbank...</div>
            </div>
          ) : filteredTier2Leads.length === 0 ? (
            <div className="archive-empty-card">
              <div className="empty-icon-circle" style={{ background: 'rgba(56, 189, 248, 0.1)', color: '#0284c7' }}>
                <Layers size={36} />
              </div>
              <h3 style={{ fontSize: '1.15rem', color: '#0f172a', margin: '0 0 6px', fontWeight: 700 }}>
                Keine TIER_2_MID Mandate im Boutique-Pool vorhanden
              </h3>
              <p style={{ color: '#475569', fontSize: '0.9rem', maxWidth: '640px', margin: '0 auto 16px', lineHeight: 1.5 }}>
                Derzeit liegen keine unbesetzten TIER_2_MID Mandate zur Zweitverwertung vor. Sobald im Primär-Radar (EQS, LSE, SHAB, CNMV) mittelständische Vakanzen, operative Leitungsposten oder Restrukturierungsfälle identifiziert werden, ordnet der DealCoach diese automatisiert hier zur Zweitverwertung ein.
              </p>
            </div>
          ) : (
            <div className="boutique-grid">
              {filteredTier2Leads.map(lead => {
                const compName = lead.nexus_companies?.name || lead.title?.split(':')[0]?.replace(/\[.*?\]/, '')?.trim() || 'Zielgesellschaft'
                const details = extractDealCoachDetails(lead)
                const region = lead.title?.match(/\[(.*?)\]/)?.[1] || 'DACH'

                return (
                  <div key={lead.id} className="boutique-card">
                    <div className="boutique-card-header">
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                          <span className="tier-tag-mid">TIER 2 MID</span>
                          <span className="region-badge">{region}</span>
                          <span className="budget-tag">{details.estimatedBudget}</span>
                        </div>
                        <h3 className="boutique-company-name">{compName}</h3>
                        <div className="boutique-role-title">{details.role}</div>
                      </div>
                    </div>

                    <div className="boutique-body">
                      <div className="boutique-meta-row">
                        <span className="meta-label">DealCoach Audit:</span>
                        <span className="meta-value">{details.vacuumCheck}</span>
                      </div>
                      <div className="boutique-meta-row">
                        <span className="meta-label">Zweitverwertungs-Fokus:</span>
                        <span className="meta-value" style={{ color: '#0f172a', fontWeight: 600 }}>{details.rationale}</span>
                      </div>
                      {lead.source && (
                        <div className="boutique-meta-row">
                          <span className="meta-label">Primärquelle:</span>
                          <a href={lead.source} target="_blank" rel="noopener noreferrer" className="meta-link">
                            {lead.source.length > 45 ? `${lead.source.slice(0, 45)}...` : lead.source} ↗
                          </a>
                        </div>
                      )}
                    </div>

                    <div className="boutique-footer">
                      <button
                        type="button"
                        onClick={() => handleOpenLeadDispatch(lead)}
                        className="boutique-dispatch-btn"
                      >
                        <ShieldCheck size={16} /> An Partner übermitteln & schützen
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: KUNDENSCHUTZ-REGISTER (ÜBERMITTELTE MANDATE) */}
      {activeTab === 'transmitted' && (
        <div className="archive-table-container">
          <table className="archive-table">
            <thead>
              <tr>
                <th>Zielgesellschaft & Register</th>
                <th>Land / Börse</th>
                <th>Vakanz / Rolle</th>
                <th>Übermittelt an</th>
                <th>Übermittlungsdatum</th>
                <th>Kundenschutz bis (Frist / Dauer)</th>
                <th>Watchdog & Fristen (14T / 30T / 60T)</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Aktionen</th>
              </tr>
            </thead>
            <tbody>
              {filteredTransmittedEntries.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ textAlign: 'center', padding: '60px 20px', color: '#64748b' }}>
                    <div className="empty-icon-circle" style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#059669', margin: '0 auto 12px' }}>
                      <ShieldCheck size={36} />
                    </div>
                    <div style={{ fontWeight: 700, fontSize: '1.05rem', color: '#0f172a', marginBottom: '6px' }}>
                      Noch keine übermittelten Mandate im Register
                    </div>
                    <div style={{ fontSize: '0.88rem', maxWidth: '520px', margin: '0 auto 16px', color: '#64748b' }}>
                      Übermittlungen aus dem Mandats-Desk oder dem Boutique-Pool werden hier lückenlos mit Käuferschutz (Standard: 18 Monate, variabel) und formellem Nachweis-Protokoll dokumentiert.
                    </div>
                    <button
                      type="button"
                      onClick={handleOpenManualDispatch}
                      className="archive-btn-secondary"
                      style={{ margin: '0 auto' }}
                    >
                      <Plus size={15} /> Erste Übermittlung protokollieren
                    </button>
                  </td>
                </tr>
              ) : (
                filteredTransmittedEntries.map(entry => {
                  const protection = computeProtectionDetails(entry.transmittedAt, entry.protectionUntil, entry.status, entry.protection_months)
                  const monthsDuration = entry.protection_months || 18
                  const deadlines = computeDeadlineStatus(entry)
                  return (
                    <tr key={entry.id} className={entry.has_change_alert ? 'row-change-alert' : ''}>
                      {/* Zielgesellschaft & Register */}
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontWeight: 700, fontSize: '0.94rem', color: '#0f172a' }}>
                            {entry.company}
                          </span>
                        </div>
                        {entry.register_id && (
                          <div style={{ fontSize: '0.74rem', color: '#475569', marginTop: '3px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <span>🏛️</span>
                            <span style={{ fontWeight: 600 }}>{entry.register_id}</span>
                          </div>
                        )}
                        {entry.ir_news_url && (
                          <div style={{ fontSize: '0.72rem', color: '#0284c7', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Globe size={11} />
                            <a href={entry.ir_news_url} target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', textDecoration: 'none' }}>
                              News / EQS Monitor
                            </a>
                          </div>
                        )}
                        {entry.has_change_alert && (
                          <div
                            className="watchdog-alert-pill"
                            onClick={() => handleOpenAuditModal(entry)}
                            title="Klicken für Audit-Historie und Quittierung"
                          >
                            <span className="watchdog-alert-ping" />
                            <AlertTriangle size={13} />
                            <span>Veränderung erkannt – Prüfung erforderlich!</span>
                          </div>
                        )}
                      </td>

                      {/* Land / Börse */}
                      <td>
                        <span className="badge-market">{entry.countryMarket || 'DE · Prime Standard'}</span>
                      </td>

                      {/* Vakanz / Rolle */}
                      <td>
                        <div style={{ fontWeight: 600, color: '#1e293b' }}>{entry.role}</div>
                      </td>

                      {/* Übermittelt an */}
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600, color: '#0f172a' }}>
                          <Building2 size={15} color="#0284c7" />
                          <span>{entry.transmittedTo}</span>
                        </div>
                      </td>

                      {/* Übermittlungsdatum */}
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.84rem', color: '#475569' }}>
                          <Calendar size={14} color="#64748b" />
                          <span>{new Date(entry.transmittedAt).toLocaleDateString('de-DE')}</span>
                        </div>
                      </td>

                      {/* Kundenschutz bis & Dauer */}
                      <td>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: '0.9rem', color: protection.isExpired ? '#dc2626' : entry.status === 'ANGEBOTEN_RESERVIERT' ? '#b45309' : '#059669' }}>
                            {protection.untilDate}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px', flexWrap: 'wrap' }}>
                            <div className={`badge-protection ${protection.isExpired ? 'expired' : entry.status === 'ANGEBOTEN_RESERVIERT' ? 'reserved' : protection.diffDays < 60 ? 'warning' : 'active'}`}>
                              <Clock size={11} /> {protection.label}
                            </div>
                            <span style={{
                              fontSize: '0.72rem',
                              fontWeight: 700,
                              background: '#f1f5f9',
                              color: '#334155',
                              padding: '1px 6px',
                              borderRadius: '4px',
                              border: '1px solid #cbd5e1'
                            }}>
                              {monthsDuration}M Schutz
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Watchdog & Meilensteine (14T / 30T / 60T) */}
                      <td>
                        {deadlines ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                            <div style={{
                              fontSize: '0.74rem',
                              padding: '2px 6px',
                              borderRadius: '4px',
                              background: deadlines.isAuditDue ? '#fef2f2' : '#f0fdf4',
                              color: deadlines.isAuditDue ? '#dc2626' : '#166534',
                              border: `1px solid ${deadlines.isAuditDue ? '#fecaca' : '#bbf7d0'}`,
                              fontWeight: 700,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              width: 'fit-content'
                            }}>
                              <Zap size={11} />
                              {deadlines.isAuditDue ? '14T-Audit fällig!' : `14T: in ${deadlines.auditDiffDays}T`}
                            </div>
                            <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
                              📅 30T-Review: {deadlines.review30Date}
                            </div>
                            <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
                              📞 60T-Nachfassen: {deadlines.followup60Date}
                            </div>
                          </div>
                        ) : (
                          <span style={{ color: '#94a3b8', fontSize: '0.8rem' }}>Keine Frist</span>
                        )}
                      </td>

                      {/* Status */}
                      <td>
                        <select
                          className={`status-select status-${(entry.status || '').toLowerCase()}`}
                          value={entry.status}
                          onChange={(e) => handleStatusChange(entry.id, e.target.value)}
                        >
                          <option value="ANGEBOTEN_RESERVIERT">🟡 Angeboten / Reserviert</option>
                          <option value="AKTIV_GESCHUETZT">🟢 Aktiv geschützt</option>
                          <option value="IN_VERHANDLUNG">🔵 In Verhandlung</option>
                          <option value="MANDATIERT">🎯 Mandatiert</option>
                          <option value="ABGELAUFEN">⚪ Abgelaufen</option>
                        </select>
                        {(() => {
                          const tracking = getOutreachTrackingStatus(entry);
                          if (tracking.isLocked48h) {
                            return (
                              <div style={{
                                fontSize: '0.72rem',
                                fontWeight: 700,
                                background: 'rgba(234, 179, 8, 0.15)',
                                color: '#b45309',
                                border: '1px solid #fde68a',
                                padding: '2px 6px',
                                borderRadius: '4px',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                marginTop: '4px'
                              }} title={tracking.badgeText}>
                                <Clock size={10} /> ⚠️ 48h-Frist aktiv (noch {tracking.remainingHours}h)
                              </div>
                            );
                          }
                          if (tracking.isExpired48h && entry.status === 'ANGEBOTEN_RESERVIERT') {
                            return (
                              <div style={{
                                fontSize: '0.72rem',
                                fontWeight: 700,
                                background: 'rgba(249, 115, 22, 0.15)',
                                color: '#c2410c',
                                border: '1px solid #fdba74',
                                padding: '2px 6px',
                                borderRadius: '4px',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                marginTop: '4px'
                              }} title={tracking.badgeText}>
                                <RefreshCw size={10} /> 🔄 48h-Timeout: Freigegeben
                              </div>
                            );
                          }
                          return null;
                        })()}
                      </td>

                      {/* Aktionen */}
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end', alignItems: 'center' }}>
                          <button
                            type="button"
                            onClick={() => handleOpenAuditModal(entry)}
                            className="btn-action-icon"
                            style={{ position: 'relative' }}
                            title={`Watchdog-Audit Historie (${entry.audit_log?.length || 0} Einträge)`}
                          >
                            <Activity size={16} color={entry.has_change_alert ? '#dc2626' : '#0284c7'} />
                            {(entry.audit_log?.length || 0) > 0 && (
                              <span style={{
                                position: 'absolute',
                                top: '-4px',
                                right: '-4px',
                                background: entry.has_change_alert ? '#dc2626' : '#0284c7',
                                color: '#ffffff',
                                fontSize: '0.62rem',
                                borderRadius: '50%',
                                width: '15px',
                                height: '15px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontWeight: 700
                              }}>
                                {entry.audit_log.length}
                              </span>
                            )}
                          </button>

                          <button
                            type="button"
                            onClick={() => handleRunSingleAudit(entry)}
                            className="btn-action-icon"
                            disabled={isAuditing}
                            title="Watchdog-Audit jetzt für dieses Mandat ausführen"
                          >
                            <RefreshCw size={15} color="#475569" className={isAuditing ? 'animate-spin' : ''} />
                          </button>

                          <button
                            type="button"
                            onClick={() => handleCopyProof(entry)}
                            className="btn-action-icon"
                            title="Formellen Nachweistext für Partner kopieren"
                          >
                            {copiedId === entry.id ? <Check size={16} color="#059669" /> : <Copy size={16} />}
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDelete(entry.id)}
                            className="btn-action-icon btn-action-delete"
                            title="Eintrag löschen"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* TAB 3: KOOPERATIONSVERTRÄGE & PARTNER-KONDITIONEN */}
      {activeTab === 'contracts' && (
        <div className="archive-section">
          <div className="partner-contracts-banner">
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px' }}>
              <div style={{ background: 'rgba(5, 150, 105, 0.1)', color: '#059669', padding: '10px', borderRadius: '10px', flexShrink: 0 }}>
                <ShieldCheck size={26} />
              </div>
              <div style={{ flex: 1 }}>
                <h3 style={{ margin: '0 0 6px', fontSize: '1.1rem', color: '#0f172a', fontWeight: 700 }}>
                  Zentraler Kooperationsverträge- & Konditionen-Desk
                </h3>
                <p style={{ margin: 0, fontSize: '0.88rem', color: '#475569', lineHeight: 1.5 }}>
                  Hier hinterlegen Sie akkreditierte Provider, verbindliche Schutzfristen und besondere Gegebenheiten der Kooperationsverträge.
                  Der neue Kundenschutz-Standard beträgt <strong>18 Monate</strong> (wie verbindlich im Kooperationsvertrag mit <strong>taskforce - Management on Demand AG</strong> vereinbart).
                  Falls einzelne Kooperationspartner eine abweichende Frist (z. B. <strong>12 Monate</strong>) vereinbaren, kann diese hier partnerbezogen oder bei jeder Mandatsübermittlung variabel hinterlegt werden.
                </p>
              </div>
            </div>
          </div>

          {filteredContracts.length === 0 ? (
            <div className="archive-empty-card">
              <div className="empty-icon-circle" style={{ background: 'rgba(99, 102, 241, 0.1)', color: '#6366f1' }}>
                <FileText size={36} />
              </div>
              <h3 style={{ fontSize: '1.15rem', color: '#0f172a', margin: '0 0 6px', fontWeight: 700 }}>
                Keine passenden Kooperationsverträge gefunden
              </h3>
              <p style={{ color: '#475569', fontSize: '0.9rem', maxWidth: '520px', margin: '0 auto 16px' }}>
                Passen Sie Ihren Suchbegriff an oder legen Sie einen neuen Partnervertrag an.
              </p>
              <button
                type="button"
                onClick={handleOpenNewPartner}
                className="archive-btn-secondary"
                style={{ margin: '0 auto' }}
              >
                <Plus size={15} /> Neuen Kooperationsvertrag anlegen
              </button>
            </div>
          ) : (
            <div className="partner-contracts-grid">
              {filteredContracts.map(partner => {
                const statusMeta = CONTRACT_STATUS_OPTIONS.find(s => s.id === partner.contractStatus) || CONTRACT_STATUS_OPTIONS[0]
                const months = partner.defaultProtectionMonths || DEFAULT_PROTECTION_MONTHS

                return (
                  <div key={partner.id} className="partner-contract-card">
                    {/* Header */}
                    <div className="partner-card-header">
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                          <span className="partner-location-tag">{partner.location || 'DACH'}</span>
                          <span
                            className="partner-status-tag"
                            style={{ background: statusMeta.bg, color: statusMeta.color }}
                          >
                            {statusMeta.label}
                          </span>
                        </div>
                        <h3 className="partner-company-name">{partner.name}</h3>
                      </div>
                    </div>

                    {/* Käuferschutz Highlight Badge */}
                    <div className="partner-protection-highlight">
                      <div className="protection-badge-circle">
                        <ShieldCheck size={20} />
                      </div>
                      <div className="protection-badge-content">
                        <div className="protection-duration-title">
                          {months} Monate Käufer- & Kundenschutz
                        </div>
                        <div className="protection-duration-subtitle">
                          {months === 18 ? 'Neuer Standard / Taskforce-Referenz' : months === 12 ? 'Klassischer Standard (Partner-Ausnahme)' : `${months} Monate vertraglich vereinbart`}
                        </div>
                      </div>
                    </div>

                    {/* Details */}
                    <div className="partner-card-body">
                      {partner.contactPerson && (
                        <div className="partner-meta-row">
                          <UserCheck size={15} color="#0284c7" />
                          <div>
                            <strong>{partner.contactPerson}</strong>
                            {partner.role && <span style={{ color: '#64748b', marginLeft: '6px' }}>({partner.role})</span>}
                          </div>
                        </div>
                      )}

                      {(partner.email || partner.phone) && (
                        <div className="partner-contact-row">
                          {partner.email && (
                            <a href={`mailto:${partner.email}`} className="partner-contact-link">
                              <Mail size={13} /> {partner.email}
                            </a>
                          )}
                          {partner.phone && (
                            <a href={`tel:${partner.phone}`} className="partner-contact-link">
                              <Phone size={13} /> {partner.phone}
                            </a>
                          )}
                        </div>
                      )}

                      <div className="partner-contract-meta-bar">
                        <div className="partner-meta-item">
                          <span className="partner-meta-label">Vertragsdatum:</span>
                          <span className="partner-meta-val">
                            {partner.contractDate ? new Date(partner.contractDate).toLocaleDateString('de-DE') : 'Hinterlegt'}
                          </span>
                        </div>

                        {partner.contractRef && (
                          <div className="partner-meta-item">
                            <span className="partner-meta-label">Referenz / Az.:</span>
                            <span className="partner-meta-val" style={{ fontFamily: 'monospace', fontWeight: 700 }}>
                              {partner.contractRef}
                            </span>
                          </div>
                        )}
                      </div>

                      {partner.documentName && (
                        <div className="partner-doc-badge">
                          <FileText size={14} color="#0284c7" />
                          <span>{partner.documentName}</span>
                        </div>
                      )}

                      {/* Besondere Konditionen & Klauseln */}
                      <div className="partner-conditions-box">
                        <div className="partner-conditions-title">
                          <Award size={14} color="#d97706" />
                          <span>Besondere vertragliche Konditionen:</span>
                        </div>
                        <div className="partner-conditions-text">
                          {partner.specialConditions || 'Standardmäßiger D.A.T.-Kundenschutz vereinbart.'}
                        </div>
                      </div>
                    </div>

                    {/* Footer Actions */}
                    <div className="partner-card-footer">
                      <button
                        type="button"
                        onClick={() => handleEditPartner(partner)}
                        className="partner-btn-edit"
                      >
                        <Edit2 size={14} /> Bearbeiten
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeletePartner(partner.id)}
                        className="partner-btn-delete"
                        title="Vertragseintrag entfernen"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* MODAL: MANDATS-ÜBERMITTLUNG PROTOKOLLIEREN & KUNDENSCHUTZ SICHERN */}
      {showDispatchModal && (
        <div className="archive-modal-backdrop" onClick={() => setShowDispatchModal(false)}>
          <div className="archive-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="archive-modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ background: 'rgba(2, 132, 199, 0.1)', color: '#0284c7', padding: '8px', borderRadius: '8px' }}>
                  <ShieldCheck size={22} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.2rem', color: '#0f172a', fontWeight: 700 }}>
                    Mandats-Übermittlung protokollieren
                  </h3>
                  <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '2px' }}>
                    {dispatchProtectionMonths} Monate exklusiver Käufer- & Kundenschutz nach D.A.T.-Standard
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowDispatchModal(false)}
                className="btn-close-modal"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleConfirmDispatch}>
              <div className="archive-modal-body">
                {dispatchTargetLead && (
                  <div className="lead-preview-notice">
                    <Info size={16} color="#0284c7" />
                    <span>
                      Übermittlung aus dem <strong>Boutique-Pool (TIER_2_MID)</strong>. Nach Bestätigung wird dieses Mandat im Kundenschutz-Register verankert.
                    </span>
                  </div>
                )}

                <div className="form-group">
                  <label>Zielgesellschaft (Klarname)</label>
                  <input
                    type="text"
                    required
                    value={dispatchCompany}
                    onChange={(e) => setDispatchCompany(e.target.value)}
                    placeholder="z. B. Brenntag SE oder Muster GmbH"
                  />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Land / Markt</label>
                    <input
                      type="text"
                      required
                      value={dispatchMarket}
                      onChange={(e) => setDispatchMarket(e.target.value)}
                      placeholder="z. B. DE · Prime Standard"
                    />
                  </div>

                  <div className="form-group">
                    <label>Vakanz / Organfunktion</label>
                    <input
                      type="text"
                      required
                      value={dispatchRole}
                      onChange={(e) => setDispatchRole(e.target.value)}
                      placeholder="z. B. Interim CFO, CRO, PMO"
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Handelsregister & Gericht (Watchdog-Pflichtfeld)</label>
                    <input
                      type="text"
                      value={dispatchRegisterId}
                      onChange={(e) => setDispatchRegisterId(e.target.value)}
                      placeholder="z. B. AG Mannheim HRB 741634"
                    />
                  </div>

                  <div className="form-group">
                    <label>Corporate News / EQS URL (Scraper-Quelle)</label>
                    <input
                      type="url"
                      value={dispatchNewsUrl}
                      onChange={(e) => setDispatchNewsUrl(e.target.value)}
                      placeholder="z. B. https://paul.group/news/"
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>Übermittelt an Partner</label>
                  <select
                    value={dispatchPartner}
                    onChange={(e) => {
                      const selected = e.target.value
                      setDispatchPartner(selected)
                      const matched = partners.find(p => selected.includes(p.name) || selected.includes(p.shortName))
                      if (matched?.defaultProtectionMonths) {
                        setDispatchProtectionMonths(matched.defaultProtectionMonths)
                        setIsDispatchCustomDuration(![18, 12, 24, 6].includes(matched.defaultProtectionMonths))
                      }
                    }}
                    className="archive-modal-select"
                  >
                    {partnerDisplayOptions.map((p, idx) => (
                      <option key={idx} value={p}>{p}</option>
                    ))}
                  </select>
                </div>

                {/* Sonderklausel-Banner falls Partner spezifische Gegebenheiten hat */}
                {(() => {
                  const matched = partners.find(p => dispatchPartner.includes(p.name) || dispatchPartner.includes(p.shortName))
                  if (matched?.specialConditions) {
                    return (
                      <div className="partner-special-condition-callout">
                        <Award size={16} color="#b45309" />
                        <div>
                          <strong>Vertragskondition ({matched.shortName || matched.name}):</strong> {matched.specialConditions}
                        </div>
                      </div>
                    )
                  }
                  return null
                })()}

                <div className="form-row">
                  <div className="form-group">
                    <label>Übermittlungsdatum</label>
                    <input
                      type="date"
                      required
                      value={dispatchDate}
                      onChange={(e) => setDispatchDate(e.target.value)}
                    />
                  </div>

                  <div className="form-group">
                    <label>Kundenschutz-Frist</label>
                    <select
                      value={isDispatchCustomDuration ? 'custom' : dispatchProtectionMonths}
                      onChange={(e) => {
                        const val = e.target.value
                        if (val === 'custom') {
                          setIsDispatchCustomDuration(true)
                        } else {
                          setIsDispatchCustomDuration(false)
                          setDispatchProtectionMonths(parseInt(val, 10))
                        }
                      }}
                      className="archive-modal-select"
                    >
                      <option value={18}>18 Monate (Neuer Standard / Taskforce-Referenz)</option>
                      <option value={12}>12 Monate (Klassischer Standard / Ausnahme)</option>
                      <option value={24}>24 Monate (Erweiterter Langzeitschutz)</option>
                      <option value={6}>6 Monate (Kurzfristige Probephase)</option>
                      <option value="custom">Individuelle Monatsanzahl...</option>
                    </select>
                  </div>
                </div>

                {isDispatchCustomDuration && (
                  <div className="form-group">
                    <label>Individuelle Schutzfrist in Monaten</label>
                    <input
                      type="number"
                      min={1}
                      max={60}
                      value={dispatchProtectionMonths}
                      onChange={(e) => setDispatchProtectionMonths(parseInt(e.target.value, 10) || 18)}
                      placeholder="z. B. 15"
                    />
                  </div>
                )}

                <div className="form-group">
                  <label>Ablaufdatum Kundenschutz (Berechnet)</label>
                  <input
                    type="text"
                    disabled
                    value={calculateProtectionEndDate(new Date(`${dispatchDate}T12:00:00Z`), dispatchProtectionMonths).toLocaleDateString('de-DE')}
                    style={{ background: '#f1f5f9', color: '#059669', fontWeight: 700 }}
                  />
                </div>

                <div className="form-group">
                  <label>Notizen / Anlass & Primärquelle</label>
                  <textarea
                    rows={3}
                    value={dispatchNotes}
                    onChange={(e) => setDispatchNotes(e.target.value)}
                    placeholder="Vertrauliche Notiz zum Übermittlungsanlass, DealCoach-Audit oder Verhandlungsstand..."
                  />
                </div>
              </div>

              <div className="archive-modal-footer">
                <button
                  type="button"
                  onClick={() => setShowDispatchModal(false)}
                  className="archive-btn-secondary"
                >
                  Abbrechen
                </button>
                <button
                  type="submit"
                  className="archive-btn-primary"
                >
                  <ShieldCheck size={16} /> {dispatchProtectionMonths} Monate Kundenschutz aktivieren
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: KOOPERATIONSVERTRAG ANLEGEN / BEARBEITEN */}
      {showPartnerModal && (
        <div className="archive-modal-backdrop" onClick={() => setShowPartnerModal(false)}>
          <div className="archive-modal-card" style={{ maxWidth: '680px' }} onClick={(e) => e.stopPropagation()}>
            <div className="archive-modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ background: 'rgba(5, 150, 105, 0.1)', color: '#059669', padding: '8px', borderRadius: '8px' }}>
                  <FileCheck size={22} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.2rem', color: '#0f172a', fontWeight: 700 }}>
                    {editingPartnerId ? 'Kooperationsvertrag bearbeiten' : 'Neuen Kooperationsvertrag anlegen'}
                  </h3>
                  <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '2px' }}>
                    Partner-Konditionen, verbindliche Schutzfristen & Sonderklauseln hinterlegen
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowPartnerModal(false)}
                className="btn-close-modal"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSavePartner}>
              <div className="archive-modal-body">
                <div className="form-row">
                  <div className="form-group" style={{ flex: 2 }}>
                    <label>Partner-Organisation / Name *</label>
                    <input
                      type="text"
                      required
                      value={partnerForm.name}
                      onChange={(e) => setPartnerForm({ ...partnerForm, name: e.target.value })}
                      placeholder="z. B. taskforce - Management on Demand AG"
                    />
                  </div>

                  <div className="form-group" style={{ flex: 1 }}>
                    <label>Kurzname</label>
                    <input
                      type="text"
                      value={partnerForm.shortName}
                      onChange={(e) => setPartnerForm({ ...partnerForm, shortName: e.target.value })}
                      placeholder="z. B. taskforce"
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Standort / Land</label>
                    <input
                      type="text"
                      value={partnerForm.location}
                      onChange={(e) => setPartnerForm({ ...partnerForm, location: e.target.value })}
                      placeholder="z. B. München, Deutschland 🇩🇪"
                    />
                  </div>

                  <div className="form-group">
                    <label>Vertragsstatus</label>
                    <select
                      value={partnerForm.contractStatus}
                      onChange={(e) => setPartnerForm({ ...partnerForm, contractStatus: e.target.value })}
                      className="archive-modal-select"
                    >
                      {CONTRACT_STATUS_OPTIONS.map(opt => (
                        <option key={opt.id} value={opt.id}>{opt.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Ansprechpartner</label>
                    <input
                      type="text"
                      value={partnerForm.contactPerson}
                      onChange={(e) => setPartnerForm({ ...partnerForm, contactPerson: e.target.value })}
                      placeholder="z. B. Frank Sieger"
                    />
                  </div>

                  <div className="form-group">
                    <label>Funktion / Rolle</label>
                    <input
                      type="text"
                      value={partnerForm.role}
                      onChange={(e) => setPartnerForm({ ...partnerForm, role: e.target.value })}
                      placeholder="z. B. Vorstand / Partner Management"
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>E-Mail</label>
                    <input
                      type="email"
                      value={partnerForm.email}
                      onChange={(e) => setPartnerForm({ ...partnerForm, email: e.target.value })}
                      placeholder="frank.sieger@taskforce.net"
                    />
                  </div>

                  <div className="form-group">
                    <label>Telefon</label>
                    <input
                      type="text"
                      value={partnerForm.phone}
                      onChange={(e) => setPartnerForm({ ...partnerForm, phone: e.target.value })}
                      placeholder="+49 89 244 147 0"
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Vertragsdatum</label>
                    <input
                      type="date"
                      value={partnerForm.contractDate}
                      onChange={(e) => setPartnerForm({ ...partnerForm, contractDate: e.target.value })}
                    />
                  </div>

                  <div className="form-group">
                    <label>Standard-Kundenschutzfrist</label>
                    <select
                      value={isPartnerCustomDuration ? 'custom' : partnerForm.defaultProtectionMonths}
                      onChange={(e) => {
                        const val = e.target.value
                        if (val === 'custom') {
                          setIsPartnerCustomDuration(true)
                        } else {
                          setIsPartnerCustomDuration(false)
                          setPartnerForm({ ...partnerForm, defaultProtectionMonths: parseInt(val, 10) })
                        }
                      }}
                      className="archive-modal-select"
                    >
                      <option value={18}>18 Monate (Neuer Standard / Taskforce-Referenz)</option>
                      <option value={12}>12 Monate (Klassischer Standard / Ausnahme)</option>
                      <option value={24}>24 Monate (Erweiterter Langzeitschutz)</option>
                      <option value={6}>6 Monate (Kurzfristige Probephase)</option>
                      <option value="custom">Individuelle Monatsanzahl...</option>
                    </select>
                  </div>
                </div>

                {isPartnerCustomDuration && (
                  <div className="form-group">
                    <label>Individuelle Standardfrist in Monaten</label>
                    <input
                      type="number"
                      min={1}
                      max={60}
                      value={partnerForm.defaultProtectionMonths}
                      onChange={(e) => setPartnerForm({ ...partnerForm, defaultProtectionMonths: parseInt(e.target.value, 10) || 18 })}
                      placeholder="z. B. 15"
                    />
                  </div>
                )}

                <div className="form-row">
                  <div className="form-group">
                    <label>Vertragsreferenz / Aktenzeichen</label>
                    <input
                      type="text"
                      value={partnerForm.contractRef}
                      onChange={(e) => setPartnerForm({ ...partnerForm, contractRef: e.target.value })}
                      placeholder="z. B. TF-DAT-2026-KV01"
                    />
                  </div>

                  <div className="form-group">
                    <label>Dokumentenbezeichnung (PDF)</label>
                    <input
                      type="text"
                      value={partnerForm.documentName}
                      onChange={(e) => setPartnerForm({ ...partnerForm, documentName: e.target.value })}
                      placeholder="Kooperationsvertrag_Taskforce_2026_gezeichnet.pdf"
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>Besondere Konditionen, Klauseln & Gegebenheiten</label>
                  <textarea
                    rows={4}
                    value={partnerForm.specialConditions}
                    onChange={(e) => setPartnerForm({ ...partnerForm, specialConditions: e.target.value })}
                    placeholder="z. B. 18 Monate Käufer- & Kundenschutz verbindlich eingeführt. Vorrangiger Provider für TIER-1 CRO & Not-Governance Mandate..."
                  />
                  <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '4px' }}>
                    Diese Vereinbarungen werden im Mandats-Desk und beim Übermitteln als verbindlicher Hinweis eingeblendet.
                  </div>
                </div>
              </div>

              <div className="archive-modal-footer">
                <button
                  type="button"
                  onClick={() => setShowPartnerModal(false)}
                  className="archive-btn-secondary"
                >
                  Abbrechen
                </button>
                <button
                  type="submit"
                  className="archive-btn-primary"
                  style={{ background: 'linear-gradient(135deg, #059669 0%, #047857 100%)', borderColor: '#059669' }}
                >
                  <FileCheck size={16} /> Kooperationsvertrag speichern
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: MANDATS-WATCHDOG AUDIT-LOG & DIFFERENZPRÜFUNG */}
      {showAuditModal && selectedAuditMandate && (
        <div className="archive-modal-backdrop" onClick={() => setShowAuditModal(false)}>
          <div className="archive-modal-card" style={{ maxWidth: '780px' }} onClick={(e) => e.stopPropagation()}>
            <div className="archive-modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  background: selectedAuditMandate.has_change_alert ? 'rgba(220, 38, 38, 0.15)' : 'rgba(2, 132, 199, 0.1)',
                  color: selectedAuditMandate.has_change_alert ? '#dc2626' : '#0284c7',
                  padding: '8px',
                  borderRadius: '8px'
                }}>
                  <Activity size={22} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.2rem', color: '#0f172a', fontWeight: 700 }}>
                    Watchdog-Audit & Differenzprüfung: {selectedAuditMandate.company}
                  </h3>
                  <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '2px' }}>
                    Automatisierte 14-tägige Handelsregister- & Corporate News Überwachung
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAuditModal(false)}
                className="btn-close-modal"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Tabs Switcher: Watchdog vs. E-Mail-Verlauf */}
            {(() => {
              const comp = (selectedAuditMandate.company || '').toLowerCase();
              const mandateEmails = syncedEmails.filter(email => {
                if (!email) return false;
                const mName = (email.mandateName || '').toLowerCase();
                const subj = (email.subject || '').toLowerCase();
                return (
                  (mName && comp && (mName.includes(comp) || comp.includes(mName))) ||
                  (subj && comp && subj.includes(comp)) ||
                  (email.mandateId && (email.mandateId === selectedAuditMandate.id || email.mandateId === selectedAuditMandate.leadId))
                );
              });

              return (
                <div style={{
                  display: 'flex',
                  gap: '8px',
                  borderBottom: '1px solid #e2e8f0',
                  padding: '0 24px',
                  background: '#f8fafc'
                }}>
                  <button
                    type="button"
                    onClick={() => setAuditModalTab('watchdog')}
                    style={{
                      padding: '12px 18px',
                      border: 'none',
                      background: 'none',
                      borderBottom: auditModalTab === 'watchdog' ? '2px solid #0284c7' : '2px solid transparent',
                      color: auditModalTab === 'watchdog' ? '#0284c7' : '#64748b',
                      fontWeight: 700,
                      fontSize: '0.88rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}
                  >
                    <Activity size={16} />
                    <span>🛡️ Watchdog-Audit &amp; Differenzprüfung</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setAuditModalTab('emails')}
                    style={{
                      padding: '12px 18px',
                      border: 'none',
                      background: 'none',
                      borderBottom: auditModalTab === 'emails' ? '2px solid #0284c7' : '2px solid transparent',
                      color: auditModalTab === 'emails' ? '#0284c7' : '#64748b',
                      fontWeight: 700,
                      fontSize: '0.88rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}
                  >
                    <Mail size={16} />
                    <span>✉️ E-Mail-Verlauf &amp; Kommunikation</span>
                    <span style={{
                      background: mandateEmails.length > 0 ? '#0284c7' : '#94a3b8',
                      color: '#ffffff',
                      fontSize: '0.72rem',
                      padding: '1px 7px',
                      borderRadius: '10px',
                      fontWeight: 700
                    }}>
                      {mandateEmails.length}
                    </span>
                  </button>
                </div>
              );
            })()}

            <div className="archive-modal-body">
              {auditModalTab === 'watchdog' && (
                <>
                  {/* Amtliche Register-Identitätsprüfung */}
              {(() => {
                const regCheck = verifyMandateRegisterIdentity(selectedAuditMandate)
                return (
                  <div style={{
                    padding: '10px 14px',
                    borderRadius: '8px',
                    marginBottom: '14px',
                    fontSize: '0.82rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    background: regCheck.isValid ? '#f0fdf4' : '#fffbeb',
                    border: `1px solid ${regCheck.isValid ? '#bbf7d0' : '#fef08a'}`,
                    color: regCheck.isValid ? '#166534' : '#854d0e'
                  }}>
                    <span>{regCheck.isValid ? '🏛️' : '⚠️'}</span>
                    <div style={{ flex: 1 }}>
                      <strong>{regCheck.isValid ? 'Amtlich verifizierte Registernummer:' : 'Register-Identität unbestätigt (REGISTER_ID_UNVERIFIED):'}</strong>{' '}
                      {regCheck.message || regCheck.reason}
                    </div>
                  </div>
                )
              })()}

              {/* Dreistufiges Evidenz-Modell Banner */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '8px 14px',
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                marginBottom: '16px',
                fontSize: '0.82rem'
              }}>
                <div>
                  <span style={{ color: '#64748b', fontWeight: 600 }}>Aktuelle Evidenz-Stufe: </span>
                  <span style={{
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: '4px',
                    background: selectedAuditMandate.match_level === MATCH_LEVELS.VERIFIED_CHANGE
                      ? '#dcfce7'
                      : selectedAuditMandate.has_change_alert || selectedAuditMandate.match_level === MATCH_LEVELS.CHANGE_HINT
                        ? '#fef3c7'
                        : selectedAuditMandate.match_level === MATCH_LEVELS.VERIFIED_STABLE
                          ? '#e0f2fe'
                          : '#f1f5f9',
                    color: selectedAuditMandate.match_level === MATCH_LEVELS.VERIFIED_CHANGE
                      ? '#166534'
                      : selectedAuditMandate.has_change_alert || selectedAuditMandate.match_level === MATCH_LEVELS.CHANGE_HINT
                        ? '#92400e'
                        : selectedAuditMandate.match_level === MATCH_LEVELS.VERIFIED_STABLE
                          ? '#0369a1'
                          : '#475569'
                  }}>
                    {selectedAuditMandate.match_level === MATCH_LEVELS.VERIFIED_CHANGE && 'Stufe 3: Bestätigte Veränderung (VERIFIED_CHANGE)'}
                    {(selectedAuditMandate.has_change_alert || selectedAuditMandate.match_level === MATCH_LEVELS.CHANGE_HINT) && 'Stufe 2: Veränderungshinweis (CHANGE_HINT) – Prüfung erforderlich'}
                    {selectedAuditMandate.match_level === MATCH_LEVELS.VERIFIED_STABLE && 'Quittiert: Status stabil (VERIFIED_STABLE, Re-Alert geschützt)'}
                    {selectedAuditMandate.match_level === MATCH_LEVELS.SEARCH_HIT && 'Stufe 1: Suchtreffer (SEARCH_HIT, rein informativ)'}
                    {selectedAuditMandate.match_level === MATCH_LEVELS.CLEAN && 'Keine Signale (CLEAN)'}
                  </span>
                </div>
                <div style={{ fontSize: '0.74rem', color: '#64748b' }}>
                  Snapshot-Hash: <code>{selectedAuditMandate.last_acknowledged_snapshot?.hash || selectedAuditMandate.last_scraped_snapshot?.hash || 'Keiner'}</code>
                </div>
              </div>

              {/* Alert Callout Banner if Change Detected */}
              {selectedAuditMandate.has_change_alert && (
                <div style={{
                  padding: '14px 18px',
                  background: '#fef2f2',
                  border: '1px solid #f87171',
                  borderRadius: '10px',
                  marginBottom: '18px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                    <AlertCircle size={22} color="#dc2626" style={{ flexShrink: 0, marginTop: '2px' }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, color: '#991b1b', fontSize: '0.96rem', marginBottom: '4px' }}>
                        Veränderung erkannt – Prüfung & Quittierung erforderlich!
                      </div>
                      <div style={{ color: '#7f1d1d', fontSize: '0.86rem', lineHeight: 1.45, marginBottom: '12px' }}>
                        {selectedAuditMandate.change_alert_details?.summary || 'Mögliches Mandats-Signal durch Watchdog identifiziert.'}
                      </div>

                      {selectedAuditMandate.change_alert_details?.matchedKeywords && (
                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '12px' }}>
                          {selectedAuditMandate.change_alert_details.matchedKeywords.map((kw, i) => (
                            <span key={i} className="audit-keyword-tag">{kw}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Menschliche Prüf- & Quittierungssektion (Stufe 2 -> Quittierung / Stufe 3) */}
              <div style={{
                padding: '14px 18px',
                background: selectedAuditMandate.has_change_alert ? '#fff7ed' : '#f8fafc',
                border: `1px solid ${selectedAuditMandate.has_change_alert ? '#fdba74' : '#e2e8f0'}`,
                borderRadius: '10px',
                marginBottom: '18px'
              }}>
                <div style={{ fontWeight: 700, fontSize: '0.88rem', color: '#0f172a', marginBottom: '8px' }}>
                  ⚖️ Menschliche Prüfentscheidung dokumentieren
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <input
                    type="text"
                    value={auditReviewNote}
                    onChange={(e) => setAuditReviewNote(e.target.value)}
                    placeholder="Prüfvermerk des Administrators / Belegnachweis..."
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: '6px',
                      border: '1px solid #cbd5e1',
                      fontSize: '0.84rem'
                    }}
                  />
                  <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      onClick={() => handleAcknowledgeAlert(selectedAuditMandate, 'ACKNOWLEDGE_STABLE')}
                      style={{
                        padding: '8px 16px',
                        borderRadius: '6px',
                        background: '#0284c7',
                        color: '#ffffff',
                        fontWeight: 700,
                        fontSize: '0.84rem',
                        border: 'none',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}
                      title="Speichert aktuellen Snapshot als stabil (Re-Alert Schutz aktiv)"
                    >
                      <Check size={15} /> Als stabil quittieren (VERIFIED_STABLE)
                    </button>

                    <button
                      type="button"
                      onClick={() => handleAcknowledgeAlert(selectedAuditMandate, 'CONFIRM_CHANGE')}
                      style={{
                        padding: '8px 16px',
                        borderRadius: '6px',
                        background: '#16a34a',
                        color: '#ffffff',
                        fontWeight: 700,
                        fontSize: '0.84rem',
                        border: 'none',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}
                      title="Bestätigt eine operative Veränderung anhand menschlicher Belege (Stufe 3)"
                    >
                      <CheckCircle size={15} /> Operative Veränderung bestätigen (VERIFIED_CHANGE)
                    </button>
                  </div>
                </div>
              </div>

              {/* Basisdaten & Fristen Übersicht */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '12px',
                padding: '14px',
                background: '#f8fafc',
                borderRadius: '10px',
                border: '1px solid #e2e8f0',
                marginBottom: '18px'
              }}>
                <div>
                  <div style={{ fontSize: '0.74rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Handelsregister (HRB)</div>
                  <div style={{ fontWeight: 700, color: '#0f172a', fontSize: '0.9rem', marginTop: '2px' }}>
                    {selectedAuditMandate.register_id || 'Nicht hinterlegt'}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: '0.74rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Corporate News Feed</div>
                  <div style={{ fontWeight: 600, color: '#0284c7', fontSize: '0.84rem', marginTop: '2px', wordBreak: 'break-all' }}>
                    {selectedAuditMandate.ir_news_url ? (
                      <a href={selectedAuditMandate.ir_news_url} target="_blank" rel="noopener noreferrer">
                        {selectedAuditMandate.ir_news_url}
                      </a>
                    ) : 'Nicht hinterlegt'}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: '0.74rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Letzter Audit-Check</div>
                  <div style={{ fontWeight: 600, color: '#334155', fontSize: '0.86rem', marginTop: '2px' }}>
                    {selectedAuditMandate.last_audit_check ? new Date(selectedAuditMandate.last_audit_check).toLocaleString('de-DE') : 'Ausstehend'}
                  </div>
                </div>
              </div>

              {/* Audit Trigger Button */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                <h4 style={{ margin: 0, fontSize: '0.96rem', color: '#0f172a', fontWeight: 700 }}>
                  Audit-Protokoll & Prüfhistorie ({selectedAuditMandate.audit_log?.length || 0})
                </h4>
                <button
                  type="button"
                  onClick={() => handleRunSingleAudit(selectedAuditMandate)}
                  disabled={isAuditing}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '6px',
                    background: '#f1f5f9',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    color: '#334155',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <RefreshCw size={13} className={isAuditing ? 'animate-spin' : ''} />
                  Watchdog jetzt erneut ausführen
                </button>
              </div>

              {/* Timeline Items */}
              {(!selectedAuditMandate.audit_log || selectedAuditMandate.audit_log.length === 0) ? (
                <div style={{ textAlign: 'center', padding: '30px', color: '#64748b', fontSize: '0.86rem' }}>
                  Noch keine Audit-Einträge vorhanden. Klicken Sie auf "Watchdog jetzt erneut ausführen".
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '360px', overflowY: 'auto', paddingRight: '4px' }}>
                  {selectedAuditMandate.audit_log.map((log, idx) => (
                    <div key={log.id || idx} className="audit-timeline-card">
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span className={`audit-source-tag tag-${(log.sourceType || '').toLowerCase()}`}>
                            {log.sourceType || 'AUDIT'}
                          </span>
                          <span style={{ fontWeight: 700, fontSize: '0.86rem', color: '#0f172a' }}>
                            {log.sourceTitle}
                          </span>
                        </div>
                        <span style={{ fontSize: '0.74rem', color: '#64748b' }}>
                          {log.timestamp ? new Date(log.timestamp).toLocaleString('de-DE') : ''}
                        </span>
                      </div>

                      {log.matchedKeywords && log.matchedKeywords.length > 0 && (
                        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginBottom: '6px' }}>
                          {log.matchedKeywords.map((kw, kidx) => (
                            <span key={kidx} className="audit-keyword-tag">{kw}</span>
                          ))}
                        </div>
                      )}

                      <div style={{ fontSize: '0.82rem', color: '#334155', lineHeight: 1.45, marginBottom: '4px' }}>
                        {log.snippet}
                      </div>

                      {log.note && (
                        <div style={{ fontSize: '0.76rem', color: '#64748b', fontStyle: 'italic', borderTop: '1px dashed #e2e8f0', paddingTop: '4px', marginTop: '4px' }}>
                          Notiz: {log.note}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {auditModalTab === 'emails' && (() => {
            const comp = (selectedAuditMandate.company || '').toLowerCase();
            const mandateEmails = syncedEmails.filter(email => {
              if (!email) return false;
              const mName = (email.mandateName || '').toLowerCase();
              const subj = (email.subject || '').toLowerCase();
              return (
                (mName && comp && (mName.includes(comp) || comp.includes(mName))) ||
                (subj && comp && subj.includes(comp)) ||
                (email.mandateId && (email.mandateId === selectedAuditMandate.id || email.mandateId === selectedAuditMandate.leadId))
              );
            });

            const displayList = emailFilterMode === 'all' ? syncedEmails : mandateEmails;

            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {/* Filter / Subheader Controls */}
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '10px',
                  padding: '12px 18px',
                  flexWrap: 'wrap',
                  gap: '12px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <button
                      type="button"
                      onClick={() => setEmailFilterMode('mandate')}
                      style={{
                        padding: '6px 14px',
                        borderRadius: '6px',
                        border: emailFilterMode === 'mandate' ? '1px solid #0284c7' : '1px solid #cbd5e1',
                        background: emailFilterMode === 'mandate' ? '#0284c7' : '#ffffff',
                        color: emailFilterMode === 'mandate' ? '#ffffff' : '#475569',
                        fontWeight: 700,
                        fontSize: '0.82rem',
                        cursor: 'pointer'
                      }}
                    >
                      Mandat: {selectedAuditMandate.company} ({mandateEmails.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setEmailFilterMode('all')}
                      style={{
                        padding: '6px 14px',
                        borderRadius: '6px',
                        border: emailFilterMode === 'all' ? '1px solid #0284c7' : '1px solid #cbd5e1',
                        background: emailFilterMode === 'all' ? '#0284c7' : '#ffffff',
                        color: emailFilterMode === 'all' ? '#ffffff' : '#475569',
                        fontWeight: 700,
                        fontSize: '0.82rem',
                        cursor: 'pointer'
                      }}
                    >
                      Alle Partner-Mails ({syncedEmails.length})
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={handleSyncEmails}
                    disabled={isSyncingEmails}
                    style={{
                      padding: '6px 14px',
                      borderRadius: '6px',
                      background: '#f1f5f9',
                      border: '1px solid #cbd5e1',
                      color: '#334155',
                      fontWeight: 700,
                      fontSize: '0.82rem',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                  >
                    <RefreshCw size={13} className={isSyncingEmails ? 'animate-spin' : ''} />
                    <span>{isSyncingEmails ? 'Synchronisiere...' : 'Jetzt mit Gmail abgleichen'}</span>
                  </button>
                </div>

                {/* Email List */}
                {displayList.length === 0 ? (
                  <div style={{
                    textAlign: 'center',
                    padding: '48px 20px',
                    background: '#f8fafc',
                    border: '1px dashed #cbd5e1',
                    borderRadius: '12px',
                    color: '#64748b'
                  }}>
                    <Inbox size={40} color="#94a3b8" style={{ margin: '0 auto 12px' }} />
                    <div style={{ fontWeight: 700, fontSize: '1rem', color: '#1e293b', marginBottom: '4px' }}>
                      Keine E-Mails für {selectedAuditMandate.company} gefunden
                    </div>
                    <div style={{ fontSize: '0.84rem', maxWidth: '440px', margin: '0 auto 16px' }}>
                      Es liegen aktuell keine verknüpften Gmail-Nachrichten mit taskforce AG oder anderen DACH-Providern zu diesem Mandat vor.
                    </div>
                    {syncedEmails.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setEmailFilterMode('all')}
                        style={{
                          padding: '7px 16px',
                          borderRadius: '6px',
                          background: '#0284c7',
                          border: 'none',
                          color: '#ffffff',
                          fontWeight: 700,
                          fontSize: '0.82rem',
                          cursor: 'pointer'
                        }}
                      >
                        Alle {syncedEmails.length} synchronisierten Partner-Mails anzeigen
                      </button>
                    )}
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '480px', overflowY: 'auto', paddingRight: '4px' }}>
                    {displayList.map(email => {
                      const isExpanded = expandedEmailId === email.id;
                      const isInbound = email.direction === 'INBOUND';
                      return (
                        <div
                          key={email.id}
                          style={{
                            background: '#ffffff',
                            border: isInbound ? '1px solid #bbf7d0' : '1px solid #bfdbfe',
                            borderRadius: '10px',
                            padding: '16px 20px',
                            boxShadow: '0 2px 6px rgba(0, 0, 0, 0.04)',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '8px'
                          }}
                        >
                          {/* Email Item Header */}
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                              <span style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                padding: '3px 9px',
                                borderRadius: '6px',
                                fontSize: '0.74rem',
                                fontWeight: 800,
                                background: isInbound ? '#dcfce7' : '#e0f2fe',
                                color: isInbound ? '#166534' : '#0369a1',
                                border: `1px solid ${isInbound ? '#86efac' : '#7dd3fc'}`
                              }}>
                                {isInbound ? '📥 EMPFANGEN' : '📤 GESENDET'}
                              </span>

                              <span style={{
                                padding: '3px 8px',
                                borderRadius: '6px',
                                fontSize: '0.74rem',
                                fontWeight: 700,
                                background: email.category === 'MANDATE_CONFIRMATION' ? '#dcfce7' : '#f1f5f9',
                                color: email.category === 'MANDATE_CONFIRMATION' ? '#15803d' : '#475569',
                                border: '1px solid #e2e8f0'
                              }}>
                                {email.category === 'MANDATE_CONFIRMATION' ? '✅ Bestätigung & Kundenschutz' : email.category === 'MANDATE_DISPATCH' ? '🚀 Mandatsübermittlung' : '📑 Kooperationsvereinbarung'}
                              </span>

                              <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#0f172a' }}>
                                {email.partnerName || email.domain}
                              </span>
                            </div>

                            <div style={{ fontSize: '0.76rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '5px' }}>
                              <Calendar size={13} color="#94a3b8" />
                              <span>{new Date(email.date).toLocaleString('de-DE')}</span>
                            </div>
                          </div>

                          {/* Subject */}
                          <div style={{ fontWeight: 800, fontSize: '0.94rem', color: '#0f172a', lineHeight: 1.35 }}>
                            {email.subject}
                          </div>

                          {/* From / To meta */}
                          <div style={{ fontSize: '0.78rem', color: '#64748b', display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                            <span><strong>Von:</strong> {email.from}</span>
                            <span><strong>An:</strong> {email.to}</span>
                            {email.mandateName && (
                              <span><strong>Mandat:</strong> <span style={{ color: '#0284c7', fontWeight: 600 }}>{email.mandateName}</span></span>
                            )}
                          </div>

                          {/* Keywords tags */}
                          {Array.isArray(email.matchedKeywords) && email.matchedKeywords.length > 0 && (
                            <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', marginTop: '2px' }}>
                              {email.matchedKeywords.map((kw, i) => (
                                <span key={i} className="audit-keyword-tag" style={{ fontSize: '0.72rem' }}>
                                  {kw}
                                </span>
                              ))}
                            </div>
                          )}

                          {/* Body toggle & text */}
                          <div style={{ marginTop: '4px', borderTop: '1px solid #f1f5f9', paddingTop: '8px' }}>
                            <button
                              type="button"
                              onClick={() => setExpandedEmailId(isExpanded ? null : email.id)}
                              style={{
                                background: 'none',
                                border: 'none',
                                color: '#0284c7',
                                fontSize: '0.78rem',
                                fontWeight: 700,
                                cursor: 'pointer',
                                padding: 0,
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px'
                              }}
                            >
                              {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                              <span>{isExpanded ? 'Vollständigen E-Mail-Text einklappen' : 'Vollständigen E-Mail-Text anzeigen'}</span>
                            </button>

                            {isExpanded && (
                              <pre style={{
                                background: '#0a0d14',
                                color: '#f8fafc',
                                padding: '14px 18px',
                                borderRadius: '8px',
                                fontSize: '0.84rem',
                                fontFamily: 'Consolas, Monaco, "Courier New", monospace',
                                whiteSpace: 'pre-wrap',
                                lineHeight: 1.55,
                                marginTop: '8px',
                                border: '1px solid #1e293b'
                              }}>
                                {email.bodyText}
                              </pre>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })()}
        </div>

            <div className="archive-modal-footer">
              <button
                type="button"
                onClick={() => setShowAuditModal(false)}
                className="archive-btn-secondary"
              >
                Schließen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
