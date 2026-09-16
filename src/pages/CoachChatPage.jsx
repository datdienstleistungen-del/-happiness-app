import React, { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { 
  Target, Send, ShieldAlert, Sparkles, Trash2, ArrowRight, ArrowUp, 
  Check, RefreshCw, Paperclip, X, FileText, TrendingUp, Users, 
  AlertCircle, MessageSquare, ArrowLeft, FileCheck, Image as ImageIcon, ExternalLink
} from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
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

export default function CoachChatPage({ embeddedLeadId, onClose }) {
  const { user } = useAuth()
  const { leadId: paramLeadId } = useParams()
  const leadId = embeddedLeadId || paramLeadId
  const navigate = useNavigate()
  
  // Hole alle Daten aus dem Context
  const { activeOffering, opportunities, triggers } = useLead()
  const { t, lang } = useLanguage()

  const SALES_QUICK_ACTIONS = [
    { id: 'pitch', label: t('nexus.coach.actionPitch', 'Sales Pitch erstellen'), icon: MessageSquare, placeholder: t('nexus.coach.phPitch', 'Beschreibe dein Angebot und deine Zielgruppe...') },
    { id: 'einwand', label: t('nexus.coach.actionObjection', 'Einwand behandeln'), icon: AlertCircle, placeholder: t('nexus.coach.phObjection', 'Was sagt der Kunde? z.B. "Ist zu teuer"...') },
    { id: 'followup', label: t('nexus.coach.actionFollowup', 'Follow-Up Vorschlag'), icon: TrendingUp, placeholder: t('nexus.coach.phFollowup', 'Was war die letzte Aktion mit diesem Lead?') },
    { id: 'analyse', label: t('nexus.coach.actionAnalyze', 'Lead analysieren'), icon: Users, placeholder: t('nexus.coach.phAnalyze', 'Firmenname, Branche, was weißt du über das Unternehmen?') },
    { id: 'contract', label: t('nexus.coach.actionContract', 'Vertrag & AGB prüfen'), icon: FileCheck, placeholder: t('nexus.coach.phContract', 'Füge den Vertragstext ein oder lade einen Screenshot/PDF hoch...') },
  ]
  
  const [message, setMessage] = useState('')
  const [attachment, setAttachment] = useState(null)
  const [isDragging, setIsDragging] = useState(false)
  const [chatHistory, setChatHistory] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [activeQuickAction, setActiveQuickAction] = useState(null)
  const [showUpgradeModal, setShowUpgradeModal] = useState(false)
  const fileInputRef = useRef(null)
  
  // Finde den spezifischen Lead (Opportunity) und seine Trigger
  // Wenn keine leadId: Nimm die letzte Opportunity aus der Pipeline
  const currentLead = leadId 
    ? opportunities?.find(o => o.id === leadId)
    : opportunities?.[0] || null
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

  const handlePaste = (e) => {
    const items = e.clipboardData?.items
    if (!items) return

    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const file = items[i].getAsFile()
        if (file) {
          e.preventDefault()
          const reader = new FileReader()
          reader.onload = (event) => {
            setAttachment({
              file,
              dataUrl: event.target.result,
              name: file.name || `Screenshot_${new Date().toLocaleTimeString().replace(/:/g, '-')}.png`,
              type: 'image'
            })
          }
          reader.readAsDataURL(file)
          break
        }
      }
    }
  }

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.type.startsWith('image/')) {
      const reader = new FileReader()
      reader.onload = (event) => {
        setAttachment({
          file,
          dataUrl: event.target.result,
          name: file.name,
          type: 'image'
        })
      }
      reader.readAsDataURL(file)
    } else if (file.type === 'text/plain' || file.name.endsWith('.txt') || file.name.endsWith('.md')) {
      const reader = new FileReader()
      reader.onload = (event) => {
        const textContent = event.target.result
        setMessage(prev => prev ? `${prev}\n\n[Dokument: ${file.name}]\n${textContent}` : `[Dokument: ${file.name}]\n${textContent}`)
      }
      reader.readAsText(file)
    } else {
      // PDF or other documents as Data URL
      const reader = new FileReader()
      reader.onload = (event) => {
        setAttachment({
          file,
          dataUrl: event.target.result,
          name: file.name,
          type: 'doc'
        })
      }
      reader.readAsDataURL(file)
    }
    e.target.value = ''
  }

  const handleDragOver = (e) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (e) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer?.files?.[0]
    if (!file) return

    if (file.type.startsWith('image/')) {
      const reader = new FileReader()
      reader.onload = (event) => {
        setAttachment({
          file,
          dataUrl: event.target.result,
          name: file.name,
          type: 'image'
        })
      }
      reader.readAsDataURL(file)
    } else if (file.type === 'text/plain' || file.name.endsWith('.txt') || file.name.endsWith('.md')) {
      const reader = new FileReader()
      reader.onload = (event) => {
        const textContent = event.target.result
        setMessage(prev => prev ? `${prev}\n\n[Dokument: ${file.name}]\n${textContent}` : `[Dokument: ${file.name}]\n${textContent}`)
      }
      reader.readAsText(file)
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if ((message.trim() || attachment) && !loading) {
        handleSend(e)
      }
    }
  }

  const handleSend = async (e) => {
    if (e) e.preventDefault()
    if ((!message.trim() && !attachment) || loading) return

    setError('')
    const currentAttachment = attachment
    const currentMsgText = message.trim() || (currentAttachment ? (lang === 'de' ? 'Bitte analysiere dieses angehängte Bild / Dokument.' : 'Please analyze this attached image / document.') : '')
    
    const userMsg = { 
      role: 'user', 
      content: currentMsgText,
      attachment: currentAttachment?.dataUrl || null,
      fileName: currentAttachment?.name || null,
      attachmentType: currentAttachment?.type || null
    }

    setChatHistory(prev => [...prev, userMsg])
    setMessage('')
    setAttachment(null)
    setActiveQuickAction(null)
    setLoading(true)

    try {
      // --- KONTEXT BUILDER: Nur relevante Daten ---
      const context = await buildCoachContext({
        opportunity: currentLead,
        offering: activeOffering,
        triggers: leadTriggers,
      })

      // --- SYSTEM-PROMPT: Saubere Trennung ---
      const systemContext = buildCoachSystemPrompt(context, activeQuickAction, lang || 'de')
      const recentHistory = chatHistory.slice(-4)

      const response = await callNexusAI({
        mode: 'chat',
        message: currentMsgText,
        context: {
          system: systemContext,
          history: recentHistory,
          quickAction: activeQuickAction,
          imageUrl: currentAttachment?.dataUrl || null
        },
        imageUrl: currentAttachment?.dataUrl || null,
        temperature: 0.5,
        lang: lang || 'de'
      })
      
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
        // Falls ein Timeout oder API-Absturz passiert, Text & Anhang zurückretten
        setError(`Fehler beim Senden: ${err.message || 'Timeout'}. Dein Text wurde zur Sicherheit wiederhergestellt.`)
        setMessage(currentMsgText)
        if (currentAttachment) setAttachment(currentAttachment)
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
    <div 
      className={`nexus-coach-container ${isDragging ? 'dragging' : ''}`} 
      style={onClose ? { height: '100%', borderLeft: '1px solid var(--border-light)' } : {}}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <header className="nexus-coach-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button
            className="nexus-coach-clear-btn"
            onClick={onClose || (() => navigate(-1))}
            title="Schließen"
          >
            <X size={18} />
          </button>
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
            <h2>{currentLead ? `Coach: ${currentLead.nexus_companies?.name || 'Lead'}` : t('nexus.coach.welcomeTitle', 'Willkommen beim NeXus Sales Coach')}</h2>
            <p>{currentLead 
              ? `${t('nexus.coach.helpPrefix', 'Ich helfe dir beim Verkauf an')} ${currentLead.nexus_companies?.name || 'diesen Lead'}. ${t('nexus.coach.chooseAction', 'Wähle eine Aktion oder stelle mir eine Frage.')}`
              : t('nexus.coach.generalHelp', 'Ich helfe dir bei Vertriebsoptimierung, Lead-Recherche & AGB-Checks. Füge Text, Screenshots (Strg+V) oder Dokumente ein.')
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
                <strong>{t('nexus.coach.context', 'Kontext')}:</strong> {currentLead.nexus_companies?.name || '?'} · {activeOffering?.offering_name || '?'}
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
          </div>
        ) : (
          <div className="nexus-coach-messages">
            {chatHistory.map((msg, index) => (
              <div key={index} className={`nexus-msg ${msg.role}`}>
                <div className="nexus-msg-content">
                  {msg.attachment && (
                    <div className="nexus-msg-attachment">
                      <img src={msg.attachment} alt={msg.fileName || 'Attachment'} />
                    </div>
                  )}
                  <ReactMarkdown 
                    remarkPlugins={[remarkGfm]}
                    components={{
                      a: ({ href, children, ...props }) => (
                        <a 
                          href={href} 
                          target="_blank" 
                          rel="noopener noreferrer" 
                          className="nexus-chat-link"
                          {...props}
                        >
                          <span>{children}</span>
                          <ExternalLink size={12} className="nexus-chat-link-icon" />
                        </a>
                      ),
                      table: ({ children, ...props }) => (
                        <div className="nexus-chat-table-wrapper">
                          <table className="nexus-chat-table" {...props}>
                            {children}
                          </table>
                        </div>
                      )
                    }}
                  >
                    {msg.content}
                  </ReactMarkdown>
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

          {/* Attachment Preview Bar */}
          {attachment && (
            <div className="nexus-coach-attachment-preview">
              <div className="nexus-coach-preview-info">
                {attachment.type === 'image' ? (
                  <img src={attachment.dataUrl} alt="Preview" className="nexus-coach-preview-thumb" />
                ) : (
                  <div className="nexus-coach-preview-doc-icon">
                    <FileText size={20} />
                  </div>
                )}
                <span className="nexus-coach-preview-name">{attachment.name}</span>
              </div>
              <button 
                type="button" 
                className="nexus-coach-preview-remove" 
                onClick={() => setAttachment(null)}
                title="Anhang entfernen"
              >
                <X size={16} />
              </button>
            </div>
          )}

          <form onSubmit={handleSend} className="nexus-coach-input-bar" style={{ alignItems: 'flex-end' }}>
            {/* Hidden File Input */}
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleFileSelect} 
              accept="image/*,.pdf,.txt,.md" 
              style={{ display: 'none' }} 
            />

            {/* Attachment Button */}
            <button 
              type="button" 
              className="nexus-coach-attach-btn" 
              onClick={() => fileInputRef.current?.click()} 
              title="Bild oder Dokument anhängen (oder Strg+V einfügen)"
            >
              <Paperclip size={18} />
            </button>

            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              placeholder={activeQuickAction 
                ? SALES_QUICK_ACTIONS.find(a => a.id === activeQuickAction)?.placeholder
                : (attachment 
                    ? t('nexus.coach.attachmentReady', 'Stelle eine Frage zu diesem Bild/Dokument oder drücke Enter...')
                    : t('nexus.coach.inputPlaceholder', 'Frage stellen, Screenshot per Strg+V einfügen oder Datei anhängen...'))}
              disabled={loading}
              rows={2}
              style={{ flex: 1, resize: 'vertical', minHeight: '44px', maxHeight: '150px', padding: '10px 14px', borderRadius: '8px', border: 'none', background: 'transparent', color: 'var(--text-primary)', fontSize: '0.95rem', outline: 'none' }}
            />
            <button type="submit" disabled={loading || (!message.trim() && !attachment)} style={{ marginBottom: '6px' }}>
              <ArrowUp size={20} />
            </button>
          </form>
        </footer>
      )}
      
      <UpgradeModal 
        isOpen={showUpgradeModal} 
        onClose={() => setShowUpgradeModal(false)} 
      />
    </div>
  )
}
