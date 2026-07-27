import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Eye, EyeOff, ExternalLink, Save, Check, AlertCircle } from 'lucide-react'
import { supabase } from '../lib/supabase'
import './KiVisibilityPage.css'

const PLATFORM_OPTIONS = [
  { value: 'tiktok', label: 'TikTok' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'youtube', label: 'YouTube' },
  { value: 'twitter', label: 'X / Twitter' },
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'facebook', label: 'Facebook' },
  { value: 'twitch', label: 'Twitch' },
  { value: 'discord', label: 'Discord' }
]

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[äÄ]/g, 'ae').replace(/[öÖ]/g, 'oe').replace(/[üÜ]/g, 'ue').replace(/[ß]/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 60)
}

export default function KiVisibilityPage() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [isPremium, setIsPremium] = useState(false)
  const [profile, setProfile] = useState(null)
  const [showPaywall, setShowPaywall] = useState(false)

  // Form state
  const [displayName, setDisplayName] = useState('')
  const [slug, setSlug] = useState('')
  const [slugEdited, setSlugEdited] = useState(false)
  const [profileType, setProfileType] = useState('creator')
  const [niche, setNiche] = useState('')
  const [bio, setBio] = useState('')
  const [platforms, setPlatforms] = useState([])
  const [newPlatform, setNewPlatform] = useState('tiktok')
  const [newHandle, setNewHandle] = useState('')
  const [offer, setOffer] = useState('')
  const [location, setLocation] = useState('')
  const [isPublished, setIsPublished] = useState(false)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Check premium status
      const { data: settings } = await supabase
        .from('ai_settings')
        .select('is_premium')
        .eq('user_id', user.id)
        .single()

      const premium = settings?.is_premium || false
      setIsPremium(premium)

      if (!premium) {
        setShowPaywall(true)
        setLoading(false)
        return
      }

      // Load existing profile
      const { data: existing } = await supabase
        .from('creator_profiles')
        .select('*')
        .eq('user_id', user.id)
        .single()

      if (existing) {
        setProfile(existing)
        setDisplayName(existing.display_name || '')
        setSlug(existing.slug || '')
        setSlugEdited(true)
        setProfileType(existing.profile_type || 'creator')
        setNiche(existing.niche || '')
        setBio(existing.bio || '')
        setPlatforms(existing.platforms || [])
        setOffer(existing.offer || '')
        setLocation(existing.location || '')
        setIsPublished(existing.is_published || false)
      } else {
        // Pre-fill from user metadata
        const { data: profileData } = await supabase
          .from('profiles')
          .select('display_name, username')
          .eq('id', user.id)
          .single()

        if (profileData) {
          setDisplayName(profileData.display_name || profileData.username || '')
          if (profileData.username) {
            setSlug(slugify(profileData.username))
          }
        }
      }
    } catch (e) {
      console.error('[KiVisibility] Load error:', e.message)
    } finally {
      setLoading(false)
    }
  }

  const handleDisplayNameChange = (val) => {
    setDisplayName(val)
    if (!slugEdited) {
      setSlug(slugify(val))
    }
  }

  const handleSlugChange = (val) => {
    setSlugEdited(true)
    setSlug(slugify(val))
  }

  const addPlatform = () => {
    if (!newHandle.trim()) return
    setPlatforms([...platforms, { name: newPlatform, handle: newHandle.trim() }])
    setNewHandle('')
  }

  const removePlatform = (index) => {
    setPlatforms(platforms.filter((_, i) => i !== index))
  }

  const saveProfile = async () => {
    setSaving(true)
    setSaved(false)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const profileData = {
        user_id: user.id,
        slug: slug,
        display_name: displayName,
        profile_type: profileType,
        niche: niche,
        bio: bio.substring(0, 500),
        platforms: platforms,
        offer: offer,
        location: location,
        is_published: isPublished
      }

      if (profile) {
        // Update existing
        const { error } = await supabase
          .from('creator_profiles')
          .update(profileData)
          .eq('id', profile.id)

        if (error) throw error
      } else {
        // Insert new
        const { error } = await supabase
          .from('creator_profiles')
          .insert(profileData)

        if (error) throw error
      }

      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (e) {
      console.error('[KiVisibility] Save error:', e.message)
      alert('Fehler beim Speichern: ' + e.message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="kiv-page">
        <div className="kiv-loading">Laden...</div>
      </div>
    )
  }

  if (showPaywall) {
    return (
      <div className="kiv-page">
        <div className="kiv-paywall">
          <AlertCircle size={48} className="kiv-paywall-icon" />
          <h2>KI-Sichtbarkeit ist ein Premium-Feature</h2>
          <p>Erstelle ein öffentliches Profil, das von AI-Suchsystemen (ChatGPT, Claude, Perplexity) gefunden werden kann.</p>
          <button className="kiv-btn kiv-btn-premium" onClick={() => navigate('/ai-chat')}>
            Premium freischalten
          </button>
        </div>
      </div>
    )
  }

  const publicUrl = `https://happiness-eu.netlify.app/creator/${slug}`

  return (
    <div className="kiv-page">
      <div className="kiv-header">
        <h1>KI-Sichtbarkeit</h1>
        <p>Erstelle ein öffentliches Profil, das von AI-Suchsystemen gefunden werden kann.</p>
      </div>

      <div className="kiv-layout">
        <div className="kiv-form">
          <div className="kiv-field">
            <label>Anzeigename</label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => handleDisplayNameChange(e.target.value)}
              placeholder="z.B. Max Mustermann"
            />
          </div>

          <div className="kiv-field">
            <label>URL-Slug</label>
            <div className="kiv-slug-input">
              <span className="kiv-slug-prefix">happiness-eu.netlify.app/creator/</span>
              <input
                type="text"
                value={slug}
                onChange={(e) => handleSlugChange(e.target.value)}
                placeholder="max-mustermann"
              />
            </div>
          </div>

          <div className="kiv-field">
            <label>Profiltyp</label>
            <div className="kiv-toggle">
              <button
                className={`kiv-toggle-btn ${profileType === 'creator' ? 'active' : ''}`}
                onClick={() => setProfileType('creator')}
              >
                Creator
              </button>
              <button
                className={`kiv-toggle-btn ${profileType === 'business' ? 'active' : ''}`}
                onClick={() => setProfileType('business')}
              >
                Business
              </button>
            </div>
          </div>

          <div className="kiv-field">
            <label>Nische / Branche</label>
            <input
              type="text"
              value={niche}
              onChange={(e) => setNiche(e.target.value)}
              placeholder="z.B. Fitness, Gaming, Marketing"
            />
          </div>

          <div className="kiv-field">
            <label>Bio ({bio.length}/500)</label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value.substring(0, 500))}
              placeholder="Kurz und faktisch. Was machst du? Wofür bist du bekannt?"
              rows={3}
            />
          </div>

          <div className="kiv-field">
            <label>Angebot (optional)</label>
            <input
              type="text"
              value={offer}
              onChange={(e) => setOffer(e.target.value)}
              placeholder="z.B. Online-Coaching, Merchandise, Kurse"
            />
          </div>

          <div className="kiv-field">
            <label>Standort (optional)</label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="z.B. Berlin, Deutschland"
            />
          </div>

          <div className="kiv-field">
            <label>Plattformen</label>
            <div className="kiv-platforms-list">
              {platforms.map((p, i) => (
                <div key={i} className="kiv-platform-tag">
                  <span>{p.name}: {p.handle}</span>
                  <button onClick={() => removePlatform(i)}>×</button>
                </div>
              ))}
            </div>
            <div className="kiv-platform-add">
              <select value={newPlatform} onChange={(e) => setNewPlatform(e.target.value)}>
                {PLATFORM_OPTIONS.map(p => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
              <input
                type="text"
                value={newHandle}
                onChange={(e) => setNewHandle(e.target.value)}
                placeholder="@handle oder URL"
                onKeyDown={(e) => e.key === 'Enter' && addPlatform()}
              />
              <button onClick={addPlatform}>+</button>
            </div>
          </div>

          <div className="kiv-field">
            <label className="kiv-checkbox">
              <input
                type="checkbox"
                checked={isPublished}
                onChange={(e) => setIsPublished(e.target.checked)}
              />
              <span>Profil veröffentlichen</span>
            </label>
            {isPublished && (
              <a href={publicUrl} target="_blank" rel="noopener noreferrer" className="kiv-preview-link">
                <ExternalLink size={14} /> Profil ansehen
              </a>
            )}
          </div>

          <div className="kiv-actions">
            <button
              className="kiv-btn kiv-btn-save"
              onClick={saveProfile}
              disabled={saving || !displayName || !slug}
            >
              {saving ? 'Speichern...' : saved ? <><Check size={16} /> Gespeichert</> : <><Save size={16} /> Speichern</>}
            </button>
          </div>
        </div>

        <div className="kiv-preview">
          <h3>Vorschau</h3>
          <div className="kiv-preview-card">
            <div className="kiv-preview-name">{displayName || 'Dein Name'}</div>
            {niche && <div className="kiv-preview-niche">{niche}</div>}
            <div className="kiv-preview-type">{profileType === 'business' ? 'Unternehmen' : 'Creator'}</div>
            {bio && <p className="kiv-preview-bio">{bio}</p>}
            {offer && <div className="kiv-preview-offer">{offer}</div>}
            {platforms.length > 0 && (
              <div className="kiv-preview-platforms">
                {platforms.map((p, i) => (
                  <span key={i} className="kiv-preview-platform">{p.name}</span>
                ))}
              </div>
            )}
            {location && <div className="kiv-preview-location">📍 {location}</div>}
          </div>
        </div>
      </div>
    </div>
  )
}
