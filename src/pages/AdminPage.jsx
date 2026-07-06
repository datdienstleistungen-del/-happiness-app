import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { useLanguage } from '../i18n/translations.jsx'
import './AdminPage.css'

export default function AdminPage() {
  const { profile } = useAuth()
  const { t } = useLanguage()
  const [tab, setTab] = useState('dashboard')
  const [loading, setLoading] = useState(true)

  // Data
  const [users, setUsers] = useState([])
  const [posts, setPosts] = useState([])
  const [marketplaceItems, setMarketplaceItems] = useState([])
  const [jobs, setJobs] = useState([])
  const [courses, setCourses] = useState([])
  const [aiProfiles, setAiProfiles] = useState([])
  const [aiConversations, setAiConversations] = useState([])

  const isAdmin = profile?.role === 'admin'

  useEffect(() => { if (isAdmin) fetchAll() }, [isAdmin])

  async function fetchAll() {
    setLoading(true)
    const [u, p, m, j, c, ap, ac] = await Promise.all([
      supabase.from('profiles').select('*'),
      supabase.from('posts').select('*, profiles(name, username)').order('created_at', { ascending: false }),
      supabase.from('marketplace').select('*, profiles(name, username)').order('created_at', { ascending: false }),
      supabase.from('jobs').select('*, profiles(name, username)').order('created_at', { ascending: false }),
      supabase.from('courses').select('*, profiles(name, username)').order('created_at', { ascending: false }),
      supabase.from('ai_settings').select('*'),
      supabase.from('ai_conversations').select('*').order('created_at', { ascending: false }),
    ])
    setUsers(u.data || [])
    setPosts(p.data || [])
    setMarketplaceItems(m.data || [])
    setJobs(j.data || [])
    setCourses(c.data || [])
    setAiProfiles(ap.data || [])
    setAiConversations(ac.data || [])
    setLoading(false)
  }

  // Actions
  async function banUser(id, banned) {
    await supabase.from('profiles').update({ banned: !banned }).eq('id', id)
    fetchAll()
  }

  async function promoteUser(id, role) {
    await supabase.from('profiles').update({ role }).eq('id', id)
    fetchAll()
  }

  async function deleteItem(table, id) {
    if (!confirm('Eintrag wirklich löschen?')) return
    await supabase.from(table).delete().eq('id', id)
    fetchAll()
  }

  async function resetAiUsage(userId) {
    if (!confirm('KI-Verlauf dieses Nutzers wirklich löschen? Das setzt das Fragenlimit zurück.')) return
    await supabase.from('ai_conversations').delete().eq('user_id', userId)
    fetchAll()
  }

  if (!isAdmin) return (
    <div className="container">
      <div className="empty-state">
        <div className="empty-icon">🔒</div>
        <p>{t('admin.noAccess') || 'Kein Zugang'}</p>
      </div>
    </div>
  )

  const stats = {
    totalUsers: users.length,
    premiumUsers: aiProfiles.filter(p => p.is_premium).length,
    totalPosts: posts.length,
    activeMarketplace: marketplaceItems.filter(i => i.active !== false).length,
    activeJobs: jobs.filter(j => j.active !== false).length,
    activeCourses: courses.filter(c => c.active !== false).length,
    totalHousings: marketplaceItems.filter(i => i.category === 'Wohnung').length,
    aiQuestionsTotal: aiConversations.length,
  }

  const sortedByActivity = [...users].sort((a, b) => new Date(b.last_seen || 0) - new Date(a.last_seen || 0))

  const tabs = [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'users', label: `Nutzer (${users.length})` },
    { id: 'activity', label: 'Aktivität' },
    { id: 'moderation', label: 'Moderation' },
    { id: 'payments', label: 'Zahlungen' },
    { id: 'ai', label: 'KI Chat' },
  ]

  return (
    <div className="admin-page">
      <div className="admin-header">
        <h1>Admin Panel</h1>
        <span className="admin-badge">Dienstleistungen</span>
      </div>

      <div className="admin-tabs">
        {tabs.map(tb => (
          <button
            key={tb.id}
            className={`admin-tab ${tab === tb.id ? 'active' : ''}`}
            onClick={() => setTab(tb.id)}
          >{tb.label}</button>
        ))}
      </div>

      {loading ? (
        <div className="admin-loading">Laden...</div>
      ) : (
        <div className="admin-content">
          {tab === 'dashboard' && <DashboardTab stats={stats} />}
          {tab === 'users' && <UsersTab users={users} aiProfiles={aiProfiles} aiConversations={aiConversations} onBan={banUser} onPromote={promoteUser} />}
          {tab === 'moderation' && <ModerationTab posts={posts} marketplace={marketplaceItems} jobs={jobs} courses={courses} onDelete={deleteItem} />}
          {tab === 'payments' && <PaymentsTab users={users} aiProfiles={aiProfiles} aiConversations={aiConversations} />}
          {tab === 'activity' && <ActivityTab users={sortedByActivity} />}
          {tab === 'ai' && <AiTab aiProfiles={aiProfiles} aiConversations={aiConversations} onReset={resetAiUsage} />}
        </div>
      )}
    </div>
  )
}

