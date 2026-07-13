import { WebSocket } from 'ws'
import { Buffer } from 'node:buffer'
import crypto from 'node:crypto'

const TRUSTED_CLIENT_TOKEN = '6A5AA1D4EAFF4E9FB37E23D68491D6F4'

function uuid() {
  return crypto.randomUUID().replaceAll('-', '')
}

async function edgeTTS(text, voice = 'de-DE-KatjaNeural', rate = '+0%', pitch = '+0Hz') {
  return new Promise((resolve, reject) => {
    const wsUrl = `wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1?TrustedClientToken=${TRUSTED_CLIENT_TOKEN}&ConnectionId=${uuid()}`
    const ws = new WebSocket(wsUrl, {
      host: 'speech.platform.bing.com',
      origin: 'chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/103.0.5060.66 Safari/537.36 Edg/103.0.1264.44'
      }
    })

    const audioChunks = []

    ws.on('message', (rawData, isBinary) => {
      if (!isBinary) {
        const msg = rawData.toString('utf8')
        if (msg.includes('turn.end')) {
          resolve(Buffer.concat(audioChunks))
          ws.close()
        }
        return
      }
      const separator = 'Path:audio\r\n'
      const idx = rawData.indexOf(separator)
      if (idx >= 0) {
        const afterPath = rawData.subarray(idx + separator.length)
        const nullIdx = afterPath.indexOf(0x00)
        if (nullIdx >= 0) {
          audioChunks.push(afterPath.subarray(nullIdx + 1))
        } else {
          audioChunks.push(afterPath)
        }
      }
    })

    ws.on('error', (err) => reject(err))

    ws.on('open', () => {
      const configMsg = `X-Timestamp:${Date()}\r\nContent-Type:application/json; charset=utf-8\r\nPath:speech.config\r\n\r\n${JSON.stringify({
        context: { synthesis: { audio: {
          metadataoptions: { sentenceBoundaryEnabled: false, wordBoundaryEnabled: false },
          outputFormat: 'audio-24khz-48kbitrate-mono-mp3'
        } } }
      })}`

      ws.send(configMsg, { compress: true }, (err) => {
        if (err) return reject(err)

        const escapedText = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        const ssmlMsg = `X-RequestId:${uuid()}\r\nContent-Type:application/ssml+xml\r\nX-Timestamp:${Date()}Z\r\nPath:ssml\r\n\r\n<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='de-DE'><voice name='${voice}'><prosody pitch='${pitch}' rate='${rate}'>${escapedText}</prosody></voice></speak>`

        ws.send(ssmlMsg, { compress: true }, (err2) => {
          if (err2) reject(err2)
        })
      })
    })
  })
}

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' }, body: '' }
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) }
  }

  try {
    const { text, voice, rate, pitch } = JSON.parse(event.body || '{}')

    if (!text || text.trim().length === 0) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Text ist erforderlich' }) }
    }

    if (text.length > 5000) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Text ist zu lang (max 5000 Zeichen)' }) }
    }

    const audioBuffer = await edgeTTS(text, voice || 'de-DE-KatjaNeural', rate || '+0%', pitch || '+0Hz')

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'audio/mpeg'
      },
      body: audioBuffer.toString('base64'),
      isBase64Encoded: true
    }
  } catch (error) {
    console.error('[TTS] Error:', error.message)
    return {
      statusCode: 200,
      headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'TTS konnte nicht generiert werden: ' + error.message })
    }
  }
}
