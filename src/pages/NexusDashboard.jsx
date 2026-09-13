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
import { useLanguage } from '../i18n/translations.jsx'
import { ContextHelpButton } from '../context/GuideContext'
import './NexusDashboard.css'

export default function NexusDashboard() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { t } = useLanguage()
  const { opportunities, triggers, radarHits, offerings, loading: contextLoading } = useLead()
  const [stats, setStats] = useState({
    totalOpps: 0,
    newTriggers: 0,
    analyses: 0
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    document.title = t('nexus.dashboard.title', 'NeXus Dashboard | Sales Intelligence')
    if (user) {
      loadDashboardData()
    }
  }, [user, t])

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
    if (window.confirm(t('nexus.dashboard.devCleanSlateConfirm', 'Willst du wirklich ALLE deine NeXus-Daten (Angebote, Leads, Signale) löschen? Dies kann nicht rückgängig gemacht werden.'))) {
      setLoading(true)
      await wipeAllUserData(user.id)
      window.location.reload()
    }
  }

  const quickActions = [
    {
      icon: Target,
      title: t('nexus.dashboard.qaOfferingTitle', 'Angebotsanalyse'),
      description: t('nexus.dashboard.qaOfferingDesc', 'Beschreibe dein Angebot und erhalte dein Vertriebsmodell'),
      action: () => navigate('/nexus/angebotsanalyse'),
      color: "#10B981"
    },
    {
      icon: Radar,
      title: t('nexus.dashboard.qaRadarTitle', 'Lead Radar'),
      description: t('nexus.dashboard.qaRadarDesc', 'Finde Trigger Events und Kaufsignale'),
      action: () => navigate('/nexus/lead-radar'),
      color: "#3B82F6"
    },
    {
      icon: Zap,
      title: t('nexus.dashboard.qaWorkspaceTitle', 'Sales Workspace'),
      description: t('nexus.dashboard.qaWorkspaceDesc', 'Generiere Nachrichten und verwalte Leads'),
      action: () => navigate('/nexus/sales-workspace'),
      color: "#F59E0B"
    }
  ]

  if (loading) {
    return (
      <div className="nexus-dashboard-loading">
        <div className="nexus-spinner"></div>
        <p>{t('nexus.dashboard.loading', 'Dashboard wird geladen...')}</p>
      </div>
    )
  }

  const userName = user?.user_metadata?.name || t('nexus.dashboard.welcomeDefault', 'Unternehmer')

  return (
    <div className="nexus-dashboard">
      {/* Header */}
      <header className="nexus-dashboard-header">
        <div className="nexus-dashboard-welcome">
          <h1>{t('nexus.dashboard.welcome', 'Willkommen zurück')}, {userName}</h1>
          <p>{t('nexus.dashboard.subtitle', 'Hier ist dein Überblick über aktuelle Verkaufschancen')}</p>
        </div>
        <button 
          className="nexus-btn-primary"
          onClick={() => navigate('/nexus/angebotsanalyse')}
        >
          <Target size={18} />
          {t('nexus.dashboard.btnAnalyzeNew', 'Neues Angebot analysieren')}
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
            <span className="nexus-stat-label">{t('nexus.dashboard.statOpps', 'Aktive Opportunities')}</span>
          </div>
        </Link>
        
        <Link to="/nexus/lead-radar" className="nexus-stat-card" style={{ textDecoration: 'none', cursor: 'pointer' }}>
          <div className="nexus-stat-icon" style={{ background: '#EF444420', color: '#EF4444' }}>
            <Radar size={24} />
          </div>
          <div className="nexus-stat-content">
            <span className="nexus-stat-value">{stats.newTriggers}</span>
            <span className="nexus-stat-label">{t('nexus.dashboard.statSignals', 'Frische Signale')}</span>
          </div>
        </Link>
        
        <Link to="/nexus/lead-radar" className="nexus-stat-card" style={{ textDecoration: 'none', cursor: 'pointer' }}>
          <div className="nexus-stat-icon" style={{ background: '#3B82F620', color: '#3B82F6' }}>
            <Target size={24} />
          </div>
          <div className="nexus-stat-content">
            <span className="nexus-stat-value">{stats.analyses}</span>
            <span className="nexus-stat-label">{t('nexus.dashboard.statAnalyses', 'Analysen')}</span>
          </div>
        </Link>
        
        <Link to="/nexus/angebotsanalyse" className="nexus-stat-card" style={{ textDecoration: 'none', cursor: 'pointer' }}>
          <div className="nexus-stat-icon" style={{ background: '#F59E0B20', color: '#F59E0B' }}>
            <Users size={24} />
          </div>
          <div className="nexus-stat-content">
            <span className="nexus-stat-value">{offerings.length}</span>
            <span className="nexus-stat-label">{t('nexus.dashboard.statOfferings', 'Aktive Angebote')}</span>
          </div>
        </Link>
      </div>

      {/* Quick Actions */}
      <section className="nexus-section">
        <h2>{t('nexus.dashboard.quickAccess', 'Schnellzugriff')}</h2>
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
            <h2>{t('nexus.dashboard.recentOpps', 'Letzte Opportunities')}</h2>
            <button onClick={() => navigate('/nexus/sales-workspace')}>
              {t('nexus.dashboard.viewPipeline', 'Pipeline anzeigen')} <ChevronRight size={16} />
            </button>
          </div>
          <div className="nexus-trigger-list">
            {opportunities && opportunities.length > 0 ? (
              opportunities.slice(0, 5).map((opp) => (
                <div key={opp.id} className="nexus-trigger-item">
                  <div className={`nexus-trigger-badge ${opp.pipeline_stage === 'opportunity' ? 'hoch' : 'mittel'}`}>
                    {opp.pipeline_stage === 'opportunity' ? <Zap size={13} /> : <Target size={13} />}
                  </div>
                  <div className="nexus-trigger-content">
                    <strong>{opp.nexus_companies?.name || t('nexus.dashboard.unknownCompany', 'Unbekannt')}</strong>
                    <p>{t('nexus.dashboard.stage', 'Stage')}: {opp.pipeline_stage}</p>
                  </div>
                </div>
              ))
            ) : (
              <div className="nexus-empty-state">
                <p>{t('nexus.dashboard.noOppsYet', 'Noch keine Opportunities. Starte das Lead Radar, um Signale zu finden.')}</p>
              </div>
            )}
          </div>
        </section>

        {/* Recent Triggers */}
        <section className="nexus-section nexus-column">
          <div className="nexus-section-header">
            <h2 style={{ display: 'flex', alignItems: 'center' }}>
              {t('nexus.dashboard.nightShiftTitle', 'Signale der Nachtschicht (Auto-Radar)')}
              <ContextHelpButton helpKey="dashboard.auto_radar" />
            </h2>
            <button onClick={() => navigate('/nexus/lead-radar')}>
              {t('nexus.dashboard.openRadar', 'Radar öffnen')} <ChevronRight size={16} />
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
                    <strong>{hit.title || t('nexus.dashboard.unknownSignal', 'Unbekanntes Signal')}</strong>
                    <span style={{color: hit.relevance_score >= 80 ? '#10B981' : 'var(--text-secondary)'}}>
                      {t('nexus.dashboard.score', 'Score')}: {hit.relevance_score} | {hit.trigger_type || t('nexus.dashboard.noTrigger', 'Kein Trigger extrahiert')}
                    </span>
                  </div>
                  <ChevronRight size={16} className="nexus-analysis-arrow" />
                </div>
              ))
            ) : (
              <div className="nexus-empty-state">
                <p>{t('nexus.dashboard.noNightSignals', 'Keine neuen Signale aus der Nachtschicht. Das Radar läuft im Hintergrund.')}</p>
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
            <h3>{t('nexus.dashboard.coachTitle', 'Brauchst du Hilfe bei deiner Strategie?')}</h3>
            <p>{t('nexus.dashboard.coachDesc', 'Der Coach unterstützt dich kontextbezogen bei allen Fragen zu NeXus und deinem Vertrieb.')}</p>
          </div>
        </div>
        <button 
          className="nexus-btn-secondary"
          onClick={() => navigate('/coach')}
        >
          {t('nexus.dashboard.openCoach', 'Coach öffnen')} <ArrowRight size={16} />
        </button>
      </section>

      {/* Danger Zone */}
      <section style={{ marginTop: '40px', padding: '20px', border: '1px solid #EF444440', borderRadius: '12px', background: '#EF444410', textAlign: 'center' }}>
        <h3 style={{ color: '#EF4444', marginBottom: '10px' }}>{t('nexus.dashboard.devCleanSlateTitle', 'Entwickler-Modus: Clean Slate')}</h3>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '15px', fontSize: '0.9rem' }}>
          {t('nexus.dashboard.devCleanSlateDesc', 'Löscht alle Analysen, Angebote, Signale und Leads, um das Tool von Grund auf neu zu testen.')}
        </p>
        <button 
          onClick={handleReset}
          style={{ background: '#EF4444', color: 'white', padding: '8px 16px', borderRadius: '8px', fontWeight: 'bold', border: 'none', cursor: 'pointer' }}
        >
          {t('nexus.dashboard.devCleanSlateBtn', 'Alle Daten unwiderruflich löschen')}
        </button>
      </section>
    </div>
  )
}
