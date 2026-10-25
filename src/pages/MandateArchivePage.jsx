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
  UserCheck
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import './MandateArchivePage.css'

const STORAGE_KEY = 'nexus:mandate_archive_v1'

const INITIAL_ARCHIVE_DATA = [
  {
    id: 'arch-001',
    company: 'Brenntag SE',
    legalForm: 'SE',
    countryMarket: 'DE · DAX / Prime Standard',
    role: 'Interim CFO / Financial Transformation',
    transmittedTo: 'taskforce - Management on Demand AG',
    transmittedAt: '2026-10-24T14:30:00.000Z',
    protectionUntil: '2027-10-24T14:30:00.000Z',
    status: 'AKTIV_GESCHUETZT',
    notes: 'Ad-hoc-Organvakanz nach Board-Beschluss. Vertrauliches Blind-Dossier übermittelt.',
    source: 'EQS Ad-hoc / BaFin'
  },
  {
    id: 'arch-002',
    company: 'Krones AG',
    legalForm: 'AG',
    countryMarket: 'DE · MDAX',
    role: 'Interim COO / Global Operations',
    transmittedTo: 'Atreus GmbH (A Heimatt Group Company)',
    transmittedAt: '2026-10-22T09:15:00.000Z',
    protectionUntil: '2027-10-22T09:15:00.000Z',
    status: 'IN_VERHANDLUNG',
    notes: 'Restrukturierungsdruck auf Werksebene. Erstgespräch mit AR-Vorsitzendem terminiert.',
    source: 'EQS Corporate News'
  },
  {
    id: 'arch-003',
    company: 'Clariant AG',
    legalForm: 'AG',
    countryMarket: 'CH · SIX Swiss Exchange',
    role: 'CRO / Chief Restructuring Officer',
    transmittedTo: 'Egon Zehnder International',
    transmittedAt: '2026-10-18T16:45:00.000Z',
    protectionUntil: '2027-10-18T16:45:00.000Z',
    status: 'AKTIV_GESCHUETZT',
    notes: 'Organ-Umbau nach Aktivisten-Intervention. 12 Monate Kundenschutz bestätigt.',
    source: 'SHAB / SIX Ad-hoc'
  },
  {
    id: 'arch-004',
    company: 'Melrose Industries Plc',
    legalForm: 'Plc',
    countryMarket: 'UK · LSE Main Market',
    role: 'Interim CFO / M&A Restructuring',
    transmittedTo: 'Russell Reynolds Associates',
    transmittedAt: '2026-10-10T11:00:00.000Z',
    protectionUntil: '2027-10-10T11:00:00.000Z',
    status: 'MANDATIERT',
    notes: 'Mandat erfolgreich durch Partner besetzt. Exklusiv-Retainer protokolliert.',
    source: 'LSE RNS Regulatory Feed'
  }
]

