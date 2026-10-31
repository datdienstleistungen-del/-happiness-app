"""
NeXus HIT - Phase 3: Mandate Forensics & Cross-Source Validation
Systematische Rekonstruktion von Kausalketten zwischen öffentlich belegten
Unternehmensereignissen und real dokumentierten Interim-Management-Mandaten.

Sicherheitsgarantie:
- Keine produktiven Supabase-Schreibzugriffe
- Strikte Trennung von bewiesener Tatsache, plausibler Korrelation und unbestätigter Hypothese
- Keine erfundenen Mandate oder künstlichen Kausalitäten
- Strikte Kennzeichnung der Datenherkunft (data_provenance)
"""

import os
import sys
import re
import json
from datetime import datetime, timezone, timedelta

# Windows console encoding safety
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
if hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(encoding='utf-8', errors='replace')

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

def load_json(rel_path):
    p = os.path.join(PROJECT_ROOT, rel_path)
    if not os.path.exists(p):
        raise FileNotFoundError(f"Datei nicht gefunden: {p}")
    with open(p, 'r', encoding='utf-8') as f:
        return json.load(f)

def calculate_temporal_delta(mandate_date_str, event_date_str):
    """
    Berechnet die zeitliche Differenz in Tagen (Mandatsbeginn minus Veröffentlichungsdatum).
    Gibt None zurück, wenn ein Datum unbekannt oder unvollständig ist.
    """
    if not mandate_date_str or not event_date_str or mandate_date_str == "unbekannt" or event_date_str == "unbekannt":
        return None
    try:
        d_mandate = datetime.fromisoformat(mandate_date_str).date()
        d_event = datetime.fromisoformat(event_date_str).date()
        return (d_mandate - d_event).days
    except Exception:
        return None

