import React, { useState, useEffect } from 'react'
import { Briefcase, Mail, MessageSquare, Phone, Send, Copy, CheckCircle, AlertCircle, List, Trash2, ArrowRight, Search } from 'lucide-react'
import { callNexusAI, runDeepResearch, callContactIntelligence, callMessageGeneration } from '../lib/nexus-ai'
import NexusAnalysisResult from '../components/NexusAnalysisResult'
import { useLead } from '../context/LeadContext'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import * as db from '../lib/nexus-db'
import { useLanguage } from '../i18n/translations.jsx'
import CoachChatPage from './CoachChatPage'
import { ContextHelpButton } from '../context/GuideContext'
import './SalesWorkspacePage.css'

const MODI = [
  { id: 'sales_pitch', label: 'Sales Pitch', icon: Send, description: 'Persönliche Erstnachricht' },
  { id: 'follow_up', label: 'Follow-Up', icon: Mail, description: 'Nachfass-Nachricht' },
  { id: 'einwandbehandlung', label: 'Einwandbehandlung', icon: MessageSquare, description: 'Auf Einwände reagieren' },
  { id: 'forum_response', label: 'Forum-Antwort', icon: Phone, description: 'Auf Forenbeiträge antworten' }
]

import { useNavigate } from 'react-router-dom'