export default function MandateArchivePage() {
  const [entries, setEntries] = useState(() => {
    try {
      const cached = localStorage.getItem(STORAGE_KEY)
      if (cached) {
        const parsed = JSON.parse(cached)
        if (Array.isArray(parsed) && parsed.length > 0) return parsed
      }
    } catch (e) {
      console.warn('[MandateArchive] Error loading local archive:', e)
    }
    return INITIAL_ARCHIVE_DATA
  })

  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [partnerFilter, setPartnerFilter] = useState('ALL')
  const [showAddModal, setShowAddModal] = useState(false)
  const [copiedId, setCopiedId] = useState(null)

  // Form State für neues Mandat
  const [newCompany, setNewCompany] = useState('')
  const [newCountryMarket, setNewCountryMarket] = useState('DE · Prime Standard')
  const [newRole, setNewRole] = useState('Interim CEO / Board Transformation')
  const [newPartner, setNewPartner] = useState('taskforce - Management on Demand AG')
  const [newTransmittedAt, setNewTransmittedAt] = useState(() => new Date().toISOString().slice(0, 10))
  const [newNotes, setNewNotes] = useState('')
  const [newSource, setNewSource] = useState('EQS Ad-hoc / Primärquelle')

  // Persistierung in localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(entries))
    } catch (e) {
      console.warn('[MandateArchive] Error saving to localStorage:', e)
    }
  }, [entries])

  // Frist- und Resttage-Berechnung
  const computeProtectionDetails = (transmittedAtStr, protectionUntilStr) => {
    const until = protectionUntilStr ? new Date(protectionUntilStr) : (() => {
      const d = new Date(transmittedAtStr)
      d.setFullYear(d.getFullYear() + 1)
      return d
    })()

    const diffMs = until.getTime() - Date.now()
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24))
    const isExpired = diffDays <= 0

    return {
      untilDate: until.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }),
      diffDays,
      isExpired,
      label: isExpired ? 'Kundenschutz abgelaufen' : `Noch ${diffDays} Tage geschützt`
    }
  }

  // Filterung
  const filteredEntries = useMemo(() => {
    return entries.filter(item => {
      const q = searchQuery.toLowerCase().trim()
      const matchesSearch = !q ||
        item.company.toLowerCase().includes(q) ||
        item.role.toLowerCase().includes(q) ||
        item.transmittedTo.toLowerCase().includes(q) ||
        (item.countryMarket || '').toLowerCase().includes(q)

      const matchesStatus = statusFilter === 'ALL' || item.status === statusFilter
      const matchesPartner = partnerFilter === 'ALL' || item.transmittedTo.toLowerCase().includes(partnerFilter.toLowerCase())

      return matchesSearch && matchesStatus && matchesPartner
    })
  }, [entries, searchQuery, statusFilter, partnerFilter])

  // KPIs
  const stats = useMemo(() => {
    const total = entries.length
    const active = entries.filter(e => {
      const p = computeProtectionDetails(e.transmittedAt, e.protectionUntil)
      return !p.isExpired && e.status !== 'ABGELAUFEN'
    }).length
    const mandated = entries.filter(e => e.status === 'MANDATIERT').length
    const uniquePartners = new Set(entries.map(e => e.transmittedTo)).size

    return { total, active, mandated, uniquePartners }
  }, [entries])

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
      const p = computeProtectionDetails(e.transmittedAt, e.protectionUntil)
      return [
        `"${e.company.replace(/"/g, '""')}"`,
        `"${(e.countryMarket || '').replace(/"/g, '""')}"`,
        `"${e.role.replace(/"/g, '""')}"`,
        `"${e.transmittedTo.replace(/"/g, '""')}"`,
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

  // Neues Mandat anlegen
  const handleCreateMandate = (e) => {
    e.preventDefault()
    if (!newCompany.trim()) return

    const transmittedDate = new Date(`${newTransmittedAt}T12:00:00Z`)
    const protectionDate = new Date(transmittedDate)
    protectionDate.setFullYear(protectionDate.getFullYear() + 1) // Exakt 12 Monate

    const newEntry = {
      id: `arch-${Date.now()}`,
      company: newCompany.trim(),
      countryMarket: newCountryMarket.trim(),
      role: newRole.trim(),
      transmittedTo: newPartner.trim(),
      transmittedAt: transmittedDate.toISOString(),
      protectionUntil: protectionDate.toISOString(),
      status: 'AKTIV_GESCHUETZT',
      notes: newNotes.trim() || 'Manuell im Mandats-Archiv protokolliert.',
      source: newSource.trim() || 'Primärquelle'
    }

    setEntries(prev => [newEntry, ...prev])
    setShowAddModal(false)
    setNewCompany('')
    setNewNotes('')
  }

  const handleCopyProof = (item) => {
    const p = computeProtectionDetails(item.transmittedAt, item.protectionUntil)
    const text = `⚖️ NACHWEIS KUNDENSCHUTZ (D.A.T. MANDATE ORIGINATION DESK)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Zielgesellschaft: ${item.company}
Land / Börsensegment: ${item.countryMarket}
Vakanz / Organfunktion: ${item.role}
Übermittelt an Partner: ${item.transmittedTo}
Datum der Übermittlung: ${new Date(item.transmittedAt).toLocaleString('de-DE')}
Kundenschutz aktiv bis: ${p.untilDate} (${p.label})
Rechtsbasis: 12 Monate exklusiver Kundenschutz nach D.A.T.-Standard
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
      {/* Page Header */}
      <div className="mandate-archive-header">
        <div>
          <h1>Mandats-Archiv & Kundenschutz-Nachweis</h1>
          <p>
            Rechtssichere Dokumentation und lückenloser 12-Monate-Kundenschutz für an Beratungs- und Executive-Search-Partner (taskforce, Atreus etc.) übermittelte C-Level- und Board-Vakanzen.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            type="button"
            className="btn-secondary"
            onClick={exportCsv}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '9px 16px',
              borderRadius: '8px',
              background: '#ffffff',
              border: '1px solid #cbd5e1',
              color: '#0f172a',
              fontWeight: 600,
              fontSize: '0.86rem',
              cursor: 'pointer'
            }}
          >
            <Download size={16} /> Kundenschutz-Report (CSV)
          </button>

          <button
            type="button"
            onClick={() => setShowAddModal(true)}
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
        <div className="archive-kpi-card">
          <div className="archive-kpi-icon" style={{ background: 'rgba(2, 132, 199, 0.1)', color: '#0284c7' }}>
            <Archive size={22} />
          </div>
          <div className="archive-kpi-info">
            <h4>Übermittelte Mandate</h4>
            <div className="kpi-value">{stats.total}</div>
          </div>
        </div>

        <div className="archive-kpi-card">
          <div className="archive-kpi-icon" style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#059669' }}>
            <ShieldCheck size={22} />
          </div>
          <div className="archive-kpi-info">
            <h4>Aktiv geschützt (12M)</h4>
            <div className="kpi-value" style={{ color: '#059669' }}>{stats.active}</div>
          </div>
        </div>

        <div className="archive-kpi-card">
          <div className="archive-kpi-icon" style={{ background: 'rgba(217, 119, 6, 0.1)', color: '#d97706' }}>
            <UserCheck size={22} />
          </div>
          <div className="archive-kpi-info">
            <h4>Erfolgreich mandatiert</h4>
            <div className="kpi-value" style={{ color: '#d97706' }}>{stats.mandated}</div>
          </div>
        </div>

        <div className="archive-kpi-card">
          <div className="archive-kpi-icon" style={{ background: 'rgba(99, 102, 241, 0.1)', color: '#6366f1' }}>
            <Building2 size={22} />
          </div>
          <div className="archive-kpi-info">
            <h4>Involvierte Partner</h4>
            <div className="kpi-value">{stats.uniquePartners}</div>
          </div>
        </div>
      </div>

      {/* Toolbar & Filter */}
      <div className="archive-toolbar">
        <div className="archive-search-box">
          <Search size={16} color="#64748b" />
          <input
            type="text"
            placeholder="Zielgesellschaft, Rolle oder Partner suchen..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="archive-filter-group">
          <select
            className="archive-select"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="ALL">Alle Status</option>
            <option value="AKTIV_GESCHUETZT">Aktiv geschützt</option>
            <option value="IN_VERHANDLUNG">In Verhandlung</option>
            <option value="MANDATIERT">Erfolgreich mandatiert</option>
            <option value="ABGELAUFEN">Abgelaufen</option>
          </select>

          <select
            className="archive-select"
            value={partnerFilter}
            onChange={(e) => setPartnerFilter(e.target.value)}
          >
            <option value="ALL">Alle Partner</option>
            <option value="taskforce">taskforce</option>
            <option value="Atreus">Atreus</option>
            <option value="Egon Zehnder">Egon Zehnder</option>
            <option value="Russell Reynolds">Russell Reynolds</option>
          </select>
        </div>
      </div>

      {/* Main Table */}
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
            {filteredEntries.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ textAlign: 'center', padding: '48px 20px', color: '#64748b' }}>
                  <Archive size={32} style={{ margin: '0 auto 12px', opacity: 0.4 }} />
                  <div>Keine übermittelten Mandate für diesen Filter gefunden.</div>
                </td>
              </tr>
            ) : (
              filteredEntries.map(entry => {
                const protection = computeProtectionDetails(entry.transmittedAt, entry.protectionUntil)
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
                      {entry.notes && (
                        <div style={{ fontSize: '0.74rem', color: '#64748b', marginTop: '2px', maxWidth: '280px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={entry.notes}>
                          {entry.notes}
                        </div>
                      )}
                    </td>

                    {/* Übermittelt an */}
                    <td>
                      <span className="badge-partner">
                        <Building2 size={13} /> {entry.transmittedTo}
                      </span>
                    </td>

                    {/* Übermittlungsdatum */}
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#334155' }}>
                        <Calendar size={13} color="#64748b" />
                        <span>{new Date(entry.transmittedAt).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })}</span>
                      </div>
                      <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginLeft: '19px' }}>
                        {new Date(entry.transmittedAt).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr
                      </div>
                    </td>

                    {/* Kundenschutz bis (12 Monate) */}
                    <td>
                      <div style={{ fontWeight: 700, color: protection.isExpired ? '#dc2626' : '#059669', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <ShieldCheck size={14} />
                        <span>{protection.untilDate}</span>
                      </div>
                      <div className={`badge-countdown ${protection.isExpired ? 'expired' : ''}`} style={{ marginTop: '2px' }}>
                        <Clock size={12} /> {protection.label}
                      </div>
                    </td>

                    {/* Status */}
                    <td>
                      <select
                        value={entry.status}
                        onChange={(e) => handleStatusChange(entry.id, e.target.value)}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          fontSize: '0.78rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                          padding: '2px 6px',
                          borderRadius: '6px'
                        }}
                      >
                        <option value="AKTIV_GESCHUETZT">🛡️ Aktiv geschützt</option>
                        <option value="IN_VERHANDLUNG">💬 In Verhandlung</option>
                        <option value="MANDATIERT">👑 Mandatiert</option>
                        <option value="ABGELAUFEN">⏳ Abgelaufen</option>
                      </select>
                    </td>

                    {/* Aktionen */}
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '6px', alignItems: 'center' }}>
                        <button
                          type="button"
                          onClick={() => handleCopyProof(entry)}
                          style={{
                            background: copiedId === entry.id ? '#059669' : '#f1f5f9',
                            color: copiedId === entry.id ? '#ffffff' : '#0f172a',
                            border: '1px solid #cbd5e1',
                            borderRadius: '6px',
                            padding: '6px 10px',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                          title="Juristischen Kundenschutz-Nachweis in Zwischenablage kopieren"
                        >
                          {copiedId === entry.id ? <Check size={12} /> : <Copy size={12} />}
                          <span>{copiedId === entry.id ? 'Kopiert' : 'Nachweis'}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDelete(entry.id)}
                          style={{
                            background: 'transparent',
                            color: '#94a3b8',
                            border: 'none',
                            padding: '6px',
                            borderRadius: '6px',
                            cursor: 'pointer'
                          }}
                          title="Eintrag entfernen"
                        >
                          <Trash2 size={14} />
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

      {/* Modal: Neues Mandat protokollieren */}
      {showAddModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '20px'
          }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowAddModal(false) }}
        >
          <div style={{
            background: '#ffffff',
            borderRadius: '16px',
            maxWidth: '560px',
            width: '100%',
            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.2)',
            overflow: 'hidden',
            border: '1px solid #cbd5e1'
          }}>
            <div style={{
              background: '#0b1329',
              color: '#ffffff',
              padding: '18px 24px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <ShieldCheck size={20} color="#38bdf8" />
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>Mandats-Übermittlung protokollieren</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateMandate} style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                  Zielgesellschaft *
                </label>
                <input
                  type="text"
                  required
                  placeholder="z. B. Brenntag SE, Continental AG"
                  value={newCompany}
                  onChange={(e) => setNewCompany(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.9rem', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                    Land / Börsensegment
                  </label>
                  <select
                    value={newCountryMarket}
                    onChange={(e) => setNewCountryMarket(e.target.value)}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.88rem' }}
                  >
                    <option value="DE · DAX / Prime Standard">DE · DAX / Prime Standard</option>
                    <option value="DE · MDAX / SDAX">DE · MDAX / SDAX</option>
                    <option value="DE · Groß-GmbH (>50 Mio. €)">DE · Groß-GmbH (&gt;50 Mio. €)</option>
                    <option value="CH · SIX Swiss Exchange">CH · SIX Swiss Exchange</option>
                    <option value="UK · LSE Main Market / AIM">UK · LSE Main Market / AIM</option>
                    <option value="ES · BME / IBEX">ES · BME / IBEX</option>
                    <option value="FR · Euronext Paris">FR · Euronext Paris</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                    Übermittelt an (Partner) *
                  </label>
                  <select
                    value={newPartner}
                    onChange={(e) => setNewPartner(e.target.value)}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.88rem' }}
                  >
                    <option value="taskforce - Management on Demand AG">taskforce - Management on Demand AG</option>
                    <option value="Atreus GmbH (A Heimatt Group Company)">Atreus GmbH (A Heimatt Group Company)</option>
                    <option value="Egon Zehnder International">Egon Zehnder International</option>
                    <option value="Russell Reynolds Associates">Russell Reynolds Associates</option>
                    <option value="Spencer Stuart">Spencer Stuart</option>
                    <option value="Korn Ferry">Korn Ferry</option>
                    <option value="Freier PE-Partner / Family Office">Freier PE-Partner / Family Office</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                  Vakanz / Organfunktion *
                </label>
                <input
                  type="text"
                  required
                  placeholder="z. B. Interim CFO, CEO-Nachfolge, CRO Restrukturierung"
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.9rem', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                    Übermittlungsdatum
                  </label>
                  <input
                    type="date"
                    value={newTransmittedAt}
                    onChange={(e) => setNewTransmittedAt(e.target.value)}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.88rem', boxSizing: 'border-box' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#059669', marginBottom: '6px' }}>
                    Kundenschutz bis (exakt +12M)
                  </label>
                  <div style={{ padding: '10px 12px', background: 'rgba(16, 185, 129, 0.1)', borderRadius: '8px', border: '1px solid rgba(16, 185, 129, 0.3)', fontWeight: 700, color: '#059669', fontSize: '0.88rem' }}>
                    {(() => {
                      const d = new Date(`${newTransmittedAt}T12:00:00Z`)
                      d.setFullYear(d.getFullYear() + 1)
                      return d.toLocaleDateString('de-DE')
                    })()}
                  </div>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                  Primärquellen-Nachweis / Notizen
                </label>
                <textarea
                  rows={2}
                  placeholder="z. B. EQS Ad-hoc Beschluss vom Vortag. Blind-Dossier per Mail an Partner übermittelt."
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.88rem', boxSizing: 'border-box', resize: 'none' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '12px' }}>
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  style={{ padding: '10px 16px', background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '8px', fontWeight: 600, cursor: 'pointer' }}
                >
                  Abbrechen
                </button>
                <button
                  type="submit"
                  style={{ padding: '10px 20px', background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)', color: '#ffffff', border: 'none', borderRadius: '8px', fontWeight: 700, cursor: 'pointer' }}
                >
                  Kundenschutz aktivieren & protokollieren
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
