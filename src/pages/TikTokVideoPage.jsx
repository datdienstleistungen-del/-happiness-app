import { useState, useRef, useEffect } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import {
  Sparkles, ArrowLeft, Film, Check, AlertTriangle, ExternalLink,
  Smartphone, Monitor, RotateCcw, Clock, Mic, Image, ChevronDown, ChevronUp,
  Lightbulb, Zap, Share2, Globe, Video, MessageSquare, Hash, HelpCircle,
  PartyPopper, ArrowRight, Copy, Upload, X, Download, FileArchive
} from 'lucide-react'
import heic2any from 'heic2any'
import CopyButton from '../components/CopyButton'
import { trackRecipeGenerated, trackPlatformViewed, trackCapCutTriggered } from '../intelligence/analytics'
import { trackExportToTool, trackPublishConfirmed } from '../intelligence/analytics/custom'
import { copyScriptToClipboard, downloadScenesZip, downloadCapCutDraft } from '../utils/capcut-export'
import { uploadToCloudinary } from '../utils/cloudinary'
import './CapCutStudio.css'

const isDE = navigator.language.startsWith('de')

const t = {
  header: isDE ? 'CapCut Content Studio' : 'CapCut Content Studio',
  heroTitle: isDE ? 'Content-Generator' : 'Content Generator',
  heroSub: isDE
    ? 'Beschreib dein Thema — H.I.T. erstellt ein CapCut-Rezept mit Skript, Visual Prompts und Publishing-Texten für alle Plattformen.'
    : 'Describe your topic — H.I.T. creates a CapCut recipe with script, visual prompts, and publishing texts for all platforms.',
  howItWorks: isDE
    ? "So geht's:"
    : "How it works:",
  howItWorksText: isDE
    ? 'Beschreib dein Thema, drücke "Generieren" — und kopiere die fertigen Texte in CapCut oder direkt in deine sozialen Kanäle.'
    : 'Describe your topic, click "Generate" — and copy the finished texts into CapCut or directly to your social channels.',
  step1: isDE ? 'Thema beschreiben' : 'Describe your topic',
  step2: isDE ? 'KI generiert Skript + Texte' : 'AI generates script + texts',
  step3: isDE ? 'Kopieren & posten' : 'Copy & post',
  textareaLabel: isDE ? 'Worum geht es in deinem Video?' : 'What is your video about?',
  textareaPlaceholder: isDE
    ? "z.B. '5 Tipps für ein glücklicheres Leben' oder 'Mein Produkt: Handgemachte Kerzen aus Sojawachs'"
    : "e.g. '5 tips for a happier life' or 'My product: Handmade soy candles'",
  durationLabel: isDE ? 'Videolänge' : 'Video length',
  quotaText: isDE
    ? (n) => `Dein H.I.T. Kontingent: ${n.videosLeft}/3 Videos | ${n.postsLeft}/5 Posts verfügbar`
    : (n) => `Your H.I.T. quota: ${n.videosLeft}/3 videos | ${n.postsLeft}/5 posts available`,
  paywallTitle: isDE ? 'H.I.T. Unlimited freischalten' : 'Unlock H.I.T. Unlimited',
  paywallPrice: '4,99 € / ' + (isDE ? 'Monat' : 'month'),
  paywallFeature1: isDE ? 'Unlimitierte Videos & Posts' : 'Unlimited videos & posts',
  paywallFeature2: isDE ? 'Alle 6 Plattformen freigeschaltet' : 'All 6 platforms unlocked',
  paywallFeature3: isDE ? 'H.I.T. Prioritäts-Server' : 'H.I.T. priority server',
  paywallBtn: isDE ? 'Jetzt upgraden' : 'Upgrade now',
  generateBtn: isDE ? 'Rezept generieren' : 'Generate recipe',
  loadingText: isDE ? 'Rezept wird generiert...' : 'Generating recipe...',
  loadingSub: isDE
    ? 'H.I.T. schreibt dein Skript, Prompts & Publishing-Payloads'
    : 'H.I.T. is writing your script, prompts & publishing payloads',
  errorGeneric: isDE ? 'Rezept konnte nicht generiert werden. Bitte versuch es nochmal.' : 'Recipe could not be generated. Please try again.',
  errorRateLimit: isDE ? 'Zu viele Anfragen. Bitte warte kurz und versuch es nochmal.' : 'Too many requests. Please wait a moment and try again.',
  errorNetwork: isDE ? 'Keine Verbindung zum Server. Prüf dein Internet.' : 'No connection to server. Check your internet.',
  // Success
  successTitle: isDE ? 'Rezept fertig!' : 'Recipe ready!',
  successSub: isDE
    ? 'H.I.T. hat alles vorbereitet. Als Nächstes: In CapCut einfügen, Video exportieren und auf deinen Kanälen posten.'
    : 'H.I.T. has prepared everything. Next step: Paste into CapCut, export video, and post on your channels.',
  nextStep1: isDE ? 'Skript in CapCut einfügen' : 'Paste script into CapCut',
  nextStep2: isDE ? 'Video exportieren' : 'Export video',
  nextStep3: isDE ? 'Auf Kanälen posten' : 'Post on channels',
  // Example
  exampleBtn: isDE ? 'Beispiel ansehen' : 'View example',
  exampleTitle: isDE ? 'So könnte ein CapCut-Rezept aussehen' : 'This is what a CapCut recipe looks like',
  exampleUse: isDE ? 'Als Vorlage verwenden' : 'Use as template',
  // Honest banner
  honestBanner: isDE
    ? 'H.I.T. bereitet alles vor — Skript, Prompts und Texte für alle Plattformen. Danach musst du nur noch in CapCut einfügen, exportieren und posten.'
    : 'H.I.T. prepares everything — script, prompts, and texts for all platforms. Then just paste into CapCut, export, and post.',
  // Result
  scenesLabel: isDE ? 'Szenen' : 'Scenes',
  videoLabel: isDE ? 'Video' : 'Video',
  platformsLabel: isDE ? 'Plattformen' : 'Platforms',
  masterScript: isDE ? 'Master Video Script' : 'Master Video Script',
  copyFullScript: isDE ? 'Ganzes Skript kopieren' : 'Copy full script',
  scenesPrompts: isDE ? 'Szenen & Visual Prompts' : 'Scenes & Visual Prompts',
  scene: isDE ? 'Szene' : 'Scene',
  spokenText: isDE ? 'Gesprochener Text' : 'Spoken text',
  visualPrompt: isDE ? 'Visueller Prompt' : 'Visual prompt',
  promptCopy: isDE ? 'Prompt kopieren' : 'Copy prompt',
  actionHub: isDE ? 'H.I.T. Action Hub' : 'H.I.T. Action Hub',
  capcutPrimary: isDE ? 'In CapCut öffnen & Video erstellen' : 'Open in CapCut & create video',
  capcutSub: isDE
    ? 'Skript + Prompts in CapCut einfügen → Video exportieren → Auf Kanälen posten'
    : 'Paste script + prompts into CapCut → export video → post on channels',
  freeTip: isDE
    ? 'H.I.T. Free-Tipp: CapCut bietet oft ein günstiges oder kostenloses KI-Modell als Alternative an — schau im Editor, was gerade verfügbar ist.'
    : 'H.I.T. Free Tip: CapCut often offers an affordable or free AI model as an alternative — check the editor to see what\'s currently available.',
  capcutMobile: isDE ? 'In CapCut öffnen' : 'Open in CapCut',
  capcutDesktop: isDE ? 'Im Browser öffnen' : 'Open in Browser',
  capcutHint: isDE ? 'Tipp: Kopiere das Skript und füge es in CapCut ein.' : 'Tip: Copy the script and paste it into CapCut.',
  guide: isDE ? "So geht's" : "How it works",
  guideStep1: isDE ? 'Klick auf "Kopieren" und füge den Text in CapCut\'s Text-to-Speech ein.' : 'Click "Copy" and paste the text into CapCut\'s Text-to-Speech.',
  guideStep2: isDE ? 'Kopiere jeden Prompt und generiere damit Bilder in Midjourney, DALL-E oder CapCut\'s KI-Generator.' : 'Copy each prompt and generate images in Midjourney, DALL-E, or CapCut\'s AI generator.',
  guideStep3: isDE ? 'Füge Bilder, Voiceover und Musik zusammen und exportiere dein Video.' : 'Combine images, voiceover, and music and export your video.',
  guideStep4: isDE ? 'Kopiere die plattformspezifischen Captions und poste dein Video auf allen Kanälen.' : 'Copy the platform-specific captions and post your video on all channels.',
  newRecipe: isDE ? 'Neues Rezept generieren' : 'Generate new recipe',
  hook: 'Hook (Text-Overlay)',
  copyHook: isDE ? 'Hook kopieren' : 'Copy hook',
  caption: 'Description / Caption',
  copyCaption: isDE ? 'Caption kopieren' : 'Copy caption',
  headline: 'Headline',
  copyHeadline: isDE ? 'Headline kopieren' : 'Copy headline',
  bodyText: isDE ? 'Beitragstext' : 'Post text',
  copyText: isDE ? 'Text kopieren' : 'Copy text',
  titleMax60: isDE ? 'Titel (max 60 Zeichen)' : 'Title (max 60 characters)',
  copyTitle: isDE ? 'Titel kopieren' : 'Copy title',
  description: isDE ? 'Beschreibung' : 'Description',
  copyDescription: isDE ? 'Beschreibung kopieren' : 'Copy description',
  postTitle: isDE ? 'Post-Titel' : 'Post title',
  platformTexts: isDE ? 'Plattform-Texte' : 'Platform texts',
}

