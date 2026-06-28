import { useState, useEffect, useRef } from 'react'
import { useLanguage } from '../App'
import { useAuth } from '../App'
import { supabase } from '../lib/supabase'
import './AIChatPage.css'

export default function AIChatPage() {
  const { t } = useLanguage()
  const { user } = useAuth()
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [profile, setProfile] = useState(null)
  const [showProfile, setShowProfile] = useState(false)
  const [consent, setConsent] = useState(false)
  const messagesEndRef = useRef(null)

  useEffect(() => {
    loadProfile()
    loadConversations()
    checkConsent()
  }, [user])

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const checkConsent = async () => {
    const { data } = await supabase
      .from('ai_settings')
      .select('data_consent')
      .eq('user_id', user.id)
      .single()
    
    if (data) {
      setConsent(data.data_consent)
    }
  }

  const loadProfile = async () => {
    const { data } = await supabase
      .from('ai_profiles')
      .select('*')
      .eq('user_id', user.id)
      .single()
    
    if (data) {
      setProfile(data)
    }
  }

  const loadConversations = async () => {
    const { data } = await supabase
      .from('ai_conversations')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true })
      .limit(50)
    
    if (data) {
      setMessages(data.map(m => ({
        role: m.message.startsWith('USER:') ? 'user' : 'assistant',
        content: m.message.startsWith('USER:') ? m.message.replace('USER:', '') : m.response
      })))
    }
  }

  const updateProfile = async (newData) => {
    if (!consent) return

    const { data: existing } = await supabase
      .from('ai_profiles')
      .select('id')
      .eq('user_id', user.id)
      .single()

    if (existing) {
      await supabase
        .from('ai_profiles')
        .update({ 
          ...profile,
          ...newData,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', user.id)
    } else {
      await supabase
        .from('ai_profiles')
        .insert({
          user_id: user.id,
          ...newData
        })
    }
  }

  const analyzeAndExtractProfile = (userMessage, aiResponse) => {
    const lowerMsg = userMessage.toLowerCase()
    
    const updates = {}

    if (lowerMsg.includes('kind') || lowerMsg.includes('kinder') || lowerMsg.includes('child') || lowerMsg.includes('kids')) {
      const ageMatch = userMessage.match(/(\d+)\s*(Jahr|jahre|years|alt)/i)
      if (ageMatch) {
        updates.family_info = {
          ...profile?.family_info,
          children: [...(profile?.family_info?.children || []), { age: parseInt(ageMatch[1]) }]
        }
      } else {
        updates.family_info = {
          ...profile?.family_info,
          has_children: true
        }
      }
    }

    if (lowerMsg.includes('kochen') || lowerMsg.includes('rezept') || lowerMsg.includes('essen') || lowerMsg.includes('küche')) {
      updates.preferences = {
        ...profile?.preferences,
        cooking: true,
        interested_in_recipes: true
      }
    }

    if (lowerMsg.includes('auto') || lowerMsg.includes('verbrenner') || lowerMsg.includes('elektro') || lowerMsg.includes('wagen')) {
      updates.occupation = {
        ...profile?.occupation,
        interested_in_car: true,
        car_type: lowerMsg.includes('elektro') ? 'electric' : lowerMsg.includes('verbrenner') ? 'combustion' : 'unknown'
      }
    }

    if (lowerMsg.includes('arbeit') || lowerMsg.includes('job') || lowerMsg.includes('beruf') || lowerMsg.includes('firma')) {
      updates.occupation = {
        ...profile?.occupation,
        interested_in_job: true
      }
    }

    if (lowerMsg.includes('wohnung') || lowerMsg.includes('zimmer') || lowerMsg.includes('wg') || lowerMsg.includes('ziehen')) {
      updates.location = {
        ...profile?.location,
        looking_for_housing: true
      }
    }

    if (lowerMsg.includes('kurs') || lowerMsg.includes('lernen') || lowerMsg.includes('bildung') || lowerMsg.includes('sprache')) {
      updates.preferences = {
        ...profile?.preferences,
        interested_in_courses: true
      }
    }

    if (Object.keys(updates).length > 0) {
      updateProfile(updates)
    }
  }

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return

    const userMessage = input.trim()
    setInput('')
    setMessages(prev => [...prev, { role: 'user', content: userMessage }])
    setIsLoading(true)

    try {
      const profileContext = profile ? 
        `User-Profil: ${JSON.stringify(profile)}. ` : ''
      
      const systemPrompt = `Du bist Happiness AI, ein freundlicher europäischer Assistent. 
Du hilfst bei Alltagsproblemen, gibst Ratschläge und bist persönlich.
Du sprichst die Sprache des Users und berücksichtigst sein Profil.
Antworte kurz, freundlich und hilfsbereit.
${profileContext}
Sprich ${t('ai.systemLanguage') || 'Deutsch'}.`

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

  return (
    <div className="ai-chat-page">
      <div className="ai-header">
        <h1>🤖 Happiness AI</h1>
        <div className="ai-header-buttons">
          <button 
            className="btn btn-outline"
            onClick={() => setShowProfile(!showProfile)}
          >
            👤 {t('ai.profile')}
          </button>
          <button 
            className="btn btn-outline"
            onClick={exportData}
          >
            📥 {t('ai.export')}
          </button>
          <button 
            className="btn btn-danger"
            onClick={deleteAllData}
          >
            🗑️ {t('ai.delete')}
          </button>
        </div>
      </div>

      {!consent && (
        <div className="consent-banner">
          <p>🔒 {t('ai.consentMessage')}</p>
          <button className="btn btn-primary" onClick={toggleConsent}>
            {t('ai.acceptConsent')}
          </button>
        </div>
      )}

      {showProfile && (
        <div className="profile-panel">
          <h3>👤 {t('ai.yourProfile')}</h3>
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

          <div className="consent-toggle">
            <label>
              <input
                type="checkbox"
                checked={consent}
                onChange={toggleConsent}
              />
              {t('ai.dataConsent')}
            </label>
          </div>
        </div>
      )}

      <div className="chat-container">
        <div className="messages">
          {messages.length === 0 && (
            <div className="welcome-message">
              <h2>👋 {t('ai.welcome')}</h2>
              <p>{t('ai.welcomeDesc')}</p>
              <div className="suggestion-chips">
                <button onClick={() => setInput('Was soll ich heute kochen?')}>
                  🍳 Was soll ich kochen?
                </button>
                <button onClick={() => setInput('Soll ich ein Elektroauto kaufen?')}>
                  🚗 Elektroauto ja/nein?
                </button>
                <button onClick={() => setInput('Meine Kinder sind picky eater')}>
                  👨‍👩‍👧 Kinder essen nicht gerne
                </button>
                <button onClick={() => setInput('Ich such einen neuen Job')}>
                  💼 Jobwechsel-Tipps
                </button>
              </div>
            </div>
          )}
          
          {messages.map((msg, index) => (
            <div key={index} className={`message ${msg.role}`}>
              <div className="message-avatar">
                {msg.role === 'user' ? '👤' : '🤖'}
              </div>
              <div className="message-content">
                {msg.content}
              </div>
            </div>
          ))}
          
          {isLoading && (
            <div className="message assistant">
              <div className="message-avatar">🤖</div>
              <div className="message-content loading">
                <span className="dot"></span>
                <span className="dot"></span>
                <span className="dot"></span>
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>

        <div className="input-container">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={t('ai.placeholder')}
            rows="1"
          />
          <button 
            className="send-button"
            onClick={sendMessage}
            disabled={!input.trim() || isLoading}
          >
            ➤
          </button>
        </div>
      </div>

      <div className="ai-footer">
        <p>🇪🇺 {t('ai.footer')}</p>
      </div>
    </div>
  )
}