import { useState, useEffect, useRef, useCallback } from 'react'
import { Heart, MessageCircle, Play, Send, X } from 'lucide-react'
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
    return (
      <div className="feed-loader">
        <div className="feed-loader-dot" />
        <div className="feed-loader-dot" />
        <div className="feed-loader-dot" />
      </div>
    )
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
        {loadingMore && (
          <>
            <div className="feed-loader-dot" />
            <div className="feed-loader-dot" />
            <div className="feed-loader-dot" />
          </>
        )}
        {!hasMore && items.length > 0 && <span>Keine weiteren Beiträge</span>}
      </div>
    </div>
  )
}

function getInitials(name) {
  if (!name) return '?'
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
}

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Gerade eben'
  if (mins < 60) return mins + ' Min.'
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return hrs + ' Std.'
  const days = Math.floor(hrs / 24)
  if (days < 7) return days + ' T.'
  return new Date(dateStr).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' })
}

function CommentSection({ postId, videoId, currentUserId }) {
  const [comments, setComments] = useState([])
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)
  const inputRef = useRef(null)

  const isVideo = !!videoId
  const filterKey = isVideo ? 'video_id' : 'post_id'
  const filterId = isVideo ? videoId : postId

  useEffect(() => { fetchComments() }, [filterId])

  async function fetchComments() {
    const { data } = await supabase
      .from(isVideo ? 'video_comments' : 'comments')
      .select('*, profiles(name, username)')
      .eq(filterKey, filterId)
      .order('created_at', { ascending: true })
    setComments(data || [])
  }

  async function addComment() {
    if (!text.trim() || !currentUserId) return
    setLoading(true)
    const row = { user_id: currentUserId, content: text.trim() }
    row[filterKey] = filterId
    await supabase.from(isVideo ? 'video_comments' : 'comments').insert(row)
    setText('')
    await fetchComments()
    setLoading(false)
    inputRef.current?.focus()
  }

  return (
    <div className="feed-comments">
      {comments.length > 0 && (
        <div className="feed-comments-list">
          {comments.map(c => (
            <div key={c.id} className="feed-comment">
              <div className="feed-comment-avatar">{getInitials(c.profiles?.name)}</div>
              <div className="feed-comment-body">
                <span className="feed-comment-author">{c.profiles?.name || 'Unbekannt'}</span>
                <span className="feed-comment-text">{c.content}</span>
                <span className="feed-comment-time">{timeAgo(c.created_at)}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {currentUserId ? (
        <div className="feed-comment-input">
          <input
            ref={inputRef}
            type="text"
            placeholder="Kommentar schreiben..."
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addComment()}
            disabled={loading}
          />
          <button onClick={addComment} disabled={!text.trim() || loading}>
            <Send size={16} />
          </button>
        </div>
      ) : (
        <div className="feed-comment-login">
          <a href="/login">Anmelden</a> zum Kommentieren
        </div>
      )}
    </div>
  )
}

function VideoCard({ video, currentUserId }) {
  const profile = video.profiles
  const [showComments, setShowComments] = useState(false)
  const [commentCount, setCommentCount] = useState(0)
  const [likes, setLikes] = useState([])
  const [showLoginPrompt, setShowLoginPrompt] = useState(false)
  const videoRef = useRef(null)
  const cardRef = useRef(null)
  const [isMuted, setIsMuted] = useState(true)
  const [isPlaying, setIsPlaying] = useState(false)

  useEffect(() => { fetchCommentCount(); fetchLikes() }, [video.id])

  useEffect(() => {
    if (!cardRef.current) return
    const observer = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting) {
        videoRef.current?.play().catch(() => {})
        setIsPlaying(true)
      } else {
        videoRef.current?.pause()
        setIsPlaying(false)
      }
    }, { threshold: 0.6 })
    observer.observe(cardRef.current)
    return () => observer.disconnect()
  }, [])

  async function fetchCommentCount() {
    const { count } = await supabase.from('video_comments').select('*', { count: 'exact', head: true }).eq('video_id', video.id)
    setCommentCount(count || 0)
  }

  async function fetchLikes() {
    const { data } = await supabase.from('video_likes').select('*').eq('video_id', video.id)
    setLikes(data || [])
  }

  async function toggleLike() {
    if (!currentUserId) { setShowLoginPrompt(true); return }
    const existing = likes.find(l => l.user_id === currentUserId)
    if (existing) {
      await supabase.from('video_likes').delete().eq('id', existing.id)
    } else {
      await supabase.from('video_likes').insert({ video_id: video.id, user_id: currentUserId })
    }
    fetchLikes()
  }

  const isLiked = likes.some(l => l.user_id === currentUserId)

  function togglePlay() {
    if (!videoRef.current) return
    if (videoRef.current.paused) {
      videoRef.current.play()
      setIsPlaying(true)
    } else {
      videoRef.current.pause()
      setIsPlaying(false)
    }
  }

  return (
    <div className="feed-card" ref={cardRef}>
      <div className="feed-card-header">
        <div className="feed-card-avatar">{getInitials(profile?.name)}</div>
        <div className="feed-card-meta">
          <span className="feed-card-author">{profile?.name || 'Unbekannt'}</span>
          <span className="feed-card-username">@{profile?.username} · {timeAgo(video.created_at)}</span>
        </div>
      </div>

      {video.caption && (
        <div className="feed-card-body">
          <p>{video.caption}</p>
        </div>
      )}

      <div className="feed-card-media feed-card-video" onClick={togglePlay} style={{ cursor: 'pointer', position: 'relative' }}>
        <video ref={videoRef} src={video.video_url} muted={isMuted} loop playsInline preload="metadata" style={{ width: '100%', maxHeight: '600px', objectFit: 'contain', background: '#000' }} />
        {!isPlaying && (
          <div className="feed-card-play"><Play size={36} /></div>
        )}
        <button onClick={(e) => { e.stopPropagation(); setIsMuted(!isMuted) }} style={{ position: 'absolute', bottom: 12, right: 12, background: 'rgba(0,0,0,0.6)', color: '#fff', border: 'none', borderRadius: 20, padding: '6px 10px', fontSize: '0.75rem', cursor: 'pointer' }}>
          {isMuted ? '🔇' : '🔊'}
        </button>
      </div>

      {(likes.length > 0 || commentCount > 0) && (
        <div className="feed-card-counts">
          {likes.length > 0 && <span><Heart size={14} fill="var(--color-koralle)" stroke="var(--color-koralle)" /> {likes.length}</span>}
          {commentCount > 0 && <span>{commentCount} Kommentar{commentCount !== 1 ? 'e' : ''}</span>}
        </div>
      )}

      <div className="feed-card-divider" />

      <div className="feed-card-actions">
        <button className={`feed-action-btn ${isLiked ? 'reacted' : ''}`} onClick={toggleLike}>
          <Heart size={17} fill={isLiked ? 'var(--color-koralle)' : 'none'} />
          <span>Gefällt mir</span>
        </button>
        <button className="feed-action-btn" onClick={() => setShowComments(!showComments)}>
          <MessageCircle size={17} />
          <span>Kommentieren</span>
        </button>
      </div>

      {showComments && (
        <CommentSection videoId={video.id} currentUserId={currentUserId} />
      )}

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

function FeedCard({ post, currentUserId }) {
  const [reactions, setReactions] = useState([])
  const [commentCount, setCommentCount] = useState(0)
  const [showComments, setShowComments] = useState(false)
  const [showLoginPrompt, setShowLoginPrompt] = useState(false)

  useEffect(() => { fetchReactions(); fetchComments() }, [post.id])

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

  async function fetchComments() {
    const { count } = await supabase.from('comments').select('*', { count: 'exact', head: true }).eq('post_id', post.id)
    setCommentCount(count || 0)
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
        <div className="feed-card-avatar">{getInitials(profile?.name)}</div>
        <div className="feed-card-meta">
          <span className="feed-card-author">{profile?.name || 'Unbekannt'}</span>
          <span className="feed-card-username">@{profile?.username} · {timeAgo(post.created_at)}</span>
        </div>
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
          <div className="feed-card-play"><Play size={28} /></div>
        </div>
      )}

      {(reactions.length > 0 || commentCount > 0) && (
        <div className="feed-card-counts">
          {reactions.length > 0 && <span>{reactions.length} Gefällt</span>}
          {commentCount > 0 && <span>{commentCount} Kommentar{commentCount !== 1 ? 'e' : ''}</span>}
        </div>
      )}

      <div className="feed-card-divider" />

      <div className="feed-card-actions">
        <button
          className={`feed-action-btn ${hasReacted ? 'reacted' : ''}`}
          onClick={toggleReaction}
        >
          <Heart size={17} fill={hasReacted ? 'var(--color-koralle)' : 'none'} />
          <span>Gefällt mir</span>
        </button>
        <button
          className={`feed-action-btn ${showComments ? 'reacted' : ''}`}
          onClick={() => setShowComments(!showComments)}
        >
          <MessageCircle size={17} />
          <span>Kommentieren</span>
        </button>
      </div>

      {showComments && (
        <CommentSection postId={post.id} currentUserId={currentUserId} />
      )}

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
