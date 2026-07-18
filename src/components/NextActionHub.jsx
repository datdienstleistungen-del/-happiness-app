import { Film, BarChart3, RotateCcw, Lightbulb } from 'lucide-react'
import { useLanguage } from '../i18n/translations'
import './NextActionHub.css'

export default function NextActionHub({ onOpenCapCut, onTrackAnalytics, onReset }) {
  const { t } = useLanguage()

  return (
    <div className="nah-container">
      {/* Empfehlungs-Banner */}
      <div className="nah-banner">
        <div className="nah-banner-icon"><Lightbulb size={18} /></div>
        <p className="nah-banner-text">{t('nextActionHub.banner')}</p>
      </div>

      {/* Aktions-Grid */}
      <div className="nah-grid">
        <button className="nah-action-card" onClick={onOpenCapCut}>
          <div className="nah-action-icon"><Film size={22} /></div>
          <div className="nah-action-label">{t('nextActionHub.capcutButton')}</div>
        </button>
        <button className="nah-action-card" onClick={onTrackAnalytics}>
          <div className="nah-action-icon"><BarChart3 size={22} /></div>
          <div className="nah-action-label">{t('nextActionHub.trackingButton')}</div>
        </button>
      </div>

      {/* Reset */}
      <button className="nah-reset" onClick={onReset}>
        <RotateCcw size={15} /> {t('nextActionHub.resetButton')}
      </button>
    </div>
  )
}
