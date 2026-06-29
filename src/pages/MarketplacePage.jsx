import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { useLanguage } from '../i18n/translations.jsx'

const CATEGORIES = ['Dienstleistung', 'Produkt', 'Geschenk', 'Tausch', 'Sonstiges']

export default function MarketplacePage() {
  const { user, profile } = useAuth()
  const { t } = useLanguage()
  const [tab, setTab] = useState('browse')
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('')
  const [search, setSearch] = useState('')
  const [form, setForm] = useState({ title: '', description: '', price: '', category: 'Sonstiges' })

  useEffect(() => { fetchItems() }, [])

  async function fetchItems() {
    const { data } = await supabase.from('marketplace').select('*, profiles(name, username)').eq('active', true).order('created_at', { ascending: false })
    setItems(data || [])
    setLoading(false)
  }

  async function handleCreate() {
    if (!form.title.trim() || !form.description.trim()) return
    await supabase.from('marketplace').insert({
      user_id: user.id,
      title: form.title.trim(),
      description: form.description.trim(),
      price: parseFloat(form.price) || 0,
      category: form.category,
    })
    setForm({ title: '', description: '', price: '', category: 'Sonstiges' })
    setTab('browse')
    fetchItems()
  }

  const filtered = items.filter(i => {
    if (filter && i.category !== filter) return false
    if (search && !i.title.toLowerCase().includes(search.toLowerCase()) && !i.description.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  return (
    <div className="container">
      {!user && (
        <div className="public-cta">
          <strong>Willkommen beim Happiness Marktplatz</strong>
          <p>Kostenlos registrieren um Anzeigen zu erstellen und zu kontaktieren.</p>
          <Link to="/register" className="btn btn-primary">Kostenlos registrieren</Link>
        </div>
      )}

      <div className="page-header">
        <h1>{t('marketplace.title')}</h1>
        <p>{t('marketplace.browse')}</p>
      </div>

      <div className="tabs">
        <button className={`tab ${tab === 'browse' ? 'active' : ''}`} onClick={() => setTab('browse')}>{t('marketplace.browse')}</button>
        {user && <button className={`tab ${tab === 'create' ? 'active' : ''}`} onClick={() => setTab('create')}>{t('marketplace.newAd')}</button>}
      </div>

      {tab === 'create' && (
        <div className="card">
          <div className="form-group"><label>{t('marketplace.titleField')}</label><input className="form-input" value={form.title} onChange={e => setForm({...form, title: e.target.value})} /></div>
          <div className="form-group"><label>{t('marketplace.desc')}</label><textarea className="form-input" value={form.description} onChange={e => setForm({...form, description: e.target.value})} /></div>
          <div style={{ display: 'flex', gap: '1rem' }}>
            <div className="form-group" style={{ flex: 1 }}><label>{t('marketplace.price')}</label><input type="number" className="form-input" value={form.price} onChange={e => setForm({...form, price: e.target.value})} /></div>
            <div className="form-group" style={{ flex: 1 }}><label>{t('marketplace.category')}</label><select className="form-input" value={form.category} onChange={e => setForm({...form, category: e.target.value})}>{CATEGORIES.map(c => <option key={c}>{c}</option>)}</select></div>
          </div>
          <button className="btn btn-primary" onClick={handleCreate}>{t('marketplace.createBtn')}</button>
        </div>
      )}

      {tab === 'browse' && (
        <>
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
            <input className="form-input" placeholder={t('marketplace.search')} value={search} onChange={e => setSearch(e.target.value)} />
            <select className="form-input" style={{ width: 'auto' }} value={filter} onChange={e => setFilter(e.target.value)}>
              <option value="">{t('marketplace.allCategories')}</option>
              {CATEGORIES.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>

          {loading ? <p style={{ textAlign: 'center', color: 'var(--text-muted)' }}>Laden...</p> : filtered.length === 0 ? (
            <div className="empty-state"><div className="empty-icon">🛒</div><p>{t('marketplace.noItems')}</p></div>
          ) : filtered.map(item => (
            <div key={item.id} className="card">
              <div className="card-header">
                <div>
                  <h3 style={{ marginBottom: '0.25rem' }}>{item.title}</h3>
                  <span className="badge badge-primary">{item.category}</span>
                </div>
                <span style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--success)' }}>{item.price.toFixed(2)} €</span>
              </div>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '0.5rem' }}>
                Von <strong>{item.profiles?.name}</strong> · {new Date(item.created_at).toLocaleDateString('de-DE')}
              </p>
              <p>{item.description}</p>
              {user && item.user_id !== user.id && (
                <div style={{ marginTop: '1rem' }}>
                  <button className="btn btn-sm btn-outline" onClick={() => alert(`Kontakt: ${item.user_id}`)}>{t('marketplace.contact')}</button>
                </div>
              )}
            </div>
          ))}
        </>
      )}
    </div>
  )
}
