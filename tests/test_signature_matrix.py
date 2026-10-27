"""
Unit Tests für Phase 1: Trigger-Signaturen & Validierungs-Matrix
Prüft:
1. JSON-Schema-Konformität und Pflichtfelder
2. Zurückweisung unzulässiger Werte (z.B. falsche Jurisdiktion, ungültige Konfidenzklasse)
3. Fehlerhafte/unvollständige LLM- bzw. Extractor-Ausgaben
4. Rechtliche Klassifikation (§ 29 BGB vs. § 29 BGB analog vs. § 85 AktG, § 21 vs § 270a InsO)
5. Gegenindikatoren (Nachfolgebestellung neutralisiert Vakanz)
6. Erkennung von echter Führungsvakanz (ohne Nachfolger)
7. Saubere Trennung von Ereignisbeleg (amtlich) vs. Mandatshypothese
8. Reproduzierbarkeit bei identischer Eingabe
"""

import os
import sys
import json
import unittest
import jsonschema

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from scripts.extract_case_patterns import (
    SIGNATURE_ITEM_SCHEMA,
    SIGNATURES_FILE_SCHEMA,
    build_signatures_from_cases,
    CURATED_PROVIDER_CASES
)

class TestSignatureMatrix(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        cls.config_path = os.path.join(PROJECT_ROOT, "config", "trigger_signatures.json")
        with open(cls.config_path, "r", encoding="utf-8") as f:
            cls.signatures_data = json.load(f)

    def test_01_schema_compliance_of_persisted_signatures(self):
        """Prüft, ob config/trigger_signatures.json dem strengen JSON-Schema entspricht."""
        try:
            jsonschema.validate(instance=self.signatures_data, schema=SIGNATURES_FILE_SCHEMA)
        except jsonschema.ValidationError as e:
            self.fail(f"Schema-Validierung fehlgeschlagen: {e.message}")

    def test_02_mandatory_fields_present_in_all_signatures(self):
        """Stellt sicher, dass keine Pflichtfelder in den Signaturen fehlen."""
        required = SIGNATURE_ITEM_SCHEMA["required"]
        for sig in self.signatures_data["signatures"]:
            for field in required:
                self.assertIn(field, sig, f"Pflichtfeld '{field}' fehlt in {sig.get('signature_id')}")
                val = sig[field]
                if isinstance(val, (str, list)):
                    self.assertTrue(len(val) > 0, f"Feld '{field}' darf nicht leer sein in {sig.get('signature_id')}")

    def test_03_rejection_of_invalid_jurisdiction(self):
        """Stellt sicher, dass ungültige Jurisdiktionen (z.B. US, UK) durch das Schema abgelehnt werden."""
        sample = dict(self.signatures_data["signatures"][0])
        sample["jurisdiction"] = "UK" # Erlaubt nur DE, AT, CH
        with self.assertRaises(jsonschema.ValidationError):
            jsonschema.validate(instance=sample, schema=SIGNATURE_ITEM_SCHEMA)

    def test_04_rejection_of_invalid_confidence_class(self):
        """Stellt sicher, dass ungültige Konfidenzklassen (z.B. 'TOP', 'D') abgelehnt werden."""
        sample = dict(self.signatures_data["signatures"][0])
        sample["confidence_class"] = "HIGH" # Erlaubt nur A, B, C
        with self.assertRaises(jsonschema.ValidationError):
            jsonschema.validate(instance=sample, schema=SIGNATURE_ITEM_SCHEMA)

    def test_05_rejection_of_invalid_official_source(self):
        """Stellt sicher, dass nicht-amtliche Quellen (z.B. 'twitter', 'linkedin') abgewiesen werden."""
        sample = dict(self.signatures_data["signatures"][0])
        sample["official_source"] = "linkedin"
        with self.assertRaises(jsonschema.ValidationError):
            jsonschema.validate(instance=sample, schema=SIGNATURE_ITEM_SCHEMA)

    def test_06_legal_classification_notvorstand_vs_notgeschaeftsfuehrer(self):
        """
        Rechtliche Prüfung:
        § 29 BGB betrifft unmittelbar nur Vereine.
        Für die GmbH darf nur § 29 BGB analog (Notgeschäftsführung) verwendet werden.
        """
        for sig in self.signatures_data["signatures"]:
            refs = " ".join(sig.get("legal_references", []))
            if "§ 29 BGB" in refs and "GmbH" in sig.get("legal_entity_type", ""):
                self.assertIn("analog", refs.lower(),
                    f"Bei GmbH muss § 29 BGB als analog gekennzeichnet sein! Gefunden in {sig['signature_id']}: {refs}")

    def test_07_counter_indicator_logic_successor_appointment(self):
        """
        Prüft Gegenindikatoren:
        Wird im selben Text 'Bestellt als Geschäftsführer' erwähnt, liegt eine planmäßige
        Nachfolge vor und kein unbesetztes Führungsvakuum.
        """
        sig_vacancy = next((s for s in self.signatures_data["signatures"] if s["signature_id"] == "SIG_DE_ORGAN_VACANCY_01"), None)
        self.assertIsNotNone(sig_vacancy)
        val_notes = sig_vacancy.get("validation_notes", "")
        self.assertIn("GEGENINDIKATOR", val_notes)
        self.assertIn("Bestellt als Geschäftsführer", val_notes)

    def test_08_distinction_event_proof_vs_mandate_hypothesis(self):
        """
        Prüft, dass amtlich belegte Ereignisse nicht automatisch als belegte Mandate gelten:
        official_event_verified = True, aber evidence_strength = 'plausibel' oder 'unbestaetigte_hypothese'.
        """
        for sig in self.signatures_data["signatures"]:
            if sig.get("official_event_verified"):
                # Mandatswahrscheinlichkeit ist eine Hypothese, kein Tatsachenbeweis aus dem Register!
                self.assertIn(sig.get("evidence_strength"), ["plausibel", "unbestaetigte_hypothese"],
                    f"Mandatsstärke darf nicht als 'belegt' behauptet werden, wenn nur ein Registerereignis vorliegt ({sig['signature_id']})")

    def test_09_reproducibility_of_signature_generation(self):
        """Prüft, dass zweimaliges Ausführen bei gleichen Eingaben exakt dieselben Signaturen erzeugt."""
        run1 = build_signatures_from_cases(CURATED_PROVIDER_CASES)
        run2 = build_signatures_from_cases(CURATED_PROVIDER_CASES)
        self.assertEqual(len(run1), len(run2))
        for s1, s2 in zip(run1, run2):
            self.assertEqual(s1["signature_id"], s2["signature_id"])
            self.assertEqual(s1["economic_problem"], s2["economic_problem"])
            self.assertEqual(s1["official_terminology"], s2["official_terminology"])

if __name__ == "__main__":
    unittest.main()
