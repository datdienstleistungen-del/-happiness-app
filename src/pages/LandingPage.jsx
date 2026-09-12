import { useState, useEffect, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { 
  Rocket, Sparkles, Check, ArrowRight, Zap, Clock, Target, 
  Mic, MicOff, Brain, Users, TrendingUp, ShoppingBag, 
  Calendar, UserPlus, Globe, Video, MessageSquare, Share2, 
  Search, ShieldCheck, CheckCircle2, ChevronRight
} from 'lucide-react'
import { trackDemoStarted, trackDemoCompleted } from '../intelligence/analytics'
import { trackLandingFunnel } from '../intelligence/analytics/custom'
import { useLanguage } from '../i18n/translations.jsx'
import InstallButton from '../components/InstallButton'
import VideoShowcase from '../components/VideoShowcase'
import { VerticalLogo } from '../components/Logo'
import MockStudioExplainer from '../components/MockStudioExplainer'
import './LandingPage.css'

const GOAL_CHIPS = [
  { icon: Users, de: 'Mehr Kunden gewinnen', en: 'Get more customers', es: 'Ganar más clientes', fr: 'Gagner plus de clients', it: 'Ottenere più clienti', nl: 'Meer klanten winnen', el: 'Κερδίστε περισσότερους πελάτες' },
  { icon: TrendingUp, de: 'Reichweite erhöhen', en: 'Increase reach', es: 'Aumentar alcance', fr: 'Augmenter la portée', it: 'Aumentare la portata', nl: 'Bereik vergroten', el: 'Αυξήστε την εμβέλεια' },
  { icon: ShoppingBag, de: 'Produkt verkaufen', en: 'Sell a product', es: 'Vender producto', fr: 'Vendre un produit', it: 'Vendere un prodotto', nl: 'Product verkopen', el: 'Πουλήστε ένα προϊόν' },
  { icon: HeartHandshakeIcon, de: 'Community aufbauen', en: 'Build community', es: 'Crear comunidad', fr: 'Créer une communauté', it: 'Creare una community', nl: 'Community opbouwen', el: 'Χτίστε κοινότητα' },
  { icon: Calendar, de: 'Event bewerben', en: 'Promote event', es: 'Promocionar evento', fr: 'Promouvoir un événement', it: 'Promuovere un evento', nl: 'Evenement promoten', el: 'Προωθήστε ένα event' },
  { icon: UserPlus, de: 'Mitarbeiter finden', en: 'Find employees', es: 'Encontrar empleados', fr: 'Trouver des employés', it: 'Trovare dipendenti', nl: 'Medewerkers vinden', el: 'Βρείτε υπαλλήλους' },
]

function HeartHandshakeIcon(props) {
  return <Users {...props} />
}

const PRE_FILL_EXAMPLES = [
  { de: 'Mein nächstes Reel soll viral gehen', en: 'Make my next Reel go viral' },
  { de: 'Mehr Reichweite auf Instagram', en: 'More reach on Instagram' },
  { de: 'Mehr Kunden über LinkedIn gewinnen', en: 'Get more customers via LinkedIn' },
  { de: 'Einen erfolgreichen YouTube Short planen', en: 'Plan a successful YouTube Short' },
  { de: 'Einen TikTok erstellen, der geteilt wird', en: 'Create a TikTok that gets shared' },
  { de: 'Mehr Anfragen über Social Media erhalten', en: 'Get more inquiries via social media' },
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

const PLATFORMS = [
  { name: 'TikTok', tag: 'Short Video' },
  { name: 'Instagram', tag: 'Reels & Carousel' },
  { name: 'LinkedIn', tag: 'B2B & Thought Leadership' },
  { name: 'Facebook', tag: 'Community & Groups' },
  { name: 'YouTube', tag: 'Shorts & Longform' },
  { name: 'X / Twitter', tag: 'Threads & News' },
  { name: 'Pinterest', tag: 'Visual Discovery' },
  { name: 'Reddit', tag: 'Discussions & Value' },
  { name: 'Blog', tag: 'SEO & In-Depth' },
  { name: 'Newsletter', tag: 'Direct Retention' },
  { name: 'Google Business', tag: 'Local Search' },
  { name: 'Marktplätze', tag: 'Direct Sales' },
]

export default function LandingPage() {
  const navigate = useNavigate()
  const { t, lang } = useLanguage()
  const heroRef = useRef(null)
  const goalInputRef = useRef(null)
  const inputChangedTracked = useRef(false)
  const [goal, setGoal] = useState('')
  const [phase, setPhase] = useState('input') // input | analysis | result | error
  const [demoResult, setDemoResult] = useState(null)
  const [error, setError] = useState('')
  const [isRecording, setIsRecording] = useState(false)
  const [recognition, setRecognition] = useState(null)
  const [showExplainer, setShowExplainer] = useState(() => {
    return localStorage.getItem('hit_hide_explainer') !== 'true'
  })

  const handleStartTour = () => {
    trackLandingFunnel('tour_clicked')
    navigate('/tour')
  }

  useEffect(() => {
    document.title = 'NeXus — KI-Content & B2B Sales Engine'
    trackLandingFunnel('opened')

    const randomIndex = Math.floor(Math.random() * PRE_FILL_EXAMPLES.length)
    setGoal(PRE_FILL_EXAMPLES[randomIndex][lang] || PRE_FILL_EXAMPLES[randomIndex].de)
  }, [lang])

  useEffect(() => {
    if (goalInputRef.current) {
      goalInputRef.current.style.height = 'auto'
      goalInputRef.current.style.height = `${goalInputRef.current.scrollHeight}px`
    }
  }, [goal])

  useEffect(() => {
    if (!heroRef.current) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          trackLandingFunnel('hero_visible')
          observer.disconnect()
        }
      },
      { threshold: 0.5 }
    )
    observer.observe(heroRef.current)
    return () => observer.disconnect()
  }, [])

  const handleChipClick = (chip) => {
    setGoal(chip[lang] || chip.de)
    trackLandingFunnel('example_changed', { method: 'chip' })
  }

  const handleInputChange = (e) => {
    setGoal(e.target.value)
    if (!inputChangedTracked.current) {
      inputChangedTracked.current = true
      trackLandingFunnel('example_changed', { method: 'typed' })
    }
  }

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
        setGoal(transcript)
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
  }, [lang])

  const toggleRecording = () => {
    if (!recognition) {
      alert(lang === 'de' ? 'Spracherkennung wird in diesem Browser nicht unterstützt.' : 'Speech recognition is not supported in this browser.')
      return
    }
    if (isRecording) {
      recognition.stop()
    } else {
      recognition.start()
    }
  }

  const startDemo = async () => {
    if (!goal.trim()) return
    trackLandingFunnel('generate_clicked')
    trackDemoStarted(goal.trim())
    trackLandingFunnel('analysis_started')
    setPhase('analysis')
    setError('')
    const startTime = Date.now()

    try {
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
      const langInstruction = `\n\nCRITICAL REQUIREMENT: The user's language is ${langName}. All generated content (including text, hooks, descriptions, titles, explanations, suggestions, and responses) MUST be written in ${langName}. Do not translate structural JSON keys, but write all their string values in ${langName}.`

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: `Erstelle einen hochwirksamen Post für dieses Ziel: "${goal.trim()}". Antworte NUR mit JSON: {"hook":"...","body":"...","hashtags":["..."],"cta":"..."}`,
          systemPrompt: `Du bist ein B2B- und Social-Media-Content-Experte. Erstelle einen kurzen, knackigen Post (100-150 Wörter). Hook im ersten Satz. 3-5 Hashtags. Klarer CTA am Ende. Antworte NUR mit validem JSON.` + langInstruction,
          history: []
        })
      })

      if (!res.ok) throw new Error('API Fehler')
      const data = await res.json()

      let parsed = null
      try {
        const jsonMatch = (data.response || '').match(/\{[\s\S]*\}/)
        parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : { body: data.response, hook: '', hashtags: [], cta: '' }
      } catch {
        parsed = { body: data.response || '', hook: '', hashtags: [], cta: '' }
      }

      trackLandingFunnel('analysis_completed', { duration_ms: Date.now() - startTime })
      setDemoResult(parsed)
      setPhase('result')
      trackDemoCompleted(goal.trim())
      setTimeout(() => trackLandingFunnel('result_visible'), 100)
    } catch (err) {
      console.error('Demo error:', err)
      setError('Es ist ein Fehler aufgetreten. Bitte versuche es erneut.')
      setPhase('input')
    }
  }

  const resetDemo = () => {
    setPhase('input')
    setDemoResult(null)
    setError('')
  }

  return (
    <div className="container">
      {/* Hero */}
      <div className="hero landing-hero" ref={heroRef}>
        <div className={showExplainer ? "landing-layout-wrapper" : "landing-layout-single"}>
          <div className={showExplainer ? "landing-left-column" : "landing-single-column"}>
            <h1><VerticalLogo size="large" /></h1>
            <p className="landing-tagline">{t('landing.tagline')}</p>

            <p className="landing-question">{t('landing.question')}</p>

            <div className="landing-input-wrap">
              <div style={{ display: 'flex', flex: 1, position: 'relative', alignItems: 'center' }}>
                <textarea
                  ref={goalInputRef}
                  className="landing-input"
                  style={{ 
                    width: '100%', 
                    paddingRight: '45px', 
                    resize: 'none', 
                    overflowY: 'hidden', 
                    height: 'auto',
                    minHeight: '46px', 
                    maxHeight: '200px', 
                    lineHeight: '1.4'
                  }}
                  rows={1}
                  value={goal}
                  onChange={(e) => {
                    handleInputChange(e)
                    e.target.style.height = 'auto'
                    e.target.style.height = `${e.target.scrollHeight}px`
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      startDemo()
                    }
                  }}
                  placeholder={t('landing.placeholder')}
                  disabled={phase !== 'input'}
                  onFocus={() => trackLandingFunnel('input_focused')}
                />
                <button
                  type="button"
                  className={`landing-mic-btn ${isRecording ? 'recording' : ''}`}
                  onClick={toggleRecording}
                  disabled={phase !== 'input'}
                  title={lang === 'de' ? 'Per Sprache eingeben' : 'Input via speech'}
                >
                  {isRecording ? <MicOff size={18} /> : <Mic size={18} />}
                </button>
              </div>
              <button
                className="btn btn-primary landing-start-btn"
                onClick={startDemo}
                disabled={phase !== 'input' || !goal.trim()}
              >
                {phase === 'input' ? (
                  <><Rocket size={16} /> {t('landing.startButton')}</>
                ) : (
                  <><span className="demo-spinner" /> {t('landing.working')}</>
                )}
              </button>
            </div>

            {error && <p className="landing-error">{error}</p>}

            {/* Quick Chips */}
            {phase === 'input' && (
              <div className="landing-chips">
                {GOAL_CHIPS.map((chip) => {
                  const ChipIcon = chip.icon
                  return (
                    <button
                      key={chip.de}
                      className="landing-chip"
                      onClick={() => handleChipClick(chip)}
                    >
                      <ChipIcon size={14} className="landing-chip-icon" />
                      <span>{chip[lang] || chip.de}</span>
                    </button>
                  )
                })}
              </div>
            )}

            <div className="landing-social-proof">
              <CheckCircle2 size={15} className="landing-social-check text-[#18AB61]" /> 
              <span>{t('landing.freeToStart')}</span>
            </div>

            <div className="landing-meta">
              {t('landing.meta')}
            </div>

            <div className="landing-actions">
              <Link to="/register" className="btn btn-primary">{t('landing.register')}</Link>
              <Link to="/login" className="btn btn-outline">{t('landing.login')}</Link>
            </div>

            <div className="landing-install">
              <InstallButton variant="hero" />
            </div>
          </div>

          {showExplainer && (
            <div className="landing-right-column">
              <MockStudioExplainer onStartTour={handleStartTour} />
            </div>
          )}
        </div>
      </div>

      {/* Analysis Phase */}
      {phase === 'analysis' && (
        <div className="hit-analysis-card">
          <div className="hit-analysis-header">
            <div className="hit-brand">
              <span className="hit-letter">H</span><span className="hit-rest">.I.T.</span>
            </div>
            <span className="hit-status">{t('landing.analyzing')}</span>
          </div>
          <div className="hit-analysis-steps">
            <div className="hit-step done"><Check size={14} /> {t('landing.stepGoal')}</div>
            <div className="hit-step active"><span className="demo-spinner" /> {t('landing.stepStrategy')}</div>
            <div className="hit-step"><span className="hit-step-num">3</span> {t('landing.stepContent')}</div>
          </div>
        </div>
      )}

      {/* Result Phase — Demo with 1 platform */}
      {phase === 'result' && demoResult && (
        <div className="demo-result-card">
          <div className="demo-result-header">
            <div className="hit-brand">
              <span className="hit-letter">H</span><span className="hit-rest">.I.T.</span>
            </div>
            <span className="hit-status">{t('landing.resultReady')}</span>
            <button className="demo-reset" onClick={resetDemo}>{t('landing.demoReset')}</button>
          </div>

          <div className="demo-result-score">
            <div className="score-item">
              <span className="score-label">{t('landing.goalDetected')}</span>
              <span className="score-value done"><Check size={15} /></span>
            </div>
            <div className="score-item">
              <span className="score-label">{t('landing.strategyCreated')}</span>
              <span className="score-value done"><Check size={15} /></span>
            </div>
            <div className="score-item">
              <span className="score-label">{t('landing.contentChance')}</span>
              <span className="score-value highlight">89%</span>
            </div>
            <div className="score-item">
              <span className="score-label">{t('landing.savedTime')}</span>
              <span className="score-value">≈ 2h</span>
            </div>
          </div>

          <div className="demo-result-platform">
            <div className="demo-result-platform-header">
              <span className="platform-badge">Instagram Post</span>
              <button
                className="copy-btn"
                onClick={() => {
                  const text = `${demoResult.hook ? demoResult.hook + '\n\n' : ''}${demoResult.body || ''}${demoResult.cta ? '\n\n' + demoResult.cta : ''}${demoResult.hashtags?.length ? '\n\n' + demoResult.hashtags.map(h => h.startsWith('#') ? h : '#' + h).join(' ') : ''}`
                  navigator.clipboard.writeText(text)
                }}
              >
                {t('landing.copy')}
              </button>
            </div>
            {demoResult.hook && <p className="demo-result-hook">{demoResult.hook}</p>}
            <p className="demo-result-body">{demoResult.body}</p>
            {demoResult.cta && <p className="demo-result-cta">{demoResult.cta}</p>}
            {demoResult.hashtags?.length > 0 && (
              <p className="demo-result-tags">
                {demoResult.hashtags.map((h, i) => (
                  <span key={i} className="hashtag">{h.startsWith('#') ? h : '#' + h}</span>
                ))}
              </p>
            )}
          </div>

          <div className="demo-result-cta-section">
            <p className="demo-result-cta-text">{t('landing.demoCta')}</p>
            <Link to="/register" className="btn btn-primary">
              <Sparkles size={16} /> {t('landing.startFree')}
            </Link>
          </div>
        </div>
      )}

      {/* Video Showcase */}
      <VideoShowcase />

      {/* How it works — Product Explanation */}
      <div className="what-we-are">
        <h2>{t('landing.howItWorks')}</h2>
        <div className="what-we-are-content">
          <div className="what-we-are-workflow">
            <div className="what-we-are-steps">
              <div className="landing-step">
                <div className="landing-step-icon-wrap">
                  <Target size={22} className="landing-step-svg" />
                </div>
                <strong>{t('landing.step1Title')}</strong>
                <p>{t('landing.step1Desc')}</p>
              </div>
              <span className="step-arrow"><ChevronRight size={20} /></span>
              <div className="landing-step">
                <div className="landing-step-icon-wrap">
                  <Brain size={22} className="landing-step-svg" />
                </div>
                <strong>{t('landing.step2Title')}</strong>
                <p>{t('landing.step2Desc')}</p>
              </div>
              <span className="step-arrow"><ChevronRight size={20} /></span>
              <div className="landing-step">
                <div className="landing-step-icon-wrap">
                  <Rocket size={22} className="landing-step-svg" />
                </div>
                <strong>{t('landing.step3Title')}</strong>
                <p>{t('landing.step3Desc')}</p>
              </div>
            </div>
            <p className="what-we-are-tagline">{t('landing.tagline2')}</p>
          </div>

          <div className="what-we-are-cta">
            <p>{t('landing.dsgvo')}</p>
            <Link to="/register" className="btn btn-primary">{t('landing.tryFree')}</Link>
          </div>
        </div>
      </div>

      {/* Platforms */}
      <div className="landing-platforms">
        <h2>{t('landing.platforms')}</h2>
        <div className="platform-grid">
          {PLATFORMS.map(p => (
            <div key={p.name} className="platform-card">
              <span className="platform-name">{p.name}</span>
              <span className="platform-tag-sub">{p.tag}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