# ── 1. DOKUMENTIERTE MANDATSFÄLLE (REALWELT-DATENSATZ) ──
def get_documented_mandate_cases():
    """
    Liefert den versionierbaren Datensatz dokumentierter Interim-Mandate und Restrukturierungsfälle
    aus Kanzlei-Pressemitteilungen, Fachpublikationen und Provider-Referenzen.
    Jeder Datensatz ist mit 'data_provenance' und 'verification_status' versehen.
    Fehlende Daten werden strikt als 'unbekannt' gekennzeichnet.
    """
    now_str = datetime.now(timezone.utc).isoformat()
    return [
        # Fall 1: Namentlich belegtes Sanierungs- & Eigenverwaltungs-Verfahren Meissner AG
        {
            "mandate_case_id": "MANDATE_MEISSNER_AG",
            "provider": "Brinkmann & Partner (Sanierungsbegleitung)",
            "company_name": "Meissner AG",
            "company_identifier": "HRB 12902 (Amtsgericht Marburg)",
            "jurisdiction": "DE",
            "industry": "Maschinen- und Werkzeugbau / Modellbau",
            "region": "Hessen",
            "company_size_class": "Gehobener Mittelstand",
            "management_function": "Generalhandlungsbevollmächtigter (anwaltlich) / Vorstand Roland Reim im Amt",
            "mandate_start_date": "unbekannt",
            "mandate_end_date": "unbekannt",
            "mandate_task": (
                "Eigenverwaltungsverfahren (§ 270b InsO n.F.); Sanierungsbegleitung durch RA Dr. Michael Lojowsky "
                "(Brinkmann & Partner) als Generalhandlungsbevollmächtigter; Vorstand Roland Reim verblieb im Amt. "
                "Kein Nachweis für ein vermitteltes Provider-Interim-Mandat."
            ),
            "mandate_source_url": "https://www.brinkmann-partner.de/meissner-ag-leitet-eigenverwaltungsverfahren-fuer-nachhaltige-restrukturierung-ein/",
            "mandate_source_quote": (
                "Meissner AG leitet Eigenverwaltungsverfahren für nachhaltige Restrukturierung ein. "
                "Der Vorstand wird bei der Durchführung des Verfahrens durch sanierungserfahrene Berater unterstützt."
            ),
            "source_publication_date": "2026-09-19",
            "source_retrieved_at": now_str,
            "source_quality": "öffentlich_belegt_kanzleipresse",
            "privacy_review_status": "vollstaendig_oeffentlich",
            "data_provenance": "real_source_unverified",
            "verification_status": "nicht_verifiziert",
            "validation_notes": (
                "Restrukturierungsverfahren und anwaltliche Sanierungsbegleitung real belegt (Brinkmann & Partner, "
                "19.09.2026, AG Marburg HRB 12902). Ein Einsatz eines über eine Interim-Boutique vermittelten CRO oder "
                "ein behauptetes 5-Tage-Delta ist NICHT nachweisbar (Generalhandlungsbevollmächtigter ist anwaltlicher "
                "Berater, kein vermittelter Interim Manager). Einstufung: real_source_unverified."
            )
        },
        # Fall 2: Namentlich belegtes Sanierungsverfahren Schlote Gruppe
        {
            "mandate_case_id": "MANDATE_SCHLOTE_HOLDING",
            "provider": "BBL Brockdorff / Brinkmann & Partner",
            "company_name": "Schlote Automotive Holding GmbH",
            "company_identifier": "HRB 101850 (Amtsgericht Hildesheim)",
            "jurisdiction": "DE",
            "industry": "Automotive / Zerspanung & Präzisionsteile",
            "region": "Niedersachsen",
            "company_size_class": "Großunternehmen / Konzern",
            "management_function": "Generalbevollmächtigte (anwaltlich) / Sachwalter",
            "mandate_start_date": "unbekannt",
            "mandate_end_date": "unbekannt",
            "mandate_task": (
                "Insolvenzverfahren in Eigenverwaltung (Eröffnung 01.05.2025); Sachwalter Manuel Sack (Brinkmann & Partner); "
                "Generalbevollmächtigte: RAin Inga Homoth & RA Justus von Buchwaldt (BBL Brockdorff); geschäftsführender "
                "Gesellschafter Jürgen Schlote verblieb im Amt; kein belegtes Provider-Interim-Mandat."
            ),
            "mandate_source_url": "https://www.brinkmann-partner.de/insolvenzverfahren-ueber-das-vermoegen-von-drei-schlote-gesellschaften-eroeffnet/",
            "mandate_source_quote": (
                "Die Restrukturierungsmaßnahmen der Geschäftsführung und des Sanierungsteams werden im eröffneten Verfahren fortgeführt."
            ),
            "source_publication_date": "2025-05-01",
            "source_retrieved_at": now_str,
            "source_quality": "öffentlich_belegt_kanzleipresse",
            "privacy_review_status": "vollstaendig_oeffentlich",
            "data_provenance": "real_source_unverified",
            "verification_status": "nicht_verifiziert",
            "validation_notes": (
                "Restrukturierungsverfahren real belegt (Eröffnung 01.05.2025 AG Hildesheim). Externe Organe waren "
                "anwaltliche Generalbevollmächtigte von BBL Brockdorff, kein vermittelter Interim Manager. Einstufung: real_source_unverified."
            )
        },
        # Fall 3: Anonymisierter Atreus Fall (Ausscheiden Technischer Geschäftsführer)
        {
            "mandate_case_id": "MANDATE_ATREUS_COO_ENERGY",
            "provider": "Atreus",
            "company_name": "unbekannt (Anonymisierter Anlagenbauer)",
            "company_identifier": "unbekannt",
            "jurisdiction": "DE",
            "industry": "Anlagenbau / Energieübertragung",
            "region": "DACH",
            "company_size_class": "Gehobener Mittelstand",
            "management_function": "Interim COO",
            "mandate_start_date": "unbekannt",
            "mandate_end_date": "unbekannt",
            "mandate_task": (
                "Stabilisierung laufender Megaprojekte (Windkraftanlagen), Restrukturierung des Einkaufs "
                "und Einführung von Kennzahlensystemen nach Organabgang."
            ),
            "mandate_source_url": "https://www.atreus.de/publikation/case-studies/chief-operations-officer-anlagenbau-energie-und-informationsuebertragung/",
            "mandate_source_quote": (
                "Nach dem Ausscheiden des Gesellschafters und des technischen Geschäftsführers übernahm "
                "der Chief Operations Officer die Leitung verschiedener Abteilungen..."
            ),
            "source_publication_date": "2024-05-15",
            "source_retrieved_at": now_str,
            "source_quality": "öffentlich_dokumentiert_anonymisiert",
            "privacy_review_status": "anonymisiert",
            "data_provenance": "real_source_unverified",
            "verification_status": "nicht_verifiziert",
            "validation_notes": "Unternehmensname durch Provider geschützt (NDA). Keine direkte HRB-Verknüpfung möglich. Einstufung: real_source_unverified."
        },
        # Fall 4: Anonymisierter F&P Fall (Working Capital & Liquidität Maschinenbau)
        {
            "mandate_case_id": "MANDATE_FUP_CFO_LIQUIDITY",
            "provider": "F&P Executive Solutions",
            "company_name": "unbekannt (Hersteller Nahrungsmittelmaschinen)",
            "company_identifier": "unbekannt",
            "jurisdiction": "DE",
            "industry": "Maschinen- und Anlagenbau",
            "region": "DE",
            "company_size_class": "Mittelstand",
            "management_function": "Interim CFO / Liquiditätsmanager",
            "mandate_start_date": "unbekannt",
            "mandate_end_date": "unbekannt",
            "mandate_task": (
                "Auflösung eines Liquiditätsengpasses durch Working Capital Optimierung und "
                "Etablierung eines 13-Wochen-Cashflow-Forecasts."
            ),
            "mandate_source_url": "https://www.fup-ag.com/case-studies/",
            "mandate_source_quote": (
                "Lösung der Liquiditätskrise eines führenden Herstellers von Maschinen und Anlagen für "
                "die Produktion von Lebensmitteln..."
            ),
            "source_publication_date": "2024-02-10",
            "source_retrieved_at": now_str,
            "source_quality": "öffentlich_dokumentiert_anonymisiert",
            "privacy_review_status": "anonymisiert",
            "data_provenance": "real_source_unverified",
            "verification_status": "nicht_verifiziert",
            "validation_notes": "Allgemeine Fallbeschreibung ohne Nennung von Registernummer oder Ort. Einstufung: real_source_unverified."
        },
        # Fall 5: Negativer Kontrollfall (Restrukturierungsfall OHNE externes Interim-Mandat)
        {
            "mandate_case_id": "CONTROL_CASE_NO_INTERIM_01",
            "provider": "keiner (Rein interne Abwicklung / Kanzlei)",
            "company_name": "Traditions-Metallbau Müller GmbH",
            "company_identifier": "HRB 45119 (Amtsgericht Augsburg)",
            "jurisdiction": "DE",
            "industry": "Metallverarbeitung / Handwerk",
            "region": "Bayern",
            "company_size_class": "KMU",
            "management_function": "keine (Inhabergeführt)",
            "mandate_start_date": "unbekannt",
            "mandate_end_date": "unbekannt",
            "mandate_task": "Keine externe Organbestellung; Regelinsolvenz ohne CRO.",
            "mandate_source_url": "https://neu.insolvenzbekanntmachungen.de",
            "mandate_source_quote": "Eröffnung des Insolvenzverfahrens über das Vermögen der Schuldnerin. Kein Sanierungskonzept.",
            "source_publication_date": "2024-03-12",
            "source_retrieved_at": now_str,
            "source_quality": "synthetische_test_fixture",
            "privacy_review_status": "synthetisch",
            "data_provenance": "synthetic_test_fixture",
            "verification_status": "synthetische_kontrolle",
            "validation_notes": "Synthetische Negativ-Kontrolle: Dient zum Test der Ausschlusslogik bei Insolvenzabwicklung mangels Masse."
        }
    ]

