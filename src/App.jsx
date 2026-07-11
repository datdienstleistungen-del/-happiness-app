import { useState, useEffect, lazy, Suspense } from 'react'
import { Routes, Route, Link, useNavigate, Navigate, useLocation } from 'react-router-dom'
import {
  Home, Sparkles, MessageCircle, Users, ShoppingCart, Briefcase,
  BookOpen, Building2, Clapperboard, Camera, Film, Bell, Settings,
  User, ChevronLeft, ChevronRight, Rocket, Hash, Menu
} from 'lucide-react'
import { supabase } from './lib/supabase'
import { LanguageProvider, useLanguage, LANGUAGES } from './i18n/translations.jsx'
import AuthContext, { useAuth } from './context/AuthContext'
import Logo, { renderBrandText } from './components/Logo'
import Feed from './components/Feed'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import CommunityPage from './pages/CommunityPage'
import FriendsPage from './pages/FriendsPage'
import MarketplacePage from './pages/MarketplacePage'
import JobsPage from './pages/JobsPage'
import CoursesPage from './pages/CoursesPage'
import HousingPage from './pages/HousingPage'
import ProfilePage from './pages/ProfilePage'
import NotificationsPage from './pages/NotificationsPage'
import HistoryPage from './pages/HistoryPage'
import AdminPage from './pages/AdminPage'
import LegalPage from './pages/LegalPage'
import OnboardingGuard from './components/OnboardingGuard'
import './App.css'

const VideoMakerPage = lazy(() => import('./pages/VideoMakerPage'))
const PhotoEditorPage = lazy(() => import('./pages/PhotoEditorPage'))
const FotostoryPage = lazy(() => import('./pages/FotostoryPage'))
const AIChatPage = lazy(() => import('./pages/AIChatPage'))
const TikTokVideoPage = lazy(() => import('./pages/TikTokVideoPage'))
const CreatorAcademyPage = lazy(() => import('./pages/CreatorAcademyPage'))
const OnboardingPage = lazy(() => import('./pages/OnboardingPage'))
const TodayQuestionPage = lazy(() => import('./pages/TodayQuestionPage'))
const CreatorWelcomePage = lazy(() => import('./pages/CreatorWelcomePage'))

