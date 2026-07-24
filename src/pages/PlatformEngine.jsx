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
      {/* Phase: INPUT */}
      {phase === 'input' && (
        <div className="pe-input-phase">
          <div className="pe-hero">
            <div className="pe-title-row">
              <h1 className="pe-title">H.I.T.</h1>
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
              if (!r || !r.content) return null
              const isCopied = copiedPlatform === key
              const copiedCount = copiedPlatform ? 1 : 0
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
                          copyToClipboard(getResultText(r), key)
                          setCopiedPlatform(key)
                          setTimeout(() => setCopiedPlatform(null), 2000)
                          const isMob = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
                          const url = isMob ? 'capcut://com.lemon.lvoverseas' : 'https://www.capcut.com/editor?enter_from=link'
                          window.open(url, '_blank')
                        }}
                      >
                        <Copy size={14} /> In CapCut einfügen
                      </button>
                    </div>
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
                  if (!r || !r.content) return null
                  return (
                    <div key={p.key} className="pe-platform-card pe-platform-card-extra">
                        <div className="pe-platform-card-header">
                        <div className="pe-platform-name-group">
                          <span className="pe-platform-name">{r.icon} {r.name}</span>
                        </div>
                        <div className="pe-copy-btn-group">
                          <button
                            className={`pe-copy-btn pe-copy-btn-card ${copiedPlatform === p.key ? 'pe-copy-btn-done' : ''}`}
                            onClick={() => {
                              copyToClipboard(getResultText(r), p.key)
                              setCopiedPlatform(p.key)
                              setTimeout(() => setCopiedPlatform(null), 2000)
                            }}
                          >
                            {copiedPlatform === p.key ? <><Check size={14} /> Kopiert!</> : <><Copy size={14} /> Kopieren</>}
                          </button>
                          <button
                            className="pe-copy-btn pe-copy-btn-card pe-copy-btn-primary"
                            onClick={() => {
                              copyToClipboard(getResultText(r), p.key)
                              setCopiedPlatform(p.key)
                              setTimeout(() => setCopiedPlatform(null), 2000)
                              const isMob = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
                              const url = isMob ? 'capcut://com.lemon.lvoverseas' : 'https://www.capcut.com/editor?enter_from=link'
                              window.open(url, '_blank')
                            }}
                          >
                            <Copy size={14} /> In CapCut einfügen
                          </button>
                        </div>
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

          {/* Next Action Hub */}
          <NextActionHub
            onOpenCapCut={() => {
              trackLandingFunnel('post_result_action', { action: 'capcut' })
              saveStateAndNavigate('/capcut-studio')
            }}
            onTrackAnalytics={() => {
              trackLandingFunnel('post_result_action', { action: 'tracking' })
              saveStateAndNavigate('/analytics')
            }}
            onReset={() => {
              trackLandingFunnel('post_result_action', { action: 'reset' })
              setPhase('input')
              setGoal('')
              setAnalysis(null)
              setResults({})
              setTopResults({})
              setRecommendations([])
              setProgress({})
              setShowMore(false)
              setGeneratedMore(false)
              window.scrollTo({ top: 0, behavior: 'smooth' })
            }}
          />

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

      {showInfo && (
        <div className="pe-info-overlay" onClick={() => setShowInfo(false)}>
          <div className="pe-info-modal" onClick={(e) => e.stopPropagation()}>
            <button className="pe-info-close" onClick={() => setShowInfo(false)}>
              <X size={20} />
            </button>
            <h2 className="pe-info-headline">
              {lang === 'en' ? 'Yes, that magnificent fitness text was written 100% by us... 🤖' :
               lang === 'es' ? '¡Sí, ese magnífico texto de fitness fue escrito al 100% por nosotros... 🤖' :
               lang === 'fr' ? 'Oui, ce magnifique texte fitness a été écrit à 100 % par nous... 🤖' :
               lang === 'it' ? 'Sì, quel magnifico testo fitness è stato scritto al 100% da noi... 🤖' :
               lang === 'nl' ? 'Ja, die geweldige fittekst is voor 100% door ons geschreven... 🤖' :
               lang === 'el' ? 'Ναι, αυτό το υπέροχο κείμενο fitness γράφτηκε 100% από εμάς... 🤖' :
               'Ja, dieser grandiose Fitness-Text wurde zu 100 % von uns geschrieben... 🤖'}
            </h2>
            <p className="pe-info-subtext">
              {lang === 'en' ? "Maybe you just saw a viral video about fitness, mindset or business and ended up here through our link. And no — we don't sell training plans!" :
               lang === 'es' ? 'Tal vez acabas de ver un video viral sobre fitness, mentalidad o negocios y aterrizaste aquí a través de nuestro enlace. ¡Y no — no vendemos planes de entrenamiento!' :
               lang === 'fr' ? "Peut-être que vous venez de voir une vidéo virale sur le fitness, l'état d'esprit ou les affaires et que vous êtes atterri ici via notre lien. Et non — nous ne vendons pas de programmes d'entraînement !" :
               lang === 'it' ? "Forse hai appena visto un video virale su fitness, mindset o business e sei finito qui attraverso il nostro link. E no — non vendiamo piani di allenamento!" :
               lang === 'nl' ? "Misschien heb je net een viraal video over fitness, mindset of business gezien en ben je via onze link hier terechtgekomen. En nee — we verkopen geen trainingsplannen!" :
               lang === 'el' ? 'Ίσως μόλις είδατε ένα ιοβόλο βίντεο για fitness, mindset ή business και κατελήξατε εδώ μέσω του συνδέσμου μας. Και όχι — δεν πουλάμε σχόλια γυμναστικής!' :
               'Vielleicht hast du gerade ein virales Video über Fitness, Mindset oder Business gesehen und bist über unseren Link hier gelandet. Und nein – wir verkaufen keine Trainingspläne!'}
            </p>
            <p className="pe-info-body">
              {lang === 'en' ? "You landed here because you experienced the power of real AI content creation live in action. The text that just captivated you was created in less than 60 seconds right here on this platform." :
               lang === 'es' ? 'Aterrizaste aquí porque experimentaste el poder de la creación de contenido con IA real en acción. El texto que te acaba de capturar se creó en menos de 60 segundos aquí mismo en esta plataforma.' :
               lang === 'fr' ? "Vous êtes arrivé ici parce que vous avez vécu la puissance de la création de contenu IA en direct. Le texte qui vient de vous capturer a été créé en moins de 60 secondes ici même sur cette plateforme." :
               lang === 'it' ? 'Sei finito qui perché hai sperimentato il potere della creazione di contenuti IA dal vivo. Il testo che ti ha appena affascinato è stato creato in meno di 60 secondi proprio qui su questa piattaforma.' :
               lang === 'nl' ? 'Je bent hier terechtgekomen omdat je de kracht van echte AI-contentcreatie live in actie hebt ervaren. De tekst die je net heeft geboeid, is in minder dan 60 seconden precies hier op dit platform gemaakt.' :
               lang === 'el' ? 'Κατελήξατε εδώ γιατί βιώσατε τη δύναμη της πραγματικής δημιουργίας περιεχομένων AI σε δράση. Το κείμενο πού σας είχε μόλις τώρα ελκύσει δημιουργήθηκε σε λιγότερο από 60 δευτερόλεπτα ακριβώς εδώ σε αυτή την πλατφόρμα.' :
               'Du bist hier gelandet, weil du die Power echter KI-Content-Erstellung live in Aktion erlebt hast. Der Text, der dich gerade eben noch gefesselt hat, entstand in weniger als 60 Sekunden genau hier auf dieser Plattform.'}
            </p>
            <h3 className="pe-info-what-title">
              {lang === 'en' ? 'What is happiness?' :
               lang === 'es' ? '¿Qué es happiness?' :
               lang === 'fr' ? "Qu'est-ce que happiness ?" :
               lang === 'it' ? 'Che cos è happiness?' :
               lang === 'nl' ? 'Wat is happiness?' :
               lang === 'el' ? 'Τι είναι το happiness;' :
               'Was ist happiness?'}
            </h3>
            <p className="pe-info-body">
              {lang === 'en' ? "We're your smart content machine. An innovative tool that writes high-converting social media texts, scripts, and recipes for creators, entrepreneurs, and businesses." :
               lang === 'es' ? 'Somos tu máquina de contenido inteligente. Una herramienta innovadora que escribe textos, scripts y recetas de redes sociales de alta conversión para creadores, emprendedores y empresas.' :
               lang === 'fr' ? "Nous sommes votre machine à contenu intelligente. Un outil innovant qui écrit des textes, scripts et recettes de réseaux sociaux à forte conversion pour les créateurs, entrepreneurs et entreprises." :
               lang === 'it' ? 'Siamo la tua macchina per contenuti intelligenti. Un tool innovativo che scrive testi, script e ricette per social media ad alta conversione per creator, imprenditori e aziende.' :
               lang === 'nl' ? "We zijn je slimme contentmachine. Een innovatief tool die hoog-converterende social media-teksten, scripts en recepten schrijft voor creators, ondernemers en bedrijven." :
               lang === 'el' ? 'Είμαστε η έξυπνη μηχανή περιεχομένων σας. Ένα καινοτόμο εργαλείο που γράφφει κείμενα, σενάρια και συνταγές social media υψηλής μετατροπής για δημιουργούς, επιχειρηματίες και εταιρείες.' :
               'Wir sind deine smarte Content-Maschine. Ein innovatives Tool, das für Creator, Selbstständige und Unternehmen hochgradig konvertierende Social-Media-Texte, Skripte und Rezepte schreibt.'}
            </p>
            <div className="pe-info-features">
              <div className="pe-info-feature">
                <span>✍️</span>
                <div>
                  <strong>{lang === 'en' ? 'No more writer\'s block' : lang === 'es' ? 'Adiós al bloqueo del escritor' : lang === 'fr' ? "Fin de la page blanche" : lang === 'it' ? 'Basta blocchi dello scrittore' : lang === 'nl' ? 'Geen writer\'s block meer' : lang === 'el' ? 'Όχι πια writer block' : 'Schluss mit Schreibblockaden'}</strong>
                  <p>{lang === 'en' ? 'Ad-level copywriting texts in no time.' : lang === 'es' ? 'Textos de nivel publicitario en un instante.' : lang === 'fr' ? "Textes de niveau pro en un instant." : lang === 'it' ? 'Testi di livello pubblicitario in un attimo.' : lang === 'nl' ? 'Teksten van reclameniveau in een oogwenk.' : lang === 'el' ? 'Κείμενα επιπέδου διαφημιστικού σε στιγμή.' : 'Texte auf Werbetexter-Niveau im Handumdrehen.'}</p>
                </div>
              </div>
              <div className="pe-info-feature">
                <span>⏰</span>
                <div>
                  <strong>{lang === 'en' ? 'No more time pressure' : lang === 'es' ? 'Sin presión de tiempo' : lang === 'fr' ? 'Plus de pression temporelle' : lang === 'it' ? 'Niente più pressione del tempo' : lang === 'nl' ? 'Geen tijdsdruk meer' : lang === 'el' ? 'Χωρίς πίεση χρόνου' : 'Kein Zeitdruck mehr'}</strong>
                  <p>{lang === 'en' ? 'Create content for a whole week in minutes.' : lang === 'es' ? 'Crea contenido para toda una semana en minutos.' : lang === 'fr' ? "Créez le contenu d'une semaine entière en quelques minutes." : lang === 'it' ? 'Crea contenuti per un\'intera settimana in pochi minuti.' : lang === 'nl' ? 'Maak content voor een hele week in minuten.' : lang === 'el' ? 'Δημιουργήστε περιεχόμενα για μια ολόκληρη εβδομάδα σε λεπτά.' : 'Erstelle den Content für eine ganze Woche in wenigen Minuten.'}</p>
                </div>
              </div>
              <div className="pe-info-feature">
                <span>🎯</span>
                <div>
                  <strong>{lang === 'en' ? 'Focus on your core business' : lang === 'es' ? 'Enfócate en tu negocio principal' : lang === 'fr' ? 'Concentrez-vous sur votre cœur de métier' : lang === 'it' ? 'Concentrati sul tuo business principale' : lang === 'nl' ? 'Focus op je core business' : lang === 'el' ? 'Εστιάστε στη βασική σας δραστηριότητα' : 'Fokus auf dein Core-Business'}</strong>
                  <p>{lang === 'en' ? 'Leave the writing to us and focus on what really moves you forward.' : lang === 'es' ? 'Déjanos escribir y concéntrate en lo que realmente te impulsa.' : lang === 'fr' ? "Laissez-nous écrire et concentrez-vous sur ce qui vous fait vraiment avancer." : lang === 'it' ? 'Lascia scrivere a noi e concentrati su ciò che ti fa davvero avanzare.' : lang === 'nl' ? 'Laat het schrijven aan ons over en concentreer je op wat je echt vooruit helpt.' : lang === 'el' ? 'Αφήστε εμάς να γράφουμε και εστιάστε σε αυτό που σας προωθεί πραγματικά.' : 'Überlass uns das Schreiben und konzentriere dich auf das, was dich wirklich voranbringt.'}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