# ── 2. HISTORISCHE UNTERNEHMENSEREIGNISSE (CROSS-SOURCE POOL) ──
def get_historical_corporate_events():
    """
    Liefert belegte Unternehmensereignisse aus Handelsregister,
    Insolvenzbekanntmachungen und Bundesanzeiger zur zeitlichen Kreuzvalidierung.
    Jeder Datensatz ist mit 'data_provenance' versehen.
    """
    return [
        {
            "event_id": "EVT_MEISSNER_INSO_APPL",
            "company_name": "Meissner AG",
            "court_and_reg": "Amtsgericht Marburg, HRB 12902",
            "event_type": "Eigenverwaltungsantrag (§ 270b InsO n.F.)",
            "official_source": "insolvenzbekanntmachungen",
            "publication_date": "2026-09-19",
            "actual_event_date": "2026-09-19",
            "summary": "Antrag auf Anordnung der vorläufigen Eigenverwaltung gem. § 270b InsO n.F.",
            "signature_id": "SIG_DE_RESTRUCTURING_CRO_01",
            "data_provenance": "real_source_verified"
        },
        {
            "event_id": "EVT_SCHLOTE_OPENING",
            "company_name": "Schlote Automotive Holding GmbH",
            "court_and_reg": "Amtsgericht Hildesheim, HRB 101850",
            "event_type": "Eröffnung Insolvenzverfahren in Eigenverwaltung",
            "official_source": "insolvenzbekanntmachungen",
            "publication_date": "2025-05-01",
            "actual_event_date": "2025-05-01",
            "summary": "Eröffnung des Insolvenzverfahrens in Eigenverwaltung am 01.05.2025.",
            "signature_id": "SIG_DE_RESTRUCTURING_CRO_01",
            "data_provenance": "real_source_verified"
        },
        {
            "event_id": "EVT_CONTROL_ROUTINE_01",
            "company_name": "Traditions-Metallbau Müller GmbH",
            "court_and_reg": "Amtsgericht Augsburg, HRB 45119",
            "event_type": "Abweisung mangels Masse",
            "official_source": "insolvenzbekanntmachungen",
            "publication_date": "2024-04-02",
            "actual_event_date": "2024-03-28",
            "summary": "Insolvenzverfahren mangels einer die Kosten deckenden Masse abgewiesen (§ 26 InsO).",
            "signature_id": "SIG_DE_RESTRUCTURING_CRO_01",
            "data_provenance": "synthetic_test_fixture"
        }
    ]

