import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../../context/AuthContext'
import { fetchFreePassStatus, formatRemainingTime } from '../../../lib/nexus-free-pass'
import Logo from '../../Logo'
import {
  Sparkles, CheckCircle2, ArrowRight, ShieldCheck, Zap,
  Smartphone, Clock, Gift, Lock, Copy, Check
} from 'lucide-react'

export default function RedditSplitHero({ onOpenAuth }) {
  const navigate = useNavigate()
  const { user, signInWithGoogle, signUp, signInWithPassword } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [authError, setAuthError] = useState('')
  const [loading, setLoading] = useState(false)
  const [passData, setPassData] = useState({ remaining_seconds: 86400, is_active: true, is_expired: false })
  const [demoStep, setDemoStep] = useState(0) // 0: initial, 1: scanned, 2: pitch shown
  const [copied, setCopied] = useState(false)

  // Language auto-detection
  const browserLang = (typeof navigator !== 'undefined' && navigator.language ? navigator.language.slice(0, 2).toLowerCase() : 'en')
  const isDe = browserLang === 'de'

  useEffect(() => {
    fetchFreePassStatus().then((data) => {
      if (data) setPassData(data)
    })

    const interval = setInterval(() => {
      setPassData((prev) => {
        if (!prev || prev.remaining_seconds <= 0) return { ...prev, is_active: false, is_expired: true, remaining_seconds: 0 }
        return { ...prev, remaining_seconds: prev.remaining_seconds - 1 }
      })
    }, 1000)

    return () => clearInterval(interval)
  }, [])

  const handleGoogleLogin = async () => {
    try {
      setLoading(true)
      setAuthError('')
      if (signInWithGoogle) {
        const { error } = await signInWithGoogle()
        if (error) setAuthError(error.message)
      } else {
        onOpenAuth?.('google')
      }
    } catch (err) {
      console.error(err)
      setAuthError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleDirectAuth = async (e) => {
    e.preventDefault()
    if (!email) return
    setAuthError('')
    
    // If no password entered yet, redirect to register page with prefilled email
    if (!password) {
      navigate(`/register?email=${encodeURIComponent(email)}`)
      return
    }

    if (password.length < 6) {
      setAuthError(isDe ? 'Passwort muss mind. 6 Zeichen lang sein.' : 'Password must be at least 6 characters.')
      return
    }

    try {
      setLoading(true)
      // Try signing up first
      const { data, error: upError } = await signUp(email, password)
      
      if (upError) {
        // If already exists, attempt instant password login
        if (upError.message.includes('already registered') || upError.message.includes('User already registered')) {
          const { error: inError } = await signInWithPassword(email, password)
          if (!inError) {
            navigate('/nexus/dashboard')
            return
          } else {
            setAuthError(isDe ? 'Konto existiert bereits. Bitte richtiges Passwort eingeben oder über Google einloggen.' : 'Account already exists. Please enter your correct password or log in with Google.')
            return
          }
        }
        setAuthError(upError.message)
        return
      }

      // If signUp didn't return session immediately, run signInWithPassword to guarantee instant login
      if (!data?.session) {
        const { error: inError } = await signInWithPassword(email, password)
        if (inError) {
          console.warn('Auto sign-in fallback:', inError.message)
        }
      }

      navigate('/nexus/dashboard')
    } catch (err) {
      setAuthError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleCopyPitch = () => {
    const text = isDe 
      ? "Hallo Herr Wagner, Glückwunsch zur Expansion nach UK! Wir haben gesehen, dass Sie für das neue Vertriebsteam noch B2B-Infrastruktur suchen. Hätten Sie nächste Woche 5 Minuten für einen kurzen Austausch?"
      : "Hi Marcus, congrats on expanding into the UK! We noticed your new team is looking for high-intent B2B sales infrastructure. Would you be open for a quick 5-min chat next Tuesday?"
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div style={{ width: '100%', maxWidth: '1240px', margin: '0 auto', padding: '24px 16px 48px' }}>
      
      {/* Top Floating IP-Guarded Free Pass Banner (Obsidian B2B) */}
      <div
        style={{
          background: 'linear-gradient(90deg, #0a0c0f 0%, #11141a 100%)',
          color: '#f8fafc',
          borderRadius: '16px',
          padding: '14px 22px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
          marginBottom: '32px',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.4)',
          border: '1px solid #1e232d'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ background: 'rgba(56, 189, 248, 0.15)', padding: '8px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Gift size={20} color="#38bdf8" />
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: '15px', letterSpacing: '-0.2px', color: '#f8fafc' }}>
              {isDe ? '24-Stunden Gratis-Pass für dein Gerät aktiv!' : '24-Hour Free All-Access Pass Active on this Device!'}
            </div>
            <div style={{ fontSize: '12.5px', color: '#94a3b8' }}>
              {isDe ? 'Teste die KI-Deal-Suche & alle Pitches 24h komplett kostenlos (0 €).' : 'Test live buyer signals & AI pitches for 24h at 100% $0 cost.'}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(5, 6, 8, 0.6)', padding: '6px 14px', borderRadius: '20px', border: '1px solid #1e232d' }}>
          <Clock size={16} color="#38bdf8" />
          <span style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 600 }}>{isDe ? 'Läuft ab in:' : 'Expires in:'}</span>
          <span style={{ fontFamily: 'monospace', fontWeight: 900, fontSize: '15px', color: passData.is_expired ? '#ef4444' : '#38bdf8' }}>
            {formatRemainingTime(passData.remaining_seconds)}
          </span>
        </div>
      </div>

      {/* Main Split-Screen Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: '40px',
          alignItems: 'center'
        }}
      >
        {/* LEFT COLUMN: High-Impact Copy & Interactive 3-Step Simulator */}
        <div>
          <div style={{ marginBottom: '20px' }}>
            <Logo size="default" />
          </div>

          <h1
            style={{
              fontSize: 'clamp(28px, 4vw, 44px)',
              fontWeight: 900,
              lineHeight: 1.15,
              color: '#f8fafc',
              letterSpacing: '-0.8px',
              marginBottom: '16px'
            }}
          >
            {isDe
              ? 'Verdiene ab heute Geld mit deinem Smartphone.'
              : 'Start Earning Money From Your Smartphone Today.'}
          </h1>

          <p
            style={{
              fontSize: 'clamp(15px, 2vw, 18px)',
              color: '#94a3b8',
              lineHeight: 1.5,
              marginBottom: '28px',
              maxWidth: '520px'
            }}
          >
            {isDe
              ? 'Unternehmen zahlen hohe Provisionen für neue Deals. NeXus scannt das Web nach Firmen mit akutem Kaufbedarf und schreibt dir die fertige Ansprache direkt aufs Handy.'
              : 'Global companies pay high commissions for qualified deals. NeXus scans the web for active buying signals and writes your winning outreach on autopilot.'}
          </p>

          {/* Interactive 3-Step Live Demo Simulator (Obsidian Card) */}
          <div
            style={{
              background: 'rgba(17, 20, 26, 0.85)',
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
              border: '1px solid #1e232d',
              borderRadius: '20px',
              padding: '20px',
              marginBottom: '28px',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
              <span style={{ fontSize: '13px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#38bdf8' }}>
                {isDe ? '10-Sekunden Live-Simulator' : '10-Second Live Simulator'}
              </span>
              <span style={{ fontSize: '12px', background: 'rgba(56, 189, 248, 0.12)', color: '#38bdf8', padding: '2px 8px', borderRadius: '12px', fontWeight: 700, border: '1px solid rgba(56, 189, 248, 0.25)' }}>
                {isDe ? 'Kostenlos testen' : 'Try Free'}
              </span>
            </div>

            {demoStep === 0 && (
              <div style={{ textAlign: 'center', padding: '14px 0' }}>
                <p style={{ fontSize: '14px', color: '#94a3b8', marginBottom: '12px' }}>
                  {isDe ? 'Probiere aus, wie einfach NeXus für dich Deals findet:' : 'See how fast NeXus finds high-paying deals for you:'}
                </p>
                <button
                  onClick={() => setDemoStep(1)}
                  style={{
                    background: '#38bdf8',
                    color: '#050608',
                    border: 'none',
                    borderRadius: '12px',
                    padding: '11px 22px',
                    fontWeight: 800,
                    fontSize: '14px',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    boxShadow: '0 4px 14px rgba(56, 189, 248, 0.25)'
                  }}
                >
                  <Sparkles size={16} />
                  {isDe ? '1. Live-Deal scannen' : '1. Scan Live Deal'}
                </button>
              </div>
            )}

            {demoStep >= 1 && (
              <div style={{ background: '#0a0c0f', border: '1px solid #1e232d', borderRadius: '12px', padding: '14px', marginBottom: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
                  <div>
                    <span style={{ fontWeight: 800, fontSize: '14px', color: '#f8fafc' }}>TechLogistik International Ltd.</span>
                    <span style={{ display: 'block', fontSize: '12px', color: '#94a3b8' }}>{isDe ? 'Signal: Expansion & Neuausrichtung' : 'Signal: European Expansion & Hiring'}</span>
                  </div>
                  <span style={{ background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', fontWeight: 800, fontSize: '12px', padding: '4px 10px', borderRadius: '8px', border: '1px solid rgba(56, 189, 248, 0.25)' }}>
                    {isDe ? 'Hohe Kaufbereitschaft' : 'High Buyer Intent'}
                  </span>
                </div>

                {demoStep === 1 && (
                  <button
                    onClick={() => setDemoStep(2)}
                    style={{
                      marginTop: '8px',
                      width: '100%',
                      background: '#38bdf8',
                      color: '#050608',
                      border: 'none',
                      borderRadius: '8px',
                      padding: '9px 14px',
                      fontWeight: 800,
                      fontSize: '13px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px'
                    }}
                  >
                    <Zap size={14} />
                    {isDe ? '2. Fertigen Pitch generieren' : '2. Generate Instant Pitch'}
                  </button>
                )}

                {demoStep === 2 && (
                  <div style={{ marginTop: '10px', background: '#11141a', padding: '12px', borderRadius: '10px', borderLeft: '3px solid #38bdf8' }}>
                    <div style={{ fontSize: '12.5px', color: '#cbd5e1', lineHeight: 1.45, marginBottom: '10px' }}>
                      {isDe
                        ? '„Hallo Herr Wagner, Glückwunsch zur Expansion! Wir haben gesehen, dass Sie für das Team noch B2B-Infrastruktur suchen. Hätten Sie nächste Woche 5 Min. für einen kurzen Austausch?“'
                        : '"Hi Marcus, congrats on expanding into the UK! We noticed your new team is looking for B2B sales infrastructure. Would you be open for a quick 5-min chat next Tuesday?"'}
                    </div>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      <button
                        onClick={handleCopyPitch}
                        style={{
                          flex: 1,
                          minWidth: '130px',
                          background: copied ? '#0284c7' : '#1e232d',
                          color: '#ffffff',
                          border: '1px solid #2d3544',
                          borderRadius: '8px',
                          padding: '8px 12px',
                          fontSize: '12px',
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '6px'
                        }}
                      >
                        {copied ? <Check size={14} /> : <Copy size={14} />}
                        {copied ? (isDe ? 'Kopiert!' : 'Copied!') : (isDe ? 'Pitch kopieren' : 'Copy Pitch')}
                      </button>
                      <button
                        onClick={() => {
                          const formEl = document.getElementById('nexus-auth-card')
                          if (formEl) formEl.scrollIntoView({ behavior: 'smooth' })
                        }}
                        style={{
                          flex: 1.5,
                          minWidth: '180px',
                          background: '#38bdf8',
                          color: '#050608',
                          border: 'none',
                          borderRadius: '8px',
                          padding: '8px 12px',
                          fontSize: '12px',
                          fontWeight: 800,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '6px',
                          boxShadow: '0 2px 8px rgba(56, 189, 248, 0.25)'
                        }}
                      >
                        <Sparkles size={14} />
                        {isDe ? '3. 5 Deals freischalten' : '3. Unlock 5 Free Deals'}
                      </button>
                      <button
                        onClick={() => setDemoStep(0)}
                        style={{ background: 'transparent', border: '1px solid #2d3544', borderRadius: '8px', padding: '8px 10px', fontSize: '11px', color: '#94a3b8', cursor: 'pointer' }}
                      >
                        Reset
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Value Checklist */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '14px', color: '#cbd5e1' }}>
              <CheckCircle2 size={18} color="#38bdf8" />
              <span>{isDe ? 'Funktioniert komplett auf dem Smartphone (kein PC nötig)' : 'Works 100% on your smartphone from anywhere'}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '14px', color: '#cbd5e1' }}>
              <CheckCircle2 size={18} color="#38bdf8" />
              <span>{isDe ? 'Keine Vorkenntnisse oder Vertriebserfahrung erforderlich' : 'Zero sales experience or prior network required'}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '14px', color: '#cbd5e1' }}>
              <CheckCircle2 size={18} color="#38bdf8" />
              <span>{isDe ? '5 echte B2B-Kaufsignale & fertige Pitches sofort inklusive' : '5 verified B2B buyer leads & instant pitches included'}</span>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Embedded Reddit-Style 1-Click Card (Obsidian Theme) */}
        <div id="nexus-auth-card">
          <div
            style={{
              background: 'rgba(17, 20, 26, 0.92)',
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
              border: '1px solid #1e232d',
              borderRadius: '24px',
              padding: 'clamp(24px, 4vw, 36px)',
              boxShadow: '0 20px 40px -15px rgba(0, 0, 0, 0.6)',
              position: 'relative'
            }}
          >
            {/* Card Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
              <div
                style={{
                  width: '40px',
                  height: '40px',
                  backgroundColor: '#0a0c0f',
                  border: '1px solid #2d3544',
                  borderRadius: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#38bdf8',
                  fontWeight: 900,
                  fontSize: '22px'
                }}
              >
                N
              </div>
              <div>
                <h3 style={{ fontSize: '20px', fontWeight: 900, color: '#f8fafc', margin: 0 }}>
                  {isDe ? '5 kostenlose Deals freischalten' : 'Unlock 5 Free B2B Deals'}
                </h3>
                <span style={{ fontSize: '12.5px', color: '#94a3b8' }}>
                  {isDe ? 'Trage deine E-Mail ein, um deinen 24h-Zugang zu sichern' : 'Enter your email to claim your 24h access pass'}
                </span>
              </div>
            </div>

            {/* Google 1-Tap Button */}
            <button
              onClick={handleGoogleLogin}
              disabled={loading}
              style={{
                width: '100%',
                background: '#0a0c0f',
                border: '1px solid #2d3544',
                borderRadius: '14px',
                padding: '13px 16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '12px',
                fontSize: '15px',
                fontWeight: 700,
                color: '#f8fafc',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
                marginBottom: '18px'
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
              </svg>
              <span>{isDe ? 'Mit Google fortfahren (1-Klick)' : 'Continue with Google (1-Tap)'}</span>
            </button>

            {/* Divider */}
            <div style={{ display: 'flex', alignItems: 'center', margin: '16px 0', color: '#64748b' }}>
              <div style={{ flex: 1, height: '1px', background: '#1e232d' }} />
              <span style={{ padding: '0 12px', fontSize: '11px', fontWeight: 800, letterSpacing: '0.5px' }}>
                {isDe ? 'ODER MIT E-MAIL' : 'OR WITH EMAIL'}
              </span>
              <div style={{ flex: 1, height: '1px', background: '#1e232d' }} />
            </div>

            {authError && (
              <div style={{
                background: 'rgba(239, 68, 68, 0.1)',
                color: '#f87171',
                padding: '10px 14px',
                borderRadius: '10px',
                fontSize: '13px',
                fontWeight: 600,
                marginBottom: '14px',
                border: '1px solid rgba(239, 68, 68, 0.25)'
              }}>
                {authError}
              </div>
            )}

            {/* Email Form */}
            <form onSubmit={handleDirectAuth}>
              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 700, color: '#cbd5e1', marginBottom: '6px' }}>
                  {isDe ? 'Deine geschäftliche E-Mail' : 'Your work email'}
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={isDe ? 'z. B. name@firma.de' : 'e.g. name@company.com'}
                  required
                  style={{
                    width: '100%',
                    padding: '12px 14px',
                    borderRadius: '12px',
                    border: '1px solid #1e232d',
                    background: '#0e1015',
                    color: '#f8fafc',
                    fontSize: '14.5px',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 700, color: '#cbd5e1', marginBottom: '6px' }}>
                  {isDe ? 'Passwort (mind. 6 Zeichen)' : 'Password (min. 6 characters)'}
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={isDe ? '••••••••' : '••••••••'}
                  style={{
                    width: '100%',
                    padding: '12px 14px',
                    borderRadius: '12px',
                    border: '1px solid #1e232d',
                    background: '#0e1015',
                    color: '#f8fafc',
                    fontSize: '14.5px',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                style={{
                  width: '100%',
                  background: 'var(--accent-blue, #38bdf8)',
                  color: '#050608',
                  border: 'none',
                  borderRadius: '14px',
                  padding: '14px',
                  fontSize: '15.5px',
                  fontWeight: 800,
                  cursor: loading ? 'wait' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  boxShadow: '0 4px 14px rgba(56, 189, 248, 0.25)',
                  transition: 'all 0.2s ease',
                  opacity: loading ? 0.8 : 1
                }}
              >
                <Zap size={18} />
                <span>{loading ? (isDe ? 'Einen Moment...' : 'One moment...') : (isDe ? 'Jetzt 5 Deals sichern (Kostenlos)' : 'Claim 5 Free Deals (Get Started)')}</span>
              </button>
            </form>

            {/* Security & Reassurance */}
            <div style={{ marginTop: '16px', textAlign: 'center', fontSize: '11.5px', color: '#94a3b8', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
              <ShieldCheck size={14} color="#38bdf8" />
              <span>{isDe ? '100 % kostenlos • Keine Kreditkarte • Sofortiger Zugriff' : '100% Free • No Credit Card Required • Instant Access'}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
