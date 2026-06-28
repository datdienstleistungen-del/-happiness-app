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
  const [questionCount, setQuestionCount] = useState(0)
  const [showPaywall, setShowPaywall] = useState(false)
  const [isPremium, setIsPremium] = useState(false)
  const messagesEndRef = useRef(null)
  const FREE_QUESTIONS = 20

  useEffect(() => {
    loadUserData()
  }, [user])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const loadUserData = async () => {
    const { data: settings } = await supabase
      .from('ai_settings')
      .select('data_consent, is_premium')
      .eq('user_id', user.id)
      .single()

    if (settings) {
      setConsent(settings.data_consent)
      if (settings.is_premium) {
        setIsPremium(true)
        setShowPaywall(false)
      }
    }

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
      setQuestionCount(history.length)
      if (history.length >= FREE_QUESTIONS) {
        setShowPaywall(true)
      }
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
    if (showPaywall && !isPremium) return

    const userMessage = input.trim()
    setInput('')
    setMessages(prev => [...prev, { role: 'user', content: userMessage }])
    setIsLoading(true)

    const systemPrompt = `Du bist der Happiness AI — ein freundlicher Assistent für alle Altersgruppen.

SPRACHE: Deutsch. Kurze Sätze. Emojis sparsam.

STIL: Neutral, hilfsbereut, professionell. Wie ein Assistent, nicht wie ein Freund.

WAS DU DARFST BEANTWORTEN:
- Schule, Mathe, Naturwissenschaften
- Musik, Filme, Spiele, Sport
- Kochen, Rezepte
- Beruf, Wohnung, Alltag
- Kreativität, Ideen
- Allgemeinwissen

WICHTIG: NIEMALS nach persönlichen Daten fragen. Kein "Was denkst du?" bei sensiblen Themen. Keine persönlichen Fragen an Minderjährige.

THEMEN — DIREKT VERWEISEN:
- Sexuelle Themen → "Das ist ein Thema, das du mit deinen Eltern oder einem Erwachsenen besprechen solltest."
- Gewalt → "Bei Gewalt solltest du mit einem Erwachsenen sprechen."
- Drogen/Alkohol → "Das ist ein Thema für Erwachsene. Sprich mit deinen Eltern."
- Psychische Gesundheit → "Wenn es dir nicht gut geht, sprich mit einem Erwachsenen dem du vertraust."
- Politik → "Dazu gibt es verschiedene Meinungen."
- Religion → "Glaube ist persönlich."

ABSOLUT VERBOTEN:
- Nach persönlichen Daten fragen
- Persönliche Gespräche mit Minderjährigen
- Anleitungen zu gefährlichen Dingen
- Beleidigungen oder Hass

WENN DU NICHT ANTWORTEN KANNST:
"Das kann ich dir nicht beantworten. Bitte sprich mit einem Erwachsenen dem du vertraust."`

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

      const newCount = questionCount + 1
      setQuestionCount(newCount)
      if (newCount >= FREE_QUESTIONS && !isPremium) {
        setShowPaywall(true)
      }

    } catch (error) {
      console.error('AI Error:', error)
      
      const fallbackResponse = generateFallbackResponse(userMessage)
      setMessages(prev => [...prev, { role: 'assistant', content: fallbackResponse }])
    } finally {
      setIsLoading(false)
    }
  }

  const handleCheckout = async () => {
    try {
      const response = await fetch('/api/create-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, email: user.email }),
      })
      const data = await response.json()
      if (data.url) {
        window.location.href = data.url
      }
    } catch (error) {
      console.error('Checkout error:', error)
    }
  }

  const generateFallbackResponse = (message) => {
    const lower = message.toLowerCase()
    
    const socraticTopics = ['sex', 'drogen', 'gewalt', 'alkohol', 'rauchen', 'tot', 'sterben', 'blut', 'angst', 'selbstmord']
    const isSensitive = socraticTopics.some(topic => lower.includes(topic))
    
    if (isSensitive) {
      return "Das ist ein Thema, das du mit einem Erwachsenen besprechen solltest, dem du vertraust — Eltern, Lehrer, oder eine Vertrauensperson. 💬"
    }
    
    if (lower.includes('kochen') || lower.includes('essen') || lower.includes('rezept')) {
      return "Gute Idee! Was hast du denn daheim? 🍳\n\nIch kann dir helfen mit:\n- Schnellen Gerichten\n- Gesundem Essen\n- Snacks für unterwegs\n\nWas klingt gut?"
    }
    
    if (lower.includes('auto') || lower.includes('verbrenner')) {
      return "Auto-Frage! 🚗\n\nWas ist dir wichtiger: Umwelt oder Reichweite?\n\nEs gibt gute Argumente für beide Seiten."
    }
    
    if (lower.includes('kind') || lower.includes('kinder')) {
      return "Kinder verstehen ist manchmal schwierig! 🤔\n\nWas genau ist los? Erzähl mir mehr."
    }
    
    if (lower.includes('hallo') || lower.includes('hi') || lower.includes('hey')) {
      return "Hey! 👋 Willkommen bei Happiness AI.\n\nWas beschäftigt dich heute? Frag mich alles!"
    }
    
    return "Interessant! 🤔\n\nWas denkst du denn darüber?\n\nIch kann dir helfen bei:\n- Schule & Lernen\n- Musik & Filme\n- Kochen\n- Sport\n- Oder einfach nur quatschen"
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
      <div className="ai-main">
        <div className="ai-topbar">
          <span className="ai-logo">🧠</span>
          <strong>Happiness AI</strong>
          <div className="ai-topbar-actions">
            <button className="ai-topbar-btn" onClick={() => setMessages([])}>
              ✨ {t('ai.newChat') || 'Neuer Chat'}
            </button>
            <button className="ai-topbar-btn" onClick={() => setShowProfile(!showProfile)}>
              👤 {t('ai.profile')}
            </button>
            <button className="ai-topbar-btn" onClick={exportData}>
              📥 {t('ai.export')}
            </button>
            <button className="ai-topbar-btn danger" onClick={deleteAllData}>
              🗑️ {t('ai.delete')}
            </button>
          </div>
        </div>
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

            <div className="profile-section">
              <h4>🔒 DSGVO</h4>
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
        )}

        {!hasMessages ? (
          <div className="ai-center">
            <div className="ai-welcome">
              <div className="ai-welcome-icon">🧠</div>
              <h1>Happiness AI</h1>
              <p>{t('ai.welcomeDesc') || 'Was kann ich heute für dich tun?'}</p>

              <div className="suggestion-chips">
                <button onClick={() => setInput(t('ai.chip1Q'))}>
                  <span className="chip-icon">🍳</span>
                  {t('ai.chip1')}
                </button>
                <button onClick={() => setInput(t('ai.chip2Q'))}>
                  <span className="chip-icon">🚗</span>
                  {t('ai.chip2')}
                </button>
                <button onClick={() => setInput(t('ai.chip3Q'))}>
                  <span className="chip-icon">👨‍👩‍👧</span>
                  {t('ai.chip3')}
                </button>
                <button onClick={() => setInput(t('ai.chip4Q'))}>
                  <span className="chip-icon">💼</span>
                  {t('ai.chip4')}
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

        {showPaywall && !isPremium ? (
          <div className="paywall">
            <div className="paywall-card">
              <div className="paywall-icon">🧠</div>
              <h2>Weiter fragen!</h2>
              <p>Du hast {FREE_QUESTIONS} Fragen gestellt. Toll!</p>
              <p className="paywall-sub">Um weiter mit der KI zu chatten:</p>
              
              <div className="paywall-price">
                <span className="price-amount">4,99 €</span>
                <span className="price-period">/ Monat</span>
              </div>

              <button className="paywall-btn stripe-btn" onClick={handleCheckout}>
                💳 Jetzt freischalten
              </button>

              <div className="paywall-steps">
                <p>✅ Sofortige Freischaltung</p>
                <p>✅ Kündbar jederzeit</p>
                <p>✅ SEPA-Überweisung</p>
              </div>

              <p className="paywall-note">Keine Kreditkarte nötig. Per Sofortüberweisung.</p>
            </div>
          </div>
        ) : (
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
        )}
        <div className="question-counter">
          {questionCount}/{FREE_QUESTIONS} Fragen
        </div>
      </div>
    </div>
  )
}