function Sidebar() {
  const { user, profile, signOut } = useAuth()
  const { lang, setLang, t } = useLanguage()
  const navigate = useNavigate()
  const location = useLocation()
  const [collapsed, setCollapsed] = useState(false)

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  const mainLinks = [
    { to: '/', icon: Home, label: t('nav.home') },
  ]

  const communityLinks = [
    { to: '/community', icon: Hash, label: 'Feed' },
    { to: '/friends', icon: Users, label: t('nav.friends') },
    { to: '/notifications', icon: Bell, label: t('nav.notifications') },
  ]

  const creatorLinks = [
    { to: '/creator-academy', icon: Rocket, label: 'NCG Academy' },
    { to: '/tiktok-video', icon: Film, label: 'TikTok Video' },
    { to: '/ai-chat', icon: Sparkles, label: 'AI Chat' },
    { to: '/video-maker', icon: Clapperboard, label: t('nav.videoMaker') },
    { to: '/photo-editor', icon: Camera, label: 'Foto Editor' },
    { to: '/fotostory', icon: Film, label: 'Fotostory' },
  ]

  const marketplaceLinks = [
    { to: '/marketplace', icon: ShoppingCart, label: t('nav.marketplace') },
    { to: '/jobs', icon: Briefcase, label: t('nav.jobs') },
    { to: '/housing', icon: Building2, label: t('nav.housing') },
  ]

  const toolsLinks = [
    { to: '/courses', icon: BookOpen, label: t('nav.courses') },
  ]

  if (profile?.role === 'admin') {
    toolsLinks.push({ to: '/admin', icon: Settings, label: t('nav.admin') })
  }

  const renderLinks = (links) => links.map((link) => (
    <Link
      key={link.to}
      to={link.to}
      className={`sidebar-link ${location.pathname === link.to ? 'active' : ''}`}
      title={collapsed ? link.label : undefined}
    >
      <span className="sidebar-icon"><link.icon size={19} /></span>
      {!collapsed && <span>{link.label}</span>}
    </Link>
  ))

  return (
    <aside className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
      <div className="sidebar-header">
        <Link to="/" className="sidebar-brand">
          <img src="/favicon.svg" alt="H" style={{ width: '32px', height: '32px' }} />
          {!collapsed && <Logo />}
        </Link>
        <button className="sidebar-toggle" onClick={() => setCollapsed(!collapsed)}>
          {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
        </button>
      </div>

      <nav className="sidebar-nav">
        {renderLinks(mainLinks)}

        <div className="sidebar-divider"></div>
        {!collapsed && <div className="sidebar-section-title">Community</div>}
        {renderLinks(communityLinks)}

        <div className="sidebar-divider"></div>
        {!collapsed && <div className="sidebar-section-title">Creator</div>}
        {renderLinks(creatorLinks)}

        <div className="sidebar-divider"></div>
        {!collapsed && <div className="sidebar-section-title">Marktplatz</div>}
        {renderLinks(marketplaceLinks)}

        <div className="sidebar-divider"></div>
        {!collapsed && <div className="sidebar-section-title">Tools</div>}
        {renderLinks(toolsLinks)}
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
  )
}

function MobileBar() {
  const { lang, setLang } = useLanguage()
  const location = useLocation()

  return (
    <>
      <nav className="mobile-bottom-nav">
        <Link to="/" className={`mobile-nav-link ${location.pathname === '/' ? 'active' : ''}`}>
          <Home size={20} />
          <span>Home</span>
        </Link>
        <Link to="/community" className={`mobile-nav-link ${location.pathname === '/community' ? 'active' : ''}`}>
          <Hash size={20} />
          <span>Feed</span>
        </Link>
        <Link to="/creator-academy" className={`mobile-nav-link ${location.pathname === '/creator-academy' ? 'active' : ''}`}>
          <Rocket size={20} />
          <span>Create</span>
        </Link>
        <Link to="/ai-chat" className={`mobile-nav-link ${location.pathname === '/ai-chat' ? 'active' : ''}`}>
          <Sparkles size={20} />
          <span>AI</span>
        </Link>
        <Link to="/marketplace" className={`mobile-nav-link ${location.pathname === '/marketplace' ? 'active' : ''}`}>
          <ShoppingCart size={20} />
          <span>Market</span>
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
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user) {
        fetchProfile(session.user.id)
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (session?.user) {
        fetchProfile(session.user.id)
      } else {
        setProfile(null)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  // Track page views for activity monitoring
  useEffect(() => {
    if (user) {
      supabase.from('profiles').update({ last_seen: new Date().toISOString() }).eq('id', user.id).then()
    }
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
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).single()
    setProfile(data)
    setLoading(false)
  }

  async function signOut() {
    await supabase.auth.signOut()
    setUser(null)
    setProfile(null)
  }

  return (
    <LanguageProvider>
      <AuthContext.Provider value={{ user, profile, loading, fetchProfile, signOut }}>
        {loading ? (
          <LoadingScreen />
        ) : (
          <>
            {user && !['/onboarding', '/today-question', '/creator-welcome'].includes(location.pathname) && <Sidebar />}
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
            <main className={user && !['/onboarding', '/today-question', '/creator-welcome'].includes(location.pathname) ? 'main-content with-sidebar' : 'main-content full'}>
              <Suspense fallback={<div className="loading">Laden...</div>}>
              <Routes>
                <Route path="/login" element={user ? <Navigate to="/" /> : <LoginPage />} />
                <Route path="/register" element={user ? <Navigate to="/" /> : <RegisterPage />} />
                <Route path="/" element={user ? <OnboardingGuard><HomePage /></OnboardingGuard> : <LandingPage />} />
                <Route path="/onboarding" element={<ProtectedRoute><OnboardingPage /></ProtectedRoute>} />
                <Route path="/today-question" element={<ProtectedRoute><TodayQuestionPage /></ProtectedRoute>} />
                <Route path="/creator-welcome" element={<ProtectedRoute><CreatorWelcomePage /></ProtectedRoute>} />
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
                <Route path="/video-maker" element={<ProtectedRoute><VideoMakerPage /></ProtectedRoute>} />
                <Route path="/photo-editor" element={<ProtectedRoute><PhotoEditorPage /></ProtectedRoute>} />
                <Route path="/fotostory" element={<ProtectedRoute><FotostoryPage /></ProtectedRoute>} />
                <Route path="/ai-chat" element={<ProtectedRoute><AIChatPage /></ProtectedRoute>} />
                <Route path="/creator-academy" element={<ProtectedRoute><CreatorAcademyPage /></ProtectedRoute>} />
                <Route path="/tiktok-video" element={<ProtectedRoute><TikTokVideoPage /></ProtectedRoute>} />
                <Route path="/legal" element={<LegalPage />} />
                <Route path="/impressum" element={<LegalPage />} />
                <Route path="/datenschutz" element={<LegalPage />} />
                <Route path="/agb" element={<LegalPage />} />
              </Routes>
              </Suspense>
            </main>
            {user && !['/onboarding', '/today-question', '/creator-welcome'].includes(location.pathname) && <MobileBar />}
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

function LandingPage() {
  return (
    <div className="container">
      <div className="hero landing-hero">
        <h1><Logo /></h1>
        <p>Europas Community fuer Glueck, Vernetzung und persoenliche Entwicklung.</p>
        <div className="landing-actions">
          <Link to="/register" className="btn btn-primary">Kostenlos registrieren</Link>
          <Link to="/login" className="btn btn-outline">Anmelden</Link>
        </div>
      </div>

      <div className="what-we-are">
        <h2>Was wir sind</h2>
        <div className="what-we-are-content">
          <p>Europa braucht eine eigene Social-Media-Plattform.</p>
          <p>Nicht als Kopie bestehender Netzwerke.<br/>Sondern als echte Alternative.</p>
          <p>Aus dieser Idee ist eine funktionierende Plattform entstanden.</p>
          <div className="what-we-are-features">
            <div className="what-we-are-feature">
              <span>Direkt im Browser nutzbar.</span>
            </div>
            <div className="what-we-are-feature">
              <span>Ohne Installation.</span>
            </div>
            <div className="what-we-are-feature">
              <span>Auf Smartphone und Desktop.</span>
            </div>
          </div>
          <div className="what-we-are-workflow">
            <h3>Alles in einem Workflow.</h3>
            <p>Inhalte erstellen. Inhalte veroeffentlichen. Inhalte mit integrierter KI verbessern.</p>
            <div className="what-we-are-steps">
              <span className="step">Posten</span>
              <span className="step-arrow">&rarr;</span>
              <span className="step">Analysieren</span>
              <span className="step-arrow">&rarr;</span>
              <span className="step">Optimieren</span>
              <span className="step-arrow">&rarr;</span>
              <span className="step">Veroeffentlichen</span>
            </div>
            <p className="what-we-are-tagline">Ohne Umwege. Ohne Tool-Wechsel.</p>
          </div>
          <div className="what-we-are-cta">
            <p>Einfach oeffnen und selbst ausprobieren, wie sich der Ansatz in der Praxis anfuehlt.</p>
            <Link to="/register" className="btn btn-primary">Jetzt ausprobieren</Link>
          </div>
        </div>
      </div>

      <div className="landing-sections">
        <Link to="/marketplace" className="dash-card">
          <span className="dash-accent" style={{ background: 'var(--color-petrol)' }}></span>
          <span className="dash-icon"><ShoppingCart size={20} /></span>
          <div><h3>Marktplatz</h3><p>Dienstleistungen, Produkte und mehr</p></div>
        </Link>
        <Link to="/jobs" className="dash-card">
          <span className="dash-accent" style={{ background: 'var(--color-koralle)' }}></span>
          <span className="dash-icon"><Briefcase size={20} /></span>
          <div><h3>Stellenangebote</h3><p>Jobs, Freelance, Praktika</p></div>
        </Link>
        <Link to="/courses" className="dash-card">
          <span className="dash-accent" style={{ background: 'var(--color-mint)' }}></span>
          <span className="dash-icon"><BookOpen size={20} /></span>
          <div><h3>Kurse</h3><p>Lernen und weiterbilden</p></div>
        </Link>
        <Link to="/housing" className="dash-card">
          <span className="dash-accent" style={{ background: 'var(--color-amber)' }}></span>
          <span className="dash-icon"><Building2 size={20} /></span>
          <div><h3>Wohnungen</h3><p>WG, Wohnung, Haus</p></div>
        </Link>
        <Link to="/community" className="dash-card">
          <span className="dash-accent" style={{ background: 'var(--color-petrol)' }}></span>
          <span className="dash-icon"><MessageCircle size={20} /></span>
          <div><h3>Community</h3><p>Vernetzen und austauschen</p></div>
        </Link>
        <Link to="/ai-chat" className="dash-card">
          <span className="dash-accent" style={{ background: 'var(--color-koralle)' }}></span>
          <span className="dash-icon"><Sparkles size={20} /></span>
          <div><h3>KI-Assistent</h3><p>Fragen stellen, Bilder analysieren</p></div>
        </Link>
      </div>
    </div>
  )
}

function HomePage() {
  const { profile } = useAuth()
  const { t } = useLanguage()
  const hour = new Date().getHours()
  const greeting = hour < 12 ? t('welcome.morning') : hour < 18 ? t('welcome.afternoon') : t('welcome.evening')

  return (
    <div className="container">
      <div className="home-create-post" onClick={() => window.location.href = '/community'}>
        <div className="home-create-avatar">{profile?.name?.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) || '?'}</div>
        <div className="home-create-input">Was denkst du gerade, {profile?.name?.split(' ')[0] || 'User'}?</div>
      </div>
      <Feed />
    </div>
  )
}
