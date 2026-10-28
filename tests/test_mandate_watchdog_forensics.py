"""
Unit Tests für Mandats-Watchdog & Audit-Pipeline Forensik
Führt die 10 Kernprüfungen aus:
1. Statischer Text enthält „Vorstand“ -> SEARCH_HIT, changeDetected: false
2. Unveränderter Inhalt nach Quittierung -> kein Re-Alert, VERIFIED_STABLE
3. Sachlich relevante Textänderung -> CHANGE_HINT, Alert ausgelöst
4. Menschliche Bestätigung -> VERIFIED_CHANGE, changeDetected: true
5. Irrelevante Layout-/Copyright-Änderung -> kein Alert
6. Fehlendes transmittedAt -> INCOMPLETE_RECORD, kein stiller Fristneustart
7. Kalenderfristen 12M / 18M mit BGB-Ultimo-Regel
8. Ungültige Register-ID -> REGISTER_ID_UNVERIFIED, Registeränderung unterdrückt
9. Wiederholter Watchdog-Lauf erzeugt keine doppelten Alerts (Idempotenz)
10. Erneuter Aufruf nach Quittierung bleibt stabil
"""

import os
import sys
import subprocess
import json
import unittest

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

class TestMandateWatchdogForensics(unittest.TestCase):

    def test_01_run_node_forensic_suite(self):
        """Führt scripts/test_watchdog_forensics.mjs aus und verifiziert den Exit Code 0."""
        script_path = os.path.join(PROJECT_ROOT, "scripts", "test_watchdog_forensics.mjs")
        result = subprocess.run(
            ["node", script_path],
            cwd=PROJECT_ROOT,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace"
        )
        self.assertEqual(
            result.returncode, 0,
            f"Forensische Node.js Testsuite fehlgeschlagen:\nSTDOUT:\n{result.stdout}\nSTDERR:\n{result.stderr}"
        )
        self.assertIn("11 von 11 Testfällen erfolgreich bestanden", result.stdout)

    def test_02_register_state_integrity(self):
        """Prüft, ob mandate_register_state.json die amtlichen Kennungen HRB 743304 und CHE-457.384.964 führt."""
        state_file = os.path.join(PROJECT_ROOT, "data", "research", "mandate_register_state.json")
        self.assertTrue(os.path.exists(state_file), "mandate_register_state.json muss existieren")
        with open(state_file, "r", encoding="utf-8") as f:
            data = json.load(f)

        paul_entry = next((m for m in data if "paul tech" in m.get("company", "").lower()), None)
        self.assertIsNotNone(paul_entry, "PAUL Tech AG Datensatz muss vorhanden sein")
        self.assertEqual(paul_entry.get("register_id"), "AG Mannheim HRB 743304")
        self.assertNotEqual(paul_entry.get("register_id"), "AG Mannheim HRB 741634", "Alte fremde HRB 741634 darf nicht vorkommen")
        self.assertEqual(paul_entry.get("match_level"), "VERIFIED_STABLE")
        self.assertFalse(paul_entry.get("has_change_alert"))
        self.assertFalse(paul_entry.get("changeDetected"))

        cosquare_entry = next((m for m in data if "cosquare" in m.get("company", "").lower()), None)
        self.assertIsNotNone(cosquare_entry, "cosquare AG Datensatz muss vorhanden sein")
        self.assertIn("457.384.964", cosquare_entry.get("register_id", ""))
        self.assertNotIn("291.802.774", cosquare_entry.get("register_id", ""), "Alte unbestätigte UID darf nicht vorkommen")

    def test_03_watchdog_cron_execution_idempotency(self):
        """Führt cron/mandate_watchdog.js aus und prüft, dass keine neuen Alerts erzeugt werden."""
        cron_script = os.path.join(PROJECT_ROOT, "cron", "mandate_watchdog.js")
        result = subprocess.run(
            ["node", cron_script],
            cwd=PROJECT_ROOT,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace"
        )
        self.assertEqual(result.returncode, 0, f"Cronjob Ausführung fehlgeschlagen:\n{result.stderr}")
        self.assertIn("Offene Alarme (Prüfhinweise Stufe 2): 0", result.stdout)
        self.assertIn("Alle quittierten Mandate sind stabil", result.stdout)

if __name__ == "__main__":
    unittest.main()
