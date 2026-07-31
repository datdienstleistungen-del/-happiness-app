import React, { createContext, useContext, useState } from 'react'

const StudioContext = createContext()

export function StudioProvider({ children }) {
  // 1. Video Finder states
  const [query, setQuery] = useState('')
  const [videos, setVideos] = useState([])
  const [loading, setLoading] = useState(false)
  const [pexelsSearched, setPexelsSearched] = useState(false)
  const [selectedVideo, setSelectedVideo] = useState(null)

  const [selectedTone, setSelectedTone] = useState('funny')
  const [customInstructions, setCustomInstructions] = useState('')
  const [generatingScript, setGeneratingScript] = useState(false)
  const [generatedScript, setGeneratedScript] = useState(null)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState('')

  const [activeSource, setActiveSource] = useState('pexels')
  const [importedUrl, setImportedUrl] = useState('')
  const [topic, setTopic] = useState('')

  const [archiveVideos, setArchiveVideos] = useState([])
  const [archiveLoading, setArchiveLoading] = useState(false)
  const [archiveQuery, setArchiveQuery] = useState('')
  const [archiveSearched, setArchiveSearched] = useState(false)

  const [mixkitVideos, setMixkitVideos] = useState([])
  const [mixkitLoading, setMixkitLoading] = useState(false)
  const [mixkitQuery, setMixkitQuery] = useState('')
  const [mixkitSearched, setMixkitSearched] = useState(false)

  // 2. Video Script (Drehbuch) states
  const [scriptStep, setScriptStep] = useState(1)
  const [scriptVideoUrl, setScriptVideoUrl] = useState('')
  const [scriptVideoFile, setScriptVideoFile] = useState(null)
  const [scriptVideoPreview, setScriptVideoPreview] = useState(null)
  const [scriptInputMode, setScriptInputMode] = useState('url')
  const [scriptSelectedGenre, setScriptSelectedGenre] = useState(null)
  const [scriptUserPremise, setScriptUserPremise] = useState('')
  const [scriptAdText, setScriptAdText] = useState('')
  const [scriptSceneAnalysis, setScriptSceneAnalysis] = useState(null)
  const [scriptGeneratedScript, setScriptGeneratedScript] = useState('')
  const [scriptId, setScriptId] = useState(null)
  const [scriptHooks, setScriptHooks] = useState([])
  const [scriptSelectedHook, setScriptSelectedHook] = useState(null)

  // 3. CapCut Studio (TikTokVideoPage) states
  const [capcutTopic, setCapcutTopic] = useState('')
  const [capcutDuration, setCapcutDuration] = useState(30)
  const [capcutRecipe, setCapcutRecipe] = useState(null)
  const [capcutActivePlatform, setCapcutActivePlatform] = useState('tiktok_instagram')
  const [capcutShowSuccess, setCapcutShowSuccess] = useState(false)
  const [capcutPublished, setCapcutPublished] = useState(false)
  const [capcutScenesWithMedia, setCapcutScenesWithMedia] = useState([])

  const value = {
    // Video Finder
    query, setQuery,
    videos, setVideos,
    loading, setLoading,
    pexelsSearched, setPexelsSearched,
    selectedVideo, setSelectedVideo,
    selectedTone, setSelectedTone,
    customInstructions, setCustomInstructions,
    generatingScript, setGeneratingScript,
    generatedScript, setGeneratedScript,
    copied, setCopied,
    error, setError,
    activeSource, setActiveSource,
    importedUrl, setImportedUrl,
    topic, setTopic,
    archiveVideos, setArchiveVideos,
    archiveLoading, setArchiveLoading,
    archiveQuery, setArchiveQuery,
    archiveSearched, setArchiveSearched,
    mixkitVideos, setMixkitVideos,
    mixkitLoading, setMixkitLoading,
    mixkitQuery, setMixkitQuery,
    mixkitSearched, setMixkitSearched,

    // Video Script
    scriptStep, setScriptStep,
    scriptVideoUrl, setScriptVideoUrl,
    scriptVideoFile, setScriptVideoFile,
    scriptVideoPreview, setScriptVideoPreview,
    scriptInputMode, setScriptInputMode,
    scriptSelectedGenre, setScriptSelectedGenre,
    scriptUserPremise, setScriptUserPremise,
    scriptAdText, setScriptAdText,
    scriptSceneAnalysis, setScriptSceneAnalysis,
    scriptGeneratedScript, setScriptGeneratedScript,
    scriptId, setScriptId,
    scriptHooks, setScriptHooks,
    scriptSelectedHook, setScriptSelectedHook,

    // CapCut Studio
    capcutTopic, setCapcutTopic,
    capcutDuration, setCapcutDuration,
    capcutRecipe, setCapcutRecipe,
    capcutActivePlatform, setCapcutActivePlatform,
    capcutShowSuccess, setCapcutShowSuccess,
    capcutPublished, setCapcutPublished,
    capcutScenesWithMedia, setCapcutScenesWithMedia
  }

  return (
    <StudioContext.Provider value={value}>
      {children}
    </StudioContext.Provider>
  )
}

export function useStudio() {
  const context = useContext(StudioContext)
  if (!context) {
    throw new Error('useStudio must be used within a StudioProvider')
  }
  return context
}
