import React, { useState, useEffect, useRef } from 'react'
import { Heart, Send, ShieldAlert, Sparkles, Trash2, ArrowRight, Check, RefreshCw } from 'lucide-react'
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
  const { t } = useLanguage()
  const [message, setMessage] = useState('')
  const [chatHistory, setChatHistory] = useState([])
  const [loading, setLoading] = useState(false)
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [showConsentModal, setShowConsentModal] = useState(false)
  const [pendingMessage, setPendingMessage] = useState('')
  const [error, setError] = useState('')
  
  // Track client-side consent state
  const [consentGranted, setConsentGranted] = useState(() => {
    return localStorage.getItem('coach_consent_active') === 'true'
  })

  const messagesEndRef = useRef(null)

  // Scroll to bottom helper
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [chatHistory, loading])

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

  // Triggered when user clicks Send
  const handleSendAttempt = (e) => {
    e.preventDefault()
    if (!message.trim() || loading) return

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
    setMessage('')
    setPendingMessage('')
    
    // Optimistic user message rendering
    const userMsg = { role: 'user', content: msgText }
    setChatHistory(prev => [...prev, userMsg])
    setLoading(true)

    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token
      const visitorId = getOrCreateVisitorId()
      
      const headers = { 'Content-Type': 'application/json' }
      if (token) headers['Authorization'] = `Bearer ${token}`

      const res = await fetch('/api/coach-chat', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          message: msgText,
          visitor_id: visitorId
        })
      })

      if (!res.ok) {
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
      setError('Beim Senden der Nachricht ist ein Fehler aufgetreten. Bitte versuche es noch einmal.')
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

    if (pendingMessage) {
      executeSendMessage(pendingMessage)
    }
  }

  // Reset chat, generate a new anonymous visitor_id, and delete consent
  const handleClearHistory = () => {
    if (window.confirm('Möchtest du dieses Gespräch und alle gespeicherten Daten wirklich löschen?')) {
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
            <h1>Happiness Coach</h1>
            <span className="coach-header-subtitle">Lebensbegleiter & Ruheoase</span>
          </div>
        </div>
        {chatHistory.length > 0 && (
          <button 
            className="coach-clear-btn" 
            onClick={handleClearHistory} 
            title="Gesprächsverlauf und Daten löschen"
          >
            <Trash2 size={16} />
            <span className="clear-btn-text">Gespräch löschen</span>
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
            <h2>Ein Ort zum Reden</h2>
            <p>
              Wenn gerade viel los ist, du vor einer schweren Entscheidung stehst oder einfach 
              jemand zum unvoreingenommenen Zuhören fehlt. Lass uns über das sprechen, was dich 
              gerade beschäftigt.
            </p>
            <form onSubmit={handleSendAttempt} className="coach-welcome-input-wrap">
              <input
                type="text"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Was beschäftigt dich gerade?"
                disabled={loading}
                autoFocus
                required
              />
              <button type="submit" disabled={loading || !message.trim()} className="coach-send-circle">
                <ArrowRight size={22} />
              </button>
            </form>
            <div className="coach-safety-tag">
              <ShieldAlert size={14} />
              <span>100% vertraulich • Ohne Registrierung nutzbar</span>
            </div>
          </div>
        ) : (
          // Scrollable Chat area
          <div className="coach-history-wrapper">
            {loadingHistory && (
              <div className="coach-history-loading">
                <RefreshCw className="spin-icon" size={20} />
                <span>Verlauf wird geladen...</span>
              </div>
            )}
            <div className="coach-messages-list">
              {chatHistory.map((msg, index) => (
                <div key={index} className={`coach-msg-bubble-container ${msg.role}`}>
                  <div className="coach-msg-bubble">
                    {msg.role === 'assistant' ? (
                      <ReactMarkdown>{msg.content}</ReactMarkdown>
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

      {/* Input bar (only shown when chat has started) */}
      {chatHistory.length > 0 && (
        <footer className="coach-chat-footer">
          {error && <div className="coach-error-banner">{error}</div>}
          <form onSubmit={handleSendAttempt} className="coach-bottom-input-bar">
            <input
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Antworte dem Coach..."
              disabled={loading}
              required
            />
            <button type="submit" disabled={loading || !message.trim()} className="coach-send-button">
              <Send size={18} />
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
              <h3>Vertraulichkeit & Speicherung</h3>
            </div>
            <div className="consent-body">
              <p>
                Deine Gespräche werden verschlüsselt gespeichert, damit ich mich beim nächsten Mal an dich 
                erinnern und an unser Gespräch anknüpfen kann.
              </p>
              <p className="consent-highlight">
                Du kannst deine gesamten Gespräche und Einwilligungen jederzeit mit dem Mülleimer-Symbol 
                oben rechts rückstandslos löschen.
              </p>
            </div>
            <div className="consent-actions">
              <button 
                type="button" 
                className="btn btn-secondary consent-decline-btn" 
                onClick={handleDeclineConsent}
              >
                Anonym bleiben (Nicht speichern)
              </button>
              <button 
                type="button" 
                className="btn btn-primary consent-accept-btn" 
                onClick={handleAcceptConsent}
              >
                <Check size={16} /> Zustimmen & Senden
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
