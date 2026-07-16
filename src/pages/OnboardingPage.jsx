import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { useLanguage } from '../i18n/translations'
import Logo from '../components/Logo'
import './OnboardingPage.css'

export default function OnboardingPage() {
  const { user } = useAuth()
  const { t } = useLanguage()
  const navigate = useNavigate()
  const [saving, setSaving] = useState(false)

  const choose = async (choice) => {
    setSaving(true)
    try {
      localStorage.setItem('happiness-onboarding-done', 'true')
      await supabase.from('profiles').update({
        onboarding_completed: true,
        onboarding_choice: choice,
        last_seen: new Date().toISOString()
      }).eq('id', user.id)
      gtag('event', 'signup_completed')

      if (choice === 'community') navigate('/', { replace: true })
      else if (choice === 'creator') navigate('/', { replace: true })
      else navigate('/', { replace: true })
    } catch (err) {
      console.error('Onboarding save failed:', err)
      navigate('/', { replace: true })
    }
  }

  return (
    <div className="onboarding-page">
      <div className="onboarding-center">
        <div className="onboarding-logo">
          <img src="/favicon.svg" alt="H" style={{ width: 40, height: 40 }} />
          <Logo />
        </div>

        <h1 className="onboarding-title">{t('onboarding.welcome')}</h1>
        <p className="onboarding-subtitle">
          {t('onboarding.subtitle')}
        </p>
        <p className="onboarding-choose">
          {t('onboarding.choose')}
        </p>

        <div className="onboarding-cards">
          <button className="onboarding-card" onClick={() => choose('community')} disabled={saving}>
            <span className="onboarding-card-icon">🌍</span>
            <span className="onboarding-card-title">{t('onboarding.connect')}</span>
            <span className="onboarding-card-desc">
              {t('onboarding.connectDesc')}
            </span>
            <span className="onboarding-card-btn">{t('onboarding.connectBtn')}</span>
          </button>

          <button className="onboarding-card" onClick={() => choose('creator')} disabled={saving}>
            <span className="onboarding-card-icon">🚀</span>
            <span className="onboarding-card-title">{t('onboarding.creator')}</span>
            <span className="onboarding-card-desc">
              {t('onboarding.creatorDesc')}
            </span>
            <span className="onboarding-card-btn">{t('onboarding.creatorBtn')}</span>
          </button>

          <button className="onboarding-card" onClick={() => choose('ai')} disabled={saving}>
            <span className="onboarding-card-icon">🤖</span>
            <span className="onboarding-card-title">{t('onboarding.ai')}</span>
            <span className="onboarding-card-desc">
              {t('onboarding.aiDesc')}
            </span>
            <span className="onboarding-card-btn">{t('onboarding.aiBtn')}</span>
          </button>
        </div>
      </div>
    </div>
  )
}
