import React, { useState, useEffect, Component } from 'react'
import { useLocation } from 'react-router-dom'
import { supabase } from './lib/supabase'
import { LanguageProvider, useLanguage } from './i18n/translations.jsx'
import AuthContext from './context/AuthContext'
import { LeadProvider } from './context/LeadContext'
import { trackPageView, checkAndTrackReturnVisit, getVisitorId } from './intelligence/analytics/custom'
import { trackNexusPageView } from './lib/nexus-analytics'
import AppRoutes from './routes/AppRoutes'
import AppLayout from './components/layout/AppLayout'
import CookieConsent from './components/CookieConsent'
import './App.css'

// Hilfsfunktion: Erkennt dynamische Importfehler durch neue Builds/ungültige Hashes
function isChunkLoadError(error) {
  if (!error) return false;
  const msg = (error.message || error.toString() || '').toLowerCase();
  return (
    msg.includes('failed to fetch dynamically imported module') ||
    msg.includes('chunkloaderror') ||
    msg.includes('loading chunk') ||
    msg.includes('dynamically imported module') ||
    msg.includes('importing a module script failed') ||
    msg.includes('error loading dynamically imported module')
  );
}

// Globaler Vite Preload Error Handler (fängt veraltete Chunks vor dem Router-Absturz ab)
if (typeof window !== 'undefined') {
  window.addEventListener('vite:preloadError', (event) => {
    event.preventDefault();
    const lastReload = parseInt(sessionStorage.getItem('nexus_chunk_reload_time') || '0', 10);
    const now = Date.now();
    if (now - lastReload > 8000) {
      sessionStorage.setItem('nexus_chunk_reload_time', now.toString());
      window.location.reload();
    }
  });
}

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error) {
    if (isChunkLoadError(error)) {
      const lastReload = parseInt(sessionStorage.getItem('nexus_chunk_reload_time') || '0', 10);
      const now = Date.now();
      if (now - lastReload > 8000) {
        sessionStorage.setItem('nexus_chunk_reload_time', now.toString());
        window.location.reload();
      }
    }
  }

  render() {
    if (this.state.error) {
      if (isChunkLoadError(this.state.error)) {
        return (
          <div style={{
            padding: 32,
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#0a0d14',
            color: '#f8fafc',
            textAlign: 'center',
            fontFamily: 'system-ui, -apple-system, sans-serif'
          }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '16px' }}>🔄</div>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: '8px', color: '#38bdf8' }}>
              App-Aktualisierung wird geladen
            </h2>
            <p style={{ color: '#94a3b8', maxWidth: '440px', lineHeight: 1.5, marginBottom: '24px', fontSize: '0.95rem' }}>
              Ein neues Update des Mandate Origination Desk wurde bereitgestellt. Die Anwendung lädt die aktuellen Daten.
            </p>
            <button
              onClick={() => {
                sessionStorage.removeItem('nexus_chunk_reload_time');
                window.location.reload();
              }}
              style={{
                background: 'linear-gradient(135deg, #38bdf8 0%, #0284c7 100%)',
                color: '#050608',
                border: 'none',
                padding: '10px 22px',
                borderRadius: '8px',
                fontWeight: 700,
                fontSize: '0.9rem',
                cursor: 'pointer',
                boxShadow: '0 0 20px rgba(56, 189, 248, 0.4)'
              }}
            >
              Jetzt aktualisieren
            </button>
          </div>
        );
      }
      return (
        <div style={{ padding: 24, background: '#1a1a2e', color: '#e74c3c', fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>
          <h2>Runtime Error</h2>
          <p>{this.state.error.message}</p>
          <pre>{this.state.error.stack}</pre>
        </div>
      );
    }
    return this.props.children;
  }
}

function LoadingScreen() {
  const { t } = useLanguage()
  return <div className="loading-screen">{t('auth.logging') || 'Wird geladen...'}</div>
}

export default function App() {
  const location = useLocation()
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

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

  // Developer filter for Google Analytics
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('ignore-analytics') === 'true') {
      localStorage.setItem('ignore-analytics', 'true');
      console.log('%c Analytics Tracking: MUTED', 'color: #d97706; font-weight: bold;');
    } else if (params.get('ignore-analytics') === 'false') {
      localStorage.removeItem('ignore-analytics');
      console.log('%c Analytics Tracking: ACTIVE', 'color: #10b981; font-weight: bold;');
    }

    const isDeveloper = localStorage.getItem('ignore-analytics') === 'true';
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const shouldTrack = window.gtag && !isLocalhost && !isDeveloper;
    if (!shouldTrack) {
      window.gtag = function() {};
    }
  }, []);

  // Track page views
  useEffect(() => {
    if (user) {
      supabase.from('profiles').update({ last_seen: new Date().toISOString() }).eq('id', user.id).then()
    }
    trackPageView(location.pathname)
    trackNexusPageView(location.pathname)
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

      if (data && data.role === 'admin') {
        localStorage.setItem('ignore-analytics', 'true');
        if (typeof window.gtag === 'function') {
          window.gtag = function() {};
        }
      }

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

  async function signInWithGoogle() {
    return await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/nexus/dashboard`
      }
    })
  }

  async function signInWithPassword(email, password) {
    return await supabase.auth.signInWithPassword({ email, password })
  }

  async function signUp() {
    return { data: null, error: new Error('Registrierung ist deaktiviert.') }
  }

  return (
    <LanguageProvider>
      <AuthContext.Provider value={{
        user,
        profile,
        loading,
        fetchProfile,
        signOut,
        signInWithGoogle,
        signInWithPassword,
        signUp
      }}>
        <LeadProvider>
          {loading ? (
            <LoadingScreen />
          ) : (
            <ErrorBoundary>
              <CookieConsent />
              <AppLayout>
                <AppRoutes />
              </AppLayout>
            </ErrorBoundary>
          )}
        </LeadProvider>
      </AuthContext.Provider>
    </LanguageProvider>
  )
}