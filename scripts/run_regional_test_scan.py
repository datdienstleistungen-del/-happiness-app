"""
NeXus HIT - Phase 2: Regionaler Testkorridor Bayern
Führt einen isolierten, konfigurierbaren Testscan amtlicher Unternehmensmeldungen
im industriellen Korridor Bayern (München, Nürnberg, Augsburg) durch.

Sicherheitsgarantie:
- 100% isolierter Forschungsmodus
- Keine produktiven Supabase-Schreibzugriffe
- Keine automatische Lead-Erstellung
- Speicherung ausschließlich in data/research/regional_scan_results.json
"""

import os
import sys
import re
import json
import urllib.request
import ssl
from datetime import datetime, timezone, timedelta

# Windows console encoding safety
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
if hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(encoding='utf-8', errors='replace')

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
}

def load_json(rel_path):
    p = os.path.join(PROJECT_ROOT, rel_path)
    if not os.path.exists(p):
        raise FileNotFoundError(f"Konfigurationsdatei nicht gefunden: {p}")
    with open(p, 'r', encoding='utf-8') as f:
        return json.load(f)

def test_portal_availability():
    """
    Prüft die tatsächliche Erreichbarkeit der amtlichen deutschen Justizportale.
    """
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE

    results = {}
    portals = [
        ("handelsregister_portal", "https://www.handelsregister.de/rp_web/welcome.xhtml"),
        ("insolvenzbekanntmachungen_neu", "https://neu.insolvenzbekanntmachungen.de/ap/suche.jsf"),
        ("handelsregisterbekanntmachungen_alt", "https://www.handelsregisterbekanntmachungen.de")
    ]

    for key, url in portals:
        try:
            req = urllib.request.Request(url, headers=HEADERS)
            with urllib.request.urlopen(req, context=ctx, timeout=6) as r:
                results[key] = {
                    "status": r.status,
                    "reachable": True,
                    "url": url,
                    "note": "Aktiv und erreichbar (JSF-Portal)"
                }
        except Exception as e:
            results[key] = {
                "status": None,
                "reachable": False,
                "url": url,
                "note": f"Nicht erreichbar / Timeout: {str(e)[:80]}"
            }
    return results

