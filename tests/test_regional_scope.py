"""
Unit Tests für Phase 2: Regionaler Testkorridor Bayern (DE_BAYERN_INDUSTRIAL)
Prüft:
1. Konfigurations-Integrität in config/ingest_scope.json (production_ingestion_enabled == False)
2. Regionale Einschränkung auf bayerische Registergerichte (München, Nürnberg, Augsburg)
3. Strikte Trennung der 6 Evidenz-Stufen (Meldung -> Identität -> Event -> Signatur -> Mandatspotenzial -> Tatsächliches Mandat)
4. Gegenindikator-Verhalten (Sofortige Nachfolge stuft Score herab)
5. Negativer Branchenhinweis (Gastronomie etc. markiert Flag, kein starrer Komplettausschluss)
6. Korrekte Persistierung in data/research/regional_scan_results.json ohne Supabase-Writes
"""

import os
import sys
import json
import unittest

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from scripts.run_regional_test_scan import (
    load_json,
    evaluate_bulletin_against_signatures,
    get_bavarian_test_bulletins
)

class TestRegionalScope(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        cls.scope_cfg = load_json("config/ingest_scope.json")
        cls.sig_data = load_json("config/trigger_signatures.json")
        cls.signatures = cls.sig_data.get("signatures", [])
        cls.bulletins = get_bavarian_test_bulletins()

    def test_01_scope_config_production_disabled(self):
        """Sicherheits-Check: production_ingestion_enabled muss strikt False sein."""
        self.assertFalse(self.scope_cfg.get("production_ingestion_enabled"),
            "CRITICAL: production_ingestion_enabled muss im Testscope False sein!")
        self.assertEqual(self.scope_cfg.get("mode"), "planned_test_scan")
        self.assertEqual(self.scope_cfg.get("active_corridor"), "DE_BAYERN_INDUSTRIAL")

    def test_02_bavarian_courts_defined(self):
        """Prüft, ob die Gerichte München, Nürnberg und Augsburg konfiguriert sind."""
        court_names = [c["name"] for c in self.scope_cfg.get("courts", [])]
        self.assertIn("Amtsgericht München", court_names)
        self.assertIn("Amtsgericht Nürnberg", court_names)
        self.assertIn("Amtsgericht Augsburg", court_names)

    def test_03_six_stages_differentiation(self):
        """
        Prüft, dass die 6 Stufen der Evidenzkette sauber getrennt im Ergebnis existieren
        und stage_6 (tatsächliches Mandat) bei Neuanfall nicht einfach als True behauptet wird.
        """
        sample_b = self.bulletins[0] # Quanten-Technologie Holding AG
        res = evaluate_bulletin_against_signatures(sample_b, self.signatures, self.scope_cfg)

        self.assertTrue(res["stage_1_raw_bulletin_found"])
        self.assertTrue(res["stage_2_identity_resolved"])
        self.assertTrue(res["stage_3_official_event_verified"])
        self.assertEqual(res["stage_4_signature_matched"], "SIG_DE_ORGAN_VACANCY_01")
        self.assertTrue(res["stage_5_mandate_potential_inferred"])
        self.assertFalse(res["stage_6_actual_mandate_confirmed"],
            "Stufe 6 (Tatsächliches Mandat) darf am reinen Signal-Anfall nicht wahr sein!")

    def test_04_counter_indicator_downgrades_successor(self):
        """
        Prüft Fall 4 (Bavaria Automotive Sensor Systems GmbH):
        Organwechsel mit zeitgleicher Bestellung von Dr. Claudia Sommer als Nachfolgerin
        muss als DOWNGRADED_SUCCESSOR_PRESENT markiert werden.
        """
        successor_b = self.bulletins[3]
        res = evaluate_bulletin_against_signatures(successor_b, self.signatures, self.scope_cfg)

        self.assertTrue(res["has_immediate_successor"])
        self.assertEqual(res["status"], "DOWNGRADED_SUCCESSOR_PRESENT")
        self.assertFalse(res["stage_5_mandate_potential_inferred"])
        self.assertEqual(res["confidence_class"], "C")

    def test_05_negative_industry_hint_flagged(self):
        """
        Prüft Fall 5 (Trattoria & Pizzeria Bella Vista GmbH):
        Gastronomie darf nicht ungeprüft als C-Level Mandat durchgehen.
        Wird als FLAGGED_NEGATIVE_INDUSTRY mit Hinweis markiert.
        """
        gastro_b = self.bulletins[4]
        res = evaluate_bulletin_against_signatures(gastro_b, self.signatures, self.scope_cfg)

        self.assertTrue(res["has_negative_industry_hint"])
        self.assertEqual(res["negative_hint_matched"], "Gastronomie")
        self.assertEqual(res["status"], "FLAGGED_NEGATIVE_INDUSTRY")
        self.assertFalse(res["stage_5_mandate_potential_inferred"])

    def test_06_routine_event_excluded(self):
        """
        Prüft Fall 6 (Schwaben Precision Components GmbH):
        Reine Satzungsänderung ohne Organabgang wird als EXCLUDED_ROUTINE aussortiert.
        """
        routine_b = self.bulletins[5]
        res = evaluate_bulletin_against_signatures(routine_b, self.signatures, self.scope_cfg)

        self.assertFalse(res["stage_3_official_event_verified"])
        self.assertEqual(res["status"], "EXCLUDED_ROUTINE")
        self.assertIsNone(res["stage_4_signature_matched"])

    def test_07_results_file_integrity(self):
        """Prüft, ob regional_scan_results.json existiert und valide Struktur hat."""
        res_file = os.path.join(PROJECT_ROOT, "data", "research", "regional_scan_results.json")
        self.assertTrue(os.path.exists(res_file))
        with open(res_file, 'r', encoding='utf-8') as f:
            data = json.load(f)
        self.assertIn("corridor", data)
        self.assertIn("results", data)
        self.assertIn("summary", data)
        self.assertEqual(len(data["results"]), 6)

if __name__ == "__main__":
    unittest.main()