const PLATFORMS = [
  { id: 'tiktok_instagram', label: 'TikTok / Instagram', icon: Hash, color: '#E4405F' },
  { id: 'linkedin_facebook', label: 'LinkedIn / Facebook', icon: Globe, color: '#0A66C2' },
  { id: 'youtube_shorts', label: 'YouTube Shorts', icon: Video, color: '#FF0000' },
  { id: 'reddit', label: 'Reddit', icon: MessageSquare, color: '#FF4500' }
]

const EXAMPLE_RECIPE = {
  video_title: isDE ? 'Creator-Strategie: So wirst du erfolgreich' : 'Creator Strategy: How to Succeed',
  voiceover_script: isDE
    ? 'Willst du ein erfolgreicher Creator werden? Es ist Zeit, deine Strategie zu ändern. Heute müssen Creators schnell, kreativ und authentisch sein. Ein guter Creator kennt sein Publikum und bietet ihnen Mehrwert. Wir bieten dir 3 Gratis-Videos, um deine Fähigkeiten zu verbessern. Danach nur 4,99 €. Besuche happiness-eu.netlify.app, um loszulegen!'
    : 'Want to become a successful creator? It\'s time to change your strategy. Today, creators need to be fast, creative, and authentic. A good creator knows their audience and provides value. We offer 3 free videos to improve your skills. After that, only €4.99. Visit happiness-eu.netlify.app to get started!',
  duration: 20,
  ratio: '9:16',
  style: 'Future Tech',
  bgm: 'Motivation Inspiring Upbeat Corporate',
  scenes: [
    {
      timestamp: '0-5s',
      spoken_text: isDE
        ? 'Willst du ein erfolgreicher Creator werden? Es ist Zeit, deine Strategie zu ändern.'
        : 'Want to become a successful creator? It\'s time to change your strategy.',
      visual_prompt: isDE
        ? 'Modernes Home-Setup mit Ringlicht, Creator sitzt vor Kamera, confident'
        : 'Modern home setup with ring light, creator sitting in front of camera, confident'
    },
    {
      timestamp: '5-10s',
      spoken_text: isDE
        ? 'Heute müssen Creators schnell, kreativ und authentisch sein.'
        : 'Today, creators need to be fast, creative, and authentic.',
      visual_prompt: isDE
        ? 'Schnelle Montage: Tipsen auf Handy, Editing-Screen, Lächeln vor Kamera'
        : 'Quick montage: typing on phone, editing screen, smiling at camera'
    },
    {
      timestamp: '10-15s',
      spoken_text: isDE
        ? 'Ein guter Creator kennt sein Publikum und bietet ihnen Mehrwert.'
        : 'A good creator knows their audience and provides value.',
      visual_prompt: isDE
        ? 'Analytics-Dashboard zeigt Wachstum, Creator nickt zufrieden'
        : 'Analytics dashboard showing growth, creator nods satisfied'
    },
    {
      timestamp: '15-20s',
      spoken_text: isDE
        ? 'Wir bieten dir 3 Gratis-Videos. Danach nur 4,99 €. Besuche happiness-eu.netlify.app!'
        : 'We offer 3 free videos. After that, only €4.99. Visit happiness-eu.netlify.app!',
      visual_prompt: isDE
        ? 'CTA-Screen mit Website-URL, Creator zeigt auf Link, energetisch'
        : 'CTA screen with website URL, creator points to link, energetic'
    }
  ],
  publishing_payload: {
    tiktok_instagram: {
      hook: isDE ? 'Creator? Ändere deine Strategie NOW 🚀' : 'Creators? Change your strategy NOW 🚀',
      description: isDE
        ? 'Die meisten Creators machen den gleichen Fehler: Sie haben keine Strategie.\n\nIch zeige dir, wie es anders geht. Link in Bio 👆\n\n#creator #contentcreator #socialmedia #strategie #growth'
        : 'Most creators make the same mistake: no strategy.\n\nI\'ll show you how to do it differently. Link in bio 👆\n\n#creator #contentcreator #socialmedia #strategy #growth'
    },
    linkedin_facebook: {
      headline: isDE ? 'Creator-Strategie: Was 90% falsch machen' : 'Creator Strategy: What 90% get wrong',
      body_text: isDE
        ? 'Die meisten Content Creator haben keine klare Strategie.\n\nDas Ergebnis: viel Aufwand, wenig Wachstum.\n\n3 Dinge, die erfolgreiche Creators anders machen:\n1. Sie kennen ihr Publikum\n2. Sie bieten echten Mehrwert\n3. Sie sind konsistent\n\nMöchtest du lernen, wie es geht? Schau dir unsere 3 kostenlosen Videos an.\n\n#ContentCreator #Strategie #SocialMedia'
        : 'Most content creators don\'t have a clear strategy.\n\nResult: lots of effort, little growth.\n\n3 things successful creators do differently:\n1. They know their audience\n2. They provide real value\n3. They are consistent\n\nWant to learn how? Check out our 3 free videos.\n\n#ContentCreator #Strategy #SocialMedia'
    },
    youtube_shorts: {
      title: isDE ? 'Creator-Strategie: So wirst du erfolgreich' : 'Creator Strategy: How to Succeed',
      description: isDE
        ? 'Die meisten Creators machen den gleichen Fehler. In diesem Video zeige ich dir, wie du es richtig machst.\n\n🎁 3 Gratis-Videos: happiness-eu.netlify.app\n\n#creator #youtube #strategie'
        : 'Most creators make the same mistake. In this video, I\'ll show you how to do it right.\n\n🎁 3 free videos: happiness-eu.netlify.app\n\n#creator #youtube #strategy'
    },
    reddit: {
      title: isDE ? 'Ich habe 3 Monate als Creator experimentiert. Hier sind die Ergebnisse.' : 'I experimented as a creator for 3 months. Here are the results.',
      body_text: isDE
        ? 'Hintergrund: Ich wollte herausfinden, was erfolgreiche Creators anders machen.\n\nWas ich gelernt habe:\n- Strategie ist wichtiger als Content-Menge\n- Authentizität schlägt Perfektion\n- Konsistenz schlägt Intensität\n\nIch habe 3 kostenlose Videos erstellt, die meine Erkenntnisse zusammenfassen.\n\nFragt mich gerne.'
        : 'Background: I wanted to find out what successful creators do differently.\n\nWhat I learned:\n- Strategy matters more than content volume\n- Authenticity beats perfection\n- Consistency beats intensity\n\nI created 3 free videos summarizing my findings.\n\nFeel free to ask.'
    }
  }
}

