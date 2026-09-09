import React, { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Target, Send, ShieldAlert, Sparkles, Trash2, ArrowRight, ArrowUp, Check, RefreshCw, Paperclip, X, FileText, TrendingUp, Users, AlertCircle, MessageSquare, ArrowLeft } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useLead } from '../context/LeadContext'
import { useLanguage } from '../i18n/translations'
import { callNexusAI } from '../lib/nexus-ai'
import { buildCoachContext, buildCoachSystemPrompt, getContextSummary } from '../lib/nexus-coach'
import UpgradeModal from '../components/UpgradeModal'
import './CoachChatPage.css'

function getOrCreateVisitorId() {
  let vid = localStorage.getItem('nexus_visitor_id')
  if (!vid) {
    vid = 'guest_' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)
    localStorage.setItem('nexus_visitor_id', vid)
  }
  return vid
}

const SALES_QUICK_ACTIONS = [
  { id: 'pitch', label: 'Sales Pitch erstellen', icon: MessageSquare, placeholder: 'Beschreibe dein Angebot und deine Zielgruppe...' },
  { id: 'einwand', label: 'Einwand behandeln', icon: AlertCircle, placeholder: 'Was sagt der Kunde? z.B. "Ist zu teuer"...' },
  { id: 'followup', label: 'Follow-Up Vorschlag', icon: TrendingUp, placeholder: 'Was war die letzte Aktion mit diesem Lead?' },
  { id: 'analyse', label: 'Lead analysieren', icon: Users, placeholder: 'Firmenname, Branche, was weißt du über das Unternehmen?' },
]

