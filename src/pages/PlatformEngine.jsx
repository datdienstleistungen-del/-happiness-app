import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Rocket, Check, Copy, Share2, Sparkles, ChevronDown, ChevronUp, RotateCcw, ArrowRight, ArrowLeft, Info, X, Mic, MicOff, Volume2, VolumeX, MessageSquare, Send } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useLanguage } from '../i18n/translations'
import { getChatEndpoint } from '../lib/hit'
import { supabase } from '../lib/supabase'
import { analyzeGoal } from '../intelligence/goal-analyzer'
import { generateRecommendations } from '../intelligence/hit-recommendations'
import { buildMasterBriefFromAnalysis, runPlatformAgent, getAllPlatforms, getAgentIcon, getAgentName } from '../intelligence/content-engine'
import { trackEvent, trackLandingFunnel } from '../intelligence/analytics/custom'
import NextActionHub from '../components/NextActionHub'
import { VerticalLogo } from '../components/Logo'
import './PlatformEngine.css'

const GOAL_CHIPS = {
  de: [
    { label: 'Mehr Kunden gewinnen', icon: '🎯' },
    { label: 'Reichweite erhöhen', icon: '📈' },
    { label: 'Produkt verkaufen', icon: '🛒' },
    { label: 'Community aufbauen', icon: '👥' },
    { label: 'Event bewerben', icon: '🎪' },
    { label: 'Mitarbeiter finden', icon: '💼' },
  ],
  en: [
    { label: 'Get more customers', icon: '🎯' },
    { label: 'Increase reach', icon: '📈' },
    { label: 'Sell a product', icon: '🛒' },
    { label: 'Build community', icon: '👥' },
    { label: 'Promote event', icon: '🎪' },
    { label: 'Find employees', icon: '💼' },
  ],
  es: [
    { label: 'Ganar más clientes', icon: '🎯' },
    { label: 'Aumentar alcance', icon: '📈' },
    { label: 'Vender producto', icon: '🛒' },
    { label: 'Crear comunidad', icon: '👥' },
    { label: 'Promocionar evento', icon: '🎪' },
    { label: 'Encontrar empleados', icon: '💼' },
  ],
  fr: [
    { label: 'Gagner plus de clients', icon: '🎯' },
    { label: 'Augmenter la portée', icon: '📈' },
    { label: 'Vendre un produit', icon: '🛒' },
    { label: 'Créer une communauté', icon: '👥' },
    { label: 'Promouvoir un événement', icon: '🎪' },
    { label: 'Trouver des employés', icon: '💼' },
  ],
  it: [
    { label: 'Ottenere più clienti', icon: '🎯' },
    { label: 'Aumentare la portata', icon: '📈' },
    { label: 'Vendere un prodotto', icon: '🛒' },
    { label: 'Creare una community', icon: '👥' },
    { label: 'Promuovere un evento', icon: '🎪' },
    { label: 'Trovare dipendenti', icon: '💼' },
  ],
  nl: [
    { label: 'Meer klanten winnen', icon: '🎯' },
    { label: 'Bereik vergroten', icon: '📈' },
    { label: 'Product verkopen', icon: '🛒' },
    { label: 'Community opbouwen', icon: '👥' },
    { label: 'Evenement promoten', icon: '🎪' },
    { label: 'Medewerkers vinden', icon: '💼' },
  ],
  el: [
    { label: 'Κερδίστε περισσότερους πελάτες', icon: '🎯' },
    { label: 'Αυξήστε την εμβέλεια', icon: '📈' },
    { label: 'Πουλήστε ένα προϊόν', icon: '🛒' },
    { label: 'Χτίστε κοινότητα', icon: '👥' },
    { label: 'Προωθήστε ένα event', icon: '🎪' },
    { label: 'Βρείτε υπαλλήλους', icon: '💼' },
  ],
}

const TICKER_ITEMS = [
  {
    icon: '📦',
    question: <>Niemand kauft dein Produkt auf <span className="highlight-coral">Kleinanzeigen?</span></>,
    solution: <><span className="highlight-petrol font-bold">H.I.T.</span> macht den <span className="highlight-mint font-semibold">Verkaufstext unwiderstehlich</span>.</>
  },
  {
    icon: '💼',
    question: <>Deine <span className="highlight-amber">Bewerbung</span> klingt wie aus dem Jahr 1995?</>,
    solution: <><span className="highlight-petrol font-bold">H.I.T.</span> bringt dein <span className="highlight-mint font-semibold">Anschreiben</span> auf das nächste Level.</>
  },
  {
    icon: '📱',
    question: <>Du sitzt seit 20 Minuten vor einem <span className="highlight-coral">leeren Post?</span></>,
    solution: <><span className="highlight-petrol font-bold">H.I.T.</span> schreibt deinen <span className="highlight-mint font-semibold">Social-Media-Text</span> in 5 Sekunden.</>
  },
  {
    icon: '🎬',
    question: <>Dein Video hat nach 3 Sekunden schon <span className="highlight-amber">0 Zuschauer?</span></>,
    solution: <><span className="highlight-petrol font-bold">H.I.T.</span> baut dir den <span className="highlight-mint font-semibold">perfekten Hook</span>.</>
  }
]

const DUEL_SETS = [
  {
    title: 'Verkauf 📦',
    bad: '„Verkaufe iPhone 13. Zustand gut, siehe Bilder. Keine Rücknahme.“',
    good: '„Biete gepflegtes iPhone 13. Akku hält top, Display kratzerfrei. Bei Fragen gerne melden!“',
    hit: '„Dein neues iPhone 13 wartet schon! 📱 Top-Zustand, langlebiger Akku & bereit für den Einsatz. Schnapp es dir, bevor es weg ist! ✨“'
  },
  {
    title: 'Bewerbung 💼',
    bad: '„Sehr geehrte Damen und Herren, hiermit bewerbe ich mich auf Ihre Stelle als...“',
    good: '„Sehr geehrte Damen und Herren, mit meinen Fähigkeiten im Bereich X möchte ich Ihr Team unterstützen...“',
    hit: '„Sie suchen jemanden, der ab Tag 1 voll anpackt und frischen Wind in Ihre Projekte bringt? Genau das biete ich Ihnen... 🚀“'
  },
  {
    title: 'Video / Social Media 🎬',
    bad: '„Hallo Leute, willkommen auf meinem Kanal! Heute zeige ich euch mal ein paar Tipps...“',
    good: '„Wenn du Probleme beim Texten hast, schau dir diese drei einfachen Kniffe an...“',
    hit: '„Hör sofort auf, deine Texte selbst zu schreiben! 🛑 Dieser eine Trick spart dir Stunden...“'
  }
]

const SPEECH_LANG_MAP = {
  de: 'de-DE',
  en: 'en-US',
  es: 'es-ES',
  fr: 'fr-FR',
  it: 'it-IT',
  nl: 'nl-NL',
  el: 'el-GR'
}

const GENERIC_VIDEO_FALLBACKS = {
  de: 'Kreatives Video',
  en: 'Creative video',
  es: 'Video creativo',
  fr: 'Vidéo créative',
  it: 'Video creativo',
  nl: 'Creatieve video',
  el: 'Δημιουργικό βίντεο'
}

