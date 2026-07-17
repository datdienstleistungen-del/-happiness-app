/**
 * PlatformConnection
 * 
 * Zeigt den Verbindungsstatus einer Plattform und ermöglicht das Verbinden.
 * Wird in der Pipeline angezeigt wenn eine Plattform nicht verbunden ist.
 */

import { useState, useEffect } from 'react'
import { Link, Check, AlertTriangle, ExternalLink, Loader2 } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useLanguage } from '../i18n/translations'
import { PLATFORMS, checkPlatformConnection, getUserPlatforms, connectPlatform } from '../intelligence/platform-connections'
import './PlatformConnection.css'

export default function PlatformConnection({ platform, onConnected, onSkip }) {
  const { user } = useAuth()
  const { t } = useLanguage()
  const [status, setStatus] = useState('checking') // 'checking', 'connected', 'disconnected', 'error'
  const [isConnecting, setIsConnecting] = useState(false)
  const [error, setError] = useState('')
  const [platformInfo, setPlatformInfo] = useState(null)

  useEffect(() => {
    checkStatus()
  }, [user, platform])

  const checkStatus = async () => {
    if (!user || !platform) return
    
    setStatus('checking')
    try {
      const connected = await checkPlatformConnection(user.id, platform)
      setStatus(connected ? 'connected' : 'disconnected')
      setPlatformInfo(PLATFORMS[platform] || null)
    } catch (err) {
      console.error('[PlatformConnection] Check error:', err)
      setStatus('error')
      setError('Verbindungsstatus konnte nicht geprüft werden.')
    }
  }

  const handleConnect = async () => {
    if (!user || !platform) return
    
    setIsConnecting(true)
    setError('')
    
    try {
      const platformData = PLATFORMS[platform]
      if (!platformData) {
        setError('Plattform nicht gefunden.')
        setIsConnecting(false)
        return
      }

      // Für OAuth-Plattformen: Redirect zur Auth-URL
      if (platformData.authType === 'oauth' && platformData.authUrl) {
        // TODO: Echten OAuth-Flow implementieren
        // Für jetzt: Zeige Hinweis dass OAuth Coming Soon ist
        setError(`OAuth-Login für ${platformData.name} wird gerade eingerichtet. Bitte hab noch einen Moment Geduld.`)
        setIsConnecting(false)
        return
      }

      // Für manuelle Plattformen (E-Mail, Podcast): Modal für manuelle Eingabe
      if (platformData.authType === 'manual') {
        // TODO: Modal für SMTP/RSS-Konfiguration
        setError(`Manuelle Konfiguration für ${platformData.name} wird gerade eingerichtet.`)
        setIsConnecting(false)
        return
      }

      // Placeholder: Erfolgreiche Verbindung (für Testing)
      const result = await connectPlatform(user.id, platform, {
        accessToken: 'test_token_' + Date.now(),
        platformUserId: 'test_user_' + Date.now(),
        platformUsername: 'test_user',
      })

      if (result.success) {
        setStatus('connected')
        if (onConnected) onConnected(platform)
      } else {
        setError(result.error || 'Verbindung fehlgeschlagen.')
      }
    } catch (err) {
      console.error('[PlatformConnection] Connect error:', err)
      setError('Verbindung fehlgeschlagen. Bitte versuch es nochmal.')
    } finally {
      setIsConnecting(false)
    }
  }

  if (status === 'checking') {
    return (
      <div className="pc-card pc-checking">
        <Loader2 size={20} className="pc-spinner" />
        <span>Prüfe {platformInfo?.name || platform}...</span>
      </div>
    )
  }

  if (status === 'connected') {
    return (
      <div className="pc-card pc-connected">
        <div className="pc-connected-icon">
          <Check size={16} />
        </div>
        <span>{platformInfo?.name || platform} ist verbunden</span>
      </div>
    )
  }

  return (
    <div className="pc-card pc-disconnected">
      <div className="pc-header">
        <span className="pc-icon">{platformInfo?.icon || '🔗'}</span>
        <div className="pc-info">
          <h3 className="pc-name">{platformInfo?.name || platform}</h3>
          <p className="pc-desc">{platformInfo?.description || ''}</p>
        </div>
      </div>

      {error && (
        <div className="pc-error">
          <AlertTriangle size={14} />
          <span>{error}</span>
        </div>
      )}

      <div className="pc-actions">
        <button
          className="pc-connect-btn"
          onClick={handleConnect}
          disabled={isConnecting}
        >
          {isConnecting ? (
            <>
              <Loader2 size={16} className="pc-spinner" />
              Verbinde...
            </>
          ) : (
            <>
              <ExternalLink size={16} />
              {platformInfo?.name || platform} verbinden
            </>
          )}
        </button>
        
        {onSkip && (
          <button className="pc-skip-btn" onClick={onSkip}>
            Überspringen
          </button>
        )}
      </div>

      <p className="pc-hinweis">
        Du brauchst ein eigenes {platformInfo?.name || platform}-Konto. 
        Happiness greift nur mit deiner Erlaubnis darauf zu.
      </p>
    </div>
  )
}

/**
 * PlatformConnectionGate
 * 
 * Blockiert den Workflow bis alle benötigten Plattformen verbunden sind.
 */
export function PlatformConnectionGate({ platforms, onAllConnected, onBack }) {
  const { user } = useAuth()
  const [connectionStatus, setConnectionStatus] = useState({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    checkAllConnections()
  }, [user, platforms])

  const checkAllConnections = async () => {
    if (!user || !platforms || platforms.length === 0) {
      setLoading(false)
      return
    }

    setLoading(true)
    const status = {}
    
    for (const platform of platforms) {
      try {
        const connected = await checkPlatformConnection(user.id, platform)
        status[platform] = connected
      } catch (err) {
        status[platform] = false
      }
    }
    
    setConnectionStatus(status)
    setLoading(false)

    // Prüfe ob alle verbunden sind
    const allConnected = Object.values(status).every(v => v === true)
    if (allConnected && onAllConnected) {
      onAllConnected()
    }
  }

  const handlePlatformConnected = (platform) => {
    setConnectionStatus(prev => ({ ...prev, [platform]: true }))
    
    // Prüfe ob jetzt alle verbunden sind
    const newStatus = { ...connectionStatus, [platform]: true }
    const allConnected = Object.values(newStatus).every(v => v === true)
    if (allConnected && onAllConnected) {
      onAllConnected()
    }
  }

  if (loading) {
    return (
      <div className="pc-gate">
        <div className="pc-gate-loading">
          <Loader2 size={24} className="pc-spinner" />
          <p>Prüfe Plattformverbindungen...</p>
        </div>
      </div>
    )
  }

  const missingPlatforms = platforms.filter(p => !connectionStatus[p])

  if (missingPlatforms.length === 0) {
    return null // Alle verbunden, nichts anzeigen
  }

  return (
    <div className="pc-gate">
      <div className="pc-gate-header">
        <h2>Plattformen verbinden</h2>
        <p>Um Content zu erstellen, brauchst du eigene Konten bei den Plattformen.</p>
      </div>

      <div className="pc-gate-list">
        {missingPlatforms.map(platform => (
          <PlatformConnection
            key={platform}
            platform={platform}
            onConnected={handlePlatformConnected}
          />
        ))}
      </div>

      {onBack && (
        <button className="pc-gate-back" onClick={onBack}>
          Zurück
        </button>
      )}
    </div>
  )
}
