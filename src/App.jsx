import { useState, useEffect, useRef, lazy, Suspense, Component } from 'react'
import { Routes, Route, Link, useNavigate, Navigate, useLocation } from 'react-router-dom'
import {
  Sparkles, MessageCircle, Users, ShoppingCart, Briefcase,
  BookOpen, Building2, Clapperboard, Camera, Film, Bell, Settings,
  User, ChevronLeft, ChevronRight, Rocket, Hash, Menu, BarChart3, Trophy, Radar,
  Target, FolderOpen, Globe, LayoutDashboard
} from 'lucide-react'
import { supabase } from './lib/supabase'
import { LanguageProvider, useLanguage, LANGUAGES } from './i18n/translations.jsx'
import AuthContext, { useAuth } from './context/AuthContext'
import Logo, { renderBrandText } from './components/Logo'
import { useOneSignal } from './hooks/useOneSignal'
import { trackPageView, checkAndTrackReturnVisit, getVisitorId } from './intelligence/analytics/custom'
import InstallButton from './components/InstallButton'
import Feed from './components/Feed'
import DashboardPage from './pages/DashboardPage'
import PlatformEngine from './pages/PlatformEngine'
import LandingPage from './pages/LandingPage'
import OnboardingGuard from './components/OnboardingGuard'
import './App.css'

