import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { 
  ArrowLeft, BarChart3, Users, Eye, Copy, MapPin, RefreshCw,
  Video, Play, Camera, TrendingUp, Sparkles, AlertTriangle, 
  Check, CheckCircle2, AlertCircle, Info, ChevronRight, HelpCircle, FileText
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { getChatEndpoint } from '../lib/hit'
import ReactMarkdown from 'react-markdown'
import './AnalyticsPage.css'

const RANGES = [
  { value: '24h', label: '24 Stunden' },
  { value: '7d', label: '7 Tage' },
  { value: '30d', label: '30 Tage' },
]

const EVENT_LABELS = {
  page_view: 'Seitenaufrufe',
  goal_submitted: 'Ziele eingegeben',
  quick_result: 'Quick Results',
  content_generated: 'Content generiert',
  copy_action: 'Kopiert',
  chat_message: 'Chat Nachrichten',
  workflow_started: 'Workflows gestartet',
  workflow_completed: 'Workflows abgeschlossen',
}

const PRESETS = {
  viral: {
    label: 'Perfektes virales Video (Hohe Bindung + Loop)',
    description: 'Starker Hook hält Zuschauer. Pacing bleibt hoch. Das Ende leitet nahtlos zurück zum Anfang (Loop), was eine Completion Rate über 70% bewirkt.',
    points: [100, 95, 92, 88, 86, 84, 82, 81, 80, 79, 78, 77, 76, 75, 74, 74, 73, 73, 72, 72, 71, 71, 70, 70, 69, 68, 68, 67, 75, 88, 95],
    score: 84,
    metrics: { hook: '92%', pacing: 'Sehr hoch', completion: '72%', loop: 'Exzellent' },
    tips: ['Hook nutzt Neugier-Loop', 'Pattern Interrupts alle 2.5 Sekunden', 'Ende bricht mitten im Satz ab und loopt perfekt']
  },
  weak_hook: {
    label: 'Schwacher Hook (Klassischer Fehlstart)',
    description: 'Das Video startet mit einer Begrüßung ("Hallo Leute..."). Die Zuschauer wissen nicht, worum es geht und scrollen in den ersten 3 Sekunden ab.',
    points: [100, 70, 45, 25, 20, 18, 16, 15, 14, 13, 12, 12, 11, 11, 10, 10, 9, 9, 8, 8, 7, 7, 6, 6, 5, 5, 4, 4, 4, 3, 3],
    score: 15,
    metrics: { hook: '25%', pacing: 'Mittelmäßig', completion: '3%', loop: 'Unbedeutend' },
    tips: ['Schneide das "Hallo Leute" komplett weg', 'Zeige das Ergebnis in der ersten Sekunde', 'Füge Text-Overlay mit dem Hauptproblem ein']
  },
  slow_pacing: {
    label: 'Schlechtes Pacing (Langatmige Pausen)',
    description: 'Der Hook zieht zwar einige an, aber durch lange Sprechpausen, "Ähms" und fehlende Schnitte schwindet die Aufmerksamkeit sekündlich.',
    points: [100, 85, 78, 70, 60, 52, 45, 38, 30, 26, 22, 19, 17, 15, 14, 12, 11, 10, 9, 8, 8, 7, 7, 6, 6, 5, 5, 4, 4, 3, 3],
    score: 28,
    metrics: { hook: '70%', pacing: 'Sehr träge', completion: '3%', loop: 'Schwach' },
    tips: ['Nutze J-Cuts und L-Cuts im Tonschnitt', 'Blende B-Roll oder Bilder über deine Stimme', 'Entferne alle Füllwörter in CapCut']
  },
  abrupt_exit: {
    label: 'Abruptes Ende (Zuschauer-Absturz am Schluss)',
    description: 'Das Video war gut, aber du kündigst das Ende an ("So, das war mein Tipp, danke..."). Zuschauer wissen, dass nichts mehr kommt und wischen weg.',
    points: [100, 92, 88, 85, 83, 81, 79, 78, 77, 76, 75, 74, 73, 72, 71, 70, 69, 68, 68, 67, 66, 65, 64, 64, 63, 62, 60, 45, 20, 5, 1],
    score: 58,
    metrics: { hook: '85%', pacing: 'Gut', completion: '1%', loop: 'Mangelhaft' },
    tips: ['Sag niemals "Danke fürs Zuschauen" am Ende', 'Führe die Lösung direkt in den Call-to-Action über', 'Beende das Video abrupt mit einer Frage']
  }
}

const PRESET_SCRIPTS = {
  viral: {
    hook: 'Das ist der dümmste Fehler, den jeder beim Posten auf TikTok macht...',
    body: 'Sie starten ihr Video mit einer netten Begrüßung. Doch niemanden interessiert, wer du bist. Dein Hook muss das Gehirn kapern. Schneide alle Atmer und Redepausen komplett raus. Ändere alle 3 Sekunden den Bildausschnitt. Blende Text-Overlays ein und untermale es mit einem passenden Sound.',
    cta: 'Wenn du wissen willst, wie du das verhinderst, schreib mir "Skript" in die Kommentare. Und das ist der...'
  },
  weak_hook: {
    hook: 'Hallo Leute, willkommen auf meinem Kanal! Heute wollte ich mal mit euch darüber reden, wie man glücklich wird...',
    body: 'Es gibt ja viele verschiedene Ansätze. Ich habe in letzter Zeit viel gelesen und wollte euch einfach mal meine Gedanken dazu mitgeben. Erstens sollte man mehr schlafen. Zweitens sollte man Sport machen. Ich hoffe, das hilft euch weiter.',
    cta: 'Danke fürs Zuschauen! Lasst mir gerne ein Like da und wir sehen uns im nächsten Video. Bis bald!'
  },
  slow_pacing: {
    hook: 'Dieses einfache Geheimnis macht dich sofort produktiver.',
    body: 'Also... viele Leute wissen nicht... dass man am besten morgens arbeitet. Wenn man aufsteht, hat man die meiste Energie. Und... äh... wenn man sich dann nicht ablenken lässt, schafft man in 2 Stunden das, was sonst 8 Stunden dauert. Man sollte das Handy in einen anderen Raum legen. Das hilft mir persönlich am meisten.',
    cta: 'Folgt mir für mehr solcher Tipps.'
  },
  abrupt_exit: {
    hook: 'Warum dein Handy dich heimlich unglücklich macht.',
    body: 'Jedes Mal, wenn du aufwachst und direkt auf Social Media scrollst, ballerst du dein Gehirn mit künstlichem Dopamin voll. Dein Gehirn gewöhnt sich an diesen hohen Reiz. Den Rest des Tages fühlt sich alles andere langweilig und anstrengend an. Leg dein Handy für die ersten 60 Minuten des Tages weg und dein Fokus wird sich verdoppeln.',
    cta: 'Das war mein Video für heute, ich hoffe es hat euch gefallen. Schreibt mir gerne Feedback. Tschüss!'
  }
}

const SOCIAL_PLATFORMS = {
  tiktok: {
    name: 'TikTok',
    color: '#000000',
    accentColor: '#fe2c55',
    icon: Video,
    stats: {
      followers: '14.200',
      views: '542.400',
      retention: '14,8s (49,3%)',
      engagement: '8,4%'
    }
  },
  instagram: {
    name: 'Instagram Reels',
    color: '#E1306C',
    accentColor: '#c13584',
    icon: Camera,
    stats: {
      followers: '8.450',
      views: '184.200',
      retention: '11,2s (37,3%)',
      engagement: '6,2%'
    }
  },
  youtube: {
    name: 'YouTube Shorts',
    color: '#FF0000',
    accentColor: '#ff0000',
    icon: Play,
    stats: {
      followers: '3.820',
      views: '89.100',
      retention: '21,5s (41,2%)',
      engagement: '11,8%'
    }
  }
}

export default function AnalyticsPage() {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('social')
  const [range, setRange] = useState('7d')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Social analytics states
  const [socialPlatform, setSocialPlatform] = useState('tiktok')
  const [selectedPreset, setSelectedPreset] = useState('viral')
  const [hookText, setHookText] = useState(localStorage.getItem('hit_latest_hook') || '');
  const [bodyText, setBodyText] = useState(localStorage.getItem('hit_latest_body') || '');
  const [ctaText, setCtaText] = useState(localStorage.getItem('hit_latest_cta') || '');
  
  const [analyzedCurve, setAnalyzedCurve] = useState(null)
  const [analyzerResults, setAnalyzerResults] = useState(null)
  const [showGuide, setShowGuide] = useState(true)
  const [activeHotspot, setActiveHotspot] = useState(null)
  
  // AI states
  const [aiAuditing, setAiAuditing] = useState(false)
  const [aiFeedback, setAiFeedback] = useState(null)
  const [cooldown, setCooldown] = useState(0)

  // Cooldown timer
  useEffect(() => {
    if (cooldown > 0) {
      const timer = setTimeout(() => setCooldown(cooldown - 1), 1000)
      return () => clearTimeout(timer)
    }
  }, [cooldown])

  // Auto-scroll to AI feedback when it arrives
  useEffect(() => {
    if (aiFeedback) {
      setTimeout(() => {
        const element = document.querySelector('.ai-audit-feedback-card')
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'start' })
        }
      }, 100)
    }
  }, [aiFeedback])

  // Load app activity analytics
  useEffect(() => { 
    if (activeTab === 'app') {
      loadAnalytics() 
    }
  }, [range, activeTab])

  // Run local analysis when inputs change
  useEffect(() => {
    handleLocalAnalysis()
  }, [hookText, bodyText, ctaText])

  // Change inputs based on selected preset
  const handlePresetSelect = (presetKey) => {
    setSelectedPreset(presetKey)
    setHookText(PRESET_SCRIPTS[presetKey].hook)
    setBodyText(PRESET_SCRIPTS[presetKey].body)
    setCtaText(PRESET_SCRIPTS[presetKey].cta)
    setAiFeedback(null)
  }

  async function loadAnalytics() {
    setLoading(true)
    setError('')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token || ''
      const res = await fetch(`/.netlify/functions/analytics-query?range=${range}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (!res.ok) {
        const err = await res.json()
        setError(err.error || 'Fehler beim Laden')
      } else {
        setData(await res.json())
      }
    } catch (e) {
      setError(e.message)
    }
    setLoading(false)
  }

  function handleLocalAnalysis() {
    const analysis = analyzeScriptLocally(hookText, bodyText, ctaText)
    setAnalyzedCurve(analysis.points)
    setAnalyzerResults(analysis)
  }

  function calculateDynamicCurve(hookText, bodyText, ctaText) {
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

  function analyzeScriptLocally(hook, body, cta) {
    const points = calculateDynamicCurve(hook, body, cta)
    
    const average = points.reduce((sum, p) => sum + p, 0) / points.length
    const score = Math.max(5, Math.min(100, Math.round(average * 1.08)))
    
    const tips = []
    const hookLen = (hook || '').trim().length
    const bodyLen = (body || '').trim().length
    const ctaLen = (cta || '').trim().length

    if (hookLen === 0) {
      tips.push('⚠️ Hook ist leer. Füge einen fesselnden Einstieg von 1-3 Sekunden hinzu.')
    } else if (hookLen > 130) {
      tips.push('⚠️ Hook ist zu lang (> 130 Zeichen). Zuschauer scrollen sofort ab.')
    } else if (hookLen > 90) {
      tips.push('⚠️ Hook ist etwas lang. Versuche, die Kernaussage schneller auf den Punkt zu bringen.')
    } else {
      tips.push('✅ Hook-Länge ist optimal für Kurzvideos!')
    }

    if (bodyLen === 0) {
      tips.push('⚠️ Hauptteil ist leer. Beschreibe das Kern-Thema deines Videos.')
    } else if (bodyLen < 300) {
      tips.push('⚠️ Hauptteil ist sehr kurz (< 300 Zeichen). Das Video bietet eventuell zu wenig Mehrwert.')
    } else if (bodyLen > 800) {
      tips.push('⚠️ Hauptteil ist sehr lang (> 800 Zeichen). Das senkt die Dynamik und erhöht die Absprungrate.')
    } else {
      tips.push('✅ Hauptteil-Länge ist im perfekten Bereich für hohe Informationsdichte!')
    }

    if (ctaLen === 0) {
      tips.push('⚠️ Ein klarer Call-to-Action fehlt. Sag Zuschauern, was sie tun sollen.')
    } else if (ctaLen > 120) {
      tips.push('⚠️ CTA/Loop ist zu lang (> 120 Zeichen). Zuschauer schalten vor dem Ende ab.')
    } else {
      tips.push('✅ CTA ist kurz und direkt!')
    }

    const hookPct = points[3] + '%'
    const completionPct = points[30] + '%'
    
    let pacingRating = 'Gut'
    if (bodyLen > 800 || bodyLen < 300) pacingRating = 'Schwach'
    else if (bodyLen > 650 || bodyLen < 400) pacingRating = 'Mittel'
    
    return {
      points,
      score,
      metrics: {
        hook: hookPct,
        pacing: pacingRating,
        completion: completionPct,
        loop: cta.toLowerCase().includes('loop') || cta.toLowerCase().includes('und das') ? 'Ja' : 'Nein'
      },
      tips
    }
  }

  const getTrafficLights = () => {
    const lights = []
    
    // 1. Hook
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

    // 2. Body
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

    // 3. CTA
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

  async function runAiAudit() {
    if (aiAuditing || cooldown > 0) return
    setAiAuditing(true)
    setAiFeedback(null)
    setError('')
    setCooldown(10)
    
    const systemPrompt = `Du bist ein erfahrener Social-Media-Wachstumsexperte und weltklasse Retention-Coach für TikTok, Instagram Reels und YouTube Shorts.
Deine Aufgabe ist es, das eingereichte Videoskript (Hook, Body, CTA) des Creators knallhart zu analysieren und eine optimierte Version zu erstellen.

Strukturiere deine Antwort zwingend in genau diese vier Abschnitte unter Verwendung von Markdown:

### 📊 REICHWEITEN-PROGNOSE
[Gib hier eine ehrliche, datenbasierte Einschätzung des viralen Potenzials des ursprünglichen Skripts. Welche Aspekte sind gut, wo springen die Leute ab?]

### ✍️ OPTIMIERTES SKRIPT
**Hook (0-3s):**
[Hier der verbesserte, extrem packende Hook]

**Hauptteil (Body):**
[Hier der dynamische, gekürzte Hauptteil mit optimalem Redefluss]

**Call-to-Action (CTA):**
[Hier ein CTA, der eine Aktion auslöst oder einen perfekten Loop zurück zum Hook bildet]

### 🎬 CAPCUT-REGIEANWEISUNGEN
[Führe hier konkrete Sekunden-Anweisungen für Pattern Interrupts auf (z.B. 0-3s: Zoom-In + rotes Text-Overlay; 6s: B-Roll Einblendung; 9s: Soundeffekt "Whoosh" etc.). Empfiehl Schnitte und Effekte alle 2-3 Sekunden, um die Retention hochzuhalten.]

### 🎬 CAPCUT-TEMPLATE EMPFEHLUNG
[Schlage hier eine konkrete Art von CapCut-Trend-Vorlage vor, nach der in der CapCut-App gesucht werden soll (z. B. '3-Sekunden-Split-Screen' oder eine Vorlage mit harten Bass-Drops bei der ersten Silbe), um das Skript visuell zu untermauern. Erkläre kurz, wie der Text-Hook exakt synchron mit dem visuellen Effekt der Vorlage matchen muss, um den typischen Absturz bei Sekunde 0:02 zu verhindern.]

Antworte ausschließlich im angegebenen Markdown-Format auf Deutsch. Antworte direkt und professionell ohne Einleitung ("Hier ist deine Analyse...").`;

    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token || ''
      
      const userRes = await supabase.auth.getUser()
      const userId = userRes.data.user?.id
      const videoEditor = localStorage.getItem('hit_video_editor') || 'capcut'
      
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          message: `Hier ist mein Skript zur Analyse:\n\nHook (0-3s):\n"${hookText}"\n\nHauptteil:\n"${bodyText}"\n\nCTA & Loop:\n"${ctaText}"`,
          systemPrompt,
          userId: userId,
          history: [],
          videoEditor
        })
      })

      if (!res.ok) {
        let errorText = ''
        try {
          const errData = await res.json()
          errorText = errData.error || errData.message || JSON.stringify(errData)
        } catch (_) {
          errorText = await res.text().catch(() => '')
        }
        throw new Error(`Server-Status ${res.status}. ${errorText ? 'Fehler: ' + errorText : ''}`)
      }

      const resData = await res.json()
      setAiFeedback(resData.response)
    } catch (e) {
      console.error('[AI Audit Error]', e)
      setError(`Das KI-Audit konnte nicht durchgeführt werden. Details: ${e.message}`)
      setCooldown(0)
    } finally {
      setAiAuditing(false)
    }
  }

  // Generate SVG path for curve
  const getPathData = (points) => {
    if (!points || points.length === 0) return ''
    const width = 300
    const height = 100
    const dx = width / (points.length - 1)
    
    return points.map((p, i) => {
      const x = i * dx
      const y = height - p
      return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`
    }).join(' ')
  }

  const getAreaPathData = (points) => {
    const linePath = getPathData(points)
    if (!linePath) return ''
    return `${linePath} L 300 100 L 0 100 Z`
  }

  return (
    <div className="analytics-page">
      <div className="analytics-header">
        <button className="analytics-back" onClick={() => navigate(-1)}>
          <ArrowLeft size={20} />
        </button>
        <h1><BarChart3 size={22} /> Analytics Hub</h1>
      </div>

      {/* Tabs Switcher */}
      <div className="analytics-tabs">
        <button 
          className={`analytics-tab ${activeTab === 'social' ? 'active' : ''}`}
          onClick={() => setActiveTab('social')}
        >
          <TrendingUp size={16} /> Social Media Analytics
        </button>
        <button 
          className={`analytics-tab ${activeTab === 'app' ? 'active' : ''}`}
          onClick={() => setActiveTab('app')}
        >
          <Users size={16} /> App-Aktivität
        </button>
      </div>

      {/* TAB 1: SOCIAL MEDIA ANALYTICS */}
      {activeTab === 'social' && (
        <div className="social-analytics-container">
          
          {/* Collapsible Coaching Panel */}
          <div className={`coaching-panel ${showGuide ? 'expanded' : 'collapsed'}`}>
            <button className="coaching-panel-toggle" onClick={() => setShowGuide(!showGuide)}>
              <span className="cpt-title">🚀 Dein Fahrplan zum viralen Video</span>
              <span className="cpt-arrow">{showGuide ? '▲ Ausblenden' : '▼ Einblenden'}</span>
            </button>
            
            {showGuide && (
              <div className="coaching-panel-content">
                <div className="coaching-steps">
                  <div className="coaching-step">
                    <span className="step-num">1</span>
                    <div className="step-info">
                      <h5>📊 DIAGNOSE</h5>
                      <p>Prüfe die Ampelkarten und deine Retention-Kurve auf Schwachstellen.</p>
                    </div>
                  </div>
                  <div className="coaching-step">
                    <span className="step-num">2</span>
                    <div className="step-info">
                      <h5>⚡ OPTIMIERUNG</h5>
                      <p>Klicke unten auf "KI-Optimierungs-Audit starten", um Fehler beheben zu lassen.</p>
                    </div>
                  </div>
                  <div className="coaching-step">
                    <span className="step-num">3</span>
                    <div className="step-info">
                      <h5>🎬 ACTION</h5>
                      <p>Kopiere das optimierte Skript und schneide dein Video exakt nach den CapCut-Regieanweisungen.</p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Brand Switcher */}
          <div className="social-brand-selector">
            {Object.entries(SOCIAL_PLATFORMS).map(([key, config]) => {
              const Icon = config.icon
              const isSelected = socialPlatform === key
              return (
                <button
                  key={key}
                  className={`brand-selector-btn ${isSelected ? 'active' : ''}`}
                  onClick={() => setSocialPlatform(key)}
                  style={{
                    '--accent-color': config.accentColor,
                    borderColor: isSelected ? config.accentColor : 'transparent'
                  }}
                >
                  <Icon size={18} />
                  <span>{config.name}</span>
                </button>
              )
            })}
          </div>

          {/* Social Stats Dashboard */}
          <div className="social-stats-grid">
            <div className="social-stat-card">
              <span className="stat-label">Abonnenten / Followers</span>
              <span className="stat-value">{SOCIAL_PLATFORMS[socialPlatform].stats.followers}</span>
            </div>
            <div className="social-stat-card">
              <span className="stat-label">Views (Letzte 30 Tage)</span>
              <span className="stat-value">{SOCIAL_PLATFORMS[socialPlatform].stats.views}</span>
            </div>
            <div className="social-stat-card">
              <span className="stat-label">Ø Wiedergabezeit (Retention)</span>
              <span className="stat-value">{SOCIAL_PLATFORMS[socialPlatform].stats.retention}</span>
            </div>
            <div className="social-stat-card">
              <span className="stat-label">Engagement Rate</span>
              <span className="stat-value">{SOCIAL_PLATFORMS[socialPlatform].stats.engagement}</span>
            </div>
          </div>

          {/* Retention Simulator Intro */}
          <div className="social-simulator-intro">
            <h2><Sparkles size={18} className="icon-spark" /> Interaktiver Zuschauerbindungs-Simulator</h2>
            <p>
              Teste dein Videoskript, bevor du filmst! Wähle eine Vorlage, um typische Algorithmus-Fehler zu untersuchen, oder tippe dein eigenes Skript ein. Unsere Simulation berechnet direkt deinen Kurvenverlauf.
            </p>
          </div>

          {/* Error Message */}
          {error && <div className="analytics-error">{error}</div>}

          {/* Simulator Workspace Grid */}
          <div className="social-simulator-workspace">
            {/* Left Side: Inputs */}
            <div className="simulator-inputs-card">
              <h3>Skript-Eingabe</h3>
              
              <div className="preset-selector-group">
                <span className="input-label">Vorlage laden:</span>
                <div className="preset-buttons">
                  {Object.entries(PRESETS).map(([key, config]) => (
                    <button
                      key={key}
                      className={`preset-btn ${selectedPreset === key ? 'active' : ''}`}
                      onClick={() => handlePresetSelect(key)}
                    >
                      {key === 'viral' && '🔥 '}
                      {key === 'weak_hook' && '👋 '}
                      {key === 'slow_pacing' && '⏳ '}
                      {key === 'abrupt_exit' && '🛑 '}
                      {key === 'viral' ? 'Viral' : key === 'weak_hook' ? 'Boring Hook' : key === 'slow_pacing' ? 'Slow' : 'Plötzliches Ende'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="input-field">
                <div className="input-field-header">
                  <label className="input-label">Hook (0 - 3 Sekunden)</label>
                  <span className="char-counter">{hookText.length}/150</span>
                </div>
                <textarea
                  value={hookText}
                  maxLength={150}
                  onChange={(e) => {
                    setHookText(e.target.value)
                    setSelectedPreset('')
                  }}
                  placeholder="Wie fesselst du die Aufmerksamkeit sofort? Keine Begrüßungen!"
                  rows={2}
                />
              </div>

              <div className="input-field">
                <div className="input-field-header">
                  <label className="input-label">Video-Hauptteil (Body)</label>
                  <span className="char-counter">{bodyText.length}/1000</span>
                </div>
                <textarea
                  value={bodyText}
                  maxLength={1000}
                  onChange={(e) => {
                    setBodyText(e.target.value)
                    setSelectedPreset('')
                  }}
                  placeholder="Inhalt. Formuliere kurze, dynamische Sätze für schnelles Pacing."
                  rows={4}
                />
              </div>

              <div className="input-field">
                <div className="input-field-header">
                  <label className="input-label">Call to Action & Loop (Ende)</label>
                  <span className="char-counter">{ctaText.length}/150</span>
                </div>
                <textarea
                  value={ctaText}
                  maxLength={150}
                  onChange={(e) => {
                    setCtaText(e.target.value)
                    setSelectedPreset('')
                  }}
                  placeholder="Wie schließt das Video? Perfekt ist ein offener Loop zurück zum Hook."
                  rows={2}
                />
              </div>

              <button 
                className="ai-audit-btn" 
                onClick={runAiAudit}
                disabled={aiAuditing || cooldown > 0 || (!hookText.trim() && !bodyText.trim())}
              >
                {aiAuditing ? (
                  <>
                    <RefreshCw size={16} className="spin" /> KI-Audit läuft...
                  </>
                ) : cooldown > 0 ? (
                  <>
                    Cooldown aktiv... ({cooldown}s)
                  </>
                ) : (
                  <>
                    <Sparkles size={16} /> KI-Optimierungs-Audit starten
                  </>
                )}
              </button>
            </div>

            {/* Right Side: Graph & Realtime Analysis */}
            <div className="simulator-results-card">
              <div className="results-header">
                <h3>Voraussichtliche Zuschauerbindung</h3>
                {analyzerResults && (
                  <div className="retention-score-badge" style={{
                    background: analyzerResults.score > 70 ? 'rgba(29, 158, 117, 0.1)' : analyzerResults.score > 40 ? 'rgba(245, 158, 11, 0.1)' : 'rgba(220, 38, 38, 0.1)',
                    color: analyzerResults.score > 70 ? '#1d9e75' : analyzerResults.score > 40 ? '#d97706' : '#dc2626'
                  }}>
                    Score: <strong>{analyzerResults.score}/100</strong>
                  </div>
                )}
              </div>

              {/* Selected Preset Details */}
              {selectedPreset && PRESETS[selectedPreset] && (
                <div className="preset-info-alert">
                  <strong>{PRESETS[selectedPreset].label}</strong>
                  <p>{PRESETS[selectedPreset].description}</p>
                </div>
              )}

              {/* SVG Retention Graph */}
              {analyzedCurve && (() => {
                const hookVal = analyzedCurve[3] || 50
                const bodyVal = analyzedCurve[15] || 50
                const ctaVal = analyzedCurve[30] || 50

                const hookY = (150 - (hookVal * 1.5)).toFixed(1)
                const bodyY = (150 - (bodyVal * 1.5)).toFixed(1)
                const ctaY = (150 - (ctaVal * 1.5)).toFixed(1)

                const pathD = `M 0 0 C 15 0 15 ${hookY} 30 ${hookY} S 135 ${bodyY} 150 ${bodyY} S 285 ${ctaY} 300 ${ctaY}`
                const areaD = `${pathD} L 300 150 L 0 150 Z`

                return (
                  <div className="svg-chart-container">
                    <div className="chart-y-axis">
                      <span>100%</span>
                      <span>50%</span>
                      <span>0%</span>
                    </div>
                    <div className="chart-viewport">
                      <svg viewBox="0 0 300 150" preserveAspectRatio="none">
                        <defs>
                          <linearGradient id="retention-gradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#1d9e75" stopOpacity="0.3" />
                            <stop offset="100%" stopColor="#1d9e75" stopOpacity="0.0" />
                          </linearGradient>
                        </defs>
                        
                        {/* Grid Lines */}
                        <line x1="0" y1="75" x2="300" y2="75" stroke="#f1f5f9" strokeDasharray="3" />
                        <line x1="30" y1="0" x2="30" y2="150" stroke="#f1f5f9" strokeDasharray="2" />
                        <line x1="270" y1="0" x2="270" y2="150" stroke="#f1f5f9" strokeDasharray="2" />

                        {/* Area Under Curve */}
                        <path d={areaD} fill="url(#retention-gradient)" />
                        
                        {/* Curve Path */}
                        <path d={pathD} fill="none" stroke="#1d9e75" strokeWidth="2.5" />
                        
                        {/* Key Points Markers */}
                        <g className="svg-hotspot" onClick={() => setActiveHotspot(3)}>
                          <circle cx="30" cy={hookY} r="7" className={`hotspot-outer ${activeHotspot === 3 ? 'active' : ''}`} />
                          <circle cx="30" cy={hookY} r="3.5" className="hotspot-inner" fill="#166534" />
                        </g>
                        <g className="svg-hotspot" onClick={() => setActiveHotspot(15)}>
                          <circle cx="150" cy={bodyY} r="7" className={`hotspot-outer ${activeHotspot === 15 ? 'active' : ''}`} />
                          <circle cx="150" cy={bodyY} r="3.5" className="hotspot-inner" fill="#166534" />
                        </g>
                        <g className="svg-hotspot" onClick={() => setActiveHotspot(30)}>
                          <circle cx="300" cy={ctaY} r="7" className={`hotspot-outer ${activeHotspot === 30 ? 'active' : ''}`} />
                          <circle cx="300" cy={ctaY} r="3.5" className="hotspot-inner" fill="#166534" />
                        </g>
                      </svg>
                      
                      <div className="chart-markers">
                        <span className="marker-tag hook-tag" style={{ top: `${(hookY / 150 * 100).toFixed(1)}%` }}>Hook</span>
                        <span className="marker-tag cta-tag" style={{ top: `${(ctaY / 150 * 100).toFixed(1)}%` }}>CTA</span>
                      </div>
                    </div>
                    <div className="chart-x-axis">
                      <span>0s</span>
                      <span>3s (Hook)</span>
                      <span>15s</span>
                      <span>27s (CTA)</span>
                      <span>30s</span>
                    </div>
                  </div>
                )
              })()}

              {/* Interactive Hotspot Popup Explanation */}
              {activeHotspot && (
                <div className="hotspot-popup-card">
                  <div className="hotspot-popup-header">
                    <h4>
                      {activeHotspot === 3 && '⏰ Sekunde 3: Die Hook-Schranke!'}
                      {activeHotspot === 15 && '⚡ Sekunde 15: Das Aufmerksamkeits-Tief!'}
                      {activeHotspot === 30 && '🔄 Sekunde 30: Die CTA-Falle!'}
                    </h4>
                    <button className="hotspot-popup-close" onClick={() => setActiveHotspot(null)}>×</button>
                  </div>
                  <p>
                    {activeHotspot === 3 && 'Die Hook-Schranke! Hier entscheidet der TikTok-Algorithmus, ob dein Video in die Next-Batch-Ausspielung kommt. Ohne packenden Einstieg wischen 80% der Nutzer sofort weg.'}
                    {activeHotspot === 15 && 'Das Aufmerksamkeits-Tief! Ohne Pattern Interrupts (Zooms, Soundeffekte, Text-Overlays) verlierst du hier schlagartig 50% der verbleibenden Zuschauer. Baue visuelle Abwechslung ein!'}
                    {activeHotspot === 30 && 'Die CTA-Falle! Kündige das Ende deines Videos niemals an. Nutze einen nahtlosen Loop zurück zum Hook für maximale Watchtime.'}
                  </p>
                </div>
              )}

              {/* Traffic Light Badges */}
              <div className="social-traffic-lights">
                {getTrafficLights().map((light, i) => (
                  <div key={i} className={`traffic-light-card ${light.type}`}>
                    <span className="tl-label">{light.label}</span>
                    <span className="tl-text">{light.text}</span>
                  </div>
                ))}
              </div>

              {/* Key Metrics Blocks */}
              {analyzerResults && (
                <div className="metrics-bubble-grid">
                  <div className="metric-bubble">
                    <span className="mb-val">{analyzerResults.metrics.hook}</span>
                    <span className="mb-lbl">Hook-Rate (3s)</span>
                  </div>
                  <div className="metric-bubble">
                    <span className="mb-val">{analyzerResults.metrics.pacing}</span>
                    <span className="mb-lbl">Video-Pacing</span>
                  </div>
                  <div className="metric-bubble">
                    <span className="mb-val">{analyzerResults.metrics.completion}</span>
                    <span className="mb-lbl">Completion Rate</span>
                  </div>
                  <div className="metric-bubble">
                    <span className="mb-val">{analyzerResults.metrics.loop}</span>
                    <span className="mb-lbl">End-Loop</span>
                  </div>
                </div>
              )}

              {/* Local Feedback / Recommendation list */}
              {analyzerResults && analyzerResults.tips && (
                <div className="local-tips-container">
                  <h4>💡 Verbesserungsvorschläge (Live-Feedback)</h4>
                  <ul>
                    {analyzerResults.tips.map((tip, i) => (
                      <li key={i}>{tip}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>

          {/* AI Feedback Section */}
          {aiFeedback && (
            <div className="ai-audit-feedback-card">
              <div className="ai-feedback-header">
                <div className="ai-header-title">
                  <Sparkles size={20} className="ai-icon" />
                  <h3>Professionelles KI-Skript-Audit</h3>
                </div>
                <div className="ai-feedback-actions">
                  <LocalCopyButton 
                    text={extractOptimizedScript(aiFeedback)} 
                    label="📋 Skript in Zwischenablage kopieren" 
                    className="primary-copy" 
                  />
                  <LocalCopyButton 
                    text={aiFeedback} 
                    label="📋 Gesamte Analyse kopieren" 
                    className="secondary-copy" 
                  />
                </div>
              </div>
              
              <div className="ai-feedback-markdown-content">
                <ReactMarkdown>{aiFeedback}</ReactMarkdown>
              </div>
            </div>
          )}

          {/* Educational Algorithm Guide */}
          <div className="algorithm-guide-card">
            <h3><HelpCircle size={18} /> Wie funktioniert der Algorithmus genau?</h3>
            <div className="guide-grid">
              <div className="guide-col">
                <h4>1. Die 3-Sekunden-Regel</h4>
                <p>
                  Sowohl TikTok als auch Meta (Instagram) bewerten die ersten 3 Sekunden extrem streng. Scrollt hier die Mehrheit ab, wird das Video nicht weiter ausgeliefert. Ein optimaler Hook liegt über 70% Zuschauerbindung nach 3s.
                </p>
              </div>
              <div className="guide-col">
                <h4>2. Pattern Interrupts</h4>
                <p>
                  Lange Monologe führen zu stetigem Zuschauerverlust. Der Algorithmus liebt Dynamik. Nutze visuelle Zoom-Effekte, Einblendungen oder Geräusche alle 2 bis 3 Sekunden, um die Aufmerksamkeit neu zu fokussieren.
                </p>
              </div>
              <div className="guide-col">
                <h4>3. Die magische Completion Rate</h4>
                <p>
                  Wird dein Video bis zum Ende angesehen, signalisiert das maximale Relevanz. Wenn du am Ende „Danke fürs Zuschauen“ sagst, bricht die Kurve ein. Leite stattdessen nahtlos wieder an den Anfang über, um ein erneutes Abspielen zu erzwingen.
                </p>
              </div>
            </div>
          </div>

        </div>
      )}

      {/* TAB 2: APP ACTIVITY ANALYTICS (EX-CUSTOM ANALYTICS) */}
      {activeTab === 'app' && (
        <>
          <div className="analytics-controls">
            <div className="analytics-range-btns">
              {RANGES.map(r => (
                <button
                  key={r.value}
                  className={`analytics-range-btn ${range === r.value ? 'active' : ''}`}
                  onClick={() => setRange(r.value)}
                >{r.label}</button>
              ))}
            </div>
            <button className="analytics-refresh" onClick={loadAnalytics} disabled={loading}>
              <RefreshCw size={14} className={loading ? 'spin' : ''} /> Aktualisieren
            </button>
          </div>

          {error && <div className="analytics-error">{error}</div>}

          {loading && !data && (
            <div className="analytics-loading">Lade Analytics...</div>
          )}

          {data && (
            <>
              <div className="analytics-grid">
                <div className="analytics-card">
                  <div className="analytics-card-icon" style={{ background: '#1d9e75' }}>
                    <Eye size={22} />
                  </div>
                  <div className="analytics-card-content">
                    <span className="analytics-card-value">{data.totalEvents?.toLocaleString() || '0'}</span>
                    <span className="analytics-card-label">Events gesamt</span>
                  </div>
                </div>
                <div className="analytics-card">
                  <div className="analytics-card-icon" style={{ background: '#0A66C2' }}>
                    <Users size={22} />
                  </div>
                  <div className="analytics-card-content">
                    <span className="analytics-card-value">{data.uniqueVisitors?.toLocaleString() || '0'}</span>
                    <span className="analytics-card-label">Eindeutige Besucher</span>
                  </div>
                </div>
                <div className="analytics-card">
                  <div className="analytics-card-icon" style={{ background: '#F59E0B' }}>
                    <Copy size={22} />
                  </div>
                  <div className="analytics-card-content">
                    <span className="analytics-card-value">{(data.eventCounts?.copy_action || 0).toLocaleString()}</span>
                    <span className="analytics-card-label">Kopier-Aktionen</span>
                  </div>
                </div>
                <div className="analytics-card">
                  <div className="analytics-card-icon" style={{ background: '#E4405F' }}>
                    <MapPin size={22} />
                  </div>
                  <div className="analytics-card-content">
                    <span className="analytics-card-value">{data.topCities?.length || 0}</span>
                    <span className="analytics-card-label">Städte erkannt</span>
                  </div>
                </div>
              </div>

              <div className="analytics-section">
                <h2>Events nach Typ</h2>
                <div className="analytics-event-list">
                  {Object.entries(data.eventCounts || {})
                    .sort((a, b) => b[1] - a[1])
                    .map(([name, count]) => (
                      <div key={name} className="analytics-event-row">
                        <span className="analytics-event-name">{EVENT_LABELS[name] || name}</span>
                        <div className="analytics-event-bar">
                          <div
                            className="analytics-event-fill"
                            style={{ width: `${Math.min(100, (count / (data.totalEvents || 1)) * 100)}%` }}
                          />
                        </div>
                        <span className="analytics-event-count">{count.toLocaleString()}</span>
                      </div>
                    ))}
                </div>
              </div>

              {data.topCities?.length > 0 && (
                <div className="analytics-section">
                  <h2>Top Städte</h2>
                  <div className="analytics-city-list">
                    {data.topCities.map((city, i) => (
                      <div key={i} className="analytics-city-row">
                        <span className="analytics-city-rank">#{i + 1}</span>
                        <span className="analytics-city-name">{city.name}</span>
                        <span className="analytics-city-count">{city.count} Events</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {data.dailyBreakdown?.length > 0 && (
                <div className="analytics-section">
                  <h2>Täglicher Verlauf</h2>
                  <div className="analytics-daily-chart">
                    {data.dailyBreakdown.map((day, i) => {
                      const maxVal = Math.max(...data.dailyBreakdown.map(d => d.page_views), 1)
                      return (
                        <div key={i} className="analytics-daily-col">
                          <div className="analytics-daily-bar-wrap">
                            <div
                              className="analytics-daily-bar"
                              style={{ height: `${(day.page_views / maxVal) * 100}%` }}
                              title={`${day.page_views} Views, ${day.goals} Ziele, ${day.copies} Kopien`}
                            />
                          </div>
                          <span className="analytics-daily-date">
                            {new Date(day.date).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              <div className="analytics-footer">
                <p>Daten werden in Supabase-Tabelle <code>events</code> gespeichert. DSGVO-konform, keine Google-Abhängigkeit.</p>
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}

function LocalCopyButton({ text, label, className = "" }) {
  const [copied, setCopied] = useState(false)
  const handleCopy = () => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <button className={`inner-copy-btn ${className}`} onClick={handleCopy}>
      {copied ? <Check size={13} style={{ color: '#1d9e75' }} /> : <Copy size={13} />}
      <span>{copied ? '✓ Kopiert!' : (label || 'Kopieren')}</span>
    </button>
  )
}

function extractOptimizedScript(markdown) {
  if (!markdown) return ''
  const match = markdown.match(/### ✍️ OPTIMIERTES SKRIPT([\s\S]*?)(### 🎬 CAPCUT-REGIEANWEISUNGEN|### 🎬 CAPCUT-TEMPLATE EMPFEHLUNG|$)/i)
  return match ? match[1].trim() : markdown
}
