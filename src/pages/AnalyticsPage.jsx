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
  const [scriptHook, setScriptHook] = useState(PRESET_SCRIPTS.viral.hook)
  const [scriptBody, setScriptBody] = useState(PRESET_SCRIPTS.viral.body)
  const [scriptCta, setScriptCta] = useState(PRESET_SCRIPTS.viral.cta)
  
  const [analyzedCurve, setAnalyzedCurve] = useState(null)
  const [analyzerResults, setAnalyzerResults] = useState(null)
  
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

  // Load app activity analytics
  useEffect(() => { 
    if (activeTab === 'app') {
      loadAnalytics() 
    }
  }, [range, activeTab])

  // Run local analysis when inputs change
  useEffect(() => {
    handleLocalAnalysis()
  }, [scriptHook, scriptBody, scriptCta])

  // Change inputs based on selected preset
  const handlePresetSelect = (presetKey) => {
    setSelectedPreset(presetKey)
    setScriptHook(PRESET_SCRIPTS[presetKey].hook)
    setScriptBody(PRESET_SCRIPTS[presetKey].body)
    setScriptCta(PRESET_SCRIPTS[presetKey].cta)
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
    const analysis = analyzeScriptLocally(scriptHook, scriptBody, scriptCta)
    setAnalyzedCurve(analysis.points)
    setAnalyzerResults(analysis)
  }

  function analyzeScriptLocally(hook, body, cta) {
    let score = 70
    const tips = []
    
    // 1. Hook Analysis
    const hookWords = hook.trim().split(/\s+/).filter(Boolean)
    let hookDrop = 15
    
    if (hookWords.length === 0) {
      hookDrop = 65
      tips.push('Dein Video hat keinen Hook! Schreibe unbedingt 1-2 Sätze am Anfang, die Aufmerksamkeit fesseln.')
      score -= 30
    } else if (hookWords.length < 4) {
      hookDrop = 40
      tips.push('Dein Hook ist sehr kurz. Stelle sicher, dass er ein klares Versprechen oder Problem formuliert.')
      score -= 10
    } else {
      const powerWords = ['fehler', 'geheimnis', 'warum', 'niemals', 'stopp', 'trick', 'wie du', 'geheime', 'vorsicht', 'wahrheit', 'unglaublich', 'psychologie', 'trickse']
      const hasPowerWord = powerWords.some(pw => hook.toLowerCase().includes(pw))
      
      const boringPhrases = ['hallo', 'willkommen', 'mein name', 'heute zeige ich', 'ich wollte mal', 'hey leute', 'hallo zusammen']
      const hasBoringPhrase = boringPhrases.some(bp => hook.toLowerCase().includes(bp))
      
      if (hasBoringPhrase) {
        hookDrop = 48
        tips.push('Vermeide Begrüßungen wie "Hallo" oder "Willkommen" im Hook. Starte sofort mit der Kernaussage.')
        score -= 20
      } else if (hasPowerWord) {
        hookDrop = 8
        tips.push('Sehr gut! Dein Hook nutzt psychologische Trigger-Wörter, um Neugier zu wecken.')
        score += 15
      } else {
        tips.push('Dein Hook ist okay. Versuche ihn spannender zu machen, z.B. mit "Der größte Fehler..."')
      }
    }
    
    // 2. Body Analysis
    const bodyWords = body.trim().split(/\s+/).filter(Boolean)
    let bodySlope = 1.4
    
    if (bodyWords.length === 0) {
      bodySlope = 3.0
      tips.push('Füge den Hauptteil deines Skripts hinzu, um das Pacing zu berechnen.')
      score -= 20
    } else {
      const paragraphs = body.split('\n').filter(p => p.trim().length > 0)
      const avgParagraphLength = bodyWords.length / Math.max(1, paragraphs.length)
      
      if (bodyWords.length > 150) {
        bodySlope = 2.4
        tips.push('Dein Hauptteil ist sehr lang (>150 Wörter). Das senkt das Pacing bei Kurzvideos drastisch.')
        score -= 15
      } else if (avgParagraphLength > 25) {
        bodySlope = 1.8
        tips.push('Lange Sätze senken die Dynamik. Kürzere Sätze und gedankliche Absätze helfen beim Schnitt.')
        score -= 5
      } else {
        tips.push('Gute Textlänge im Hauptteil. Eignet sich für schnelle Schnitte (alle 2-3 Sekunden).')
        score += 10
      }
    }
    
    // 3. CTA Analysis
    const ctaWords = cta.trim().split(/\s+/).filter(Boolean)
    let ctaDrop = 12
    
    if (ctaWords.length === 0) {
      ctaDrop = 35
      tips.push('Ein klarer Call-to-Action fehlt. Sag Zuschauern, was sie als Nächstes tun sollen.')
      score -= 10
    } else {
      const ctaLower = cta.toLowerCase()
      const goodCtaWords = ['folge', 'abonnier', 'kommentier', 'schreib in', 'link', 'klick', 'herz', 'plus', 'teilen']
      const hasGoodCta = goodCtaWords.some(w => ctaLower.includes(w))
      
      const boringCta = ['danke', 'tschüss', 'schönen tag', 'bis zum nächsten mal']
      const hasBoringCta = boringCta.some(w => ctaLower.includes(w))
      
      if (hasBoringCta) {
        ctaDrop = 40
        tips.push('Beende dein Video nicht mit "Danke" oder "Tschüss". Das signalisiert Zuschauern, wegzuschalten.')
        score -= 20
      } else if (hasGoodCta) {
        ctaDrop = 6
        tips.push('Starker CTA! Du forderst den Zuschauer aktiv und direkt zu einer Interaktion auf.')
        score += 10
      }
    }
    
    // Points estimation
    const points = []
    let current = 100
    
    for (let i = 0; i <= 30; i++) {
      if (i === 0) {
        points.push(100)
      } else if (i <= 3) {
        const fraction = i / 3
        current = 100 - (hookDrop * fraction)
        points.push(Math.round(current))
      } else if (i < 27) {
        const decay = bodySlope * (1 - (i / 100))
        current = current - decay
        points.push(Math.max(5, Math.round(current)))
      } else {
        const remainingSeconds = 30 - i
        const fraction = (3 - remainingSeconds) / 3
        let endVal = current - (ctaDrop * fraction)
        
        // Loop indicators check
        if (cta.toLowerCase().includes('loop') || cta.toLowerCase().includes('anfang') || cta.toLowerCase().includes('und das') || cta.toLowerCase().includes('wie du')) {
          endVal = current + (10 * fraction)
        }
        
        current = endVal
        points.push(Math.max(1, Math.round(current)))
      }
    }
    
    score = Math.max(5, Math.min(99, Math.round(score)))
    const hookPct = points[3] + '%'
    const completionPct = points[30] + '%'
    
    let pacingRating = 'Mittel'
    if (bodySlope < 1.1) pacingRating = 'Sehr hoch'
    else if (bodySlope < 1.5) pacingRating = 'Gut'
    else if (bodySlope > 2.0) pacingRating = 'Schwach'
    
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

  async function runAiAudit() {
    if (aiAuditing || cooldown > 0) return
    setAiAuditing(true)
    setAiFeedback(null)
    setError('')
    setCooldown(60)
    
    const systemPrompt = `Du bist ein erfahrener Social-Media-Wachstumsexperte und weltklasse Retention-Coach für TikTok, Instagram Reels und YouTube Shorts.
Deine Aufgabe ist es, das eingereichte Videoskript (Hook, Body, CTA) des Creators knallhart zu analysieren und eine optimierte Version zu erstellen.

Strukturiere deine Antwort zwingend in genau diese drei Abschnitte unter Verwendung von Markdown:

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

Antworte ausschließlich im angegebenen Markdown-Format auf Deutsch. Antworte direkt und professionell ohne Einleitung ("Hier ist deine Analyse...").`;

    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token || ''
      
      const userRes = await supabase.auth.getUser()
      const userId = userRes.data.user?.id
      
      const res = await fetch(getChatEndpoint(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          message: `Hier ist mein Skript zur Analyse:\n\nHook (0-3s):\n"${scriptHook}"\n\nHauptteil:\n"${scriptBody}"\n\nCTA & Loop:\n"${scriptCta}"`,
          systemPrompt,
          userId: userId,
          history: []
        })
      })

      if (!res.ok) {
        throw new Error(`Server antwortete mit Status ${res.status}`)
      }

      const resData = await res.json()
      setAiFeedback(resData.response)
    } catch (e) {
      console.error('[AI Audit Error]', e)
      setError('Das KI-Audit konnte nicht durchgeführt werden. Bitte überprüfe deine Internetverbindung.')
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
                  <span className="char-counter">{scriptHook.length}/150</span>
                </div>
                <textarea
                  value={scriptHook}
                  maxLength={150}
                  onChange={(e) => {
                    setScriptHook(e.target.value)
                    setSelectedPreset('')
                  }}
                  placeholder="Wie fesselst du die Aufmerksamkeit sofort? Keine Begrüßungen!"
                  rows={2}
                />
              </div>

              <div className="input-field">
                <div className="input-field-header">
                  <label className="input-label">Video-Hauptteil (Body)</label>
                  <span className="char-counter">{scriptBody.length}/1000</span>
                </div>
                <textarea
                  value={scriptBody}
                  maxLength={1000}
                  onChange={(e) => {
                    setScriptBody(e.target.value)
                    setSelectedPreset('')
                  }}
                  placeholder="Inhalt. Formuliere kurze, dynamische Sätze für schnelles Pacing."
                  rows={4}
                />
              </div>

              <div className="input-field">
                <div className="input-field-header">
                  <label className="input-label">Call to Action & Loop (Ende)</label>
                  <span className="char-counter">{scriptCta.length}/150</span>
                </div>
                <textarea
                  value={scriptCta}
                  maxLength={150}
                  onChange={(e) => {
                    setScriptCta(e.target.value)
                    setSelectedPreset('')
                  }}
                  placeholder="Wie schließt das Video? Perfekt ist ein offener Loop zurück zum Hook."
                  rows={2}
                />
              </div>

              <button 
                className="ai-audit-btn" 
                onClick={runAiAudit}
                disabled={aiAuditing || cooldown > 0 || (!scriptHook.trim() && !scriptBody.trim())}
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
              {analyzedCurve && (
                <div className="svg-chart-container">
                  <div className="chart-y-axis">
                    <span>100%</span>
                    <span>50%</span>
                    <span>0%</span>
                  </div>
                  <div className="chart-viewport">
                    <svg viewBox="0 0 300 100" preserveAspectRatio="none">
                      <defs>
                        <linearGradient id="retention-gradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#1d9e75" stopOpacity="0.3" />
                          <stop offset="100%" stopColor="#1d9e75" stopOpacity="0.0" />
                        </linearGradient>
                      </defs>
                      
                      {/* Grid Lines */}
                      <line x1="0" y1="50" x2="300" y2="50" stroke="#f1f5f9" strokeDasharray="3" />
                      <line x1="30" y1="0" x2="30" y2="100" stroke="#f1f5f9" strokeDasharray="2" />
                      <line x1="270" y1="0" x2="270" y2="100" stroke="#f1f5f9" strokeDasharray="2" />

                      {/* Area Under Curve */}
                      <path d={getAreaPathData(analyzedCurve)} fill="url(#retention-gradient)" />
                      
                      {/* Curve Path */}
                      <path d={getPathData(analyzedCurve)} fill="none" stroke="#1d9e75" strokeWidth="2.5" />
                      
                      {/* Key Points Markers */}
                      <circle cx="30" cy={Math.max(2, Math.min(98, 100 - (analyzedCurve[3] || 50)))} r="4" fill="#166534" />
                      <circle cx="270" cy={Math.max(2, Math.min(98, 100 - (analyzedCurve[27] || 50)))} r="4" fill="#166534" />
                    </svg>
                    
                    <div className="chart-markers">
                      <span className="marker-tag hook-tag" style={{ top: `${Math.max(5, Math.min(90, 100 - (analyzedCurve[3] || 50)))}%` }}>Hook</span>
                      <span className="marker-tag cta-tag" style={{ top: `${Math.max(5, Math.min(90, 100 - (analyzedCurve[27] || 50)))}%` }}>CTA</span>
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
              )}

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
  const match = markdown.match(/### ✍️ OPTIMIERTES SKRIPT([\s\S]*?)(### 🎬 CAPCUT-REGIEANWEISUNGEN|$)/i)
  return match ? match[1].trim() : markdown
}