const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)

export default function TikTokVideoPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()

  const [topic, setTopic] = useState(location.state?.postText || '')
  const [duration, setDuration] = useState(30)
  const [recipe, setRecipe] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [activePlatform, setActivePlatform] = useState('tiktok_instagram')
  const [showSuccess, setShowSuccess] = useState(false)
  const [showExample, setShowExample] = useState(false)
  const [published, setPublished] = useState(false)

  const [showUploadPrompt, setShowUploadPrompt] = useState(false)
  const [scenesWithMedia, setScenesWithMedia] = useState([])
  const [isZipping, setIsZipping] = useState(false)
  const [toast, setToast] = useState(null)
  const [uploadProgress, setUploadProgress] = useState({})

  const [videoUsed, setVideoUsed] = useState(0)
  const [contentUsed, setContentUsed] = useState(0)
  const [isPremium, setIsPremium] = useState(false)
  const [quotaLoaded, setQuotaLoaded] = useState(false)

  const VIDEO_LIMIT = 3
  const CONTENT_LIMIT = 5
  const videosLeft = Math.max(0, VIDEO_LIMIT - videoUsed)
  const postsLeft = Math.max(0, CONTENT_LIMIT - contentUsed)
  const hasQuota = true // Early Traction: limits removed

  useEffect(() => {
    loadQuota()
  }, [user])

  const pipelineUsed = useRef(false)
  useEffect(() => {
    const pipelineResult = location.state?.pipelineResult
    if (pipelineResult?.recipe && !pipelineUsed.current) {
      pipelineUsed.current = true
      setTopic(location.state?.postText || '')
      setRecipe(pipelineResult.recipe)
      setShowSuccess(true)
    }
  }, [])

  const loadQuota = async () => {
    if (!user) return
    try {
      const { data } = await supabase
        .from('ai_settings')
        .select('free_video_used, free_content_used, is_premium')
        .eq('user_id', user.id)
        .single()
      if (data) {
        setVideoUsed(data.free_video_used || 0)
        setContentUsed(data.free_content_used || 0)
        setIsPremium(data.is_premium || false)
      }
    } catch (e) {
      console.warn('[Quota] Fallback: using defaults', e.message)
      setVideoUsed(0)
      setContentUsed(0)
      setIsPremium(false)
    } finally {
      setQuotaLoaded(true)
    }
  }

  const incrementQuota = async () => {
    if (!user || isPremium) return
    try {
      await supabase
        .from('ai_settings')
        .update({ free_video_used: videoUsed + 1 })
        .eq('user_id', user.id)
      setVideoUsed(prev => prev + 1)
    } catch (e) {
      console.warn('[Quota] Increment failed', e.message)
    }
  }

  const sanitize = (input) => {
    return input.replace(/<[^>]*>/g, '').trim().substring(0, 2000)
  }

  const generateRecipe = async () => {
    if (!topic.trim() || topic.trim().length < 3) return
    if (!hasQuota) return

    setLoading(true)
    setError('')
    setRecipe(null)
    setShowSuccess(false)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token || ''

      const res = await fetch('/api/content-recipe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          topic: sanitize(topic),
          duration
        })
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Unknown error' }))
        throw new Error(err.error || `Error (${res.status})`)
      }

      const data = await res.json()
      setRecipe(data)
      setShowSuccess(true)
      trackRecipeGenerated(data.video_title, duration)
    } catch (err) {
      console.error('[CapCut] Recipe error:', err)
      const msg = err.message || ''
      if (msg.includes('429') || msg.includes('ausgelastet')) {
        setError(t.errorRateLimit)
      } else if (msg.includes('fetch') || msg.includes('network')) {
        setError(t.errorNetwork)
      } else {
        setError(err.error || t.errorGeneric)
      }
    } finally {
      setLoading(false)
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      generateRecipe()
    }
  }

  const useExampleAsTemplate = () => {
    setTopic(EXAMPLE_RECIPE.video_title)
    setShowExample(false)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const showToast = (msg) => {
    setToast(msg)
    setTimeout(() => setToast(null), 2500)
  }

  const handleMediaUpload = async (sceneIndex, e) => {
    const rawFile = e.target.files?.[0]
    if (!rawFile) return

    let file = rawFile
    const name = rawFile.name.toLowerCase()
    if (name.endsWith('.heic') || name.endsWith('.heif')) {
      try {
        const blob = await heic2any({ blob: rawFile, toType: 'image/jpeg', quality: 0.85 })
        file = new File([blob], rawFile.name.replace(/\.heic$/i, '.jpg').replace(/\.heif$/i, '.jpg'), { type: 'image/jpeg' })
      } catch (err) {
        console.error('HEIC conversion failed:', err)
      }
    }

    const previewUrl = URL.createObjectURL(file)

    setScenesWithMedia(prev => {
      const updated = [...prev]
      if (!updated[sceneIndex]) {
        updated[sceneIndex] = { id: Date.now() + sceneIndex }
      }
      updated[sceneIndex] = {
        ...updated[sceneIndex],
        mediaFile: file,
        mediaUrl: previewUrl,
        mediaName: file.name,
        uploading: true,
        cloudUrl: null
      }
      return updated
    })

    try {
      const result = await uploadToCloudinary(file, (percent) => {
        setUploadProgress(prev => ({ ...prev, [sceneIndex]: percent }))
      })

      setScenesWithMedia(prev => {
        const updated = [...prev]
        updated[sceneIndex] = {
          ...updated[sceneIndex],
          cloudUrl: result.url,
          cloudPublicId: result.publicId,
          uploading: false
        }
        return updated
      })
      setUploadProgress(prev => ({ ...prev, [sceneIndex]: 100 }))
    } catch (err) {
      console.error('[Cloudinary] Upload failed:', err)
      setScenesWithMedia(prev => {
        const updated = [...prev]
        updated[sceneIndex] = { ...updated[sceneIndex], uploading: false, uploadError: true }
        return updated
      })
      showToast(isDE ? 'Upload fehlgeschlagen. Bitte erneut versuchen.' : 'Upload failed. Please try again.')
    }
  }

  const removeMedia = (sceneIndex) => {
    setScenesWithMedia(prev => {
      const updated = [...prev]
      if (updated[sceneIndex]?.mediaUrl) {
        URL.revokeObjectURL(updated[sceneIndex].mediaUrl)
      }
      updated[sceneIndex] = { ...updated[sceneIndex], mediaFile: null, mediaUrl: null, mediaName: null, cloudUrl: null, uploading: false }
      return updated
    })
  }

  const handleCopyScript = async () => {
    if (!recipe?.scenes) return
    await copyScriptToClipboard(recipe.scenes)
    showToast(t.toastScriptCopied)
  }

  const handleDownloadZip = async () => {
    if (!recipe?.scenes) return
    const scenesWithFiles = recipe.scenes.map((scene, i) => ({
      ...scene,
      mediaFile: scenesWithMedia[i]?.mediaFile || null,
      mediaUrl: scenesWithMedia[i]?.cloudUrl || scenesWithMedia[i]?.mediaUrl || null
    }))
    await downloadScenesZip(scenesWithFiles, setIsZipping)
  }

  const handleDownloadDraft = async () => {
    if (!recipe) return
    const scenesWithCloud = recipe.scenes.map((scene, i) => ({
      ...scene,
      mediaUrl: scenesWithMedia[i]?.cloudUrl || null
    }))
    await downloadCapCutDraft(recipe, scenesWithCloud)
  }

  const getPlatformContent = (platform, payload) => {
    if (!payload) return null
    const data = payload[platform]
    if (!data) return null

    switch (platform) {
      case 'tiktok_instagram':
        return (
          <>
            <div className="ccp-platform-field">
              <label>{t.hook}</label>
              <div className="ccp-platform-value">{data.hook}</div>
              <CopyButton text={data.hook} label={t.copyHook} />
            </div>
            <div className="ccp-platform-field">
              <label>{t.caption}</label>
              <div className="ccp-platform-value ccp-platform-value--pre">{data.description}</div>
              <CopyButton text={data.description} label={t.copyCaption} />
            </div>
          </>
        )
      case 'linkedin_facebook':
        return (
          <>
            <div className="ccp-platform-field">
              <label>{t.headline}</label>
              <div className="ccp-platform-value">{data.headline}</div>
              <CopyButton text={data.headline} label={t.copyHeadline} />
            </div>
            <div className="ccp-platform-field">
              <label>{t.bodyText}</label>
              <div className="ccp-platform-value ccp-platform-value--pre">{data.body_text}</div>
              <CopyButton text={data.body_text} label={t.copyText} />
            </div>
          </>
        )
      case 'youtube_shorts':
        return (
          <>
            <div className="ccp-platform-field">
              <label>{t.titleMax60}</label>
              <div className="ccp-platform-value">{data.title}</div>
              <CopyButton text={data.title} label={t.copyTitle} />
            </div>
            <div className="ccp-platform-field">
              <label>{t.description}</label>
              <div className="ccp-platform-value ccp-platform-value--pre">{data.description}</div>
              <CopyButton text={data.description} label={t.copyDescription} />
            </div>
          </>
        )
      case 'reddit':
        return (
          <>
            <div className="ccp-platform-field">
              <label>{t.postTitle}</label>
              <div className="ccp-platform-value">{data.title}</div>
              <CopyButton text={data.title} label={t.copyTitle} />
            </div>
            <div className="ccp-platform-field">
              <label>{t.bodyText}</label>
              <div className="ccp-platform-value ccp-platform-value--pre">{data.body_text}</div>
              <CopyButton text={data.body_text} label={t.copyText} />
            </div>
          </>
        )
      default:
        return null
    }
  }

  return (
    <div className="ccp-page">
      <div className="ccp-header">
        <button className="ccp-back" onClick={() => navigate(-1)}>
          <ArrowLeft size={20} />
        </button>
        <h1><Film size={22} /> {t.header}</h1>
      </div>

      <div className="ccp-hero">
        <div className="ccp-hero-icon"><Zap size={28} /></div>
        <h2>{t.heroTitle}</h2>
        <p className="ccp-hero-sub">{t.heroSub}</p>
      </div>

      <div className="ccp-how-it-works">
        <HelpCircle size={14} />
        <span><strong>{t.howItWorks}</strong> {t.howItWorksText}</span>
      </div>

      <div className="ccp-steps">
        <div className="ccp-step">
          <div className="ccp-step-num">1</div>
          <span className="ccp-step-text">{t.step1}</span>
        </div>
        <div className="ccp-step-arrow">→</div>
        <div className="ccp-step">
          <div className="ccp-step-num">2</div>
          <span className="ccp-step-text">{t.step2}</span>
        </div>
        <div className="ccp-step-arrow">→</div>
        <div className="ccp-step">
          <div className="ccp-step-num">3</div>
          <span className="ccp-step-text">{t.step3}</span>
        </div>
      </div>

      {!recipe && !loading && (
        <div className="ccp-input-section">
          <div className="ccp-input-group">
            <label className="ccp-label">
              <Lightbulb size={16} /> {t.textareaLabel}
            </label>
            <textarea
              className="ccp-textarea"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={t.textareaPlaceholder}
              rows={3}
            />
          </div>

          <div className="ccp-input-group">
            <label className="ccp-label">
              <Clock size={16} /> {t.durationLabel}
            </label>
            <div className="ccp-duration-options">
              {[15, 30, 45, 60].map(d => (
                <button
                  key={d}
                  className={`ccp-duration-btn ${duration === d ? 'active' : ''}`}
                  onClick={() => setDuration(d)}
                >
                  {d}s
                </button>
              ))}
            </div>
          </div>

          <button
            className="ccp-generate-btn"
            onClick={generateRecipe}
            disabled={!topic.trim() || topic.trim().length < 3 || loading}
          >
            <Sparkles size={18} /> {t.generateBtn}
          </button>

          {!showExample && !recipe && (
            <div className="ccp-example-teaser">
              <button className="ccp-example-btn" onClick={() => setShowExample(true)}>
                <Film size={16} /> {t.exampleBtn}
              </button>
            </div>
          )}

          {error && (
            <div className="ccp-error">
              <AlertTriangle size={16} /> {error}
            </div>
          )}
        </div>
      )}

      {showExample && !recipe && (
        <div className="ccp-example-card">
          <div className="ccp-example-header">
            <h3>{t.exampleTitle}</h3>
            <button className="ccp-example-use-btn" onClick={useExampleAsTemplate}>
              <ArrowRight size={14} /> {t.exampleUse}
            </button>
          </div>

          <div className="ccp-example-meta">
            <span>🎬 {EXAMPLE_RECIPE.duration}s</span>
            <span>📐 {EXAMPLE_RECIPE.ratio}</span>
            <span>🎨 {EXAMPLE_RECIPE.style}</span>
            <span>🎵 {EXAMPLE_RECIPE.bgm}</span>
          </div>

          <div className="ccp-section">
            <div className="ccp-section-header">
              <Mic size={18} />
              <h3>{t.masterScript}</h3>
            </div>
            <div className="ccp-script-box">
              <p className="ccp-script-text">{EXAMPLE_RECIPE.voiceover_script}</p>
            </div>
          </div>

          <div className="ccp-section">
            <div className="ccp-section-header">
              <Image size={18} />
              <h3>{t.scenesPrompts}</h3>
            </div>
            <div className="ccp-scenes-list">
              {EXAMPLE_RECIPE.scenes.map((scene, i) => (
                <div key={i} className="ccp-scene-card">
                  <div className="ccp-scene-header">
                    <div className="ccp-scene-left">
                      <span className="ccp-scene-num">{i + 1}</span>
                      <div className="ccp-scene-info">
                        <span className="ccp-scene-timestamp">{scene.timestamp}</span>
                        <span className="ccp-scene-spoken">{scene.spoken_text}</span>
                      </div>
                    </div>
                  </div>
                  <div className="ccp-scene-body">
                    <div className="ccp-scene-section">
                      <h4>{t.visualPrompt}</h4>
                      <div className="ccp-scene-prompt">
                        <code>{scene.visual_prompt}</code>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {EXAMPLE_RECIPE.publishing_payload && (
            <div className="ccp-section ccp-social-tabs-section">
              <div className="ccp-section-header">
                <Share2 size={18} />
                <h3>{t.platformTexts}</h3>
              </div>
              <div className="ccp-platform-tabs">
                {PLATFORMS.map(p => {
                  const Icon = p.icon
                  return (
                    <button
                      key={p.id}
                      className={`ccp-platform-tab ${activePlatform === p.id ? 'active' : ''}`}
                      onClick={() => setActivePlatform(p.id)}
                      style={activePlatform === p.id ? { borderColor: p.color, color: p.color } : {}}
                    >
                      <Icon size={14} />
                      <span>{p.label}</span>
                    </button>
                  )
                })}
              </div>
              <div className="ccp-platform-content">
                {getPlatformContent(activePlatform, EXAMPLE_RECIPE.publishing_payload)}
              </div>
            </div>
          )}
        </div>
      )}

      {loading && (
        <div className="ccp-loading">
          <div className="ccp-spinner" />
          <p className="ccp-loading-text">{t.loadingText}</p>
          <p className="ccp-loading-sub">{t.loadingSub}</p>
        </div>
      )}

      {recipe && showSuccess && (
        <div className="ccp-success-banner">
          <div className="ccp-success-icon"><PartyPopper size={28} /></div>
          <h3>{t.successTitle}</h3>
          <p>{t.successSub}</p>
          <div className="ccp-success-steps">
            <div className="ccp-success-step">
              <span className="ccp-success-step-num">1</span>
              <span>{t.nextStep1}</span>
            </div>
            <div className="ccp-success-step">
              <span className="ccp-success-step-num">2</span>
              <span>{t.nextStep2}</span>
            </div>
            <div className="ccp-success-step">
              <span className="ccp-success-step-num">3</span>
              <span>{t.nextStep3}</span>
            </div>
          </div>
        </div>
      )}

      {recipe && !showUploadPrompt && scenesWithMedia.filter(s => s?.mediaUrl).length === 0 && (
        <div className="ccp-upload-prompt">
          <div className="ccp-upload-prompt-icon">📸</div>
          <p>{t.capcut.uploadPromptTitle}</p>
          <div className="ccp-upload-prompt-actions">
            <button className="ccp-btn-primary" onClick={() => setShowUploadPrompt(true)}>
              <Upload size={16} /> {t.capcut.btnUploadYes}
            </button>
            <button className="ccp-btn-outline" onClick={() => setShowUploadPrompt(false)}>
              {t.capcut.btnUploadNo}
            </button>
          </div>
        </div>
      )}

      {recipe && (
        <div className="ccp-result">
          <div className="ccp-result-header">
            <h2 className="ccp-result-title">{recipe.video_title}</h2>
            <div className="ccp-result-meta">
              <span>{recipe.scenes.length} {t.scenesLabel}</span>
              <span>·</span>
              <span>{duration}s {t.videoLabel}</span>
              <span>·</span>
              <span>4 {t.platformsLabel}</span>
            </div>
          </div>

          <div className="ccp-banner ccp-banner--info">
            <Zap size={18} />
            <div>{t.honestBanner}</div>
          </div>

          <div className="ccp-section">
            <div className="ccp-section-header">
              <Mic size={18} />
              <h3>{t.masterScript}</h3>
              <CopyButton text={recipe.voiceover_script} label={t.copyFullScript} />
            </div>
            <div className="ccp-script-box">
              <p className="ccp-script-text">{recipe.voiceover_script}</p>
            </div>
          </div>

          {recipe.publishing_payload && (
            <div className="ccp-section ccp-social-tabs-section">
              <div className="ccp-platform-tabs">
                {PLATFORMS.map(p => {
                  const Icon = p.icon
                  return (
                    <button
                      key={p.id}
                      className={`ccp-platform-tab ${activePlatform === p.id ? 'active' : ''}`}
                      onClick={() => { setActivePlatform(p.id); trackPlatformViewed(p.id) }}
                      style={activePlatform === p.id ? { borderColor: p.color, color: p.color } : {}}
                    >
                      <Icon size={14} />
                      <span>{p.label}</span>
                    </button>
                  )
                })}
              </div>

              <div className="ccp-platform-content">
                {getPlatformContent(activePlatform, recipe.publishing_payload)}
              </div>
            </div>
          )}

          <div className="ccp-section ccp-action-hub">
            <div className="ccp-section-header">
              <Zap size={18} />
              <h3>{t.actionHub}</h3>
            </div>

            <a
              href={isMobile ? 'capcut://com.lemon.lvoverseas' : 'https://www.capcut.com/editor?enter_from=link'}
              target={isMobile ? undefined : '_blank'}
              rel={isMobile ? undefined : 'noopener noreferrer'}
              className="ccp-action-primary"
              onClick={() => {
                trackCapCutTriggered()
                trackExportToTool('capcut', topic)
              }}
            >
              <Video size={20} />
              <div>
                <span className="ccp-action-label">{t.capcutPrimary}</span>
                <span className="ccp-action-sub">{t.capcutSub}</span>
              </div>
              <ExternalLink size={16} />
            </a>

            <div className="ccp-free-guard">{t.freeTip}</div>

            <div className="ccp-capcut-links-secondary">
              <a href="capcut://" className="ccp-capcut-btn-sm mobile" onClick={() => trackExportToTool('capcut', topic)}>
                <Smartphone size={16} /> {t.capcutMobile}
              </a>
              <a href="https://capcut.com" target="_blank" rel="noopener noreferrer" className="ccp-capcut-btn-sm desktop" onClick={() => trackExportToTool('capcut', topic)}>
                <Monitor size={16} /> {t.capcutDesktop}
              </a>
            </div>
            <p className="ccp-capcut-hint">{t.capcutHint}</p>

            <div style={{ marginTop: '1rem', textAlign: 'center' }}>
              {!published ? (
                <button
                  className="btn btn-outline"
                  onClick={() => {
                    trackPublishConfirmed(topic, 'tiktok')
                    setPublished(true)
                  }}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#16a34a', borderColor: '#16a34a' }}
                >
                  <Check size={14} /> {isDE ? 'Veröffentlicht markieren' : 'Mark as published'}
                </button>
              ) : (
                <span style={{ color: '#16a34a', fontSize: '0.85rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                  <Check size={14} /> {isDE ? 'Als veröffentlicht markiert' : 'Marked as published'}
                </span>
              )}
            </div>
          </div>

          <div className="ccp-section">
            <div className="ccp-section-header">
              <Image size={18} />
              <h3>{t.scenesPrompts}</h3>
            </div>
            <div className="ccp-scenes-list">
              {recipe.scenes.map((scene, i) => (
                <SceneCard
                  key={i}
                  scene={scene}
                  index={i}
                  t={t}
                  showUpload={showUploadPrompt}
                  mediaData={scenesWithMedia[i] || null}
                  onUpload={(e) => handleMediaUpload(i, e)}
                  onRemove={() => removeMedia(i)}
                />
              ))}
            </div>
          </div>

          {scenesWithMedia.filter(s => s?.mediaUrl).length > 0 && (
            <div className="ccp-export-panel">
              <div className="ccp-export-header">
                <FileArchive size={20} />
                <h3>{t.capcut.exportPanelTitle}</h3>
              </div>
              <div className="ccp-export-actions">
                <button className="ccp-export-btn" onClick={handleCopyScript}>
                  <Copy size={18} />
                  <div>
                    <span className="ccp-export-btn-label">{t.capcut.btnCopyScript}</span>
                    <span className="ccp-export-btn-desc">{t.capcut.btnCopyScriptDesc}</span>
                  </div>
                </button>
                <button className="ccp-export-btn" onClick={handleDownloadZip} disabled={isZipping}>
                  <Download size={18} />
                  <div>
                    <span className="ccp-export-btn-label">
                      {isZipping ? t.capcut.zippingProgress : t.capcut.btnDownloadZip}
                    </span>
                    <span className="ccp-export-btn-desc">{t.capcut.btnDownloadZipDesc}</span>
                  </div>
                </button>
                <button className="ccp-export-btn" onClick={handleDownloadDraft}>
                  <FileArchive size={18} />
                  <div>
                    <span className="ccp-export-btn-label">{t.capcut.btnDownloadDraft}</span>
                    <span className="ccp-export-btn-desc">{t.capcut.btnDownloadDraftDesc}</span>
                  </div>
                </button>
              </div>
              <div className="ccp-export-guide">
                <h4>{t.capcut.guideTitle}</h4>
                <p>{t.capcut.guideStep1}</p>
                <p>{t.capcut.guideStep2}</p>
                <p>{t.capcut.guideStep3}</p>
                <p>{t.capcut.guideStep4}</p>
                <p>{t.capcut.guideStep5}</p>
              </div>
            </div>
          )}

          <div className="ccp-section">
            <div className="ccp-section-header">
              <Lightbulb size={18} />
              <h3>{t.guide}</h3>
            </div>
            <div className="ccp-guide">
              <div className="ccp-guide-step">
                <span className="ccp-guide-num">1</span>
                <p><strong>{isDE ? 'Skript kopieren' : 'Copy script'}</strong> — {t.guideStep1}</p>
              </div>
              <div className="ccp-guide-step">
                <span className="ccp-guide-num">2</span>
                <p><strong>{isDE ? 'Prompts für Bilder' : 'Prompts for images'}</strong> — {t.guideStep2}</p>
              </div>
              <div className="ccp-guide-step">
                <span className="ccp-guide-num">3</span>
                <p><strong>{isDE ? 'In CapCut zusammensetzen' : 'Assemble in CapCut'}</strong> — {t.guideStep3}</p>
              </div>
              <div className="ccp-guide-step">
                <span className="ccp-guide-num">4</span>
                <p><strong>{isDE ? 'Publishing-Texte nutzen' : 'Use publishing texts'}</strong> — {t.guideStep4}</p>
              </div>
            </div>
          </div>

          <div className="ccp-result-actions">
            <button
              className="ccp-btn-outline"
              onClick={() => {
                setRecipe(null)
                setError('')
                setShowSuccess(false)
                setActivePlatform('tiktok_instagram')
              }}
            >
              <RotateCcw size={16} /> {t.newRecipe}
            </button>
          </div>
        </div>
      )}
      {toast && (
        <div className="ccp-toast">{toast}</div>
      )}
    </div>
  )
}

function SceneCard({ scene, index, t, showUpload, mediaData, onUpload, onRemove }) {
  const [expanded, setExpanded] = useState(false)
  const fileInputRef = useRef(null)

  return (
    <div className="ccp-scene-card">
      <div className="ccp-scene-header" onClick={() => setExpanded(!expanded)}>
        <div className="ccp-scene-left">
          <span className="ccp-scene-num">{index + 1}</span>
          <div className="ccp-scene-info">
            <span className="ccp-scene-timestamp">{scene.timestamp}</span>
            <span className="ccp-scene-spoken">{scene.spoken_text.substring(0, 60)}{scene.spoken_text.length > 60 ? '...' : ''}</span>
          </div>
        </div>
        {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </div>

      {expanded && (
        <div className="ccp-scene-body">
          <div className="ccp-scene-section">
            <h4>{t.spokenText}</h4>
            <p>{scene.spoken_text}</p>
          </div>
          <div className="ccp-scene-section">
            <div className="ccp-scene-prompt-header">
              <h4>{t.visualPrompt}</h4>
              <CopyButton text={scene.visual_prompt} label={t.promptCopy} />
            </div>
            <div className="ccp-scene-prompt">
              <code>{scene.visual_prompt}</code>
            </div>
          </div>

          {showUpload && (
            <div className="ccp-scene-upload">
              <h4>{t.capcut.sceneTitle} {index + 1}</h4>
              {!mediaData?.mediaUrl ? (
                <div className="ccp-upload-area" onClick={() => fileInputRef.current?.click()}>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    style={{ display: 'none' }}
                    onChange={onUpload}
                  />
                  <Upload size={20} />
                  <span>{t.capcut.btnUploadPhoto}</span>
                </div>
              ) : (
                <div className="ccp-upload-preview">
                  <img src={mediaData.mediaUrl} alt={`Scene ${index + 1}`} className="ccp-upload-thumb" />
                  <div className="ccp-upload-info">
                    <span className="ccp-upload-name">{mediaData.mediaName}</span>
                    {mediaData.uploading ? (
                      <div className="ccp-upload-progress">
                        <div className="ccp-upload-progress-bar">
                          <div className="ccp-upload-progress-fill" style={{ width: `${mediaData.uploadProgress || 0}%` }} />
                        </div>
                        <span className="ccp-upload-status">{isDE ? 'Wird hochgeladen...' : 'Uploading...'}</span>
                      </div>
                    ) : mediaData.cloudUrl ? (
                      <span className="ccp-upload-success">{isDE ? '✓ In der Cloud gespeichert' : '✓ Saved to cloud'}</span>
                    ) : mediaData.uploadError ? (
                      <span className="ccp-upload-error">{isDE ? '✗ Upload fehlgeschlagen' : '✗ Upload failed'}</span>
                    ) : null}
                    <button className="ccp-upload-remove" onClick={onRemove}>
                      <X size={14} /> {isDE ? 'Entfernen' : 'Remove'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
