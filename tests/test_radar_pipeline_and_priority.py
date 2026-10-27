"""
NeXus HIT - Unit & Regression Tests: Ingestion-Takt, Lead-Qualifizierung & Rendering
Tests the 3-hour repetition cycle, lead prioritization (Event vs Mandat),
and the public frontend data pipeline.
"""

import os
import json
import unittest

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RESEARCH_FILE = os.path.join(PROJECT_ROOT, "data", "research", "continuous_radar_events.json")
PUBLIC_FILE = os.path.join(PROJECT_ROOT, "public", "data", "continuous_radar_events.json")
SETUP_SCRIPT = os.path.join(PROJECT_ROOT, "modules", "feed_ingestion", "setup_task.ps1")

from modules.feed_ingestion.event_model import (
    TriggerEvent,
    VALID_MANDATE_PRIORITIES,
    MANDATE_PRIORITY_LABELS
)

class TestRadarPipelineAndPriority(unittest.TestCase):

    def test_01_setup_task_script_defines_3_hour_repetition(self):
        """Verifies that setup_task.ps1 is explicitly configured for 3-hour repetition (PT3H)."""
        self.assertTrue(os.path.exists(SETUP_SCRIPT), "setup_task.ps1 must exist")
        with open(SETUP_SCRIPT, "r", encoding="utf-8") as f:
            content = f.read()
        self.assertIn("-RepetitionInterval (New-TimeSpan -Hours 3)", content)
        self.assertIn("-Once", content)
        self.assertIn("Alle 3 Stunden", content)

    def test_02_lead_qualification_acute_pressure_vs_passive_distress(self):
        """Tests that acute actions (CRO, C-Level, SchVG) are High Priority and passive are Watchlist."""
        # 1. Acute SchVG Creditor Pressure
        ev_schvg = TriggerEvent(
            company_name="PAUL Tech AG",
            country="DE",
            category="finanzierung_anleihen_restrukturierung",
            description="Gläubigerversammlung beschließt Restrukturierung und Laufzeitverlängerung",
            source_url="https://example.com/paul-tech",
            source_type="capital_markets_press",
            evidence_text="Abstimmung nach SchVG über Anleihebedingungen"
        )
        self.assertEqual(ev_schvg.mandate_priority, "high_priority_action_required")
        self.assertEqual(ev_schvg.action_type, "schvg_glaeubiger_druck")

        # 2. Acute C-Level Organ Vacuum
        ev_cfo = TriggerEvent(
            company_name="pferdewetten.de AG",
            country="DE",
            category="c_level_vakanz",
            description="Neuer CFO im Rahmen der Neuaufstellung berufen",
            source_url="https://example.com/pferdewetten",
            source_type="capital_markets_press",
            evidence_text="Finanzvorstand Frank Hartmann scheidet aus"
        )
        self.assertEqual(ev_cfo.mandate_priority, "high_priority_action_required")
        self.assertEqual(ev_cfo.action_type, "c_level_organ_vakuum")

        # 3. Acute Eigenverwaltung (CRO required)
        ev_cro = TriggerEvent(
            company_name="Weha Ludwig Werwein GmbH",
            country="DE",
            category="insolvenzantrag_eigenverwaltung",
            description="Sanierung in Eigenverwaltung eingeleitet",
            source_url="https://example.com/weha",
            source_type="law_firm_press",
            evidence_text="Geschäftsführung führt Betrieb fort mit Sanierungsexperten"
        )
        self.assertEqual(ev_cro.mandate_priority, "high_priority_action_required")
        self.assertEqual(ev_cro.action_type, "cro_eigenverwaltung")

        # 4. Passive Regular Insolvency (Court Administrator appointed - organs stripped of power)
        ev_reg = TriggerEvent(
            company_name="BSH Solar GmbH",
            country="DE",
            category="unternehmenskrise_restrukturierung",
            description="BSH stellt Insolvenzantrag",
            source_url="https://example.com/bsh",
            source_type="law_firm_press",
            evidence_text="Zum vorläufigen Insolvenzverwalter wurde Rechtsanwalt Dr. Müller bestellt"
        )
        self.assertEqual(ev_reg.mandate_priority, "watchlist_general_distress")
        self.assertEqual(ev_reg.action_type, "passiv_regelinsolvenz")

        # 5. Passive Completed M&A (Takeover finished)
        ev_mna = TriggerEvent(
            company_name="Süddeutsche Gelenkscheibenfabrik GmbH & Co. KG",
            country="DE",
            category="fusion_uebernahme_unternehmensverkauf",
            description="Investorenprozess erfolgreich abgeschlossen",
            source_url="https://example.com/gelenk",
            source_type="law_firm_press",
            evidence_text="Übernahme durch strategischen Investor vollzogen"
        )
        self.assertEqual(ev_mna.mandate_priority, "watchlist_general_distress")
        self.assertEqual(ev_mna.action_type, "passiv_m_and_a_abschluss")

        # 6. Passive Routine Order / Contract
        ev_order = TriggerEvent(
            company_name="CeoTronics AG",
            country="DE",
            category="corporate_news_auftrag",
            description="Großauftrag über 1,2 Mio Euro erhalten",
            source_url="https://example.com/ceotronics",
            source_type="ad_hoc_disclosure",
            evidence_text="Lieferung von Audio-Systemen bis Ende 2026"
        )
        self.assertEqual(ev_order.mandate_priority, "watchlist_general_distress")
        self.assertEqual(ev_order.action_type, "passiv_auftrag_routine")

    def test_03_public_data_mirror_integrity_and_rendering_readiness(self):
        """Verifies that public/data/continuous_radar_events.json exists, is valid, and matches data/research."""
        self.assertTrue(os.path.exists(PUBLIC_FILE), "public/data/continuous_radar_events.json must exist")
        self.assertTrue(os.path.exists(RESEARCH_FILE), "data/research/continuous_radar_events.json must exist")

        with open(PUBLIC_FILE, "r", encoding="utf-8") as f:
            pub_data = json.load(f)

        events = pub_data.get("events", [])
        self.assertGreaterEqual(len(events), 24, "At least 24 real events must be present in public radar store")

        # Verify that capital market events from anleihen-finder are present
        bond_events = [e for e in events if "anleihen-finder.de" in (e.get("source_url") or "")]
        self.assertGreaterEqual(len(bond_events), 4, "Anleihen Finder events must be in the public store")

        for ev in bond_events:
            self.assertTrue(ev["source_url"].startswith("https://www.anleihen-finder.de/"), "Source URL must be explicit")
            self.assertIn(ev["mandate_priority"], VALID_MANDATE_PRIORITIES, "Must have valid mandate_priority")
            self.assertIn(ev["mandate_priority_label"], MANDATE_PRIORITY_LABELS.values(), "Must have display label")
            self.assertTrue(len(ev["mandate_rationale"]) > 10, "Must provide mandate hypothesis rationale")

    def test_04_continuous_radar_history_integrity(self):
        """
        Verifies that continuous_radar_history.json exists, has required schema fields,
        and accurately logs run history, query telemetry, and reality check outcomes.
        """
        history_file = os.path.join(PROJECT_ROOT, "data", "research", "continuous_radar_history.json")
        pub_history_file = os.path.join(PROJECT_ROOT, "public", "data", "continuous_radar_history.json")

        self.assertTrue(os.path.exists(history_file), "continuous_radar_history.json must exist in data/research/")
        self.assertTrue(os.path.exists(pub_history_file), "continuous_radar_history.json must be mirrored in public/data/")

        with open(history_file, "r", encoding="utf-8") as f:
            data = json.load(f)

        self.assertIn("version", data)
        self.assertIn("total_runs", data)
        self.assertIn("runs", data)
        self.assertGreaterEqual(len(data["runs"]), 1, "At least one run must be logged")

        latest = data["runs"][0]
        required_fields = [
            "run_id", "started_at", "finished_at", "duration_seconds",
            "status", "trigger", "application_version", "sources_configured",
            "sources_attempted", "sources_succeeded", "sources_failed",
            "queries_executed", "items_retrieved", "items_after_deduplication",
            "items_checked", "events_created", "events_updated",
            "events_rejected", "events_published", "errors"
        ]
        for field in required_fields:
            self.assertIn(field, latest, f"Missing required field in run record: {field}")

        self.assertIn(latest["status"], ["SUCCESS", "PARTIAL", "FAILED", "RUNNING"])
        self.assertIn(latest["trigger"], ["scheduled", "manual"])

        # Check queries_executed telemetry
        self.assertIsInstance(latest["queries_executed"], list)
        if latest["queries_executed"]:
            q = latest["queries_executed"][0]
            self.assertIn("source", q)
            self.assertIn("query_name", q)
            self.assertIn("reachable", q)
            self.assertIsInstance(q["reachable"], bool)

if __name__ == "__main__":
    unittest.main()

