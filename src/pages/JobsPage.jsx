import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { useLanguage } from '../i18n/translations.jsx'

const JOB_TYPES = ['Vollzeit', 'Teilzeit', 'Freelance', 'Praktikum', 'Homeoffice']

export default function JobsPage() {
  const { user } = useAuth()
  const { t } = useLanguage()
  const [tab, setTab] = useState('browse')
  const [jobs, setJobs] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [form, setForm] = useState({ title: '', description: '', location: '', type: 'Vollzeit', contact: '' })

  useEffect(() => { fetchJobs() }, [])

  async function fetchJobs() {
    const { data } = await supabase.from('jobs').select('*, profiles(name, username)').eq('active', true).order('created_at', { ascending: false })
    setJobs(data || [])
    setLoading(false)
  }

  async function handleCreate() {
    if (!form.title.trim() || !form.description.trim()) return
    await supabase.from('jobs').insert({
      user_id: user.id,
      title: form.title.trim(),
      description: form.description.trim(),
      location: form.location.trim(),
      job_type: form.type,
      contact: form.contact.trim() || user.email,
    })
    setForm({ title: '', description: '', location: '', type: 'Vollzeit', contact: '' })
    setTab('browse')
    fetchJobs()
  }

  const filtered = jobs.filter(j => {
    if (typeFilter && j.job_type !== typeFilter) return false
    if (search) {
      const s = search.toLowerCase()
      if (!j.title.toLowerCase().includes(s) && !j.description.toLowerCase().includes(s) && !j.location?.toLowerCase().includes(s)) return false
    }
    return true
  })

  return (
    <div className="container">
      <div className="page-header"><h1>💼 {t('jobs.title')}</h1><p>{t('jobs.browse')}</p></div>

      <div className="tabs">
        <button className={`tab ${tab === 'browse' ? 'active' : ''}`} onClick={() => setTab('browse')}>{t('jobs.browse')}</button>
        <button className={`tab ${tab === 'create' ? 'active' : ''}`} onClick={() => setTab('create')}>{t('jobs.create')}</button>
      </div>

      {tab === 'create' && (
        <div className="card">
          <div className="form-group"><label>{t('jobs.titleField')}</label><input className="form-input" value={form.title} onChange={e => setForm({...form, title: e.target.value})} /></div>
          <div className="form-group"><label>{t('jobs.desc')}</label><textarea className="form-input" value={form.description} onChange={e => setForm({...form, description: e.target.value})} /></div>
          <div style={{ display: 'flex', gap: '1rem' }}>
            <div className="form-group" style={{ flex: 1 }}><label>{t('jobs.location')}</label><input className="form-input" value={form.location} onChange={e => setForm({...form, location: e.target.value})} /></div>
            <div className="form-group" style={{ flex: 1 }}><label>{t('jobs.type')}</label><select className="form-input" value={form.type} onChange={e => setForm({...form, type: e.target.value})}>{JOB_TYPES.map(t => <option key={t}>{t}</option>)}</select></div>
          </div>
          <div className="form-group"><label>{t('jobs.contact')}</label><input className="form-input" value={form.contact} onChange={e => setForm({...form, contact: e.target.value})} /></div>
          <button className="btn btn-primary" onClick={handleCreate}>{t('jobs.createBtn')}</button>
        </div>
      )}

      {tab === 'browse' && (
        <>
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
            <input className="form-input" placeholder={t('jobs.search')} value={search} onChange={e => setSearch(e.target.value)} />
            <select className="form-input" style={{ width: 'auto' }} value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
              <option value="">{t('jobs.allTypes')}</option>
              {JOB_TYPES.map(t => <option key={t}>{t}</option>)}
            </select>
          </div>

          {loading ? <p style={{ textAlign: 'center', color: 'var(--text-muted)' }}>Laden...</p> : filtered.length === 0 ? (
            <div className="empty-state"><div className="empty-icon">💼</div><p>{t('jobs.noJobs')}</p></div>
          ) : filtered.map(job => (
            <div key={job.id} className="card">
              <div className="card-header">
                <div>
                  <h3 style={{ marginBottom: '0.25rem' }}>{job.title}</h3>
                  <span className="badge badge-primary">{job.job_type}</span>
                  {job.location && <span style={{ marginLeft: '0.5rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>📍 {job.location}</span>}
                </div>
              </div>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '0.5rem' }}>
                Von <strong>{job.profiles?.name}</strong> · {new Date(job.created_at).toLocaleDateString('de-DE')}
              </p>
              <p>{job.description}</p>
              {job.user_id !== user.id && (
                <div style={{ marginTop: '1rem' }}>
                  <button className="btn btn-sm btn-outline" onClick={() => alert(`Bewerbung an: ${job.contact}`)}>{t('jobs.apply')}</button>
                </div>
              )}
            </div>
          ))}
        </>
      )}
    </div>
  )
}
