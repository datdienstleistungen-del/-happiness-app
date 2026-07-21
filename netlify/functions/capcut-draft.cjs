exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
      }
    }
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' }
  }

  try {
    const { recipe, scenes } = JSON.parse(event.body)
    const timestamp = Date.now()
    const fps = 30

    let currentOffset = 0
    const videoSegments = []
    const textSegments = []
    const videoMaterials = []
    const textMaterials = []

    scenes.forEach((scene, index) => {
      const durationSec = scene.duration || 4
      const durationUs = durationSec * 1000000
      const sceneId = `scene_material_${index}`
      const textId = `text_material_${index}`
      const fileName = `scene-${index + 1}.jpg`
      const mediaUrl = scene.mediaUrl || null

      videoMaterials.push({
        id: sceneId,
        type: 'photo',
        local_path: fileName,
        name: fileName,
        url: mediaUrl
      })

      textMaterials.push({
        id: textId,
        type: 'text',
        content: JSON.stringify({
          text: scene.spoken_text || '',
          styles: [{
            range: [0, (scene.spoken_text || '').length],
            font: { path: '' },
            size: 8.0,
            color: [1, 1, 1],
            bold: false,
            italic: false,
            underline: false,
            shadow_alpha: 0.8,
            shadow_smoothing: 0.45,
            shadow_color: [0, 0, 0],
            shadow_offset: [2, 2]
          }]
        })
      })

      videoSegments.push({
        id: `video_seg_${index}`,
        material_id: sceneId,
        target_timerange: {
          start: currentOffset,
          duration: durationUs
        },
        source_timerange: {
          start: 0,
          duration: durationUs
        },
        extra_material_refs: [],
        clip: {
          alpha: 1.0,
          flip: { horizontal: false, vertical: false },
          rotation: 0.0,
          scale: { x: 1.0, y: 1.0 },
          transform: { x: 0.0, y: 0.0 }
        },
        render_index: index
      })

      textSegments.push({
        id: `text_seg_${index}`,
        material_id: textId,
        target_timerange: {
          start: currentOffset,
          duration: durationUs
        },
        source_timerange: {
          start: 0,
          duration: durationUs
        },
        extra_material_refs: [],
        clip: {
          alpha: 1.0,
          flip: { horizontal: false, vertical: false },
          rotation: 0.0,
          scale: { x: 1.0, y: 1.0 },
          transform: { x: 0.0, y: 0.0 }
        },
        render_index: index + 100
      })

      currentOffset += durationUs
    })

    const draftContent = {
      id: `happiness-recipe-${timestamp}`,
      name: `H.I.T. Rezept: ${recipe?.title || 'Video'}`,
      duration: currentOffset,
      fps: fps,
      canvas_config: {
        width: 1080,
        height: 1920,
        ratio: '9:16'
      },
      platform: {
        app_source: 'cc',
        app_version: '9.0.0',
        os: 'windows'
      },
      tracks: [
        {
          id: 'video-track',
          type: 'video',
          segments: videoSegments
        },
        {
          id: 'text-track',
          type: 'text',
          segments: textSegments
        }
      ],
      materials: {
        videos: videoMaterials,
        audios: [],
        texts: textMaterials,
        stickers: [],
        video_effects: [],
        material_animations: [],
        transitions: [],
        masks: [],
        canvases: [],
        speeds: [],
        audio_fades: []
      },
      extra_info: {},
      free_render_index_mode_on: false
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify(draftContent)
    }
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Failed to generate CapCut draft',
        details: error.message
      })
    }
  }
}
