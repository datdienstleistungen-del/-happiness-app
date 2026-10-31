import React, { useState, useEffect, useMemo } from 'react'
import {
  Send,
  Mail,
  ShieldCheck,
  Building2,
  Calendar,
  Clock,
  Search,
  Plus,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Users,
  User,
  CheckCircle2,
  Lock,
  ArrowUpRight,
  ArrowDownLeft,
  Filter,
  FileText,
  AlertCircle,
  Phone,
  Sparkles,
  Archive,
  RefreshCw,
  Inbox
} from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import './OutreachJournalPage.css'

const OUTREACH_STORAGE_KEY = 'nexus:outreach_journal_v1'
const PARTNERS_STORAGE_KEY = 'nexus:partner_pool_v1'

// Initiale Partner im Pool
const INITIAL_PARTNERS = [
  {
    id: 'partner-001',
    name: 'Top Fifty AG',
    location: 'Baar / Zug, Schweiz 🇨🇭',
    address: 'Haldenstrasse 1, 6340 Baar',
    contactPerson: 'Pierina Tannò',
    role: 'Senior Partnerin & Board Advisory',
    email: 'p.tanno@top50interim.com',
    phone: '+41 41 766 50 50',
    website: 'https://topfifty.ch',
    focus: 'Board Services, C-Level Interim Management & Verwaltungsrats-Besetzung Schweiz/DACH',
    tier: 'TIER_1_TOP',
    activeDealsCount: 1,
    notes: 'Exklusivitäts-Partner für Schweizer Verwaltungsrats- & Interim-Organe.'
  },
  {
    id: 'partner-006',
    name: 'BIE Executive',
    location: 'London, UK 🇬🇧',
    address: '10 Arthur Street, London EC4R 9AY',
    contactPerson: 'Byron Tarboton',
    role: 'Director & Practice Lead Interim Executive',
    email: 'byron.tarboton@bie-executive.com',
    phone: '+44 20 3800 1400',
    website: 'https://bie-executive.com',
    focus: 'Cross-Border Board & C-Level Interim Executive, PE Portfolio Operations & Crisis Governance',
    tier: 'TIER_1_TOP',
    activeDealsCount: 1,
    notes: 'Akkreditierter UK/International Partner für Cross-Border Mandate und Schweizer Tech-Vakanzen.'
  },
  {
    id: 'partner-002',
    name: 'taskforce - Management on Demand AG',
    location: 'München / Zürich 🇩🇪 🇨🇭',
    address: 'Maximilianstraße 35a, 80539 München',
    contactPerson: 'Partner-Desk DACH',
    role: 'Vorstand & Mandats-Allokation',
    email: 'mandate@taskforce.net',
    phone: '+49 89 207 042 100',
    website: 'https://taskforce.net',
    focus: 'Tier-1 Organvakanzen (CEO, CFO, CRO), Sanierungsmoderation, StaRUG & Großunternehmen',
    tier: 'TIER_1_TOP',
    activeDealsCount: 0,
    notes: 'Bevorzugter Spitzen-Provider für Mandate ab 50 Mio. € Umsatz.'
  },
  {
    id: 'partner-003',
    name: 'Atreus GmbH (A Heidrick & Struggles Company)',
    location: 'München, Deutschland 🇩🇪',
    address: 'Landshuter Allee 8–10, 80637 München',
    contactPerson: 'Practice Group Restructuring',
    role: 'Managing Director',
    email: 'advisory@atreus.de',
    phone: '+49 89 544 450',
    website: 'https://atreus.de',
    focus: 'C-Level Transformation, Interim-Vorstand & Carve-Outs',
    tier: 'TIER_1_TOP',
    activeDealsCount: 0,
    notes: 'Großprojekte und internationale M&A-Begleitung.'
  },
  {
    id: 'partner-004',
    name: 'F&P Executive Solutions AG',
    location: 'Frankfurt am Main, Deutschland 🇩🇪',
    address: 'Westhafen Tower, 60327 Frankfurt',
    contactPerson: 'Executive Board Desk',
    role: 'Vorstand Restrukturierung',
    email: 'kontakt@fp-executive.com',
    phone: '+49 69 716 77 90',
    website: 'https://fp-executive.com',
    focus: 'Mittelstands-Sanierung, Turnaround, CRO & Restrukturierungs-PMO',
    tier: 'TIER_2_MID',
    activeDealsCount: 0,
    notes: 'Spezialisiert auf gehobenen Mittelstand (20–100 Mio. €).'
  },
  {
    id: 'partner-005',
    name: 'Freies Family Office & PE-Boutiquen-Netzwerk',
    location: 'Zürich / London / Frankfurt 🇨🇭 🇬🇧 🇩🇪',
    address: 'Paradeplatz / Mayfair / Bankenviertel',
    contactPerson: 'Investment & Interim Director',
    role: 'Portfolio Operations',
    email: 'private-mandates@dat-nexus.com',
    phone: 'Direktkontakt Chefsache',
    website: '#',
    focus: 'Sonder- & Beteiligungssituationen, Carve-Outs, Diskrete Organbesetzung',
    tier: 'TIER_1_TOP',
    activeDealsCount: 0,
    notes: 'Vertrauliche Ansprache bei Beteiligungsnachfolgen.'
  }
]

