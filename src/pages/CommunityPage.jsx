import { useState, useEffect, useRef } from 'react'
import { MessageCircle, FileText, Clapperboard, Heart, Image as ImageIcon, X } from 'lucide-react'
import { Link } from 'react-router-dom'
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
  const [selectedImage, setSelectedImage] = useState(null)
  const [imagePreview, setImagePreview] = useState(null)
  const fileInputRef = useRef(null)

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
    if (!newPost.trim() && !selectedImage) return

    let imageUrl = ''
    if (selectedImage) {
      const ext = selectedImage.name.split('.').pop() || 'jpg'
      const filePath = `posts/${user.id}/${Date.now()}.${ext}`
      const { error: uploadError } = await supabase.storage
        .from('community-images')
        .upload(filePath, selectedImage, { contentType: selectedImage.type })
      if (!uploadError) {
        const { data: urlData } = supabase.storage
          .from('community-images')
          .getPublicUrl(filePath)
        imageUrl = urlData.publicUrl
      }
    }

    await supabase.from('posts').insert({
      user_id: user.id,
      content: newPost.trim() || '',
      image_url: imageUrl,
    })
    setNewPost('')
    setSelectedImage(null)
    setImagePreview(null)
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
        <h1>{t('community.title')}</h1>
        <p>{t('community.share')}</p>
      </div>

      <div className="tabs">
        <button className={`tab ${tab === 'posts' ? 'active' : ''}`} onClick={() => setTab('posts')}>
          <FileText size={16} style={{ marginRight: 6, verticalAlign: 'text-bottom' }} />
          {t('community.title')}
        </button>
        <button className={`tab ${tab === 'videos' ? 'active' : ''}`} onClick={() => setTab('videos')}>
          <Clapperboard size={16} style={{ marginRight: 6, verticalAlign: 'text-bottom' }} />
          {t('video.title')}
        </button>
      </div>

      {tab === 'posts' && (
        <>
          {user ? (
            <div className="card">
              <textarea
                className="form-input"
                placeholder={t('community.placeholder')}
                value={newPost}
                onChange={(e) => setNewPost(e.target.value)}
                rows={3}
              />
              {imagePreview && (
                <div style={{ position: 'relative', marginTop: '0.5rem', display: 'inline-block' }}>
                  <img src={imagePreview} alt="" style={{ maxWidth: '200px', maxHeight: '150px', borderRadius: '8px', objectFit: 'cover' }} />
                  <button
                    onClick={() => { setSelectedImage(null); setImagePreview(null) }}
                    style={{ position: 'absolute', top: -8, right: -8, background: 'var(--danger, #e53e3e)', color: 'white', border: 'none', borderRadius: '50%', width: 22, height: 22, cursor: 'pointer', fontSize: 12, lineHeight: '22px', textAlign: 'center' }}
                  ><X size={12} /></button>
                </div>
              )}
              <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.5rem', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <input ref={fileInputRef} type="file" accept="image/*" onChange={(e) => { const f = e.target.files[0]; if (f) { setSelectedImage(f); setImagePreview(URL.createObjectURL(f)) } }} style={{ display: 'none' }} />
                  <button className="btn btn-sm btn-outline" onClick={() => fileInputRef.current?.click()}>
                    <ImageIcon size={14} style={{ marginRight: 4, verticalAlign: 'text-bottom' }} />
                    Bild
                  </button>
                </div>
                <button className="btn btn-primary" onClick={handlePost} disabled={!newPost.trim() && !selectedImage}>
                  {t('community.post')}
                </button>
              </div>
            </div>
          ) : (
            <div className="public-cta" style={{ textAlign: 'center', padding: '2rem', marginBottom: '1rem' }}>
              <p style={{ marginBottom: '1rem', color: 'var(--text-muted)' }}>Melde dich an, um Beiträge zu erstellen.</p>
              <Link to="/login" className="btn btn-primary">Anmelden</Link>
            </div>
          )}

          {loading ? (
            <p style={{ textAlign: 'center', color: 'var(--text-muted)' }}>Laden...</p>
          ) : posts.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon"><MessageCircle /></div>
              <p>{t('community.noPosts')}</p>
            </div>
          ) : (
            posts.map((post) => (
              <PostCard key={post.id} post={post} currentUserId={user?.id} onLike={handleLike} />
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
        {post.image_url && (
          <img src={post.image_url} alt="" style={{ width: '100%', maxHeight: '400px', objectFit: 'cover', borderRadius: '8px', marginBottom: '0.75rem' }} />
        )}
        <p>{post.content}</p>
      </div>
      <div className="card-actions">
        <button
          className={`btn btn-sm ${isLiked ? 'btn-primary' : 'btn-outline'}`}
          onClick={() => onLike(post.id)}
        >
          <Heart size={14} fill={isLiked ? 'currentColor' : 'none'} style={{ marginRight: 4, verticalAlign: 'text-bottom' }} />
          {likes.length}
        </button>
        <button
          className="btn btn-sm btn-outline"
          onClick={() => setShowComments(!showComments)}
        >
          <MessageCircle size={14} style={{ marginRight: 4, verticalAlign: 'text-bottom' }} />
          {comments.length}
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