export default function PlatformEngine() {
  const { user } = useAuth()
  const { t, lang } = useLanguage()
  const navigate = useNavigate()

  const [phase, setPhase] = useState('input')
  const [goal, setGoal] = useState('')
  const [analysis, setAnalysis] = useState(null)
  const [recommendations, setRecommendations] = useState([])
  const [results, setResults] = useState({})
  const [topResults, setTopResults] = useState({})
  const [progress, setProgress] = useState({})
  const [error, setError] = useState('')
  const [showMore, setShowMore] = useState(false)
  const [copiedAll, setCopiedAll] = useState(false)
  const [generatedMore, setGeneratedMore] = useState(false)
  const [copiedPlatform, setCopiedPlatform] = useState(null)
  const [generatingSingle, setGeneratingSingle] = useState(null)
  const [showInfo, setShowInfo] = useState(false)
  const [tickerIndex, setTickerIndex] = useState(0)
  const [duelIndex, setDuelIndex] = useState(0)
  const videoEditor = 'capcut';
  const [mobileStep, setMobileStep] = useState('input');
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);

  // Co-Pilot Chat and Voice states
  const [chatHistory, setChatHistory] = useState([])
  const [chatInput, setChatInput] = useState('')
  const [isRecording, setIsRecording] = useState(false)
  const [recognition, setRecognition] = useState(null)
  const [readingAloud, setReadingAloud] = useState(false)
  const [tourActive, setTourActive] = useState(false)

  const goalMobileRef = useRef(null)
  const goalDesktopRef = useRef(null)
  const chatMobileRef = useRef(null)
  const chatDesktopRef = useRef(null)

  useEffect(() => {
    [goalMobileRef, goalDesktopRef].forEach(ref => {
      if (ref.current) {
        ref.current.style.height = 'auto';
        ref.current.style.height = `${ref.current.scrollHeight}px`;
      }
    });
  }, [goal])

  useEffect(() => {
    [chatMobileRef, chatDesktopRef].forEach(ref => {
      if (ref.current) {
        ref.current.style.height = 'auto';
        ref.current.style.height = `${ref.current.scrollHeight}px`;
      }
    });
  }, [chatInput])

  // Speech Recognition initialization
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (SpeechRecognition) {
      const rec = new SpeechRecognition()
      rec.continuous = false
      rec.lang = SPEECH_LANG_MAP[lang] || 'de-DE'
      rec.interimResults = false

      rec.onstart = () => {
        setIsRecording(true)
      }

      rec.onresult = (event) => {
        const transcript = event.results[0][0].transcript
        if (phase === 'result') {
          setChatInput(transcript)
        } else {
          setGoal(transcript)
        }
        setIsRecording(false)
      }

      rec.onerror = (e) => {
        console.error('Speech recognition error', e)
        setIsRecording(false)
      }

      rec.onend = () => {
        setIsRecording(false)
      }

      setRecognition(rec)
    }
  }, [lang, phase])

  const toggleRecording = () => {
    if (!recognition) {
      alert('Spracherkennung wird in diesem Browser nicht unterstützt.')
      return
    }
    if (isRecording) {
      recognition.stop()
    } else {
      recognition.start()
    }
  }

  const speakText = (text) => {
    if (!window.speechSynthesis) return
    window.speechSynthesis.cancel()
    
    // Clean raw text
    const cleanText = text.replace(/\{[\s\S]*\}/g, '').replace(/[*#`_-]/g, '').trim()
    
    const utterance = new SpeechSynthesisUtterance(cleanText)
    utterance.lang = SPEECH_LANG_MAP[lang] || 'de-DE'
    window.speechSynthesis.speak(utterance)
  }

  const stopSpeaking = () => {
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel()
    }
  }

  // Toggle reading aloud mode
  const toggleReadingAloud = () => {
    if (readingAloud) {
      stopSpeaking()
      setReadingAloud(false)
    } else {
      setReadingAloud(true)
      // Read aloud the last message if assistant spoke
      const lastMsg = chatHistory[chatHistory.length - 1]
      if (lastMsg && lastMsg.role === 'assistant') {
        speakText(lastMsg.content)
      }
    }
  }

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (phase === 'result' && isMobile) {
      setMobileStep('analysis');
    }
  }, [phase, isMobile]);

  const getMobileAnalysis = () => {
    const videoPlatform = results.tiktok || results.instagram || results.youtube || Object.values(results)[0]
    let hook = videoPlatform?.content?.hook
    let body = videoPlatform?.content?.body
    let cta = videoPlatform?.content?.cta

    // Fallback to localStorage if results content is not available
    if (!hook && !body && !cta) {
      hook = localStorage.getItem('hit_latest_hook') || ''
      body = localStorage.getItem('hit_latest_body') || ''
      cta = localStorage.getItem('hit_latest_cta') || ''
    }

    if (!hook && !body && !cta) return null

    const points = calculateDynamicCurveLocal(hook, body, cta)
    const average = points.reduce((sum, p) => sum + p, 0) / points.length
    const score = Math.max(5, Math.min(100, Math.round(average * 1.08)))

    const hookY = (150 - (points[3] * 1.5)).toFixed(1)
    const bodyY = (150 - (points[15] * 1.5)).toFixed(1)
    const ctaY = (150 - (points[30] * 1.5)).toFixed(1)

    const pathD = `M 0 0 C 15 0 15 ${hookY} 30 ${hookY} S 135 ${bodyY} 150 ${bodyY} S 285 ${ctaY} 300 ${ctaY}`
    const areaD = `${pathD} L 300 150 L 0 150 Z`

    const lights = getTrafficLightsLocal(hook, body, cta)

    return {
      score,
      points,
      hookY,
      bodyY,
      ctaY,
      pathD,
      areaD,
      lights
    }
  }

  function calculateDynamicCurveLocal(hookText, bodyText, ctaText) {
    const hookLen = (hookText || '').trim().length
    const bodyLen = (bodyText || '').trim().length
    const ctaLen = (ctaText || '').trim().length

    const points = new Array(31).fill(100)
    
    let hookVal = 95
    if (hookLen === 0 || hookLen > 130) {
      hookVal = 25
    } else if (hookLen > 90) {
      hookVal = 55
    }

    let bodyVal = 88
    if (bodyLen < 300 || bodyLen > 800) {
      bodyVal = 20
    } else if (bodyLen < 400 || bodyLen > 650) {
      bodyVal = 50
    }

    let ctaVal = 82
    if (ctaLen > 120) {
      ctaVal = 5
    } else if (ctaLen === 0) {
      ctaVal = 30
    } else {
      const ctaLower = ctaText.toLowerCase()
      if (ctaLower.includes('loop') || ctaLower.includes('anfang') || ctaLower.includes('und das')) {
        ctaVal = Math.min(95, bodyVal + 5)
      }
    }

    for (let i = 0; i <= 30; i++) {
      if (i === 0) {
        points[i] = 100
      } else if (i <= 3) {
        const pct = i / 3
        points[i] = Math.round(100 - (100 - hookVal) * pct)
      } else if (i <= 15) {
        const pct = (i - 3) / 12
        points[i] = Math.round(hookVal - (hookVal - bodyVal) * pct)
      } else if (i <= 27) {
        const pct = (i - 15) / 12
        points[i] = Math.round(bodyVal - (bodyVal - ctaVal) * pct)
      } else {
        const pct = (i - 27) / 3
        points[i] = Math.round(ctaVal)
      }
      points[i] = Math.max(1, Math.min(100, points[i]))
    }

    return points
  }

  function getTrafficLightsLocal(hookText, bodyText, ctaText) {
    const lights = []
    
    const hookLen = hookText.length
    if (hookLen === 0) {
      lights.push({ 
        type: 'red', 
        label: 'HOOK',
        text: '⚠️ Hook leer! Bitte füge einen Hook-Text hinzu.' 
      })
    } else if (hookLen > 130) {
      lights.push({ 
        type: 'red', 
        label: 'HOOK',
        text: '⚠️ Hook viel zu lang. Zuschauer scrollen sofort ab.' 
      })
    } else if (hookLen >= 90) {
      lights.push({ 
        type: 'yellow', 
        label: 'HOOK',
        text: '⚠️ Hook etwas lang. Versuche, die Kernaussage schneller zu bringen.' 
      })
    } else {
      lights.push({ 
        type: 'green', 
        label: 'HOOK',
        text: '✅ Hook hat eine ideale, knackige Länge!' 
      })
    }

    const bodyLen = bodyText.length
    if (bodyLen === 0) {
      lights.push({ 
        type: 'red', 
        label: 'HAUPTTEIL',
        text: '⚠️ Hauptteil leer. Bitte füge den Video-Inhalt ein.' 
      })
    } else if (bodyLen < 100 || bodyLen > 1000) {
      lights.push({ 
        type: 'red', 
        label: 'HAUPTTEIL',
        text: '⚠️ Hauptteil ungeeignet für optimale Retention (zu kurz oder zu überladen).' 
      })
    } else if (bodyLen >= 300 && bodyLen <= 800) {
      lights.push({ 
        type: 'green', 
        label: 'HAUPTTEIL',
        text: '✅ Hauptteil hat die optimale Pacing-Dichte!' 
      })
    } else {
      lights.push({ 
        type: 'yellow', 
        label: 'HAUPTTEIL',
        text: '⚠️ Hauptteil ist sehr kurz oder lang. Achte auf Pattern Interrupts.' 
      })
    }

    const ctaLen = ctaText.length
    if (ctaLen === 0) {
      lights.push({ 
        type: 'red', 
        label: 'CTA & LOOP',
        text: '⚠️ Kein CTA vorhanden. Die Zuschauer wissen nicht, was sie tun sollen.' 
      })
    } else if (ctaLen > 120) {
      lights.push({ 
        type: 'red', 
        label: 'CTA & LOOP',
        text: '⚠️ CTA viel zu lang. Zuschauer schalten vor dem Videoende ab.' 
      })
    } else if (ctaLen >= 60) {
      lights.push({ 
        type: 'yellow', 
        label: 'CTA & LOOP',
        text: '⚠️ CTA etwas lang. Vermeide langes Verabschieden.' 
      })
    } else {
      lights.push({ 
        type: 'green', 
        label: 'CTA & LOOP',
        text: '✅ CTA ist kurz und direkt!' 
      })
    }

    return lights
  }

  // Restore state from localStorage on mount (after navigating back from CapCut/Analytics)
  useEffect(() => {
    try {
      const saved = localStorage.getItem('hit_engine_state')
      if (saved) {
        const s = JSON.parse(saved)
        if (s.phase && s.phase !== 'input') {
          setPhase(s.phase)
          setGoal(s.goal || '')
          setAnalysis(s.analysis || null)
          setRecommendations(s.recommendations || [])
          setResults(s.results || {})
          setTopResults(s.topResults || {})
          setGeneratedMore(s.generatedMore || false)
          if (s.chatHistory) setChatHistory(s.chatHistory)
        }
        localStorage.removeItem('hit_engine_state')
      }
    } catch {}
  }, [])

  // Trigger interactive onboarding tour based on query params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('startTour') === 'true') {
      setTourActive(true)
      // Clean query params so it doesn't trigger repeatedly on reload
      navigate('/', { replace: true })
    }
  }, [navigate])

  // Auto-rotating ticker (every 4 seconds)
  useEffect(() => {
    if (phase !== 'input') return
    const interval = setInterval(() => {
      setTickerIndex((prev) => (prev + 1) % TICKER_ITEMS.length)
    }, 4000)
    return () => clearInterval(interval)
  }, [phase])

  // Auto-rotating duel (every 6 seconds)
  useEffect(() => {
    if (phase !== 'input') return
    const interval = setInterval(() => {
      setDuelIndex((prev) => (prev + 1) % DUEL_SETS.length)
    }, 6000)
    return () => clearInterval(interval)
  }, [phase])

  // Save state to localStorage before navigating away
  const saveStateAndNavigate = useCallback((path) => {
    const state = { phase, goal, analysis, recommendations, results, topResults, generatedMore, chatHistory }
    localStorage.setItem('hit_engine_state', JSON.stringify(state))
    navigate(path)
  }, [phase, goal, analysis, recommendations, results, topResults, generatedMore, chatHistory, navigate])

  const chips = GOAL_CHIPS[lang] || GOAL_CHIPS.de

  const handleChipClick = (chip) => {
    setGoal(chip.label)
  }

  const startAnalysis = async (overrideGoal) => {
    const activeGoal = typeof overrideGoal === 'string' ? overrideGoal : goal
    if (!activeGoal.trim()) return
    setPhase('analysis')
    setError('')
    setResults({})
    setTopResults({})
    trackEvent('hit_started', { goal: activeGoal.trim() })

    try {
      const chatEndpoint = getChatEndpoint()
      let token = ''
      try {
        const { data: { session } } = await supabase.auth.getSession()
        token = session?.access_token || ''
      } catch {}

      const analysisResult = await analyzeGoal(activeGoal.trim(), chatEndpoint, token, videoEditor, lang)
      setAnalysis(analysisResult)

      const recs = await generateRecommendations(activeGoal.trim(), analysisResult, chatEndpoint, token, videoEditor, lang)
      setRecommendations(recs)

      trackEvent('analysis_completed', { goal: activeGoal.trim(), contentScore: analysisResult.contentScore, videoEditor })

      setPhase('questions')
    } catch (err) {
      console.error('Analysis failed:', err)
      setError('Analyse fehlgeschlagen. Bitte versuche es erneut.')
      setPhase('input')
    }
  }

  const startGenerating = async (platformsToGenerate) => {
    setPhase('generating')
    setProgress({})

    try {
      const chatEndpoint = getChatEndpoint()
      let token = ''
      try {
        const { data: { session } } = await supabase.auth.getSession()
        token = session?.access_token || ''
      } catch {}

      const masterBrief = buildMasterBriefFromAnalysis(analysis)

      const newResults = { ...results }

      for (const platformKey of platformsToGenerate) {
        const result = await runPlatformAgent(platformKey, goal, masterBrief, chatEndpoint, token, videoEditor, lang)
        if (result) {
          newResults[platformKey] = result
          setResults({ ...newResults })
        }
        setProgress(prev => ({ ...prev, [platformKey]: 'done' }))
      }
      console.log('[startGenerating] promises resolved. newResults keys:', Object.keys(newResults))

      const top3 = analysis.topPlatforms || Object.keys(newResults).slice(0, 3)
      const top = {}
      top3.forEach(key => {
        if (newResults[key]) top[key] = newResults[key]
      })
      setTopResults(top)

      const videoPlatform = newResults.tiktok || newResults.instagram || newResults.youtube || Object.values(newResults)[0]
      const contentPayload = videoPlatform?.content
      if (contentPayload) {
        localStorage.setItem('hit_latest_hook', contentPayload.hook || '')
        localStorage.setItem('hit_latest_body', contentPayload.body || '')
        localStorage.setItem('hit_latest_cta', contentPayload.cta || '')
      }

      const introMessage = `Hallo! Ich habe die ideale Video-Strategie für deinen Ziel-Fokus "${goal.trim()}" erstellt. Ich habe eine fesselnde Anekdote recherchiert und als psychologische Metapher eingebaut. Schau dir das fertige Skript rechts an! Möchtest du, dass ich Anpassungen vornehme oder den Tonfall verändere?`
      setChatHistory([
        { role: 'assistant', content: introMessage }
      ])

      setPhase('result')
      trackEvent('package_received', { goal: goal.trim(), platformCount: platformsToGenerate.length })
    } catch (err) {
      console.error('Generation failed:', err)
      setError('Content-Erstellung fehlgeschlagen. Bitte versuche es erneut.')
      setPhase('questions')
    }
  }

  const refineScript = async (userInstruction) => {
    if (!userInstruction.trim()) return

    const updatedHistory = [...chatHistory, { role: 'user', content: userInstruction }]
    setChatHistory(updatedHistory)
    setChatInput('')
    setPhase('refining')
    
    try {
      const activePlatform = Object.keys(topResults)[0] || 'tiktok'
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token || ''
      const chatEndpoint = getChatEndpoint()

      const currentScript = results[activePlatform]?.content || { hook: '', body: '', cta: '' }
      const currentScriptJson = JSON.stringify(currentScript, null, 2)

      const languageNames = {
        de: 'Deutsch (German)',
        en: 'Englisch (English)',
        es: 'Spanisch (Español)',
        fr: 'Französisch (Français)',
        it: 'Italienisch (Italiano)',
        nl: 'Niederländisch (Nederlands)',
        el: 'Griechisch (Greek/Ελληνικά)'
      }
      const langName = languageNames[lang] || 'Deutsch (German)'
      const langInstruction = `\n\nCRITICAL REQUIREMENT: The user's language is ${langName}. All generated content (including text, hooks, descriptions, titles, explanations, suggestions, and responses) MUST be written in ${langName}. Do not translate structural JSON keys, but write all their string values and any conversational explanations/dialogue in ${langName}.`

      const systemPrompt = `Du bist der H.I.T. Co-Pilot. Deine Aufgabe ist es, das bestehende Skript basierend auf den Wünschen des Nutzers anzupassen.

Aktuelles Skript (JSON):
${currentScriptJson}

BENUTZER-ANWEISUNG FÜR DIE ANPASSUNG:
"${userInstruction}"

### Richtlinien für die Antwort:
1. Passe das Skript im Hauptteil (Body), Hook oder CTA entsprechend der Benutzer-Anweisung an.
2. Behalte die strengen Qualitätsregeln der Creator Academy bei (120-Wörter-Limit, Metaphern-Brücke, keine Floskeln, visuelle Sync-Regie-Anweisungen).
3. Gib deine Antwort als strukturiertes JSON-Objekt zurück mit genau diesen Feldern:
{
  "hook": "...",
  "body": "...",
  "cta": "...",
  "imageIdea": "..."
}
Erkläre kurz davor oder danach im Text, was du geändert hast, sodass die Antwort sowohl den Dialog als auch das JSON-Skript enthält.` + langInstruction

      const response = await fetch(chatEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          message: `Passe das Skript an basierend auf: ${userInstruction}`,
          systemPrompt,
          history: [],
          videoEditor
        }),
      })

      if (!response.ok) throw new Error('Refinement failed')
      const data = await response.json()
      
      const parsed = parsePlatformResult(data.response)
      
      let explanation = data.response.replace(/\\{[\\s\\S]*\\}/, '').trim()
      if (!explanation) {
        explanation = "Ich habe das Skript angepasst! Die Aktualisierungen siehst du in der Vorschau rechts."
      }
      
      const newResults = { ...results }
      newResults[activePlatform] = {
        ...newResults[activePlatform],
        content: parsed,
        raw: data.response
      }
      setResults(newResults)
      
      const newTop = { ...topResults }
      if (newTop[activePlatform]) {
        newTop[activePlatform] = newResults[activePlatform]
        setTopResults(newTop)
      }
      
      localStorage.setItem('hit_latest_hook', parsed.hook || '')
      localStorage.setItem('hit_latest_body', parsed.body || '')
      localStorage.setItem('hit_latest_cta', parsed.cta || '')
      
      setChatHistory([...updatedHistory, { role: 'assistant', content: explanation }])
      
      if (readingAloud) {
        speakText(explanation)
      }
    } catch (err) {
      console.error(err)
      setError('Anpassung fehlgeschlagen. Bitte versuche es erneut.')
      setChatHistory([...updatedHistory, { role: 'assistant', content: 'Es gab leider einen Fehler bei der Anpassung. Bitte versuche es noch einmal!' }])
    } finally {
      setPhase('result')
    }
  }

  const handleStart = () => {
    if (Object.keys(results).length > 0) {
      setPhase('result')
      return
    }
    const top3 = analysis?.topPlatforms || ['instagram', 'facebook', 'linkedin']
    startGenerating(top3)
  }

  const handleGenerateMore = async () => {
    setGeneratedMore(true)
    trackEvent('more_platforms_generated', { goal: goal.trim() })
    const allKeys = getAllPlatforms().map(p => p.key)
    const alreadyGenerated = Object.keys(results)
    const remaining = allKeys.filter(k => !alreadyGenerated.includes(k))
    await startGenerating(remaining)
  }

  const handleGenerateSingle = async (platformKey) => {
    setGeneratingSingle(platformKey)
    try {
      const chatEndpoint = getChatEndpoint()
      let token = ''
      try {
        const { data: { session } } = await supabase.auth.getSession()
        token = session?.access_token || ''
      } catch {}
      const masterBrief = buildMasterBriefFromAnalysis(analysis)
      const result = await runPlatformAgent(platformKey, goal, masterBrief, chatEndpoint, token, videoEditor, lang)
      if (result) {
        setResults(prev => ({ ...prev, [platformKey]: result }))
        const contentPayload = result?.content
        if (contentPayload && ['tiktok', 'instagram', 'youtube'].includes(platformKey)) {
          localStorage.setItem('hit_latest_hook', contentPayload.hook || '')
          localStorage.setItem('hit_latest_body', contentPayload.body || '')
          localStorage.setItem('hit_latest_cta', contentPayload.cta || '')
        }
      }
    } catch (err) {
      console.error('Single generation failed:', err)
    }
    setGeneratingSingle(null)
  }

  const copyToClipboard = (text, platform = 'all', r = null) => {
    navigator.clipboard.writeText(text)
    trackEvent('content_copied', { platform })
    if (r && r.content) {
      const c = r.content
      localStorage.setItem('hit_latest_hook', c.hook || '')
      localStorage.setItem('hit_latest_body', c.body || '')
      localStorage.setItem('hit_latest_cta', c.cta || '')
    }
  }

  const copyAllTop3 = () => {
    const allText = Object.values(topResults)
      .filter(r => r && r.content)
      .map(r => {
        const c = r.content
        return `${r.icon} ${r.name}\n\n${c.hook ? c.hook + '\n\n' : ''}${c.body || ''}${c.cta ? '\n\n' + c.cta : ''}${c.hashtags?.length ? '\n\n' + c.hashtags.map(h => h.startsWith('#') ? h : '#' + h).join(' ') : ''}`
      }).join('\n\n---\n\n')
    copyToClipboard(allText)
    setCopiedAll(true)
    setTimeout(() => setCopiedAll(false), 2000)
  }

  const getResultText = (r) => {
    const c = r?.content
    if (!c) return ''
    return `${c.hook ? c.hook + '\n\n' : ''}${c.body || ''}${c.cta ? '\n\n' + c.cta : ''}${c.hashtags?.length ? '\n\n' + c.hashtags.map(h => h.startsWith('#') ? h : '#' + h).join(' ') : ''}`
  }

  const getFootageSources = (r, goalText) => {
    if (r?.content?.footageSources && r.content.footageSources.length > 0) {
      return r.content.footageSources
    }
    let queryText = goalText || analysis?.goal || ''
    if (!queryText.trim() && r?.content) {
      const textToExtractFrom = r.content.imageIdea || r.content.hook || r.content.body || ''
      const words = textToExtractFrom.split(/\s+/).filter(w => w.length > 3).slice(0, 3)
      if (words.length > 0) {
        queryText = words.join(' ')
      }
    }
    if (!queryText.trim()) {
      queryText = GENERIC_VIDEO_FALLBACKS[lang] || 'Creative video'
    }

    // Translate/optimize for stock platforms if language is not English
    let stockQueryText = queryText
    if (lang !== 'en') {
      const lower = queryText.toLowerCase()
      const STOCK_TRANSLATIONS = {
        'fußballkuriositäten': 'funny football soccer bloopers',
        'fussballkuriositäten': 'funny football soccer bloopers',
        'fußball': 'soccer football',
        'fussball': 'soccer football',
        'kunden': 'business clients meeting success',
        'verkauf': 'product showcase e-commerce sales',
        'community': 'people connection community handshake',
        'event': 'concert party crowd event',
        'mitarbeiter': 'teamwork office hiring',
        'bewerb': 'job interview resume',
        'fitness': 'fitness gym workout',
        'kochen': 'cooking kitchen food recipe',
        'essen': 'food cooking dining',
        'reise': 'travel adventure destination',
        'natur': 'nature landscape forest'
      }
      for (const [key, value] of Object.entries(STOCK_TRANSLATIONS)) {
        if (lower.includes(key)) {
          stockQueryText = value
          break
        }
      }
    }

    const query = encodeURIComponent(queryText)
    const stockQuery = encodeURIComponent(stockQueryText)

    return [
      {
        platform: 'YouTube',
        query: queryText,
        url: `https://www.youtube.com/results?search_query=${query}`
      },
      {
        platform: 'TikTok',
        query: queryText,
        url: `https://www.tiktok.com/search?q=${query}`
      },
      {
        platform: 'Pexels (Stock)',
        query: stockQueryText,
        url: `https://www.pexels.com/search/video/${stockQuery}`
      },
      {
        platform: 'Pixabay (Stock)',
        query: stockQueryText,
        url: `https://pixabay.com/de/videos/search/${stockQuery}`
      }
    ]
  }

  const handleTourStepAction = (stepIndex, direction) => {
    if (direction === 'next') {
      if (stepIndex === 0 && phase === 'input') {
        const sample = 'Fußball-Fails'
        setGoal(sample)
        startAnalysis(sample)
      } else if (stepIndex === 1 && phase === 'questions') {
        handleStart()
      }
    }
  }

  const allPlatforms = getAllPlatforms()
  const generatedPlatforms = Object.keys(results)
  const top3Keys = analysis?.topPlatforms || []
  const hasGeneratedScript = Object.keys(results).length > 0 || !!localStorage.getItem('hit_latest_body')

  return (
    <div className="platform-engine">
      {error && (
        <div className="pe-error-banner" style={{
          background: 'var(--color-koralle, #d85a30)',
          color: '#ffffff',
          padding: '0.75rem 1rem',
          borderRadius: '10px',
          marginBottom: '1rem',
          fontSize: '0.9rem',
          fontWeight: '600',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          animation: 'peFadeIn 0.3s ease'
        }}>
          <span>⚠️ {error}</span>
          <button 
            onClick={() => setError('')} 
            style={{ background: 'none', border: 'none', color: '#ffffff', cursor: 'pointer', fontSize: '1.1rem', padding: '0 0.5rem' }}
          >
            ×
          </button>
        </div>
      )}
      {/* Mobile Wizard Navigation */}
      <div className="pe-mobile-wizard-nav">
        <button
          className={`pe-wizard-tab ${mobileStep === 'input' ? 'active' : ''}`}
          onClick={() => setMobileStep('input')}
        >
          1. Text
        </button>
        <button
          className={`pe-wizard-tab ${mobileStep === 'analysis' ? 'active' : ''}`}
          onClick={() => {
            if (hasGeneratedScript) {
              setMobileStep('analysis');
            }
          }}
          disabled={!hasGeneratedScript}
        >
          2. Analyse
        </button>
        <button
          className={`pe-wizard-tab ${mobileStep === 'studio' ? 'active' : ''}`}
          onClick={() => {
            if (hasGeneratedScript) {
              setMobileStep('studio');
            }
          }}
          disabled={!hasGeneratedScript}
        >
          3. Studio
        </button>
      </div>

      {/* RENDER INHALT FÜR SMARTPHONES */}
      {isMobile ? (
        <>
          {/* STEP 1: INPUT / LOADERS */}
          {mobileStep === 'input' && (
            <div className="pe-mobile-input-step">
              {(phase === 'input' || phase === 'result' || phase === 'refining') && (
                <div className="pe-input-phase">
                  <div className="pe-main-layout">
                    {/* On mobile input step, we only show the right column */}
                    <div className="pe-right-column">
                      <div className="pe-hero">
                        <div className="pe-title-row" style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                          <VerticalLogo size="small" />
                          <button className="pe-info-btn" onClick={() => setShowInfo(true)} aria-label="Info" style={{ marginLeft: 'auto' }}>
                            <Info size={18} />
                          </button>
                        </div>
                        <div className="pe-header-container" style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px', marginTop: '6px' }}>
                          <p className="pe-subtitle" style={{ margin: 0 }}>{t('landing.tagline')}</p>
                          <span 
                            className="new-feature-badge" 
                            title={t('newFeatures.researchTooltip')}
                            style={{
                              fontSize: '9px',
                              fontWeight: '700',
                              background: 'var(--color-koralle, #d85a30)',
                              color: '#ffffff',
                              padding: '2px 6px',
                              borderRadius: '4px',
                              letterSpacing: '0.5px',
                              cursor: 'help',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}
                          >
                            {t('newFeatures.new')} (Recherche ℹ️)
                          </span>
                        </div>
                      </div>

                      <div className="pe-input-wrap">
                        <textarea
                          ref={goalMobileRef}
                          className="pe-input"
                          style={{ resize: 'none', overflowY: 'hidden', height: 'auto', minHeight: '46px', maxHeight: '200px', lineHeight: '1.4' }}
                          rows={1}
                          value={goal}
                          onChange={(e) => {
                            setGoal(e.target.value);
                            e.target.style.height = 'auto';
                            e.target.style.height = `${e.target.scrollHeight}px`;
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                              e.preventDefault();
                              startAnalysis();
                            }
                          }}
                          placeholder={t('landing.placeholder')}
                        />
                        <button
                          className="btn btn-primary pe-start-btn"
                          onClick={startAnalysis}
                          disabled={!goal.trim()}
                        >
                          <Sparkles size={16} /> H.I.T. starten
                        </button>
                      </div>

                      <div className="pe-suggestions">
                        <p className="pe-suggestions-title">{t('landing.suggestionsTitle')}</p>
                        <div className="pe-chips">
                          {chips.map((chip) => (
                            <button
                              key={chip.label}
                              className="pe-chip"
                              onClick={() => handleChipClick(chip)}
                            >
                              <span className="pe-chip-icon">{chip.icon}</span>
                              <span className="pe-chip-label">{chip.label}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {phase === 'analysis' && (
                <div className="pe-card pe-analysis-card">
                  <div className="pe-card-header">
                    <div className="pe-brand"><span className="pe-brand-h">H</span>.I.T.</div>
                    <span className="pe-status">{t('landing.analyzing')}</span>
                  </div>
                  <div className="pe-analysis-steps">
                    <div className="pe-step done"><Check size={14} /> {t('landing.stepGoal')}</div>
                    <div className="pe-step active"><span className="pe-spinner" /> {t('landing.stepStrategy')}</div>
                    <div className="pe-step"><span className="pe-step-num">3</span> {t('landing.stepContent')}</div>
                  </div>
                </div>
              )}

              {phase === 'questions' && analysis && (
                <div className="pe-card pe-question-card">
                  <div className="pe-card-header">
                    <div className="pe-brand"><span className="pe-brand-h">H</span>.I.T.</div>
                    <span className="pe-status">{t('landing.analyzing')}</span>
                  </div>

                  <div className="pe-score-grid">
                    <div className="pe-score-item">
                      <span className="pe-score-label">{t('landing.goalDetected')}</span>
                      <span className="pe-score-value done">✅</span>
                    </div>
                    <div className="pe-score-item">
                      <span className="pe-score-label">{t('landing.strategyCreated')}</span>
                      <span className="pe-score-value done">✅</span>
                    </div>
                    <div className="pe-score-item">
                      <span className="pe-score-label">{t('landing.contentChance')}</span>
                      <span className="pe-score-value highlight">{analysis.contentScore}%</span>
                    </div>
                    <div className="pe-score-item">
                      <span className="pe-score-label">{t('landing.savedTime')}</span>
                      <span className="pe-score-value">{analysis.savedTime}</span>
                    </div>
                  </div>

                  <div className="pe-recommended">
                    <p className="pe-recommended-title">{t('platformEngine.recommended')}</p>
                    <div className="pe-recommended-list">
                      {top3Keys.map((key, i) => (
                        <span key={key} className="pe-recommended-item">
                          {i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉'} {getAgentName(key)}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="pe-question-actions">
                    <button className="btn btn-primary" onClick={handleStart}>
                      <Sparkles size={16} /> Weiter
                    </button>
                  </div>
                </div>
              )}

              {phase === 'generating' && (
                <div className="pe-card pe-generating-card">
                  <div className="pe-card-header">
                    <div className="pe-brand"><span className="pe-brand-h">H</span>.I.T.</div>
                    <span className="pe-status">{t('platformEngine.generating')}</span>
                  </div>

                  <div className="pe-progress-bar">
                    <div
                      className="pe-progress-fill"
                      style={{ width: `${(Object.keys(progress).length / (analysis?.topPlatforms?.length || 3)) * 100}%` }}
                    />
                  </div>

                  <div className="pe-progress-list">
                    {top3Keys.map((key) => (
                      <div key={key} className={`pe-progress-item ${progress[key] === 'done' ? 'done' : 'active'}`}>
                        {progress[key] === 'done' ? <Check size={14} /> : <span className="pe-spinner-small" />}
                        <span>{getAgentIcon(key)} {getAgentName(key)}</span>
                        {progress[key] === 'done' ? <span className="pe-progress-status">fertig</span> : <span className="pe-progress-status">wird erstellt...</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STEP 2: DYNAMIC SVG CURVE, SCORE & TRAFFIC LIGHTS */}
          {mobileStep === 'analysis' && (() => {
            const analysisData = getMobileAnalysis();
            if (!analysisData) {
              return (
                <div className="pe-card pe-mobile-analysis-card" style={{ padding: '2rem', textAlign: 'center', background: 'rgba(255,255,255,0.85)', border: '1px solid var(--border)', borderRadius: '16px' }}>
                  <p style={{ margin: 0, color: 'var(--text-muted)' }}>Keine Analyse-Daten vorhanden. Bitte erstelle zuerst einen Text in Schritt 1.</p>
                </div>
              );
            }
            return (
              <div className="pe-card pe-mobile-analysis-card" style={{ padding: '1.5rem', borderRadius: '16px', background: 'rgba(255,255,255,0.85)', border: '1px solid var(--border)', boxShadow: '0 4px 24px rgba(0,0,0,0.05)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                  <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800 }}>Zuschauerbindung</h3>
                  <div className="retention-score-badge" style={{
                    background: 'rgba(29, 158, 117, 0.1)',
                    color: '#1d9e75',
                    padding: '4px 10px',
                    borderRadius: '8px',
                    fontSize: '0.88rem',
                    fontWeight: 700
                  }}>
                    Score: {analysisData.score}/100
                  </div>
                </div>

                <div className="svg-chart-container" style={{ marginBottom: '1.5rem' }}>
                  <div className="chart-viewport" style={{ background: '#f8fafc', borderRadius: '12px', padding: '10px', position: 'relative' }}>
                    <svg viewBox="0 0 300 150" preserveAspectRatio="none" style={{ width: '100%', height: '120px' }}>
                      <defs>
                        <linearGradient id="retention-gradient-mobile" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#1d9e75" stopOpacity="0.3" />
                          <stop offset="100%" stopColor="#1d9e75" stopOpacity="0.0" />
                        </linearGradient>
                      </defs>
                      <line x1="0" y1="75" x2="300" y2="75" stroke="#e2e8f0" strokeDasharray="3" />
                      <line x1="30" y1="0" x2="30" y2="150" stroke="#e2e8f0" strokeDasharray="2" />
                      <line x1="270" y1="0" x2="270" y2="150" stroke="#e2e8f0" strokeDasharray="2" />
                      <path d={analysisData.areaD} fill="url(#retention-gradient-mobile)" />
                      <path d={analysisData.pathD} fill="none" stroke="#1d9e75" strokeWidth="2.5" />
                      <circle cx="30" cy={analysisData.hookY} r="4" fill="#166534" />
                      <circle cx="150" cy={analysisData.bodyY} r="4" fill="#166534" />
                      <circle cx="300" cy={analysisData.ctaY} r="4" fill="#166534" />
                    </svg>
                  </div>
                </div>

                <div className="social-traffic-lights" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {analysisData.lights.map((light, i) => (
                    <div key={i} className={`traffic-light-card ${light.type}`} style={{
                      padding: '10px 12px',
                      borderRadius: '10px',
                      background: light.type === 'green' ? 'rgba(29, 158, 117, 0.08)' : light.type === 'yellow' ? 'rgba(245, 158, 11, 0.08)' : 'rgba(220, 38, 38, 0.08)',
                      borderLeft: `4px solid ${light.type === 'green' ? '#1d9e75' : light.type === 'yellow' ? '#f59e0b' : '#dc2626'}`
                    }}>
                      <span className="tl-label" style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', display: 'block', color: '#64748b' }}>{light.label}</span>
                      <span className="tl-text" style={{ fontSize: '0.85rem', color: 'var(--text)' }}>{light.text}</span>
                    </div>
                  ))}
                </div>

                <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'stretch' }}>
                  <button
                    className="btn btn-primary"
                    onClick={() => setMobileStep('studio')}
                    style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', padding: '0.88rem' }}
                  >
                    <span>Weiter zum Studio</span>
                    <ArrowRight size={16} />
                  </button>
                </div>
              </div>
            );
          })()}

          {/* STEP 3: STUDIO RESULTS SCREEN */}
          {mobileStep === 'studio' && (phase === 'result' || phase === 'refining') && (
            <div className="pe-result-phase">
              <div className="pe-result-header">
                <h2 className="pe-result-title">✨ {t('platformEngine.resultTitle')}</h2>
                <p className="pe-result-subtitle">
                  {goal} · {top3Keys.length} Plattformen erstellt
                </p>
              </div>

              <div className="pe-copilot-workspace">
                {/* LINKE SPALTE: Co-Pilot Chatverlauf */}
                <div className="pe-copilot-chat-card">
                  <div className="pe-chat-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', borderBottom: '1px solid var(--border, #e5e7eb)', paddingBottom: '0.75rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ fontSize: '1.25rem' }}>🤖</span>
                      <div>
                        <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: '700' }}>H.I.T. Co-Pilot</h3>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted, #6b7280)' }}>Online</span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '0.25rem' }}>
                      <button 
                        className={`pe-chat-btn ${readingAloud ? 'active-audio' : ''}`} 
                        onClick={toggleReadingAloud}
                        title={readingAloud ? "Vorlesen deaktivieren" : "Antworten laut vorlesen"}
                      >
                        {readingAloud ? <Volume2 size={18} /> : <VolumeX size={18} />}
                      </button>
                    </div>
                  </div>

                  <div className="pe-chat-history">
                    {chatHistory.map((msg, idx) => (
                      <div key={idx} className={`pe-chat-message ${msg.role}`}>
                        {msg.content}
                      </div>
                    ))}
                    {phase === 'refining' && (
                      <div className="pe-chat-message assistant" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span className="pe-spinner-small" />
                        <span>H.I.T. überarbeitet das Skript...</span>
                      </div>
                    )}
                  </div>

                  <div className="pe-copilot-input-area">
                    <form 
                      onSubmit={(e) => {
                        e.preventDefault()
                        refineScript(chatInput)
                      }}
                      className="pe-chat-input-bar"
                    >
                      <button
                        type="button"
                        className={`pe-chat-btn ${isRecording ? 'recording' : ''}`}
                        onClick={toggleRecording}
                        title="Per Sprache eingeben"
                      >
                        {isRecording ? <MicOff size={18} /> : <Mic size={18} />}
                      </button>
                      <textarea
                        ref={chatMobileRef}
                        className="pe-chat-input"
                        style={{ resize: 'none', overflowY: 'hidden', height: 'auto', minHeight: '38px', maxHeight: '150px', lineHeight: '1.4', paddingTop: '8px', paddingBottom: '8px' }}
                        rows={1}
                        placeholder="Wie soll ich das Skript anpassen?"
                        value={chatInput}
                        onChange={(e) => {
                          setChatInput(e.target.value);
                          e.target.style.height = 'auto';
                          e.target.style.height = `${e.target.scrollHeight}px`;
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            refineScript(chatInput);
                          }
                        }}
                        disabled={phase === 'refining'}
                      />
                      <button
                        type="submit"
                        className="pe-chat-btn pe-chat-btn-primary"
                        disabled={!chatInput.trim() || phase === 'refining'}
                        title="Senden"
                      >
                        <Send size={16} />
                      </button>
                    </form>
                  </div>
                </div>

                {/* RECHTE SPALTE: Live-Skript-Vorschau */}
                <div className="pe-copilot-preview-card">
                  <div className="pe-preview-header" style={{ marginBottom: '1rem', borderBottom: '1px solid var(--border, #e5e7eb)', paddingBottom: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                    <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: '700' }}>🎬 Aktuelles Skript</h3>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span className="pe-platform-badge" style={{ background: 'var(--color-mint, #10b981)', color: '#fff', fontSize: '9px', fontWeight: '700', padding: '2px 6px', borderRadius: '4px', textTransform: 'uppercase' }}>
                        TikTok / Short
                      </span>
                      {(() => {
                        const activePlatform = Object.keys(topResults)[0] || 'tiktok'
                        const r = topResults[activePlatform]
                        if (!r || !r.content) return null
                        const isCopied = copiedPlatform === activePlatform
                        return (
                          <button
                            className={`pe-copy-btn ${isCopied ? 'pe-copy-btn-done' : ''}`}
                            onClick={() => {
                              copyToClipboard(getResultText(r), activePlatform, r)
                              setCopiedPlatform(activePlatform)
                              setTimeout(() => setCopiedPlatform(null), 2000)
                            }}
                            style={{
                              padding: '2px 8px',
                              fontSize: '11px',
                              fontWeight: '600',
                              borderRadius: '6px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              background: isCopied ? 'var(--color-mint-light, #ecfdf5)' : 'var(--bg-secondary, #f3f4f6)',
                              color: isCopied ? 'var(--color-mint, #059669)' : 'var(--text-muted, #4b5563)',
                              border: '1px solid var(--border, #e5e7eb)',
                              cursor: 'pointer'
                            }}
                          >
                            {isCopied ? <><Check size={12} /> Kopiert!</> : <><Copy size={12} /> Kopieren</>}
                          </button>
                        )
                      })()}
                    </div>
                  </div>

                  <div className="pe-preview-section">
                    {(() => {
                      const activePlatform = Object.keys(topResults)[0] || 'tiktok'
                      const r = topResults[activePlatform]
                      if (!r || !r.content) return <p>Kein Skript vorhanden.</p>
                      return (
                        <>
                          {r.content.hook && (
                            <div className="pe-preview-block">
                              <div className="pe-preview-title">Hook (0-3s)</div>
                              <p className="pe-preview-content">{r.content.hook}</p>
                            </div>
                          )}
                          {r.content.body && (
                            <div className="pe-preview-block">
                              <div className="pe-preview-title">Hauptteil (Body & Metapher)</div>
                              <p className="pe-preview-content">{r.content.body}</p>
                            </div>
                          )}
                          {r.content.cta && (
                            <div className="pe-preview-block">
                              <div className="pe-preview-title">CTA & Loop (12-15s)</div>
                              <p className="pe-preview-content">{r.content.cta}</p>
                            </div>
                          )}
                          {r.content.imageIdea && (
                            <div className="pe-preview-block" style={{ borderLeftColor: 'var(--color-koralle, #d85a30)' }}>
                              <div className="pe-preview-title" style={{ color: 'var(--color-koralle, #d85a30)' }}>Visualisierungsidee / B-Roll</div>
                              <p className="pe-preview-content">{r.content.imageIdea}</p>
                            </div>
                          )}
                          <div className="pe-preview-block" style={{ borderLeftColor: 'var(--color-mint, #10b981)', background: 'var(--bg-secondary, #f9fafb)', padding: '12px', borderRadius: '8px', marginTop: '12px' }}>
                            <div className="pe-preview-title" style={{ color: 'var(--color-mint, #059669)', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.88rem', fontWeight: '700' }}>
                              🎥 Video-Quellen & Footage finden
                            </div>
                            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted, #6b7280)', margin: '4px 0 10px 0', lineHeight: '1.4' }}>
                              Passendes Footage für deine Szenen suchen und herunterladen:
                            </p>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                              {getFootageSources(r, goal).map((src, sIdx) => {
                                let icon = '🔗'
                                if (src.platform.toLowerCase().includes('youtube')) icon = '▶️'
                                if (src.platform.toLowerCase().includes('tiktok')) icon = '🎵'
                                if (src.platform.toLowerCase().includes('pexels') || src.platform.toLowerCase().includes('pixabay')) icon = '📹'
                                return (
                                  <a
                                    key={sIdx}
                                    href={src.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    style={{
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '6px',
                                      padding: '6px 12px',
                                      fontSize: '0.78rem',
                                      fontWeight: '600',
                                      background: '#ffffff',
                                      color: 'var(--text, #374151)',
                                      border: '1px solid var(--border, #e5e7eb)',
                                      borderRadius: '6px',
                                      textDecoration: 'none',
                                      transition: 'all 0.2s ease',
                                      boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                                    }}
                                    onMouseOver={(e) => {
                                      e.currentTarget.style.background = 'var(--bg-secondary, #f3f4f6)'
                                      e.currentTarget.style.borderColor = 'var(--text-muted, #9ca3af)'
                                    }}
                                    onMouseOut={(e) => {
                                      e.currentTarget.style.background = '#ffffff'
                                      e.currentTarget.style.borderColor = 'var(--border, #e5e7eb)'
                                    }}
                                  >
                                    <span>{icon}</span>
                                    <span>{src.platform}: <strong style={{ color: 'var(--color-koralle, #d85a30)' }}>"{src.query}"</strong></span>
                                  </a>
                                )
                              })}
                            </div>
                            <p style={{ fontSize: '0.68rem', color: 'var(--text-muted, #9ca3af)', marginTop: '8px', lineHeight: '1.3' }}>
                              {lang === 'de' 
                                ? 'Hinweis: H.I.T. verlinkt auf externe Suchergebnisse. Bitte beachte die Urheberrechte und Nutzungsbedingungen der jeweiligen Plattformen.' 
                                : 'Note: H.I.T. links to external search results. Please respect the copyright and terms of service of the respective platforms.'}
                            </p>
                          </div>
                        </>
                      )
                    })()}
                  </div>

                  <NextActionHub
                    onOpenCapCut={() => {
                      trackLandingFunnel('post_result_action', { action: 'capcut' })
                      saveStateAndNavigate('/capcut-studio')
                    }}
                    onTrackAnalytics={() => {
                      trackLandingFunnel('post_result_action', { action: 'tracking' })
                      saveStateAndNavigate('/analytics')
                    }}
                    onReset={() => {
                      trackLandingFunnel('post_result_action', { action: 'reset' })
                      setPhase('input')
                      setGoal('')
                      setResults({})
                      setTopResults({})
                      setRecommendations([])
                      setProgress({})
                      setMobileStep('input')
                      setChatHistory([])
                      localStorage.removeItem('hit_latest_hook')
                      localStorage.removeItem('hit_latest_body')
                      localStorage.removeItem('hit_latest_cta')
                    }}
                  />
                </div>
              </div>
            </div>
          )}
        </>
      ) : (
        /* RENDER INHALT FÜR DESKTOP-BILDSCHIRME (> 768px) */
        <>
          {/* Phase: INPUT */}
          {phase === 'input' && (
            <div className="pe-input-phase">
              <div className="pe-main-layout">
                {/* Left Column: Glassmorphism Ticker */}
                <div className="pe-left-column">
                  <div className="pe-ticker-widget">
                    <div key={tickerIndex} className="pe-ticker-content pe-ticker-fade">
                      <div className="pe-ticker-header">
                        <span className="pe-ticker-icon">{TICKER_ITEMS[tickerIndex].icon}</span>
                        <span className="pe-ticker-badge">H.I.T. Power</span>
                      </div>
                      <div className="pe-ticker-text">
                        <p className="pe-ticker-question">{TICKER_ITEMS[tickerIndex].question}</p>
                        <p className="pe-ticker-solution">{TICKER_ITEMS[tickerIndex].solution}</p>
                      </div>
                    </div>
                    <div className="pe-ticker-dots">
                      {TICKER_ITEMS.map((_, i) => (
                        <span
                          key={i}
                          className={`pe-ticker-dot ${i === tickerIndex ? 'active' : ''}`}
                          onClick={() => setTickerIndex(i)}
                        />
                      ))}
                    </div>
                  </div>

                  <div className="pe-duel-widget">
                    <div className="pe-duel-header">
                      <span className="pe-duel-icon">⚡</span>
                      <span className="pe-duel-title">Vergleichs-Duell: {DUEL_SETS[duelIndex].title}</span>
                    </div>
                    <div className="pe-duel-grid">
                      <div className="pe-duel-column pe-duel-bad">
                        <span className="pe-duel-badge">Klassisch / KI-Standard</span>
                        <p className="pe-duel-text">{DUEL_SETS[duelIndex].bad}</p>
                      </div>
                      <div className="pe-duel-column pe-duel-good">
                        <span className="pe-duel-badge">Gut formuliert</span>
                        <p className="pe-duel-text">{DUEL_SETS[duelIndex].good}</p>
                      </div>
                      <div className="pe-duel-column pe-duel-hit">
                        <span className="pe-duel-badge">H.I.T. Magie ✨</span>
                        <p className="pe-duel-text">{DUEL_SETS[duelIndex].hit}</p>
                      </div>
                    </div>
                    <div className="pe-duel-dots">
                      {DUEL_SETS.map((_, i) => (
                        <span
                          key={i}
                          className={`pe-duel-dot ${i === duelIndex ? 'active' : ''}`}
                          onClick={() => setDuelIndex(i)}
                        />
                      ))}
                    </div>
                  </div>
                </div>

                {/* Right Column: Main Hero and Form Input */}
                <div className="pe-right-column">
                  <div className="pe-hero">
                    <div className="pe-title-row" style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                      <VerticalLogo size="small" />
                      <button className="pe-info-btn" onClick={() => setShowInfo(true)} aria-label="Info" style={{ marginLeft: 'auto' }}>
                        <Info size={18} />
                      </button>
                    </div>
                    <div className="pe-header-container" style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px', marginTop: '6px' }}>
                      <p className="pe-subtitle" style={{ margin: 0 }}>{t('landing.tagline')}</p>
                      <span 
                        className="new-feature-badge" 
                        title={t('newFeatures.researchTooltip')}
                        style={{
                          fontSize: '9px',
                          fontWeight: '700',
                          background: 'var(--color-koralle, #d85a30)',
                          color: '#ffffff',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          letterSpacing: '0.5px',
                          cursor: 'help',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}
                      >
                        {t('newFeatures.new')} (Recherche ℹ️)
                      </span>
                    </div>
                  </div>

                  <div className="pe-input-wrap">
                    <textarea
                      ref={goalDesktopRef}
                      className="pe-input"
                      style={{ resize: 'none', overflowY: 'hidden', height: 'auto', minHeight: '46px', maxHeight: '200px', lineHeight: '1.4' }}
                      rows={1}
                      value={goal}
                      onChange={(e) => {
                        setGoal(e.target.value);
                        e.target.style.height = 'auto';
                        e.target.style.height = `${e.target.scrollHeight}px`;
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          startAnalysis();
                        }
                      }}
                      placeholder={t('landing.placeholder')}
                    />
                    <button
                      className="btn btn-primary pe-start-btn"
                      onClick={startAnalysis}
                      disabled={!goal.trim()}
                    >
                      <Sparkles size={16} /> H.I.T. starten
                    </button>
                  </div>

                  <div className="pe-suggestions">
                    <p className="pe-suggestions-title">{t('landing.suggestionsTitle')}</p>
                    <div className="pe-chips">
                      {chips.map((chip) => (
                        <button
                          key={chip.label}
                          className="pe-chip"
                          onClick={() => handleChipClick(chip)}
                        >
                          <span className="pe-chip-icon">{chip.icon}</span>
                          <span className="pe-chip-label">{chip.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Phase: ANALYSIS */}
          {phase === 'analysis' && (
            <div className="pe-card pe-analysis-card">
              <div className="pe-card-header">
                <div className="pe-brand"><span className="pe-brand-h">H</span>.I.T.</div>
                <span className="pe-status">{t('landing.analyzing')}</span>
              </div>
              <div className="pe-analysis-steps">
                <div className="pe-step done"><Check size={14} /> {t('landing.stepGoal')}</div>
                <div className="pe-step active"><span className="pe-spinner" /> {t('landing.stepStrategy')}</div>
                <div className="pe-step"><span className="pe-step-num">3</span> {t('landing.stepContent')}</div>
              </div>
            </div>
          )}

          {/* Phase: QUESTIONS */}
          {phase === 'questions' && analysis && (
            <div className="pe-card pe-question-card">
              <div className="pe-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div className="pe-brand"><span className="pe-brand-h">H</span>.I.T.</div>
                  <span className="pe-status">{t('landing.analyzing')}</span>
                </div>
                <button
                  onClick={() => setPhase('input')}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '6px 12px',
                    fontSize: '0.8rem',
                    fontWeight: '600',
                    borderRadius: '6px',
                    background: 'var(--bg-secondary, #f3f4f6)',
                    color: 'var(--text, #374151)',
                    border: '1px solid var(--border, #e5e7eb)',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                  }}
                  onMouseOver={(e) => e.currentTarget.style.background = 'var(--border, #e5e7eb)'}
                  onMouseOut={(e) => e.currentTarget.style.background = 'var(--bg-secondary, #f3f4f6)'}
                >
                  <ArrowLeft size={14} /> Zurück zum Ziel
                </button>
              </div>

              <div className="pe-score-grid">
                <div className="pe-score-item">
                  <span className="pe-score-label">{t('landing.goalDetected')}</span>
                  <span className="pe-score-value done">✅</span>
                </div>
                <div className="pe-score-item">
                  <span className="pe-score-label">{t('landing.strategyCreated')}</span>
                  <span className="pe-score-value done">✅</span>
                </div>
                <div className="pe-score-item">
                  <span className="pe-score-label">{t('landing.contentChance')}</span>
                  <span className="pe-score-value highlight">{analysis.contentScore}%</span>
                </div>
                <div className="pe-score-item">
                  <span className="pe-score-label">{t('landing.savedTime')}</span>
                  <span className="pe-score-value">{analysis.savedTime}</span>
                </div>
              </div>

              <div className="pe-recommended">
                <p className="pe-recommended-title">{t('platformEngine.recommended')}</p>
                <div className="pe-recommended-list">
                  {top3Keys.map((key, i) => (
                    <span key={key} className="pe-recommended-item">
                      {i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉'} {getAgentName(key)}
                    </span>
                  ))}
                </div>
              </div>

              <div className="pe-question-actions">
                <button className="btn btn-primary" onClick={handleStart}>
                  <Sparkles size={16} /> Weiter
                </button>
              </div>
            </div>
          )}

          {/* Phase: GENERATING */}
          {phase === 'generating' && (
            <div className="pe-card pe-generating-card">
              <div className="pe-card-header">
                <div className="pe-brand"><span className="pe-brand-h">H</span>.I.T.</div>
                <span className="pe-status">{t('platformEngine.generating')}</span>
              </div>

              <div className="pe-progress-bar">
                <div
                  className="pe-progress-fill"
                  style={{ width: `${(Object.keys(progress).length / (analysis?.topPlatforms?.length || 3)) * 100}%` }}
                />
              </div>

              <div className="pe-progress-list">
                {top3Keys.map((key) => (
                  <div key={key} className={`pe-progress-item ${progress[key] === 'done' ? 'done' : 'active'}`}>
                    {progress[key] === 'done' ? <Check size={14} /> : <span className="pe-spinner-small" />}
                    <span>{getAgentIcon(key)} {getAgentName(key)}</span>
                    {progress[key] === 'done' ? <span className="pe-progress-status">fertig</span> : <span className="pe-progress-status">wird erstellt...</span>}
                  </div>
                ))}
              </div>
            </div>
          )}


          {/* Phase: RESULT */}
          {(phase === 'result' || phase === 'refining') && mobileStep !== 'studio' && (
            <div className="pe-result-phase">
              <div className="pe-result-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', width: '100%' }}>
                <div>
                  <h2 className="pe-result-title">✨ {t('platformEngine.resultTitle')}</h2>
                  <p className="pe-result-subtitle">
                    {goal} · {top3Keys.length} Plattformen erstellt
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <button
                    onClick={() => setTourActive(true)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '8px 14px',
                      fontSize: '0.88rem',
                      fontWeight: '600',
                      borderRadius: '8px',
                      background: 'rgba(16, 185, 129, 0.1)',
                      color: 'var(--color-mint, #10b981)',
                      border: '1px solid rgba(16, 185, 129, 0.2)',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                    }}
                  >
                    ❓ Tour starten
                  </button>
                  <button
                    onClick={() => setPhase('questions')}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '8px 14px',
                      fontSize: '0.88rem',
                      fontWeight: '600',
                      borderRadius: '8px',
                      background: 'var(--bg-secondary, #f3f4f6)',
                      color: 'var(--text, #374151)',
                      border: '1px solid var(--border, #e5e7eb)',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                    }}
                    onMouseOver={(e) => e.currentTarget.style.background = 'var(--border, #e5e7eb)'}
                    onMouseOut={(e) => e.currentTarget.style.background = 'var(--bg-secondary, #f3f4f6)'}
                  >
                    <ArrowLeft size={16} /> Zurück zur Analyse
                  </button>
                </div>
              </div>

              <div className="pe-copilot-workspace">
                {/* LINKE SPALTE: Co-Pilot Chatverlauf */}
                <div className="pe-copilot-chat-card">
                  <div className="pe-chat-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', borderBottom: '1px solid var(--border, #e5e7eb)', paddingBottom: '0.75rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ fontSize: '1.25rem' }}>🤖</span>
                      <div>
                        <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: '700' }}>H.I.T. Co-Pilot</h3>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted, #6b7280)' }}>Online</span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '0.25rem' }}>
                      <button 
                        className={`pe-chat-btn ${readingAloud ? 'active-audio' : ''}`} 
                        onClick={toggleReadingAloud}
                        title={readingAloud ? "Vorlesen deaktivieren" : "Antworten laut vorlesen"}
                      >
                        {readingAloud ? <Volume2 size={18} /> : <VolumeX size={18} />}
                      </button>
                    </div>
                  </div>

                  <div className="pe-chat-history">
                    {chatHistory.map((msg, idx) => (
                      <div key={idx} className={`pe-chat-message ${msg.role}`}>
                        {msg.content}
                      </div>
                    ))}
                    {phase === 'refining' && (
                      <div className="pe-chat-message assistant" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span className="pe-spinner-small" />
                        <span>H.I.T. überarbeitet das Skript...</span>
                      </div>
                    )}
                  </div>

                  <div className="pe-copilot-input-area">
                    <form 
                      onSubmit={(e) => {
                        e.preventDefault()
                        refineScript(chatInput)
                      }}
                      className="pe-chat-input-bar"
                    >
                      <button
                        type="button"
                        className={`pe-chat-btn ${isRecording ? 'recording' : ''}`}
                        onClick={toggleRecording}
                        title="Per Sprache eingeben"
                      >
                        {isRecording ? <MicOff size={18} /> : <Mic size={18} />}
                      </button>
                      <textarea
                        ref={chatDesktopRef}
                        className="pe-chat-input"
                        style={{ resize: 'none', overflowY: 'hidden', height: 'auto', minHeight: '38px', maxHeight: '150px', lineHeight: '1.4', paddingTop: '8px', paddingBottom: '8px' }}
                        rows={1}
                        placeholder="Wie soll ich das Skript anpassen?"
                        value={chatInput}
                        onChange={(e) => {
                          setChatInput(e.target.value);
                          e.target.style.height = 'auto';
                          e.target.style.height = `${e.target.scrollHeight}px`;
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            refineScript(chatInput);
                          }
                        }}
                        disabled={phase === 'refining'}
                      />
                      <button
                        type="submit"
                        className="pe-chat-btn pe-chat-btn-primary"
                        disabled={!chatInput.trim() || phase === 'refining'}
                        title="Senden"
                      >
                        <Send size={16} />
                      </button>
                    </form>
                  </div>
                </div>

                {/* RECHTE SPALTE: Live-Skript-Vorschau */}
                <div className="pe-copilot-preview-card">
                  <div className="pe-preview-header" style={{ marginBottom: '1rem', borderBottom: '1px solid var(--border, #e5e7eb)', paddingBottom: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                    <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: '700' }}>🎬 Aktuelles Skript</h3>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span className="pe-platform-badge" style={{ background: 'var(--color-mint, #10b981)', color: '#fff', fontSize: '9px', fontWeight: '700', padding: '2px 6px', borderRadius: '4px', textTransform: 'uppercase' }}>
                        TikTok / Short
                      </span>
                      {(() => {
                        const activePlatform = Object.keys(topResults)[0] || 'tiktok'
                        const r = topResults[activePlatform]
                        if (!r || !r.content) return null
                        const isCopied = copiedPlatform === activePlatform
                        return (
                          <button
                            className={`pe-copy-btn ${isCopied ? 'pe-copy-btn-done' : ''}`}
                            onClick={() => {
                              copyToClipboard(getResultText(r), activePlatform, r)
                              setCopiedPlatform(activePlatform)
                              setTimeout(() => setCopiedPlatform(null), 2000)
                            }}
                            style={{
                              padding: '2px 8px',
                              fontSize: '11px',
                              fontWeight: '600',
                              borderRadius: '6px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              background: isCopied ? 'var(--color-mint-light, #ecfdf5)' : 'var(--bg-secondary, #f3f4f6)',
                              color: isCopied ? 'var(--color-mint, #059669)' : 'var(--text-muted, #4b5563)',
                              border: '1px solid var(--border, #e5e7eb)',
                              cursor: 'pointer'
                            }}
                          >
                            {isCopied ? <><Check size={12} /> Kopiert!</> : <><Copy size={12} /> Kopieren</>}
                          </button>
                        )
                      })()}
                    </div>
                  </div>

                  <div className="pe-preview-section">
                    {(() => {
                      const activePlatform = Object.keys(topResults)[0] || 'tiktok'
                      const r = topResults[activePlatform]
                      if (!r || !r.content) return <p>Kein Skript vorhanden.</p>
                      return (
                        <>
                          {r.content.hook && (
                            <div className="pe-preview-block">
                              <div className="pe-preview-title">Hook (0-3s)</div>
                              <p className="pe-preview-content">{r.content.hook}</p>
                            </div>
                          )}
                          {r.content.body && (
                            <div className="pe-preview-block">
                              <div className="pe-preview-title">Hauptteil (Body & Metapher)</div>
                              <p className="pe-preview-content">{r.content.body}</p>
                            </div>
                          )}
                          {r.content.cta && (
                            <div className="pe-preview-block">
                              <div className="pe-preview-title">CTA & Loop (12-15s)</div>
                              <p className="pe-preview-content">{r.content.cta}</p>
                            </div>
                          )}
                          {r.content.imageIdea && (
                            <div className="pe-preview-block" style={{ borderLeftColor: 'var(--color-koralle, #d85a30)' }}>
                              <div className="pe-preview-title" style={{ color: 'var(--color-koralle, #d85a30)' }}>Visualisierungsidee / B-Roll</div>
                              <p className="pe-preview-content">{r.content.imageIdea}</p>
                            </div>
                          )}
                          <div className="pe-preview-block" style={{ borderLeftColor: 'var(--color-mint, #10b981)', background: 'var(--bg-secondary, #f9fafb)', padding: '12px', borderRadius: '8px', marginTop: '12px' }}>
                            <div className="pe-preview-title" style={{ color: 'var(--color-mint, #059669)', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.88rem', fontWeight: '700' }}>
                              🎥 Video-Quellen & Footage finden
                            </div>
                            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted, #6b7280)', margin: '4px 0 10px 0', lineHeight: '1.4' }}>
                              Passendes Footage für deine Szenen suchen und herunterladen:
                            </p>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                              {getFootageSources(r, goal).map((src, sIdx) => {
                                let icon = '🔗'
                                if (src.platform.toLowerCase().includes('youtube')) icon = '▶️'
                                if (src.platform.toLowerCase().includes('tiktok')) icon = '🎵'
                                if (src.platform.toLowerCase().includes('pexels') || src.platform.toLowerCase().includes('pixabay')) icon = '📹'
                                return (
                                  <a
                                    key={sIdx}
                                    href={src.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    style={{
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '6px',
                                      padding: '6px 12px',
                                      fontSize: '0.78rem',
                                      fontWeight: '600',
                                      background: '#ffffff',
                                      color: 'var(--text, #374151)',
                                      border: '1px solid var(--border, #e5e7eb)',
                                      borderRadius: '6px',
                                      textDecoration: 'none',
                                      transition: 'all 0.2s ease',
                                      boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                                    }}
                                    onMouseOver={(e) => {
                                      e.currentTarget.style.background = 'var(--bg-secondary, #f3f4f6)'
                                      e.currentTarget.style.borderColor = 'var(--text-muted, #9ca3af)'
                                    }}
                                    onMouseOut={(e) => {
                                      e.currentTarget.style.background = '#ffffff'
                                      e.currentTarget.style.borderColor = 'var(--border, #e5e7eb)'
                                    }}
                                  >
                                    <span>{icon}</span>
                                    <span>{src.platform}: <strong style={{ color: 'var(--color-koralle, #d85a30)' }}>"{src.query}"</strong></span>
                                  </a>
                                )
                              })}
                            </div>
                            <p style={{ fontSize: '0.68rem', color: 'var(--text-muted, #9ca3af)', marginTop: '8px', lineHeight: '1.3' }}>
                              {lang === 'de' 
                                ? 'Hinweis: H.I.T. verlinkt auf externe Suchergebnisse. Bitte beachte die Urheberrechte und Nutzungsbedingungen der jeweiligen Plattformen.' 
                                : 'Note: H.I.T. links to external search results. Please respect the copyright and terms of service of the respective platforms.'}
                            </p>
                          </div>
                        </>
                      )
                    })()}
                  </div>

                  <NextActionHub
                    onOpenCapCut={() => {
                      trackLandingFunnel('post_result_action', { action: 'capcut' })
                      saveStateAndNavigate('/capcut-studio')
                    }}
                    onTrackAnalytics={() => {
                      trackLandingFunnel('post_result_action', { action: 'tracking' })
                      saveStateAndNavigate('/analytics')
                    }}
                    onReset={() => {
                      trackLandingFunnel('post_result_action', { action: 'reset' })
                      setPhase('input')
                      setGoal('')
                      setResults({})
                      setTopResults({})
                      setRecommendations([])
                      setProgress({})
                      setChatHistory([])
                    }}
                  />
                </div>
              </div>
            </div>
          )}
        </>
      )}
      {showInfo && (
        <div className="pe-info-overlay" onClick={() => setShowInfo(false)}>
          <div className="pe-info-modal" onClick={(e) => e.stopPropagation()}>
            <button className="pe-info-close" onClick={() => setShowInfo(false)} aria-label="Schließen">
              <X size={20} />
            </button>
            <h3 className="pe-info-headline">H.I.T. Studio – Dein Content-Co-Pilot</h3>
            <p className="pe-info-subtext">
              Erstelle virale Skripte und finde das passende Footage für deine Videos in Sekundenschnelle.
            </p>
            <div className="pe-info-body">
              H.I.T. (Happiness Intelligence Team) nimmt dir die lästige Arbeit ab: Statt manuell nach Clips zu suchen und Skripte zu schreiben, sucht H.I.T. relevante Videoquellen und bereitet dir ein fertiges CapCut-Projekt vor.
            </div>
            <h4 className="pe-info-what-title">Was H.I.T. für dich tut:</h4>
            <div className="pe-info-features">
              <div className="pe-info-feature">
                <span>🎯</span>
                <div>
                  <strong>Zielgruppen-Fokus</strong>
                  <p>H.I.T. analysiert deine Idee und optimiert sie für deine Nische.</p>
                </div>
              </div>
              <div className="pe-info-feature">
                <span>🤖</span>
                <div>
                  <strong>Co-Pilot Skript-Optimierung</strong>
                  <p>Passe das Skript im Chat in Sekundenschnelle an deine Wünsche an.</p>
                </div>
              </div>
              <div className="pe-info-feature">
                <span>🎥</span>
                <div>
                  <strong>Footage-Sourcing</strong>
                  <p>Erhalte direkte Links zu den besten Video-Clips im Web – kein langes Suchen.</p>
                </div>
              </div>
              <div className="pe-info-feature">
                <span>⚡</span>
                <div>
                  <strong>CapCut-Export</strong>
                  <p>Lade das fertige Projekt herunter und öffne es direkt in CapCut.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}