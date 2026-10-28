import React, { useState, useEffect, useMemo } from 'react'
import { Briefcase, Radar, Mail, MessageSquare, Send, Copy, CheckCircle, AlertCircle, List, Trash2, ArrowRight, Search, Share2, ExternalLink, Video, Globe, Sparkles, RefreshCw, Clock, Check, Loader2, X, Eye, ShieldCheck, FileText, Zap, Edit3, ShieldAlert, AlertTriangle, Printer, Download, UserCheck, Archive } from 'lucide-react'
import { callNexusAI, runDeepResearch, callContactIntelligence, callMessageGeneration, callSocialIntelligence } from '../lib/nexus-ai'
import { isPlaceholderCompany, computeTargetMatchScore, classifyB2BLifecycle, getCategoryLifecycleConfig, hasConcreteVerifiedAnlass, isBlacklistedRole } from '../lib/nexus-validation'
import { formatEventDate, extractDomain, getFreshnessTrafficLight } from '../lib/nexus-dates'
import NexusAnalysisResult from '../components/NexusAnalysisResult'
import { useLead } from '../context/LeadContext'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import * as db from '../lib/nexus-db'
import { useLanguage } from '../i18n/translations.jsx'
import CoachChatPage from './CoachChatPage'
import NexusLiveProgressBar from '../components/NexusLiveProgressBar'
import { ContextHelpButton } from '../components/ContextHelpButton'
import { resolveTriggerCompanyName, extractCompanyNameFromText, buildSignalPayload } from '../lib/nexus-signal-publisher'
import { trackSocialOutreachGenerated, trackSocialCommentCopied, trackSocialDmCopied, trackSocialOriginalOpened } from '../lib/nexus-analytics'
import './SalesWorkspacePage.css'

const MODI = [
  { id: 'sales_pitch', label: 'Sales Pitch', icon: Send, description: 'Persönliche Erstnachricht' },
  { id: 'follow_up', label: 'Follow-Up', icon: Mail, description: 'Nachfass-Nachricht' },
  { id: 'einwandbehandlung', label: 'Einwandbehandlung', icon: MessageSquare, description: 'Auf Einwände reagieren' },
  { id: 'forum_response', label: 'Social Outreach', icon: Share2, description: 'LinkedIn / YouTube / Foren' }
]

import { useNavigate, useSearchParams } from 'react-router-dom'

// Standardisierte akkreditierte Partner für Swiss & International Desk
export const OUTREACH_PARTNERS = [
  {
    id: 'topfifty',
    name: 'Top Fifty AG',
    location: 'Baar / Zug, Schweiz 🇨🇭',
    contactPerson: 'Pierina Tannò',
    role: 'Senior Partnerin & Board Advisory',
    email: 'p.tanno@top50interim.com',
    status: 'EXKLUSIV_RESERVIERT',
    statusLabel: '14 Tage Exklusivität Schweiz',
    exclusivityDays: 14,
    defaultRefPrefix: 'CH-ZG-2026-VR',
    lang: 'de'
  },
  {
    id: 'bie_executive',
    name: 'BIE Executive',
    location: 'London, UK 🇬🇧',
    contactPerson: 'Byron Tarboton',
    role: 'Director & Practice Lead Interim Executive',
    email: 'byron.tarboton@bie-executive.com',
    status: 'FIRST_LOOK_AKTIV',
    statusLabel: '48h First-Look UK',
    exclusivityHours: 48,
    defaultRefPrefix: 'INT-CH-2026',
    lang: 'en'
  },
  {
    id: 'taskforce',
    name: 'taskforce - Management on Demand AG',
    location: 'München / Zürich 🇩🇪 🇨🇭',
    contactPerson: 'Partner-Desk DACH',
    role: 'Vorstand & Mandats-Allokation',
    email: 'mandate@taskforce.net',
    status: 'ANGEBOTEN_RESERVIERT',
    statusLabel: 'Groß-Provider Erstansprache',
    exclusivityDays: 14,
    defaultRefPrefix: 'CH-TF-2026',
    lang: 'de'
  },
  {
    id: 'atreus',
    name: 'Atreus GmbH (A Heidrick & Struggles Company)',
    location: 'München, Deutschland 🇩🇪',
    contactPerson: 'Practice Group Restructuring',
    role: 'Managing Director',
    email: 'advisory@atreus.de',
    status: 'ANGEBOTEN_RESERVIERT',
    statusLabel: 'Transformation & Interim Vorstand',
    exclusivityDays: 14,
    defaultRefPrefix: 'DE-ATR-2026',
    lang: 'de'
  },
  {
    id: 'fp_executive',
    name: 'F&P Executive Solutions AG',
    location: 'Frankfurt am Main, Deutschland 🇩🇪',
    contactPerson: 'Executive Board Desk',
    role: 'Vorstand Restrukturierung',
    email: 'kontakt@fp-executive.com',
    status: 'ANGEBOTEN_RESERVIERT',
    statusLabel: 'Mittelstands-Sanierung & CRO',
    exclusivityDays: 14,
    defaultRefPrefix: 'DE-FP-2026',
    lang: 'de'
  },
  {
    id: 'private_pe',
    name: 'Freies Family Office & PE-Boutiquen-Netzwerk',
    location: 'Zürich / London / Frankfurt 🇨🇭 🇬🇧 🇩🇪',
    contactPerson: 'Investment & Interim Director',
    role: 'Portfolio Operations',
    email: 'private-mandates@dat-nexus.com',
    status: 'DISKRIT_RESERVIERT',
    statusLabel: 'Diskrete Platzierung PE',
    exclusivityDays: 14,
    defaultRefPrefix: 'PE-INV-2026',
    lang: 'de'
  }
];

export function generateGermanOutreachEmail({ partner, refCode, region, segment, role, incident }) {
  const pName = partner?.contactPerson || 'Damen und Herren';
  const salutation = pName.includes('Frau') || pName.includes('Pierina') || pName.includes('Tannò')
    ? `Sehr geehrte Frau ${pName.split(' ').pop()},`
    : pName.includes('Herr') || pName.includes('Byron')
      ? `Sehr geehrter Herr ${pName.split(' ').pop()},`
      : `Sehr geehrte Damen und Herren,`;

  const subject = `Diskretes Mandatssignal: Organ-Vakuum VR / C-Level (${region} · ${segment})`;

  const body = `${salutation}

über unseren Mandate Desk identifizieren wir tagesaktuell signifikante Organ-Vakanzen und Führungslücken im europäischen Markt.

Am Standort ${region} liegt uns ein akutes Organ-Vakuum bei einer schweizerischen Technologie-AG vor: Ein vollwertiges Mitglied des Verwaltungsrates mit Einzelunterschrift ist per sofort ausgeschieden, ohne dass eine Nachfolge geregelt ist.

Da hier unmittelbarer Handlungsdruck bezüglich Board-Governance, Organvertretung und operativer Handlungsfähigkeit besteht, stellen wir diesen Anlass einem ausgewählten Partner zur Mandatierung zur Verfügung.

Ihnen sichern wir für diesen Fall absolute Exklusivität zu – das Signal wird von uns an keinen weiteren Provider oder Wettbewerber im Schweizer Markt herausgegeben.

Das anonymisierte Blind-Profil zur Ersteinschätzung:

Referenz: ${refCode}
Region & Rechtsform: ${region} · Aktiengesellschaft (AG)
Segment: ${segment}
Anlass: ${incident}
Bedarf: ${role}
Status: Vakant / Frei zur Erstansprache

Weitere Informationen zu unserem Mandate Desk finden Sie unter:
https://dat-dat.de

Bei Interesse an den verifizierten Klardaten und Organ-Details für Ihre Mandatsansprache freue ich mich über Ihre kurze Rückmeldung.

Mit freundlichen Grüßen

Harro Goerndt
D.A.T. Dienstleistungen · Executive Mandate Desk
Weserstraße 16 · 26382 Wilhelmshaven`;

  return { subject, body };
}

export function generateEnglishOutreachEmail({ partner, refCode, region, segment, role, incident }) {
  const pName = partner?.contactPerson || 'Executive';
  const lastName = pName.split(' ').pop();
  const salutation = `Dear Mr ${lastName},`;
  const subject = `Mandate Opportunity: Executive / Board Transition (Greater Zurich Area)`;

  const body = `${salutation}

Through our European Mandate Desk, we monitor primary statutory registers for acute C-level and board-level transitions across key European jurisdictions.

We have identified an immediate governance and leadership vacancy at a Swiss digital technology corporation (Aktiengesellschaft) located within the greater Zurich / Central Switzerland economic area. A senior board director has stepped down with immediate effect, leaving an unstaffed organ vacancy.

Due to interim governance requirements, we are presenting this event to an established executive interim partner. We grant you exclusive first-look rights for the UK market on this lead until Wednesday, 28 October 2026, 17:00 BST. Should you decline or not confirm by this deadline, exclusivity expires.

Anonymised Mandate Overview:
- Reference: ${refCode}
- Region & Entity: Greater Zurich Area / Central Switzerland · Swiss Corporation (AG)
- Industry: ${segment}
- Trigger: ${incident}
- Requirement: ${role}
- Status: Open for primary outreach

Further information about our executive desk:
https://dat-dat.de

To receive the verified corporate entity details, primary filing records, and source documentation, please confirm your interest by replying directly to this email.

Best regards,

Harro Goerndt
D.A.T. Dienstleistungen · Executive Mandate Desk
Weserstraße 16 · 26382 Wilhelmshaven, Germany`;

  return { subject, body };
}


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

