import { useState, useEffect } from 'react'
import { BookOpen, Lock, Unlock, Mail, CheckCircle2, Loader2 } from 'lucide-react'
import { useLanguage } from '../i18n/translations.jsx'
import { getDailyScienceArticle } from '../content/wissenschaft'
import { supabase } from '../lib/supabase'
import './WissenschaftPage.css'

export default function WissenschaftPage() {
  const { t } = useLanguage()
  const [unlocked, setUnlocked] = useState(false)
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  
  const article = getDailyScienceArticle()

  useEffect(() => {
    // Check if user has already unlocked it previously
    const isUnlocked = localStorage.getItem('wissenschaft_unlocked') === 'true'
    if (isUnlocked) {
      setUnlocked(true)
    }
  }, [])

  const handleUnlock = async (e) => {
    e.preventDefault()
    if (!email || !email.includes('@')) {
      setError('Bitte gib eine gültige E-Mail-Adresse ein.')
      return
    }

    setLoading(true)
    setError('')

    try {
      // Speichere die E-Mail in Supabase
      const { error: dbError } = await supabase
        .from('email_leads')
        .insert([{ email: email.toLowerCase(), source: 'wissenschaft_paywall' }])
      
      // Fehler ignorieren, wenn Tabelle nicht existiert (für die Demo), 
      // aber in Produktion wollen wir ihn abfangen.
      // Falls die E-Mail schon existiert (Unique Constraint), ist das auch in Ordnung, wir schalten trotzdem frei.
      if (dbError && dbError.code !== '23505') { 
        console.warn('Database Error:', dbError)
      }

      // Freischalten!
      localStorage.setItem('wissenschaft_unlocked', 'true')
      setSuccess(true)
      
      // Kurze Verzögerung für die Animation, dann den Nebel entfernen
      setTimeout(() => {
        setUnlocked(true)
      }, 1000)

    } catch (err) {
      console.error(err)
      setError('Ein Fehler ist aufgetreten. Bitte versuche es noch einmal.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container">
      <div className="page-header">
        <h1>{t('nav.wissenschaft')}</h1>
      </div>

      <div className="card science-article-card">
        <div className="science-meta">
          <span className="science-date">{article.date}</span>
          <span className="science-readtime"><BookOpen size={14} /> {article.readTime}</span>
        </div>
        
        <h2 className="science-title">{article.title}</h2>
        
        <div className="science-intro">
          <p>{article.intro}</p>
        </div>

        {/* Trennlinie */}
        <hr className="science-divider" />

        <div className="science-body-container">
          <div className={`science-body ${unlocked ? '' : 'is-blurred'}`}>
            {article.body.split('\n\n').map((paragraph, idx) => (
              <p key={idx}>{paragraph}</p>
            ))}
          </div>

          {!unlocked && (
            <div className="fog-overlay">
              <div className="fog-form-box">
                <div className="fog-icon-wrap">
                  <Lock size={32} className="fog-icon" />
                </div>
                <h3>Weiterlesen? Kostenlos!</h3>
                <p className="fog-description">
                  Dieser Artikel (und alle zukünftigen Studien) sind zu <strong>100% kostenlos</strong>. 
                  Trag einfach kurz deine E-Mail ein, um den gesamten Text jetzt freizuschalten. Kein Abo, versprochen!
                </p>
                
                {success ? (
                  <div className="fog-success">
                    <CheckCircle2 size={40} className="success-icon" />
                    <p>Erfolgreich freigeschaltet! Einen Moment...</p>
                  </div>
                ) : (
                  <form onSubmit={handleUnlock} className="fog-form">
                    <div className="input-group">
                      <Mail size={18} className="input-icon" />
                      <input 
                        type="email" 
                        placeholder="Deine beste E-Mail-Adresse" 
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        disabled={loading}
                      />
                    </div>
                    {error && <p className="fog-error">{error}</p>}
                    <button type="submit" className="btn btn-primary fog-btn" disabled={loading}>
                      {loading ? <Loader2 size={18} className="spin" /> : <><Unlock size={18} /> Artikel jetzt freischalten</>}
                    </button>
                  </form>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
