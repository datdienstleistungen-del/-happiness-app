import { useState, useRef, useEffect, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'
import { useLanguage } from '../i18n/translations'
import { getFFmpeg, downloadBlob } from '../lib/ffmpeg'
import './VideoMakerPage.css'

const FILTERS = [
  { id: 'none', label: 'Original', css: 'none' },
  { id: 'warm', label: 'Waerme', css: 'sepia(0.3) saturate(1.4) brightness(1.1)' },
  { id: 'cold', label: 'Kalt', css: 'saturate(0.8) hue-rotate(20deg) brightness(1.05)' },
  { id: 'vintage', label: 'Vintage', css: 'sepia(0.5) contrast(1.1) brightness(0.9)' },
  { id: 'bw', label: 'S/W', css: 'grayscale(1) contrast(1.2)' },
  { id: 'vivid', label: 'Lebhaft', css: 'saturate(1.8) contrast(1.1) brightness(1.05)' },
  { id: 'film', label: 'Film', css: 'contrast(1.2) saturate(0.9) brightness(0.95) sepia(0.1)' },
  { id: 'dramatic', label: 'Dramatisch', css: 'contrast(1.4) brightness(0.85) saturate(0.7)' },
]

const ANIMATION_PRESETS = [
  { id: 'none', label: 'Keine', type: 'none' },
  { id: 'fade', label: 'Fade In/Out', type: 'fade' },
  { id: 'slide-up', label: 'Slide Up', type: 'slide', direction: 'up' },
  { id: 'slide-down', label: 'Slide Down', type: 'slide', direction: 'down' },
  { id: 'slide-left', label: 'Slide Left', type: 'slide', direction: 'left' },
  { id: 'slide-right', label: 'Slide Right', type: 'slide', direction: 'right' },
  { id: 'scale', label: 'Zoom In/Out', type: 'scale' },
  { id: 'typewriter', label: 'Typewriter', type: 'typewriter' },
  { id: 'bounce', label: 'Bounce', type: 'bounce' },
  { id: 'rotate', label: 'Rotate In', type: 'rotate' },
]

// Sticker/Emoji/Shape Constants
const EMOJI_CATEGORIES = {
  'Gesichter': ['😀','😃','😄','😁','😆','😅','😂','🤣','😊','😇','🙂','🙃','😉','😌','😍','🥰','😘','😗','😙','😚','😋','😛','😝','😜','🤪','🤨','🧐','🤓','😎','🤩','🥳','😏','😒','😞','😔','😟','😕','🙁','☹','😣','😖','😫','😩','🥺','😢','😭','😤','😠','😡','🤬','🤯','😳','🥵','🥶','😱','😨','😰','😥','😓','🤗','🤔','🤭','🤫','🤥','😶','😐','😑','😬','🙄','😯','😦','😧','😮','😲','🥱','😴','🤤','😪','😵','🤐','🥴','🤢','🤮','🤧','😷','🤒','🤕','🤑','🤠','😈','👿','👹','👺','🤡','💩','👻','💀','☠','👽','👾','🤖','🎃','😺','😸','😹','😻','😼','😽','🙀','😿','😾'],
  'Hände': ['👋','🤚','🖐','✋','🖖','👌','🤌','🤏','✌','🤞','🤟','🤘','🤙','👈','👉','👆','🖕','👇','☝','👍','👎','✊','👊','🤛','🤜','👏','🙌','👐','🤲','🤝','🙏','✍','💅','🤳','💪','🦾','🦿','🦵','🦶','👂','🦻','👃','🧠','🫀','🫁','🦷','🦴','👀','👁','👅','👄','🫦'],
  'Sachen': ['❤','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💔','❣','💕','💞','💓','💗','💖','💘','💝','💟','☮','✝','☪','🕉','☸','✡','🔯','🕎','☯','☦','🛐','⛎','♈','♉','♊','♋','♌','♍','♎','♏','♐','♑','♒','♓','⛎','🔯','🕎','🔯'],
  'Essen': ['🍏','🍎','🍐','🍊','🍋','🍌','🍉','🍇','🍓','🫐','🍈','🍒','🍑','🥭','🍍','🥥','🥝','🍅','🍆','🥑','🥦','🥬','🥒','🌶','🫑','🌽','🥕','🫒','🧄','🧅','🥔','🍠','🥐','🥯','🍞','🥖','🥨','🧀','🥚','🍳','🧈','🥞','🧇','🥓','🥩','🍗','🍖','🦴','🌭','🍔','🍟','🍕','🥪','🥙','🧆','🌮','🌯','🫔','🥗','🥘','🥫','🍝','🍜','🍲','🍛','🍣','🍱','🥟','🦪','🍤','🍙','🍚','🍘','🍥','🥮','🍢','🍡','🥧','🍰','🎂','🍮','🍭','🍬','🍫','🍿','🍩','🍪','🌰','🥜','🍯','🥛','🍼','☕','🍵','🧃','🥤','🍶','🍺','🍻','🥂','🍷','🥃','🍸','🍹','🧉','🍾','🧊','🥄','🍴','🍽','🥣','🥢','🥤'],
  'Aktivitäten': ['⚽','🏀','🏈','⚾','🥎','🎾','🏐','🏉','🎱','🪀','🏓','🏸','🏒','🏑','🏏','🪃','🥅','🪁','🏹','🎣','🤿','🥽','🎽','🎿','🛷','🥌','🎯','🪂','🧗','🤺','🏇','⛷','🏂','🏄','🏊','🤽','🚣','🧘','🛀','🛌','🤸','🤾','⛹','🏋','🚴','🚵','🏎','🏍','🛹','🛷','⛸','🥌','🎿','🛹','🛼'],
  'Reisen': ['🚗','🚕','🚙','🚌','🚎','🏎','🚓','🚑','🚒','🚐','🛻','🚚','🚛','🚜','🦯','🦽','🦼','🛴','🚲','🛵','🏍','🛺','🚨','🚔','🚍','🚘','🚖','🚡','🚠','🚟','🚃','🚋','🚞','🚝','🚄','🚅','🚈','🚂','🚆','🚇','🚊','🚉','✈','🛫','🛬','🛩','🪂','🛰','🚀','🛸','🚁','🛶','⛵','🚤','🛥','🛳','⛴','🚢','🏝','🏖','🏜','🌋','⛰','🏔','🗻','🏕','⛺','🏖','🏝','🏟','🏛','🏗','🏘','🏙','🏚','🏠','🏡','🏢','🏣','🏤','🏥','🏦','🏨','🏩','🏪','🏫','🏬','🏭','🏯','🏰','💒','🗼','🗽','⛪','🕌','🕍','⛩','🕋','⛲','⛱','🏞','🌅','🌄','🌠','🎆','🎇','🎑','🌉','♨','🎠','🎡','🎢','💈','🎪','🎭','🏰','🏯','🗼','⛩','🏛'],
}

const SHAPES = [
  { id: 'circle', label: 'Kreis', svg: '<circle cx="50" cy="50" r="45" fill="currentColor" />' },
  { id: 'square', label: 'Quadrat', svg: '<rect x="10" y="10" width="80" height="80" fill="currentColor" />' },
  { id: 'triangle', label: 'Dreieck', svg: '<polygon points="50,10 90,90 10,90" fill="currentColor" />' },
  { id: 'star', label: 'Stern', svg: '<polygon points="50,5 61,35 95,35 68,57 79,90 50,75 21,90 32,57 5,35 39,35" fill="currentColor" />' },
  { id: 'heart', label: 'Herz', svg: '<path d="M50 90 C50 90 10 55 10 30 C10 10 30 10 50 25 C70 10 90 10 90 30 C90 55 50 90 50 90 Z" fill="currentColor" />' },
  { id: 'arrow-up', label: 'Pfeil ↑', svg: '<polygon points="50,10 90,70 70,70 70,90 30,90 30,70 10,70" fill="currentColor" />' },
  { id: 'arrow-down', label: 'Pfeil ↓', svg: '<polygon points="50,90 10,30 30,30 30,10 70,10,10 70,30 90,30" fill="currentColor" />' },
  { id: 'arrow-left', label: 'Pfeil ←', svg: '<polygon points="10,50 70,10 70,30 90,30 90,70 70,70 70,90" fill="currentColor" />' },
  { id: 'arrow-right', label: 'Pfeil →', svg: '<polygon points="90,50 30,10 30,30 10,30 10,70 30,70 30,90" fill="currentColor" />' },
  { id: 'check', label: 'Haken', svg: '<polyline points="20,50 45,75 80,20" fill="none" stroke="currentColor" stroke-width="12" stroke-linecap="round" stroke-linejoin="round" />' },
  { id: 'cross', label: 'Kreuz', svg: '<line x1="15" y1="15" x2="85" y2="85" stroke="currentColor" stroke-width="12" stroke-linecap="round" /><line x1="85" y1="15" x2="15" y2="85" stroke="currentColor" stroke-width="12" stroke-linecap="round" />' },
  { id: 'speech', label: 'Sprechblase', svg: '<path d="M10 30 L10 75 L25 75 L40 90 L55 75 L90 75 L90 25 L10 25 Z" fill="currentColor" />' },
  { id: 'thought', label: 'Gedankenblase', svg: '<circle cx="70" cy="25" r="15" fill="currentColor" /><circle cx="55" cy="40" r="10" fill="currentColor" /><circle cx="40" cy="50" r="7" fill="currentColor" /><path d="M10 30 L10 75 L25 75 L30 90 L45 75 L90 75 L90 25 L10 25 Z" fill="currentColor" />' },
  { id: 'lightning', label: 'Blitz', svg: '<polygon points="50,10 70,50 55,50 65,90 30,50 45,50 30,10" fill="currentColor" />' },
]

const STICKER_COLORS = ['#ffffff', '#ff6b6b', '#4ecdc4', '#ffe66d', '#a8e6cf', '#ff8b94', '#96ceb4', '#ffcc5c', '#88d8b0', '#ffaaa5']

const isMobile = () => /Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)