export function extractDealCoachAudit(opp) {
  if (!opp) return null;

  // 1. Aus review_notes JSON extrahieren falls vorhanden
  if (opp.review_notes) {
    try {
      const parsed = typeof opp.review_notes === 'string' ? JSON.parse(opp.review_notes) : opp.review_notes;
      if (parsed?.deal_coach) {
        return parsed.deal_coach;
      }
    } catch (e) {}
  }

  // 2. Aus situation-Text parsen
  const situation = opp.situation || '';
  const tierMatch = situation.match(/\[DEALCOACH AUDIT\]:\s*([^\n\r]+)/i);
  const vacMatch = situation.match(/\[VAKUUM-CHECK\]:\s*([^\n\r]+)/i);
  const urgMatch = situation.match(/\[DRINGLICHKEIT\]:\s*([^\n\r]+)/i);
  const ratMatch = situation.match(/\[MANDATS-BEGRÜNDUNG\]:\s*([^\n\r]+)/i);
  const budMatch = situation.match(/\[BUDGET-SCHÄTZUNG\]:\s*([^\n\r]+)/i);

  // 3. Fallback auf priority oder tags
  let tier = tierMatch ? tierMatch[1].trim() : null;
  if (!tier && opp.priority) {
    if (opp.priority.toUpperCase().includes('TIER_1')) tier = 'TIER_1_TOP';
    else if (opp.priority.toUpperCase().includes('TIER_2')) tier = 'TIER_2_MID';
    else if (opp.priority.toUpperCase().includes('TIER_3') || opp.priority.toUpperCase().includes('DISCARDED')) tier = 'TIER_3';
    else if (opp.priority.toUpperCase().includes('PRÜFUNG') || opp.priority.toUpperCase().includes('PRUEFUNG') || opp.priority.toUpperCase().includes('FUNG') || opp.priority.toUpperCase().includes('REVIEW')) tier = 'PRÜFUNG_EMPFOHLEN';
  }
  if (!tier && Array.isArray(opp.tags)) {
    if (opp.tags.includes('TIER_1_TOP')) tier = 'TIER_1_TOP';
    else if (opp.tags.includes('TIER_2_MID')) tier = 'TIER_2_MID';
    else if (opp.tags.includes('TIER_3') || opp.tags.includes('Auto_Discarded') || opp.tags.includes('Dormant_Shell') || opp.tags.includes('Complete_Organ_Vacuum_No_Contractor') || opp.tags.includes('Private_Asset_Or_Shell')) tier = 'TIER_3';
    else if (opp.tags.some(t => t.includes('PRÜFUNG') || t.includes('PRUEFUNG') || t.includes('FUNG'))) tier = 'PRÜFUNG_EMPFOHLEN';
  }

  // Intelligenter Default basierend auf Lead-Score und Rechtsform
  if (!tier) {
    if (opp.review_status === 'rejected') {
      tier = 'TIER_3';
    } else {
      const comp = (opp.nexus_companies?.name || opp.company?.name || opp.title || '').toUpperCase();
      const isMajor = /(AG|SE|PLC|SA|CORP|NV|SPA|SIEMENS|VOLKSWAGEN|DAIMLER|BMW|BASF|BAYER|ALLIANZ|SAP)/.test(comp);
      tier = (opp.lead_score >= 80 || isMajor) ? 'TIER_1_TOP' : 'TIER_2_MID';
    }
  }

  const isTier1 = tier === 'TIER_1_TOP';
  const isTier2 = tier === 'TIER_2_MID';
  const isTier3 = tier === 'TIER_3';

  return {
    tier,
    verdict: isTier1 ? 'AKUTER C-LEVEL / ORGAN-MANDATSBEDARF' : isTier2 ? 'OPERATIVER INTERIM- & LEITUNGSBEDARF' : isTier3 ? 'AUSGESONDERT: MANTEL / KEIN AUFTRAGGEBER' : 'VOREINSCHÄTZUNG DEALCOACH (ZUR PRÜFUNG)',
    vacuum_check: vacMatch ? vacMatch[1].trim() : (isTier1 ? 'BESTANDEN: Reale Führungslücke bei bestehendem Geschäftsbetrieb' : isTier2 ? 'BESTANDEN: Organ-Position vakant / Stillstand droht' : isTier3 ? 'K.O. DROP: Organmangel / inaktive Hülle' : 'HINWEIS: Manuelle Sichtung durch Harro'),
    urgency_check: urgMatch ? urgMatch[1].trim() : (isTier1 ? 'HOCH: Akute Not-Governance / Überbrückungsbedarf per sofort' : isTier2 ? 'HOCH: Operativer Handlungsdruck' : isTier3 ? '0 € Mandatswert (Karteileiche ohne laufenden Geschäftsbetrieb)' : 'ROUTINE: Regulatorische Pflichtmitteilung zur Vorlage'),
    rationale: ratMatch ? ratMatch[1].trim() : (opp.strategic_angle || opp.notes || 'DealCoach-Voreinschätzung zur manuellen Prüfung durch Harro im Mandats-Desk.'),
    estimated_budget: budMatch && budMatch[1].trim() && budMatch[1].trim() !== 'Auf Anfrage' && !budMatch[1].trim().includes('150.000') && !budMatch[1].trim().includes('80.000') ? budMatch[1].trim() : '-'
  };
}

export function getCountryFlag(opp) {
  if (!opp) return { flag: '🌐', label: 'International', code: 'INT' };
  const source = (opp.source || '').toLowerCase();
  const title = (opp.title || '').toUpperCase();
  const compCountry = (opp.nexus_companies?.country || opp.company?.country || '').toUpperCase();

  if (source.includes('londonstockexchange') || source.includes('investegate') || title.startsWith('[UK]') || compCountry === 'UK' || compCountry === 'GB') {
    return { flag: '🇬🇧', label: 'Vereinigtes Königreich', code: 'UK' };
  }
  if (source.includes('shab.ch') || title.startsWith('[CH]') || compCountry === 'CH' || compCountry === 'SCHWEIZ') {
    return { flag: '🇨🇭', label: 'Schweiz', code: 'CH' };
  }
  if (source.includes('cnmv.es') || title.startsWith('[ES]') || compCountry === 'ES' || compCountry === 'SPANIEN') {
    return { flag: '🇪🇸', label: 'Spanien', code: 'ES' };
  }
  if (source.includes('eqs-news') || source.includes('dgap') || title.startsWith('[DACH]') || title.startsWith('[DE]') || compCountry === 'DACH' || compCountry === 'DE' || compCountry === 'DEUTSCHLAND') {
    return { flag: '🇩🇪', label: 'Deutschland (DACH)', code: 'DE' };
  }
  if (source.includes('boursorama') || title.startsWith('[FR]') || compCountry === 'FR') {
    return { flag: '🇫🇷', label: 'Frankreich', code: 'FR' };
  }
  return { flag: '🇪🇺', label: 'Europa', code: 'EU' };
}

export function getLegalForm(compName, opp) {
  const text = `${compName || ''} ${opp?.title || ''}`.toUpperCase();
  if (/\b(AG & CO\.?\s*KGAA|AG & CO\.?\s*KG)\b/i.test(text)) return 'AG & Co. KGaA';
  if (/\b(KGAA)\b/i.test(text)) return 'KGaA';
  if (/\b(SE & CO\.?\s*KGAA)\b/i.test(text)) return 'SE & Co. KGaA';
  if (/\b(SE)\b/i.test(text)) return 'SE';
  if (/\b(AG)\b/i.test(text)) return 'AG';
  if (/\b(GMBH & CO\.?\s*KG)\b/i.test(text)) return 'GmbH & Co. KG';
  if (/\b(GMBH)\b/i.test(text)) return 'GmbH';
  if (/\b(HOLDINGS PLC|HOLDING PLC|PLC)\b/i.test(text)) return 'PLC';
  if (/\b(S\.?A\.?)\b/i.test(text)) return 'S.A.';
  if (/\b(S\.?L\.?)\b/i.test(text)) return 'S.L.';
  if (/\b(NV|B\.?V\.?)\b/i.test(text)) return 'N.V. / B.V.';
  if (/\b(LTD\.?|LIMITED)\b/i.test(text)) return 'Ltd.';
  return 'Kapitalgesellschaft';
}

export function extractCleanAnnouncementText(situation, title) {
  if (!situation && !title) return '';
  let text = situation || title || '';
  // Strip out DealCoach metadata tags
  text = text.replace(/\[DEALCOACH AUDIT\]:[^\n\r]*[\r\n]*/gi, '');
  text = text.replace(/\[VAKUUM-CHECK\]:[^\n\r]*[\r\n]*/gi, '');
  text = text.replace(/\[DRINGLICHKEIT\]:[^\n\r]*[\r\n]*/gi, '');
  text = text.replace(/\[MANDATS-BEGRÜNDUNG\]:[^\n\r]*[\r\n]*/gi, '');
  text = text.replace(/\[BUDGET-SCHÄTZUNG\]:[^\n\r]*[\r\n]*/gi, '');
  text = text.replace(/\[COMPANY\]:[^\n\r]*[\r\n]*/gi, '');
  text = text.replace(/\[KAUFSIGNAL\]:[^\n\r]*[\r\n]*/gi, '');
  text = text.replace(/\[EREIGNISDATUM\]:[^\n\r]*[\r\n]*/gi, '');
  text = text.trim();
  if (!text) {
    text = (title || '').replace(/^\[[A-Z0-9_\-]+\]\s*/i, '');
  }
  return text;
}


