"""
Unit Tests für Phase 3: Mandate Forensics & Cross-Source Validation (Re-evaluiert)
Prüft:
1. Schema und Pflichtfelder in data/research/mandate_cases.json (inkl. data_provenance, verification_status)
2. Korrekte mathematische Berechnung der zeitlichen Differenz (Delta in Tagen) über calculate_temporal_delta
3. Re-evaluierte Einstufung von Meissner AG und Schlote Holding als 'real_source_unverified' / 'nicht_verifiziert'
4. Delta ist None bei nicht verifizierten Mandatsdaten
5. Negative Kontrollfälle (Traditions-Metallbau Müller GmbH als synthetic_test_fixture)
6. Integrität von mandate_cases.json, cross_source_matches.json und mandate_forensics_report.md
"""

import os
import sys
import json
import unittest

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from scripts.run_mandate_forensics import (
    load_json,
    calculate_temporal_delta,
    get_documented_mandate_cases,
    get_historical_corporate_events,
    perform_cross_source_matching
)

class TestMandateForensics(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        cls.sources_cfg = load_json("config/mandate_forensics_sources.json")
        cls.mandates = get_documented_mandate_cases()
        cls.events = get_historical_corporate_events()
        cls.matches = perform_cross_source_matching(cls.mandates, cls.events, cls.sources_cfg)

    def test_01_mandate_cases_mandatory_fields_and_provenance(self):
        """Prüft, ob alle Pflichtfelder inklusive data_provenance und verification_status vorhanden sind."""
        required_fields = [
            "mandate_case_id", "provider", "company_name", "company_identifier",
            "jurisdiction", "industry", "region", "company_size_class",
            "management_function", "mandate_start_date", "mandate_end_date",
            "mandate_task", "mandate_source_url", "mandate_source_quote",
            "source_publication_date", "source_retrieved_at", "source_quality",
            "privacy_review_status", "data_provenance", "verification_status", "validation_notes"
        ]
        allowed_provenance = {"real_source_verified", "real_source_unverified", "synthetic_test_fixture"}
        for m in self.mandates:
            for field in required_fields:
                self.assertIn(field, m, f"Pflichtfeld '{field}' fehlt in Mandatsfall {m.get('mandate_case_id')}")
            self.assertIn(m["data_provenance"], allowed_provenance,
                f"Ungültige data_provenance '{m['data_provenance']}' in {m.get('mandate_case_id')}")

    def test_02_mathematical_temporal_delta_calculation(self):
        """
        Prüft die mathematische Exaktheit der Zeitabstandsberechnung über calculate_temporal_delta.
        """
        # Test 1: Regulärer Vorlauf (Event 5 Tage vor Mandat)
        delta_pos = calculate_temporal_delta("2024-04-15", "2024-04-10")
        self.assertEqual(delta_pos, 5)

        # Test 2: Nachträgliche Veröffentlichung (Event 8 Tage nach Mandat)
        delta_neg = calculate_temporal_delta("2024-05-10", "2024-05-18")
        self.assertEqual(delta_neg, -8)

        # Test 3: Unbekanntes Datum -> None
        self.assertIsNone(calculate_temporal_delta("unbekannt", "2024-04-10"))
        self.assertIsNone(calculate_temporal_delta("2024-04-15", "unbekannt"))
        self.assertIsNone(calculate_temporal_delta(None, "2024-04-10"))

    def test_03_meissner_and_schlote_classified_as_unverified_mandate(self):
        """
        Strikte Prüfung der Tatsachenbelege:
        Meissner AG und Schlote Holding dürfen NICHT als 'real_source_verified' bezüglich
        eines Interim-Provider-Mandats deklariert sein, da die Sanierungsbegleitung
        durch anwaltliche Generalbevollmächtigte (Brinkmann & Partner, BBL Brockdorff) erfolgte.
        """
        meissner = next((m for m in self.mandates if m["company_name"] == "Meissner AG"), None)
        self.assertIsNotNone(meissner)
        self.assertEqual(meissner["data_provenance"], "real_source_unverified")
        self.assertEqual(meissner["verification_status"], "nicht_verifiziert")
        self.assertEqual(meissner["mandate_start_date"], "unbekannt")
        self.assertIn("Marburg", meissner["company_identifier"]) # Korrektes Gericht: AG Marburg

        schlote = next((m for m in self.mandates if m["company_name"] == "Schlote Automotive Holding GmbH"), None)
        self.assertIsNotNone(schlote)
        self.assertEqual(schlote["data_provenance"], "real_source_unverified")
        self.assertEqual(schlote["verification_status"], "nicht_verifiziert")
        self.assertEqual(schlote["mandate_start_date"], "unbekannt")

    def test_04_cross_matches_reflect_unverified_status(self):
        """
        Prüft, dass bei unvollständigen/unverifizierten Mandatsdaten delta_days auf None steht
        und die Kausalitätsbewertung das Fehlen des Provider-Nachweises transparent ausweist.
        """
        for match in self.matches:
            if match["verification_status"] == "nicht_verifiziert":
                self.assertIsNone(match["delta_days"])
                self.assertEqual(match["temporal_window"], "unbekannt")
                self.assertIn("NICHT VERIFIZIERT", match["causality_assessment"])

    def test_05_negative_control_case_handling(self):
        """
        Prüft Kontrollfall Traditions-Metallbau Müller GmbH:
        Muss strikt als 'synthetic_test_fixture' markiert sein.
        """
        control_case = next(m for m in self.mandates if m["mandate_case_id"] == "CONTROL_CASE_NO_INTERIM_01")
        self.assertEqual(control_case["data_provenance"], "synthetic_test_fixture")
        self.assertEqual(control_case["verification_status"], "synthetische_kontrolle")
        self.assertIn("keine", control_case["management_function"].lower())

    def test_06_persisted_research_files_exist_and_consistent(self):
        """Prüft, ob mandate_cases.json und cross_source_matches.json ordnungsgemäß persistiert sind."""
        mandates_file = os.path.join(PROJECT_ROOT, "data", "research", "mandate_cases.json")
        matches_file = os.path.join(PROJECT_ROOT, "data", "research", "cross_source_matches.json")
        report_file = os.path.join(PROJECT_ROOT, "reports", "mandate_forensics_report.md")

        self.assertTrue(os.path.exists(mandates_file))
        self.assertTrue(os.path.exists(matches_file))
        self.assertTrue(os.path.exists(report_file))

        with open(mandates_file, "r", encoding="utf-8") as f:
            data = json.load(f)
            self.assertIn("mandates", data)
            self.assertEqual(len(data["mandates"]), 5)

if __name__ == "__main__":
    unittest.main()