export default function SalesWorkspacePage() {
  const navigate = useNavigate()
  const { t, lang } = useLanguage()
  const { user } = useAuth()
  const { opportunities, triggers, deleteOpportunity } = useLead()
  
  const [selectedMode, setSelectedMode] = useState('sales_pitch')
  const [activeOppId, setActiveOppId] = useState(null)
  const [activeTab, setActiveTab] = useState('aktion') // 'historie', 'aktion', 'intelligence'
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
  const [editedMessage, setEditedMessage] = useState('') // Vom Benutzer bearbeitete Nachricht

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
      alert("✅ Realistische Testdaten (TechNova + Müller AG) erfolgreich eingefügt! Bitte jetzt den Cron-Befehl im Terminal ausführen.")
    } catch (e) {
      alert("Fehler: " + e.message)
    }
  }

  useEffect(() => {
    // Reset Kontakt-State beim Opportunity-Wechsel
    setFoundContact(null);
    setContactPersisted(false);

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
            einwand: ''
          }));
          
          setResult(null);
          setActiveTab('aktion');

          // Lade Historie
          const activities = ctx.activities || [];
          const genData = ctx.generated_content || [];
          const combined = [
            ...(activities).map(a => ({ ...a, _type: 'activity' })),
            ...(genData).map(g => ({ ...g, _type: 'content' }))
          ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
          setHistoryItems(combined);

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
        
        if (res.status === 'no_candidates') {
          setFormData(prev => ({ ...prev, ansprechpartner: 'Kein passender Ansprechpartner gefunden' }));
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
          setFullContext(prev => prev ? {
            ...prev,
            contacts: [{ nexus_contacts: { name: contact.name, role: contact.role || '', email: contact.email || null } }]
          } : prev);
          
          // Kontakt mit vollständigen Daten speichern (evidence, source_url, email_status)
          setFoundContact({
            name: contact.name,
            role: contact.role,
            email: contact.email,
            email_status: contact.email_status || 'UNKNOWN',
            evidence: contact.evidence || null,
            source_url: contact.source_url || null,
            rank_score: contact.rank_score,
            company_validated: contact.company_validated || false
          });
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
      
      // Auto-Save Contact if manually typed and not in DB
      if (formData.ansprechpartner && formData.ansprechpartner !== 'Kein verlässlicher Ansprechpartner gefunden' && formData.ansprechpartner !== 'Fehler bei der Kontaktrecherche') {
        if (!fullContext?.contacts || fullContext.contacts.length === 0) {
            try {
              await db.saveOpportunityContact(user.id, fullContext.company_id, activeOppId, formData.ansprechpartner, '', 'manual', 100);
            } catch(e) { console.error("Auto-save contact error", e) }
        }
      }
      
      // Auto-Save: In die Historie wegspeichern
      if (activeOppId && user) {
        const saved = await db.saveGeneratedContent(user.id, activeOppId, selectedMode, resultData)
        if (saved) {
          // Füge es direkt der Historie hinzu (ohne kompletten Reload)
          setHistoryItems(prev => [{ ...saved, _type: 'content' }, ...prev])
        }
      }
    } catch (err) {
      console.error('Sales Workspace Fehler:', err)
      const errorMsg = err.message || '';
      if (errorMsg.includes('Mistral') || errorMsg.includes('Timeout') || errorMsg.includes('NeXus')) {
        setError(errorMsg.replace('NeXus AI Error: ', ''));
      } else {
        setError('Fehler bei der Generierung. Bitte versuche es erneut.')
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
              <label htmlFor="company">Firmenname *</label>
              <input
                id="company"
                name="company"
                type="text"
                value={formData.company}
                onChange={handleInputChange}
                placeholder="z.B. Mustermann GmbH"
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="ansprechpartner" style={{ display: 'flex', justifyContent: 'flex-start', alignItems: 'center', gap: '12px' }}>
                Ansprechpartner (optional)
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
                  {findingContact ? 'Suche...' : 'Auto-Finden'}
                </button>
              </label>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <input
                  id="ansprechpartner"
                  name="ansprechpartner"
                  type="text"
                  value={formData.ansprechpartner}
                  onChange={handleInputChange}
                  placeholder="z.B. Herr Schmidt"
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
                    <CheckCircle size={14} /> Speichern
                  </button>
                )}
              </div>
            </div>
            <div className="form-group">
              <label htmlFor="branche">Branche</label>
              <input
                id="branche"
                name="branche"
                type="text"
                value={formData.branche}
                onChange={handleInputChange}
                placeholder="z.B. IT, Handwerk, etc."
              />
            </div>
            <div className="form-group">
              <label htmlFor="situation">{t('nexus.situationContext')}</label>
              <textarea
                id="situation"
                name="situation"
                value={formData.situation}
                onChange={handleInputChange}
                placeholder="Was weißt du über die Situation des Unternehmens?"
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
                placeholder="z.B. Mustermann GmbH"
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
                placeholder="Wann und wie hast du zuletzt kontaktiert?"
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
                placeholder="z.B. Mustermann GmbH"
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
                placeholder="Was hat der Kunde als Einwand vorgebracht?"
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
                placeholder="z.B. LinkedIn-Beitrag von Mustermann GmbH"
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
                placeholder="Was steht im Beitrag oder in der Frage?"
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
          <ArrowRight size={14} style={{ transform: 'rotate(180deg)' }} /> Zurück
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
              Coach fragen
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
                  Historie
                </button>
                <button 
                  className={`tab-btn ${activeTab === 'aktion' ? 'active' : ''}`} 
                  onClick={() => setActiveTab('aktion')}
                  style={{ background: activeTab === 'aktion' ? 'var(--color-koralle)' : 'transparent', color: activeTab === 'aktion' ? 'white' : 'var(--text-primary)', border: 'none', padding: '8px 16px', borderRadius: '4px', cursor: 'pointer', fontWeight: 600 }}
                >
                  Aktion (Pitch)
                </button>
                <button 
                  className={`tab-btn ${activeTab === 'intelligence' ? 'active' : ''}`} 
                  onClick={() => setActiveTab('intelligence')}
                  style={{ background: activeTab === 'intelligence' ? 'var(--color-koralle)' : 'transparent', color: activeTab === 'intelligence' ? 'white' : 'var(--text-primary)', border: 'none', padding: '8px 16px', borderRadius: '4px', cursor: 'pointer', fontWeight: 600 }}
                >
                  Intelligence
                </button>
              </div>
              
              {activeOpp && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                  Status: 
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
                  <p style={{ color: 'var(--text-secondary)' }}>Noch keine Aktivitäten in dieser Akte.</p>
                ) : (
                  historyItems.map((item, idx) => (
                    <div key={idx} style={{ padding: '16px', background: 'var(--bg-secondary)', borderRadius: '8px', border: '1px solid var(--border-light)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                        <span style={{ fontWeight: 'bold', color: 'var(--text-primary)' }}>
                          {item._type === 'content' ? `KI Generiert: ${item.type}` : item.description}
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
                      ) : null}
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Tab: Aktion (Layout angepasst, damit Formular breiter ist) */}
            {activeTab === 'aktion' && (
              <div className="tab-content-aktion" style={{ display: 'flex', flexDirection: 'column', gap: '24px', flex: 1 }}>
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
                          <span className="mode-label">{mode.label}</span>
                          <span className="mode-description">{mode.description}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
                <main className="sales-workspace-main" style={{ width: '100%' }}>
                  
                  <form onSubmit={handleGenerate} className="sales-form">
                    {renderFormFields()}
                    
                    <div className="form-group" style={{ marginTop: '16px' }}>
                      <label htmlFor="targetLang">Zielsprache der Nachricht</label>
                      <select
                        id="targetLang"
                        name="targetLang"
                        value={formData.targetLang || 'auto'}
                        onChange={handleInputChange}
                        style={{ width: '100%', padding: '10px', borderRadius: '4px', border: '1px solid var(--border-light)', background: 'var(--bg)', color: 'var(--text-primary)' }}
                      >
                        <option value="auto">Automatisch (Passend zur Ziel-Firma)</option>
                        <option value="de">Deutsch</option>
                        <option value="en">Englisch</option>
                        <option value="es">Spanisch</option>
                        <option value="fr">Französisch</option>
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
                        <h3>Generierte Nachricht (Wurde automatisch in der Historie gespeichert)</h3>
                        <button className="copy-btn" onClick={handleCopy}>
                          {copied ? <><CheckCircle size={16} /> Kopiert!</> : <><Copy size={16} /> Kopieren</>}
                        </button>
                      </div>
                      <NexusAnalysisResult data={result} mode={selectedMode} />
                    </div>
                  )}
                </main>
              </div>
            )}

            {/* Tab: Intelligence */}
            {activeTab === 'intelligence' && (
              <div className="tab-content-intelligence" style={{ padding: '16px', background: 'var(--bg-secondary)', borderRadius: '8px' }}>
                <h3 style={{ marginTop: 0, display: 'flex', alignItems: 'center' }}>
                  Lead-Akte (Opportunity Context) <ContextHelpButton helpKey="lead_akte.opportunity" />
                </h3>
                
                {fullContext ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                    
                    {/* 1. Company & Contact */}
                    <div style={{ background: 'var(--bg-card)', padding: '16px', borderRadius: '6px', border: '1px solid var(--border-light)' }}>
                      <h4 style={{ marginTop: 0, color: 'var(--color-koralle)' }}>Unternehmen & Kontakt</h4>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', fontSize: '0.9rem' }}>
                        <div>
                          <strong>Firma:</strong> <br/>
                          {fullContext.company?.name || '-'} {fullContext.company?.industry ? `(${fullContext.company.industry})` : ''}
                        </div>
                        <div>
                          <strong>Ansprechpartner:</strong> <br/>
                          {fullContext.contacts?.length > 0 ? (
                            <span>
                              {`${fullContext.contacts[0].nexus_contacts.first_name || ''} ${fullContext.contacts[0].nexus_contacts.last_name || ''}`.trim()} 
                              {fullContext.contacts[0].nexus_contacts.role && ` (${fullContext.contacts[0].nexus_contacts.role})`}
                            </span>
                          ) : findingContact ? (
                            <span style={{ color: 'var(--text-secondary)' }}>Suche laeuft...</span>
                          ) : (
                            <span style={{ color: 'var(--text-secondary)' }}>Kein Ansprechpartner gefunden</span>
                          )}
                        </div>
                      </div>
                      
                      {/* Contact Intelligence Details */}
                      {foundContact && (
                        <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid var(--border-light)', fontSize: '0.85rem' }}>
                          {/* Evidenz */}
                          {foundContact.evidence && (
                            <div style={{ marginBottom: '8px' }}>
                              <strong style={{ color: 'var(--text-primary)' }}>Evidenz:</strong><br/>
                              <span style={{ color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                                "{foundContact.evidence}"
                              </span>
                            </div>
                          )}
                          
                          {/* Quelle */}
                          {foundContact.source_url && (
                            <div style={{ marginBottom: '8px' }}>
                              <strong style={{ color: 'var(--text-primary)' }}>Quelle:</strong>{' '}
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
                            {foundContact.email && foundContact.email_confidence ? (
                              // Fall 1: Email da + Confidence (Pattern-Guess)
                              <span>
                                <input
                                  type="email"
                                  value={foundContact.email}
                                  onChange={(e) => setFoundContact(prev => ({ ...prev, email: e.target.value }))}
                                  style={{
                                    padding: '4px 8px',
                                    border: '1px solid var(--border-light)',
                                    borderRadius: '4px',
                                    fontSize: '0.85rem',
                                    width: '220px',
                                    marginRight: '8px'
                                  }}
                                />
                                <span style={{
                                  padding: '2px 6px',
                                  borderRadius: '4px',
                                  fontSize: '0.75rem',
                                  fontWeight: 600,
                                  backgroundColor: foundContact.email_confidence >= 80 ? '#dcfce7' : foundContact.email_confidence >= 60 ? '#fef3c7' : '#ffedd5',
                                  color: foundContact.email_confidence >= 80 ? '#166534' : foundContact.email_confidence >= 60 ? '#92400e' : '#9a3412'
                                }}>
                                  {foundContact.email_confidence}% Geraten – nicht verifiziert
                                </span>
                              </span>
                            ) : foundContact.email ? (
                              // Fall 2: Email da, ohne Confidence (manuell eingegeben oder Website)
                              <span style={{ color: '#22c55e' }}>{foundContact.email}</span>
                            ) : (
                              // Fall 3: Keine Email (UNKNOWN)
                              <span style={{ color: 'var(--text-secondary)' }}>Keine E-Mail gefunden</span>
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
                                Bestätigen
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
                                Verwerfen
                              </button>
                            </div>
                          )}
                          
                          {/* UNKNOWN: Manuelle Eingabe */}
                          {!foundContact.email && (
                            <div style={{ display: 'flex', gap: '8px', marginBottom: '8px', alignItems: 'center' }}>
                              <input
                                type="email"
                                placeholder="E-Mail manuell eingeben"
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
                                Speichern
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
                                <span style={{ marginLeft: '8px', color: '#22c55e', fontSize: '0.8rem' }}>✓ Firmenwebsite</span>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* 2. Offering */}
                    <div style={{ background: 'var(--bg-card)', padding: '16px', borderRadius: '6px', border: '1px solid var(--border-light)' }}>
                      <h4 style={{ marginTop: 0, color: 'var(--color-koralle)' }}>Offering & Positioning</h4>
                      <div style={{ fontSize: '0.9rem', lineHeight: '1.5' }}>
                        <strong>Angebot:</strong> {fullContext.offering?.offering_name || '-'}<br/><br/>
                        <strong>Positioning / Nutzen:</strong><br/>
                        {fullContext.offering?.positioning || '-'}
                      </div>
                    </div>

                    {/* 3. Trigger */}
                    {activeTrigger && (
                      <div style={{ background: 'var(--bg-card)', padding: '16px', borderRadius: '6px', border: '1px solid var(--border-light)' }}>
                        <h4 style={{ marginTop: 0, color: 'var(--color-koralle)' }}>Ursprüngliches Kaufsignal (Trigger)</h4>
                        <p style={{ whiteSpace: 'pre-wrap', lineHeight: '1.5', margin: '0 0 16px 0', fontSize: '0.95rem' }}>
                          {activeTrigger.content}
                        </p>
                        
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                          <div>
                            <strong style={{ color: 'var(--text-primary)' }}>Quelle:</strong> <br/>
                            {activeTrigger.source?.startsWith('http') ? (
                              <a href={activeTrigger.source} target="_blank" rel="noreferrer" style={{ color: 'var(--color-koralle)', textDecoration: 'none' }}>
                                Original-Link öffnen ↗
                              </a>
                            ) : (
                              activeTrigger.source
                            )}
                          </div>
                          <div>
                            <strong style={{ color: 'var(--text-primary)' }}>Entdeckt am:</strong> <br/>
                            {new Date(activeTrigger.created_at).toLocaleDateString()}
                          </div>
                          <div>
                            <strong style={{ color: 'var(--text-primary)' }}>Trigger-Typ:</strong> <br/>
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
                          <Send size={18} /> Nachricht vorbereiten
                        </h4>
                        
                        {/* Contact Summary */}
                        <div style={{ marginBottom: '12px', fontSize: '0.9rem', padding: '8px', background: 'var(--bg-secondary)', borderRadius: '4px' }}>
                          <strong>An:</strong> {foundContact.name}{' '}
                          {foundContact.role && <span>({foundContact.role})</span>}
                          <br/>
                          <strong>Firma:</strong> {fullContext.company?.name || '-'}
                          <br/>
                          <strong>E-Mail:</strong>{' '}
                          {foundContact.email && foundContact.email_status !== 'UNKNOWN' ? (
                            <span style={{ color: '#22c55e' }}>{foundContact.email}</span>
                          ) : (
                            <span style={{ color: 'var(--text-secondary)' }}>Nicht öffentlich verfügbar</span>
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
                            <Send size={14} /> Nachricht generieren
                          </button>
                        )}

                        {/* Loading */}
                        {isGeneratingMessage && (
                          <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', padding: '12px 0' }}>
                            Nachricht wird generiert...
                          </div>
                        )}

                        {/* Generated Message */}
                        {generatedMessage && generatedMessage.status === 'generated' && (
                          <div>
                            {/* Subject */}
                            {generatedMessage.subject && (
                              <div style={{ marginBottom: '8px', fontSize: '0.85rem' }}>
                                <strong>Betreff:</strong> {generatedMessage.subject}
                              </div>
                            )}
                            
                            {/* Message (editable) */}
                            <div style={{ marginBottom: '12px' }}>
                              <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.85rem', fontWeight: 600 }}>
                                Nachricht:
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
                                <strong>Verwendete Fakten:</strong>
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
                                <strong>Interpretationen:</strong>
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
                                <strong>Quellen:</strong>
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
                                {copied ? 'Kopiert!' : !contactPersisted ? 'Erst E-Mail bestätigen' : 'Kopieren'}
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
                                Neu generieren
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Error */}
                        {generatedMessage?.status === 'error' && (
                          <div style={{ color: '#ef4444', fontSize: '0.9rem' }}>
                            Fehler: {generatedMessage.error}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  ) : (
                  <p>Lade Intelligence-Daten...</p>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="sales-workspace-empty-state" style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <CheckCircle size={48} color="var(--border-light)" />
            <h2 style={{ color: 'var(--text-primary)' }}>Wähle eine Firma aus der Pipeline</h2>
            <p style={{ color: 'var(--text-secondary)' }}>Oder gib die Daten manuell im Radar ein.</p>
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
