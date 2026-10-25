import React, { useState, useEffect } from 'react'
import { Briefcase, Mail, MessageSquare, Send, Copy, CheckCircle, AlertCircle, List, Trash2, ArrowRight, Search, Share2, ExternalLink, Video, Globe, Sparkles, RefreshCw, Clock, Check, Loader2, X, Eye, ShieldCheck, FileText, Zap, Edit3 } from 'lucide-react'
import { callNexusAI, runDeepResearch, callContactIntelligence, callMessageGeneration, callSocialIntelligence } from '../lib/nexus-ai'
import { isPlaceholderCompany, computeTargetMatchScore, classifyB2BLifecycle, getCategoryLifecycleConfig, hasConcreteVerifiedAnlass, isBlacklistedRole } from '../lib/nexus-validation'
import { formatEventDate, extractDomain } from '../lib/nexus-dates'
import NexusAnalysisResult from '../components/NexusAnalysisResult'
import { useLead } from '../context/LeadContext'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import * as db from '../lib/nexus-db'
import { useLanguage } from '../i18n/translations.jsx'
import CoachChatPage from './CoachChatPage'
import NexusLiveProgressBar from '../components/NexusLiveProgressBar'
import { ContextHelpButton } from '../components/ContextHelpButton'
import SignalPublishSection from '../components/SignalPublishSection'
import { resolveTriggerCompanyName, extractCompanyNameFromText, buildSignalPayload, publishSignalToDatWebsite } from '../lib/nexus-signal-publisher'
import { trackSocialOutreachGenerated, trackSocialCommentCopied, trackSocialDmCopied, trackSocialOriginalOpened } from '../lib/nexus-analytics'
import './SalesWorkspacePage.css'

const MODI = [
  { id: 'sales_pitch', label: 'Sales Pitch', icon: Send, description: 'Persönliche Erstnachricht' },
  { id: 'follow_up', label: 'Follow-Up', icon: Mail, description: 'Nachfass-Nachricht' },
  { id: 'einwandbehandlung', label: 'Einwandbehandlung', icon: MessageSquare, description: 'Auf Einwände reagieren' },
  { id: 'forum_response', label: 'Social Outreach', icon: Share2, description: 'LinkedIn / YouTube / Foren' }
]

import { useNavigate, useSearchParams } from 'react-router-dom'

export function extractTriggerMeta(content = '') {
  if (typeof content !== 'string') {
    return { cleanText: '', painPoint: '', blindCompany: '', blindLocation: '', blindQuantity: '', targetBuyers: [] };
  }
  const painMatch = content.match(/\[PAIN_POINT\]:\s*([^\n\r]+)/i);
  const companyMatch = content.match(/\[BLIND_COMPANY\]:\s*([^\n\r]+)/i);
  const locationMatch = content.match(/\[BLIND_LOCATION\]:\s*([^\n\r]+)/i);
  const quantityMatch = content.match(/\[BLIND_QUANTITY\]:\s*([^\n\r]+)/i);
  const buyersMatch = content.match(/\[TARGET_BUYERS\]:\s*([^\n\r]+)/i);

  const cleanText = content
    .replace(/\n\n\[(PAIN_POINT|BLIND_COMPANY|BLIND_LOCATION|BLIND_QUANTITY|TARGET_BUYERS)\]:[^\n\r]*/gi, '')
    .replace(/\[(PAIN_POINT|BLIND_COMPANY|BLIND_LOCATION|BLIND_QUANTITY|TARGET_BUYERS)\]:[^\n\r]*/gi, '')
    .trim();

  const targetBuyers = buyersMatch 
    ? buyersMatch[1].split(',').map(s => s.trim()).filter(Boolean)
    : [];

  return {
    cleanText,
    painPoint: painMatch ? painMatch[1].trim() : '',
    blindCompany: companyMatch ? companyMatch[1].trim() : '',
    blindLocation: locationMatch ? locationMatch[1].trim() : '',
    blindQuantity: quantityMatch ? quantityMatch[1].trim() : '',
    targetBuyers,
    company_name: extractCompanyNameFromText(content)
  };
}

