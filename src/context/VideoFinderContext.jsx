import React, { createContext, useContext, useState } from 'react'

const VideoFinderContext = createContext()

export function VideoFinderProvider({ children }) {
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

  const value = {
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
  }

  return (
    <VideoFinderContext.Provider value={value}>
      {children}
    </VideoFinderContext.Provider>
  )
}

export function useVideoFinder() {
  return useContext(VideoFinderContext)
}