function DashboardTab({ stats }) {
  return (
    <div className="dashboard-grid">
      <div className="dash-stat">
        <div className="dash-stat-value">{stats.totalUsers}</div>
        <div className="dash-stat-label">Registrierte Nutzer</div>
      </div>
      <div className="dash-stat premium">
        <div className="dash-stat-value">{stats.premiumUsers}</div>
        <div className="dash-stat-label">Premium Nutzer (KI)</div>
      </div>
      <div className="dash-stat">
        <div className="dash-stat-value">{stats.totalPosts}</div>
        <div className="dash-stat-label">Beitraege</div>
      </div>
      <div className="dash-stat">
        <div className="dash-stat-value">{stats.activeMarketplace}</div>
        <div className="dash-stat-label">Marktplatz Anzeigen</div>
      </div>
      <div className="dash-stat">
        <div className="dash-stat-value">{stats.activeJobs}</div>
        <div className="dash-stat-label">Stellenangebote</div>
      </div>
      <div className="dash-stat">
        <div className="dash-stat-value">{stats.activeCourses}</div>
        <div className="dash-stat-label">Kurse</div>
      </div>
      <div className="dash-stat">
        <div className="dash-stat-value">{stats.totalHousings}</div>
        <div className="dash-stat-label">Wohnungen</div>
      </div>
      <div className="dash-stat accent">
        <div className="dash-stat-value">{stats.aiQuestionsTotal}</div>
        <div className="dash-stat-label">KI Fragen gesamt</div>
      </div>
    </div>
  )
}

function UsersTab({ users, aiProfiles, aiConversations, onBan, onPromote }) {
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('all')

  const filtered = users.filter(u => {
    const matchSearch = !search || u.name?.toLowerCase().includes(search.toLowerCase()) || u.username?.toLowerCase().includes(search.toLowerCase())
    const matchRole = roleFilter === 'all' || u.role === roleFilter
    return matchSearch && matchRole
  })

  function getAiProfile(userId) {
    return aiProfiles.find(p => p.user_id === userId)
  }

  function getQuestionCount(userId) {
    return aiConversations.filter(c => c.user_id === userId).length
  }

  return (
    <div className="users-panel">
      <div className="users-toolbar">
        <input
          type="text"
          placeholder="Nutzer suchen..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="admin-search"
        />
        <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)} className="admin-select">
          <option value="all">Alle Rollen</option>
          <option value="admin">Admin</option>
          <option value="moderator">Moderator</option>
          <option value="user">User</option>
        </select>
      </div>

      <div className="users-list">
        {filtered.map(u => {
          const ai = getAiProfile(u.id)
          return (
            <div key={u.id} className={`user-card ${u.banned ? 'banned' : ''}`}>
              <div className="user-card-header">
                <div className="user-avatar">{u.name?.[0]?.toUpperCase() || '?'}</div>
                <div className="user-info">
                  <div className="user-name">{u.name || 'Unbekannt'}</div>
                  <div className="user-meta">@{u.username || '---'}</div>
                </div>
                <div className="user-badges">
                  {u.role === 'admin' && <span className="badge badge-admin">Admin</span>}
                  {u.role === 'moderator' && <span className="badge badge-mod">Mod</span>}
                  {ai?.is_premium && <span className="badge badge-premium">Premium</span>}
                  {u.banned && <span className="badge badge-banned">Gebannt</span>}
                </div>
              </div>
              <div className="user-card-stats">
                {ai && (
                  <span className="user-stat">
                    KI: {getQuestionCount(u.id)}/20 Fragen
                    {ai.is_premium && ' (Premium)'}
                  </span>
                )}
                {u.created_at && (
                  <span className="user-stat">
                    Registriert: {new Date(u.created_at).toLocaleDateString('de-DE')}
                  </span>
                )}
              </div>
              <div className="user-card-actions">
                <button className="admin-btn btn-sm" onClick={() => onBan(u.id, u.banned)}>
                  {u.banned ? 'Entbannen' : 'Bannen'}
                </button>
                {u.role !== 'admin' && (
                  <button className="admin-btn btn-sm btn-primary" onClick={() => onPromote(u.id, 'admin')}>
                    Zu Admin
                  </button>
                )}
                {u.role === 'admin' && (
                  <button className="admin-btn btn-sm btn-secondary" onClick={() => onPromote(u.id, 'user')}>
                    Admin entfernen
                  </button>
                )}
              </div>
            </div>
          )
        })}
        {filtered.length === 0 && <div className="empty-state">Keine Nutzer gefunden</div>}
      </div>
    </div>
  )
}