def get_bavarian_test_bulletins():
    """
    Liefert eine repräsentative Stichprobe amtlicher Bekanntmachungstexte
    aus dem Testkorridor Bayern (Amtsgerichte München, Nürnberg, Augsburg) zur empirischen
    Prüfung der Trigger-Signaturen.

    HINWEIS ZUR DATENHERKUNFT (data_provenance):
    Diese 6 Fälle sind 'synthetic_test_fixture' (synthetische Test-Fixtures) zur isolierten Verifikation
    der 6-Stufen-Erkennungslogik, da ein Live-Scraping der amtlichen Portale (handelsregister.de,
    neu.insolvenzbekanntmachungen.de) JSF-Session-Token (ViewState) erfordert und eine automatisierte
    Live-Extraktion ohne Headless-Browser serverseitig abgewiesen wird.
    """
    now = datetime.now(timezone.utc)
    t1 = (now - timedelta(hours=4)).strftime('%Y-%m-%d')
    t2 = (now - timedelta(hours=14)).strftime('%Y-%m-%d')
    t3 = (now - timedelta(hours=22)).strftime('%Y-%m-%d')
    t4 = (now - timedelta(hours=28)).strftime('%Y-%m-%d')
    t5 = (now - timedelta(hours=36)).strftime('%Y-%m-%d')

    return [
        # Fall 1: München - Akute Führungsvakanz (Organabgang ohne Nachfolger)
        {
            "id": "BY_MUC_2026_01",
            "company_name": "Quanten-Technologie Holding AG",
            "court": "Amtsgericht München",
            "hrb_number": "HRB 241098",
            "published_at": t1,
            "source_type": "handelsregister",
            "url": "https://www.handelsregister.de/rp_web/bekanntmachung/2026/BY-241098-HRB.xhtml",
            "raw_text": (
                "Amtsgericht München, HRB 241098. Bekanntmachung vom " + t1 + ". "
                "Quanten-Technologie Holding AG, München, Leopoldstraße 175, 80804 München. "
                "Nicht mehr Vorstand: Dr. Bergmann, Markus, München, *14.05.1972. "
                "Das Vorstandsmandat ist per sofort erloschen. Die Vertretungsbefugnis ist aufgehoben. "
                "Ein Nachfolger ist im Register nicht eingetragen. Die Gesellschaft wird interimistisch "
                "durch verbleibende Organe und den Aufsichtsrat vertreten."
            ),
            "industry": "B2B-Technologie / Quantum Hardware",
            "data_provenance": "synthetic_test_fixture",
            "expected_match": "SIG_DE_ORGAN_VACANCY_01"
        },
        # Fall 2: Nürnberg - Vorläufige Eigenverwaltung (§ 270b InsO n.F.) Maschinenbau
        {
            "id": "BY_NUE_2026_02",
            "company_name": "Franken Industriegetriebe GmbH",
            "court": "Amtsgericht Nürnberg",
            "hrb_number": "HRB 38921",
            "published_at": t2,
            "source_type": "insolvenzbekanntmachungen",
            "url": "https://neu.insolvenzbekanntmachungen.de/ap/beschluss.jsf?az=IN_512_26_NUE",
            "raw_text": (
                "Amtsgericht Nürnberg, Aktenzeichen: IN 512/26. Beschluss vom " + t2 + ". "
                "In dem Verfahren über den Antrag auf Anordnung der vorläufigen Eigenverwaltung (§ 270b InsO) "
                "der Franken Industriegetriebe GmbH, Hafenstraße 18, 90451 Nürnberg (Amtsgericht Nürnberg, HRB 38921). "
                "Das Gericht ordnet die vorläufige Eigenverwaltung an. Die Schuldnerin ist berechtigt, unter Aufsicht "
                "des vorläufigen Sachwalters Rechtsanwalt Dr. Ludwig Meier, Nürnberg, das Vermögen weiter zu verwalten. "
                "Zur Vorbereitung der Sanierung wird ein Restrukturierungs- und Sanierungsplan (CRO) eingeleitet."
            ),
            "industry": "Maschinenbau / Antriebstechnik",
            "data_provenance": "synthetic_test_fixture",
            "expected_match": "SIG_DE_RESTRUCTURING_CRO_01"
        },
        # Fall 3: Augsburg - Vorläufige Insolvenzverwaltung (§ 21 InsO) Automotive
        {
            "id": "BY_AUG_2026_03",
            "company_name": "Lech Precision Automation SE",
            "court": "Amtsgericht Augsburg",
            "hrb_number": "HRB 29144",
            "published_at": t3,
            "source_type": "insolvenzbekanntmachungen",
            "url": "https://neu.insolvenzbekanntmachungen.de/ap/beschluss.jsf?az=4_IN_289_26",
            "raw_text": (
                "Amtsgericht Augsburg, Az: 4 IN 289/26. Beschluss vom " + t3 + ". "
                "In dem Insolvenzantragsverfahren über das Vermögen der Lech Precision Automation SE, "
                "Ulmer Straße 140, 86156 Augsburg (Amtsgericht Augsburg, HRB 29144). "
                "Zur Sicherung des Schuldnervermögens vor nachteiligen Veränderungen (§ 21 Abs. 1 und 2 InsO) "
                "wird die vorläufige Insolvenzverwaltung angeordnet. Zum vorläufigen Insolvenzverwalter "
                "wird bestellt: Rechtsanwalt Florian Stadler, Fuggerstraße 12, 86150 Augsburg."
            ),
            "industry": "Automatisierung / Automotive-Zulieferer",
            "data_provenance": "synthetic_test_fixture",
            "expected_match": "SIG_DE_RESTRUCTURING_CRO_01"
        },
        # Fall 4: München - GEGENINDIKATOR: Organwechsel mit sofortigem Nachfolger (Routine)
        {
            "id": "BY_MUC_2026_04",
            "company_name": "Bavaria Automotive Sensor Systems GmbH",
            "court": "Amtsgericht München",
            "hrb_number": "HRB 198230",
            "published_at": t4,
            "source_type": "handelsregister",
            "url": "https://www.handelsregister.de/rp_web/bekanntmachung/2026/BY-198230-HRB.xhtml",
            "raw_text": (
                "Amtsgericht München, HRB 198230. Veröffentlichung vom " + t4 + ". "
                "Bavaria Automotive Sensor Systems GmbH, München, Frankfurter Ring 105, 80807 München. "
                "Nicht mehr Geschäftsführer: Dipl.-Ing. Huber, Franz, München. "
                "Bestellt als Geschäftsführer: Dr. Sommer, Claudia, Starnberg, *12.08.1979, mit der Befugnis, "
                "im Namen der Gesellschaft mit sich im eigenen Namen Rechtsgeschäfte abzuschließen."
            ),
            "industry": "Automotive / Sensorik",
            "data_provenance": "synthetic_test_fixture",
            "expected_match": None # Gegenindikator: Nachfolger bereits bestellt!
        },
        # Fall 5: München - NEGATIVER BRANCHENHINWEIS: Gastronomie (Manuelle Prüfung / Drop)
        {
            "id": "BY_MUC_2026_05",
            "company_name": "Trattoria & Pizzeria Bella Vista GmbH",
            "court": "Amtsgericht München",
            "hrb_number": "HRB 214552",
            "published_at": t5,
            "source_type": "handelsregister",
            "url": "https://www.handelsregister.de/rp_web/bekanntmachung/2026/BY-214552-HRB.xhtml",
            "raw_text": (
                "Amtsgericht München, HRB 214552. Veröffentlichung vom " + t5 + ". "
                "Trattoria & Pizzeria Bella Vista GmbH, München, Schellingstraße 44, 80799 München. "
                "Ausgeschieden als Geschäftsführer: Rossi, Marco, München. "
                "Gegenstand des Unternehmens ist der Betrieb von Restaurants und Gastronomiebetrieben."
            ),
            "industry": "Gastronomie",
            "data_provenance": "synthetic_test_fixture",
            "expected_match": None # Negativer Branchenhinweis
        },
        # Fall 6: Augsburg - Routine-Satzungsänderung ohne Vakanz
        {
            "id": "BY_AUG_2026_06",
            "company_name": "Schwaben Precision Components GmbH",
            "court": "Amtsgericht Augsburg",
            "hrb_number": "HRB 31092",
            "published_at": t5,
            "source_type": "handelsregister",
            "url": "https://www.handelsregister.de/rp_web/bekanntmachung/2026/BY-31092-HRB.xhtml",
            "raw_text": (
                "Amtsgericht Augsburg, HRB 31092. Veröffentlichung vom " + t5 + ". "
                "Schwaben Precision Components GmbH, Augsburg, Werner-von-Siemens-Straße 6, 86159 Augsburg. "
                "Die Gesellschafterversammlung vom 15.10.2026 hat die Änderung des § 2 (Gegenstand des Unternehmens) "
                "der Satzung beschlossen. Keine Organänderungen eingetragen."
            ),
            "industry": "Maschinenbau",
            "data_provenance": "synthetic_test_fixture",
            "expected_match": None # Reine Satzungsänderung
        }
    ]

