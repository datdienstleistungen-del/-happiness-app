import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Rocket, Check, Copy, Share2, Sparkles, ChevronDown, ChevronUp, RotateCcw, ArrowRight, ArrowLeft, Info, X } from 'lucide-react'
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
    const content = videoPlatform?.content
    if (!content) return null

    const hook = content.hook || ''
    const body = content.body || ''
    const cta = content.cta || ''

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
        }
        localStorage.removeItem('hit_engine_state')
      }
    } catch {}
  }, [])

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
    const state = { phase, goal, analysis, recommendations, results, topResults, generatedMore }
    localStorage.setItem('hit_engine_state', JSON.stringify(state))
    navigate(path)
  }, [phase, goal, analysis, recommendations, results, topResults, generatedMore, navigate])

  const chips = GOAL_CHIPS[lang] || GOAL_CHIPS.de

  const handleChipClick = (chip) => {
    setGoal(chip.label)
  }

  const startAnalysis = async () => {
    if (!goal.trim()) return
    setPhase('analysis')
    setError('')
    trackEvent('hit_started', { goal: goal.trim() })

    try {
      const chatEndpoint = getChatEndpoint()
      let token = ''
      try {
        const { data: { session } } = await supabase.auth.getSession()
        token = session?.access_token || ''
      } catch {}

      const analysisResult = await analyzeGoal(goal.trim(), chatEndpoint, token, videoEditor)
      setAnalysis(analysisResult)

      const recs = await generateRecommendations(goal.trim(), analysisResult, chatEndpoint, token, videoEditor)
      setRecommendations(recs)

      trackEvent('analysis_completed', { goal: goal.trim(), contentScore: analysisResult.contentScore, videoEditor })

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

      const promises = platformsToGenerate.map(async (platformKey) => {
        const result = await runPlatformAgent(platformKey, goal, masterBrief, chatEndpoint, token, videoEditor)
        if (result) {
          newResults[platformKey] = result
          setResults({ ...newResults })
        }
        setProgress(prev => ({ ...prev, [platformKey]: 'done' }))
      })

      await Promise.all(promises)

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

      setPhase('result')
      trackEvent('package_received', { goal: goal.trim(), platformCount: platformsToGenerate.length })
    } catch (err) {
      console.error('Generation failed:', err)
      setError('Content-Erstellung fehlgeschlagen. Bitte versuche es erneut.')
      setPhase('questions')
    }
  }

  const handleStart = () => {
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
      const result = await runPlatformAgent(platformKey, goal, masterBrief, chatEndpoint, token, videoEditor)
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

  const copyToClipboard = (text, platform = 'all') => {
    navigator.clipboard.writeText(text)
    trackEvent('content_copied', { platform })
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

  const allPlatforms = getAllPlatforms()
  const generatedPlatforms = Object.keys(results)
  const top3Keys = analysis?.topPlatforms || []

  return (
    <div className="platform-engine">
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
            if (Object.keys(results).length > 0) {
              setMobileStep('analysis');
            }
          }}
          disabled={Object.keys(results).length === 0}
        >
          2. Analyse
        </button>
        <button
          className={`pe-wizard-tab ${mobileStep === 'studio' ? 'active' : ''}`}
          onClick={() => {
            if (Object.keys(results).length > 0) {
              setMobileStep('studio');
            }
          }}
          disabled={Object.keys(results).length === 0}
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
              {phase === 'input' && (
                <div className="pe-input-phase">
                  <div className="pe-main-layout">
                    {/* On mobile input step, we only show the right column */}
                    <div className="pe-right-column">
                      <div className="pe-hero">
                        <div className="pe-title-row">
                          <VerticalLogo size="small" />
                          <button className="pe-info-btn" onClick={() => setShowInfo(true)} aria-label="Info">
                            <Info size={18} />
                          </button>
                        </div>
                        <p className="pe-subtitle">{t('landing.tagline')}</p>
                      </div>

                      <div className="pe-input-wrap">
                        <input
                          className="pe-input"
                          type="text"
                          value={goal}
                          onChange={(e) => setGoal(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && startAnalysis()}
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
                          {getGoalSuggestions().map((chip) => (
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
          {mobileStep === 'analysis' && getMobileAnalysis() && (() => {
            const analysisData = getMobileAnalysis();
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
              </div>
            );
          })()}

          {/* STEP 3: STUDIO RESULTS SCREEN */}
          {mobileStep === 'studio' && phase === 'result' && (
            <div className="pe-result-phase">
              <div className="pe-result-header">
                <h2 className="pe-result-title">✨ {t('platformEngine.resultTitle')}</h2>
                <p className="pe-result-subtitle">
                  {goal} · {top3Keys.length} Plattformen erstellt
                </p>
              </div>

              <div className="pe-platform-grid">
                {top3Keys.map((key, index) => {
                  const r = topResults[key]
                  if (!r || !r.content) return null
                  const isCopied = copiedPlatform === key
                  return (
                    <div key={key} className={`pe-platform-card ${isCopied ? 'pe-platform-card-copied' : ''}`}>
                      <div className="pe-platform-card-header">
                        <div className="pe-platform-name-group">
                          <span className="pe-platform-step">{index + 1}/3</span>
                          <span className="pe-platform-name">{r.icon} {r.name}</span>
                        </div>
                        <div className="pe-copy-btn-group">
                          <button
                            className={`pe-copy-btn pe-copy-btn-card ${isCopied ? 'pe-copy-btn-done' : ''}`}
                            onClick={() => {
                              copyToClipboard(getResultText(r), key)
                              setCopiedPlatform(key)
                              setTimeout(() => setCopiedPlatform(null), 2000)
                            }}
                          >
                            {isCopied ? <><Check size={14} /> Kopiert!</> : <><Copy size={14} /> Kopieren</>}
                          </button>
                          <button
                            className="pe-copy-btn pe-copy-btn-card pe-copy-btn-primary"
                            onClick={() => {
                              const content = r.content
                              if (content) {
                                localStorage.setItem('hit_latest_hook', content.hook || '')
                                localStorage.setItem('hit_latest_body', content.body || '')
                                localStorage.setItem('hit_latest_cta', content.cta || '')
                              }
                              saveStateAndNavigate('/capcut-studio')
                            }}
                          >
                            In CapCut einfügen
                          </button>
                        </div>
                      </div>

                      <div className="pe-platform-card-body">
                        {r.content.hook && (
                          <div className="pe-content-field">
                            <span className="pe-field-label">Hook (0-3s):</span>
                            <p className="pe-field-value">{r.content.hook}</p>
                          </div>
                        )}
                        {r.content.body && (
                          <div className="pe-content-field">
                            <span className="pe-field-label">Hauptteil:</span>
                            <p className="pe-field-value">{r.content.body}</p>
                          </div>
                        )}
                        {r.content.cta && (
                          <div className="pe-content-field">
                            <span className="pe-field-label">CTA & Loop:</span>
                            <p className="pe-field-value">{r.content.cta}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>

              <NextActionHub
                onOpenCapCut={() => {
                  trackLandingFunnel('post_result_action', { action: 'capcut' })
                  saveStateAndNavigate('/capcut-studio')
                }}
                onTrackAnalytics={() => {
                  trackLandingFunnel('post_result_action', { action: 'tracking' })
                  const videoPlatform = results.tiktok || results.instagram || results.youtube || Object.values(results)[0]
                  const content = videoPlatform?.content
                  if (content) {
                    localStorage.setItem('hit_latest_hook', content.hook || '')
                    localStorage.setItem('hit_latest_body', content.body || '')
                    localStorage.setItem('hit_latest_cta', content.cta || '')
                  }
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
                }}
              />
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
                    <div className="pe-title-row">
                      <VerticalLogo size="small" />
                      <button className="pe-info-btn" onClick={() => setShowInfo(true)} aria-label="Info">
                        <Info size={18} />
                      </button>
                    </div>
                    <p className="pe-subtitle">{t('landing.tagline')}</p>
                  </div>

                  <div className="pe-input-wrap">
                    <input
                      className="pe-input"
                      type="text"
                      value={goal}
                      onChange={(e) => setGoal(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && startAnalysis()}
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
                      {getGoalSuggestions().map((chip) => (
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
          {phase === 'result' && (
            <div className="pe-result-phase">
              <div className="pe-result-header">
                <h2 className="pe-result-title">✨ {t('platformEngine.resultTitle')}</h2>
                <p className="pe-result-subtitle">
                  {goal} · {top3Keys.length} Plattformen erstellt
                </p>
              </div>

              <div className="pe-platform-grid">
                {top3Keys.map((key, index) => {
                  const r = topResults[key]
                  if (!r || !r.content) return null
                  const isCopied = copiedPlatform === key
                  return (
                    <div key={key} className={`pe-platform-card ${isCopied ? 'pe-platform-card-copied' : ''}`}>
                      <div className="pe-platform-card-header">
                        <div className="pe-platform-name-group">
                          <span className="pe-platform-step">{index + 1}/3</span>
                          <span className="pe-platform-name">{r.icon} {r.name}</span>
                        </div>
                        <div className="pe-copy-btn-group">
                          <button
                            className={`pe-copy-btn pe-copy-btn-card ${isCopied ? 'pe-copy-btn-done' : ''}`}
                            onClick={() => {
                              copyToClipboard(getResultText(r), key)
                              setCopiedPlatform(key)
                              setTimeout(() => setCopiedPlatform(null), 2000)
                            }}
                          >
                            {isCopied ? <><Check size={14} /> Kopiert!</> : <><Copy size={14} /> Kopieren</>}
                          </button>
                          <button
                            className="pe-copy-btn pe-copy-btn-card pe-copy-btn-primary"
                            onClick={() => {
                              const content = r.content
                              if (content) {
                                localStorage.setItem('hit_latest_hook', content.hook || '')
                                localStorage.setItem('hit_latest_body', content.body || '')
                                localStorage.setItem('hit_latest_cta', content.cta || '')
                              }
                              saveStateAndNavigate('/capcut-studio')
                            }}
                          >
                            In CapCut einfügen
                          </button>
                        </div>
                      </div>

                      <div className="pe-platform-card-body">
                        {r.content.hook && (
                          <div className="pe-content-field">
                            <span className="pe-field-label">Hook (0-3s):</span>
                            <p className="pe-field-value">{r.content.hook}</p>
                          </div>
                        )}
                        {r.content.body && (
                          <div className="pe-content-field">
                            <span className="pe-field-label">Hauptteil:</span>
                            <p className="pe-field-value">{r.content.body}</p>
                          </div>
                        )}
                        {r.content.cta && (
                          <div className="pe-content-field">
                            <span className="pe-field-label">CTA & Loop:</span>
                            <p className="pe-field-value">{r.content.cta}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>

              <NextActionHub
                onOpenCapCut={() => {
                  trackLandingFunnel('post_result_action', { action: 'capcut' })
                  saveStateAndNavigate('/capcut-studio')
                }}
                onTrackAnalytics={() => {
                  trackLandingFunnel('post_result_action', { action: 'tracking' })
                  const videoPlatform = results.tiktok || results.instagram || results.youtube || Object.values(results)[0]
                  const content = videoPlatform?.content
                  if (content) {
                    localStorage.setItem('hit_latest_hook', content.hook || '')
                    localStorage.setItem('hit_latest_body', content.body || '')
                    localStorage.setItem('hit_latest_cta', content.cta || '')
                  }
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
                }}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}