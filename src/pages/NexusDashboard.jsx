import React, { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { 
  Radar, Target, TrendingUp, Users, ArrowRight, Zap, Activity,
  BarChart3, Clock, CheckCircle, AlertCircle, ChevronRight,
  Lightbulb, TrendingDown, DollarSign, Building2, Sparkles
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
      color: "var(--accent-blue, #38bdf8)"
    },
    {
      icon: Radar,
      title: t('nexus.dashboard.qaRadarTitle', 'Lead Radar'),
      description: t('nexus.dashboard.qaRadarDesc', 'Finde Trigger Events und Kaufsignale'),
      action: () => navigate('/nexus/lead-radar'),
      color: "var(--accent-emerald, #10b981)"
    },
    {
      icon: Zap,
      title: t('nexus.dashboard.qaWorkspaceTitle', 'Sales Workspace'),
      description: t('nexus.dashboard.qaWorkspaceDesc', 'Generiere Nachrichten und verwalte Leads'),
      action: () => navigate('/nexus/sales-workspace'),
      color: "var(--accent-blue, #38bdf8)"
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

      {/* 3-SCHRITTE ONBOARDING-ASSISTENT (für neue Nutzer oder Nutzer ohne Opportunities) */}
      {(offerings.length === 0 || stats.totalOpps === 0) && (
        <section className="nexus-onboarding-wizard" style={{
          background: 'linear-gradient(135deg, rgba(56, 189, 248, 0.12) 0%, rgba(16, 185, 129, 0.08) 100%)',
          border: '1px solid rgba(56, 189, 248, 0.3)',
          borderRadius: '16px',
          padding: '24px',
          marginBottom: '24px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.25rem', color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Sparkles size={20} color="var(--accent-blue, #38bdf8)" />
                {t('nexus.onboarding.title', 'NeXus Schnellstart in 3 Schritten')}
              </h2>
              <p style={{ margin: '4px 0 0 0', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                {t('nexus.onboarding.subtitle', 'In unter 60 Sekunden zu deinen ersten B2B-Verkaufschancen und abschlussstarken Pitches:')}
              </p>
            </div>
            <span style={{ fontSize: '0.8rem', background: 'rgba(56, 189, 248, 0.2)', color: '#38bdf8', padding: '4px 12px', borderRadius: '20px', fontWeight: 600 }}>
              {offerings.length === 0 ? 'Schritt 1 von 3' : 'Schritt 2 von 3'}
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px' }}>
            {/* Schritt 1: Angebot eingeben */}
            <div style={{
              background: offerings.length > 0 ? 'rgba(16, 185, 129, 0.08)' : 'rgba(15, 23, 42, 0.7)',
              border: offerings.length > 0 ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid var(--accent-blue, #38bdf8)',
              borderRadius: '12px',
              padding: '16px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between'
            }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                  <span style={{
                    background: offerings.length > 0 ? '#10b981' : '#38bdf8',
                    color: '#000',
                    borderRadius: '50%',
                    width: '24px',
                    height: '24px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 'bold',
                    fontSize: '0.85rem'
                  }}>
                    {offerings.length > 0 ? '✓' : '1'}
                  </span>
                  <strong style={{ color: '#fff' }}>1. Angebot definieren</strong>
                </div>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '0 0 12px 0' }}>
                  {offerings.length > 0 ? `Aktiv: "${offerings[0]?.offering_name || 'Angebot hinterlegt'}"` : 'Beschreibe kurz dein Produkt oder deine B2B-Dienstleistung.'}
                </p>
              </div>
              <button 
                className={offerings.length > 0 ? "nexus-btn-secondary" : "nexus-btn-primary"}
                style={{ width: '100%', fontSize: '0.85rem', padding: '8px 12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                onClick={() => navigate('/nexus/angebotsanalyse')}
              >
                <Target size={15} /> {offerings.length > 0 ? 'Angebot anpassen' : 'Angebot analysieren'}
              </button>
            </div>

            {/* Schritt 2: Lead Radar starten */}
            <div style={{
              background: offerings.length > 0 && stats.newTriggers === 0 ? 'rgba(15, 23, 42, 0.7)' : 'rgba(15, 23, 42, 0.4)',
              border: offerings.length > 0 && stats.newTriggers === 0 ? '1px solid var(--accent-blue, #38bdf8)' : '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '12px',
              padding: '16px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              opacity: offerings.length === 0 ? 0.6 : 1
            }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                  <span style={{
                    background: stats.newTriggers > 0 ? '#10b981' : (offerings.length > 0 ? '#38bdf8' : 'rgba(255, 255, 255, 0.2)'),
                    color: (stats.newTriggers > 0 || offerings.length > 0) ? '#000' : '#fff',
                    borderRadius: '50%',
                    width: '24px',
                    height: '24px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 'bold',
                    fontSize: '0.85rem'
                  }}>
                    {stats.newTriggers > 0 ? '✓' : '2'}
                  </span>
                  <strong style={{ color: '#fff' }}>2. Lead Radar starten</strong>
                </div>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '0 0 12px 0' }}>
                  {stats.newTriggers > 0 ? `${stats.newTriggers} Signale gefunden` : 'NeXus durchsucht News & Signale nach konkreten B2B-Kaufanlässen.'}
                </p>
              </div>
              <button 
                className={offerings.length > 0 ? "nexus-btn-primary" : "nexus-btn-secondary"}
                style={{ width: '100%', fontSize: '0.85rem', padding: '8px 12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                onClick={() => navigate('/nexus/lead-radar')}
                disabled={offerings.length === 0}
              >
                <Radar size={15} /> Lead Radar öffnen
              </button>
            </div>

            {/* Schritt 3: Ergebnis & Pitch sehen */}
            <div style={{
              background: 'rgba(15, 23, 42, 0.4)',
              border: stats.totalOpps > 0 ? '1px solid #10b981' : '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '12px',
              padding: '16px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              opacity: (offerings.length === 0 || stats.newTriggers === 0) ? 0.6 : 1
            }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                  <span style={{
                    background: stats.totalOpps > 0 ? '#10b981' : 'rgba(255, 255, 255, 0.2)',
                    color: stats.totalOpps > 0 ? '#000' : '#fff',
                    borderRadius: '50%',
                    width: '24px',
                    height: '24px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 'bold',
                    fontSize: '0.85rem'
                  }}>
                    {stats.totalOpps > 0 ? '✓' : '3'}
                  </span>
                  <strong style={{ color: '#fff' }}>3. Ergebnis & Pitch</strong>
                </div>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '0 0 12px 0' }}>
                  4-Schritte-Pitch generieren und Leads direkt im Workspace managen.
                </p>
              </div>
              <button 
                className="nexus-btn-secondary"
                style={{ width: '100%', fontSize: '0.85rem', padding: '8px 12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                onClick={() => navigate('/nexus/sales-workspace')}
              >
                <Zap size={15} /> Sales Workspace
              </button>
            </div>
          </div>
        </section>
      )}

      {/* Stats Grid */}
      <div className="nexus-stats-grid">
        <Link to="/nexus/sales-workspace" className="nexus-stat-card" style={{ textDecoration: 'none', cursor: 'pointer' }}>
          <div className="nexus-stat-icon">
            <Zap size={24} />
          </div>
          <div className="nexus-stat-content">
            <span className="nexus-stat-value">{stats.totalOpps}</span>
            <span className="nexus-stat-label">{t('nexus.dashboard.statOpps', 'Aktive Opportunities')}</span>
          </div>
        </Link>
        
        <Link to="/nexus/lead-radar" className="nexus-stat-card" style={{ textDecoration: 'none', cursor: 'pointer' }}>
          <div className="nexus-stat-icon" style={{ color: 'var(--accent-emerald, #10b981)' }}>
            <Radar size={24} />
          </div>
          <div className="nexus-stat-content">
            <span className="nexus-stat-value">{stats.newTriggers}</span>
            <span className="nexus-stat-label">{t('nexus.dashboard.statSignals', 'Frische Signale')}</span>
          </div>
        </Link>
        
        <Link to="/nexus/lead-radar" className="nexus-stat-card" style={{ textDecoration: 'none', cursor: 'pointer' }}>
          <div className="nexus-stat-icon">
            <Target size={24} />
          </div>
          <div className="nexus-stat-content">
            <span className="nexus-stat-value">{stats.analyses}</span>
            <span className="nexus-stat-label">{t('nexus.dashboard.statAnalyses', 'Analysen')}</span>
          </div>
        </Link>
        
        <Link to="/nexus/angebotsanalyse" className="nexus-stat-card" style={{ textDecoration: 'none', cursor: 'pointer' }}>
          <div className="nexus-stat-icon" style={{ color: 'var(--accent-emerald, #10b981)' }}>
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
              <div className="nexus-action-icon" style={{ color: action.color }}>
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
                    <Activity size={20} color="var(--accent-blue, #38bdf8)" />
                  </div>
                  <div className="nexus-analysis-content">
                    <strong>{hit.title || t('nexus.dashboard.unknownSignal', 'Unbekanntes Signal')}</strong>
                    <span style={{color: hit.relevance_score >= 80 ? 'var(--accent-emerald, #10b981)' : 'var(--text-secondary)'}}>
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
          <Lightbulb size={32} color="var(--accent-blue, #38bdf8)" />
          <div>
            <h3>{t('nexus.dashboard.coachTitle', 'Brauchst du Hilfe bei deiner Strategie?')}</h3>
            <p>{t('nexus.dashboard.coachDesc', 'Der Coach unterstützt dich kontextbezogen bei allen Fragen zu NeXus und deinem Vertrieb.')}</p>
          </div>
        </div>
        <button 
          className="nexus-btn-secondary"
          onClick={() => navigate('/coach')}
        >
          {t('nexus.dashboard.openCoach', 'DealCoach öffnen')} <ArrowRight size={16} />
        </button>
      </section>

      {/* Danger Zone */}
      <section style={{ marginTop: '40px', padding: '20px', border: '1px solid rgba(239, 68, 68, 0.25)', borderRadius: '12px', background: 'rgba(239, 68, 68, 0.05)', textAlign: 'center' }}>
        <h3 style={{ color: '#ef4444', marginBottom: '10px' }}>{t('nexus.dashboard.devCleanSlateTitle', 'Entwickler-Modus: Clean Slate')}</h3>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '15px', fontSize: '0.9rem' }}>
          {t('nexus.dashboard.devCleanSlateDesc', 'Löscht alle Analysen, Angebote, Signale und Leads, um das Tool von Grund auf neu zu testen.')}
        </p>
        <button 
          onClick={handleReset}
          style={{ background: '#ef4444', color: 'white', padding: '8px 16px', borderRadius: '8px', fontWeight: 'bold', border: 'none', cursor: 'pointer' }}
        >
          {t('nexus.dashboard.devCleanSlateBtn', 'Alle Daten unwiderruflich löschen')}
        </button>
      </section>
    </div>
  )
}
