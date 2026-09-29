import React, { useState, useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Users, Building2, Search, ArrowRight, AlertCircle, CheckCircle, Globe } from 'lucide-react'
import { callNexusAI } from '../lib/nexus-ai'
import NexusAnalysisResult from '../components/NexusAnalysisResult'
import { useLead } from '../context/LeadContext'
import { supabase } from '../lib/supabase'
import './NexusLeadIntelligencePage.css'

async function fetchWithAuth(url, options = {}) {
  const { data: { session } } = await supabase.auth.getSession()
  const token = session?.access_token
  const headers = { 'Content-Type': 'application/json', ...options.headers }
  if (token) headers['Authorization'] = `Bearer ${token}`
  return fetch(url, { ...options, headers })
}

export default function NexusLeadIntelligencePage() {
  const [searchParams] = useSearchParams()
  const { activeOffering } = useLead()
  const [companyName, setCompanyName] = useState(() => searchParams.get('company') || '')
  const [angebot, setAngebot] = useState(() => {
    const fromUrl = searchParams.get('angebot')
    if (fromUrl) return fromUrl
    return activeOffering ? [activeOffering.offering_name, activeOffering.positioning].filter(Boolean).join(' — ') : ''
  })
  const [analyse, setAnalyse] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [firmenprofil, setFirmenprofil] = useState(null)
  const [profilLoading, setProfilLoading] = useState(false)
  const autoAnalyzedRef = useRef(false)

  // Trigger-Kontext aus URL-Param (z.B. von Lead Radar weitergeleitet)
  const triggerContext = searchParams.get('trigger') || null

  // Firmenprofil zuerst: Company+Domain auflösen, Website crawlen, fertiges Profil zurückgeben
  const runProfileScan = async (name) => {
    setProfilLoading(true)
    setFirmenprofil(null)
    try {
      const startRes = await fetchWithAuth('/.netlify/functions/nexus-company-profile-start', {
        method: 'POST',
        body: JSON.stringify({
          company_name: name,
          trigger_context: triggerContext || undefined
        })
      })
      if (!startRes.ok) return null
      const startData = await startRes.json()
      console.log('[Intelligence] Profile start:', startData)
      if (startData.status === 'no_domain' || !startData.profile_id) return null

      // Bis status done/error pollen (auch already_done: erste Abfrage liefert den fertigen Stand)
      let profile = null
      let guard = 0
      while (guard++ < 60) {
        const stepRes = await fetchWithAuth('/.netlify/functions/nexus-company-profile-step', {
          method: 'POST',
          body: JSON.stringify({ profile_id: startData.profile_id })
        })
        if (!stepRes.ok) break
        const stepData = await stepRes.json()
        profile = stepData
        setFirmenprofil(stepData)
        if (stepData.status === 'done' || stepData.status === 'error') break
        await new Promise(r => setTimeout(r, 400))
      }
      return profile && profile.status === 'done' ? profile : null
    } catch (err) {
      console.error('Firmenprofil-Scan Fehler:', err)
      return null
    } finally {
      setProfilLoading(false)
    }
  }

  const handleAnalyze = async (e) => {
    if (e) e.preventDefault()
    if (!companyName.trim()) {
      setError('Bitte gib einen Firmennamen ein.')
      return
    }

    setLoading(true)
    setError(null)
    setAnalyse(null)
    setFirmenprofil(null)

    try {
      // 1. Firmenprofil zuerst (Domain-Auflösung + Web-Crawl) — liefert verifizierte Fakten
      const profile = await runProfileScan(companyName.trim())

      // 2. Intelligence-Analyse mit eingespeistem Profil
      const angebotText = angebot || (activeOffering ? [activeOffering.offering_name, activeOffering.positioning].filter(Boolean).join(' — ') : '')
      const result = await callNexusAI({
        mode: 'lead_intelligence',
        company: companyName,
        angebot: angebotText,
        companyProfile: profile || null
      })
      setAnalyse(result)
    } catch (err) {
      console.error('Lead Intelligence Fehler:', err)
      setError(err?.message || 'Fehler bei der Analyse. Bitte versuche es erneut.')
    } finally {
      setLoading(false)
    }
  }

  // Auto-analyze, wenn der Firmenname aus der URL kommt (z.B. Lead-Radar-Weiterleitung)
  useEffect(() => {
    const urlCompany = searchParams.get('company')
    if (urlCompany && !autoAnalyzedRef.current) {
      autoAnalyzedRef.current = true
      setTimeout(() => handleAnalyze(null), 100)
    }
  }, [searchParams])

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
              {profilLoading
                ? (firmenprofil && firmenprofil.current_step != null && firmenprofil.total_steps
                    ? `Firmenprofil: Schritt ${firmenprofil.current_step} von ${firmenprofil.total_steps}...`
                    : 'Firmenwebsite wird aufgelöst...')
                : 'Analyse läuft...'}
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
          
          <NexusAnalysisResult data={analyse} mode="lead_intelligence" firmenprofil={firmenprofil} profilLoading={profilLoading} />

          {(profilLoading || firmenprofil) && (
            <div className="firmenprofil-status" style={{ marginTop: '16px', padding: '12px 16px', background: 'var(--bg-secondary, #f8f9fa)', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Globe size={18} className={profilLoading ? 'spin' : ''} />
              <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                {profilLoading
                  ? (firmenprofil && firmenprofil.current_step != null && firmenprofil.total_steps
                      ? `Firmenprofil wird extrahiert... Schritt ${firmenprofil.current_step} von ${firmenprofil.total_steps}`
                      : 'Firmenwebsite wird aufgelöst...')
                  : `Firmenprofil: ${firmenprofil?.sources?.length || 0} Aussagen aus ${firmenprofil?.current_step || 0} Seiten`}
              </span>
            </div>
          )}
          
          <div className="result-actions">
            <button className="btn-primary" onClick={() => { setAnalyse(null); setFirmenprofil(null); autoAnalyzedRef.current = false }}>
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
