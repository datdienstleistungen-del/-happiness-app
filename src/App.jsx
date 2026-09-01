import React, { useState, useEffect, Component } from 'react'
import { useLocation } from 'react-router-dom'
import { supabase } from './lib/supabase'
import { LanguageProvider, useLanguage } from './i18n/translations.jsx'
import AuthContext from './context/AuthContext'
import { VideoFinderProvider } from './context/VideoFinderContext'
import { VideoScriptProvider } from './context/VideoScriptContext'
import { CapCutProvider } from './context/CapCutContext'
import { LeadProvider } from './context/LeadContext'
import { GuideProvider } from './context/GuideContext'
import { useOneSignal } from './hooks/useOneSignal'
import { trackPageView, checkAndTrackReturnVisit, getVisitorId } from './intelligence/analytics/custom'
import AppRoutes from './routes/AppRoutes'
import AppLayout from './components/layout/AppLayout'
import './App.css'

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

  useOneSignal(user)

  return (
    <LanguageProvider>
      <AuthContext.Provider value={{ user, profile, loading, fetchProfile, signOut }}>
        <VideoFinderProvider>
          <VideoScriptProvider>
            <CapCutProvider>
              <LeadProvider>
                <GuideProvider>
                  {loading ? (
                    <LoadingScreen />
                  ) : (
                    <AppLayout>
                      <ErrorBoundary>
                        <AppRoutes />
                      </ErrorBoundary>
                    </AppLayout>
                  )}
                </GuideProvider>
              </LeadProvider>
            </CapCutProvider>
          </VideoScriptProvider>
        </VideoFinderProvider>
      </AuthContext.Provider>
    </LanguageProvider>
  )
}