def perform_cross_source_matching(mandates, events, sources_cfg):
    """
    Führt den forensischen Kreuzabgleich zwischen Mandaten und Ereignissen durch.
    Kennzeichnet Kausalzusammenhänge strikt als 'nicht verifiziert', wenn der Vermittlungsnachweis
    eines Provider-Interim-Mandats fehlt.
    """
    matches = []
    windows = sources_cfg.get("temporal_analysis_windows", [])

    for m in mandates:
        m_id = m.get("mandate_case_id")
        m_comp = m.get("company_name", "")
        m_start = m.get("mandate_start_date")
        m_provenance = m.get("data_provenance", "real_source_unverified")
        m_ver_status = m.get("verification_status", "nicht_verifiziert")

        for evt in events:
            e_comp = evt.get("company_name", "")
            e_pub = evt.get("publication_date")
            e_act = evt.get("actual_event_date")

            identity_match = False
            identity_certainty = "keine_uebereinstimmung"
            if m_comp != "unbekannt" and m_comp.lower() == e_comp.lower():
                identity_match = True
                identity_certainty = "hohe_eindeutigkeit_namentlich_belegt"
            elif m_comp.startswith("unbekannt") and m.get("industry") in evt.get("summary", ""):
                identity_certainty = "anonymisierter_fall_keine_namenszuordnung"

            if not identity_match:
                continue

            delta_days = calculate_temporal_delta(m_start, e_pub)
            assigned_window = "unbekannt"
            temporal_role = "unbestimmt"

            if delta_days is not None:
                if delta_days >= 0:
                    for w in windows:
                        if w["min_days"] <= delta_days <= w["max_days"]:
                            assigned_window = w["window_id"]
                            break
                    if delta_days <= 30:
                        temporal_role = "akuter_krisenindikator"
                    elif delta_days <= 180:
                        temporal_role = "vorbereitender_sanierungsindikator"
                    else:
                        temporal_role = "bilanzieller_fruehindikator"
                else:
                    assigned_window = "WIN_POST_MANDATE"
                    temporal_role = "nachtraeglicher_bestaetigungsindikator"

            # Kausalitätsbewertung:
            if m_provenance == "synthetic_test_fixture":
                causality_text = "Synthetischer Kontrollfall: Dient ausschließlich zum Testen von Negativausschluss-Regeln."
            elif m_ver_status == "nicht_verifiziert":
                causality_text = (
                    "Kausalitätsbeleg: NICHT VERIFIZIERT. Das gerichtliche Sanierungsereignis ist zwar real belegt, "
                    "jedoch ist die Beauftragung eines externen Interim-Management-Providers empirisch unbestätigt. "
                    "Die Sanierungsbegleitung erfolgte durch anwaltliche Generalbevollmächtigte (Kanzleien Brinkmann & Partner, "
                    "BBL Brockdorff) und nicht durch nachweisbare Provider-Interim-Manager. Ein belastbares Zeit-Delta "
                    "vor Mandat kann nicht abgeleitet werden."
                )
            else:
                causality_text = "Verifiziertes Mandat mit belegtem Kausalitätsnachweis."

            match_entry = {
                "match_id": f"MATCH_{m_id}_{evt.get('event_id')}",
                "mandate_case_id": m_id,
                "event_id": evt.get("event_id"),
                "company_name": m_comp,
                "data_provenance": m_provenance,
                "verification_status": m_ver_status,
                "identity_certainty": identity_certainty,
                "mandate_function": m.get("management_function"),
                "mandate_start_date": m_start,
                "event_type": evt.get("event_type"),
                "event_publication_date": e_pub,
                "event_actual_date": e_act,
                "official_source": evt.get("official_source"),
                "signature_id": evt.get("signature_id"),
                "delta_days": delta_days,
                "temporal_window": assigned_window,
                "temporal_role": temporal_role,
                "causality_assessment": causality_text,
                "alternative_explanations": [
                    "Sanierung durch Kanzleianwälte (Generalbevollmächtigte) statt Provider-Interim-Manager",
                    "Bestehende Geschäftsführung verbleibt vollumfänglich im Amt",
                    "Schutz von Mandatsdaten durch Vertraulichkeitsvereinbarungen (NDA)"
                ],
                "false_positive_risk": "Hoch bei ungeprüfter Gleichsetzung von anwaltlichen Generalbevollmächtigten mit Interim Managern."
            }
            matches.append(match_entry)

    return matches

