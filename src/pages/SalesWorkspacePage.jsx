import React, { useState, useEffect } from 'react'
import { Briefcase, Mail, MessageSquare, Send, Copy, CheckCircle, AlertCircle, List, Trash2, ArrowRight, Search, Share2, ExternalLink, Video, Globe, Sparkles, RefreshCw } from 'lucide-react'
import { callNexusAI, runDeepResearch, callContactIntelligence, callMessageGeneration, callSocialIntelligence } from '../lib/nexus-ai'
import NexusAnalysisResult from '../components/NexusAnalysisResult'
import { useLead } from '../context/LeadContext'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import * as db from '../lib/nexus-db'
import { useLanguage } from '../i18n/translations.jsx'
import CoachChatPage from './CoachChatPage'
import NexusLiveProgressBar from '../components/NexusLiveProgressBar'
import { ContextHelpButton } from '../context/GuideContext'
import './SalesWorkspacePage.css'

const MODI = [
  { id: 'sales_pitch', label: 'Sales Pitch', icon: Send, description: 'Persönliche Erstnachricht' },
  { id: 'follow_up', label: 'Follow-Up', icon: Mail, description: 'Nachfass-Nachricht' },
  { id: 'einwandbehandlung', label: 'Einwandbehandlung', icon: MessageSquare, description: 'Auf Einwände reagieren' },
  { id: 'forum_response', label: 'Social Outreach', icon: Share2, description: 'LinkedIn / YouTube / Foren' }
]

import { useNavigate, useSearchParams } from 'react-router-dom'

