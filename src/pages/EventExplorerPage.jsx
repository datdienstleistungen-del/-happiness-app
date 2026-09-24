import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Building2, Calendar, MapPin, Sparkles, Loader2, AlertCircle, CheckCircle, ArrowRight, Globe, Crown } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import * as db from '../lib/nexus-db'
import { callEliteEnrichment } from '../lib/nexus-ai'
import './EventExplorerPage.css'

const DEFAULT_EVENT_TYPES = [
  { id: 'leadership_change', event_key: 'leadership_change', label_de: 'Führungswechsel / C-Level', description_de: 'Neuer CEO, CTO, CIO oder VP eingestellt', icon: 'Crown' },
  { id: 'funding_round', event_key: 'funding_round', label_de: 'Finanzierungsrunde / Kapitalerhöhung', description_de: 'Frisches Kapital für Expansion & Tool-Investitionen', icon: 'TrendingUp' },
  { id: 'expansion_hiring', event_key: 'expansion_hiring', label_de: 'Expansion & Massen-Recruiting', description_de: 'Neuer Standort oder starkes Team-Wachstum', icon: 'Rocket' },
  { id: 'merger_acquisition', event_key: 'merger_acquisition', label_de: 'Übernahme & M&A', description_de: 'Fusion, Akquisition oder System-Harmonisierung', icon: 'GitMerge' },
  { id: 'compliance_audit', event_key: 'compliance_audit', label_de: 'Compliance / ESG / Regulatorik', description_de: 'Neue EU-Vorgaben, NIS-2, ISO-Zertifizierungen', icon: 'Shield' },
  { id: 'software_switch', event_key: 'software_switch', label_de: 'Tool-Wechsel & IT-Modernisierung', description_de: 'Ablösung von Legacy-Systemen oder Cloud-Migration', icon: 'Package' }
]

export default function EventExplorerPage() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const [eventTypes, setEventTypes] = useState(DEFAULT_EVENT_TYPES)
  const [selectedType, setSelectedType] = useState(DEFAULT_EVENT_TYPES[0])
  const [region, setRegion] = useState('Deutschland')
  const [loading, setLoading] = useState(false)
  const [events, setEvents] = useState([])
  const [stats, setStats] = useState(null)
  const [error, setError] = useState(null)
  const [existingEvents, setExistingEvents] = useState([])
  const [enrichingId, setEnrichingId] = useState(null)
  const [enrichedPackages, setEnrichedPackages] = useState({})

  useEffect(() => {
    loadEventTypes()
    loadExistingEvents()
  }, [user])

  async function loadEventTypes() {
    const types = await db.getEventTypes()
    if (types && types.length > 0) {
      setEventTypes(types)
      if (!selectedType) setSelectedType(types[0])
    }
  }

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
        why_relevant: `Business Event: ${evt.event_type}`,
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
          region: region,
          time_range: '30d'
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
    const icons = { Building2, Users: Building2, TrendingUp: Sparkles, Rocket: ArrowRight, GitMerge: Building2, Package: Building2, Handshake: Building2, Crown: Building2, Leaf: Building2, Shield: Building2 }
    return icons[iconName] || Building2
  }

  return (
    <div className="event-explorer-page">
      <div className="event-explorer-header">
        <div>
          <h1>Business Event Explorer</h1>
          <p>Finde relevante Geschäftereignisse — unabhängig von Angeboten</p>
        </div>
      </div>

      {/* Event Type Selection */}
      <div className="event-type-grid">
        {eventTypes.map((type) => {
          const Icon = getEventIcon(type.icon)
          return (
            <button
              key={type.id}
              className={`event-type-card ${selectedType?.id === type.id ? 'selected' : ''}`}
              onClick={() => setSelectedType(type)}
            >
              <Icon size={24} />
              <span className="event-type-label">{type.label_de}</span>
              <span className="event-type-desc">{type.description_de}</span>
            </button>
          )
        })}
      </div>

      {/* Search Controls */}
      <div className="event-search-controls">
        <div className="event-search-input-group">
          <Globe size={18} className="search-icon" />
          <input
            type="text"
            value={region}
            onChange={(e) => setRegion(e.target.value)}
            placeholder="Region (z.B. Bayern, Deutschland, Europa)"
          />
        </div>
        <button
          className="event-search-button"
          onClick={handleSearch}
          disabled={!selectedType || loading}
        >
          {loading ? (
            <><Loader2 size={18} className="spin" /> Suche läuft...</>
          ) : (
            <><Search size={18} /> Events suchen</>
          )}
        </button>
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
          <span><strong>{stats.strategies}</strong> Strategien</span>
          <span><strong>{stats.searched}</strong> Quellen durchsucht</span>
          <span><strong>{stats.deduplicated}</strong> Duplikate entfernt</span>
          <span><strong>{stats.extracted}</strong> Events extrahiert</span>
        </div>
      )}

      {/* Results */}
      {events.length > 0 && (
        <div className="event-results">
          <h2>Gefundene Events ({events.length})</h2>
          {events.map((evt, i) => (
            <div key={evt.id || i} className="event-result-card">
              <div className="event-result-header">
                <span className={`event-type-badge ${evt.verification_status}`}>
                  {evt.event_type}
                </span>
                <span className="event-date">
                  {evt.event_date ? new Date(evt.event_date).toLocaleDateString('de-DE') : 'Kein Datum'}
                </span>
              </div>
              <h3>{evt.title}</h3>
              {evt.description && <p className="event-description">{evt.description}</p>}
              <div className="event-meta">
                <span><Building2 size={14} /> {evt.company_name || 'UNRESOLVED'}</span>
                {evt.city && <span><MapPin size={14} /> {evt.city}{evt.country ? `, ${evt.country}` : ''}</span>}
                {evt.confidence && <span><Sparkles size={14} /> {Math.round(evt.confidence * 100)}%</span>}
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
                      className="elite-button"
                      onClick={() => handleCreateAndEnrich(evt)}
                      disabled={enrichingId === evt.id}
                    >
                      {enrichingId === evt.id ? (
                        <><Loader2 size={14} className="spin" /> Anreichern...</>
                      ) : (
                        <><Crown size={14} /> Elite Package</>
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
          <h2>Bisherige Events ({existingEvents.length})</h2>
          {existingEvents.slice(0, 10).map((evt) => (
            <div key={evt.id} className="event-result-card existing">
              <div className="event-result-header">
                <span className={`event-type-badge ${evt.verification_status}`}>
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
