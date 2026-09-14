import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { 
  Target, Sparkles, RefreshCw, CheckCircle2, ArrowRight, 
  Save, AlertCircle, Edit3, Plus, ChevronDown, ChevronUp,
  Layers, Zap, ShieldCheck, Globe
} from 'lucide-react'
import { callNexusAI } from '../lib/nexus-ai'
import { createOffering, generateSignalStrategies } from '../lib/nexus-db'
import { trackOfferingAnalyzed } from '../lib/nexus-analytics'
import NexusAnalysisResult from '../components/NexusAnalysisResult'
import SignalStrategiesManager from '../components/nexus/SignalStrategiesManager'
import { useLead } from '../context/LeadContext'
import { useAuth } from '../context/AuthContext'
import { useLanguage } from '../i18n/translations.jsx'
import { ContextHelpButton } from '../context/GuideContext'
import './AngebotsanalysePage.css'

const PRESET_IDEAS = [
  {
    label: "B2B SaaS / CRM",
    text: "Cloudbasierte Vertriebs- und CRM-Software für wachsende IT-Unternehmen"
  },
  {
    label: "Industrie-Wartung",
    text: "IoT-Sensorik und vorausschauende Wartung für Maschinenbau-Fertigungsstraßen"
  },
  {
    label: "Vertriebsberatung",
    text: "Outbound-Vertriebsoptimierung und B2B-Terminierung für Dienstleister"
  },
  {
    label: "IT-Security & DSGVO",
    text: "Automatisierte Pentests und DSGVO-Compliance-Audits für den Mittelstand"
  }
]

