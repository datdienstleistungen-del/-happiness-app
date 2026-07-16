import { useNavigate } from 'react-router-dom'
import { Rocket, PenTool, TrendingUp, BookOpen, ArrowRight } from 'lucide-react'
import { useLanguage } from '../i18n/translations'
import './CreatorWelcomePage.css'

export default function CreatorWelcomePage() {
  const { t } = useLanguage()
  const navigate = useNavigate()

  const go = (path) => {
    navigate(path, { replace: true })
  }

  return (
    <div className="cw-page">
      <div className="cw-center">
        <div className="cw-icon"><Rocket size={28} /></div>
        <h1 className="cw-title">{t('onboarding.creatorWelcome')}</h1>
        <p className="cw-subtitle">{t('onboarding.creatorSub')}</p>

        <div className="cw-cards">
          <button className="cw-card" onClick={() => go('/')}>
            <span className="cw-card-icon"><PenTool size={24} /></span>
            <span className="cw-card-content">
              <span className="cw-card-title">{t('onboarding.createContent')}</span>
              <span className="cw-card-desc">{t('onboarding.createContentDesc')}</span>
            </span>
            <ArrowRight size={20} className="cw-card-arrow" />
          </button>

          <button className="cw-card" onClick={() => go('/')}>
            <span className="cw-card-icon"><TrendingUp size={24} /></span>
            <span className="cw-card-content">
              <span className="cw-card-title">{t('onboarding.improveContent')}</span>
              <span className="cw-card-desc">{t('onboarding.improveContentDesc')}</span>
            </span>
            <ArrowRight size={20} className="cw-card-arrow" />
          </button>

          <button className="cw-card" onClick={() => go('/')}>
            <span className="cw-card-icon"><BookOpen size={24} /></span>
            <span className="cw-card-content">
              <span className="cw-card-title">{t('onboarding.learnSkills')}</span>
              <span className="cw-card-desc">{t('onboarding.learnSkillsDesc')}</span>
            </span>
            <ArrowRight size={20} className="cw-card-arrow" />
          </button>
        </div>

        <button className="cw-skip" onClick={() => go('/')}>
          {t('onboarding.skipDashboard')}
        </button>
      </div>
    </div>
  )
}
