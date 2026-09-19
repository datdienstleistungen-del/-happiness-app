import React, { createContext, useContext, useState } from 'react'

const VideoScriptContext = createContext()

export function VideoScriptProvider({ children }) {
  const [scriptStep, setScriptStep] = useState(1)
  const [scriptMode, setScriptMode] = useState('followup_optimizer') // 'followup_optimizer' | 'standard'
  const [scriptVideoUrl, setScriptVideoUrl] = useState('')
  const [scriptVideoFile, setScriptVideoFile] = useState(null)
  const [scriptVideoPreview, setScriptVideoPreview] = useState(null)
  const [scriptAnalyticsImages, setScriptAnalyticsImages] = useState([]) // Screenshots of TikTok analytics (data URLs)
  const [scriptAnalyticsNotes, setScriptAnalyticsNotes] = useState('')
  const [scriptInputMode, setScriptInputMode] = useState('upload')
  const [scriptSelectedGenre, setScriptSelectedGenre] = useState('followup_tiktok_optimizer')
  const [scriptUserPremise, setUserPremise] = useState('')
  const [scriptAdText, setScriptAdText] = useState('')
  const [scriptSceneAnalysis, setScriptSceneAnalysis] = useState(null)
  const [scriptGeneratedScript, setScriptGeneratedScript] = useState('')
  const [scriptId, setScriptId] = useState(null)
  const [scriptHooks, setScriptHooks] = useState([])
  const [scriptSelectedHook, setScriptSelectedHook] = useState(null)

  const value = {
    scriptStep, setScriptStep,
    scriptMode, setScriptMode,
    scriptVideoUrl, setScriptVideoUrl,
    scriptVideoFile, setScriptVideoFile,
    scriptVideoPreview, setScriptVideoPreview,
    scriptAnalyticsImages, setScriptAnalyticsImages,
    scriptAnalyticsNotes, setScriptAnalyticsNotes,
    scriptInputMode, setScriptInputMode,
    scriptSelectedGenre, setScriptSelectedGenre,
    scriptUserPremise, setUserPremise,
    scriptAdText, setScriptAdText,
    scriptSceneAnalysis, setScriptSceneAnalysis,
    scriptGeneratedScript, setScriptGeneratedScript,
    scriptId, setScriptId,
    scriptHooks, setScriptHooks,
    scriptSelectedHook, setScriptSelectedHook,
  }

  return (
    <VideoScriptContext.Provider value={value}>
      {children}
    </VideoScriptContext.Provider>
  )
}

export function useVideoScript() {
  return useContext(VideoScriptContext)
}
