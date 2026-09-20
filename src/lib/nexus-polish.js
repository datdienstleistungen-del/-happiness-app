/**
 * NeXus AI Text Polish & Voice Transcript Corrector
 * Sub-second correction of STT phonetic errors, typos, punctuation, and grammar.
 */

export async function polishText(text, lang = 'de') {
  if (!text || !text.trim()) return text
  try {
    const res = await fetch('/.netlify/functions/nexus-polish-text', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: text.trim(), lang })
    })
    if (!res.ok) {
      console.warn(`[Polish] API responded with status ${res.status}`)
      return text
    }
    const data = await res.json()
    return data.text || text
  } catch (err) {
    console.warn('[Polish] Network or parsing error:', err)
    return text
  }
}