const getAspectRatios = () => {
  const mobile = isMobile()
  return [
    { id: '16:9', label: 'Landscape (16:9)', width: mobile ? 1280 : 1920, height: mobile ? 720 : 1080 },
    { id: '9:16', label: 'Vertical (9:16)', width: mobile ? 720 : 1080, height: mobile ? 1280 : 1920 },
    { id: '1:1', label: 'Quadrat (1:1)', width: mobile ? 720 : 1080, height: mobile ? 720 : 1080 },
    { id: '4:5', label: 'Instagram (4:5)', width: mobile ? 720 : 1080, height: mobile ? 900 : 1350 },
  ]
}

export default function VideoMakerPage() {
  const { t } = useLanguage()
  const { user } = useAuth()
  const videoRef = useRef(null)
  const fileInputRef = useRef(null)
  const audioInputRef = useRef(null)
  const timelineRef = useRef(null)

  const [videoFile, setVideoFile] = useState(null)
  const [videoUrl, setVideoUrl] = useState(null)
  const [videoDuration, setVideoDuration] = useState(0)
  const [videoLoaded, setVideoLoaded] = useState(false)
  const [videoError, setVideoError] = useState(null)

  const [trimStart, setTrimStart] = useState(0)
  const [trimEnd, setTrimEnd] = useState(100)
  const [currentTime, setCurrentTime] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)

  const [filter, setFilter] = useState('none')
  const [aspectRatio, setAspectRatio] = useState('16:9')

  const [textOverlays, setTextOverlays] = useState([])
  const [activeTextId, setActiveTextId] = useState(null)
  const [showTextPanel, setShowTextPanel] = useState(false)
  const [activeAnimTab, setActiveAnimTab] = useState('presets') // 'presets' | 'keyframes'
  const [editingKeyframeIndex, setEditingKeyframeIndex] = useState(null)
  const [keyframeTime, setKeyframeTime] = useState(0)
  const [keyframeOpacity, setKeyframeOpacity] = useState(1)
  const [keyframeTransform, setKeyframeTransform] = useState('')

  // Sticker/Emoji/Shape Overlays
  const [overlays, setOverlays] = useState([])
  const [activeOverlayId, setActiveOverlayId] = useState(null)
  const [stickerInputRef, setStickerInputRef] = useState(null)
  const [activeStickerTab, setActiveStickerTab] = useState('emoji') // 'emoji' | 'shapes' | 'images'

  const [audioFile, setAudioFile] = useState(null)
  const [audioUrl, setAudioUrl] = useState(null)
  const [audioVolume, setAudioVolume] = useState(70)
  const [originalVolume, setOriginalVolume] = useState(100)

  const [brightness, setBrightness] = useState(100)
  const [contrast, setContrast] = useState(100)
  const [saturation, setSaturation] = useState(100)

  const [isExporting, setIsExporting] = useState(false)
  const [exportProgress, setExportProgress] = useState(0)
  const [activeTab, setActiveTab] = useState('trim')

  const ffmpegRef = useRef(null)
  const [ffmpegLoaded, setFfmpegLoaded] = useState(false)
  const [ffmpegLoading, setFfmpegLoading] = useState(false)

  const handleVideoUpload = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setVideoFile(file)
    const url = URL.createObjectURL(file)
    setVideoUrl(url)
    setVideoLoaded(false)
    setTextOverlays([])
    setFilter('none')
    setBrightness(100)
    setContrast(100)
    setSaturation(100)
  }

  const handleVideoLoaded = () => {
    const v = videoRef.current
    if (!v) return
    setVideoDuration(v.duration)
    setTrimEnd(100)
    setVideoLoaded(true)
    v.currentTime = 0
  }

  const handleTimeUpdate = () => {
    const v = videoRef.current
    if (!v) return
    setCurrentTime(v.currentTime)

    const startSec = (trimStart / 100) * videoDuration
    const endSec = (trimEnd / 100) * videoDuration
    if (v.currentTime >= endSec) {
      v.pause()
      setIsPlaying(false)
    }
  }

  const togglePlay = () => {
    const v = videoRef.current
    if (!v) return
    if (isPlaying) {
      v.pause()
    } else {
      const startSec = (trimStart / 100) * videoDuration
      if (v.currentTime < startSec || v.currentTime >= (trimEnd / 100) * videoDuration) {
        v.currentTime = startSec
      }
      v.play()
    }
    setIsPlaying(!isPlaying)
  }

  const seekTo = (e) => {
    const v = videoRef.current
    if (!v) return
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left
    const percent = x / rect.width
    v.currentTime = percent * videoDuration
  }

  const addTextOverlay = () => {
    const id = Date.now()
    setTextOverlays(prev => [...prev, {
      id,
      text: 'Text hier',
      x: 50,
      y: 50,
      fontSize: 36,
      color: '#ffffff',
      fontWeight: 'bold',
      opacity: 100,
      shadow: true,
      // Animation properties
      animation: {
        preset: 'fade',
        keyframes: [
          { time: 0, opacity: 0, transform: 'translateY(20px) scale(0.9)' },
          { time: 0.5, opacity: 1, transform: 'translateY(0) scale(1)' },
          { time: 1, opacity: 1, transform: 'translateY(0) scale(1)' },
        ]
      }
    }])
    setActiveTextId(id)
    setShowTextPanel(true)
    setActiveTab('text')
  }

  const updateTextOverlay = (id, field, value) => {
    setTextOverlays(prev => prev.map(t => t.id === id ? { ...t, [field]: value } : t))
  }

  const removeTextOverlay = (id) => {
    setTextOverlays(prev => prev.filter(t => t.id !== id))
    if (activeTextId === id) setActiveTextId(null)
  }

  const handleAudioUpload = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setAudioFile(file)
    setAudioUrl(URL.createObjectURL(file))
  }

  // Animation helpers
  const getTextAnimation = (id) => {
    const overlay = textOverlays.find(t => t.id === id)
    return overlay?.animation || { preset: 'fade', keyframes: [] }
  }

  const updateTextAnimation = (id, animUpdate) => {
    setTextOverlays(prev => prev.map(t => 
      t.id === id ? { ...t, animation: { ...t.animation, ...animUpdate } } : t
    ))
  }

  const getPresetIcon = (presetId) => {
    const icons = {
      none: '✕',
      fade: '⚬',
      'slide-up': '⬆',
      'slide-down': '⬇',
      'slide-left': '⬅',
      'slide-right': '➡',
      scale: '🔍',
      typewriter: '⌨',
      bounce: '⚽',
      rotate: '🔄',
    }
    return icons[presetId] || '✦'
  }

  const applyAnimationPreset = (presetId) => {
    const presets = {
      fade: {
        keyframes: [
          { time: 0, opacity: 0, transform: 'translateY(0) scale(1)' },
          { time: 0.3, opacity: 1, transform: 'translateY(0) scale(1)' },
          { time: 0.7, opacity: 1, transform: 'translateY(0) scale(1)' },
          { time: 1, opacity: 0, transform: 'translateY(0) scale(1)' },
        ]
      },
      'slide-up': {
        keyframes: [
          { time: 0, opacity: 0, transform: 'translateY(30px) scale(1)' },
          { time: 0.4, opacity: 1, transform: 'translateY(0) scale(1)' },
          { time: 0.6, opacity: 1, transform: 'translateY(0) scale(1)' },
          { time: 1, opacity: 0, transform: 'translateY(-20px) scale(1)' },
        ]
      },
      'slide-down': {
        keyframes: [
          { time: 0, opacity: 0, transform: 'translateY(-30px) scale(1)' },
          { time: 0.4, opacity: 1, transform: 'translateY(0) scale(1)' },
          { time: 0.6, opacity: 1, transform: 'translateY(0) scale(1)' },
          { time: 1, opacity: 0, transform: 'translateY(20px) scale(1)' },
        ]
      },
      'slide-left': {
        keyframes: [
          { time: 0, opacity: 0, transform: 'translateX(-40px) scale(1)' },
          { time: 0.4, opacity: 1, transform: 'translateX(0) scale(1)' },
          { time: 0.6, opacity: 1, transform: 'translateX(0) scale(1)' },
          { time: 1, opacity: 0, transform: 'translateX(30px) scale(1)' },
        ]
      },
      'slide-right': {
        keyframes: [
          { time: 0, opacity: 0, transform: 'translateX(40px) scale(1)' },
          { time: 0.4, opacity: 1, transform: 'translateX(0) scale(1)' },
          { time: 0.6, opacity: 1, transform: 'translateX(0) scale(1)' },
          { time: 1, opacity: 0, transform: 'translateX(-30px) scale(1)' },
        ]
      },
      scale: {
        keyframes: [
          { time: 0, opacity: 0, transform: 'scale(0.5)' },
          { time: 0.3, opacity: 1, transform: 'scale(1.1)' },
          { time: 0.5, opacity: 1, transform: 'scale(1)' },
          { time: 1, opacity: 0, transform: 'scale(1.5)' },
        ]
      },
      typewriter: {
        keyframes: [
          { time: 0, opacity: 0, transform: 'scale(1)' },
          { time: 0.05, opacity: 1, transform: 'scale(1)' },
          { time: 0.95, opacity: 1, transform: 'scale(1)' },
          { time: 1, opacity: 0, transform: 'scale(1)' },
        ]
      },
      bounce: {
        keyframes: [
          { time: 0, opacity: 0, transform: 'translateY(50px) scale(0.8)' },
          { time: 0.2, opacity: 1, transform: 'translateY(-10px) scale(1.05)' },
          { time: 0.4, opacity: 1, transform: 'translateY(0) scale(1)' },
          { time: 0.6, opacity: 1, transform: 'translateY(-5px) scale(1.02)' },
          { time: 1, opacity: 0, transform: 'translateY(0) scale(1)' },
        ]
      },
      rotate: {
        keyframes: [
          { time: 0, opacity: 0, transform: 'rotate(-90deg) scale(0.5)' },
          { time: 0.4, opacity: 1, transform: 'rotate(0deg) scale(1.1)' },
          { time: 0.6, opacity: 1, transform: 'rotate(0deg) scale(1)' },
          { time: 1, opacity: 0, transform: 'rotate(90deg) scale(0.5)' },
        ]
      },
    }
    return presets[presetId] || presets.fade
  }

  // Keyframe editor handlers
  const openKeyframeEditor = (index) => {
    const anim = getTextAnimation(activeTextId)
    const kf = anim.keyframes?.[index]
    if (kf) {
      setEditingKeyframeIndex(index)
      setKeyframeTime(kf.time)
      setKeyframeOpacity(kf.opacity)
      setKeyframeTransform(kf.transform || '')
    }
  }

  const handleTimelineClick = (e) => {
    if (!activeTextId || editingKeyframeIndex !== null) return
    const rect = timelineRef.current?.getBoundingClientRect()
    if (!rect) return
    const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width))
    const time = x / rect.width
    const anim = getTextAnimation(activeTextId)
    const newKeyframe = { time, opacity: 1, transform: 'translateY(0) scale(1)' }
    const keyframes = [...(anim.keyframes || []), newKeyframe].sort((a, b) => a.time - b.time)
    updateTextAnimation(activeTextId, { keyframes })
  }

  const saveKeyframe = () => {
    if (editingKeyframeIndex === null || !activeTextId) return
    const anim = getTextAnimation(activeTextId)
    const keyframes = [...(anim.keyframes || [])]
    keyframes[editingKeyframeIndex] = { time: keyframeTime, opacity: keyframeOpacity, transform: keyframeTransform }
    keyframes.sort((a, b) => a.time - b.time)
    updateTextAnimation(activeTextId, { keyframes })
    setEditingKeyframeIndex(null)
  }

  const deleteKeyframe = () => {
    if (editingKeyframeIndex === null || !activeTextId) return
    const anim = getTextAnimation(activeTextId)
    const keyframes = (anim.keyframes || []).filter((_, i) => i !== editingKeyframeIndex)
    updateTextAnimation(activeTextId, { keyframes })
    setEditingKeyframeIndex(null)
  }

  const applyPresetToActive = (presetId) => {
    if (!activeTextId) return
    const preset = applyAnimationPreset(presetId)
    updateTextAnimation(activeTextId, { preset: presetId, keyframes: preset.keyframes })
  }

  const getFilterCSS = () => {
    const f = FILTERS.find(fi => fi.id === filter)
    const custom = `brightness(${brightness / 100}) contrast(${contrast / 100}) saturate(${saturation / 100})`
    return f?.css !== 'none' ? `${f.css} ${custom}` : custom
  }

  // Sticker/Emoji/Shape Overlay Functions
  const addEmojiOverlay = (emoji) => {
    const id = Date.now()
    setOverlays(prev => [...prev, {
      id,
      type: 'emoji',
      content: emoji,
      x: 50,
      y: 50,
      size: 60,
      color: '#ffffff',
      opacity: 100,
      rotation: 0,
      animation: { preset: 'fade', keyframes: [
        { time: 0, opacity: 0, transform: 'translateY(20px) scale(0.9)' },
        { time: 0.5, opacity: 1, transform: 'translateY(0) scale(1)' },
        { time: 1, opacity: 1, transform: 'translateY(0) scale(1)' },
      ]}
    }])
    setActiveOverlayId(id)
  }

  const addShapeOverlay = (shape) => {
    const id = Date.now()
    setOverlays(prev => [...prev, {
      id,
      type: 'shape',
      shape: shape.id,
      x: 50,
      y: 50,
      size: 80,
      color: '#ffffff',
      opacity: 100,
      rotation: 0,
      animation: { preset: 'fade', keyframes: [
        { time: 0, opacity: 0, transform: 'translateY(20px) scale(0.9)' },
        { time: 0.5, opacity: 1, transform: 'translateY(0) scale(1)' },
        { time: 1, opacity: 1, transform: 'translateY(0) scale(1)' },
      ]}
    }])
    setActiveOverlayId(id)
  }

  const handleStickerUpload = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) return
    const id = Date.now()
    const url = URL.createObjectURL(file)
    setOverlays(prev => [...prev, {
      id,
      type: 'image',
      imageUrl: url,
      x: 50,
      y: 50,
      size: 100,
      opacity: 100,
      rotation: 0,
      animation: { preset: 'fade', keyframes: [
        { time: 0, opacity: 0, transform: 'translateY(20px) scale(0.9)' },
        { time: 0.5, opacity: 1, transform: 'translateY(0) scale(1)' },
        { time: 1, opacity: 1, transform: 'translateY(0) scale(1)' },
      ]}
    }])
    setActiveOverlayId(id)
    if (stickerInputRef.current) stickerInputRef.current.value = ''
  }

  const updateOverlay = (id, field, value) => {
    setOverlays(prev => prev.map(o => o.id === id ? { ...o, [field]: value } : o))
  }

  const removeOverlay = (id) => {
    setOverlays(prev => prev.filter(o => o.id !== id))
    if (activeOverlayId === id) setActiveOverlayId(null)
  }

  const getOverlayAnimation = (id) => {
    const overlay = overlays.find(o => o.id === id)
    return overlay?.animation || { preset: 'fade', keyframes: [] }
  }

  const updateOverlayAnimation = (id, animUpdate) => {
    setOverlays(prev => prev.map(o => 
      o.id === id ? { ...o, animation: { ...o.animation, ...animUpdate } } : o
    ))
  }

  const applyPresetToOverlay = (presetId) => {
    if (!activeOverlayId) return
    const preset = applyAnimationPreset(presetId)
    updateOverlayAnimation(activeOverlayId, { preset: presetId, keyframes: preset.keyframes })
  }

  const loadFFmpeg = async () => {
    if (ffmpegRef.current) return ffmpegRef.current
    setFfmpegLoading(true)
    const ffmpeg = await getFFmpeg()
    ffmpegRef.current = ffmpeg

    ffmpeg.on('log', ({ message }) => {
      console.log('[FFmpeg]', message)
    })

    ffmpeg.on('progress', ({ progress }) => {
      setExportProgress(Math.round(progress * 100))
    })

    setFfmpegLoaded(true)
    setFfmpegLoading(false)
    return ffmpeg
  }

  const downloadVideo = (blob) => {
    downloadBlob(blob, `happiness-video-${Date.now()}.mp4`)
  }

  // Helper to generate drawtext filter with animation support
  const buildDrawTextFilter = (overlay, clipDuration) => {
    const cw = videoRef.current?.videoWidth || 1920
    const ch = videoRef.current?.videoHeight || 1080
    const x = (overlay.x / 100) * cw
    const y = (overlay.y / 100) * ch
    const escaped = overlay.text.replace(/'/g, "\\'").replace(/:/g, "\\:")
    const baseParams = `text='${escaped}':x=${x}:y=${y}:fontsize=${overlay.fontSize * 2}:fontcolor=${overlay.color}:shadowcolor=black:shadowx=2:shadowy=2:alpha=${overlay.opacity / 100}`
    
    const anim = overlay.animation
    if (!anim || !anim.keyframes || anim.keyframes.length < 2) {
      // No animation or insufficient keyframes
      return `drawtext=${baseParams}`
    }
    
    // Build drawtext with enable expressions for each keyframe segment
    const keyframes = [...anim.keyframes].sort((a, b) => a.time - b.time)
    const drawtextFilters = []
    
    for (let i = 0; i < keyframes.length - 1; i++) {
      const kf1 = keyframes[i]
      const kf2 = keyframes[i + 1]
      const startTime = kf1.time * clipDuration
      const endTime = kf2.time * clipDuration
      const duration = endTime - startTime
      
      if (duration <= 0) continue
      
      // Interpolate opacity and transform
      const opacityExpr = `lerp(${kf1.opacity}, ${kf2.opacity}, (t-${startTime})/${duration})`
      const transform = kf2.transform || 'translateY(0) scale(1)'
      
      // For simplicity, use enable with static values per segment
      // FFmpeg drawtext doesn't easily support animated transform, so we approximate
      const filter = `drawtext=${baseParams}:enable='between(t,${startTime.toFixed(3)},${endTime.toFixed(3)})':alpha=${kf2.opacity}`
      drawtextFilters.push(filter)
    }
    
    return drawtextFilters.join(',')
  }

  const exportVideo = async () => {
    if (!videoRef.current || !videoLoaded || !videoFile) return
    
    setIsExporting(true)
    setExportProgress(0)
    
    try {
      const ffmpeg = await loadFFmpeg()
      
      // Write input file
      await ffmpeg.writeFile('input.mp4', await fetchFile(videoFile))
      
      // Build filter chain
      const filters = []
      
      // Color adjustments
      const brightnessVal = (brightness - 100) / 200
      const contrastVal = contrast / 100
      const saturationVal = saturation / 100
      if (brightnessVal !== 0 || contrastVal !== 1 || saturationVal !== 1) {
        filters.push(`eq=brightness=${brightnessVal}:contrast=${contrastVal}:saturation=${saturationVal}`)
      }
      
      // Preset filter
      if (filter !== 'none') {
        const filterMap = {
          warm: 'colorbalance=rs=0.1:gs=0.05:bs=-0.1',
          cold: 'colorbalance=rs=-0.1:gs=0:bs=0.1',
          vintage: 'curves=vintage',
          bw: 'hue=s=0',
          vivid: 'eq=saturation=1.5',
          film: 'curves=vintage,eq=saturation=0.8',
          dramatic: 'eq=contrast=1.3:brightness=-0.05',
        }
        if (filterMap[filter]) filters.push(filterMap[filter])
      }
      
      // Text overlays with animation support
      const clipDuration = (trimEnd / 100) * videoDuration - (trimStart / 100) * videoDuration
      textOverlays.forEach(overlay => {
        const drawtextFilter = buildDrawTextFilter(overlay, clipDuration)
        if (drawtextFilter) filters.push(drawtextFilter)
      })
      
      // Sticker/Emoji/Shape overlays
      overlays.forEach(overlay => {
        if (overlay.type === 'emoji') {
          const drawtextFilter = buildDrawTextFilter({
            ...overlay,
            text: overlay.content,
            fontSize: overlay.size / 2,
            color: overlay.color,
            opacity: overlay.opacity,
            animation: overlay.animation
          }, clipDuration)
          if (drawtextFilter) filters.push(drawtextFilter)
        } else if (overlay.type === 'shape') {
          // Shapes are rendered as emoji-like characters via drawtext
          const shapeChar = { circle: '●', square: '■', triangle: '▲', star: '★', heart: '♥', 'arrow-up': '▲', 'arrow-down': '▼', 'arrow-left': '◀', 'arrow-right': '▶', check: '✓', cross: '✕', speech: '💬', thought: '💭', lightning: '⚡' }[overlay.shape] || '●'
          const drawtextFilter = buildDrawTextFilter({
            ...overlay,
            text: shapeChar,
            fontSize: overlay.size / 2,
            color: overlay.color,
            opacity: overlay.opacity,
            animation: overlay.animation
          }, clipDuration)
          if (drawtextFilter) filters.push(drawtextFilter)
        } else if (overlay.type === 'image') {
          // For images, we'd need to use overlay filter in FFmpeg
          // This is a simplified version - full image overlay requires writing the image file
          console.log('Image overlay export not fully implemented yet:', overlay)
        }
      })
      
      // Build FFmpeg args
      const startSec = (trimStart / 100) * videoDuration
      const endSec = (trimEnd / 100) * videoDuration
      
      const args = ['-i', 'input.mp4', '-ss', String(startSec), '-to', String(endSec)]
      
      if (filters.length > 0) {
        args.push('-vf', filters.join(','))
      }
      
      if (audioUrl && audioFile) {
        await ffmpeg.writeFile('audio.mp3', await fetchFile(audioFile))
        args.push('-i', 'audio.mp3', '-filter_complex', `amix=inputs=2:duration=first:volume=${audioVolume / 100}`, '-c:a', 'aac')
      }
      
      args.push('-c:v', 'libx264', '-preset', 'fast', '-crf', '23', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', 'output.mp4')
      
      await ffmpeg.exec(args)
      
      const data = await ffmpeg.readFile('output.mp4')
      const blob = new Blob([data.buffer], { type: 'video/mp4' })
      
      // Download or share
      if (isMobile() && navigator.share) {
        try {
          const file = new File([blob], 'happiness-video.mp4', { type: 'video/mp4' })
          await navigator.share({ files: [file], title: 'Happiness Video' })
        } catch (shareErr) {
          if (shareErr.name !== 'AbortError') {
            downloadBlob(blob)
          }
        }
      } else {
        downloadBlob(blob)
      }
      
      // Cleanup
      await ffmpeg.deleteFile('input.mp4')
      await ffmpeg.deleteFile('output.mp4')
      if (audioUrl) await ffmpeg.deleteFile('audio.mp3').catch(() => {})
      
    } catch (err) {
      console.error('Export failed:', err)
      setVideoError('Export fehlgeschlagen. Bitte versuche es mit einem kuerzeren Video.')
    } finally {
      setIsExporting(false)
    }
  }

  const formatTime = (sec) => {
    const m = Math.floor(sec / 60)
    const s = Math.floor(sec % 60)
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  return (
    <div className="editor-page">
      <div className="editor-header">
        <h1>CapCut Studio</h1>
        {videoLoaded && (
          <button className="btn btn-export" onClick={exportVideo} disabled={isExporting || ffmpegLoading}>
            {ffmpegLoading ? 'Video-Engine wird geladen...' : isExporting ? `Exportiere... ${Math.round(exportProgress)}%` : 'Video exportieren'}
          </button>
        )}
      </div>

      {!videoUrl ? (
        <div className="upload-area" onClick={() => fileInputRef.current?.click()}>
          <input ref={fileInputRef} type="file" accept="video/*" onChange={handleVideoUpload} style={{ display: 'none' }} />
          <div className="upload-icon">+</div>
          <div className="upload-text">Video hochladen</div>
          <div className="upload-hint">MP4, WebM, MOV</div>
        </div>
      ) : (
        <div className="editor-layout">
          <div className="preview-area">
            <div className="video-container" style={{ aspectRatio: aspectRatio.replace(':', '/') }}>
              <video
                ref={videoRef}
                src={videoUrl}
                onLoadedMetadata={handleVideoLoaded}
                onTimeUpdate={handleTimeUpdate}
                onEnded={() => setIsPlaying(false)}
                onError={(e) => setVideoError('Video konnte nicht geladen werden: ' + (e.target.error?.message || 'Unbekannter Fehler'))}
                className="video-element"
                style={{ filter: getFilterCSS() }}
                playsInline
                preload="auto"
              />
              {textOverlays.map(overlay => (
                <div
                  key={overlay.id}
                  className={`text-overlay ${overlay.id === activeTextId ? 'active' : ''}`}
                  style={{
                    left: `${overlay.x}%`,
                    top: `${overlay.y}%`,
                    fontSize: `${overlay.fontSize}px`,
                    color: overlay.color,
                    fontWeight: overlay.fontWeight,
                    opacity: overlay.opacity / 100,
                    textShadow: overlay.shadow ? '0 2px 10px rgba(0,0,0,0.8)' : 'none',
                  }}
                  onClick={() => { setActiveTextId(overlay.id); setShowTextPanel(true) }}
                >
                  {overlay.text}
                </div>
              ))}
              {overlays.map(overlay => (
                <div
                  key={overlay.id}
                  className={`overlay-item ${overlay.id === activeOverlayId ? 'active' : ''}`}
                  style={{
                    left: `${overlay.x}%`,
                    top: `${overlay.y}%`,
                    transform: `translate(-50%, -50%) rotate(${overlay.rotation}deg)`,
                    opacity: overlay.opacity / 100,
                    cursor: 'move',
                    pointerEvents: 'auto',
                  }}
                  onClick={(e) => { e.stopPropagation(); setActiveOverlayId(overlay.id); }}
                >
                  {overlay.type === 'emoji' && (
                    <span style={{ fontSize: `${overlay.size}px`, filter: `drop-shadow(0 2px 4px rgba(0,0,0,0.3))` }}>
                      {overlay.content}
                    </span>
                  )}
                  {overlay.type === 'shape' && (
                    <svg width={overlay.size} height={overlay.size} style={{ color: overlay.color }}>
                      {SHAPES.find(s => s.id === overlay.shape)?.svg}
                    </svg>
                  )}
                  {overlay.type === 'image' && (
                    <img src={overlay.imageUrl} alt="" style={{ width: overlay.size, height: overlay.size, borderRadius: '8px', objectFit: 'cover' }} />
                  )}
                </div>
              ))}
            </div>

            <div className="timeline-area">
              <div className="timeline-bar" onClick={seekTo} ref={timelineRef}>
                <div className="timeline-progress" style={{ width: `${(currentTime / videoDuration) * 100}%` }} />
                <div className="timeline-trim" style={{ left: `${trimStart}%`, width: `${trimEnd - trimStart}%` }} />
                <div className="timeline-handle left" style={{ left: `${trimStart}%` }}
                  onMouseDown={(e) => {
                    e.stopPropagation()
                    const onMove = (ev) => {
                      const rect = timelineRef.current.getBoundingClientRect()
                      const x = Math.max(0, Math.min(ev.clientX - rect.left, rect.width))
                      setTrimStart((x / rect.width) * 100)
                    }
                    const onUp = () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp) }
                    document.addEventListener('mousemove', onMove)
                    document.addEventListener('mouseup', onUp)
                  }}
                  onTouchStart={(e) => {
                    e.stopPropagation()
                    const onMove = (ev) => {
                      ev.preventDefault()
                      const rect = timelineRef.current.getBoundingClientRect()
                      const x = Math.max(0, Math.min(ev.touches[0].clientX - rect.left, rect.width))
                      setTrimStart((x / rect.width) * 100)
                    }
                    const onEnd = () => { document.removeEventListener('touchmove', onMove); document.removeEventListener('touchend', onEnd) }
                    document.addEventListener('touchmove', onMove, { passive: false })
                    document.addEventListener('touchend', onEnd)
                  }}
                />
                <div className="timeline-handle right" style={{ left: `${trimEnd}%` }}
                  onMouseDown={(e) => {
                    e.stopPropagation()
                    const onMove = (ev) => {
                      const rect = timelineRef.current.getBoundingClientRect()
                      const x = Math.max(0, Math.min(ev.clientX - rect.left, rect.width))
                      setTrimEnd((x / rect.width) * 100)
                    }
                    const onUp = () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp) }
                    document.addEventListener('mousemove', onMove)
                    document.addEventListener('mouseup', onUp)
                  }}
                  onTouchStart={(e) => {
                    e.stopPropagation()
                    const onMove = (ev) => {
                      ev.preventDefault()
                      const rect = timelineRef.current.getBoundingClientRect()
                      const x = Math.max(0, Math.min(ev.touches[0].clientX - rect.left, rect.width))
                      setTrimEnd((x / rect.width) * 100)
                    }
                    const onEnd = () => { document.removeEventListener('touchmove', onMove); document.removeEventListener('touchend', onEnd) }
                    document.addEventListener('touchmove', onMove, { passive: false })
                    document.addEventListener('touchend', onEnd)
                  }}
                />
              </div>
              <div className="timeline-info">
                <span>{formatTime(currentTime)} / {formatTime(videoDuration)}</span>
                <span>Schnitt: {formatTime((trimStart / 100) * videoDuration)} — {formatTime((trimEnd / 100) * videoDuration)}</span>
              </div>
              <div className="timeline-controls">
                <button className="btn btn-play" onClick={togglePlay}>
                  {isPlaying ? 'Pause' : 'Abspielen'}
                </button>
                <button className="btn btn-secondary" onClick={() => { setTrimStart(0); setTrimEnd(100) }}>
                  Zuruecksetzen
                </button>
                <button className="btn btn-secondary" onClick={() => { setVideoUrl(null); setVideoFile(null); setVideoLoaded(false) }}>
                  Neues Video
                </button>
              </div>
            </div>
          </div>

          <div className="sidebar">
            <div className="sidebar-tabs">
              <button className={`tab ${activeTab === 'trim' ? 'active' : ''}`} onClick={() => setActiveTab('trim')}>Zuschneiden</button>
              <button className={`tab ${activeTab === 'text' ? 'active' : ''}`} onClick={() => setActiveTab('text')}>Text</button>
              <button className={`tab ${activeTab === 'animation' ? 'active' : ''}`} onClick={() => setActiveTab('animation')}>Animation</button>
              <button className={`tab ${activeTab === 'stickers' ? 'active' : ''}`} onClick={() => setActiveTab('stickers')}>Sticker</button>
              <button className={`tab ${activeTab === 'filter' ? 'active' : ''}`} onClick={() => setActiveTab('filter')}>Filter</button>
              <button className={`tab ${activeTab === 'audio' ? 'active' : ''}`} onClick={() => setActiveTab('audio')}>Audio</button>
            </div>

            <div className="sidebar-content">
              {activeTab === 'trim' && (
                <div className="panel">
                  <h3>Video zuschneiden</h3>
                  <div className="control">
                    <label>Start: {formatTime((trimStart / 100) * videoDuration)}</label>
                    <input type="range" min="0" max="100" value={trimStart} onChange={e => setTrimStart(+e.target.value)} />
                  </div>
                  <div className="control">
                    <label>Ende: {formatTime((trimEnd / 100) * videoDuration)}</label>
                    <input type="range" min="0" max="100" value={trimEnd} onChange={e => setTrimEnd(+e.target.value)} />
                  </div>
                  <div className="control">
                    <label>Seitenverhaeltnis</label>
                    <select value={aspectRatio} onChange={e => setAspectRatio(e.target.value)}>
                      {getAspectRatios().map(ar => (
                        <option key={ar.id} value={ar.id}>{ar.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {activeTab === 'text' && (
                <div className="panel">
                  <h3>Text hinzufuegen</h3>
                  <button className="btn btn-primary" onClick={addTextOverlay}>+ Text hinzufuegen</button>
                  {textOverlays.length === 0 ? (
                    <div className="text-controls" style={{ marginTop: '12px', padding: '12px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px' }}>
                      <input 
                        type="text" 
                        placeholder="Text eingeben..." 
                        style={{ width: '100%', padding: '8px 10px', border: '1px solid #e2e8f0', borderRadius: '4px', fontSize: '14px', marginBottom: '8px' }}
                        onKeyDown={(e) => { if (e.key === 'Enter') addTextOverlay(); }}
                        ref={(el) => { if (el) el.focus(); }}
                      />
                      <p style={{ fontSize: '12px', color: '#64748b', margin: '8px 0 0' }}>Enter drücken zum Erstellen</p>
                    </div>
                  ) : null}
                  {textOverlays.map(overlay => (
                    <div key={overlay.id} className={`text-item ${overlay.id === activeTextId ? 'active' : ''}`}>
                      <div className="text-item-header">
                        <span>{overlay.text}</span>
                        <button className="btn-icon" onClick={() => removeTextOverlay(overlay.id)}>x</button>
                      </div>
                      {overlay.id === activeTextId && (
                        <div className="text-controls">
                          <input type="text" value={overlay.text} onChange={e => updateTextOverlay(overlay.id, 'text', e.target.value)} placeholder="Text" />
                          <div className="control-row">
                            <input type="range" min="12" max="72" value={overlay.fontSize} onChange={e => updateTextOverlay(overlay.id, 'fontSize', +e.target.value)} />
                            <span>{overlay.fontSize}px</span>
                          </div>
                          <div className="control-row">
                            <label>X:</label>
                            <input type="range" min="0" max="100" value={overlay.x} onChange={e => updateTextOverlay(overlay.id, 'x', +e.target.value)} />
                            <label>Y:</label>
                            <input type="range" min="0" max="100" value={overlay.y} onChange={e => updateTextOverlay(overlay.id, 'y', +e.target.value)} />
                          </div>
                          <div className="control-row">
                            <input type="color" value={overlay.color} onChange={e => updateTextOverlay(overlay.id, 'color', e.target.value)} />
                            <select value={overlay.fontWeight} onChange={e => updateTextOverlay(overlay.id, 'fontWeight', e.target.value)}>
                              <option value="normal">Normal</option>
                              <option value="bold">Fett</option>
                            </select>
                            <div className="control-row">
                              <label>Deckkraft:</label>
                              <input type="range" min="0" max="100" value={overlay.opacity} onChange={e => updateTextOverlay(overlay.id, 'opacity', +e.target.value)} />
                            </div>
                          </div>
                          <label className="checkbox-label">
                            <input type="checkbox" checked={overlay.shadow} onChange={e => updateTextOverlay(overlay.id, 'shadow', e.target.checked)} />
                            Schatten
                          </label>
                        </div>
                      )}
                    </div>
                  ))}
                  {textOverlays.length > 0 && !activeTextId && (
                    <div className="text-controls" style={{ marginTop: '12px', padding: '12px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px' }}>
                      <p style={{ fontSize: '12px', color: '#64748b', margin: '0 0 8px' }}>Wähle einen Text aus der Liste oder erstelle einen neuen:</p>
                      <button className="btn btn-primary" onClick={addTextOverlay} style={{ width: '100%' }}>+ Neuer Text</button>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'filter' && (
                <div className="panel">
                  <h3>Filter & Farben</h3>
                  <div className="filter-grid">
                    {FILTERS.map(f => (
                      <button key={f.id} className={`filter-btn ${filter === f.id ? 'active' : ''}`} onClick={() => setFilter(f.id)}>
                        {f.label}
                      </button>
                    ))}
                  </div>
                  <div className="control">
                    <label>Helligkeit: {brightness}%</label>
                    <input type="range" min="50" max="150" value={brightness} onChange={e => setBrightness(+e.target.value)} />
                  </div>
                  <div className="control">
                    <label>Kontrast: {contrast}%</label>
                    <input type="range" min="50" max="150" value={contrast} onChange={e => setContrast(+e.target.value)} />
                  </div>
                  <div className="control">
                    <label>Saettigung: {saturation}%</label>
                    <input type="range" min="0" max="200" value={saturation} onChange={e => setSaturation(+e.target.value)} />
                  </div>
                </div>
              )}

              {activeTab === 'audio' && (
                <div className="panel">
                  <h3>Audio</h3>
                  <div className="control">
                    <label>Originalton</label>
                    <div className="control-row">
                      <input type="range" min="0" max="100" value={originalVolume} onChange={e => { setOriginalVolume(+e.target.value); if (videoRef.current) videoRef.current.volume = e.target.value / 100 }} />
                      <span>{originalVolume}%</span>
                    </div>
                  </div>
                  <div className="control">
                    <label>Musik hinzufuegen</label>
                    <button className="btn btn-secondary" onClick={() => audioInputRef.current?.click()}>
                      {audioFile ? audioFile.name : 'Audio-Datei waehlen'}
                    </button>
                    <input ref={audioInputRef} type="file" accept="audio/*" onChange={handleAudioUpload} style={{ display: 'none' }} />
                  </div>
                  {audioUrl && (
                    <div className="control">
                      <label>Musik-Lautstaerke: {audioVolume}%</label>
                      <input type="range" min="0" max="100" value={audioVolume} onChange={e => setAudioVolume(+e.target.value)} />
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'animation' && activeTextId && (
                <div className="panel">
                  <h3>Animation</h3>
                  <div className="anim-tabs">
                    <button className={`anim-tab ${activeAnimTab === 'presets' ? 'active' : ''}`} onClick={() => setActiveAnimTab('presets')}>Presets</button>
                    <button className={`anim-tab ${activeAnimTab === 'keyframes' ? 'active' : ''}`} onClick={() => setActiveAnimTab('keyframes')}>Keyframes</button>
                  </div>

                  {activeAnimTab === 'presets' && (
                    <div className="presets-grid">
                      {ANIMATION_PRESETS.map(preset => (
                        <button
                          key={preset.id}
                          className={`preset-btn ${getTextAnimation(activeTextId)?.preset === preset.id ? 'active' : ''}`}
                          onClick={() => {
                            const applied = applyAnimationPreset(preset.id)
                            updateTextAnimation(activeTextId, { preset: preset.id, keyframes: applied.keyframes })
                          }}
                          title={preset.label}
                        >
                          <span className="preset-icon">{getPresetIcon(preset.id)}</span>
                          <span className="preset-label">{preset.label}</span>
                        </button>
                      ))}
                    </div>
                  )}

                  {activeAnimTab === 'keyframes' && (
                    <div className="keyframe-editor">
                      <p className="keyframe-hint">Klicke auf die Timeline um Keyframes zu setzen. Zeit in % der Clip-Dauer.</p>
                      <div className="keyframe-timeline" ref={timelineRef} onClick={handleTimelineClick}>
                        <div className="keyframe-track">
                          <div className="keyframe-playhead" style={{ left: `${(currentTime / videoDuration) * 100}%` }} />
                          {getTextAnimation(activeTextId)?.keyframes?.map((kf, i) => (
                            <button
                              key={i}
                              className="keyframe-marker"
                              style={{ left: `${kf.time * 100}%` }}
                              onClick={e => { e.stopPropagation(); openKeyframeEditor(i) }}
                              title={`Keyframe ${i+1}: ${Math.round(kf.time*100)}%`}
                            />
                          ))}
                        </div>
                        <div className="keyframe-time-ruler">
                          {[0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100].map(t => (
                            <span key={t} style={{ left: `${t}%` }}>{t}%</span>
                          ))}
                        </div>
                      </div>
                      {editingKeyframeIndex !== null && (
                        <div className="keyframe-editor-panel">
                          <h4>Keyframe {editingKeyframeIndex + 1} bearbeiten</h4>
                          <div className="control">
                            <label>Zeit (%): {Math.round(keyframeTime * 100)}</label>
                            <input type="range" min="0" max="100" value={keyframeTime * 100} onChange={e => setKeyframeTime(e.target.value / 100)} />
                          </div>
                          <div className="control">
                            <label>Opacity: {Math.round(keyframeOpacity * 100)}%</label>
                            <input type="range" min="0" max="100" value={keyframeOpacity * 100} onChange={e => setKeyframeOpacity(e.target.value / 100)} />
                          </div>
                          <div className="control">
                            <label>Transform (CSS):</label>
                            <input type="text" value={keyframeTransform} onChange={e => setKeyframeTransform(e.target.value)} placeholder="z.B. translateY(20px) scale(0.9)" />
                          </div>
                          <div className="control-row">
                            <button className="btn btn-secondary" onClick={saveKeyframe}>Speichern</button>
                            <button className="btn btn-danger" onClick={deleteKeyframe}>Loeschen</button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {activeTab === 'stickers' && (
              <div className="panel">
                <h3>Sticker & Emojis</h3>
                <div className="sticker-tabs">
                  <button className={`sticker-tab ${activeStickerTab === 'emoji' ? 'active' : ''}`} onClick={() => setActiveStickerTab('emoji')}>Emojis</button>
                  <button className={`sticker-tab ${activeStickerTab === 'shapes' ? 'active' : ''}`} onClick={() => setActiveStickerTab('shapes')}>Formen</button>
                  <button className={`sticker-tab ${activeStickerTab === 'images' ? 'active' : ''}`} onClick={() => setActiveStickerTab('images')}>Bilder</button>
                </div>

                {activeStickerTab === 'emoji' && (
                  <div className="emoji-picker">
                    {Object.entries(EMOJI_CATEGORIES).map(([category, emojis]) => (
                      <div key={category} className="emoji-category">
                        <h4>{category}</h4>
                        <div className="emoji-grid">
                          {emojis.map((emoji, i) => (
                            <button
                              key={i}
                              className="emoji-btn"
                              onClick={() => addEmojiOverlay(emoji)}
                              title={emoji}
                            >
                              {emoji}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {activeStickerTab === 'shapes' && (
                  <div className="shapes-grid">
                    {SHAPES.map(shape => (
                      <button
                        key={shape.id}
                        className="shape-btn"
                        onClick={() => addShapeOverlay(shape)}
                        title={shape.label}
                      >
                        <svg width="40" height="40" viewBox="0 0 100 100" style={{ color: '#64748b' }}>
                          {shape.svg}
                        </svg>
                        <span className="shape-label">{shape.label}</span>
                      </button>
                    ))}
                  </div>
                )}

                {activeStickerTab === 'images' && (
                  <div className="sticker-images">
                    <div className="control">
                      <label>Eigenes Bild hochladen</label>
                      <input
                        ref={stickerInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleStickerUpload}
                        style={{ display: 'none' }}
                      />
                      <button className="btn btn-secondary" onClick={() => stickerInputRef.current?.click()}>
                        Bild auswaehlen
                      </button>
                    </div>
                    {overlays.filter(o => o.type === 'image').map(overlay => (
                      <div key={overlay.id} className="uploaded-sticker">
                        <img src={overlay.imageUrl} alt="" style={{ width: 60, height: 60, borderRadius: '8px', objectFit: 'cover' }} />
                        <button className="btn-icon" onClick={() => removeOverlay(overlay.id)}>x</button>
                      </div>
                    ))}
                  </div>
                )}

                {overlays.length > 0 && (
                  <div className="sticker-list">
                    <h4>Hinzugefuegte Sticker</h4>
                    {overlays.map(overlay => (
                      <div key={overlay.id} className={`sticker-list-item ${overlay.id === activeOverlayId ? 'active' : ''}`} onClick={() => setActiveOverlayId(overlay.id)}>
                        <span className="sticker-preview">
                          {overlay.type === 'emoji' && <span style={{ fontSize: '24px' }}>{overlay.content}</span>}
                          {overlay.type === 'shape' && <svg width="24" height="24" viewBox="0 0 100 100" style={{ color: overlay.color }}>{SHAPES.find(s => s.id === overlay.shape)?.svg}</svg>}
                          {overlay.type === 'image' && <img src={overlay.imageUrl} alt="" style={{ width: 24, height: 24, borderRadius: '4px', objectFit: 'cover' }} />}
                        </span>
                        <span className="sticker-info">
                          {overlay.type === 'emoji' && `Emoji: ${overlay.content}`}
                          {overlay.type === 'shape' && `Form: ${SHAPES.find(s => s.id === overlay.shape)?.label}`}
                          {overlay.type === 'image' && 'Eigenes Bild'}
                        </span>
                        <button className="btn-icon" onClick={(e) => { e.stopPropagation(); removeOverlay(overlay.id) }}>x</button>
                      </div>
                    ))}
                  </div>
                )}

                {activeOverlayId && (
                  <div className="sticker-controls">
                    <h4>Sticker bearbeiten</h4>
                    <div className="control">
                      <label>Groesse: {overlays.find(o => o.id === activeOverlayId)?.size}px</label>
                      <input type="range" min="20" max="200" value={overlays.find(o => o.id === activeOverlayId)?.size || 60} onChange={e => updateOverlay(activeOverlayId, 'size', +e.target.value)} />
                    </div>
                    <div className="control-row">
                      <label>X:</label>
                      <input type="range" min="0" max="100" value={overlays.find(o => o.id === activeOverlayId)?.x || 50} onChange={e => updateOverlay(activeOverlayId, 'x', +e.target.value)} />
                      <label>Y:</label>
                      <input type="range" min="0" max="100" value={overlays.find(o => o.id === activeOverlayId)?.y || 50} onChange={e => updateOverlay(activeOverlayId, 'y', +e.target.value)} />
                    </div>
                    <div className="control-row">
                      <label>Rotation: {overlays.find(o => o.id === activeOverlayId)?.rotation}°</label>
                      <input type="range" min="0" max="360" value={overlays.find(o => o.id === activeOverlayId)?.rotation || 0} onChange={e => updateOverlay(activeOverlayId, 'rotation', +e.target.value)} />
                    </div>
                    <div className="control-row">
                      <label>Deckkraft: {overlays.find(o => o.id === activeOverlayId)?.opacity}%</label>
                      <input type="range" min="0" max="100" value={overlays.find(o => o.id === activeOverlayId)?.opacity || 100} onChange={e => updateOverlay(activeOverlayId, 'opacity', +e.target.value)} />
                    </div>
                    <div className="control">
                      <label>Farbe (Formen/Emojis)</label>
                      <input type="color" value={overlays.find(o => o.id === activeOverlayId)?.color || '#ffffff'} onChange={e => updateOverlay(activeOverlayId, 'color', e.target.value)} />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {videoError && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '12px 16px', marginTop: '16px', color: '#991b1b', fontSize: '14px' }}>
          {videoError}
          <button onClick={() => setVideoError(null)} style={{ marginLeft: '12px', background: 'none', border: 'none', color: '#991b1b', cursor: 'pointer', textDecoration: 'underline' }}>Schliessen</button>
        </div>
      )}

      {isExporting && (
        <div className="export-overlay">
          <div className="export-box">
            <div className="export-bar">
              <div className="export-fill" style={{ width: `${exportProgress}%` }} />
            </div>
            <p>Video wird exportiert... {Math.round(exportProgress)}%</p>
          </div>
        </div>
      )}
    </div>
  )
}
