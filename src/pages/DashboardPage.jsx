import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Rocket, ArrowRight, Clock, Check, Sparkles, Loader, HelpCircle, Copy, PenTool } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useLanguage } from '../i18n/translations.jsx'
import { supabase } from '../lib/supabase'
import { trackWorkflowCreated } from '../intelligence/analytics'
import { trackGoalSubmitted, trackQuickResult } from '../intelligence/analytics/custom'
import { getChatEndpoint } from '../lib/hit'
import Feed from '../components/Feed'
import WorkflowWidget from '../components/WorkflowWidget'
import CopyButton from '../components/CopyButton'
import './DashboardPage.css'

const QUICK_GOALS_BY_CHOICE = {
  community: [
    'Einen interessanten Beitrag fuer die Community schreiben',
    'Neue Leute in der Community kennenlernen',
    'Diskussion zu einem Thema starten',
    'Erfahrungen mit anderen teilen',
  ],
  creator: [
    'TikTok über gesunde Gewohnheiten erstellen',
    'Facebook-Post für mein Business schreiben',
    'Instagram-Post mit KI optimieren',
    'Content-Idee für YouTube generieren',
  ],
  ai: [
    'Mir hilfe bei einem Alltagsproblem',
    'Ideen fuer mein naechstes Projekt generieren',
    'Einen Text fuer mich schreiben',
    'Lerne etwas Neues heute',
  ],
}

const QUICK_GOALS_DEFAULT = [
  'TikTok über gesunde Gewohnheiten erstellen',
  'Facebook-Post für mein Business schreiben',
  'Instagram-Post mit KI optimieren',
  'Content-Idee für YouTube generieren',
]

function isSimpleGoal(goal) {
  const lower = goal.toLowerCase()
  return /post|beitrag|text|schreib|teilen|empfehl|tipp|idee|gruß|nachricht/i.test(lower)
    && !/video|tiktok|reel|youtube|film|kurzvideo/i.test(lower)
}

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
  const [quickResult, setQuickResult] = useState(null)
  const [quickLoading, setQuickLoading] = useState(false)
  const [showHowModal, setShowHowModal] = useState(false)

  const onboardingChoice = localStorage.getItem('happiness-onboarding-choice') || 'creator'
  const quickGoals = QUICK_GOALS_BY_CHOICE[onboardingChoice] || QUICK_GOALS_DEFAULT

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

    if (isSimpleGoal(g)) {
      setQuickLoading(true)
      setQuickResult(null)
      trackQuickResult(g)
      try {
        const { data: { session } } = await supabase.auth.getSession()
        const token = session?.access_token || ''
        const res = await fetch(getChatEndpoint(), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({
            message: `Schreibe einen fertigen, postfertigen Post basierend auf diesem Ziel:\n\n"${g}"\n\nRegeln: Kein Meta-Kommentar. Nur den fertigen Text. Max 280 Zeichen für Social Media.`,
            systemPrompt: 'Du bist ein erfahrener Social-Media-Texter. Schreibe kurze, prägnante, postfertige Texte.',
            history: []
          })
        })
        if (res.ok) {
          const data = await res.json()
          setQuickResult({ goal: g, content: (data.response || '').trim() })
        }
      } catch {}
      setQuickLoading(false)
      return
    }

    trackGoalSubmitted(g, 'content')
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

      {/* ── How it works ── */}
      <div className="dashboard-how-it-works" onClick={() => setShowHowModal(true)}>
        <HelpCircle size={16} />
        <div>
            <strong>{t('dashboard.howTitle') || 'So funktioniert es:'}</strong>
          <span>{t('dashboard.howText') || 'Beschreib dein Ziel unten — H.I.T. generiert dir automatisch Texte, Skripte und Posts für alle Plattformen. Du kopierst und postest.'}</span>
        </div>
      </div>

      {/* ── How it works Modal ── */}
      {showHowModal && (
        <div className="dashboard-modal-overlay" onClick={() => setShowHowModal(false)}>
          <div className="dashboard-modal" onClick={(e) => e.stopPropagation()}>
            <button className="dashboard-modal-close" onClick={() => setShowHowModal(false)}>×</button>
            <h2>So funktioniert H.I.T.</h2>
            <div className="dashboard-modal-steps">
              <div className="dashboard-modal-step">
                <div className="dashboard-modal-step-num">1</div>
                <div>
                  <strong>Ziel beschreiben</strong>
                  <p>Gib ein, was du erstellen möchtest — z.B. "TikTok über gesunde Gewohnheiten" oder "Facebook-Post für mein Business".</p>
                </div>
              </div>
              <div className="dashboard-modal-step">
                <div className="dashboard-modal-step-num">2</div>
                <div>
                  <strong>H.I.T. generiert Content</strong>
                  <p>Die KI analysiert dein Ziel und erstellt automatisch fertige Texte, Skripte und Posts für alle Plattformen.</p>
                </div>
              </div>
              <div className="dashboard-modal-step">
                <div className="dashboard-modal-step-num">3</div>
                <div>
                  <strong>Kopieren & posten</strong>
                  <p>Kopiere die fertigen Texte und poste sie direkt auf TikTok, Instagram, Facebook, LinkedIn oder andere Kanäle.</p>
                </div>
              </div>
            </div>
            <button className="btn btn-primary" style={{ width: '100%' }} onClick={() => setShowHowModal(false)}>
              Verstanden
            </button>
          </div>
        </div>
      )}

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
          {quickGoals.map((g, i) => (
            <button key={i} className="hit-chip" onClick={() => setGoal(g)}>{g}</button>
          ))}
        </div>
      </div>

      {/* ── Quick Result (simple goals) ── */}
      {quickLoading && (
        <div className="dashboard-quick-result">
          <div className="dashboard-quick-loading">
            <Loader size={18} className="spin" />
            <span>H.I.T. schreibt deinen Post...</span>
          </div>
        </div>
      )}
      {quickResult && (
        <div className="dashboard-quick-result">
          <div className="dashboard-quick-header">
            <PenTool size={16} />
            <strong>Fertiger Post für: {quickResult.goal}</strong>
          </div>
          <div className="dashboard-quick-content">{quickResult.content}</div>
          <div className="dashboard-quick-actions">
            <CopyButton text={quickResult.content} />
            <button className="dashboard-quick-dismiss" onClick={() => setQuickResult(null)}>Schließen</button>
          </div>
        </div>
      )}

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
