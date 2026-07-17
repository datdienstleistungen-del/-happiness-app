import { useState } from 'react'
import { Copy, Check } from 'lucide-react'
import { trackCopyAction } from '../intelligence/analytics/custom'

export default function CopyButton({ text, className, label, platform }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      trackCopyAction(platform || 'unknown')
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Copy failed:', err)
    }
  }

  return (
    <button className={`copy-btn ${copied ? 'copied' : ''} ${className || ''}`} onClick={handleCopy} title={copied ? 'Kopiert!' : 'In Zwischenablage kopieren'}>
      {copied ? <Check size={14} /> : <Copy size={14} />}
      {copied ? ' Kopiert' : label || ''}
    </button>
  )
}