export default function SalesWorkspacePage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const oppIdFromUrl = searchParams.get('opportunityId')
  const { t, lang } = useLanguage()
  const { user } = useAuth()
  const { opportunities: rawDbOpportunities, triggers, deleteOpportunity, refreshData, activeOffering } = useLead()

  // Kombiniere Datenbank-Opportunities mit lokal übertragenen Radar-Opportunities (z.B. PAUL Tech AG)
  const [localRadarOpps, setLocalRadarOpps] = useState(() => {
    try {
      const LOCAL_OPPS_KEY = 'nexus_local_radar_opportunities'
      return JSON.parse(localStorage.getItem(LOCAL_OPPS_KEY) || '[]')
    } catch {
      return []
    }
  })

  // Verschmelze Opportunities ohne Dubletten (lokale Radar-Imports haben Vorrang)
  const opportunities = useMemo(() => {
    const dbList = Array.isArray(rawDbOpportunities) ? rawDbOpportunities : []
    const combined = [...localRadarOpps]
    dbList.forEach(dbOpp => {
      const dbCompName = dbOpp.nexus_companies?.name || dbOpp.company?.name || dbOpp.title
      if (!combined.some(o => o.id === dbOpp.id || (dbCompName && (o.nexus_companies?.name === dbCompName || o.title?.includes(dbCompName))))) {
        combined.push(dbOpp)
      }
    })
    return combined
  }, [rawDbOpportunities, localRadarOpps])
  
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

  // Mandats-Übermittlung & 12 Monate Kundenschutz State & Modal
  const [isDirectPublishing, setIsDirectPublishing] = useState(false)
  const [showDispatchModal, setShowDispatchModal] = useState(false)
  const [dispatchPartner, setDispatchPartner] = useState('taskforce - Management on Demand AG')
  const [dispatchRole, setDispatchRole] = useState('')
  const [dispatchSuccess, setDispatchSuccess] = useState(false)
  const [dispatchSuccessData, setDispatchSuccessData] = useState(null)
  const [copiedDispatchBlind, setCopiedDispatchBlind] = useState(false)

  // Blind-Profil State & Modal
  const [showBlindProfileModal, setShowBlindProfileModal] = useState(false)
  const [copiedBlindText, setCopiedBlindText] = useState(false)
  const [blindProfileTab, setBlindProfileTab] = useState('teaser') // 'teaser' | 'vault' | 'edit' | 'outreach'
  const [customBlindCompany, setCustomBlindCompany] = useState('')
  const [customBlindLocation, setCustomBlindLocation] = useState('')
  const [customBlindPainPoint, setCustomBlindPainPoint] = useState('')
  const [isSavingBlindProfile, setIsSavingBlindProfile] = useState(false)

  // Outreach Integration State
  const [outreachPartnerId, setOutreachPartnerId] = useState('topfifty')
  const [outreachRole, setOutreachRole] = useState('')
  const [outreachRefCode, setOutreachRefCode] = useState('')
  const [outreachSubject, setOutreachSubject] = useState('')
  const [outreachBody, setOutreachBody] = useState('')
  const [isOutreachLogging, setIsOutreachLogging] = useState(false)
  const [copiedOutreachMail, setCopiedOutreachMail] = useState(false)
  const [outreachSuccessMessage, setOutreachSuccessMessage] = useState('')

  // Harter Reputationsschutz ('Kalter Kaffee' Warn-Modal vor Export / Weitergabe bei >48h)
  const [staleWarningModal, setStaleWarningModal] = useState(null)

  // DealCoach Stufe 2: Übertrag in Harros Prüf-Inbox
  const [isSubmittingReview, setIsSubmittingReview] = useState(false)

  const resolveOppCompanyHelper = (o) => {
    if (!o) return '';
    let name = resolveTriggerCompanyName(
      o.triggers?.[0]?.nexus_trigger_events,
      o,
      o.nexus_companies?.name || o.company?.name || ''
    );
    if (!name || name === 'Unternehmen' || name === 'Unbekanntes Unternehmen') {
      const m = (o.title || '').match(/^\[[A-Z0-9_\-]+\]\s*([^:]+):/i);
      if (m && m[1].trim()) {
        name = m[1].trim();
      }
    }
    return (name && name !== 'Unternehmen' && name !== 'Unbekanntes Unternehmen') ? name.trim() : '';
  };

  const isStrictValidOpportunityHelper = (o) => {
    if (!o) return false;
    const comp = resolveOppCompanyHelper(o);
    if (!comp || isPlaceholderCompany(comp)) return false;
    const eventText = (o.triggers?.[0]?.nexus_trigger_events?.content || o.situation || o.title || '').trim();
    if (!eventText || eventText.toLowerCase() === 'keine angabe' || eventText.length < 5) return false;
    if (o.source && (o.source.endsWith('...') || o.source.endsWith('…'))) return false;
    return true;
  };

  // 1-Klick-Triage: Ausführung von Verwerfen, Boutique-Pool oder Tier-1 mit automatischem Sprung zum nächsten Fall
  const handleTriageAction = async (actionType, oppToProcess = null) => {
    const currentOpp = oppToProcess || activeOpp;
    if (!currentOpp?.id) return;
    const targetId = currentOpp.id;

    // 1. Berechne sofort den NÄCHSTEN Fall in der aktuellen Ansicht für flüssiges Weiterblättern
    const validOpps = (opportunities || []).filter(isStrictValidOpportunityHelper);
    let currentList = [];
    if (queueFilter === 'inbox') {
      currentList = validOpps.filter(o => o.review_status === 'pending' || o.review_status === 'PENDING_REVIEW' || o.review_status === 'unreviewed');
    } else if (queueFilter === 'rejected') {
      currentList = validOpps.filter(o => o.review_status === 'rejected' || o.review_status === 'DISMISSED');
    } else if (queueFilter === 'relevant') {
      currentList = validOpps.filter(o => (o.review_status === 'verified' || o.review_status === 'reviewed' || o.review_status === 'QUALIFIED') && computeTargetMatchScore(resolveOppCompanyHelper(o), o.lead_score, o) >= 50);
    } else if (queueFilter === 'unclear') {
      currentList = validOpps.filter(o => (o.review_status === 'verified' || o.review_status === 'reviewed' || o.review_status === 'QUALIFIED') && computeTargetMatchScore(resolveOppCompanyHelper(o), o.lead_score, o) < 50);
    } else {
      currentList = validOpps.filter(o => o.review_status === 'verified' || o.review_status === 'reviewed' || o.review_status === 'QUALIFIED');
    }

    const currentIndex = currentList.findIndex(o => o.id === targetId);
    const remainingList = currentList.filter(o => o.id !== targetId);
    let nextOpp = null;
    if (remainingList.length > 0) {
      if (currentIndex >= 0 && currentIndex < remainingList.length) {
        nextOpp = remainingList[currentIndex];
      } else {
        nextOpp = remainingList[0];
      }
    }

    // Sofortige UI-Reaktion: Zum nächsten Fall springen
    if (nextOpp) {
      setActiveOppId(nextOpp.id);
      setActiveOpp(nextOpp);
    } else {
      setActiveOppId(null);
      setActiveOpp(null);
    }

    // 2. DB-Updates zusammenstellen
    const now = new Date().toISOString();
    let updates = {};
    if (actionType === 'dismiss') {
      updates = {
        review_status: 'rejected',
        review_notes: 'Signal im Mandats-Desk verworfen - Harro Goerndt',
        reviewed_at: now
      };
    } else if (actionType === 'boutique_tier2') {
      const existingTags = Array.isArray(currentOpp.tags) ? currentOpp.tags : [];
      const newTags = Array.from(new Set([...existingTags, 'Boutique_Pool', 'TIER_2_MID']));
      updates = {
        pipeline_stage: 'boutique_pool',
        review_status: 'verified',
        priority: 'TIER_2_MID',
        tags: newTags,
        review_notes: 'In Boutique-Pool (Tier 2) überführt zur Zweitverwertung - Harro Goerndt',
        reviewed_at: now
      };
    } else if (actionType === 'priority_tier1') {
      const existingTags = Array.isArray(currentOpp.tags) ? currentOpp.tags : [];
      const newTags = Array.from(new Set([...existingTags, 'taskforce', 'TIER_1_TOP']));
      updates = {
        pipeline_stage: 'opportunity',
        review_status: 'verified',
        priority: 'TIER_1_TOP',
        tags: newTags,
        review_notes: 'Als Tier-1 qualifiziert für Groß-Provider (taskforce) - Harro Goerndt',
        reviewed_at: now
      };
    }

    // 3. In DB speichern
    try {
      await db.updateOpportunity(targetId, updates);
      if (refreshData) {
        await refreshData();
      }
    } catch (err) {
      console.error('Fehler bei handleTriageAction:', err);
    }
  };

  // Automatische Vorauswahl des ersten Falls bei leerer Auswahl
  useEffect(() => {
    if (!activeOppId && opportunities && opportunities.length > 0) {
      const valid = opportunities.filter(isStrictValidOpportunityHelper);
      const firstInbox = valid.find(o => o.review_status === 'pending' || o.review_status === 'PENDING_REVIEW' || o.review_status === 'unreviewed');
      const candidate = firstInbox || valid[0];
      if (candidate) {
        setActiveOppId(candidate.id);
        setActiveOpp(candidate);
      }
    }
  }, [activeOppId, opportunities]);


  useEffect(() => {
    if (oppIdFromUrl) {
      setActiveOppId(oppIdFromUrl)
      const target = opportunities.find(o => o.id === oppIdFromUrl)
      if (target) {
        setActiveOpp(target)
        if (target.review_status === 'verified' || target.pipeline_stage === 'opportunity') {
          setQueueFilter('relevant')
        }
      }
    }
  }, [oppIdFromUrl, opportunities])

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

  // Synchronisiere Outreach-Formular bei aktivem Lead oder Partnerwechsel
  useEffect(() => {
    if (!activeOpp) return;
    const partner = OUTREACH_PARTNERS.find(p => p.id === outreachPartnerId) || OUTREACH_PARTNERS[0];
    const isSwiss = (activeOpp.country === 'CH' || (activeOpp.title || '').includes('[CH]') || (activeOpp.situation || '').includes('Zug') || (activeOpp.situation || '').includes('Schweiz'));
    
    // Bestehenden RefCode aus Tags suchen oder generieren
    const existingRefTag = Array.isArray(activeOpp.tags) ? activeOpp.tags.find(t => t.startsWith('CH-') || t.startsWith('INT-')) : null;
    let refCode = existingRefTag;
    if (!refCode) {
      if (partner.lang === 'en') {
        refCode = `INT-CH-2026-${activeOpp.id ? activeOpp.id.slice(0, 3).toUpperCase() : '081'}`;
      } else {
        refCode = `CH-ZG-2026-VR-${activeOpp.id ? activeOpp.id.slice(0, 2).toUpperCase() : '01'}`;
      }
    }

    // Role aus Trigger/Situation parsen
    const parsedRole = (() => {
      const sit = activeOpp.situation || '';
      const mRole = sit.match(/\[ROLE\]:\s*([^\n\r]+)/i);
      if (mRole) return mRole[1].trim();
      const mOrgan = sit.match(/\b(Mitglied des Verwaltungsrates|Präsident des Verwaltungsrates|Verwaltungsrat|Vorstand|CEO|CFO|CRO)\b/i);
      return mOrgan ? mOrgan[0].trim() : 'Interim Board Member / Governance & Transition Lead';
    })();
    setOutreachRole(parsedRole);
    setOutreachRefCode(refCode);

    // Segment & Incident
    const segment = (activeOpp.industry && activeOpp.industry !== 'B2B & Industrie') ? activeOpp.industry : 'Digital Commerce / Video-Tech (Scale-up)';
    const region = isSwiss ? 'Kanton Zug (Schweiz)' : 'DACH / Zentraleuropa';
    const incident = 'Akutes Ausscheiden Verwaltungsrat mit Einzelunterschrift per sofort / Vakanz';

    if (partner.lang === 'en') {
      const { subject, body } = generateEnglishOutreachEmail({ partner, refCode, region, segment, role: parsedRole, incident });
      setOutreachSubject(subject);
      setOutreachBody(body);
    } else {
      const { subject, body } = generateGermanOutreachEmail({ partner, refCode, region, segment, role: parsedRole, incident });
      setOutreachSubject(subject);
      setOutreachBody(body);
    }
  }, [activeOpp?.id, outreachPartnerId])

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

  // DealCoach Stufe 2: Lead zur menschlichen Prüfung in Harros Prüf-Inbox vorlegen
  const handleSubmitToHumanReview = async (opp = null, e = null) => {
    if (e) e.stopPropagation();
    const target = opp || activeOpp;
    if (!target || !target.id) return;

    setIsSubmittingReview(true);
    try {
      const nowIso = new Date().toISOString();
      const existingNotes = target.review_notes || '';
      const auditNote = `[DealCoach Revisions-Audit]: Zur menschlichen Prüfung in Harros Prüf-Inbox vorgelegt am ${new Date().toLocaleString('de-DE')}`;
      const noteToSave = existingNotes.includes('Zur menschlichen Prüfung in Harros Prüf-Inbox vorgelegt')
        ? existingNotes
        : (existingNotes ? `${existingNotes}\n${auditNote}` : auditNote);

      let updates = {
        review_status: 'pending',
        pipeline_stage: 'review',
        review_notes: noteToSave
      };

      await db.updateOpportunity(target.id, updates);
      if (refreshData) await refreshData();

      setActiveOpp(prev => (prev && prev.id === target.id) ? { ...prev, ...updates } : prev);
      setQueueFilter('inbox');
      setActiveTab('pruefung');
    } catch (err) {
      console.error('Error submitting lead to human review:', err);
      alert('Fehler beim Vorlegen zur Prüfung: ' + (err.message || 'Unbekannter Fehler'));
    } finally {
      setIsSubmittingReview(false);
    }
  };

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

    try {
      return buildSignalPayload({
        opportunity: targetOpp,
        trigger: triggerWithOverrides,
        foundContact,
        analystName: 'Harro Goerndt',
        verificationNote: reviewNotes || 'Primärquelle verifiziert – 100% faktengeprüft',
        overrideCompany: compName
      });
    } catch (e) {
      console.warn('[BlindProfile] Error generating payload:', e);
      return null;
    }
  };

  const handleCopyBlindProfileText = (targetOpp = activeOpp, targetTrigger = activeTrigger, force = false) => {
    if (!force) {
      const dateVal = targetTrigger?.event_date || targetOpp?.event_date || targetTrigger?.published_at || targetTrigger?.created_at || targetOpp?.created_at;
      const traffic = getFreshnessTrafficLight(dateVal);
      if (traffic.isStale) {
        setStaleWarningModal({
          title: `🚨 Veraltetes Signal (${traffic.label})`,
          traffic,
          actionName: 'Blind-Profil kopieren',
          onConfirm: () => handleCopyBlindProfileText(targetOpp, targetTrigger, true)
        });
        return;
      }
    }
    const data = getBlindProfileData(targetOpp, targetTrigger);
    if (!data) return;
    const t = data.teaser;
    const warningPrefix = force ? `⚠️ [WARNUNG: SIGNAL ÄLTER ALS 48H - REPUTATIONSRISIKO]\n\n` : '';
    const text = `${warningPrefix}🔒 EXKLUSIVES MANDATS-SIGNAL (ANONYMISIERTES BLIND-PROFIL)
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

⚖️ 100% DSGVO-konform · Primärquelle verifiziert durch Harro Goerndt · D.A.T. Mandats-Desk`;

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

  const handleOpenDispatchModal = (force = false) => {
    if (!activeOpp) return;
    if (!force) {
      const dateVal = activeTrigger?.event_date || activeOpp?.event_date || activeTrigger?.published_at || activeTrigger?.created_at || activeOpp?.created_at;
      const traffic = getFreshnessTrafficLight(dateVal);
      if (traffic.isStale) {
        setStaleWarningModal({
          title: `🚨 Veraltetes Signal (${traffic.label})`,
          traffic,
          actionName: 'Mandat an Partner übermitteln',
          onConfirm: () => handleOpenDispatchModal(true)
        });
        return;
      }
    }
    const resolvedRole = activeOpp.title?.includes(':') ? activeOpp.title.split(':')[1].trim() : (activeOpp.situation || 'C-Level Organvakanz');
    setDispatchRole(resolvedRole);
    setDispatchSuccess(false);
    setShowDispatchModal(true);
  };

  const handleDirectPublish = (force = false) => handleOpenDispatchModal(force);

  const handleConfirmDispatch = async () => {
    if (!activeOpp) return;
    setIsDirectPublishing(true);
    try {
      const compName = resolveTriggerCompanyName(activeTrigger, activeOpp) || activeOpp.nexus_companies?.name || activeOpp.title || 'Mandat';
      const now = new Date();
      const protectionUntil = new Date(now);
      protectionUntil.setFullYear(protectionUntil.getFullYear() + 1);

      const entry = {
        id: `arch-${Date.now()}`,
        company: compName,
        countryMarket: activeOpp.country || 'DE · Prime Standard',
        role: dispatchRole || 'Interim Organ / C-Level',
        transmittedTo: dispatchPartner,
        transmittedAt: now.toISOString(),
        protectionUntil: protectionUntil.toISOString(),
        status: 'AKTIV_GESCHUETZT',
        notes: `Aus Mandats-Desk an ${dispatchPartner} übermittelt.`,
        source: activeTrigger?.source || activeOpp.source || 'EQS / Primärquelle'
      };

      // Speichere in Mandats-Archiv (localStorage)
      try {
        const existing = JSON.parse(localStorage.getItem('nexus:mandate_archive_v1') || '[]');
        const updated = [entry, ...existing.filter(e => e.id !== entry.id)];
        localStorage.setItem('nexus:mandate_archive_v1', JSON.stringify(updated));
      } catch (e) {
        console.warn('Archive save error:', e);
      }

      // Aktualisiere Status in Supabase
      try {
        await db.updateOpportunity(activeOpp.id, {
          pipeline_stage: 'dispatched',
          review_status: 'verified',
          review_notes: `An Partner übermittelt: ${dispatchPartner}. 12 Monate Kundenschutz bis ${protectionUntil.toLocaleDateString('de-DE')}.`
        });
        setActiveOpp(prev => ({ ...prev, pipeline_stage: 'dispatched', review_status: 'verified' }));
      } catch (e) {
        console.warn('DB update error on dispatch:', e);
      }

      // Blind-Profil zur sofortigen Weitergabe kopieren
      const blind = getBlindProfileData(activeOpp, activeTrigger);
      if (blind?.teaser) {
        const text = `🔒 EXKLUSIVES MANDATS-SIGNAL (D.A.T. MANDATS-DESK)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🏢 Mandant / Zielprofil: ${blind.teaser.headline}
📍 Region & Branche: ${blind.teaser.industry}
📊 Transaktionsphase: ${blind.teaser.lifecycleBadge} · ${blind.teaser.signalCategory}
⚠️ Handlungsdruck & Organvakanz:
${blind.teaser.eventSummary}

🎯 Übermittelt an Partner: ${dispatchPartner}
⚖️ 12 Monate Kundenschutz aktiv bis: ${protectionUntil.toLocaleDateString('de-DE')}
Primärquelle verifiziert durch Harro Goerndt · D.A.T. Dienstleistungen`;

        navigator.clipboard.writeText(text);
        setCopiedDispatchBlind(true);
      }

      setDispatchSuccessData({
        company: compName,
        partner: dispatchPartner,
        protectionDate: protectionUntil.toLocaleDateString('de-DE')
      });
      setDispatchSuccess(true);
    } catch (err) {
      console.error('Dispatch error:', err);
      alert('Fehler beim Protokollieren der Übermittlung.');
    } finally {
      setIsDirectPublishing(false);
    }
  };

  const handleExecuteOutreach = async () => {
    if (!activeOpp) return;
    setIsOutreachLogging(true);
    setOutreachSuccessMessage('');
    try {
      const partner = OUTREACH_PARTNERS.find(p => p.id === outreachPartnerId) || OUTREACH_PARTNERS[0];
      const oppId = activeOpp.id;
      const now = new Date();
      const protectionDate = new Date(now);
      if (partner.exclusivityHours) {
        protectionDate.setHours(protectionDate.getHours() + partner.exclusivityHours);
      } else {
        protectionDate.setDate(protectionDate.getDate() + (partner.exclusivityDays || 14));
      }
      const longProtection = new Date(now);
      longProtection.setFullYear(longProtection.getFullYear() + 1);

      const compName = resolveOppCompanyHelper(activeOpp) || activeOpp.nexus_companies?.name || activeOpp.title || 'Mandat';

      // 1. In Supabase nexus_activities speichern
      const activityPayload = {
        entity_type: 'opportunity',
        entity_id: oppId,
        opportunity_id: oppId,
        user_id: user?.id || '976e6211-8931-425a-a171-0c062290181b',
        actor_type: 'USER',
        actor_name: 'Harro Goerndt',
        activity_type: 'email_sent',
        description: `Original-Ansprache versendet: ${partner.name} · ${partner.contactPerson} (${partner.email}) | Ref: ${outreachRefCode} · ${partner.statusLabel}`,
        metadata: {
          recipient: partner.contactPerson,
          organization: partner.name,
          email: partner.email,
          location: partner.location,
          role: outreachRole,
          subject: outreachSubject,
          body: outreachBody,
          reference_code: outreachRefCode,
          target_company: compName,
          status: partner.status,
          sent_at: now.toISOString(),
          protection_until: protectionDate.toISOString()
        }
      };

      try {
        await supabase.from('nexus_activities').insert(activityPayload);
      } catch (e) {
        console.warn('nexus_activities insert warning:', e);
      }

      // 2. nexus_opportunities updaten
      const existingTags = Array.isArray(activeOpp.tags) ? activeOpp.tags : [];
      const updatedTags = Array.from(new Set([
        ...existingTags,
        partner.status,
        partner.name.replace(/\s+/g, '_'),
        outreachRefCode,
        'contacted'
      ]));

      try {
        await db.updateOpportunity(oppId, {
          pipeline_stage: 'contacted',
          review_status: 'verified',
          tags: updatedTags,
          review_notes: `[Outreach Journal]: Angeboten an ${partner.contactPerson} (${partner.name}) · Ref: ${outreachRefCode} · Status: ${partner.status} bis ${protectionDate.toLocaleDateString('de-DE')}`
        });
        setActiveOpp(prev => ({
          ...prev,
          pipeline_stage: 'contacted',
          review_status: 'verified',
          tags: updatedTags
        }));
      } catch (e) {
        console.warn('db.updateOpportunity warning:', e);
      }

      // 3. localStorage nexus:outreach_journal_v1 updaten
      try {
        const existingJournal = JSON.parse(localStorage.getItem('nexus:outreach_journal_v1') || '[]');
        const journalEntry = {
          id: `act-${Date.now()}`,
          leadId: oppId,
          company: compName,
          partnerId: partner.id,
          recipient: partner.contactPerson,
          organization: partner.name,
          email: partner.email,
          referenceCode: outreachRefCode,
          role: outreachRole,
          subject: outreachSubject,
          body: outreachBody,
          status: partner.status,
          sentAt: now.toISOString(),
          protectionUntil: protectionDate.toISOString(),
          blindProfile: {
            entityType: 'Aktiengesellschaft (AG)',
            region: partner.location.includes('Schweiz') ? 'Kanton Zug (Schweiz)' : 'Schweiz / Greater Zurich Area',
            industry: 'Digital Commerce / Video-Tech (Scale-up)',
            incident: 'Akutes Ausscheiden Verwaltungsrat mit Einzelunterschrift per sofort / Vakanz',
            situationAnalysis: 'Organ-Vakuum bei schweizerischer Technologie-AG ohne geregelte Nachfolge.',
            mandateAngle: outreachRole,
            budgetRange: 'Auf Anfrage / Marktüblich',
            exclusivityClause: `${partner.statusLabel} bis ${protectionDate.toLocaleDateString('de-DE')}`
          }
        };
        localStorage.setItem('nexus:outreach_journal_v1', JSON.stringify([journalEntry, ...existingJournal.filter(j => j.id !== journalEntry.id)]));
      } catch (e) {
        console.warn('localStorage journal update warning:', e);
      }

      // 4. localStorage nexus:mandate_archive_v1 updaten
      try {
        const existingArchive = JSON.parse(localStorage.getItem('nexus:mandate_archive_v1') || '[]');
        const archiveEntry = {
          id: `arch-${Date.now()}`,
          leadId: oppId,
          company: compName,
          countryMarket: partner.location.includes('Schweiz') ? 'CH · Zug (SHAB)' : 'CH / UK · Cross-Border',
          role: outreachRole,
          transmittedTo: `${partner.name} · ${partner.contactPerson}`,
          transmittedAt: now.toISOString(),
          protectionUntil: longProtection.toISOString(),
          status: 'ANGEBOTEN_RESERVIERT',
          notes: `${partner.statusLabel} bis ${protectionDate.toLocaleDateString('de-DE')}. Ref. ${outreachRefCode}`,
          source: activeTrigger?.source || activeOpp.source || 'SHAB-Mutation'
        };
        localStorage.setItem('nexus:mandate_archive_v1', JSON.stringify([archiveEntry, ...existingArchive.filter(a => a.id !== archiveEntry.id)]));
      } catch (e) {
        console.warn('localStorage archive update warning:', e);
      }

      // 5. In Zwischenablage kopieren
      navigator.clipboard.writeText(outreachBody);
      setCopiedOutreachMail(true);
      setOutreachSuccessMessage(`✅ Outreach an ${partner.name} erfolgreich protokolliert! E-Mail-Text in Zwischenablage kopiert & 12 Monate Kundenschutz gesichert.`);
      if (refreshData) await refreshData();
    } catch (err) {
      console.error('Outreach execution error:', err);
      alert('Fehler beim Protokollieren des Outreach: ' + err.message);
    } finally {
      setIsOutreachLogging(false);
    }
  };

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

  const handleCopyMessage = (force = false) => {
    if (!force) {
      const dateVal = activeTrigger?.event_date || activeOpp?.event_date || activeTrigger?.published_at || activeTrigger?.created_at || activeOpp?.created_at;
      const traffic = getFreshnessTrafficLight(dateVal);
      if (traffic.isStale) {
        setStaleWarningModal({
          title: `🚨 Veraltetes Signal (${traffic.label})`,
          traffic,
          actionName: 'Nachricht kopieren',
          onConfirm: () => handleCopyMessage(true)
        });
        return;
      }
    }
    const warningPrefix = force ? `⚠️ [WARNUNG: SIGNAL ÄLTER ALS 48H - REPUTATIONSRISIKO]\n\n` : '';
    const text = editedMessage || generatedMessage?.message || '';
    navigator.clipboard.writeText(warningPrefix + text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyPackage = (text, force = false) => {
    if (!text) return;
    if (!force) {
      const dateVal = activeTrigger?.event_date || activeOpp?.event_date || activeTrigger?.published_at || activeTrigger?.created_at || activeOpp?.created_at;
      const traffic = getFreshnessTrafficLight(dateVal);
      if (traffic.isStale) {
        setStaleWarningModal({
          title: `🚨 Veraltetes Signal (${traffic.label})`,
          traffic,
          actionName: 'Lead-Paket kopieren',
          onConfirm: () => handleCopyPackage(text, true)
        });
        return;
      }
    }
    const warningPrefix = force ? `⚠️ [WARNUNG: SIGNAL ÄLTER ALS 48H - REPUTATIONSRISIKO]\n\n` : '';
    navigator.clipboard.writeText(warningPrefix + text);
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

  const handleCopy = async (force = false) => {
    try {
      if (!force) {
        const dateVal = activeTrigger?.event_date || activeOpp?.event_date || activeTrigger?.published_at || activeTrigger?.created_at || activeOpp?.created_at;
        const traffic = getFreshnessTrafficLight(dateVal);
        if (traffic.isStale) {
          setStaleWarningModal({
            title: `🚨 Veraltetes Signal (${traffic.label})`,
            traffic,
            actionName: 'Pitch kopieren',
            onConfirm: () => handleCopy(true)
          });
          return;
        }
      }
      let textToCopy = result;
      if (typeof result === 'object') {
        textToCopy = result.response || result.nachricht || result.message || result.text || result.antwort || result.pitch || JSON.stringify(result, null, 2);
      }
      const warningPrefix = force ? `⚠️ [WARNUNG: SIGNAL ÄLTER ALS 48H - REPUTATIONSRISIKO]\n\n` : '';
      await navigator.clipboard.writeText(warningPrefix + textToCopy);
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
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', flexWrap: 'wrap' }}>
                      {(() => {
                        const traffic = getFreshnessTrafficLight(dateVal);
                        return (
                          <span 
                            className={`badge-freshness ${traffic.badgeClass}`}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              padding: '2px 7px',
                              borderRadius: '4px',
                              fontSize: '0.74rem',
                              fontWeight: 700,
                              background: traffic.color === 'green' ? 'rgba(34, 197, 94, 0.15)' : traffic.color === 'yellow' ? 'rgba(234, 179, 8, 0.18)' : 'rgba(239, 68, 68, 0.2)',
                              color: traffic.color === 'green' ? '#4ade80' : traffic.color === 'yellow' ? '#facc15' : '#f87171',
                              border: `1px solid ${traffic.color === 'green' ? 'rgba(34, 197, 94, 0.35)' : traffic.color === 'yellow' ? 'rgba(234, 179, 8, 0.4)' : 'rgba(239, 68, 68, 0.45)'}`
                            }}
                            title={traffic.tooltip}
                          >
                            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: traffic.color === 'green' ? '#22c55e' : traffic.color === 'yellow' ? '#eab308' : '#ef4444' }} />
                            {traffic.label}
                          </span>
                        );
                      })()}
                      {dateInfo && (
                        <span style={{ color: 'var(--text-secondary)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          <Clock size={12} /> {dateInfo.relativeTime}
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
            const resolveOppCompany = resolveOppCompanyHelper;
            const isStrictValidOpportunity = isStrictValidOpportunityHelper;

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
              const resolveOppCompany = resolveOppCompanyHelper;
              const isStrictValidOpportunity = isStrictValidOpportunityHelper;

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
                const compName = resolveOppCompanyHelper(opp);
                const country = getCountryFlag(opp);
                const dateVal = opp.event_date || opp.triggers?.[0]?.nexus_trigger_events?.event_date || opp.published_at || opp.created_at;
                const traffic = getFreshnessTrafficLight(dateVal);
                const audit = extractDealCoachAudit(opp);
                const isT1 = audit?.tier === 'TIER_1_TOP';
                const isT2 = audit?.tier === 'TIER_2_MID';

                return (
                  <div 
                    key={opp.id} 
                    className={`queue-item ${activeOppId === opp.id ? 'active' : ''}`}
                    onClick={() => {
                      setActiveOppId(opp.id);
                      setActiveOpp(opp);
                    }}
                    style={{ cursor: 'pointer', padding: '12px 14px' }}
                  >
                    <div className="queue-item-content">
                      <div className="queue-item-header" style={{ marginBottom: '8px' }}>
                        <h4 style={{
                          fontSize: '0.96rem',
                          fontWeight: 700,
                          color: 'var(--text-primary, #0f172a)',
                          margin: 0,
                          lineHeight: 1.35,
                          wordBreak: 'break-word',
                          whiteSpace: 'normal',
                          overflow: 'visible',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px'
                        }}>
                          <span style={{ fontSize: '1.2rem', lineHeight: 1, flexShrink: 0 }} title={country.label}>{country.flag}</span>
                          <span>{compName || '-'}</span>
                        </h4>
                      </div>

                      <div className="queue-item-meta" style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                        {/* Frische-Zeitstempel mit Ampel-Punkt */}
                        <span 
                          className={`queue-badge-freshness ${traffic.badgeClass}`}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px',
                            padding: '2px 8px',
                            borderRadius: '4px',
                            fontSize: '0.74rem',
                            fontWeight: 700,
                            background: traffic.color === 'green' ? 'rgba(34, 197, 94, 0.15)' : traffic.color === 'yellow' ? 'rgba(234, 179, 8, 0.18)' : 'rgba(239, 68, 68, 0.2)',
                            color: traffic.color === 'green' ? '#4ade80' : traffic.color === 'yellow' ? '#facc15' : '#f87171',
                            border: `1px solid ${traffic.color === 'green' ? 'rgba(34, 197, 94, 0.35)' : traffic.color === 'yellow' ? 'rgba(234, 179, 8, 0.4)' : 'rgba(239, 68, 68, 0.45)'}`
                          }}
                          title={traffic.tooltip}
                        >
                          <span style={{
                            width: '6px',
                            height: '6px',
                            borderRadius: '50%',
                            background: traffic.color === 'green' ? '#22c55e' : traffic.color === 'yellow' ? '#eab308' : '#ef4444',
                            display: 'inline-block'
                          }} />
                          {traffic.label}
                        </span>

                        {/* DealCoach Einstufung */}
                        <span 
                          className={`queue-badge-tier ${isT1 ? 'tier-1' : isT2 ? 'tier-2' : 'tier-review'}`}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '2px 8px',
                            borderRadius: '4px',
                            fontSize: '0.74rem',
                            fontWeight: 700,
                            background: isT1 ? 'rgba(168, 85, 247, 0.2)' : isT2 ? 'rgba(59, 130, 246, 0.2)' : 'rgba(148, 163, 184, 0.15)',
                            color: isT1 ? '#c084fc' : isT2 ? '#60a5fa' : '#cbd5e1',
                            border: `1px solid ${isT1 ? 'rgba(168, 85, 247, 0.45)' : isT2 ? 'rgba(59, 130, 246, 0.4)' : 'rgba(148, 163, 184, 0.3)'}`
                          }}
                        >
                          {isT1 ? '👑 TIER 1' : isT2 ? '🏢 TIER 2' : '⚖️ Zur Prüfung'}
                        </span>
                      </div>
                    </div>
                    <button 
                      className="delete-opp-btn"
                      title="Lead löschen"
                      onClick={(e) => {
                        e.stopPropagation();
                        if(window.confirm('Lead wirklich löschen?')) {
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

        {/* ── MANDATS-DESK: KLIENTEN-PULT (1-KLICK-TRIAGE) ── */}
        {activeOpp ? (() => {
          const compName = resolveOppCompanyHelper(activeOpp);
          const country = getCountryFlag(activeOpp);
          const legalForm = getLegalForm(compName, activeOpp);
          const audit = extractDealCoachAudit(activeOpp);
          const tier = audit?.tier || 'PRÜFUNG_EMPFOHLEN';
          const isTier1 = tier === 'TIER_1_TOP';
          const isTier2 = tier === 'TIER_2_MID';
          const isTier3 = tier === 'TIER_3';

          const dateVal = activeOpp.event_date || activeOpp.triggers?.[0]?.nexus_trigger_events?.event_date || activeOpp.published_at || activeOpp.created_at;
          const traffic = getFreshnessTrafficLight(dateVal);
          const dateFormatted = formatEventDate(dateVal).formattedDate;

          const rawSituation = activeOpp.situation || activeTrigger?.content || activeOpp.title || '';
          const cleanAnnouncement = extractCleanAnnouncementText(rawSituation, activeOpp.title);

          const sourceUrl = activeOpp.source || activeTrigger?.source_url || activeTrigger?.source;
          const hasValidSource = sourceUrl && sourceUrl.startsWith('http');
          const domain = hasValidSource ? extractDomain(sourceUrl) : 'Originalquelle';

          return (
            <div className="mandats-desk-pult" style={{
              display: 'flex',
              flexDirection: 'column',
              flex: 1,
              gap: '20px',
              background: 'var(--bg-card, #11141a)',
              border: '1px solid var(--border-medium, #1e232d)',
              borderRadius: '16px',
              padding: '24px',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
              minWidth: 0,
              position: 'relative'
            }}>
              {/* ── RADAR-HERKUNFT BANNER MIT ZURÜCK-BUTTON ── */}
              {activeOpp?._fromRadar && (
                <div className="radar-imported-banner" style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 18px',
                  background: 'rgba(56, 189, 248, 0.1)',
                  border: '1px solid rgba(56, 189, 248, 0.3)',
                  borderRadius: '10px',
                  color: '#38bdf8',
                  fontSize: '0.86rem',
                  marginBottom: '10px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <Radar size={18} />
                    <span>
                      Echtzeit-Signal aus Primär-Radar importiert: <strong>{resolveOppCompanyHelper(activeOpp)}</strong>
                      {' '}(Publiziert am {dateFormatted})
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => navigate('/nexus/events')}
                    style={{
                      background: 'rgba(56, 189, 248, 0.2)',
                      border: '1px solid rgba(56, 189, 248, 0.4)',
                      color: '#f8fafc',
                      borderRadius: '6px',
                      padding: '5px 12px',
                      fontSize: '0.8rem',
                      fontWeight: '600',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                  >
                    <ArrowRight size={14} style={{ transform: 'rotate(180deg)' }} /> Zurück zum Primär-Radar (Beleg)
                  </button>
                </div>
              )}

              {/* ── 1. STAMMDATEN CARD ── */}
              <div className="pult-stammdaten-card" style={{
                background: '#0e1015',
                border: '1px solid #1e232d',
                borderRadius: '12px',
                padding: '20px 24px',
                display: 'flex',
                flexDirection: 'column',
                gap: '14px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                      <span style={{ fontSize: '1.75rem', lineHeight: 1 }} title={country.label}>{country.flag}</span>
                      <h2 style={{
                        margin: 0,
                        fontSize: '1.45rem',
                        fontWeight: 800,
                        color: '#f8fafc',
                        letterSpacing: '-0.02em',
                        wordBreak: 'break-word',
                        lineHeight: 1.25
                      }}>
                        {compName || '-'}
                      </h2>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', fontSize: '0.88rem', color: '#94a3b8' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                        <Globe size={15} color="#60a5fa" />
                        <strong style={{ color: '#cbd5e1' }}>Land:</strong> {country.label} ({country.code})
                      </span>
                      <span>•</span>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                        <Briefcase size={15} color="#a855f7" />
                        <strong style={{ color: '#cbd5e1' }}>Rechtsform:</strong> {legalForm}
                      </span>
                      <span>•</span>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                        <Clock size={15} color="#facc15" />
                        <strong style={{ color: '#cbd5e1' }}>Publikation:</strong> {dateFormatted} ({traffic.label})
                      </span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                    {/* Prominenter Action-Button: Dossier & Teaser öffnen */}
                    <button
                      type="button"
                      onClick={() => {
                        setShowBlindProfileModal(true);
                        setBlindProfileTab('teaser');
                      }}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '9px 18px',
                        background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                        border: '1px solid #38bdf8',
                        borderRadius: '8px',
                        color: '#ffffff',
                        fontWeight: 700,
                        fontSize: '0.88rem',
                        cursor: 'pointer',
                        boxShadow: '0 4px 14px rgba(2, 132, 199, 0.4)',
                        transition: 'all 0.2s ease'
                      }}
                      title="Dossier & Anonymisiertes 1-Page Blind-Profil öffnen"
                    >
                      <FileText size={16} />
                      <span>📄 Dossier &amp; Teaser öffnen</span>
                    </button>

                    {/* Link zur Originalmeldung */}
                    {hasValidSource ? (
                      <a
                        href={sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '8px',
                          padding: '9px 16px',
                          background: 'rgba(56, 189, 248, 0.1)',
                          border: '1px solid rgba(56, 189, 248, 0.4)',
                          borderRadius: '8px',
                          color: '#38bdf8',
                          fontWeight: 700,
                          fontSize: '0.86rem',
                          textDecoration: 'none',
                          transition: 'all 0.2s ease',
                          boxShadow: '0 2px 10px rgba(56, 189, 248, 0.1)'
                        }}
                        title={`Originalquelle öffnen (${domain})`}
                      >
                        <span>Originalmeldung öffnen ({domain})</span>
                        <ExternalLink size={15} />
                      </a>
                    ) : (
                      <span style={{ color: '#64748b', fontSize: '0.84rem', fontStyle: 'italic' }}>
                        Keine externe Primärquelle
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* ── 2. DEALCOACH-AUDIT CARD ── */}
              <div className="pult-dealcoach-audit" style={{
                background: isTier1
                  ? 'linear-gradient(135deg, rgba(88, 28, 135, 0.18) 0%, #0e1015 100%)'
                  : isTier2
                  ? 'linear-gradient(135deg, rgba(30, 58, 138, 0.18) 0%, #0e1015 100%)'
                  : isTier3
                  ? 'linear-gradient(135deg, rgba(239, 68, 68, 0.15) 0%, #0e1015 100%)'
                  : 'linear-gradient(135deg, rgba(51, 65, 85, 0.2) 0%, #0e1015 100%)',
                border: `1px solid ${isTier1 ? 'rgba(168, 85, 247, 0.4)' : isTier2 ? 'rgba(59, 130, 246, 0.4)' : isTier3 ? 'rgba(239, 68, 68, 0.4)' : 'rgba(148, 163, 184, 0.3)'}`,
                borderRadius: '12px',
                padding: '20px 24px',
                display: 'flex',
                flexDirection: 'column',
                gap: '18px'
              }}>
                {/* Audit Header Banner */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{
                      background: isTier1 ? 'rgba(168, 85, 247, 0.25)' : isTier2 ? 'rgba(59, 130, 246, 0.25)' : isTier3 ? 'rgba(239, 68, 68, 0.25)' : 'rgba(148, 163, 184, 0.2)',
                      border: `1px solid ${isTier1 ? '#a855f7' : isTier2 ? '#3b82f6' : isTier3 ? '#ef4444' : '#94a3b8'}`,
                      borderRadius: '8px',
                      padding: '6px 14px',
                      fontSize: '0.92rem',
                      fontWeight: 800,
                      color: isTier1 ? '#f3e8ff' : isTier2 ? '#dbeafe' : isTier3 ? '#fecaca' : '#f1f5f9',
                      letterSpacing: '0.03em'
                    }}>
                      {isTier1 ? '👑 TIER 1 TOP' : isTier2 ? '🏢 TIER 2 MID' : isTier3 ? '🗑️ TIER 3 (AUSGESONDERT)' : '⚖️ PRÜFUNG EMPFOHLEN'}
                    </div>
                    <div>
                      <div style={{ fontSize: '1rem', fontWeight: 800, color: '#f8fafc', letterSpacing: '-0.01em' }}>
                        DealCoach Revisions-Urteil: <span style={{ color: isTier1 ? '#c084fc' : isTier2 ? '#60a5fa' : isTier3 ? '#f87171' : '#cbd5e1' }}>{audit?.verdict || 'VORLÄUFIGE VOREINSCHÄTZUNG'}</span>
                      </div>
                      <div style={{ fontSize: '0.82rem', color: '#94a3b8', marginTop: '2px' }}>
                        Geschätztes Budgetvolumen: <strong style={{ color: isTier3 ? '#f87171' : '#cbd5e1' }}>{audit?.estimated_budget && audit.estimated_budget !== 'Auf Anfrage' && audit.estimated_budget !== '-' ? audit.estimated_budget : '-'}</strong>
                      </div>
                    </div>
                  </div>

                  <div style={{ fontSize: '0.78rem', color: '#64748b', fontStyle: 'italic' }}>
                    Automatisierter Primär-Audit · Harro Revisions-Gate
                  </div>
                </div>

                {/* Was ist passiert? (Original Meldungstext ohne Meta-Tags) */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    📰 Was ist passiert?
                  </div>
                  <div style={{
                    background: '#0a0c0f',
                    border: '1px solid #1e232d',
                    borderRadius: '8px',
                    padding: '14px 18px',
                    color: '#e2e8f0',
                    fontSize: '0.94rem',
                    lineHeight: 1.6,
                    maxHeight: '180px',
                    overflowY: 'auto',
                    whiteSpace: 'pre-wrap'
                  }}>
                    {cleanAnnouncement || activeOpp.title || 'Keine detaillierte Meldung verfügbar.'}
                  </div>
                </div>

                {/* Warum brennt es? (Vakuum- & Dringlichkeits-Audit) */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#facc15', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    🔥 Warum brennt es? (DealCoach Vakuum- & Dringlichkeits-Audit)
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '12px' }}>
                    {/* Vakuum-Check Kachel */}
                    <div style={{ background: '#0a0c0f', border: '1px solid #1e232d', borderRadius: '8px', padding: '12px 16px' }}>
                      <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '4px' }}>
                        ⚡ Vakuum-Check (Organ-Vakanz)
                      </div>
                      <div style={{ fontSize: '0.9rem', color: '#f1f5f9', fontWeight: 600 }}>
                        {audit?.vacuum_check || 'Organ-Position vakant / Stillstand droht'}
                      </div>
                    </div>

                    {/* Dringlichkeit Kachel */}
                    <div style={{ background: '#0a0c0f', border: '1px solid #1e232d', borderRadius: '8px', padding: '12px 16px' }}>
                      <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '4px' }}>
                        🚨 Dringlichkeit & Not-Governance
                      </div>
                      <div style={{ fontSize: '0.9rem', color: '#f1f5f9', fontWeight: 600 }}>
                        {audit?.urgency_check || 'Akute Überbrückung / Ad-hoc Mandatsbedarf per sofort'}
                      </div>
                    </div>
                  </div>

                  {/* Mandats-Begründung / Strategischer Hebel */}
                  {audit?.rationale && (
                    <div style={{ background: '#0a0c0f', border: '1px solid #1e232d', borderRadius: '8px', padding: '12px 16px' }}>
                      <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '4px' }}>
                        💡 Mandats-Begründung / Strategischer Hebel
                      </div>
                      <div style={{ fontSize: '0.9rem', color: '#cbd5e1', lineHeight: 1.5 }}>
                        {audit.rationale}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* ── 3. VIER EINDEUTIGE AKTIONS-BUTTONS AM UNTEREN RAND ── */}
              <div className="pult-action-bar" style={{
                marginTop: 'auto',
                paddingTop: '20px',
                borderTop: '1px solid #1e232d',
                display: 'grid',
                gridTemplateColumns: '1.25fr 1fr 1.2fr 1.2fr',
                gap: '12px'
              }}>
                {/* Button 0: Prominenter Teaser & Dossier Button */}
                <button
                  type="button"
                  onClick={() => {
                    setShowBlindProfileModal(true);
                    setBlindProfileTab('teaser');
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    padding: '14px 18px',
                    borderRadius: '10px',
                    border: '1px solid #38bdf8',
                    background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                    color: '#ffffff',
                    fontSize: '0.95rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    boxShadow: '0 4px 16px rgba(2, 132, 199, 0.4)'
                  }}
                  title="Dossier & Teaser öffnen: 1-Page PDF, Blind-Profil & Outreach-Vorbereitung"
                >
                  <FileText size={18} />
                  <span>📄 Dossier &amp; Teaser</span>
                </button>

                {/* Button 1: Verwerfen */}
                <button
                  type="button"
                  onClick={() => handleTriageAction('dismiss', activeOpp)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    padding: '14px 18px',
                    borderRadius: '10px',
                    border: '1px solid rgba(239, 68, 68, 0.4)',
                    background: 'rgba(239, 68, 68, 0.12)',
                    color: '#f87171',
                    fontSize: '0.95rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    boxShadow: '0 2px 10px rgba(239, 68, 68, 0.1)'
                  }}
                  title="Signal verwerfen und aus dem Posteingang entfernen (springt automatisch zum nächsten Fall)"
                >
                  <X size={18} />
                  <span>❌ Verwerfen</span>
                </button>

                {/* Button 2: In Boutique-Pool (Tier 2) */}
                <button
                  type="button"
                  onClick={() => handleTriageAction('boutique_tier2', activeOpp)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    padding: '14px 18px',
                    borderRadius: '10px',
                    border: '1px solid #3b82f6',
                    background: 'linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%)',
                    color: '#ffffff',
                    fontSize: '0.95rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    boxShadow: '0 4px 16px rgba(37, 99, 235, 0.3)'
                  }}
                  title="In den Boutique-Pool (Mandats-Archiv) für Zweitverwertung verschieben (springt automatisch zum nächsten Fall)"
                >
                  <Briefcase size={18} />
                  <span>🏢 In Boutique-Pool (Tier 2)</span>
                </button>

                {/* Button 3: Als Tier-1 vormerken */}
                <button
                  type="button"
                  onClick={() => handleTriageAction('priority_tier1', activeOpp)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    padding: '14px 18px',
                    borderRadius: '10px',
                    border: '1px solid #a855f7',
                    background: 'linear-gradient(135deg, #6b21a8 0%, #9333ea 100%)',
                    color: '#ffffff',
                    fontSize: '0.95rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    boxShadow: '0 4px 16px rgba(147, 51, 234, 0.3)'
                  }}
                  title="Als Tier-1 für Groß-Provider (taskforce) vormerken (springt automatisch zum nächsten Fall)"
                >
                  <Sparkles size={18} />
                  <span>👑 Als Tier-1 vormerken</span>
                </button>
              </div>
            </div>
          );
        })() : (
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

      {/* ⚖️ Mandats-Übermittlung & 12 Monate Kundenschutz Modal */}
      {showDispatchModal && activeOpp && (
        <div 
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            backgroundColor: 'rgba(15, 23, 42, 0.75)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px'
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowDispatchModal(false)
          }}
        >
          <div 
            style={{
              background: '#ffffff',
              border: '1px solid #cbd5e1',
              borderRadius: '16px',
              maxWidth: '640px',
              width: '100%',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
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
                  <ShieldCheck size={22} color="#ffffff" />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, color: '#ffffff' }}>
                    Mandat an Partner übermitteln & Kundenschutz aktivieren
                  </h3>
                  <p style={{ margin: '2px 0 0 0', fontSize: '0.84rem', color: '#e0f2fe' }}>
                    Rechtssicherer 12-Monate-Kundenschutz nach D.A.T.-Standard im Mandats-Archiv
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowDispatchModal(false)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#ffffff',
                  cursor: 'pointer',
                  padding: '6px',
                  borderRadius: '6px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
                title="Schließen"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
              {dispatchSuccess ? (
                <div style={{
                  padding: '20px',
                  background: 'rgba(16, 185, 129, 0.08)',
                  border: '1px solid rgba(16, 185, 129, 0.3)',
                  borderRadius: '12px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#059669', fontWeight: 700, fontSize: '1.05rem' }}>
                    <CheckCircle size={22} />
                    <span>Mandat erfolgreich übermittelt & protokolliert!</span>
                  </div>
                  <div style={{ fontSize: '0.9rem', color: '#334155', lineHeight: 1.6 }}>
                    Das Mandat für <strong>{dispatchSuccessData?.company}</strong> wurde an <strong>{dispatchSuccessData?.partner}</strong> übermittelt. Der 12-monatige Kundenschutz ist bis zum <strong>{dispatchSuccessData?.protectionDate}</strong> im Mandats-Archiv rechtswirksam hinterlegt.
                  </div>
                  {copiedDispatchBlind && (
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', color: '#0284c7', fontWeight: 600 }}>
                      <Check size={14} /> Vertrauliches Blind-Profil automatisch in Zwischenablage kopiert!
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
                    <button
                      type="button"
                      onClick={() => {
                        setShowDispatchModal(false);
                        navigate('/nexus/mandats-archiv');
                      }}
                      style={{
                        padding: '10px 18px',
                        borderRadius: '8px',
                        background: '#0284c7',
                        color: '#ffffff',
                        border: 'none',
                        fontWeight: 700,
                        fontSize: '0.86rem',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}
                    >
                      <Archive size={16} /> Zum Mandats-Archiv wechseln
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowDispatchModal(false)}
                      style={{
                        padding: '10px 18px',
                        borderRadius: '8px',
                        background: '#f1f5f9',
                        color: '#334155',
                        border: '1px solid #cbd5e1',
                        fontWeight: 600,
                        fontSize: '0.86rem',
                        cursor: 'pointer'
                      }}
                    >
                      Schließen
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: '4px' }}>
                        Zielgesellschaft
                      </label>
                      <div style={{ fontSize: '1rem', fontWeight: 800, color: '#0f172a' }}>
                        {resolveTriggerCompanyName(activeTrigger, activeOpp) || activeOpp.nexus_companies?.name || activeOpp.title || 'Zielgesellschaft'}
                      </div>
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: '4px' }}>
                        Kundenschutz-Frist
                      </label>
                      <div style={{ fontSize: '0.92rem', fontWeight: 700, color: '#059669', display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <ShieldCheck size={16} /> 12 Monate ab heute ({(() => {
                          const d = new Date();
                          d.setFullYear(d.getFullYear() + 1);
                          return d.toLocaleDateString('de-DE');
                        })()})
                      </div>
                    </div>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                      Partner-Organisation (Empfänger) *
                    </label>
                    <select
                      value={dispatchPartner}
                      onChange={(e) => setDispatchPartner(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '10px 14px',
                        borderRadius: '8px',
                        border: '1px solid #cbd5e1',
                        fontSize: '0.9rem',
                        color: '#0f172a',
                        background: '#f8fafc',
                        cursor: 'pointer'
                      }}
                    >
                      <option value="taskforce - Management on Demand AG">taskforce - Management on Demand AG</option>
                      <option value="Atreus GmbH (A Heimatt Group Company)">Atreus GmbH (A Heimatt Group Company)</option>
                      <option value="Egon Zehnder International">Egon Zehnder International</option>
                      <option value="Russell Reynolds Associates">Russell Reynolds Associates</option>
                      <option value="Spencer Stuart">Spencer Stuart</option>
                      <option value="Korn Ferry">Korn Ferry</option>
                      <option value="Freier PE-Partner / Family Office">Freier PE-Partner / Family Office</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                      Vakanz / Organfunktion
                    </label>
                    <input
                      type="text"
                      value={dispatchRole}
                      onChange={(e) => setDispatchRole(e.target.value)}
                      placeholder="z. B. Interim CFO, CEO-Vakanz, CRO Restrukturierung"
                      style={{
                        width: '100%',
                        padding: '10px 14px',
                        borderRadius: '8px',
                        border: '1px solid #cbd5e1',
                        fontSize: '0.9rem',
                        color: '#0f172a',
                        boxSizing: 'border-box'
                      }}
                    />
                  </div>

                  <div style={{
                    padding: '12px 14px',
                    background: '#f1f5f9',
                    borderRadius: '8px',
                    border: '1px solid #e2e8f0',
                    fontSize: '0.82rem',
                    color: '#64748b',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}>
                    <FileText size={16} color="#0284c7" />
                    <span>Das anonymisierte Blind-Profil für den Partner wird beim Übermitteln automatisch in die Zwischenablage kopiert.</span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '8px' }}>
                    <button
                      type="button"
                      onClick={() => setShowDispatchModal(false)}
                      style={{
                        padding: '10px 18px',
                        borderRadius: '8px',
                        background: '#f1f5f9',
                        color: '#334155',
                        border: '1px solid #cbd5e1',
                        fontWeight: 600,
                        cursor: 'pointer'
                      }}
                    >
                      Abbrechen
                    </button>
                    <button
                      type="button"
                      disabled={isDirectPublishing}
                      onClick={handleConfirmDispatch}
                      style={{
                        padding: '10px 22px',
                        borderRadius: '8px',
                        background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                        color: '#ffffff',
                        border: 'none',
                        fontWeight: 700,
                        fontSize: '0.88rem',
                        cursor: isDirectPublishing ? 'not-allowed' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}
                    >
                      {isDirectPublishing ? <Loader2 size={16} className="animate-spin" /> : <ShieldCheck size={16} />}
                      <span>Übermittlung protokollieren & Kundenschutz aktivieren</span>
                    </button>
                  </div>
                </>
              )}
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
                      Klarer Account: <strong>{d.company?.legalName || compName || '-'}</strong> · DSGVO-konforme Mandats-Intelligence
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

              {/* Tabs: Vorschau / Vault / Bearbeiten / Outreach */}
              <div className="no-print" style={{ display: 'flex', background: '#070a0f', borderBottom: '1px solid #1e293b', padding: '8px 24px', gap: '8px', flexWrap: 'wrap' }}>
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
                  <Eye size={15} /> 1. 📄 1-Page Teaser &amp; Vorschau (100% Blind)
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
                  <ShieldCheck size={15} /> 2. 🔐 Klardaten-Tresor (Vault)
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
                  <Edit3 size={15} /> 3. ✏️ Felder anpassen
                </button>
                <button
                  type="button"
                  onClick={() => setBlindProfileTab('outreach')}
                  style={{
                    background: blindProfileTab === 'outreach' ? '#0284c7' : 'transparent',
                    color: blindProfileTab === 'outreach' ? '#ffffff' : '#94a3b8',
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
                  <FileText size={15} /> 4. ✉️ Outreach vorbereiten
                </button>
              </div>

              {/* Tab 1: 1-Page Teaser Vorschau & Print Layout */}
              {blindProfileTab === 'teaser' && (
                <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {/* Quick Action Bar for Teaser */}
                  <div className="no-print" style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    background: '#070a12',
                    border: '1px solid #1e293b',
                    borderRadius: '10px',
                    padding: '12px 18px',
                    gap: '12px',
                    flexWrap: 'wrap'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#94a3b8', fontSize: '0.84rem' }}>
                      <span style={{ color: '#38bdf8', fontWeight: 700 }}>A4 Portrait:</span>
                      <span>Optimiertes 1-Page Format ohne Seitenumbruch für Mandats-Boutiquen</span>
                    </div>

                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        onClick={() => window.print()}
                        style={{
                          background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                          color: '#ffffff',
                          border: 'none',
                          padding: '8px 16px',
                          borderRadius: '6px',
                          fontWeight: 700,
                          fontSize: '0.84rem',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          boxShadow: '0 0 12px rgba(2, 132, 199, 0.4)'
                        }}
                      >
                        <Printer size={15} />
                        <span>🖨️ Als PDF drucken / sichern</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setBlindProfileTab('outreach')}
                        style={{
                          background: '#16a34a',
                          color: '#ffffff',
                          border: 'none',
                          padding: '8px 16px',
                          borderRadius: '6px',
                          fontWeight: 700,
                          fontSize: '0.84rem',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px'
                        }}
                      >
                        <FileText size={15} />
                        <span>✉️ Outreach an Partner vorbereiten</span>
                      </button>
                    </div>
                  </div>

                  {/* Clean 1-Page Blind Profile Document Container */}
                  <div id="nexus-teaser-print-container" className="nexus-teaser-paper-preview">
                    {/* Header */}
                    <div className="teaser-doc-header">
                      <div>
                        <div className="teaser-brand-title">D.A.T. Dienstleistungen · Executive Mandate Desk</div>
                        <div className="teaser-brand-sub">Tagesaktuelle Organwechsel &amp; Mandatssignale · Schweiz &amp; DACH</div>
                      </div>
                      <div className="teaser-conf-badge">
                        <div className="teaser-conf-text">STRIKT VERTRAULICH</div>
                        <div className="teaser-conf-sub">100% Anonymisiertes Blind-Profil</div>
                      </div>
                    </div>

                    {/* Title Bar */}
                    <div className="teaser-title-bar">
                      <div>
                        <div className="teaser-doc-type">MANDATS-BRIEFING · C-LEVEL / BOARD VACANCY</div>
                        <div className="teaser-doc-headline">{t.headline}</div>
                      </div>
                      <div className="teaser-meta-pills">
                        <div><strong>Referenz:</strong> {outreachRefCode || `CH-ZG-2026-VR-${activeOpp?.id ? activeOpp.id.slice(0, 4).toUpperCase() : '01'}`}</div>
                        <div><strong>Datum:</strong> {activeTrigger?.event_date || activeOpp?.event_date || new Date().toISOString().split('T')[0]}</div>
                        <div><strong>Status:</strong> Freigegeben zur Erstansprache</div>
                      </div>
                    </div>

                    {/* Facts Table */}
                    <table className="teaser-facts-table">
                      <tbody>
                        <tr>
                          <td className="tf-label">Zielbranche / Segment</td>
                          <td className="tf-val"><strong>{t.industry}</strong></td>
                          <td className="tf-label">Standort / Region</td>
                          <td className="tf-val"><strong>{t.region}</strong></td>
                        </tr>
                        <tr>
                          <td className="tf-label">Rechtsform &amp; Größe</td>
                          <td className="tf-val">{d.company?.legalForm || 'Aktiengesellschaft (AG)'} · {d.company?.employeesCount || 'k. A. / nicht erfasst'} MA</td>
                          <td className="tf-label">Ziel-Organ / Vakanz</td>
                          <td className="tf-val"><strong>{d.roleTargeting?.primaryRole || outreachRole || 'Verwaltungsrat / C-Level'}</strong></td>
                        </tr>
                        <tr>
                          <td className="tf-label">Primärquelle / Nachweis</td>
                          <td className="tf-val" colSpan="3">
                            Amtliche Registerpublikation ({d.primarySource?.url ? 'SHAB Schweizerisches Handelsamtsblatt' : 'Handelsregister'}) · Verifiziert durch Harro Goerndt am {new Date().toLocaleDateString('de-DE')}
                          </td>
                        </tr>
                      </tbody>
                    </table>

                    {/* Section: Situation & Vakanz-Anlass */}
                    <div className="teaser-section-title">
                      <span>📌</span> AUSGANGSLAGE &amp; AKUTER HANDLUNGSDRUCK
                    </div>
                    <div className="teaser-text-box">
                      {t.eventSummary}
                    </div>

                    {/* Section: Leistungsumfang & Einsatzoptionen */}
                    <div className="teaser-section-title">
                      <span>🎯</span> MANDATS-FOKUS &amp; PROVIDER-EINSATZOPTIONEN
                    </div>
                    <div className="teaser-scope-list">
                      <div>• <strong>Sofortige Organ-Vertretung:</strong> Besetzung der vakanten Organposition zur Sicherung der Handlungsfähigkeit und Einzelzeichnungsberechtigung.</div>
                      <div>• <strong>Corporate Governance &amp; Transformation:</strong> Begleitung von Nachfolge, Neuausrichtung oder Gesellschafterwechsel auf VR-/C-Level-Ebene.</div>
                      <div>• <strong>Exklusiver Erstansprache-Vorteil:</strong> Unmittelbarer zeitlicher Vorteil vor öffentlicher Marktausschreibung.</div>
                    </div>

                    {/* Target Partners / Buyers */}
                    <div style={{ marginBottom: '14px' }}>
                      <div style={{ fontSize: '0.74rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', marginBottom: '5px' }}>
                        Akkreditierte Partner-Profile:
                      </div>
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                        {(t.targetBuyers || ['Top Fifty AG', 'BIE Executive AG', 'taskforce AG', 'Freies PE-Netzwerk']).map((b, idx) => (
                          <span key={idx} style={{ background: '#f1f5f9', color: '#0369a1', border: '1px solid #cbd5e1', padding: '3px 8px', borderRadius: '4px', fontSize: '0.74rem', fontWeight: 600 }}>
                            ✓ {b}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Footer */}
                    <div className="teaser-doc-footer">
                      <div>
                        <strong>D.A.T. Dienstleistungen</strong> · Executive Mandate Desk<br />
                        Weserstraße 16 · 26382 Wilhelmshaven · https://dat-dat.de
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <strong>Exklusivitäts-Garantie:</strong> Dieses Signal wird nur einem ausgewählten Partner zur Mandatierung bereitgestellt.<br />
                        Klardaten-Freigabe erfolgt diskret auf Anforderung.
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
                      <span>Verifizierter Klardaten-Tresor (Wird Partnern nach Übermittlung übergeben)</span>
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
                          {d.roleTargeting?.primaryRole || 'k. A. / nicht erfasst'}
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

              {/* Tab 4: Outreach Vorbereiten & Versenden */}
              {blindProfileTab === 'outreach' && (
                <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {outreachSuccessMessage ? (
                    <div style={{
                      background: 'rgba(34, 197, 94, 0.15)',
                      border: '1px solid #22c55e',
                      borderRadius: '10px',
                      padding: '16px',
                      color: '#4ade80',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      fontSize: '0.9rem'
                    }}>
                      <Check size={22} color="#22c55e" />
                      <div>
                        <strong>Outreach erfolgreich erfasst!</strong>
                        <div>{outreachSuccessMessage}</div>
                      </div>
                    </div>
                  ) : null}

                  {/* Partner Selection & Meta */}
                  <div style={{ background: '#0e131f', border: '1px solid #1e293b', borderRadius: '12px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                      <div style={{ flex: 1, minWidth: '280px' }}>
                        <label style={{ display: 'block', fontSize: '0.84rem', color: '#94a3b8', marginBottom: '6px', fontWeight: 700 }}>
                          Akkreditierten Partner auswählen:
                        </label>
                        <select
                          value={outreachPartnerId}
                          onChange={(e) => setOutreachPartnerId(e.target.value)}
                          style={{
                            padding: '10px 14px',
                            borderRadius: '8px',
                            background: '#070a12',
                            border: '1px solid #0284c7',
                            color: '#f8fafc',
                            fontSize: '0.92rem',
                            fontWeight: 600,
                            width: '100%',
                            boxSizing: 'border-box'
                          }}
                        >
                          {OUTREACH_PARTNERS.map(p => (
                            <option key={p.id} value={p.id}>
                              {p.name} ({p.location})
                            </option>
                          ))}
                        </select>
                      </div>

                      {(() => {
                        const currentP = OUTREACH_PARTNERS.find(p => p.id === outreachPartnerId) || OUTREACH_PARTNERS[0];
                        return (
                          <div style={{ display: 'flex', gap: '14px', background: '#070a12', border: '1px solid #1e293b', padding: '10px 16px', borderRadius: '8px', fontSize: '0.82rem' }}>
                            <div>
                              <div style={{ color: '#64748b' }}>Ansprechpartner:</div>
                              <div style={{ color: '#f8fafc', fontWeight: 600 }}>{currentP.contactPerson}</div>
                            </div>
                            <div style={{ borderLeft: '1px solid #1e293b', paddingLeft: '14px' }}>
                              <div style={{ color: '#64748b' }}>E-Mail:</div>
                              <div style={{ color: '#38bdf8', fontWeight: 600 }}>{currentP.email}</div>
                            </div>
                            <div style={{ borderLeft: '1px solid #1e293b', paddingLeft: '14px' }}>
                              <div style={{ color: '#64748b' }}>Exklusivität:</div>
                              <div style={{ color: '#4ade80', fontWeight: 700 }}>
                                {currentP.exclusivityHours ? `${currentP.exclusivityHours}h Exklusivrechte` : `${currentP.exclusivityDays} Tage`}
                              </div>
                            </div>
                          </div>
                        );
                      })()}
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '0.84rem', color: '#94a3b8', marginBottom: '4px', fontWeight: 600 }}>
                        E-Mail-Betreff:
                      </label>
                      <input
                        type="text"
                        value={outreachSubject}
                        onChange={(e) => setOutreachSubject(e.target.value)}
                        style={{ width: '100%', padding: '10px 12px', background: '#070a12', border: '1px solid #334155', borderRadius: '6px', color: '#f8fafc', fontSize: '0.9rem', boxSizing: 'border-box' }}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '0.84rem', color: '#94a3b8', marginBottom: '4px', fontWeight: 600 }}>
                        E-Mail-Text (Harro Goerndt Executive Phrasing):
                      </label>
                      <textarea
                        rows={11}
                        value={outreachBody}
                        onChange={(e) => setOutreachBody(e.target.value)}
                        style={{ width: '100%', padding: '12px', background: '#070a12', border: '1px solid #334155', borderRadius: '6px', color: '#f8fafc', fontSize: '0.88rem', fontFamily: 'monospace', lineHeight: 1.5, boxSizing: 'border-box' }}
                      />
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginTop: '6px' }}>
                      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          onClick={() => {
                            const fullCopy = `Betreff: ${outreachSubject}\n\n${outreachBody}`;
                            navigator.clipboard.writeText(fullCopy);
                            setCopiedOutreachMail(true);
                            setTimeout(() => setCopiedOutreachMail(false), 3000);
                          }}
                          style={{
                            background: copiedOutreachMail ? '#22c55e' : '#1e293b',
                            color: '#ffffff',
                            border: '1px solid #334155',
                            padding: '10px 16px',
                            borderRadius: '6px',
                            fontWeight: 700,
                            fontSize: '0.84rem',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px'
                          }}
                        >
                          {copiedOutreachMail ? <Check size={16} /> : <Copy size={16} />}
                          <span>{copiedOutreachMail ? 'E-Mail kopiert!' : '📋 E-Mail Text &amp; Betreff kopieren'}</span>
                        </button>

                        {(() => {
                          const currentP = OUTREACH_PARTNERS.find(p => p.id === outreachPartnerId) || OUTREACH_PARTNERS[0];
                          const mailtoHref = `mailto:${encodeURIComponent(currentP.email)}?subject=${encodeURIComponent(outreachSubject)}&body=${encodeURIComponent(outreachBody)}`;
                          return (
                            <a
                              href={mailtoHref}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{
                                background: '#0284c7',
                                color: '#ffffff',
                                border: 'none',
                                padding: '10px 16px',
                                borderRadius: '6px',
                                fontWeight: 700,
                                fontSize: '0.84rem',
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                                textDecoration: 'none'
                              }}
                            >
                              <span>✉️ In Standard-Mailclient öffnen</span>
                            </a>
                          );
                        })()}
                      </div>

                      <button
                        type="button"
                        onClick={handleExecuteOutreach}
                        disabled={isOutreachLogging}
                        style={{
                          background: 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)',
                          color: '#ffffff',
                          border: 'none',
                          padding: '10px 20px',
                          borderRadius: '6px',
                          fontWeight: 700,
                          fontSize: '0.88rem',
                          cursor: isOutreachLogging ? 'not-allowed' : 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          boxShadow: '0 0 14px rgba(34, 197, 94, 0.4)'
                        }}
                      >
                        {isOutreachLogging ? <Loader2 size={16} className="animate-spin" /> : <ShieldCheck size={16} />}
                        <span>{isOutreachLogging ? 'Wird gespeichert...' : '💾 Outreach protokollieren &amp; Kundenschutz aktivieren'}</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Modal Footer mit Aktionen */}
              <div className="no-print" style={{
                background: '#030712',
                padding: '16px 24px',
                borderTop: '1px solid #1f2937',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '12px'
              }}>
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
                  {(() => {
                    const dateVal = activeTrigger?.event_date || activeOpp?.event_date || activeTrigger?.published_at || activeTrigger?.created_at || activeOpp?.created_at;
                    const traffic = getFreshnessTrafficLight(dateVal);
                    return (
                      <span 
                        className={`badge-freshness ${traffic.badgeClass}`}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '5px',
                          padding: '6px 12px',
                          borderRadius: '6px',
                          fontSize: '0.8rem',
                          fontWeight: 700,
                          background: traffic.color === 'green' ? 'rgba(34, 197, 94, 0.15)' : traffic.color === 'yellow' ? 'rgba(234, 179, 8, 0.18)' : 'rgba(239, 68, 68, 0.2)',
                          color: traffic.color === 'green' ? '#4ade80' : traffic.color === 'yellow' ? '#facc15' : '#f87171',
                          border: `1px solid ${traffic.color === 'green' ? 'rgba(34, 197, 94, 0.35)' : traffic.color === 'yellow' ? 'rgba(234, 179, 8, 0.4)' : 'rgba(239, 68, 68, 0.45)'}`
                        }}
                        title={traffic.tooltip}
                      >
                        <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: traffic.color === 'green' ? '#22c55e' : traffic.color === 'yellow' ? '#eab308' : '#ef4444' }} />
                        {traffic.label}: {traffic.sublabel}
                      </span>
                    );
                  })()}

                  <button
                    type="button"
                    onClick={() => window.print()}
                    style={{
                      background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
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
                    <Printer size={16} />
                    <span>🖨️ 1-Page PDF</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleCopyBlindProfileText()}
                    style={{
                      background: copiedBlindText ? '#22c55e' : '#1e293b',
                      color: '#ffffff',
                      border: '1px solid #334155',
                      borderRadius: '8px',
                      padding: '10px 18px',
                      fontWeight: 700,
                      fontSize: '0.88rem',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                  >
                    {copiedBlindText ? <Check size={16} /> : <Copy size={16} />}
                    {copiedBlindText ? 'Blind-Profil kopiert!' : '📋 Blind-Profil kopieren'}
                  </button>

                  <button
                    type="button"
                    onClick={() => setBlindProfileTab('outreach')}
                    style={{
                      background: 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)',
                      color: '#ffffff',
                      border: '1px solid #4ade80',
                      borderRadius: '8px',
                      padding: '10px 18px',
                      fontWeight: 700,
                      fontSize: '0.88rem',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      boxShadow: '0 0 14px rgba(34, 197, 94, 0.4)'
                    }}
                  >
                    <FileText size={16} />
                    <span>✉️ Outreach vorbereiten</span>
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

      {/* 🚨 Reputationsschutz Modal ('Kalter Kaffee' Warnung bei Veraltung > 48h) */}
      {staleWarningModal && (
        <div 
          className="stale-warning-overlay"
          onClick={() => setStaleWarningModal(null)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.82)',
            backdropFilter: 'blur(8px)',
            zIndex: 99999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px'
          }}
        >
          <div 
            className="stale-warning-modal"
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#0d1117',
              border: '1px solid #ef4444',
              borderRadius: '12px',
              maxWidth: '540px',
              width: '100%',
              padding: '24px 28px',
              boxShadow: '0 0 35px rgba(239, 68, 68, 0.35)',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', borderBottom: '1px solid rgba(239, 68, 68, 0.3)', paddingBottom: '14px' }}>
              <div style={{ background: 'rgba(239, 68, 68, 0.15)', padding: '10px', borderRadius: '10px', color: '#f87171' }}>
                <ShieldAlert size={28} />
              </div>
              <div>
                <h3 style={{ margin: 0, color: '#f87171', fontSize: '1.15rem', fontWeight: 800 }}>
                  {staleWarningModal.title || '🚨 Hohes Reputationsrisiko: Kalter Kaffee (>48h)'}
                </h3>
                <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                  NeXus European Mandate Origination Desk · Reputationsschutz
                </span>
              </div>
            </div>

            <div style={{ color: '#cbd5e1', fontSize: '0.9rem', lineHeight: 1.5, display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <p style={{ margin: 0 }}>
                Dieses Signal ist <strong>älter als 48 Stunden</strong> ({staleWarningModal.traffic?.tooltip || 'Veralteter Vorfall'}).
              </p>
              <div style={{ background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.25)', borderRadius: '8px', padding: '12px 14px', color: '#fca5a5', fontSize: '0.85rem' }}>
                <strong>⚠️ Warnung vor Weitergabe:</strong> Im europäischen C-Level-, Board- und Interim-Segment erwarten Partner absolute Exklusivität und Echtzeit-Signale. Die Weitergabe überholter Vakanzen ("Kalter Kaffee") schädigt die NeXus-Glaubwürdigkeit bei Headhuntern und PE-Fonds nachhaltig.
              </div>
              <p style={{ margin: 0, fontSize: '0.85rem', color: '#94a3b8' }}>
                Aktion: <strong>{staleWarningModal.actionName}</strong>
              </p>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '8px', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => setStaleWarningModal(null)}
                style={{
                  background: '#1e293b',
                  color: '#f8fafc',
                  border: '1px solid #334155',
                  borderRadius: '6px',
                  padding: '9px 18px',
                  fontSize: '0.88rem',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Abbrechen (Empfohlen)
              </button>
              <button
                type="button"
                onClick={() => {
                  const cb = staleWarningModal.onConfirm;
                  setStaleWarningModal(null);
                  if (cb) cb();
                }}
                style={{
                  background: '#dc2626',
                  color: '#ffffff',
                  border: '1px solid #f87171',
                  borderRadius: '6px',
                  padding: '9px 18px',
                  fontSize: '0.88rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <AlertTriangle size={15} />
                Auf eigenes Risiko fortfahren
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
