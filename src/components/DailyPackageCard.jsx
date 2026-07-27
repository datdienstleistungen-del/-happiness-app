import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Settings, X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import './DailyPackageCard.css'

const DEFAULT_SETTINGS = {
  topic: '',
  platform: 'tiktok',
  tone: 'authentisch',
  duration: 30,
  language: 'de'
}

const PLATFORMS = [
  { value: 'tiktok', label: 'TikTok' },
  { value: 'instagram', label: 'Instagram Reels' },
  { value: 'youtube', label: 'YouTube Shorts' },
  { value: 'facebook', label: 'Facebook' },
  { value: 'linkedin', label: 'LinkedIn' }
]

const TONES = [
  { value: 'authentisch', label: 'Authentisch' },
  { value: 'lustig', label: 'Lustig' },
  { value: 'informativ', label: 'Informativ' },
  { value: 'motivierend', label: 'Motivierend' },
  { value: 'provokant', label: 'Provokant' },
  { value: 'entspannt', label: 'Entspannt' }
]

const DURATIONS = [
  { value: 15, label: '15 Sek' },
  { value: 30, label: '30 Sek' },
  { value: 60, label: '60 Sek' }
]

export default function DailyPackageCard() {
  const navigate = useNavigate()
  const [pkg, setPkg] = useState(null)
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(null)
  const [streak, setStreak] = useState(0)
  const [showSettings, setShowSettings] = useState(false)
  const [settings, setSettings] = useState(DEFAULT_SETTINGS)
  const [savingSettings, setSavingSettings] = useState(false)

  useEffect(() => {
    loadPackage()
    loadSettings()
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

  const loadSettings = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data } = await supabase
        .from('ai_settings')
        .select('daily_package_settings')
        .eq('user_id', user.id)
        .single()

      if (data?.daily_package_settings) {
        setSettings({ ...DEFAULT_SETTINGS, ...data.daily_package_settings })
      }
    } catch (e) {
      console.warn('[Settings] Load error:', e.message)
    }
  }

  const saveSettings = async () => {
    setSavingSettings(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      await supabase
        .from('ai_settings')
        .update({ daily_package_settings: settings })
        .eq('user_id', user.id)

      setShowSettings(false)
    } catch (e) {
      console.warn('[Settings] Save error:', e.message)
    } finally {
      setSavingSettings(false)
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
    const full = `${pkg.hook}\n\n${pkg.script}\n\n${pkg.hashtags.map(t => '#' + t).join(' ')}`
    await copyToClipboard(full, 'all')
  }

  const markAsUsed = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      await supabase
        .from('daily_packages')
        .update({ used: true })
        .eq('user_id', user.id)
        .eq('package_date', new Date().toISOString().split('T')[0])

      setPkg(prev => ({ ...prev, used: true }))
    } catch (e) {
      console.warn('[MarkUsed] Error:', e.message)
    }
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
    <div className={`dp-card ${pkg.used ? 'dp-used' : ''}`}>
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
          <button className="dp-settings-btn" onClick={() => setShowSettings(true)}>
            <Settings size={16} />
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
          Analysieren & Verbessern
        </button>
        {!pkg.used && (
          <button className="dp-btn dp-btn-done" onClick={markAsUsed}>
            Erledigt ✓
          </button>
        )}
        {pkg.used && (
          <span className="dp-done-badge">Bereits verwendet</span>
        )}
      </div>

      {showSettings && (
        <div className="dp-settings-overlay" onClick={() => setShowSettings(false)}>
          <div className="dp-settings-modal" onClick={(e) => e.stopPropagation()}>
            <div className="dp-settings-header">
              <h3>Paket-Einstellungen</h3>
              <button className="dp-settings-close" onClick={() => setShowSettings(false)}>
                <X size={18} />
              </button>
            </div>

            <div className="dp-settings-body">
              <label className="dp-settings-label">
                Thema / Branche
                <input
                  type="text"
                  className="dp-settings-input"
                  placeholder="z.B. Fitness, Kochen, Gaming..."
                  value={settings.topic}
                  onChange={(e) => setSettings(s => ({ ...s, topic: e.target.value }))}
                />
              </label>

              <label className="dp-settings-label">
                Plattform
                <select
                  className="dp-settings-select"
                  value={settings.platform}
                  onChange={(e) => setSettings(s => ({ ...s, platform: e.target.value }))}
                >
                  {PLATFORMS.map(p => (
                    <option key={p.value} value={p.value}>{p.label}</option>
                  ))}
                </select>
              </label>

              <label className="dp-settings-label">
                Tonfall
                <select
                  className="dp-settings-select"
                  value={settings.tone}
                  onChange={(e) => setSettings(s => ({ ...s, tone: e.target.value }))}
                >
                  {TONES.map(t => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </label>

              <label className="dp-settings-label">
                Videodauer
                <select
                  className="dp-settings-select"
                  value={settings.duration}
                  onChange={(e) => setSettings(s => ({ ...s, duration: parseInt(e.target.value) }))}
                >
                  {DURATIONS.map(d => (
                    <option key={d.value} value={d.value}>{d.label}</option>
                  ))}
                </select>
              </label>
            </div>

            <div className="dp-settings-footer">
              <button className="dp-btn dp-btn-cancel" onClick={() => setShowSettings(false)}>
                Abbrechen
              </button>
              <button 
                className="dp-btn dp-btn-save" 
                onClick={saveSettings}
                disabled={savingSettings}
              >
                {savingSettings ? 'Speichern...' : 'Speichern'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
