import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Video, Sliders, Scissors, Volume2, Sparkles, Copy, Check } from 'lucide-react'
import './CapCutStudio.css' // Reuse the studio CSS to maintain visual consistency

export default function OpusCutterStudio() {
  const navigate = useNavigate()
  const [copied, setCopied] = useState(false)
  const [keywords, setKeywords] = useState('Glücklich sein, Persönlichkeitsentwicklung, Mindset Hacks, Gewohnheiten ändern, Erfolg im Alltag')
  const [savedState, setSavedState] = useState(null)
  const [targetPlatform, setTargetPlatform] = useState('tiktok')

  const platformDetails = {
    tiktok: {
      description: 'Dein brandneues Video ist online! Entdecke spannende Einblicke und praktische Tipps für deinen Erfolg.',
      hashtags: '#fyp #viral #foryoupage #contentcreator #happiness',
      tips: 'Lade das Video zur Prime-Time (18:00 - 20:00 Uhr) hoch. Nutze einen trendigen TikTok Sound im Hintergrund (Leise auf 3%). Interagiere in den ersten 30 Minuten mit allen Kommentaren.'
    },
    shorts: {
      description: 'Kurz, knackig und voller Mehrwert – so bringst du dein Leben auf das nächste Level!',
      hashtags: '#shorts #ytshorts #viral #growth #happiness',
      tips: 'YouTube Shorts belohnt hohe Completion Rates extrem. Halte das Video unter 30 Sekunden. Verwende ein starkes, kontrastreiches Standbild als Thumbnail im Upload-Prozess.'
    },
    reels: {
      description: 'Lust auf Inspiration? Schau dir dieses Reel an und teile deine Gedanken in den Kommentaren!',
      hashtags: '#reels #instagramreels #viralreels #creators #happiness',
      tips: 'Teile Reels direkt auch in deinem Feed, um die Reichweite zu maximieren. Nutze relevante Nischen-Hashtags und verlinke Co-Autoren, falls vorhanden.'
    }
  }

  useEffect(() => {
    document.title = 'Opus KI-Cutter Studio — Happiness'
    try {
      const saved = localStorage.getItem('hit_engine_state')
      if (saved) {
        setSavedState(JSON.parse(saved))
      }
    } catch {}
  }, [])

  const handleCopyKeywords = () => {
    navigator.clipboard.writeText(keywords)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const goBack = () => {
    if (savedState) {
      localStorage.setItem('hit_engine_state', JSON.stringify(savedState))
    }
    navigate('/')
  }

  const originalScript = savedState?.results?.tiktok?.content?.body || 
                         savedState?.goal || 
                         'Gib dein Skript im H.I.T. Generator ein, um die Analyse zu starten.'

  return (
    <div className="capcut-page" style={{ padding: '2rem 1rem', maxWidth: '800px', margin: '0 auto', textAlign: 'left' }}>
      {/* Header */}
      <div className="capcut-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', marginBottom: '2rem', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button onClick={goBack} className="btn btn-outline" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1rem', borderRadius: '8px' }}>
            <ArrowLeft size={16} /> Zurück zu H.I.T.
          </button>
          <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800, color: 'var(--color-petrol, #085041)' }}>
            🤖 Opus KI-Cutter Studio
          </h2>
        </div>
        <a href="https://opus.pro" target="_blank" rel="noopener noreferrer" className="btn btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1.25rem', borderRadius: '8px', textDecoration: 'none' }}>
          🚀 Direkt zu Opus Clip wechseln
        </a>
      </div>

      {/* Target Platform Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
        <button onClick={() => setTargetPlatform('tiktok')} className={`btn ${targetPlatform === 'tiktok' ? 'btn-primary' : 'btn-outline'}`} style={{ flex: 1 }}>📱 TikTok</button>
        <button onClick={() => setTargetPlatform('shorts')} className={`btn ${targetPlatform === 'shorts' ? 'btn-primary' : 'btn-outline'}`} style={{ flex: 1 }}>📺 YouTube Shorts</button>
        <button onClick={() => setTargetPlatform('reels')} className={`btn ${targetPlatform === 'reels' ? 'btn-primary' : 'btn-outline'}`} style={{ flex: 1 }}>📸 Instagram Reels</button>
      </div>

      {/* Publishing Details Card */}
      <div className="pe-card" style={{ padding: '1.5rem', borderRadius: '16px', background: 'rgba(255,255,255,0.85)', border: '1px solid var(--border)', boxShadow: '0 4px 24px rgba(0,0,0,0.05)', marginBottom: '1.5rem' }}>
        <h4 style={{ margin: '0 0 1rem', fontSize: '1rem', color: 'var(--text)' }}>
          📢 Veröffentlichungs-Details ({targetPlatform === 'tiktok' ? 'TikTok' : targetPlatform === 'shorts' ? 'YouTube Shorts' : 'Instagram Reels'})
        </h4>
        
        <div style={{ marginBottom: '1rem' }}>
          <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)' }}>Beschreibung & Caption</label>
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem' }}>
            <input type="text" readOnly value={platformDetails[targetPlatform].description} style={{ flex: 1, padding: '0.75rem 1rem', borderRadius: '10px', border: '1px solid var(--border)', fontSize: '0.9rem', background: '#f8fafc', outline: 'none' }} />
            <button onClick={() => { navigator.clipboard.writeText(platformDetails[targetPlatform].description); alert('Kopiert!'); }} className="btn btn-outline" style={{ padding: '0.75rem' }}>Kopieren</button>
          </div>
        </div>

        <div style={{ marginBottom: '1rem' }}>
          <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)' }}>Hashtags</label>
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem' }}>
            <input type="text" readOnly value={platformDetails[targetPlatform].hashtags} style={{ flex: 1, padding: '0.75rem 1rem', borderRadius: '10px', border: '1px solid var(--border)', fontSize: '0.9rem', background: '#f8fafc', outline: 'none' }} />
            <button onClick={() => { navigator.clipboard.writeText(platformDetails[targetPlatform].hashtags); alert('Kopiert!'); }} className="btn btn-outline" style={{ padding: '0.75rem' }}>Kopieren</button>
          </div>
        </div>

        <div>
          <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)' }}>💡 Posting-Tipps für maximale Reichweite</label>
          <p style={{ margin: '0.25rem 0 0', fontSize: '0.88rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
            {platformDetails[targetPlatform].tips}
          </p>
        </div>
      </div>

<div className="dashboard-grid" style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1.5rem' }}>
        
        {/* Intro Banner */}
        <div className="home-welcome-card" style={{ padding: '1.5rem', borderRadius: '16px', background: 'rgba(255,255,255,0.45)', border: '1px solid var(--border)', backdropFilter: 'blur(12px)' }}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: '0 0 0.5rem', fontSize: '1.1rem', color: 'var(--color-koralle, #d85a30)' }}>
            <Sparkles size={18} /> Smart AI-Cutter Workflow (Opus Clip & Veed.io)
          </h3>
          <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
            Dieses Studio bereitet deinen Content optimal für KI-gestützte Schnittprogramme vor. Opus Clip und Veed.io nutzen Auto-Framing und Untertitel-Vorlagen, um dein Video vollautomatisch viral gehen zu lassen.
          </p>
        </div>

        {/* AI Keywords & Metadata */}
        <div className="pe-card" style={{ padding: '1.5rem', borderRadius: '16px', background: 'rgba(255,255,255,0.85)', border: '1px solid var(--border)', boxShadow: '0 4px 24px rgba(0,0,0,0.05)' }}>
          <h4 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: '0 0 1rem', fontSize: '1rem', color: 'var(--text)' }}>
            <Sliders size={18} className="highlight-coral" /> Optimierte KI-Keywords (für Opus Clip SEO-Score)
          </h4>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem', lineHeight: 1.4 }}>
            Füge diese Keywords bei Opus Clip im Feld „Fokus-Themen“ ein, damit der Algorithmus die interessantesten Abschnitte deines gesprochenen Texts präzise schneidet und hervorhebt.
          </p>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <input 
              type="text" 
              value={keywords} 
              onChange={(e) => setKeywords(e.target.value)}
              style={{ flex: 1, padding: '0.75rem 1rem', borderRadius: '10px', border: '1px solid var(--border)', fontSize: '0.9rem', outline: 'none' }}
            />
            <button 
              onClick={handleCopyKeywords}
              className="btn btn-primary"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', padding: '0.75rem 1.25rem', borderRadius: '10px', whiteSpace: 'nowrap' }}
            >
              {copied ? <Check size={16} /> : <Copy size={16} />}
              {copied ? 'Kopiert' : 'Keywords kopieren'}
            </button>
          </div>
        </div>

        {/* Speech Pause Analysis */}
        <div className="pe-card" style={{ padding: '1.5rem', borderRadius: '16px', background: 'rgba(255,255,255,0.85)', border: '1px solid var(--border)' }}>
          <h4 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: '0 0 1rem', fontSize: '1rem', color: 'var(--text)' }}>
            <Volume2 size={18} className="highlight-mint" /> Sprechpausen-Analyse & Dynamik-Pacing
          </h4>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
            <div style={{ padding: '0.75rem', background: 'rgba(0,0,0,0.02)', borderRadius: '10px', textAlign: 'center' }}>
              <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--color-petrol)' }}>0.2 Sekunden</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Empfohlenes Pausen-Limit (Auto-Cut)</div>
            </div>
            <div style={{ padding: '0.75rem', background: 'rgba(0,0,0,0.02)', borderRadius: '10px', textAlign: 'center' }}>
              <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--color-koralle)' }}>Aktiviert (Auto-Zoom)</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Dynamischer Zoom bei Wortwechsel</div>
            </div>
          </div>
          <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
            <strong>Tipp:</strong> Stelle die Pausen-Löschung bei Veed.io oder Opus Clip auf genau 0.2 Sekunden. Dadurch werden alle Atemgeräusche und Pausen gelöscht, was die Zuschauerbindung (Retention Rate) im Schnitt um 14% ansteigen lässt.
          </p>
        </div>

        {/* Auto-Framing Instructions */}
        <div className="pe-card" style={{ padding: '1.5rem', borderRadius: '16px', background: 'rgba(255,255,255,0.85)', border: '1px solid var(--border)' }}>
          <h4 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: '0 0 1rem', fontSize: '1rem', color: 'var(--text)' }}>
            <Scissors size={18} className="highlight-amber" /> Auto-Framing & Text-Overlay Guide (9:16)
          </h4>
          <ul style={{ paddingLeft: '1.25rem', margin: 0, fontSize: '0.88rem', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: '0.5rem', lineHeight: 1.5 }}>
            <li>
              <strong>Ausschnitt-Verlauf:</strong> Wähle in Opus Clip das Seitenverhältnis 9:16 und wähle „Auto-Reframe“. Die KI verfolgt automatisch dein Gesicht, sodass du immer im Zentrum des Bildes stehst.
            </li>
            <li>
              <strong>Wort-für-Wort Untertitel:</strong> Wähle das Preset „Karaoke“ oder „Neon Word“. Die KI hevorhebt das aktuell gesprochene Wort gelb oder grün. Platziere den Untertitel-Block bei 40% bis 50% der Bildschirmhöhe, um nicht von den Video-Steuerelementen verdeckt zu werden.
            </li>
            <li>
              <strong>Emoji-Auto-Einblendung:</strong> Aktiviere „Emoji-Auto-Detection“. Opus setzt dann automatisch passende Emojis synchron zu den Wörtern über deinen Untertitel.
            </li>
          </ul>
        </div>
      </div>
    </div>
  )
}