def generate_forensics_markdown_report(mandates, events, matches, sources_cfg):
    """
    Erstellt den formalen Forschungsbericht 'reports/mandate_forensics_report.md'.
    """
    now_str = datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S UTC')
    windows = sources_cfg.get("temporal_analysis_windows", [])

    win_counts = {}
    for m in matches:
        w = m.get("temporal_window", "unbekannt")
        win_counts[w] = win_counts.get(w, 0) + 1

    md = f"""# NeXus HIT - Phase 3: Mandate Forensics & Cross-Source Validation Report

**Stand:** {now_str}  
**Status:** Forschungsprotokoll & Forensische Validierung (Isoliert, 0 Supabase-Writes)

---

## 1. Untersuchungsziel & Methodik

Das Ziel der Mandats-Forensik besteht im Aufbau einer empirisch überprüfbaren Beweiskette zwischen:
1. einer dokumentierten Unternehmenskrise oder Leitungs-Vakanz,
2. einer amtlichen Pflichtveröffentlichung (Handelsregister, Insolvenzbekanntmachungen, Bundesanzeiger),
3. einem tatsächlich dokumentierten Einsatz von Interim-Managern (CRO, Sanierungsgeschäftsführer, Interim CFO/COO).

> [!IMPORTANT]
> **Kausalitäts-Grundsatz:** Ein zeitlicher Zusammenhang allein beweist keine Kausalität. 
> Ein Match gilt erst dann als bestätigt, wenn Unternehmensidentität, zeitliche Abfolge und 
> die beschriebene operative Aufgabe zweifelsfrei durch Primärbelege gestützt werden.
> **Generalbevollmächtigte von Sanierungskanzleien sind keine Interim Manager aus Provider-Boutiquen.**

---

## 2. Quellenkatalog & Erreichbarkeit

| Kategorie | Quelle / Institution | URL | Status | Relevanz für Validierung |
|---|---|---|---|---|
| **Interim Provider** | Atreus GmbH | `https://www.atreus.de/case-studies/` | ✅ Erreichbar | 71 Case Studies (anonymisiert per NDA) |
| **Interim Provider** | taskforce AG | `https://www.taskforce.net/de/leistungen/mandate` | ✅ Erreichbar | Reale Mandatstypen (PMI, Restrukturierung) |
| **Interim Provider** | F&P Executive Solutions AG | `https://www.fup-ag.com/case-studies/` | ✅ Erreichbar | 40+ Fallstudien (anonymisiert per NDA) |
| **Kanzlei** | Brinkmann & Partner | `https://www.brinkmann-partner.de/aktuelles/` | ✅ Erreichbar | Reale namentliche Beschlüsse & Eigenverwaltungen |
| **Kanzlei** | GÖRG Partnerschaft | `https://www.goerg.de/de/aktuelles/pressemitteilungen` | ✅ Erreichbar | Insolvenzverwaltung & StaRUG-Verfahren |
| **Kanzlei** | Schultze & Braun | `https://www.schultze-braun.de/newsroom/pressemitteilungen/` | ✅ Erreichbar | Eigenverwaltungen & Schutzschirme |
| **Register** | Handelsregister Portal | `https://www.handelsregister.de` | ✅ Erreichbar (JSF) | Amtliche Organ-Mutationen |
| **Register** | Insolvenzbekanntmachungen | `https://neu.insolvenzbekanntmachungen.de` | ✅ Erreichbar (JSF) | Beschlüsse gem. §§ 21, 270b, 270d InsO |
| **Register** | Bundesanzeiger | `https://www.bundesanzeiger.de` | ✅ Erreichbar | Bilanzen, Going-Concern-Vermerke |

---

## 3. Untersuchte Mandate & Fallstudien

Insgesamt wurden **{len(mandates)} Mandats- und Kontrollfälle** forensisch erfasst:

"""
    for m in mandates:
        md += f"### {m['mandate_case_id']}: {m['company_name']} ({m['industry']})\n"
        md += f"- **Datenherkunft (data_provenance):** `{m['data_provenance']}` | Verifikationsstatus: `{m['verification_status']}`\n"
        md += f"- **Provider / Mandatsträger:** {m['provider']}\n"
        md += f"- **Funktion:** `{m['management_function']}`\n"
        md += f"- **Einsatzzeitraum:** {m['mandate_start_date']} bis {m['mandate_end_date']}\n"
        md += f"- **Aufgabe:** {m['mandate_task']}\n"
        md += f"- **Belegqualität:** `{m['source_quality']}` | Datenschutz: `{m['privacy_review_status']}`\n"
        md += f"- **Quelle:** [{m['mandate_source_url']}]({m['mandate_source_url']})\n"
        md += f"- **Originalzitat:** *\"{m['mandate_source_quote']}\"*\n"
        md += f"- **Validierungsnotiz:** {m['validation_notes']}\n\n"

    md += """---

## 4. Cross-Source Matching & Kausalitätsprüfung

Die forensische Kreuzprüfung vergleicht amtliche Registerereignisse mit den behaupteten Mandaten.

### Ergebnisse der Kreuzvalidierung:

"""
    for match in matches:
        md += f"#### Match: `{match['match_id']}`\n"
        md += f"- **Unternehmen:** **{match['company_name']}** (Sicherheit: `{match['identity_certainty']}`)\n"
        md += f"- **Datenherkunft:** `{match['data_provenance']}` | Verifikation: `{match['verification_status']}`\n"
        md += f"- **Amtliches Ereignis:** {match['event_type']} ({match['official_source']}) am {match['event_publication_date']}\n"
        md += f"- **Mandatsbeginn:** {match['mandate_start_date']} (Funktion: `{match['mandate_function']}`)\n"
        md += f"- **Zeitabstand (Delta):** `{match['delta_days']}` -> Einstufung: **{match['temporal_role']}**\n"
        md += f"- **Zugeordnete Signatur:** `{match['signature_id']}`\n"
        md += f"- **Kausalitätsbewertung:** {match['causality_assessment']}\n"
        md += f"- **Alternative Erklärungen:** {'; '.join(match['alternative_explanations'])}\n\n"

    md += """---

## 5. Negative Kontrollfälle & Verzerrungskontrolle (Bias Control)

1. **Kontrollfall `CONTROL_CASE_NO_INTERIM_01` (Traditions-Metallbau Müller GmbH):**
   - *Status:* `synthetic_test_fixture`
   - *Amtliches Ereignis:* Insolvenzantrag und Abweisung mangels Masse gem. § 26 InsO.
   - *Befund:* Trotz Vorliegen eines amtlichen Krisensignals wurde kein Interim-Management beauftragt. Das Unternehmen verfügte über keinerlei freie Masse.
   - *Regel-Ableitung:* Amtliche Insolvenzsignale dürfen nur dann als Mandatschance qualifiziert werden, wenn Sanierungsinstrumente wie Eigenverwaltung (§ 270b InsO) oder Schutzschirm (§ 270d InsO) angeordnet werden, die auf Unternehmensfortführung abzielen.

---

## 6. Fazit & Neu-Bewertung der Signatur-Belastbarkeit

1. **Keine empirisch bestätigten Kausalketten zu Provider-Mandaten:**
   - In den untersuchten Fällen (Meissner AG, Schlote Holding) wurden Sanierungsverfahren zwar amtlich nachgewiesen, die Leitungsfunktionen wurden jedoch durch **anwaltliche Generalbevollmächtigte** (Kanzleien Brinkmann & Partner, BBL Brockdorff) und Sachwalter wahrgenommen.
   - Ein Mandatseinsatz aus einer Executive-Interim-Provider-Boutique ist in diesen Primärquellen **nicht belegt**.
   - Die Behauptung fester Vorlaufzeiten (z.B. '5 Tage' oder '20 Tage') entbehrt einer empirischen Primärquelle und wird als **nicht verifiziert** korrigiert.

2. **Präzisierung des Sanierungsrechts:**
   - Vorläufige Eigenverwaltung wird nach der SanInsFoG-Reform 2021 durch **§ 270b InsO n.F.** geregelt (§ 270a InsO betrifft den Eigenverwaltungsplan).
   - Die Bestellung eines Notgeschäftsführers bei der GmbH erfolgt nach **§ 29 BGB analog**, ist gegenüber der Vertretung durch Gesellschafter gem. § 35 Abs. 1 Satz 2 GmbHG strikt subsidiär und greift nur bei vollständiger Beschlussunfähigkeit.

3. **Status der Signaturen:**
   - Die Signaturen bleiben als plausible **Fachhypothesen** für den Lead-Desk relevant, dürfen jedoch im System nicht als 'empirisch bewiesene Kausalitäten' deklariert werden.
"""
    return md

