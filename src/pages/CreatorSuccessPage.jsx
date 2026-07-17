import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, TrendingUp, Users, Lightbulb, FileText, Copy, ExternalLink, CheckCircle, RotateCcw, RefreshCw } from 'lucide-react'
import { supabase } from '../lib/supabase'
import './CreatorSuccessPage.css'

const RANGES = [
  { value: '24h', label: '24 Stunden' },
  { value: '7d', label: '7 Tage' },
  { value: '30d', label: '30 Tage' },
]

const FUNNEL_STEPS = [
  { key: 'ideas', label: 'Idee eingegeben', icon: Lightbulb, color: '#f59e0b' },
  { key: 'generated', label: 'Content erzeugt', icon: FileText, color: '#3b82f6' },
  { key: 'copied', label: 'Content kopiert', icon: Copy, color: '#8b5cf6' },
  { key: 'exported', label: 'Exportiert', icon: ExternalLink, color: '#ec4899' },
  { key: 'published', label: 'Veröffentlicht', icon: CheckCircle, color: '#10b981' },
]

export default function CreatorSuccessPage() {
  const navigate = useNavigate()
  const [range, setRange] = useState('7d')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => { loadFunnel() }, [range])

  async function loadFunnel() {
    setLoading(true)
    setError('')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token || ''
      const res = await fetch(`/.netlify/functions/analytics-query?view=funnel&range=${range}`, {
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
    } finally {
      setLoading(false)
    }
  }

  const funnel = data?.funnel || {}
  const daily = data?.daily || []

  const maxDaily = daily.length > 0
    ? Math.max(...daily.map(d => Math.max(d.ideas, d.generated, d.copied, d.exported)), 1)
    : 1

  const getDropOff = (current, previous) => {
    if (!previous || previous === 0) return null
    return Math.round(((previous - current) / previous) * 100)
  }

  return (
    <div className="csp-page">
      <div className="csp-header">
        <button className="csp-back" onClick={() => navigate('/admin')}>
          <ArrowLeft size={18} />
        </button>
        <div className="csp-header-text">
          <h1>Creator Success Dashboard</h1>
          <p>Vom Konzept zur Veröffentlichung — Conversion-Funnel</p>
        </div>
        <button className="csp-refresh" onClick={loadFunnel} disabled={loading}>
          <RefreshCw size={16} className={loading ? 'spinning' : ''} />
        </button>
      </div>

      <div className="csp-range-selector">
        {RANGES.map(r => (
          <button
            key={r.value}
            className={`csp-range-btn ${range === r.value ? 'active' : ''}`}
            onClick={() => setRange(r.value)}
          >
            {r.label}
          </button>
        ))}
      </div>

      {error && <div className="csp-error">{error}</div>}

      {loading && !data && (
        <div className="csp-loading">
          <div className="csp-spinner"></div>
          <p>Lade Funnel-Daten...</p>
        </div>
      )}

      {data && (
        <>
          {/* Conversion Rate Hero */}
          <div className="csp-hero">
            <div className="csp-hero-value">{funnel.conversionRate || 0}%</div>
            <div className="csp-hero-label">Gesamt-Conversion</div>
            <div className="csp-hero-sub">Idee → Veröffentlicht</div>
          </div>

          {/* Funnel Visualization */}
          <div className="csp-funnel">
            <h2>Conversion-Funnel</h2>
            <div className="csp-funnel-steps">
              {FUNNEL_STEPS.map((step, i) => {
                const count = funnel[step.key] || 0
                const prevCount = i > 0 ? (funnel[FUNNEL_STEPS[i - 1].key] || 0) : null
                const dropOff = getDropOff(count, prevCount)
                const widthPercent = funnel.ideas > 0 ? (count / funnel.ideas) * 100 : 0
                const Icon = step.icon

                return (
                  <div key={step.key} className="csp-funnel-step">
                    <div className="csp-funnel-step-header">
                      <div className="csp-funnel-step-icon" style={{ color: step.color }}>
                        <Icon size={18} />
                      </div>
                      <span className="csp-funnel-step-label">{step.label}</span>
                      <span className="csp-funnel-step-count">{count}</span>
                    </div>
                    <div className="csp-funnel-bar-bg">
                      <div
                        className="csp-funnel-bar"
                        style={{ width: `${widthPercent}%`, backgroundColor: step.color }}
                      />
                    </div>
                    {dropOff !== null && dropOff > 0 && (
                      <div className="csp-funnel-dropoff">
                        -{dropOff}% Drop-off
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Stats Cards */}
          <div className="csp-stats-grid">
            <div className="csp-stat-card">
              <Users size={20} />
              <div className="csp-stat-value">{funnel.ideas || 0}</div>
              <div className="csp-stat-label">Ziele eingegeben</div>
            </div>
            <div className="csp-stat-card">
              <FileText size={20} />
              <div className="csp-stat-value">{funnel.generated || 0}</div>
              <div className="csp-stat-label">Content erzeugt</div>
            </div>
            <div className="csp-stat-card">
              <Copy size={20} />
              <div className="csp-stat-value">{funnel.copied || 0}</div>
              <div className="csp-stat-label">Kopiert</div>
            </div>
            <div className="csp-stat-card">
              <ExternalLink size={20} />
              <div className="csp-stat-value">{funnel.exported || 0}</div>
              <div className="csp-stat-label">Exportiert</div>
            </div>
            <div className="csp-stat-card">
              <CheckCircle size={20} />
              <div className="csp-stat-value">{funnel.published || 0}</div>
              <div className="csp-stat-label">Veröffentlicht</div>
            </div>
          </div>

          {/* Daily Trend */}
          {daily.length > 0 && (
            <div className="csp-trend">
              <h2>Täglicher Trend</h2>
              <div className="csp-trend-chart">
                {daily.slice(-14).map((day, i) => (
                  <div key={day.date} className="csp-trend-day">
                    <div className="csp-trend-bars">
                      <div
                        className="csp-trend-bar ideas"
                        style={{ height: `${(day.ideas / maxDaily) * 100}%` }}
                        title={`${day.ideas} Ideen`}
                      />
                      <div
                        className="csp-trend-bar generated"
                        style={{ height: `${(day.generated / maxDaily) * 100}%` }}
                        title={`${day.generated} Generiert`}
                      />
                      <div
                        className="csp-trend-bar copied"
                        style={{ height: `${(day.copied / maxDaily) * 100}%` }}
                        title={`${day.copied} Kopiert`}
                      />
                    </div>
                    <span className="csp-trend-date">
                      {new Date(day.date).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })}
                    </span>
                  </div>
                ))}
              </div>
              <div className="csp-trend-legend">
                <span><span className="csp-legend-dot ideas" /> Ideen</span>
                <span><span className="csp-legend-dot generated" /> Generiert</span>
                <span><span className="csp-legend-dot copied" /> Kopiert</span>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
