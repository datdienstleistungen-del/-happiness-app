import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Rocket, ArrowRight, Clock, Check, Sparkles, Loader } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useLanguage } from '../i18n/translations.jsx'
import { supabase } from '../lib/supabase'
import { trackWorkflowCreated } from '../intelligence/analytics'
import Feed from '../components/Feed'
import WorkflowWidget from '../components/WorkflowWidget'
import './DashboardPage.css'

const QUICK_GOALS = [
  'TikTok über gesunde Gewohnheiten erstellen',
  'Facebook-Post für mein Business schreiben',
  'Instagram-Post mit KI optimieren',
  'Content-Idee für YouTube generieren',
]

const PHASE_ICONS = { plan: '📝', create: '🎨', grow: '🚀' }
const STATUS_ICONS = { pending: '○', active: '●', completed: '✓', skipped: '–', failed: '✗' }

export default function DashboardPage() {
  const { user, profile } = useAuth()
  const { t } = useLanguage()
  const navigate = useNavigate()
  const [goal, setGoal] = useState('')
  const [workflows, setWorkflows] = useState([])
  const [loadingWorkflows, setLoadingWorkflows] = useState(true)
  const [selectedWf, setSelectedWf] = useState(null)

  useEffect(() => { loadWorkflows() }, [user])

  async function loadWorkflows() {
    if (!user) return
    setLoadingWorkflows(true)
    const { data } = await supabase
      .from('workflows')
      .select('*, workflow_steps(*)')
      .eq('user_id', user.id)
      .not('status', 'eq', 'archived')
      .order('updated_at', { ascending: false })
      .limit(5)
    setWorkflows(data || [])
    setLoadingWorkflows(false)
  }

  const handleGoalSubmit = async () => {
    if (!goal.trim()) return
    const g = goal.trim()
    setGoal('')

    const { data: wf } = await supabase
      .from('workflows')
      .insert({ user_id: user.id, goal: g, status: 'clarifying', platform: 'content' })
      .select()
      .single()

    if (wf) {
      trackWorkflowCreated(wf.platform || 'content')
      await supabase.from('workflow_steps').insert([
        { workflow_id: wf.id, step_key: 'analyze', label: 'Ziel analysieren', phase: 'clarifying', status: 'pending', order_index: 0 },
        { workflow_id: wf.id, step_key: 'script', label: 'Skript schreiben', phase: 'planning', status: 'pending', order_index: 1 },
        { workflow_id: wf.id, step_key: 'design', label: 'Visuals erstellen', phase: 'executing', status: 'pending', order_index: 2 },
        { workflow_id: wf.id, step_key: 'review', label: 'Ergebnis prüfen', phase: 'reviewing', status: 'pending', order_index: 3 },
        { workflow_id: wf.id, step_key: 'publish', label: 'Veröffentlichen', phase: 'published', status: 'pending', order_index: 4 },
      ])
    }

    navigate('/execute?goal=' + encodeURIComponent(g))
  }

  const getGreeting = () => {
    const hour = new Date().getHours()
    if (hour < 12) return t('welcome.morning') || 'Guten Morgen'
    if (hour < 18) return t('welcome.afternoon') || 'Guten Tag'
    return t('welcome.evening') || 'Guten Abend'
  }

  const getProgress = (wf) => {
    if (!wf.workflow_steps || wf.workflow_steps.length === 0) return 0
    const done = wf.workflow_steps.filter(s => s.status === 'completed').length
    return Math.round((done / wf.workflow_steps.length) * 100)
  }

  return (
    <div className="dashboard">
      <div className="dashboard-greeting">
        <h1>{getGreeting()}, {profile?.name || user?.email?.split('@')[0] || ''}</h1>
      </div>

      {/* ── H.I.T. Command Center ── */}
      <div className="hit-command-center">
        <div className="hit-command-header">
          <div className="hit-brand-compact">
            <span className="hit-letter">H</span>
            <span className="hit-rest">.I.T.</span>
          </div>
          <p className="hit-command-sub">{t('dashboard.hitCommand')}</p>
        </div>

        <div className="hit-input-wrap">
          <input
            className="hit-input"
            type="text"
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleGoalSubmit()}
            placeholder={t('dashboard.hitPlaceholder')}
          />
          <button className="hit-submit-btn" onClick={handleGoalSubmit} disabled={!goal.trim()}>
            <Rocket size={18} />
            <span>{t('dashboard.hitStart')}</span>
          </button>
        </div>

        <div className="hit-chips">
          {QUICK_GOALS.map((g, i) => (
            <button key={i} className="hit-chip" onClick={() => setGoal(g)}>{g}</button>
          ))}
        </div>
      </div>

      {/* ── Active Workflows ── */}
      <div className="dashboard-section">
        <h2>{t('dashboard.workflows')}</h2>
        {loadingWorkflows ? (
          <div className="dashboard-loading"><Loader size={20} className="spin" /> Lade Workflows...</div>
        ) : workflows.length === 0 ? (
          <div className="dashboard-empty">
            <p>{t('dashboard.noWorkflows')}</p>
          </div>
        ) : (
          <div className="workflow-list">
            {workflows.map(wf => (
              <div key={wf.id} className="workflow-card">
                <div className="workflow-card-header">
                  <span className="workflow-platform">{wf.platform || 'content'}</span>
                  <span className={`workflow-status status-${wf.status}`}>{wf.status}</span>
                </div>
                <h3 className="workflow-goal">{wf.goal}</h3>
                <div className="workflow-progress-bar">
                  <div className="workflow-progress-fill" style={{ width: `${getProgress(wf)}%` }} />
                </div>
                <div className="workflow-card-footer">
                  <span className="workflow-progress-text">{getProgress(wf)}% {t('dashboard.percentDone')}</span>
                  <button
                    className="workflow-continue-btn"
                    onClick={() => setSelectedWf(wf)}
                  >
                    {t('dashboard.continue')} <ArrowRight size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Community Inspiration ── */}
      <div className="dashboard-section">
        <h2>{t('dashboard.communityInspiration')}</h2>
        <p className="dashboard-section-sub">{t('dashboard.communitySub')}</p>
        <Feed />
      </div>

      {selectedWf && (
        <WorkflowWidget workflow={selectedWf} onClose={() => setSelectedWf(null)} />
      )}
    </div>
  )
}