const LoginPage = lazy(() => import('./pages/LoginPage'))
const RegisterPage = lazy(() => import('./pages/RegisterPage'))
const CommunityPage = lazy(() => import('./pages/CommunityPage'))
const FriendsPage = lazy(() => import('./pages/FriendsPage'))
const MarketplacePage = lazy(() => import('./pages/MarketplacePage'))
const JobsPage = lazy(() => import('./pages/JobsPage'))
const CoursesPage = lazy(() => import('./pages/CoursesPage'))
const HousingPage = lazy(() => import('./pages/HousingPage'))
const ProfilePage = lazy(() => import('./pages/ProfilePage'))
const NotificationsPage = lazy(() => import('./pages/NotificationsPage'))
const HistoryPage = lazy(() => import('./pages/HistoryPage'))
const AdminPage = lazy(() => import('./pages/AdminPage'))
const LegalPage = lazy(() => import('./pages/LegalPage'))
const PhotoEditorPage = lazy(() => import('./pages/PhotoEditorPage'))
const FotostoryPage = lazy(() => import('./pages/FotostoryPage'))
const AIChatPage = lazy(() => import('./pages/AIChatPage'))
const ExecutionPipeline = lazy(() => import('./pages/ExecutionPipeline'))
const TikTokVideoPage = lazy(() => import('./pages/TikTokVideoPage'))
const CreatorAcademyPage = lazy(() => import('./pages/CreatorAcademyPage'))
const PostPreparationPage = lazy(() => import('./pages/PostPreparationPage'))
const OnboardingPage = lazy(() => import('./pages/OnboardingPage'))
const TodayQuestionPage = lazy(() => import('./pages/TodayQuestionPage'))
const AnalyticsPage = lazy(() => import('./pages/AnalyticsPage'))
const LeadRadarPage = lazy(() => import('./pages/LeadRadarPage'))
const CreatorSuccessPage = lazy(() => import('./pages/CreatorSuccessPage'))

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

  const mainLinks = [
    { to: '/', icon: Target, label: 'H.I.T.' },
  ]

  const studioLinks = [
    { to: '/creator-academy', icon: Rocket, label: 'Content Studio' },
    { to: '/capcut-studio', icon: Film, label: 'CapCut Studio' },
    { to: '/ai-chat', icon: Sparkles, label: 'AI Chat' },
    { to: '/analytics', icon: BarChart3, label: 'Analytics' },
  ]

  const discoverLinks = [
    { to: '/community', icon: Globe, label: 'Community Feed' },
    { to: '/friends', icon: Users, label: 'Streamer Squads' },
    { to: '/marketplace', icon: ShoppingCart, label: t('nav.marketplace') },
    { to: '/jobs', icon: Briefcase, label: t('nav.jobs') },
    { to: '/courses', icon: BookOpen, label: t('nav.courses') },
    { to: '/housing', icon: Building2, label: t('nav.housing') },
  ]

  const accountLinks = [
    { to: '/notifications', icon: Bell, label: t('nav.notifications') },
  ]

  if (profile?.role === 'admin') {
    accountLinks.push({ to: '/admin', icon: Settings, label: t('nav.admin') })
    accountLinks.push({ to: '/admin/lead-radar', icon: Radar, label: 'Global Lead Radar' })
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
      {!collapsed && <span>{link.label}</span>}
    </Link>
  ))

  return (
    <>
      {mobileOpen && <div className="sidebar-overlay" onClick={() => setMobileOpen(false)} />}
      <aside ref={sidebarRef} className={`sidebar ${collapsed ? 'collapsed' : ''} ${mobileOpen ? 'mobile-open' : ''}`}>
        <div className="sidebar-header">
          <Link to="/" className="sidebar-brand" onClick={() => setMobileOpen(false)}>
            <img src="/favicon.svg" alt="H" style={{ width: '32px', height: '32px' }} />
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
        {renderLinks(mainLinks)}

        <div className="sidebar-divider"></div>
        {!collapsed && <div className="sidebar-section-title">My Studio</div>}
        {renderLinks(studioLinks)}

        <div className="sidebar-divider"></div>
        {!collapsed && <div className="sidebar-section-title">Entdecken</div>}
        {renderLinks(discoverLinks)}

        <div className="sidebar-divider"></div>
        {!collapsed && <div className="sidebar-section-title">Konto</div>}
        {renderLinks(accountLinks)}
      </nav>

      <div className="sidebar-footer">
        {!collapsed && (
          <div className="sidebar-legal">
            <Link to="/legal?tab=impressum" className="sidebar-legal-link">{t('legal.impressum') || 'Impressum'}</Link>
            <Link to="/legal?tab=datenschutz" className="sidebar-legal-link">{t('legal.privacy') || 'Datenschutz'}</Link>
            <Link to="/legal?tab=agb" className="sidebar-legal-link">AGB</Link>
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
          <div className="sidebar-avatar">
            {(profile?.name || user?.email || '?')[0].toUpperCase()}
          </div>
          {!collapsed && (
            <div className="sidebar-user-info">
              <div className="sidebar-user-name">{profile?.name || user?.email}</div>
              <button className="sidebar-logout" onClick={handleSignOut}>{t('nav.logout')}</button>
            </div>
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
        <Link to="/" className={`mobile-nav-link ${location.pathname === '/' ? 'active' : ''}`}>
          <Target size={20} />
          <span>H.I.T.</span>
        </Link>
        <Link to="/creator-academy" className={`mobile-nav-link ${location.pathname === '/creator-academy' ? 'active' : ''}`}>
          <FolderOpen size={20} />
          <span>Studio</span>
        </Link>
        <Link to="/community" className={`mobile-nav-link ${location.pathname === '/community' ? 'active' : ''}`}>
          <Globe size={20} />
          <span>Entdecken</span>
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

class ErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { error: null } }
  static getDerivedStateFromError(error) { return { error } }
  render() {
    if (this.state.error) {
      return <div style={{ padding: 24, background: '#1a1a2e', color: '#e74c3c', fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>
        <h2>Runtime Error</h2>
        <p>{this.state.error.message}</p>
        <pre>{this.state.error.stack}</pre>
      </div>
    }
    return this.props.children
  }
}

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  const { t } = useLanguage()
  if (loading) return <div className="loading">{t('auth.logging')}</div>
  if (!user) return <Navigate to="/login" />
  return children
}

export default function App() {
  const location = useLocation()
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)

  useEffect(() => {
    checkAndTrackReturnVisit()

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user) {
        fetchProfile(session.user.id)
      } else {
        setLoading(false)
      }
    }).catch(() => {
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (session?.user) {
        fetchProfile(session.user.id)
      } else {
        setProfile(null)
        setLoading(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  // Track page views for activity monitoring
  useEffect(() => {
    if (user) {
      supabase.from('profiles').update({ last_seen: new Date().toISOString() }).eq('id', user.id).then()
    }
    // Custom analytics tracking
    trackPageView(location.pathname)
    // Log page view (skip admin)
    if (user && profile && profile.role !== 'admin') {
      supabase.from('page_views').insert({
        path: location.pathname,
        user_id: user?.id || null,
        user_agent: navigator.userAgent,
        referrer: document.referrer || null
      }).then()
    }
  }, [location.pathname])

  async function fetchProfile(userId) {
    try {
      const { data } = await supabase.from('profiles').select('*').eq('id', userId).single()
      setProfile(data)

      const visitorId = getVisitorId()
      supabase.rpc('claim_anonymous_events', {
        p_user_id: userId,
        p_visitor_id: visitorId
      }).then(({ error }) => {
        if (error) console.warn('[Analytics] Claim error:', error.message)
      })
    } catch (e) {
      console.warn('[Profile] Fetch error:', e.message)
    } finally {
      setLoading(false)
    }
  }

  async function signOut() {
    await supabase.auth.signOut()
    setUser(null)
    setProfile(null)
  }

  useOneSignal(user)

  return (
    <LanguageProvider>
      <AuthContext.Provider value={{ user, profile, loading, fetchProfile, signOut }}>
        {loading ? (
          <LoadingScreen />
        ) : (
          <>
            {user && !['/onboarding', '/today-question'].includes(location.pathname) && <Sidebar mobileOpen={mobileSidebarOpen} setMobileOpen={setMobileSidebarOpen} />}
            {!user && location.pathname !== '/login' && location.pathname !== '/register' && (
              <nav className="public-topbar">
                <Link to="/" className="public-topbar-brand">
                  <img src="/favicon.svg" alt="H" style={{ width: '28px', height: '28px' }} />
                  <Logo />
                </Link>
                <div className="public-topbar-links">
                  <Link to="/marketplace" className={location.pathname === '/marketplace' ? 'active' : ''}>Marktplatz</Link>
                  <Link to="/jobs" className={location.pathname === '/jobs' ? 'active' : ''}>Jobs</Link>
                  <Link to="/courses" className={location.pathname === '/courses' ? 'active' : ''}>Kurse</Link>
                  <Link to="/housing" className={location.pathname === '/housing' ? 'active' : ''}>Wohnungen</Link>
                  <Link to="/community" className={location.pathname === '/community' ? 'active' : ''}>Community</Link>
                </div>
                <div className="public-topbar-actions">
                  <Link to="/login" className="btn btn-outline btn-sm">Anmelden</Link>
                  <Link to="/register" className="btn btn-primary btn-sm">Registrieren</Link>
                </div>
              </nav>
            )}
              <main className={user && !['/onboarding', '/today-question'].includes(location.pathname) ? 'main-content with-sidebar' : 'main-content full'}>
              {user && (
                <button className="mobile-menu-btn" onClick={() => setMobileSidebarOpen(true)}>
                  <Menu size={22} />
                </button>
              )}
              <ErrorBoundary>
              <Suspense fallback={<div className="loading">Laden...</div>}>
              <Routes>
                <Route path="/login" element={user ? <Navigate to="/" /> : <LoginPage />} />
                <Route path="/register" element={user ? <Navigate to="/" /> : <RegisterPage />} />
                <Route path="/" element={user ? <OnboardingGuard><PlatformEngine /></OnboardingGuard> : <LandingPage />} />
                <Route path="/onboarding" element={<ProtectedRoute><OnboardingPage /></ProtectedRoute>} />
                <Route path="/today-question" element={<ProtectedRoute><TodayQuestionPage /></ProtectedRoute>} />
                <Route path="/community" element={<CommunityPage />} />
                <Route path="/friends" element={<ProtectedRoute><FriendsPage /></ProtectedRoute>} />
                <Route path="/marketplace" element={<MarketplacePage />} />
                <Route path="/jobs" element={<JobsPage />} />
                <Route path="/courses" element={<CoursesPage />} />
                <Route path="/housing" element={<HousingPage />} />
                <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
                <Route path="/notifications" element={<ProtectedRoute><NotificationsPage /></ProtectedRoute>} />
                <Route path="/history" element={<ProtectedRoute><HistoryPage /></ProtectedRoute>} />
                <Route path="/admin" element={<ProtectedRoute><AdminPage /></ProtectedRoute>} />
                <Route path="/admin/creator-success" element={<ProtectedRoute><CreatorSuccessPage /></ProtectedRoute>} />
                <Route path="/photo-editor" element={<ProtectedRoute><PhotoEditorPage /></ProtectedRoute>} />
                <Route path="/fotostory" element={<ErrorBoundary><ProtectedRoute><FotostoryPage /></ProtectedRoute></ErrorBoundary>} />
                <Route path="/ai-chat" element={<ProtectedRoute><AIChatPage /></ProtectedRoute>} />
                <Route path="/execute" element={<ProtectedRoute><ExecutionPipeline /></ProtectedRoute>} />
                <Route path="/creator-academy" element={<ProtectedRoute><CreatorAcademyPage /></ProtectedRoute>} />
                <Route path="/post-preparation" element={<ProtectedRoute><PostPreparationPage /></ProtectedRoute>} />
                <Route path="/capcut-studio" element={<ProtectedRoute><TikTokVideoPage /></ProtectedRoute>} />
                <Route path="/analytics" element={<ProtectedRoute><AnalyticsPage /></ProtectedRoute>} />
                <Route path="/admin/lead-radar" element={<ProtectedRoute><LeadRadarPage /></ProtectedRoute>} />
                <Route path="/legal" element={<LegalPage />} />
                <Route path="/impressum" element={<LegalPage />} />
                <Route path="/datenschutz" element={<LegalPage />} />
                <Route path="/agb" element={<LegalPage />} />
              </Routes>
              </Suspense>
              </ErrorBoundary>
            </main>
            {user && !['/onboarding', '/today-question'].includes(location.pathname) && <MobileBar />}
          </>
        )}
      </AuthContext.Provider>
    </LanguageProvider>
  )
}

function LoadingScreen() {
  const { t } = useLanguage()
  return <div className="loading-screen">Wird geladen…</div>
}
