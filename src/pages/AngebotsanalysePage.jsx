import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { 
  Target, Sparkles, RefreshCw, CheckCircle2, ArrowRight, 
  Save, AlertCircle, Edit3, Plus, ChevronDown, ChevronUp,
  Layers, Zap, ShieldCheck, Globe, Clock, Trash2
} from 'lucide-react'
import { callNexusAI } from '../lib/nexus-ai'
import { 
  createOffering, 
  generateSignalStrategies, 
  createOrUpdateFilterProfile,
  cleanupTestOfferings,
  deleteOffering 
} from '../lib/nexus-db'
import { trackOfferingAnalyzed } from '../lib/nexus-analytics'
import NexusAnalysisResult from '../components/NexusAnalysisResult'
import SignalStrategiesManager from '../components/nexus/SignalStrategiesManager'
import { useLead } from '../context/LeadContext'
import { useAuth } from '../context/AuthContext'
import { useLanguage } from '../i18n/translations.jsx'
import { ContextHelpButton } from '../context/GuideContext'
import { TRIGGER_CATEGORIES, B2B_TRIGGER_PRESETS, isTestOffering } from '../lib/nexus-validation'
import './AngebotsanalysePage.css'

export default function AngebotsanalysePage() {
  const { t, lang } = useLanguage()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { refreshData, offerings, activeOffering, activeOfferingId, setActiveOfferingId } = useLead()
  
  // View states: false = show active profile; true = create / analyze new offering
  const [isCreatingNew, setIsCreatingNew] = useState(false)
  const [selectedPresetId, setSelectedPresetId] = useState('')
  const [selectedCategoryId, setSelectedCategoryId] = useState('')
  const [angebotInput, setAngebotInput] = useState('')
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [analysisResult, setAnalysisResult] = useState(null)
  const [showManualFields, setShowManualFields] = useState(false)
  
  // Editable form fields (derived from AI analysis)
  const [formOfferingName, setFormOfferingName] = useState('')
  const [formTargetAudience, setFormTargetAudience] = useState('')
  const [formPositioning, setFormPositioning] = useState('')
  const [maxAgeDays, setMaxAgeDays] = useState(14)
  
  const [isSaving, setIsSaving] = useState(false)
  const [isCleaning, setIsCleaning] = useState(false)
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
      const savedMaxAge = activeOffering.max_age_days || activeOffering.ai_understanding?.max_age_days
      if (savedMaxAge) {
        setMaxAgeDays(Math.max(1, Math.min(30, Number(savedMaxAge) || 14)))
      }
    }
  }, [activeOffering, isCreatingNew])

  // Synchronisiere aktives Angebot mit Vorlagen-Katalog (Preset-Erkennung)
  useEffect(() => {
    if (activeOffering) {
      const catId = activeOffering.ai_understanding?.category_id
      const offName = (activeOffering.offering_name || '').toLowerCase()
      const matched = B2B_TRIGGER_PRESETS.find(p => 
        p.id === catId ||
        (p.key && offName.includes(p.key)) ||
        offName.includes(p.badge.toLowerCase()) ||
        offName.includes(p.title.toLowerCase().slice(0, 15))
      )
      if (matched) {
        setSelectedPresetId(matched.id)
        setSelectedCategoryId(matched.id)
      } else {
        setSelectedPresetId('')
      }
    }
  }, [activeOffering])

  // Auswahl einer festen B2B-Vorlage (Preset)
  const handleSelectPreset = async (presetId) => {
    if (!presetId) {
      setSelectedPresetId('')
      return
    }
    const preset = B2B_TRIGGER_PRESETS.find(p => p.id === presetId)
    if (!preset) return

    setSelectedPresetId(preset.id)
    setSelectedCategoryId(preset.id)
    setAngebotInput(preset.searchQuery)
    setFormOfferingName(preset.offeringName)
    setFormTargetAudience(preset.targetAudience)
    setFormPositioning(preset.positioning)
    setMaxAgeDays(preset.maxAgeDays || 14)

    // Prüfen, ob für dieses Preset bereits ein bereinigtes Profil existiert
    const existingMatch = offerings.find(o => 
      !isTestOffering(o) && (
        o.ai_understanding?.category_id === preset.id ||
        (o.offering_name && o.offering_name.toLowerCase().includes(preset.key)) ||
        (o.offering_name && o.offering_name.toLowerCase().includes(preset.badge.toLowerCase()))
      )
    )

    if (existingMatch) {
      if (setActiveOfferingId) setActiveOfferingId(existingMatch.id)
      setIsCreatingNew(false)
      setSuccessMsg(`B2B-Vorlage "${preset.shortLabel}" als aktives Profil geladen.`)
      setTimeout(() => setSuccessMsg(null), 4000)
    } else {
      setIsCreatingNew(true)
      setSuccessMsg(`B2B-Vorlage "${preset.shortLabel}" ausgewählt. Formular mit System-Prompt & Suchkriterien befüllt.`)
      setTimeout(() => setSuccessMsg(null), 4000)
    }
  }

  // 1-Klick Preset direkt speichern & aktivieren
  const handleDirectActivatePreset = async (presetToActivate = null) => {
    if (!user) {
      setError('Du musst eingeloggt sein, um eine Vorlage zu aktivieren.')
      return
    }

    const preset = presetToActivate || B2B_TRIGGER_PRESETS.find(p => p.id === selectedCategoryId) || B2B_TRIGGER_PRESETS[0]
    setIsSaving(true)
    setError(null)

    try {
      const offName = formOfferingName.trim() || preset.offeringName
      const targetAudience = formTargetAudience.trim() || preset.targetAudience
      const pos = formPositioning.trim() || preset.positioning

      const aiUnderstanding = {
        offering_name: offName,
        core_offering: offName,
        target_audience: targetAudience,
        positioning: pos,
        category_id: preset.id,
        trigger_category: preset.title,
        crawler_operators: preset.crawlerOperator,
        max_age_days: maxAgeDays || preset.maxAgeDays,
        demand_contexts: preset.demandContexts
      }

      const payload = {
        offering_name: offName,
        target_audience: targetAudience,
        positioning: pos,
        ai_understanding: aiUnderstanding
      }

      const savedOffering = await createOffering(user.id, payload)
      if (!savedOffering || !savedOffering.id) {
        throw new Error('Das Angebot konnte nicht in der Datenbank gespeichert werden.')
      }

      try {
        await generateSignalStrategies(savedOffering.id, aiUnderstanding, null, lang || 'de')
        const keywords = [
          ...offName.split(/\s+/).filter(w => w.length > 3),
          ...targetAudience.split(/[,/\s]+/).filter(w => w.length > 3),
          ...preset.demandContexts
        ].slice(0, 15)

        await createOrUpdateFilterProfile(user.id, savedOffering.id, {
          targetKeywords: keywords,
          negativeKeywords: ['Stellenangebot', 'Bewerbung', 'Praktikum', 'Aktienkurs', 'free download'],
          industry: targetAudience
        })
      } catch (stratErr) {
        console.warn('[Angebotsanalyse] Strategy / Filter generation notice:', stratErr.message)
      }

      sessionStorage.removeItem('nexus_pending_analysis')
      if (refreshData) await refreshData()
      if (setActiveOfferingId) setActiveOfferingId(savedOffering.id)

      setIsCreatingNew(false)
      setAnalysisResult(null)
      setSuccessMsg(`Vorlage "${offName}" erfolgreich gespeichert & Signal-Strategien aktiviert!`)
      setTimeout(() => setSuccessMsg(null), 5000)
    } catch (err) {
      console.error('Preset-Aktivierungs-Fehler:', err)
      setError(`Fehler beim Aktivieren der Vorlage: ${err.message || 'Unbekannter Fehler'}`)
    } finally {
      setIsSaving(false)
    }
  }

  // Cleanup-Button: Löscht alte Test-Einträge ("bitte um infö", "software käufer", etc.)
  const handleCleanupTestEntries = async () => {
    if (!user) {
      setError('Bitte logge dich ein, um die Datenbank zu bereinigen.')
      return
    }

    const confirmed = window.confirm(
      'Möchtest du wirklich alle alten Test-Einträge (z. B. "bitte um infö", "software käufer", Test-Profile) unwiderruflich aus der Datenbank entfernen?'
    )
    if (!confirmed) return

    setIsCleaning(true)
    setError(null)
    try {
      const res = await cleanupTestOfferings(user.id)
      if (refreshData) await refreshData()
      setSuccessMsg(`🗑️ Datenbank bereinigt: ${res.deletedCount || 0} Test-Einträge wurden dauerhaft aus der Datenbank entfernt.`)
      setTimeout(() => setSuccessMsg(null), 6000)
    } catch (err) {
      console.error('Cleanup error:', err)
      setError(`Fehler beim Bereinigen der Datenbank: ${err.message || 'Unbekannter Fehler'}`)
    } finally {
      setIsCleaning(false)
    }
  }

  // Helper to extract clean strings from AI JSON structure
  const applyAiResult = (data, rawInput) => {
    setAnalysisResult(data)

    // 1. Kompaktes Token-Spar-Format ({ trigger_type, company_name, region, industry, buyer_target_group, ... })
    if (data?.trigger_type || data?.buyer_target_group) {
      const nameCandidate = data.company_name || data.trigger_type || rawInput?.split(/[,.\n]/)[0]?.trim() || 'NeXus B2B Signal'
      setFormOfferingName(nameCandidate.slice(0, 60))
      
      const audience = data.buyer_target_group || (data.industry ? `B2B-Entscheider (${data.industry})` : 'B2B Dienstleister')
      setFormTargetAudience(audience)

      const pos = `${data.trigger_type || 'Kaufsignal'} · Branche: ${data.industry || 'B2B'} · Region: ${data.region || 'DACH'}${data.evidence_quote ? ` — "${data.evidence_quote}"` : ''}`
      setFormPositioning(pos)
      trackOfferingAnalyzed(nameCandidate, audience)
      return
    }

    // 2. Standard-Format Fallback
    const nameCandidate = rawInput?.split(/[,.\n]/)[0]?.trim() || 'NeXus B2B Angebot'
    setFormOfferingName(nameCandidate.slice(0, 60))

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
      setError('Bitte wähle eine Kategorie aus dem Katalog oder gib kurz deinen Suchauftrag ein.')
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
        lang: lang || 'de',
        max_age_days: maxAgeDays
      })

      const rawText = typeof data === 'string'
        ? data
        : (data?.response || data?.text || data?.content || '');

      if (rawText.trim().includes('KEIN_VALIDES_SIGNAL') || data?.is_valid_signal === false) {
        setError('Token-Bremse aktiv: Kein valides B2B-Kaufsignal erkannt. Das Ereignis ist entweder nicht exakt belegbar (Datum, Ort, Unternehmen) oder erzeugt keinen geschäftlichen Handlungsdruck. Es wurden keine weiteren Token verbraucht.')
        setIsAnalyzing(false)
        return
      }

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
      const triggers = analysisResult?.trigger_events || analysisResult?.relevante_trigger || []
      const offName = formOfferingName.trim() || angebotInput.trim().slice(0, 50)
      const targetAudience = formTargetAudience.trim() || 'B2B Entscheider'
      const pos = formPositioning.trim() || angebotInput.trim()

      const selectedCategoryObj = TRIGGER_CATEGORIES.find(c => c.id === selectedCategoryId) || null;

      const aiUnderstanding = {
        offering_name: offName,
        core_offering: offName,
        target_audience: targetAudience,
        positioning: pos,
        category_id: selectedCategoryId || null,
        trigger_category: selectedCategoryObj?.title || null,
        crawler_operators: selectedCategoryObj?.primaryOperator || null,
        max_age_days: maxAgeDays,
        demand_contexts: Array.isArray(triggers) && triggers.length > 0
          ? triggers.map(t => typeof t === 'string' ? t : (t.signal || t.event || t.trigger_name || ''))
          : [
              `Wachstum und Expansion in der Zielgruppe ${targetAudience}`,
              `Erhöhter Bedarf an: ${pos}`,
              `Einstellung von Führungskräften / Vertriebsausbau`,
              `Neukundengewinnung & Expansion in neue Märkte`
            ]
      }

      const payload = {
        offering_name: offName,
        target_audience: targetAudience,
        positioning: pos,
        ai_understanding: aiUnderstanding
      }

      const savedOffering = await createOffering(user.id, payload)
      if (!savedOffering || !savedOffering.id) {
        throw new Error('Das Angebot konnte nicht in der Datenbank gespeichert werden.')
      }

      // Automatically generate initial signal strategies & V3 Filter Profile
      try {
        await generateSignalStrategies(savedOffering.id, aiUnderstanding, null, lang || 'de')

        // V3 Multi-Tenant Filter Profile anlegen
        const keywords = [
          ...savedOffering.offering_name.split(/\s+/).filter(w => w.length > 3),
          ...savedOffering.target_audience.split(/[,/\s]+/).filter(w => w.length > 3),
          ...(Array.isArray(triggers) ? triggers.map(t => typeof t === 'string' ? t : (t.signal || t.event || '')).filter(Boolean) : [])
        ].slice(0, 15);

        await createOrUpdateFilterProfile(user.id, savedOffering.id, {
          targetKeywords: keywords,
          negativeKeywords: ['Stellenangebot', 'Bewerbung', 'Praktikum', 'Aktienkurs', 'free download'],
          industry: savedOffering.target_audience
        });
      } catch (stratErr) {
        console.warn('[Angebotsanalyse] Strategy / Filter generation notice:', stratErr.message)
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
    setSelectedPresetId('')
    setSelectedCategoryId('')
    setAngebotInput('')
    setAnalysisResult(null)
    setFormOfferingName('')
    setFormTargetAudience('')
    setFormPositioning('')
    setMaxAgeDays(14)
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
              <h2>{t('nexus.offeringAnalysis.singleInputTitle', 'Was suchst du? (Suchauftrag)')}</h2>
              <p>{t('nexus.offeringAnalysis.singleInputSubtitle', 'Beschreibe die gesuchten Trigger, Anlässe oder Signale in 1–2 Sätzen. NeXus ermittelt Zielgruppe, Schmerzpunkte und Kaufauslöser automatisch.')}</p>
            </div>
          </div>

          <form onSubmit={handleRunAnalysis} className="single-input-form">
            
            {/* 1. Dropdown-Katalog statt Freitext-Eingabe (5 Kern-Kategorien) */}
            {/* 1. Dropdown-Katalog statt Freitext-Eingabe (5 Kern-Kategorien) */}
            <div className="trigger-catalog-wrapper" style={{
              background: 'linear-gradient(135deg, rgba(17, 20, 26, 0.95) 0%, rgba(9, 13, 22, 0.95) 100%)',
              border: '1px solid rgba(56, 189, 248, 0.35)',
              borderRadius: '12px',
              padding: '16px 18px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.35)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                <label htmlFor="triggerCategoryDropdown" style={{ fontSize: '0.85rem', fontWeight: 700, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Layers size={16} color="#38bdf8" />
                  <span>Vorgegebene Kern-Kategorie wählen (B2B-Vorlage):</span>
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '0.72rem', color: '#10b981', fontFamily: 'monospace', fontWeight: 700, background: 'rgba(16, 185, 129, 0.1)', padding: '2px 8px', borderRadius: '4px', border: '1px solid rgba(16, 185, 129, 0.25)' }}>
                    ✓ Strikter B2B-Katalog (Token-Bremse aktiv)
                  </span>
                  <button
                    type="button"
                    onClick={handleCleanupTestEntries}
                    disabled={isCleaning}
                    className="btn-cleanup-tests-compact"
                    title="Löscht alte Test-Einträge ('bitte um infö', etc.) dauerhaft aus der Datenbank"
                    style={{
                      background: 'rgba(239, 68, 68, 0.12)',
                      border: '1px solid rgba(239, 68, 68, 0.3)',
                      color: '#f87171',
                      fontSize: '0.72rem',
                      fontWeight: 600,
                      padding: '3px 8px',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    <Trash2 size={12} />
                    <span>Test-Einträge löschen</span>
                  </button>
                </div>
              </div>

              <select
                id="triggerCategoryDropdown"
                value={selectedCategoryId}
                onChange={(e) => handleSelectPreset(e.target.value)}
                disabled={isAnalyzing}
                style={{
                  width: '100%',
                  padding: '11px 14px',
                  background: '#090d16',
                  border: '1px solid #334155',
                  borderRadius: '8px',
                  color: '#f8fafc',
                  fontSize: '0.9rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  outline: 'none',
                  boxShadow: 'inset 0 2px 4px rgba(0, 0, 0, 0.4)'
                }}
              >
                <option value="">-- Bitte eine der 5 B2B-Kern-Kategorien wählen --</option>
                {B2B_TRIGGER_PRESETS.map(preset => (
                  <option key={preset.id} value={preset.id}>
                    {preset.label}
                  </option>
                ))}
              </select>

              {/* 1-Click Schnellauswahl-Pills */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center' }}>
                <span style={{ fontSize: '0.72rem', color: '#94a3b8', fontWeight: 600 }}>1-Klick-Auswahl:</span>
                {B2B_TRIGGER_PRESETS.map(preset => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => handleSelectPreset(preset.id)}
                    disabled={isAnalyzing}
                    style={{
                      padding: '4px 10px',
                      fontSize: '0.73rem',
                      borderRadius: '6px',
                      background: selectedCategoryId === preset.id ? 'rgba(56, 189, 248, 0.2)' : 'rgba(255, 255, 255, 0.04)',
                      border: `1px solid ${selectedCategoryId === preset.id ? '#38bdf8' : 'rgba(255, 255, 255, 0.08)'}`,
                      color: selectedCategoryId === preset.id ? '#38bdf8' : '#cbd5e1',
                      fontWeight: selectedCategoryId === preset.id ? 700 : 500,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    Kat. {preset.number}: {preset.title}
                  </button>
                ))}
              </div>
            </div>

            {/* Manuelle Verfeinerung (Optionales Freitext-Feld) */}
            <div className="textarea-wrapper">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.78rem', color: '#94a3b8', fontWeight: 500 }}>
                  Suchauftrag / Prompt-Details (automatisch durch Katalog befüllt, editierbar):
                </span>
                {selectedCategoryId && (
                  <span style={{ fontSize: '0.72rem', color: '#38bdf8', fontFamily: 'monospace' }}>
                    Katalog-Preset aktiv
                  </span>
                )}
              </div>
              <textarea
                className="single-input-textarea"
                rows={3}
                placeholder="Wähle oben eine Kern-Kategorie oder gib hier eigene Stichworte ein..."
                value={angebotInput}
                onChange={(e) => setAngebotInput(e.target.value)}
                disabled={isAnalyzing}
              />
            </div>

            {/* Aktualitäts-Regler (Slider) */}
            <div className="max-age-slider-group">
              <div className="max-age-slider-header">
                <label htmlFor="maxAgeSlider" className="max-age-slider-label">
                  <Clock size={15} className="text-[#38bdf8]" />
                  <span>Maximales Alter des Triggers (in Tagen):</span>
                  <span className="max-age-slider-value">{maxAgeDays} {maxAgeDays === 1 ? 'Tag' : 'Tage'}</span>
                </label>
                <span className="max-age-slider-hint">Standard: 14 Tage (1 bis 30 Tage)</span>
              </div>
              <input
                id="maxAgeSlider"
                type="range"
                min="1"
                max="30"
                value={maxAgeDays}
                onChange={(e) => setMaxAgeDays(parseInt(e.target.value, 10))}
                disabled={isAnalyzing}
                className="max-age-slider-input"
              />
              <div className="max-age-slider-ticks">
                <span>1 Tag (Ultra-frisch)</span>
                <span>14 Tage (Standard)</span>
                <span>30 Tage</span>
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
                    <span>{t('nexus.offeringAnalysis.btnAnalyzing', 'NeXus analysiert deinen Suchauftrag …')}</span>
                  </>
                ) : (
                  <>
                    <Zap size={16} />
                    <span>{t('nexus.offeringAnalysis.btnAnalyze', 'Suchauftrag analysieren')}</span>
                  </>
                )}
              </button>

              {selectedCategoryId && (
                <button
                  type="button"
                  className="btn-quick-activate"
                  onClick={() => handleDirectActivatePreset()}
                  disabled={isSaving}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '13.5px',
                    fontWeight: 700,
                    padding: '10px 18px',
                    cursor: 'pointer'
                  }}
                >
                  {isSaving ? <RefreshCw size={15} className="spin" /> : <Save size={15} />}
                  <span>⚡ 1-Klick Profil anlegen & aktivieren</span>
                </button>
              )}

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
                <CheckCircle2 size={18} className="text-[#38bdf8]" color="#38bdf8" />
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

                    <div className="review-field">
                      <label htmlFor="formMaxAgeDays">
                        Maximales Alter des Triggers (in Tagen): <strong>{maxAgeDays} {maxAgeDays === 1 ? 'Tag' : 'Tage'}</strong>
                      </label>
                      <input 
                        id="formMaxAgeDays"
                        type="range"
                        min="1"
                        max="30"
                        value={maxAgeDays} 
                        onChange={(e) => setMaxAgeDays(parseInt(e.target.value, 10))}
                        className="max-age-slider-input"
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
          <div className="profile-top-bar" style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '14px',
            background: 'rgba(17, 20, 26, 0.75)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            padding: '16px 20px',
            borderRadius: '12px',
            marginBottom: '18px'
          }}>
            <div className="profile-top-controls" style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
              <div className="profile-badge-row" style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                <span className="badge-active-indicator">{t('nexus.offeringAnalysis.activeTitle', 'Aktives Angebot')}</span>
                <div className="profile-select-wrap" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <label htmlFor="profile-select" className="profile-select-label" style={{ fontSize: '13px', fontWeight: 600, color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Layers size={14} className="text-[#38bdf8]" />
                    <span>Vorlage (Preset):</span>
                  </label>
                  <select
                    id="profile-select"
                    value={selectedPresetId || (activeOffering ? `custom_${activeOffering.id}` : '')}
                    onChange={(e) => {
                      const val = e.target.value
                      if (val.startsWith('custom_')) {
                        const id = val.replace('custom_', '')
                        setActiveOfferingId(id)
                        setSelectedPresetId('')
                      } else {
                        handleSelectPreset(val)
                      }
                    }}
                    className="profile-select"
                    style={{
                      padding: '8px 12px',
                      borderRadius: '8px',
                      border: '1px solid #334155',
                      background: '#090d16',
                      color: '#f8fafc',
                      fontSize: '13px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      maxWidth: '460px',
                      outline: 'none'
                    }}
                  >
                    <option value="">-- Feste B2B Trigger-Vorlage wählen --</option>
                    {B2B_TRIGGER_PRESETS.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.label}
                      </option>
                    ))}
                    {offerings.filter(o => !isTestOffering(o) && !B2B_TRIGGER_PRESETS.some(p => o.ai_understanding?.category_id === p.id)).length > 0 && (
                      <optgroup label="Individuell gespeicherte Profile">
                        {offerings.filter(o => !isTestOffering(o) && !B2B_TRIGGER_PRESETS.some(p => o.ai_understanding?.category_id === p.id)).map(o => (
                          <option key={o.id} value={`custom_${o.id}`}>
                            {o.offering_name || o.product_name || 'B2B Angebot'}
                          </option>
                        ))}
                      </optgroup>
                    )}
                  </select>
                </div>
              </div>

              {/* Button: Alte Test-Einträge aus Datenbank löschen */}
              <div className="cleanup-btn-wrapper">
                <button
                  type="button"
                  className="btn-cleanup-tests"
                  onClick={handleCleanupTestEntries}
                  disabled={isCleaning}
                  title="Löscht Test-Einträge wie 'bitte um infö' und 'software käufer' dauerhaft aus der Datenbank"
                >
                  {isCleaning ? <RefreshCw size={13} className="spin" /> : <Trash2 size={13} />}
                  <span>🗑️ Alte Test-Einträge aus Datenbank löschen</span>
                </button>
              </div>
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

            <div className="profile-meta-row" style={{ marginTop: '14px', paddingTop: '12px', borderTop: '1px solid var(--border-subtle, #1e232d)', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--text-secondary, #94a3b8)' }}>
              <Clock size={14} className="text-[#38bdf8]" />
              <span>Maximales Alter des Triggers (in Tagen): <strong style={{ color: 'var(--text-primary, #f8fafc)' }}>{activeOffering?.ai_understanding?.max_age_days || activeOffering?.max_age_days || 14} Tage</strong></span>
            </div>
          </div>

          {/* Signal Strategies Engine for the active offering */}
          <SignalStrategiesManager offering={activeOffering} />

          {/* Next Steps CTA to Lead Radar */}
          <div className="pipeline-next-step-card">
            <div className="next-step-info">
              <h4>{t('nexus.offeringAnalysis.readyRadar', 'Bereit für den Lead Radar?')}</h4>
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
