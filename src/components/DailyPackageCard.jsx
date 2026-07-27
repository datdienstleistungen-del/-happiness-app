import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import './DailyPackageCard.css'

export default function DailyPackageCard({ onStartWithPackage }) {
  const [pkg, setPkg] = useState(null)
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(null)
  const [streak, setStreak] = useState(0)

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
        {streak > 0 && (
          <div className="dp-streak">
            <span className="dp-streak-fire">🔥</span>
            <span>{streak} Tag{streak > 1 ? 'e' : ''} streak</span>
          </div>
        )}
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
        <span className="dp-label">Script (30 Sek)</span>
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
        {!pkg.used && (
          <button className="dp-btn dp-btn-done" onClick={markAsUsed}>
            Erledigt ✓
          </button>
        )}
        {pkg.used && (
          <span className="dp-done-badge">Bereits verwendet</span>
        )}
      </div>
    </div>
  )
}
