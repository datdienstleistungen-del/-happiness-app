import { useState, useEffect, createContext, useContext } from 'react'
import { Routes, Route, Link, useNavigate, Navigate } from 'react-router-dom'
import { supabase } from './lib/supabase'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import CommunityPage from './pages/CommunityPage'
import FriendsPage from './pages/FriendsPage'
import MarketplacePage from './pages/MarketplacePage'
import JobsPage from './pages/JobsPage'
import CoursesPage from './pages/CoursesPage'
import ProfilePage from './pages/ProfilePage'
import NotificationsPage from './pages/NotificationsPage'
import HistoryPage from './pages/HistoryPage'
import AdminPage from './pages/AdminPage'
import './App.css'

const AuthContext = createContext()

export function useAuth() {
  return useContext(AuthContext)
}

function Navbar() {
  const { user, profile, signOut } = useAuth()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  const links = [
    { to: '/', label: '🏠 Start' },
    { to: '/community', label: '💬 Community' },
    { to: '/friends', label: '👥 Freunde' },
    { to: '/marketplace', label: '🛒 Marktplatz' },
    { to: '/jobs', label: '💼 Jobs' },
    { to: '/courses', label: '📚 Kurse' },
    { to: '/profile', label: '👤 Profil' },
    { to: '/notifications', label: '🔔 Benachrichtigungen' },
    { to: '/history', label: '📜 Verlauf' },
  ]

  if (profile?.role === 'admin') {
    links.push({ to: '/admin', label: '⚙️ Admin' })
  }

  return (
    <nav className="navbar">
      <div className="navbar-brand">
        <Link to="/">🌈 Happiness</Link>
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
        <span>{profile?.name || user?.email}</span>
        <button className="btn btn-sm btn-outline" onClick={handleSignOut}>Logout</button>
      </div>
    </nav>
  )
}

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="loading">Laden...</div>
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

  if (loading) {
    return <div className="loading-screen">🌈 Happiness App wird geladen...</div>
  }

  return (
    <AuthContext.Provider value={{ user, profile, loading, fetchProfile, signOut }}>
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
          <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
          <Route path="/notifications" element={<ProtectedRoute><NotificationsPage /></ProtectedRoute>} />
          <Route path="/history" element={<ProtectedRoute><HistoryPage /></ProtectedRoute>} />
          <Route path="/admin" element={<ProtectedRoute><AdminPage /></ProtectedRoute>} />
        </Routes>
      </main>
    </AuthContext.Provider>
  )
}

function HomePage() {
  const { profile } = useAuth()
  return (
    <div className="container">
      <div className="hero">
        <h1>🌈 Willkommen bei der Happiness App!</h1>
        <p>Schön, dass du da bist, <strong>{profile?.name}</strong>!</p>
      </div>
      <div className="dashboard-grid">
        <Link to="/community" className="dash-card">
          <span className="dash-icon">💬</span>
          <h3>Community</h3>
          <p>Teile Gedanken und vernetze dich</p>
        </Link>
        <Link to="/friends" className="dash-card">
          <span className="dash-icon">👥</span>
          <h3>Freunde</h3>
          <p>Finde und verbinde dich mit Freunden</p>
        </Link>
        <Link to="/marketplace" className="dash-card">
          <span className="dash-icon">🛒</span>
          <h3>Marktplatz</h3>
          <p>Angebote entdecken und teilen</p>
        </Link>
        <Link to="/jobs" className="dash-card">
          <span className="dash-icon">💼</span>
          <h3>Jobbörse</h3>
          <p>Finde deinen nächsten Job</p>
        </Link>
        <Link to="/courses" className="dash-card">
          <span className="dash-icon">📚</span>
          <h3>Kurse</h3>
          <p>Lerne Neues und wachse</p>
        </Link>
        <Link to="/profile" className="dash-card">
          <span className="dash-icon">👤</span>
          <h3>Profil</h3>
          <p>Verwalte dein Profil</p>
        </Link>
      </div>
    </div>
  )
}