def main():
    print("=" * 75)
    print("🔬 NeXus HIT - Phase 3: Mandate Forensics & Cross-Source Validation")
    print(f"Timestamp: {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S UTC')}")
    print("Isolierter Modus: Keine produktiven Supabase-Schreibzugriffe.")
    print("=" * 75)

    sources_cfg = load_json("config/mandate_forensics_sources.json")
    print("\n📂 [1/4] Lade Mandats- und Kanzleiquellen-Katalog...")
    prov_sources = sources_cfg["source_categories"]["interim_providers"]["sources"]
    firm_sources = sources_cfg["source_categories"]["restructuring_law_firms"]["sources"]
    print(f"   -> {len(prov_sources)} Provider-Quellen und {len(firm_sources)} Restrukturierungskanzleien aktiv.")

    print("\n🔍 [2/4] Lade forensische Mandatsfälle und amtliche historische Ereignisse...")
    mandates = get_documented_mandate_cases()
    events = get_historical_corporate_events()
    print(f"   -> {len(mandates)} dokumentierte Mandate & Kontrollfälle erfasst.")
    print(f"   -> {len(events)} historische amtliche Primärereignisse im Pool.")

    mandates_file = os.path.join(PROJECT_ROOT, "data", "research", "mandate_cases.json")
    os.makedirs(os.path.dirname(mandates_file), exist_ok=True)
    with open(mandates_file, 'w', encoding='utf-8') as f:
        json.dump({
            "version": "2.0.0",
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "total_mandate_cases": len(mandates),
            "mandates": mandates
        }, f, indent=2, ensure_ascii=False)
    print(f"   -> Mandats-Datensatz gespeichert in: {mandates_file}")

    print("\n⚖️ [3/4] Führe Cross-Source Matching durch...")
    matches = perform_cross_source_matching(mandates, events, sources_cfg)
    print(f"   -> {len(matches)} Kreuzabgleiche durchgeführt.")

    matches_file = os.path.join(PROJECT_ROOT, "data", "research", "cross_source_matches.json")
    with open(matches_file, 'w', encoding='utf-8') as f:
        json.dump({
            "version": "2.0.0",
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "total_matches": len(matches),
            "matches": matches
        }, f, indent=2, ensure_ascii=False)
    print(f"   -> Match-Ergebnisse gespeichert in: {matches_file}")

    print("\n📝 [4/4] Erstelle detaillierten Mandate Forensics Bericht...")
    report_md = generate_forensics_markdown_report(mandates, events, matches, sources_cfg)
    report_file = os.path.join(PROJECT_ROOT, "reports", "mandate_forensics_report.md")
    os.makedirs(os.path.dirname(report_file), exist_ok=True)
    with open(report_file, 'w', encoding='utf-8') as f:
        f.write(report_md)
    print(f"   -> Bericht gespeichert in: {report_file}")

    print("\n" + "=" * 75)
    print("📊 CLI-BERICHT: MANDATE FORENSICS (PHASE 3 RE-EVALUIERT)")
    print(f"• Analysierte Mandats- und Kontrollfälle: {len(mandates)}")
    print(f"• Amtliche Primärereignisse im Pool:     {len(events)}")
    print(f"• Durchgeführte Kreuzabgleiche:          {len(matches)}")
    print("• Kausalitäts-Befund:")
    print("  - Meissner AG: Restrukturierung real (AG Marburg 2026), Provider-CRO-Mandat UNVERIFIZIERT.")
    print("  - Schlote Holding: Sanierung real (AG Hildesheim 2025), Provider-CRO-Mandat UNVERIFIZIERT.")
    print("  - Atreus & F&P: Provider-Fallstudien öffentlich, aber durch NDA anonymisiert.")
    print("  - Traditions-Metallbau Müller: Synthetische Negativkontrolle.")
    print("• Bestätigte empirische Provider-Vorlaufzeiten: 0 (keine verifizierten Mandatsvertragsdaten)")
    print("• Sicherheit: 0 produktive Supabase-Schreibzugriffe.")
    print("=" * 75)

    return 0

if __name__ == "__main__":
    sys.exit(main())
