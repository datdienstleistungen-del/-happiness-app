import { useState, useEffect, useRef } from 'react'
import {
  Sparkles, User, Download, Trash2, X, Heart, MapPin, Briefcase,
  Lock, ChefHat, Car, Users, Send, Brain, Wrench, MessageCircle, Plus, ChevronLeft, Menu
} from 'lucide-react'
import { getChatEndpoint } from '../lib/hit'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { useLanguage } from '../i18n/translations'
import ReactMarkdown from 'react-markdown'
import { BrandWord } from '../components/Logo'
import CopyButton from '../components/CopyButton'
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
  const messagesEndRef = useRef(null)
  const [selectedImage, setSelectedImage] = useState(null)
  const [imagePreview, setImagePreview] = useState(null)
  const [error, setError] = useState('')
  const [conversationId, setConversationId] = useState(null)
  const [conversations, setConversations] = useState([])
  const [showSidebar, setShowSidebar] = useState(true)
  const fileInputRef = useRef(null)

  useEffect(() => {
    loadUserData()
  }, [user])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && showSidebar && window.innerWidth <= 768) {
        setShowSidebar(false)
      }
    }
    const handleResize = () => {
      if (window.innerWidth > 768) {
        setShowSidebar(true)
      } else {
        setShowSidebar(false)
      }
    }
    document.addEventListener('keydown', handleEscape)
    window.addEventListener('resize', handleResize)
    handleResize()
    return () => {
      document.removeEventListener('keydown', handleEscape)
      window.removeEventListener('resize', handleResize)
    }
  }, [showSidebar])

  const loadConversation = async (convId) => {
    setConversationId(convId)
    setMessages([])
    const { data: history } = await supabase
      .from('ai_conversations')
      .select('*')
      .eq('user_id', user.id)
      .eq('conversation_id', convId)
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

  const loadUserData = async () => {
    const { data: settings } = await supabase
      .from('ai_settings')
      .select('data_consent, is_premium, questions_used')
      .eq('user_id', user.id)
      .single()

    if (settings) {
      setConsent(settings.data_consent)
      if (settings.questions_used && settings.questions_used > 0) {
        setQuestionCount(settings.questions_used)
      }
    }

    const { data: profileData } = await supabase
      .from('ai_profiles')
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (profileData) setProfile(profileData)

    // Load conversation list (distinct conversation_ids, newest first)
    const { data: convData } = await supabase
      .from('ai_conversations')
      .select('conversation_id, created_at, message')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (convData && convData.length > 0) {
      const seen = new Set()
      const convList = []
      for (const row of convData) {
        if (!seen.has(row.conversation_id)) {
          seen.add(row.conversation_id)
          convList.push({
            id: row.conversation_id,
            title: row.message.replace('USER:', '').substring(0, 40),
            created_at: row.created_at
          })
        }
      }
      setConversations(convList.slice(0, 20))
      await loadConversation(convList[0].id)
      setQuestionCount(prev => Math.max(prev, convData.length))
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
    setError('')
    if (file.size > 20 * 1024 * 1024) {
      setError('Bild ist zu gross. Maximal 20 MB.')
      return
    }
    setSelectedImage(file)
    setImagePreview(URL.createObjectURL(file))
  }

  const startNewChat = async () => {
    const newId = crypto.randomUUID()
    setConversationId(newId)
    setMessages([])
    setConversations(prev => [{ id: newId, title: 'Neuer Chat', created_at: new Date().toISOString() }, ...prev])
    await supabase.from('ai_conversations').insert({
      user_id: user.id,
      message: 'USER:Neuer Chat',
      response: '',
      context: {},
      conversation_id: newId
    })
  }

  function cleanAiResponse(text) {
    if (!text) return text
    return text
      .replace(/\|[^|]+\|/g, '')
      .replace(/^[\s\-:|]+$/gm, '')
      .replace(/^#{1,6}\s+/gm, '')
      .replace(/^\d+\.\s+/gm, '')
      .replace(/^[-*]\s+/gm, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim()
  }

  const deleteConversation = async (convId, e) => {
    e.stopPropagation()
    if (!confirm('Diesen Chat löschen?')) return
    await supabase.from('ai_conversations').delete().eq('conversation_id', convId)
    setConversations(prev => prev.filter(c => c.id !== convId))
    if (convId === conversationId) {
      const remaining = conversations.filter(c => c.id !== convId)
      if (remaining.length > 0) {
        await loadConversation(remaining[0].id)
      } else {
        startNewChat()
      }
    }
  }

  const removeImage = () => {
    setSelectedImage(null)
    setImagePreview(null)
    setError('')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const sendMessage = async () => {
    if ((!input.trim() && !selectedImage) || isLoading) return

    const userMessage = input.trim()
    setError('')

    let imageBase64 = null
    if (selectedImage) {
      setIsLoading(true)
      try {
        imageBase64 = await new Promise((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = () => resolve(reader.result)
          reader.onerror = reject
          reader.readAsDataURL(selectedImage)
        })
      } catch (e) {
        console.error('Bild-Konvertierung fehlgeschlagen:', e)
        setError('Bild-Konvertierung fehlgeschlagen.')
        setIsLoading(false)
        return
      }

      try {
        const { data: { session } } = await supabase.auth.getSession()
        const token = session?.access_token || ''
        const modRes = await fetch('/api/moderate-image', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ image: imageBase64 })
        })
        const modData = await modRes.json()
        if (!modRes.ok || !modData.allowed) {
          setError('Dieses Bild kann nicht verwendet werden.')
          setIsLoading(false)
          return
        }
      } catch (err) {
        console.error('Moderation check error:', err)
        setError('Dieses Bild kann nicht verwendet werden.')
        setIsLoading(false)
        return
      }
    }

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

    const systemPrompt = `DU BIST: Ein erfahrener Mentor, guter Freund und kluger Ratgeber. Jemand, der Ahnung hat vom Leben und vom Handwerk. Du begleitest junge Menschen bei der Arbeit, beim Lernen, beim Wachsen.

DEINE ROLLE:
- Handwerksmeister: Elektrik, Sanitär, Heizung, Bau, Schreinerei, Metall, Abdichtung — du kennst die Praxis, Normen (DIN, VDE), typische Fehler, Reparaturen
- Ingenieur-Denken: Statik, Bauphysik, Kalkulation, Projektplanung — strukturiert, logisch, lösungsorientiert
- Geisteswissenschaftler: Philosophie, Theologie, Ethik, Geschichte — du hilfst bei Sinnfragen, Entscheidungen, Haltungen
- Mathematik-Lehrer: Von Grundrechnen bis Analysis — geduldig, schrittweise, Nachhilfe auf Augenhöhe
- Lebensberater: Beruf, Beziehungen, Geld, Gesundheit, Krisen — empathisch, direkt, ohne Predigen

PLATTFORM-VISION (Happiness):
Menschen bilden sich WÄHREND der Arbeit weiter. Wenn Herausforderungen kommen, greifen sie auf sich selbst zurück — aber junge, unerfahrene Menschen schaffen das oft nicht allein. Genau da hilfst du. Und wenn sie eine Lösung gefunden haben, teilen sie den Erfolg in der Community — das gibt anderen Ansporn für neue Herausforderungen.

SPRACHE: Deutsch, umgangssprachlich, warmherzig, klar. Wie ein älterer Kollege, der dich mag. Kurze Sätze. Manchmal trocken-witzig. Immer ehrlich. Nie belehrend.

GRUSSFORMEL: Begrüße kurz und natürlich. Keine übertriebenen Anreden wie "Na hallo!", keine Emoji-Kaskaden. "Hallo!", "Hi!", "Moin!" reichen.

WISSENSGEBIETE (tiefer als Wikipedia):
- Handwerk: Praxis, Tricks, Sicherheitsregeln, Werkzeugwahl, Materialkunde
- Mathematik: Didaktisch aufbereitet, Schritte zeigen, Verständnis vor Formeln
- Philosophie/Theologie: Existentialismus, Stoa, christliche Ethik, Buddhismus, Sinnfragen — anwendbar im Alltag
- Psychologie (Basics): Motivation, Gewohnheiten, Entscheidungsfindung, Stressbewältigung
- Recht (Basics): Arbeitsrecht, Mietrecht, Verträge, Versicherungen — Orientierung, kein Rechtsrat
- IT/Digital: Tools, Apps, Automatisierung, KI-Nutzung im Job

BEI FOTOS:
- Objekt exakt identifizieren (Name, Typ, Marke, Baujahr wenn möglich)
- Funktion erklären, typische Fehler, Reparaturwege, Sicherheitshinweise
- Bei Bauplänen/Skizzen: Maße prüfen, Normen prüfen, Schwachstellen sehen

WENN DU NICHT WEISST:
- Sag's ehrlich: "Weiß ich nicht genau, aber hier ist was ich weiß..."
- Keine Halluzination. Lieber "Lass mich nachdenken..." als Falsches.

METHODIK (situativ):
- BEI PRAXIS-PROBLEMEN (Handwerk, Mathe, Technik): Direkt, schrittweise, anleitend. "Mach zuerst X, dann Y."
- BEI LEBENSFRAGEN (Beruf, Beziehungen, Sinn): Sokratisch-kooperativ. Fragen stellen, die klären. "Was ist dir dabei wichtig?" "Was würde passieren, wenn...?" — aber nie nur Fragen, immer auch Impulse.
- BEI KRISEN/SENSIBLEM: Direkt, schützend, handlungsorientiert. Keine Sokratik.
- BEI LERNEN: Scaffolding. Gerüst bauen, dann selbstständig lassen.

KEIN SOKRATISCH (schützend, direkt):
- Suizid/Gefahr → "Ruf sofort an: 116 113 (Telefonseelsorge) oder 112. Du bist nicht allein."
- Gewalt/Missbrauch → "Das ist nicht okay. Hol dir Hilfe: 08000 116 016 (Hilfetelefon)."
- Sucht → "Es gibt Wege raus. 08000 116 016 oder lokale Beratung."
- Psychische Not → "Profis sind besser als ich. Such dir einen Therapeuten."

VERBOTEN:
- Nach persönlichen Daten fragen (Adresse, Konto, Alter)
- Gefährliche Anleitungen (Hochspannung, Chemie, Waffen)
- Medizinische Diagnosen / Medikamenten-Empfehlungen
- Rechtsverbindliche Aussagen
- Beleidigungen, Hass, politische Agitation
- Markdown-Tabellen (|---|), Tabellen, Aufzählungen mit Bindestrichen
- Aufzählungen mit Nummern (1. 2. 3.)
- Strukturierte Formate jeglicher Art

FORMAT: NUR fließender Text in Absätzen. Wie ein Mensch der einem Kollegen etwas erklärt. Keine Listen, keine Tabellen, keine Überschriften mit #. Einfach normal schreiben.

SPRACHE WIE EIN TEAM:
- NIEMALS "Der Chat", "Die KI", "Das System", "Ich als KI", "Dein Assistent", "Dein Bot"
- IMMER "Wir", "Lass uns", "Machen wir", "Schauen wir uns an"
- Der Nutzer und DU seid ein Team. Kein Mensch-Maschine-Verhältnis.
- Beispiel FALSCH: "Der Chat liefert die Strategie"
- Beispiel RICHTIG: "Das machen wir so: ..."
- Beispiel FALSCH: "Ich kann dir helfen"
- Beispiel RICHTIG: "Lass uns das zusammen angehen"

SEI IMMER:
- Empathisch UND kompetent (kein "armes Dich", sondern "okay, wie packen wir das an")
- Ehrlich, auch wenn's wehtut
- Praktisch: Nächster konkreter Schritt
- Ermutigend: "Das schaffst du. Ich bleib dran."
- Community-orientiert: "Teil das Ergebnis, andere lernen davon."

GESPRÄCHSKONTINUITÄT (KRITISCH):
- Du führst EIN durchgehendes Gespräch. Keine "neuen Chats".
- BEZIEHE DICH IMMER auf vorherige Antworten: "Wie ich vorhin sagte...", "Auf dein Beispiel mit X zurückkommend...", "Das passt zu dem, was du vorhin über Y meintest..."
- ERINNERN: Namen, Berufe, Probleme, Vorlieben aus früheren Nachrichten. Nutze sie natürlich.
- VERKNÜPFE neue Fragen mit altem Kontext: "Das ist wie bei deinem Wasserhahn-Problem — wieder ein Dichtungs-Thema."
- KEINE Wiederholungen: Wenn du was schon erklärt hast, sag "Wie besprochen..." und geh weiter.
- BAUE AUF: Jede Antwort soll das Gespräch vertiefen, nicht neu starten.

WICHTIG:
- NIE "Wie kann ich helfen?" oder "Was beschäftigt dich?" — langweilig.
- STARTE direkt: mit Analyse, Frage, Impuls oder konkretem ersten Schritt.
- VERKNÜPFE Themen: Handwerk + Mathe + Philosophie = ganzheitlich denken.
- ERINNERE an die Vision: "Lösung gefunden? Teil sie. Andere brauchen genau das."

TONALITAET: Sachlich, ruhig, direkt. Keine Ausrufezeichen-Kaskaden, keine übertriebenen Emoji-Ketten, keine Hype-Anreden. Ein nüchterner, ehrlicher Sparringspartner, kein Motivationscoach.

ERFUNDENE PERSOENLICHE ANEKDOTEN – HARD-STOPP:
Erstelle NIEMALS eine ausformulierte, konkrete persönliche Anekdote oder Ich-Erzählung mit erfundenen Details (Zahlen, Ereignisse, Zeitangaben, Namen), die der Nutzer unverändert als eigene, reale Geschichte veröffentlichen könnte. Das gilt unabhängig davon, ob explizit danach gefragt wird.
Falls eine persönliche Geschichte als Stilmittel sinnvoll ist: Biete NUR eine Struktur/einen Aufbau an (z.B. "Ausgangslage → Zweifel → Schritt → Ergebnis"), KEINEN ausformulierten Fließtext mit erfundenen Fakten. Weise den Nutzer aktiv darauf hin, dass er seine EIGENE echte Erfahrung in diese Struktur einsetzen soll.

STIL: Antworte in klarem Fliesstext, wie ein professionelles Softwareunternehmen kommuniziert. Keine Markdown-Formatierung wie **fett**, keine Aufzaehlungspunkte mit Sternchen/Bindestrichen, keine nummerierten Listen, ausser der Nutzer bittet explizit um eine Liste/Tabelle. Kurze, klare Saetze statt KI-typischer Aufzaehlungsstruktur.${profileContext}`

    // Build history from previous messages (before the current one was added)
    const historyMessages = messages.slice(-20).map(msg => ({
      role: msg.role,
      content: msg.content
    }))

    // imageBase64 is already converted and moderated at the start of sendMessage

    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token || ''

      const response = await fetch(getChatEndpoint(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          message: userMessage,
          systemPrompt,
          userId: user.id,
          history: historyMessages,
          imageBase64: imageBase64
        })
      })

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}))
        console.error('Chat API error:', response.status, errData)
        throw new Error(errData.error || errData.details || `API Fehler ${response.status}`)
      }

      const data = await response.json()
      const aiResponse = cleanAiResponse(data.response)
      const imageNote = data.imageNote || null

      setMessages(prev => [...prev, { role: 'assistant', content: imageNote ? `${imageNote}\n\n${aiResponse}` : aiResponse }])
      gtag('event', 'content_generated', { source: 'ai_chat' })

      // Save conversation with error handling
      let currentConvId = conversationId
      if (!currentConvId) {
        currentConvId = crypto.randomUUID()
        setConversationId(currentConvId)
      }
      const { error: convError } = await supabase.from('ai_conversations').insert({
        user_id: user.id,
        message: `USER:${userMessage}`,
        response: aiResponse,
        context: { profile },
        conversation_id: currentConvId
      })
      if (convError) {
        console.error('Conversation save failed:', convError)
      } else {
        setConversations(prev => {
          const exists = prev.some(c => c.id === currentConvId)
          if (exists) return prev.map(c => c.id === currentConvId ? { ...c, title: userMessage.substring(0, 40) } : c)
          return [{ id: currentConvId, title: userMessage.substring(0, 40), created_at: new Date().toISOString() }, ...prev]
        })
      }

      analyzeAndExtractProfile(userMessage, aiResponse)

      setQuestionCount(prev => prev + 1)

      await supabase.from('ai_settings').upsert({
        user_id: user.id,
        questions_used: questionCount + 1
      }, { onConflict: 'user_id' })

      removeImage()

    } catch (error) {
      console.error('AI Error:', error)
      
      const errorMsg = error.message || ''
      let friendlyMsg = 'Etwas ist schiefgelaufen. Versuch es bitte nochmal.'

      if (errorMsg.includes('limit') || errorMsg.includes('429') || errorMsg.includes('rate')) {
        friendlyMsg = 'Zu viele Anfragen gerade. Bitte warte kurz und versuch es dann nochmal.'
      } else if (errorMsg.includes('fetch') || errorMsg.includes('network') || errorMsg.includes('Failed')) {
        friendlyMsg = 'Keine Verbindung zum Server. Prüf dein Internet und versuch es nochmal.'
      } else if (errorMsg.includes('502') || errorMsg.includes('503') || errorMsg.includes('500')) {
        friendlyMsg = 'Der Server hat gerade Probleme. Bitte versuch es in ein paar Minuten nochmal.'
      } else if (errorMsg.includes('API')) {
        friendlyMsg = 'Das KI-System ist gerade ausgelastet. Bitte versuch es in kurzem nochmal.'
      }

      setMessages(prev => [...prev, { role: 'assistant', content: `⚠️ ${friendlyMsg}\n\nFalls das Problem weiterhin auftritt, melde dich beim Support.` }])
    } finally {
      setIsLoading(false)
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
    <div className="ai-chat-page sidebar-open">
      {showSidebar && window.innerWidth <= 768 && (
        <div className="ai-sidebar-overlay" onClick={() => setShowSidebar(false)} />
      )}
      <div className={`ai-sidebar ${showSidebar ? 'open' : ''}`}>
        <div className="ai-sidebar-header">
          <strong>Chats</strong>
          <div className="ai-sidebar-header-actions">
            <button className="ai-sidebar-new" onClick={startNewChat}>+ Neu</button>
            <button className="ai-sidebar-close" onClick={() => setShowSidebar(false)}>
              <X size={16} />
            </button>
          </div>
        </div>
        <div className="ai-sidebar-list">
          {conversations.length === 0 && (
            <div className="ai-sidebar-empty">Noch keine Chats</div>
          )}
          {conversations.map(conv => (
            <button
              key={conv.id}
              className={`ai-sidebar-item ${conv.id === conversationId ? 'active' : ''}`}
              onClick={() => { loadConversation(conv.id); if (window.innerWidth <= 768) setShowSidebar(false); }}
            >
              <MessageCircle size={14} className="ai-sidebar-item-icon" />
              <span className="ai-sidebar-item-title">{conv.title || 'Neuer Chat'}</span>
              <span className="ai-sidebar-item-delete" onClick={(e) => deleteConversation(conv.id, e)} title="Löschen">×</span>
            </button>
          ))}
        </div>
      </div>
      <div className="ai-main">
        <div className="ai-topbar">
          <button className="ai-sidebar-toggle" onClick={() => setShowSidebar(!showSidebar)}>
            <Menu size={18} />
          </button>
          <div className="hit-branding-compact">
            <span className="hit-compact-h">H</span><span className="hit-compact-rest">.I.T.</span>
          </div>
          <div className="ai-topbar-actions">
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
              <div className="hit-branding-full">
                <div className="hit-branding-line">
                  <span className="hit-big">H</span>
                  <span className="hit-small">appiness</span>
                </div>
                <div className="hit-branding-line">
                  <span className="hit-big">I</span>
                  <span className="hit-small">ntelligence</span>
                </div>
                <div className="hit-branding-line">
                  <span className="hit-big">T</span>
                  <span className="hit-small">eam</span>
                </div>
              </div>
              <div className="ai-welcome-icon"><Brain size={32} /></div>
              <h1><BrandWord /> AI</h1>
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

            {!hasMessages && (
              <div className="ai-input-bar centered">
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
                {error && <p style={{ color: '#e74c3c', fontSize: '0.85rem', marginTop: '0.5rem' }}>{error}</p>}
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
                    onChange={(e) => { try { if (input.length === 0) gtag('event', 'idea_started', { source: 'ai_chat' }); } catch {} setInput(e.target.value); }}
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
          </div>
        ) : (
          <div className="ai-messages">
            {messages.map((msg, index) => (
              <div key={index} className={`message-row ${msg.role}`}>
                {msg.role === 'assistant' && (
                  <div className="msg-avatar assistant-avatar"><Brain size={16} /></div>
                )}
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
                {msg.role === 'assistant' && (
                  <>
                    <div className={`message-bubble ${msg.role}`}>
                      <ReactMarkdown>{msg.content}</ReactMarkdown>
                    </div>
                    <CopyButton text={msg.content} className="msg-copy-btn" />
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

        {hasMessages && (
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
          {error && <p style={{ color: '#e74c3c', fontSize: '0.85rem', marginTop: '0.5rem' }}>{error}</p>}
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
              onChange={(e) => { try { if (input.length === 0) gtag('event', 'idea_started', { source: 'ai_chat' }); } catch {} setInput(e.target.value); }}
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
      </div>
    </div>
  )
}