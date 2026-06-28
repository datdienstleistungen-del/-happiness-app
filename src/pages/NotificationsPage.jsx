import { useState, useEffect } from 'react'
import { useAuth } from '../App'
import { supabase } from '../lib/supabase'
import { useLanguage } from '../i18n/translations.jsx'

export default function NotificationsPage() {
  const { user } = useAuth()
  const { t } = useLanguage()
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { fetchNotifications() }, [])

  async function fetchNotifications() {
    const { data } = await supabase.from('notifications').select('*').eq('user_id', user.id).order('created_at', { ascending: false })
    setNotifications(data || [])
    setLoading(false)
  }

  async function markAllRead() {
    await supabase.from('notifications').update({ read: true }).eq('user_id', user.id).eq('read', false)
    fetchNotifications()
  }

  async function markRead(id) {
    await supabase.from('notifications').update({ read: true }).eq('id', id)
    fetchNotifications()
  }

  const unreadCount = notifications.filter(n => !n.read).length

  return (
    <div className="container">
      <div className="page-header">
        <h1>🔔 {t('notifications.title')}</h1>
        {unreadCount > 0 && <button className="btn btn-sm btn-outline" onClick={markAllRead} style={{ marginTop: '0.5rem' }}>{t('notifications.markAll')}</button>}
      </div>

      {loading ? <p style={{ textAlign: 'center', color: 'var(--text-muted)' }}>Laden...</p> : notifications.length === 0 ? (
        <div className="empty-state"><div className="empty-icon">🔔</div><p>{t('notifications.none')}</p></div>
      ) : (
        notifications.map(n => (
          <div key={n.id} className="card" style={{ borderLeftColor: n.read ? 'var(--border)' : 'var(--primary)', borderLeftWidth: '3px' }}>
            <div className="card-header">
              <p>{n.content}</p>
              <span className="card-time">{new Date(n.created_at).toLocaleString('de-DE')}</span>
            </div>
            {!n.read && (
              <button className="btn btn-sm btn-outline" onClick={() => markRead(n.id)}>{t('notifications.markRead')}</button>
            )}
          </div>
        ))
      )}
    </div>
  )
}
