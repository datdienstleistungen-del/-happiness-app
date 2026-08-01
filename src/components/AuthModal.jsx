import { useState } from 'react'
import { X, Check } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useLanguage } from '../i18n/translations.jsx'

export default function AuthModal({ isOpen, onClose, onSuccess, title = 'Konto erstellen oder einloggen' }) {
  const [isLogin, setIsLogin] = useState(true)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [username, setUsername] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [successMsg, setSuccessMsg] = useState('')
  const { t } = useLanguage()

  if (!isOpen) return null

  function translateError(msg) {
    if (msg.includes('security purposes')) return t('auth.errorSecurity')
    if (msg.includes('Invalid login')) return t('auth.errorInvalidLogin')
    if (msg.includes('Email not confirmed')) return t('auth.errorEmailNotConfirmed')
    if (msg.includes('rate limit')) return t('auth.errorRateLimit')
    return msg
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setSuccessMsg('')
    setLoading(true)

    try {
      if (isLogin) {
        // Sign In
        const { data, error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error

        if (data.user) {
          onSuccess(data.user)
          onClose()
        }
      } else {
        // Sign Up
        const cleanUsername = username.trim().toLowerCase()
        if (cleanUsername) {
          // Check if username is already taken
          const { data: existing } = await supabase
            .from('profiles')
            .select('id')
            .eq('username', cleanUsername)
            .maybeSingle()
          
          if (existing) {
            throw new Error('Dieser Benutzername ist bereits vergeben.')
          }
        }

        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              name: name.trim(),
              username: cleanUsername
            }
          }
        })
        if (error) throw error

        if (data.user) {
          // If auto-confirm is enabled or session is immediately active
          if (data.session) {
            onSuccess(data.user)
            onClose()
          } else {
            setSuccessMsg('Registrierung erfolgreich! Bitte bestätige deine E-Mail-Adresse, um fortzufahren.')
            setEmail('')
            setPassword('')
            setName('')
            setUsername('')
          }
        }
      }
    } catch (err) {
      console.error('[AuthModal] Error:', err.message)
      setError(translateError(err.message))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-modal-overlay" style={styles.overlay}>
      <div className="auth-modal-card" style={styles.card}>
        <button onClick={onClose} style={styles.closeBtn} title="Schließen">
          <X size={18} />
        </button>

        <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
          <img src="/favicon.svg" alt="H" style={{ width: '36px', height: '36px' }} />
          <h2 style={styles.title}>{title}</h2>
          <p style={styles.subtitle}>
            {isLogin ? 'Melde dich an, um dein Skript dauerhaft zu sichern.' : 'Registriere dich kostenlos, um deine Skripte zu speichern.'}
          </p>
        </div>

        {successMsg ? (
          <div style={styles.successBlock}>
            <div style={styles.successIcon}><Check size={24} /></div>
            <p style={{ margin: '8px 0 0 0', fontWeight: '600', color: '#0f5132' }}>{successMsg}</p>
            <button 
              className="vsp-btn vsp-btn-primary" 
              onClick={() => setIsLogin(true)} 
              style={{ marginTop: '16px', width: '100%', justifyContent: 'center' }}
            >
              Jetzt anmelden
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={styles.form}>
            {!isLogin && (
              <>
                <div style={styles.field}>
                  <label style={styles.label}>Name</label>
                  <input
                    type="text"
                    style={styles.input}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Dein Name"
                    required
                  />
                </div>
                <div style={styles.field}>
                  <label style={styles.label}>Benutzername</label>
                  <input
                    type="text"
                    style={styles.input}
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="z.B. creator_max"
                    required
                  />
                </div>
              </>
            )}

            <div style={styles.field}>
              <label style={styles.label}>E-Mail</label>
              <input
                type="email"
                style={styles.input}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="deine@email.de"
                required
              />
            </div>

            <div style={styles.field}>
              <label style={styles.label}>Passwort</label>
              <input
                type="password"
                style={styles.input}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                minLength={6}
                required
              />
            </div>

            {error && <p style={styles.errorText}>{error}</p>}

            <button type="submit" className="vsp-btn vsp-btn-primary" style={styles.submitBtn} disabled={loading}>
              {loading ? 'Bitte warten...' : (isLogin ? 'Jetzt anmelden' : 'Registrieren & Fortfahren')}
            </button>
          </form>
        )}

        {!successMsg && (
          <div style={styles.toggleContainer}>
            {isLogin ? (
              <p style={{ margin: 0 }}>
                Noch kein Konto?{' '}
                <span onClick={() => { setIsLogin(false); setError(''); }} style={styles.toggleLink}>
                  Hier registrieren
                </span>
              </p>
            ) : (
              <p style={{ margin: 0 }}>
                Bereits ein Konto?{' '}
                <span onClick={() => { setIsLogin(true); setError(''); }} style={styles.toggleLink}>
                  Hier anmelden
                </span>
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

const styles = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0, 0, 0, 0.6)',
    backdropFilter: 'blur(4px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
    padding: '16px'
  },
  card: {
    background: '#ffffff',
    borderRadius: '16px',
    padding: '24px 32px',
    maxWidth: '440px',
    width: '100%',
    boxShadow: '0 10px 25px rgba(0, 0, 0, 0.15)',
    position: 'relative',
    animation: 'authModalEnter 0.3s ease-out',
    color: '#1f2937'
  },
  closeBtn: {
    position: 'absolute',
    top: '16px',
    right: '16px',
    background: 'none',
    border: 'none',
    color: '#9ca3af',
    cursor: 'pointer',
    padding: '4px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'background 0.2s, color 0.2s'
  },
  title: {
    margin: '12px 0 4px 0',
    fontSize: '1.25rem',
    fontWeight: '700',
    color: '#111827'
  },
  subtitle: {
    margin: 0,
    fontSize: '0.85rem',
    color: '#6b7280',
    lineHeight: '1.4'
  },
  form: {
    marginTop: '16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px'
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    textAlign: 'left'
  },
  label: {
    fontSize: '0.8rem',
    fontWeight: '600',
    color: '#374151'
  },
  input: {
    padding: '10px 12px',
    borderRadius: '8px',
    border: '1px solid #d1d5db',
    fontSize: '0.9rem',
    color: '#1f2937',
    outline: 'none',
    transition: 'border-color 0.2s'
  },
  submitBtn: {
    marginTop: '8px',
    padding: '12px',
    width: '100%',
    justifyContent: 'center',
    fontSize: '0.95rem',
    fontWeight: '600'
  },
  errorText: {
    margin: '4px 0',
    fontSize: '0.8rem',
    color: '#dc2626',
    fontWeight: '600',
    textAlign: 'left'
  },
  toggleContainer: {
    marginTop: '20px',
    textAlign: 'center',
    fontSize: '0.85rem',
    color: '#4b5563',
    borderTop: '1px solid #f3f4f6',
    paddingTop: '16px'
  },
  toggleLink: {
    color: '#085041',
    fontWeight: '600',
    cursor: 'pointer',
    textDecoration: 'underline'
  },
  successBlock: {
    textAlign: 'center',
    padding: '16px 0 8px 0'
  },
  successIcon: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '48px',
    height: '48px',
    borderRadius: '50%',
    background: '#d1e7dd',
    color: '#0f5132'
  }
}
