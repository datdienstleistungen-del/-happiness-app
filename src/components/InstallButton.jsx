import { useState, useEffect } from 'react'
import { Download, X, Share, Plus } from 'lucide-react'
import useInstallPrompt from '../hooks/useInstallPrompt'
import './InstallButton.css'

export default function InstallButton({ variant = 'sidebar' }) {
  const { install, canInstall, isStandalone, isIOS } = useInstallPrompt()
  const [showIOSModal, setShowIOSModal] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    const wasDismissed = localStorage.getItem('happiness-install-dismissed')
    if (wasDismissed) setDismissed(true)
  }, [])

  if (isStandalone || dismissed || !canInstall) return null

  const handleClick = async () => {
    if (isIOS) {
      setShowIOSModal(true)
      return
    }
    await install()
  }

  const handleDismiss = () => {
    setShowIOSModal(false)
    setDismissed(true)
    localStorage.setItem('happiness-install-dismissed', 'true')
  }

  if (variant === 'hero') {
    return (
      <>
        <button className="install-btn install-btn-hero" onClick={handleClick}>
          <Download size={20} />
          <span>Jetzt installieren</span>
        </button>

        {showIOSModal && <IOSModal onDismiss={handleDismiss} />}
      </>
    )
  }

  return (
    <>
      <button className="install-btn install-btn-sidebar" onClick={handleClick}>
        <Download size={16} />
        <span>App installieren</span>
      </button>

      {showIOSModal && <IOSModal onDismiss={handleDismiss} />}
    </>
  )
}

function IOSModal({ onDismiss }) {
  return (
    <div className="install-modal-overlay" onClick={onDismiss}>
      <div className="install-modal" onClick={(e) => e.stopPropagation()}>
        <button className="install-modal-close" onClick={onDismiss}>
          <X size={18} />
        </button>

        <div className="install-modal-icon">📱</div>
        <h3>App zum Home-Bildschirm</h3>

        <div className="install-modal-steps">
          <div className="install-modal-step">
            <div className="install-modal-step-num">1</div>
            <div className="install-modal-step-text">
              Tippe auf das <strong>Teilen-Symbol</strong>
              <div className="install-modal-step-icon"><Share size={16} /></div>
            </div>
          </div>
          <div className="install-modal-step">
            <div className="install-modal-step-num">2</div>
            <div className="install-modal-step-text">
              Wähle <strong>"Zum Home-Bildschirm"</strong>
            </div>
          </div>
          <div className="install-modal-step">
            <div className="install-modal-step-num">3</div>
            <div className="install-modal-step-text">
              Tippe <strong>"Hinzufügen"</strong>
              <div className="install-modal-step-icon"><Plus size={16} /></div>
            </div>
          </div>
        </div>

        <button className="install-modal-btn" onClick={onDismiss}>
          Verstanden
        </button>
      </div>
    </div>
  )
}
