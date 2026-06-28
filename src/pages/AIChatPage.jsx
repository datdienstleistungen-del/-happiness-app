import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { useLanguage } from '../i18n/translations'
import './AIChatPage.css'

export default function AIChatPage() {
  const { user } = useAuth()
  const { t } = useLanguage()
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [consent, setConsent] = useState(false)
  const [profile, setProfile] = useState(null)
  const [showProfile, setShowProfile] = useState(false)
  const messagesEndRef = useRef(null)

  useEffect(() => {
    loadUserData()
  }, [user])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const loadUserData = async () => {
    const { data: settings } = await supabase
      .from('ai_settings')
      .select('data_consent')
      .eq('user_id', user.id)
      .single()

    if (settings) setConsent(settings.data_consent)

    const { data: profileData } = await supabase
      .from('ai_profiles')
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (profileData) setProfile(profileData)

    const { data: history } = await supabase
      .from('ai_conversations')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true })

    if (history) {
      const loadedMessages = []
      history.forEach(conv => {
        loadedMessages.push({ role: 'user', content: conv.message.replace('USER:', '') })
        loadedMessages.push({ role: 'assistant', content: conv.response })
      })
      setMessages(loadedMessages)
    }
  }

  const analyzeAndExtractProfile = async (userMessage, aiResponse) => {
    const lowerMsg = userMessage.toLowerCase()

    const updates = {}

    if (lowerMsg.includes('mein name') || lowerMsg.includes('ich heiße')) {
      const nameMatch = userMessage.match(/(?:mein name ist|ich heiße) (\w+)/i)
      if (nameMatch) updates.display_name = nameMatch[1]
    }

    if (lowerMsg.includes('kinder') || lowerMsg.includes('sohn') || lowerMsg.includes('tochter')) {
      updates.family_info = { ...profile?.family_info, has_children: true }
    }

    if (lowerMsg.includes('beruf') || lowerMsg.includes('job') || lowerMsg.includes('arbeit')) {
      updates.occupation = { ...profile?.occupation, mentioned_work: true }
    }

    if (lowerMsg.includes('wohnung') || lowerMsg.includes('zimmer') || lowerMsg.includes('haus')) {
      updates.location = { ...profile?.location, housing_interest: true }
    }

    if (Object.keys(updates).length > 0) {
      const { data: existing } = await supabase
        .from('ai_profiles')
        .select('id')
        .eq('user_id', user.id)
        .single()

      if (existing) {
        await supabase
          .from('ai_profiles')
          .update(updates)
          .eq('user_id', user.id)
      } else {
        await supabase
          .from('ai_profiles')
          .insert({ user_id: user.id, ...updates })
      }
    }
  }

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return

    const userMessage = input.trim()
    setInput('')
    setMessages(prev => [...prev, { role: 'user', content: userMessage }])
    setIsLoading(true)

    const systemPrompt = `Du bist der Happiness AI Assistent — freundlich, hilfsbereut und europäisch. 
Sprich auf Deutsch. Halte Antworten kurz (3-5 Sätze max). 
Du hilfst bei: Kochen, Familie, Auto, Beruf, Wohnung, Bildung.
Antworte NUR auf die Frage des Users. Kein Smalltalk.`

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage,
          systemPrompt,
          userId: user.id
        })
      })

      if (!response.ok) {
        throw new Error('API Fehler')
      }

      const data = await response.json()
      const aiResponse = data.response

      setMessages(prev => [...prev, { role: 'assistant', content: aiResponse }])

      await supabase.from('ai_conversations').insert({
        user_id: user.id,
        message: `USER:${userMessage}`,
        response: aiResponse,
        context: { profile }
      })

      analyzeAndExtractProfile(userMessage, aiResponse)

    } catch (error) {
      console.error('AI Error:', error)
      
      const fallbackResponse = generateFallbackResponse(userMessage)
      setMessages(prev => [...prev, { role: 'assistant', content: fallbackResponse }])
    } finally {
      setIsLoading(false)
    }
  }

  const generateFallbackResponse = (message) => {
    const lower = message.toLowerCase()
    
    if (lower.includes('kochen') || lower.includes('essen') || lower.includes('rezept')) {
      return "Hier sind ein paar Ideen für heute:\n\n🍝 Pasta mit frischer Tomatensoße\n🥗 Griechischer Salat mit Feta\n🍛 Einfaches Curry mit Gemüse\n\nSoll ich ein genaues Rezept geben?"
    }
    
    if (lower.includes('auto') || lower.includes('verbrenner')) {
      return "Die Frage Verbrenner vs. Elektro ist aktuell!\n\n🔋 Elektro: Günstiger im Betrieb, Umweltfreundlich\n⛽ Verbrenner: Höhere Reichweite, günstiger in der Anschaffung\n\nWelche Faktoren sind dir wichtig?"
    }
    
    if (lower.includes('kind') || lower.includes('kinder')) {
      return "Kinder verstehen ist manchmal schwierig! 🤔\n\nErzähl mir mehr:\n- Wie alt sind sie?\n- Was genau ist das Problem?\n\nDann kann ich dir gezielt helfen!"
    }
    
    if (lower.includes('hallo') || lower.includes('hi') || lower.includes('hey')) {
      return "Hallo! 👋 Ich bin dein Happiness AI Assistent.\n\nIch kann dir helfen bei:\n🍳 Kochideen\n🚗 Auto-Fragen\n👨‍👩‍👧 Familienprobleme\n💼 Beruf\n🏠 Wohnung\n\nWas beschäftigt dich heute?"
    }
    
    return "Das ist eine interessante Frage! 🤔\n\nErzähl mir mehr Details, damit ich dir besser helfen kann.\n\nIch kann dir helfen bei:\n- Kochen & Rezepte\n- Auto & Mobilität\n- Familie & Beziehungen\n- Arbeit & Beruf\n- Wohnungssuche\n- Bildung & Kurse"
  }

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const exportData = async () => {
    const { data: profileData } = await supabase
      .from('ai_profiles')
      .select('*')
      .eq('user_id', user.id)
      .single()

    const { data: conversations } = await supabase
      .from('ai_conversations')
      .select('*')
      .eq('user_id', user.id)

    const exportObj = {
      profile: profileData,
      conversations: conversations,
      exportDate: new Date().toISOString()
    }

    const blob = new Blob([JSON.stringify(exportObj, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'happiness-ai-data.json'
    a.click()
    URL.revokeObjectURL(url)
  }

  const deleteAllData = async () => {
    if (!confirm('Alle AI-Daten wirklich löschen? Dies kann nicht rückgängig gemacht werden.')) return

    await supabase.from('ai_conversations').delete().eq('user_id', user.id)
    await supabase.from('ai_profiles').delete().eq('user_id', user.id)
    await supabase.from('ai_settings').delete().eq('user_id', user.id)

    setMessages([])
    setProfile(null)
    setConsent(false)
  }

  const toggleConsent = async () => {
    const newConsent = !consent
    setConsent(newConsent)

    const { data: existing } = await supabase
      .from('ai_settings')
      .select('id')
      .eq('user_id', user.id)
      .single()

    if (existing) {
      await supabase
        .from('ai_settings')
        .update({ data_consent: newConsent })
        .eq('user_id', user.id)
    } else {
      await supabase
        .from('ai_settings')
        .insert({
          user_id: user.id,
          data_consent: newConsent
        })
    }
  }

  const hasMessages = messages.length > 0

  return (
    <div className="ai-chat-page">
      <div className="ai-sidebar-panel">
        <div className="ai-sidebar-header">
          <span className="ai-logo">🧠</span>
          <span>Happiness AI</span>
        </div>

        <button
          className="new-chat-btn"
          onClick={() => setMessages([])}
        >
          ✨ {t('ai.newChat') || 'Neuer Chat'}
        </button>

        <div className="ai-sidebar-divider" />

        <button className="ai-sidebar-btn" onClick={() => setShowProfile(!showProfile)}>
          👤 {t('ai.profile')}
        </button>
        <button className="ai-sidebar-btn" onClick={exportData}>
          📥 {t('ai.export')}
        </button>
        <button className="ai-sidebar-btn danger" onClick={deleteAllData}>
          🗑️ {t('ai.delete')}
        </button>

        <div className="ai-sidebar-footer">
          <div className="ai-status">
            <span className="ai-status-dot" />
            {consent ? 'Profil aktiv' : 'Profil inaktiv'}
          </div>
          <label className="consent-switch">
            <input
              type="checkbox"
              checked={consent}
              onChange={toggleConsent}
            />
            <span className="consent-label">{t('ai.dataConsent')}</span>
          </label>
          <p className="ai-eu-badge">🇪🇺 {t('ai.footer')}</p>
        </div>
      </div>

      <div className="ai-main">
        {showProfile && (
          <div className="profile-panel">
            <div className="profile-panel-header">
              <h3>👤 {t('ai.yourProfile')}</h3>
              <button className="close-btn" onClick={() => setShowProfile(false)}>✕</button>
            </div>
            <p className="profile-info">{t('ai.profileInfo')}</p>
            
            <div className="profile-section">
              <h4>👨‍👩‍👧 {t('ai.family')}</h4>
              <pre>{JSON.stringify(profile?.family_info || {}, null, 2)}</pre>
            </div>
            
            <div className="profile-section">
              <h4>❤️ {t('ai.preferences')}</h4>
              <pre>{JSON.stringify(profile?.preferences || {}, null, 2)}</pre>
            </div>
            
            <div className="profile-section">
              <h4>📍 {t('ai.location')}</h4>
              <pre>{JSON.stringify(profile?.location || {}, null, 2)}</pre>
            </div>
            
            <div className="profile-section">
              <h4>💼 {t('ai.occupation')}</h4>
              <pre>{JSON.stringify(profile?.occupation || {}, null, 2)}</pre>
            </div>
          </div>
        )}

        {!hasMessages ? (
          <div className="ai-center">
            <div className="ai-welcome">
              <div className="ai-welcome-icon">🧠</div>
              <h1>Happiness AI</h1>
              <p>{t('ai.welcomeDesc') || 'Was kann ich heute für dich tun?'}</p>

              <div className="suggestion-chips">
                <button onClick={() => setInput('Was soll ich heute kochen?')}>
                  <span className="chip-icon">🍳</span>
                  Was kochen?
                </button>
                <button onClick={() => setInput('Soll ich ein Elektroauto kaufen?')}>
                  <span className="chip-icon">🚗</span>
                  Elektroauto?
                </button>
                <button onClick={() => setInput('Meine Kinder sind picky eater')}>
                  <span className="chip-icon">👨‍👩‍👧</span>
                  Kinder essen nicht
                </button>
                <button onClick={() => setInput('Ich such einen neuen Job')}>
                  <span className="chip-icon">💼</span>
                  Jobwechsel-Tipps
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="ai-messages">
            {messages.map((msg, index) => (
              <div key={index} className={`message-row ${msg.role}`}>
                {msg.role === 'assistant' && (
                  <div className="msg-avatar assistant-avatar">🧠</div>
                )}
                <div className={`message-bubble ${msg.role}`}>
                  {msg.content}
                </div>
                {msg.role === 'user' && (
                  <div className="msg-avatar user-avatar">
                    {user?.email?.[0]?.toUpperCase() || 'U'}
                  </div>
                )}
              </div>
            ))}

            {isLoading && (
              <div className="message-row assistant">
                <div className="msg-avatar assistant-avatar">🧠</div>
                <div className="message-bubble assistant loading-bubble">
                  <span className="typing-dot"></span>
                  <span className="typing-dot"></span>
                  <span className="typing-dot"></span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        )}

        <div className="ai-input-bar">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyPress}
            placeholder={t('ai.placeholder')}
            rows="1"
          />
          <button
            className="send-btn"
            onClick={sendMessage}
            disabled={!input.trim() || isLoading}
          >
            ➤
          </button>
        </div>
      </div>
    </div>
  )
}