export default function SalesWorkspacePage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const oppIdFromUrl = searchParams.get('opportunityId')
  const { t, lang } = useLanguage()
  const { user } = useAuth()
  const { opportunities, triggers, deleteOpportunity } = useLead()
  
  const [selectedMode, setSelectedMode] = useState('sales_pitch')
  const [activeOppId, setActiveOppId] = useState(oppIdFromUrl || null)
  const [activeTab, setActiveTab] = useState('aktion') // 'historie', 'aktion', 'intelligence'

  useEffect(() => {
    if (oppIdFromUrl && oppIdFromUrl !== activeOppId) {
      setActiveOppId(oppIdFromUrl)
    }
  }, [oppIdFromUrl])
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
  const [findingContact, setFindingContact] = useState(false)
  const [isResearching, setIsResearching] = useState(false)
  const [foundContact, setFoundContact] = useState(null) // Speichert den gefundenen Kontakt für Bestätigung
  const [contactPersisted, setContactPersisted] = useState(false) // true nur wenn DB-Save erfolgreich war
  const [generatedMessage, setGeneratedMessage] = useState(null) // Generierte Nachricht
  const [isGeneratingMessage, setIsGeneratingMessage] = useState(false) // Nachricht wird generiert
  const [editedMessage, setEditedMessage] = useState('')

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

          const companyName = ctx.company?.name || '';
          const industry = ctx.company?.industry || '';
          
          // Finde neuesten Trigger
          const latestTrigger = ctx.triggers?.length > 0 ? ctx.triggers[0].nexus_trigger_events : null;
          setActiveTrigger(latestTrigger);

          // Prüfe, ob es schon einen Kontakt gibt
          let contactName = '';
          const existingContact = ctx.contacts?.length > 0 ? ctx.contacts[0].nexus_contacts : null;

          if (existingContact) {
             const fullName = `${existingContact.first_name || ''} ${existingContact.last_name || ''}`.trim();
             contactName = `${fullName}${existingContact.role ? ` (${existingContact.role})` : ''}`;
             setFoundContact(existingContact);
          }

          setFormData(prev => ({
            ...prev,
            company: companyName,
            branche: industry,
            situation: latestTrigger ? latestTrigger.content : '',
            ansprechpartner: contactName,
            targetLang: lang || 'de',
            einwand: ''
          }));
          
          setResult(null);
          setActiveTab('aktion');

          // Auto-Übersetzung für fremdsprachige Leads (z.B. Uruguay/Spanisch), wenn der Nutzer auf Deutsch arbeitet
          const isForeign = /\b(de|la|el|en|y|que|los|las|por|con|para|una|un|es|del|al|empresa|innovación|desarrollo|soluciones|crecimiento|financiamiento|adquisición|nueva|nuevo|sede|sociedad|productos)\b/i.test((latestTrigger?.content || '') + ' ' + (ctx.offering?.positioning || ''));
          if (isForeign && (lang || 'de') === 'de') {
            handleTranslateIntelligence(ctx, latestTrigger);
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
      const resultData = await callNexusAI({
        mode: selectedMode,
        lang: lang,
        targetLang: formData.targetLang || 'auto',
        ...formData,
        full_context: {
          opportunity: fullContext || null,
          research: fullContext?.research || [],
          offering: fullContext?.offering ? { name: fullContext.offering.offering_name, positioning: fullContext.offering.positioning } : null,
          triggers: fullContext?.triggers ? fullContext.triggers.map(t => t.nexus_trigger_events).filter(Boolean) : (latestTrigger ? [latestTrigger] : []),
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
              <label htmlFor="situation">{t('nexus.situationContext')}</label>
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
          <div className="queue-list">
            {opportunities && opportunities.length > 0 ? (
              opportunities.map(opp => (
                <div 
                  key={opp.id} 
                  className={`queue-item ${activeOppId === opp.id ? 'active' : ''}`}
                  onClick={() => setActiveOppId(opp.id)}
                  style={{ cursor: 'pointer' }}
                >
                  <div className="queue-item-content">
                    <h4>{opp.nexus_companies?.name || 'Unbekanntes Unternehmen'}</h4>
                    <span className="queue-stage">{opp.pipeline_stage}</span>
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
              ))
            ) : (
              <div className="queue-empty">
                {t('nexus.noLeads')}
              </div>
            )}
          </div>
        </aside>

        {/* CRM Dashboard: Wird nur angezeigt, wenn ein Lead (oder Manuell) aktiv ist */}
        {activeOppId || formData.company ? (
          <div className="sales-workspace-crm" style={{ display: 'flex', flexDirection: 'column', flex: 1, gap: '20px' }}>
            {/* Tabs & Status */}
            <div className="crm-header-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-light)', paddingBottom: '8px' }}>
              <div className="crm-tabs" style={{ display: 'flex', gap: '8px' }}>
                <button 
                  className={`tab-btn ${activeTab === 'historie' ? 'active' : ''}`} 
                  onClick={() => setActiveTab('historie')}
                  style={{ background: activeTab === 'historie' ? 'var(--color-koralle)' : 'transparent', color: activeTab === 'historie' ? 'white' : 'var(--text-primary)', border: 'none', padding: '8px 16px', borderRadius: '4px', cursor: 'pointer', fontWeight: 600 }}
                >
                  {t('nexus.wsTabHistory')}
                </button>
                <button 
                  className={`tab-btn ${activeTab === 'aktion' ? 'active' : ''}`} 
                  onClick={() => setActiveTab('aktion')}
                  style={{ background: activeTab === 'aktion' ? 'var(--color-koralle)' : 'transparent', color: activeTab === 'aktion' ? 'white' : 'var(--text-primary)', border: 'none', padding: '8px 16px', borderRadius: '4px', cursor: 'pointer', fontWeight: 600 }}
                >
                  {t('nexus.wsTabPitch')}
                </button>
                <button 
                  className={`tab-btn ${activeTab === 'intelligence' ? 'active' : ''}`} 
                  onClick={() => setActiveTab('intelligence')}
                  style={{ background: activeTab === 'intelligence' ? 'var(--color-koralle)' : 'transparent', color: activeTab === 'intelligence' ? 'white' : 'var(--text-primary)', border: 'none', padding: '8px 16px', borderRadius: '4px', cursor: 'pointer', fontWeight: 600 }}
                >
                  {t('nexus.wsTabAudit')}
                </button>
              </div>
              
              {activeOpp && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                  {`${t('nexus.wsStage')}: `}
                  <span style={{ background: 'var(--bg-secondary)', padding: '4px 12px', borderRadius: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>
                    {activeOpp.pipeline_stage.toUpperCase()}
                  </span>
                </div>
              )}
            </div>

            {/* Tab: Historie */}
            {activeTab === 'historie' && (
              <div className="tab-content-historie" style={{ display: 'flex', flexDirection: 'column', gap: '16px', overflowY: 'auto', paddingRight: '8px' }}>
                {historyItems.length === 0 ? (
                  <p style={{ color: 'var(--text-secondary)' }}>{t('nexus.wsNoHistory')}</p>
                ) : (
                  historyItems.map((item, idx) => (
                    <div key={idx} style={{ padding: '16px', background: 'var(--bg-secondary)', borderRadius: '8px', border: '1px solid var(--border-light)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                        <span style={{ fontWeight: 'bold', color: 'var(--text-primary)' }}>
                          {item._type === 'content' ? t('nexus.wsGeneratedPitch') + ': ' + item.type : item.description}
                        </span>
                        <span>{new Date(item.created_at).toLocaleString()}</span>
                      </div>
                      {item._type === 'content' ? (
                        <div style={{ fontSize: '0.9rem', whiteSpace: 'pre-wrap', color: 'var(--text-primary)' }}>
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
                        <div style={{ fontSize: '0.9rem', marginTop: '6px', padding: '10px', background: 'var(--bg-card)', borderRadius: '6px', border: '1px solid var(--border-light)' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                            <span style={{ fontWeight: 600, color: 'var(--color-koralle)', fontSize: '0.8rem' }}>
                              Plattform: {item.metadata.platform?.toUpperCase() || 'SOCIAL'}
                            </span>
                            {item.metadata.url && (
                              <a href={item.metadata.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.8rem', color: 'var(--color-koralle)', textDecoration: 'none' }}>
                                Original-Post ↗
                              </a>
                            )}
                          </div>
                          {item.metadata.comment && (
                            <div style={{ marginBottom: '6px' }}>
                              <strong style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Öffentlicher Kommentar:</strong>
                              <p style={{ margin: '4px 0', whiteSpace: 'pre-wrap' }}>{item.metadata.comment}</p>
                            </div>
                          )}
                          {item.metadata.direct_message && (
                            <div>
                              <strong style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Direktnachricht (DM):</strong>
                              <p style={{ margin: '4px 0', whiteSpace: 'pre-wrap' }}>{item.metadata.direct_message}</p>
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
                      <strong style={{ color: 'var(--color-koralle)' }}>📢 Gespeicherter Social Outreach vorhanden:</strong>{' '}
                      {socialState.outreachData.comment ? `Kommentar: "${socialState.outreachData.comment.slice(0, 90)}..."` : (socialState.outreachData.direct_message ? `DM: "${socialState.outreachData.direct_message.slice(0, 90)}..."` : 'Nachricht verfasst')}
                    </div>
                    <button 
                      type="button" 
                      onClick={() => setSelectedMode('forum_response')}
                      style={{ fontSize: '0.8rem', background: 'transparent', color: 'var(--color-koralle)', border: '1px solid var(--color-koralle)', borderRadius: '4px', padding: '4px 10px', cursor: 'pointer', whiteSpace: 'nowrap' }}
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
                            <span className="social-presence-badge unverified">
                              LinkedIn: Keine verifizierte URL
                            </span>
                          )}
                          {socialState.profiles?.youtube?.url ? (
                            <a href={socialState.profiles.youtube.url} target="_blank" rel="noopener noreferrer" className="social-presence-badge youtube">
                              <Video size={14} /> YouTube Kanal ↗
                            </a>
                          ) : (
                            <span className="social-presence-badge unverified">
                              YouTube: Kein Kanal verlinkt
                            </span>
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
                        <div style={{ padding: '14px 18px', background: 'var(--bg-secondary)', borderRadius: '8px', border: '1px solid var(--border-light)' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
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
                                    💬 {t('nexus.wsSocialCommentTab') || 'Mehrwert-Kommentar'}
                                  </button>
                                  <button 
                                    className={`social-outreach-tab-btn ${socialState.activeTab === 'direct_message' ? 'active' : ''}`}
                                    onClick={() => setSocialState(prev => ({ ...prev, activeTab: 'direct_message' }))}
                                  >
                                    ✉️ {t('nexus.wsSocialDmTab') || 'Direktnachricht (InMail / DM)'}
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
                                    <option value="en">🇬🇧 Englisch (English)</option>
                                    <option value="de">🇩🇪 Deutsch</option>
                                    <option value="fr">🇫🇷 Français</option>
                                    <option value="es">🇪🇸 Español</option>
                                    <option value="it">🇮🇹 Italiano</option>
                                    <option value="nl">🇳🇱 Nederlands</option>
                                    <option value="el">🇬🇷 Ελληνικά</option>
                                  </select>
                                </div>
                              </div>

                              <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                                <div>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                                    <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                                      📝 {socialState.activeTab === 'comment' ? 'Zu postender Kommentar' : 'Zu versendende Direktnachricht'} ({socialState.outreachData.post_lang_label || 'Englisch'}):
                                    </label>
                                    <span style={{ fontSize: '0.8rem', color: 'var(--color-koralle)', fontWeight: 600 }}>
                                      ✨ Formatiert für {socialState.selectedActivity.platform?.toUpperCase()}
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
                                      border: '1px solid var(--border-light)',
                                      background: 'var(--bg)',
                                      color: 'var(--text-primary)',
                                      fontFamily: 'inherit',
                                      fontSize: '0.95rem',
                                      lineHeight: 1.5,
                                      resize: 'vertical'
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

            {/* Tab: Intelligence */}
            {activeTab === 'intelligence' && (
              <div className="tab-content-intelligence" style={{ padding: '16px', background: 'var(--bg-secondary)', borderRadius: '8px' }}>
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
                          {fullContext.company?.name || '-'} {fullContext.company?.industry ? `(${fullContext.company.industry})` : ''}
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
                          {translatingIntel ? '🔄 ' + t('nexus.wsTranslating') : '🇩🇪 ' + (translatedIntelligence?.offering_name ? 'Übersetzung aktualisieren' : t('nexus.wsTranslateDe'))}
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
                              <strong>{t('nexus.wsOriginal')}</strong> {activeTrigger.content}
                            </div>
                          </div>
                        ) : (
                          <p style={{ whiteSpace: 'pre-wrap', lineHeight: '1.5', margin: '0 0 16px 0', fontSize: '0.95rem' }}>
                            {activeTrigger.content}
                          </p>
                        )}
                        
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                          <div>
                            <strong style={{ color: 'var(--text-primary)' }}>{t('nexus.wsAuditSource')}</strong> <br/>
                            {activeTrigger.source?.startsWith('http') ? (
                              <a href={activeTrigger.source} target="_blank" rel="noreferrer" style={{ color: 'var(--color-koralle)', textDecoration: 'none' }}>
                                {t('nexus.wsOpenLink')}
                              </a>
                            ) : (
                              activeTrigger.source
                            )}
                          </div>
                          <div>
                            <strong style={{ color: 'var(--text-primary)' }}>{t('nexus.wsDiscoveredAt')}</strong> <br/>
                            {new Date(activeTrigger.created_at).toLocaleDateString()}
                          </div>
                          <div>
                            <strong style={{ color: 'var(--text-primary)' }}>{t('nexus.wsTriggerType')}</strong> <br/>
                            {activeTrigger.signal_type || 'Unbekannt'}
                          </div>
                          <div>
                            <strong style={{ color: 'var(--text-primary)' }}>AI Confidence:</strong> <br/>
                            {activeTrigger.confidence_score ? `${activeTrigger.confidence_score}%` : 'N/A'}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* 4. Message Generation */}
                    {foundContact && (
                      <div style={{ background: 'var(--bg-card)', padding: '16px', borderRadius: '6px', border: '1px solid var(--border-light)' }}>
                        <h4 style={{ marginTop: 0, color: 'var(--color-koralle)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <Send size={18} /> {t('nexus.wsPrepareMessage')}
                        </h4>
                        
                        {/* Contact Summary */}
                        <div style={{ marginBottom: '12px', fontSize: '0.9rem', padding: '8px', background: 'var(--bg-secondary)', borderRadius: '4px' }}>
                          <strong>{t('nexus.wsTo')}</strong> {foundContact.name}{' '}
                          {foundContact.role && <span>({foundContact.role})</span>}
                          <br/>
                          <strong>{t('nexus.wsAuditFirm')}</strong> {fullContext.company?.name || '-'}
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
                                  padding: '8px',
                                  border: '1px solid var(--border-light)',
                                  borderRadius: '4px',
                                  fontSize: '0.9rem',
                                  lineHeight: '1.5',
                                  resize: 'vertical',
                                  fontFamily: 'inherit'
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
    </div>
  )
}
