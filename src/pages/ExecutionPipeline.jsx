import { useState, useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Check, ArrowRight, Clock, Sparkles, AlertTriangle, MessageCircle } from 'lucide-react'
import { useLanguage } from '../i18n/translations'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { getChatEndpoint } from '../lib/hit'
import { trackIdeaSubmitted, trackWorkflowCompleted, trackArtifactSaved, trackPlatformsDetected, trackMasterBriefGenerated, trackPlatformAgentResult, trackMultiPlatformCount } from '../intelligence/analytics'
import { detectPlatforms, buildMasterBrief, runPlatformAgent } from '../intelligence/content-engine'
import './ExecutionPipeline.css'

const INTENT_PROMPT = `Du bist ein Intent-Analyst. Der Nutzer hat etwas eingegeben. Analysiere:

1. WAS ist das Ziel? (Was will der Nutzer konkret tun?)
2. IST das Ziel GENUG DETAILLIERT um es direkt auszuführen?

WICHTIG: Wenn "video", "tiktok", "reel" oder "kurzvideo" im Text vorkommt, ist die Plattform IMMER "tiktok" — egal ob LinkedIn, Instagram oder sonstwas erwähnt wird. Ein Video bleibt ein Video.

Beispiele:
- "Ich will ein TikTok über gesunde Gewohnheiten" → Ziel: tiktok, Detail: hoch, AUSFÜHREN
- "Erstelle ein Video für LinkedIn" → Ziel: tiktok, Detail: hoch, AUSFÜHREN
- "Video für Instagram Reels" → Ziel: tiktok, Detail: hoch, AUSFÜHREN
- "Erstelle einen Facebook-Post über mein neues Produkt" → Ziel: facebook, Detail: hoch, AUSFÜHREN
- "Soll ich eine Kleinanzeige für mein Auto schalten?" → Ziel: marketplace, Detail: mittel, KLÄREN
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
  let result = null
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

    if (response.ok) {
      const data = await response.json()
      const raw = (data.response || '').trim()
      const jsonMatch = raw.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        try { result = JSON.parse(jsonMatch[0]) } catch {}
      }
    }
  } catch {}

  if (!result) result = fallbackIntent(goal)

  if (/video|tiktok|reel|kurzvideo/i.test(goal)) {
    result.platform = 'tiktok'
    result.action = 'execute'
  }

  return result
}

function fallbackIntent(goal) {
  const lower = goal.toLowerCase()
  if (/video|tiktok|reel|kurzvideo/.test(lower)) return { platform: 'tiktok', action: 'execute' }
  if (/instagram|ig|story/.test(lower)) return { platform: 'instagram', action: 'execute' }
  if (/facebook|fb/.test(lower)) return { platform: 'facebook', action: 'execute' }
  if (/linkedin/.test(lower)) return { platform: 'linkedin', action: 'execute' }
  if (/reddit/.test(lower)) return { platform: 'reddit', action: 'execute' }
  if (/tweet|twitter|x /.test(lower)) return { platform: 'x', action: 'execute' }
  if (/post|text|schreib|content|caption/.test(lower)) return { platform: 'content', action: 'execute' }
  if (/feedback|review|verbesser|check/.test(lower)) return { platform: 'creator-academy', action: 'execute' }
  return { platform: 'chat', action: 'execute' }
}

async function startRealWork(platform, goal) {
  try {
    const { data: { session } } = await supabase.auth.getSession()
    const token = session?.access_token || ''
    const chatEndpoint = getChatEndpoint()

    if (/video|tiktok|reel|kurzvideo/i.test(goal)) {
      platform = 'tiktok'
    }

    const { data: masterBriefRaw } = await fetch(chatEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({
        message: `Erstelle einen Master-Brief für dieses Ziel:\n\n"${goal}"`,
        systemPrompt: `Du bist die Master Content Engine. Erstelle einen strukturierten Master-Brief mit: KERNbotschaft, ZIELGRUPPE, EMOTION, HAUPTTHEMA, CALL-TO-ACTION. NUR den Brief, kein Markdown.`,
        history: []
      })
    }).then(r => r.ok ? r.json() : { response: null })

    const masterBrief = masterBriefRaw?.response || goal

    const detectedPlatforms = detectPlatforms(goal)
    trackPlatformsDetected(detectedPlatforms)
    trackMasterBriefGenerated(goal)

    const results = await Promise.all(
      detectedPlatforms.map(p => runPlatformAgent(p, goal, masterBrief, chatEndpoint, token))
    )

    const validResults = results.filter(Boolean)
    validResults.forEach(r => trackPlatformAgentResult(r.platform, true))
    results.filter(r => !r).forEach((_, i) => trackPlatformAgentResult(detectedPlatforms[i], false))

    if (validResults.length === 0) return null

    if (validResults.length > 1) {
      trackMultiPlatformCount(validResults.length)
    }

    if (validResults.length === 1) {
      return {
        content: validResults[0].content,
        platform: validResults[0].platform,
        masterBrief,
        detectedPlatforms,
        agentResults: validResults
      }
    }

    return { contents: validResults, masterBrief, detectedPlatforms, agentResults: validResults }
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
  reddit: [
    { key: 'understand', duration: 1200 },
    { key: 'research', duration: 1500 },
    { key: 'draft', duration: 1800 },
  ],
  pinterest: [
    { key: 'understand', duration: 1200 },
    { key: 'research', duration: 1500 },
    { key: 'draft', duration: 1800 },
  ],
  email: [
    { key: 'understand', duration: 1200 },
    { key: 'research', duration: 1500 },
    { key: 'draft', duration: 1800 },
  ],
  podcast: [
    { key: 'understand', duration: 1200 },
    { key: 'research', duration: 1500 },
    { key: 'draft', duration: 1800 },
  ],
}

export default function ExecutionPipeline() {
  const { t } = useLanguage()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [searchParams] = useSearchParams()
  const goal = searchParams.get('goal') || ''
  const debugMode = searchParams.get('debug') === '1'

  const [phase, setPhase] = useState('analyzing')
  const [intent, setIntent] = useState(null)
  const [currentStep, setCurrentStep] = useState(0)
  const [completedSteps, setCompletedSteps] = useState([])
  const [finished, setFinished] = useState(false)
  const [apiResult, setApiResult] = useState(null)
  const [apiDone, setApiDone] = useState(false)
  const [clarifyText, setClarifyText] = useState('')
  const [error, setError] = useState('')
  const [debugData, setDebugData] = useState(null)
  const [showResult, setShowResult] = useState(false)
  const workflowRef = useRef(null)
  const startTime = useRef(Date.now())

  useEffect(() => {
    if (!user || !goal.trim()) return
    supabase
      .from('workflows')
      .select('id, workflow_steps(id, step_key, order_index, status)')
      .eq('user_id', user.id)
      .eq('goal', goal.trim())
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => { if (data) workflowRef.current = data })
  }, [user, goal])

  const updateStepStatus = async (stepKey, status) => {
    const wf = workflowRef.current
    if (!wf) return
    const step = wf.workflow_steps?.find(s => s.step_key === stepKey)
    if (!step) return
    await supabase.from('workflow_steps').update({ status }).eq('id', step.id)
  }

  const updateWorkflowStatus = async (status) => {
    const wf = workflowRef.current
    if (!wf) return
    await supabase.from('workflows').update({ status, active_phase: status }).eq('id', wf.id)
  }

  useEffect(() => {
    if (!goal.trim()) {
      navigate('/')
      return
    }

    trackIdeaSubmitted(goal)

    let cancelled = false

    analyzeIntent(goal).then(result => {
      if (cancelled) return

      if (!result) {
        setError('H.I.T. konnte das Ziel nicht analysieren. API-Limit erreicht. Versuch es spaeter nochmal.')
        updateWorkflowStatus('archived')
        setPhase('error')
        return
      }

      if (result.platform === 'chat') {
        navigate('/ai-chat', { state: { message: goal } })
        return
      }

      if (result.action === 'clarify') {
        setClarifyText(result.clarifyQuestion || 'Was genau soll ich dafür tun?')
        updateWorkflowStatus('clarifying')
        setPhase('clarify')
        return
      }

      setIntent(result)
      setPhase('executing')
      updateWorkflowStatus('executing')

      const steps = STEP_LABELS_BY_PLATFORM[result.platform] || []
      let stepIndex = 0

      const runStep = () => {
        if (stepIndex >= steps.length) {
          setFinished(true)
          updateWorkflowStatus('reviewing')
          return
        }
        setCurrentStep(stepIndex)
        updateStepStatus(steps[stepIndex].key, 'active')
        const dur = steps[stepIndex].duration
        setTimeout(() => {
          updateStepStatus(steps[stepIndex].key, 'completed')
          setCompletedSteps(prev => [...prev, stepIndex])
          stepIndex++
          runStep()
        }, dur)
      }

      runStep()

      if (result.platform !== 'marketplace') {
        startRealWork(result.platform, goal).then(async (r) => {
          setApiResult(r)
          setApiDone(true)
          if (debugMode && r) {
            setDebugData({
              goal,
              detectedPlatforms: r.detectedPlatforms || [],
              masterBrief: r.masterBrief || '',
              agentResults: r.agentResults || [],
              intent
            })
          }
          if (r && workflowRef.current) {
            if (r.contents) {
              for (const item of r.contents) {
                trackArtifactSaved(item.platform)
                await supabase.from('workflow_artifacts').insert({
                  workflow_id: workflowRef.current.id,
                  artifact_type: item.platform,
                  content: { content: item.content, agent: item.agent, masterBrief: r.masterBrief }
                })
              }
            } else {
              const artifactType = result.platform === 'tiktok' ? 'video' : 'post'
              trackArtifactSaved(artifactType)
              await supabase.from('workflow_artifacts').insert({
                workflow_id: workflowRef.current.id,
                artifact_type: artifactType,
                content: r
              })
            }
          }
        })
      } else {
        setApiDone(true)
      }
    })

    return () => { cancelled = true }
  }, [goal])

  useEffect(() => {
    if (phase !== 'executing' || !finished || !apiDone || !intent) return

    updateWorkflowStatus('reviewing')
    trackWorkflowCompleted(intent?.platform || 'content', Math.round((Date.now() - startTime) / 1000))
    setShowResult(true)
  }, [finished, apiDone, intent, goal, phase])

  const navigateToResult = () => {
    const generatedContent = apiResult?.content || apiResult?.contents?.[0]?.content || goal
    const goalLower = goal.toLowerCase()

    updateWorkflowStatus('published')
    updateStepStatus('publish', 'completed')

    if (intent.platform === 'tiktok' || /video|tiktok|reel|kurzvideo/.test(goalLower)) {
      navigate('/tiktok-video', { state: { postText: generatedContent, pipelineResult: apiResult } })
    } else if (intent.platform === 'marketplace') {
      navigate('/marketplace', { state: { form: { title: goal, description: goal, price: '', category: 'Sonstiges' }, startTab: 'create' } })
    } else {
      navigate('/post-preparation', { state: { draft: generatedContent, feedback: '', platform: intent.platform } })
    }
  }

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

        {finished && apiDone && showResult && (
          <div className="ep-result">
            <div className="ep-result-header">
              <div className="ep-result-icon">✅</div>
              <div>
                <p className="ep-result-title">Ergebnis bereit</p>
                <p className="ep-result-subtitle">
                  {apiResult?.contents
                    ? `${apiResult.contents.length} Plattformen generiert`
                    : `Fertig für ${(intent?.platform || 'diese Plattform').replace('content', 'Content')}`
                  }
                </p>
              </div>
            </div>

            {(apiResult?.content || apiResult?.contents?.[0]?.content) && (
              <div className="ep-result-preview">
                {(apiResult.contents || [{ content: apiResult.content, platform: intent?.platform }]).map((item, i) => (
                  <div key={i} className="ep-result-item">
                    <span className="ep-result-platform">{item.platform || intent?.platform}</span>
                    <p className="ep-result-text">{(item.content || '').slice(0, 200)}{(item.content || '').length > 200 ? '...' : ''}</p>
                  </div>
                ))}
              </div>
            )}

            <button className="ep-btn primary" onClick={navigateToResult}>
              Weiter →
            </button>
          </div>
        )}

        {finished && apiDone && debugMode && debugData && (
          <div className="ep-debug-panel">
            <div className="ep-debug-header">
              <span className="ep-debug-badge">DEBUG</span>
              <span className="ep-debug-goal">"{debugData.goal}"</span>
            </div>

            <div className="ep-debug-section">
              <h4 className="ep-debug-title">Detected Platforms</h4>
              <div className="ep-debug-tags">
                {debugData.detectedPlatforms.map(p => (
                  <span key={p} className="ep-debug-tag">{p}</span>
                ))}
              </div>
            </div>

            <div className="ep-debug-section">
              <h4 className="ep-debug-title">Master Brief</h4>
              <pre className="ep-debug-code">{debugData.masterBrief}</pre>
            </div>

            {debugData.agentResults.map((agent, i) => (
              <div key={i} className="ep-debug-section">
                <h4 className="ep-debug-title">
                  <span className="ep-debug-agent">{agent.agent}</span>
                  <span className="ep-debug-platform">{agent.platform}</span>
                </h4>
                <pre className="ep-debug-code">{(agent.content || '').slice(0, 500)}{(agent.content || '').length > 500 ? '...' : ''}</pre>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