export default function CoachChatPage({ embeddedLeadId, onClose }) {
  const { user } = useAuth()
  const { leadId: paramLeadId } = useParams()
  const leadId = embeddedLeadId || paramLeadId
  const navigate = useNavigate()
  
  // Hole alle Daten aus dem Context
  const { activeOffering, opportunities, triggers } = useLead()
  const { t, lang } = useLanguage()
  
  const [message, setMessage] = useState('')
  const [chatHistory, setChatHistory] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [activeQuickAction, setActiveQuickAction] = useState(null)
  const [showUpgradeModal, setShowUpgradeModal] = useState(false)
  
  // Finde den spezifischen Lead (Opportunity) und seine Trigger
  const currentLead = opportunities?.find(o => o.id === leadId)
  const leadTriggers = currentLead ? (triggers?.filter(t => t.company_id === currentLead.company_id) || []) : []
  
  const messagesEndRef = useRef(null)

  const getStorageKey = () => leadId ? `nexus_coach_history_${leadId}` : 'nexus_coach_history'

  // Lade History beim Mounten oder wenn sich der Lead ändert
  useEffect(() => {
    try {
      const saved = localStorage.getItem(getStorageKey())
      setChatHistory(saved ? JSON.parse(saved) : [])
    } catch (e) {
      setChatHistory([])
    }
  }, [leadId])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [chatHistory, loading])

  useEffect(() => {
    localStorage.setItem(getStorageKey(), JSON.stringify(chatHistory))
  }, [chatHistory, leadId])

  useEffect(() => {
    document.title = currentLead 
      ? `Coach: ${currentLead.nexus_companies?.name || 'Lead'}` 
      : 'NeXus Coach - Sales Intelligence'
  }, [currentLead])

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (message.trim() && !loading) {
        handleSend(e)
      }
    }
  }

  const handleSend = async (e) => {
    e.preventDefault()
    if (!message.trim() || loading) return

    setError('')
    const userMsg = { role: 'user', content: message }
    setChatHistory(prev => [...prev, userMsg])
    setMessage('')
    setActiveQuickAction(null)
    setLoading(true)

    try {
      // --- KONTEXT BUILDER: Nur relevante Daten ---
      const context = await buildCoachContext({
        opportunity: currentLead,
        offering: activeOffering,
        triggers: leadTriggers,
      })

      // --- DEBUG: Was landet tatsächlich im Context? ---
      console.log('[NeXusCoach] Context Debug:', {
        hasContext: !!context,
        companyName: context?.company?.name,
        hasOffering: !!context?.offering,
        offeringName: context?.offering?.name,
        triggerCount: context?.triggers?.length,
        contactCount: context?.contacts?.length,
        hasResearch: !!context?.research,
        activityCount: context?.activities?.length,
        opportunityStage: context?.opportunity?.stage,
      })

      // --- SYSTEM-PROMPT: Saubere Trennung ---
      const systemContext = buildCoachSystemPrompt(context, activeQuickAction)

      // --- DEBUG: Was steht im Prompt? ---
      const contextSection = systemContext.split('--- AKTUELLER KONTEXT')[1]?.split('---')[0] || 'KEIN KONTEXT GEFUNDEN'
      console.log('[NeXusCoach] Prompt-Kontext:', contextSection.substring(0, 500))
      console.log('[NeXusCoach] System-Prompt Länge:', systemContext.length, 'Zeichen')

      const recentHistory = chatHistory.slice(-4);
      const response = await callNexusAI('chat', message, { system: systemContext, history: recentHistory }, 0.5)
      
      if (response) {
        let textContent = ''
        if (typeof response === 'string') {
          textContent = response
        } else if (typeof response === 'object') {
          textContent = response.response || response.message || response.answer || response.content || JSON.stringify(response)
        }
        setChatHistory(prev => [...prev, { role: 'assistant', content: textContent }])
      } else {
        throw new Error('Leere Antwort vom Server')
      }
    } catch (err) {
      console.error('[NeXusCoach] Send error:', err)
      if (err.name === 'RateLimitError') {
        setShowUpgradeModal(true)
      } else {
        // Falls ein Timeout oder API-Absturz passiert, Text zurück ins Eingabefeld retten!
        setError(`Fehler beim Senden: ${err.message || 'Timeout'}. Dein Text wurde zur Sicherheit wiederhergestellt.`)
        setMessage(userMsg.content)
      }
      setChatHistory(prev => prev.slice(0, -1))
    } finally {
      setLoading(false)
    }
  }

  const handleQuickAction = (actionId) => {
    setActiveQuickAction(activeQuickAction === actionId ? null : actionId)
    setMessage('')
  }

  return (
    <div className="nexus-coach-container" style={onClose ? { height: '100%', borderLeft: '1px solid var(--border-light)' } : {}}>
      <header className="nexus-coach-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          {!onClose ? (
            <button 
              className="btn-secondary" 
              onClick={() => navigate('/nexus/sales-workspace')}
              style={{ padding: '6px 12px', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <ArrowLeft size={16} /> Zurück
            </button>
          ) : (
            <button
              className="btn-secondary"
              onClick={onClose}
              style={{ padding: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <X size={18} />
            </button>
          )}
          <div className="nexus-coach-brand">
            <div className="nexus-coach-icon">
              <Target size={22} />
            </div>
            <div className="nexus-coach-info">
              <h1>{currentLead ? `Coach: ${currentLead.nexus_companies?.name}` : 'NeXus Sales Coach'}</h1>
              <span className="nexus-coach-subtitle">
                {currentLead ? `Lead Intelligence für ${currentLead.nexus_companies?.industry || 'Unbekannte Branche'}` : 'Dein Vertriebsassistent'}
              </span>
            </div>
          </div>
        </div>
        {chatHistory.length > 0 && (
          <button 
            className="nexus-coach-clear-btn" 
            onClick={() => {
              if (window.confirm('Gesprächsverlauf löschen?')) {
                setChatHistory([])
              }
            }}
          >
            <Trash2 size={16} />
          </button>
        )}
      </header>

      <main className="nexus-coach-main">
        {chatHistory.length === 0 ? (
          <div className="nexus-coach-welcome">
            <div className="nexus-coach-welcome-icon">
              <Target size={48} />
            </div>
            <h2>{currentLead ? `Coach: ${currentLead.nexus_companies?.name || 'Lead'}` : 'Willkommen beim NeXus Sales Coach'}</h2>
            <p>{currentLead 
              ? `Ich helfe dir beim Verkauf an ${currentLead.nexus_companies?.name || 'diesen Lead'}. Wähle eine Aktion oder stelle mir eine Frage.`
              : 'Ich helfe dir bei der Vertriebsoptimierung. Wähle eine Aktion oder stelle mir eine Frage.'
            }</p>
            
            {currentLead && (
              <div className="nexus-coach-context-hint" style={{ 
                padding: '12px 16px', 
                background: 'var(--bg-secondary, #f8f9fa)', 
                borderRadius: '8px', 
                marginBottom: '20px',
                fontSize: '0.85rem',
                color: 'var(--text-secondary, #666)',
                border: '1px solid var(--border-light, #e0e0e0)'
              }}>
                <strong>Kontext:</strong> {currentLead.nexus_companies?.name || '?'} · {activeOffering?.offering_name || '?'}
                {leadTriggers.length > 0 && ` · ${leadTriggers.length} Trigger`}
              </div>
            )}
            
            <div className="nexus-coach-quick-actions">
              {SALES_QUICK_ACTIONS.map(action => (
                <button
                  key={action.id}
                  className={`nexus-quick-action-btn ${activeQuickAction === action.id ? 'active' : ''}`}
                  onClick={() => handleQuickAction(action.id)}
                >
                  <action.icon size={18} />
                  <span>{action.label}</span>
                </button>
              ))}
            </div>

            <div className="nexus-coach-input-area" style={{ marginTop: '32px' }}>
              <form onSubmit={handleSend} className="nexus-coach-form">
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={activeQuickAction ? SALES_QUICK_ACTIONS.find(a => a.id === activeQuickAction)?.placeholder : 'Füge hier deine Firmen-Analysen, Recherchen oder Fragen ein... (Shift+Enter für neue Zeile)'}
                  disabled={loading}
                  autoFocus
                  rows={4}
                  style={{ resize: 'vertical', minHeight: '80px', width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-light)', background: 'var(--bg-card)', color: 'var(--text-primary)', fontSize: '0.95rem' }}
                />
                <button type="submit" disabled={loading || !message.trim()} style={{ alignSelf: 'flex-end', marginBottom: '4px' }}>
                  <ArrowRight size={20} />
                </button>
              </form>
            </div>
          </div>
        ) : (
          <div className="nexus-coach-messages">
            {chatHistory.map((msg, index) => (
              <div key={index} className={`nexus-msg ${msg.role}`}>
                <div className="nexus-msg-content">
                  <ReactMarkdown>{msg.content}</ReactMarkdown>
                </div>
              </div>
            ))}
            {loading && (
              <div className="nexus-msg assistant">
                <div className="nexus-msg-content nexus-typing">
                  <span></span><span></span><span></span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </main>

      {error && <div className="nexus-coach-error" style={{ margin: '0 20px', padding: '12px', background: '#EF444420', color: '#EF4444', borderRadius: '8px', border: '1px solid #EF4444' }}>{error}</div>}
      
      {(chatHistory.length > 0 || true) && (
        <footer className="nexus-coach-footer">
          <div className="nexus-coach-quick-actions-row">
            {SALES_QUICK_ACTIONS.map(action => (
              <button
                key={action.id}
                className={`nexus-quick-action-sm ${activeQuickAction === action.id ? 'active' : ''}`}
                onClick={() => handleQuickAction(action.id)}
                title={action.label}
              >
                <action.icon size={16} />
              </button>
            ))}
          </div>
          <form onSubmit={handleSend} className="nexus-coach-input-bar" style={{ alignItems: 'flex-end' }}>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={activeQuickAction 
                ? SALES_QUICK_ACTIONS.find(a => a.id === activeQuickAction)?.placeholder
                : 'Stelle eine Vertriebsfrage... (Shift+Enter für neue Zeile)'}
              disabled={loading}
              rows={2}
              style={{ flex: 1, resize: 'vertical', minHeight: '44px', maxHeight: '150px', padding: '10px 14px', borderRadius: '8px', border: 'none', background: 'transparent', color: 'var(--text-primary)', fontSize: '0.95rem', outline: 'none' }}
            />
            <button type="submit" disabled={loading || !message.trim()} style={{ marginBottom: '6px' }}>
              <ArrowUp size={20} />
            </button>
          </form>
        </footer>
      )}
      
      <UpgradeModal 
        isOpen={showUpgradeModal} 
        onClose={() => setShowUpgradeModal(false)} 
        onBypass={() => {
          // Dev-Bypass: Fehler zurücksetzen und Modal schließen
          setError('');
        }}
      />
    </div>
  )
}
