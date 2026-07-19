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
  const [phase, setPhase] = useState('choice')
  const [choice, setChoice] = useState(null)

  const handleChoice = (c) => {
    if (c === 'community') {
      saveOnboarding(c, null)
    } else {
      setChoice(c)
      setPhase('skill')
    }
  }

  const handleBack = () => {
    setPhase('choice')
    setChoice(null)
  }

  const handleSkill = (level) => {
    saveOnboarding(choice, level)
  }

  const saveOnboarding = async (choiceVal, skillVal) => {
    setSaving(true)
    try {
      localStorage.setItem('happiness-onboarding-done', 'true')
      localStorage.setItem('happiness-onboarding-choice', choiceVal)
      await supabase.from('profiles').update({
        onboarding_completed: true,
        onboarding_choice: choiceVal,
        editing_skill_level: skillVal,
        last_seen: new Date().toISOString()
      }).eq('id', user.id)
      navigate('/')
    } catch (err) {
      console.error('Onboarding save failed:', err)
      navigate('/')
    }
  }

  return (
    <div className="onboarding-page">
      <div className="onboarding-center">
        <div className="onboarding-logo">
          <img src="/favicon.svg" alt="H" style={{ width: 40, height: 40 }} />
          <Logo />
        </div>

        {phase === 'choice' && (
          <>
            <h1 className="onboarding-title">{t('onboarding.welcome')}</h1>
            <p className="onboarding-subtitle">{t('onboarding.subtitle')}</p>
            <p className="onboarding-choose">{t('onboarding.choose')}</p>

            <div className="onboarding-cards">
              <button className="onboarding-card" onClick={() => handleChoice('community')} disabled={saving}>
                <span className="onboarding-card-icon">🌍</span>
                <span className="onboarding-card-title">{t('onboarding.connect')}</span>
                <span className="onboarding-card-desc">{t('onboarding.connectDesc')}</span>
                <span className="onboarding-card-btn">{t('onboarding.connectBtn')}</span>
              </button>

              <button className="onboarding-card" onClick={() => handleChoice('creator')} disabled={saving}>
                <span className="onboarding-card-icon">🚀</span>
                <span className="onboarding-card-title">{t('onboarding.creator')}</span>
                <span className="onboarding-card-desc">{t('onboarding.creatorDesc')}</span>
                <span className="onboarding-card-btn">{t('onboarding.creatorBtn')}</span>
              </button>

              <button className="onboarding-card" onClick={() => handleChoice('ai')} disabled={saving}>
                <span className="onboarding-card-icon">🤖</span>
                <span className="onboarding-card-title">{t('onboarding.ai')}</span>
                <span className="onboarding-card-desc">{t('onboarding.aiDesc')}</span>
                <span className="onboarding-card-btn">{t('onboarding.aiBtn')}</span>
              </button>
            </div>
          </>
        )}

        {phase === 'skill' && (
          <>
            <h1 className="onboarding-title">{t('onboarding.skillTitle')}</h1>
            <p className="onboarding-subtitle">{t('onboarding.skillDesc')}</p>

            <div className="onboarding-cards">
              <button className="onboarding-card" onClick={() => handleSkill('beginner')} disabled={saving}>
                <span className="onboarding-card-icon">🎬</span>
                <span className="onboarding-card-title">{t('onboarding.skillBeginner')}</span>
                <span className="onboarding-card-desc">{t('onboarding.skillBeginnerDesc')}</span>
              </button>

              <button className="onboarding-card" onClick={() => handleSkill('intermediate')} disabled={saving}>
                <span className="onboarding-card-icon">🎥</span>
                <span className="onboarding-card-title">{t('onboarding.skillIntermediate')}</span>
                <span className="onboarding-card-desc">{t('onboarding.skillIntermediateDesc')}</span>
              </button>

              <button className="onboarding-card" onClick={() => handleSkill('pro')} disabled={saving}>
                <span className="onboarding-card-icon">🎞️</span>
                <span className="onboarding-card-title">{t('onboarding.skillPro')}</span>
                <span className="onboarding-card-desc">{t('onboarding.skillProDesc')}</span>
              </button>
            </div>

            <button className="onboarding-back-btn" onClick={handleBack} disabled={saving}>
              {t('onboarding.skillBack')}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
