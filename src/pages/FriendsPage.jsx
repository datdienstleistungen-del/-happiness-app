import { useState, useEffect } from 'react'
import { useAuth } from '../App'
import { supabase } from '../lib/supabase'
import { useLanguage } from '../i18n/translations.jsx'

export default function FriendsPage() {
  const { user, profile } = useAuth()
  const { t } = useLanguage()
  const [tab, setTab] = useState('friends')
  const [friends, setFriends] = useState([])
  const [requests, setRequests] = useState([])
  const [search, setSearch] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { fetchData() }, [])

  async function fetchData() {
    const { data: friendships } = await supabase
      .from('friendships')
      .select('*')
      .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`)

    const friendIds = (friendships || [])
      .filter(f => f.status === 'accepted')
      .map(f => f.user1_id === user.id ? f.user2_id : f.user1_id)

    const pendingIncoming = (friendships || [])
      .filter(f => f.status === 'pending' && f.user2_id === user.id)
      .map(f => ({ ...f, requester_id: f.user1_id }))

    if (friendIds.length > 0) {
      const { data: friendProfiles } = await supabase
        .from('profiles')
        .select('*')
        .in('id', friendIds)
      setFriends(friendProfiles || [])
    } else {
      setFriends([])
    }

    if (pendingIncoming.length > 0) {
      const requesterIds = pendingIncoming.map(r => r.requester_id)
      const { data: requesterProfiles } = await supabase
        .from('profiles')
        .select('*')
        .in('id', requesterIds)
      setRequests(pendingIncoming.map((r, i) => ({ ...r, profile: requesterProfiles?.[i] })))
    } else {
      setRequests([])
    }

    setLoading(false)
  }

  async function handleSearch() {
    if (!search.trim()) { setSearchResults([]); return }
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .neq('id', user.id)
      .or(`name.ilike.%${search}%,username.ilike.%${search}%`)
    setSearchResults(data || [])
  }

  async function sendRequest(targetId) {
    await supabase.from('friendships').insert({
      user1_id: user.id,
      user2_id: targetId,
      status: 'pending',
    })
    await supabase.from('notifications').insert({
      user_id: targetId,
      content: `${profile.name} möchte Freund mit dir werden!`,
      type: 'friend_request',
    })
    handleSearch()
  }

  async function acceptRequest(friendshipId) {
    await supabase.from('friendships').update({ status: 'accepted' }).eq('id', friendshipId)
    fetchData()
  }

  async function declineRequest(friendshipId) {
    await supabase.from('friendships').delete().eq('id', friendshipId)
    fetchData()
  }

  async function removeFriend(friendId) {
    await supabase.from('friendships')
      .delete()
      .or(`and(user1_id.eq.${user.id},user2_id.eq.${friendId}),and(user1_id.eq.${friendId},user2_id.eq.${user.id})`)
    fetchData()
  }

  return (
    <div className="container">
      <div className="page-header">
        <h1>👥 {t('friends.title')}</h1>
      </div>

      <div className="tabs">
        <button className={`tab ${tab === 'friends' ? 'active' : ''}`} onClick={() => setTab('friends')}>
          {t('friends.yourFriends')} ({friends.length})
        </button>
        <button className={`tab ${tab === 'requests' ? 'active' : ''}`} onClick={() => setTab('requests')}>
          {t('friends.requests')} ({requests.length})
        </button>
        <button className={`tab ${tab === 'search' ? 'active' : ''}`} onClick={() => setTab('search')}>
          {t('friends.findUsers')}
        </button>
      </div>

      {loading ? <p style={{ textAlign: 'center', color: 'var(--text-muted)' }}>Laden...</p> : (
        <>
          {tab === 'friends' && (
            friends.length === 0 ? (
              <div className="empty-state"><div className="empty-icon">👥</div><p>{t('friends.noFriends')}</p></div>
            ) : friends.map(f => (
              <div key={f.id} className="list-item">
                <div className="list-item-info">
                  <div className="list-item-avatar">{f.name?.[0]?.toUpperCase() || '?'}</div>
                  <div>
                    <strong>{f.name}</strong>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>@{f.username}</div>
                  </div>
                </div>
                <div className="list-item-actions">
                  <button className="btn btn-sm btn-danger" onClick={() => removeFriend(f.id)}>{t('friends.remove')}</button>
                </div>
              </div>
            ))
          )}

          {tab === 'requests' && (
            requests.length === 0 ? (
              <div className="empty-state"><div className="empty-icon">📩</div><p>{t('friends.noRequests')}</p></div>
            ) : requests.map(r => (
              <div key={r.id} className="list-item">
                <div className="list-item-info">
                  <div className="list-item-avatar">{r.profile?.name?.[0]?.toUpperCase() || '?'}</div>
                  <div>
                    <strong>{r.profile?.name}</strong>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>@{r.profile?.username} möchte Freund werden</div>
                  </div>
                </div>
                <div className="list-item-actions">
                  <button className="btn btn-sm btn-primary" onClick={() => acceptRequest(r.id)}>✓ {t('friends.accept')}</button>
                  <button className="btn btn-sm btn-outline" onClick={() => declineRequest(r.id)}>✗ {t('friends.decline')}</button>
                </div>
              </div>
            ))
          )}

          {tab === 'search' && (
            <>
              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
                <input
                  className="form-input"
                  placeholder={t('friends.search')}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                />
                <button className="btn btn-primary" onClick={handleSearch}>Suchen</button>
              </div>
              {searchResults.map(u => (
                <div key={u.id} className="list-item">
                  <div className="list-item-info">
                    <div className="list-item-avatar">{u.name?.[0]?.toUpperCase() || '?'}</div>
                    <div>
                      <strong>{u.name}</strong>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>@{u.username}</div>
                    </div>
                  </div>
                  <div className="list-item-actions">
                    <button className="btn btn-sm btn-primary" onClick={() => sendRequest(u.id)}>
                      {t('friends.sendRequest')}
                    </button>
                  </div>
                </div>
              ))}
            </>
          )}
        </>
      )}
    </div>
  )
}
