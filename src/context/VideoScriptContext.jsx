import React, { createContext, useContext, useState } from 'react'

const VideoScriptContext = createContext()

export function VideoScriptProvider({ children }) {
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

  const value = {
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
