import React, { createContext, useContext, useState } from 'react'

const CapCutContext = createContext()

export function CapCutProvider({ children }) {
  const [capcutTopic, setCapcutTopic] = useState('')
  const [capcutDuration, setCapcutDuration] = useState(30)
  const [capcutRecipe, setCapcutRecipe] = useState(null)
  const [capcutActivePlatform, setCapcutActivePlatform] = useState('tiktok_instagram')
  const [capcutShowSuccess, setCapcutShowSuccess] = useState(false)
  const [capcutPublished, setCapcutPublished] = useState(false)
  const [capcutScenesWithMedia, setCapcutScenesWithMedia] = useState([])

  const value = {
    capcutTopic, setCapcutTopic,
    capcutDuration, setCapcutDuration,
    capcutRecipe, setCapcutRecipe,
    capcutActivePlatform, setCapcutActivePlatform,
    capcutShowSuccess, setCapcutShowSuccess,
    capcutPublished, setCapcutPublished,
    capcutScenesWithMedia, setCapcutScenesWithMedia,
  }

  return (
    <CapCutContext.Provider value={value}>
      {children}
    </CapCutContext.Provider>
  )
}

export function useCapCut() {
  return useContext(CapCutContext)
}
