import { useState, useEffect, createContext, useContext } from 'react'
import { Routes, Route, Link, useNavigate, Navigate } from 'react-router-dom'
import { supabase } from './lib/supabase'
import { LanguageProvider, useLanguage, LANGUAGES } from './i18n/translations.jsx'
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
import './App.css'

const AuthContext = createContext()

export function useAuth() {
  return useContext(AuthContext)
}

function Navbar() {
  const { user, profile, signOut } = useAuth()
  const { lang, setLang, t } = useLanguage()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  const links = [
    { to: '/', label: `🏠 ${t('nav.home')}` },
    { to: '/community', label: `💬 ${t('nav.community')}` },
    { to: '/friends', label: `👥 ${t('nav.friends')}` },
    { to: '/marketplace', label: `🛒 ${t('nav.marketplace')}` },
    { to: '/jobs', label: `💼 ${t('nav.jobs')}` },
    { to: '/courses', label: `📚 ${t('nav.courses')}` },
    { to: '/housing', label: `🏠 ${t('nav.housing')}` },
    { to: '/profile', label: `👤 ${t('nav.profile')}` },
    { to: '/notifications', label: `🔔 ${t('nav.notifications')}` },
    { to: '/video-maker', label: `🎬 ${t('nav.videoMaker')}` },
    { to: '/history', label: `📜 ${t('nav.history')}` },
  ]

  if (profile?.role === 'admin') {
    links.push({ to: '/admin', label: `⚙️ ${t('nav.admin')}` })
  }

  return (
    <nav className="navbar">
      <div className="navbar-brand">
        <Link to="/">
          <img src="/favicon.svg" alt="Happiness" style={{ height: '28px', verticalAlign: 'middle', marginRight: '6px' }} />
          Happiness
        </Link>
        <button className="menu-toggle" onClick={() => setMenuOpen(!menuOpen)}>☰</button>
      </div>
      <div className={`navbar-links ${menuOpen ? 'open' : ''}`}>
        {links.map((link) => (
          <Link key={link.to} to={link.to} onClick={() => setMenuOpen(false)}>
            {link.label}
          </Link>
        ))}
      </div>
      <div className="navbar-user">
        <select
          className="lang-select"
          value={lang}
          onChange={(e) => setLang(e.target.value)}
        >
          {LANGUAGES.map((l) => (
            <option key={l.code} value={l.code}>{l.flag} {l.label}</option>
          ))}
        </select>
        <span>{profile?.name || user?.email}</span>
        <button className="btn btn-sm btn-outline" onClick={handleSignOut}>{t('nav.logout')}</button>
      </div>
    </nav>
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
            {user && <Navbar />}
            <main className={user ? 'main-content' : 'main-content full'}>
              <Routes>
                <Route path="/login" element={user ? <Navigate to="/" /> : <LoginPage />} />
                <Route path="/register" element={user ? <Navigate to="/" /> : <RegisterPage />} />
                <Route path="/" element={<ProtectedRoute><HomePage /></ProtectedRoute>} />
                <Route path="/community" element={<ProtectedRoute><CommunityPage /></ProtectedRoute>} />
                <Route path="/friends" element={<ProtectedRoute><FriendsPage /></ProtectedRoute>} />
                <Route path="/marketplace" element={<ProtectedRoute><MarketplacePage /></ProtectedRoute>} />
                <Route path="/jobs" element={<ProtectedRoute><JobsPage /></ProtectedRoute>} />
          <Route path="/courses" element={<ProtectedRoute><CoursesPage /></ProtectedRoute>} />
          <Route path="/housing" element={<ProtectedRoute><HousingPage /></ProtectedRoute>} />
          <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
                <Route path="/notifications" element={<ProtectedRoute><NotificationsPage /></ProtectedRoute>} />
                <Route path="/history" element={<ProtectedRoute><HistoryPage /></ProtectedRoute>} />
                <Route path="/admin" element={<ProtectedRoute><AdminPage /></ProtectedRoute>} />
                <Route path="/video-maker" element={<ProtectedRoute><VideoMakerPage /></ProtectedRoute>} />
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
