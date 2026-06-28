import { useState, useEffect } from 'react'
import { useAuth } from '../App'
import { supabase } from '../lib/supabase'

export default function AdminPage() {
  const { profile } = useAuth()
  const [tab, setTab] = useState('stats')
  const [users, setUsers] = useState([])
  const [posts, setPosts] = useState([])
  const [items, setItems] = useState([])
  const [jobs, setJobs] = useState([])
  const [courses, setCourses] = useState([])
  const [loading, setLoading] = useState(true)

  const isAdmin = profile?.role === 'admin'

  useEffect(() => { if (isAdmin) fetchAll() }, [isAdmin])

  async function fetchAll() {
    const [u, p, m, j, c] = await Promise.all([
      supabase.from('profiles').select('*'),
      supabase.from('posts').select('*, profiles(name, username)'),
      supabase.from('marketplace').select('*, profiles(name, username)'),
      supabase.from('jobs').select('*, profiles(name, username)'),
      supabase.from('courses').select('*, profiles(name, username)'),
    ])
    setUsers(u.data || [])
    setPosts(p.data || [])
    setItems(m.data || [])
    setJobs(j.data || [])
    setCourses(c.data || [])
    setLoading(false)
  }

  async function deleteUser(id) {
    if (!confirm('Nutzer wirklich löschen?')) return
    await supabase.from('profiles').delete().eq('id', id)
    fetchAll()
  }

  async function deletePost(id) {
    await supabase.from('posts').delete().eq('id', id)
    fetchAll()
  }

  async function deleteItem(id) {
    await supabase.from('marketplace').delete().eq('id', id)
    fetchAll()
  }

  async function deleteJob(id) {
    await supabase.from('jobs').delete().eq('id', id)
    fetchAll()
  }

  async function deleteCourse(id) {
    await supabase.from('courses').delete().eq('id', id)
    fetchAll()
  }

  if (!isAdmin) return <div className="container"><div className="empty-state"><div className="empty-icon">🔒</div><p>Kein Zugriff. Nur für Admins.</p></div></div>

  return (
    <div className="container">
      <div className="page-header"><h1>⚙️ Admin-Bereich</h1></div>

      {loading ? <p style={{ textAlign: 'center', color: 'var(--text-muted)' }}>Laden...</p> : (
        <>
          <div className="stats-row">
            <div className="stat-card"><div className="stat-value">{users.length}</div><div className="stat-label">Nutzer</div></div>
            <div className="stat-card"><div className="stat-value">{posts.length}</div><div className="stat-label">Beiträge</div></div>
            <div className="stat-card"><div className="stat-value">{items.filter(i => i.active).length}</div><div className="stat-label">Anzeigen</div></div>
            <div className="stat-card"><div className="stat-value">{jobs.filter(j => j.active).length}</div><div className="stat-label">Jobs</div></div>
            <div className="stat-card"><div className="stat-value">{courses.filter(c => c.active).length}</div><div className="stat-label">Kurse</div></div>
          </div>

          <div className="tabs">
            <button className={`tab ${tab === 'stats' ? 'active' : ''}`} onClick={() => setTab('stats')}>Nutzer</button>
            <button className={`tab ${tab === 'posts' ? 'active' : ''}`} onClick={() => setTab('posts')}>Beiträge</button>
            <button className={`tab ${tab === 'items' ? 'active' : ''}`} onClick={() => setTab('items')}>Anzeigen</button>
            <button className={`tab ${tab === 'jobs' ? 'active' : ''}`} onClick={() => setTab('jobs')}>Jobs</button>
            <button className={`tab ${tab === 'courses' ? 'active' : ''}`} onClick={() => setTab('courses')}>Kurse</button>
          </div>

          {tab === 'stats' && users.map(u => (
            <div key={u.id} className="list-item">
              <div className="list-item-info">
                <div className="list-item-avatar">{u.name?.[0]?.toUpperCase()}</div>
                <div><strong>{u.name}</strong> <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>@{u.username} · {u.email} · {u.role || 'user'}</span></div>
              </div>
              <button className="btn btn-sm btn-danger" onClick={() => deleteUser(u.id)}>Löschen</button>
            </div>
          ))}

          {tab === 'posts' && posts.map(p => (
            <div key={p.id} className="card">
              <div className="card-header"><span className="card-author">{p.profiles?.name}</span><span className="card-time">{new Date(p.created_at).toLocaleDateString('de-DE')}</span></div>
              <p>{p.content}</p>
              <button className="btn btn-sm btn-danger" style={{ marginTop: '0.5rem' }} onClick={() => deletePost(p.id)}>Löschen</button>
            </div>
          ))}

          {tab === 'items' && items.map(i => (
            <div key={i.id} className="card">
              <div className="card-header"><span className="card-author">{i.title} - {i.profiles?.name}</span><span className="badge badge-primary">{i.category}</span></div>
              <p>{i.description}</p>
              <button className="btn btn-sm btn-danger" style={{ marginTop: '0.5rem' }} onClick={() => deleteItem(i.id)}>Löschen</button>
            </div>
          ))}

          {tab === 'jobs' && jobs.map(j => (
            <div key={j.id} className="card">
              <div className="card-header"><span className="card-author">{j.title} - {j.profiles?.name}</span><span className="badge badge-primary">{j.job_type}</span></div>
              <p>{j.description}</p>
              <button className="btn btn-sm btn-danger" style={{ marginTop: '0.5rem' }} onClick={() => deleteJob(j.id)}>Löschen</button>
            </div>
          ))}

          {tab === 'courses' && courses.map(c => (
            <div key={c.id} className="card">
              <div className="card-header"><span className="card-author">{c.title} - {c.profiles?.name}</span><span className="badge badge-primary">{c.category}</span></div>
              <p>{c.description}</p>
              <button className="btn btn-sm btn-danger" style={{ marginTop: '0.5rem' }} onClick={() => deleteCourse(c.id)}>Löschen</button>
            </div>
          ))}
        </>
      )}
    </div>
  )
}
