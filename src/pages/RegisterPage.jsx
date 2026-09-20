import { useState, useEffect } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useLanguage } from '../i18n/translations.jsx'

export default function RegisterPage() {
  const [searchParams] = useSearchParams()
  const initialEmail = searchParams.get('email') || ''
  
  const [formData, setFormData] = useState({ email: initialEmail, password: '', name: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const navigate = useNavigate()
  const { t } = useLanguage()
  const { signInWithGoogle, signUp, signInWithPassword } = useAuth()

  useEffect(() => {
    if (initialEmail && !formData.email) {
      setFormData(prev => ({ ...prev, email: initialEmail }))
    }
  }, [initialEmail])

  function handleChange(e) {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  function translateError(msg) {
    if (msg.includes('security purposes')) return t('auth.errorSecurity') || 'Aus Sicherheitsgründen bitte kurz warten.'
    if (msg.includes('already registered') || msg.includes('User already registered')) return t('auth.errorAlreadyRegistered') || 'Diese E-Mail ist bereits registriert. Bitte logge dich ein.'
    if (msg.includes('valid email')) return t('auth.errorValidEmail') || 'Bitte gib eine gültige E-Mail-Adresse ein.'
    if (msg.includes('Password') || msg.includes('at least 6 characters')) return t('auth.errorPasswordLength') || 'Das Passwort muss mindestens 6 Zeichen lang sein.'
    if (msg.includes('rate limit')) return t('auth.errorRateLimit') || 'Zu viele Versuche. Bitte warte einen Moment.'
    return msg
  }

  async function handleGoogleAuth() {
    try {
      setLoading(true)
      setError('')
      const { error: gError } = await signInWithGoogle()
      if (gError) setError(translateError(gError.message))
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    if (formData.password.length < 6) {
      setError(t('auth.errorPasswordLength') || 'Das Passwort muss mindestens 6 Zeichen lang sein.')
      return
    }

    setLoading(true)

    try {
      const { data, error: authError } = await signUp(formData.email, formData.password, formData.name)

      if (authError) {
        // If already registered, try signing in directly with the password
        if (authError.message.includes('already registered') || authError.message.includes('User already registered')) {
          const { data: logData, error: loginError } = await signInWithPassword(formData.email, formData.password)
          if (!loginError && logData?.session) {
            navigate('/nexus/dashboard')
            return
          }
        }
        setError(translateError(authError.message))
        setLoading(false)
        return
      }

      // If Supabase returns session immediately
      if (data?.session) {
        navigate('/nexus/dashboard')
        return
      }

      // Auto-login attempt immediately after signup
      const { data: logData, error: logErr } = await signInWithPassword(formData.email, formData.password)
      if (!logErr && logData?.session) {
        navigate('/nexus/dashboard')
        return
      }

      // Only show success/confirmation if email confirmation is strictly enforced
      setSuccess(true)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        {success ? (
          <div style={{ textAlign: 'center', padding: '2rem 1rem' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🎉</div>
            <h1 style={{ fontSize: '1.3rem', marginBottom: '0.75rem' }}>{t('auth.registerSuccess') || 'Konto erstellt!'}</h1>
            <p style={{ color: 'var(--text-muted, #6b7280)', fontSize: '0.9rem', lineHeight: 1.6, marginBottom: '1.5rem' }}>
              {t('auth.registerConfirm') || 'Wir haben dir einen Bestätigungslink gesendet. Bitte prüfe dein Postfach.'}
            </p>
            <Link to="/login" className="btn btn-primary" style={{ width: '100%' }}>
              {t('auth.goToLogin') || 'Zum Login'}
            </Link>
          </div>
        ) : (
          <>
            <div style={{ textAlign: 'center', marginBottom: '0.5rem' }}>
              <img src="/nexus-logo-official.png" alt="NeXus" style={{ height: '36px', width: 'auto' }} />
            </div>
            <h1 style={{ textAlign: 'center', fontSize: '1.5rem', marginTop: '8px' }}>{t('auth.register') || 'Kostenlos registrieren'}</h1>
            <p className="subtitle">{t('auth.createAccount') || 'Starte jetzt mit deinen 5 kostenlosen B2B-Deals'}</p>

            {/* Google 1-Tap Button */}
            <button
              type="button"
              onClick={handleGoogleAuth}
              disabled={loading}
              style={{
                width: '100%',
                background: '#ffffff',
                border: '1px solid #cbd5e1',
                borderRadius: '12px',
                padding: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '10px',
                fontSize: '14.5px',
                fontWeight: 700,
                color: '#1e293b',
                cursor: 'pointer',
                marginBottom: '16px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
              </svg>
              <span>Mit Google registrieren (1-Klick)</span>
            </button>

            <div style={{ display: 'flex', alignItems: 'center', margin: '14px 0', color: '#94a3b8' }}>
              <div style={{ flex: 1, height: '1px', background: '#e2e8f0' }} />
              <span style={{ padding: '0 10px', fontSize: '11px', fontWeight: 800 }}>ODER MIT E-MAIL</span>
              <div style={{ flex: 1, height: '1px', background: '#e2e8f0' }} />
            </div>

            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>{t('auth.email') || 'E-Mail'}</label>
                <input
                  type="email"
                  name="email"
                  className="form-input"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="name@beispiel.de"
                  required
                />
              </div>

              <div className="form-group">
                <label>{t('auth.password') || 'Passwort (mind. 6 Zeichen)'}</label>
                <input
                  type="password"
                  name="password"
                  className="form-input"
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="••••••••"
                  required
                />
              </div>

              {error && <p style={{ color: 'var(--danger, #ef4444)', marginBottom: '1rem', fontSize: '0.9rem' }}>{error}</p>}

              <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '12px' }} disabled={loading}>
                {loading ? (t('auth.registering') || 'Wird erstellt...') : (t('auth.register') || 'Kostenlos starten')}
              </button>
            </form>

            <p className="link" style={{ marginTop: '16px' }}>
              {t('auth.hasAccount') || 'Bereits registriert?'} <Link to="/login">{t('auth.loginHere') || 'Hier einloggen'}</Link>
            </p>
          </>
        )}
      </div>
    </div>
  )
}

