import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../App'
import { useLanguage } from '../i18n/translations.jsx'

export default function VideoFeed() {
  const { user } = useAuth()
  const { t } = useLanguage()
  const [videos, setVideos] = useState([])
  const [loading, setLoading] = useState(true)
  const [currentVideo, setCurrentVideo] = useState(0)
  const containerRef = useRef(null)

  useEffect(() => { fetchVideos() }, [])

  async function fetchVideos() {
    const { data } = await supabase
      .from('videos')
      .select('*, profiles(name, username, avatar_url)')
      .order('created_at', { ascending: false })
      .limit(20)
    setVideos(data || [])
    setLoading(false)
  }

  async function handleLike(videoId) {
    const existing = await supabase
      .from('video_likes')
      .select('*')
      .eq('video_id', videoId)
      .eq('user_id', user.id)
      .single()

    if (existing.data) {
      await supabase.from('video_likes').delete().eq('id', existing.data.id)
    } else {
      await supabase.from('video_likes').insert({ video_id: videoId, user_id: user.id })
    }
    fetchVideos()
  }

  async function handleDelete(videoId) {
    if (!confirm('Video wirklich löschen?')) return
    await supabase.from('videos').delete().eq('id', videoId)
    fetchVideos()
  }

  function formatTime(date) {
    const now = new Date()
    const diff = now - new Date(date)
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)
    const days = Math.floor(diff / 86400000)

    if (minutes < 1) return t('time.justNow')
    if (minutes < 60) return `${minutes} ${t('time.minutes')}`
    if (hours < 24) return `${hours} ${t('time.hours')}`
    return `${days} ${t('time.days')}`
  }

  if (loading) {
    return <p style={{ textAlign: 'center', color: 'var(--text-muted)' }}>Laden...</p>
  }

  if (videos.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-icon">🎬</div>
        <p>{t('video.noVideos')}</p>
      </div>
    )
  }

  return (
    <div ref={containerRef} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {videos.map((video) => (
        <VideoCard
          key={video.id}
          video={video}
          currentUserId={user.id}
          onLike={handleLike}
          onDelete={handleDelete}
          formatTime={formatTime}
          t={t}
        />
      ))}
    </div>
  )
}

function VideoCard({ video, currentUserId, onLike, onDelete, formatTime, t }) {
  const [likes, setLikes] = useState([])
  const [showComments, setShowComments] = useState(false)
  const [comments, setComments] = useState([])
  const [commentText, setCommentText] = useState('')
  const videoRef = useRef(null)

  useEffect(() => { fetchInteractions() }, [video.id])

  async function fetchInteractions() {
    const { data: likesData } = await supabase.from('video_likes').select('*').eq('video_id', video.id)
    setLikes(likesData || [])

    const { data: commentsData } = await supabase
      .from('video_comments')
      .select('*, profiles(name, username)')
      .eq('video_id', video.id)
      .order('created_at', { ascending: true })
    setComments(commentsData || [])
  }

  async function addComment() {
    if (!commentText.trim()) return
    await supabase.from('video_comments').insert({
      video_id: video.id,
      user_id: currentUserId,
      content: commentText.trim(),
    })
    setCommentText('')
    fetchInteractions()
  }

  const isLiked = likes.some((l) => l.user_id === currentUserId)
  const profile = video.profiles

  return (
    <div className="card" style={{ overflow: 'hidden' }}>
      <div className="card-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div className="list-item-avatar" style={{ width: 40, height: 40, fontSize: '1rem' }}>
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} alt="" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
            ) : (
              profile?.name?.[0]?.toUpperCase() || '?'
            )}
          </div>
          <div>
            <strong>{profile?.name || 'Unbekannt'}</strong>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>@{profile?.username} · {formatTime(video.created_at)}</div>
          </div>
        </div>
        {video.user_id === currentUserId && (
          <button className="btn btn-sm btn-danger" onClick={() => onDelete(video.id)}>
            🗑️
          </button>
        )}
      </div>

      {video.caption && (
        <p style={{ padding: '0 1rem', marginBottom: '0.5rem' }}>{video.caption}</p>
      )}

      <video
        ref={videoRef}
        src={video.video_url}
        controls
        playsInline
        style={{ width: '100%', maxHeight: '500px', background: '#000' }}
      />

      <div className="card-actions" style={{ padding: '0.75rem 1rem' }}>
        <button
          className={`btn btn-sm ${isLiked ? 'btn-primary' : 'btn-outline'}`}
          onClick={() => handleLike(video.id)}
        >
          {isLiked ? '❤️' : '🤍'} {likes.length}
        </button>
        <button
          className="btn btn-sm btn-outline"
          onClick={() => setShowComments(!showComments)}
        >
          💬 {comments.length}
        </button>
        <button
          className="btn btn-sm btn-outline"
          onClick={() => {
            if (navigator.share) {
              navigator.share({ title: video.caption, url: window.location.href })
            }
          }}
        >
          📤 {t('video.share')}
        </button>
      </div>

      {showComments && (
        <div style={{ padding: '0 1rem 1rem', borderTop: '1px solid var(--border)' }}>
          {comments.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', padding: '0.5rem 0' }}>{t('video.noComments')}</p>
          ) : (
            comments.map((c) => (
              <div key={c.id} style={{ marginBottom: '0.5rem', paddingTop: '0.5rem' }}>
                <strong style={{ color: 'var(--primary-light)' }}>{c.profiles?.name}</strong>{' '}
                <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                  {formatTime(c.created_at)}
                </span>
                <p style={{ fontSize: '0.9rem' }}>{c.content}</p>
              </div>
            ))
          )}
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
            <input
              className="form-input"
              placeholder={t('video.commentPlaceholder')}
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addComment()}
            />
            <button className="btn btn-primary btn-sm" onClick={addComment}>{t('video.send')}</button>
          </div>
        </div>
      )}
    </div>
  )
}
