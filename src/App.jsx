import { useState, useEffect } from 'react'
import { Routes, Route, Link, useNavigate, Navigate, useLocation } from 'react-router-dom'
import { supabase } from './lib/supabase'
import { LanguageProvider, useLanguage, LANGUAGES } from './i18n/translations.jsx'
import AuthContext, { useAuth } from './context/AuthContext'
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
import VideoMakerPage from './pages/VideoMakerPage'
import PhotoEditorPage from './pages/PhotoEditorPage'
import FotostoryPage from './pages/FotostoryPage'
import AIChatPage from './pages/AIChatPage'
import LegalPage from './pages/LegalPage'
import './App.css'

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
    { to: '/', icon: '🏠', label: t('nav.home') },
    { to: '/ai-chat', icon: '✨', label: t('nav.aiChat') },
    { to: '/community', icon: '💬', label: t('nav.community') },
    { to: '/friends', icon: '👥', label: t('nav.friends') },
    { to: '/marketplace', icon: '🛒', label: t('nav.marketplace') },
  ]

  const moreLinks = [
    { to: '/jobs', icon: '💼', label: t('nav.jobs') },
    { to: '/courses', icon: '📚', label: t('nav.courses') },
    { to: '/housing', icon: '🏠', label: t('nav.housing') },
    { to: '/video-maker', icon: '🎬', label: t('nav.videoMaker') },
    { to: '/photo-editor', icon: '📷', label: 'Foto Editor' },
    { to: '/fotostory', icon: '🎞️', label: 'Fotostory' },
    { to: '/notifications', icon: '🔔', label: t('nav.notifications') },
  ]

  if (profile?.role === 'admin') {
    moreLinks.push({ to: '/admin', icon: '⚙️', label: t('nav.admin') })
  }

  return (
    <aside className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
      <div className="sidebar-header">
        <Link to="/" className="sidebar-brand">
          <img src="/favicon.svg" alt="H" style={{ width: '32px', height: '32px' }} />
          {!collapsed && <span>Happiness</span>}
        </Link>
        <button className="sidebar-toggle" onClick={() => setCollapsed(!collapsed)}>
          {collapsed ? '»' : '«'}
        </button>
      </div>

      <nav className="sidebar-nav">
        {mainLinks.map((link) => (
          <Link
            key={link.to}
            to={link.to}
            className={`sidebar-link ${location.pathname === link.to ? 'active' : ''}`}
            title={collapsed ? link.label : undefined}
          >
            <span className="sidebar-icon">{link.icon}</span>
            {!collapsed && <span>{link.label}</span>}
          </Link>
        ))}

        <div className="sidebar-divider"></div>

        {!collapsed && <div className="sidebar-section-title">{t('nav.more') || 'Mehr'}</div>}

        {moreLinks.map((link) => (
          <Link
            key={link.to}
            to={link.to}
            className={`sidebar-link ${location.pathname === link.to ? 'active' : ''}`}
            title={collapsed ? link.label : undefined}
          >
            <span className="sidebar-icon">{link.icon}</span>
            {!collapsed && <span>{link.label}</span>}
          </Link>
        ))}
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

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  const { t } = useLanguage()
  if (loading) return <div className="loading">{t('auth.logging')}</div>
  if (!user) return <Navigate to="/login" />
  return children
}

export default function App() {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user) {
        fetchProfile(session.user.id)
      } else {
        setLoading(false)
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
            {user && <Sidebar />}
            <main className={user ? 'main-content with-sidebar' : 'main-content full'}>
              <Routes>
                <Route path="/login" element={user ? <Navigate to="/" /> : <LoginPage />} />
                <Route path="/register" element={user ? <Navigate to="/" /> : <RegisterPage />} />
                <Route path="/" element={<ProtectedRoute><HomePage /></ProtectedRoute>} />
                <Route path="/community" element={<ProtectedRoute><CommunityPage /></ProtectedRoute>} />
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
                <Route path="/legal" element={<LegalPage />} />
                <Route path="/impressum" element={<LegalPage />} />
                <Route path="/datenschutz" element={<LegalPage />} />
                <Route path="/agb" element={<LegalPage />} />
              </Routes>
            </main>
          </>
        )}
      </AuthContext.Provider>
    </LanguageProvider>
  )
}

function LoadingScreen() {
  const { t } = useLanguage()
  return <div className="loading-screen">🌈 Happiness App wird geladen...</div>
}

function HomePage() {
  const { profile } = useAuth()
  const { t } = useLanguage()
  const hour = new Date().getHours()
  const greeting = hour < 12 ? t('welcome.morning') : hour < 18 ? t('welcome.afternoon') : t('welcome.evening')

  return (
    <div className="container">
      <div className="hero">
        <h1>🌈 {t('home.welcome')}</h1>
        <p>{greeting}, <strong>{profile?.name}</strong>!</p>
        <p style={{color: 'rgba(255,255,255,0.8)', fontSize: '0.95rem', marginTop: '0.5rem'}}>{t('home.desc')}</p>
      </div>
      <div className="dashboard-grid">
        <Link to="/community" className="dash-card">
          <span className="dash-icon">💬</span>
          <h3>{t('nav.community')}</h3>
          <p>{t('community.share')}</p>
        </Link>
        <Link to="/friends" className="dash-card">
          <span className="dash-icon">👥</span>
          <h3>{t('nav.friends')}</h3>
          <p>{t('friends.noFriends')}</p>
        </Link>
        <Link to="/marketplace" className="dash-card">
          <span className="dash-icon">🛒</span>
          <h3>{t('nav.marketplace')}</h3>
          <p>{t('marketplace.browse')}</p>
        </Link>
        <Link to="/jobs" className="dash-card">
          <span className="dash-icon">💼</span>
          <h3>{t('nav.jobs')}</h3>
          <p>{t('jobs.browse')}</p>
        </Link>
        <Link to="/courses" className="dash-card">
          <span className="dash-icon">📚</span>
          <h3>{t('nav.courses')}</h3>
          <p>{t('courses.browse')}</p>
        </Link>
        <Link to="/housing" className="dash-card">
          <span className="dash-icon">🏠</span>
          <h3>{t('nav.housing')}</h3>
          <p>{t('housing.subtitle')}</p>
        </Link>
        <Link to="/profile" className="dash-card">
          <span className="dash-icon">👤</span>
          <h3>{t('nav.profile')}</h3>
          <p>{t('profile.edit')}</p>
        </Link>
      </div>
    </div>
  )
}
