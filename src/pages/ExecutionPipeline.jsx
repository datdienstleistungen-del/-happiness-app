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
      facebook: `Du bist ein erfahrener Facebook-Content-Writer fuer die Marke Happiness. 
Schreibe einen fertigen, direkt postbaren Facebook-Post basierend auf diesem Ziel des Nutzers.
Ton: Warmherzig,社区-orientiert, wie ein Freund der anderen etwas empfiehlt. Nicht werblich, nicht KI-typisch.
Laenge: 3-5 kurze Absaetze. Hook in der ersten Zeile. Call-to-Action am Ende.
Format: Klarer Fliesstext. Keine Tabellen, keine Listen, keine Markdown-Formatierung.
Antworte NUR mit dem fertigen Post-Text, kein Meta-Kommentar, keine Erklaerung.`,

      instagram: `Du bist ein erfahrener Instagram-Content-Writer fuer die Marke Happiness. 
Schreibe einen fertigen, direkt postbaren Instagram-Caption basierend auf diesem Ziel des Nutzers.
Ton: Visuell, inspirierend, kurz. Wie ein Instagram-Post der gut performt.
Laenge: 2-4 kurze Absaetze max. Emoji am Anfang des ersten Satzes erlaubt.
Hashtags: 5-8 relevante Hashtags am Ende.
Format: Klarer Fliesstext. Keine Tabellen, keine Listen, keine Markdown-Formatierung.
Antworte NUR mit dem fertigen Post-Text, kein Meta-Kommentar, keine Erklaerung.`,

      x: `Du bist ein erfahrener X/Twitter-Writer fuer die Marke Happiness. 
Schreibe einen fertigen, direkt postbaren X-Post basierend auf diesem Ziel des Nutzers.
Ton: Zugespitzt, direkt, kein Roman. Wie ein Tweet der viral geht.
Laenge: MAXIMAL 250 Zeichen (inkl. Leerzeichen). Kein Fliesstext-Roman.
Format: Klartext. Keine Markdown-Formatierung, keine Listen.
Antworte NUR mit dem fertigen Tweet-Text, kein Meta-Kommentar, keine Erklaerung.`,

      reddit: `Du bist ein erfahrener Reddit-Content-Writer fuer die Marke Happiness. 
Schreibe einen fertigen, direkt postbaren Reddit-Post basierend auf diesem Ziel des Nutzers.
Ton: Ehrlich,社区-typisch, wie ein echter Reddit-User der etwas teilt. Keine Werbesprache, kein Marketing.
Laenge: 1-3 Absaetze. Direkt, ohne Umschweife.
Format: Klarer Fliesstext. Keine Tabellen, keine Listen, keine Markdown-Formatierung.
Antworte NUR mit dem fertigen Post-Text, kein Meta-Kommentar, keine Erklaerung.`,

      content: `Du bist ein erfahrener Content-Writer fuer die Marke Happiness. 
Schreibe einen fertigen, direkt verwendbaren Text basierend auf diesem Ziel des Nutzers.
Ton: Professionell, klar, wie ein erfahrenes Softwareunternehmen.
Laenge: Passend zum Zweck, 2-5 Absaetze.
Format: Klarer Fliesstext. Keine Tabellen, keine Listen, keine Markdown-Formatierung.
Antworte NUR mit dem fertigen Text, kein Meta-Kommentar, keine Erklaerung.`
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

  useEffect(() => {
    if (!goal.trim()) {
      navigate('/')
      return
    }

    let cancelled = false

    analyzeIntent(goal).then(result => {
      if (cancelled) return

      if (!result || result.platform === 'chat') {
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
      } else if (intent.platform === 'facebook' || intent.platform === 'instagram' || intent.platform === 'content') {
        navigate('/creator-academy', { state: { draft: generatedContent, pipelineResult: apiResult } })
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
