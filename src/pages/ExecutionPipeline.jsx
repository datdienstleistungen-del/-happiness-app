import { useState, useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Check, ArrowRight, Clock, Sparkles, HelpCircle } from 'lucide-react'
import { useLanguage } from '../i18n/translations'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { getChatEndpoint } from '../lib/hit'
import { trackIdeaSubmitted, trackWorkflowCompleted, trackArtifactSaved, trackPlatformsDetected, trackMasterBriefGenerated, trackPlatformAgentResult, trackMultiPlatformCount } from '../intelligence/analytics'
import { detectPlatforms, runPlatformAgent } from '../intelligence/content-engine'
import { generateQuestionSequence, getNextQuestion, buildMasterBriefFromAnswers } from '../intelligence/guided-questions'
import './ExecutionPipeline.css'

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

  const [phase, setPhase] = useState('analyzing')
  const [intent, setIntent] = useState(null)
  const [currentStep, setCurrentStep] = useState(0)
  const [completedSteps, setCompletedSteps] = useState([])
  const [finished, setFinished] = useState(false)
  const [apiResult, setApiResult] = useState(null)
  const [apiDone, setApiDone] = useState(false)
  const [guidedQuestions, setGuidedQuestions] = useState([])
  const [guidedIndex, setGuidedIndex] = useState(0)
  const [guidedAnswers, setGuidedAnswers] = useState({})
  const [guidedGoal, setGuidedGoal] = useState('')
  const [error, setError] = useState('')
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
    if (guidedQuestions.length > 0) return

    trackIdeaSubmitted(goal)

    // Start guided flow: H.I.T. asks questions first
    const questions = generateQuestionSequence(goal)
    setGuidedQuestions(questions)
    setGuidedGoal(goal)
    setGuidedIndex(0)
    setGuidedAnswers({})
    setPhase('guided')
    updateWorkflowStatus('guiding')
  }, [goal])

  useEffect(() => {
    if (phase !== 'executing' || !finished || !apiDone || !intent) return

    updateWorkflowStatus('reviewing')
    trackWorkflowCompleted(intent?.platform || 'content', Math.round((Date.now() - startTime) / 1000))
    setShowResult(true)
  }, [finished, apiDone, intent, goal, phase])

  const handleGuidedAnswer = (questionId, value) => {
    try {
      console.log('[Guided] Answer:', questionId, value)
      const newAnswers = { ...guidedAnswers, [questionId]: value }
      setGuidedAnswers(newAnswers)

      const next = getNextQuestion(guidedQuestions, newAnswers, guidedIndex + 1)
      console.log('[Guided] Next:', next ? next.question.id : 'DONE — starting execution')
      if (next) {
        setGuidedIndex(next.index)
      } else {
        startExecutionFromGuided(newAnswers)
      }
    } catch (err) {
      console.error('[Guided] Error:', err)
      setError('Ein Fehler ist aufgetreten. Bitte versuch es nochmal.')
      setPhase('error')
    }
  }

  const startExecutionFromGuided = async (answers) => {
    try {
      console.log('[Pipeline] Starting execution with answers:', answers)
      const brief = buildMasterBriefFromAnswers(guidedGoal, answers)

      // Detect platform from answers
      const channel = answers.channel || 'social_media'
      const platforms = Array.isArray(answers.platforms) ? answers.platforms : (answers.platforms ? [answers.platforms] : [])
      let detectedPlatform = 'content'

      if (channel === 'kleinanzeigen') detectedPlatform = 'marketplace'
      else if (platforms.includes('tiktok') || /video|tiktok|reel|kurzvideo/.test(guidedGoal.toLowerCase())) detectedPlatform = 'tiktok'
      else if (platforms.length > 0) detectedPlatform = platforms[0]
      else if (/video|tiktok|reel|kurzvideo/.test(guidedGoal.toLowerCase())) detectedPlatform = 'tiktok'

      proceedToExecution(answers, detectedPlatform, brief)
    } catch (err) {
      console.error('[Pipeline] Error in startExecutionFromGuided:', err)
      setError('Ein Fehler ist aufgetreten. Bitte versuch es nochmal.')
      setPhase('error')
    }
  }

  const proceedToExecution = (answers, detectedPlatform, brief) => {
    // Build enriched goal from answers
    const platforms = Array.isArray(answers.platforms) ? answers.platforms : (answers.platforms ? [answers.platforms] : [])
    const platformText = platforms.length > 0 ? platforms.join(', ') : ''
    const enrichedGoal = [
      guidedGoal,
      `Zielgruppe: ${answers.audience || ''}`,
      `Kanal: ${answers.channel || ''}${platformText ? ` (${platformText})` : ''}`,
      `Ziel: ${answers.goal_type || ''}`,
      `Tonfall: ${answers.tone || ''}`,
      answers.usp ? `USP: ${answers.usp}` : '',
    ].filter(Boolean).join('. ')

    setIntent({ platform: detectedPlatform, action: 'execute' })
    setPhase('executing')
    updateWorkflowStatus('executing')

    const steps = STEP_LABELS_BY_PLATFORM[detectedPlatform] || []
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

    if (detectedPlatform !== 'marketplace') {
      startRealWork(detectedPlatform, enrichedGoal).then(async (r) => {
        setApiResult(r)
        setApiDone(true)
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
            const artifactType = detectedPlatform === 'tiktok' ? 'video' : 'post'
            trackArtifactSaved(artifactType)
            await supabase.from('workflow_artifacts').insert({
              workflow_id: workflowRef.current.id,
              artifact_type: artifactType,
              content: r
            })
          }
        }
      }).catch(err => {
        console.error('[Pipeline] startRealWork failed:', err)
        setError('H.I.T. konnte die Arbeit nicht starten. Bitte versuch es nochmal.')
        setPhase('error')
      })
    } else {
      setApiDone(true)
    }
  }

  const navigateToResult = () => {
    const generatedContent = apiResult?.content || apiResult?.contents?.[0]?.content || goal
    const goalLower = goal.toLowerCase()

    updateWorkflowStatus('published')
    updateStepStatus('publish', 'completed')

    if (intent.platform === 'tiktok' || /video|tiktok|reel|kurzvideo/.test(goalLower)) {
      navigate('/capcut-studio', { state: { postText: generatedContent, pipelineResult: apiResult } })
    } else if (intent.platform === 'marketplace') {
      navigate('/marketplace', { state: { form: { title: goal, description: goal, price: '', category: 'Sonstiges' }, startTab: 'create' } })
    } else {
      navigate('/post-preparation', { state: { draft: generatedContent, feedback: '', platform: intent.platform } })
    }
  }

  if (phase === 'guided') {
    const next = getNextQuestion(guidedQuestions, guidedAnswers, guidedIndex)
    if (!next) {
      // fallback: should not happen
      setPhase('analyzing')
      return null
    }
    const q = next.question
    const progress = ((guidedIndex) / guidedQuestions.length) * 100

    return (
      <div className="ep-page">
        <div className="ep-card">
          <div className="ep-header">
            <div className="ep-header-brand">
              <span className="ep-hit-h">H</span><span className="ep-hit-rest">.I.T.</span>
            </div>
            <p className="ep-goal">"{guidedGoal}"</p>
          </div>

          <div style={{ width: '100%', height: '4px', background: '#e5e7eb', borderRadius: '2px', marginBottom: '24px' }}>
            <div style={{ width: `${progress}%`, height: '100%', background: '#7c3aed', borderRadius: '2px', transition: 'width 0.3s ease' }} />
          </div>

          <div style={{ textAlign: 'center', padding: '0 16px' }}>
            <div style={{ fontSize: '2rem', marginBottom: '8px' }}>
              {guidedIndex === 0 ? '👋' : guidedIndex === guidedQuestions.length - 1 ? '✨' : '💬'}
            </div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: '600', color: '#111827', marginBottom: '6px' }}>
              {q.question}
            </h2>
            {q.hint && (
              <p style={{ fontSize: '0.85rem', color: '#6b7280', marginBottom: '20px' }}>
                {q.hint}
              </p>
            )}

            {q.type === 'text' ? (
              <div style={{ maxWidth: '400px', margin: '0 auto' }}>
                <input
                  type="text"
                  value={guidedAnswers[q.id] || ''}
                  onChange={(e) => setGuidedAnswers(prev => ({ ...prev, [q.id]: e.target.value }))}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && guidedAnswers[q.id]?.trim()) {
                      handleGuidedAnswer(q.id, guidedAnswers[q.id])
                    }
                  }}
                  placeholder={q.placeholder || 'Deine Antwort...'}
                  autoFocus
                  style={{
                    width: '100%', padding: '12px 16px', borderRadius: '10px',
                    border: '2px solid #e5e7eb', fontSize: '15px', outline: 'none',
                    transition: 'border-color 0.2s',
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#7c3aed'}
                  onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
                />
                <button
                  onClick={() => handleGuidedAnswer(q.id, guidedAnswers[q.id])}
                  disabled={!guidedAnswers[q.id]?.trim()}
                  style={{
                    marginTop: '12px', padding: '10px 24px', borderRadius: '10px',
                    border: 'none', background: guidedAnswers[q.id]?.trim() ? '#7c3aed' : '#d1d5db',
                    color: 'white', fontWeight: '600', fontSize: '14px', cursor: guidedAnswers[q.id]?.trim() ? 'pointer' : 'not-allowed',
                    transition: 'background 0.2s',
                  }}
                >
                  Weiter →
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxWidth: '400px', margin: '0 auto' }}>
                {q.options.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => handleGuidedAnswer(q.id, opt.value)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '12px',
                      padding: '12px 16px', borderRadius: '10px',
                      border: guidedAnswers[q.id] === opt.value ? '2px solid #7c3aed' : '2px solid #e5e7eb',
                      background: guidedAnswers[q.id] === opt.value ? '#f5f3ff' : 'white',
                      cursor: 'pointer', textAlign: 'left', fontSize: '14px', fontWeight: '500',
                      transition: 'all 0.15s',
                    }}
                  >
                    <span style={{ fontSize: '1.2rem' }}>{opt.icon}</span>
                    <span>{opt.label}</span>
                  </button>
                ))}
              </div>
            )}

            <p style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: '20px' }}>
              Frage {guidedIndex + 1} von {guidedQuestions.length}
            </p>
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
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
              <button className="ep-btn primary" onClick={() => { setError(''); setPhase('analyzing'); window.location.reload(); }}>
                <Sparkles size={16} /> Erneut versuchen
              </button>
              <button className="ep-btn secondary" onClick={() => navigate('/')}>Zurueck zur Startseite</button>
            </div>
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

        <div className="ep-how-it-works">
          <HelpCircle size={14} />
          <span>H.I.T. analysiert dein Ziel und generiert automatisch fertige Texte und Skripte. Du musst nur noch kopieren und posten.</span>
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
      </div>
    </div>
  )
}
