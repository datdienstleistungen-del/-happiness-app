import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useLanguage } from '../i18n/translations.jsx'

export default function RegisterPage() {
  const [formData, setFormData] = useState({ email: '', password: '', name: '', username: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const navigate = useNavigate()
  const { t } = useLanguage()

  function handleChange(e) {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  function translateError(msg) {
    if (msg.includes('security purposes')) return t('auth.errorSecurity')
    if (msg.includes('already registered')) return t('auth.errorAlreadyRegistered')
    if (msg.includes('valid email')) return t('auth.errorValidEmail')
    if (msg.includes('Password')) return t('auth.errorPasswordLength')
    if (msg.includes('rate limit')) return t('auth.errorRateLimit')
    return msg
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    if (formData.password.length < 6) {
      setError(t('auth.errorPasswordLength'))
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
        },
        emailRedirectTo: window.location.origin + '/login',
      }
    })

    if (authError) {
      setError(translateError(authError.message))
      setLoading(false)
      return
    }

    setSuccess(true)
    setLoading(false)
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        {success ? (
          <div style={{ textAlign: 'center', padding: '2rem 1rem' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>✅</div>
            <h1 style={{ fontSize: '1.3rem', marginBottom: '0.75rem' }}>{t('auth.registerSuccess')}</h1>
            <p style={{ color: 'var(--text-muted, #6b7280)', fontSize: '0.9rem', lineHeight: 1.6, marginBottom: '1.5rem' }}>
              {t('auth.registerConfirm')}
            </p>
            <p style={{ color: 'var(--text-muted, #6b7280)', fontSize: '0.8rem', marginBottom: '1.5rem' }}>
              {t('auth.registerAfterConfirm')}
            </p>
            <Link to="/login" className="btn btn-primary" style={{ width: '100%' }}>
              {t('auth.goToLogin')}
            </Link>
          </div>
        ) : (
          <>
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
          </>
        )}
      </div>
    </div>
  )
}
