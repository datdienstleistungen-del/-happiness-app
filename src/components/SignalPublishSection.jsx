import React, { useState } from 'react'
import { 
  ShieldCheck, CheckCircle, Copy, ExternalLink, 
  Check, Loader2, Sparkles, Send, FileText, X, AlertCircle 
} from 'lucide-react'
import { buildSignalPayload, publishSignalToDatWebsite, resolveTriggerCompanyName } from '../lib/nexus-signal-publisher'

export default function SignalPublishSection({
  opportunity = null,
  trigger = null,
  foundContact = null,
  userId = '976e6211-8931-425a-a171-0c062290181b',
  isPreVerified = false,
  overrideCompany = null,
  onPublished = null
}) {
  const [isChecked, setIsChecked] = useState(Boolean(isPreVerified))
  const [analystName, setAnalystName] = useState('Harro Goerndt')
  const [verificationNote, setVerificationNote] = useState('Primärquelle & Datum validiert – 100% faktengeprüft')
  const [isPublishing, setIsPublishing] = useState(false)
  const [publishResult, setPublishResult] = useState(null)
  const [showModal, setShowModal] = useState(false)
  
  const [copiedLink, setCopiedLink] = useState(false)
  const [copiedMessage, setCopiedMessage] = useState(false)

  // Wenn von der 5-Punkte-Prüfung oder Lead-Status verifiziert, automatisch freischalten
  React.useEffect(() => {
    if (isPreVerified) {
      setIsChecked(true)
    }
  }, [isPreVerified])

  const resolvedCompName = overrideCompany || resolveTriggerCompanyName(trigger, opportunity)

  const handlePublish = async () => {
    if (!isChecked && !isPreVerified) return

    setIsPublishing(true)
    try {
      const signalPayload = buildSignalPayload({
        opportunity,
        trigger,
        foundContact,
        analystName: analystName.trim() || 'Harro Goerndt',
        verificationNote: verificationNote.trim(),
        overrideCompany: resolvedCompName
      })

      const result = await publishSignalToDatWebsite({
        signalPayload,
        signalObj: signalPayload,
        userId
      })

      setPublishResult(result)
      setShowModal(true)
      if (onPublished) onPublished(result)
    } catch (err) {
      console.error('[SignalPublishSection] Veröffentlichungsfehler:', err)
      alert('Fehler bei der Veröffentlichung auf dat-dat.de. Bitte prüfen Sie die Verbindung.')
    } finally {
      setIsPublishing(false)
    }
  }

  const handleCopyLink = () => {
    if (!publishResult?.liveUrl) return
    navigator.clipboard.writeText(publishResult.liveUrl)
    setCopiedLink(true)
    setTimeout(() => setCopiedLink(false), 2500)
  }

  const handleCopyMessage = () => {
    if (!publishResult?.linkedInMessage) return
    navigator.clipboard.writeText(publishResult.linkedInMessage)
    setCopiedMessage(true)
    setTimeout(() => setCopiedMessage(false), 2500)
  }

  return (
    <>
      {/* =========================================================================
          1. HUMAN-IN-THE-LOOP PRÜFBEREICH IN DER KARTEIKARTE
          ========================================================================= */}
      <div style={{
        marginTop: '16px',
        background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.7) 0%, rgba(15, 23, 42, 0.8) 100%)',
        border: '1px solid rgba(56, 189, 248, 0.35)',
        borderRadius: '10px',
        padding: '16px',
        boxShadow: '0 4px 14px rgba(0, 0, 0, 0.25)'
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{
              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              color: '#ffffff',
              fontSize: '0.72rem',
              fontWeight: 800,
              padding: '3px 8px',
              borderRadius: '4px',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}>
              <ShieldCheck size={13} /> HUMAN-VERIFIED WORKFLOW
            </span>
            <span style={{ fontSize: '0.85rem', color: '#f8fafc', fontWeight: 600 }}>
              Freigabe &amp; Live-Schaltung auf dat-dat.de {resolvedCompName && <span style={{ color: '#38bdf8' }}>({resolvedCompName})</span>}
            </span>
          </div>

          <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontFamily: 'monospace' }}>
            Paywall: 78,00 € zzgl. USt.
          </span>
        </div>

        {/* Checkbox & Analysten-Eingabefeld */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '14px' }}>
          
          <label style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: '10px',
            cursor: 'pointer',
            padding: '8px 10px',
            background: isChecked ? 'rgba(16, 185, 129, 0.1)' : 'rgba(255, 255, 255, 0.03)',
            border: `1px solid ${isChecked ? 'rgba(16, 185, 129, 0.4)' : 'rgba(255, 255, 255, 0.08)'}`,
            borderRadius: '6px',
            transition: 'all 0.2s ease'
          }}>
            <input
              type="checkbox"
              checked={isChecked}
              onChange={(e) => setIsChecked(e.target.checked)}
              style={{ marginTop: '3px', cursor: 'pointer', accentColor: '#10b981', width: '16px', height: '16px' }}
            />
            <div style={{ fontSize: '0.86rem', color: '#f8fafc', lineHeight: 1.4 }}>
              <strong>Signal manuell geprüft (Primärquelle &amp; Datum validiert)</strong>
              <div style={{ fontSize: '0.76rem', color: '#94a3b8', marginTop: '2px' }}>
                Bestätigt, dass der Trigger real ist, ein klares Kaufsignal darstellt und das Veröffentlichungsdatum &lt; 30 Tage ist.
              </div>
            </div>
          </label>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '10px' }}>
            <div>
              <span style={{ fontSize: '0.73rem', color: '#94a3b8', display: 'block', marginBottom: '3px' }}>
                Verifizierungs-Notiz / Handzeichen Analyst:
              </span>
              <input
                type="text"
                value={analystName}
                onChange={(e) => setAnalystName(e.target.value)}
                placeholder="Harro Goerndt"
                style={{
                  width: '100%',
                  padding: '7px 10px',
                  background: '#090d16',
                  border: '1px solid #1e232d',
                  borderRadius: '6px',
                  color: '#f8fafc',
                  fontSize: '0.85rem',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            <div>
              <span style={{ fontSize: '0.73rem', color: '#94a3b8', display: 'block', marginBottom: '3px' }}>
                Prüfvermerk:
              </span>
              <input
                type="text"
                value={verificationNote}
                onChange={(e) => setVerificationNote(e.target.value)}
                placeholder="Notiz zur Primärquelle..."
                style={{
                  width: '100%',
                  padding: '7px 10px',
                  background: '#090d16',
                  border: '1px solid #1e232d',
                  borderRadius: '6px',
                  color: '#cbd5e1',
                  fontSize: '0.85rem',
                  boxSizing: 'border-box'
                }}
              />
            </div>
          </div>

        </div>

        {/* Action Button */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
          <div style={{ fontSize: '0.78rem', color: isChecked ? '#34d399' : '#f59e0b', display: 'flex', alignItems: 'center', gap: '5px' }}>
            {isChecked ? (
              <>
                <CheckCircle size={14} color="#10b981" />
                <span>Freigabe erteilt. Bereit zur Live-Schaltung auf dat-dat.de.</span>
              </>
            ) : (
              <>
                <AlertCircle size={14} color="#f59e0b" />
                <span>Bitte bestätigen Sie die manuelle Prüfung, um den Button zu aktivieren.</span>
              </>
            )}
          </div>

          <button
            type="button"
            disabled={!isChecked || isPublishing}
            onClick={handlePublish}
            style={{
              background: isChecked 
                ? 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)' 
                : '#1e293b',
              color: isChecked ? '#ffffff' : '#64748b',
              border: isChecked ? '1px solid #38bdf8' : '1px solid #334155',
              padding: '9px 18px',
              borderRadius: '8px',
              fontWeight: 700,
              fontSize: '0.85rem',
              cursor: isChecked && !isPublishing ? 'pointer' : 'not-allowed',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              boxShadow: isChecked ? '0 0 16px rgba(2, 132, 199, 0.4)' : 'none',
              transition: 'all 0.2s ease'
            }}
          >
            {isPublishing ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                <span>Veröffentliche auf dat-dat.de...</span>
              </>
            ) : (
              <>
                <span>🚀 Als Human-Verified Dossier auf dat-dat.de veröffentlichen</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* =========================================================================
          3. BESTÄTIGUNGS-MODAL & LINK-GENERIERUNG IN NEXUS
          ========================================================================= */}
      {showModal && publishResult && (
        <div style={{
          position: 'fixed',
          inset: 0,
          zIndex: 9999,
          background: 'rgba(0, 0, 0, 0.85)',
          backdropFilter: 'blur(6px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px'
        }}>
          <div style={{
            background: '#0a0c0f',
            border: '1px solid #38bdf8',
            borderRadius: '16px',
            maxWidth: '680px',
            width: '100%',
            padding: '28px',
            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.6), 0 0 30px rgba(56, 189, 248, 0.2)',
            display: 'flex',
            flexDirection: 'column',
            gap: '20px',
            animation: 'fadeIn 0.2s ease-out'
          }}>
            
            {/* Modal Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #1e232d', pb: '14px', paddingBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: 'rgba(16, 185, 129, 0.15)', border: '1px solid rgba(16, 185, 129, 0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10b981' }}>
                  <CheckCircle size={24} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.25rem', color: '#f8fafc', fontWeight: 800 }}>
                    Signal erfolgreich live geschaltet!
                  </h3>
                  <p style={{ margin: '3px 0 0 0', fontSize: '0.8rem', color: '#94a3b8' }}>
                    Human-Verified Dossier ist sofort auf dat-dat.de abrufbar &amp; kaufbereit.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowModal(false)}
                style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '6px' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* ELEMENT 1: 🔗 ZIEL-LINK */}
            <div style={{ background: '#11141a', border: '1px solid #1e232d', borderRadius: '10px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  🔗 1. Finaler Live-Ziel-Link (dat-dat.de)
                </span>
                <span style={{ fontSize: '0.72rem', color: '#10b981', background: 'rgba(16, 185, 129, 0.1)', padding: '2px 8px', borderRadius: '4px' }}>
                  ✓ Status: Öffentlich &amp; Paywall aktiv (78 €)
                </span>
              </div>

              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <input
                  type="text"
                  readOnly
                  value={publishResult.liveUrl}
                  style={{
                    flex: 1,
                    padding: '10px 12px',
                    background: '#090d16',
                    border: '1px solid #38bdf8',
                    borderRadius: '6px',
                    color: '#f8fafc',
                    fontFamily: 'monospace',
                    fontSize: '0.88rem'
                  }}
                />

                <button
                  type="button"
                  onClick={handleCopyLink}
                  style={{
                    background: copiedLink ? '#10b981' : '#1e232d',
                    color: copiedLink ? '#ffffff' : '#38bdf8',
                    border: '1px solid #38bdf8',
                    padding: '10px 14px',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontWeight: 600,
                    fontSize: '0.82rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    whiteSpace: 'nowrap',
                    transition: 'all 0.2s ease'
                  }}
                >
                  {copiedLink ? <Check size={16} /> : <Copy size={16} />}
                  <span>{copiedLink ? 'Kopiert!' : 'Link kopieren'}</span>
                </button>

                <a
                  href={publishResult.liveUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    background: '#0284c7',
                    color: '#ffffff',
                    padding: '10px 12px',
                    borderRadius: '6px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    textDecoration: 'none',
                    fontSize: '0.82rem',
                    fontWeight: 600
                  }}
                  title="Dossier in neuem Tab öffnen"
                >
                  <ExternalLink size={16} />
                </a>
              </div>
            </div>

            {/* ELEMENT 2: ✉️ VERKAUFSVORLAGE FÜR LEAD-KÄUFER (LINKEDIN) */}
            <div style={{ background: '#11141a', border: '1px solid #1e232d', borderRadius: '10px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '4px' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  ✉️ 2. Outreach-Vorlage: Signal an Käufer / Headhunter anbieten (LinkedIn)
                </span>
                <span style={{ fontSize: '0.72rem', color: '#10b981', background: 'rgba(16, 185, 129, 0.1)', padding: '2px 8px', borderRadius: '4px' }}>
                  ✓ 100% Geblurt (Kein Google-Leak des Ziel-Accounts)
                </span>
              </div>
              <p style={{ margin: 0, fontSize: '0.75rem', color: '#94a3b8', lineHeight: 1.4 }}>
                Nutzen Sie diesen Text, um Headhunter oder Vertriebler auf LinkedIn anzuschreiben. Der Firmenname bleibt geheim, bis der Interessent das Dossier für 78 € freischaltet.
              </p>

              <textarea
                readOnly
                rows={4}
                value={publishResult.linkedInMessage}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  background: '#090d16',
                  border: '1px solid #1e232d',
                  borderRadius: '6px',
                  color: '#cbd5e1',
                  fontSize: '0.85rem',
                  lineHeight: 1.5,
                  resize: 'none',
                  boxSizing: 'border-box'
                }}
              />

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '4px' }}>
                <button
                  type="button"
                  onClick={handleCopyMessage}
                  style={{
                    background: copiedMessage ? '#10b981' : '#38bdf8',
                    color: '#050608',
                    border: 'none',
                    padding: '8px 16px',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontWeight: 700,
                    fontSize: '0.82rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    transition: 'all 0.2s ease'
                  }}
                >
                  {copiedMessage ? <Check size={16} /> : <Copy size={16} />}
                  <span>{copiedMessage ? 'Anschreiben kopiert!' : 'Anschreiben kopieren'}</span>
                </button>
              </div>
            </div>

            {/* Modal Footer */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', borderTop: '1px solid #1e232d', paddingTop: '14px' }}>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                style={{
                  background: '#1e232d',
                  color: '#f8fafc',
                  border: '1px solid #334155',
                  padding: '9px 18px',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: '0.85rem'
                }}
              >
                Schließen
              </button>
            </div>

          </div>
        </div>
      )}
    </>
  )
}
