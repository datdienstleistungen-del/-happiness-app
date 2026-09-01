import React, { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { 
  Radar, Target, TrendingUp, Users, ArrowRight, Zap, Activity,
  BarChart3, Clock, CheckCircle, AlertCircle, ChevronRight,
  Lightbulb, TrendingDown, DollarSign, Building2
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { getDashboardStats, wipeAllUserData } from '../lib/nexus-db'
import { useLead } from '../context/LeadContext'
import { ContextHelpButton } from '../context/GuideContext'
import './NexusDashboard.css'

export default function NexusDashboard() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { opportunities, triggers, radarHits, offerings, loading: contextLoading } = useLead()
  const [stats, setStats] = useState({
    totalOpps: 0,
    newTriggers: 0,
    analyses: 0
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    document.title = "NeXus Dashboard | Sales Intelligence"
    if (user) {
      loadDashboardData()
    }
  }, [user])

  const loadDashboardData = async () => {
    if (!user) return
    setLoading(true)
    const statsData = await getDashboardStats(user.id)
    setStats(statsData)
    setLoading(false)
  }

  const handleAnalysisClick = async (offeringId) => {
    // Navigate to sales workspace or analysis view
    navigate('/nexus/sales-workspace')
  }

  const handleReset = async () => {
    if (window.confirm('Willst du wirklich ALLE deine NeXus-Daten (Angebote, Leads, Signale) löschen? Dies kann nicht rückgängig gemacht werden.')) {
      setLoading(true)
      await wipeAllUserData(user.id)
      window.location.reload()
    }
  }

  const quickActions = [
    {
      icon: Target,
      title: "Angebotsanalyse",
      description: "Beschreibe dein Angebot und erhalte dein Vertriebsmodell",
      action: () => navigate('/nexus/angebotsanalyse'),
      color: "#10B981"
    },
    {
      icon: Radar,
      title: "Lead Radar",
      description: "Finde Trigger Events und Kaufsignale",
      action: () => navigate('/nexus/lead-radar'),
      color: "#3B82F6"
    },
    {
      icon: Zap,
      title: "Sales Workspace",
      description: "Generiere Nachrichten und verwalte Leads",
      action: () => navigate('/nexus/sales-workspace'),
      color: "#F59E0B"
    }
  ]

  if (loading) {
    return (
      <div className="nexus-dashboard-loading">
        <div className="nexus-spinner"></div>
        <p>Dashboard wird geladen...</p>
      </div>
    )
  }

  return (
    <div className="nexus-dashboard">
      {/* Header */}
      <header className="nexus-dashboard-header">
        <div className="nexus-dashboard-welcome">
          <h1>Willkommen zurück, {user?.user_metadata?.name || 'Unternehmer'}</h1>
          <p>Hier ist dein Überblick über aktuelle Verkaufschancen</p>
        </div>
        <button 
          className="nexus-btn-primary"
          onClick={() => navigate('/nexus/angebotsanalyse')}
        >
          <Target size={18} />
          Neues Angebot analysieren
        </button>
      </header>

      {/* Stats Grid */}
      <div className="nexus-stats-grid">
        <Link to="/nexus/sales-workspace" className="nexus-stat-card" style={{ textDecoration: 'none', cursor: 'pointer' }}>
          <div className="nexus-stat-icon" style={{ background: '#10B98120', color: '#10B981' }}>
            <Zap size={24} />
          </div>
          <div className="nexus-stat-content">
            <span className="nexus-stat-value">{stats.totalOpps}</span>
            <span className="nexus-stat-label">Aktive Opportunities</span>
          </div>
        </Link>
        
        <Link to="/nexus/lead-radar" className="nexus-stat-card" style={{ textDecoration: 'none', cursor: 'pointer' }}>
          <div className="nexus-stat-icon" style={{ background: '#EF444420', color: '#EF4444' }}>
            <Radar size={24} />
          </div>
          <div className="nexus-stat-content">
            <span className="nexus-stat-value">{stats.newTriggers}</span>
            <span className="nexus-stat-label">Frische Signale</span>
          </div>
        </Link>
        
        <Link to="/nexus/lead-radar" className="nexus-stat-card" style={{ textDecoration: 'none', cursor: 'pointer' }}>
          <div className="nexus-stat-icon" style={{ background: '#3B82F620', color: '#3B82F6' }}>
            <Target size={24} />
          </div>
          <div className="nexus-stat-content">
            <span className="nexus-stat-value">{stats.analyses}</span>
            <span className="nexus-stat-label">Analysen</span>
          </div>
        </Link>
        
        <Link to="/nexus/angebotsanalyse" className="nexus-stat-card" style={{ textDecoration: 'none', cursor: 'pointer' }}>
          <div className="nexus-stat-icon" style={{ background: '#F59E0B20', color: '#F59E0B' }}>
            <Users size={24} />
          </div>
          <div className="nexus-stat-content">
            <span className="nexus-stat-value">{offerings.length}</span>
            <span className="nexus-stat-label">Aktive Angebote</span>
          </div>
        </Link>
      </div>

      {/* Quick Actions */}
      <section className="nexus-section">
        <h2>Schnellzugriff</h2>
        <div className="nexus-quick-actions">
          {quickActions.map((action, index) => (
            <div 
              key={index} 
              className="nexus-action-card"
              onClick={action.action}
            >
              <div className="nexus-action-icon" style={{ background: `${action.color}20`, color: action.color }}>
                <action.icon size={24} />
              </div>
              <div className="nexus-action-content">
                <h3>{action.title}</h3>
                <p>{action.description}</p>
              </div>
              <ChevronRight size={20} className="nexus-action-arrow" />
            </div>
          ))}
        </div>
      </section>

      {/* Two Column Layout */}
      <div className="nexus-dashboard-columns">
        {/* Recent Opportunities */}
        <section className="nexus-section nexus-column">
          <div className="nexus-section-header">
            <h2>Letzte Opportunities</h2>
            <button onClick={() => navigate('/nexus/sales-workspace')}>
              Pipeline anzeigen <ChevronRight size={16} />
            </button>
          </div>
          <div className="nexus-trigger-list">
            {opportunities && opportunities.length > 0 ? (
              opportunities.slice(0, 5).map((opp) => (
                <div key={opp.id} className="nexus-trigger-item">
                  <div className={`nexus-trigger-badge ${opp.pipeline_stage === 'opportunity' ? 'hoch' : 'mittel'}`}>
                    {opp.pipeline_stage === 'opportunity' ? '🔥' : '📍'}
                  </div>
                  <div className="nexus-trigger-content">
                    <strong>{opp.nexus_companies?.name || 'Unbekannt'}</strong>
                    <p>Stage: {opp.pipeline_stage}</p>
                  </div>
                </div>
              ))
            ) : (
              <div className="nexus-empty-state">
                <p>Noch keine Opportunities. Starte das Lead Radar, um Signale zu finden.</p>
              </div>
            )}
          </div>
        </section>

        {/* Recent Triggers */}
        <section className="nexus-section nexus-column">
          <div className="nexus-section-header">
            <h2 style={{ display: 'flex', alignItems: 'center' }}>
              Signale der Nachtschicht (Auto-Radar)
              <ContextHelpButton helpKey="dashboard.auto_radar" />
            </h2>
            <button onClick={() => navigate('/nexus/lead-radar')}>
              Radar öffnen <ChevronRight size={16} />
            </button>
          </div>
          <div className="nexus-analyses-list">
            {radarHits && radarHits.length > 0 ? (
              radarHits.slice(0, 5).map((hit) => (
                <div 
                  key={hit.id} 
                  className="nexus-analysis-item nexus-clickable"
                  onClick={() => navigate('/nexus/lead-radar')}
                >
                  <div className="nexus-analysis-icon">
                    <Activity size={20} color="#3B82F6" />
                  </div>
                  <div className="nexus-analysis-content">
                    <strong>{hit.title || 'Unbekanntes Signal'}</strong>
                    <span style={{color: hit.relevance_score >= 80 ? '#10B981' : 'var(--text-secondary)'}}>
                      Score: {hit.relevance_score} | {hit.trigger_type || 'Kein Trigger extrahiert'}
                    </span>
                  </div>
                  <ChevronRight size={16} className="nexus-analysis-arrow" />
                </div>
              ))
            ) : (
              <div className="nexus-empty-state">
                <p>Keine neuen Signale aus der Nachtschicht. Das Radar läuft im Hintergrund.</p>
              </div>
            )}
          </div>
        </section>
      </div>

      {/* Coach Teaser */}
      <section className="nexus-coach-teaser">
        <div className="nexus-coach-content">
          <Lightbulb size={32} color="#F59E0B" />
          <div>
            <h3>Brauchst du Hilfe bei deiner Strategie?</h3>
            <p>Der Coach unterstützt dich kontextbezogen bei allen Fragen zu NeXus und deinem Vertrieb.</p>
          </div>
        </div>
        <button 
          className="nexus-btn-secondary"
          onClick={() => navigate('/coach')}
        >
          Coach öffnen <ArrowRight size={16} />
        </button>
      </section>

      {/* Danger Zone */}
      <section style={{ marginTop: '40px', padding: '20px', border: '1px solid #EF444440', borderRadius: '12px', background: '#EF444410', textAlign: 'center' }}>
        <h3 style={{ color: '#EF4444', marginBottom: '10px' }}>Entwickler-Modus: Clean Slate</h3>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '15px', fontSize: '0.9rem' }}>
          Löscht alle Analysen, Angebote, Signale und Leads, um das Tool von Grund auf neu zu testen.
        </p>
        <button 
          onClick={handleReset}
          style={{ background: '#EF4444', color: 'white', padding: '8px 16px', borderRadius: '8px', fontWeight: 'bold', border: 'none', cursor: 'pointer' }}
        >
          Alle Daten unwiderruflich löschen
        </button>
      </section>
    </div>
  )
}