function ModerationTab({ posts, marketplace, jobs, courses, onDelete }) {
  const [section, setSection] = useState('posts')
  const housings = marketplace.filter(i => i.category === 'Wohnung')

  const sections = [
    { id: 'posts', label: `Beitraege (${posts.length})` },
    { id: 'marketplace', label: `Marktplatz (${marketplace.length})` },
    { id: 'jobs', label: `Jobs (${jobs.length})` },
    { id: 'courses', label: `Kurse (${courses.length})` },
    { id: 'housing', label: `Wohnungen (${housings.length})` },
  ]

  return (
    <div className="moderation-panel">
      <div className="moderation-tabs">
        {sections.map(s => (
          <button
            key={s.id}
            className={`admin-tab ${section === s.id ? 'active' : ''}`}
            onClick={() => setSection(s.id)}
          >{s.label}</button>
        ))}
      </div>

      <div className="moderation-list">
        {section === 'posts' && posts.map(p => (
          <div key={p.id} className="mod-card">
            <div className="mod-card-header">
              <span className="mod-author">{p.profiles?.name || 'Unbekannt'}</span>
              <span className="mod-time">{new Date(p.created_at).toLocaleDateString('de-DE')}</span>
            </div>
            <div className="mod-card-content">{p.content}</div>
            <div className="mod-card-actions">
              <button className="admin-btn btn-sm btn-danger" onClick={() => onDelete('posts', p.id)}>Loeschen</button>
            </div>
          </div>
        ))}

        {section === 'marketplace' && marketplace.map(i => (
          <div key={i.id} className="mod-card">
            <div className="mod-card-header">
              <span className="mod-title">{i.title}</span>
              <span className="mod-author">{i.profiles?.name}</span>
              <span className="mod-time">{new Date(i.created_at).toLocaleDateString('de-DE')}</span>
            </div>
            <div className="mod-card-content">{i.description}</div>
            <div className="mod-card-meta">
              <span className="badge">{i.category}</span>
              {i.price && <span className="mod-price">{i.price} €</span>}
            </div>
            <div className="mod-card-actions">
              <button className="admin-btn btn-sm btn-danger" onClick={() => onDelete('marketplace', i.id)}>Loeschen</button>
            </div>
          </div>
        ))}

        {section === 'jobs' && jobs.map(j => (
          <div key={j.id} className="mod-card">
            <div className="mod-card-header">
              <span className="mod-title">{j.title}</span>
              <span className="mod-author">{j.profiles?.name}</span>
              <span className="mod-time">{new Date(j.created_at).toLocaleDateString('de-DE')}</span>
            </div>
            <div className="mod-card-content">{j.description}</div>
            <div className="mod-card-meta">
              <span className="badge">{j.job_type}</span>
              {j.location && <span className="mod-location">{j.location}</span>}
            </div>
            <div className="mod-card-actions">
              <button className="admin-btn btn-sm btn-danger" onClick={() => onDelete('jobs', j.id)}>Loeschen</button>
            </div>
          </div>
        ))}

        {section === 'courses' && courses.map(c => (
          <div key={c.id} className="mod-card">
            <div className="mod-card-header">
              <span className="mod-title">{c.title}</span>
              <span className="mod-author">{c.profiles?.name}</span>
              <span className="mod-time">{new Date(c.created_at).toLocaleDateString('de-DE')}</span>
            </div>
            <div className="mod-card-content">{c.description}</div>
            <div className="mod-card-meta">
              <span className="badge">{c.category}</span>
            </div>
            <div className="mod-card-actions">
              <button className="admin-btn btn-sm btn-danger" onClick={() => onDelete('courses', c.id)}>Loeschen</button>
            </div>
          </div>
        ))}

        {section === 'housing' && housings.map(h => (
          <div key={h.id} className="mod-card">
            <div className="mod-card-header">
              <span className="mod-title">{h.title}</span>
              <span className="mod-author">{h.profiles?.name}</span>
              <span className="mod-time">{new Date(h.created_at).toLocaleDateString('de-DE')}</span>
            </div>
            <div className="mod-card-content">{h.description}</div>
            <div className="mod-card-meta">
              {h.price > 0 && <span className="mod-price">{h.price} €/Monat</span>}
            </div>
            <div className="mod-card-actions">
              <button className="admin-btn btn-sm btn-danger" onClick={() => onDelete('marketplace', h.id)}>Loeschen</button>
            </div>
          </div>
        ))}

        {((section === 'posts' && posts.length === 0) ||
          (section === 'marketplace' && marketplace.length === 0) ||
          (section === 'jobs' && jobs.length === 0) ||
          (section === 'courses' && courses.length === 0) ||
          (section === 'housing' && housings.length === 0)) && (
          <div className="empty-state">Keine Eintraege</div>
        )}
      </div>
    </div>
  )
}

