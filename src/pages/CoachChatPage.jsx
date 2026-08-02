import React, { useState, useEffect, useRef } from 'react'
import { Heart, Send, ShieldAlert, Sparkles, Trash2, ArrowRight, ArrowUp, Check, RefreshCw, Paperclip, X, Image as ImageIcon, FileText, Volume2 } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useLanguage } from '../i18n/translations'
import './CoachChatPage.css'

function getOrCreateVisitorId() {
  let vid = localStorage.getItem('hit_visitor_id')
  if (!vid) {
    vid = 'guest_' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)
    localStorage.setItem('hit_visitor_id', vid)
  }
  return vid
}

export default function CoachChatPage() {
  const { user } = useAuth()
  const { t, lang } = useLanguage()
  const [message, setMessage] = useState('')
  const [chatHistory, setChatHistory] = useState([])
  const [loading, setLoading] = useState(false)
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [showConsentModal, setShowConsentModal] = useState(false)
  const [pendingMessage, setPendingMessage] = useState('')
  const [error, setError] = useState('')
  
  const [attachment, setAttachment] = useState(null)
  const [attachmentPreview, setAttachmentPreview] = useState(null)
  const [playingAudio, setPlayingAudio] = useState(null)
  const fileInputRef = useRef(null)
  const audioRef = useRef(null)
  
  // Track client-side consent state
  const [consentGranted, setConsentGranted] = useState(() => {
    return localStorage.getItem('coach_consent_active') === 'true'
  })

  const messagesEndRef = useRef(null)
  const sessionMessageCount = useRef(0)

  // Scroll to bottom helper
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [chatHistory, loading])

  // Dynamically set localized page title
  useEffect(() => {
    document.title = `${t('coach.title')} - ${t('coach.subtitle')}`
  }, [t])

  // Fetch chat history from server on mount (only if consent was previously granted)
  useEffect(() => {
    const fetchHistory = async () => {
      if (!consentGranted) return
      setLoadingHistory(true)
      try {
        const token = (await supabase.auth.getSession()).data.session?.access_token
        const visitorId = getOrCreateVisitorId()
        
        const headers = {}
        if (token) headers['Authorization'] = `Bearer ${token}`
        
        const res = await fetch(`/api/coach-chat?visitor_id=${visitorId}`, {
          method: 'GET',
          headers
        })
        if (res.ok) {
          const data = await res.json()
          if (data.history) {
            setChatHistory(data.history)
            if (data.history.length > 0) {
              if (typeof window !== 'undefined' && typeof window.gtag === 'function') {
                window.gtag('event', 'coach_return_visit')
              }
            }
          }
        }
      } catch (err) {
        console.error('[CoachPage] Failed to load chat history:', err)
      } finally {
        setLoadingHistory(false)
      }
    }
    fetchHistory()
  }, [consentGranted, user])

  // Handle attachments
  const handleFileSelect = (e) => {
    const file = e.target.files[0]
    if (!file) return

    if (file.type.startsWith('image/')) {
      const reader = new FileReader()
      reader.onload = (ev) => {
        setAttachment(ev.target.result)
        setAttachmentPreview({ type: 'image', url: ev.target.result, name: file.name })
      }
      reader.readAsDataURL(file)
    } else {
      const reader = new FileReader()
      reader.onload = (ev) => {
        const textContent = `[Inhalt der angehängten Datei "${file.name}"]\n\n${ev.target.result}`
        setAttachment(textContent)
        setAttachmentPreview({ type: 'text', name: file.name })
      }
      reader.readAsText(file)
    }
    e.target.value = ''
  }

  const clearAttachment = () => {
    setAttachment(null)
    setAttachmentPreview(null)
  }

  // TTS playback
  const handlePlayVoice = async (text, index) => {
    if (playingAudio === index) {
      if (audioRef.current) audioRef.current.pause()
      setPlayingAudio(null)
      return
    }
    setPlayingAudio(index)
    try {
      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, voice: 'nova' })
      })
      if (!res.ok) throw new Error('TTS failed')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      if (audioRef.current) audioRef.current.pause()
      audioRef.current = new Audio(url)
      audioRef.current.onended = () => setPlayingAudio(null)
      audioRef.current.play()
    } catch (e) {
      console.error(e)
      setPlayingAudio(null)
    }
  }

  // Triggered when user clicks Send
  const handleSendAttempt = (e) => {
    e.preventDefault()
    if ((!message.trim() && !attachment) || loading) return

    setError('')
    // If consent hasn't been set, show the consent dialogue first
    const consentSet = localStorage.getItem('coach_consent_choice_made') === 'true'
    if (!consentSet) {
      setPendingMessage(message)
      setShowConsentModal(true)
      return
    }

    executeSendMessage(message)
  }

  // Handle actual API call to send message
  const executeSendMessage = async (msgText) => {
    const currentAttachment = attachment
    const currentAttachmentPreview = attachmentPreview
    
    setMessage('')
    setPendingMessage('')
    clearAttachment()

    sessionMessageCount.current += 1
    if (sessionMessageCount.current === 1) {
      if (typeof window !== 'undefined' && typeof window.gtag === 'function') {
        window.gtag('event', 'coach_message_sent', {
          message_count: 1
        })
      }
    }
    
    // Optimistic user message rendering
    const displayMsg = currentAttachmentPreview 
      ? `[Anhang: ${currentAttachmentPreview.name}]\n\n${msgText}` 
      : msgText
    const userMsg = { role: 'user', content: displayMsg }
    setChatHistory(prev => [...prev, userMsg])
    setLoading(true)

    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token
      const visitorId = getOrCreateVisitorId()
      
      const headers = { 'Content-Type': 'application/json' }
      if (token) headers['Authorization'] = `Bearer ${token}`

      const payloadMsg = currentAttachmentPreview && currentAttachmentPreview.type === 'text' 
        ? `${currentAttachment}\n\n${msgText}` 
        : msgText

      const res = await fetch('/api/coach-chat', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          message: payloadMsg,
          image_url: currentAttachmentPreview && currentAttachmentPreview.type === 'image' ? currentAttachment : undefined,
          visitor_id: visitorId,
          language: lang
        })
      })

      if (!res.ok) {
        if (res.status === 429) {
          const errData = await res.json().catch(() => ({}))
          throw new Error(errData.error || 'Upload-Limit erreicht')
        }
        throw new Error('Server returned an error')
      }

      const data = await res.json()
      if (data.response) {
        setChatHistory(prev => [...prev, { role: 'assistant', content: data.response }])
      } else {
        throw new Error('Empty response')
      }
    } catch (err) {
      console.error('[CoachPage] Send error:', err)
      const isRateLimit = err.message && err.message.includes('Upload-Limit')
      setError(isRateLimit ? 'Du hast dein tägliches Limit für kostenlose Bild-Uploads (3/3) erreicht. Bitte logge dich ein oder versuche es morgen wieder.' : t('coach.sendError'))
      // Remove the last optimistic user message if sending failed
      setChatHistory(prev => prev.slice(0, -1))
    } finally {
      setLoading(false)
    }
  }

  // Handle User giving consent
  const handleAcceptConsent = async () => {
    setShowConsentModal(false)
    setConsentGranted(true)
    localStorage.setItem('coach_consent_active', 'true')
    localStorage.setItem('coach_consent_choice_made', 'true')

    if (typeof window !== 'undefined' && typeof window.gtag === 'function') {
      window.gtag('event', 'coach_consent_given')
    }

    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token
      const visitorId = getOrCreateVisitorId()
      const headers = { 'Content-Type': 'application/json' }
      if (token) headers['Authorization'] = `Bearer ${token}`

      // Fire and forget consent call
      await fetch('/api/coach-consent', {
        method: 'POST',
        headers,
        body: JSON.stringify({ visitor_id: visitorId })
      })
    } catch (err) {
      console.error('[CoachPage] Failed to save consent on server:', err)
    }

    if (pendingMessage) {
      executeSendMessage(pendingMessage)
    }
  }

  // Handle User declining consent (chat without saving)
  const handleDeclineConsent = () => {
    setShowConsentModal(false)
    setConsentGranted(false)
    localStorage.setItem('coach_consent_active', 'false')
    localStorage.setItem('coach_consent_choice_made', 'true')

    if (typeof window !== 'undefined' && typeof window.gtag === 'function') {
      window.gtag('event', 'coach_consent_declined')
    }

    if (pendingMessage) {
      executeSendMessage(pendingMessage)
    }
  }

  // Reset chat, generate a new anonymous visitor_id, and delete consent
  const handleClearHistory = async () => {
    if (window.confirm(t('coach.clearConfirm'))) {
      const visitorId = localStorage.getItem('hit_visitor_id')

      try {
        const token = (await supabase.auth.getSession()).data.session?.access_token
        const headers = {}
        if (token) headers['Authorization'] = `Bearer ${token}`

        await fetch(`/api/coach-consent?visitor_id=${visitorId}`, {
          method: 'DELETE',
          headers
        })
      } catch (err) {
        console.error('[CoachPage] Failed to delete conversation from server:', err)
      }

      // Detach visitor session
      localStorage.removeItem('hit_visitor_id')
      localStorage.removeItem('coach_consent_active')
      localStorage.removeItem('coach_consent_choice_made')
      setConsentGranted(false)
      setChatHistory([])
      setError('')
      setMessage('')
      setPendingMessage('')
    }
  }

  return (
    <div className="coach-chat-container">
      {/* Header Bar */}
      <header className="coach-chat-header">
        <div className="coach-brand">
          <div className="coach-heart-icon">
            <Heart size={20} fill="var(--primary)" color="var(--primary)" />
          </div>
          <div className="coach-header-info">
            <h1>{t('coach.title')}</h1>
            <span className="coach-header-subtitle">{t('coach.subtitle')}</span>
          </div>
        </div>
        {chatHistory.length > 0 && (
          <button 
            className="coach-clear-btn" 
            onClick={handleClearHistory} 
            title={t('coach.clearBtn')}
          >
            <Trash2 size={16} />
            <span className="clear-btn-text">{t('coach.clearBtn')}</span>
          </button>
        )}
      </header>

      {/* Main Panel */}
      <main className="coach-chat-main">
        {chatHistory.length === 0 && !loadingHistory ? (
          // Welcome screen if no history exists
          <div className="coach-welcome-card">
            <div className="coach-icon-ring">
              <Heart size={48} className="pulse-heart" />
            </div>
            <h2>{t('coach.welcomeTitle')}</h2>
            <p>
              {t('coach.welcomeDesc')}
            </p>
            <form onSubmit={handleSendAttempt} className="coach-welcome-input-wrap">
              {attachmentPreview && (
                <div className="coach-attachment-preview">
                  {attachmentPreview.type === 'image' ? <ImageIcon size={16} /> : <FileText size={16} />}
                  <span className="attachment-name">{attachmentPreview.name}</span>
                  <button type="button" onClick={clearAttachment} className="attachment-clear"><X size={14} /></button>
                </div>
              )}
              <button type="button" className="coach-welcome-attach-btn" onClick={() => fileInputRef.current?.click()} title="Datei / Foto hochladen">
                <Paperclip size={20} />
              </button>
              <input
                type="text"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={t('coach.placeholderWelcome')}
                disabled={loading}
                autoFocus
              />
              <button type="submit" disabled={loading || (!message.trim() && !attachment)} className="coach-send-circle">
                <ArrowRight size={22} />
              </button>
            </form>
            <div className="coach-safety-tag">
              <ShieldAlert size={14} />
              <span>{t('coach.safetyText')}</span>
            </div>
          </div>
        ) : (
          // Scrollable Chat area
          <div className="coach-history-wrapper">
            {loadingHistory && (
              <div className="coach-history-loading">
                <RefreshCw className="spin-icon" size={20} />
                <span>{t('coach.loadingHistory')}</span>
              </div>
            )}
            <div className="coach-messages-list">
              {chatHistory.map((msg, index) => (
                <div key={index} className={`coach-msg-bubble-container ${msg.role}`}>
                  <div className="coach-msg-bubble">
                    {msg.role === 'assistant' ? (
                      <>
                        <ReactMarkdown>{msg.content}</ReactMarkdown>
                        <button 
                          className="coach-tts-btn"
                          onClick={() => handlePlayVoice(msg.content, index)}
                          title="Vorlesen"
                        >
                          {playingAudio === index ? <RefreshCw className="spin-icon" size={14} /> : <Volume2 size={14} />}
                        </button>
                      </>
                    ) : (
                      <p>{msg.content}</p>
                    )}
                  </div>
                </div>
              ))}
              
              {loading && (
                <div className="coach-msg-bubble-container assistant">
                  <div className="coach-msg-bubble coach-typing-indicator">
                    <span></span>
                    <span></span>
                    <span></span>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          </div>
        )}
      </main>

      {chatHistory.length > 0 && (
        <footer className="coach-chat-footer">
          {error && <div className="coach-error-banner">{error}</div>}
          <form onSubmit={handleSendAttempt} className="coach-bottom-input-bar">
            {attachmentPreview && (
              <div className="coach-attachment-preview">
                {attachmentPreview.type === 'image' ? <ImageIcon size={16} /> : <FileText size={16} />}
                <span className="attachment-name">{attachmentPreview.name}</span>
                <button type="button" onClick={clearAttachment} className="attachment-clear"><X size={14} /></button>
              </div>
            )}
            <button type="button" className="coach-attach-btn" onClick={() => fileInputRef.current?.click()} title="Datei / Foto hochladen">
              <Paperclip size={20} />
            </button>
            <input
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={t('coach.placeholderInput')}
              disabled={loading}
            />
            <button type="submit" disabled={loading || (!message.trim() && !attachment)} className="coach-send-button">
              <ArrowUp size={20} />
            </button>
          </form>
        </footer>
      )}

      {/* GDPR Consent Dialog */}
      {showConsentModal && (
        <div className="coach-consent-overlay">
          <div className="coach-consent-modal">
            <div className="consent-header">
              <ShieldAlert size={28} className="consent-alert-icon" />
              <h3>{t('coach.consentTitle')}</h3>
            </div>
            <div className="consent-body">
              <p>
                {t('coach.consentText1')}
              </p>
              <p className="consent-highlight">
                {t('coach.consentText2')}
              </p>
              <p className="consent-highlight" style={{ marginTop: '0.5rem', fontWeight: 'bold' }}>
                {t('coach.consentText3')}
              </p>
            </div>
            <div className="consent-actions">
              <button 
                type="button" 
                className="btn btn-secondary consent-decline-btn" 
                onClick={handleDeclineConsent}
              >
                {t('coach.consentDecline')}
              </button>
              <button 
                type="button" 
                className="btn btn-primary consent-accept-btn" 
                onClick={handleAcceptConsent}
              >
                <Check size={16} /> {t('coach.consentAccept')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Hidden File Input */}
      <input type="file" ref={fileInputRef} className="hidden-file-input" onChange={handleFileSelect} accept="image/*,.pdf,.txt,.doc,.docx,.csv" style={{ display: 'none' }} />
    </div>
  )
}
