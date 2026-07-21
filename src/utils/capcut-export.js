import JSZip from 'jszip'

export const copyScriptToClipboard = async (scenes) => {
  const fullScript = scenes
    .map((scene, i) => `Szene ${i + 1}:\n${scene.spoken_text || ''}`)
    .join('\n\n')

  await navigator.clipboard.writeText(fullScript)
  return true
}

export const downloadScenesZip = async (scenes, onProgress) => {
  if (onProgress) onProgress(true)

  try {
    const zip = new JSZip()
    let hasFiles = false

    scenes.forEach((scene, i) => {
      if (scene.mediaFile) {
        const ext = scene.mediaFile.name
          ? scene.mediaFile.name.split('.').pop()
          : 'jpg'
        zip.file(`scene-${i + 1}.${ext}`, scene.mediaFile)
        hasFiles = true
      }
    })

    if (!hasFiles) {
      throw new Error('Keine Medien zum Herunterladen gefunden.')
    }

    const blob = await zip.generateAsync({ type: 'blob' })
    const url = URL.createObjectURL(blob)

    const a = document.createElement('a')
    a.href = url
    a.download = 'capcut-media.zip'
    a.click()

    setTimeout(() => URL.revokeObjectURL(url), 1000)
    return true
  } catch (error) {
    console.error('ZIP-Export fehlgeschlagen:', error)
    throw error
  } finally {
    if (onProgress) onProgress(false)
  }
}

export const downloadCapCutDraft = async (recipe, scenes) => {
  try {
    const payload = {
      recipe: { title: recipe?.video_title || 'H.I.T. Video' },
      scenes: scenes.map(s => ({
        duration: s.duration || 4,
        spoken_text: s.spoken_text || ''
      }))
    }

    const response = await fetch('/api/capcut-draft', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })

    if (!response.ok) {
      throw new Error(`Server-Fehler: ${response.statusText}`)
    }

    const draftJson = await response.json()

    const blob = new Blob(
      [JSON.stringify(draftJson, null, 2)],
      { type: 'application/json' }
    )
    const url = URL.createObjectURL(blob)

    const a = document.createElement('a')
    a.href = url
    a.download = 'draft_content.json'
    a.click()

    setTimeout(() => URL.revokeObjectURL(url), 1000)
    return true
  } catch (error) {
    console.error('Draft-Download fehlgeschlagen:', error)
    throw error
  }
}