export default function AngebotsanalysePage() {
  const { t, lang } = useLanguage()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { refreshData, offerings, activeOffering, activeOfferingId, setActiveOfferingId } = useLead()
  
  // View states: false = show active profile; true = create / analyze new offering
  const [isCreatingNew, setIsCreatingNew] = useState(false)
  const [angebotInput, setAngebotInput] = useState('')
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [analysisResult, setAnalysisResult] = useState(null)
  const [showManualFields, setShowManualFields] = useState(false)
  
  // Editable form fields (derived from AI analysis)
  const [formOfferingName, setFormOfferingName] = useState('')
  const [formTargetAudience, setFormTargetAudience] = useState('')
  const [formPositioning, setFormPositioning] = useState('')
  
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState(null)
  const [successMsg, setSuccessMsg] = useState(null)

  // Check for pending landing page analysis on initial mount (only when logged in)
  useEffect(() => {
    if (!user) return
    try {
      const pendingStr = sessionStorage.getItem('nexus_pending_analysis')
      if (pendingStr) {
        const pending = JSON.parse(pendingStr)
        if (pending.angebot) {
          setAngebotInput(pending.angebot)
          setIsCreatingNew(true)
          if (pending.analyse) {
            applyAiResult(pending.analyse, pending.angebot)
          }
        }
      }
    } catch (e) {
      console.warn('Could not parse pending analysis:', e)
    }
  }, [user])

  // Auto-fill active offering in view mode
  useEffect(() => {
    if (activeOffering && !isCreatingNew) {
      setFormOfferingName(activeOffering.offering_name || '')
      setFormTargetAudience(activeOffering.target_audience || '')
      setFormPositioning(activeOffering.positioning || '')
    }
  }, [activeOffering, isCreatingNew])

  // Helper to extract clean strings from AI JSON structure
  const applyAiResult = (data, rawInput) => {
    setAnalysisResult(data)

    // 1. Offering Name
    const nameCandidate = rawInput?.split(/[,.\n]/)[0]?.trim() || 'NeXus B2B Angebot'
    setFormOfferingName(nameCandidate.slice(0, 60))

    // 2. Target Audience
    let audienceStr = ''
    if (typeof data.zielgruppe === 'string') {
      audienceStr = data.zielgruppe
    } else if (data.zielgruppe?.beschreibung) {
      audienceStr = data.zielgruppe.beschreibung
      if (data.zielgruppe.entscheider && Array.isArray(data.zielgruppe.entscheider)) {
        audienceStr += ` (Entscheider: ${data.zielgruppe.entscheider.join(', ')})`
      }
    } else if (data.zielgruppen_profil?.zielgruppe) {
      audienceStr = data.zielgruppen_profil.zielgruppe
    }
    setFormTargetAudience(audienceStr)

    // 3. Positioning / Value Proposition
    let posStr = ''
    if (data.pitch_grundlage?.value_proposition) {
      posStr = data.pitch_grundlage.value_proposition
    } else if (data.sales_pitch?.pitch) {
      posStr = data.sales_pitch.pitch
    } else if (data.value_proposition) {
      posStr = data.value_proposition
    } else if (typeof data.vertriebsstrategie === 'string') {
      posStr = data.vertriebsstrategie
    }
    setFormPositioning(posStr)
    trackOfferingAnalyzed(nameCandidate, audienceStr)
  }

  // Single-Input Trigger: Run existing AI analysis
  const handleRunAnalysis = async (e) => {
    if (e) e.preventDefault()
    if (!angebotInput.trim()) {
      setError('Bitte gib kurz ein, was du anbietest.')
      return
    }

    setIsAnalyzing(true)
    setError(null)
    setSuccessMsg(null)

    try {
      const data = await callNexusAI({
        mode: 'angebotsanalyse',
        angebot: angebotInput.trim(),
        branche: 'B2B',
        lang: lang || 'de'
      })

      if (!data) {
        throw new Error('Keine Antwort von der NeXus AI erhalten.')
      }

      applyAiResult(data, angebotInput.trim())
    } catch (err) {
      console.error('Analyse-Fehler:', err)
      setError(`Analyse-Fehler: ${err.message || 'Die KI konnte das Angebot nicht verarbeiten.'}`)
    } finally {
      setIsAnalyzing(false)
    }
  }

  // Persist Offering to Supabase & Generate Signal Strategies
  const handleSaveOffering = async () => {
    if (!user) {
      setError('Du musst eingeloggt sein, um ein Angebot zu speichern.')
      return
    }

    if (!formOfferingName.trim() && !angebotInput.trim()) {
      setError('Bitte gib einen Namen oder eine Beschreibung für das Angebot an.')
      return
    }

    setIsSaving(true)
    setError(null)

    try {
      const payload = {
        offering_name: formOfferingName.trim() || angebotInput.trim().slice(0, 50),
        target_audience: formTargetAudience.trim() || 'B2B Entscheider',
        positioning: formPositioning.trim() || angebotInput.trim()
      }

      const savedOffering = await createOffering(user.id, payload)
      if (!savedOffering || !savedOffering.id) {
        throw new Error('Das Angebot konnte nicht in der Datenbank gespeichert werden.')
      }

      // Automatically generate initial signal strategies from AI understanding
      try {
        const aiUnderstanding = {
          offering_name: savedOffering.offering_name,
          target_audience: savedOffering.target_audience,
          positioning: savedOffering.positioning,
          demand_contexts: analysisResult?.trigger_events || analysisResult?.relevante_trigger || []
        }
        await generateSignalStrategies(savedOffering.id, aiUnderstanding, null, lang || 'de')
      } catch (stratErr) {
        console.warn('[Angebotsanalyse] Strategy generation notice:', stratErr.message)
      }

      // Clear session storage if present
      sessionStorage.removeItem('nexus_pending_analysis')

      // Refresh lead context and set newly created offering as active
      if (refreshData) await refreshData()
      if (setActiveOfferingId) setActiveOfferingId(savedOffering.id)

      setIsCreatingNew(false)
      setAnalysisResult(null)
      setSuccessMsg('Angebotsprofil erfolgreich gespeichert & Signal-Strategien aktiviert!')
      setTimeout(() => setSuccessMsg(null), 5000)
    } catch (err) {
      console.error('Speicher-Fehler:', err)
      setError(`Speicher-Fehler: ${err.message || 'Unbekannter Fehler'}`)
    } finally {
      setIsSaving(false)
    }
  }

  const handleStartNewAnalysis = () => {
    setAngebotInput('')
    setAnalysisResult(null)
    setFormOfferingName('')
    setFormTargetAudience('')
    setFormPositioning('')
    setError(null)
    setIsCreatingNew(true)
  }

  return (
    <div className="angebotsanalyse-page">
      
      {/* Header Navigation */}
      <header className="page-header">
        <button 
          className="btn-back-link" 
          onClick={() => navigate('/nexus/dashboard')}
        >
          <ArrowRight size={14} className="rotate-180" /> 
          <span>{t('nexus.backToDashboard', 'Zurück zum Dashboard')}</span>
        </button>

        <div className="header-title-box">
          <div className="header-icon-badge">
            <Target size={22} className="text-[#155DFC]" />
          </div>
          <div>
            <h1>
              {t('nexus.offeringAnalysis.headerTitle', 'Mein Angebot')} <ContextHelpButton helpKey="offering.definition" />
            </h1>
            <p className="header-subtitle">
              {t('nexus.offeringAnalysis.subtitle', 'Definiere dein zentrales Wertangebot. NeXus analysiert dein Angebot semantisch und aktiviert automatische Suchstrategien für den Lead Radar.')}
            </p>
          </div>
        </div>
      </header>

      {successMsg && (
        <div className="nexus-alert-success animate-fade-in">
          <CheckCircle2 size={18} />
          <span>{successMsg}</span>
        </div>
      )}

      {error && (
        <div className="nexus-alert-error animate-fade-in">
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {/* =========================================================================
          ZUSTAND 1: NEUES ANGEBOT ANALYSIEREN (SINGLE-INPUT FLOW)
          ========================================================================= */}
      {(isCreatingNew || (!activeOffering && offerings.length === 0)) ? (
        <div className="single-input-card animate-fade-in">
          <div className="single-input-header">
            <Sparkles size={20} className="text-[#155DFC]" />
            <div>
              <h2>{t('nexus.offeringAnalysis.singleInputTitle', 'Was bietest du an?')}</h2>
              <p>{t('nexus.offeringAnalysis.singleInputSubtitle', 'Beschreibe dein Produkt oder deine Dienstleistung in 1–2 Sätzen. NeXus ermittelt Zielgruppe, Schmerzpunkte und Kaufauslöser automatisch.')}</p>
            </div>
          </div>

          <form onSubmit={handleRunAnalysis} className="single-input-form">
            <div className="textarea-wrapper">
              <textarea
                className="single-input-textarea"
                rows={3}
                placeholder={t('nexus.offeringAnalysis.placeholder', 'z. B. Cloudbasierte CRM- und Vertriebssoftware für wachsende IT-Unternehmen...')}
                value={angebotInput}
                onChange={(e) => setAngebotInput(e.target.value)}
                disabled={isAnalyzing}
                autoFocus
              />

              {/* Inspiration Chips */}
              <div className="preset-chips-row">
                <span className="preset-label">{t('nexus.offeringAnalysis.inspiration', 'Inspiration:')}</span>
                {PRESET_IDEAS.map((preset, idx) => (
                  <button
                    key={idx}
                    type="button"
                    className="preset-chip-btn"
                    onClick={() => setAngebotInput(preset.text)}
                    disabled={isAnalyzing}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="single-input-actions">
              <button
                type="submit"
                className="btn-analyze-primary"
                disabled={isAnalyzing || !angebotInput.trim()}
              >
                {isAnalyzing ? (
                  <>
                    <RefreshCw size={16} className="spin" />
                    <span>{t('nexus.offeringAnalysis.btnAnalyzing', 'NeXus analysiert dein Angebot …')}</span>
                  </>
                ) : (
                  <>
                    <Zap size={16} />
                    <span>{t('nexus.offeringAnalysis.btnAnalyze', 'Angebot analysieren ⚡')}</span>
                  </>
                )}
              </button>

              {activeOffering && (
                <button
                  type="button"
                  className="btn-cancel-link"
                  onClick={() => { setIsCreatingNew(false); setAnalysisResult(null); }}
                >
                  {t('nexus.offeringAnalysis.btnCancel', 'Abbrechen (Zurück zum Profil)')}
                </button>
              )}
            </div>
          </form>

          {/* Result Presentation after Analysis */}
          {analysisResult && (
            <div className="analysis-output-section animate-fade-in">
              <div className="analysis-output-badge">
                <CheckCircle2 size={18} className="text-[#10B981]" />
                <h3>{t('nexus.offeringAnalysis.understoodTitle', 'NeXus hat dein Angebot verstanden')}</h3>
              </div>

              {/* Visualized Intelligence Matrix */}
              <div className="analysis-result-box">
                <NexusAnalysisResult data={analysisResult} mode="angebotsanalyse" />
              </div>

              {/* Optional Manual Review Collapsible */}
              <div className="manual-review-accordion">
                <button 
                  type="button" 
                  className="accordion-toggle-btn"
                  onClick={() => setShowManualFields(!showManualFields)}
                >
                  <div className="toggle-left">
                    <Edit3 size={15} />
                    <span>{t('nexus.offeringAnalysis.reviewTitle', 'Erkannte Daten überprüfen oder anpassen (Optional)')}</span>
                  </div>
                  {showManualFields ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </button>

                {showManualFields && (
                  <div className="manual-review-fields animate-fade-in">
                    <div className="review-field">
                      <label htmlFor="formOfferingName">{t('nexus.offeringAnalysis.fieldName', 'Angebotsname / Titel')}</label>
                      <input 
                        id="formOfferingName"
                        type="text" 
                        value={formOfferingName} 
                        onChange={(e) => setFormOfferingName(e.target.value)} 
                        placeholder="z. B. B2B SaaS CRM Plattform"
                      />
                    </div>

                    <div className="review-field">
                      <label htmlFor="formTargetAudience">{t('nexus.offeringAnalysis.fieldAudience', 'Zielgruppe & Entscheider')}</label>
                      <textarea 
                        id="formTargetAudience"
                        rows={2}
                        value={formTargetAudience} 
                        onChange={(e) => setFormTargetAudience(e.target.value)} 
                        placeholder="z. B. Geschäftsführer & Vertriebsleiter in IT-Unternehmen"
                      />
                    </div>

                    <div className="review-field">
                      <label htmlFor="formPositioning">{t('nexus.offeringAnalysis.fieldPositioning', 'Value Proposition / Verkaufsargument')}</label>
                      <textarea 
                        id="formPositioning"
                        rows={2}
                        value={formPositioning} 
                        onChange={(e) => setFormPositioning(e.target.value)} 
                        placeholder="z. B. Automatisiert die Akquise und eliminiert manuelle Recherche."
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Save Button */}
              <div className="save-action-bar">
                <button
                  type="button"
                  className="btn-save-offering"
                  onClick={handleSaveOffering}
                  disabled={isSaving}
                >
                  {isSaving ? (
                    <>
                      <RefreshCw size={16} className="spin" />
                      <span>{t('nexus.offeringAnalysis.btnSaving', 'Speichere & aktiviere Signal-Strategien...')}</span>
                    </>
                  ) : (
                    <>
                      <Save size={16} />
                      <span>{t('nexus.offeringAnalysis.btnSaveOffering', 'Angebotsprofil speichern & Signal-Strategien aktivieren')}</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* =========================================================================
            ZUSTAND 2: AKTIVES ANGEBOTSPROFIL ANZEIGEN & VERWALTEN
            ========================================================================= */
        <div className="active-profile-container animate-fade-in">
          
          {/* Profile Switcher & Actions Top Bar */}
          <div className="profile-top-bar">
            <div className="profile-badge-row">
              <span className="badge-active-indicator">{t('nexus.offeringAnalysis.activeTitle', '🟢 Aktives Angebot')}</span>
              {offerings.length > 1 && (
                <div className="profile-select-wrap">
                  <label htmlFor="profile-select">{t('nexus.offeringAnalysis.switchProfile', 'Profil wechseln:')}</label>
                  <select
                    id="profile-select"
                    value={activeOfferingId || ''}
                    onChange={(e) => setActiveOfferingId(e.target.value)}
                    className="profile-select"
                  >
                    {offerings.map(o => (
                      <option key={o.id} value={o.id}>
                        {o.offering_name || o.product_name || 'Unbenanntes Angebot'}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <button
              type="button"
              className="btn-new-offering"
              onClick={handleStartNewAnalysis}
            >
              <Plus size={15} />
              <span>{t('nexus.offeringAnalysis.btnNewOffering', 'Neues Angebot analysieren')}</span>
            </button>
          </div>

          {/* Active Profile Summary Card */}
          <div className="active-profile-card">
            <div className="profile-section">
              <span className="profile-label">{t('nexus.offeringAnalysis.productService', 'Produkt / Dienstleistung')}</span>
              <h3 className="profile-offering-name">{activeOffering?.offering_name || 'B2B Angebot'}</h3>
            </div>

            <div className="profile-grid">
              <div className="profile-grid-col">
                <span className="profile-label">{t('nexus.offeringAnalysis.targetGroup', 'Zielgruppe')}</span>
                <p className="profile-text">{activeOffering?.target_audience || 'Noch keine Zielgruppe definiert.'}</p>
              </div>
              <div className="profile-grid-col">
                <span className="profile-label">{t('nexus.offeringAnalysis.valueProp', 'Value Proposition / Positionierung')}</span>
                <p className="profile-text">{activeOffering?.positioning || 'Noch keine Positionierung hinterlegt.'}</p>
              </div>
            </div>
          </div>

          {/* Signal Strategies Engine for the active offering */}
          <SignalStrategiesManager offering={activeOffering} />

          {/* Next Steps CTA to Lead Radar */}
          <div className="pipeline-next-step-card">
            <div className="next-step-info">
              <h4>{t('nexus.offeringAnalysis.readyRadar', '🎯 Bereit für den Lead Radar?')}</h4>
              <p>{t('nexus.offeringAnalysis.readyRadarDesc', 'Nutze die generierten Signal-Strategien deines Angebots, um akute Kaufreize im Markt in Echtzeit zu finden.')}</p>
            </div>
            <button 
              className="btn-to-radar"
              onClick={() => navigate('/nexus/lead-radar')}
            >
              <span>{t('nexus.offeringAnalysis.toLeadRadar', 'Zum Lead Radar')}</span>
              <ArrowRight size={16} />
            </button>
          </div>

        </div>
      )}

    </div>
  )
}
