import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useLanguage } from '../i18n/translations.jsx'

export default function RegisterPage() {
  const [formData, setFormData] = useState({ email: '', password: '', name: '', username: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const { t } = useLanguage()

  function handleChange(e) {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  function translateError(msg) {
    if (msg.includes('security purposes')) return 'Aus Sicherheitsgründen kannst du dies erst nach einigen Sekunden erneut anfordern. Bitte warte kurz.'
    if (msg.includes('already registered')) return 'Diese E-Mail-Adresse ist bereits registriert.'
    if (msg.includes('valid email')) return 'Bitte gib eine gültige E-Mail-Adresse ein.'
    if (msg.includes('Password')) return 'Passwort muss mindestens 6 Zeichen lang sein.'
    if (msg.includes('rate limit')) return 'Zu viele Versuche. Bitte warte einen Moment.'
    return msg
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    if (formData.password.length < 6) {
      setError('Passwort muss mindestens 6 Zeichen lang sein.')
      return
    }

    setLoading(true)

    const { data, error: authError } = await supabase.auth.signUp({
      email: formData.email,
      password: formData.password,
      options: {
        data: {
          name: formData.name,
          username: formData.username,
        }
      }
    })

    if (authError) {
      setError(translateError(authError.message))
      setLoading(false)
      return
    }

    navigate('/login')
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div style={{ textAlign: 'center', marginBottom: '0.5rem' }}>
          <img src="/favicon.svg" alt="Happiness" style={{ width: '40px', height: '40px' }} />
        </div>
        <h1 style={{ textAlign: 'center', fontSize: '1.5rem' }}>{t('auth.register')}</h1>
        <p className="subtitle">{t('auth.createAccount')}</p>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>{t('auth.name')}</label>
            <input
              type="text"
              name="name"
              className="form-input"
              value={formData.name}
              onChange={handleChange}
              required
            />
          </div>
          <div className="form-group">
            <label>{t('auth.username')}</label>
            <input
              type="text"
              name="username"
              className="form-input"
              value={formData.username}
              onChange={handleChange}
              required
            />
          </div>
          <div className="form-group">
            <label>{t('auth.email')}</label>
            <input
              type="email"
              name="email"
              className="form-input"
              value={formData.email}
              onChange={handleChange}
              required
            />
          </div>
          <div className="form-group">
            <label>{t('auth.password')}</label>
            <input
              type="password"
              name="password"
              className="form-input"
              value={formData.password}
              onChange={handleChange}
              required
            />
          </div>

          {error && <p style={{ color: 'var(--danger)', marginBottom: '1rem', fontSize: '0.9rem' }}>{error}</p>}

          <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={loading}>
            {loading ? t('auth.registering') : t('auth.register')}
          </button>
        </form>

        <p className="link">
          {t('auth.hasAccount')} <Link to="/login">{t('auth.loginHere')}</Link>
        </p>
      </div>
    </div>
  )
}
