import React, { useState, useEffect, useMemo } from 'react'
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
  Info
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import './MandateArchivePage.css'

const STORAGE_KEY = 'nexus:mandate_archive_v1'

// Standard C-Level & Boutique Advisory Whitelist
const PARTNER_OPTIONS = [
  'Top Fifty AG (Baar/Zug · Pierina Tannò)',
  'taskforce - Management on Demand AG',
  'Atreus GmbH (A Heimatt Group Company)',
  'Egon Zehnder International',
  'Russell Reynolds Associates',
  'Spencer Stuart',
  'Korn Ferry',
  'F&P Executive Solutions AG',
  'Freier PE-Partner / Family Office',
  'Spezialisierte Boutique / Interim Provider'
]

// Initiales exklusiv reserviertes Mandat (cosquare AG an Top Fifty AG)
const INITIAL_COSQUARE_ARCHIVE_ENTRY = {
  id: 'arch-cosquare-2026-01',
  leadId: '35bead11-ba4d-47b4-be1a-21a765b96b29',
  company: 'cosquare AG',
  countryMarket: 'CH · Zug (SHAB)',
  role: 'Mitglied des Verwaltungsrates (Ersatzbesetzung)',
  transmittedTo: 'Top Fifty AG · Pierina Tannò',
  transmittedAt: '2026-10-26T09:15:00.000Z',
  protectionUntil: '2026-11-09T23:59:59.000Z',
  status: 'ANGEBOTEN_RESERVIERT',
  notes: 'Exklusive 14-tägige Reservierung (Frist bis 09.11.2026) für Top Fifty AG / Pierina Tannò. Blind-Profil übermittelt.',
  source: 'Schweizerisches Handelsamtsblatt (SHAB) · Ref. CH-ZG-2026-VR-01'
}

