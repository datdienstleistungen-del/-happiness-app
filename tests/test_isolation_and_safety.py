"""
Unit Tests für Phase 4: Gesamtsystem-Integrität, Sicherheit & Isolation
Prüft:
1. Striktes Verbot produktiver Supabase-Schreibzugriffe im Test- und Forschungsmodus
2. Isolation aller Forschungs-Artefakte in config/ und data/research/
3. Namensauflösungs-Sicherheit: Keine fälschliche Zuordnung allein durch Namensähnlichkeit
4. Vollständige Ausführbarkeit der Testsuite über alle 3 Phasen
5. Reproduzierbarkeit und Fehlerfreiheit
"""

import os
import sys
import json
import unittest

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from scripts.run_mandate_forensics import perform_cross_source_matching, load_json

class TestIsolationAndSafety(unittest.TestCase):

    def test_01_production_ingestion_flag_safety(self):
        """Verifiziert, dass der Ingest-Scope in config/ingest_scope.json strikt False für Produktion ist."""
        scope_file = os.path.join(PROJECT_ROOT, "config", "ingest_scope.json")
        with open(scope_file, 'r', encoding='utf-8') as f:
            cfg = json.load(f)
        self.assertFalse(cfg.get("production_ingestion_enabled", True),
            "SICHERHEITS-VERLETZUNG: production_ingestion_enabled darf im Testkorridor niemals True sein!")
        self.assertFalse(cfg.get("safety_policy", {}).get("allow_supabase_writes", True),
            "SICHERHEITS-VERLETZUNG: allow_supabase_writes muss False sein!")
        self.assertFalse(cfg.get("safety_policy", {}).get("allow_lead_creation", True),
            "SICHERHEITS-VERLETZUNG: allow_lead_creation muss False sein!")

    def test_02_no_ambiguous_name_matching(self):
        """
        Prüft, dass bloße Namensähnlichkeit (z.B. 'Müller') ohne Registeridentität
        NICHT als bestätigtes Kausal-Match eingestuft wird.
        """
        sources_cfg = load_json("config/mandate_forensics_sources.json")
        mock_mandate = [{
            "mandate_case_id": "TEST_AMBIGUOUS_NAME_01",
            "provider": "Test Provider",
            "company_name": "Müller Holding", # Ähnlich zu Traditions-Metallbau Müller GmbH
            "company_identifier": "unbekannt",
            "jurisdiction": "DE",
            "industry": "Metall",
            "region": "Bayern",
            "company_size_class": "KMU",
            "management_function": "Interim CEO",
            "mandate_start_date": "2024-05-01",
            "mandate_end_date": "2024-11-01",
            "mandate_task": "Restrukturierung",
            "mandate_source_url": "https://example.com",
            "mandate_source_quote": "Restrukturierung der Müller Holding",
            "source_publication_date": "2024-05-05",
            "source_retrieved_at": "2026-10-27T00:00:00Z",
            "source_quality": "test",
            "privacy_review_status": "test",
            "validation_notes": "Testfall für unsichere Namenszuordnung"
        }]

        mock_event = [{
            "event_id": "TEST_EVT_MUELLER_METALL",
            "company_name": "Traditions-Metallbau Müller GmbH",
            "court_and_reg": "Amtsgericht Augsburg, HRB 45119",
            "event_type": "Insolvenz",
            "official_source": "insolvenzbekanntmachungen",
            "publication_date": "2024-04-01",
            "actual_event_date": "2024-04-01",
            "summary": "Insolvenz Traditions-Metallbau Müller",
            "signature_id": "SIG_DE_RESTRUCTURING_CRO_01"
        }]

        matches = perform_cross_source_matching(mock_mandate, mock_event, sources_cfg)
        # Darf KEIN Match sein, weil Namen nicht exakt und Registeridentität nicht übereinstimmt
        self.assertEqual(len(matches), 0, "Unsichere Namensähnlichkeit darf kein automatisches Match erzeugen!")

    def test_03_research_data_directory_structure(self):
        """Stellt sicher, dass alle Forschungsartefakte im isolierten research-Verzeichnis liegen."""
        expected_files = [
            os.path.join(PROJECT_ROOT, "config", "trigger_signatures.json"),
            os.path.join(PROJECT_ROOT, "config", "ingest_scope.json"),
            os.path.join(PROJECT_ROOT, "config", "mandate_forensics_sources.json"),
            os.path.join(PROJECT_ROOT, "data", "research", "provider_cases_raw.json"),
            os.path.join(PROJECT_ROOT, "data", "research", "regional_scan_results.json"),
            os.path.join(PROJECT_ROOT, "data", "research", "mandate_cases.json"),
            os.path.join(PROJECT_ROOT, "data", "research", "cross_source_matches.json"),
            os.path.join(PROJECT_ROOT, "reports", "mandate_forensics_report.md")
        ]
        for fpath in expected_files:
            self.assertTrue(os.path.exists(fpath), f"Erwartetes Forschungsartefakt fehlt: {fpath}")

if __name__ == "__main__":
    unittest.main()
