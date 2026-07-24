import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Video, SlidersHorizontal, Layers, Film, Download, Sparkles, Copy, Check } from 'lucide-react'
import './CapCutStudio.css' // Reuse the studio CSS to maintain visual consistency

export default function ProCutterStudio() {
  const navigate = useNavigate()
  const [copied, setCopied] = useState(false)
  const [savedState, setSavedState] = useState(null)
  const [markerText, setMarkerText] = useState(`00:00:00:00 - HOOK START (Zoom 110%)
00:00:02:15 - PATTERN INTERRUPT (B-Roll Insert / Scale 120%)
00:00:05:00 - BODY START (Zoom 100% / J-Cut Audio transition)
00:00:08:12 - INTERRUPT (Text Overlay / SFX Whoosh)
00:00:12:00 - SCALE CHANGE (Punch in 130%)
00:00:15:22 - B-ROLL INSERT
00:00:19:05 - SCALE CHANGE (Punch out 105%)
00:00:24:10 - CTA & LOOP START (Zoom 115%)`)

  useEffect(() => {
    document.title = 'Pro-Cutter Studio — Happiness'
    try {
      const saved = localStorage.getItem('hit_engine_state')
      if (saved) {
        setSavedState(JSON.parse(saved))
      }
    } catch {}
  }, [])

  const handleCopyMarkers = () => {
    navigator.clipboard.writeText(markerText)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const goBack = () => {
    if (savedState) {
      localStorage.setItem('hit_engine_state', JSON.stringify(savedState))
    }
    navigate('/')
  }

  const handleDownloadMarkers = () => {
    const element = document.createElement("a");
    const file = new Blob([markerText], {type: 'text/plain'});
    element.href = URL.createObjectURL(file);
    element.download = "premiere_markers.txt";
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  }

  return (
    <div className="capcut-page" style={{ padding: '2rem 1rem', maxWidth: '800px', margin: '0 auto', textAlign: 'left' }}>
      {/* Header */}
      <div className="capcut-header" style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
        <button onClick={goBack} className="btn btn-outline" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1rem', borderRadius: '8px' }}>
          <ArrowLeft size={16} /> Zurück zu H.I.T.
        </button>
        <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800, color: 'var(--color-petrol, #085041)' }}>
          💻 Pro-Cutter Studio (Premiere / DaVinci)
        </h2>
      </div>

      <div className="dashboard-grid" style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1.5rem' }}>
        
        {/* Intro Banner */}
        <div className="home-welcome-card" style={{ padding: '1.5rem', borderRadius: '16px', background: 'rgba(255,255,255,0.45)', border: '1px solid var(--border)', backdropFilter: 'blur(12px)' }}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: '0 0 0.5rem', fontSize: '1.1rem', color: 'var(--color-koralle, #d85a30)' }}>
            <Sparkles size={18} /> Professional Desktop Editing Workflow
          </h3>
          <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
            Für Cutter, die absolute Kontrolle über Timeline, Keyframes und Gradings haben. Dieses Studio liefert dir Timeline-Marker und Profi-Anweisungen, um deine Premiere Pro- oder DaVinci Resolve-Projekte in Sekundenschnelle aufzubauen.
          </p>
        </div>

        {/* Timeline Markers Export */}
        <div className="pe-card" style={{ padding: '1.5rem', borderRadius: '16px', background: 'rgba(255,255,255,0.85)', border: '1px solid var(--border)', boxShadow: '0 4px 24px rgba(0,0,0,0.05)' }}>
          <h4 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: '0 0 0.5rem', fontSize: '1rem', color: 'var(--text)' }}>
            <SlidersHorizontal size={18} className="highlight-coral" /> Premiere / DaVinci Timeline-Marker
          </h4>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem', lineHeight: 1.4 }}>
            Kopiere oder lade die Markerliste als TXT-Datei herunter, um deine Timeline-Schnittpunkte im Editor direkt zu benennen. Perfekt für das Platzieren von Soundeffekten und Scale-Punches.
          </p>
          <textarea 
            value={markerText} 
            onChange={(e) => setMarkerText(e.target.value)}
            style={{ width: '100%', height: '140px', padding: '0.75rem', borderRadius: '10px', border: '1px solid var(--border)', fontFamily: 'monospace', fontSize: '0.85rem', outline: 'none', resize: 'vertical', marginBottom: '1rem' }}
          />
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button 
              onClick={handleCopyMarkers}
              className="btn btn-outline"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', padding: '0.75rem 1.25rem', borderRadius: '10px' }}
            >
              {copied ? <Check size={16} /> : <Copy size={16} />}
              {copied ? 'Kopiert' : 'Marker kopieren'}
            </button>
            <button 
              onClick={handleDownloadMarkers}
              className="btn btn-primary"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', padding: '0.75rem 1.25rem', borderRadius: '10px' }}
            >
              <Download size={16} /> Marker-Datei herunterladen (.txt)
            </button>
          </div>
        </div>

        {/* Pro Editing Guide */}
        <div className="pe-card" style={{ padding: '1.5rem', borderRadius: '16px', background: 'rgba(255,255,255,0.85)', border: '1px solid var(--border)' }}>
          <h4 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: '0 0 1rem', fontSize: '1rem', color: 'var(--text)' }}>
            <Layers size={18} className="highlight-mint" /> Professionelle Editing-Techniken (Timeline-Rezepte)
          </h4>
          <ul style={{ paddingLeft: '1.25rem', margin: 0, fontSize: '0.88rem', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: '0.6rem', lineHeight: 1.5 }}>
            <li>
              <strong>J-Cuts & L-Cuts:</strong> Lasse das Audio der nächsten Szene 0.5 bis 1 Sekunde *vor* dem Bildwechsel einspielen (J-Cut). Das macht Schnitte organisch und verhindert ein unnatürliches Ruckeln beim Sprecherwechsel.
            </li>
            <li>
              <strong>Scale Punches (Bildausschnitt-Wechsel):</strong> Schneide nicht nur linear. Verändere den Zoomwert des Sprechers bei jedem thematischen Sprechpause-Wechsel von z.B. 100% auf 118% (Scale-Punch). Das imitiert einen Kamerawechsel.
            </li>
            <li>
              <strong>Keyframing für Dynamic Graphics:</strong> Alle Text-Overlays sollten eine leichte Bewegung aufweisen (z.B. langsamer Zoom von 100% auf 105% über Keyframes), um statische Langeweile im Auge des Betrachters zu verhindern.
            </li>
          </ul>
        </div>
      </div>
    </div>
  )
}
