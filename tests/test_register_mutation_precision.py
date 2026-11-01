"""
NeXus HIT - Test Suite: Präzisionspatch Handelsregister-Mutationen
Verifiziert die exakte Trennung von Austritt und Bestellung bei Handelsregistermutationen.

Anforderungen:
1. Geschäftsführer scheidet aus, neuer Geschäftsführer gleichzeitig bestellt -> NICHT NACHGEWIESEN, VERWORFEN
2. Verwaltungsrat scheidet aus, neuer Verwaltungsrat gleichzeitig bestellt -> NICHT NACHGEWIESEN, VERWORFEN
3. Ein Mitglied scheidet aus, weitere Mitglieder bleiben im Amt -> NICHT NACHGEWIESEN, STUFE 1
4. Vollständiges Organ scheidet aus, keine Nachfolge dokumentiert -> BESTANDEN, STUFE 2
5. Austritt und Nachfolge in getrennten Veröffentlichungen gemeldet:
   - Veröffentlichung A (nur Austritt) -> BESTANDEN, STUFE 2
   - Veröffentlichung B (nur Bestellung) -> NICHT NACHGEWIESEN, VERWORFEN
6. Unvollständige oder widersprüchliche Registermeldung -> NICHT NACHGEWIESEN, STUFE 1
7. Mehrere Organwechsel innerhalb einer Veröffentlichung:
   - Mehrere GF raus, mehrere GF rein -> NICHT NACHGEWIESEN, VERWORFEN
   - GF raus, nur Prokurist rein -> BESTANDEN, STUFE 2
8. Tonisi Holding AG (Regressionstest) -> NICHT NACHGEWIESEN, VERWORFEN
9. NapaImport GmbH (Regressionstest) -> NICHT NACHGEWIESEN, VERWORFEN

Bestandsschutz:
10. Weinkellereien Aarau AG -> BESTANDEN, STUFE 2 (BOARD_MEMBER)
11. cosquare AG -> BESTANDEN, STUFE 2 (BOARD_MEMBER)
12. Weha Ludwig Werwein GmbH -> NICHT NACHGEWIESEN, STUFE 2 (CRO_INTERIM)
13. Fehlende Nachfolge im Register ist noch kein Beweis für externe Suche -> STUFE 2 (NICHT STUFE 3)
"""

import unittest
from datetime import datetime, timezone

from modules.feed_ingestion.reality_check import (
    MandateRealityCheckEngine,
    analyze_organ_mutations,
    CLASS_MANDAT_PLAUSIBEL,
    CLASS_BEOBACHTEN,
    CLASS_VERWERFEN,
    STAGE_2_PLAUSIBLE_CHANCE,
    STAGE_1_VERIFIED_EVENT,
    STAGE_DISCARDED
)
from modules.feed_ingestion.deal_coach import audit_mandate_lead


