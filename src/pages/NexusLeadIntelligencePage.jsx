import React, { useState, useEffect, useRef } from 'react'
import { Users, Building2, Search, ArrowRight, AlertCircle, CheckCircle } from 'lucide-react'
import { callNexusAI } from '../lib/nexus-ai'
import NexusAnalysisResult from '../components/NexusAnalysisResult'
import { useLead } from '../context/LeadContext'
import './NexusLeadIntelligencePage.css'

export default function NexusLeadIntelligencePage() {
  const { currentLead } = useLead()
  const [companyName, setCompanyName] = useState(() => currentLead?.companyName || '')
  const [angebot, setAngebot] = useState(() => currentLead?.angebot || '')
  const [analyse, setAnalyse] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const autoAnalyzedRef = useRef(false)

  const handleAnalyze = async (e) => {
    if (e) e.preventDefault()
    if (!companyName.trim()) {
      setError('Bitte gib einen Firmennamen ein.')
      return
    }

    setLoading(true)
    setError(null)
    setAnalyse(null)

    try {
      const result = await callNexusAI({
        mode: 'lead_intelligence',
        company: companyName,
        angebot: angebot
      })

      setAnalyse(result)
    } catch (err) {
      console.error('Lead Intelligence Fehler:', err)
      setError('Fehler bei der Analyse. Bitte versuche es erneut.')
    } finally {
      setLoading(false)
    }
  }

  // Auto-analyze if we have a real company name from lead context
  useEffect(() => {
    if (currentLead?.companyName && 
        currentLead.companyName !== 'Unbekanntes Unternehmen' &&
        currentLead.companyName !== 'Nicht spezifiziert' &&
        !autoAnalyzedRef.current) {
      autoAnalyzedRef.current = true
      setTimeout(() => handleAnalyze(null), 100)
    }
  }, [currentLead])

  return (
    <div className="lead-intelligence-page">
      <header className="page-header" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', paddingBottom: '20px', borderBottom: '1px solid var(--border-light)', marginBottom: '24px' }}>
        <button 
          className="btn-secondary" 
          onClick={() => window.history.back()}
          style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 12px', fontSize: '0.9rem' }}
        >
          <ArrowRight size={14} style={{ transform: 'rotate(180deg)' }} /> Zurück
        </button>
        <div className="header-title" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <Users size={28} color="var(--color-koralle)" />
          <div>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 700, margin: '0 0 4px 0' }}>Lead Intelligence</h1>
            <p style={{ margin: 0, color: 'var(--text-secondary)' }}>Detaillierte Analyse des Zielunternehmens</p>
          </div>
        </div>
      </header>

      <form onSubmit={handleAnalyze} className="lead-intelligence-form">
        <div className="form-row">
          <div className="form-group">
            <label htmlFor="company">Firmenname</label>
            <div className="input-with-icon">
              <Building2 size={18} />
              <input
                id="company"
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="z.B. Mustermann GmbH"
              />
            </div>
          </div>
          
          <div className="form-group">
            <label htmlFor="angebot">Dein Angebot (optional)</label>
            <input
              id="angebot"
              type="text"
              value={angebot}
              onChange={(e) => setAngebot(e.target.value)}
              placeholder="Was bietest du an?"
            />
          </div>
        </div>
        
        {error && (
          <div className="error-message">
            <AlertCircle size={16} />
            {error}
          </div>
        )}
        
        <button type="submit" className="analyze-btn" disabled={loading}>
          {loading ? (
            <>
              <div className="btn-spinner"></div>
              Analyse läuft...
            </>
          ) : (
            <>
              <Search size={18} />
              Firma analysieren
            </>
          )}
        </button>
      </form>

      {analyse && (
        <div className="lead-intelligence-result">
          <div className="result-header">
            <CheckCircle size={24} color="#10B981" />
            <h2>Intelligence-Bericht: {companyName}</h2>
          </div>
          
          <NexusAnalysisResult data={analyse} mode="lead_intelligence" />
          
          <div className="result-actions">
            <button className="btn-primary" onClick={() => { setAnalyse(null); autoAnalyzedRef.current = false }}>
              Neue Analyse
            </button>
          </div>
        </div>
      )}

      {!loading && !analyse && !error && (
        <div className="lead-intelligence-empty">
          <Users size={48} color="var(--text-secondary)" />
          <h3>Unternehmen analysieren</h3>
          <p>Gib einen Firmennamen ein, um eine detaillierte Intelligence-Analyse zu erhalten.</p>
        </div>
      )}
    </div>
  )
}
