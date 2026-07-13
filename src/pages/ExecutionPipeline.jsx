import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Check, ArrowRight, Clock, Sparkles, AlertTriangle, MessageCircle } from 'lucide-react'
import { useLanguage } from '../i18n/translations'
import { supabase } from '../lib/supabase'
import { getChatEndpoint } from '../lib/hit'
import './ExecutionPipeline.css'

const INTENT_PROMPT = `Du bist ein Intent-Analyst. Der Nutzer hat etwas eingegeben. Analysiere:

1. WAS ist das Ziel? (Was will der Nutzer konkret tun?)
2. IST das Ziel GENUG DETAILLIERT um es direkt auszuführen?

Beispiele:
- "Ich will ein TikTok über gesunde Gewohnheiten" → Ziel: tiktok, Detail: hoch, AUSFÜHREN
- "Ich möchte ein TikTok Video erstellen" → Ziel: tiktok, Detail: niedrig, KLÄREN
- "Erstelle einen Facebook-Post über mein neues Produkt" → Ziel: facebook, Detail: hoch, AUSFÜHREN
- "Ich überlege einen Post zu machen" → Ziel: facebook, Detail: niedrig, KLÄREN
- "Soll ich eine Kleinanzeige für mein Auto schalten?" → Ziel: marketplace, Detail: mittel, KLÄREN
- "Verkaufe mein Fahrrad für 200€" → Ziel: marketplace, Detail: hoch, AUSFÜHREN
- "Mir langweilt es sich" → Ziel: keins, AUSFÜHREN (zum Chat)

Antworte NUR mit JSON:
{"platform":"tiktok|facebook|instagram|marketplace|content|chat","intent":"konkret|vage","action":"execute|clarify","clarifyQuestion":"Falls clarify: kurze Frage auf Deutsch (max 15 Wörter), sonst null"}

Regeln:
- "execute" nur wenn konkreter Inhalt im Text steht (Produktname, Thema, Beschreibung)
- "clarify" wenn der Nutzer nur die Plattform nennt aber keinen Inhalt nennt
- "chat" wenn kein erkennbares Plattform-Ziel
- platform "chat" → IMMER action "execute" (zum AI Chat weiterleiten)
- Kein Text außer dem JSON`

async function analyzeIntent(goal) {
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
        message: `Analysiere diese Nutzereingabe:\n\n"${goal}"`,
        systemPrompt: INTENT_PROMPT,
        history: []
      })
    })

    if (!response.ok) return null
    const data = await response.json()
    const raw = (data.response || '').trim()

    const jsonMatch = raw.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return null
    return JSON.parse(jsonMatch[0])
  } catch {
    return null
  }
}

async function startRealWork(platform, goal) {
  try {
    const { data: { session } } = await supabase.auth.getSession()
    const token = session?.access_token || ''

    const WRITING_PROMPTS = {
      facebook: `Rolle: Facebook-Writer fuer Happiness (happiness-eu.netlify.app).
Aufgabe: Ziel des Nutzers in einen postfertigen Facebook-Post umwandeln.
Stil: Warmherzig, wie ein Freund empfiehlt. Kein KI-Sound.
Struktur: Hook, 3-5 Absätze, CTA. Happiness natürlich nennen.
Format: Fliesstext, kein Markdown. Nur den fertigen Text.`,

      instagram: `Rolle: Instagram-Writer fuer Happiness (happiness-eu.netlify.app).
Aufgabe: Ziel des Nutzers in eine postfertige Instagram-Caption umwandeln.
Stil: Visuell, inspirierend, kurz. Emoji am Anfang erlaubt.
Struktur: 2-4 Absätze, 5-8 Hashtags (immer #happiness). Happiness natürlich nennen.
Format: Fliesstext, kein Markdown. Nur den fertigen Text.`,

      x: `Rolle: X/Twitter-Writer fuer Happiness (happiness-eu.netlify.app).
Aufgabe: Ziel des Nutzers in einen Tweet umwandeln.
Stil: Zugespitzt, direkt. 250 Zeichen max. "via @Happiness" wenn Platz.
Format: Klartext, kein Markdown. Nur den Tweet.`,

      reddit: `Rolle: Reddit-User der etwas teilt. Happiness (happiness-eu.netlify.app) dahinter.
Aufgabe: Ziel des Nutzers in einen Reddit-Post umwandeln.
Stil: Ehrlich, direkt. Null Werbung. Reddit hasst Marketing.
Struktur: 1-3 Absätze. Happiness natürlich erwaehnen.
Format: Fliesstext, kein Markdown. Nur den fertigen Text.`,

      content: `Rolle: Content-Writer fuer Happiness (happiness-eu.netlify.app).
Aufgabe: Ziel des Nutzers in einen verwendbaren Text umwandeln.
Stil: Professionell, klar.
Struktur: 2-5 Absätze, passend zum Zweck. Happiness natürlich erwaehnen.
Format: Fliesstext, kein Markdown. Nur den fertigen Text.`
    }

    if (platform === 'tiktok') {
      const res = await fetch('/api/tiktok-video', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ text: goal.trim() })
      })
      if (!res.ok) return null
      return await res.json()
    }

    const prompt = WRITING_PROMPTS[platform]
    if (!prompt) return null

    const response = await fetch(getChatEndpoint(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        message: `Schreibe einen fertigen Beitrag basierend auf diesem Ziel:\n\n"${goal}"`,
        systemPrompt: prompt,
        history: []
      })
    })
    if (!response.ok) return null
    const data = await response.json()
    return { content: data.response }
  } catch {
    return null
  }
  return null
}

