import { useState, useEffect, useRef } from 'react'
import {
  Sparkles, User, Download, Trash2, X, Heart, MapPin, Briefcase,
  Lock, ChefHat, Car, Users, CreditCard, Check, Send, Brain, Wrench
} from 'lucide-react'
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
  const [selectedImage, setSelectedImage] = useState(null)
  const [imagePreview, setImagePreview] = useState(null)
  const fileInputRef = useRef(null)
  const FREE_QUESTIONS = 5

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
    const lower = userMessage.toLowerCase()

    const updates = {}

    const namePatterns = [
      /(?:mein name ist|ich heisse|ich bin|man nennt mich|i'm|my name is)\s+(\w+)/i,
      /(?:ich bin der|ich bin die|ich bin das)\s+(\w+)/i,
      /(?:hi|hallo|moin|servus|hey)\s*,?\s*ich bin\s+(\w+)/i
    ]
    for (const pattern of namePatterns) {
      const match = userMessage.match(pattern)
      if (match) {
        updates.display_name = match[1]
        break
      }
    }

    const jobPatterns = [
      /(?:ich arbeite als|mein beruf ist|ich bin)\s+(?:ein|eine|der|die)\s+(.+)/i,
      /(?:ich arbeite im|ich bin im bereich)\s+(.+)/i,
      /(?:mein job|meine arbeit)\s+(?:ist|heisst)\s+(.+)/i
    ]
    for (const pattern of jobPatterns) {
      const match = userMessage.match(pattern)
      if (match) {
        updates.occupation = { ...profile?.occupation, job: match[1].trim(), mentioned_work: true }
        break
      }
    }

    const interestPatterns = [
      /(?:ich mag|ich liebe|ich fuere gerne|mein hobby ist|ich spiele gerne|ich hoere gerne)\s+(.+)/i,
      /(?:interessiere mich fuer|fasziniert mich)\s+(.+)/i
    ]
    const currentInterests = { ...profile?.interests } || {}
    for (const pattern of interestPatterns) {
      const match = userMessage.match(pattern)
      if (match) {
        const interest = match[1].trim().replace(/[.!?]+$/, '').substring(0, 50)
        const key = `interest_${Object.keys(currentInterests).length}`
        currentInterests[key] = interest
      }
    }
    if (Object.keys(currentInterests).length > Object.keys(profile?.interests || {}).length) {
      updates.interests = currentInterests
    }

    const foodPatterns = [
      /(?:ich esse kein|ich bin|mag ich nicht|mag ich gerne|liebe ich)\s+(.+)/i,
      /(?:vegetarier|veganer|laktoseintolerant|glutenfrei)\s*$/i
    ]
    for (const pattern of foodPatterns) {
      const match = userMessage.match(pattern)
      if (match) {
        const food = match[1] ? match[1].trim().substring(0, 50) : match[0]
        updates.preferences = { ...profile?.preferences, food }
        break
      }
    }

    if (lower.includes('kinder') || lower.includes('sohn') || lower.includes('tochter')) {
      updates.family_info = { ...profile?.family_info, has_children: true }
    }
    if (lower.includes('mein mann') || lower.includes('meine frau') || lower.includes('mein partner') || lower.includes('meine partnerin')) {
      updates.family_info = { ...profile?.family_info, has_partner: true }
    }

    if (lower.includes('wohnung') || lower.includes('haus') || lower.includes('mieter') || lower.includes('eigentum')) {
      updates.location = { ...profile?.location, housing_interest: true }
    }
    if (lower.includes('wahne in') || lower.includes('lebe in') || lower.includes('komme aus')) {
      const cityMatch = userMessage.match(/(?:wohne in|lebe in|komme aus)\s+(\w[\w\s]*)/i)
      if (cityMatch) {
        updates.location = { ...profile?.location, city: cityMatch[1].trim() }
      }
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

  const handleImageSelect = (e) => {
    const file = e.target.files[0]
    if (!file) return
    if (!file.type.startsWith('image/')) return
    if (file.size > 20 * 1024 * 1024) {
      setError('Bild ist zu gross. Maximal 20 MB.')
      return
    }
    setSelectedImage(file)
    setImagePreview(URL.createObjectURL(file))
  }

  const removeImage = () => {
    setSelectedImage(null)
    setImagePreview(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const sendMessage = async () => {
    if ((!input.trim() && !selectedImage) || isLoading) return
    if (showPaywall && !isPremium) return

    const userMessage = input.trim()
    setInput('')
    setMessages(prev => [...prev, { role: 'user', content: userMessage, image: imagePreview }])
    setIsLoading(true)

    // Profile context for the AI
    let profileContext = ''
    if (profile) {
      if (profile.display_name) profileContext += `\n\nDU SPRICHST MIT: ${profile.display_name}`
      if (profile.occupation?.job) profileContext += `\nBeruf: ${profile.occupation.job}`
      if (profile.family_info?.has_children) profileContext += `\nHat Kinder`
      if (profile.interests) {
        const interests = Object.values(profile.interests).filter(v => v && typeof v === 'string')
        if (interests.length) profileContext += `\nInteressen: ${interests.join(', ')}`
      }
      if (profile.preferences?.food) profileContext += `\nEssensvorlieben: ${profile.preferences.food}`
      if (profile.location?.city) profileContext += `\nWohnt in: ${profile.location.city}`
    }

    // Last conversation topics as context
    const recentMsgs = messages.slice(-6)
    if (recentMsgs.length > 0) {
      const topics = recentMsgs.map(m => m.content).join(' | ')
      profileContext += `\n\nVorherige Themen in diesem Chat: ${topics}`
    }

    const systemPrompt = `Du bist ein guter Freund. Einer der immer fuer dich da ist. Du weisst fast alles: Handwerk, Ingenieur, Wissenschaft, Alltag. Wenn du dir nicht sicher bist, suchst du im Internet nach.

SPRACHE: Deutsch, umgangssprachlich, warmherzig. Wie ein Kumpel der Ahnung hat. Kurze Saetze. Manchmal witzig, immer ehrlich.

GRUESSFORMEL: Wechsle immer zwischen verschiedenen Gruessen:
- "Hallo!" / "Hallo [Name]!"
- "Moin!"
- "Servus!"
- "Na hallo!"
- "Guten Tag!"
- "Hi!"
Benutze NIE zweimal hintereinander denselben Gruess. Wenn du den Namen kennst, verwende ihn gelegentlich.

DEIN WISSEN:
- Handwerk: Elektrik, Sanitaer, Heizung, Bau, Schreinerei, Metall, Abdichtung
- Ingenieur: Statik, Bauphysik, Normen (DIN, VDE), Kalkulation, Projektplanung
- Alltag: Kochen, Auto, Gesundheit, Geld, Job, Familie, Sport
- Wissenschaft: Physik, Chemie, Biologie, Mathematik
- IT: Computer, Internet, Apps, Programmierung
- Recht: Vertraege, Versicherung, Mietrecht, Arbeitsrecht

WENN DIR JEMAND EIN FOTO ZEIGT:
- Identifiziere das Objekt genau (Name, Marke, Typ wenn moeglich)
- Erklaere wofuer es ist und wie es funktioniert
- Nenne typische Fehler und Reparaturmoeglichkeiten
- Warn vor Sicherheitsrisiken wenn noetig

WENN DU ETWAS NICHT 100% WEISST:
- Gib trotzdem alles was du weisst
- Sag ehrlich: "Lass mich kurz nachschauen..."
- Dann gib die beste Antwort

SOKRATISCH (bei normalen Themen):
Stell Fragen die zum Nachdenken anregen. Beispiel:
- "Was denkst du denn?"
- "Hast du schon mal versucht...?"
- "Was waere wenn...?"

KEIN SOKRATISCH (bei sensiblen Themen):
- Sexuelle Themen → Direkt: "Das ist ein Thema fuer Erwachsene. Sprich mit jemandem dem du vertraust."
- Gewalt → Direkt: "Bei Gewalt solltest du mit einem Erwachsenen sprechen."
- Drogen/Alkohol → Direkt: "Das ist ein Thema fuer Erwachsene."
- Psychische Gesundheit → Direkt: "Wenn es dir nicht gut geht, hol dir Hilfe."
- Politik → Neutral: "Dazu gibt es verschiedene Meinungen."
- Religion → Respektvoll: "Glaube ist persoenlich."

VERBOTEN:
- Nach persoenlichen Daten fragen (Name, Adresse, Alter)
- Anleitungen zu gefaehrlichen Dingen
- Beleidigungen oder Hass

SEI IMMER:
- Empathisch und nett
- Ehrlich und direkt
- Praktisch und hilfsbereit
- Nie abweisend oder kalt

WICHTIG: Antworte NIE mit "Wie kann ich dir helfen?" oder "Was beschaeftigt dich?" — das ist langweilig. Starte direkt mit hilfreichen Inhalt oder einer konkreten Frage.${profileContext}`

    // Build history from previous messages (before the current one was added)
    const historyMessages = messages.slice(-20).map(msg => ({
      role: msg.role,
      content: msg.content
    }))

    // Upload image to Supabase Storage and get URL
    let imageUrl = null
    if (selectedImage) {
      const filePath = `chat-images/${user.id}/${Date.now()}.jpg`
      const { error: uploadError } = await supabase.storage
        .from('chat-images')
        .upload(filePath, selectedImage, { contentType: selectedImage.type })
      
      if (!uploadError) {
        const { data: urlData } = supabase.storage
          .from('chat-images')
          .getPublicUrl(filePath)
        imageUrl = urlData.publicUrl
      }
    }

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage,
          systemPrompt,
          userId: user.id,
          history: historyMessages,
          imageUrl: imageUrl
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

      removeImage()

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
          <span className="ai-logo"><Brain size={20} /></span>
          <strong>Happiness AI</strong>
          <div className="ai-topbar-actions">
            <button className="ai-topbar-btn" onClick={() => setMessages([])}>
              <Sparkles size={14} style={{ marginRight: 4, verticalAlign: 'text-bottom' }} />
              {t('ai.newChat') || 'Neuer Chat'}
            </button>
            <button className="ai-topbar-btn" onClick={() => setShowProfile(!showProfile)}>
              <User size={14} style={{ marginRight: 4, verticalAlign: 'text-bottom' }} />
              {t('ai.profile')}
            </button>
            <button className="ai-topbar-btn" onClick={exportData}>
              <Download size={14} style={{ marginRight: 4, verticalAlign: 'text-bottom' }} />
              {t('ai.export')}
            </button>
            <button className="ai-topbar-btn danger" onClick={deleteAllData}>
              <Trash2 size={14} style={{ marginRight: 4, verticalAlign: 'text-bottom' }} />
              {t('ai.delete')}
            </button>
          </div>
        </div>
        {showProfile && (
          <div className="profile-panel">
            <div className="profile-panel-header">
              <h3><User size={16} style={{ marginRight: 6, verticalAlign: 'text-bottom' }} />{t('ai.yourProfile')}</h3>
              <button className="close-btn" onClick={() => setShowProfile(false)}><X size={16} /></button>
            </div>
            <p className="profile-info">{t('ai.profileInfo')}</p>
            
            <div className="profile-section">
              <h4><Users size={14} style={{ marginRight: 6, verticalAlign: 'text-bottom' }} />{t('ai.family')}</h4>
              <pre>{JSON.stringify(profile?.family_info || {}, null, 2)}</pre>
            </div>
            
            <div className="profile-section">
              <h4><Heart size={14} style={{ marginRight: 6, verticalAlign: 'text-bottom' }} />{t('ai.preferences')}</h4>
              <pre>{JSON.stringify(profile?.preferences || {}, null, 2)}</pre>
            </div>
            
            <div className="profile-section">
              <h4><MapPin size={14} style={{ marginRight: 6, verticalAlign: 'text-bottom' }} />{t('ai.location')}</h4>
              <pre>{JSON.stringify(profile?.location || {}, null, 2)}</pre>
            </div>
            
            <div className="profile-section">
              <h4><Briefcase size={14} style={{ marginRight: 6, verticalAlign: 'text-bottom' }} />{t('ai.occupation')}</h4>
              <pre>{JSON.stringify(profile?.occupation || {}, null, 2)}</pre>
            </div>

            <div className="profile-section">
              <h4><Lock size={14} style={{ marginRight: 6, verticalAlign: 'text-bottom' }} />DSGVO</h4>
              <label className="consent-switch">
                <input
                  type="checkbox"
                  checked={consent}
                  onChange={toggleConsent}
                />
                <span className="consent-label">{t('ai.dataConsent')}</span>
              </label>
              <p className="ai-eu-badge">{t('ai.footer')}</p>
            </div>
          </div>
        )}

        {!hasMessages ? (
          <div className="ai-center">
            <div className="ai-welcome">
              <div className="ai-welcome-icon"><Brain size={32} /></div>
              <h1>Happiness AI</h1>
              <p>{t('ai.welcomeDesc') || 'Was kann ich heute für dich tun?'}</p>

              <div className="suggestion-chips">
                <button onClick={() => setInput('Was soll ich heute kochen?')}>
                  <span className="chip-icon"><ChefHat size={16} /></span>
                  Was kochen?
                </button>
                <button onClick={() => setInput('Mein Wasserhahn tropft, wie repariere ich das?')}>
                  <span className="chip-icon"><Wrench size={16} /></span>
                  Handwerk
                </button>
                <button onClick={() => setInput('Soll ich ein Elektroauto kaufen?')}>
                  <span className="chip-icon"><Car size={16} /></span>
                  Auto
                </button>
                <button onClick={() => setInput('Tipps fuer einen Jobwechsel?')}>
                  <span className="chip-icon"><Briefcase size={16} /></span>
                  Job
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="ai-messages">
            {messages.map((msg, index) => (
              <div key={index} className={`message-row ${msg.role}`}>
                {msg.role === 'assistant' && (
                  <div className="msg-avatar assistant-avatar"><Brain size={16} /></div>
                )}
                <div className={`message-bubble ${msg.role}`}>
                  {msg.content}
                </div>
                {msg.role === 'user' && (
                  <>
                    {msg.image && (
                      <img src={msg.image} alt="" style={{ maxWidth: '200px', borderRadius: '8px', marginBottom: '0.5rem', display: 'block' }} />
                    )}
                    <div className={`message-bubble ${msg.role}`}>
                      {msg.content}
                    </div>
                    <div className="msg-avatar user-avatar">
                      {user?.email?.[0]?.toUpperCase() || 'U'}
                    </div>
                  </>
                )}
              </div>
            ))}

            {isLoading && (
              <div className="message-row assistant">
                <div className="msg-avatar assistant-avatar"><Brain size={16} /></div>
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
              <div className="paywall-icon"><Brain size={32} /></div>
              <h2>Weiter fragen!</h2>
              <p>Du hast {FREE_QUESTIONS} Fragen gestellt. Toll!</p>
              <p className="paywall-sub">Um weiter mit der KI zu chatten:</p>
              
              <div className="paywall-price">
                <span className="price-amount">4,99 €</span>
                <span className="price-period">/ Monat</span>
              </div>

              <button className="paywall-btn stripe-btn" onClick={handleCheckout}>
                <CreditCard size={16} style={{ marginRight: 6, verticalAlign: 'text-bottom' }} />
                Jetzt freischalten
              </button>

              <div className="paywall-steps">
                <p><Check size={14} style={{ marginRight: 6, verticalAlign: 'text-bottom' }} />Sofortige Freischaltung</p>
                <p><Check size={14} style={{ marginRight: 6, verticalAlign: 'text-bottom' }} />Kuendbar jederzeit</p>
                <p><Check size={14} style={{ marginRight: 6, verticalAlign: 'text-bottom' }} />Per Kreditkarte</p>
              </div>

              <p className="paywall-note">Sicher bezahlen mit Stripe.</p>
            </div>
          </div>
        ) : (
        <div className="ai-input-bar">
          {imagePreview && (
            <div style={{ position: 'relative', marginBottom: '0.5rem' }}>
              <img src={imagePreview} alt="" style={{ maxWidth: '120px', borderRadius: '8px', border: '2px solid var(--border)' }} />
              <button
                onClick={removeImage}
                style={{
                  position: 'absolute', top: -8, right: -8,
                  background: 'var(--danger, #e53e3e)', color: 'white',
                  border: 'none', borderRadius: '50%', width: 22, height: 22,
                  cursor: 'pointer', fontSize: '12px', lineHeight: '22px', textAlign: 'center'
                }}
              >X</button>
            </div>
          )}
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-end' }}>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageSelect}
              style={{ display: 'none' }}
            />
            <button
              className="send-btn"
              onClick={() => fileInputRef.current?.click()}
              style={{ background: 'var(--border)', color: 'var(--text)' }}
              title="Bild hochladen"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                <circle cx="8.5" cy="8.5" r="1.5"></circle>
                <polyline points="21 15 16 10 5 21"></polyline>
              </svg>
            </button>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onInput={(e) => {
                e.target.style.height = 'auto'
                e.target.style.height = Math.min(e.target.scrollHeight, 150) + 'px'
              }}
              onKeyDown={handleKeyPress}
              placeholder={t('ai.placeholder')}
              rows={1}
              style={{ flex: 1, minHeight: '48px' }}
            />
            <button
              className="send-btn"
              onClick={sendMessage}
              disabled={(!input.trim() && !selectedImage) || isLoading}
            >
              <Send size={16} />
            </button>
          </div>
        </div>
        )}
        <div className="question-counter">
          {questionCount}/{FREE_QUESTIONS} Fragen
        </div>
      </div>
    </div>
  )
}