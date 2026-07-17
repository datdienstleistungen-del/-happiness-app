import { useNavigate } from 'react-router-dom'
import { useLanguage } from '../i18n/translations'
import './VideoShowcase.css'

export default function VideoShowcase() {
  const navigate = useNavigate()
  const { t } = useLanguage()

  const copyPrompt = () => {
    navigator.clipboard.writeText(t('videoShowcase.promptText'))
  }

  return (
    <section className="video-showcase-section">
      <div className="video-showcase-container">
        <header className="showcase-header">
          <h2 className="showcase-title">{t('videoShowcase.title')}</h2>
          <p className="showcase-subtitle">{t('videoShowcase.subtitle')}</p>
        </header>

        <div className="showcase-card">
          <div className="showcase-video-column">
            <video
              className="showcase-video"
              src="/assets/videos/demo-hit.mp4"
              autoPlay
              loop
              muted
              playsInline
            />
          </div>

          <div className="showcase-info-column">
            <div className="prompt-box">
              <div className="prompt-header">
                <span className="prompt-label">{t('videoShowcase.promptLabel')}</span>
                <button className="copy-icon-btn" onClick={copyPrompt} aria-label="Copy Prompt">
                  📋
                </button>
              </div>
              <div className="prompt-content">
                <code>"{t('videoShowcase.promptText')}"</code>
              </div>
            </div>

            <div className="results-box">
              <span className="results-label">{t('videoShowcase.resultLabel')}</span>
              <div className="platform-badges">
                <span className="badge badge-tiktok">🎬 {t('videoShowcase.badge1')}</span>
                <span className="badge badge-instagram">📸 {t('videoShowcase.badge2')}</span>
                <span className="badge badge-shorts">📝 {t('videoShowcase.badge3')}</span>
              </div>
            </div>

            <div className="showcase-branding">
              <span className="hit-logo-small">⚡ H.I.T.</span>
            </div>
          </div>
        </div>

        <div className="showcase-cta-container">
          <button className="showcase-cta-btn" onClick={() => navigate('/register')}>
            {t('videoShowcase.cta')}
          </button>
        </div>
      </div>
    </section>
  )
}
