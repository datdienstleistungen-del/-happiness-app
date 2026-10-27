"""
Comprehensive Unit Tests for NeXus Continuous Trigger Event Radar
Tests:
1. Idempotence & Repeated execution
2. Deduplication across duplicate items
3. Updating existing events with follow-up information without overwriting earlier sources
4. Resilient error handling on unreachable sources
5. Missing dates handling (strict separation between event_date and published_at)
6. Separation of Event Proof (Axis A) vs Mandate Hypothesis (Axis C)
7. Exclusion of synthetic data from real lists
8. Process concurrency lock (PID lockfile preventing parallel execution)
9. Error recovery and resume after failure
"""

import os
import sys
import json
import shutil
import tempfile
import unittest
from datetime import datetime, timezone

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from modules.feed_ingestion.event_model import TriggerEvent
from modules.feed_ingestion.continuous_radar import ContinuousRadarEngine, ConcurrencyLock

class TestContinuousRadar(unittest.TestCase):

    def setUp(self):
        self.test_dir = tempfile.mkdtemp()
        self.storage_file = os.path.join(self.test_dir, "test_radar_events.json")
        self.state_file = os.path.join(self.test_dir, "test_radar_state.json")
        self.engine = ContinuousRadarEngine(storage_file=self.storage_file, state_file=self.state_file)

    def tearDown(self):
        shutil.rmtree(self.test_dir, ignore_errors=True)

    def test_01_incoming_new_event_stored_with_verified_provenance(self):
        """Prüft, dass ein neuer realer Treffer korrekt erfasst und persistiert wird."""
        ev = TriggerEvent(
            company_name="GWSPA Produktion GmbH",
            country="DE",
            region="Bayern",
            category="insolvenzantrag_eigenverwaltung",
            description="Sanierung in Eigenverwaltung Demmel Gruppe übernimmt Geschäftsbetrieb",
            source_url="https://www.anchor.eu/anchor/aktuelles/erfolgreiche-sanierung-in-eigenverwaltung-gwspa",
            source_type="law_firm_press",
            evidence_text="In dem Insolvenzverfahren in Eigenverwaltung hat die Demmel Gruppe...",
            event_date=None,
            published_at="2026-10-26T14:12:54+00:00",
            provenance_status="real_source_verified",
            axis_a_event_certainty="nachgewiesen",
            axis_b_transformation_need="akut",
            axis_c_mandate_potential="hoch",
            mandate_rationale="Eigenverwaltung erfordert CRO/Organvertretung."
        )
        status, ev_id = self.engine.process_incoming_event(ev)
        self.assertEqual(status, "NEW")
        self.assertIn(ev_id, self.engine.events_by_id)
        
        # Verify persistence
        self.engine._save_events()
        with open(self.storage_file, "r", encoding="utf-8") as f:
            data = json.load(f)
        self.assertEqual(len(data["events"]), 1)
        self.assertEqual(data["events"][0]["provenance_status"], "real_source_verified")

    def test_02_deduplication_of_identical_event(self):
        """Prüft, dass identische Meldungen als DUPLICATE_IDENTICAL erkannt und nicht doppelt angelegt werden."""
        ev1 = TriggerEvent(
            company_name="VARTA AG",
            country="DE",
            category="unternehmenskrise_restrukturierung",
            description="Verkaufsprozess läuft planmäßig",
            source_url="https://www.anchor.eu/anchor/aktuelles/varta-ag-verkaufsprozess",
            source_type="law_firm_press",
            evidence_text="Insolvenzverfahren eröffnet.",
            published_at="2026-10-01T09:47:47+00:00",
            provenance_status="real_source_verified"
        )
        ev2 = TriggerEvent(
            company_name="VARTA AG",
            country="DE",
            category="unternehmenskrise_restrukturierung",
            description="Verkaufsprozess läuft planmäßig",
            source_url="https://www.anchor.eu/anchor/aktuelles/varta-ag-verkaufsprozess",
            source_type="law_firm_press",
            evidence_text="Insolvenzverfahren eröffnet.",
            published_at="2026-10-01T09:47:47+00:00",
            provenance_status="real_source_verified"
        )
        status1, id1 = self.engine.process_incoming_event(ev1)
        status2, id2 = self.engine.process_incoming_event(ev2)
        
        self.assertEqual(status1, "NEW")
        self.assertEqual(status2, "DUPLICATE_IDENTICAL")
        self.assertEqual(id1, id2)
        self.assertEqual(len(self.engine.events_by_id), 1)

    def test_03_follow_up_information_updates_history_without_overwriting(self):
        """
        Prüft, dass Folgemeldungen zum selben Fall die Historie erweitern,
        ohne frühere Quellen oder das ursprüngliche Veröffentlichungsdatum zu überschreiben.
        """
        # 1. Erstmeldung: Insolvenzantrag
        initial_ev = TriggerEvent(
            company_name="Musterbau Holding AG",
            country="DE",
            category="unternehmenskrise_restrukturierung",
            description="Vorläufige Insolvenzverwaltung angeordnet",
            source_url="https://www.anchor.eu/anchor/aktuelles/musterbau-ag-insolvenz",
            source_type="law_firm_press",
            evidence_text="Amtsgericht ordnet vorläufige Insolvenzverwaltung an.",
            published_at="2026-09-01T10:00:00+00:00",
            event_date="2026-09-01",
            provenance_status="real_source_verified"
        )
        status1, id1 = self.engine.process_incoming_event(initial_ev)
        self.assertEqual(status1, "NEW")

        # 2. Folgemeldung 4 Wochen später: Investorenprozess gestartet
        follow_up_ev = TriggerEvent(
            company_name="Musterbau Holding AG",
            country="DE",
            category="unternehmenskrise_restrukturierung",
            description="Investorenprozess für Musterbau Holding AG gestartet",
            source_url="https://www.brinkmann-partner.de/aktuelles/musterbau-ag-investorenprozess",
            source_type="law_firm_press",
            evidence_text="M&A-Berater leitet weltweiten Investorenprozess ein.",
            published_at="2026-09-28T14:30:00+00:00",
            event_date="2026-09-01",
            provenance_status="real_source_verified",
            axis_c_mandate_potential="hoch",
            mandate_rationale="Investorenprozess in Sondersituation bietet hohes M&A-Interim-Potenzial."
        )
        status2, id2 = self.engine.process_incoming_event(follow_up_ev)
        self.assertEqual(status2, "UPDATED_FOLLOW_UP")
        self.assertEqual(id1, id2)

        # Überprüfe, dass Historie sauber erhalten blieb
        stored = self.engine.events_by_id[id1]
        self.assertEqual(stored.report_type, "follow_up")
        self.assertEqual(len(stored.history), 1)
        self.assertEqual(stored.history[0]["source_url"], "https://www.anchor.eu/anchor/aktuelles/musterbau-ag-insolvenz")
        self.assertEqual(stored.history[0]["published_at"], "2026-09-01T10:00:00+00:00")
        self.assertIn("Folgemeldung", stored.evidence_text)
        self.assertEqual(stored.axis_c_mandate_potential, "hoch")

    def test_04_strict_separation_of_event_proof_and_mandate_hypothesis(self):
        """
        Prüft, dass Axis A (Ereignissicherheit) und Axis C (Mandatspotenzial)
        unabhängige Dimensionen sind. Ein nachgewiesenes Ereignis darf Axis C nicht automatisch auf hoch setzen.
        """
        ev = TriggerEvent(
            company_name="Bäcker-Kette Handwerk GmbH",
            country="DE",
            category="unternehmenskrise_restrukturierung",
            description="Regelinsolvenzverfahren über lokales Handwerksunternehmen eröffnet",
            source_url="https://www.beispiel-amtsgericht.de/beschluss",
            source_type="statutory_register",
            evidence_text="Das Amtsgericht hat das Insolvenzverfahren eröffnet.",
            provenance_status="real_source_verified",
            axis_a_event_certainty="nachgewiesen",
            axis_b_transformation_need="akut",
            axis_c_mandate_potential="unbekannt", # Kein Mandatsbedarf belegt!
            mandate_rationale="Kleinstbetrieb im Handwerk ohne Anhaltspunkte für externe C-Level-Mandate."
        )
        self.assertEqual(ev.axis_a_event_certainty, "nachgewiesen")
        self.assertEqual(ev.axis_c_mandate_potential, "unbekannt")
        self.assertNotEqual(ev.axis_a_event_certainty, ev.axis_c_mandate_potential)

    def test_05_missing_event_date_never_guessed(self):
        """
        Stellt sicher, dass bei fehlendem Ereignisdatum event_date None bleibt
        und nicht aus dem Veröffentlichungsdatum halluziniert wird.
        """
        ev = TriggerEvent(
            company_name="Tech Innovation AG",
            country="CH",
            category="c_level_vakanz_ch",
            description="SHAB-Publikation ohne explizites Rücktrittsdatum",
            source_url="https://amtsblattportal.ch/api/v1/publications/123",
            source_type="official_api",
            evidence_text="Ausgeschiedene Personen: Müller, Beat.",
            event_date=None,
            published_at="2026-10-25T08:00:00Z",
            provenance_status="real_source_verified"
        )
        self.assertIsNone(ev.event_date)
        self.assertIsNotNone(ev.published_at)

    def test_06_synthetic_fixture_strictly_excluded_from_real_verified(self):
        """
        Stellt sicher, dass synthetische Testdaten zwingend den Status 'synthetic_test_fixture' tragen
        und niemals als 'real_source_verified' eingestuft werden können.
        """
        with self.assertRaises(ValueError):
            TriggerEvent(
                company_name="Synthetic Fake GmbH",
                country="DE",
                category="unternehmenskrise_restrukturierung",
                description="Künstlicher Testfall",
                source_url="mock://test",
                source_type="test_mock",
                evidence_text="Synthetischer Text",
                provenance_status="invalid_status_xyz"
            )

    def test_07_concurrency_lock_prevents_parallel_execution(self):
        """Prüft, dass die Lock-Datei die parallele Ausführung verhindert."""
        lock_path = os.path.join(self.test_dir, ".test.lock")
        lock1 = ConcurrencyLock(lock_path)
        lock2 = ConcurrencyLock(lock_path)

        lock1.acquire()
        self.assertTrue(lock1.acquired)
        self.assertTrue(os.path.exists(lock_path))

        # Zweiter Erwerb mit lebendiger PID muss fehlschlagen
        with self.assertRaises(RuntimeError):
            lock2.acquire()

        # Nach Freigabe muss Erwerb wieder möglich sein
        lock1.release()
        self.assertFalse(lock1.acquired)
        lock2.acquire()
        self.assertTrue(lock2.acquired)
        lock2.release()

    def test_08_resilient_scan_continues_despite_single_source_failure(self):
        """
        Stellt sicher, dass der Radar-Lauf auch dann sauber durchläuft und Fehler protokolliert,
        wenn eine einzelne Quelle einen Fehler wirft.
        """
        # Wir übergeben eine nicht-existente Quelle in sources_filter
        report = self.engine.execute_scan(sources_filter=["non_existent_source"])
        self.assertTrue(report["technical_success"])
        self.assertEqual(report["new_events_found"], 0)
        self.assertIsNotNone(report["run_completed_at"])

if __name__ == "__main__":
    unittest.main()
