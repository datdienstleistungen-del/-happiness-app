import React, { useState, useEffect, useRef } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import {
  Briefcase,
  Radar,
  ShieldCheck,
  Archive,
  User,
  ChevronLeft,
  ChevronRight,
  Menu,
  Send,
  ArrowLeft
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useLanguage } from '../../i18n/translations.jsx'
import Logo from '../Logo'

function TopNavigationHeader() {
  const navigate = useNavigate()
  const location = useLocation()
  const [lastCompany, setLastCompany] = useState(null)

  useEffect(() => {
    const checkLast = () => {
      try {
        const stored = sessionStorage.getItem('nexus_last_viewed_company') || localStorage.getItem('nexus_last_viewed_company')
        if (stored) {
          const parsed = typeof stored === 'string' && stored.startsWith('{') ? JSON.parse(stored) : { name: stored }
          setLastCompany(parsed)
        }
      } catch (e) {}
    }
    checkLast()
    window.addEventListener('storage', checkLast)
    return () => window.removeEventListener('storage', checkLast)
  }, [location.pathname])

  const routeTitles = {
    '/nexus/sales-workspace': 'Mandats-Desk',
    '/nexus/events': 'Primär-Radar',
    '/nexus/outreach': 'Outreach / Gesendete E-Mails',
    '/nexus/mandats-archiv': 'Mandats-Archiv',
    '/coach': 'DealCoach',
    '/nexus/dashboard': 'Executive Dashboard',
    '/nexus/lead-intelligence': 'Lead Intelligence Desk'
  }

  let currentTitle = routeTitles[location.pathname] || 'NeXus Origination Desk'
  if (location.pathname === '/nexus/mandats-archiv') {
    if (location.search.includes('tab=contracts')) {
      currentTitle = 'Kooperationsverträge & Partner'
    } else {
      currentTitle = 'Mandats-Archiv & Kundenschutz'
    }
  }

  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1)
    } else {
      navigate('/nexus/events')
    }
  }

  const handleJumpToLastCase = () => {
    if (!lastCompany) return
    if (lastCompany.targetUrl) {
      navigate(lastCompany.targetUrl)
    } else if (lastCompany.eventId) {
      navigate(`/nexus/events?highlight=${encodeURIComponent(lastCompany.eventId)}`)
    } else {
      navigate(`/nexus/events?company=${encodeURIComponent(lastCompany.name || lastCompany)}`)
    }
  }

  return (
    <header className="nexus-top-nav-bar">
      <div className="nexus-top-nav-left">
        <button
          type="button"
          onClick={handleBack}
          className="nexus-nav-back-btn"
          title="Einen Schritt zurück zur vorherigen Arbeitsstation"
        >
          <ArrowLeft size={15} />
          <span>Zurück</span>
        </button>

        <div className="nexus-nav-breadcrumbs">
          <span className="crumb-root">NeXus</span>
          <span className="crumb-sep">/</span>
          <span className="crumb-current">{currentTitle}</span>
        </div>
      </div>

      <div className="nexus-top-nav-right">
        {lastCompany && (
          <button
            type="button"
            onClick={handleJumpToLastCase}
            className="nexus-quick-return-pill"
            title={`Sofort zurück zu ${lastCompany.name || lastCompany} springen`}
          >
            <span className="pill-pulse" />
            <Briefcase size={13} />
            <span>Zuletzt geöffnet: <strong>{lastCompany.name || lastCompany}</strong></span>
            <ChevronRight size={13} />
          </button>
        )}
      </div>
    </header>
  )
}

function Sidebar({ mobileOpen, setMobileOpen }) {
  const { user, profile, signOut } = useAuth()
  const { t } = useLanguage()
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

  // 5 exklusive Mandats-Workstations
  const mandateLinks = [
    { to: '/nexus/sales-workspace', icon: Briefcase, label: 'Mandats-Desk' },
    { to: '/nexus/outreach', icon: Send, label: 'Outreach / Gesendete E-Mails' },
    { to: '/nexus/mandats-archiv', icon: Archive, label: 'Mandats-Archiv' },
    { to: '/nexus/events', icon: Radar, label: 'Primär-Radar' },
    { to: '/coach', icon: ShieldCheck, label: 'DealCoach' },
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
                background: '#0284c7',
                color: '#ffffff',
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
          {renderLinks(mandateLinks)}
        </nav>

        <div className="sidebar-footer">
          {!collapsed && (
            <div className="sidebar-legal" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '12px', paddingBottom: '8px', borderBottom: '1px solid #1e293b' }}>
              <Link to="/legal?tab=impressum" className="sidebar-legal-link" style={{ fontSize: '0.72rem', color: '#64748b' }}>Impressum</Link>
              <span style={{ color: '#334155', fontSize: '0.72rem' }}>·</span>
              <Link to="/legal?tab=datenschutz" className="sidebar-legal-link" style={{ fontSize: '0.72rem', color: '#64748b' }}>Datenschutz</Link>
            </div>
          )}

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
                <div className="sidebar-avatar" onClick={() => navigate('/login')} style={{ cursor: 'pointer', background: '#1e293b', border: '1px solid #334155', color: '#38bdf8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <User size={16} />
                </div>
                {!collapsed && (
                  <div className="sidebar-user-info">
                    <div className="sidebar-user-name">
                      Gast-Modus
                    </div>
                    <button className="sidebar-logout" onClick={() => navigate('/login')} style={{ color: '#38bdf8', fontWeight: 'bold' }}>Anmelden</button>
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
  const location = useLocation()

  return (
    <nav className="mobile-bottom-nav">
      <Link to="/nexus/sales-workspace" className={`mobile-nav-link ${location.pathname === '/nexus/sales-workspace' ? 'active' : ''}`}>
        <Briefcase size={20} />
        <span>Mandats-Desk</span>
      </Link>
      <Link to="/nexus/events" className={`mobile-nav-link ${location.pathname === '/nexus/events' ? 'active' : ''}`}>
        <Radar size={20} />
        <span>Primär-Radar</span>
      </Link>
      <Link to="/coach" className={`mobile-nav-link ${location.pathname === '/coach' ? 'active' : ''}`}>
        <ShieldCheck size={20} />
        <span>DealCoach</span>
      </Link>
      <Link to="/nexus/mandats-archiv" className={`mobile-nav-link ${location.pathname === '/nexus/mandats-archiv' ? 'active' : ''}`}>
        <Archive size={20} />
        <span>Mandats-Archiv</span>
      </Link>
    </nav>
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

      <main className={isMainContentWithSidebar ? 'main-content with-sidebar' : 'main-content full'}>
        {shouldShowSidebar && (
          <button className="mobile-menu-btn" onClick={() => setMobileSidebarOpen(true)}>
            <Menu size={22} />
          </button>
        )}
        
        {shouldShowSidebar && <TopNavigationHeader />}

        {children}
      </main>

      {shouldShowSidebar && <MobileBar />}
    </>
  )
}
