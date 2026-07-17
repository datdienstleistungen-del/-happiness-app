import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Rocket, Check, Copy, Share2, Sparkles, ChevronDown, ChevronUp, Film, BarChart3, RotateCcw, ArrowRight, Target, ArrowLeft } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useLanguage } from '../i18n/translations'
import { getChatEndpoint } from '../lib/hit'
import { supabase } from '../lib/supabase'
import { analyzeGoal } from '../intelligence/goal-analyzer'
import { generateRecommendations } from '../intelligence/hit-recommendations'
import { buildMasterBriefFromAnalysis, runPlatformAgent, getAllPlatforms, getAgentIcon, getAgentName } from '../intelligence/content-engine'
import { trackEvent } from '../intelligence/analytics/custom'
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
}

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

      const analysisResult = await analyzeGoal(goal.trim(), chatEndpoint, token)
      setAnalysis(analysisResult)

      const recs = await generateRecommendations(goal.trim(), analysisResult, chatEndpoint, token)
      setRecommendations(recs)

      trackEvent('analysis_completed', { goal: goal.trim(), contentScore: analysisResult.contentScore })

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
        const result = await runPlatformAgent(platformKey, goal, masterBrief, chatEndpoint, token)
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
      const result = await runPlatformAgent(platformKey, goal, masterBrief, chatEndpoint, token)
      if (result) {
        setResults(prev => ({ ...prev, [platformKey]: result }))
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
    const allText = Object.values(topResults).map(r => {
      const c = r.content
      return `${r.icon} ${r.name}\n\n${c.hook ? c.hook + '\n\n' : ''}${c.body || ''}${c.cta ? '\n\n' + c.cta : ''}${c.hashtags?.length ? '\n\n' + c.hashtags.map(h => h.startsWith('#') ? h : '#' + h).join(' ') : ''}`
    }).join('\n\n---\n\n')
    copyToClipboard(allText)
    setCopiedAll(true)
    setTimeout(() => setCopiedAll(false), 2000)
  }

  const getResultText = (r) => {
    const c = r.content
    return `${c.hook ? c.hook + '\n\n' : ''}${c.body || ''}${c.cta ? '\n\n' + c.cta : ''}${c.hashtags?.length ? '\n\n' + c.hashtags.map(h => h.startsWith('#') ? h : '#' + h).join(' ') : ''}`
  }

  const allPlatforms = getAllPlatforms()
  const generatedPlatforms = Object.keys(results)
  const top3Keys = analysis?.topPlatforms || []

  return (
    <div className="platform-engine">
      {/* Phase: INPUT */}
      {phase === 'input' && (
        <div className="pe-input-phase">
          <div className="pe-hero">
            <h1 className="pe-title">H.I.T.</h1>
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
              <Rocket size={16} /> {t('landing.startButton')}
            </button>
          </div>

          {error && <p className="pe-error">{error}</p>}

          <div className="pe-chips">
            {chips.map((chip) => (
              <button key={chip.label} className="pe-chip" onClick={() => handleChipClick(chip)}>
                <span>{chip.icon}</span> {chip.label}
              </button>
            ))}
          </div>

          <p className="pe-meta">{t('landing.meta')}</p>
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

      {/* Phase: RESULT — Creator Package */}
      {phase === 'result' && (
        <div className="pe-result-phase">
          <div className="pe-result-header">
            <h2 className="pe-result-title">✨ {t('platformEngine.resultTitle')}</h2>
            <p className="pe-result-subtitle">
              {goal} · {top3Keys.length} Plattformen erstellt
            </p>
          </div>

          {/* Top 3 Platform Cards */}
          <div className="pe-platform-grid">
            {top3Keys.map((key, index) => {
              const r = topResults[key]
              if (!r) return null
              const isCopied = copiedPlatform === key
              const copiedCount = copiedPlatform ? 1 : 0
              return (
                <div key={key} className={`pe-platform-card ${isCopied ? 'pe-platform-card-copied' : ''}`}>
                  <div className="pe-platform-card-header">
                    <div className="pe-platform-name-group">
                      <span className="pe-platform-step">{index + 1}/3</span>
                      <span className="pe-platform-name">{r.icon} {r.name}</span>
                    </div>
                    <button
                      className={`pe-copy-btn pe-copy-btn-card ${isCopied ? 'pe-copy-btn-done' : ''}`}
                      onClick={() => {
                        copyToClipboard(getResultText(r), key)
                        setCopiedPlatform(key)
                        setTimeout(() => setCopiedPlatform(null), 2000)
                      }}
                    >
                      {isCopied ? <><Check size={14} /> Kopiert!</> : <><Copy size={14} /> In CapCut einfügen</>}
                    </button>
                  </div>
                  {r.content.hook && <p className="pe-card-hook">{r.content.hook}</p>}
                  <p className="pe-card-body">{r.content.body}</p>
                  {r.content.cta && <p className="pe-card-cta">{r.content.cta}</p>}
                  {r.content.hashtags?.length > 0 && (
                    <div className="pe-card-tags">
                      {r.content.hashtags.map((h, i) => (
                        <span key={i} className="pe-tag">{h.startsWith('#') ? h : '#' + h}</span>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Action Buttons — nur Teilen */}
          <div className="pe-actions">
            <button className="btn btn-outline" onClick={async () => {
              const text = Object.values(topResults).map(r => getResultText(r)).join('\n\n---\n\n')
              try {
                if (navigator.share) {
                  await navigator.share({ title: 'Creator-Paket von H.I.T.', text })
                } else {
                  throw new Error('no share')
                }
              } catch {
                navigator.clipboard.writeText(text)
                trackEvent('content_copied', { platform: 'all_share' })
                setCopiedAll(true)
                setTimeout(() => setCopiedAll(false), 2000)
              }
            }}>
              <Share2 size={16} /> {copiedAll ? t('platformEngine.copiedAll') || 'Kopiert!' : t('platformEngine.shareAll')}
            </button>
          </div>

          {/* Weitere Plattformen — einzeln generieren */}
          {allPlatforms.filter(p => !top3Keys.includes(p.key)).length > 0 && (
            <div className="pe-more-section">
              <p className="pe-more-title">{t('platformEngine.moreAvailable')}</p>

              {/* Bereits generierte weitere Plattformen — als volle Karten */}
              {allPlatforms
                .filter(p => !top3Keys.includes(p.key) && results[p.key])
                .map((p, i) => {
                  const r = results[p.key]
                  return (
                    <div key={p.key} className="pe-platform-card pe-platform-card-extra">
                      <div className="pe-platform-card-header">
                        <div className="pe-platform-name-group">
                          <span className="pe-platform-name">{r.icon} {r.name}</span>
                        </div>
                        <button
                          className={`pe-copy-btn pe-copy-btn-card ${copiedPlatform === p.key ? 'pe-copy-btn-done' : ''}`}
                          onClick={() => {
                            copyToClipboard(getResultText(r), p.key)
                            setCopiedPlatform(p.key)
                            setTimeout(() => setCopiedPlatform(null), 2000)
                          }}
                        >
                          {copiedPlatform === p.key ? <><Check size={14} /> Kopiert!</> : <><Copy size={14} /> In CapCut einfügen</>}
                        </button>
                      </div>
                      {r.content.hook && <p className="pe-card-hook">{r.content.hook}</p>}
                      <p className="pe-card-body">{r.content.body}</p>
                      {r.content.cta && <p className="pe-card-cta">{r.content.cta}</p>}
                      {r.content.hashtags?.length > 0 && (
                        <div className="pe-card-tags">
                          {r.content.hashtags.map((h, i) => (
                            <span key={i} className="pe-tag">{h.startsWith('#') ? h : '#' + h}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}

              {/* Noch nicht generierte — einzeln auflisten */}
              <div className="pe-more-list">
                {allPlatforms
                  .filter(p => !top3Keys.includes(p.key) && !results[p.key])
                  .map(p => (
                    <button
                      key={p.key}
                      className="pe-more-item-btn"
                      onClick={() => handleGenerateSingle(p.key)}
                      disabled={generatingSingle !== null}
                    >
                      {generatingSingle === p.key ? (
                        <><span className="pe-spinner-small" /> Wird erstellt...</>
                      ) : (
                        <>{p.icon} {p.name} <span className="pe-more-plus">+</span></>
                      )}
                    </button>
                  ))
                }
              </div>

              {/* Alle generieren — secondary */}
              {!generatedMore && allPlatforms.filter(p => !top3Keys.includes(p.key) && !results[p.key]).length > 1 && (
                <button className="btn btn-outline pe-more-btn" onClick={handleGenerateMore}>
                  {t('platformEngine.moreButton')}
                </button>
              )}
            </div>
          )}

          {/* Next Steps — Was möchtest du jetzt tun? */}
          <div className="pe-next-steps">
            <div className="pe-next-banner">
              <div className="pe-next-banner-icon">💡</div>
              <div className="pe-next-banner-text">
                <strong>{t('platformEngine.nextStepTitle')}</strong>
                <p>{t('platformEngine.nextStepText', { platform: getAgentName(top3Keys[0] || 'instagram') })}</p>
              </div>
            </div>

            <div className="pe-next-grid">
              <button className="pe-next-card" onClick={() => saveStateAndNavigate('/capcut-studio')}>
                <div className="pe-next-card-icon"><Film size={24} /></div>
                <div className="pe-next-card-label">{t('platformEngine.nextCapCut')}</div>
                <div className="pe-next-card-desc">{t('platformEngine.nextCapCutDesc')}</div>
              </button>
              <button className="pe-next-card" onClick={() => saveStateAndNavigate('/analytics')}>
                <div className="pe-next-card-icon"><BarChart3 size={24} /></div>
                <div className="pe-next-card-label">{t('platformEngine.nextAnalytics')}</div>
                <div className="pe-next-card-desc">{t('platformEngine.nextAnalyticsDesc')}</div>
              </button>
              <button className="pe-next-card pe-next-card-reset" onClick={() => {
                setPhase('input')
                setGoal('')
                setAnalysis(null)
                setResults({})
                setTopResults({})
                setRecommendations([])
                setProgress({})
                setShowMore(false)
                setGeneratedMore(false)
              }}>
                <div className="pe-next-card-icon"><Target size={24} /></div>
                <div className="pe-next-card-label">{t('platformEngine.nextNewGoal')}</div>
                <div className="pe-next-card-desc">{t('platformEngine.nextNewGoalDesc')}</div>
              </button>
            </div>
          </div>

          {/* Recommendations */}
          {recommendations.length > 0 && (
            <div className="pe-recommendations">
              <h3>{t('platformEngine.recsTitle')}</h3>
              <div className="pe-rec-list">
                {recommendations.map((rec, i) => (
                  <div key={i} className="pe-rec-item">
                    <span className="pe-rec-icon">{rec.icon}</span>
                    <div>
                      <strong>{rec.title}</strong>
                      <p>{rec.text}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Package Contents */}
          <div className="pe-package-contents">
            <h3>{t('platformEngine.packageTitle')}</h3>
            <div className="pe-package-checks">
              <span>✓ Strategie</span>
              <span>✓ Hook</span>
              <span>✓ Hashtags</span>
              <span>✓ CTA</span>
              <span>✓ Bildideen</span>
              <span>✓ Veröffentlichungszeit</span>
            </div>
          </div>

          {/* Reset — Prominent */}
          <div className="pe-reset-section">
            <button className="btn btn-primary btn-lg" onClick={() => {
              setPhase('input')
              setGoal('')
              setAnalysis(null)
              setResults({})
              setTopResults({})
              setRecommendations([])
              setProgress({})
              setShowMore(false)
              setGeneratedMore(false)
            }}>
              <RotateCcw size={18} /> {t('platformEngine.resetButton')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