const STEP_LABELS_BY_PLATFORM = {
  tiktok: [
    { key: 'understand', duration: 1200 },
    { key: 'script', duration: 1800 },
    { key: 'create', duration: 1500 },
  ],
  facebook: [
    { key: 'understand', duration: 1200 },
    { key: 'research', duration: 1500 },
    { key: 'draft', duration: 1800 },
  ],
  instagram: [
    { key: 'understand', duration: 1200 },
    { key: 'research', duration: 1500 },
    { key: 'draft', duration: 1800 },
  ],
  content: [
    { key: 'understand', duration: 1200 },
    { key: 'research', duration: 1500 },
    { key: 'draft', duration: 1800 },
  ],
  marketplace: [
    { key: 'understand', duration: 1000 },
    { key: 'analyze', duration: 1200 },
    { key: 'prepare', duration: 1000 },
  ],
}

export default function ExecutionPipeline() {
  const { t } = useLanguage()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const goal = searchParams.get('goal') || ''

  const [phase, setPhase] = useState('analyzing')
  const [intent, setIntent] = useState(null)
  const [currentStep, setCurrentStep] = useState(0)
  const [completedSteps, setCompletedSteps] = useState([])
  const [finished, setFinished] = useState(false)
  const [apiResult, setApiResult] = useState(null)
  const [apiDone, setApiDone] = useState(false)
  const [clarifyText, setClarifyText] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!goal.trim()) {
      navigate('/')
      return
    }

    let cancelled = false

    analyzeIntent(goal).then(result => {
      if (cancelled) return

      if (!result) {
        setError('H.I.T. konnte das Ziel nicht analysieren. API-Limit erreicht. Versuch es spaeter nochmal.')
        setPhase('error')
        return
      }

      if (result.platform === 'chat') {
        navigate('/ai-chat', { state: { message: goal } })
        return
      }

      if (result.action === 'clarify') {
        setClarifyText(result.clarifyQuestion || 'Was genau soll ich dafür tun?')
        setPhase('clarify')
        return
      }

      setIntent(result)
      setPhase('executing')

      const steps = STEP_LABELS_BY_PLATFORM[result.platform] || []
      let stepIndex = 0

      const runStep = () => {
        if (stepIndex >= steps.length) {
          setFinished(true)
          return
        }
        setCurrentStep(stepIndex)
        const dur = steps[stepIndex].duration
        setTimeout(() => {
          setCompletedSteps(prev => [...prev, stepIndex])
          stepIndex++
          runStep()
        }, dur)
      }

      runStep()

      if (result.platform !== 'marketplace') {
        startRealWork(result.platform, goal).then(r => {
          setApiResult(r)
          setApiDone(true)
        })
      } else {
        setApiDone(true)
      }
    })

    return () => { cancelled = true }
  }, [goal])

  useEffect(() => {
    if (phase !== 'executing' || !finished || !apiDone || !intent) return

    const timer = setTimeout(() => {
      const generatedContent = apiResult?.content || goal

      if (intent.platform === 'tiktok') {
        navigate('/tiktok-video', { state: { postText: generatedContent, pipelineResult: apiResult } })
      } else if (intent.platform === 'facebook' || intent.platform === 'instagram' || intent.platform === 'linkedin' || intent.platform === 'reddit' || intent.platform === 'x' || intent.platform === 'content') {
        navigate('/post-preparation', { state: { draft: generatedContent, feedback: '' } })
      } else if (intent.platform === 'marketplace') {
        navigate('/marketplace', { state: { form: { title: goal, description: goal, price: '', category: 'Sonstiges' }, startTab: 'create' } })
      }
    }, 600)

    return () => clearTimeout(timer)
  }, [finished, apiDone, intent, goal, navigate, apiResult, phase])

  if (phase === 'clarify') {
    return (
      <div className="ep-page">
        <div className="ep-card">
          <div className="ep-header">
            <div className="ep-header-brand">
              <span className="ep-hit-h">H</span><span className="ep-hit-rest">.I.T.</span>
            </div>
          </div>
          <div className="ep-clarify">
            <div className="ep-clarify-icon"><MessageCircle size={28} /></div>
            <p className="ep-clarify-text">{clarifyText}</p>
            <div className="ep-clarify-actions">
              <button className="ep-btn primary" onClick={() => navigate('/ai-chat', { state: { message: goal } })}>
                <Sparkles size={16} /> Im Chat besprechen
              </button>
              <button className="ep-btn secondary" onClick={() => navigate('/')}>Zurück</button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (phase === 'analyzing') {
    return (
      <div className="ep-page">
        <div className="ep-card">
          <div className="ep-header">
            <div className="ep-header-brand">
              <span className="ep-hit-h">H</span><span className="ep-hit-rest">.I.T.</span>
            </div>
            <p className="ep-goal">"{goal}"</p>
          </div>
          <div className="ep-analyzing">
            <div className="ep-analyzing-spinner"></div>
            <p>H.I.T. analysiert dein Ziel...</p>
          </div>
        </div>
      </div>
    )
  }

  if (phase === 'error') {
    return (
      <div className="ep-page">
        <div className="ep-card">
          <div className="ep-header">
            <div className="ep-header-brand">
              <span className="ep-hit-h">H</span><span className="ep-hit-rest">.I.T.</span>
            </div>
          </div>
          <div className="ep-error" style={{ padding: '24px', textAlign: 'center' }}>
            <p style={{ color: '#991b1b', marginBottom: '16px' }}>{error}</p>
            <button className="ep-btn primary" onClick={() => navigate('/')}>Zurueck zur Startseite</button>
          </div>
        </div>
      </div>
    )
  }

  const stepLabels = {
    understand: t('hp.step.understand') || 'Verstehe dein Ziel...',
    script: t('hp.step.script') || 'Skript wird geschrieben...',
    create: t('hp.step.create') || 'Content wird erstellt...',
    research: t('hp.step.research') || 'Passendes Wissen wird geladen...',
    draft: t('hp.step.draft') || 'Entwurf wird erstellt...',
    analyze: t('hp.step.analyze') || 'Anzeige wird analysiert...',
    prepare: t('hp.step.prepare') || 'Inserat wird vorbereitet...',
  }

  const stepIcons = {
    understand: '🎯',
    script: '📝',
    create: '🎬',
    research: '📚',
    draft: '✍️',
    analyze: '🔍',
    prepare: '📦',
  }

  const steps = STEP_LABELS_BY_PLATFORM[intent?.platform] || []

  return (
    <div className="ep-page">
      <div className="ep-card">
        <div className="ep-header">
          <div className="ep-header-brand">
            <span className="ep-hit-h">H</span><span className="ep-hit-rest">.I.T.</span>
          </div>
          <p className="ep-goal">"{goal}"</p>
        </div>

        <div className="ep-steps">
          {steps.map((step, i) => {
            const isCompleted = completedSteps.includes(i)
            const isCurrent = currentStep === i && !isCompleted
            const isPending = !isCompleted && !isCurrent

            return (
              <div key={step.key} className={`ep-step ${isCompleted ? 'done' : ''} ${isCurrent ? 'active' : ''} ${isPending ? 'pending' : ''}`}>
                <div className="ep-step-icon">
                  {isCompleted ? (
                    <div className="ep-step-check"><Check size={14} /></div>
                  ) : isCurrent ? (
                    <div className="ep-step-spinner">{stepIcons[step.key]}</div>
                  ) : (
                    <div className="ep-step-pending">{stepIcons[step.key]}</div>
                  )}
                </div>
                <div className="ep-step-text">
                  <span className="ep-step-label">{stepLabels[step.key]}</span>
                  {isCompleted && <span className="ep-step-done-label">Fertig</span>}
                  {isCurrent && <span className="ep-step-loading-dots"><span>.</span><span>.</span><span>.</span></span>}
                </div>
                {i < steps.length - 1 && <div className={`ep-step-line ${isCompleted ? 'done' : ''}`} />}
              </div>
            )
          })}
        </div>

        {finished && !apiDone && intent?.platform !== 'marketplace' && (
          <div className="ep-finished ep-waiting">
            <div className="ep-finished-icon"><Clock size={20} /></div>
            <p>H.I.T. arbeitet noch im Hintergrund...</p>
          </div>
        )}

        {finished && apiDone && (
          <div className="ep-finished">
            <div className="ep-finished-icon">✅</div>
            <p>Weiterleitung...</p>
          </div>
        )}
      </div>
    </div>
  )
}
