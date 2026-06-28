import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { useLanguage } from '../i18n/translations.jsx'

export default function HistoryPage() {
  const { user } = useAuth()
  const { t } = useLanguage()
  const [tab, setTab] = useState('posts')
  const [posts, setPosts] = useState([])
  const [items, setItems] = useState([])
  const [jobs, setJobs] = useState([])
  const [courses, setCourses] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    const [p, m, j, c] = await Promise.all([
      supabase.from('posts').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
      supabase.from('marketplace').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
      supabase.from('jobs').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
      supabase.from('courses').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
    ])
    setPosts(p.data || [])
    setItems(m.data || [])
    setJobs(j.data || [])
    setCourses(c.data || [])
    setLoading(false)
  }

  return (
    <div className="container">
      <div className="page-header"><h1>📜 {t('history.title')}</h1></div>

      <div className="tabs">
        <button className={`tab ${tab === 'posts' ? 'active' : ''}`} onClick={() => setTab('posts')}>{t('history.posts')} ({posts.length})</button>
        <button className={`tab ${tab === 'items' ? 'active' : ''}`} onClick={() => setTab('items')}>{t('history.items')} ({items.length})</button>
        <button className={`tab ${tab === 'jobs' ? 'active' : ''}`} onClick={() => setTab('jobs')}>{t('history.jobs')} ({jobs.length})</button>
        <button className={`tab ${tab === 'courses' ? 'active' : ''}`} onClick={() => setTab('courses')}>{t('history.courses')} ({courses.length})</button>
      </div>

      {loading ? <p style={{ textAlign: 'center', color: 'var(--text-muted)' }}>Laden...</p> : (
        <>
          {tab === 'posts' && (posts.length === 0 ? <div className="empty-state"><p>{t('history.none')} {t('history.posts').toLowerCase()}.</p></div> : posts.map(p => (
            <div key={p.id} className="card"><span className="card-time">{new Date(p.created_at).toLocaleDateString('de-DE')}</span><p style={{ marginTop: '0.5rem' }}>{p.content}</p></div>
          )))}
          {tab === 'items' && (items.length === 0 ? <div className="empty-state"><p>{t('history.none')} {t('history.items').toLowerCase()}.</p></div> : items.map(i => (
            <div key={i.id} className="card"><span className="card-time">{new Date(i.created_at).toLocaleDateString('de-DE')} · {i.active ? '✅ Aktiv' : '❌ Deaktiviert'}</span><p style={{ marginTop: '0.5rem' }}><strong>{i.title}</strong> - {i.price.toFixed(2)} €</p></div>
          )))}
          {tab === 'jobs' && (jobs.length === 0 ? <div className="empty-state"><p>{t('history.none')} {t('history.jobs').toLowerCase()}.</p></div> : jobs.map(j => (
            <div key={j.id} className="card"><span className="card-time">{new Date(j.created_at).toLocaleDateString('de-DE')} · {j.active ? '✅ Aktiv' : '❌ Deaktiviert'}</span><p style={{ marginTop: '0.5rem' }}><strong>{j.title}</strong> · {j.job_type}</p></div>
          )))}
          {tab === 'courses' && (courses.length === 0 ? <div className="empty-state"><p>{t('history.none')} {t('history.courses').toLowerCase()}.</p></div> : courses.map(c => (
            <div key={c.id} className="card"><span className="card-time">{new Date(c.created_at).toLocaleDateString('de-DE')} · {c.active ? '✅ Aktiv' : '❌ Deaktiviert'}</span><p style={{ marginTop: '0.5rem' }}><strong>{c.title}</strong> · {c.category}</p></div>
          )))}
        </>
      )}
    </div>
  )
}
