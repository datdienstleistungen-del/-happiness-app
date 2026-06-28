import { useState, useEffect } from 'react'
import { useAuth } from '../App'
import { supabase } from '../lib/supabase'

export default function ProfilePage() {
  const { user, profile, fetchProfile } = useAuth()
  const [tab, setTab] = useState('profile')
  const [form, setForm] = useState({ name: '', username: '', bio: '', avatar_url: '' })
  const [pwForm, setPwForm] = useState({ newPw: '', newPw2: '' })
  const [posts, setPosts] = useState([])
  const [msg, setMsg] = useState('')

  useEffect(() => {
    if (profile) {
      setForm({ name: profile.name || '', username: profile.username || '', bio: profile.bio || '', avatar_url: profile.avatar_url || '' })
      fetchPosts()
    }
  }, [profile])

  async function fetchPosts() {
    const { data } = await supabase.from('posts').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(10)
    setPosts(data || [])
  }

  async function handleSave() {
    setMsg('')
    if (!form.name.trim() || !form.username.trim()) { setMsg('Name und Benutzername sind Pflicht.'); return }

    const { data: existing } = await supabase.from('profiles').select('id').eq('username', form.username.trim()).neq('id', user.id).single()
    if (existing) { setMsg('Benutzername bereits vergeben.'); return }

    await supabase.from('profiles').update({ name: form.name.trim(), username: form.username.trim(), bio: form.bio.trim(), avatar_url: form.avatar_url.trim() }).eq('id', user.id)
    fetchProfile(user.id)
    setMsg('Profil gespeichert!')
  }

  async function handleChangePw() {
    setMsg('')
    if (pwForm.newPw !== pwForm.newPw2) { setMsg('Passwörter stimmen nicht überein.'); return }
    if (pwForm.newPw.length < 6) { setMsg('Passwort muss mindestens 6 Zeichen lang sein.'); return }
    const { error } = await supabase.auth.updateUser({ password: pwForm.newPw })
    if (error) setMsg(error.message)
    else { setMsg('Passwort geändert!'); setPwForm({ newPw: '', newPw2: '' }) }
  }

  return (
    <div className="container">
      <div className="page-header"><h1>👤 Profil</h1></div>

      <div className="tabs">
        <button className={`tab ${tab === 'profile' ? 'active' : ''}`} onClick={() => setTab('profile')}>Profil</button>
        <button className={`tab ${tab === 'settings' ? 'active' : ''}`} onClick={() => setTab('settings')}>Einstellungen</button>
      </div>

      {tab === 'profile' && profile && (
        <div className="card">
          <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'flex-start' }}>
            <div className="list-item-avatar" style={{ width: 80, height: 80, fontSize: '2rem' }}>
              {profile.avatar_url ? <img src={profile.avatar_url} alt="" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} /> : profile.name?.[0]?.toUpperCase()}
            </div>
            <div style={{ flex: 1 }}>
              <h2>{profile.name}</h2>
              <p style={{ color: 'var(--text-muted)' }}>@{profile.username}</p>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{user.email}</p>
              {profile.bio && <p style={{ marginTop: '0.75rem' }}>{profile.bio}</p>}
            </div>
          </div>
          <div style={{ marginTop: '1.5rem', borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
            <h3>Deine Beiträge</h3>
            {posts.length === 0 ? <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Noch keine Beiträge.</p> : posts.map(p => (
              <div key={p.id} style={{ padding: '0.75rem 0', borderBottom: '1px solid var(--border)' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{new Date(p.created_at).toLocaleDateString('de-DE')}</span>
                <p>{p.content}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'settings' && (
        <>
          <div className="card">
            <h3 style={{ marginBottom: '1rem' }}>Profil bearbeiten</h3>
            <div className="form-group"><label>Name</label><input className="form-input" value={form.name} onChange={e => setForm({...form, name: e.target.value})} /></div>
            <div className="form-group"><label>Benutzername</label><input className="form-input" value={form.username} onChange={e => setForm({...form, username: e.target.value})} /></div>
            <div className="form-group"><label>Über mich</label><textarea className="form-input" value={form.bio} onChange={e => setForm({...form, bio: e.target.value})} /></div>
            <div className="form-group"><label>Avatar-URL</label><input className="form-input" value={form.avatar_url} onChange={e => setForm({...form, avatar_url: e.target.value})} /></div>
            <button className="btn btn-primary" onClick={handleSave}>Speichern</button>
          </div>

          <div className="card">
            <h3 style={{ marginBottom: '1rem' }}>Passwort ändern</h3>
            <div className="form-group"><label>Neues Passwort</label><input type="password" className="form-input" value={pwForm.newPw} onChange={e => setPwForm({...pwForm, newPw: e.target.value})} /></div>
            <div className="form-group"><label>Neues Passwort wiederholen</label><input type="password" className="form-input" value={pwForm.newPw2} onChange={e => setPwForm({...pwForm, newPw2: e.target.value})} /></div>
            <button className="btn btn-primary" onClick={handleChangePw}>Passwort ändern</button>
          </div>
        </>
      )}

      {msg && <p style={{ marginTop: '1rem', color: msg.includes('gespeichert') || msg.includes('geändert') ? 'var(--success)' : 'var(--danger)' }}>{msg}</p>}
    </div>
  )
}
