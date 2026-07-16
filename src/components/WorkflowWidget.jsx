import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  X, ChevronRight, Check, Loader, AlertTriangle, Rocket,
  MessageCircle, PenTool, Film, BarChart3, Share2
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { trackWidgetOpened } from '../intelligence/analytics'
import './WorkflowWidget.css'

const PHASES = [
  { key: 'clarifying', label: 'Klären', icon: '🎯', desc: 'Ziel verstehen' },
  { key: 'planning', label: 'Planen', icon: '📝', desc: 'Schritte definieren' },
  { key: 'executing', label: 'Umsetzen', icon: '⚡', desc: 'H.I.T. arbeitet' },
  { key: 'reviewing', label: 'Prüfen', icon: '👁️', desc: 'Ergebnis prüfen' },
  { key: 'published', label: 'Fertig', icon: '🚀', desc: 'Veröffentlicht' },
]

const STEP_ICONS = {
  analyze: MessageCircle,
  script: PenTool,
  design: PenTool,
  video: Film,
  review: BarChart3,
  publish: Share2,
  feedback: MessageCircle,
}

const PLATFORM_META = {
  tiktok: { icon: '🎵', label: 'TikTok', color: '#000000' },
  facebook: { icon: '👥', label: 'Facebook', color: '#1877F2' },
  instagram: { icon: '📸', label: 'Instagram', color: '#E4405F' },
  linkedin: { icon: '💼', label: 'LinkedIn', color: '#0A66C2' },
  youtube: { icon: '▶️', label: 'YouTube', color: '#FF0000' },
  kleinanzeigen: { icon: '🏷️', label: 'Kleinanzeigen', color: '#FF6600' },
  marketplace: { icon: '🏷️', label: 'Marktplatz', color: '#FF6600' },
  reddit: { icon: '🔴', label: 'Reddit', color: '#FF4500' },
  pinterest: { icon: '📌', label: 'Pinterest', color: '#E60023' },
  email: { icon: '✉️', label: 'E-Mail', color: '#007BFF' },
  podcast: { icon: '🎙️', label: 'Podcast', color: '#8B5CF6' },
  video: { icon: '🎬', label: 'Video-Skript', color: '#085041' },
  post: { icon: '📝', label: 'Post-Text', color: '#085041' },
  content: { icon: '📝', label: 'Content', color: '#085041' },
}

