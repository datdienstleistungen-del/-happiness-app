import { useState, useEffect } from 'react'
import { useAuth } from '../App'
import { supabase } from '../lib/supabase'

const CATEGORIES = ['Glück', 'Wellness', 'Persönlichkeitsentwicklung', 'Beruf', 'Sport', 'Kreativität', 'Sonstiges']

export default function CoursesPage() {
  const { user } = useAuth()
  const [tab, setTab] = useState('browse')
  const [courses, setCourses] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [catFilter, setCatFilter] = useState('')
  const [form, setForm] = useState({ title: '', description: '', category: 'Glück', duration: '', price: '', maxParticipants: '20' })

  useEffect(() => { fetchCourses() }, [])

  async function fetchCourses() {
    const { data } = await supabase.from('courses').select('*, profiles(name, username), course_enrollments(user_id)').eq('active', true).order('created_at', { ascending: false })
    setCourses(data || [])
    setLoading(false)
  }

  async function handleCreate() {
    if (!form.title.trim() || !form.description.trim()) return
    await supabase.from('courses').insert({
      user_id: user.id,
      title: form.title.trim(),
      description: form.description.trim(),
      category: form.category,
      duration: form.duration.trim(),
      price: parseFloat(form.price) || 0,
      max_participants: parseInt(form.maxParticipants) || 20,
    })
    setForm({ title: '', description: '', category: 'Glück', duration: '', price: '', maxParticipants: '20' })
    setTab('browse')
    fetchCourses()
  }

  async function handleEnroll(courseId) {
    await supabase.from('course_enrollments').insert({ course_id: courseId, user_id: user.id })
    fetchCourses()
  }

  async function handleLeave(courseId) {
    await supabase.from('course_enrollments').delete().eq('course_id', courseId).eq('user_id', user.id)
    fetchCourses()
  }

  const filtered = courses.filter(c => {
    if (catFilter && c.category !== catFilter) return false
    if (search) {
      const s = search.toLowerCase()
      if (!c.title.toLowerCase().includes(s) && !c.description.toLowerCase().includes(s)) return false
    }
    return true
  })

  return (
    <div className="container">
      <div className="page-header"><h1>📚 Kurse</h1><p>Lerne Neues und wachse</p></div>

      <div className="tabs">
        <button className={`tab ${tab === 'browse' ? 'active' : ''}`} onClick={() => setTab('browse')}>Kurse entdecken</button>
        <button className={`tab ${tab === 'create' ? 'active' : ''}`} onClick={() => setTab('create')}>Kurs anbieten</button>
      </div>

      {tab === 'create' && (
        <div className="card">
          <div className="form-group"><label>Kurstitel</label><input className="form-input" value={form.title} onChange={e => setForm({...form, title: e.target.value})} /></div>
          <div className="form-group"><label>Beschreibung</label><textarea className="form-input" value={form.description} onChange={e => setForm({...form, description: e.target.value})} /></div>
          <div style={{ display: 'flex', gap: '1rem' }}>
            <div className="form-group" style={{ flex: 1 }}><label>Kategorie</label><select className="form-input" value={form.category} onChange={e => setForm({...form, category: e.target.value})}>{CATEGORIES.map(c => <option key={c}>{c}</option>)}</select></div>
            <div className="form-group" style={{ flex: 1 }}><label>Dauer</label><input className="form-input" placeholder="z.B. 4 Wochen" value={form.duration} onChange={e => setForm({...form, duration: e.target.value})} /></div>
          </div>
          <div style={{ display: 'flex', gap: '1rem' }}>
            <div className="form-group" style={{ flex: 1 }}><label>Preis (€)</label><input type="number" className="form-input" value={form.price} onChange={e => setForm({...form, price: e.target.value})} /></div>
            <div className="form-group" style={{ flex: 1 }}><label>Max. Teilnehmer</label><input type="number" className="form-input" value={form.maxParticipants} onChange={e => setForm({...form, maxParticipants: e.target.value})} /></div>
          </div>
          <button className="btn btn-primary" onClick={handleCreate}>Kurs erstellen</button>
        </div>
      )}

      {tab === 'browse' && (
        <>
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
            <input className="form-input" placeholder="Suchen..." value={search} onChange={e => setSearch(e.target.value)} />
            <select className="form-input" style={{ width: 'auto' }} value={catFilter} onChange={e => setCatFilter(e.target.value)}>
              <option value="">Alle Kategorien</option>
              {CATEGORIES.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>

          {loading ? <p style={{ textAlign: 'center', color: 'var(--text-muted)' }}>Laden...</p> : filtered.length === 0 ? (
            <div className="empty-state"><div className="empty-icon">📚</div><p>Keine Kurse gefunden.</p></div>
          ) : filtered.map(course => {
            const enrollments = course.course_enrollments || []
            const isEnrolled = enrollments.some(e => e.user_id === user.id)
            const isFull = enrollments.length >= course.max_participants
            const progress = enrollments.length / course.max_participants

            return (
              <div key={course.id} className="card">
                <div className="card-header">
                  <div>
                    <h3 style={{ marginBottom: '0.25rem' }}>{course.title}</h3>
                    <span className="badge badge-primary">{course.category}</span>
                    {course.duration && <span style={{ marginLeft: '0.5rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>⏱ {course.duration}</span>}
                  </div>
                  <span style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--success)' }}>{course.price.toFixed(2)} €</span>
                </div>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '0.5rem' }}>
                  Von <strong>{course.profiles?.name}</strong> · {new Date(course.created_at).toLocaleDateString('de-DE')}
                </p>
                <p>{course.description}</p>
                <div style={{ marginTop: '1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
                    <span>Plätze: {enrollments.length}/{course.max_participants}</span>
                  </div>
                  <div style={{ height: '6px', background: 'var(--border)', borderRadius: '3px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${progress * 100}%`, background: 'var(--gradient)', borderRadius: '3px' }} />
                  </div>
                </div>
                <div style={{ marginTop: '1rem' }}>
                  {course.user_id !== user.id && (
                    isEnrolled ? (
                      <button className="btn btn-sm btn-danger" onClick={() => handleLeave(course.id)}>Abmelden</button>
                    ) : (
                      <button className="btn btn-sm btn-primary" onClick={() => handleEnroll(course.id)} disabled={isFull}>
                        {isFull ? 'Ausgebucht' : 'Teilnehmen'}
                      </button>
                    )
                  )}
                </div>
              </div>
            )
          })}
        </>
      )}
    </div>
  )
}
