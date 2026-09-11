import React, { useState, useEffect, useRef } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import {
  Heart, Users, Briefcase, BookOpen, Film, Settings,
  User, ChevronLeft, ChevronRight, Menu, Radar, Target, LayoutDashboard, Search, Video
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useLanguage, LANGUAGES } from '../../i18n/translations.jsx'
import Logo from '../Logo'
import InstallButton from '../InstallButton'

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
    { to: '/nexus/dashboard', icon: LayoutDashboard, label: 'NeXus Dashboard' },
    { to: '/nexus/angebotsanalyse', icon: Target, label: 'Angebotsanalyse' },
    { to: '/nexus/lead-radar', icon: Radar, label: 'Lead Radar' },
    { to: '/nexus/sales-workspace', icon: Briefcase, label: 'Sales Workspace' },
  ]

  const coachLinks = [
    { to: '/coach', icon: Heart, label: 'Coach' },
  ]

  const contentLinks = [
    { to: '/video-finder', icon: Search, label: 'Video Finder' },
    { to: '/video-script', icon: Video, label: 'Video Script', badge: 'NEU' },
    { to: '/capcut-studio', icon: Film, label: 'CapCut Studio' },
  ]

  const accountLinks = [
    { to: '/wissenschaft', icon: BookOpen, label: 'Vertriebspsychologie' },
  ]

  if (profile?.role === 'admin') {
    accountLinks.push({ to: '/admin', icon: Settings, label: t('nav.admin') })
  }

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
                background: 'var(--color-koralle, #d85a30)',
                color: '#ffffff',
                padding: '1px 5px',
                borderRadius: '4px',
                marginLeft: '6px',
                letterSpacing: '0.5px',
                cursor: 'help'
              }}
            >
              {t('newFeatures.new')}
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
            <img src="/favicon.svg" alt="NeXus" style={{ width: '32px', height: '32px' }} />
            {!collapsed && <Logo />}
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
          <div className="sidebar-section-title" style={{ color: 'var(--color-koralle)', fontWeight: '700' }}>
            NeXus ⭐
          </div>
        )}
        {renderLinks(nexusLinks)}

        <div className="sidebar-divider"></div>
        {!collapsed && (
          <div className="sidebar-section-title">
            {lang === 'es' ? 'Asistente' : lang === 'nl' ? 'Assistent' : lang === 'fr' ? 'Assistant' : lang === 'it' ? 'Assistente' : lang === 'el' ? 'Βοηθός' : lang === 'en' ? 'Assistant' : 'Assistent'}
          </div>
        )}
        {renderLinks(coachLinks)}

        <div className="sidebar-divider"></div>
        {!collapsed && (
          <div className="sidebar-section-title" style={{ display: 'flex', alignItems: 'center' }}>
            Video Intelligence
          </div>
        )}
        {renderLinks(contentLinks)}

        <div className="sidebar-divider"></div>
        {!collapsed && (
          <div className="sidebar-section-title">
            Wissen
          </div>
        )}
        {renderLinks(accountLinks)}
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

        <InstallButton variant="sidebar" />

        <div className="sidebar-user">
          {user ? (
            <>
              <div className="sidebar-avatar">
                {(profile?.name || user?.email || '?')[0].toUpperCase()}
              </div>
              {!collapsed && (
                <div className="sidebar-user-info">
                  <div className="sidebar-user-name">{profile?.name || user?.email}</div>
                  <button className="sidebar-logout" onClick={handleSignOut}>{t('nav.logout')}</button>
                </div>
              )}
            </>
          ) : (
            <>
              <div className="sidebar-avatar" onClick={() => navigate('/login')} style={{ cursor: 'pointer', background: 'var(--color-koralle, #d85a30)' }}>
                👤
              </div>
              {!collapsed && (
                <div className="sidebar-user-info">
                  <div className="sidebar-user-name">
                    {lang === 'es' ? 'Modo Invitado' : lang === 'nl' ? 'Gastmodus' : lang === 'fr' ? 'Mode Invité' : lang === 'it' ? 'Modalità Ospite' : lang === 'el' ? 'Λειτουργία Επισκέπτη' : lang === 'en' ? 'Guest Mode' : 'Gast-Modus'}
                  </div>
                  <button className="sidebar-logout" onClick={() => navigate('/login')} style={{ color: 'var(--color-koralle, #d85a30)', fontWeight: 'bold' }}>{t('auth.login')}</button>
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
        <Link to="/nexus/dashboard" className={`mobile-nav-link ${location.pathname.startsWith('/nexus') ? 'active' : ''}`}>
          <Radar size={20} />
          <span>NeXus</span>
        </Link>
        <Link to="/coach" className={`mobile-nav-link ${location.pathname === '/coach' ? 'active' : ''}`}>
          <Heart size={20} />
          <span>Coach</span>
        </Link>
        <Link to="/video-finder" className={`mobile-nav-link ${['/video-finder', '/video-script', '/capcut-studio'].includes(location.pathname) ? 'active' : ''}`}>
          <Video size={20} />
          <span>Studio</span>
        </Link>
        <Link to="/profile" className={`mobile-nav-link ${location.pathname === '/profile' ? 'active' : ''}`}>
          <User size={20} />
          <span>Profil</span>
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

  const shouldShowSidebar = ((user && !['/onboarding', '/today-question'].includes(location.pathname)) || (!user && ['/', '/video-finder', '/video-script', '/capcut-studio', '/tour'].includes(location.pathname)))
  
  const shouldShowPublicTopbar = !user && !['/login', '/register', '/video-finder', '/video-script', '/capcut-studio', '/tour', '/nexus'].includes(location.pathname)

  const isMainContentWithSidebar = ((user && !['/onboarding', '/today-question'].includes(location.pathname)) || (!user && ['/', '/video-finder', '/video-script', '/capcut-studio', '/tour'].includes(location.pathname)))

  return (
    <>
      {shouldShowSidebar && <Sidebar mobileOpen={mobileSidebarOpen} setMobileOpen={setMobileSidebarOpen} />}
      
      {shouldShowPublicTopbar && (
        <nav className="public-topbar">
          <Link to="/" className="public-topbar-brand">
                   <img src="/favicon.svg" alt="NeXus" style={{ width: '28px', height: '28px' }} />
            <Logo />
          </Link>
          <div className="public-topbar-links">
          </div>
          <div className="public-topbar-actions">
            {!user && (
              <>
                <Link to="/login" className="btn btn-outline btn-sm">Anmelden</Link>
                <Link to="/register" className="btn btn-primary btn-sm">Registrieren</Link>
              </>
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
