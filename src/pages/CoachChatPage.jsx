import React, { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { 
  Target, Send, ShieldAlert, Sparkles, Trash2, ArrowRight, ArrowUp, 
  Check, RefreshCw, Paperclip, X, FileText, TrendingUp, Users, 
  AlertCircle, MessageSquare, ArrowLeft, FileCheck, Image as ImageIcon, ExternalLink,
  Mic, MicOff, Volume2, VolumeX, Radio, Copy, ShieldCheck
} from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useLead } from '../context/LeadContext'
import { useLanguage } from '../i18n/translations'
import { callNexusAI } from '../lib/nexus-ai'
import { buildCoachContext, buildCoachSystemPrompt, getContextSummary } from '../lib/nexus-coach'
import { polishText } from '../lib/nexus-polish'
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

function cleanTextForSpeech(text) {
  if (!text) return ''
  return text
    .replace(/```[\s\S]*?```/g, ' Code-Block weggelassen. ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/##SEARCH##\([^)]+\)/g, '')
    .replace(/\|[^\n]+\|/g, '') // remove markdown tables
    .replace(/[#*_~`>-]/g, '')
    .replace(/https?:\/\/[^\s]+/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

export default function CoachChatPage({ embeddedLeadId, onClose }) {
  const { user } = useAuth()
  const { leadId: paramLeadId } = useParams()
  const leadId = embeddedLeadId || paramLeadId
  const navigate = useNavigate()
  
  // Hole alle Daten aus dem Context
  const { activeOffering, opportunities, triggers } = useLead()
  const { t, lang } = useLanguage()

  const MANDATE_QUICK_ACTIONS = [
    { id: 'vakuum', label: 'Vakuum- & Organ-Audit', icon: ShieldAlert, placeholder: 'Unternehmen & Vakanz beschreiben: Wer scheidet aus (CEO, CFO, CRO)? Droht sofortiger Stillstand oder geordnete Nachfolge?' },
    { id: 'pitch', label: 'C-Level Mandats-Pitch', icon: MessageSquare, placeholder: 'Welche Organposition soll besetzt werden? Adressat angeben (z. B. Aufsichtsrat, Gesellschafter, Beirat)...' },
    { id: 'governance', label: 'Not-Governance & Restrukturierung', icon: AlertCircle, placeholder: 'Restrukturierungsfall oder Krise beschreiben (z. B. StaRUG, CEO-Abberufung, Interim-Vorstand, Schutzschirm)...' },
    { id: 'budget', label: 'Tier 1 / Tier 2 Budget-Check', icon: TrendingUp, placeholder: 'Unternehmensgröße & gesuchte Organ-Rolle angeben für Tagessatz- und Budget-Band-Kalkulation...' },
    { id: 'dossier', label: 'Blind-Profil & Dealflow-Dossier', icon: FileCheck, placeholder: 'Lead-Daten für ein anonymisiertes Mandats-Dossier für Investoren und Vermittlungspartner eingeben...' },
  ]
  
  const [message, setMessage] = useState('')
  const [attachments, setAttachments] = useState([])
  const [isDragging, setIsDragging] = useState(false)
  const [chatHistory, setChatHistory] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [activeQuickAction, setActiveQuickAction] = useState(null)
  const [showUpgradeModal, setShowUpgradeModal] = useState(false)
  const fileInputRef = useRef(null)
  
  // Voice & Speech-to-Text & Polish States
  const [isListening, setIsListening] = useState(false)
  const isListeningRef = useRef(false)
  const baseMessageRef = useRef('')
  const accumulatedRef = useRef('')
  const [isPolishing, setIsPolishing] = useState(false)
  const [polishSuccess, setPolishSuccess] = useState(false)
  const [speakingIndex, setSpeakingIndex] = useState(null)
  const [copiedIndex, setCopiedIndex] = useState(null)
  const [autoVoice, setAutoVoice] = useState(() => {
    return localStorage.getItem('nexus_coach_autovoice') === 'true'
  })
  const recognitionRef = useRef(null)
  
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
      : 'NeXus DealCoach - Sales Intelligence'
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
            setAttachments(prev => {
              if (prev.length >= 5) return prev
              return [...prev, {
                file,
                dataUrl: event.target.result,
                name: file.name || `Screenshot_${new Date().toLocaleTimeString().replace(/:/g, '-')}_${prev.length + 1}.png`,
                type: 'image'
              }]
            })
          }
          reader.readAsDataURL(file)
        }
      }
    }
  }

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files || [])
    if (files.length === 0) return

    files.forEach(file => {
      if (file.type.startsWith('image/')) {
        const reader = new FileReader()
        reader.onload = (event) => {
          setAttachments(prev => {
            if (prev.length >= 5) return prev
            return [...prev, {
              file,
              dataUrl: event.target.result,
              name: file.name,
              type: 'image'
            }]
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
        const reader = new FileReader()
        reader.onload = (event) => {
          setAttachments(prev => {
            if (prev.length >= 5) return prev
            return [...prev, {
              file,
              dataUrl: event.target.result,
              name: file.name,
              type: 'doc'
            }]
          })
        }
        reader.readAsDataURL(file)
      }
    })
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
    const files = Array.from(e.dataTransfer?.files || [])
    if (files.length === 0) return

    files.forEach(file => {
      if (file.type.startsWith('image/')) {
        const reader = new FileReader()
        reader.onload = (event) => {
          setAttachments(prev => {
            if (prev.length >= 5) return prev
            return [...prev, {
              file,
              dataUrl: event.target.result,
              name: file.name,
              type: 'image'
            }]
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
    })
  }

  // Cleanup voice on unmount
  // Cleanup voice and recognition on unmount
  useEffect(() => {
    return () => {
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel()
      }
      stopListeningSession()
    }
  }, [])

  const toggleAutoVoice = () => {
    const next = !autoVoice
    setAutoVoice(next)
    localStorage.setItem('nexus_coach_autovoice', String(next))
    if (!next && window.speechSynthesis) {
      window.speechSynthesis.cancel()
      setSpeakingIndex(null)
    }
  }

  const stopListeningSession = () => {
    isListeningRef.current = false
    setIsListening(false)
    if (recognitionRef.current) {
      try {
        recognitionRef.current.onresult = null
        recognitionRef.current.onend = null
        recognitionRef.current.onerror = null
        recognitionRef.current.onstart = null
        recognitionRef.current.stop()
      } catch (e) {}
      try {
        recognitionRef.current.abort()
      } catch (e) {}
      recognitionRef.current = null
    }
  }

  const startListeningSession = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) {
      alert('Spracherkennung wird von deinem Browser nicht unterstützt. Bitte verwende Google Chrome, Microsoft Edge oder Safari.')
      return
    }

    if (window.speechSynthesis) {
      window.speechSynthesis.cancel()
      setSpeakingIndex(null)
    }

    stopListeningSession()
    isListeningRef.current = true
    setIsListening(true)

    const langMap = {
      de: 'de-DE',
      en: 'en-US',
      es: 'es-ES',
      fr: 'fr-FR',
      it: 'it-IT',
      nl: 'nl-NL',
      el: 'el-GR'
    }

    const createAndStartInstance = () => {
      if (!isListeningRef.current) return

      try {
        const rec = new SpeechRecognition()
        rec.continuous = true
        rec.interimResults = true
        rec.maxAlternatives = 1
        rec.lang = langMap[lang] || 'de-DE'

        rec.onstart = () => {
          if (isListeningRef.current) {
            setIsListening(true)
          }
        }

        rec.onresult = (event) => {
          if (!isListeningRef.current) return
          let interim = ''
          let finalChunk = ''
          for (let i = event.resultIndex; i < event.results.length; ++i) {
            const transcript = event.results[i][0]?.transcript || ''
            if (event.results[i].isFinal) {
              finalChunk += transcript
            } else {
              interim += transcript
            }
          }
          if (finalChunk.trim()) {
            accumulatedRef.current = accumulatedRef.current
              ? `${accumulatedRef.current} ${finalChunk.trim()}`
              : finalChunk.trim()
          }
          const full = [baseMessageRef.current, accumulatedRef.current, interim.trim()]
            .filter(Boolean)
            .join(' ')
            .replace(/\s+/g, ' ')
          setMessage(full)
        }

        rec.onerror = (e) => {
          console.warn('[CoachChat] Speech recognition error event:', e.error)
          if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
            isListeningRef.current = false
            setIsListening(false)
            alert('Mikrofonzugriff wurde im Browser verweigert. Bitte aktiviere das Mikrofon in deinen Browsereinstellungen.')
          } else if (e.error === 'audio-capture') {
            isListeningRef.current = false
            setIsListening(false)
            alert('Kein Mikrofon gefunden oder das Mikrofon wird von einem anderen Programm belegt.')
          }
        }

        rec.onend = () => {
          if (isListeningRef.current) {
            try {
              rec.onend = null
              rec.onerror = null
            } catch (e) {}
            setTimeout(() => {
              if (isListeningRef.current) {
                createAndStartInstance()
              }
            }, 150)
          } else {
            setIsListening(false)
          }
        }

        recognitionRef.current = rec
        rec.start()
      } catch (err) {
        console.warn('[CoachChat] Error starting fresh recognition instance:', err)
        if (isListeningRef.current) {
          setTimeout(() => {
            if (isListeningRef.current) createAndStartInstance()
          }, 300)
        }
      }
    }

    createAndStartInstance()
  }

  const toggleListening = () => {
    if (isListening) {
      stopListeningSession()
    } else {
      baseMessageRef.current = message.trim()
      accumulatedRef.current = ''
      startListeningSession()
    }
  }

  const handlePolishText = async () => {
    if (!message.trim() || isPolishing) return
    
    // If currently dictating, stop voice first
    if (isListening) {
      stopListeningSession()
    }

    setIsPolishing(true)
    try {
      const polished = await polishText(message, lang)
      if (polished && polished.trim()) {
        setMessage(polished.trim())
        setPolishSuccess(true)
        setTimeout(() => setPolishSuccess(false), 3000)
      }
    } catch (err) {
      console.error('[CoachChat] Polish error:', err)
    } finally {
      setIsPolishing(false)
    }
  }

  const speakText = (text, index) => {
    if (!window.speechSynthesis) {
      alert('Sprachausgabe wird in diesem Browser nicht unterstützt.')
      return
    }

    if (speakingIndex === index) {
      window.speechSynthesis.cancel()
      setSpeakingIndex(null)
      return
    }

    window.speechSynthesis.cancel()
    const clean = cleanTextForSpeech(text)
    if (!clean) return

    const utterance = new SpeechSynthesisUtterance(clean)
    const langMap = {
      de: 'de-DE',
      en: 'en-US',
      es: 'es-ES',
      fr: 'fr-FR',
      it: 'it-IT',
      nl: 'nl-NL',
      el: 'el-GR'
    }
    utterance.lang = langMap[lang] || 'de-DE'
    utterance.rate = 1.05
    utterance.pitch = 1.0

    const voices = window.speechSynthesis.getVoices()
    const voice = voices.find(v => v.lang.startsWith(langMap[lang] || 'de') && (v.name.includes('Google') || v.name.includes('Natural') || v.name.includes('Neural') || v.default)) ||
                  voices.find(v => v.lang.startsWith(langMap[lang] || 'de'))
    if (voice) utterance.voice = voice

    utterance.onend = () => {
      setSpeakingIndex(null)
    }
    utterance.onerror = () => {
      setSpeakingIndex(null)
    }

    setSpeakingIndex(index)
    window.speechSynthesis.speak(utterance)
  }

  const handleCopyText = async (text, index) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedIndex(index)
      setTimeout(() => {
        setCopiedIndex(prev => (prev === index ? null : prev))
      }, 2000)
    } catch (err) {
      console.error('Failed to copy text:', err)
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if ((message.trim() || attachments.length > 0) && !loading) {
        handleSend(e)
      }
    }
  }

  const handleSend = async (e) => {
    if (e) e.preventDefault()
    if ((!message.trim() && attachments.length === 0) || loading) return

    if (isListening) {
      stopListeningSession()
    }

    setError('')
    const currentAttachments = [...attachments]
    const currentMsgText = message.trim() || (currentAttachments.length > 0 ? (lang === 'de' ? `Bitte analysiere diese ${currentAttachments.length} angehängten Bilder / Dokumente / Video-Frames.` : `Please analyze these ${currentAttachments.length} attached images / documents.`) : '')
    
    const userMsg = { 
      role: 'user', 
      content: currentMsgText,
      attachments: currentAttachments,
      attachment: currentAttachments[0]?.dataUrl || null,
      fileName: currentAttachments[0]?.name || null,
      attachmentType: currentAttachments[0]?.type || null
    }

    setChatHistory(prev => [...prev, userMsg])
    setMessage('')
    setAttachments([])
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

      const imageUrls = currentAttachments.filter(a => a.type === 'image').map(a => a.dataUrl)

      const response = await callNexusAI({
        mode: 'chat',
        message: currentMsgText,
        context: {
          system: systemContext,
          history: recentHistory,
          quickAction: activeQuickAction,
          imageUrls: imageUrls.length > 0 ? imageUrls : null,
          imageUrl: imageUrls[0] || null
        },
        imageUrls: imageUrls.length > 0 ? imageUrls : null,
        imageUrl: imageUrls[0] || null,
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
        setChatHistory(prev => {
          const next = [...prev, { role: 'assistant', content: textContent }]
          if (autoVoice) {
            setTimeout(() => {
              speakText(textContent, next.length - 1)
            }, 100)
          }
          return next
        })
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
        if (currentAttachments.length > 0) setAttachments(currentAttachments)
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
          <div className="nexus-coach-brand">
            <div className="nexus-coach-icon">
              <ShieldCheck size={22} />
            </div>
            <div className="nexus-coach-info">
              <h1>{currentLead ? `DealCoach: ${currentLead.nexus_companies?.name || 'Mandatsfall'}` : 'DealCoach'}</h1>
              <span className="nexus-coach-subtitle">
                {currentLead ? `Mandats- & Governance-Intelligence für ${currentLead.nexus_companies?.name || 'Mandatsfall'}` : 'Revisions- & Sparringspartner für Executive Mandate (Stufe 2)'}
              </span>
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {chatHistory.length > 0 && (
            <button 
              className="nexus-coach-clear-btn" 
              onClick={() => {
                if (window.confirm('Gesprächsverlauf löschen?')) {
                  if (window.speechSynthesis) window.speechSynthesis.cancel()
                  setSpeakingIndex(null)
                  setChatHistory([])
                }
              }}
              title="Verlauf löschen"
            >
              <Trash2 size={16} />
            </button>
          )}

          {onClose && (
            <button
              className="nexus-coach-clear-btn"
              onClick={onClose}
              title="Panel schließen"
            >
              <X size={18} />
            </button>
          )}
        </div>
      </header>

      <main className="nexus-coach-main">
        {chatHistory.length === 0 ? (
          <div className="nexus-coach-welcome">
            <div className="nexus-coach-welcome-icon">
              <ShieldCheck size={48} />
            </div>
            <h2>{currentLead ? `DealCoach: ${currentLead.nexus_companies?.name || 'Mandat'}` : 'Willkommen beim DealCoach'}</h2>
            <p>{currentLead 
              ? `Ich analysiere das Mandat für ${currentLead.nexus_companies?.name || 'diesen Fall'}. Wähle ein Governance-Audit, erstelle einen diskreten C-Level Pitch oder prüfe den Handlungsdruck.`
              : 'Ich bin dein Sparringspartner für C-Level Organvakanzen, Interim-Mandate (CEO/CFO/CRO), Ad-hoc-Analysen und Governance-Strategien. Analysiere Mandatsanlässe, berechne Honorarbänder oder strukturiere diskrete Vorstands- & Aufsichtsratsansprachen.'
            }</p>
            
            {currentLead && (
              <div className="nexus-coach-context-hint" style={{ 
                padding: '12px 18px', 
                background: 'rgba(56, 189, 248, 0.08)', 
                borderRadius: '8px', 
                marginBottom: '20px',
                fontSize: '0.86rem',
                color: '#e2e8f0',
                border: '1px solid rgba(56, 189, 248, 0.25)',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                flexWrap: 'wrap'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <strong style={{ color: '#38bdf8' }}>Unternehmen:</strong> {currentLead.nexus_companies?.name || currentLead.title || 'Mandat'}
                </div>
                {currentLead.priority && (
                  <span style={{
                    background: currentLead.priority.includes('TIER_1') ? 'rgba(168, 85, 247, 0.2)' : 'rgba(59, 130, 246, 0.2)',
                    color: currentLead.priority.includes('TIER_1') ? '#c084fc' : '#60a5fa',
                    padding: '2px 8px',
                    borderRadius: '4px',
                    fontWeight: 700,
                    fontSize: '0.75rem',
                    border: `1px solid ${currentLead.priority.includes('TIER_1') ? 'rgba(168, 85, 247, 0.4)' : 'rgba(59, 130, 246, 0.4)'}`
                  }}>
                    {currentLead.priority.includes('TIER_1') ? '👑 TIER 1 TOP' : '🏢 TIER 2 MID'}
                  </span>
                )}
                {leadTriggers.length > 0 && (
                  <span style={{ color: '#94a3b8' }}>
                    · {leadTriggers.length} Ad-hoc-Signal(e)
                  </span>
                )}
              </div>
            )}
            
            <div className="nexus-coach-quick-actions">
              {MANDATE_QUICK_ACTIONS.map(action => (
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
                  {/* Multi-Attachments Rendering */}
                  {msg.attachments && msg.attachments.length > 0 ? (
                    <div className="nexus-msg-attachments-grid" style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '8px' }}>
                      {msg.attachments.map((att, attIdx) => (
                        att.type === 'image' ? (
                          <div key={attIdx} className="nexus-msg-attachment">
                            <img src={att.dataUrl} alt={att.name || `Attachment ${attIdx + 1}`} />
                          </div>
                        ) : (
                          <div key={attIdx} className="nexus-coach-preview-doc-icon" style={{ borderRadius: '6px', padding: '6px' }}>
                            <FileText size={20} />
                            <span style={{ fontSize: '0.75rem', marginLeft: '4px' }}>{att.name}</span>
                          </div>
                        )
                      ))}
                    </div>
                  ) : msg.attachment ? (
                    <div className="nexus-msg-attachment">
                      <img src={msg.attachment} alt={msg.fileName || 'Attachment'} />
                    </div>
                  ) : null}

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
                  
                  {msg.role === 'assistant' && (
                    <div className="nexus-msg-footer-bar">
                      <button
                        type="button"
                        className={`nexus-msg-action-btn ${copiedIndex === index ? 'copied' : ''}`}
                        onClick={() => handleCopyText(msg.content, index)}
                        title="Text / Entwurf in Zwischenablage kopieren"
                      >
                        {copiedIndex === index ? <Check size={14} className="nexus-copy-check" /> : <Copy size={14} />}
                        <span>{copiedIndex === index ? "Kopiert!" : "Kopieren"}</span>
                      </button>

                      <button
                        type="button"
                        className={`nexus-msg-action-btn ${speakingIndex === index ? 'speaking' : ''}`}
                        onClick={() => speakText(msg.content, index)}
                        title={speakingIndex === index ? "Sprachausgabe stoppen" : "Antwort vorlesen"}
                      >
                        {speakingIndex === index ? <VolumeX size={14} /> : <Volume2 size={14} />}
                        <span>{speakingIndex === index ? "Stopp" : "Vorlesen"}</span>
                        {speakingIndex === index && <span className="nexus-audio-bars"><span></span><span></span><span></span></span>}
                      </button>
                    </div>
                  )}
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
          {/* Multiple Attachments Preview Bar */}
          {attachments.length > 0 && (
            <div className="nexus-coach-attachments-list" style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '8px' }}>
              {attachments.map((att, attIdx) => (
                <div key={attIdx} className="nexus-coach-attachment-preview" style={{ marginBottom: 0 }}>
                  <div className="nexus-coach-preview-info">
                    {att.type === 'image' ? (
                      <img src={att.dataUrl} alt="Preview" className="nexus-coach-preview-thumb" />
                    ) : (
                      <div className="nexus-coach-preview-doc-icon">
                        <FileText size={20} />
                      </div>
                    )}
                    <span className="nexus-coach-preview-name">{att.name}</span>
                  </div>
                  <button 
                    type="button" 
                    className="nexus-coach-preview-remove" 
                    onClick={() => setAttachments(prev => prev.filter((_, i) => i !== attIdx))}
                    title="Anhang entfernen"
                  >
                    <X size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}

          <form onSubmit={handleSend} className="nexus-coach-input-bar" style={{ alignItems: 'flex-end' }}>
            {/* Hidden File Input */}
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleFileSelect} 
              accept="image/*,.pdf,.txt,.md" 
              multiple
              style={{ display: 'none' }} 
            />

            {/* Attachment Button */}
            <button 
              type="button" 
              className="nexus-coach-attach-btn" 
              onClick={() => fileInputRef.current?.click()} 
              title="Ad-hoc-Meldungen, Beschlüsse oder Dokumente anhängen (Bilder/PDF per Strg+V)"
            >
              <Paperclip size={18} />
            </button>

            {/* Microphone / Speech-to-Text Button */}
            <button 
              type="button" 
              className={`nexus-coach-mic-btn ${isListening ? 'listening' : ''}`} 
              onClick={toggleListening} 
              title={isListening ? "Spracherkennung beenden (Höre zu...)" : "Spracheingabe starten (Mikrofon)"}
            >
              {isListening ? <MicOff size={18} /> : <Mic size={18} />}
            </button>

            {/* Audio Voice Output (TTS) Toggle */}
            <button 
              type="button" 
              className="nexus-coach-mic-btn"
              onClick={toggleAutoVoice} 
              title={autoVoice ? "Sprachausgabe: Aktiv (Klicken zum Ausschalten)" : "Sprachausgabe: Aus (Klicken zum Einschalten)"}
              style={{ color: autoVoice ? 'var(--accent-blue, #0284c7)' : 'var(--text-muted, #64748b)' }}
            >
              {autoVoice ? <Volume2 size={18} /> : <VolumeX size={18} />}
            </button>

            {/* AI Text Polish & Spellcheck Button */}
            <button 
              type="button" 
              className={`nexus-coach-polish-btn ${isPolishing ? 'polishing' : ''} ${polishSuccess ? 'success' : ''}`} 
              onClick={handlePolishText} 
              disabled={isPolishing || !message.trim()}
              title={polishSuccess ? "Text & Rechtschreibung korrigiert!" : "Rechtschreibung & Grammatik mit KI prüfen (Fehler beheben)"}
            >
              {isPolishing ? (
                <RefreshCw size={18} className="nexus-spin" />
              ) : polishSuccess ? (
                <Check size={18} color="#10b981" />
              ) : (
                <Sparkles size={18} />
              )}
            </button>

            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              placeholder={isListening 
                ? "Höre zu... sprich jetzt frei ins Mikrofon..."
                : (activeQuickAction 
                    ? MANDATE_QUICK_ACTIONS.find(a => a.id === activeQuickAction)?.placeholder
                    : (attachments.length > 0 
                        ? `${attachments.length} Anhang/Dokument(e) bereit. Stelle eine Mandatsfrage dazu oder drücke Enter...`
                        : 'Mandatsfrage stellen, Ad-hoc-Meldung einfügen, sprechen oder Dokument anhängen...'))}
              disabled={loading}
              rows={2}
              style={{ flex: 1, resize: 'vertical', minHeight: '44px', maxHeight: '150px', padding: '10px 14px', borderRadius: '8px', border: 'none', background: 'transparent', color: 'var(--text-primary)', fontSize: '0.95rem', outline: 'none' }}
            />
            <button type="submit" disabled={loading || (!message.trim() && attachments.length === 0)} style={{ marginBottom: '6px' }}>
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
