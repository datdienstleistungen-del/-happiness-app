import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { useLanguage } from '../i18n/translations.jsx'
import VideoUpload from '../components/VideoUpload.jsx'
import VideoFeed from '../components/VideoFeed.jsx'

export default function CommunityPage() {
  const { user, profile } = useAuth()
  const { t } = useLanguage()
  const [tab, setTab] = useState('posts')
  const [posts, setPosts] = useState([])
  const [newPost, setNewPost] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => { fetchPosts() }, [])

  async function fetchPosts() {
    const { data } = await supabase
      .from('posts')
      .select('*, profiles(name, username)')
      .order('created_at', { ascending: false })
    setPosts(data || [])
    setLoading(false)
  }

  async function handlePost() {
    if (!newPost.trim()) return
    await supabase.from('posts').insert({
      user_id: user.id,
      content: newPost.trim(),
    })
    setNewPost('')
    fetchPosts()
  }

  async function handleLike(postId) {
    const existing = await supabase
      .from('likes')
      .select('*')
      .eq('post_id', postId)
      .eq('user_id', user.id)
      .single()

    if (existing.data) {
      await supabase.from('likes').delete().eq('id', existing.data.id)
    } else {
      await supabase.from('likes').insert({ post_id: postId, user_id: user.id })
    }
    fetchPosts()
  }

  return (
    <div className="container">
      <div className="page-header">
        <h1>💬 {t('community.title')}</h1>
        <p>{t('community.share')}</p>
      </div>

      <div className="tabs">
        <button className={`tab ${tab === 'posts' ? 'active' : ''}`} onClick={() => setTab('posts')}>
          📝 {t('community.title')}
        </button>
        <button className={`tab ${tab === 'videos' ? 'active' : ''}`} onClick={() => setTab('videos')}>
          🎬 {t('video.title')}
        </button>
      </div>

      {tab === 'posts' && (
        <>
          <div className="card">
            <textarea
              className="form-input"
              placeholder={t('community.placeholder')}
              value={newPost}
              onChange={(e) => setNewPost(e.target.value)}
              rows={3}
            />
            <div style={{ marginTop: '0.75rem', textAlign: 'right' }}>
              <button className="btn btn-primary" onClick={handlePost} disabled={!newPost.trim()}>
                {t('community.post')}
              </button>
            </div>
          </div>

          {loading ? (
            <p style={{ textAlign: 'center', color: 'var(--text-muted)' }}>Laden...</p>
          ) : posts.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">💬</div>
              <p>{t('community.noPosts')}</p>
            </div>
          ) : (
            posts.map((post) => (
              <PostCard key={post.id} post={post} currentUserId={user.id} onLike={handleLike} />
            ))
          )}
        </>
      )}

      {tab === 'videos' && (
        <>
          <VideoUpload onUploadComplete={() => {}} />
          <div style={{ marginTop: '1.5rem' }}>
            <VideoFeed />
          </div>
        </>
      )}
    </div>
  )
}

function PostCard({ post, currentUserId, onLike }) {
  const [likes, setLikes] = useState([])
  const [comments, setComments] = useState([])
  const [commentText, setCommentText] = useState('')
  const [showComments, setShowComments] = useState(false)
  const { t } = useLanguage()

  useEffect(() => { fetchInteractions() }, [post.id])

  async function fetchInteractions() {
    const { data: likesData } = await supabase.from('likes').select('*').eq('post_id', post.id)
    setLikes(likesData || [])

    const { data: commentsData } = await supabase
      .from('comments')
      .select('*, profiles(name, username)')
      .eq('post_id', post.id)
      .order('created_at', { ascending: true })
    setComments(commentsData || [])
  }

  async function addComment() {
    if (!commentText.trim()) return
    await supabase.from('comments').insert({
      post_id: post.id,
      user_id: currentUserId,
      content: commentText.trim(),
    })
    setCommentText('')
    fetchInteractions()
  }

  const isLiked = likes.some((l) => l.user_id === currentUserId)
  const profile = post.profiles

  return (
    <div className="card">
      <div className="card-header">
        <div>
          <span className="card-author">{profile?.name || 'Unbekannt'}</span>
          <span className="card-time" style={{ marginLeft: '0.5rem' }}>@{profile?.username}</span>
        </div>
        <span className="card-time">
          {new Date(post.created_at).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>
      <div className="card-body">
        <p>{post.content}</p>
      </div>
      <div className="card-actions">
        <button
          className={`btn btn-sm ${isLiked ? 'btn-primary' : 'btn-outline'}`}
          onClick={() => onLike(post.id)}
        >
          {isLiked ? '❤️' : '🤍'} {likes.length}
        </button>
        <button
          className="btn btn-sm btn-outline"
          onClick={() => setShowComments(!showComments)}
        >
          💬 {comments.length}
        </button>
      </div>

      {showComments && (
        <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--border)' }}>
          {comments.map((c) => (
            <div key={c.id} style={{ marginBottom: '0.5rem' }}>
              <strong style={{ color: 'var(--primary-light)' }}>{c.profiles?.name}</strong>{' '}
              <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                {new Date(c.created_at).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
              </span>
              <p style={{ fontSize: '0.9rem' }}>{c.content}</p>
            </div>
          ))}
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
            <input
              className="form-input"
              placeholder={t('community.comment')}
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addComment()}
            />
            <button className="btn btn-primary btn-sm" onClick={addComment}>{t('community.send')}</button>
          </div>
        </div>
      )}
    </div>
  )
}