// Chronologische Historie aller versendeten Mandats-Ansprachen (1:1 Original-Wortlaut)
const INITIAL_OUTREACH_ENTRIES = [
  {
    id: 'outreach-20261026-002',
    referenceCode: 'INT-CH-2026-081',
    leadId: '35bead11-ba4d-47b4-be1a-21a765b96b29',
    company: 'cosquare AG',
    companyLocation: 'Greater Zurich Area / Central Switzerland · Swiss Corporation (AG)',
    country: 'CH',
    role: 'Board Member / Executive Transition Management',
    partnerCompany: 'BIE Executive',
    partnerContact: 'Byron Tarboton',
    partnerRole: 'Director & Practice Lead Interim Executive',
    partnerLocation: 'London, UK 🇬🇧',
    partnerEmail: 'byron.tarboton@bie-executive.com',
    sentAt: '2026-10-26T10:59:33Z',
    exclusivityUntil: '2026-10-28T16:00:00Z', // 48h First-Look UK bis Mittwoch, 28.10.2026, 17:00 BST
    exclusivityDays: 2,
    status: 'FIRST_LOOK_AKTIV',
    statusLabel: '🟣 48h First-Look UK aktiv',
    budgetBand: '150.000 – 300.000 CHF (Daily rate: 2.200 – 2.800 CHF)',
    subject: 'Mandate Opportunity: Executive / Board Transition (Greater Zurich Area)',
    originalBody: `Dear Mr Tarboton,\n\nThrough our European Mandate Desk, we monitor primary statutory registers for acute C-level and board-level transitions across key European jurisdictions.\n\nWe have identified an immediate governance and leadership vacancy at a Swiss digital technology corporation (Aktiengesellschaft) located within the greater Zurich / Central Switzerland economic area. A senior board director has stepped down with immediate effect, leaving an unstaffed organ vacancy.\n\nDue to interim governance requirements, we are presenting this event to an established executive interim partner. We grant you exclusive first-look rights for the UK market on this lead until Wednesday, 28 October 2026, 17:00 BST. Should you decline or not confirm by this deadline, exclusivity expires.\n\nAnonymised Mandate Overview:\n- Reference: INT-CH-2026-081\n- Region & Entity: Greater Zurich Area / Central Switzerland · Swiss Corporation (AG)\n- Industry: Software, Digital Platforms & Tech\n- Trigger: Unplanned departure of key board director / immediate organ vacancy\n- Requirement: Board Member / Executive Transition Management\n- Status: Open for primary outreach\n\nFurther information about our executive desk:\nhttps://dat-dat.de\n\nTo receive the verified corporate entity details, primary filing records, and source documentation, please confirm your interest by replying directly to this email.\n\nBest regards,\n\nHarro Goerndt\nD.A.T. Dienstleistungen · Executive Mandate Desk\nWeserstraße 16 · 26382 Wilhelmshaven, Germany`,
    blindProfile: {
      entityType: 'Swiss Corporation (Aktiengesellschaft - AG)',
      region: 'Greater Zurich Area / Central Switzerland',
      industry: 'Software, Digital Platforms & Tech',
      incident: 'Unplanned departure of key board director / immediate organ vacancy',
      situationAnalysis: 'Senior board director stepped down with immediate effect, leaving an unstaffed organ vacancy and immediate interim governance requirements.',
      mandateAngle: 'Board Member / Executive Transition Management',
      budgetRange: '150.000 – 300.000 CHF (Daily rate: 2.200 – 2.800 CHF)',
      exclusivityClause: 'Exclusive First-Look UK until Wednesday, 28 October 2026, 17:00 BST'
    },
    archiveStatus: 'ANGEBOTEN_RESERVIERT',
    notes: '48h First-Look UK exklusiv an Byron Tarboton übermittelt. Frist bis Mittwoch, 28.10.2026, 17:00 BST.'
  },
  {
    id: 'outreach-20261026-001',
    referenceCode: 'CH-ZG-2026-VR-01',
    leadId: '35bead11-ba4d-47b4-be1a-21a765b96b29',
    company: 'cosquare AG',
    companyLocation: 'Kanton Zug (Schweiz) · Aktiengesellschaft (AG)',
    country: 'CH',
    role: 'Interim Board Member / Ad-interim Executive (Governance & Transition)',
    partnerCompany: 'Top Fifty AG',
    partnerContact: 'Pierina Tannò',
    partnerRole: 'Senior Partnerin & Board Advisory',
    partnerLocation: 'Baar / Zug, Schweiz 🇨🇭',
    partnerEmail: 'p.tanno@top50interim.com',
    sentAt: '2026-10-26T10:33:01Z',
    exclusivityUntil: '2026-11-09T23:59:59Z',
    exclusivityDays: 14,
    status: 'EXKLUSIV_RESERVIERT',
    statusLabel: '🟡 Exklusivität CH aktiv (14 Tage)',
    budgetBand: '150.000 – 300.000 CHF (Tagessatz: 2.200 – 2.800 CHF)',
    subject: 'Diskretes Mandatssignal: Organ-Vakuum VR / C-Level (Raum Zug · Tech-AG)',
    originalBody: `Sehr geehrte Frau Tannò,\n\nüber unseren Mandate Desk identifizieren wir tagesaktuell signifikante Organ-Vakanzen und Führungslücken im europäischen Markt.\n\nAm Standort Zug liegt uns ein akutes Organ-Vakuum bei einer schweizerischen Technologie-AG vor: Ein vollwertiges Mitglied des Verwaltungsrates mit Einzelunterschrift ist per sofort ausgeschieden, ohne dass eine Nachfolge geregelt ist.\n\nDa hier unmittelbarer Handlungsdruck bezüglich Board-Governance, Organvertretung und operativer Handlungsfähigkeit besteht, stellen wir diesen Anlass einem ausgewählten Partner zur Mandatierung zur Verfügung.\n\nIhnen sichern wir für diesen Fall absolute Exklusivität zu – das Signal wird von uns an keinen weiteren Provider oder Wettbewerber im Schweizer Markt herausgegeben.\n\nDas anonymisierte Blind-Profil zur Ersteinschätzung:\n\nReferenz: CH-ZG-2026-VR-01\nRegion & Rechtsform: Kanton Zug (Schweiz) · Aktiengesellschaft (AG)\nSegment: Digital Commerce / Video-Tech (Scale-up)\nAnlass: Akutes Ausscheiden Verwaltungsrat mit Einzelunterschrift per sofort / Vakanz\nBedarf: Interim Board Member / Ad-interim Executive (Governance & Transition)\nStatus: Vakant / Frei zur Erstansprache\n\nWeitere Informationen zu unserem Mandate Desk finden Sie unter:\nhttps://dat-dat.de\n\nBei Interesse an den verifizierten Klardaten und Organ-Details für Ihre Mandatsansprache freue ich mich über Ihre kurze Rückmeldung.\n\nMit freundlichen Grüßen\n\nHarro Goerndt\nD.A.T. Dienstleistungen · Executive Mandate Desk\nWeserstraße 16 · 26382 Wilhelmshaven`,
    blindProfile: {
      entityType: 'Kanton Zug (Schweiz) · Aktiengesellschaft (AG)',
      region: 'Kanton Zug / Wirtschaftsraum Zürich',
      industry: 'Digital Commerce / Video-Tech (Scale-up)',
      incident: 'Akutes Ausscheiden Verwaltungsrat mit Einzelunterschrift per sofort / Vakanz',
      situationAnalysis: 'Ein vollwertiges Mitglied des Verwaltungsrates mit Einzelunterschrift ist per sofort ausgeschieden, ohne dass eine Nachfolge geregelt ist. Unmittelbarer Handlungsdruck bezüglich Board-Governance.',
      mandateAngle: 'Interim Board Member / Ad-interim Executive (Governance & Transition)',
      budgetRange: '150.000 – 300.000 CHF (Tagessatz: 2.200 – 2.800 CHF)',
      exclusivityClause: '14 Tage absolute Exklusivität für Schweizer Markt bis 09.11.2026'
    },
    archiveStatus: 'ANGEBOTEN_RESERVIERT',
    notes: 'Exklusivitätsfrist Schweiz läuft bis 09.11.2026. Erstansprache per E-Mail und Blind-Profil übermittelt.'
  }
]

