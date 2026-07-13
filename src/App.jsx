import { useState, useEffect, useRef, lazy, Suspense } from 'react'
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
import { useOneSignal } from './hooks/useOneSignal'
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
const ExecutionPipeline = lazy(() => import('./pages/ExecutionPipeline'))
const TikTokVideoPage = lazy(() => import('./pages/TikTokVideoPage'))
const CreatorAcademyPage = lazy(() => import('./pages/CreatorAcademyPage'))
const PostPreparationPage = lazy(() => import('./pages/PostPreparationPage'))
const OnboardingPage = lazy(() => import('./pages/OnboardingPage'))
const TodayQuestionPage = lazy(() => import('./pages/TodayQuestionPage'))
const CreatorWelcomePage = lazy(() => import('./pages/CreatorWelcomePage'))

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
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)

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

  useOneSignal(user)

  return (
    <LanguageProvider>
      <AuthContext.Provider value={{ user, profile, loading, fetchProfile, signOut }}>
        {loading ? (
          <LoadingScreen />
        ) : (
          <>
            {user && !['/onboarding', '/today-question', '/creator-welcome'].includes(location.pathname) && <Sidebar mobileOpen={mobileSidebarOpen} setMobileOpen={setMobileSidebarOpen} />}
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
              {user && (
                <button className="mobile-menu-btn" onClick={() => setMobileSidebarOpen(true)}>
                  <Menu size={22} />
                </button>
              )}
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
                <Route path="/execute" element={<ProtectedRoute><ExecutionPipeline /></ProtectedRoute>} />
                <Route path="/creator-academy" element={<ProtectedRoute><CreatorAcademyPage /></ProtectedRoute>} />
                <Route path="/post-preparation" element={<ProtectedRoute><PostPreparationPage /></ProtectedRoute>} />
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
  const navigate = useNavigate()
  const [goal, setGoal] = useState('')

  const handleGoalSubmit = (mode) => {
    if (!goal.trim()) return
    const params = new URLSearchParams({ goal: goal.trim(), mode })
    navigate(`/execute?${params.toString()}`)
  }

  return (
    <div className="hp">

      {/* ── 3-Column Dashboard ── */}
      <div className="hp-dashboard">

        {/* ── Left: Value Prop Card ── */}
        <div className="hp-left">
          <div className="hp-left-card">
            <h2 className="hp-left-title">{t('hp.leftTitle')}</h2>
            <p className="hp-left-sub">{t('hp.leftSub')}</p>

            <div className="hp-left-steps">
              <div className="hp-left-step">
                <div className="hp-left-step-icon" style={{ background: 'rgba(8,80,65,0.1)', color: '#085041' }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
                </div>
                <div>
                  <strong>{t('hp.step1Title')}</strong>
                  <p>{t('hp.step1Desc')}</p>
                </div>
              </div>

              <div className="hp-left-step">
                <div className="hp-left-step-icon" style={{ background: 'rgba(216,90,48,0.1)', color: '#D85A30' }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                </div>
                <div>
                  <strong>{t('hp.step2Title')}</strong>
                  <p>{t('hp.step2Desc')}</p>
                </div>
              </div>

              <div className="hp-left-step">
                <div className="hp-left-step-icon" style={{ background: 'rgba(29,158,117,0.1)', color: '#1D9E75' }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>
                </div>
                <div>
                  <strong>{t('hp.step3Title')}</strong>
                  <p>{t('hp.step3Desc')}</p>
                </div>
              </div>

              <div className="hp-left-step">
                <div className="hp-left-step-icon" style={{ background: 'rgba(186,117,23,0.1)', color: '#BA7517' }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                </div>
                <div>
                  <strong>{t('hp.step4Title')}</strong>
                  <p>{t('hp.step4Desc')}</p>
                </div>
              </div>
            </div>

            <div className="hp-left-footer">
              <span className="hp-left-footer-icon">💚</span>
              <div>
                <strong>{t('hp.footerTitle')}</strong>
                <p>{t('hp.footerSub')}</p>
              </div>
            </div>
          </div>
        </div>

        {/* ── Center: Main Content ── */}
        <div className="hp-center">
          <h1 className="hp-center-title">{t('hp.centerTitle')} <span className="hp-hit">H.I.T.</span></h1>
          <p className="hp-center-sub">{t('hp.centerSub')}</p>

          <div className="hp-input-wrap">
            <input
              className="hp-input"
              type="text"
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && goal.trim() && handleGoalSubmit('build')}
              placeholder={t('hp.placeholder')}
            />
          </div>

          <div className="hp-chips">
            <button className="hp-chip" onClick={() => setGoal(t('hp.chip1'))}>{t('hp.chip1')}</button>
            <button className="hp-chip" onClick={() => setGoal(t('hp.chip3'))}>{t('hp.chip3')}</button>
            <button className="hp-chip" onClick={() => setGoal(t('hp.chip9'))}>{t('hp.chip9')}</button>
            <button className="hp-chip" onClick={() => setGoal(t('hp.chip10'))}>{t('hp.chip10')}</button>
          </div>

          <div className="hp-actions">
            <button className="hp-action think" onClick={() => handleGoalSubmit('think')}>
              <span className="hp-action-icon">🧠</span>
              <div>
                <strong>{t('hp.actionThink')}</strong>
                <span>{t('hp.actionThinkDesc')}</span>
              </div>
            </button>
            <button className="hp-action build" onClick={() => handleGoalSubmit('build')}>
              <span className="hp-action-icon">🚀</span>
              <div>
                <strong>{t('hp.actionBuild')}</strong>
                <span>{t('hp.actionBuildDesc')}</span>
              </div>
            </button>
            <button className="hp-action surprise" onClick={() => handleGoalSubmit('surprise')}>
              <span className="hp-action-icon">✨</span>
              <div>
                <strong>{t('hp.actionSurprise')}</strong>
                <span>{t('hp.actionSurpriseDesc')}</span>
              </div>
            </button>
          </div>

          <div className="hp-info-card">
            <strong>{t('hp.infoTitle')}</strong>
            <p>{t('hp.infoSub')}</p>
            <span>{t('hp.infoDesc')}</span>
          </div>
        </div>

        {/* ── Right: H.I.T. Branding ── */}
        <div className="hp-right">
          <div className="hp-hit-full">
            <div className="hp-hit-line">
              <span className="hp-hit-big">H</span>
              <span className="hp-hit-rest">appiness</span>
            </div>
            <div className="hp-hit-line">
              <span className="hp-hit-big">I</span>
              <span className="hp-hit-rest">ntelligence</span>
            </div>
            <div className="hp-hit-line">
              <span className="hp-hit-big">T</span>
              <span className="hp-hit-rest">eam</span>
            </div>
          </div>
        </div>

      </div>

      {/* ── Community Inspiration ── */}
      <div className="hp-community">
        <div className="hp-community-header">
          <h2>{t('hp.communityTitle')}</h2>
          <p>{t('hp.communitySub')}</p>
        </div>
        <Feed />
      </div>

    </div>
  )
}
