import { useState, useEffect } from 'react'
import { Heart, MessageCircle, Play } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import './Feed.css'

export default function Feed() {
  const { user } = useAuth()
  const [posts, setPosts] = useState([])
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

  if (loading) {
    return <div className="feed-loading">Laden...</div>
  }

  if (posts.length === 0) {
    return <div className="feed-empty">Noch keine Beiträge vorhanden.</div>
  }

  return (
    <div className="feed">
      {posts.map((post) => (
        <FeedCard key={post.id} post={post} currentUserId={user?.id} />
      ))}
    </div>
  )
}

function FeedCard({ post, currentUserId }) {
  const [reactions, setReactions] = useState([])
  const [showLoginPrompt, setShowLoginPrompt] = useState(false)

  useEffect(() => { fetchReactions() }, [post.id])

  useEffect(() => {
    const channel = supabase
      .channel('feed-reactions-' + post.id)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reactions', filter: `post_id=eq.${post.id}` }, () => {
        fetchReactions()
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [post.id])

  async function fetchReactions() {
    const { data } = await supabase.from('reactions').select('*').eq('post_id', post.id)
    setReactions(data || [])
  }

  async function toggleReaction() {
    if (!currentUserId) {
      setShowLoginPrompt(true)
      return
    }
    const existing = reactions.find((r) => r.user_id === currentUserId)
    if (existing) {
      await supabase.from('reactions').delete().eq('id', existing.id)
    } else {
      await supabase.from('reactions').insert({ post_id: post.id, user_id: currentUserId, type: 'like' })
    }
    fetchReactions()
  }

  const hasReacted = reactions.some((r) => r.user_id === currentUserId)
  const profile = post.profiles
  const isVideo = post.image_url && /\.(mp4|webm|ogg|mov)$/i.test(post.image_url)
  const isImage = post.image_url && !isVideo

  return (
    <div className="feed-card">
      <div className="feed-card-header">
        <div>
          <span className="feed-card-author">{profile?.name || 'Unbekannt'}</span>
          <span className="feed-card-username">@{profile?.username}</span>
        </div>
        <span className="feed-card-time">
          {new Date(post.created_at).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>

      {post.content && (
        <div className="feed-card-body">
          <p>{post.content}</p>
        </div>
      )}

      {isImage && (
        <div className="feed-card-media">
          <img src={post.image_url} alt="" />
        </div>
      )}

      {isVideo && (
        <div className="feed-card-media feed-card-video">
          <video src={post.image_url} preload="metadata" />
          <div className="feed-card-play"><Play size={32} /></div>
        </div>
      )}

      <div className="feed-card-actions">
        <button
          className={`feed-reaction-btn ${hasReacted ? 'reacted' : ''}`}
          onClick={toggleReaction}
        >
          <Heart size={16} fill={hasReacted ? 'var(--color-koralle)' : 'none'} />
          <span>{reactions.length}</span>
        </button>
      </div>

      {showLoginPrompt && (
        <div className="feed-login-prompt">
          <p>Melde dich an, um zu reagieren.</p>
          <a href="/login" className="btn btn-primary btn-sm">Anmelden</a>
          <button className="btn btn-outline btn-sm" onClick={() => setShowLoginPrompt(false)}>Schliessen</button>
        </div>
      )}
    </div>
  )
}