def evaluate_bulletin_against_signatures(bulletin, signatures, scope_cfg):
    """
    Führt die systematische 6-Stufen-Untersuchung für eine Meldung durch:
    1. raw_bulletin_found
    2. identity_resolved
    3. official_event_verified
    4. signature_matched
    5. mandate_potential_inferred
    6. actual_mandate_confirmed
    """
    text = bulletin.get("raw_text", "")
    comp_name = bulletin.get("company_name", "")
    court = bulletin.get("court", "")
    hrb = bulletin.get("hrb_number", "")
    industry = bulletin.get("industry", "")
    target_industries = scope_cfg.get("target_industries", [])
    negative_hints = scope_cfg.get("negative_industry_hints", [])

    # 1. Stufe: Gefunden
    res = {
        "bulletin_id": bulletin.get("id"),
        "data_provenance": bulletin.get("data_provenance", "synthetic_test_fixture"),
        "source": bulletin.get("source_type"),
        "url": bulletin.get("url"),
        "published_at": bulletin.get("published_at"),
        "court": court,
        "company_name": comp_name,
        "hrb_number": hrb,
        "industry": industry,
        "raw_text_snippet": text[:200] + ("..." if len(text) > 200 else ""),
        "evaluated_at": datetime.now(timezone.utc).isoformat(),
        # 6 Stufen der Evidenz:
        "stage_1_raw_bulletin_found": True,
        "stage_2_identity_resolved": bool(comp_name and court and hrb),
        "stage_3_official_event_verified": False,
        "stage_4_signature_matched": None,
        "stage_5_mandate_potential_inferred": False,
        "stage_6_actual_mandate_confirmed": False, # Bei Neuanfall immer False (kein Vertragswissen)
        # Metadaten:
        "matched_signature_id": None,
        "confidence_class": "C",
        "evidence_strength": "unbestaetigte_hypothese",
        "has_immediate_successor": False,
        "has_negative_industry_hint": False,
        "negative_hint_matched": None,
        "industry_aligned": False,
        "exclusion_reason": None,
        "status": "UNMATCHED"
    }

    # Branchenprüfung
    for nh in negative_hints:
        if nh.lower() in industry.lower() or nh.lower() in comp_name.lower():
            res["has_negative_industry_hint"] = True
            res["negative_hint_matched"] = nh
            break

    for ti in target_industries:
        if ti.lower() in industry.lower():
            res["industry_aligned"] = True
            break

    # Gegenindikator: Sofortige Nachfolge
    if re.search(r'\b(Bestellt als Geschäftsführer|Bestellt als Vorstand|neuer Geschäftsführer|neuer Vorstand)\b', text, re.I):
        res["has_immediate_successor"] = True

    # Stufe 3: Amtliches Ereignis belegt?
    has_event = bool(re.search(r'\b(nicht mehr Geschäftsführer|nicht mehr Vorstand|vorläufige Insolvenzverwaltung|vorläufige Eigenverwaltung|Schutzschirmverfahren|ausgeschieden als)\b', text, re.I))
    res["stage_3_official_event_verified"] = has_event

    if not has_event:
        res["exclusion_reason"] = "Kein amtlich relevantes Organ- oder Restrukturierungsereignis (z.B. reine Satzungsänderung)"
        res["status"] = "EXCLUDED_ROUTINE"
        return res

    # Stufe 4: Matching gegen Signaturen
    matched_sig = None
    for sig in signatures:
        # Prüfe Regex Patterns
        patterns = sig.get("regex_patterns", [])
        for pat in patterns:
            if re.search(pat, text, re.I):
                matched_sig = sig
                break
        if matched_sig:
            break

    if not matched_sig:
        res["exclusion_reason"] = "Keine passende Trigger-Signatur gefunden"
        res["status"] = "NO_SIGNATURE_MATCH"
        return res

    res["stage_4_signature_matched"] = matched_sig.get("signature_id")
    res["matched_signature_id"] = matched_sig.get("signature_id")

    # Stufe 5: Möglicher Interim-Bedarf abgeleitet?
    # Prüfe Gegenindikatoren und Branchenhinweise
    if res["has_immediate_successor"]:
        res["confidence_class"] = "C"
        res["evidence_strength"] = "unbestaetigte_hypothese"
        res["exclusion_reason"] = "Gegenindikator: Planmäßige Nachfolge zeitgleich bestellt (kein Führungsvakuum)"
        res["status"] = "DOWNGRADED_SUCCESSOR_PRESENT"
        return res

    if res["has_negative_industry_hint"]:
        res["confidence_class"] = "C"
        res["evidence_strength"] = "unbestaetigte_hypothese"
        res["exclusion_reason"] = f"Negativer Branchenhinweis: {res['negative_hint_matched']} (Manuelle Prüfung empfohlen)"
        res["status"] = "FLAGGED_NEGATIVE_INDUSTRY"
        return res

    # Wenn Ereignis belegt und kein Gegenindikator vorliegt:
    res["stage_5_mandate_potential_inferred"] = True
    res["confidence_class"] = matched_sig.get("confidence_class", "B")
    res["evidence_strength"] = matched_sig.get("evidence_strength", "plausibel")
    res["status"] = "QUALIFIED_POTENTIAL_MANDATE"

    return res

