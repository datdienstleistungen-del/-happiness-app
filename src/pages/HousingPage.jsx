import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Building2, Calendar } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { renderBrandText } from '../components/Logo'
import { useLanguage } from '../i18n/translations.jsx'

const HOUSING_TYPES = ['WG-Zimmer', 'Wohnung', 'Haus', 'Temporär', 'Sonstiges']

export default function HousingPage() {
  const { user } = useAuth()
  const { t } = useLanguage()
  const [tab, setTab] = useState('browse')
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [priceMax, setPriceMax] = useState('')
  const [form, setForm] = useState({
    title: '',
    description: '',
    price: '',
    housing_type: 'WG-Zimmer',
    location: '',
    size: '',
    available_from: '',
    contact: '',
  })

  useEffect(() => { fetchItems() }, [])

  async function fetchItems() {
    const { data } = await supabase
      .from('marketplace')
      .select('*, profiles(name, username)')
      .eq('active', true)
      .eq('category', 'Wohnung')
      .order('created_at', { ascending: false })
    setItems(data || [])
    setLoading(false)
  }

  async function handleCreate() {
    if (!form.title.trim() || !form.description.trim()) return
    await supabase.from('marketplace').insert({
      user_id: user.id,
      title: form.title.trim(),
      description: `${form.housing_type} | ${form.size}m² | Verfügbar ab: ${form.available_from} | ${form.description.trim()}`,
      price: parseFloat(form.price) || 0,
      category: 'Wohnung',
    })
    setForm({ title: '', description: '', price: '', housing_type: 'WG-Zimmer', location: '', size: '', available_from: '', contact: '' })
    setTab('browse')
    fetchItems()
  }

  const filtered = items.filter(i => {
    if (typeFilter && !i.description.includes(typeFilter)) return false
    if (search) {
      const s = search.toLowerCase()
      if (!i.title.toLowerCase().includes(s) && !i.description.toLowerCase().includes(s)) return false
    }
    if (priceMax && i.price > parseFloat(priceMax)) return false
    return true
  })

  function parseHousingType(desc) {
    for (const type of HOUSING_TYPES) {
      if (desc.includes(type)) return type
    }
    return 'Sonstiges'
  }

  function parseSize(desc) {
    const match = desc.match(/(\d+)m²/)
    return match ? match[1] + 'm²' : null
  }

  function parseAvailable(desc) {
    const match = desc.match(/Verfügbar ab: ([^\|]+)/)
    return match ? match[1].trim() : null
  }

  function parseOriginalDesc(desc) {
    const parts = desc.split('|')
    return parts.length > 1 ? parts.slice(1).join('|').trim() : desc
  }

  return (
    <div className="container">
      {!user && (
        <div className="public-cta">
          <strong>{renderBrandText('Willkommen bei den Happiness Wohnungsanzeigen')}</strong>
          <p>Kostenlos registrieren um Wohnungen zu inserieren und zu kontaktieren.</p>
          <Link to="/register" className="btn btn-primary">Kostenlos registrieren</Link>
        </div>
      )}

      <div className="page-header">
        <h1>{t('housing.title')}</h1>
        <p>{t('housing.subtitle')}</p>
      </div>

      <div className="tabs">
        <button className={`tab ${tab === 'browse' ? 'active' : ''}`} onClick={() => setTab('browse')}>{t('housing.browse')}</button>
        {user && <button className={`tab ${tab === 'create' ? 'active' : ''}`} onClick={() => setTab('create')}>{t('housing.create')}</button>}
      </div>

      {tab === 'create' && (
        <div className="card">
          <div className="form-group">
            <label>{t('housing.titleField')}</label>
            <input className="form-input" value={form.title} onChange={e => setForm({...form, title: e.target.value})} placeholder="z.B. WG-Zimmer in Berlin-Mitte" />
          </div>
          <div style={{ display: 'flex', gap: '1rem' }}>
            <div className="form-group" style={{ flex: 1 }}>
              <label>{t('housing.type')}</label>
              <select className="form-input" value={form.housing_type} onChange={e => setForm({...form, housing_type: e.target.value})}>
                {HOUSING_TYPES.map(h => <option key={h}>{h}</option>)}
              </select>
            </div>
            <div className="form-group" style={{ flex: 1 }}>
              <label>{t('housing.price')}</label>
              <input type="number" className="form-input" value={form.price} onChange={e => setForm({...form, price: e.target.value})} placeholder="€ pro Monat" />
            </div>
          </div>
          <div style={{ display: 'flex', gap: '1rem' }}>
            <div className="form-group" style={{ flex: 1 }}>
              <label>{t('housing.location')}</label>
              <input className="form-input" value={form.location} onChange={e => setForm({...form, location: e.target.value})} placeholder="z.B. Berlin, Neukölln" />
            </div>
            <div className="form-group" style={{ flex: 1 }}>
              <label>{t('housing.size')}</label>
              <input className="form-input" value={form.size} onChange={e => setForm({...form, size: e.target.value})} placeholder="z.B. 15" />
            </div>
          </div>
          <div className="form-group">
            <label>{t('housing.availableFrom')}</label>
            <input type="date" className="form-input" value={form.available_from} onChange={e => setForm({...form, available_from: e.target.value})} />
          </div>
          <div className="form-group">
            <label>{t('housing.desc')}</label>
            <textarea className="form-input" value={form.description} onChange={e => setForm({...form, description: e.target.value})} placeholder="Beschreibe die Wohnung, die Nachbarschaft, die WG..." />
          </div>
          <div className="form-group">
            <label>{t('housing.contact')}</label>
            <input className="form-input" value={form.contact} onChange={e => setForm({...form, contact: e.target.value})} placeholder="E-Mail oder Telefonnummer" />
          </div>
          <button className="btn btn-primary" onClick={handleCreate}>{t('housing.publish')}</button>
        </div>
      )}

      {tab === 'browse' && (
        <>
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
            <input className="form-input" style={{ flex: 1, minWidth: '200px' }} placeholder={t('housing.search')} value={search} onChange={e => setSearch(e.target.value)} />
            <select className="form-input" style={{ width: 'auto' }} value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
              <option value="">{t('housing.allTypes')}</option>
              {HOUSING_TYPES.map(h => <option key={h}>{h}</option>)}
            </select>
            <input className="form-input" style={{ width: '150px' }} type="number" placeholder={t('housing.maxPrice')} value={priceMax} onChange={e => setPriceMax(e.target.value)} />
          </div>

          {loading ? <p style={{ textAlign: 'center', color: 'var(--text-muted)' }}>Laden...</p> : filtered.length === 0 ? (
            <div className="empty-state"><div className="empty-icon"><Building2 /></div><p>{t('housing.noResults')}</p></div>
          ) : filtered.map(item => {
            const housingType = parseHousingType(item.description)
            const size = parseSize(item.description)
            const available = parseAvailable(item.description)
            const originalDesc = parseOriginalDesc(item.description)

            return (
              <div key={item.id} className="card" style={{ borderLeft: '4px solid var(--primary)' }}>
                <div className="card-header">
                  <div>
                    <h3 style={{ marginBottom: '0.25rem' }}>{item.title}</h3>
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <span className="badge badge-primary">{housingType}</span>
                      {size && <span className="badge" style={{ background: 'var(--border)', color: 'var(--text)' }}>📐 {size}</span>}
                      {available && <span className="badge" style={{ background: 'var(--border)', color: 'var(--text)' }}><Calendar size={12} style={{ marginRight: 4, verticalAlign: 'text-bottom' }} />{available}</span>}
                    </div>
                  </div>
                  <span style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--success)' }}>{item.price.toFixed(0)} €<span style={{ fontSize: '0.8rem', fontWeight: 400, color: 'var(--text-muted)' }}>/Monat</span></span>
                </div>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '0.5rem' }}>
                  Von <strong>{item.profiles?.name}</strong> · {new Date(item.created_at).toLocaleDateString('de-DE')}
                </p>
                <p>{originalDesc}</p>
                {user && item.user_id !== user.id && (
                  <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem' }}>
                    <button className="btn btn-sm btn-primary" onClick={() => alert(`${t('housing.contactInfo')}: ${item.user_id}`)}>
                      ✉️ {t('housing.contactBtn')}
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </>
      )}
    </div>
  )
}
