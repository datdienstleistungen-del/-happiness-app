import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, BarChart3, Users, Eye, Copy, MapPin, Calendar, RefreshCw } from 'lucide-react'
import { supabase } from '../lib/supabase'
import './AnalyticsPage.css'

const RANGES = [
  { value: '24h', label: '24 Stunden' },
  { value: '7d', label: '7 Tage' },
  { value: '30d', label: '30 Tage' },
]

const EVENT_LABELS = {
  page_view: 'Seitenaufrufe',
  goal_submitted: 'Ziele eingegeben',
  quick_result: 'Quick Results',
  content_generated: 'Content generiert',
  copy_action: 'Kopiert',
  chat_message: 'Chat Nachrichten',
  workflow_started: 'Workflows gestartet',
  workflow_completed: 'Workflows abgeschlossen',
}

export default function AnalyticsPage() {
  const navigate = useNavigate()
  const [range, setRange] = useState('7d')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => { loadAnalytics() }, [range])

  async function loadAnalytics() {
    setLoading(true)
    setError('')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token || ''
      const res = await fetch(`/.netlify/functions/analytics-query?range=${range}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (!res.ok) {
        const err = await res.json()
        setError(err.error || 'Fehler beim Laden')
      } else {
        setData(await res.json())
      }
    } catch (e) {
      setError(e.message)
    }
    setLoading(false)
  }

  return (
    <div className="analytics-page">
      <div className="analytics-header">
        <button className="analytics-back" onClick={() => navigate(-1)}>
          <ArrowLeft size={20} />
        </button>
        <h1><BarChart3 size={22} /> Custom Analytics</h1>
      </div>

      <div className="analytics-controls">
        <div className="analytics-range-btns">
          {RANGES.map(r => (
            <button
              key={r.value}
              className={`analytics-range-btn ${range === r.value ? 'active' : ''}`}
              onClick={() => setRange(r.value)}
            >{r.label}</button>
          ))}
        </div>
        <button className="analytics-refresh" onClick={loadAnalytics} disabled={loading}>
          <RefreshCw size={14} className={loading ? 'spin' : ''} /> Aktualisieren
        </button>
      </div>

      {error && <div className="analytics-error">{error}</div>}

      {loading && !data && (
        <div className="analytics-loading">Lade Analytics...</div>
      )}

      {data && (
        <>
          <div className="analytics-grid">
            <div className="analytics-card">
              <div className="analytics-card-icon" style={{ background: '#1d9e75' }}>
                <Eye size={22} />
              </div>
              <div className="analytics-card-content">
                <span className="analytics-card-value">{data.totalEvents?.toLocaleString() || '0'}</span>
                <span className="analytics-card-label">Events gesamt</span>
              </div>
            </div>
            <div className="analytics-card">
              <div className="analytics-card-icon" style={{ background: '#0A66C2' }}>
                <Users size={22} />
              </div>
              <div className="analytics-card-content">
                <span className="analytics-card-value">{data.uniqueVisitors?.toLocaleString() || '0'}</span>
                <span className="analytics-card-label">Eindeutige Besucher</span>
              </div>
            </div>
            <div className="analytics-card">
              <div className="analytics-card-icon" style={{ background: '#F59E0B' }}>
                <Copy size={22} />
              </div>
              <div className="analytics-card-content">
                <span className="analytics-card-value">{(data.eventCounts?.copy_action || 0).toLocaleString()}</span>
                <span className="analytics-card-label">Kopier-Aktionen</span>
              </div>
            </div>
            <div className="analytics-card">
              <div className="analytics-card-icon" style={{ background: '#E4405F' }}>
                <MapPin size={22} />
              </div>
              <div className="analytics-card-content">
                <span className="analytics-card-value">{data.topCities?.length || 0}</span>
                <span className="analytics-card-label">Städte erkannt</span>
              </div>
            </div>
          </div>

          <div className="analytics-section">
            <h2>Events nach Typ</h2>
            <div className="analytics-event-list">
              {Object.entries(data.eventCounts || {})
                .sort((a, b) => b[1] - a[1])
                .map(([name, count]) => (
                  <div key={name} className="analytics-event-row">
                    <span className="analytics-event-name">{EVENT_LABELS[name] || name}</span>
                    <div className="analytics-event-bar">
                      <div
                        className="analytics-event-fill"
                        style={{ width: `${Math.min(100, (count / (data.totalEvents || 1)) * 100)}%` }}
                      />
                    </div>
                    <span className="analytics-event-count">{count.toLocaleString()}</span>
                  </div>
                ))}
            </div>
          </div>

          {data.topCities?.length > 0 && (
            <div className="analytics-section">
              <h2>Top Städte</h2>
              <div className="analytics-city-list">
                {data.topCities.map((city, i) => (
                  <div key={i} className="analytics-city-row">
                    <span className="analytics-city-rank">#{i + 1}</span>
                    <span className="analytics-city-name">{city.name}</span>
                    <span className="analytics-city-count">{city.count} Events</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {data.dailyBreakdown?.length > 0 && (
            <div className="analytics-section">
              <h2>Täglicher Verlauf</h2>
              <div className="analytics-daily-chart">
                {data.dailyBreakdown.map((day, i) => {
                  const maxVal = Math.max(...data.dailyBreakdown.map(d => d.page_views), 1)
                  return (
                    <div key={i} className="analytics-daily-col">
                      <div className="analytics-daily-bar-wrap">
                        <div
                          className="analytics-daily-bar"
                          style={{ height: `${(day.page_views / maxVal) * 100}%` }}
                          title={`${day.page_views} Views, ${day.goals} Ziele, ${day.copies} Kopien`}
                        />
                      </div>
                      <span className="analytics-daily-date">
                        {new Date(day.date).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          <div className="analytics-footer">
            <p>Daten werden in Supabase-Tabelle <code>events</code> gespeichert. DSGVO-konform, keine Google-Abhängigkeit.</p>
          </div>
        </>
      )}
    </div>
  )
}
