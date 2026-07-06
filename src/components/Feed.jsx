import { useState, useEffect, useRef, useCallback } from 'react'
import { Heart, MessageCircle, Play } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import './Feed.css'

const PAGE_SIZE = 10

export default function Feed() {
  const { user } = useAuth()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const loaderRef = useRef(null)

  useEffect(() => { fetchInitial() }, [])

  async function fetchInitial() {
    setLoading(true)
    const [postsRes, videosRes] = await Promise.all([
      supabase.from('posts').select('*, profiles(name, username)').order('created_at', { ascending: false }).limit(PAGE_SIZE),
      supabase.from('videos').select('*, profiles(name, username)').order('created_at', { ascending: false }).limit(PAGE_SIZE)
    ])

    const posts = (postsRes.data || []).map(p => ({ ...p, _type: 'post' }))
    const videos = (videosRes.data || []).map(v => ({ ...v, _type: 'video' }))

    const all = [...posts, ...videos].sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    setItems(all.slice(0, PAGE_SIZE))
    setHasMore(all.length > PAGE_SIZE)
    setLoading(false)
  }

  const fetchMore = useCallback(async () => {
    if (loadingMore || !hasMore) return
    setLoadingMore(true)

    const lastItem = items[items.length - 1]
    if (!lastItem) { setLoadingMore(false); return }

    const lastDate = lastItem.created_at

    const [postsRes, videosRes] = await Promise.all([
      supabase.from('posts').select('*, profiles(name, username)').order('created_at', { ascending: false }).lt('created_at', lastDate).limit(PAGE_SIZE),
      supabase.from('videos').select('*, profiles(name, username)').order('created_at', { ascending: false }).lt('created_at', lastDate).limit(PAGE_SIZE)
    ])

    const posts = (postsRes.data || []).map(p => ({ ...p, _type: 'post' }))
    const videos = (videosRes.data || []).map(v => ({ ...v, _type: 'video' }))

    const all = [...posts, ...videos].sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    const newItems = all.slice(0, PAGE_SIZE)

    if (newItems.length < PAGE_SIZE) setHasMore(false)
    setItems(prev => [...prev, ...newItems])
    setLoadingMore(false)
  }, [items, loadingMore, hasMore])

  useEffect(() => {
    if (!loaderRef.current) return
    const observer = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting) fetchMore()
    }, { threshold: 0.1 })
    observer.observe(loaderRef.current)
    return () => observer.disconnect()
  }, [fetchMore])

  if (loading) {
    return <div className="feed-loading">Laden...</div>
  }

  if (items.length === 0) {
    return <div className="feed-empty">Noch keine Beiträge vorhanden.</div>
  }

  return (
    <div className="feed">
      {items.map((item) => (
        item._type === 'video'
          ? <VideoCard key={'v-' + item.id} video={item} currentUserId={user?.id} />
          : <FeedCard key={'p-' + item.id} post={item} currentUserId={user?.id} />
      ))}
      <div ref={loaderRef} className="feed-loader">
        {loadingMore && <span>Laden...</span>}
        {!hasMore && items.length > 0 && <span>Keine weiteren Beiträge</span>}
      </div>
    </div>
  )
}

function VideoCard({ video, currentUserId }) {
  const [showLoginPrompt, setShowLoginPrompt] = useState(false)
  const profile = video.profiles

  return (
    <div className="feed-card">
      <div className="feed-card-header">
        <div>
          <span className="feed-card-author">{profile?.name || 'Unbekannt'}</span>
          <span className="feed-card-username">@{profile?.username}</span>
        </div>
        <span className="feed-card-time">
          {new Date(video.created_at).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>

      {video.caption && (
        <div className="feed-card-body">
          <p>{video.caption}</p>
        </div>
      )}

      <div className="feed-card-media feed-card-video">
        <video src={video.video_url} preload="metadata" controls />
      </div>

      <div className="feed-card-actions">
        <span className="feed-reaction-btn" style={{ cursor: 'default' }}>
          <Play size={16} />
          <span>Video</span>
        </span>
      </div>
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
