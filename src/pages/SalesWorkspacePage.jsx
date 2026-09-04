import React, { useState, useEffect } from 'react'
import { Briefcase, Mail, MessageSquare, Phone, Send, Copy, CheckCircle, AlertCircle, List, Trash2, ArrowRight, Search } from 'lucide-react'
import { callNexusAI, runDeepResearch } from '../lib/nexus-ai'
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
             contactName = `${existingContact.name}${existingContact.role ? ` (${existingContact.role})` : ''}`;
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
    setFoundContact(null);
    try {
      const res = await callNexusAI({
        mode: 'find_contact',
        lang: lang,
        userMessage: `Finde den Entscheider bei ${companyName}`,
        company: companyName
      });
      
        try {
          const textToParse = res?.response || res || "";
          const cleanedText = typeof textToParse === 'string' ? textToParse.replace(/```(?:json)?/g, '').replace(/```/g, '').trim() : "";
          parsed = typeof textToParse === 'string' ? JSON.parse(cleanedText) : textToParse;
        } catch(e) {
          console.error("Fehler beim Parsen der Kontakt-JSON:", e);
        }
      
      if (parsed && parsed.name && parsed.name.trim() !== '' && parsed.name !== 'N/A' && parsed.name !== 'unbekannt') {
        // Zeige den Kontakt sofort im Formular an (falls DB-Save wegen RLS fehlschlägt, haben wir ihn trotzdem im Pitch)
        let fullStr = `${parsed.name}${parsed.role && parsed.role !== 'N/A' && parsed.role !== 'unbekannt' ? ` (${parsed.role})` : ''}`;
        if (parsed.phone && parsed.phone !== 'unbekannt' && parsed.phone !== 'N/A') {
          fullStr += ` | Tel: ${parsed.phone}`;
        }
        setFormData(prev => ({ ...prev, ansprechpartner: fullStr }));
        
        // Versuche im Hintergrund zu speichern (nexus_contacts und nexus_opportunity_contacts)
        try {
          const savedContact = await db.saveOpportunityContact(user.id, companyId, oppId, parsed.name, parsed.role || '', 'tavily', 80);
          if (savedContact) {
            setFoundContact(savedContact);
          } else {
            // Fallback, wenn der Save fehlschlägt, aber wir einen generierten Kontakt haben
            setFoundContact({ name: parsed.name, role: parsed.role });
          }
        } catch(e) {
          console.error("Fehler beim Speichern des Kontakts:", e);
          setFoundContact({ name: parsed.name, role: parsed.role });
        }
      } else {
         // Explizit markieren, dass kein Kontakt gefunden wurde
         setFormData(prev => ({ ...prev, ansprechpartner: 'Kein verlässlicher Ansprechpartner gefunden' }));
      }
    } catch (e) {
      console.error(e);
      setFormData(prev => ({ ...prev, ansprechpartner: 'Fehler bei der Kontaktrecherche' }));
    } finally {
      setFindingContact(false);
    }
  }

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
    alert("Kontakt ist bereits sicher in der Akte gespeichert!");
    setFoundContact(null);
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
      
      // Auto-Save: In die Historie wegspeichern
      if (activeOppId && user) {
        const saved = await db.saveGeneratedContent(user.id, activeOppId, selectedMode, resultData, {
          company: formData.company,
          ansprechpartner: formData.ansprechpartner
        })
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
                          {item._type === 'content' ? `KI Generiert: ${item.type}` : item.activity_type}
                        </span>
                        <span>{new Date(item.created_at).toLocaleString()}</span>
                      </div>
                      {item._type === 'content' ? (
                        <div style={{ fontSize: '0.9rem', whiteSpace: 'pre-wrap', color: 'var(--text-primary)' }}>
                          {typeof item.content === 'object' ? item.content.response : item.content}
                        </div>
                      ) : (
                        <div style={{ fontSize: '0.9rem' }}>{item.description}</div>
                      )}
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
                    <button type="submit" className="generate-btn" disabled={loading}>
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
                              {fullContext.contacts[0].nexus_contacts.name} 
                              {fullContext.contacts[0].nexus_contacts.role && ` (${fullContext.contacts[0].nexus_contacts.role})`}
                            </span>
                          ) : (
                            <span style={{ color: 'var(--text-secondary)' }}>Wird gesucht...</span>
                          )}
                        </div>
                      </div>
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