function PaymentsTab({ users, aiProfiles, aiConversations }) {
  function getQuestionCount(userId) {
    return aiConversations.filter(c => c.user_id === userId).length
  }

  const premiumUsers = users.filter(u => {
    const ai = aiProfiles.find(p => p.user_id === u.id)
    return ai?.is_premium
  })

  const freeUsers = users.filter(u => {
    const ai = aiProfiles.find(p => p.user_id === u.id)
    return !ai?.is_premium
  })

  return (
    <div className="payments-panel">
      <div className="payments-summary">
        <div className="payment-stat">
          <div className="payment-stat-value">{premiumUsers.length}</div>
          <div className="payment-stat-label">Premium Abonnenten</div>
        </div>
        <div className="payment-stat">
          <div className="payment-stat-value">{(premiumUsers.length * 4.99).toFixed(2)} €</div>
          <div className="payment-stat-label">Monatsumsatz</div>
        </div>
        <div className="payment-stat">
          <div className="payment-stat-value">{freeUsers.length}</div>
          <div className="payment-stat-label">Free Tier Nutzer</div>
        </div>
      </div>

      <h3>Premium Abonnenten</h3>
      {premiumUsers.length === 0 ? (
        <div className="empty-state">Noch keine Premium Abonnenten</div>
      ) : (
        <div className="payments-list">
          {premiumUsers.map(u => {
            const ai = aiProfiles.find(p => p.user_id === u.id)
            return (
              <div key={u.id} className="payment-card">
                <div className="payment-card-info">
                  <div className="payment-name">{u.name || 'Unbekannt'}</div>
                  <div className="payment-meta">
                    Premium seit: {ai?.premium_since ? new Date(ai.premium_since).toLocaleDateString('de-DE') : 'Unbekannt'}
                  </div>
                  <div className="payment-meta">
                    KI Fragen: {getQuestionCount(u.id)}
                  </div>
                </div>
                <div className="payment-status premium-active">4.99 €/Monat</div>
              </div>
            )
          })}
        </div>
      )}

      <h3 style={{ marginTop: '24px' }}>Free Tier Nutzer (ueber 20 Fragen)</h3>
      <div className="payments-list">
        {freeUsers.filter(u => getQuestionCount(u.id) >= 15).map(u => {
          const count = getQuestionCount(u.id)
          return (
            <div key={u.id} className="payment-card near-limit">
              <div className="payment-card-info">
                <div className="payment-name">{u.name || 'Unbekannt'}</div>
                <div className="payment-meta">KI Fragen: {count}/20</div>
              </div>
              <div className="payment-status near-limit">
                {count >= 20 ? 'Limit erreicht' : 'Fast am Limit'}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function AiTab({ aiProfiles, aiConversations, onReset }) {
  const [search, setSearch] = useState('')

  const filtered = aiProfiles.filter(p => {
    if (!search) return true
    return p.user_id?.toLowerCase().includes(search.toLowerCase())
  })

  function getQuestionCount(userId) {
    return aiConversations.filter(c => c.user_id === userId).length
  }

  return (
    <div className="ai-panel">
      <div className="ai-toolbar">
        <input
          type="text"
          placeholder="User ID suchen..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="admin-search"
        />
      </div>

      <div className="ai-profiles-list">
        {filtered.map(p => (
          <div key={p.id} className={`ai-profile-card ${p.is_premium ? 'premium' : ''}`}>
            <div className="ai-profile-header">
              <div className="ai-profile-user">User: {p.user_id?.slice(0, 8)}...</div>
              <div className="ai-profile-badges">
                {p.is_premium && <span className="badge badge-premium">Premium</span>}
                {!p.is_premium && <span className="badge badge-free">Free</span>}
                {p.data_consent && <span className="badge badge-consent">DSGVO</span>}
              </div>
            </div>
            <div className="ai-profile-stats">
              <span>Fragen: {getQuestionCount(p.user_id)}/20</span>
              <span>Sprache: {p.language || 'de'}</span>
            </div>
            <div className="ai-profile-actions">
              <button className="admin-btn btn-sm" onClick={() => onReset(p.user_id)}>
                Fragen zuruecksetzen
              </button>
            </div>
          </div>
        ))}
        {filtered.length === 0 && <div className="empty-state">Keine KI Profile gefunden</div>}
      </div>

      <h3 style={{ marginTop: '24px' }}>Letzte Konversationen ({aiConversations.length})</h3>
      <div className="ai-conversations-list">
        {aiConversations.slice(0, 20).map(c => (
          <div key={c.id} className="conversation-card">
            <div className="conv-header">
              <span className="conv-user">{c.user_id?.slice(0, 8)}...</span>
              <span className="conv-time">{new Date(c.created_at).toLocaleString('de-DE')}</span>
            </div>
            <div className="conv-messages">
              <div className="conv-msg user">
                <strong>Du:</strong> {c.message?.slice(0, 150)}{c.message?.length > 150 ? '...' : ''}
              </div>
              <div className="conv-msg assistant">
                <strong>KI:</strong> {c.response?.slice(0, 150)}{c.response?.length > 150 ? '...' : ''}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function ActivityTab({ users }) {
  const formatTime = (iso) => {
    if (!iso) return 'Nie'
    const diff = Date.now() - new Date(iso).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return 'Gerade eben'
    if (mins < 60) return `Vor ${mins} Min.`
    const hours = Math.floor(mins / 60)
    if (hours < 24) return `Vor ${hours} Std.`
    const days = Math.floor(hours / 24)
    if (days < 7) return `Vor ${days} Tagen`
    return new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div className="admin-panel">
      <h2>Wer war auf der App?</h2>
      <p style={{ color: 'var(--text-muted)', marginBottom: '1rem' }}>Alle Nutzer sortiert nach letzter Aktivität</p>
      <div className="activity-list">
        {users.length === 0 ? (
          <p>Keine Nutzer.</p>
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Username</th>
                <th>Rolle</th>
                <th>Registriert</th>
                <th>Letzte Aktivität</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id}>
                  <td><strong>{u.name}</strong></td>
                  <td>@{u.username}</td>
                  <td>{u.role === 'admin' ? '🛡️ Admin' : u.banned ? '🚫 Gebannt' : 'User'}</td>
                  <td>{new Date(u.created_at).toLocaleDateString('de-DE')}</td>
                  <td style={{ color: u.last_seen && Date.now() - new Date(u.last_seen).getTime() < 300000 ? 'var(--success)' : 'inherit' }}>
                    {formatTime(u.last_seen)}
                    {u.last_seen && Date.now() - new Date(u.last_seen).getTime() < 300000 && ' 🟢'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
