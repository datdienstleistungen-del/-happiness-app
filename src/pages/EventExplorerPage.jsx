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
  Briefcase
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

export default function EventExplorerPage() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const [eventTypes] = useState(MANDATE_EVENT_TYPES)
  const [selectedType, setSelectedType] = useState(MANDATE_EVENT_TYPES[0])
  const [selectedRegionId, setSelectedRegionId] = useState('EU_UK')
  const [customKeyword, setCustomKeyword] = useState('')
  const [loading, setLoading] = useState(false)
  const [events, setEvents] = useState([])
  const [stats, setStats] = useState(null)
  const [error, setError] = useState(null)
  const [existingEvents, setExistingEvents] = useState([])
  const [enrichingId, setEnrichingId] = useState(null)
  const [enrichedPackages, setEnrichedPackages] = useState({})

  const selectedGeo = GEOGRAPHY_OPTIONS.find(g => g.id === selectedRegionId) || GEOGRAPHY_OPTIONS[0]

  useEffect(() => {
    loadExistingEvents()
  }, [user])

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
    if (!selectedType || !user) return

    setLoading(true)
    setError(null)
    setEvents([])
    setStats(null)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token || ''

      const res = await fetch('/.netlify/functions/cron-event-search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          event_type: selectedType.event_key,
          event_label: selectedType.label_de,
          event_keywords: selectedType.keywords,
          region_id: selectedGeo.id,
          region: selectedGeo.label,
          target_sources: selectedGeo.sources,
          source_keywords: selectedGeo.sourcesList,
          custom_keyword: customKeyword.trim() || undefined,
          time_range: '48h'
        })
      })

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.error || `Search failed: ${res.statusText}`)
      }

      const result = await res.json()
      setEvents(result.events || [])
      setStats(result.stats || {})
      await loadExistingEvents()
    } catch (err) {
      console.error('Event Search error:', err)
      setError(err.message || 'Search failed')
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

      {/* Mandate Event Type Selection (6 Cards) */}
      <div className="event-type-grid">
        {eventTypes.map((type) => {
          const Icon = getEventIcon(type.icon)
          const isSelected = selectedType?.id === type.id
          return (
            <button
              key={type.id}
              type="button"
              className={`event-type-card ${isSelected ? 'selected' : ''}`}
              onClick={() => setSelectedType(type)}
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
            disabled={!selectedType || loading}
          >
            {loading ? (
              <><Loader2 size={18} className="spin" /> Durchsuche Primärquellen...</>
            ) : (
              <><Search size={18} /> Mandats-Events suchen</>
            )}
          </button>
        </div>
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

      {/* Error */}
      {error && (
        <div className="event-error">
          <AlertCircle size={18} /> {error}
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
      {events.length > 0 && (
        <div className="event-results">
          <h2>Gefundene Mandats-Events ({events.length})</h2>
          {events.map((evt, i) => (
            <div key={evt.id || i} className="event-result-card">
              <div className="event-result-header">
                <span className={`event-type-badge ${evt.verification_status || 'verified'}`}>
                  {evt.event_type}
                </span>
                <span className="event-date">
                  <Calendar size={13} style={{ display: 'inline', marginRight: 4, verticalAlign: 'text-top' }} />
                  {evt.event_date ? new Date(evt.event_date).toLocaleDateString('de-DE') : 'Echtzeit-Signal'}
                </span>
              </div>
              <h3>{evt.title}</h3>
              {evt.description && <p className="event-description">{evt.description}</p>}
              <div className="event-meta">
                <span><Building2 size={14} /> {evt.company_name || 'UNRESOLVED'}</span>
                {evt.city && <span><MapPin size={14} /> {evt.city}{evt.country ? `, ${evt.country}` : ''}</span>}
                {evt.confidence && <span><Sparkles size={14} /> Match-Konfidenz: {Math.round(evt.confidence * 100)}%</span>}
              </div>
              {evt.id && (
                <div className="event-actions">
                  {enrichedPackages[evt.id] ? (
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
                        <><Crown size={14} /> Mandats-Package generieren</>
                      )}
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

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
    </div>
  )
}
