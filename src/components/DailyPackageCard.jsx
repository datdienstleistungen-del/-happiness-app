import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Settings, X, MessageSquare, Check, ChevronRight } from 'lucide-react'
import { supabase } from '../lib/supabase'
import './DailyPackageCard.css'

export default function DailyPackageCard() {
  const navigate = useNavigate()
  const [pkg, setPkg] = useState(null)
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(null)
  const [streak, setStreak] = useState(0)

  // Freetext flow
  const [showFreetext, setShowFreetext] = useState(false)
  const [freetextStep, setFreetextStep] = useState('input') // input | confirm | generating
  const [freetextInput, setFreetextInput] = useState('')
  const [freetextSummary, setFreetextSummary] = useState('')
  const [freetextError, setFreetextError] = useState('')

  useEffect(() => {
    loadPackage()
  }, [])

  const loadPackage = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const res = await fetch('/api/daily-package', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        }
      })

      if (res.ok) {
        const data = await res.json()
        setPkg(data.package)
        loadStreak()
      }
    } catch (e) {
      console.warn('[DailyPackage] Error:', e.message)
    } finally {
      setLoading(false)
    }
  }

  const loadPackageWithFreetext = async (userText) => {
    setFreetextStep('generating')
    setFreetextError('')

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const res = await fetch('/api/daily-package', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ customRequest: userText })
      })

      if (res.ok) {
        const data = await res.json()
        setPkg(data.package)
        setShowFreetext(false)
        setFreetextStep('input')
        setFreetextInput('')
        loadStreak()
      } else {
        setFreetextError('Fehler beim Generieren. Bitte versuch es nochmal.')
        setFreetextStep('confirm')
      }
    } catch (e) {
      setFreetextError('Fehler beim Generieren.')
      setFreetextStep('confirm')
    }
  }

  const summarizeRequest = async () => {
    if (!freetextInput.trim()) return
    setFreetextStep('confirm')
    setFreetextError('')

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const res = await fetch('/api/daily-package', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ summarizeOnly: true, customRequest: freetextInput })
      })

      if (res.ok) {
        const data = await res.json()
        setFreetextSummary(data.summary || freetextInput)
      } else {
        setFreetextSummary(freetextInput)
      }
    } catch (e) {
      setFreetextSummary(freetextInput)
    }
  }

  const loadStreak = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data } = await supabase
        .from('daily_packages')
        .select('package_date, used')
        .eq('user_id', user.id)
        .order('package_date', { ascending: false })
        .limit(30)

      if (!data) return

      let currentStreak = 0
      const today = new Date()

      for (let i = 0; i < data.length; i++) {
        const pkgDate = new Date(data[i].package_date)
        const diffDays = Math.floor((today - pkgDate) / (1000 * 60 * 60 * 24))

        if (diffDays === i) {
          currentStreak++
        } else {
          break
        }
      }

      setStreak(currentStreak)
    } catch (e) {
      console.warn('[Streak] Error:', e.message)
    }
  }

  const copyToClipboard = async (text, type) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(type)
      setTimeout(() => setCopied(null), 2000)
    } catch (e) {
      console.warn('Copy failed')
    }
  }

  const copyAll = async () => {
    if (!pkg) return
    const watermark = '\n\nErstellt mit https://happiness-eu.netlify.app'
    const full = `${pkg.hook}\n\n${pkg.script}\n\n${pkg.hashtags.map(t => '#' + t).join(' ')}${watermark}`
    await copyToClipboard(full, 'all')
  }

  const sendToAnalytics = () => {
    if (!pkg) return
    localStorage.setItem('hit_latest_hook', pkg.hook)
    localStorage.setItem('hit_latest_body', pkg.script)
    localStorage.setItem('hit_latest_cta', pkg.hashtags?.map(t => '#' + t).join(' ') || '')
    navigate('/analytics')
  }

  if (loading) {
    return (
      <div className="dp-card dp-loading">
        <div className="dp-shimmer"></div>
        <div className="dp-shimmer dp-shimmer-short"></div>
      </div>
    )
  }

  if (!pkg) return null

  const hashtagsText = pkg.hashtags?.map(t => '#' + t).join(' ') || ''

  return (
    <div className="dp-card">
      <div className="dp-header">
        <div className="dp-title-row">
          <span className="dp-badge">HEUTE</span>
          <h3>Dein Creator-Paket</h3>
        </div>
        <div className="dp-header-right">
          {streak > 0 && (
            <div className="dp-streak">
              <span className="dp-streak-fire">🔥</span>
              <span>{streak} Tag{streak > 1 ? 'e' : ''} streak</span>
            </div>
          )}
          <button className="dp-settings-btn" onClick={() => setShowFreetext(true)} title="Paket anpassen">
            <MessageSquare size={16} />
          </button>
        </div>
      </div>

      <div className="dp-hook">
        <span className="dp-label">Hook (0-2 Sek)</span>
        <p className="dp-hook-text">{pkg.hook}</p>
        <button
          className={`dp-copy-btn ${copied === 'hook' ? 'dp-copied' : ''}`}
          onClick={() => copyToClipboard(pkg.hook, 'hook')}
        >
          {copied === 'hook' ? '✓ Kopiert' : 'Kopieren'}
        </button>
      </div>

      <div className="dp-script">
        <span className="dp-label">Script ({pkg.platform || 'TikTok'})</span>
        <p>{pkg.script}</p>
        <button
          className={`dp-copy-btn ${copied === 'script' ? 'dp-copied' : ''}`}
          onClick={() => copyToClipboard(pkg.script, 'script')}
        >
          {copied === 'script' ? '✓ Kopiert' : 'Kopieren'}
        </button>
      </div>

      <div className="dp-meta">
        <div className="dp-hashtags">
          <span className="dp-label">Hashtags</span>
          <p className="dp-hashtags-text">{hashtagsText}</p>
          <button
            className={`dp-copy-btn ${copied === 'hashtags' ? 'dp-copied' : ''}`}
            onClick={() => copyToClipboard(hashtagsText, 'hashtags')}
          >
            {copied === 'hashtags' ? '✓ Kopiert' : 'Kopieren'}
          </button>
        </div>
        <div className="dp-time">
          <span className="dp-label">Beste Zeit</span>
          <p className="dp-time-text">{pkg.best_time}</p>
        </div>
      </div>

      <div className="dp-actions">
        <button className="dp-btn dp-btn-copy-all" onClick={copyAll}>
          {copied === 'all' ? '✓ Alles kopiert' : 'Alles kopieren'}
        </button>
        <button className="dp-btn dp-btn-analyze" onClick={sendToAnalytics}>
          Analysieren
        </button>
      </div>

      <div className="dp-watermark">
        Erstellt mit <a href="https://happiness-eu.netlify.app" target="_blank" rel="noopener noreferrer">happiness-eu.netlify.app</a>
      </div>

      {/* === FREETEXT MODAL === */}
      {showFreetext && (
        <div className="dp-freetext-overlay" onClick={() => { setShowFreetext(false); setFreetextStep('input'); setFreetextInput(''); }}>
          <div className="dp-freetext-modal" onClick={(e) => e.stopPropagation()}>
            <div className="dp-freetext-header">
              <h3>{freetextStep === 'input' ? 'Was möchtest du heute?' : freetextStep === 'confirm' ? 'Stimmt das so?' : 'Generiere...'}</h3>
              <button className="dp-freetext-close" onClick={() => { setShowFreetext(false); setFreetextStep('input'); setFreetextInput(''); }}>
                <X size={18} />
              </button>
            </div>

            {freetextStep === 'input' && (
              <div className="dp-freetext-body">
                <p className="dp-freetext-hint">Beschreib frei, was dein nächstes Video soll. Thema, Stil, Ziel — alles was dir einfällt.</p>
                <textarea
                  className="dp-freetext-textarea"
                  placeholder='z.B. "Ein motivierendes Video über Fitness, 30 Sekunden, für TikTok. Mein Produkt ist eine App die beim Trainieren hilft."'
                  value={freetextInput}
                  onChange={(e) => setFreetextInput(e.target.value)}
                  rows={5}
                />
                <button
                  className="dp-freetext-next"
                  onClick={summarizeRequest}
                  disabled={!freetextInput.trim()}
                >
                  Weiter <ChevronRight size={16} />
                </button>
              </div>
            )}

            {freetextStep === 'confirm' && (
              <div className="dp-freetext-body">
                <div className="dp-freetext-summary">
                  <p className="dp-freetext-summary-label">Die KI hat das verstanden:</p>
                  <p className="dp-freetext-summary-text">{freetextSummary}</p>
                </div>
                {freetextError && <p className="dp-freetext-error">{freetextError}</p>}
                <div className="dp-freetext-actions">
                  <button className="dp-freetext-back" onClick={() => setFreetextStep('input')}>
                    Zurück
                  </button>
                  <button className="dp-freetext-generate" onClick={() => loadPackageWithFreetext(freetextInput)}>
                    Paket generieren
                  </button>
                </div>
              </div>
            )}

            {freetextStep === 'generating' && (
              <div className="dp-freetext-body dp-freetext-loading">
                <div className="dp-freetext-spinner"></div>
                <p>Dein Paket wird erstellt...</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