// Bereinigungs-Hilfe: Entfernt alte Test-/Mockup-Daten
function sanitizeArchiveEntries(list) {
  if (!Array.isArray(list)) return [INITIAL_COSQUARE_ARCHIVE_ENTRY]
  const DUMMY_IDS = ['arch-001', 'arch-002', 'arch-003', 'arch-004']
  const DUMMY_COMPANIES = ['brenntag', 'krones', 'clariant', 'melrose']

  const cleaned = list.filter(item => {
    if (!item) return false
    if (DUMMY_IDS.includes(item.id)) return false
    const compLower = (item.company || '').toLowerCase()
    if (DUMMY_COMPANIES.some(d => compLower.includes(d))) return false
    return true
  })

  const hasCosquare = cleaned.some(item => (item.company || '').toLowerCase().includes('cosquare'))
  if (!hasCosquare) {
    cleaned.unshift(INITIAL_COSQUARE_ARCHIVE_ENTRY)
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
  // Aktiver Hauptbereich: 'boutique_pool' (TIER_2_MID Zweitverwertung) | 'transmitted' (Kundenschutz-Register)
  const [activeTab, setActiveTab] = useState('boutique_pool')

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
    return [INITIAL_COSQUARE_ARCHIVE_ENTRY]
  })

  // 2. Dynamischer Boutique-Pool (TIER_2_MID Leads aus Supabase)
  const [tier2Leads, setTier2Leads] = useState([])
  const [loadingTier2, setLoadingTier2] = useState(true)

  // Filter & Suche State
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [partnerFilter, setPartnerFilter] = useState('ALL')
  const [copiedId, setCopiedId] = useState(null)

  // Übermittlungs-Modal State
  const [showDispatchModal, setShowDispatchModal] = useState(false)
  const [dispatchTargetLead, setDispatchTargetLead] = useState(null)
  const [dispatchCompany, setDispatchCompany] = useState('')
  const [dispatchMarket, setDispatchMarket] = useState('DE · Gehobener Mittelstand')
  const [dispatchRole, setDispatchRole] = useState('')
  const [dispatchPartner, setDispatchPartner] = useState(PARTNER_OPTIONS[0])
  const [dispatchDate, setDispatchDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [dispatchNotes, setDispatchNotes] = useState('')
  const [dispatchSource, setDispatchSource] = useState('Primärquelle verifiziert')

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

  // Frist- und Resttage-Berechnung (Exakt 12 Monate bzw. vereinbarte Frist)
  const computeProtectionDetails = (transmittedAtStr, protectionUntilStr, status) => {
    const until = protectionUntilStr ? new Date(protectionUntilStr) : (() => {
      const d = new Date(transmittedAtStr)
      d.setFullYear(d.getFullYear() + 1)
      return d
    })()

    const diffMs = until.getTime() - Date.now()
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24))
    const isExpired = diffDays <= 0

    let label = isExpired ? 'Kundenschutz abgelaufen' : `Noch ${diffDays} Tage geschützt`
    if (status === 'ANGEBOTEN_RESERVIERT') {
      label = isExpired ? 'Reservierung abgelaufen' : `Exklusivität aktiv (${diffDays} Tage)`
    }

    return {
      untilDate: until.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }),
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

  // Statistiken
  const stats = useMemo(() => {
    const transmittedTotal = entries.length
    const activeProtected = entries.filter(e => {
      const p = computeProtectionDetails(e.transmittedAt, e.protectionUntil, e.status)
      return !p.isExpired && e.status !== 'ABGELAUFEN'
    }).length
    const tier2Count = tier2Leads.length
    const uniquePartners = new Set(entries.map(e => e.transmittedTo)).size

    return { transmittedTotal, activeProtected, tier2Count, uniquePartners }
  }, [entries, tier2Leads])

  // CSV-Export für juristischen Kundenschutz-Nachweis
  const exportCsv = () => {
    const headers = [
      'Zielgesellschaft',
      'Land_Boerse',
      'Vakanz_Rolle',
      'Uebermittelt_An',
      'Uebermittlungsdatum',
      'Kundenschutz_Bis',
      'Status',
      'Primaerquellen_Nachweis'
    ]

    const rows = entries.map(e => {
      const p = computeProtectionDetails(e.transmittedAt, e.protectionUntil, e.status)
      return [
        `"${(e.company || '').replace(/"/g, '""')}"`,
        `"${(e.countryMarket || '').replace(/"/g, '""')}"`,
        `"${(e.role || '').replace(/"/g, '""')}"`,
        `"${(e.transmittedTo || '').replace(/"/g, '""')}"`,
        `"${new Date(e.transmittedAt).toLocaleDateString('de-DE')}"`,
        `"${p.untilDate}"`,
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
    setDispatchPartner(PARTNER_OPTIONS[0])
    setDispatchDate(new Date().toISOString().slice(0, 10))
    setDispatchNotes('')
    setDispatchSource('Primärquelle / DealCoach Audit')
    setShowDispatchModal(true)
  }

  // Öffnet Modal für einen konkreten TIER_2 Lead aus dem Boutique-Pool
  const handleOpenLeadDispatch = (lead) => {
    const compName = lead.nexus_companies?.name || lead.title?.split(':')[0]?.replace(/\[.*?\]/, '')?.trim() || 'Zielgesellschaft'
    const details = extractDealCoachDetails(lead)

    setDispatchTargetLead(lead)
    setDispatchCompany(compName)
    setDispatchMarket(lead.title?.includes('[UK]') ? 'UK · Mittelstand' : lead.title?.includes('[CH]') ? 'CH · Mittelstand' : 'DE · Gehobener Mittelstand')
    setDispatchRole(details.role)
    setDispatchPartner(PARTNER_OPTIONS[0])
    setDispatchDate(new Date().toISOString().slice(0, 10))
    setDispatchNotes(`Zweitverwertung via Boutique-Pool: ${details.rationale} | Budget: ${details.estimatedBudget}`)
    setDispatchSource(lead.source || 'EQS / LSE / Primär-Radar')
    setShowDispatchModal(true)
  }

  // Übermittlung final speichern & 12 Monate Kundenschutz aktivieren
  const handleConfirmDispatch = async (e) => {
    e.preventDefault()
    if (!dispatchCompany.trim()) return

    const transmittedDate = new Date(`${dispatchDate}T12:00:00Z`)
    const protectionDate = new Date(transmittedDate)
    protectionDate.setFullYear(protectionDate.getFullYear() + 1) // Exakt 12 Monate

    const newEntry = {
      id: `arch-${Date.now()}`,
      leadId: dispatchTargetLead?.id || null,
      company: dispatchCompany.trim(),
      countryMarket: dispatchMarket.trim(),
      role: dispatchRole.trim(),
      transmittedTo: dispatchPartner.trim(),
      transmittedAt: transmittedDate.toISOString(),
      protectionUntil: protectionDate.toISOString(),
      status: 'AKTIV_GESCHUETZT',
      notes: dispatchNotes.trim() || 'Zweitverwertungs-Mandat an autorisierten Partner übermittelt.',
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
            tags: [...(dispatchTargetLead.tags || []), 'TRANSMITTED_TO_PARTNER', 'KUNDENSCHUTZ_12M']
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

  // 1-Klick formeller Nachweis-String
  const handleCopyProof = (item) => {
    const p = computeProtectionDetails(item.transmittedAt, item.protectionUntil, item.status)
    const isReserved = item.status === 'ANGEBOTEN_RESERVIERT'
    const text = `⚖️ NACHWEIS ${isReserved ? 'EXKLUSIV-RESERVIERUNG' : 'KUNDENSCHUTZ'} (D.A.T. MANDATE ORIGINATION DESK)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Zielgesellschaft: ${item.company}
Land / Börsensegment: ${item.countryMarket}
Vakanz / Organfunktion: ${item.role}
Übermittelt an Partner: ${item.transmittedTo}
Datum der Übermittlung: ${new Date(item.transmittedAt).toLocaleString('de-DE')}
Status: ${isReserved ? '🟡 Exklusiv reserviert (14 Tage)' : item.status}
Gültig bis: ${p.untilDate} (${p.label})
Rechtsbasis: ${isReserved ? '14 Tage Exklusivität nach D.A.T.-Standard' : '12 Monate exklusiver Kundenschutz nach D.A.T.-Standard'}
Primärnachweis: ${item.source || item.notes}`

    navigator.clipboard.writeText(text)
    setCopiedId(item.id)
    setTimeout(() => setCopiedId(null), 2500)
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
            <Archive size={16} /> D.A.T. Mandats-Archiv & Zweitverwertung
          </div>
          <h1>Mandats-Archiv & Kundenschutz</h1>
          <p>
            Zentrales Verzeichnis für die <strong>Boutique-Zweitverwertung (TIER_2_MID)</strong> sowie das lückenlose <strong>12-Monate-Kundenschutz-Register</strong> nach D.A.T.-Standard.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          {entries.length > 0 && (
            <button
              type="button"
              onClick={exportCsv}
              className="archive-btn-secondary"
              title="CSV-Report mit allen Übermittlungsfristen herunterladen"
            >
              <Download size={16} /> Kundenschutz-Report (CSV)
            </button>
          )}

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
        </div>
      </div>

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
            <h4>Aktiv geschützt (12M)</h4>
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

        <div className="archive-kpi-card">
          <div className="archive-kpi-icon" style={{ background: 'rgba(99, 102, 241, 0.1)', color: '#6366f1' }}>
            <Building2 size={22} />
          </div>
          <div className="archive-kpi-info">
            <h4>Partner-Netzwerk</h4>
            <div className="kpi-value">{PARTNER_OPTIONS.length}</div>
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
      </div>

      {/* Toolbar & Filter */}
      <div className="archive-toolbar">
        <div className="archive-search-box">
          <Search size={16} color="#64748b" />
          <input
            type="text"
            placeholder={activeTab === 'boutique_pool' ? "Unternehmen oder Rolle im Boutique-Pool suchen..." : "Zielgesellschaft, Rolle oder Partner suchen..."}
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
              <option value="AKTIV_GESCHUETZT">🟢 Aktiv geschützt (12M)</option>
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
              {PARTNER_OPTIONS.map((p, idx) => (
                <option key={idx} value={p.split(' ')[0]}>{p.split(' ')[0]}</option>
              ))}
            </select>
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
                        <ShieldCheck size={16} /> An Boutique-Partner übermitteln & 12M schützen
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
                <th>Zielgesellschaft</th>
                <th>Land / Börse</th>
                <th>Vakanz / Rolle</th>
                <th>Übermittelt an</th>
                <th>Übermittlungsdatum</th>
                <th>Kundenschutz bis (12 Monate)</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Aktionen</th>
              </tr>
            </thead>
            <tbody>
              {filteredTransmittedEntries.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '60px 20px', color: '#64748b' }}>
                    <div className="empty-icon-circle" style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#059669', margin: '0 auto 12px' }}>
                      <ShieldCheck size={36} />
                    </div>
                    <div style={{ fontWeight: 700, fontSize: '1.05rem', color: '#0f172a', marginBottom: '6px' }}>
                      Noch keine übermittelten Mandate im Register
                    </div>
                    <div style={{ fontSize: '0.88rem', maxWidth: '520px', margin: '0 auto 16px', color: '#64748b' }}>
                      Übermittlungen aus dem Mandats-Desk oder dem Boutique-Pool werden hier lückenlos mit 12 Monaten D.A.T.-Kundenschutz und formellem Nachweis-Protokoll dokumentiert.
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
                  const protection = computeProtectionDetails(entry.transmittedAt, entry.protectionUntil, entry.status)
                  return (
                    <tr key={entry.id}>
                      {/* Zielgesellschaft */}
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontWeight: 700, fontSize: '0.92rem', color: '#0f172a' }}>
                            {entry.company}
                          </span>
                        </div>
                        {entry.source && (
                          <div style={{ fontSize: '0.74rem', color: '#64748b', marginTop: '2px' }}>
                            Quelle: {entry.source}
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

                      {/* Kundenschutz bis (12 Monate bzw. Reservierung) */}
                      <td>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: '0.9rem', color: protection.isExpired ? '#dc2626' : entry.status === 'ANGEBOTEN_RESERVIERT' ? '#b45309' : '#059669' }}>
                            {protection.untilDate}
                          </div>
                          <div className={`badge-protection ${protection.isExpired ? 'expired' : entry.status === 'ANGEBOTEN_RESERVIERT' ? 'reserved' : protection.diffDays < 60 ? 'warning' : 'active'}`}>
                            <Clock size={11} /> {protection.label}
                          </div>
                        </div>
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
                      </td>

                      {/* Aktionen */}
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', alignItems: 'center' }}>
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

      {/* MODAL: MANDATS-ÜBERMITTLUNG PROTOKOLLIEREN & 12M KUNDENSCHUTZ SICHERN */}
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
                    12 Monate exklusiver Kundenschutz nach D.A.T.-Standard
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

                <div className="form-group">
                  <label>Übermittelt an Partner</label>
                  <select
                    value={dispatchPartner}
                    onChange={(e) => setDispatchPartner(e.target.value)}
                    className="archive-modal-select"
                  >
                    {PARTNER_OPTIONS.map((p, idx) => (
                      <option key={idx} value={p}>{p}</option>
                    ))}
                  </select>
                </div>

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
                    <label>Kundenschutz bis (Automatisch +12 Monate)</label>
                    <input
                      type="text"
                      disabled
                      value={(() => {
                        const d = new Date(`${dispatchDate}T12:00:00Z`)
                        d.setFullYear(d.getFullYear() + 1)
                        return d.toLocaleDateString('de-DE')
                      })()}
                      style={{ background: '#f1f5f9', color: '#059669', fontWeight: 700 }}
                    />
                  </div>
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
                  <ShieldCheck size={16} /> 12 Monate Kundenschutz aktivieren
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