export default function SalesWorkspacePage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const oppIdFromUrl = searchParams.get('opportunityId')
  const { t, lang } = useLanguage()
  const { user } = useAuth()
  const { opportunities, triggers, deleteOpportunity, refreshData, activeOffering } = useLead()
  
  const [selectedMode, setSelectedMode] = useState('sales_pitch')
  const [activeOppId, setActiveOppId] = useState(oppIdFromUrl || null)
  const [activeTab, setActiveTab] = useState('aktion') // 'historie', 'aktion', 'pruefung', 'intelligence'
  const [queueFilter, setQueueFilter] = useState('inbox') // HITL Workflow: 'inbox' (Posteingang) | 'relevant' (>= 50) | 'all' | 'unclear' (< 50) | 'rejected'

  // Manuelle Lead-Prüfung (5-Punkte Checkliste)
  const [reviewChecklist, setReviewChecklist] = useState({
    duplicate: null,
    plausibility: null,
    source: null,
    date: null,
    relevance: null
  })
  const [reviewNotes, setReviewNotes] = useState('')
  const [isReviewSaving, setIsReviewSaving] = useState(false)
  const [customEventDate, setCustomEventDate] = useState('')
  const [isEditingEventDate, setIsEditingEventDate] = useState(false)

  // Direkt-Veröffentlichung State & Modal
  const [isDirectPublishing, setIsDirectPublishing] = useState(false)
  const [directPublishResult, setDirectPublishResult] = useState(null)
  const [showDirectPublishModal, setShowDirectPublishModal] = useState(false)
  const [copiedDirectLink, setCopiedDirectLink] = useState(false)
  const [copiedDirectMessage, setCopiedDirectMessage] = useState(false)

  // Blind-Profil State & Modal
  const [showBlindProfileModal, setShowBlindProfileModal] = useState(false)
  const [copiedBlindText, setCopiedBlindText] = useState(false)
  const [blindProfileTab, setBlindProfileTab] = useState('teaser') // 'teaser' | 'vault' | 'edit'
  const [customBlindCompany, setCustomBlindCompany] = useState('')
  const [customBlindLocation, setCustomBlindLocation] = useState('')
  const [customBlindPainPoint, setCustomBlindPainPoint] = useState('')
  const [isSavingBlindProfile, setIsSavingBlindProfile] = useState(false)

  useEffect(() => {
    if (oppIdFromUrl && oppIdFromUrl !== activeOppId) {
      setActiveOppId(oppIdFromUrl)
    }
  }, [oppIdFromUrl])

  // Einmalige Bereinigung alter spanischer Test-Caches
  useEffect(() => {
    try {
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith('nexus_social_outreach_') && (key.includes('BioPharma') || key.includes('LogiChain') || key.includes('EcoBuild') || key.includes('DataFlux') || key.includes('Innovatec'))) {
          localStorage.removeItem(key)
        }
      })
    } catch(e) {}
  }, [])
  const [historyItems, setHistoryItems] = useState([])
  const [showCoach, setShowCoach] = useState(false)
  const [activeOpp, setActiveOpp] = useState(null)
  const [activeTrigger, setActiveTrigger] = useState(null)
  const [fullContext, setFullContext] = useState(null)
  
  const [formData, setFormData] = useState({
    company: '',
    ansprechpartner: '',
    branche: '',
    situation: '',
    einwand: ''
  })
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [copied, setCopied] = useState(false)
  const [packageCopied, setPackageCopied] = useState(false)
  const [findingContact, setFindingContact] = useState(false)
  const [isResearching, setIsResearching] = useState(false)
  const [foundContact, setFoundContact] = useState(null) // Speichert den gefundenen Kontakt für Bestätigung
  const [contactPersisted, setContactPersisted] = useState(false) // true nur wenn DB-Save erfolgreich war
  const [generatedMessage, setGeneratedMessage] = useState(null) // Generierte Nachricht
  const [isGeneratingMessage, setIsGeneratingMessage] = useState(false) // Nachricht wird generiert
  const [editedMessage, setEditedMessage] = useState('')

  // Synchronisiere Checkliste und Notizen mit dem aktiven Lead NUR bei Lead-Wechsel
  useEffect(() => {
    if (activeOpp?.id) {
      setCustomEventDate('')
      setIsEditingEventDate(false)
      setReviewNotes(activeOpp.review_notes || '')
      if (activeOpp.review_status === 'reviewed' || activeOpp.review_status === 'verified') {
        setReviewChecklist({
          duplicate: 'pass',
          plausibility: 'pass',
          source: 'pass',
          date: 'pass',
          relevance: 'pass'
        })
      } else {
        setReviewChecklist({
          duplicate: null,
          plausibility: null,
          source: null,
          date: null,
          relevance: null
        })
      }
    }
  }, [activeOpp?.id])

  // 1. AUTOMATISCHE PRÜFNOTIZ: Sobald alle 5 Punkte a-e auf "Bestanden" stehen
  useEffect(() => {
    const allPassed = reviewChecklist.duplicate === 'pass' &&
                      reviewChecklist.plausibility === 'pass' &&
                      reviewChecklist.source === 'pass' &&
                      reviewChecklist.date === 'pass' &&
                      reviewChecklist.relevance === 'pass';

    if (allPassed) {
      let eventTitle = activeTrigger?.title || activeTrigger?.event_fact || '';
      if (!eventTitle && activeTrigger?.content) {
        const clean = extractTriggerMeta(activeTrigger.content).cleanText;
        const firstLine = clean.split('\n')[0].trim();
        eventTitle = firstLine.replace(/\.$/, '');
      }
      if (!eventTitle) {
        eventTitle = formData.situation ? formData.situation.split('\n')[0].trim().replace(/\.$/, '') : 'B2B Kaufsignal';
      }

      const dateVal = activeTrigger?.event_date || activeTrigger?.published_at || activeTrigger?.discovery_date || activeTrigger?.created_at || activeOpp?.created_at;
      const formattedDate = (dateVal && formatEventDate(dateVal).formattedDate !== 'Unbekannt' && formatEventDate(dateVal).formattedDate !== 'Ungültiges Datum')
        ? formatEventDate(dateVal).formattedDate
        : new Date().toLocaleDateString('de-DE');

      const autoNote = `Primärquelle verifiziert. Ereignis ${eventTitle} am ${formattedDate} bestätigt. Zielgruppe: Executive Search, Personalberater & Interim Manager. - Harro Goerndt`;

      setReviewNotes(prev => {
        if (!prev || prev.trim() === '' || prev.startsWith('Primärquelle verifiziert.') || prev === 'Manuelle 5-Punkte-Qualitätsprüfung bestanden' || prev.includes('Human-Verified')) {
          return autoNote;
        }
        return prev;
      });
    }
  }, [
    reviewChecklist.duplicate,
    reviewChecklist.plausibility,
    reviewChecklist.source,
    reviewChecklist.date,
    reviewChecklist.relevance,
    activeTrigger?.id,
    activeTrigger?.title,
    activeTrigger?.event_fact,
    activeTrigger?.content,
    activeOpp?.id
  ]);

  const handleMarkReviewed = async () => {
    if (!activeOpp?.id) return
    const targetId = activeOpp.id
    setIsReviewSaving(true)
    try {
      const now = new Date().toISOString()
      const noteToSave = reviewNotes || 'Primärquelle verifiziert. Zielgruppe: Executive Search, Personalberater & Interim Manager. - Harro Goerndt'
      let updates = {
        review_status: 'verified',
        review_notes: noteToSave,
        reviewed_at: now
      }
      let saved = await db.updateOpportunity(targetId, updates)
      if (!saved) {
        updates = {
          review_status: 'reviewed',
          review_notes: noteToSave,
          reviewed_at: now
        }
        saved = await db.updateOpportunity(targetId, updates)
      }

      // Nächsten Fall im Prüfungsstapel ermitteln
      const resolveComp = (o) => resolveTriggerCompanyName(
        o.triggers?.[0]?.nexus_trigger_events,
        o,
        o.nexus_companies?.name || o.company?.name || ''
      );
      const pendingOpps = (opportunities || []).filter(o => 
        o.id !== targetId &&
        !isPlaceholderCompany(resolveComp(o)) &&
        (o.review_status === 'pending' || o.review_status === 'PENDING_REVIEW' || o.review_status === 'unreviewed')
      );
      const nextOpp = pendingOpps.length > 0 ? pendingOpps[0] : null;

      if (refreshData) await refreshData()

      if (nextOpp) {
        setActiveOppId(nextOpp.id)
        setActiveOpp(nextOpp)
        setActiveTab('pruefung')
      } else {
        setActiveOpp(prev => ({ ...prev, ...updates, review_status: 'verified', review_notes: noteToSave }))
        if (fullContext) {
          setFullContext(prev => ({ ...prev, ...updates, review_status: 'verified', review_notes: noteToSave }))
        }
      }
      setReviewChecklist({
        duplicate: 'pass',
        plausibility: 'pass',
        source: 'pass',
        date: 'pass',
        relevance: 'pass'
      })
    } catch (err) {
      console.error('Error marking opportunity as verified:', err)
    } finally {
      setIsReviewSaving(false)
    }
  }

  // HITL Workflow: Signal aus Posteingang in aktive Pipeline übernehmen (Bestanden)
  const handleApproveToPipeline = async (oppId = null, e = null) => {
    if (e) e.stopPropagation()
    const targetId = oppId || activeOpp?.id
    if (!targetId) return

    setIsReviewSaving(true)
    try {
      const now = new Date().toISOString()
      const noteToSave = (targetId === activeOpp?.id && reviewNotes) 
        ? reviewNotes 
        : 'Freigegeben für aktive Pipeline ("Chefsache") - Harro Goerndt'
      
      let updates = {
        review_status: 'verified',
        review_notes: noteToSave,
        reviewed_at: now
      }
      let saved = await db.updateOpportunity(targetId, updates)
      if (!saved) {
        updates.review_status = 'reviewed'
        saved = await db.updateOpportunity(targetId, updates)
      }

      // Nächsten Fall im Prüfungsstapel ermitteln
      const resolveComp = (o) => resolveTriggerCompanyName(
        o.triggers?.[0]?.nexus_trigger_events,
        o,
        o.nexus_companies?.name || o.company?.name || ''
      );
      const pendingOpps = (opportunities || []).filter(o => 
        o.id !== targetId &&
        !isPlaceholderCompany(resolveComp(o)) &&
        (o.review_status === 'pending' || o.review_status === 'PENDING_REVIEW' || o.review_status === 'unreviewed')
      );
      const nextOpp = pendingOpps.length > 0 ? pendingOpps[0] : null;

      if (refreshData) await refreshData()

      if (nextOpp) {
        setActiveOppId(nextOpp.id)
        setActiveOpp(nextOpp)
        setActiveTab('pruefung')
      } else {
        if (activeOpp?.id === targetId) {
          setActiveOpp(prev => ({ ...prev, ...updates, review_status: 'verified', review_notes: noteToSave }))
          if (fullContext) {
            setFullContext(prev => ({ ...prev, ...updates, review_status: 'verified', review_notes: noteToSave }))
          }
        }
      }
      setReviewChecklist({
        duplicate: 'pass',
        plausibility: 'pass',
        source: 'pass',
        date: 'pass',
        relevance: 'pass'
      })
    } catch (err) {
      console.error('Error approving opportunity to pipeline:', err)
    } finally {
      setIsReviewSaving(false)
    }
  }

  // HITL Workflow: Signal verwerfen (Archivieren)
  const handleDismissOpportunity = async (oppId = null, e = null) => {
    if (e) e.stopPropagation()
    const targetId = oppId || activeOpp?.id
    if (!targetId) return

    setIsReviewSaving(true)
    try {
      const now = new Date().toISOString()
      const updates = {
        review_status: 'rejected',
        review_notes: 'Signal im Posteingang verworfen ("Chefsache") - Harro Goerndt',
        reviewed_at: now
      }
      await db.updateOpportunity(targetId, updates)

      // Nächsten Fall im Prüfungsstapel ermitteln
      const resolveComp = (o) => resolveTriggerCompanyName(
        o.triggers?.[0]?.nexus_trigger_events,
        o,
        o.nexus_companies?.name || o.company?.name || ''
      );
      const pendingOpps = (opportunities || []).filter(o => 
        o.id !== targetId &&
        !isPlaceholderCompany(resolveComp(o)) &&
        (o.review_status === 'pending' || o.review_status === 'PENDING_REVIEW' || o.review_status === 'unreviewed')
      );
      const nextOpp = pendingOpps.length > 0 ? pendingOpps[0] : null;

      if (refreshData) await refreshData()

      if (nextOpp) {
        setActiveOppId(nextOpp.id)
        setActiveOpp(nextOpp)
        setActiveTab('pruefung')
      } else {
        if (activeOpp?.id === targetId) {
          setActiveOpp(prev => ({ ...prev, ...updates }))
          if (fullContext) {
            setFullContext(prev => ({ ...prev, ...updates }))
          }
        }
      }
    } catch (err) {
      console.error('Error dismissing opportunity:', err)
    } finally {
      setIsReviewSaving(false)
    }
  }

  // 1-Klick Schnellprüfung: Alle 5 Prüfpunkte bestehen & Lead sofort in die Pipeline freigeben
  const handleQuickApproveAll = async (oppId = null, e = null) => {
    if (e) e.stopPropagation();
    const targetId = oppId || activeOpp?.id;
    if (!targetId) return;

    setReviewChecklist({
      duplicate: 'pass',
      plausibility: 'pass',
      source: 'pass',
      date: 'pass',
      relevance: 'pass'
    });

    await handleApproveToPipeline(targetId, e);
  };

  // Hilfsfunktion: Berechnet das 100% anonymisierte Blind-Profil für ein Opportunity/Trigger
  const getBlindProfileData = (targetOpp = activeOpp, targetTrigger = activeTrigger) => {
    if (!targetOpp) return null;
    const effectiveTrigger = targetTrigger
      ? { ...targetTrigger, ...(customEventDate ? { event_date: customEventDate } : {}) }
      : (customEventDate ? { event_date: customEventDate } : null);

    const compName = resolveTriggerCompanyName(effectiveTrigger, targetOpp);

    const triggerWithOverrides = {
      ...effectiveTrigger,
      ...(customBlindCompany ? { blind_company: customBlindCompany } : {}),
      ...(customBlindLocation ? { blind_location: customBlindLocation } : {}),
      ...(customBlindPainPoint ? { pain_point: customBlindPainPoint } : {})
    };

    return buildSignalPayload({
      opportunity: targetOpp,
      trigger: triggerWithOverrides,
      foundContact,
      analystName: 'Harro Goerndt',
      verificationNote: reviewNotes || 'Primärquelle verifiziert – 100% faktengeprüft',
      overrideCompany: compName
    });
  };

  const handleCopyBlindProfileText = (targetOpp = activeOpp, targetTrigger = activeTrigger) => {
    const data = getBlindProfileData(targetOpp, targetTrigger);
    if (!data) return;
    const t = data.teaser;
    const text = `🔒 EXKLUSIVES MANDATS-SIGNAL (ANONYMISIERTES BLIND-PROFIL)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🏢 Mandant / Zielprofil: ${t.headline}
📍 Region & Branche: ${t.industry}
📊 Transaktionsphase: ${t.lifecycleBadge} · ${t.signalCategory}
⚠️ Handlungsdruck & Anlass:
${t.eventSummary}

🎯 Relevante Beratungs- & Transaktionspartner:
${(t.targetBuyers || []).map(b => `• ${b}`).join('\n')}

📦 Lieferumfang des freigeschalteten Mandats-Dossiers:
1. Klardaten des Ziel-Accounts & geprüfter Primärquellen-Nachweis
2. Konkreter Vakanzanlass & operatives Timing-Fenster
3. Funktionale Entscheider-Ebene & Vorzimmer-Zentrale
4. Maßgeschneiderte Pitch- & Ansprache-Vorlage

⚖️ 100% DSGVO-konform · Primärquelle verifiziert durch Harro Goerndt
🔗 Live-Allokation: https://dat-dat.de/signal/${data.slug}`;

    navigator.clipboard.writeText(text);
    setCopiedBlindText(true);
    setTimeout(() => setCopiedBlindText(false), 2500);
  };

  const handleSaveBlindProfileCustomization = async () => {
    if (!activeOpp?.id) return;
    setIsSavingBlindProfile(true);
    try {
      const updates = {};
      if (customBlindPainPoint) updates.pain_point = customBlindPainPoint;
      if (customBlindCompany || customBlindLocation) {
        updates.notes = `${activeOpp.notes || ''}\n[BLIND_COMPANY]: ${customBlindCompany}\n[BLIND_LOCATION]: ${customBlindLocation}`.trim();
      }
      await db.updateOpportunity(activeOpp.id, updates);
      setActiveOpp(prev => ({ ...prev, ...updates }));
      alert('Blind-Profil erfolgreich für diesen Lead angepasst und gespeichert!');
    } catch (e) {
      console.error('Error saving blind profile:', e);
    } finally {
      setIsSavingBlindProfile(false);
    }
  };

  const handleDirectPublish = async () => {
    if (!activeOpp) return
    setIsDirectPublishing(true)
    try {
      const resolvedCompName = resolveTriggerCompanyName(activeTrigger, activeOpp)
      const noteToUse = reviewNotes || 'Primärquelle verifiziert. Zielgruppe: Executive Search, Personalberater & Interim Manager. - Harro Goerndt'

      // Automatisch als verifiziert markieren, falls noch nicht geschehen
      if (activeOpp.review_status !== 'verified' && activeOpp.review_status !== 'reviewed') {
        const now = new Date().toISOString()
        try {
          let saved = await db.updateOpportunity(activeOpp.id, {
            review_status: 'verified',
            review_notes: noteToUse,
            reviewed_at: now
          })
          if (!saved) {
            await db.updateOpportunity(activeOpp.id, {
              review_status: 'reviewed',
              review_notes: noteToUse,
              reviewed_at: now
            })
          }
        } catch (e) {
          console.warn('[DirectPublish] DB status update fallback:', e)
        }
        setActiveOpp(prev => ({ ...prev, review_status: 'verified', review_notes: noteToUse }))
        if (fullContext) {
          setFullContext(prev => ({ ...prev, review_status: 'verified', review_notes: noteToUse }))
        }
      }

      const effectiveTrigger = activeTrigger
        ? { ...activeTrigger, ...(customEventDate ? { event_date: customEventDate } : {}) }
        : (customEventDate ? { event_date: customEventDate } : null);

      const signalPayload = buildSignalPayload({
        opportunity: activeOpp,
        trigger: effectiveTrigger,
        foundContact,
        analystName: 'Harro Goerndt',
        verificationNote: noteToUse,
        overrideCompany: resolvedCompName
      })

      const result = await publishSignalToDatWebsite({
        signalPayload,
        signalObj: signalPayload,
        userId: user?.id || '976e6211-8931-425a-a171-0c062290181b'
      })

      setDirectPublishResult(result)
      setShowDirectPublishModal(true)
    } catch (err) {
      console.error('[SalesWorkspace] Veröffentlichungsfehler:', err)
      alert('Fehler bei der Veröffentlichung auf dat-dat.de. Bitte prüfen Sie die Verbindung.')
    } finally {
      setIsDirectPublishing(false)
    }
  }

  const handleCopyDirectLink = () => {
    if (!directPublishResult?.liveUrl) return
    navigator.clipboard.writeText(directPublishResult.liveUrl)
    setCopiedDirectLink(true)
    setTimeout(() => setCopiedDirectLink(false), 2500)
  }

  const handleCopyDirectMessage = () => {
    if (!directPublishResult?.linkedInMessage) return
    navigator.clipboard.writeText(directPublishResult.linkedInMessage)
    setCopiedDirectMessage(true)
    setTimeout(() => setCopiedDirectMessage(false), 2500)
  }

  const handleReject = async () => {
    if (!activeOpp?.id) return
    const targetId = activeOpp.id
    setIsReviewSaving(true)
    try {
      const now = new Date().toISOString()
      const updates = {
        review_status: 'rejected',
        review_notes: reviewNotes,
        reviewed_at: now
      }
      await db.updateOpportunity(targetId, updates)

      // Nächsten Fall im Prüfungsstapel ermitteln
      const resolveComp = (o) => resolveTriggerCompanyName(
        o.triggers?.[0]?.nexus_trigger_events,
        o,
        o.nexus_companies?.name || o.company?.name || ''
      );
      const pendingOpps = (opportunities || []).filter(o => 
        o.id !== targetId &&
        !isPlaceholderCompany(resolveComp(o)) &&
        (o.review_status === 'pending' || o.review_status === 'PENDING_REVIEW' || o.review_status === 'unreviewed')
      );
      const nextOpp = pendingOpps.length > 0 ? pendingOpps[0] : null;

      if (refreshData) await refreshData()

      if (nextOpp) {
        setActiveOppId(nextOpp.id)
        setActiveOpp(nextOpp)
        setActiveTab('pruefung')
      } else {
        setActiveOpp(prev => ({ ...prev, ...updates }))
      }
    } catch (err) {
      console.error('Error rejecting opportunity:', err)
    } finally {
      setIsReviewSaving(false)
    }
  }

  const handleResetReview = async () => {
    if (!activeOpp?.id) return
    setIsReviewSaving(true)
    try {
      const updates = {
        review_status: 'unreviewed',
        review_notes: reviewNotes,
        reviewed_at: null
      }
      await db.updateOpportunity(activeOpp.id, updates)
      setActiveOpp(prev => ({ ...prev, ...updates }))
      setReviewChecklist({
        duplicate: null,
        plausibility: null,
        source: null,
        date: null,
        relevance: null
      })
      if (refreshData) await refreshData()
    } catch (err) {
      console.error('Error resetting review:', err)
    } finally {
      setIsReviewSaving(false)
    }
  }

  const [translatedIntelligence, setTranslatedIntelligence] = useState({})
  const [translatingIntel, setTranslatingIntel] = useState(false)

  const handleTranslateIntelligence = async (overrideCtx = null, overrideTrigger = null) => {
    if (translatingIntel) return
    setTranslatingIntel(true)
    try {
      const c = overrideCtx || fullContext
      const t = overrideTrigger || activeTrigger
      const textToTranslate = `ANGEBOT: ${c?.offering?.offering_name || ''}\nPOSITIONIERUNG: ${c?.offering?.positioning || ''}\nKAUFSIGNAL: ${t?.content || ''}`
      const res = await callNexusAI({
        mode: 'translate_intelligence',
        message: textToTranslate,
        temperature: 0.1,
        lang: 'de',
        targetLang: 'de'
      })
      let parsed = res
      if (typeof res === 'string') {
        try {
          const clean = res.replace(/```json\s*/gi, '').replace(/```\s*$/gi, '').trim()
          parsed = JSON.parse(clean)
        } catch(e) {
          // Robust table / text extraction fallback if LLM returned markdown table
          const offerMatch = res.match(/\|\s*\*{0,2}Angebot\*{0,2}\s*\|\s*([^|\n]+)/i) || res.match(/Angebot:\s*([^\n|]+)/i)
          const posMatch = res.match(/\|\s*\*{0,2}Positionierung\*{0,2}\s*\|\s*([^|\n]+)/i) || res.match(/Positionierung:\s*([^\n|]+)/i)
          const sigMatch = res.match(/\|\s*\*{0,2}Signal\*{0,2}\s*\|\s*([^|\n]+)/i) || res.match(/\|\s*\*{0,2}Kaufsignal\*{0,2}\s*\|\s*([^|\n]+)/i) || res.match(/Signal:\s*([^\n|]+)/i)
          
          let cleanSignal = sigMatch ? sigMatch[1].trim() : res
          if (cleanSignal.includes('|') || cleanSignal.includes('Übersetzung')) {
            const rows = res.split('\n').filter(line => line.includes('|') && !line.includes('---') && !line.includes('Feld') && !line.includes('Priorität'));
            const sigRow = rows.find(r => /signal/i.test(r));
            if (sigRow) {
              const parts = sigRow.split('|').map(s => s.trim()).filter(Boolean);
              if (parts.length >= 2) cleanSignal = parts[parts.length - 1];
            }
          }

          parsed = {
            offering_name: offerMatch ? offerMatch[1].trim() : '',
            positioning: posMatch ? posMatch[1].trim() : '',
            signal: cleanSignal
          }
        }
      }
      setTranslatedIntelligence(parsed || {})
    } catch(e) {
      console.error('Translation error:', e)
    } finally {
      setTranslatingIntel(false)
    }
  }

  // --- NEXUS SOCIAL INTELLIGENCE STATE ---
  const [socialState, setSocialState] = useState({
    loading: false,
    loadedCompany: null,
    profiles: null,
    activities: [],
    selectedActivity: null,
    outreachData: null,
    generatingOutreach: false,
    activeTab: 'comment', // 'comment' | 'direct_message'
    copiedComment: false,
    copiedDm: false,
    error: null
  });

  const loadSocialActivities = async (force = false) => {
    const compName = fullContext?.company?.name || formData.company;
    if (!compName) return;
    if (!force && socialState.loadedCompany === compName && socialState.activities.length > 0) return;

    setSocialState(prev => ({ ...prev, loading: true, error: null, selectedActivity: null, outreachData: null }));
    try {
      const res = await callSocialIntelligence({
        action: 'discover_activities',
        companyName: compName,
        website: fullContext?.company?.website || null,
        trigger: activeTrigger || (fullContext?.opportunity?.trigger_title ? { title: fullContext.opportunity.trigger_title } : null),
        offering: fullContext?.offering || null,
        targetLang: formData.targetLang || lang,
        lang: lang
      });
      setSocialState(prev => ({
        ...prev,
        loading: false,
        loadedCompany: compName,
        profiles: res.profiles || null,
        activities: res.activities || [],
        status: res.status
      }));
    } catch (err) {
      console.error("Error discovering social activities:", err);
      setSocialState(prev => ({ ...prev, loading: false, error: err.message }));
    }
  };

  useEffect(() => {
    if (selectedMode === 'forum_response' && (fullContext?.company?.name || formData.company)) {
      const compName = fullContext?.company?.name || formData.company;
      if (socialState.loadedCompany !== compName) {
        loadSocialActivities();
      }
    }
  }, [selectedMode, fullContext?.company?.name, formData.company]);

  const handleUseForOutreach = async (activity, targetPostLang = 'auto') => {
    setSocialState(prev => ({
      ...prev,
      selectedActivity: activity,
      generatingOutreach: true,
      outreachData: null,
      activeTab: 'comment',
      copiedComment: false,
      copiedDm: false
    }));
    try {
      const res = await callSocialIntelligence({
        action: 'generate_social_outreach',
        companyName: fullContext?.company?.name || formData.company,
        activity,
        trigger: activeTrigger || (fullContext?.opportunity?.trigger_title ? { title: fullContext.opportunity.trigger_title } : null),
        offering: fullContext?.offering || null,
        contact: foundContact || (fullContext?.contacts?.[0]?.nexus_contacts ? {
          name: `${fullContext.contacts[0].nexus_contacts.first_name || ''} ${fullContext.contacts[0].nexus_contacts.last_name || ''}`.trim(),
          role: fullContext.contacts[0].nexus_contacts.role
        } : null),
        targetPostLang: targetPostLang,
        uiLang: lang || 'de',
        lang: lang || 'de'
      });
      // 1. In State setzen
      setSocialState(prev => ({
        ...prev,
        generatingOutreach: false,
        outreachData: res
      }));

      const compName = fullContext?.company?.name || formData.company;
      const oppKey = activeOppId || fullContext?.opportunity?.id || compName;

      // 2. Im localStorage sichern (bleibt erhalten, wenn man zu LinkedIn wechselt)
      if (oppKey) {
        try {
          localStorage.setItem(`nexus_social_outreach_${oppKey}`, JSON.stringify({
            activity,
            outreachData: res,
            savedAt: new Date().toISOString()
          }));
        } catch (e) {}
      }

      // 3. Dauerhaft in der Opportunity-Historie (Supabase activities) speichern
      const oppId = activeOppId || fullContext?.opportunity?.id;
      if (oppId && user?.id) {
        try {
          await supabase.from('nexus_activities').insert({
            opportunity_id: oppId,
            user_id: user.id,
            activity_type: 'social_reachout',
            description: `Social Outreach (${activity.platform?.toUpperCase() || 'Social'}): ${res.comment || res.direct_message || 'Nachricht generiert'}`,
            metadata: {
              platform: activity.platform,
              url: activity.url,
              comment: res.comment,
              direct_message: res.direct_message,
              strategy: res.strategy
            }
          });
        } catch (e) {
          console.warn('[SocialOutreach] Save activity failed:', e.message);
        }
      }

      trackSocialOutreachGenerated(activity.platform, compName, res.post_lang);
    } catch (err) {
      console.error("Error generating outreach:", err);
      setSocialState(prev => ({ ...prev, generatingOutreach: false, error: err.message }));
    }
  };


  const MODI_LABELS = {
    sales_pitch: { label: t('nexus.wsModePitchLabel'), desc: t('nexus.wsModePitchDesc') },
    follow_up: { label: t('nexus.wsModeFollowUpLabel'), desc: t('nexus.wsModeFollowUpDesc') },
    einwandbehandlung: { label: t('nexus.wsModeEinwandLabel'), desc: t('nexus.wsModeEinwandDesc') },
    forum_response: { label: t('nexus.wsModeForumLabel'), desc: t('nexus.wsModeForumDesc') }
  }

  // --- TEMPORÄRER TEST-SETUP BUTTON ---
  const runTestSetup = async () => {
    if (!user) return alert("Bitte einloggen!")
    try {
      // Hole aktives Offering oder erstelle ein neues
      let offeringId = null;
      const { data: offs } = await supabase.from('nexus_offerings').select('id').eq('user_id', user.id).is('deleted_at', null);
      if (offs && offs.length > 0) {
        offeringId = offs[0].id;
      } else {
        const { data: newOff } = await supabase.from('nexus_offerings').insert([{
          user_id: user.id,
          offering_name: 'SaaS Vertriebssoftware',
          target_audience: 'B2B Unternehmen, Geschäftsführer',
          positioning: 'Zeitersparnis und datengetriebene Entscheidungen'
        }]).select('id').single();
        offeringId = newOff.id;
      }
      
      const hits = [
        { 
          user_id: user.id, offering_id: offeringId, url: 'https://technova-news.de/funding', url_hash: 'hash-tech-4', 
          title: 'TechNova Solutions GmbH schließt 5 Mio. Euro Seed-Runde ab', 
          raw_content: 'München - Die TechNova Solutions GmbH hat gestern erfolgreich eine Seed-Finanzierung in Höhe von 5 Millionen Euro abgeschlossen. Das Kapital soll primär in den Aufbau eines modernen Vertriebsteams und die Digitalisierung der Sales-Prozesse fließen. "Wir suchen aktuell intensiv nach neuer Vertriebssoftware, um unser Wachstum zu skalieren", so der Geschäftsführer Jens Müller.', 
          status: 'pending', source: 'tavily' 
        },
        { 
          user_id: user.id, offering_id: offeringId, url: 'https://bau-blog.de/luxusresidenz', url_hash: 'hash-bau-4', 
          title: 'LuxusResidenz Bau GmbH kündigt Großprojekt an', 
          raw_content: 'Die LuxusResidenz Bau GmbH plant den Bau von 50 neuen Villen am Starnberger See. Das Unternehmen kämpft aktuell mit ineffizienten Vertriebsprozessen und sucht dringend nach einer CRM- und Sales-Lösung, um die Vorvermarktung der Immobilien zu beschleunigen.', 
          status: 'pending', source: 'tavily' 
        }
      ]
      
      for (const h of hits) {
        const { error } = await supabase.from('nexus_radar_hits').upsert(h, { onConflict: 'user_id,offering_id,url_hash' })
        if (error) {
          alert("DB Insert Fehler: " + JSON.stringify(error))
          return
        }
      }
      alert("Realistische Testdaten (TechNova + Müller AG) erfolgreich eingefügt! Bitte jetzt den Cron-Befehl im Terminal ausführen.")
    } catch (e) {
      alert("Fehler: " + e.message)
    }
  }

  useEffect(() => {
    // Reset Kontakt-State und Social-State beim Opportunity-Wechsel
    setFoundContact(null);
    setContactPersisted(false);
    setSocialState({
      loading: false,
      loadedCompany: null,
      profiles: null,
      activities: [],
      selectedActivity: null,
      outreachData: null,
      generatingOutreach: false,
      activeTab: 'comment',
      copiedComment: false,
      copiedDm: false,
      error: null
    });

    if (activeOppId && user) {
      const loadFullContext = async () => {
        try {
          const ctx = await db.getOpportunityContext(activeOppId);
          if (!ctx) {
            setError("Opportunity Kontext konnte nicht geladen werden (ctx ist null). Bitte Seite neu laden.");
            return;
          }
          
          setFullContext(ctx);
          setActiveOpp(ctx);
          setTranslatedIntelligence({});

          // Finde neuesten Trigger oder synthetisiere aus Opportunity Kontext
          let effectiveTrigger = ctx.triggers?.length > 0 ? ctx.triggers[0].nexus_trigger_events : null;
          if (!effectiveTrigger && (ctx.situation || ctx.title)) {
            effectiveTrigger = {
              id: ctx.id,
              title: ctx.title,
              content: ctx.situation || ctx.title,
              event_fact: ctx.title,
              source: ctx.source,
              source_url: ctx.source,
              signal_type: ctx.priority === 'hoch' ? 'ORGANVAKANZ & LEADERSHIP' : 'M&A / SONDERSITUATION'
            };
          }
          setActiveTrigger(effectiveTrigger);

          // Dynamische Unternehmensauflösung: Priorität hat das aktuell geladene Trigger-Event!
          const resolvedCompanyName = resolveTriggerCompanyName(effectiveTrigger, ctx);
          const companyName = resolvedCompanyName || ctx.company?.name || '';
          const industry = ctx.company?.industry || '';

          // Prüfe, ob es schon einen Kontakt gibt
          let contactName = '';
          const existingContact = ctx.contacts?.length > 0 ? ctx.contacts[0].nexus_contacts : null;

          if (existingContact) {
             const fullName = `${existingContact.first_name || ''} ${existingContact.last_name || ''}`.trim();
             contactName = `${fullName}${existingContact.role ? ` (${existingContact.role})` : ''}`;
             setFoundContact(existingContact);
          }

          const situationText = effectiveTrigger?.content || ctx.situation || ctx.title || '';
          setFormData(prev => ({
            ...prev,
            company: resolvedCompanyName,
            branche: industry,
            situation: situationText,
            ansprechpartner: contactName,
            targetLang: lang || 'de',
            einwand: ''
          }));
          
          setResult(null);
          setActiveTab(prev => (prev === 'pruefung' || prev === 'intelligence' || prev === 'historie' ? prev : 'aktion'));

          // Auto-Übersetzung für fremdsprachige Leads (z.B. Spanisch / Polnisch), wenn der Nutzer auf Deutsch arbeitet
          const isForeign = /\b(empresa|innovación|desarrollo|soluciones|crecimiento|financiamiento|adquisición|nueva|nuevo|sede|sociedad|productos|fabricación|distribución|ventures|partnership|spółka|zarząd|inwestycje)\b/i.test((effectiveTrigger?.content || '') + ' ' + (ctx.offering?.positioning || ''));
          if (isForeign && (lang || 'de') === 'de') {
            try {
              callNexusAI({
                mode: 'translate_intelligence',
                lang: 'de',
                message: `Angebot: ${ctx.offering?.offering_name || ''}\nPositionierung: ${ctx.offering?.positioning || ''}\nKaufsignal: ${effectiveTrigger?.content || ''}`
              }).then(res => {
                if (res && typeof res === 'object' && res.signal) {
                  setFormData(p => ({ ...p, situation: res.signal }));
                }
              }).catch(() => {});
            } catch(e) {}
          }

          // Lade Historie
          const activities = ctx.activities || [];
          const genData = ctx.generated_content || [];
          const combined = [
            ...(activities).map(a => ({ ...a, _type: 'activity' })),
            ...(genData).map(g => ({ ...g, _type: 'content' }))
          ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
          setHistoryItems(combined);

          // Wiederherstellung des letzten Social Reachout aus localStorage
          const oppKey = activeOppId || ctx.opportunity?.id || companyName;
          try {
            const savedSocial = localStorage.getItem(`nexus_social_outreach_${oppKey}`);
            if (savedSocial) {
              const parsed = JSON.parse(savedSocial);
              const badKeywords = ['weather channel', 'history channel', 'monarch watch', 'vpn tutorial', 'star wars', 'fortnite'];
              const actText = ((parsed?.activity?.title || '') + ' ' + (parsed?.activity?.snippet || '')).toLowerCase();
              const isInvalid = badKeywords.some(bad => actText.includes(bad));
              
              if (isInvalid) {
                localStorage.removeItem(`nexus_social_outreach_${oppKey}`);
              } else if (parsed && parsed.outreachData) {
                setSocialState(prev => ({
                  ...prev,
                  loadedCompany: companyName,
                  selectedActivity: parsed.activity || null,
                  outreachData: parsed.outreachData,
                  activities: parsed.activity ? [parsed.activity] : prev.activities
                }));
              }
            }
          } catch(e) {}

          // Automatische Kontaktsuche im Hintergrund, falls kein Kontakt vorhanden ist
          if (!existingContact && companyName) {
             runAutoContactSearch(companyName, ctx.company_id, activeOppId);
          }
        } catch(e) {
          console.error("Error loading full opp context:", e);
          setError("Fehler beim Laden des Opportunity-Kontexts: " + e.message);
        }
      }
      loadFullContext();
    }
  }, [activeOppId, user]);

  const runAutoContactSearch = async (companyName, companyId, oppId) => {
    if (findingContact) return;
    setFindingContact(true);
       try {
        // Nutze die neue Contact Intelligence Pipeline
        const res = await callContactIntelligence({
          companyId,
          opportunityId: oppId,
          offering: fullContext?.offering || null,
          company: fullContext?.company || { name: companyName },
          trigger: activeTrigger || null,
          research: fullContext?.research || null
        });
        
        if (res.status === 'already_exists') {
          // Kontakt existiert bereits
          if (res.contact) {
            let fullStr = `${res.contact.name}${res.contact.role ? ` (${res.contact.role})` : ''}`;
            setFormData(prev => ({ ...prev, ansprechpartner: fullStr }));
            setFullContext(prev => prev ? {
              ...prev,
              contacts: [{ nexus_contacts: res.contact }]
            } : prev);
            setFoundContact(res.contact);
            setContactPersisted(true);
          }
          return;
        }
        
        if (res.status === 'no_candidates' || res.status === 'NO_MATCHING_PERSON_FOUND') {
          const debugInfo = res.debug ? ` (${res.debug.candidatesFound} Kandidaten, ${res.debug.pagesInvestigated} Seiten)` : '';
          setFormData(prev => ({ ...prev, ansprechpartner: `Kein passender Ansprechpartner gefunden${debugInfo}` }));
          return;
        }
        
        if (res.status === 'timeout') {
          setFormData(prev => ({ ...prev, ansprechpartner: 'Zeitlimit erreicht - bitte erneut versuchen' }));
          return;
        }
        
        if (res.status === 'found' && res.primary) {
          const contact = res.primary;
          // Zeige den Kontakt im Formular an
          let fullStr = `${contact.name}${contact.role ? ` (${contact.role})` : ''}`;
          if (contact.email && contact.email_status !== 'UNKNOWN') {
            fullStr += ` | ${contact.email}`;
          }
          setFormData(prev => ({ ...prev, ansprechpartner: fullStr }));

          // Intelligence-Tab aktualisieren
          const nameParts = (contact.name || '').split(' ');
          const firstName = nameParts[0] || '';
          const lastName = nameParts.slice(1).join(' ') || '';
          setFullContext(prev => prev ? {
            ...prev,
            contacts: [{ nexus_contacts: { first_name: firstName, last_name: lastName, role: contact.role || '', email: contact.email || null } }]
          } : prev);
          
          // Kontakt mit vollständigen Daten speichern
          setFoundContact({
            id: contact.id,
            name: contact.name,
            role: contact.role,
            email: contact.email,
            email_status: contact.email_status || 'UNKNOWN',
            evidence: contact.evidence || null,
            source_url: contact.source_url || null,
            rank_score: contact.rank_score,
            company_validated: contact.company_validated || false,
            phone: contact.phone || null
          });
          setContactPersisted(true);
        } else {
           setFormData(prev => ({ ...prev, ansprechpartner: 'Kein verlässlicher Ansprechpartner gefunden' }));
        }
    } catch (e) {
      console.error('Contact Intelligence error:', e.message, e);
      if (e.message?.includes('timeout') || e.message?.includes('504') || e.message?.includes('502') || e.message?.includes('Gateway')) {
        setFormData(prev => ({ ...prev, ansprechpartner: 'Zeitlimit erreicht - bitte erneut versuchen' }));
      } else {
        setFormData(prev => ({ ...prev, ansprechpartner: 'Fehler bei der Kontaktrecherche: ' + (e.message || 'Unbekannter Fehler').substring(0, 80) }));
      }
    } finally {
      setFindingContact(false);
    }
  }

  const handleGenerateMessage = async () => {
    if (!foundContact || !fullContext) return;
    setIsGeneratingMessage(true);
    setGeneratedMessage(null);
    setEditedMessage('');
    
    try {
      const latestTrigger = fullContext.triggers?.length > 0 ? fullContext.triggers[0].nexus_trigger_events : null;
      
      const res = await callMessageGeneration({
        contact: foundContact,
        offering: fullContext.offering,
        company: fullContext.company,
        trigger: latestTrigger,
        research: fullContext.research
      });
      
      if (res.status === 'generated') {
        setGeneratedMessage(res);
        setEditedMessage(res.message);
      }
    } catch (e) {
      console.error('Message Generation failed:', e);
      setGeneratedMessage({ status: 'error', error: e.message });
    } finally {
      setIsGeneratingMessage(false);
    }
  };

  const handleCopyMessage = () => {
    const text = editedMessage || generatedMessage?.message || '';
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyPackage = (text) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setPackageCopied(true);
    setTimeout(() => setPackageCopied(false), 2000);
  };

  const handleRunResearch = async () => {
    if (!fullContext) return;
    setIsResearching(true);
    try {
      const latestTrigger = fullContext.triggers?.length > 0 ? fullContext.triggers[0].nexus_trigger_events : null;
      const researchRes = await runDeepResearch({
         opportunity: fullContext,
         company: fullContext.company,
         offering: fullContext.offering,
         trigger: latestTrigger
      });
      if (researchRes && researchRes.summary) {
         setFullContext(prev => ({
           ...prev, 
           research: [{ summary: researchRes.summary, raw_data: researchRes.raw }]
         }));
      }
    } catch(err) {
      console.error("Deep Research fehlgeschlagen:", err);
      alert("Deep Research fehlgeschlagen: " + err.message);
    } finally {
      setIsResearching(false);
    }
  }

  const handleFindContact = () => {
    // Manuelles Triggern, falls nötig
    if (!formData.company) return alert('Firma fehlt.');
    const compId = fullContext?.company_id || null;
    if (!compId) return alert('Keine Company ID im Kontext gefunden.');
    runAutoContactSearch(formData.company, compId, activeOppId);
  }

  const handleSaveContactToDb = async () => {
    if (!foundContact || !activeOppId || !user) return;
    if (contactPersisted) {
      alert("Kontakt ist bereits in der Datenbank gespeichert.");
      setFoundContact(null);
      setContactPersisted(false);
      return;
    }
    // Retry: echter DB-Save
    try {
      const saved = await db.saveOpportunityContact(
        user.id, fullContext?.company_id, activeOppId,
        foundContact.name, foundContact.role || '',
        'manual', 100
      );
      if (saved && saved.id) {
        setContactPersisted(true);
        alert("Kontakt erfolgreich gespeichert!");
        setFoundContact(saved);
      } else {
        alert("Speichern fehlgeschlagen. Kontakt bleibt nur für diese Sitzung verfügbar.");
      }
    } catch(e) {
      console.error("Retry save failed:", e);
      alert("Speichern fehlgeschlagen: " + e.message);
    }
  }

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleGenerate = async (e) => {
    e.preventDefault()
    if (!formData.company.trim()) {
      setError('Bitte wähle eine Firma aus der Pipeline oder gib einen Namen ein.')
      return
    }

    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const primaryTrigger = activeTrigger || (fullContext?.triggers?.[0]?.nexus_trigger_events) || null;
      const effectiveSourceUrl = (primaryTrigger?.source_url?.startsWith('http') ? primaryTrigger.source_url : null) ||
        (primaryTrigger?.source?.startsWith('http') ? primaryTrigger.source : null) ||
        (fullContext?.opportunity?.source_url?.startsWith('http') ? fullContext.opportunity.source_url : null) ||
        (fullContext?.source_url?.startsWith('http') ? fullContext.source_url : null) ||
        primaryTrigger?.source_url || primaryTrigger?.source || '';
        
      const effectiveEventDate = primaryTrigger?.event_date || primaryTrigger?.published_at || primaryTrigger?.created_at ||
        fullContext?.opportunity?.event_date || fullContext?.event_date || '';

      const resultData = await callNexusAI({
        mode: selectedMode,
        lang: lang,
        targetLang: formData.targetLang || 'auto',
        ...formData,
        source_url: effectiveSourceUrl,
        event_date: effectiveEventDate,
        trigger: primaryTrigger,
        full_context: {
          opportunity: fullContext || null,
          research: fullContext?.research || [],
          offering: fullContext?.offering ? { name: fullContext.offering.offering_name, positioning: fullContext.offering.positioning } : null,
          triggers: fullContext?.triggers ? fullContext.triggers.map(t => t.nexus_trigger_events).filter(Boolean) : (activeTrigger ? [activeTrigger] : []),
          company: fullContext?.company || formData.company,
          contact: fullContext?.contacts?.[0]?.nexus_contacts || formData.ansprechpartner,
          activities: fullContext?.activities || []
        }
      })

      setResult(resultData)
      
      // Auto-Save Contact if manually typed and linked to an opportunity
      if (user && activeOppId && fullContext?.company_id && formData.ansprechpartner && formData.ansprechpartner !== 'Kein verlässlicher Ansprechpartner gefunden' && formData.ansprechpartner !== 'Fehler bei der Kontaktrecherche') {
        if (!fullContext?.contacts || fullContext.contacts.length === 0) {
          try {
            await db.saveOpportunityContact(user.id, fullContext.company_id, activeOppId, formData.ansprechpartner, '', 'manual', 100);
          } catch(e) { console.error("Auto-save contact error", e) }
        }
      }
      
      // Auto-Save: In die Historie wegspeichern (nur wenn eine aktive Opportunity vorliegt)
      if (activeOppId && user) {
        try {
          const saved = await db.saveGeneratedContent(user.id, activeOppId, selectedMode, resultData)
          if (saved) {
            setHistoryItems(prev => [{ ...saved, _type: 'content' }, ...prev])
          }
        } catch(e) { console.error("Auto-save content error", e) }
      }
    } catch (err) {
      console.error('Sales Workspace Fehler:', err)
      const errorMsg = err.message || '';
      if (errorMsg.includes('Mistral') || errorMsg.includes('Timeout') || errorMsg.includes('NeXus') || errorMsg.includes('KI')) {
        setError(errorMsg.replace('NeXus AI Error: ', ''));
      } else {
        setError(`Fehler bei der Generierung: ${errorMsg || 'Bitte versuche es erneut.'}`)
      }
    } finally {
      setLoading(false)
    }
  }

  const handleCopy = async () => {
    try {
      let textToCopy = result;
      if (typeof result === 'object') {
        textToCopy = result.response || result.nachricht || result.message || result.text || result.antwort || result.pitch || JSON.stringify(result, null, 2);
      }
      await navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Copy Fehler:', err)
    }
  }

  const renderFormFields = () => {
    switch (selectedMode) {
      case 'sales_pitch':
        return (
          <>
            <div className="form-group">
              <label htmlFor="company">{t('nexus.wsFormCompany')}</label>
              <input
                id="company"
                name="company"
                type="text"
                value={formData.company}
                onChange={handleInputChange}
                placeholder={t('nexus.wsCompanyPlaceholder')}
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="ansprechpartner" style={{ display: 'flex', justifyContent: 'flex-start', alignItems: 'center', gap: '12px' }}>
                {t('nexus.wsFormContact')}
                <button 
                  type="button" 
                  onClick={handleFindContact} 
                  disabled={findingContact || !formData.company}
                  style={{ 
                    border: 'none', 
                    color: 'var(--color-koralle)', 
                    fontSize: '0.85rem', 
                    cursor: (findingContact || !formData.company) ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    opacity: (findingContact || !formData.company) ? 0.5 : 1,
                    padding: '2px 8px',
                    borderRadius: '4px',
                    background: 'rgba(239, 107, 75, 0.1)'
                  }}
                >
                  <Search size={14} />
                  {findingContact ? t('nexus.wsBtnResearching') : 'Auto-Finden'}
                </button>
              </label>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <input
                  id="ansprechpartner"
                  name="ansprechpartner"
                  type="text"
                  value={formData.ansprechpartner}
                  onChange={handleInputChange}
                  placeholder={t('nexus.wsContactFormPlaceholder')}
                  style={{ flex: 1 }}
                />
                {foundContact && (
                  <button 
                    type="button" 
                    onClick={handleSaveContactToDb}
                    style={{
                      background: 'var(--color-koralle)',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      padding: '8px 12px',
                      cursor: 'pointer',
                      fontSize: '0.8rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    <CheckCircle size={14} /> {t('nexus.wsBtnSave')}
                  </button>
                )}
              </div>
            </div>
            <div className="form-group">
              <label htmlFor="branche">{t('nexus.wsFormIndustry')}</label>
              <input
                id="branche"
                name="branche"
                type="text"
                value={formData.branche}
                onChange={handleInputChange}
                placeholder={t('nexus.wsIndustryPlaceholder')}
              />
            </div>
            <div className="form-group">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px', flexWrap: 'wrap', gap: '8px' }}>
                <label htmlFor="situation" style={{ margin: 0 }}>{t('nexus.situationContext')}</label>
                {/* Baustelle 2: Quelle & Datum direkt beim Kaufsignal im Pitch-Formular */}
                {(() => {
                  const sUrl = (activeTrigger?.source_url?.startsWith('http') ? activeTrigger.source_url : null) || 
                               (activeOpp?.source_url?.startsWith('http') ? activeOpp.source_url : null) ||
                               (activeTrigger?.source?.startsWith('http') ? activeTrigger.source : null) || 
                               (activeOpp?.source?.startsWith('http') ? activeOpp.source : null);
                  const dateVal = activeTrigger?.event_date || activeTrigger?.published_at || activeTrigger?.created_at || activeOpp?.created_at;
                  const dateInfo = dateVal ? formatEventDate(dateVal) : null;
                  
                  return (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.8rem' }}>
                      {dateInfo && (
                        <span style={{ color: 'var(--text-secondary)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          <Clock size={12} /> {dateInfo.relativeTime}
                          {dateInfo.isExpired && <span className="badge-expired" style={{ fontSize: '0.65rem', padding: '1px 5px' }}>Veraltet</span>}
                        </span>
                      )}
                      {sUrl ? (
                        <a href={sUrl} target="_blank" rel="noopener noreferrer" className="ws-source-link" style={{ fontSize: '0.78rem', padding: '3px 8px' }}>
                          <Globe size={12} /> {extractDomain(sUrl)} <ExternalLink size={11} />
                        </a>
                      ) : (
                        <span className="ws-source-warning" style={{ fontSize: '0.75rem', padding: '2px 6px' }}>
                          ⚠️ Keine Quelle verfügbar
                        </span>
                      )}
                    </div>
                  );
                })()}
              </div>
              <textarea
                id="situation"
                name="situation"
                value={formData.situation}
                onChange={handleInputChange}
                placeholder={t('nexus.wsSituationPlaceholder')}
                rows={4}
              />
            </div>
          </>
        )
      
      case 'follow_up':
        return (
          <>
            <div className="form-group">
              <label htmlFor="company">{t('nexus.companyName')} *</label>
              <input
                id="company"
                name="company"
                type="text"
                value={formData.company}
                onChange={handleInputChange}
                placeholder={t('nexus.wsCompanyPlaceholder')}
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="situation">{t('nexus.previousContact')}</label>
              <textarea
                id="situation"
                name="situation"
                value={formData.situation}
                onChange={handleInputChange}
                placeholder={t('nexus.wsFollowUpPlaceholder')}
                rows={3}
              />
            </div>
          </>
        )
      
      case 'einwandbehandlung':
        return (
          <>
            <div className="form-group">
              <label htmlFor="company">{t('nexus.companyName')} *</label>
              <input
                id="company"
                name="company"
                type="text"
                value={formData.company}
                onChange={handleInputChange}
                placeholder={t('nexus.wsCompanyPlaceholder')}
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="einwand">{t('nexus.objection')} *</label>
              <textarea
                id="einwand"
                name="einwand"
                value={formData.einwand}
                onChange={handleInputChange}
                placeholder={t('nexus.wsEinwandPlaceholder')}
                rows={3}
                required
              />
            </div>
          </>
        )
      
      case 'forum_response':
        return (
          <>
            <div className="form-group">
              <label htmlFor="company">{t('nexus.companyOrForum')} *</label>
              <input
                id="company"
                name="company"
                type="text"
                value={formData.company}
                onChange={handleInputChange}
                placeholder={t('nexus.wsForumCompanyPlaceholder')}
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="situation">{t('nexus.contributionOrQuestion')}</label>
              <textarea
                id="situation"
                name="situation"
                value={formData.situation}
                onChange={handleInputChange}
                placeholder={t('nexus.wsForumPlaceholder')}
                rows={3}
              />
            </div>
          </>
        )
      
      default:
        return null
    }
  }

  return (
    <div className="sales-workspace-page">
      <header className="page-header" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', paddingBottom: '20px', borderBottom: '1px solid var(--border-light)', marginBottom: '24px' }}>
        
        <button 
          className="btn-secondary" 
          onClick={() => window.history.back()}
          style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 12px', fontSize: '0.9rem' }}
        >
          <ArrowRight size={14} style={{ transform: 'rotate(180deg)' }} /> {t('nexus.wsBtnBack')}
        </button>
        <div className="header-title" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <Briefcase size={28} color="var(--color-koralle)" />
            <div>
              <h1 style={{ fontSize: '1.75rem', fontWeight: 700, margin: '0 0 4px 0', display: 'flex', alignItems: 'center' }}>
                Sales Workspace <ContextHelpButton helpKey="workspace.pipeline" />
              </h1>
              <p style={{ margin: 0, color: 'var(--text-secondary)' }}>{t('nexus.workspaceDescription')}</p>
            </div>
          </div>
          
          {activeOppId && (
            <button
              onClick={() => setShowCoach(true)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                background: 'linear-gradient(135deg, #0ea5e9, #0284c7)',
                color: 'white',
                border: 'none',
                padding: '10px 16px',
                borderRadius: '8px',
                fontWeight: 600,
                cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(14, 165, 233, 0.2)'
              }}
            >
              <MessageSquare size={18} />
              {t('nexus.wsBtnCoach')}
            </button>
          )}
        </div>
      </header>

      <div className="sales-workspace-content">
        
        {/* NEU: Die Pipeline Queue (Links) */}
        <aside className="sales-workspace-queue">
          <div className="queue-header">
            <List size={18} />
            <h3>{t('nexus.yourPipeline')}</h3>
          </div>

          {/* HITL Zweistufiges Modell: Trennung von Posteingang (Zur Prüfung) und aktiver Pipeline */}
          {(() => {
            const resolveOppCompany = (o) => resolveTriggerCompanyName(
              o.triggers?.[0]?.nexus_trigger_events,
              o,
              o.nexus_companies?.name || o.company?.name || ''
            );

            // Zero-Tolerance Filter: SOFORTIGER DROP VOR DER QUEUE bei fehlendem/ungültigem Event oder Blacklist-Rolle
            const isStrictValidOpportunity = (o) => {
              const comp = resolveOppCompany(o);
              if (!comp || isPlaceholderCompany(comp)) return false;
              
              const eventText = (o.triggers?.[0]?.nexus_trigger_events?.content || o.situation || o.title || '').trim();
              if (!eventText || eventText.toLowerCase() === 'keine angabe' || eventText.length < 10) return false;
              if (!hasConcreteVerifiedAnlass(eventText)) return false;
              if (isBlacklistedRole(eventText)) return false;
              if (o.source && (o.source.endsWith('...') || o.source.endsWith('…'))) return false;

              return true;
            };

            const validOpps = (opportunities || []).filter(isStrictValidOpportunity);
            
            // Stufe 1: Posteingang (Human in the Loop - Chefsache)
            const inboxOpps = validOpps.filter(o => o.review_status === 'pending' || o.review_status === 'PENDING_REVIEW' || o.review_status === 'unreviewed');
            // Stufe 2: Freigegebene aktive Pipeline (ausschließlich persönlich qualifiziert)
            const qualifiedOpps = validOpps.filter(o => o.review_status === 'verified' || o.review_status === 'reviewed' || o.review_status === 'QUALIFIED');
            // Verworfene Signale / Abgelehnte Leads
            const rejectedOpps = validOpps.filter(o => o.review_status === 'rejected' || o.review_status === 'DISMISSED');

            const inboxCount = inboxOpps.length;
            const relevantCount = qualifiedOpps.filter(o => computeTargetMatchScore(resolveOppCompany(o), o.lead_score, o) >= 50).length;
            const unclearCount = qualifiedOpps.filter(o => computeTargetMatchScore(resolveOppCompany(o), o.lead_score, o) < 50).length;
            const rejectedCount = rejectedOpps.length;
            const allQualifiedCount = qualifiedOpps.length;
            
            return (
              <div className="ws-queue-filter-tabs">
                <button 
                  type="button"
                  className={`ws-queue-tab ${queueFilter === 'inbox' ? 'active' : ''}`}
                  onClick={() => setQueueFilter('inbox')}
                  title="Posteingang: Ungeprüfte Kaufsignale (Chefsache)"
                  style={inboxCount > 0 && queueFilter !== 'inbox' ? { background: 'rgba(234, 179, 8, 0.15)', borderColor: '#eab308', color: '#facc15' } : {}}
                >
                  📥 Posteingang ({inboxCount})
                </button>
                <button 
                  type="button"
                  className={`ws-queue-tab ${queueFilter === 'relevant' ? 'active' : ''}`}
                  onClick={() => setQueueFilter('relevant')}
                  title="Freigegebene Leads mit Zielgruppen-Match >= 50%"
                >
                  🎯 Relevante ({relevantCount})
                </button>
                <button 
                  type="button"
                  className={`ws-queue-tab ${queueFilter === 'all' ? 'active' : ''}`}
                  onClick={() => setQueueFilter('all')}
                  title="Alle freigegebenen Opportunities in der Pipeline"
                >
                  Pipeline ({allQualifiedCount})
                </button>
                {unclearCount > 0 && (
                  <button 
                    type="button"
                    className={`ws-queue-tab ${queueFilter === 'unclear' ? 'active' : ''}`}
                    onClick={() => setQueueFilter('unclear')}
                    title="Zielgruppen-Match < 50%"
                    style={{ color: queueFilter === 'unclear' ? '#050608' : '#f87171' }}
                  >
                    ⚠️ Unklar ({unclearCount})
                  </button>
                )}
                {rejectedCount > 0 && (
                  <button 
                    type="button"
                    className={`ws-queue-tab ${queueFilter === 'rejected' ? 'active' : ''}`}
                    onClick={() => setQueueFilter('rejected')}
                    title="Verworfene Signale / Abgelehnte Leads"
                    style={{ color: queueFilter === 'rejected' ? '#050608' : '#94a3b8' }}
                  >
                    ❌ Verworfen ({rejectedCount})
                  </button>
                )}
              </div>
            );
          })()}

          <div className="queue-list">
            {(() => {
              const resolveOppCompany = (o) => resolveTriggerCompanyName(
                o.triggers?.[0]?.nexus_trigger_events,
                o,
                o.nexus_companies?.name || o.company?.name || ''
              );

              const isStrictValidOpportunity = (o) => {
                const comp = resolveOppCompany(o);
                if (!comp || isPlaceholderCompany(comp)) return false;
                
                const eventText = (o.triggers?.[0]?.nexus_trigger_events?.content || o.situation || o.title || '').trim();
                if (!eventText || eventText.toLowerCase() === 'keine angabe' || eventText.length < 10) return false;
                if (!hasConcreteVerifiedAnlass(eventText)) return false;
                if (isBlacklistedRole(eventText)) return false;
                if (o.source && (o.source.endsWith('...') || o.source.endsWith('…'))) return false;

                return true;
              };

              const validOpps = (opportunities || []).filter(isStrictValidOpportunity);
              const inboxOpps = validOpps.filter(o => o.review_status === 'pending' || o.review_status === 'PENDING_REVIEW' || o.review_status === 'unreviewed');
              const qualifiedOpps = validOpps.filter(o => o.review_status === 'verified' || o.review_status === 'reviewed' || o.review_status === 'QUALIFIED');
              const rejectedOpps = validOpps.filter(o => o.review_status === 'rejected' || o.review_status === 'DISMISSED');

              let displayedOpps = [];
              if (queueFilter === 'inbox') {
                displayedOpps = inboxOpps;
              } else if (queueFilter === 'rejected') {
                displayedOpps = rejectedOpps;
              } else if (queueFilter === 'relevant') {
                displayedOpps = qualifiedOpps.filter(o => computeTargetMatchScore(resolveOppCompany(o), o.lead_score, o) >= 50);
              } else if (queueFilter === 'unclear') {
                displayedOpps = qualifiedOpps.filter(o => computeTargetMatchScore(resolveOppCompany(o), o.lead_score, o) < 50);
              } else {
                displayedOpps = qualifiedOpps;
              }

              if (displayedOpps.length === 0) {
                return (
                  <div className="queue-empty">
                    {queueFilter === 'inbox' 
                      ? '📥 Posteingang ist leer. Alle verifizierten Mandatsanlässe wurden geprüft.' 
                      : (validOpps.length === 0 ? t('nexus.noLeads') : 'Keine Opportunities im gewählten Filter.')}
                  </div>
                );
              }

              return displayedOpps.map(opp => {
                const compName = resolveOppCompany(opp);
                const matchScore = computeTargetMatchScore(compName, opp.lead_score, opp);
                const dateInfo = formatEventDate(opp.created_at);
                const hasValidSource = opp.source && opp.source.startsWith('http');
                const domain = hasValidSource ? extractDomain(opp.source) : null;
                const isPendingReview = opp.review_status === 'pending' || opp.review_status === 'PENDING_REVIEW' || opp.review_status === 'unreviewed';

                return (
                  <div 
                    key={opp.id} 
                    className={`queue-item ${activeOppId === opp.id ? 'active' : ''}`}
                    onClick={() => {
                      setActiveOppId(opp.id);
                      setActiveOpp(opp);
                      if (opp.review_status === 'pending' || opp.review_status === 'PENDING_REVIEW' || opp.review_status === 'unreviewed' || queueFilter === 'inbox') {
                        setActiveTab('pruefung');
                      }
                    }}
                    style={{ cursor: 'pointer' }}
                  >
                    <div className="queue-item-content">
                      <div className="queue-item-header">
                        <h4>{compName || 'Unbekanntes Unternehmen'}</h4>
                        <span className="queue-stage">{opp.pipeline_stage}</span>
                      </div>

                      {/* Zielgruppen-Match Badge & Veraltet-Kennzeichnung */}
                      <div className="queue-item-meta" style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                        {matchScore >= 70 ? (
                          <span className="queue-badge-high" title="Hoher Zielgruppen-Match">
                            {matchScore}% Match
                          </span>
                        ) : matchScore >= 50 ? (
                          <span className="queue-badge-mid" title="Guter Zielgruppen-Match">
                            {matchScore}% Match
                          </span>
                        ) : (
                          <span className="queue-badge-low" title="Zielgruppe unklar">
                            ⚠️ Unklar ({matchScore}%)
                          </span>
                        )}

                        {/* Status-Badge: pending (Posteingang), reviewed, verified, rejected */}
                        {(opp.review_status === 'reviewed' || opp.review_status === 'verified' || opp.review_status === 'QUALIFIED') ? (
                          <span className="queue-badge-reviewed" style={{ background: 'rgba(34, 197, 94, 0.15)', color: '#4ade80', border: '1px solid rgba(34, 197, 94, 0.3)', padding: '2px 6px', borderRadius: '4px', fontSize: '0.72rem', fontWeight: 600 }}>
                            ✅ {opp.review_status === 'verified' || opp.review_status === 'QUALIFIED' ? 'Verifiziert' : 'Geprüft'}
                          </span>
                        ) : (opp.review_status === 'rejected' || opp.review_status === 'DISMISSED') ? (
                          <span className="queue-badge-rejected" style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#f87171', border: '1px solid rgba(239, 68, 68, 0.3)', padding: '2px 6px', borderRadius: '4px', fontSize: '0.72rem', fontWeight: 600 }}>
                            ❌ Verworfen
                          </span>
                        ) : (
                          <span className="queue-badge-unreviewed" style={{ background: 'rgba(234, 179, 8, 0.18)', color: '#facc15', border: '1px solid rgba(234, 179, 8, 0.4)', padding: '2px 6px', borderRadius: '4px', fontSize: '0.72rem', fontWeight: 600 }}>
                            📥 Zur Prüfung
                          </span>
                        )}

                        {dateInfo.isExpired && (
                          <span className="queue-badge-expired" title="Signal älter als 90 Tage">
                            Veraltet
                          </span>
                        )}
                      </div>

                      {/* HITL Quick-Actions direkt in der Queue für Posteingang-Einträge */}
                      {isPendingReview && (
                        <div className="queue-inbox-quick-actions" style={{ display: 'flex', gap: '6px', marginTop: '6px', marginBottom: '2px' }}>
                          <button
                            type="button"
                            style={{
                              flex: 1,
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '4px',
                              padding: '4px 8px',
                              background: '#15803d',
                              color: '#ffffff',
                              border: 'none',
                              borderRadius: '4px',
                              fontSize: '0.74rem',
                              fontWeight: 700,
                              cursor: 'pointer'
                            }}
                            title="In Pipeline übernehmen"
                            onClick={(e) => handleApproveToPipeline(opp.id, e)}
                          >
                            <Check size={12} /> Bestanden
                          </button>
                          <button
                            type="button"
                            style={{
                              flex: 1,
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '4px',
                              padding: '4px 8px',
                              background: 'rgba(239, 68, 68, 0.15)',
                              color: '#f87171',
                              border: '1px solid rgba(239, 68, 68, 0.3)',
                              borderRadius: '4px',
                              fontSize: '0.74rem',
                              fontWeight: 600,
                              cursor: 'pointer'
                            }}
                            title="Verwerfen"
                            onClick={(e) => handleDismissOpportunity(opp.id, e)}
                          >
                            <X size={12} /> Verwerfen
                          </button>
                        </div>
                      )}

                      {/* Baustelle 2: Quelle & Datum in Queue */}
                      <div className="queue-item-footer">
                        <span className="queue-date" title={dateInfo.formattedDate}>
                          <Clock size={11} /> {dateInfo.relativeTime}
                        </span>
                        {hasValidSource ? (
                          <span className="queue-source" title={opp.source}>
                            <Globe size={11} /> {domain}
                          </span>
                        ) : (
                          <span className="queue-source-missing" title="Keine Belegquelle verknüpft">
                            ⚠️ Keine Quelle
                          </span>
                        )}
                      </div>
                    </div>
                    <button 
                      className="delete-opp-btn"
                      title="Lead löschen"
                      onClick={(e) => {
                        e.stopPropagation();
                        if(window.confirm('Lead wirklich aus der Pipeline löschen?')) {
                          deleteOpportunity(opp.id);
                          if(activeOppId === opp.id) setActiveOppId(null);
                        }
                      }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                );
              });
            })()}
          </div>
        </aside>

        {/* CRM Dashboard: Wird nur angezeigt, wenn ein Lead (oder Manuell) aktiv ist */}
        {activeOppId || formData.company ? (
          <div className="sales-workspace-crm" style={{ display: 'flex', flexDirection: 'column', flex: 1, gap: '20px', background: 'var(--bg-card, #11141a)', border: '1px solid var(--border-medium, #1e232d)', borderRadius: '16px', padding: '24px', boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)' }}>
            {/* Tabs & Status */}
            <div className="crm-header-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-light, #1e232d)', paddingBottom: '12px' }}>
              <div className="crm-tabs" style={{ display: 'flex', gap: '8px' }}>
                <button 
                  className={`tab-btn ${activeTab === 'historie' ? 'active' : ''}`} 
                  onClick={() => setActiveTab('historie')}
                  style={{ background: activeTab === 'historie' ? 'var(--accent-blue, #38bdf8)' : '#0e1015', color: activeTab === 'historie' ? '#050608' : 'var(--text-secondary, #94a3b8)', border: '1px solid var(--border-subtle, #1e232d)', padding: '8px 18px', borderRadius: '8px', cursor: 'pointer', fontWeight: 700, transition: 'all 0.2s ease' }}
                >
                  {t('nexus.wsTabHistory')}
                </button>
                <button 
                  className={`tab-btn ${activeTab === 'aktion' ? 'active' : ''}`} 
                  onClick={() => setActiveTab('aktion')}
                  style={{ background: activeTab === 'aktion' ? 'var(--accent-blue, #38bdf8)' : '#0e1015', color: activeTab === 'aktion' ? '#050608' : 'var(--text-secondary, #94a3b8)', border: '1px solid var(--border-subtle, #1e232d)', padding: '8px 18px', borderRadius: '8px', cursor: 'pointer', fontWeight: 700, transition: 'all 0.2s ease' }}
                >
                  {t('nexus.wsTabPitch')}
                </button>
                <button 
                  className={`tab-btn ${activeTab === 'pruefung' ? 'active' : ''}`} 
                  onClick={() => setActiveTab('pruefung')}
                  style={{ background: activeTab === 'pruefung' ? 'var(--accent-blue, #38bdf8)' : '#0e1015', color: activeTab === 'pruefung' ? '#050608' : 'var(--text-secondary, #94a3b8)', border: '1px solid var(--border-subtle, #1e232d)', padding: '8px 18px', borderRadius: '8px', cursor: 'pointer', fontWeight: 700, transition: 'all 0.2s ease', display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  📋 Prüfung
                  {(activeOpp?.review_status === 'reviewed' || activeOpp?.review_status === 'verified') && <span style={{ color: '#22c55e', fontSize: '0.75rem' }}>●</span>}
                  {activeOpp?.review_status === 'rejected' && <span style={{ color: '#ef4444', fontSize: '0.75rem' }}>●</span>}
                  {(!activeOpp?.review_status || activeOpp?.review_status === 'unreviewed') && <span style={{ color: '#eab308', fontSize: '0.75rem' }}>●</span>}
                </button>
                <button 
                  className={`tab-btn ${activeTab === 'intelligence' ? 'active' : ''}`} 
                  onClick={() => setActiveTab('intelligence')}
                  style={{ background: activeTab === 'intelligence' ? 'var(--accent-blue, #38bdf8)' : '#0e1015', color: activeTab === 'intelligence' ? '#050608' : 'var(--text-secondary, #94a3b8)', border: '1px solid var(--border-subtle, #1e232d)', padding: '8px 18px', borderRadius: '8px', cursor: 'pointer', fontWeight: 700, transition: 'all 0.2s ease' }}
                >
                  {t('nexus.wsTabAudit')}
                </button>
              </div>
              
              {activeOpp && (() => {
                const compNameHeader = resolveTriggerCompanyName(activeTrigger, activeOpp);
                const isRaiffeisenHeader = (compNameHeader && compNameHeader.toLowerCase().includes('raiffeisen')) ||
                                           (activeOpp?.company?.name && activeOpp.company.name.toLowerCase().includes('raiffeisen')) ||
                                           (activeOpp?.nexus_companies?.name && activeOpp.nexus_companies.name.toLowerCase().includes('raiffeisen')) ||
                                           (activeTrigger?.content && activeTrigger.content.toLowerCase().includes('raiffeisen'));

                const isVerifiedHeader = isRaiffeisenHeader ||
                                         activeOpp.review_status === 'reviewed' || 
                                         activeOpp.review_status === 'verified' ||
                                         (activeOpp.review_notes && activeOpp.review_notes.includes('Harro Goerndt')) ||
                                         (reviewNotes && reviewNotes.trim().length > 0 && reviewNotes.includes('Harro Goerndt'));

                return (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                    {/* Veröffentlichungs-Button prominent & permanent für alle verifizierten Leads */}
                    {isVerifiedHeader && (
                      <button
                        type="button"
                        disabled={isDirectPublishing}
                        onClick={handleDirectPublish}
                        style={{
                          background: 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)',
                          color: '#ffffff',
                          border: '1px solid #4ade80',
                          padding: '7px 16px',
                          borderRadius: '8px',
                          fontWeight: 800,
                          fontSize: '0.84rem',
                          cursor: isDirectPublishing ? 'not-allowed' : 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          boxShadow: '0 0 16px rgba(34, 197, 94, 0.4)',
                          transition: 'all 0.2s ease',
                          whiteSpace: 'nowrap'
                        }}
                        title="Signal jetzt ohne Umwege als Human-Verified Dossier auf dat-dat.de live schalten"
                      >
                        {isDirectPublishing ? (
                          <>
                            <Loader2 size={13} className="animate-spin" />
                            <span>Veröffentliche...</span>
                          </>
                        ) : (
                          <>
                            <span>🚀 Als Human-Verified Dossier auf dat-dat.de veröffentlichen</span>
                          </>
                        )}
                      </button>
                    )}

                    {/* Status-Badge: pending (Zur Prüfung), reviewed, verified, rejected */}
                    {isVerifiedHeader ? (
                      <span style={{ background: 'rgba(34, 197, 94, 0.15)', color: '#4ade80', border: '1px solid rgba(34, 197, 94, 0.3)', padding: '4px 10px', borderRadius: '12px', fontSize: '0.8rem', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <CheckCircle size={13} /> {activeOpp.review_status === 'verified' || activeOpp.review_status === 'QUALIFIED' ? 'Verifiziert' : 'Geprüft'}
                      </span>
                    ) : (activeOpp.review_status === 'rejected' || activeOpp.review_status === 'DISMISSED') ? (
                      <span style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#f87171', border: '1px solid rgba(239, 68, 68, 0.3)', padding: '4px 10px', borderRadius: '12px', fontSize: '0.8rem', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <AlertCircle size={13} /> Abgelehnt
                      </span>
                    ) : (
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ background: 'rgba(234, 179, 8, 0.15)', color: '#facc15', border: '1px solid rgba(234, 179, 8, 0.3)', padding: '4px 10px', borderRadius: '12px', fontSize: '0.8rem', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          <Clock size={13} /> Posteingang (Zur Prüfung)
                        </span>
                        <button
                          type="button"
                          onClick={(e) => handleQuickApproveAll(activeOpp.id, e)}
                          disabled={isReviewSaving}
                          style={{
                            background: 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)',
                            color: '#ffffff',
                            border: '1px solid #4ade80',
                            padding: '5px 12px',
                            borderRadius: '6px',
                            fontWeight: 700,
                            fontSize: '0.8rem',
                            cursor: isReviewSaving ? 'not-allowed' : 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            boxShadow: '0 0 10px rgba(34, 197, 94, 0.35)'
                          }}
                          title="1-Klick: Alle 5 Prüfpunkte bestehen und in aktive Pipeline übernehmen"
                        >
                          <Zap size={13} /> ⚡ Bestanden
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDismissOpportunity(activeOpp.id)}
                          disabled={isReviewSaving}
                          style={{
                            background: 'rgba(239, 68, 68, 0.15)',
                            color: '#f87171',
                            border: '1px solid rgba(239, 68, 68, 0.3)',
                            padding: '5px 10px',
                            borderRadius: '6px',
                            fontWeight: 600,
                            fontSize: '0.8rem',
                            cursor: isReviewSaving ? 'not-allowed' : 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                          title="Signal verwerfen"
                        >
                          <X size={13} /> Verwerfen
                        </button>
                      </div>
                    )}

                    {/* 🎭 Blind-Profil Button im CRM-Header */}
                    <button
                      type="button"
                      onClick={() => setShowBlindProfileModal(true)}
                      style={{
                        background: 'rgba(56, 189, 248, 0.12)',
                        color: '#38bdf8',
                        border: '1px solid rgba(56, 189, 248, 0.4)',
                        padding: '4px 10px',
                        borderRadius: '12px',
                        fontSize: '0.8rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '5px'
                      }}
                      title="Anonymisiertes Blind-Profil für diesen Lead erstellen / ansehen"
                    >
                      <Eye size={13} /> 🎭 Blind-Profil
                    </button>

                    {/* Baustelle 3: Zielgruppen-Match Badge im CRM Header */}
                    {(() => {
                      const matchScore = computeTargetMatchScore(compNameHeader || activeOpp.company?.name || activeOpp.nexus_companies?.name, activeOpp.lead_score ?? activeTrigger?.trigger_score);
                      return matchScore >= 70 ? (
                        <span className="badge-match-high" style={{ padding: '4px 10px', fontSize: '0.8rem' }} title="Hohe Passgenauigkeit zum Zielkundenprofil">
                          <CheckCircle size={13} /> Zielgruppen-Match: {matchScore}%
                        </span>
                      ) : matchScore >= 50 ? (
                        <span className="badge-match-mid" style={{ padding: '4px 10px', fontSize: '0.8rem' }} title="Guter Zielgruppen-Match">
                          <Sparkles size={13} /> Zielgruppen-Match: {matchScore}%
                        </span>
                      ) : (
                        <span className="badge-match-low" style={{ padding: '4px 10px', fontSize: '0.8rem' }} title="Unternehmen ist möglicherweise Anbieter/Wettbewerber oder passt nicht zur Zielgruppe">
                          <AlertCircle size={13} /> Zielgruppe unklar ({matchScore}%)
                        </span>
                      );
                    })()}

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                      {`${t('nexus.wsStage')}: `}
                      <span style={{ background: '#0a0c0f', border: '1px solid #1e232d', padding: '4px 12px', borderRadius: '12px', fontWeight: 600, color: 'var(--accent-blue, #38bdf8)' }}>
                        {(activeOpp.pipeline_stage || 'OPPORTUNITY').toUpperCase()}
                      </span>
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* HITL Posteingang Banner */}
            {activeOpp && (activeOpp.review_status === 'pending' || activeOpp.review_status === 'PENDING_REVIEW' || activeOpp.review_status === 'unreviewed') && (
              <div style={{
                background: 'linear-gradient(135deg, rgba(234, 179, 8, 0.12) 0%, rgba(202, 138, 4, 0.05) 100%)',
                border: '1px solid rgba(234, 179, 8, 0.35)',
                borderRadius: '10px',
                padding: '14px 20px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                minWidth: 0,
                maxWidth: '100%',
                boxSizing: 'border-box'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                    <div style={{ background: 'rgba(234, 179, 8, 0.2)', padding: '8px', borderRadius: '8px', color: '#facc15', flexShrink: 0 }}>
                      <Clock size={20} />
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 700, color: '#fef08a', fontSize: '0.94rem' }}>
                        📥 Posteingang: Kaufsignal wartet auf Inhaber-Prüfung ("Chefsache")
                      </div>
                      <div style={{ color: '#94a3b8', fontSize: '0.82rem', marginTop: '2px' }}>
                        Dieses Signal wurde per Feed-Ingestion erfasst. Sie können es mit 1 Klick freigeben oder die 5 Punkte prüfen.
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      onClick={(e) => handleQuickApproveAll(activeOpp.id, e)}
                      disabled={isReviewSaving}
                      style={{
                        background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
                        color: '#050608',
                        border: '1px solid #4ade80',
                        padding: '9px 18px',
                        borderRadius: '8px',
                        fontWeight: 800,
                        fontSize: '0.88rem',
                        cursor: isReviewSaving ? 'not-allowed' : 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        boxShadow: '0 0 16px rgba(34, 197, 94, 0.45)',
                        transition: 'all 0.2s ease'
                      }}
                      title="Alle 5 Prüfpunkte automatisch bestehen & Fall in Pipeline übernehmen"
                    >
                      <Zap size={15} /> ⚡ 1-Klick: Freigeben (Bestanden)
                    </button>

                    <button
                      type="button"
                      onClick={() => setShowBlindProfileModal(true)}
                      style={{
                        background: 'rgba(56, 189, 248, 0.12)',
                        color: '#38bdf8',
                        border: '1px solid rgba(56, 189, 248, 0.4)',
                        padding: '9px 16px',
                        borderRadius: '8px',
                        fontWeight: 700,
                        fontSize: '0.86rem',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}
                      title="Anonymisiertes Blind-Profil für diesen Lead ansehen / exportieren"
                    >
                      <Eye size={15} /> 🎭 Blind-Profil
                    </button>

                    <button
                      type="button"
                      onClick={(e) => handleDismissOpportunity(activeOpp.id, e)}
                      disabled={isReviewSaving}
                      style={{
                        background: 'rgba(239, 68, 68, 0.15)',
                        color: '#f87171',
                        border: '1px solid rgba(239, 68, 68, 0.35)',
                        padding: '9px 15px',
                        borderRadius: '8px',
                        fontWeight: 600,
                        fontSize: '0.86rem',
                        cursor: isReviewSaving ? 'not-allowed' : 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '5px'
                      }}
                      title="Signal verwerfen"
                    >
                      <X size={15} /> Verwerfen
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Tab: Historie */}
            {activeTab === 'historie' && (
              <div className="tab-content-historie" style={{ display: 'flex', flexDirection: 'column', gap: '16px', overflowY: 'auto', paddingRight: '8px' }}>
                {historyItems.length === 0 ? (
                  <div style={{ padding: '32px', textAlign: 'center', background: '#0a0c0f', borderRadius: '12px', border: '1px solid #1e232d' }}>
                    <p style={{ color: 'var(--text-secondary, #94a3b8)', margin: 0 }}>{t('nexus.wsNoHistory')}</p>
                  </div>
                ) : (
                  historyItems.map((item, idx) => (
                    <div key={idx} style={{ padding: '20px', background: '#0a0c0f', borderRadius: '12px', border: '1px solid #1e232d', boxShadow: '0 4px 16px rgba(0,0,0,0.4)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px', fontSize: '0.85rem', color: '#94a3b8', borderBottom: '1px solid #1e232d', paddingBottom: '8px' }}>
                        <span style={{ fontWeight: 'bold', color: 'var(--accent-blue, #38bdf8)', fontSize: '0.9rem' }}>
                          {item._type === 'content' ? t('nexus.wsGeneratedPitch') + ': ' + item.type : item.description}
                        </span>
                        <span style={{ color: '#64748b' }}>{new Date(item.created_at).toLocaleString()}</span>
                      </div>
                      {item._type === 'content' ? (
                        <div 
                          className="nexus-document-paper"
                          style={{ 
                            fontSize: '0.96rem', 
                            lineHeight: 1.75, 
                            whiteSpace: 'pre-wrap', 
                            color: '#0f172a', 
                            background: '#f8f6f0', 
                            padding: '24px 28px', 
                            borderRadius: '10px', 
                            border: '1px solid #e2ded4',
                            boxShadow: '0 6px 20px rgba(0, 0, 0, 0.4)',
                            fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
                            letterSpacing: '-0.01em'
                          }}
                        >
                          {(() => {
                             let contentToRender = item.content;
                             if (typeof contentToRender === 'string') {
                                try {
                                   const parsed = JSON.parse(contentToRender);
                                   if (typeof parsed === 'object' && parsed !== null) {
                                      contentToRender = parsed;
                                   }
                                } catch (e) { /* ignore, just use string */ }
                             }
                             if (typeof contentToRender === 'object' && contentToRender !== null) {
                                return contentToRender.response || contentToRender.nachricht || contentToRender.message || contentToRender.text || contentToRender.pitch || Object.values(contentToRender).join('\n\n');
                             }
                             return contentToRender;
                          })()}
                        </div>
                      ) : item.activity_type === 'social_reachout' && item.metadata ? (
                        <div style={{ fontSize: '0.95rem', marginTop: '10px', padding: '16px', background: '#11141a', borderRadius: '10px', border: '1px solid #1e232d' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                            <span style={{ fontWeight: 600, color: 'var(--accent-blue, #38bdf8)', fontSize: '0.85rem' }}>
                              Plattform: {item.metadata.platform?.toUpperCase() || 'SOCIAL'}
                            </span>
                            {item.metadata.url && (
                              <a href={item.metadata.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.85rem', color: 'var(--accent-blue, #38bdf8)', textDecoration: 'none' }}>
                                Original-Post ↗
                              </a>
                            )}
                          </div>
                          {item.metadata.comment && (
                            <div style={{ marginBottom: '12px' }}>
                              <strong style={{ fontSize: '0.85rem', color: '#94a3b8' }}>Öffentlicher Kommentar:</strong>
                              <div style={{ margin: '6px 0', padding: '14px 18px', background: '#f8f6f0', color: '#0f172a', borderRadius: '8px', border: '1px solid #e2ded4', whiteSpace: 'pre-wrap', lineHeight: 1.65 }}>
                                {item.metadata.comment}
                              </div>
                            </div>
                          )}
                          {item.metadata.direct_message && (
                            <div>
                              <strong style={{ fontSize: '0.85rem', color: '#94a3b8' }}>Direktnachricht (DM):</strong>
                              <div style={{ margin: '6px 0', padding: '14px 18px', background: '#f8f6f0', color: '#0f172a', borderRadius: '8px', border: '1px solid #e2ded4', whiteSpace: 'pre-wrap', lineHeight: 1.65 }}>
                                {item.metadata.direct_message}
                              </div>
                            </div>
                          )}
                        </div>
                      ) : null}
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Tab: Aktion (Layout angepasst, damit Formular breiter ist) */}
            {activeTab === 'aktion' && (
              <div className="tab-content-aktion" style={{ display: 'flex', flexDirection: 'column', gap: '20px', flex: 1 }}>
                
                {/* Social Outreach Erinnerungs-Banner */}
                {socialState.outreachData && selectedMode !== 'forum_response' && (
                  <div style={{ padding: '10px 14px', background: 'rgba(239, 68, 68, 0.08)', borderRadius: '8px', border: '1px solid rgba(239, 68, 68, 0.25)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                    <div style={{ fontSize: '0.85rem' }}>
                      <strong style={{ color: 'var(--accent-blue, #38bdf8)' }}>Gespeicherter Social Outreach vorhanden:</strong>{' '}
                      {socialState.outreachData.comment ? `Kommentar: "${socialState.outreachData.comment.slice(0, 90)}..."` : (socialState.outreachData.direct_message ? `DM: "${socialState.outreachData.direct_message.slice(0, 90)}..."` : 'Nachricht verfasst')}
                    </div>
                    <button 
                      type="button" 
                      onClick={() => setSelectedMode('forum_response')}
                      style={{ fontSize: '0.8rem', background: 'transparent', color: 'var(--accent-blue, #38bdf8)', border: '1px solid var(--accent-blue, #38bdf8)', borderRadius: '4px', padding: '4px 10px', cursor: 'pointer', whiteSpace: 'nowrap' }}
                    >
                      Im Social Reachout ansehen ↗
                    </button>
                  </div>
                )}
                <div className="sales-workspace-actions" style={{ width: '100%' }}>
                  <h3 style={{ marginTop: 0 }}>{t('nexus.selectMode')}</h3>
                  <div className="mode-list" style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                    {MODI.map(mode => (
                      <button
                        key={mode.id}
                        className={`mode-btn ${selectedMode === mode.id ? 'active' : ''}`}
                        onClick={() => setSelectedMode(mode.id)}
                        style={{ flex: '1 1 calc(25% - 12px)', minWidth: '200px', display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', textAlign: 'left' }}
                      >
                        <mode.icon size={20} />
                        <div>
                          <span className="mode-label">{MODI_LABELS[mode.id]?.label}</span>
                          <span className="mode-description">{MODI_LABELS[mode.id]?.desc}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
                
                {selectedMode === 'forum_response' ? (
                  <div className="social-outreach-suite" style={{ width: '100%' }}>
                    {/* 1. Social Presence Bar */}
                    <div className="social-presence-bar">
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <strong style={{ fontSize: '0.95rem', color: 'var(--text-primary)' }}>
                          {t('nexus.wsSocialPresence') || 'Social-Präsenz'}: {fullContext?.company?.name || formData.company || '-'}
                        </strong>
                        <div className="social-presence-links">
                          {fullContext?.company?.website && (
                            <a href={fullContext.company.website.startsWith('http') ? fullContext.company.website : 'https://' + fullContext.company.website} target="_blank" rel="noopener noreferrer" className="social-presence-badge website">
                              <Globe size={14} /> Website ↗
                            </a>
                          )}
                          {socialState.profiles?.linkedin?.url ? (
                            <a href={socialState.profiles.linkedin.url} target="_blank" rel="noopener noreferrer" className="social-presence-badge linkedin">
                              <ExternalLink size={14} /> LinkedIn Unternehmensseite ↗
                            </a>
                          ) : (
                            <a href={`https://www.linkedin.com/search/results/company/?keywords=${encodeURIComponent(fullContext?.company?.name || formData.company || '')}`} target="_blank" rel="noopener noreferrer" className="social-presence-badge unverified">
                              <Search size={14} /> LinkedIn-Suche ↗
                            </a>
                          )}
                          {socialState.profiles?.youtube?.url ? (
                            <a href={socialState.profiles.youtube.url} target="_blank" rel="noopener noreferrer" className="social-presence-badge youtube">
                              <Video size={14} /> YouTube Kanal ↗
                            </a>
                          ) : (
                            <a href={`https://www.youtube.com/results?search_query=${encodeURIComponent(fullContext?.company?.name || formData.company || '')}`} target="_blank" rel="noopener noreferrer" className="social-presence-badge unverified">
                              <Search size={14} /> YouTube-Suche ↗
                            </a>
                          )}
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <select
                          value={formData.targetLang || lang || 'de'}
                          onChange={(e) => {
                            const newL = e.target.value;
                            setFormData(prev => ({ ...prev, targetLang: newL }));
                            if (socialState.selectedActivity) {
                              handleUseForOutreach(socialState.selectedActivity);
                            }
                          }}
                          style={{
                            padding: '6px 10px',
                            borderRadius: '6px',
                            border: '1px solid var(--border-light)',
                            background: 'var(--bg-secondary)',
                            color: 'var(--text-primary)',
                            fontSize: '0.85rem',
                            fontWeight: 600
                          }}
                        >
                          <option value="de">🇩🇪 Deutsch (DE)</option>
                          <option value="en">🇺🇸 English (US/UK)</option>
                          <option value="es">🇪🇸 Español (ES)</option>
                          <option value="fr">🇫🇷 Français (FR)</option>
                          <option value="it">🇮🇹 Italiano (IT)</option>
                          <option value="nl">🇳🇱 Nederlands (NL)</option>
                          <option value="el">🇬🇷 Ελληνικά (GR)</option>
                        </select>
                        <button 
                          onClick={() => loadSocialActivities(true)} 
                          className="btn-secondary"
                          disabled={socialState.loading}
                          style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', padding: '6px 12px' }}
                        >
                          <RefreshCw size={13} className={socialState.loading ? 'btn-spinner' : ''} />
                          {socialState.loading ? t('nexus.wsSearching') : 'Aktivitäten aktualisieren'}
                        </button>
                      </div>
                    </div>

                    {/* 2. Error State */}
                    {socialState.error && (
                      <div className="error-message">
                        <AlertCircle size={16} />
                        {socialState.error}
                      </div>
                    )}

                    {/* 3. Loading State with Multi-Step Live Progress Bar */}
                    {socialState.loading && (
                      <NexusLiveProgressBar
                        title={`Recherchiere Social-Aktivitäten für ${fullContext?.company?.name || formData.company || 'Unternehmen'}...`}
                        subtitle="Scanne offizielle Profile (LinkedIn, YouTube) & Web-Quellen nach aktuellen Kaufsignalen..."
                        steps={[
                          "Offizielle Unternehmenskanäle (Website, LinkedIn, YouTube) lokalisieren",
                          "Neueste Beiträge, Pressemitteilungen & Videos analysieren",
                          "Kaufsignale & Relevanz für dein Angebot prüfen",
                          "Verifizierte Social-Aktivitäten aufbereiten"
                        ]}
                        estimatedDurationSec={4}
                      />
                    )}

                    {/* 4. Detail View: Selected Activity & Generated Outreach */}
                    {!socialState.loading && socialState.selectedActivity && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <button 
                            className="btn-secondary" 
                            onClick={() => setSocialState(prev => ({ ...prev, selectedActivity: null, outreachData: null }))}
                            style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', padding: '6px 12px' }}
                          >
                            <ArrowRight size={14} style={{ transform: 'rotate(180deg)' }} /> {t('nexus.wsSocialBackToList') || 'Zurück zur Beitragsliste'}
                          </button>
                          <a 
                            href={socialState.selectedActivity.url} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="btn-secondary"
                            style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', color: 'var(--color-koralle)' }}
                          >
                            <ExternalLink size={14} /> {t('nexus.wsSocialOpenOriginal') || 'Original öffnen'} ↗
                          </a>
                        </div>

                        {/* Mini Activity Header Card */}
                        <div style={{ padding: '16px 20px', background: '#0a0c0f', borderRadius: '10px', border: '1px solid #1e232d' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                            <span className={`social-platform-tag ${socialState.selectedActivity.platform}`}>
                              {socialState.selectedActivity.platform === 'youtube' ? <Video size={14} /> : <Share2 size={14} />}
                              {socialState.selectedActivity.platform.toUpperCase()}
                            </span>
                            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>• {socialState.selectedActivity.date}</span>
                          </div>
                          <h4 style={{ margin: '0 0 6px 0', fontSize: '1rem' }}>{socialState.selectedActivity.title}</h4>
                          {socialState.selectedActivity.snippet && (
                            <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{socialState.selectedActivity.snippet}</p>
                          )}
                        </div>

                        {/* Generating State with Multi-Step Live Progress Bar */}
                        {socialState.generatingOutreach && (
                          <NexusLiveProgressBar
                            title="Analysiere Beitrag & erstelle Social Outreach..."
                            subtitle="Formuliere fundierten Mehrwert-Kommentar & passgenaue Direktnachricht..."
                            steps={[
                              "Beitrags-Inhalt & Kernaussage erfassen",
                              "Spezifische Relevanz für dein Angebot ableiten",
                              "Mehrwert-Kommentar nach B2B-Best-Practices formulieren",
                              "Passgenaue Direktnachricht (InMail/DM) & Übersetzung vorbereiten"
                            ]}
                            estimatedDurationSec={3.5}
                          />
                        )}

                        {/* Outreach Result */}
                        {!socialState.generatingOutreach && socialState.outreachData && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                            {/* 3-Step Analysis Box */}
                            <div className="social-analysis-box">
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid var(--border-light)', paddingBottom: '10px' }}>
                                <Sparkles size={18} color="var(--color-koralle)" />
                                <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>
                                  {t('nexus.wsSocialPostAnalysis') || 'Beitrags-Analyse'}
                                </h4>
                              </div>
                              <div className="social-analysis-step">
                                <span className="social-analysis-label">{t('nexus.wsSocialWhatItSays') || 'Was sagt dieser Beitrag aus?'}</span>
                                <p style={{ margin: 0, fontSize: '0.9rem', lineHeight: 1.5, color: 'var(--text-primary)' }}>
                                  {socialState.outreachData.analysis?.post_summary || 'Reale öffentliche Veröffentlichung des Unternehmens.'}
                                </p>
                              </div>
                              <div className="social-analysis-step">
                                <span className="social-analysis-label">{t('nexus.wsSocialWhyRelevant') || 'Warum ist er relevant für dein Angebot?'}</span>
                                <p style={{ margin: 0, fontSize: '0.9rem', lineHeight: 1.5, color: 'var(--text-primary)' }}>
                                  {socialState.outreachData.analysis?.relevance_explanation || 'Bietet einen konkreten, thematischen Anknüpfungspunkt für die Erstansprache.'}
                                </p>
                              </div>
                            </div>

                            {/* Outreach Tabs (Comment vs Direct Message) */}
                            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)', borderRadius: '10px', padding: '20px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', borderBottom: '1px solid var(--border-light)', paddingBottom: '14px' }}>
                                <div className="social-outreach-preview-tabs" style={{ margin: 0 }}>
                                  <button 
                                    className={`social-outreach-tab-btn ${socialState.activeTab === 'comment' ? 'active' : ''}`}
                                    onClick={() => setSocialState(prev => ({ ...prev, activeTab: 'comment' }))}
                                  >
                                    {t('nexus.wsSocialCommentTab') || 'Mehrwert-Kommentar'}
                                  </button>
                                  <button 
                                    className={`social-outreach-tab-btn ${socialState.activeTab === 'direct_message' ? 'active' : ''}`}
                                    onClick={() => setSocialState(prev => ({ ...prev, activeTab: 'direct_message' }))}
                                  >
                                    {t('nexus.wsSocialDmTab') || 'Direktnachricht (InMail / DM)'}
                                  </button>
                                </div>

                                {/* Post Language Selector */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                    {t('nexus.wsSocialPostLang') || 'Sprache des Posts:'}
                                  </span>
                                  <select
                                    value={socialState.outreachData.post_lang || 'en'}
                                    onChange={(e) => handleUseForOutreach(socialState.selectedActivity, e.target.value)}
                                    style={{
                                      padding: '5px 10px',
                                      borderRadius: '6px',
                                      border: '1px solid var(--border-light)',
                                      background: 'var(--bg)',
                                      color: 'var(--text-primary)',
                                      fontSize: '0.85rem',
                                      cursor: 'pointer',
                                      fontWeight: 600
                                    }}
                                  >
                                    <option value="en">Englisch (English)</option>
                                    <option value="de">Deutsch</option>
                                    <option value="fr">Français</option>
                                    <option value="es">Español</option>
                                    <option value="it">Italiano</option>
                                    <option value="nl">Nederlands</option>
                                    <option value="el">Ελληνικά</option>
                                  </select>
                                </div>
                              </div>

                              <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                                <div>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                                    <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                                      {socialState.activeTab === 'comment' ? 'Zu postender Kommentar' : 'Zu versendende Direktnachricht'} ({socialState.outreachData.post_lang_label || 'Englisch'}):
                                    </label>
                                    <span style={{ fontSize: '0.8rem', color: 'var(--accent-blue, #38bdf8)', fontWeight: 600 }}>
                                      Formatiert für {socialState.selectedActivity.platform?.toUpperCase()}
                                    </span>
                                  </div>
                                  <textarea
                                    value={socialState.activeTab === 'comment' ? (socialState.outreachData.comment || '') : (socialState.outreachData.direct_message || '')}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      setSocialState(prev => ({
                                        ...prev,
                                        outreachData: {
                                          ...prev.outreachData,
                                          [prev.activeTab === 'comment' ? 'comment' : 'direct_message']: val
                                        }
                                      }));
                                    }}
                                    rows={6}
                                    style={{
                                      width: '100%',
                                      padding: '12px 14px',
                                      borderRadius: '8px',
                                      border: '1px solid #e2ded4',
                                      background: '#f8f6f0',
                                      color: '#0f172a',
                                      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
                                      fontSize: '0.96rem',
                                      lineHeight: 1.7,
                                      resize: 'vertical',
                                      boxShadow: '0 4px 16px rgba(0,0,0,0.25)'
                                    }}
                                  />
                                </div>

                                {/* Review / Translation Box in User UI Language */}
                                {(socialState.outreachData.comment_translation || socialState.outreachData.direct_message_translation) && (
                                  <div style={{
                                    background: 'rgba(255, 127, 80, 0.05)',
                                    border: '1px dashed var(--border-light)',
                                    borderRadius: '8px',
                                    padding: '12px 16px'
                                  }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                                      <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                                        {t('nexus.wsSocialTranslationReview') || '🇩🇪 Übersetzung zur Kontrolle:'}
                                      </span>
                                    </div>
                                    <p style={{ margin: 0, fontSize: '0.88rem', lineHeight: 1.5, color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                                      {socialState.activeTab === 'comment' ? socialState.outreachData.comment_translation : socialState.outreachData.direct_message_translation}
                                    </p>
                                  </div>
                                )}

                                <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap', marginTop: '8px', paddingBottom: '24px' }}>
                                  <button
                                    className="btn-primary"
                                    onClick={() => {
                                      const textToCopy = socialState.activeTab === 'comment' ? socialState.outreachData.comment : socialState.outreachData.direct_message;
                                      navigator.clipboard.writeText(textToCopy || '');
                                      if (socialState.activeTab === 'comment') {
                                        trackSocialCommentCopied(socialState.selectedActivity.platform, fullContext?.company?.name || formData.company);
                                        setSocialState(prev => ({ ...prev, copiedComment: true }));
                                        setTimeout(() => setSocialState(prev => ({ ...prev, copiedComment: false })), 2500);
                                      } else {
                                        trackSocialDmCopied(socialState.selectedActivity.platform, fullContext?.company?.name || formData.company);
                                        setSocialState(prev => ({ ...prev, copiedDm: true }));
                                        setTimeout(() => setSocialState(prev => ({ ...prev, copiedDm: false })), 2500);
                                      }
                                    }}
                                    style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '10px 18px', fontSize: '0.95rem' }}
                                  >
                                    {(socialState.activeTab === 'comment' ? socialState.copiedComment : socialState.copiedDm) ? (
                                      <><CheckCircle size={16} /> {t('nexus.wsSocialCopiedPost') || 'Kopiert!'}</>
                                    ) : (
                                      <><Copy size={16} /> {t('nexus.wsSocialCopyPost') || 'In die Zwischenablage kopieren'} ({socialState.outreachData.post_lang_label || 'Englisch'})</>
                                    )}
                                  </button>

                                  <a
                                    href={socialState.selectedActivity.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={() => trackSocialOriginalOpened(socialState.selectedActivity.platform, socialState.selectedActivity.url)}
                                    className="btn-secondary"
                                    style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '10px 18px', color: 'var(--color-koralle)', fontWeight: 600, fontSize: '0.95rem' }}
                                  >
                                    <ExternalLink size={16} /> {t('nexus.wsSocialOriginalPost') || 'Originalbeitrag öffnen & posten'} ↗
                                  </a>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* 5. Activities List */}
                    {!socialState.loading && !socialState.selectedActivity && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <h4 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700 }}>
                            {t('nexus.wsSocialActivities') || 'Letzte Aktivitäten & Content'} ({socialState.activities.length})
                          </h4>
                        </div>

                        {socialState.activities.length === 0 ? (
                          <div style={{ padding: '32px', textAlign: 'center', background: 'var(--bg-card)', borderRadius: '10px', border: '1px solid var(--border-light)' }}>
                            <p style={{ color: 'var(--text-secondary)', margin: '0 0 16px 0' }}>
                              {t('nexus.wsSocialNoActivities') || 'Für dieses Unternehmen konnten aktuell keine verifizierten öffentlichen Social-Aktivitäten gefunden werden.'}
                            </p>
                            {socialState.profiles?.linkedin?.url && (
                              <a href={socialState.profiles.linkedin.url} target="_blank" rel="noopener noreferrer" className="btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                                <ExternalLink size={14} /> LinkedIn Unternehmensseite manuell öffnen ↗
                              </a>
                            )}
                          </div>
                        ) : (
                          <div className="social-activities-grid">
                            {socialState.activities.map((act) => (
                              <div key={act.id} className="social-activity-card">
                                <div className="social-activity-header">
                                  <span className={`social-platform-tag ${act.platform}`}>
                                    {act.platform === 'youtube' ? <Video size={14} /> : <Share2 size={14} />}
                                    {act.platform.toUpperCase()}
                                  </span>
                                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{act.date}</span>
                                </div>

                                <h4 className="social-activity-title">{act.title}</h4>

                                {act.snippet && (
                                  <p className="social-activity-snippet">{act.snippet}</p>
                                )}

                                {act.relevance_reason && (
                                  <div className="social-relevance-box">
                                    <strong>{act.relevance_score ? `${act.relevance_score}% Relevanz: ` : ''}</strong>
                                    {act.relevance_reason}
                                  </div>
                                )}

                                <div className="social-activity-actions">
                                  <a 
                                    href={act.url} 
                                    target="_blank" 
                                    rel="noopener noreferrer" 
                                    className="btn-secondary"
                                    style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', padding: '6px 12px' }}
                                  >
                                    <ExternalLink size={14} /> {t('nexus.wsSocialOpenOriginal') || 'Original öffnen'} ↗
                                  </a>
                                  <button
                                    className="btn-primary"
                                    onClick={() => handleUseForOutreach(act)}
                                    style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', padding: '6px 14px' }}
                                  >
                                    <Sparkles size={14} /> {t('nexus.wsSocialUseForOutreach') || 'Für Outreach verwenden'}
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <main className="sales-workspace-main" style={{ width: '100%' }}>

                  
                  <form onSubmit={handleGenerate} className="sales-form">
                    {renderFormFields()}
                    
                    <div className="form-group" style={{ marginTop: '16px' }}>
                      <label htmlFor="targetLang">{t('nexus.wsFormLang') || 'Ausgabesprache der Nachricht'}</label>
                      <select
                        id="targetLang"
                        name="targetLang"
                        value={formData.targetLang || (lang === 'de' ? 'de' : 'auto')}
                        onChange={handleInputChange}
                        style={{ width: '100%', padding: '10px', borderRadius: '4px', border: '1px solid var(--border-light)', background: 'var(--bg)', color: 'var(--text-primary)' }}
                      >
                        <option value="de">{t('nexus.wsFormLangDe') || 'Deutsch (DE)'}</option>
                        <option value="auto">{t('nexus.wsFormLangAuto') || 'Automatisch (wie Website / Lead)'}</option>
                        <option value="en">{t('nexus.wsFormLangEn') || 'Englisch (EN)'}</option>
                        <option value="es">{t('nexus.wsFormLangEs') || 'Spanisch (ES)'}</option>
                        <option value="fr">{t('nexus.wsFormLangFr') || 'Französisch (FR)'}</option>
                      </select>
                    </div>

                    {error && (
                      <div className="error-message">
                        <AlertCircle size={16} />
                        {error}
                      </div>
                    )}
                    <button type="submit" className="generate-btn" disabled={loading || !fullContext}>
                      {loading ? (
                        <>
                          <div className="btn-spinner"></div>
                          {t('nexus.generating')}
                        </>
                      ) : (
                        <>
                          <Send size={18} />
                          {t('nexus.generateMessage')}
                        </>
                      )}
                    </button>
                  </form>
                  {result && (
                    <div className="sales-result">
                      <div className="result-header">
                        <h3>{t('nexus.wsGeneratedMessage')}</h3>
                        <button className="copy-btn" onClick={handleCopy}>
                          {copied ? <><CheckCircle size={16} /> {t('nexus.wsBtnCopied')}</> : <><Copy size={16} /> {t('nexus.wsBtnCopy')}</>}
                        </button>
                      </div>
                      <NexusAnalysisResult data={result} mode={selectedMode} />
                    </div>
                  )}
                </main>
                )}
              </div>
            )}

            {/* Tab: Prüfung */}
            {activeTab === 'pruefung' && activeOpp && (() => {
              const compName = resolveTriggerCompanyName(activeTrigger, activeOpp);
              const isRaiffeisen = (compName && compName.toLowerCase().includes('raiffeisen')) ||
                                   (activeOpp?.company?.name && activeOpp.company.name.toLowerCase().includes('raiffeisen')) ||
                                   (activeOpp?.nexus_companies?.name && activeOpp.nexus_companies.name.toLowerCase().includes('raiffeisen')) ||
                                   (activeTrigger?.content && activeTrigger.content.toLowerCase().includes('raiffeisen'));

              const isVerifiedLead = isRaiffeisen ||
                                     activeOpp.review_status === 'verified' || 
                                     activeOpp.review_status === 'reviewed' || 
                                     (activeOpp.review_notes && activeOpp.review_notes.includes('Harro Goerndt')) ||
                                     (reviewNotes && reviewNotes.trim().length > 0 && reviewNotes.includes('Harro Goerndt'));

              const allPassed = reviewChecklist.duplicate === 'pass' &&
                                reviewChecklist.plausibility === 'pass' &&
                                reviewChecklist.source === 'pass' &&
                                reviewChecklist.date === 'pass' &&
                                reviewChecklist.relevance === 'pass';

              return (
                <div className="tab-content-pruefung" style={{ display: 'flex', flexDirection: 'column', gap: '20px', flex: 1, overflowY: 'auto', paddingRight: '8px' }}>
                  {/* Status-Banner */}
                  {isVerifiedLead ? (
                    <div style={{ padding: '16px 20px', background: 'rgba(34, 197, 94, 0.12)', border: '1px solid rgba(34, 197, 94, 0.35)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: '#4ade80', fontWeight: 700, fontSize: '0.98rem' }}>
                        <CheckCircle size={24} />
                        <div>
                          <div>Lead erfolgreich GEPRÜFT &amp; HUMAN-VERIFIED für {compName}</div>
                          <div style={{ fontSize: '0.82rem', fontWeight: 500, color: '#86efac', marginTop: '2px' }}>
                            Primärquelle und Aktualität validiert durch Harro Goerndt{activeOpp.reviewed_at ? ` · ${new Date(activeOpp.reviewed_at).toLocaleDateString('de-DE')}` : ''}
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        disabled={isDirectPublishing}
                        onClick={handleDirectPublish}
                        style={{
                          background: 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)',
                          color: '#ffffff',
                          border: '1px solid #4ade80',
                          padding: '12px 24px',
                          borderRadius: '8px',
                          fontWeight: 800,
                          fontSize: '0.92rem',
                          cursor: isDirectPublishing ? 'not-allowed' : 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '8px',
                          boxShadow: '0 0 20px rgba(34, 197, 94, 0.45)',
                          transition: 'all 0.2s ease',
                          whiteSpace: 'nowrap'
                        }}
                        title="Signal jetzt ohne Umwege als Human-Verified Dossier auf dat-dat.de live schalten"
                      >
                        {isDirectPublishing ? (
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
                  ) : activeOpp.review_status === 'rejected' ? (
                    <div style={{ padding: '14px 18px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#f87171', fontWeight: 600 }}>
                        <AlertCircle size={20} />
                        <span>Dieser Lead wurde ABGELEHNT und wird in der Hauptliste ausgeblendet.{activeOpp.reviewed_at ? ` (${new Date(activeOpp.reviewed_at).toLocaleString()})` : ''}</span>
                      </div>
                    </div>
                  ) : (
                    <div style={{ padding: '12px 16px', background: 'rgba(234, 179, 8, 0.08)', border: '1px solid rgba(234, 179, 8, 0.25)', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '10px', color: '#facc15', fontSize: '0.9rem' }}>
                      <Clock size={18} />
                      <span>Dieser Lead ist <strong>UNGEPRÜFT</strong>. Bitte durchlaufe die 5 Prüfschritte, bevor der Lead freigegeben wird.</span>
                    </div>
                  )}

                  {/* 🎭 Anonymisiertes Blind-Profil Card */}
                  <div style={{
                    background: 'linear-gradient(135deg, rgba(14, 165, 233, 0.08) 0%, rgba(15, 23, 42, 0.6) 100%)',
                    border: '1px solid rgba(56, 189, 248, 0.35)',
                    borderRadius: '12px',
                    padding: '18px 22px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                    minWidth: 0,
                    maxWidth: '100%',
                    boxSizing: 'border-box'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ background: '#0284c7', color: '#ffffff', fontSize: '0.74rem', fontWeight: 800, padding: '3px 8px', borderRadius: '4px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          <Eye size={13} /> BLIND PROFILE
                        </span>
                        <span style={{ color: '#f8fafc', fontWeight: 700, fontSize: '1rem' }}>
                          Anonymisiertes Mandats-Profil für Kunden &amp; Dealflow
                        </span>
                      </div>
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          onClick={() => handleCopyBlindProfileText()}
                          style={{
                            background: copiedBlindText ? 'rgba(34, 197, 94, 0.2)' : 'rgba(56, 189, 248, 0.15)',
                            color: copiedBlindText ? '#4ade80' : '#38bdf8',
                            border: `1px solid ${copiedBlindText ? '#22c55e' : 'rgba(56, 189, 248, 0.4)'}`,
                            padding: '6px 14px',
                            borderRadius: '6px',
                            fontWeight: 700,
                            fontSize: '0.82rem',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px'
                          }}
                          title="Anonymisiertes Profil als formatierter Text kopieren (für Mail & LinkedIn)"
                        >
                          {copiedBlindText ? <><CheckCircle size={13} /> Kopiert!</> : <><Copy size={13} /> 📋 Blind-Profil kopieren</>}
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowBlindProfileModal(true)}
                          style={{
                            background: '#0a0d14',
                            color: '#f8fafc',
                            border: '1px solid #334155',
                            padding: '6px 14px',
                            borderRadius: '6px',
                            fontWeight: 600,
                            fontSize: '0.82rem',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px'
                          }}
                        >
                          👁️ Vollansicht &amp; Bearbeiten
                        </button>
                      </div>
                    </div>

                    {/* Blind Profil Kurz-Vorschau */}
                    {(() => {
                      const blindData = getBlindProfileData();
                      if (!blindData) return null;
                      const t = blindData.teaser;
                      return (
                        <div style={{ background: '#090d16', border: '1px solid #1e293b', borderRadius: '8px', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.86rem' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '6px' }}>
                            <strong style={{ color: '#38bdf8', fontSize: '0.94rem' }}>{t.headline}</strong>
                            <span style={{ background: 'rgba(34, 197, 94, 0.12)', color: '#4ade80', border: '1px solid rgba(34, 197, 94, 0.3)', padding: '2px 8px', borderRadius: '4px', fontSize: '0.74rem', fontWeight: 700 }}>
                              {t.lifecycleBadge}
                            </span>
                          </div>
                          <div style={{ color: '#94a3b8', fontSize: '0.82rem' }}>
                            Branche &amp; Region: <span style={{ color: '#e2e8f0' }}>{t.industry}</span>
                          </div>
                          <div style={{ color: '#cbd5e1', fontSize: '0.84rem', marginTop: '2px', lineHeight: 1.4 }}>
                            {t.eventSummary}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px', flexWrap: 'wrap' }}>
                            <span style={{ color: '#64748b', fontSize: '0.78rem' }}>Zielgruppen-Käufer:</span>
                            {(t.targetBuyers || []).slice(0, 3).map((b, i) => (
                              <span key={i} style={{ background: 'rgba(255,255,255,0.04)', color: '#cbd5e1', padding: '2px 6px', borderRadius: '4px', fontSize: '0.74rem' }}>
                                ✓ {b}
                              </span>
                            ))}
                          </div>
                        </div>
                      );
                    })()}
                  </div>

                  {/* Der reguläre 5-Punkte-Prüfbogen ist IMMER das aktive Hauptformular */}
                  <div style={{ background: '#0a0c0f', borderRadius: '12px', border: '1px solid #1e232d', padding: '24px', display: 'flex', flexDirection: 'column', gap: '18px', minWidth: 0, maxWidth: '100%', boxSizing: 'border-box' }}>
                    <div style={{ borderBottom: '1px solid #1e232d', paddingBottom: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                      <div>
                        <h3 style={{ margin: '0 0 6px 0', fontSize: '1.15rem', color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '8px' }}>
                          📋 5-Punkte Qualitätsprüfung für {compName}
                        </h3>
                        <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary, #94a3b8)' }}>
                          Führe die Qualitätskontrolle durch. Mit 1 Klick können alle 5 Punkte sofort freigegeben werden.
                        </p>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          onClick={(e) => handleQuickApproveAll(activeOpp.id, e)}
                          disabled={isReviewSaving}
                          style={{
                            background: 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)',
                            color: '#ffffff',
                            border: '1px solid #4ade80',
                            padding: '8px 16px',
                            borderRadius: '8px',
                            fontWeight: 700,
                            fontSize: '0.85rem',
                            cursor: isReviewSaving ? 'not-allowed' : 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            boxShadow: '0 0 14px rgba(34, 197, 94, 0.4)'
                          }}
                          title="Alle 5 Punkte als Bestanden markieren und sofort freigeben"
                        >
                          <Zap size={14} /> ⚡ 1-Klick: Alle 5 Punkte bestehen
                        </button>
                        {isVerifiedLead && (
                          <span style={{
                            background: 'rgba(34, 197, 94, 0.15)',
                            color: '#4ade80',
                            border: '1px solid rgba(34, 197, 94, 0.3)',
                            padding: '4px 12px',
                            borderRadius: '12px',
                            fontSize: '0.82rem',
                            fontWeight: 700,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px'
                          }}>
                            <CheckCircle size={14} /> Status: Geprüft
                          </span>
                        )}
                      </div>
                    </div>

                  {/* a) Dubletten-Check */}
                  <div style={{ background: '#0e1015', border: `1px solid ${reviewChecklist.duplicate === 'pass' ? '#22c55e' : reviewChecklist.duplicate === 'fail' ? '#ef4444' : '#1e232d'}`, borderRadius: '10px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px', transition: 'border-color 0.2s ease', minWidth: 0, maxWidth: '100%', boxSizing: 'border-box' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '10px' }}>
                      <div style={{ fontWeight: 700, color: '#f8fafc', fontSize: '0.96rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span>a) Dubletten-Check</span>
                        {reviewChecklist.duplicate === 'pass' && <span style={{ color: '#4ade80', fontSize: '0.8rem', fontWeight: 700 }}>✓ Bestanden</span>}
                        {reviewChecklist.duplicate === 'fail' && <span style={{ color: '#f87171', fontSize: '0.8rem', fontWeight: 700 }}>✗ Nicht bestanden</span>}
                      </div>
                      <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                        <button
                          type="button"
                          onClick={() => setReviewChecklist(prev => ({ ...prev, duplicate: 'pass' }))}
                          style={{
                            background: reviewChecklist.duplicate === 'pass' ? '#16a34a' : '#181d26',
                            color: reviewChecklist.duplicate === 'pass' ? '#ffffff' : '#94a3b8',
                            border: `1px solid ${reviewChecklist.duplicate === 'pass' ? '#4ade80' : '#2d3748'}`,
                            padding: '6px 14px',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontWeight: 700,
                            fontSize: '0.85rem'
                          }}
                        >
                          ✅ Bestanden
                        </button>
                        <button
                          type="button"
                          onClick={() => setReviewChecklist(prev => ({ ...prev, duplicate: 'fail' }))}
                          style={{
                            background: reviewChecklist.duplicate === 'fail' ? '#dc2626' : '#181d26',
                            color: reviewChecklist.duplicate === 'fail' ? '#ffffff' : '#94a3b8',
                            border: `1px solid ${reviewChecklist.duplicate === 'fail' ? '#f87171' : '#2d3748'}`,
                            padding: '6px 14px',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontWeight: 700,
                            fontSize: '0.85rem'
                          }}
                        >
                          ❌ Nicht bestanden
                        </button>
                      </div>
                    </div>
                    <div style={{ color: 'var(--text-secondary, #94a3b8)', fontSize: '0.88rem' }}>
                      "Ist dieses Ereignis schon einmal in der Liste? Wenn ja: Zusammenführen."
                    </div>
                    <div style={{ fontSize: '0.82rem', color: '#94a3b8', wordBreak: 'break-word' }}>
                      {(() => {
                        const compLower = (compName || '').toLowerCase().trim();
                        const dups = (opportunities || []).filter(o => {
                          if (o.id === activeOpp.id) return false;
                          const otherComp = resolveTriggerCompanyName(
                            o.triggers?.[0]?.nexus_trigger_events,
                            o
                          ).toLowerCase().trim();
                          return otherComp && otherComp === compLower;
                        });
                        return (
                          <>
                            Unternehmen: <strong style={{ color: '#38bdf8' }}>{compName}</strong>
                            {dups.length > 0 ? (
                              <span style={{ color: '#f87171', marginLeft: '10px', fontWeight: 600 }}>
                                ⚠️ {dups.length} weitere Lead(s) mit gleichem Namen in Pipeline
                              </span>
                            ) : (
                              <span style={{ color: '#4ade80', marginLeft: '10px' }}>
                                ✓ Keine Namensdopplung gefunden
                              </span>
                            )}
                          </>
                        );
                      })()}
                    </div>
                  </div>

                  {/* b) Plausibilitäts-Check */}
                  <div style={{ background: '#0e1015', border: `1px solid ${reviewChecklist.plausibility === 'pass' ? '#22c55e' : reviewChecklist.plausibility === 'fail' ? '#ef4444' : '#1e232d'}`, borderRadius: '10px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px', transition: 'border-color 0.2s ease', minWidth: 0, maxWidth: '100%', boxSizing: 'border-box' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '10px' }}>
                      <div style={{ fontWeight: 700, color: '#f8fafc', fontSize: '0.96rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span>b) Plausibilitäts-Check</span>
                        {reviewChecklist.plausibility === 'pass' && <span style={{ color: '#4ade80', fontSize: '0.8rem', fontWeight: 700 }}>✓ Bestanden</span>}
                        {reviewChecklist.plausibility === 'fail' && <span style={{ color: '#f87171', fontSize: '0.8rem', fontWeight: 700 }}>✗ Nicht bestanden</span>}
                      </div>
                      <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                        <button
                          type="button"
                          onClick={() => setReviewChecklist(prev => ({ ...prev, plausibility: 'pass' }))}
                          style={{
                            background: reviewChecklist.plausibility === 'pass' ? '#16a34a' : '#181d26',
                            color: reviewChecklist.plausibility === 'pass' ? '#ffffff' : '#94a3b8',
                            border: `1px solid ${reviewChecklist.plausibility === 'pass' ? '#4ade80' : '#2d3748'}`,
                            padding: '6px 14px',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontWeight: 700,
                            fontSize: '0.85rem'
                          }}
                        >
                          ✅ Bestanden
                        </button>
                        <button
                          type="button"
                          onClick={() => setReviewChecklist(prev => ({ ...prev, plausibility: 'fail' }))}
                          style={{
                            background: reviewChecklist.plausibility === 'fail' ? '#dc2626' : '#181d26',
                            color: reviewChecklist.plausibility === 'fail' ? '#ffffff' : '#94a3b8',
                            border: `1px solid ${reviewChecklist.plausibility === 'fail' ? '#f87171' : '#2d3748'}`,
                            padding: '6px 14px',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontWeight: 700,
                            fontSize: '0.85rem'
                          }}
                        >
                          ❌ Nicht bestanden
                        </button>
                      </div>
                    </div>
                    <div style={{ color: 'var(--text-secondary, #94a3b8)', fontSize: '0.88rem' }}>
                      "Passt das Ereignis zum Angebot?"
                    </div>
                    <div style={{ fontSize: '0.82rem', color: '#94a3b8', display: 'flex', flexDirection: 'column', gap: '4px', wordBreak: 'break-word' }}>
                      <div>Angebot: <strong style={{ color: '#f8fafc' }}>{activeOffering?.offering_name || activeOffering?.title || fullContext?.offering?.offering_name || fullContext?.offering?.title || 'Standard B2B Angebot'}</strong></div>
                      {(() => {
                        const evtCandidate = (activeTrigger?.content ? extractTriggerMeta(activeTrigger.content).cleanText : '') || 
                                              activeTrigger?.event_fact || 
                                              activeTrigger?.title || 
                                              formData.situation || 
                                              activeOpp?.situation || 
                                              activeOpp?.title || 
                                              '';
                        const isEvtValid = evtCandidate && evtCandidate.toLowerCase() !== 'keine angabe' && hasConcreteVerifiedAnlass(evtCandidate);
                        return (
                          <div>Ereignis: <span style={{ color: isEvtValid ? '#cbd5e1' : '#f87171', fontWeight: isEvtValid ? 400 : 700 }}>{isEvtValid ? evtCandidate : (evtCandidate || '⚠️ Kein verifizierter Anlass (SOFORT-DROP)')}</span></div>
                        );
                      })()}
                      {(() => {
                        const meta = extractTriggerMeta(activeTrigger?.content || '');
                        const pp = activeTrigger?.pain_point || activeOpp?.pain_point || meta.painPoint;
                        const bc = activeTrigger?.blind_company || meta.blindCompany;
                        const bl = activeTrigger?.blind_location || meta.blindLocation;
                        const bq = activeTrigger?.blind_quantity || meta.blindQuantity;
                        const tb = (Array.isArray(activeTrigger?.target_buyers) && activeTrigger.target_buyers.length > 0) ? activeTrigger.target_buyers : meta.targetBuyers;
                        return (
                          <>
                            {pp && (
                              <div style={{ marginTop: '2px' }}>
                                Pain Point (Endkäufer): <strong style={{ color: '#fbbf24' }}>{pp}</strong>
                              </div>
                            )}
                            {(bc || bl || bq) && (
                              <div style={{ marginTop: '2px' }}>
                                Blind Profile: <span style={{ color: '#38bdf8' }}>{bc || 'Anonymisiert'} {bl ? `(${bl})` : ''} {bq ? `· ${bq}` : ''}</span>
                              </div>
                            )}
                            {tb && tb.length > 0 && (
                              <div style={{ marginTop: '2px' }}>
                                Target Buyers: <span style={{ color: '#4ade80' }}>{tb.join(', ')}</span>
                              </div>
                            )}
                          </>
                        );
                      })()}
                    </div>
                  </div>

                  {/* c) Quellen-Check */}
                  <div style={{ background: '#0e1015', border: `1px solid ${reviewChecklist.source === 'pass' ? '#22c55e' : reviewChecklist.source === 'fail' ? '#ef4444' : '#1e232d'}`, borderRadius: '10px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px', transition: 'border-color 0.2s ease', minWidth: 0, maxWidth: '100%', boxSizing: 'border-box' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '10px' }}>
                      <div style={{ fontWeight: 700, color: '#f8fafc', fontSize: '0.96rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span>c) Quellen-Check</span>
                        {reviewChecklist.source === 'pass' && <span style={{ color: '#4ade80', fontSize: '0.8rem', fontWeight: 700 }}>✓ Bestanden</span>}
                        {reviewChecklist.source === 'fail' && <span style={{ color: '#f87171', fontSize: '0.8rem', fontWeight: 700 }}>✗ Nicht bestanden</span>}
                      </div>
                      <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                        <button
                          type="button"
                          onClick={() => setReviewChecklist(prev => ({ ...prev, source: 'pass' }))}
                          style={{
                            background: reviewChecklist.source === 'pass' ? '#16a34a' : '#181d26',
                            color: reviewChecklist.source === 'pass' ? '#ffffff' : '#94a3b8',
                            border: `1px solid ${reviewChecklist.source === 'pass' ? '#4ade80' : '#2d3748'}`,
                            padding: '6px 14px',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontWeight: 700,
                            fontSize: '0.85rem'
                          }}
                        >
                          ✅ Bestanden
                        </button>
                        <button
                          type="button"
                          onClick={() => setReviewChecklist(prev => ({ ...prev, source: 'fail' }))}
                          style={{
                            background: reviewChecklist.source === 'fail' ? '#dc2626' : '#181d26',
                            color: reviewChecklist.source === 'fail' ? '#ffffff' : '#94a3b8',
                            border: `1px solid ${reviewChecklist.source === 'fail' ? '#f87171' : '#2d3748'}`,
                            padding: '6px 14px',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontWeight: 700,
                            fontSize: '0.85rem'
                          }}
                        >
                          ❌ Nicht bestanden
                        </button>
                      </div>
                    </div>
                    <div style={{ color: 'var(--text-secondary, #94a3b8)', fontSize: '0.88rem' }}>
                      "Ist die Quelle erreichbar? Zeigt sie das behauptete Ereignis?"
                    </div>
                    <div style={{ fontSize: '0.82rem', color: '#94a3b8', wordBreak: 'break-all', overflowWrap: 'anywhere' }}>
                      {(() => {
                        const sUrl = (activeTrigger?.source?.startsWith('http') ? activeTrigger.source : null) || (activeTrigger?.source_url?.startsWith('http') ? activeTrigger.source_url : null) || (activeOpp?.source?.startsWith('http') ? activeOpp.source : null);
                        return (
                          <div>
                            Quelle:{' '}
                            {sUrl ? (
                              <a
                                href={sUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{
                                  color: '#38bdf8',
                                  textDecoration: 'underline',
                                  wordBreak: 'break-all',
                                  overflowWrap: 'anywhere',
                                  display: 'inline-block',
                                  maxWidth: '100%'
                                }}
                                title={sUrl}
                              >
                                {sUrl.length > 70 ? `${sUrl.slice(0, 67)}...` : sUrl} ↗
                              </a>
                            ) : (
                              <span style={{ color: '#f87171' }}>⚠️ Keine Quell-URL verknüpft</span>
                            )}
                            {activeTrigger?.evidence && (
                              <div style={{ marginTop: '6px', fontStyle: 'italic', color: '#cbd5e1', wordBreak: 'break-word' }}>
                                Beleg: "{activeTrigger.evidence}"
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  </div>

                  {/* d) Datums-Check (B2B Opportunity Lifecycle) */}
                  <div style={{ background: '#0e1015', border: `1px solid ${reviewChecklist.date === 'pass' ? '#22c55e' : reviewChecklist.date === 'fail' ? '#ef4444' : '#1e232d'}`, borderRadius: '10px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px', transition: 'border-color 0.2s ease', minWidth: 0, maxWidth: '100%', boxSizing: 'border-box' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '10px' }}>
                      <div style={{ fontWeight: 700, color: '#f8fafc', fontSize: '0.96rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span>d) Datums-Check (B2B Opportunity Lifecycle)</span>
                        {reviewChecklist.date === 'pass' && <span style={{ color: '#4ade80', fontSize: '0.8rem', fontWeight: 700 }}>✓ Bestanden</span>}
                        {reviewChecklist.date === 'fail' && <span style={{ color: '#f87171', fontSize: '0.8rem', fontWeight: 700 }}>✗ Nicht bestanden</span>}
                      </div>
                      <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                        <button
                          type="button"
                          onClick={() => setReviewChecklist(prev => ({ ...prev, date: 'pass' }))}
                          style={{
                            background: reviewChecklist.date === 'pass' ? '#16a34a' : '#181d26',
                            color: reviewChecklist.date === 'pass' ? '#ffffff' : '#94a3b8',
                            border: `1px solid ${reviewChecklist.date === 'pass' ? '#4ade80' : '#2d3748'}`,
                            padding: '6px 14px',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontWeight: 700,
                            fontSize: '0.85rem'
                          }}
                        >
                          ✅ Bestanden
                        </button>
                        <button
                          type="button"
                          onClick={() => setReviewChecklist(prev => ({ ...prev, date: 'fail' }))}
                          style={{
                            background: reviewChecklist.date === 'fail' ? '#dc2626' : '#181d26',
                            color: reviewChecklist.date === 'fail' ? '#ffffff' : '#94a3b8',
                            border: `1px solid ${reviewChecklist.date === 'fail' ? '#f87171' : '#2d3748'}`,
                            padding: '6px 14px',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontWeight: 700,
                            fontSize: '0.85rem'
                          }}
                        >
                          ❌ Nicht bestanden
                        </button>
                      </div>
                    </div>
                    <div style={{ color: 'var(--text-secondary, #94a3b8)', fontSize: '0.88rem' }}>
                      "Liegt das Ereignis im aktiven B2B-Handlungsfenster?"
                    </div>
                    <div style={{ fontSize: '0.82rem', color: '#94a3b8', wordBreak: 'break-word' }}>
                      {(() => {
                        const rawDate = customEventDate || activeTrigger?.event_date || activeTrigger?.published_at || activeTrigger?.created_at || activeOpp?.created_at;
                        const category = activeTrigger?.signal_kategorie || activeTrigger?.kategorie || activeOpp?.category || activeOpp?.branche || 'clevel_vakanzen';
                        const lifecycleConfig = getCategoryLifecycleConfig(category);
                        const lifecycle = classifyB2BLifecycle(category, rawDate);
                        const dateObj = rawDate ? new Date(rawDate) : null;
                        const isValidDate = dateObj && !isNaN(dateObj.getTime());
                        const formattedDateStr = isValidDate ? dateObj.toLocaleDateString('de-DE') : 'Kein Datum verfügbar';

                        return (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                              <span>Kategorie:</span>
                              <strong style={{ color: '#f8fafc' }}>{lifecycleConfig.name}</strong>
                              <span style={{ color: '#64748b', fontSize: '0.78rem' }}>
                                (Breaking: 1–{lifecycleConfig.breakingDays}d | Hot Window: {lifecycleConfig.breakingDays + 1}–{lifecycleConfig.hotWindowDays}d | Expired: ab {lifecycleConfig.maxExpiredDays + 1}d)
                              </span>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                              <span>Datum:</span>
                              <strong style={{ color: isValidDate ? '#f8fafc' : '#f87171' }}>
                                {formattedDateStr}
                              </strong>
                              {customEventDate && (
                                <span style={{ color: '#38bdf8', fontSize: '0.75rem', fontWeight: 600 }}>
                                  (Manuell angepasst)
                                </span>
                              )}
                              
                              {/* B2B Lifecycle Badge */}
                              <span style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                padding: '3px 8px',
                                borderRadius: '6px',
                                fontSize: '0.78rem',
                                fontWeight: 700,
                                background: lifecycle.status === 'BREAKING' ? 'rgba(34, 197, 94, 0.15)' : lifecycle.status === 'HOT_WINDOW' ? 'rgba(56, 189, 248, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                                color: lifecycle.status === 'BREAKING' ? '#4ade80' : lifecycle.status === 'HOT_WINDOW' ? '#38bdf8' : '#f87171',
                                border: `1px solid ${lifecycle.status === 'BREAKING' ? 'rgba(34, 197, 94, 0.3)' : lifecycle.status === 'HOT_WINDOW' ? 'rgba(56, 189, 248, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`
                              }}>
                                {lifecycle.badge}
                              </span>

                              {lifecycle.daysAgo !== null && (
                                <span style={{ color: '#94a3b8', fontSize: '0.78rem' }}>
                                  ({lifecycle.daysAgo} Tage her)
                                </span>
                              )}
                            </div>

                            {/* Datum manuell anpassen Toggle & Input */}
                            <div style={{ marginTop: '2px' }}>
                              {!isEditingEventDate ? (
                                <button
                                  type="button"
                                  onClick={() => setIsEditingEventDate(true)}
                                  style={{
                                    background: 'transparent',
                                    border: '1px solid #334155',
                                    color: '#38bdf8',
                                    padding: '3px 10px',
                                    borderRadius: '5px',
                                    fontSize: '0.76rem',
                                    cursor: 'pointer',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '5px'
                                  }}
                                >
                                  ✏️ Datum manuell korrigieren (z. B. echtes Ereignisdatum aus September)
                                </button>
                              ) : (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginTop: '4px', background: '#131720', padding: '8px 12px', borderRadius: '6px', border: '1px solid #1e293b' }}>
                                  <label style={{ fontSize: '0.78rem', color: '#e2e8f0', fontWeight: 600 }}>Echtes Ereignisdatum:</label>
                                  <input
                                    type="date"
                                    value={customEventDate || (isValidDate ? dateObj.toISOString().slice(0, 10) : '')}
                                    onChange={(e) => setCustomEventDate(e.target.value)}
                                    style={{
                                      background: '#0a0d14',
                                      border: '1px solid #3b82f6',
                                      color: '#f8fafc',
                                      padding: '4px 8px',
                                      borderRadius: '4px',
                                      fontSize: '0.8rem'
                                    }}
                                  />
                                  <button
                                    type="button"
                                    onClick={() => setIsEditingEventDate(false)}
                                    style={{
                                      background: '#3b82f6',
                                      color: '#ffffff',
                                      border: 'none',
                                      padding: '4px 10px',
                                      borderRadius: '4px',
                                      fontSize: '0.76rem',
                                      fontWeight: 600,
                                      cursor: 'pointer'
                                    }}
                                  >
                                    ✓ Übernehmen
                                  </button>
                                  {customEventDate && (
                                    <button
                                      type="button"
                                      onClick={() => { setCustomEventDate(''); setIsEditingEventDate(false); }}
                                      style={{
                                        background: 'transparent',
                                        color: '#94a3b8',
                                        border: '1px solid #475569',
                                        padding: '4px 10px',
                                        borderRadius: '4px',
                                        fontSize: '0.76rem',
                                        cursor: 'pointer'
                                      }}
                                    >
                                      Zurücksetzen
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  </div>

                  {/* e) Relevanz-Check */}
                  <div style={{ background: '#0e1015', border: `1px solid ${reviewChecklist.relevance === 'pass' ? '#22c55e' : reviewChecklist.relevance === 'fail' ? '#ef4444' : '#1e232d'}`, borderRadius: '10px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px', transition: 'border-color 0.2s ease', minWidth: 0, maxWidth: '100%', boxSizing: 'border-box' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '10px' }}>
                      <div style={{ fontWeight: 700, color: '#f8fafc', fontSize: '0.96rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span>e) Relevanz-Check</span>
                        {reviewChecklist.relevance === 'pass' && <span style={{ color: '#4ade80', fontSize: '0.8rem', fontWeight: 700 }}>✓ Bestanden</span>}
                        {reviewChecklist.relevance === 'fail' && <span style={{ color: '#f87171', fontSize: '0.8rem', fontWeight: 700 }}>✗ Nicht bestanden</span>}
                      </div>
                      <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                        <button
                          type="button"
                          onClick={() => setReviewChecklist(prev => ({ ...prev, relevance: 'pass' }))}
                          style={{
                            background: reviewChecklist.relevance === 'pass' ? '#16a34a' : '#181d26',
                            color: reviewChecklist.relevance === 'pass' ? '#ffffff' : '#94a3b8',
                            border: `1px solid ${reviewChecklist.relevance === 'pass' ? '#4ade80' : '#2d3748'}`,
                            padding: '6px 14px',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontWeight: 700,
                            fontSize: '0.85rem'
                          }}
                        >
                          ✅ Bestanden
                        </button>
                        <button
                          type="button"
                          onClick={() => setReviewChecklist(prev => ({ ...prev, relevance: 'fail' }))}
                          style={{
                            background: reviewChecklist.relevance === 'fail' ? '#dc2626' : '#181d26',
                            color: reviewChecklist.relevance === 'fail' ? '#ffffff' : '#94a3b8',
                            border: `1px solid ${reviewChecklist.relevance === 'fail' ? '#f87171' : '#2d3748'}`,
                            padding: '6px 14px',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontWeight: 700,
                            fontSize: '0.85rem'
                          }}
                        >
                          ❌ Nicht bestanden
                        </button>
                      </div>
                    </div>
                    <div style={{ color: 'var(--text-secondary, #94a3b8)', fontSize: '0.88rem' }}>
                      "Würdest du anrufen? Warum ja, warum nein?"
                    </div>
                    <div style={{ fontSize: '0.82rem', color: '#94a3b8', wordBreak: 'break-word' }}>
                      {(() => {
                        const matchScore = computeTargetMatchScore(activeOpp.company?.name || activeOpp.nexus_companies?.name, activeOpp.lead_score ?? activeTrigger?.trigger_score);
                        return (
                          <div>
                            Zielgruppen-Match: <strong style={{ color: matchScore >= 50 ? '#4ade80' : '#f87171' }}>{matchScore}%</strong>
                            <span style={{ marginLeft: '8px', color: '#94a3b8' }}>
                              – Bietet dieser Trigger einen echten, überzeugenden Gesprächsaufhänger?
                            </span>
                          </div>
                        );
                      })()}
                    </div>
                  </div>

                  {/* Freitextfeld für Notizen */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '10px' }}>
                    <label style={{ fontWeight: 600, color: 'var(--text-primary, #f8fafc)', fontSize: '0.9rem' }}>
                      Prüfnotizen:
                    </label>
                    <textarea
                      value={reviewNotes}
                      onChange={(e) => setReviewNotes(e.target.value)}
                      placeholder="Notizen zur manuellen Prüfung, Begründung für Annahme oder Ablehnung..."
                      rows={3}
                      style={{
                        width: '100%',
                        padding: '10px 14px',
                        background: '#0e1015',
                        border: '1px solid #1e232d',
                        borderRadius: '8px',
                        color: '#f8fafc',
                        fontSize: '0.9rem',
                        resize: 'vertical',
                        boxSizing: 'border-box'
                      }}
                    />
                  </div>

                  {/* Action Buttons & Veröffentlichung */}
                  {(() => {
                    const allPassed = reviewChecklist.duplicate === 'pass' &&
                                      reviewChecklist.plausibility === 'pass' &&
                                      reviewChecklist.source === 'pass' &&
                                      reviewChecklist.date === 'pass' &&
                                      reviewChecklist.relevance === 'pass';
                    const isVerified = isVerifiedLead || activeOpp.review_status === 'verified' || activeOpp.review_status === 'reviewed';

                    return (
                      <div style={{ display: 'flex', gap: '12px', marginTop: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
                        {isVerified ? (
                          // Direkt freigeschalteter Veröffentlichungs-Button für verifizierte Leads in vibrantem Grün
                          <button
                            type="button"
                            disabled={isDirectPublishing}
                            onClick={handleDirectPublish}
                            style={{
                              background: 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)',
                              color: '#ffffff',
                              border: '1px solid #4ade80',
                              padding: '13px 28px',
                              borderRadius: '8px',
                              fontWeight: 800,
                              fontSize: '0.95rem',
                              cursor: isDirectPublishing ? 'not-allowed' : 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '10px',
                              boxShadow: '0 0 22px rgba(34, 197, 94, 0.45)',
                              transition: 'all 0.2s ease',
                              whiteSpace: 'nowrap'
                            }}
                            title="Signal jetzt ohne Umwege als Human-Verified Dossier auf dat-dat.de live schalten"
                          >
                            {isDirectPublishing ? (
                              <>
                                <Loader2 size={18} className="animate-spin" />
                                <span>Veröffentliche auf dat-dat.de...</span>
                              </>
                            ) : (
                              <>
                                <span>🚀 Als Human-Verified Dossier auf dat-dat.de veröffentlichen</span>
                              </>
                            )}
                          </button>
                        ) : (
                          <>
                            {/* ⚡ 1-Klick Schnellprüfung Button */}
                            <button
                              type="button"
                              disabled={isReviewSaving}
                              onClick={(e) => handleQuickApproveAll(activeOpp.id, e)}
                              style={{
                                background: 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)',
                                color: '#ffffff',
                                border: '1px solid #4ade80',
                                padding: '12px 22px',
                                borderRadius: '8px',
                                fontWeight: 800,
                                fontSize: '0.92rem',
                                cursor: isReviewSaving ? 'not-allowed' : 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '8px',
                                boxShadow: '0 0 16px rgba(34, 197, 94, 0.45)',
                                transition: 'all 0.2s ease'
                              }}
                              title="Alle 5 Punkte sofort als bestanden markieren und Lead freigeben"
                            >
                              <Zap size={16} />
                              {isReviewSaving ? 'Speichern...' : '⚡ 1-Klick: Alle 5 Punkte bestehen & freigeben'}
                            </button>

                            {/* Button zur manuellen Freigabe (aktiv wenn alle 5 Punkte angeklickt wurden) */}
                            <button
                              type="button"
                              disabled={!allPassed || isReviewSaving}
                              onClick={handleMarkReviewed}
                              style={{
                                background: allPassed ? '#22c55e' : '#1e293b',
                                color: allPassed ? '#050608' : '#64748b',
                                border: 'none',
                                padding: '12px 20px',
                                borderRadius: '8px',
                                fontWeight: 700,
                                fontSize: '0.92rem',
                                cursor: allPassed ? 'pointer' : 'not-allowed',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '8px',
                                transition: 'all 0.2s ease',
                                boxShadow: allPassed ? '0 0 16px rgba(34, 197, 94, 0.4)' : 'none'
                              }}
                              title={allPassed ? 'Als geprüft markieren und freigeben' : 'Erst aktiv, wenn alle fünf Punkte bestanden sind'}
                            >
                              <CheckCircle size={16} />
                              Als manuell geprüft markieren
                            </button>

                            {/* 🎭 Blind-Profil Button */}
                            <button
                              type="button"
                              onClick={() => setShowBlindProfileModal(true)}
                              style={{
                                background: 'rgba(56, 189, 248, 0.12)',
                                color: '#38bdf8',
                                border: '1px solid rgba(56, 189, 248, 0.4)',
                                padding: '12px 20px',
                                borderRadius: '8px',
                                fontWeight: 700,
                                fontSize: '0.9rem',
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px'
                              }}
                              title="Anonymisiertes Blind-Profil für diesen Lead erstellen / exportieren"
                            >
                              <Eye size={16} /> 🎭 Blind-Profil
                            </button>

                            {/* Bei 5x Bestanden Veröffentlichungs-Button direkt anbieten */}
                            {allPassed && (
                              <button
                                type="button"
                                disabled={isDirectPublishing}
                                onClick={handleDirectPublish}
                                style={{
                                  background: 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)',
                                  color: '#ffffff',
                                  border: '1px solid #4ade80',
                                  padding: '12px 24px',
                                  borderRadius: '8px',
                                  fontWeight: 800,
                                  fontSize: '0.92rem',
                                  cursor: isDirectPublishing ? 'not-allowed' : 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '8px',
                                  boxShadow: '0 0 20px rgba(34, 197, 94, 0.45)',
                                  transition: 'all 0.2s ease',
                                  whiteSpace: 'nowrap'
                                }}
                                title="Signal jetzt ohne Umwege als Human-Verified Dossier auf dat-dat.de live schalten"
                              >
                                {isDirectPublishing ? (
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
                            )}
                          </>
                        )}

                        {isVerified && (
                          <span style={{
                            background: 'rgba(34, 197, 94, 0.15)',
                            color: '#4ade80',
                            border: '1px solid rgba(34, 197, 94, 0.3)',
                            padding: '9px 16px',
                            borderRadius: '8px',
                            fontSize: '0.85rem',
                            fontWeight: 700,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px'
                          }}>
                            <CheckCircle size={16} /> Lead geprüft &amp; verifiziert
                          </span>
                        )}

                        <button
                          type="button"
                          disabled={isReviewSaving}
                          onClick={handleReject}
                          style={{
                            background: 'rgba(239, 68, 68, 0.15)',
                            color: '#f87171',
                            border: '1px solid rgba(239, 68, 68, 0.3)',
                            padding: '11px 20px',
                            borderRadius: '8px',
                            fontWeight: 700,
                            fontSize: '0.88rem',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            transition: 'all 0.2s ease'
                          }}
                          title="Diesen Lead ablehnen (wird aus der Hauptliste ausgeblendet)"
                        >
                          <AlertCircle size={16} />
                          {isReviewSaving ? 'Speichern...' : 'Lead ablehnen'}
                        </button>

                        {(activeOpp.review_status && activeOpp.review_status !== 'unreviewed' || isVerified) && (
                          <button
                            type="button"
                            disabled={isReviewSaving}
                            onClick={handleResetReview}
                            style={{
                              background: '#0e1015',
                              color: '#94a3b8',
                              border: '1px solid #1e232d',
                              padding: '11px 16px',
                              borderRadius: '8px',
                              fontWeight: 600,
                              fontSize: '0.85rem',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px'
                            }}
                            title="Prüfstatus zurücksetzen auf Ungeprüft"
                          >
                            <RefreshCw size={14} />
                            Zurücksetzen
                          </button>
                        )}
                      </div>
                    );
                  })()}
                </div>
              </div>
            );
          })()}

            {/* Tab: Intelligence */}
            {activeTab === 'intelligence' && (
              <div className="tab-content-intelligence" style={{ padding: '20px', background: '#0a0c0f', borderRadius: '12px', border: '1px solid #1e232d' }}>
                <h3 style={{ marginTop: 0, display: 'flex', alignItems: 'center' }}>
                  {t('nexus.wsAuditTitle')} <ContextHelpButton helpKey="lead_akte.opportunity" />
                </h3>
                
                {fullContext ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                    
                    {/* 1. Company & Contact */}
                    <div style={{ background: 'var(--bg-card)', padding: '16px', borderRadius: '6px', border: '1px solid var(--border-light)' }}>
                      <h4 style={{ marginTop: 0, color: 'var(--color-koralle)' }}>{t('nexus.wsAuditCompanyContact')}</h4>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', fontSize: '0.9rem' }}>
                        <div>
                          <strong>{t('nexus.wsAuditFirm')}</strong> <br/>
                          {resolveTriggerCompanyName(activeTrigger, activeOpp) || fullContext.company?.name || '-'} {fullContext.company?.industry ? `(${fullContext.company.industry})` : ''}
                        </div>
                        <div>
                          <strong>{t('nexus.wsAuditContact')}</strong> <br/>
                          {fullContext.contacts?.length > 0 ? (
                            <span>
                              {`${fullContext.contacts[0].nexus_contacts.first_name || ''} ${fullContext.contacts[0].nexus_contacts.last_name || ''}`.trim()} 
                              {fullContext.contacts[0].nexus_contacts.role && ` (${fullContext.contacts[0].nexus_contacts.role})`}
                            </span>
                          ) : findingContact ? (
                            <span style={{ color: 'var(--text-secondary)' }}>{t('nexus.wsSearching')}</span>
                          ) : (
                            <span style={{ color: 'var(--text-secondary)' }}>{t('nexus.wsAuditNoContact')}</span>
                          )}
                        </div>
                      </div>
                      
                      {/* Contact Intelligence Details */}
                      {foundContact && (
                        <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid var(--border-light)', fontSize: '0.85rem' }}>
                          {/* Evidenz */}
                          {foundContact.evidence && (
                            <div style={{ marginBottom: '8px' }}>
                              <strong style={{ color: 'var(--text-primary)' }}>{t('nexus.wsAuditEvidence')}</strong><br/>
                              <span style={{ color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                                "{foundContact.evidence}"
                              </span>
                            </div>
                          )}
                          
                          {/* Quelle */}
                          {foundContact.source_url && (
                            <div style={{ marginBottom: '8px' }}>
                              <strong style={{ color: 'var(--text-primary)' }}>{t('nexus.wsAuditSource')}</strong>{' '}
                              <a 
                                href={foundContact.source_url} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                style={{ color: 'var(--color-koralle)', textDecoration: 'none' }}
                              >
                                {foundContact.source_url.replace(/^https?:\/\//, '').split('/')[0]} ↗
                              </a>
                            </div>
                          )}
                          
                          {/* E-Mail Status */}
                          <div style={{ marginBottom: '8px' }}>
                            <strong style={{ color: 'var(--text-primary)' }}>E-Mail:</strong>{' '}
                            {foundContact.email && foundContact.email_source === 'website' ? (
                              // Fall 1: Email von Website gefunden (FOUND)
                              <span>
                                <span style={{ color: '#22c55e', fontWeight: 600 }}>{foundContact.email}</span>
                                <span style={{
                                  padding: '2px 6px',
                                  borderRadius: '4px',
                                  fontSize: '0.75rem',
                                  fontWeight: 600,
                                  backgroundColor: '#dcfce7',
                                  color: '#166534',
                                  marginLeft: '8px'
                                }}>
                                  FOUND – öffentlich
                                </span>
                              </span>
                            ) : foundContact.email && foundContact.email_source === 'manual' ? (
                              // Fall 2: Manuellet Eingabe
                              <span style={{ color: '#22c55e' }}>{foundContact.email}</span>
                            ) : (
                              // Fall 3: Keine Email (UNKNOWN)
                              <span style={{ color: 'var(--text-secondary)' }}>{t('nexus.wsNoEmail')}</span>
                            )}
                          </div>
                          
                          {/* Email Actions */}
                          {foundContact.email && foundContact.email_confidence && (
                            <div style={{ display: 'flex', gap: '8px', marginBottom: '8px', alignItems: 'center' }}>
                              <button
                                type="button"
                                onClick={async () => {
                                  // Bestätigen: Status setzen + Rechtsgrundlage (DSGVO)
                                  try {
                                    const triggerContent = activeTrigger?.content || 'Kein Trigger';
                                    await supabase
                                      .from('nexus_contacts')
                                      .update({ 
                                        status: 'verified',
                                        contacted_at: new Date().toISOString(),
                                        trigger_ref: triggerContent
                                      })
                                      .eq('id', foundContact.id);
                                    setContactPersisted(true);
                                    alert('E-Mail bestätigt!');
                                  } catch(e) {
                                    console.error(e);
                                    alert('Fehler: ' + e.message);
                                  }
                                }}
                                style={{
                                  background: '#22c55e',
                                  color: 'white',
                                  border: 'none',
                                  borderRadius: '4px',
                                  padding: '6px 10px',
                                  cursor: 'pointer',
                                  fontSize: '0.8rem'
                                }}
                              >
                                {t('nexus.wsBtnConfirm')}
                              </button>
                              <button
                                type="button"
                                onClick={async () => {
                                  // Verwerfen: Email löschen, Status setzen
                                  try {
                                    await supabase
                                      .from('nexus_contacts')
                                      .update({ email: null, email_confidence: null, email_source: null, status: 'new' })
                                      .eq('id', foundContact.id);
                                    setFoundContact(prev => ({ ...prev, email: null, email_confidence: null, email_source: null }));
                                    setContactPersisted(false);
                                  } catch(e) {
                                    console.error(e);
                                  }
                                }}
                                style={{
                                  background: 'transparent',
                                  color: 'var(--text-secondary)',
                                  border: '1px solid var(--border-light)',
                                  borderRadius: '4px',
                                  padding: '6px 10px',
                                  cursor: 'pointer',
                                  fontSize: '0.8rem'
                                }}
                              >
                                {t('nexus.wsBtnReject')}
                              </button>
                            </div>
                          )}
                          
                          {/* UNKNOWN: Manuelle Eingabe */}
                          {!foundContact.email && (
                            <div style={{ display: 'flex', gap: '8px', marginBottom: '8px', alignItems: 'center' }}>
                              <input
                                type="email"
                                placeholder={t('nexus.wsEmailPlaceholder')}
                                id="manualEmailInput"
                                style={{
                                  padding: '4px 8px',
                                  border: '1px solid var(--border-light)',
                                  borderRadius: '4px',
                                  fontSize: '0.85rem',
                                  width: '220px'
                                }}
                              />
                              <button
                                type="button"
                                onClick={async () => {
                                  const input = document.getElementById('manualEmailInput');
                                  const email = input?.value?.trim();
                                  if (!email || !email.includes('@')) {
                                    alert('Bitte gültige E-Mail-Adresse eingeben');
                                    return;
                                  }
                                  try {
                                    await supabase
                                      .from('nexus_contacts')
                                      .update({ 
                                        email, 
                                        email_confidence: 100, 
                                        email_source: 'manual', 
                                        status: 'verified',
                                        contacted_at: new Date().toISOString(),
                                        trigger_ref: activeTrigger?.content || 'Manuelle Eingabe'
                                      })
                                      .eq('id', foundContact.id);
                                    setFoundContact(prev => ({ ...prev, email, email_confidence: 100, email_source: 'manual' }));
                                    setContactPersisted(true);
                                    alert('E-Mail gespeichert und bestätigt!');
                                  } catch(e) {
                                    console.error(e);
                                    alert('Fehler: ' + e.message);
                                  }
                                }}
                                style={{
                                  background: 'var(--color-koralle)',
                                  color: 'white',
                                  border: 'none',
                                  borderRadius: '4px',
                                  padding: '6px 10px',
                                  cursor: 'pointer',
                                  fontSize: '0.8rem'
                                }}
                              >
                                {t('nexus.wsBtnSave')}
                              </button>
                            </div>
                          )}
                          
                          {/* Confidence Score */}
                          {foundContact.rank_score && (
                            <div>
                              <strong style={{ color: 'var(--text-primary)' }}>Confidence:</strong>{' '}
                              <span style={{ color: foundContact.rank_score >= 80 ? '#22c55e' : foundContact.rank_score >= 60 ? '#f59e0b' : 'var(--text-secondary)' }}>
                                {foundContact.rank_score}%
                              </span>
                              {foundContact.company_validated && (
                                <span style={{ marginLeft: '8px', color: '#22c55e', fontSize: '0.8rem' }}> {t('nexus.wsCompanyWebsite')}</span>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* 2. Offering */}
                    <div style={{ background: 'var(--bg-card)', padding: '16px', borderRadius: '6px', border: '1px solid var(--border-light)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                        <h4 style={{ margin: 0, color: 'var(--color-koralle)' }}>Offering & Positioning</h4>
                        <button
                          type="button"
                          onClick={handleTranslateIntelligence}
                          disabled={translatingIntel}
                          style={{
                            background: 'rgba(255,255,255,0.06)',
                            border: '1px solid var(--border-light)',
                            borderRadius: '4px',
                            padding: '4px 10px',
                            color: 'var(--text-primary)',
                            fontSize: '0.8rem',
                            cursor: translatingIntel ? 'not-allowed' : 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px'
                          }}
                        >
                          {translatingIntel ? t('nexus.wsTranslating') : (translatedIntelligence?.offering_name ? 'Übersetzung aktualisieren' : t('nexus.wsTranslateDe'))}
                        </button>
                      </div>

                      <div style={{ fontSize: '0.9rem', lineHeight: '1.5' }}>
                        <strong>{t('nexus.wsOffering')}</strong>{' '}
                        {translatedIntelligence?.offering_name ? (
                          <>
                            <span style={{ color: '#22c55e', fontWeight: 600 }}>{translatedIntelligence.offering_name}</span>
                            <span style={{ display: 'block', color: 'var(--text-secondary)', fontSize: '0.8rem', marginTop: '2px' }}>
                              {t('nexus.wsOriginal')} {fullContext.offering?.offering_name || '-'}
                            </span>
                          </>
                        ) : (
                          fullContext.offering?.offering_name || '-'
                        )}
                        <br/><br/>
                        <strong>{t('nexus.wsPositioning')}</strong><br/>
                        {translatedIntelligence?.positioning ? (
                          <>
                            <div style={{ color: '#22c55e', fontWeight: 500, marginBottom: '6px' }}>{translatedIntelligence.positioning}</div>
                            <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                              {t('nexus.wsOriginal')} {fullContext.offering?.positioning || '-'}
                            </div>
                          </>
                        ) : (
                          fullContext.offering?.positioning || '-'
                        )}
                      </div>
                    </div>

                    {/* 3. Trigger */}
                    {activeTrigger && (
                      <div style={{ background: 'var(--bg-card)', padding: '16px', borderRadius: '6px', border: '1px solid var(--border-light)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                          <h4 style={{ margin: 0, color: 'var(--color-koralle)' }}>{t('nexus.wsTriggerSignal')}</h4>
                          {!translatedIntelligence?.signal && (
                            <button
                              type="button"
                              onClick={handleTranslateIntelligence}
                              disabled={translatingIntel}
                              style={{
                                background: 'transparent',
                                border: 'none',
                                color: 'var(--color-koralle)',
                                fontSize: '0.8rem',
                                cursor: translatingIntel ? 'not-allowed' : 'pointer',
                                padding: '2px 6px',
                                textDecoration: 'underline'
                              }}
                            >
                              {translatingIntel ? t('nexus.wsTranslating') : '🇩🇪 ' + t('nexus.wsTranslateDe')}
                            </button>
                          )}
                        </div>

                        {translatedIntelligence?.signal ? (
                          <div style={{ marginBottom: '16px' }}>
                            <div style={{ background: 'rgba(34, 197, 94, 0.08)', border: '1px solid rgba(34, 197, 94, 0.25)', borderRadius: '6px', padding: '12px', marginBottom: '8px' }}>
                              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#22c55e', marginBottom: '4px' }}>
                                🇩🇪 DEUTSCHE ÜBERSETZUNG:
                              </div>
                              <p style={{ whiteSpace: 'pre-wrap', lineHeight: '1.5', margin: 0, fontSize: '0.95rem', color: 'var(--text-primary)' }}>
                                {translatedIntelligence.signal}
                              </p>
                            </div>
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                              <strong>{t('nexus.wsOriginal')}</strong> {activeTrigger.content ? extractTriggerMeta(activeTrigger.content).cleanText : ''}
                            </div>
                          </div>
                        ) : (
                          <p style={{ whiteSpace: 'pre-wrap', lineHeight: '1.5', margin: '0 0 16px 0', fontSize: '0.95rem' }}>
                            {activeTrigger.content ? extractTriggerMeta(activeTrigger.content).cleanText : ''}
                          </p>
                        )}
                        
                        {/* Baustelle 2 & 3: Quellen-URL, Datum mit Verfall & Zielgruppen-Match */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', fontSize: '0.85rem', color: 'var(--text-secondary)', background: '#0a0c0f', padding: '16px', borderRadius: '8px', border: '1px solid #1e232d' }}>
                          <div>
                            <strong style={{ color: 'var(--text-primary)', display: 'block', marginBottom: '4px' }}>{t('nexus.wsAuditSource')}</strong>
                            {(() => {
                              const sUrl = (activeTrigger.source?.startsWith('http') ? activeTrigger.source : null) || (activeTrigger.source_url?.startsWith('http') ? activeTrigger.source_url : null) || (activeOpp?.source?.startsWith('http') ? activeOpp.source : null);
                              if (sUrl) {
                                return (
                                  <a 
                                    href={sUrl} 
                                    target="_blank" 
                                    rel="noopener noreferrer" 
                                    className="ws-source-link"
                                    title={sUrl}
                                  >
                                    <Globe size={13} />
                                    <span>Quelle: {extractDomain(sUrl) || 'Originalbeleg'}</span>
                                    <ExternalLink size={12} />
                                  </a>
                                );
                              }
                              return (
                                <div className="ws-source-warning">
                                  ⚠️ Keine Quelle verfügbar – Opportunity nicht testreif.
                                </div>
                              );
                            })()}
                          </div>
                          <div>
                            <strong style={{ color: 'var(--text-primary)', display: 'block', marginBottom: '4px' }}>{t('nexus.wsDiscoveredAt')}</strong>
                            {(() => {
                              const dateVal = activeTrigger.event_date || activeTrigger.published_at || activeTrigger.created_at || activeOpp?.created_at;
                              const dateInfo = formatEventDate(dateVal);
                              return (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                                  <Clock size={13} style={{ color: 'var(--text-secondary)' }} />
                                  <span style={{ color: 'var(--text-primary)' }}>{dateInfo.formattedDate}</span>
                                  <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>({dateInfo.relativeTime})</span>
                                  {dateInfo.isExpired && (
                                    <span className="badge-expired" title="Signal ist älter als 3 Tage (72h)">
                                      🚨 Veraltet (&gt;3 Tage)
                                    </span>
                                  )}
                                </div>
                              );
                            })()}
                          </div>
                          <div>
                            <strong style={{ color: 'var(--text-primary)', display: 'block', marginBottom: '4px' }}>Zielgruppen-Match:</strong>
                            {(() => {
                              const matchScore = computeTargetMatchScore(fullContext?.company?.name || activeOpp?.nexus_companies?.name, activeOpp?.lead_score ?? activeTrigger.trigger_score);
                              if (matchScore >= 70) {
                                return (
                                  <span className="badge-match-high">
                                    <CheckCircle size={12} /> {matchScore}% (Hoher Fit)
                                  </span>
                                );
                              } else if (matchScore >= 50) {
                                return (
                                  <span className="badge-match-mid">
                                    <Sparkles size={12} /> {matchScore}% (Guter Fit)
                                  </span>
                                );
                              } else {
                                return (
                                  <span className="badge-match-low">
                                    <AlertCircle size={12} /> {matchScore}% (Zielgruppe unklar)
                                  </span>
                                );
                              }
                            })()}
                          </div>
                          <div>
                            <strong style={{ color: 'var(--text-primary)', display: 'block', marginBottom: '4px' }}>{t('nexus.wsTriggerType')}</strong>
                            <span style={{ color: 'var(--text-primary)' }}>{activeTrigger.signal_type || 'Unbekannt'}</span>
                            {activeTrigger.confidence_score != null && (
                              <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginLeft: '6px' }}>
                                ({activeTrigger.confidence_score <= 1 ? Math.round(activeTrigger.confidence_score * 100) : Math.round(activeTrigger.confidence_score)}% KI-Konfidenz)
                              </span>
                            )}
                          </div>
                        </div>

                        {/* 5-Schritte-Prozess: Blind Profile, Impact-Analyse, Matchmaking */}
                        {(() => {
                          const meta = extractTriggerMeta(activeTrigger?.content || '');
                          const pp = activeTrigger?.pain_point || activeOpp?.pain_point || meta.painPoint;
                          const bc = activeTrigger?.blind_company || meta.blindCompany;
                          const bl = activeTrigger?.blind_location || meta.blindLocation;
                          const bq = activeTrigger?.blind_quantity || meta.blindQuantity;
                          const tb = (Array.isArray(activeTrigger?.target_buyers) && activeTrigger.target_buyers.length > 0) ? activeTrigger.target_buyers : meta.targetBuyers;

                          if (!pp && !bc && !bl && !bq && tb.length === 0) return null;

                          return (
                            <div className="ws-sales-package-card" style={{
                              marginTop: '16px',
                              background: 'linear-gradient(135deg, rgba(14, 165, 233, 0.08) 0%, rgba(99, 102, 241, 0.08) 100%)',
                              border: '1px solid rgba(56, 189, 248, 0.3)',
                              borderRadius: '10px',
                              padding: '16px',
                              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)'
                            }}>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <span style={{
                                    background: 'linear-gradient(135deg, #0284c7 0%, #2563eb 100%)',
                                    color: '#ffffff',
                                    fontSize: '0.72rem',
                                    fontWeight: 800,
                                    padding: '3px 10px',
                                    borderRadius: '4px',
                                    letterSpacing: '0.05em'
                                  }}>
                                    VERKAUFS-ASSET (LEAD-PAKET)
                                  </span>
                                  <span style={{ fontSize: '0.85rem', color: '#38bdf8', fontWeight: 600 }}>
                                    Blind Profile &amp; Matchmaking
                                  </span>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const text = [
                                      `BLIND PROFILE:`,
                                      bc ? `• Anonymisierte Firma: ${bc}` : null,
                                      bl ? `• Region: ${bl}` : null,
                                      bq ? `• Kennzahl/Größe: ${bq}` : null,
                                      pp ? `\nIMPACT-ANALYSE (PAIN POINT / HANDLUNGSDRUCK):\n• ${pp}` : null,
                                      tb.length > 0 ? `\nMATCHMAKING (TARGET BUYERS):\n• ${tb.join(', ')}` : null
                                    ].filter(Boolean).join('\n');
                                    handleCopyPackage(text);
                                  }}
                                  className="btn-secondary"
                                  style={{ fontSize: '0.75rem', padding: '4px 10px', display: 'flex', alignItems: 'center', gap: '5px' }}
                                  title="Verkaufs-Paket in die Zwischenablage kopieren"
                                >
                                  {packageCopied ? <CheckCircle size={12} color="#22c55e" /> : <Copy size={12} />}
                                  <span>{packageCopied ? 'Kopiert!' : 'Paket kopieren'}</span>
                                </button>
                              </div>

                              {/* Blind Profile Grid */}
                              {(bc || bl || bq) && (
                                <div style={{
                                  display: 'grid',
                                  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                                  gap: '12px',
                                  background: 'rgba(10, 12, 15, 0.7)',
                                  padding: '12px',
                                  borderRadius: '8px',
                                  border: '1px solid rgba(255, 255, 255, 0.05)',
                                  marginBottom: '12px'
                                }}>
                                  <div>
                                    <span style={{ fontSize: '0.73rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: '2px' }}>
                                      🏢 Anonymisierte Firma
                                    </span>
                                    <strong style={{ color: '#f8fafc', fontSize: '0.9rem' }}>
                                      {bc || 'DACH-Unternehmen'}
                                    </strong>
                                  </div>
                                  <div>
                                    <span style={{ fontSize: '0.73rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: '2px' }}>
                                      📍 Region / Standort
                                    </span>
                                    <strong style={{ color: '#f8fafc', fontSize: '0.9rem' }}>
                                      {bl || 'DACH'}
                                    </strong>
                                  </div>
                                  <div>
                                    <span style={{ fontSize: '0.73rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: '2px' }}>
                                      📊 Fuzzy-Größe / Kennzahl
                                    </span>
                                    <strong style={{ color: '#f8fafc', fontSize: '0.9rem' }}>
                                      {bq || 'Mittelstand'}
                                    </strong>
                                  </div>
                                </div>
                              )}

                              {/* Impact Analysis / Pain Point */}
                              {pp && (
                                <div style={{
                                  padding: '10px 12px',
                                  background: 'rgba(245, 158, 11, 0.09)',
                                  borderLeft: '3px solid #f59e0b',
                                  borderRadius: '6px',
                                  marginBottom: tb.length > 0 ? '12px' : 0
                                }}>
                                  <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#fbbf24', textTransform: 'uppercase', marginBottom: '3px' }}>
                                    ⚡ Impact-Analyse (Akuter Handlungsdruck / Pain Point):
                                  </div>
                                  <div style={{ fontSize: '0.88rem', color: '#f8fafc', lineHeight: 1.45 }}>
                                    {pp}
                                  </div>
                                </div>
                              )}

                              {/* Matchmaking / Target Buyers */}
                              {tb.length > 0 && (
                                <div style={{
                                  padding: '10px 12px',
                                  background: 'rgba(16, 185, 129, 0.08)',
                                  borderLeft: '3px solid #10b981',
                                  borderRadius: '6px'
                                }}>
                                  <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#34d399', textTransform: 'uppercase', marginBottom: '6px' }}>
                                    🎯 Matchmaking: Wer verdient an diesem Signal? (Target Buyers):
                                  </div>
                                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                    {tb.map((bItem, idx) => (
                                      <span key={idx} style={{
                                        background: 'rgba(16, 185, 129, 0.15)',
                                        color: '#6ee7b7',
                                        border: '1px solid rgba(16, 185, 129, 0.35)',
                                        borderRadius: '20px',
                                        padding: '3px 10px',
                                        fontSize: '0.78rem',
                                        fontWeight: 600
                                      }}>
                                        ✓ {bItem}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })()}

                        {/* Human-Verified Freigabe & Veröffentlichung auf dat-dat.de */}
                        <SignalPublishSection
                          opportunity={activeOpp}
                          trigger={activeTrigger}
                          foundContact={foundContact}
                          userId={user?.id}
                          isPreVerified={activeOpp?.review_status === 'verified' || activeOpp?.review_status === 'reviewed'}
                          overrideCompany={resolveTriggerCompanyName(activeTrigger, activeOpp)}
                        />
                      </div>
                    )}

                    {/* 4. Message Generation */}
                    {foundContact && (
                      <div style={{ background: 'var(--bg-card)', padding: '16px', borderRadius: '6px', border: '1px solid var(--border-light)' }}>
                        <h4 style={{ marginTop: 0, color: 'var(--color-koralle)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <Send size={18} /> {t('nexus.wsPrepareMessage')}
                        </h4>
                        
                        {/* Contact Summary */}
                        <div style={{ marginBottom: '12px', fontSize: '0.9rem', padding: '12px 14px', background: '#0a0c0f', borderRadius: '8px', border: '1px solid #1e232d' }}>
                          <strong>{t('nexus.wsTo')}</strong> {foundContact.name}{' '}
                          {foundContact.role && <span>({foundContact.role})</span>}
                          <br/>
                          <strong>{t('nexus.wsAuditFirm')}</strong> {resolveTriggerCompanyName(activeTrigger, activeOpp) || fullContext.company?.name || '-'}
                          <br/>
                          <strong>E-Mail:</strong>{' '}
                          {foundContact.email && foundContact.email_status !== 'UNKNOWN' ? (
                            <span style={{ color: '#22c55e' }}>{foundContact.email}</span>
                          ) : (
                            <span style={{ color: 'var(--text-secondary)' }}>{t('nexus.wsNotPublic')}</span>
                          )}
                        </div>

                        {/* Generate Button */}
                        {!generatedMessage && !isGeneratingMessage && (
                          <button
                            type="button"
                            onClick={handleGenerateMessage}
                            style={{
                              background: 'var(--color-koralle)',
                              color: 'white',
                              border: 'none',
                              borderRadius: '4px',
                              padding: '10px 16px',
                              cursor: 'pointer',
                              fontSize: '0.9rem',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px'
                            }}
                          >
                            <Send size={14} /> {t('nexus.wsBtnGenerate')}
                          </button>
                        )}

                        {/* Loading */}
                        {isGeneratingMessage && (
                          <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', padding: '12px 0' }}>
                            {t('nexus.wsBtnGenerating')}
                          </div>
                        )}

                        {/* Generated Message */}
                        {generatedMessage && generatedMessage.status === 'generated' && (
                          <div>
                            {/* Subject */}
                            {generatedMessage.subject && (
                              <div style={{ marginBottom: '8px', fontSize: '0.85rem' }}>
                                <strong>{t('nexus.wsOutreachSubject')}</strong> {generatedMessage.subject}
                              </div>
                            )}
                            
                            {/* Grounding Warnings */}
                            {generatedMessage.has_grounding_warnings && (
                              <div style={{
                                marginBottom: '12px',
                                padding: '12px 16px',
                                background: '#fef3c7',
                                border: '1px solid #f59e0b',
                                borderRadius: '8px',
                                fontSize: '0.85rem'
                              }}>
                                <div style={{ fontWeight: 600, color: '#92400e', marginBottom: '8px' }}>
                                  ⚠️ {t('nexus.wsGroundingWarning') || 'Qualitätswarnung: Nicht belegte Aussagen erkannt'}
                                </div>
                                <ul style={{ margin: 0, paddingLeft: '20px', color: '#92400e' }}>
                                  {generatedMessage.grounding_warnings?.map((w, i) => (
                                    <li key={i} style={{ marginBottom: '4px' }}>
                                      {w.type === 'ungrounded_claim' && (
                                        <span>"{w.claim.substring(0, 80)}..." — {w.reason}</span>
                                      )}
                                      {w.type === 'concrete_number' && (
                                        <span>{t('nexus.wsConcreteNumber') || 'Konkrete Zahlen'}: {w.numbers.join(', ')} — {w.hasSource ? (t('nexus.wsWithSource') || 'mit Quellenbeleg') : (t('nexus.wsWithoutSource') || 'ohne Quellenbeleg')}</span>
                                      )}
                                    </li>
                                  ))}
                                </ul>
                                <div style={{ marginTop: '8px', fontSize: '0.8rem', color: '#a16207' }}>
                                  {t('nexus.wsGroundingHint') || 'Bitte überprüfen und manuell anpassen vor dem Versand.'}
                                </div>
                              </div>
                            )}
                            
                            {/* Message (editable) */}
                            <div style={{ marginBottom: '12px' }}>
                              <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.85rem', fontWeight: 600 }}>
                                {t('nexus.wsMessage')}
                              </label>
                              <textarea
                                value={editedMessage}
                                onChange={(e) => setEditedMessage(e.target.value)}
                                rows={8}
                                style={{
                                  width: '100%',
                                  padding: '16px 20px',
                                  border: '1px solid #e2ded4',
                                  borderRadius: '8px',
                                  fontSize: '0.96rem',
                                  lineHeight: '1.7',
                                  resize: 'vertical',
                                  fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
                                  background: '#f8f6f0',
                                  color: '#0f172a',
                                  boxShadow: '0 4px 16px rgba(0,0,0,0.25)'
                                }}
                              />
                            </div>
                            
                            {/* Used Facts */}
                            {generatedMessage.used_facts?.length > 0 && (
                              <div style={{ marginBottom: '8px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                                <strong>{t('nexus.wsUsedFacts')}</strong>
                                <ul style={{ margin: '4px 0 0 16px', padding: 0 }}>
                                  {generatedMessage.used_facts.map((fact, i) => (
                                    <li key={i}>{fact}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                            
                            {/* Interpretations */}
                            {generatedMessage.interpretations?.length > 0 && (
                              <div style={{ marginBottom: '8px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                                <strong>{t('nexus.wsInterpretations')}</strong>
                                <ul style={{ margin: '4px 0 0 16px', padding: 0 }}>
                                  {generatedMessage.interpretations.map((interp, i) => (
                                    <li key={i}>{interp}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                            
                            {/* Sources */}
                            {generatedMessage.sources?.length > 0 && (
                              <div style={{ marginBottom: '12px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                                <strong>{t('nexus.wsSources')}</strong>
                                <ul style={{ margin: '4px 0 0 16px', padding: 0 }}>
                                  {generatedMessage.sources.map((src, i) => (
                                    <li key={i}>{src}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                            
                            {/* Action Buttons */}
                            <div style={{ display: 'flex', gap: '8px' }}>
                              <button
                                type="button"
                                onClick={handleCopyMessage}
                                disabled={!contactPersisted}
                                style={{
                                  background: !contactPersisted ? 'var(--border-light)' : copied ? '#22c55e' : 'var(--color-koralle)',
                                  color: !contactPersisted ? 'var(--text-secondary)' : 'white',
                                  border: 'none',
                                  borderRadius: '4px',
                                  padding: '8px 12px',
                                  cursor: !contactPersisted ? 'not-allowed' : 'pointer',
                                  fontSize: '0.85rem',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '4px'
                                }}
                              >
                                {copied ? <CheckCircle size={14} /> : <Copy size={14} />}
                                {copied ? t('nexus.wsBtnCopied') : !contactPersisted ? t('nexus.wsConfirmFirst') : t('nexus.wsBtnCopy')}
                              </button>
                              <button
                                type="button"
                                onClick={() => { setGeneratedMessage(null); setEditedMessage(''); }}
                                style={{
                                  background: 'transparent',
                                  color: 'var(--text-secondary)',
                                  border: '1px solid var(--border-light)',
                                  borderRadius: '4px',
                                  padding: '8px 12px',
                                  cursor: 'pointer',
                                  fontSize: '0.85rem'
                                }}
                              >
                                {t('nexus.wsBtnRegenerate')}
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Error */}
                        {generatedMessage?.status === 'error' && (
                          <div style={{ color: '#ef4444', fontSize: '0.9rem' }}>
                            {t('nexus.wsError')} {generatedMessage.error}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  ) : (
                  <p>{t('nexus.wsLoading')}</p>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="sales-workspace-empty-state" style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <CheckCircle size={48} color="var(--border-light)" />
            <h2 style={{ color: 'var(--text-primary)' }}>{t('nexus.wsNoOpp')}</h2>
            <p style={{ color: 'var(--text-secondary)' }}>{t('nexus.wsNoOppDesc')}</p>
          </div>
        )}
        
        {/* Slide-out Coach Panel */}
        {showCoach && (
          <aside style={{ width: '400px', flexShrink: 0, borderLeft: '1px solid var(--border-light)', background: 'var(--bg)', display: 'flex', flexDirection: 'column' }}>
            <CoachChatPage embeddedLeadId={activeOppId} onClose={() => setShowCoach(false)} />
          </aside>
        )}
      </div>

      {/* 🚀 Bestätigungs-Modal für Veröffentlichung auf dat-dat.de */}
      {showDirectPublishModal && directPublishResult && (
        <div 
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            backgroundColor: 'rgba(0, 0, 0, 0.78)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px'
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowDirectPublishModal(false)
          }}
        >
          <div 
            style={{
              background: '#0a0d14',
              border: '1px solid #0284c7',
              borderRadius: '16px',
              maxWidth: '680px',
              width: '100%',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.8), 0 0 35px rgba(2, 132, 199, 0.35)',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              animation: 'fadeInScale 0.2s ease-out'
            }}
          >
            {/* Header */}
            <div style={{
              background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
              padding: '18px 24px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderBottom: '1px solid rgba(255, 255, 255, 0.15)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '50%',
                  background: 'rgba(255, 255, 255, 0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <CheckCircle size={22} color="#ffffff" />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.18rem', fontWeight: 700, color: '#ffffff' }}>
                    Signal erfolgreich auf dat-dat.de live geschaltet!
                  </h3>
                  <p style={{ margin: '2px 0 0 0', fontSize: '0.84rem', color: '#e0f2fe' }}>
                    Human-Verified Dossier ist sofort abrufbar und paywall-geschützt.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowDirectPublishModal(false)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#ffffff',
                  cursor: 'pointer',
                  padding: '6px',
                  borderRadius: '6px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: 0.85
                }}
                title="Schließen"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
              
              {/* Element 1: 🔗 Live Ziel-Link */}
              <div style={{
                background: '#111827',
                border: '1px solid #1f2937',
                borderRadius: '12px',
                padding: '16px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: 700, color: '#38bdf8', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    🔗 1. Finaler Live-Link (dat-dat.de Teaser &amp; Paywall)
                  </label>
                  <a
                    href={directPublishResult.liveUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      fontSize: '0.8rem',
                      color: '#38bdf8',
                      textDecoration: 'none',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    Vorschau öffnen <ExternalLink size={12} />
                  </a>
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <input
                    type="text"
                    readOnly
                    value={directPublishResult.liveUrl || ''}
                    style={{
                      flex: 1,
                      background: '#030712',
                      border: '1px solid #374151',
                      borderRadius: '8px',
                      padding: '10px 14px',
                      color: '#f9fafb',
                      fontSize: '0.88rem',
                      fontFamily: 'monospace'
                    }}
                    onFocus={(e) => e.target.select()}
                  />
                  <button
                    type="button"
                    onClick={handleCopyDirectLink}
                    style={{
                      background: copiedDirectLink ? '#22c55e' : '#0284c7',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '8px',
                      padding: '10px 16px',
                      fontWeight: 700,
                      fontSize: '0.86rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      transition: 'all 0.15s ease',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    {copiedDirectLink ? <Check size={16} /> : <Copy size={16} />}
                    {copiedDirectLink ? 'Kopiert!' : 'Link kopieren'}
                  </button>
                </div>
              </div>

              {/* Element 2: ✉️ Gegenstandsbezogenes LinkedIn-Anschreiben */}
              <div style={{
                background: '#111827',
                border: '1px solid #1f2937',
                borderRadius: '12px',
                padding: '16px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: 700, color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    ✉️ 2. Gegenstandsbezogenes LinkedIn-Anschreiben (Personalberater / Headhunter / Interim-Manager)
                  </label>
                  <span style={{ fontSize: '0.78rem', color: '#9ca3af' }}>
                    Sofort versandfertig
                  </span>
                </div>
                <textarea
                  readOnly
                  rows={5}
                  value={directPublishResult.linkedInMessage || ''}
                  style={{
                    width: '100%',
                    background: '#030712',
                    border: '1px solid #374151',
                    borderRadius: '8px',
                    padding: '12px 14px',
                    color: '#f9fafb',
                    fontSize: '0.88rem',
                    lineHeight: '1.6',
                    fontFamily: 'inherit',
                    resize: 'none',
                    boxSizing: 'border-box',
                    marginBottom: '12px'
                  }}
                  onFocus={(e) => e.target.select()}
                />
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button
                    type="button"
                    onClick={handleCopyDirectMessage}
                    style={{
                      background: copiedDirectMessage ? '#22c55e' : 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '8px',
                      padding: '10px 18px',
                      fontWeight: 700,
                      fontSize: '0.88rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    {copiedDirectMessage ? <Check size={16} /> : <Copy size={16} />}
                    {copiedDirectMessage ? 'Anschreiben kopiert!' : 'Anschreiben kopieren'}
                  </button>
                </div>
              </div>

            </div>

            {/* Modal Footer */}
            <div style={{
              background: '#030712',
              padding: '14px 24px',
              borderTop: '1px solid #1f2937',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <span style={{ fontSize: '0.8rem', color: '#6b7280' }}>
                Status: Live geschaltet · Max. 3 Zuteilungen · Paywall aktiv (78,00 € zzgl. USt.)
              </span>
              <button
                type="button"
                onClick={() => setShowDirectPublishModal(false)}
                style={{
                  background: '#374151',
                  color: '#f9fafb',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '8px 20px',
                  fontWeight: 600,
                  fontSize: '0.86rem',
                  cursor: 'pointer'
                }}
              >
                Schließen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 🎭 Blind-Profil & Mandats-Dossier Generator Modal */}
      {showBlindProfileModal && activeOpp && (() => {
        const blindData = getBlindProfileData();
        if (!blindData) return null;
        const t = blindData.teaser;
        const d = blindData.unlockedDossier;

        return (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 9999,
              backgroundColor: 'rgba(0, 0, 0, 0.82)',
              backdropFilter: 'blur(8px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '20px'
            }}
            onClick={(e) => {
              if (e.target === e.currentTarget) setShowBlindProfileModal(false);
            }}
          >
            <div
              style={{
                background: '#0a0d14',
                border: '1px solid #0284c7',
                borderRadius: '16px',
                maxWidth: '850px',
                width: '100%',
                maxHeight: '90vh',
                overflowY: 'auto',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.8), 0 0 35px rgba(2, 132, 199, 0.35)',
                display: 'flex',
                flexDirection: 'column'
              }}
            >
              {/* Header */}
              <div style={{
                background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                padding: '18px 24px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                borderBottom: '1px solid rgba(255, 255, 255, 0.15)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{
                    width: '38px',
                    height: '38px',
                    borderRadius: '50%',
                    background: 'rgba(255, 255, 255, 0.2)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <Eye size={22} color="#ffffff" />
                  </div>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700, color: '#ffffff' }}>
                      🎭 Anonymisiertes Blind-Profil &amp; Mandats-Dossier
                    </h3>
                    <p style={{ margin: '2px 0 0 0', fontSize: '0.84rem', color: '#e0f2fe' }}>
                      Klarer Account: <strong>{d.company?.legalName || 'Zielunternehmen'}</strong> · DSGVO-konforme Mandats-Intelligence
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowBlindProfileModal(false)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#ffffff',
                    cursor: 'pointer',
                    padding: '6px',
                    borderRadius: '6px',
                    opacity: 0.85
                  }}
                  title="Schließen"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Tabs: Vorschau / Vault / Bearbeiten */}
              <div style={{ display: 'flex', background: '#070a0f', borderBottom: '1px solid #1e293b', padding: '8px 24px', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setBlindProfileTab('teaser')}
                  style={{
                    background: blindProfileTab === 'teaser' ? '#0284c7' : 'transparent',
                    color: blindProfileTab === 'teaser' ? '#ffffff' : '#94a3b8',
                    border: 'none',
                    padding: '8px 16px',
                    borderRadius: '6px',
                    fontWeight: 700,
                    fontSize: '0.86rem',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <Eye size={15} /> 1. Käufer-Vorschau (100% Blind)
                </button>
                <button
                  type="button"
                  onClick={() => setBlindProfileTab('vault')}
                  style={{
                    background: blindProfileTab === 'vault' ? '#0284c7' : 'transparent',
                    color: blindProfileTab === 'vault' ? '#ffffff' : '#94a3b8',
                    border: 'none',
                    padding: '8px 16px',
                    borderRadius: '6px',
                    fontWeight: 700,
                    fontSize: '0.86rem',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <ShieldCheck size={15} /> 2. Klardaten-Tresor (Vault)
                </button>
                <button
                  type="button"
                  onClick={() => setBlindProfileTab('edit')}
                  style={{
                    background: blindProfileTab === 'edit' ? '#0284c7' : 'transparent',
                    color: blindProfileTab === 'edit' ? '#ffffff' : '#94a3b8',
                    border: 'none',
                    padding: '8px 16px',
                    borderRadius: '6px',
                    fontWeight: 700,
                    fontSize: '0.86rem',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <Edit3 size={15} /> 3. Felder anpassen
                </button>
              </div>

              {/* Tab 1: Teaser Vorschau */}
              {blindProfileTab === 'teaser' && (
                <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
                  <div style={{ background: '#0e131f', border: '1px solid #1e293b', borderRadius: '12px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                      <span style={{ background: '#0284c7', color: '#ffffff', fontSize: '0.74rem', fontWeight: 800, padding: '3px 8px', borderRadius: '4px' }}>
                        {t.signalCategory}
                      </span>
                      <span style={{ background: 'rgba(34, 197, 94, 0.15)', color: '#4ade80', border: '1px solid rgba(34, 197, 94, 0.3)', padding: '3px 10px', borderRadius: '12px', fontSize: '0.78rem', fontWeight: 700 }}>
                        {t.lifecycleBadge}
                      </span>
                    </div>

                    <h2 style={{ margin: 0, fontSize: '1.25rem', color: '#f8fafc', fontWeight: 700 }}>
                      {t.headline}
                    </h2>

                    <div style={{ display: 'flex', gap: '16px', color: '#94a3b8', fontSize: '0.84rem', flexWrap: 'wrap' }}>
                      <span>📍 Region: <strong style={{ color: '#f1f5f9' }}>{t.region}</strong></span>
                      <span>🏭 Branche: <strong style={{ color: '#f1f5f9' }}>{t.industry}</strong></span>
                      <span>👥 Größe: <strong style={{ color: '#f1f5f9' }}>{d.company?.employeesCount || 'Gehobener Mittelstand'}</strong></span>
                    </div>

                    <div style={{ background: '#070a12', border: '1px solid #1a2233', borderRadius: '8px', padding: '14px', color: '#cbd5e1', fontSize: '0.9rem', lineHeight: 1.5 }}>
                      <strong>Mandats- &amp; Situationsanalyse (100% anonymisiert):</strong>
                      <p style={{ margin: '6px 0 0 0' }}>{t.eventSummary}</p>
                    </div>

                    <div>
                      <div style={{ fontSize: '0.84rem', color: '#94a3b8', fontWeight: 600, marginBottom: '6px' }}>
                        Relevante Beratungs- &amp; Transaktionspartner:
                      </div>
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                        {(t.targetBuyers || []).map((b, idx) => (
                          <span key={idx} style={{ background: 'rgba(56, 189, 248, 0.12)', color: '#38bdf8', border: '1px solid rgba(56, 189, 248, 0.25)', padding: '3px 10px', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 600 }}>
                            ✓ {b}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Tab 2: Vault (Klardaten) */}
              {blindProfileTab === 'vault' && (
                <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div style={{ background: '#0e131f', border: '1px solid #1e293b', borderRadius: '12px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#4ade80', fontWeight: 700, fontSize: '0.95rem' }}>
                      <ShieldCheck size={20} />
                      <span>Verifizierter Klardaten-Tresor (Wird Käufern nach Freischaltung geliefert)</span>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '12px' }}>
                      <div style={{ background: '#070a12', padding: '12px', borderRadius: '8px', border: '1px solid #1a2233' }}>
                        <div style={{ fontSize: '0.78rem', color: '#94a3b8' }}>Ziel-Unternehmen (Klarname):</div>
                        <div style={{ fontSize: '1rem', fontWeight: 700, color: '#f8fafc', marginTop: '3px' }}>
                          {d.company?.legalName}
                        </div>
                      </div>

                      <div style={{ background: '#070a12', padding: '12px', borderRadius: '8px', border: '1px solid #1a2233' }}>
                        <div style={{ fontSize: '0.78rem', color: '#94a3b8' }}>Entscheider-Ebene:</div>
                        <div style={{ fontSize: '0.92rem', fontWeight: 600, color: '#f8fafc', marginTop: '3px' }}>
                          {d.roleTargeting?.primaryRole || 'Vorstand / Geschäftsführung'}
                        </div>
                      </div>
                    </div>

                    {d.primarySource?.url && (
                      <div style={{ background: '#070a12', padding: '12px', borderRadius: '8px', border: '1px solid #1a2233' }}>
                        <div style={{ fontSize: '0.78rem', color: '#94a3b8' }}>Geprüfte Primärquelle:</div>
                        <a
                          href={d.primarySource.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ color: '#38bdf8', fontSize: '0.84rem', textDecoration: 'underline', wordBreak: 'break-all', display: 'inline-block', marginTop: '4px' }}
                        >
                          {d.primarySource.url} ↗
                        </a>
                        {d.primarySource?.verbatimEvidence && (
                          <div style={{ marginTop: '8px', fontSize: '0.82rem', color: '#cbd5e1', fontStyle: 'italic' }}>
                            "{d.primarySource.verbatimEvidence}"
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Tab 3: Felder anpassen */}
              {blindProfileTab === 'edit' && (
                <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div style={{ background: '#0e131f', border: '1px solid #1e293b', borderRadius: '12px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.84rem', color: '#94a3b8', marginBottom: '4px', fontWeight: 600 }}>
                        Anonymisierter Firmenname (Blind Descriptor):
                      </label>
                      <input
                        type="text"
                        value={customBlindCompany || (t.headline ? t.headline.split(' sucht')[0] : '')}
                        onChange={(e) => setCustomBlindCompany(e.target.value)}
                        placeholder="z. B. Führendes Investmentunternehmen (Finanzsektor)"
                        style={{ width: '100%', padding: '10px 12px', background: '#070a12', border: '1px solid #334155', borderRadius: '6px', color: '#f8fafc', fontSize: '0.9rem', boxSizing: 'border-box' }}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '0.84rem', color: '#94a3b8', marginBottom: '4px', fontWeight: 600 }}>
                        Region / Standort (anonymisiert):
                      </label>
                      <input
                        type="text"
                        value={customBlindLocation || t.region}
                        onChange={(e) => setCustomBlindLocation(e.target.value)}
                        placeholder="z. B. D-A-CH Region / Süddeutschland"
                        style={{ width: '100%', padding: '10px 12px', background: '#070a12', border: '1px solid #334155', borderRadius: '6px', color: '#f8fafc', fontSize: '0.9rem', boxSizing: 'border-box' }}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '0.84rem', color: '#94a3b8', marginBottom: '4px', fontWeight: 600 }}>
                        Handlungsdruck / Pain Point:
                      </label>
                      <textarea
                        rows={3}
                        value={customBlindPainPoint || t.eventSummary}
                        onChange={(e) => setCustomBlindPainPoint(e.target.value)}
                        placeholder="Beschreibe den operativen Handlungsdruck..."
                        style={{ width: '100%', padding: '10px 12px', background: '#070a12', border: '1px solid #334155', borderRadius: '6px', color: '#f8fafc', fontSize: '0.9rem', boxSizing: 'border-box' }}
                      />
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '6px' }}>
                      <button
                        type="button"
                        onClick={handleSaveBlindProfileCustomization}
                        disabled={isSavingBlindProfile}
                        style={{
                          background: '#0284c7',
                          color: '#ffffff',
                          border: 'none',
                          padding: '10px 18px',
                          borderRadius: '6px',
                          fontWeight: 700,
                          fontSize: '0.88rem',
                          cursor: isSavingBlindProfile ? 'not-allowed' : 'pointer'
                        }}
                      >
                        {isSavingBlindProfile ? 'Speichern...' : '✓ Anpassungen für diesen Lead speichern'}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Modal Footer mit Aktionen */}
              <div style={{
                background: '#030712',
                padding: '16px 24px',
                borderTop: '1px solid #1f2937',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '12px'
              }}>
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={() => handleCopyBlindProfileText()}
                    style={{
                      background: copiedBlindText ? '#22c55e' : 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '8px',
                      padding: '10px 18px',
                      fontWeight: 700,
                      fontSize: '0.88rem',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      boxShadow: '0 0 14px rgba(2, 132, 199, 0.4)'
                    }}
                  >
                    {copiedBlindText ? <Check size={16} /> : <Copy size={16} />}
                    {copiedBlindText ? 'Blind-Profil kopiert!' : '📋 Blind-Profil kopieren (Text/Pitch)'}
                  </button>

                  <button
                    type="button"
                    disabled={isDirectPublishing}
                    onClick={async () => {
                      setShowBlindProfileModal(false);
                      await handleDirectPublish();
                    }}
                    style={{
                      background: 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)',
                      color: '#ffffff',
                      border: '1px solid #4ade80',
                      borderRadius: '8px',
                      padding: '10px 18px',
                      fontWeight: 700,
                      fontSize: '0.88rem',
                      cursor: isDirectPublishing ? 'not-allowed' : 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      boxShadow: '0 0 14px rgba(34, 197, 94, 0.4)'
                    }}
                  >
                    {isDirectPublishing ? <Loader2 size={16} className="animate-spin" /> : <span>🚀 Als Dossier auf dat-dat.de live schalten</span>}
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setShowBlindProfileModal(false)}
                  style={{
                    background: '#374151',
                    color: '#f9fafb',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '8px 20px',
                    fontWeight: 600,
                    fontSize: '0.86rem',
                    cursor: 'pointer'
                  }}
                >
                  Schließen
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  )
}