export default function WorkflowWidget({ workflow, onClose }) {
  const navigate = useNavigate()
  const [wf, setWf] = useState(workflow)
  const [steps, setSteps] = useState(workflow.workflow_steps || [])
  const [artifacts, setArtifacts] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setWf(workflow)
    setSteps(workflow.workflow_steps || [])
    loadArtifacts(workflow.id)
    trackWidgetOpened(workflow.id)
  }, [workflow])

  async function loadArtifacts(wfId) {
    const { data } = await supabase
      .from('workflow_artifacts')
      .select('*')
      .eq('workflow_id', wfId)
      .order('created_at', { ascending: false })
    setArtifacts(data || [])
  }

  useEffect(() => {
    if (!wf?.id) return
    const channel = supabase
      .channel(`wf-${wf.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'workflow_steps', filter: `workflow_id=eq.${wf.id}` }, (payload) => {
        setSteps(prev => {
          const idx = prev.findIndex(s => s.id === payload.new.id)
          if (idx >= 0) {
            const next = [...prev]
            next[idx] = payload.new
            return next
          }
          return [...prev, payload.new].sort((a, b) => a.order_index - b.order_index)
        })
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'workflows', filter: `id=eq.${wf.id}` }, (payload) => {
        setWf(prev => ({ ...prev, ...payload.new }))
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'workflow_artifacts', filter: `workflow_id=eq.${wf.id}` }, (payload) => {
        setArtifacts(prev => [payload.new, ...prev])
      })
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [wf?.id])

  const currentPhaseIndex = PHASES.findIndex(p => p.key === wf?.status)
  const activeStep = steps.find(s => s.status === 'active')
  const completedSteps = steps.filter(s => s.status === 'completed').length
  const totalSteps = steps.length || 1
  const progress = Math.round((completedSteps / totalSteps) * 100)

  const handleStepClick = (step) => {
    if (step.status !== 'active' && step.status !== 'completed') return
    const toolRoute = getToolRoute(step)
    if (toolRoute) navigate(toolRoute)
  }

  const getToolRoute = (step) => {
    if (!step) return null
    const key = step.step_key || ''
    if (key.includes('script') || key.includes('text') || key.includes('content')) return '/creator-academy'
    if (key.includes('video') || key.includes('tiktok')) return '/tiktok-video'
    if (key.includes('design') || key.includes('image') || key.includes('photo')) return '/photo-editor'
    if (key.includes('story')) return '/fotostory'
    if (key.includes('review') || key.includes('analytics')) return '/analytics'
    return null
  }

  const handleAction = () => {
    if (wf?.status === 'published') {
      navigate('/community')
    } else if (activeStep) {
      const route = getToolRoute(activeStep)
      if (route) navigate(route)
    } else {
      navigate(`/execute?goal=${encodeURIComponent(wf?.goal || '')}`)
    }
  }

  return (
    <div className="workflow-widget-overlay" onClick={onClose}>
      <div className="workflow-widget" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="wf-widget-header">
          <div className="wf-widget-title">
            <Rocket size={18} />
            <span>Workflow</span>
          </div>
          <button className="wf-widget-close" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {/* Goal */}
        <div className="wf-widget-goal">
          <span className="wf-goal-label">Ziel</span>
          <p className="wf-goal-text">{wf?.goal}</p>
          {wf?.platform && (
            <span className="wf-platform-badge">{wf.platform}</span>
          )}
        </div>

        {/* Phases */}
        <div className="wf-phases">
          {PHASES.map((phase, i) => {
            const isPast = i < currentPhaseIndex
            const isCurrent = i === currentPhaseIndex
            const isFuture = i > currentPhaseIndex
            return (
              <div
                key={phase.key}
                className={`wf-phase ${isPast ? 'done' : ''} ${isCurrent ? 'active' : ''} ${isFuture ? 'future' : ''}`}
              >
                <div className="wf-phase-dot">
                  {isPast ? <Check size={12} /> : <span>{phase.icon}</span>}
                </div>
                <div className="wf-phase-info">
                  <span className="wf-phase-label">{phase.label}</span>
                  <span className="wf-phase-desc">{phase.desc}</span>
                </div>
                {i < PHASES.length - 1 && (
                  <div className={`wf-phase-line ${isPast ? 'done' : ''}`} />
                )}
              </div>
            )
          })}
        </div>

        {/* Progress bar */}
        <div className="wf-progress-section">
          <div className="wf-progress-header">
            <span>Fortschritt</span>
            <span>{progress}%</span>
          </div>
          <div className="wf-progress-bar">
            <div className="wf-progress-fill" style={{ width: `${progress}%` }} />
          </div>
        </div>

        {/* Steps */}
        {steps.length > 0 && (
          <div className="wf-steps">
            <h4 className="wf-steps-title">Schritte</h4>
            {steps.sort((a, b) => a.order_index - b.order_index).map(step => {
              const StepIcon = STEP_ICONS[step.step_key] || ChevronRight
              const isActive = step.status === 'active'
              const isCompleted = step.status === 'completed'
              return (
                <div
                  key={step.id}
                  className={`wf-step ${step.status}`}
                  onClick={() => handleStepClick(step)}
                >
                  <div className={`wf-step-icon ${step.status}`}>
                    {step.status === 'completed' ? <Check size={14} /> :
                     step.status === 'active' ? <Loader size={14} className="spin" /> :
                     step.status === 'failed' ? <AlertTriangle size={14} /> :
                     <StepIcon size={14} />}
                  </div>
                  <div className="wf-step-info">
                    <span className="wf-step-label">{step.label}</span>
                    {step.tool_used && (
                      <span className="wf-step-tool">via {step.tool_used}</span>
                    )}
                  </div>
                  {isCompleted && (
                    <button
                      className="wf-step-action"
                      onClick={(e) => {
                        e.stopPropagation()
                        const route = getToolRoute(step)
                        if (route) navigate(route)
                      }}
                    >
                      Ansehen
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* Artifacts */}
        {artifacts.length > 0 && (
          <div className="wf-artifacts">
            <div className="wf-artifacts-header">
              <h4 className="wf-steps-title">Ergebnisse</h4>
              {artifacts.length > 1 && (
                <button
                  className="wf-copy-all-btn"
                  onClick={() => {
                    const allText = artifacts.map(art => {
                      const meta = PLATFORM_META[art.artifact_type] || { label: art.artifact_type }
                      const text = art.content?.content || art.content?.recipe?.voiceover_script || ''
                      return `--- ${meta.label} ---\n${text}`
                    }).join('\n\n')
                    navigator.clipboard.writeText(allText)
                  }}
                >
                  Alles kopieren
                </button>
              )}
            </div>
            {artifacts.map(art => {
              const meta = PLATFORM_META[art.artifact_type] || { icon: '📝', label: art.artifact_type, color: '#085041' }
              return (
                <div key={art.id} className="wf-artifact-card" style={{ borderColor: `${meta.color}20` }}>
                  <div className="wf-artifact-icon">{meta.icon}</div>
                  <div className="wf-artifact-info">
                    <span className="wf-artifact-title" style={{ color: meta.color }}>
                      {meta.label}
                    </span>
                    <span className="wf-artifact-desc">
                      {(art.content?.content || art.content?.recipe?.voiceover_script || '').slice(0, 80)}...
                    </span>
                  </div>
                  <button
                    className="wf-step-action"
                    onClick={() => {
                      const text = art.content?.content || art.content?.recipe?.voiceover_script || ''
                      if (text) navigator.clipboard.writeText(text)
                    }}
                  >
                    Kopieren
                  </button>
                </div>
              )
            })}
          </div>
        )}

        {/* Action button */}
        <div className="wf-widget-footer">
          <button className="wf-action-btn" onClick={handleAction}>
            {wf?.status === 'published' ? (
              <><Share2 size={16} /> Im Feed ansehen</>
            ) : activeStep ? (
              <><Rocket size={16} /> Weitermachen</>
            ) : (
              <><Rocket size={16} /> Workflow starten</>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