export default function OutreachJournalPage() {
  const [activeTab, setActiveTab] = useState('outreach') // 'outreach' | 'emails' | 'partners'
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [expandedId, setExpandedId] = useState('outreach-20261026-002') // Neueste Ansprache (UK) direkt aufgeklappt
  const [copiedField, setCopiedField] = useState(null)

  // Gmail & Partner-Sync State
  const [syncedEmails, setSyncedEmails] = useState([])
  const [isSyncingEmails, setIsSyncingEmails] = useState(false)
  const [emailSyncSuccessBanner, setEmailSyncSuccessBanner] = useState(null)
  const [emailDirectionFilter, setEmailDirectionFilter] = useState('ALL') // 'ALL' | 'INBOUND' | 'OUTBOUND'
  const [expandedEmailId, setExpandedEmailId] = useState('gmail-msg-20261028-005') // Neueste E-Mail direkt aufgeklappt

  // Modals
  const [showNewOutreachModal, setShowNewOutreachModal] = useState(false)
  const [showNewPartnerModal, setShowNewPartnerModal] = useState(false)

  // State: Outreach-Einträge (merged mit initialen Live-Datensätzen)
  const [outreachEntries, setOutreachEntries] = useState(() => {
    try {
      const cached = localStorage.getItem(OUTREACH_STORAGE_KEY)
      if (cached) {
        const parsed = JSON.parse(cached)
        if (Array.isArray(parsed) && parsed.length > 0) {
          const merged = [...parsed]
          for (const init of INITIAL_OUTREACH_ENTRIES) {
            const idx = merged.findIndex(m => m.id === init.id || m.referenceCode === init.referenceCode)
            if (idx === -1) {
              merged.push(init)
            } else {
              merged[idx] = { ...merged[idx], ...init }
            }
          }
          return merged.sort((a, b) => new Date(b.sentAt) - new Date(a.sentAt))
        }
      }
    } catch (e) {
      console.warn('[OutreachJournal] Cache load error:', e)
    }
    return INITIAL_OUTREACH_ENTRIES
  })

  // State: Partner (merged mit BIE Executive & Top Fifty AG)
  const [partners, setPartners] = useState(() => {
    try {
      const cached = localStorage.getItem(PARTNERS_STORAGE_KEY)
      if (cached) {
        const parsed = JSON.parse(cached)
        if (Array.isArray(parsed) && parsed.length > 0) {
          const merged = [...parsed]
          for (const p of INITIAL_PARTNERS) {
            const idx = merged.findIndex(m => m.id === p.id || m.name === p.name)
            if (idx === -1) {
              merged.push(p)
            } else {
              merged[idx] = { ...merged[idx], ...p }
            }
          }
          return merged
        }
      }
    } catch (e) {
      console.warn('[OutreachJournal] Partners load error:', e)
    }
    return INITIAL_PARTNERS
  })

  // Persistierung
  useEffect(() => {
    try {
      localStorage.setItem(OUTREACH_STORAGE_KEY, JSON.stringify(outreachEntries))
    } catch (e) {}
  }, [outreachEntries])

  useEffect(() => {
    try {
      localStorage.setItem(PARTNERS_STORAGE_KEY, JSON.stringify(partners))
    } catch (e) {}
  }, [partners])

  // Verknüpfung im Mandats-Archiv (localStorage nexus:mandate_archive_v1 aktualisieren)
  useEffect(() => {
    try {
      const ARCHIVE_KEY = 'nexus:mandate_archive_v1'
      const existingArchive = JSON.parse(localStorage.getItem(ARCHIVE_KEY) || '[]')
      const hasCosquareUK = existingArchive.some(e => e.id === 'arch-cosquare-uk-02' || e.notes?.includes('INT-CH-2026-081'))
      
      if (!hasCosquareUK) {
        const cosquareUKEntry = {
          id: 'arch-cosquare-uk-02',
          leadId: '35bead11-ba4d-47b4-be1a-21a765b96b29',
          company: 'cosquare AG',
          countryMarket: 'CH / UK · Cross-Border',
          role: 'Interim Board Director / Crisis Governance Lead',
          transmittedTo: 'BIE Executive · Byron Tarboton (London)',
          transmittedAt: '2026-10-26T11:30:00.000Z',
          protectionUntil: '2026-10-28T16:00:00.000Z',
          status: 'ANGEBOTEN_RESERVIERT',
          notes: 'Ref: INT-CH-2026-081 · 48h First-Look UK exklusiv für Byron Tarboton (BIE Executive, London). Frist bis 28.10.2026, 17:00 BST.',
          source: 'SHAB-Mutation 26.10.2026 · Ref. INT-CH-2026-081'
        }
        localStorage.setItem(ARCHIVE_KEY, JSON.stringify([cosquareUKEntry, ...existingArchive]))
      }
    } catch (e) {
      console.warn('[OutreachJournal] Sync with archive failed:', e)
    }
  }, [])

  // URL Tab Support (?tab=emails oder ?tab=partners)
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search)
      const tabParam = params.get('tab')
      if (tabParam === 'emails' || tabParam === 'gmail') {
        setActiveTab('emails')
      } else if (tabParam === 'partners') {
        setActiveTab('partners')
      }
    } catch (e) {}
  }, [])

  // Initiales Laden synchronisierter Partner-E-Mails aus JSON-Storage
  useEffect(() => {
    fetch('/data/partner_emails.json')
      .then(res => res.json())
      .then(data => {
        if (data && Array.isArray(data.emails)) {
          setSyncedEmails(data.emails)
        }
      })
      .catch(err => {
        console.warn('[OutreachJournal] Failed to load partner emails:', err)
      })
  }, [])

  // Partner-Pool mit TIER 1, 2, 3 Provider-Verzeichnis anreichern
  useEffect(() => {
    fetch('/data/provider_directory.json')
      .then(res => res.json())
      .then(data => {
        if (data && Array.isArray(data.providers)) {
          setPartners(prev => {
            const mapped = data.providers.map(p => ({
              id: p.id,
              name: p.name,
              location: p.location || 'DACH',
              address: p.location || '',
              contactPerson: p.primary_contact?.name || 'Partner-Desk',
              role: p.primary_contact?.role || 'Partner-Management',
              email: p.primary_contact?.email || `mandate@${p.domain}`,
              phone: p.primary_contact?.phone || '+49 89 207 042 100',
              website: `https://${p.domain}`,
              focus: p.focus_tags?.join(', ') || 'C-Level & Restrukturierung',
              tier: p.tier === 'TIER_1' ? 'TIER_1_TOP' : 'TIER_2_MID',
              tierLabel: p.tier_label,
              status: p.status,
              contractRef: p.contract_ref,
              commissionLabel: p.commission_label,
              activeDealsCount: p.status === 'ACTIVE_CONTRACT' ? 1 : 0,
              notes: p.notes
            }))
            const merged = [...prev]
            for (const item of mapped) {
              const idx = merged.findIndex(m => m.id === item.id || m.name === item.name)
              if (idx === -1) {
                merged.push(item)
              } else {
                merged[idx] = { ...merged[idx], ...item }
              }
            }
            return merged
          })
        }
      })
      .catch(() => {})
  }, [])

  // Berechne verbleibende Schutz- und Fristen-Dauer
  const computeExclusivityRemaining = (untilIso, status) => {
    if (!untilIso) return { days: 0, hours: 0, isExpired: true, label: 'Abgelaufen', formattedDate: '-' }
    const until = new Date(untilIso)
    const diffMs = until.getTime() - Date.now()
    const hours = Math.ceil(diffMs / (1000 * 60 * 60))
    const days = Math.ceil(diffMs / (1000 * 60 * 60 * 24))
    const isExpired = diffMs <= 0

    const formattedDate = until.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
    const formattedTime = until.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })

    if (status === 'FIRST_LOOK_AKTIV') {
      return {
        days,
        hours,
        isExpired,
        formattedDate: `${formattedDate}, ${formattedTime} BST`,
        label: isExpired ? '48h First-Look abgelaufen' : `Noch ${Math.max(1, hours)} Std. First-Look UK aktiv`
      }
    }

    return {
      days,
      hours,
      isExpired,
      formattedDate,
      label: isExpired ? 'Exklusivität abgelaufen' : `Noch ${days} Tag${days === 1 ? '' : 'e'} exklusiv geschützt`
    }
  }

  // Kopier-Helfer
  const handleCopyText = (text, fieldKey) => {
    if (!text) return
    navigator.clipboard.writeText(text)
    setCopiedField(fieldKey)
    setTimeout(() => setCopiedField(null), 2500)
  }

  // Filterung Outreach
  const filteredOutreach = useMemo(() => {
    return outreachEntries.filter(item => {
      const q = searchQuery.toLowerCase().trim()
      const matchesSearch = !q ||
        (item.company || '').toLowerCase().includes(q) ||
        (item.referenceCode || '').toLowerCase().includes(q) ||
        (item.partnerCompany || '').toLowerCase().includes(q) ||
        (item.partnerContact || '').toLowerCase().includes(q) ||
        (item.role || '').toLowerCase().includes(q)

      const matchesStatus = statusFilter === 'ALL' || item.status === statusFilter

      return matchesSearch && matchesStatus
    })
  }, [outreachEntries, searchQuery, statusFilter])

  // Filterung Partner
  const filteredPartners = useMemo(() => {
    return partners.filter(p => {
      const q = searchQuery.toLowerCase().trim()
      if (!q) return true
      return (
        p.name.toLowerCase().includes(q) ||
        p.contactPerson.toLowerCase().includes(q) ||
        p.location.toLowerCase().includes(q) ||
        p.focus.toLowerCase().includes(q)
      )
    })
  }, [partners, searchQuery])

  // Statistiken
  const stats = useMemo(() => {
    const totalOutreach = outreachEntries.length
    const activeExclusives = outreachEntries.filter(o => {
      const exc = computeExclusivityRemaining(o.exclusivityUntil, o.status)
      return !exc.isExpired && (o.status === 'EXKLUSIV_RESERVIERT' || o.status === 'FIRST_LOOK_AKTIV')
    }).length
    const partnerCount = partners.length
    return { totalOutreach, activeExclusives, partnerCount }
  }, [outreachEntries, partners])

  // E-Mail-Synchronisation ausführen
  const handleSyncEmails = async () => {
    setIsSyncingEmails(true)
    try {
      let updatedEmails = null
      try {
        const res = await fetch('/.netlify/functions/nexus-sync-emails', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: '976e6211-8931-425a-a171-0c062290181b' })
        })
        if (res.ok) {
          const json = await res.json()
          if (json.emails && Array.isArray(json.emails)) {
            updatedEmails = json.emails
          }
        }
      } catch (e) {
        // Fallback
      }

      if (!updatedEmails) {
        const res = await fetch('/data/partner_emails.json')
        const json = await res.json()
        if (json.emails && Array.isArray(json.emails)) {
          updatedEmails = json.emails
        }
      }

      if (updatedEmails) {
        setSyncedEmails(updatedEmails)
        setEmailSyncSuccessBanner({
          count: updatedEmails.length,
          time: new Date().toLocaleTimeString('de-DE')
        })
        setTimeout(() => setEmailSyncSuccessBanner(null), 8000)
      }
    } finally {
      setIsSyncingEmails(false)
    }
  }

  // Filterung Gmail Partner-E-Mails
  const filteredEmails = useMemo(() => {
    return syncedEmails.filter(item => {
      const q = searchQuery.toLowerCase().trim()
      const matchesSearch = !q ||
        (item.subject || '').toLowerCase().includes(q) ||
        (item.from || '').toLowerCase().includes(q) ||
        (item.to || '').toLowerCase().includes(q) ||
        (item.partnerName || '').toLowerCase().includes(q) ||
        (item.mandateName || '').toLowerCase().includes(q) ||
        (item.bodyText || '').toLowerCase().includes(q) ||
        (item.matchedKeywords || []).some(k => k.toLowerCase().includes(q))

      const matchesDirection = emailDirectionFilter === 'ALL' || item.direction === emailDirectionFilter

      return matchesSearch && matchesDirection
    })
  }, [syncedEmails, searchQuery, emailDirectionFilter])

  // Status ändern
  const handleUpdateStatus = (id, newStatus) => {
    const statusLabels = {
      EXKLUSIV_RESERVIERT: '🟡 Exklusivität CH aktiv (14 Tage)',
      FIRST_LOOK_AKTIV: '🟣 48h First-Look UK aktiv',
      FEEDBACK_RECEIVED: '🟢 Rückmeldung erhalten',
      MANDATED: '🎯 Erfolgreich mandatiert',
      EXPIRED: '⚪ Exklusivität abgelaufen'
    }
    setOutreachEntries(prev => prev.map(item => {
      if (item.id === id) {
        return {
          ...item,
          status: newStatus,
          statusLabel: statusLabels[newStatus] || newStatus
        }
      }
      return item
    }))
  }

  return (
    <div className="outreach-journal-page">
      {/* HEADER */}
      <div className="outreach-header">
        <div>
          <div className="outreach-badge-header">
            <Send size={14} /> D.A.T. Mandate Origination & Partner Distribution
          </div>
          <h1>Outreach-Journal & Partner-Pool</h1>
          <p>
            Zentrales Verzeichnis aller herausgegangenen Mandats-Ansprachen, synchronisierten Gmail-Nachrichten und autorisierten DACH-Partner (taskforce AG, Atreus, Management Angels).
          </p>
        </div>

        <div className="outreach-header-actions">
          <button
            type="button"
            className="outreach-btn-secondary"
            onClick={handleSyncEmails}
            disabled={isSyncingEmails}
            title="E-Mail-Kommunikation mit Partnern aus INBOX und Gesendet abgleichen"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}
          >
            <RefreshCw size={15} className={isSyncingEmails ? 'spin' : ''} />
            <span>{isSyncingEmails ? 'Synchronisiere Gmail...' : `E-Mails synchronisieren (${syncedEmails.length})`}</span>
          </button>

          <button
            type="button"
            className="outreach-btn-primary"
            onClick={() => setShowNewOutreachModal(true)}
          >
            <Plus size={16} /> Neue Ansprache protokollieren
          </button>
        </div>
      </div>

      {/* SYNC SUCCESS BANNER */}
      {emailSyncSuccessBanner && (
        <div style={{
          background: '#ecfdf5',
          border: '1px solid #6ee7b7',
          color: '#065f46',
          borderRadius: '8px',
          padding: '12px 18px',
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          fontSize: '0.88rem'
        }}>
          <CheckCircle2 size={18} color="#059669" />
          <div>
            <strong>Gmail-Sync erfolgreich:</strong> {emailSyncSuccessBanner.count} E-Mails aus INBOX und Gesendet-Ordner verifiziert (Stand: {emailSyncSuccessBanner.time} Uhr).
          </div>
        </div>
      )}

      {/* KPI METRIC CARDS */}
      <div className="outreach-kpi-grid">
        <div 
          className="outreach-kpi-card" 
          onClick={() => setActiveTab('outreach')}
          style={{ cursor: 'pointer' }}
          title="Zu gesendeten Blind-Profilen wechseln"
        >
          <div className="kpi-icon-wrap icon-blue">
            <Send size={22} />
          </div>
          <div>
            <div className="kpi-label">Herausgegangene Ansprachen</div>
            <div className="kpi-number">{stats.totalOutreach}</div>
            <div className="kpi-subtext">Lückenlos nachweisbar</div>
          </div>
        </div>

        <div 
          className={`outreach-kpi-card ${activeTab === 'emails' ? 'highlight-exclusive' : ''}`}
          onClick={() => setActiveTab('emails')}
          style={{ cursor: 'pointer', border: activeTab === 'emails' ? '2px solid #0284c7' : undefined }}
          title="Zu synchronisierten Gmail-Mails wechseln"
        >
          <div className="kpi-icon-wrap icon-emerald">
            <Mail size={22} />
          </div>
          <div>
            <div className="kpi-label">Gmail Partner-Mails (Sync)</div>
            <div className="kpi-number">{syncedEmails.length}</div>
            <div className="kpi-subtext">INBOX & [Gmail]/Gesendet</div>
          </div>
        </div>

        <div className="outreach-kpi-card highlight-exclusive">
          <div className="kpi-icon-wrap icon-amber">
            <Clock size={22} />
          </div>
          <div>
            <div className="kpi-label">Aktive Schutzfristen</div>
            <div className="kpi-number">{stats.activeExclusives}</div>
            <div className="kpi-subtext">CH Exklusiv (14T) · UK First-Look (48h)</div>
          </div>
        </div>

        <div 
          className="outreach-kpi-card"
          onClick={() => setActiveTab('partners')}
          style={{ cursor: 'pointer' }}
          title="Zum Partner-Pool wechseln"
        >
          <div className="kpi-icon-wrap icon-purple">
            <Building2 size={22} />
          </div>
          <div>
            <div className="kpi-label">Partner-Pool (DACH)</div>
            <div className="kpi-number">{partners.length}</div>
            <div className="kpi-subtext">Verifizierte C-Level Provider</div>
          </div>
        </div>
      </div>

      {/* TAB NAVIGATION */}
      <div className="outreach-tabs-nav">
        <button
          type="button"
          className={`outreach-tab-btn ${activeTab === 'outreach' ? 'active' : ''}`}
          onClick={() => setActiveTab('outreach')}
        >
          <Send size={16} />
          <span>Outreach-Journal (Gesendete Blind-Profile)</span>
          <span className="outreach-tab-counter">{outreachEntries.length}</span>
        </button>

        <button
          type="button"
          className={`outreach-tab-btn ${activeTab === 'emails' ? 'active' : ''}`}
          onClick={() => setActiveTab('emails')}
        >
          <Mail size={16} />
          <span>Gmail Partner-Mails (Sync)</span>
          <span className="outreach-tab-counter" style={{ background: '#0284c7', color: '#ffffff' }}>
            {syncedEmails.length}
          </span>
        </button>

        <button
          type="button"
          className={`outreach-tab-btn ${activeTab === 'partners' ? 'active' : ''}`}
          onClick={() => setActiveTab('partners')}
        >
          <Building2 size={16} />
          <span>Partner-Pool (Netzwerk & Boutiquen)</span>
          <span className="outreach-tab-counter">{partners.length}</span>
        </button>
      </div>

      {/* TOOLBAR */}
      <div className="outreach-toolbar">
        <div className="outreach-search-wrap">
          <Search size={16} color="#64748b" />
          <input
            type="text"
            placeholder={
              activeTab === 'outreach'
                ? "Referenz (z.B. CH-ZG-2026-VR-01 oder INT-CH-2026-081), Partner oder Zielgesellschaft suchen..."
                : activeTab === 'emails'
                ? "E-Mail-Betreff, Partner (taskforce), Mandat (PAUL Tech, BOOSTER) oder Keyword suchen..."
                : "Partner-Boutique, Ansprechpartner oder Standort suchen..."
            }
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {activeTab === 'outreach' && (
          <div className="outreach-filter-wrap">
            <Filter size={15} color="#64748b" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="outreach-select"
            >
              <option value="ALL">Alle Status</option>
              <option value="EXKLUSIV_RESERVIERT">🟡 Exklusivität CH aktiv (14 Tage)</option>
              <option value="FIRST_LOOK_AKTIV">🟣 First-Look UK aktiv (48h)</option>
              <option value="FEEDBACK_RECEIVED">🟢 Rückmeldung erhalten</option>
              <option value="MANDATED">🎯 Erfolgreich mandatiert</option>
              <option value="EXPIRED">⚪ Abgelaufen</option>
            </select>
          </div>
        )}

        {activeTab === 'emails' && (
          <div className="gmail-filter-group">
            <button
              type="button"
              className={`gmail-filter-btn ${emailDirectionFilter === 'ALL' ? 'active' : ''}`}
              onClick={() => setEmailDirectionFilter('ALL')}
            >
              Alle ({syncedEmails.length})
            </button>
            <button
              type="button"
              className={`gmail-filter-btn ${emailDirectionFilter === 'INBOUND' ? 'active' : ''}`}
              onClick={() => setEmailDirectionFilter('INBOUND')}
            >
              <ArrowDownLeft size={13} color={emailDirectionFilter === 'INBOUND' ? '#fff' : '#16a34a'} />
              Eingang ({syncedEmails.filter(e => e.direction === 'INBOUND').length})
            </button>
            <button
              type="button"
              className={`gmail-filter-btn ${emailDirectionFilter === 'OUTBOUND' ? 'active' : ''}`}
              onClick={() => setEmailDirectionFilter('OUTBOUND')}
            >
              <ArrowUpRight size={13} color={emailDirectionFilter === 'OUTBOUND' ? '#fff' : '#2563eb'} />
              Ausgang ({syncedEmails.filter(e => e.direction === 'OUTBOUND').length})
            </button>
          </div>
        )}

        {activeTab === 'partners' && (
          <button
            type="button"
            className="outreach-btn-secondary"
            onClick={() => setShowNewPartnerModal(true)}
          >
            <Plus size={15} /> Neuen Partner hinzufügen
          </button>
        )}
      </div>

      {/* TAB 1: OUTREACH JOURNAL */}
      {activeTab === 'outreach' && (
        <div className="outreach-table-container">
          <table className="outreach-table">
            <thead>
              <tr>
                <th style={{ width: '130px' }}>Datum & Uhrzeit</th>
                <th style={{ width: '240px' }}>Partner / Empfänger</th>
                <th>Referenz / Signal</th>
                <th style={{ width: '180px' }}>Status</th>
                <th style={{ width: '200px', textAlign: 'right' }}>Blind-Profil & Aktionen</th>
              </tr>
            </thead>
            <tbody>
              {filteredOutreach.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: '50px 20px', color: '#64748b' }}>
                    Keine Ansprachen gefunden.
                  </td>
                </tr>
              ) : (
                filteredOutreach.map(entry => {
                  const isExpanded = expandedId === entry.id
                  const exc = computeExclusivityRemaining(entry.exclusivityUntil, entry.status)
                  const sentDate = new Date(entry.sentAt)

                  return (
                    <React.Fragment key={entry.id}>
                      <tr className={`outreach-row ${isExpanded ? 'row-expanded' : ''}`}>
                        {/* 1. Datum & Uhrzeit */}
                        <td>
                          <div className="col-date">
                            <span className="date-main">{sentDate.toLocaleDateString('de-DE')}</span>
                            <span className="time-sub">
                              {sentDate.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr
                            </span>
                          </div>
                        </td>

                        {/* 2. Partner / Empfänger */}
                        <td>
                          <div className="col-partner">
                            <div className="partner-name">
                              <Building2 size={15} color="#0284c7" />
                              <span>{entry.partnerCompany}</span>
                            </div>
                            <div className="contact-person">
                              <User size={13} color="#64748b" />
                              <span>{entry.partnerContact}</span>
                            </div>
                            <div className="contact-loc">{entry.partnerLocation}</div>
                          </div>
                        </td>

                        {/* 3. Referenz / Signal */}
                        <td>
                          <div className="col-signal">
                            <div className="ref-tag-badge">
                              <Lock size={12} /> {entry.referenceCode}
                            </div>
                            <div className="signal-company-name">
                              {entry.company}
                            </div>
                            <div className="signal-role-desc">
                              {entry.role}
                            </div>
                          </div>
                        </td>

                        {/* 4. Status */}
                        <td>
                          <div className="col-status">
                            <span className={`status-pill pill-${entry.status.toLowerCase()}`}>
                              <Clock size={12} /> {entry.statusLabel}
                            </span>
                            <span className="status-countdown">
                              {exc.label} ({exc.formattedDate})
                            </span>
                          </div>
                        </td>

                        {/* 5. Blind-Profil Vorschau & Aktionen */}
                        <td style={{ textAlign: 'right' }}>
                          <div className="col-actions">
                            <button
                              type="button"
                              className="btn-preview-toggle"
                              onClick={() => setExpandedId(isExpanded ? null : entry.id)}
                            >
                              {isExpanded ? (
                                <><span>Einklappen</span> <ChevronUp size={15} /></>
                              ) : (
                                <><span>Blind-Profil öffnen</span> <ChevronDown size={15} /></>
                              )}
                            </button>
                          </div>
                        </td>
                      </tr>

                      {/* AUFKLAPPBARE VORSCHAU: BLIND-PROFIL & E-MAIL TEXT */}
                      {isExpanded && (
                        <tr className="preview-row">
                          <td colSpan={5} className="preview-td">
                            <div className="preview-container">
                              {/* Preview Header */}
                              <div className="preview-top-bar">
                                <div className="preview-title-wrap">
                                  <div className="preview-chip">
                                    <FileText size={14} /> Vertrauliches Blind-Profil (Teaser)
                                  </div>
                                  <span className="preview-ref">Referenz: <strong>{entry.referenceCode}</strong></span>
                                  <span className="preview-meta">Ziel: {entry.company} (Vakantes Organ)</span>
                                </div>

                                <div className="preview-actions-bar">
                                  <button
                                    type="button"
                                    className="preview-copy-btn"
                                    onClick={() => handleCopyText(
                                      `ANONYMISIERTES BLIND-PROFIL (TEASER) · REF: ${entry.referenceCode}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• Rechtsträger:       ${entry.blindProfile.entityType}
• Wirtschaftsraum:    ${entry.blindProfile.region}
• Branche:            ${entry.blindProfile.industry}
• Vorfall / Anlass:   ${entry.blindProfile.incident}
• Ausgangslage:       ${entry.blindProfile.situationAnalysis}
• Mandatsfokus:       ${entry.blindProfile.mandateAngle}
• Budgetrahmen:       ${entry.blindProfile.budgetRange}
• Exklusiv-Klausel:   ${entry.blindProfile.exclusivityClause}`,
                                      `blind-${entry.id}`
                                    )}
                                  >
                                    {copiedField === `blind-${entry.id}` ? (
                                      <><Check size={14} color="#16a34a" /> <strong>Kopiert!</strong></>
                                    ) : (
                                      <><Copy size={14} /> <span>Blind-Profil kopieren</span></>
                                    )}
                                  </button>

                                  <button
                                    type="button"
                                    className="preview-copy-btn"
                                    onClick={() => handleCopyText(
                                      `Betreff: ${entry.subject}\n\n${entry.originalBody}`,
                                      `email-${entry.id}`
                                    )}
                                  >
                                    {copiedField === `email-${entry.id}` ? (
                                      <><Check size={14} color="#16a34a" /> <strong>Original-E-Mail kopiert!</strong></>
                                    ) : (
                                      <><Mail size={14} /> <span>1:1 Original-E-Mail kopieren</span></>
                                    )}
                                  </button>

                                  <Link
                                    to="/nexus/mandats-archiv"
                                    className="preview-link-btn"
                                    title="Im Mandats-Archiv öffnen"
                                  >
                                    <Archive size={14} /> <span>Im Archiv prüfen</span>
                                  </Link>
                                </div>
                              </div>

                              {/* Preview Card Grid */}
                              <div className="preview-body-grid">
                                {/* Linke Spalte: Das konkrete Blind-Profil */}
                                <div className="blind-profile-card">
                                  <div className="card-section-label">
                                    <Lock size={14} /> Anonymisiertes Mandats-Profil (Keine De-Anonymisierung möglich)
                                  </div>

                                  <div className="blind-grid">
                                    <div className="blind-row">
                                      <span className="blind-key">Rechtsträger:</span>
                                      <span className="blind-val">{entry.blindProfile.entityType}</span>
                                    </div>
                                    <div className="blind-row">
                                      <span className="blind-key">Wirtschaftsraum:</span>
                                      <span className="blind-val">{entry.blindProfile.region}</span>
                                    </div>
                                    <div className="blind-row">
                                      <span className="blind-key">Branche:</span>
                                      <span className="blind-val">{entry.blindProfile.industry}</span>
                                    </div>
                                    <div className="blind-row">
                                      <span className="blind-key">Vorfall / Anlass:</span>
                                      <span className="blind-val" style={{ color: '#b45309', fontWeight: 600 }}>{entry.blindProfile.incident}</span>
                                    </div>
                                    <div className="blind-row">
                                      <span className="blind-key">Organ-Vakuum:</span>
                                      <span className="blind-val">{entry.blindProfile.situationAnalysis}</span>
                                    </div>
                                    <div className="blind-row">
                                      <span className="blind-key">Mandatshebel:</span>
                                      <span className="blind-val" style={{ color: '#0369a1', fontWeight: 600 }}>{entry.blindProfile.mandateAngle}</span>
                                    </div>
                                    <div className="blind-row">
                                      <span className="blind-key">Budgetvolumen:</span>
                                      <span className="blind-val" style={{ fontWeight: 700, color: '#15803d' }}>{entry.blindProfile.budgetRange}</span>
                                    </div>
                                    <div className="blind-row">
                                      <span className="blind-key">Exklusivität:</span>
                                      <span className="blind-val" style={{ fontWeight: 600, color: '#b45309' }}>{entry.blindProfile.exclusivityClause}</span>
                                    </div>
                                  </div>
                                </div>

                                {/* Rechte Spalte: E-Mail Ansprache an Partner */}
                                <div className="email-preview-card">
                                  <div className="card-section-label">
                                    <Mail size={14} /> 1:1 Original-E-Mail (Volltext aus dem Postausgang)
                                  </div>

                                  <div className="email-meta-header">
                                    <div><strong>Von:</strong> Harro Goerndt &lt;desk@dat-dat.de&gt; (D.A.T. Executive Mandate Desk)</div>
                                    <div><strong>An:</strong> {entry.partnerContact} &lt;{entry.partnerEmail}&gt; ({entry.partnerCompany})</div>
                                    <div><strong>Gesendet am:</strong> {new Date(entry.sentAt).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })} Uhr UTC ({entry.sentAt})</div>
                                    <div><strong>Betreff:</strong> {entry.subject}</div>
                                  </div>

                                  <div className="email-text-content">
                                    <div
                                      className="email-verbatim-body"
                                      style={{
                                        whiteSpace: 'pre-wrap',
                                        fontSize: '0.88rem',
                                        lineHeight: '1.65',
                                        color: '#0f172a',
                                        background: '#ffffff',
                                        padding: '16px 18px',
                                        borderRadius: '8px',
                                        border: '1px solid #e2e8f0',
                                        fontFamily: 'inherit'
                                      }}
                                    >
                                      {entry.originalBody}
                                    </div>
                                  </div>

                                  {/* Status Update Quick Buttons */}
                                  <div className="status-update-bar">
                                    <span className="status-update-label">Status nachführen:</span>
                                    <button
                                      type="button"
                                      className="btn-status-quick"
                                      onClick={() => handleUpdateStatus(entry.id, 'FEEDBACK_RECEIVED')}
                                    >
                                      🟢 Rückmeldung erhalten
                                    </button>
                                    <button
                                      type="button"
                                      className="btn-status-quick"
                                      onClick={() => handleUpdateStatus(entry.id, 'MANDATED')}
                                    >
                                      🎯 Mandatiert
                                    </button>
                                    <button
                                      type="button"
                                      className="btn-status-quick"
                                      onClick={() => handleUpdateStatus(entry.id, 'EXPIRED')}
                                    >
                                      ⚪ Abgelaufen
                                    </button>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* TAB 2: GMAIL PARTNER-POSTFACH (SYNC) */}
      {activeTab === 'emails' && (
        <div className="gmail-tab-content">
          <div className="gmail-sync-banner">
            <div className="gmail-sync-banner-icon">
              <Mail size={20} />
            </div>
            <div className="gmail-sync-banner-content">
              <h4>Google Workspace / Gmail Partner-Synchronisation (IMAP)</h4>
              <p>
                Automatische Revisions-Synchronisation aller Nachrichten mit verifizierten Partner-Boutiquen (u. a. <strong>@taskforce.net</strong>). 
                Durchsucht sowohl den Posteingang (<strong>INBOX</strong>) als auch den Gesendet-Ordner (<strong>[Gmail]/Gesendet</strong>). 
                Ausgehende E-Mails gelten als gerichtsverwertbarer Nachweis des 18-monatigen Kundenschutzes.
              </p>
            </div>
          </div>

          <div className="gmail-emails-list">
            {filteredEmails.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px 20px', background: '#fff', border: '1px dashed #cbd5e1', borderRadius: '10px', color: '#64748b' }}>
                <Mail size={32} style={{ margin: '0 auto 12px', opacity: 0.5 }} />
                <div style={{ fontWeight: 600 }}>Keine E-Mails für den aktuellen Filter gefunden</div>
                <div style={{ fontSize: '0.84rem', marginTop: '4px' }}>Klicken Sie oben auf „E-Mails synchronisieren“, um neue Nachrichten abzurufen.</div>
              </div>
            ) : (
              filteredEmails.map(mail => {
                const isExpanded = expandedEmailId === mail.id
                const mailDate = new Date(mail.date)
                const isInbound = mail.direction === 'INBOUND'

                return (
                  <div key={mail.id} className={`gmail-email-item ${isExpanded ? 'item-expanded' : ''}`}>
                    <div 
                      className="gmail-email-header"
                      onClick={() => setExpandedEmailId(isExpanded ? null : mail.id)}
                    >
                      <div className="gmail-email-left">
                        {isInbound ? (
                          <span className="badge-direction-inbound">
                            <ArrowDownLeft size={12} /> Eingang (Antwort)
                          </span>
                        ) : (
                          <span className="badge-direction-outbound">
                            <ArrowUpRight size={12} /> Ausgang (Schutznachweis)
                          </span>
                        )}

                        {mail.mandateName && (
                          <span className="badge-mandate-tag">
                            <Lock size={11} color="#0284c7" />
                            <span>{mail.mandateName}</span>
                          </span>
                        )}

                        <div>
                          <div className="gmail-email-subject">{mail.subject}</div>
                          <div className="gmail-email-snippet">
                            <strong>{isInbound ? mail.from : mail.to}</strong> · {mail.bodyText?.slice(0, 110)}...
                          </div>
                        </div>
                      </div>

                      <div className="gmail-email-right">
                        <div className="gmail-email-date">
                          <div>{mailDate.toLocaleDateString('de-DE')}</div>
                          <div style={{ fontSize: '0.74rem' }}>{mailDate.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr</div>
                        </div>
                        <button
                          type="button"
                          className="btn-preview-toggle"
                          onClick={(e) => {
                            e.stopPropagation()
                            setExpandedEmailId(isExpanded ? null : mail.id)
                          }}
                        >
                          {isExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                        </button>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="gmail-email-body-expanded">
                        <div className="gmail-email-meta-box">
                          <div><strong>Von:</strong> {mail.from}</div>
                          <div><strong>An:</strong> {mail.to}</div>
                          <div><strong>Datum:</strong> {mailDate.toLocaleString('de-DE')} UTC</div>
                          <div><strong>Partner:</strong> {mail.partnerName}</div>
                          {mail.mandateName && <div><strong>Zugeordnetes Mandat:</strong> {mail.mandateName}</div>}
                          <div><strong>Revisions-ID:</strong> <code>{mail.id}</code></div>
                        </div>

                        <div className="gmail-email-text-box">
                          {mail.bodyText}
                        </div>

                        {mail.matchedKeywords && mail.matchedKeywords.length > 0 && (
                          <div className="gmail-keywords-wrap">
                            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b' }}>Erkannte Signal-Begriffe:</span>
                            {mail.matchedKeywords.map((kw, i) => (
                              <span key={i} className="gmail-keyword-chip">
                                #{kw}
                              </span>
                            ))}
                          </div>
                        )}

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '14px', paddingTop: '10px', borderTop: '1px solid #e2e8f0' }}>
                          <button
                            type="button"
                            className="preview-copy-btn"
                            onClick={() => handleCopyText(`Betreff: ${mail.subject}\n\n${mail.bodyText}`, `gmail-${mail.id}`)}
                          >
                            {copiedField === `gmail-${mail.id}` ? (
                              <><Check size={14} color="#16a34a" /> <strong>Text kopiert!</strong></>
                            ) : (
                              <><Copy size={14} /> <span>E-Mail kopieren</span></>
                            )}
                          </button>

                          <Link
                            to="/nexus/mandats-archiv"
                            className="preview-link-btn"
                            title="Im Mandats-Archiv öffnen"
                          >
                            <Archive size={14} /> <span>Im Mandats-Archiv prüfen</span>
                          </Link>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </div>
        </div>
      )}

      {/* TAB 3: PARTNER-POOL */}
      {activeTab === 'partners' && (
        <div className="partners-grid">
          {filteredPartners.map(p => (
            <div key={p.id} className="partner-card">
              <div className="partner-card-header">
                <div>
                  <div className="partner-tier-badge">{p.tier === 'TIER_1_TOP' ? '👑 TIER 1 BOUTIQUE' : '🏢 MITTELSTANDS-BOUTIQUE'}</div>
                  <h3 className="partner-card-title">{p.name}</h3>
                  <div className="partner-card-loc">{p.location}</div>
                </div>
                <div className="partner-deals-counter">
                  <span className="deals-num">{p.activeDealsCount}</span>
                  <span className="deals-lbl">Aktive Deals</span>
                </div>
              </div>

              <div className="partner-contact-box">
                <div className="contact-main">
                  <User size={15} color="#0284c7" />
                  <div>
                    <div style={{ fontWeight: 700, color: '#0f172a' }}>{p.contactPerson}</div>
                    <div style={{ fontSize: '0.8rem', color: '#64748b' }}>{p.role}</div>
                  </div>
                </div>

                <div className="contact-details-list">
                  <div className="contact-detail-item">
                    <Mail size={13} color="#64748b" />
                    <a href={`mailto:${p.email}`}>{p.email}</a>
                  </div>
                  <div className="contact-detail-item">
                    <Phone size={13} color="#64748b" />
                    <span>{p.phone}</span>
                  </div>
                </div>
              </div>

              <div className="partner-focus-box">
                <span className="focus-label">Mandats-Fokus:</span>
                <p className="focus-text">{p.focus}</p>
              </div>

              {p.notes && (
                <div className="partner-notes-box">
                  <AlertCircle size={13} color="#64748b" />
                  <span>{p.notes}</span>
                </div>
              )}

              <div className="partner-card-footer">
                <button
                  type="button"
                  className="partner-action-btn"
                  onClick={() => {
                    setActiveTab('outreach')
                    setSearchQuery(p.name)
                  }}
                >
                  <Send size={14} /> Ansprachen einsehen
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* MODAL: NEUE ANSPRACHE ERFASSEN */}
      {showNewOutreachModal && (
        <div className="outreach-modal-overlay">
          <div className="outreach-modal">
            <div className="modal-header">
              <h3><Send size={18} /> Neue Mandats-Ansprache protokollieren</h3>
              <button
                type="button"
                className="btn-modal-close"
                onClick={() => setShowNewOutreachModal(false)}
              >
                ✕
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault()
                const form = e.target
                const newRef = form.refCode.value.trim() || `MAN-${Date.now()}`
                const newEntry = {
                  id: `outreach-${Date.now()}`,
                  referenceCode: newRef,
                  company: form.targetComp.value.trim(),
                  role: form.targetRole.value.trim(),
                  partnerCompany: form.partnerSelect.value,
                  partnerContact: form.partnerContact.value.trim(),
                  partnerLocation: 'DACH-Region',
                  partnerEmail: form.partnerEmail.value.trim(),
                  sentAt: new Date().toISOString(),
                  exclusivityUntil: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
                  exclusivityDays: 14,
                  status: 'EXKLUSIV_RESERVIERT',
                  statusLabel: '🟡 Exklusivität aktiv (14 Tage)',
                  budgetBand: form.budgetBand.value.trim(),
                  subject: `Vertrauliches Mandats-Signal · ${form.targetRole.value.trim()} · Ref: ${newRef}`,
                  greeting: `Sehr geehrte Damen und Herren,`,
                  introText: `im Rahmen unseres europäischen Mandate-Radars ist uns eine zeitkritische Sondersituation aufgegangen.`,
                  blindProfile: {
                    entityType: 'Kapitalgesellschaft',
                    region: 'DACH-Raum',
                    industry: form.industry.value.trim() || 'Industrie & Technologie',
                    incident: 'Organvakanz per sofort',
                    situationAnalysis: 'Führungsposition vakant',
                    mandateAngle: form.targetRole.value.trim(),
                    budgetRange: form.budgetBand.value.trim(),
                    exclusivityClause: '14 Tage exklusiver Erstzugriff'
                  },
                  closingText: 'Mit freundlichen Grüßen\nHarro Goerndt',
                  notes: form.notes.value.trim()
                }

                setOutreachEntries(prev => [newEntry, ...prev])
                setShowNewOutreachModal(false)
              }}
            >
              <div className="modal-body">
                <div className="form-group-row">
                  <div className="form-group">
                    <label>Referenz-Code</label>
                    <input name="refCode" defaultValue={`CH-ZG-${new Date().getFullYear()}-VR-02`} required />
                  </div>
                  <div className="form-group">
                    <label>Zielgesellschaft (Intern)</label>
                    <input name="targetComp" placeholder="z.B. OCBasel AG" required />
                  </div>
                </div>

                <div className="form-group-row">
                  <div className="form-group">
                    <label>Vakante Organfunktion</label>
                    <input name="targetRole" defaultValue="Mitglied des Verwaltungsrates (Einzelunterschrift)" required />
                  </div>
                  <div className="form-group">
                    <label>Branche (für Blind-Profil)</label>
                    <input name="industry" placeholder="z.B. Pharma & Healthcare" required />
                  </div>
                </div>

                <div className="form-group-row">
                  <div className="form-group">
                    <label>Partner auswählen</label>
                    <select name="partnerSelect" className="outreach-select">
                      {partners.map(p => (
                        <option key={p.id} value={p.name}>{p.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Ansprechpartner / E-Mail</label>
                    <input name="partnerContact" placeholder="Name Ansprechpartner" defaultValue="Pierina Tannò" required />
                  </div>
                </div>

                <div className="form-group-row">
                  <div className="form-group">
                    <label>Partner E-Mail</label>
                    <input name="partnerEmail" type="email" defaultValue="p.tanno@topfifty.ch" required />
                  </div>
                  <div className="form-group">
                    <label>Budgetband</label>
                    <input name="budgetBand" defaultValue="150.000 – 300.000 CHF" required />
                  </div>
                </div>

                <div className="form-group">
                  <label>Interne Notizen</label>
                  <textarea name="notes" rows={2} placeholder="Exklusivitäts-Bedingungen, Vorbesprechung..." />
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn-modal-cancel" onClick={() => setShowNewOutreachModal(false)}>
                  Abbrechen
                </button>
                <button type="submit" className="outreach-btn-primary">
                  <Check size={16} /> Ansprache speichern & Exklusivität starten
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: NEUEN PARTNER ANLEGEN */}
      {showNewPartnerModal && (
        <div className="outreach-modal-overlay">
          <div className="outreach-modal">
            <div className="modal-header">
              <h3><Building2 size={18} /> Neuen Partner zum Pool hinzufügen</h3>
              <button
                type="button"
                className="btn-modal-close"
                onClick={() => setShowNewPartnerModal(false)}
              >
                ✕
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault()
                const form = e.target
                const newPartner = {
                  id: `partner-${Date.now()}`,
                  name: form.pName.value.trim(),
                  location: form.pLoc.value.trim(),
                  address: form.pAddr.value.trim(),
                  contactPerson: form.pContact.value.trim(),
                  role: form.pRole.value.trim(),
                  email: form.pEmail.value.trim(),
                  phone: form.pPhone.value.trim(),
                  website: form.pWeb.value.trim(),
                  focus: form.pFocus.value.trim(),
                  tier: form.pTier.value,
                  activeDealsCount: 0,
                  notes: form.pNotes.value.trim()
                }

                setPartners(prev => [...prev, newPartner])
                setShowNewPartnerModal(false)
              }}
            >
              <div className="modal-body">
                <div className="form-group-row">
                  <div className="form-group">
                    <label>Boutique- / Partner-Name</label>
                    <input name="pName" placeholder="z.B. Alvarez & Marsal" required />
                  </div>
                  <div className="form-group">
                    <label>Standort & Land</label>
                    <input name="pLoc" placeholder="z.B. Frankfurt am Main 🇩🇪" required />
                  </div>
                </div>

                <div className="form-group-row">
                  <div className="form-group">
                    <label>Ansprechpartner</label>
                    <input name="pContact" placeholder="z.B. Dr. Michael Weber" required />
                  </div>
                  <div className="form-group">
                    <label>Rolle / Funktion</label>
                    <input name="pRole" placeholder="z.B. Managing Director Restructuring" required />
                  </div>
                </div>

                <div className="form-group-row">
                  <div className="form-group">
                    <label>E-Mail</label>
                    <input name="pEmail" type="email" placeholder="kontakt@partner.com" required />
                  </div>
                  <div className="form-group">
                    <label>Telefon</label>
                    <input name="pPhone" placeholder="+49 ..." />
                  </div>
                </div>

                <div className="form-group-row">
                  <div className="form-group">
                    <label>Klassifizierung</label>
                    <select name="pTier" className="outreach-select">
                      <option value="TIER_1_TOP">👑 TIER 1 TOP (Spitzen-Provider / Börse)</option>
                      <option value="TIER_2_MID">🏢 TIER 2 MID (Mittelstands-Boutique)</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Website</label>
                    <input name="pWeb" placeholder="https://..." />
                  </div>
                </div>

                <div className="form-group">
                  <label>Mandats-Fokus & Schwerpunkte</label>
                  <textarea name="pFocus" rows={2} placeholder="z.B. Sanierungsgutachten, CRO-Stellung, Automotive & Maschinenbau" required />
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn-modal-cancel" onClick={() => setShowNewPartnerModal(false)}>
                  Abbrechen
                </button>
                <button type="submit" className="outreach-btn-primary">
                  <Check size={16} /> Partner im Pool speichern
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
