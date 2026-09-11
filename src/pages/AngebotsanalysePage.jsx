import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Target, Save, ArrowRight, CheckCircle, AlertCircle, Radar, Edit3 } from 'lucide-react'
import { createOffering } from '../lib/nexus-db'
import SignalStrategiesManager from '../components/nexus/SignalStrategiesManager'
import { useLead } from '../context/LeadContext'
import { useAuth } from '../context/AuthContext'
import { useLanguage } from '../i18n/translations.jsx'
import { ContextHelpButton } from '../context/GuideContext'
import './AngebotsanalysePage.css'

export default function AngebotsanalysePage() {
  const { t } = useLanguage();
  const navigate = useNavigate()
  const { user } = useAuth()
  const { refreshData, offerings, activeOffering, activeOfferingId, setActiveOfferingId } = useLead()
  
  const [isEditing, setIsEditing] = useState(false)
  const [productName, setProductName] = useState('')
  const [targetAudience, setTargetAudience] = useState('')
  const [valueProposition, setValueProposition] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (activeOffering && !isEditing) {
      setProductName(activeOffering.offering_name || '')
      setTargetAudience(activeOffering.target_audience || '')
      setValueProposition(activeOffering.positioning || '')
    }
  }, [activeOffering, isEditing])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!productName.trim() || !targetAudience.trim() || !valueProposition.trim()) {
      setError(t('nexus.errRequired') || 'Bitte f�lle alle Pflichtfelder aus.')
      return
    }
    
    setLoading(true)
    setError(null)
    
    try {
      if (user) {
        const result = await createOffering(user.id, {
          offering_name: productName,
          target_audience: targetAudience,
          positioning: valueProposition
        })
        if (!result) {
          setError(t('nexus.errDbSave') || 'Datenbank-Fehler.')
          setLoading(false)
          return
        }
        if (refreshData) await refreshData()
        setIsEditing(false)
      }
    } catch (err) {
      console.error('Fehler beim Speichern:', err)
      setError(`Fehler beim Speichern: ${err?.message || 'Unbekannt'}`)
    } finally {
      setLoading(false)
    }
  }

  const handleReset = () => {
    setProductName('')
    setTargetAudience('')
    setValueProposition('')
    setIsEditing(true)
    setError(null)
  }

  return (
    <div className="angebotsanalyse-page">
      <header className="page-header" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
        <button 
          className="btn-secondary" 
          onClick={() => navigate('/nexus/dashboard')}
          style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 12px', fontSize: '0.9rem' }}
        >
          <ArrowRight size={14} style={{ transform: 'rotate(180deg)' }} /> {t('nexus.backToDashboard') || 'Zur�ck zum Dashboard'}
        </button>
        <div className="header-title">
          <Target className="header-icon" size={28} />
          <h1 style={{ display: 'flex', alignItems: 'center' }}>
            {t('nexus.myOfferingProfile') || 'Mein Angebotsprofil'} <ContextHelpButton helpKey="offering.definition" />
          </h1>
          <p>{t('nexus.offeringDesc') || 'Definiere dein zentrales Fallobjekt. Diese Daten sind das Fundament f�r die gesamte NeXus Intelligence.'}</p>
        </div>
      </header>

      {(!activeOffering || isEditing) ? (
        <form onSubmit={handleSubmit} className="angebotsanalyse-form">
          <div className="form-group">
            <label htmlFor="productName">{t('nexus.yourProduct') || 'Dein Produkt / Deine Dienstleistung'}</label>
            <input 
              type="text"
              id="productName"
              value={productName}
              onChange={(e) => setProductName(e.target.value)}
              placeholder="z.B. SaaS Vertriebssoftware"
              required
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="targetAudience">{t('nexus.whoIsTarget') || 'Wer ist dein idealer Kunde? (Zielgruppe)'}</label>
            <textarea 
              id="targetAudience"
              value={targetAudience}
              onChange={(e) => setTargetAudience(e.target.value)}
              placeholder="z.B. Marketingagenturen mit 10-50 Mitarbeitern im D-A-CH Raum"
              rows={3}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="valueProposition">Was ist dein größtes Verkaufsargument (Value Proposition)?</label>
            <textarea 
              id="valueProposition"
              value={valueProposition}
              onChange={(e) => setValueProposition(e.target.value)}
              placeholder="z.B. Wir automatisieren die Lead-Recherche komplett, sodass Vertriebler 30% mehr Zeit für Gespräche haben."
              rows={3}
              required
            />
          </div>
          
          {error && (
            <div className="form-error">
              <AlertCircle size={16} />
              {error}
            </div>
          )}
          
          <div style={{ display: 'flex', gap: '12px' }}>
            <button type="submit" className="submit-btn" disabled={loading} style={{ flex: 1 }}>
              {loading ? (
                <>
                  <div className="btn-spinner"></div>
                  {t('nexus.savingProfile') || 'Speichere Profil...'}
                </>
              ) : (
                <>
                  <Save size={18} />
                  {t('nexus.saveProfile') || 'Angebotsprofil speichern'}
                </>
              )}
            </button>
            {activeOffering && isEditing && (
              <button type="button" className="btn-secondary" onClick={() => setIsEditing(false)}>
                Abbrechen
              </button>
            )}
          </div>
        </form>
      ) : (
        <div className="angebotsanalyse-result">
          <div className="result-header">
            <CheckCircle size={24} color="#10B981" />
            <h2>{t('nexus.activeProfile') || 'Aktives Angebotsprofil'}</h2>
          </div>
          
          {offerings && offerings.length > 1 && (
            <div style={{ marginBottom: '20px', background: 'var(--bg-elevated)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border-light)' }}>
              <label style={{ display: 'block', fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '8px' }}>{t('nexus.switchProfile') || 'Profil wechseln:'}</label>
              <select 
                value={activeOfferingId || ''} 
                onChange={(e) => setActiveOfferingId(e.target.value)}
                style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid var(--border-light)', background: 'var(--bg-card)', color: 'var(--text-primary)' }}
              >
                {offerings.map(o => (
                  <option key={o.id} value={o.id}>{o.product_name}</option>
                ))}
              </select>
            </div>
          )}
          
          <div style={{ background: 'var(--bg-elevated)', padding: '24px', borderRadius: '12px', border: '1px solid var(--border-light)', marginBottom: '24px' }}>
            <div style={{ marginBottom: '16px' }}>
              <strong style={{ color: 'var(--text-secondary)', display: 'block', fontSize: '0.85rem', marginBottom: '4px' }}>{t('nexus.productService') || 'Produkt / Dienstleistung'}</strong>
              <div style={{ fontSize: '1.1rem', fontWeight: 600 }}>{activeOffering.offering_name}</div>
            </div>
            <div style={{ marginBottom: '16px' }}>
              <strong style={{ color: 'var(--text-secondary)', display: 'block', fontSize: '0.85rem', marginBottom: '4px' }}>{t('nexus.targetGroupHeader') || 'Zielgruppe'}</strong>
              <div>{activeOffering.target_audience}</div>
            </div>
            <div>
              <strong style={{ color: 'var(--text-secondary)', display: 'block', fontSize: '0.85rem', marginBottom: '4px' }}>{t('nexus.valuePropHeader') || 'Value Proposition'}</strong>
              <div>{activeOffering.value_proposition}</div>
            </div>
          </div>
          
          <SignalStrategiesManager offering={activeOffering} />
          
          <div className="nexus-action-pipeline">
            <h3>{t('nexus.nextSteps') || 'N�chste Schritte'}</h3>
            <div className="pipeline-actions">
              <button className="pipeline-btn" onClick={() => navigate('/nexus/lead-radar')}>
                <Radar size={18} />
                <div>
                  <span className="pipeline-btn-title">{t('nexus.toLeadRadar') || 'Zum Lead Radar'}</span>
                  <span className="pipeline-btn-desc">{t('nexus.findCompaniesDesc') || 'Finde passende Unternehmen'}</span>
                </div>
                <ArrowRight size={16} />
              </button>
            </div>
          </div>
          
          <div className="result-actions">
            <button className="btn-secondary" onClick={handleReset} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Edit3 size={16} />
              {t('nexus.createNewProfile') || 'Neues Profil erstellen'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
