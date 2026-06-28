import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useLanguage } from '../i18n/translations.jsx'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const { t } = useLanguage()

  function translateError(msg) {
    if (msg.includes('security purposes')) return 'Aus Sicherheitsgründen kannst du dies erst nach einigen Sekunden erneut anfordern.'
    if (msg.includes('Invalid login')) return 'Ungültige Anmeldedaten. Bitte überprüfe E-Mail und Passwort.'
    if (msg.includes('Email not confirmed')) return 'E-Mail noch nicht bestätigt. Bitte überprüfe dein Postfach.'
    if (msg.includes('rate limit')) return 'Zu viele Versuche. Bitte warte einen Moment.'
    return msg
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError(translateError(error.message))
      setLoading(false)
    } else {
      navigate('/')
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1>🌈 Happiness</h1>
        <p className="subtitle">{t('auth.loginSubtitle')}</p>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>{t('auth.email')}</label>
            <input
              type="email"
              className="form-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label>{t('auth.password')}</label>
            <input
              type="password"
              className="form-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          {error && <p style={{ color: 'var(--danger)', marginBottom: '1rem', fontSize: '0.9rem' }}>{error}</p>}

          <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={loading}>
            {loading ? t('auth.logging') : t('auth.login')}
          </button>
        </form>

        <p className="link">
          {t('auth.noAccount')} <Link to="/register">{t('auth.registerHere')}</Link>
        </p>
      </div>
    </div>
  )
}