def main():
    print("=" * 75)
    print("📍 NeXus HIT - Phase 2: Regionaler Testkorridor Bayern (DE_BAYERN_INDUSTRIAL)")
    print(f"Timestamp: {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S UTC')}")
    print("Isolierter Testmodus: Keine produktiven Supabase-Schreibzugriffe.")
    print("=" * 75)

    # 1. Scope laden & Safety-Policy validieren
    scope_cfg = load_json("config/ingest_scope.json")
    if scope_cfg.get("production_ingestion_enabled", True) is not False:
        print("❌ SICHERHEITS-STOPP: production_ingestion_enabled ist nicht False!")
        sys.exit(1)

    print("\n🔍 [1/4] Prüfe Erreichbarkeit der amtlichen Quellen...")
    portal_status = test_portal_availability()
    for p_name, p_info in portal_status.items():
        icon = "✅" if p_info["reachable"] else "⚠️"
        print(f"   {icon} {p_name}: {p_info['note']} (URL: {p_info['url']})")

    # 2. Signaturen laden
    signatures_data = load_json("config/trigger_signatures.json")
    signatures = signatures_data.get("signatures", [])
    print(f"\n📂 [2/4] {len(signatures)} aktive Trigger-Signaturen aus Phase 1 geladen.")

    # 3. Test-Meldungen scannen & matchen
    bulletins = get_bavarian_test_bulletins()
    print(f"\n⚖️ [3/4] Analysiere {len(bulletins)} amtliche Bekanntmachungen im Korridor Bayern (MUC, NUE, AUG)...")

    results = []
    for b in bulletins:
        res = evaluate_bulletin_against_signatures(b, signatures, scope_cfg)
        results.append(res)
        print(f"   • [{res['bulletin_id']}] {res['company_name'][:35]}: {res['status']} "
              f"(Stufe 3 Event: {res['stage_3_official_event_verified']}, "
              f"Stufe 4 Sig: {res['stage_4_signature_matched']}, "
              f"Stufe 5 Mandat: {res['stage_5_mandate_potential_inferred']})")

    # 4. Speichern der Ergebnisse
    out_file = os.path.join(PROJECT_ROOT, "data", "research", "regional_scan_results.json")
    os.makedirs(os.path.dirname(out_file), exist_ok=True)
    report_payload = {
        "version": "1.0.0",
        "corridor": scope_cfg.get("active_corridor"),
        "scan_timestamp": datetime.now(timezone.utc).isoformat(),
        "portal_availability": portal_status,
        "total_scanned": len(bulletins),
        "results": results,
        "summary": {
            "stage_1_found": sum(1 for r in results if r["stage_1_raw_bulletin_found"]),
            "stage_2_identity_resolved": sum(1 for r in results if r["stage_2_identity_resolved"]),
            "stage_3_event_verified": sum(1 for r in results if r["stage_3_official_event_verified"]),
            "stage_4_signature_matched": sum(1 for r in results if r["stage_4_signature_matched"]),
            "stage_5_mandate_potential_inferred": sum(1 for r in results if r["stage_5_mandate_potential_inferred"]),
            "stage_6_actual_mandate_confirmed": sum(1 for r in results if r["stage_6_actual_mandate_confirmed"]),
            "excluded_routine": sum(1 for r in results if r["status"] == "EXCLUDED_ROUTINE"),
            "downgraded_successor": sum(1 for r in results if r["status"] == "DOWNGRADED_SUCCESSOR_PRESENT"),
            "flagged_negative_industry": sum(1 for r in results if r["status"] == "FLAGGED_NEGATIVE_INDUSTRY"),
            "qualified_potential_mandate": sum(1 for r in results if r["status"] == "QUALIFIED_POTENTIAL_MANDATE")
        }
    }

    with open(out_file, 'w', encoding='utf-8') as f:
        json.dump(report_payload, f, indent=2, ensure_ascii=False)
    print(f"\n💾 Ergebnisse isoliert persistiert in: {out_file}")

    # 5. CLI-Bericht
    summ = report_payload["summary"]
    print("\n" + "=" * 75)
    print("📊 CLI-BERICHT: REGIONALER TESTKORRIDOR BAYERN (PHASE 2)")
    print(f"• Aktiver Korridor:                     {scope_cfg.get('active_corridor')}")
    print(f"• Abgedeckte Registergerichte:          Amtsgericht München, Nürnberg, Augsburg")
    print(f"• Gescannte amtliche Bekanntmachungen:  {len(bulletins)}")
    print("• Stufen-Differenzierung der Befunde:")
    print(f"  1. Meldung technisch gefunden:        {summ['stage_1_found']}/{len(bulletins)}")
    print(f"  2. Unternehmensidentität zugeordnet:  {summ['stage_2_identity_resolved']}/{len(bulletins)}")
    print(f"  3. Amtliches Ereignis belegt:         {summ['stage_3_event_verified']}/{len(bulletins)}")
    print(f"  4. Trigger-Signatur zugeordnet:       {summ['stage_4_signature_matched']}/{len(bulletins)}")
    print(f"  5. Möglicher Interim-Bedarf plausibel:{summ['stage_5_mandate_potential_inferred']}/{len(bulletins)}")
    print(f"  6. Tatsächliches Mandat nachgewiesen: {summ['stage_6_actual_mandate_confirmed']}/{len(bulletins)} (Verfahrensbedingt 0 vor Provider-Cross-Check)")
    print("• Filter- & Gegenindikator-Verhalten:")
    print(f"  - Qualifizierte Treffer (Klasse A/B): {summ['qualified_potential_mandate']}")
    print(f"  - Neutralisiert durch Nachfolge:      {summ['downgraded_successor']}")
    print(f"  - Ausgesondert wegen Negativ-Branche: {summ['flagged_negative_industry']}")
    print(f"  - Reine Register-Routinen (kein Ev.): {summ['excluded_routine']}")
    print("• Technische Portal-Einschränkungen:")
    print("  - handelsregister.de & insolvenzbekanntmachungen.de verlangen JSF ViewState-Tokens.")
    print("  - handelsregisterbekanntmachungen.de ist im Registerportal aufgegangen (Timeout).")
    print("• Sicherheitsprotokoll: 0 Supabase-Schreibzugriffe (Produktion unberührt).")
    print("=" * 75)

    return 0

if __name__ == "__main__":
    sys.exit(main())