class TestRegisterMutationPrecision(unittest.TestCase):

    def test_case_1_gf_simultaneous_succession(self):
        """1. Geschäftsführer scheidet aus, neuer Geschäftsführer wird gleichzeitig bestellt."""
        event = {
            "company_name": "Alpha Logistik GmbH",
            "category": "c_level_vakanz_de",
            "description": "Handelsregister-Bekanntmachung HRB 12345.",
            "evidence_text": "Nicht mehr Geschäftsführer: Thomas Schmidt. Bestellt als Geschäftsführer: Michael Weber.",
            "source_url": "https://www.handelsregisterbekanntmachungen.de",
            "published_at": datetime.now(timezone.utc).isoformat()
        }
        rc = MandateRealityCheckEngine.evaluate(event)
        self.assertEqual(rc["organ_vacuum_status"], "NICHT NACHGEWIESEN")
        self.assertEqual(rc["stage_level"], "VERWORFEN")
        self.assertEqual(rc["status"], CLASS_VERWERFEN)
        self.assertIn("Simultaner Organwechsel", rc["rationale"])

        # DealCoach Audit Prüfung
        item = {
            "company": "Alpha Logistik GmbH",
            "title": "Alpha Logistik GmbH - Registerbekanntmachung",
            "snippet": event["evidence_text"],
            "raw_text": event["evidence_text"],
            "region": "DE"
        }
        is_valid, reason, audit = audit_mandate_lead(item, rc)
        self.assertFalse(is_valid)
        self.assertEqual(audit["tier"], "TIER_3")
        self.assertEqual(audit["audit_verdict"], "DISCARDED_SIMULTANEOUS_SUCCESSION")

    def test_case_2_vr_simultaneous_succession(self):
        """2. Verwaltungsrat scheidet aus, neuer Verwaltungsrat wird gleichzeitig bestellt."""
        event = {
            "company_name": "Beta Pharma AG",
            "category": "c_level_vakanz_ch",
            "description": "Mutation im Schweizerischen Handelsamtsblatt (SHAB).",
            "evidence_text": "Ausgeschiedene Personen und erloschene Unterschriften: Meier, Kurt, Mitglied des Verwaltungsrates. Eingetragene Personen neu: Huber, Beat, Mitglied des Verwaltungsrates.",
            "source_url": "https://www.shab.ch/shabforms/servlet/Search?rubrik=HR02",
            "published_at": datetime.now(timezone.utc).isoformat()
        }
        rc = MandateRealityCheckEngine.evaluate(event)
        self.assertEqual(rc["organ_vacuum_status"], "NICHT NACHGEWIESEN")
        self.assertEqual(rc["stage_level"], "VERWORFEN")
        self.assertEqual(rc["status"], CLASS_VERWERFEN)

    def test_case_3_member_exits_remaining_organs(self):
        """3. Ein Mitglied scheidet aus, weitere Mitglieder bleiben im Amt."""
        event = {
            "company_name": "Gamma Industrietechnik AG",
            "category": "c_level_vakanz_ch",
            "description": "Organmutation SHAB.",
            "evidence_text": "Ausgeschiedene Personen: Müller, Hans, Mitglied des Verwaltungsrates. Die übrigen Mitglieder des Verwaltungsrates bleiben im Amt.",
            "source_url": "https://www.shab.ch",
            "published_at": datetime.now(timezone.utc).isoformat()
        }
        rc = MandateRealityCheckEngine.evaluate(event)
        self.assertEqual(rc["organ_vacuum_status"], "NICHT NACHGEWIESEN")
        self.assertEqual(rc["stage_level"], "STUFE 1")
        self.assertEqual(rc["status"], CLASS_BEOBACHTEN)
        self.assertEqual(rc["target_role"], "KEINE")

    def test_case_4_complete_organ_exits_no_succession(self):
        """4. Vollständiges Organ scheidet aus, keine Nachfolge dokumentiert."""
        event = {
            "company_name": "Delta Automation GmbH",
            "category": "c_level_vakanz_ch",
            "description": "Organausscheiden SHAB.",
            "evidence_text": "Ausgeschiedene Personen und erloschene Unterschriften: Hasler, Daniel, Geschäftsführer, mit Einzelunterschrift.",
            "source_url": "https://www.shab.ch",
            "published_at": datetime.now(timezone.utc).isoformat()
        }
        rc = MandateRealityCheckEngine.evaluate(event)
        self.assertEqual(rc["organ_vacuum_status"], "BESTANDEN")
        self.assertEqual(rc["stage_level"], "STUFE 2")
        self.assertEqual(rc["status"], CLASS_MANDAT_PLAUSIBEL)

    def test_case_5_split_publications(self):
        """5. Austritt und Nachfolge werden in getrennten Veröffentlichungen gemeldet."""
        # Veröffentlichung A: Nur Austritt gemeldet
        event_a = {
            "company_name": "Epsilon Retail SE",
            "category": "c_level_vakanz_ch",
            "description": "Ausscheiden aus dem Organ.",
            "evidence_text": "Ausgeschiedene Personen: Schneider, Frank, Geschäftsführer, Unterschrift erloschen.",
            "source_url": "https://www.shab.ch",
            "published_at": datetime.now(timezone.utc).isoformat()
        }
        rc_a = MandateRealityCheckEngine.evaluate(event_a)
        self.assertEqual(rc_a["organ_vacuum_status"], "BESTANDEN")
        self.assertEqual(rc_a["stage_level"], "STUFE 2")
        self.assertEqual(rc_a["status"], CLASS_MANDAT_PLAUSIBEL)

        # Veröffentlichung B: Spätere Bestellung des Nachfolgers
        event_b = {
            "company_name": "Epsilon Retail SE",
            "category": "c_level_vakanz_de",
            "description": "Neubestellung Geschäftsführung.",
            "evidence_text": "Bestellt als Geschäftsführer: Dr. Wagner, Klaus.",
            "source_url": "https://www.handelsregisterbekanntmachungen.de",
            "published_at": datetime.now(timezone.utc).isoformat()
        }
        rc_b = MandateRealityCheckEngine.evaluate(event_b)
        self.assertEqual(rc_b["stage_level"], "VERWORFEN")
        self.assertEqual(rc_b["status"], CLASS_VERWERFEN)

    def test_case_6_contradictory_or_ambiguous_entry(self):
        """6. Unvollständige oder widersprüchliche Registermeldung."""
        event = {
            "company_name": "Zeta Holding AG",
            "category": "c_level_vakanz_ch",
            "description": "Registermutation.",
            "evidence_text": "Mutation betrifft unklare Registermeldung mit widersprüchlichen Angaben zur Vertretung.",
            "source_url": "https://www.shab.ch",
            "published_at": datetime.now(timezone.utc).isoformat()
        }
        rc = MandateRealityCheckEngine.evaluate(event)
        self.assertEqual(rc["organ_vacuum_status"], "NICHT NACHGEWIESEN")
        self.assertEqual(rc["stage_level"], "STUFE 1")
        self.assertEqual(rc["status"], CLASS_BEOBACHTEN)

    def test_case_7a_multiple_changes_both_replaced(self):
        """7a. Mehrere Organwechsel innerhalb Publikation: Beide Geschäftsführer ersetzt."""
        event = {
            "company_name": "Eta Systems AG",
            "category": "c_level_vakanz_ch",
            "description": "Organwechsel.",
            "evidence_text": "Ausgeschiedene Personen: Müller, Geschäftsführer; Schmidt, Geschäftsführer. Eingetragene Personen neu: Weber, Geschäftsführer; Schulz, Geschäftsführer.",
            "source_url": "https://www.shab.ch",
            "published_at": datetime.now(timezone.utc).isoformat()
        }
        rc = MandateRealityCheckEngine.evaluate(event)
        self.assertEqual(rc["organ_vacuum_status"], "NICHT NACHGEWIESEN")
        self.assertEqual(rc["stage_level"], "VERWORFEN")
        self.assertEqual(rc["status"], CLASS_VERWERFEN)

    def test_case_7b_multiple_changes_only_procurator_appointed(self):
        """7b. Mehrere Organwechsel: GF scheidet aus, neu eingetragen wird lediglich Prokurist."""
        event = {
            "company_name": "Theta Services AG",
            "category": "c_level_vakanz_ch",
            "description": "Organmutation.",
            "evidence_text": "Ausgeschiedene Personen: Müller, Geschäftsführer. Eingetragene Personen neu: Schulz, mit Kollektivprokura zu zweien.",
            "source_url": "https://www.shab.ch",
            "published_at": datetime.now(timezone.utc).isoformat()
        }
        rc = MandateRealityCheckEngine.evaluate(event)
        self.assertEqual(rc["organ_vacuum_status"], "BESTANDEN")
        self.assertEqual(rc["stage_level"], "STUFE 2")
        self.assertEqual(rc["status"], CLASS_MANDAT_PLAUSIBEL)

    def test_case_8_tonisi_holding_regression(self):
        """8. Tonisi Holding AG: Gesamter VR tritt zurück, neuer VR (Präsident + VP) gleichzeitig bestellt."""
        event = {
            "company_name": "Tonisi Holding AG",
            "category": "c_level_vakanz_ch",
            "description": "SHAB-Mutation vom 31.10.2026.",
            "evidence_text": "Ausgeschiedene Personen und erloschene Unterschriften: Weber, Rolf, Delegierter des Verwaltungsrates, mit Kollektivunterschrift zu zweien; Vellidis, Konstantinos, Mitglied des Verwaltungsrates; Weidinger, René, Mitglied des Verwaltungsrates. Eingetragene Personen neu oder mutierend: Brösamle, Dr. Simon-Martin, Präsident des Verwaltungsrates, mit Einzelunterschrift; Pfletschinger, Martin, Vizepräsident des Verwaltungsrates, mit Kollektivunterschrift zu zweien.",
            "source_url": "https://www.shab.ch/shabforms/servlet/Search?rubrik=HR02&id=1006473123",
            "published_at": datetime.now(timezone.utc).isoformat()
        }
        rc = MandateRealityCheckEngine.evaluate(event)
        self.assertEqual(rc["organ_vacuum_status"], "NICHT NACHGEWIESEN")
        self.assertEqual(rc["stage_level"], "VERWORFEN")
        self.assertEqual(rc["status"], CLASS_VERWERFEN)

        # Prüfung auch im DealCoach
        item = {
            "company": "Tonisi Holding AG",
            "title": "Tonisi Holding AG - SHAB Mutation",
            "snippet": event["evidence_text"],
            "raw_text": event["evidence_text"],
            "region": "CH"
        }
        is_valid, reason, audit = audit_mandate_lead(item, rc)
        self.assertFalse(is_valid)
        self.assertEqual(audit["tier"], "TIER_3")

    def test_case_9_napaimport_regression(self):
        """9. NapaImport GmbH: GF scheidet aus, neuer GF gleichzeitig mit Einzelunterschrift bestellt."""
        event = {
            "company_name": "NapaImport GmbH",
            "category": "c_level_vakanz_ch",
            "description": "SHAB-Mutation vom 31.10.2026.",
            "evidence_text": "Ausgeschiedene Personen und erloschene Unterschriften: Hildt, Albert, Geschäftsführer, mit Einzelunterschrift. Eingetragene Personen neu oder mutierend: Schneider, Martin, Geschäftsführer, mit Einzelunterschrift.",
            "source_url": "https://www.shab.ch/shabforms/servlet/Search?rubrik=HR02&id=1006473456",
            "published_at": datetime.now(timezone.utc).isoformat()
        }
        rc = MandateRealityCheckEngine.evaluate(event)
        self.assertEqual(rc["organ_vacuum_status"], "NICHT NACHGEWIESEN")
        self.assertEqual(rc["stage_level"], "VERWORFEN")
        self.assertEqual(rc["status"], CLASS_VERWERFEN)

        # Prüfung auch im DealCoach
        item = {
            "company": "NapaImport GmbH",
            "title": "NapaImport GmbH - SHAB Mutation",
            "snippet": event["evidence_text"],
            "raw_text": event["evidence_text"],
            "region": "CH"
        }
        is_valid, reason, audit = audit_mandate_lead(item, rc)
        self.assertFalse(is_valid)
        self.assertEqual(audit["tier"], "TIER_3")

    def test_case_10_bestandsschutz_weinkellereien_aarau(self):
        """10. Bestandsschutz: Weinkellereien Aarau AG (reales VR-Ausscheiden ohne Nachfolge)."""
        event = {
            "company_name": "Weinkellereien Aarau AG",
            "category": "c_level_vakanz_ch",
            "description": "Mutation SHAB.",
            "evidence_text": "Ausgeschiedene Personen und erloschene Unterschriften: Stucky, Ulrich, von Bettmeralp, in Aarau, Mitglied des Verwaltungsrates, mit Kollektivunterschrift zu zweien.",
            "source_url": "https://www.shab.ch",
            "published_at": datetime.now(timezone.utc).isoformat()
        }
        rc = MandateRealityCheckEngine.evaluate(event)
        self.assertEqual(rc["organ_vacuum_status"], "BESTANDEN")
        self.assertEqual(rc["stage_level"], "STUFE 2")
        self.assertEqual(rc["status"], CLASS_MANDAT_PLAUSIBEL)
        self.assertEqual(rc["target_role"], "BOARD_MEMBER")

    def test_case_11_bestandsschutz_cosquare(self):
        """11. Bestandsschutz: cosquare AG (nachgewiesene Organvakanz)."""
        event = {
            "company_name": "cosquare AG",
            "category": "c_level_vakanz_ch",
            "description": "Senior Board Resignation.",
            "evidence_text": "Senior board director stepped down with immediate effect, leaving an unstaffed organ vacancy. Ausgeschiedene Personen: Lanfranconi, Mitglied des Verwaltungsrates, Unterschrift erloschen.",
            "source_url": "https://www.shab.ch",
            "published_at": datetime.now(timezone.utc).isoformat()
        }
        rc = MandateRealityCheckEngine.evaluate(event)
        self.assertEqual(rc["organ_vacuum_status"], "BESTANDEN")
        self.assertEqual(rc["stage_level"], "STUFE 2")
        self.assertEqual(rc["status"], CLASS_MANDAT_PLAUSIBEL)
        self.assertEqual(rc["target_role"], "BOARD_MEMBER")

    def test_case_12_bestandsschutz_weha_werwein(self):
        """12. Bestandsschutz: Weha Ludwig Werwein GmbH (CRO-/Interim-Chance ohne Organvakanz)."""
        event = {
            "company_name": "Weha Ludwig Werwein GmbH",
            "category": "insolvenzantrag_eigenverwaltung",
            "description": "Insolvenzantrag in Eigenverwaltung beim Amtsgericht Augsburg gestellt.",
            "evidence_text": "Weha Ludwig Werwein stellt Antrag auf Eigenverwaltung. Der Geschäftsbetrieb läuft vollumfänglich weiter.",
            "source_url": "https://www.insolvenzbekanntmachungen.de",
            "published_at": datetime.now(timezone.utc).isoformat()
        }
        rc = MandateRealityCheckEngine.evaluate(event)
        self.assertEqual(rc["organ_vacuum_status"], "NICHT NACHGEWIESEN")
        self.assertEqual(rc["stage_level"], "STUFE 2")
        self.assertEqual(rc["status"], CLASS_MANDAT_PLAUSIBEL)
        self.assertEqual(rc["target_role"], "CRO_INTERIM")

    def test_case_13_missing_successor_not_proof_of_external_search(self):
        """13. Wichtig: Eine fehlende Nachfolge im Register ist noch kein Beweis für eine externe Suche."""
        event = {
            "company_name": "Kappeler Präzision AG",
            "category": "c_level_vakanz_ch",
            "description": "Ausscheiden aus dem Verwaltungsrat.",
            "evidence_text": "Ausgeschiedene Personen: Kappeler, Beat, Mitglied des Verwaltungsrates, Unterschrift erloschen.",
            "source_url": "https://www.shab.ch",
            "published_at": datetime.now(timezone.utc).isoformat()
        }
        rc = MandateRealityCheckEngine.evaluate(event)
        # Muss Stufe 2 bleiben (Plausibel), darf NICHT Stufe 3 werden!
        self.assertEqual(rc["stage_level"], "STUFE 2")
        self.assertEqual(rc["external_search_status"], "NICHT BESTÄTIGT")
        self.assertNotEqual(rc["stage_level"], "STUFE 3")


if __name__ == "__main__":
    unittest.main()
