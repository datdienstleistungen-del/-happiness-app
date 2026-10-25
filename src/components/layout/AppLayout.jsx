import React, { useState, useEffect, useRef } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import {
  Heart, Briefcase, Settings,
  User, ChevronLeft, ChevronRight, Menu, Radar, Target, LayoutDashboard
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useLanguage, LANGUAGES } from '../../i18n/translations.jsx'
import Logo from '../Logo'

function Sidebar({ mobileOpen, setMobileOpen }) {
  const { user, profile, signOut } = useAuth()
  const { lang, setLang, t } = useLanguage()
  const navigate = useNavigate()
  const location = useLocation()
  const [collapsed, setCollapsed] = useState(false)
  const sidebarRef = useRef(null)

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth > 768) setMobileOpen(false)
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  useEffect(() => {
    if (!mobileOpen) return
    const handleClickOutside = (e) => {
      if (sidebarRef.current && !sidebarRef.current.contains(e.target)) {
        setMobileOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [mobileOpen])

  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [mobileOpen])

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  const nexusLinks = [
    { to: '/nexus/sales-workspace', icon: Briefcase, label: t('nexus.nav.salesWorkspace', 'Sales Workspace') },
    { to: '/nexus/lead-radar', icon: Radar, label: t('nexus.nav.leadRadar', 'Lead Radar') },
    { to: '/nexus/events', icon: Target, label: t('nexus.nav.events', 'Mandatsereignisse') },
    { to: '/nexus/dashboard', icon: LayoutDashboard, label: t('nexus.nav.dashboard', 'NeXus Dashboard') },
    { to: '/nexus/angebotsanalyse', icon: Target, label: t('nexus.nav.offeringAnalysis', 'Angebotsanalyse') },
  ]

  const coachLinks = [
    { to: '/coach', icon: Heart, label: t('nexus.nav.coach', 'DealCoach') },
  ]

  const renderLinks = (links) => links.map((link) => (
    <Link
      key={link.to}
      to={link.to}
      className={`sidebar-link ${location.pathname === link.to ? 'active' : ''}`}
      title={collapsed ? link.label : undefined}
      onClick={() => setMobileOpen(false)}
    >
      <span className="sidebar-icon"><link.icon size={19} /></span>
      {!collapsed && (
        <span className="sidebar-label-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
          <span>{link.label}</span>
          {link.badge && (
            <span 
              className="new-feature-badge" 
              title={t(link.badge)}
              style={{
                fontSize: '9px',
                fontWeight: '700',
                background: 'var(--accent-blue, #38bdf8)',
                color: '#050608',
                padding: '1px 5px',
                borderRadius: '4px',
                marginLeft: '6px',
                letterSpacing: '0.5px',
                cursor: 'help'
              }}
            >
              {t('newFeatures.new', 'NEU')}
            </span>
          )}
        </span>
      )}
    </Link>
  ))

  return (
    <>
      {mobileOpen && <div className="sidebar-overlay" onClick={() => setMobileOpen(false)} />}
      <aside ref={sidebarRef} className={`sidebar ${collapsed ? 'collapsed' : ''} ${mobileOpen ? 'mobile-open' : ''}`}>
        <div className="sidebar-header">
          <Link to="/" className="sidebar-brand" onClick={() => setMobileOpen(false)}>
            <Logo iconOnly={collapsed} size={collapsed ? 'small' : 'default'} />
          </Link>
          <button className="sidebar-toggle" onClick={() => {
            if (window.innerWidth <= 768) {
              setMobileOpen(!mobileOpen)
            } else {
              setCollapsed(!collapsed)
            }
          }}>
            {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
          </button>
      </div>

      <nav className="sidebar-nav">
        {!collapsed && (
          <div className="sidebar-section-title" style={{ color: 'var(--accent-blue, #38bdf8)', fontWeight: '700' }}>
            {t('nexus.nav.nexus', 'NeXus')}
          </div>
        )}
        {renderLinks(nexusLinks)}

        <div className="sidebar-divider"></div>
        {!collapsed && (
          <div className="sidebar-section-title">
            {t('nexus.nav.assistant', 'Assistent')}
          </div>
        )}
        {renderLinks(coachLinks)}

      </nav>

      <div className="sidebar-footer">
        {!collapsed && (
          <div className="sidebar-legal">
            <Link to="/legal?tab=impressum" className="sidebar-legal-link">{t('legal.impressum')}</Link>
            <Link to="/legal?tab=datenschutz" className="sidebar-legal-link">{t('legal.privacy')}</Link>
            <Link to="/legal?tab=agb" className="sidebar-legal-link">{t('legal.terms')}</Link>
          </div>
        )}
        <select
          className="sidebar-lang"
          value={lang}
          onChange={(e) => setLang(e.target.value)}
        >
          {LANGUAGES.map((l) => (
            <option key={l.code} value={l.code}>{l.flag} {l.label}</option>
          ))}
        </select>

        <div className="sidebar-user">
          {user ? (
            <>
              <div className="sidebar-avatar">
                {(profile?.name || user?.email || '?')[0].toUpperCase()}
              </div>
              {!collapsed && (
                <div className="sidebar-user-info">
                  <div className="sidebar-user-name">{profile?.name || user?.email}</div>
                  <button className="sidebar-logout" onClick={handleSignOut}>{t('nav.logout', 'Abmelden')}</button>
                </div>
              )}
            </>
          ) : (
            <>
              <div className="sidebar-avatar" onClick={() => navigate('/login')} style={{ cursor: 'pointer', background: 'var(--bg-card, #11141a)', border: '1px solid var(--border-medium, #2d3544)', color: 'var(--accent-blue, #38bdf8)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <User size={16} />
              </div>
              {!collapsed && (
                <div className="sidebar-user-info">
                  <div className="sidebar-user-name">
                    {t('nexus.nav.guestMode', 'Gast-Modus')}
                  </div>
                  <button className="sidebar-logout" onClick={() => navigate('/login')} style={{ color: 'var(--accent-blue, #38bdf8)', fontWeight: 'bold' }}>{t('auth.login')}</button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </aside>
    </>
  )
}

function MobileBar() {
  const { lang, setLang } = useLanguage()
  const location = useLocation()

  return (
    <>
      <nav className="mobile-bottom-nav">
        <Link to="/nexus/sales-workspace" className={`mobile-nav-link ${location.pathname === '/nexus/sales-workspace' ? 'active' : ''}`}>
          <Briefcase size={20} />
          <span>Workspace</span>
        </Link>
        <Link to="/nexus/lead-radar" className={`mobile-nav-link ${location.pathname === '/nexus/lead-radar' ? 'active' : ''}`}>
          <Radar size={20} />
          <span>Radar</span>
        </Link>
        <Link to="/nexus/events" className={`mobile-nav-link ${location.pathname === '/nexus/events' ? 'active' : ''}`}>
          <Target size={20} />
          <span>Events</span>
        </Link>
        <Link to="/coach" className={`mobile-nav-link ${location.pathname === '/coach' ? 'active' : ''}`}>
          <Heart size={20} />
          <span>DealCoach</span>
        </Link>
      </nav>
      <div className="mobile-lang-bar">
        <select
          className="mobile-lang-select"
          value={lang}
          onChange={(e) => setLang(e.target.value)}
        >
          {LANGUAGES.map((l) => (
            <option key={l.code} value={l.code}>{l.flag} {l.label}</option>
          ))}
        </select>
      </div>
    </>
  )
}

export default function AppLayout({ children }) {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  const { user } = useAuth()
  const location = useLocation()

  const isAuthPage = location.pathname === '/login' || location.pathname === '/register'
  const shouldShowSidebar = user && !isAuthPage
  const isMainContentWithSidebar = shouldShowSidebar

  return (
    <>
      {shouldShowSidebar && <Sidebar mobileOpen={mobileSidebarOpen} setMobileOpen={setMobileSidebarOpen} />}
      
      {shouldShowPublicTopbar && (
        <nav className="public-topbar">
          <Link to="/" className="public-topbar-brand">
            <Logo />
          </Link>
          <div className="public-topbar-links">
          </div>
          <div className="public-topbar-actions">
            {!user && (
              <Link to="/login" className="btn btn-primary btn-sm">Anmelden</Link>
            )}
            {user && (
              <Link to="/" className="btn btn-primary btn-sm">Zum Coach</Link>
            )}
          </div>
        </nav>
      )}

      <main className={isMainContentWithSidebar ? 'main-content with-sidebar' : 'main-content full'}>
        {shouldShowSidebar && (
          <button className="mobile-menu-btn" onClick={() => setMobileSidebarOpen(true)}>
            <Menu size={22} />
          </button>
        )}
        
        {children}
      </main>

      {shouldShowSidebar && <MobileBar />}
    </>
  )
}
