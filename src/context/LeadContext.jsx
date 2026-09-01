import React, { createContext, useContext, useState, useCallback, useEffect } from 'react'
import { useAuth } from './AuthContext'
import * as db from '../lib/nexus-db'

/**
 * NeXus LeadContext (Sales Operating System)
 * 
 * Verwaltet den State der Pipeline (Triggers -> Opportunities)
 * und bietet die Core-Methoden für den Intelligence-Workflow.
 */

const LeadContext = createContext(null)

export function LeadProvider({ children }) {
  const { user } = useAuth()
  const [opportunities, setOpportunities] = useState([])
  const [triggers, setTriggers] = useState([])
  const [radarHits, setRadarHits] = useState([])
  const [offerings, setOfferings] = useState([])
  const [activeOfferingId, setActiveOfferingId] = useState(null)
  const [loading, setLoading] = useState(false)

  // 1. Lade Dashboard-relevante Daten (Triggers & Pipeline)
  const loadPipelineData = useCallback(async () => {
    if (!user) return
    setLoading(true)
    try {
      const [opps, trigs, offs, hits] = await Promise.all([
        db.getOpportunities(user.id),
        db.getTriggerEvents(user.id),
        db.getOfferings(user.id),
        db.getRadarHits(user.id)
      ])
      setOpportunities(opps || [])
      setTriggers(trigs || [])
      setOfferings(offs || [])
      setRadarHits(hits || [])
      
      if (offs && offs.length > 0 && !activeOfferingId) {
        setActiveOfferingId(offs[0].id)
      }
    } catch (err) {
      console.error('[LeadContext] Error loading data:', err)
    } finally {
      setLoading(false)
    }
  }, [user, activeOfferingId])

  useEffect(() => {
    loadPipelineData()
  }, [loadPipelineData])

  // 2. Die Kern-Pipeline: Mache aus einem rohen Signal eine Opportunity
  const processSignalToOpportunity = useCallback(async (offeringId, companyData, signalData) => {
    if (!user) return null
    setLoading(true)
    try {
      // 1. Company identifizieren oder anlegen
      let company = await db.getCompanyByDomain(user.id, companyData.domain || '')
      if (!company) {
        company = await db.createCompany(user.id, { 
          name: companyData.name, 
          domain: companyData.domain || null, 
          ai_confidence: 85 // Beispiel-Wert der KI
        })
      }
      
      if (!company || !company.id) {
        alert("Pipeline-Fehler: Firma konnte in der Datenbank nicht angelegt werden. Fehlt der Firmenname?");
        return null;
      }
      
      // 2. M:N Verknüpfung Company <-> Offering
      if (offeringId) {
        await db.linkCompanyOffering(company.id, offeringId)
      }

      // 3. Trigger Event in der DB anlegen
      const triggerEvent = await db.createTriggerEvent(user.id, {
        company_id: company.id,
        signal_type: signalData.signal_type || 'KI_DETECTED',
        content: signalData.content,
        source: signalData.source || 'NeXus Radar Scan',
        confidence_score: signalData.confidence_score || 0.8
      })

      if (!triggerEvent || !triggerEvent.id) {
        alert("Pipeline-Fehler: Kaufsignal (Trigger) konnte nicht gespeichert werden.");
        return null;
      }

      // 4. Opportunity erzeugen
      const opp = await db.createOpportunity(user.id, company.id, {
        offering_id: offeringId,
        pipeline_stage: 'opportunity',
        source: 'Trigger Radar',
        created_from: 'AI'
      })

      if (opp && triggerEvent) {
        // 5. M:N Opportunity <-> Trigger verknüpfen
        await db.linkTriggerToOpportunity(opp.id, triggerEvent.id)
        
        // 6. Activity loggen
        await db.logActivity(
          user.id, 
          'opportunity', 
          opp.id, 
          'SYSTEM', 
          'NeXus Engine', 
          'status_changed', 
          'Opportunity aus Trigger generiert'
        )

        // State aktualisieren
        await loadPipelineData()
        return opp
      }
      
      alert("Pipeline-Fehler: Opportunity konnte nicht angelegt werden.");
      return null
    } catch (err) {
      console.error('[LeadContext] Pipeline error:', err)
      alert(`Pipeline-Fehler (Crash): ${err.message}`);
      return null
    } finally {
      setLoading(false)
    }
  }, [user, loadPipelineData])

  // 3. Platzhalter: Company Enrichment (Option 1/2)
  const enrichCompany = useCallback(async (opportunityId, companyId) => {
    if (!user) return
    setLoading(true)
    try {
      // Hier wird später der KI-Scraper oder Apollo/Hunter angebunden
      // Mock-Delay
      await new Promise(r => setTimeout(r, 1500))
      
      await db.updateCompany(companyId, {
        industry: 'Software',
        size: '50-200 Mitarbeiter',
        description: 'B2B SaaS Anbieter (Enriched by KI)'
      })

      await db.logActivity(user.id, 'opportunity', opportunityId, 'AI', 'Enrichment Bot', 'company_enriched', 'Firmendaten automatisch ergänzt')
      
      await loadPipelineData()
    } finally {
      setLoading(false)
    }
  }, [user, loadPipelineData])

  // 4. Update Pipeline Stage (z.B. Drag & Drop im Kanban)
  const updatePipelineStage = useCallback(async (opportunityId, newStage) => {
    if (!user) return
    try {
      await db.updateOpportunity(opportunityId, { pipeline_stage: newStage })
      await db.logActivity(user.id, 'opportunity', opportunityId, 'USER', 'Sales Rep', 'status_changed', `Verschoben zu: ${newStage}`)
      await loadPipelineData()
    } catch (err) {
      console.error(err)
    }
  }, [user, loadPipelineData])

  const deleteOpportunity = useCallback(async (oppId) => {
    try {
      const success = await db.deleteOpportunity(oppId)
      if (success) {
        setOpportunities(prev => prev.filter(opp => opp.id !== oppId))
      }
      return success
    } catch (err) {
      console.error(err)
      return false
    }
  }, [])

  const value = {
    opportunities,
    triggers,
    radarHits,
    offerings,
    activeOfferingId,
    setActiveOfferingId,
    activeOffering: offerings.find(o => o.id === activeOfferingId) || (offerings.length > 0 ? offerings[0] : null),
    loading,
    refreshData: loadPipelineData,
    processSignalToOpportunity,
    enrichCompany,
    updatePipelineStage,
    deleteOpportunity
  }

  return (
    <LeadContext.Provider value={value}>
      {children}
    </LeadContext.Provider>
  )
}

export function useLead() {
  const context = useContext(LeadContext)
  if (!context) {
    throw new Error('useLead must be used within a LeadProvider')
  }
  return context
}

// --- LEGACY SHIMS (To be removed when Phase 3 is fully done) ---
export function createLeadFromAnalysis(analysis, source = 'angebotsanalyse') {
  console.warn('[NeXus] createLeadFromAnalysis is deprecated and will be removed.')
  return {}
}
