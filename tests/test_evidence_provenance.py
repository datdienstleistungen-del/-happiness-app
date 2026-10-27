"""
Unit Tests für Evidenz-Audit, Datenprovenienz & Rechtliche Präzision
Prüft:
1. Durchgängige Präsenz des Feldes 'data_provenance' über alle Forschungsdatensätze
   (mandate_cases.json, regional_scan_results.json, trigger_signatures.json)
2. Erlaubte Werte für data_provenance:
   - 'real_source_verified'
   - 'real_source_unverified'
   - 'synthetic_test_fixture'
3. Strikte Zurückweisung von Fehleinstufungen:
   - Synthetische Testfälle (bayerische Test-Bulletins, Müller GmbH) dürfen NIEMALS als 'real_source_verified' markiert sein.
   - Unbestätigte Mandate (Meissner AG, Schlote Holding, Atreus, F&P) dürfen NIEMALS als 'real_source_verified' markiert sein.
4. Rechtliche Normenkontrolle:
   - GmbH: Keine direkte Anwendung von § 29 BGB, sondern strikt '§ 29 BGB analog (Notgeschäftsführung)'.
   - GmbH: Passive Vertretung durch Gesellschafter gem. § 35 Abs. 1 Satz 2 GmbHG.
   - AG: Gerichtliche Notbestellung gem. § 85 AktG.
   - Insolvenz: Vorläufige Eigenverwaltung gem. § 270b InsO n.F. (SanInsFoG).
5. Fail-Closed Verifikationsprüfung:
   - Ein Mandat gilt nur dann als verifiziert, wenn ein belegter Mandatsvertrag / Provider-Nachweis vorliegt.
"""

import os
import sys
import json
import unittest

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

VALID_PROVENANCE_VALUES = {
    "real_source_verified",
    "real_source_unverified",
    "synthetic_test_fixture"
}

def load_json_file(rel_path):
    p = os.path.join(PROJECT_ROOT, rel_path)
    if not os.path.exists(p):
        raise FileNotFoundError(f"Datei nicht gefunden: {p}")
    with open(p, "r", encoding="utf-8") as f:
        return json.load(f)

class TestEvidenceProvenance(unittest.TestCase):

    def test_01_all_trigger_signatures_have_valid_provenance(self):
        """Prüft, dass alle Trigger-Signaturen in config/trigger_signatures.json 'data_provenance' besitzen."""
        data = load_json_file("config/trigger_signatures.json")
        signatures = data.get("signatures", [])
        self.assertGreater(len(signatures), 0)
        for sig in signatures:
            self.assertIn("data_provenance", sig, f"data_provenance fehlt in Signatur {sig.get('signature_id')}")
            self.assertIn(sig["data_provenance"], VALID_PROVENANCE_VALUES,
                f"Ungültige data_provenance in Signatur {sig.get('signature_id')}: {sig['data_provenance']}")

    def test_02_all_regional_scan_results_have_valid_provenance(self):
        """Prüft, dass alle Ergebnisse des regionalen Testlaufs 'data_provenance' besitzen."""
        data = load_json_file("data/research/regional_scan_results.json")
        results = data.get("results", [])
        self.assertEqual(len(results), 6)
        for r in results:
            self.assertIn("data_provenance", r, f"data_provenance fehlt in regionalem Ergebnis {r.get('bulletin_id')}")
            self.assertIn(r["data_provenance"], VALID_PROVENANCE_VALUES)
            # Da es sich um Testfixtures handelt, MÜSSEN sie als synthetic_test_fixture markiert sein:
            self.assertEqual(r["data_provenance"], "synthetic_test_fixture",
                f"Bayerische Test-Meldung {r.get('bulletin_id')} darf nicht als real deklariert sein!")

    def test_03_all_mandate_cases_have_valid_provenance(self):
        """Prüft, dass alle Mandatsfälle in data/research/mandate_cases.json 'data_provenance' besitzen."""
        data = load_json_file("data/research/mandate_cases.json")
        mandates = data.get("mandates", [])
        self.assertEqual(len(mandates), 5)
        for m in mandates:
            self.assertIn("data_provenance", m, f"data_provenance fehlt in Mandatsfall {m.get('mandate_case_id')}")
            self.assertIn(m["data_provenance"], VALID_PROVENANCE_VALUES)

    def test_04_unverified_mandates_strictly_not_marked_as_verified(self):
        """
        Sicherheitsprüfung gegen Halluzination:
        Weder Meissner AG, noch Schlote Gruppe, noch anonymisierte Fälle (Atreus, F&P)
        dürfen als 'real_source_verified' deklariert sein.
        """
        data = load_json_file("data/research/mandate_cases.json")
        for m in data.get("mandates", []):
            cid = m.get("mandate_case_id")
            prov = m.get("data_provenance")
            ver = m.get("verification_status")

            if cid in ["MANDATE_MEISSNER_AG", "MANDATE_SCHLOTE_HOLDING", "MANDATE_ATREUS_COO_ENERGY", "MANDATE_FUP_CFO_LIQUIDITY"]:
                self.assertNotEqual(prov, "real_source_verified",
                    f"FEHLER: Fall {cid} wurde fälschlich als 'real_source_verified' deklariert!")
                self.assertEqual(prov, "real_source_unverified",
                    f"Fall {cid} muss als 'real_source_unverified' eingestuft sein!")
                self.assertEqual(ver, "nicht_verifiziert",
                    f"Fall {cid} muss verification_status='nicht_verifiziert' haben!")

            if cid == "CONTROL_CASE_NO_INTERIM_01":
                self.assertEqual(prov, "synthetic_test_fixture",
                    "Kontrollfall Müller GmbH muss als 'synthetic_test_fixture' markiert sein!")

    def test_05_legal_references_strictness_and_precision(self):
        """
        Prüft juristische Präzision in den Trigger-Signaturen:
        - GmbH: § 29 BGB analog (Notgeschäftsführung) und § 35 Abs. 1 Satz 2 GmbHG.
        - AG: § 85 AktG (Notvorstand).
        - InsO: § 270b InsO n.F. (vorläufige Eigenverwaltung).
        """
        data = load_json_file("config/trigger_signatures.json")
        signatures = data.get("signatures", [])

        # 1. Signatur Führungsvakanz
        sig_vacancy = next((s for s in signatures if s["signature_id"] == "SIG_DE_ORGAN_VACANCY_01"), None)
        self.assertIsNotNone(sig_vacancy)
        all_refs = " ".join(sig_vacancy.get("legal_references", []))
        self.assertIn("§ 29 BGB analog", all_refs,
            "GmbH darf § 29 BGB nur mit dem Zusatz 'analog' referenzieren!")
        self.assertIn("§ 35", all_refs,
            "Bei Führungsvakanz der GmbH muss § 35 GmbHG (passive Vertretung durch Gesellschafter) genannt sein!")
        self.assertIn("§ 85 AktG", all_refs,
            "Für AG-Notvorstand muss § 85 AktG genannt sein!")

        # 2. Signatur Sanierung / Eigenverwaltung
        sig_restruct = next((s for s in signatures if s["signature_id"] == "SIG_DE_RESTRUCTURING_CRO_01"), None)
        self.assertIsNotNone(sig_restruct)
        restruct_refs = " ".join(sig_restruct.get("legal_references", []))
        self.assertIn("§ 270b InsO", restruct_refs,
            "Vorläufige Eigenverwaltung muss gem. SanInsFoG 2021 als § 270b InsO n.F. zitiert werden!")

    def test_06_fail_closed_validation_mock_gate(self):
        """
        Stellt sicher, dass eine Validierungsfunktion fehlschlägt,
        wenn unbestätigte Annahmen als verifizierte Tatsachen deklariert werden.
        """
        def validate_evidence_record(record):
            """Fail-closed Validator für Forschungs- und Mandatsdatensätze."""
            prov = record.get("data_provenance")
            if prov not in VALID_PROVENANCE_VALUES:
                raise ValueError(f"Unbekannte Datenprovenienz: {prov}")

            # Wenn 'real_source_verified' behauptet wird:
            if prov == "real_source_verified":
                if not record.get("mandate_source_url") or not record.get("mandate_source_url").startswith("http"):
                    raise AssertionError("Verifizierter Datensatz erfordert eine valide Primärquellen-URL!")
                if record.get("verification_status") != "verifiziert":
                    raise AssertionError("Ein Datensatz mit real_source_verified muss verification_status='verifiziert' haben!")
                if not record.get("mandate_contract_evidence"):
                    raise AssertionError("Ein verifiziertes Mandat erfordert einen belegten Mandatsvertrag / Provider-Nachweis!")
            return True

        # Valider synthetischer Datensatz
        valid_synthetic = {
            "mandate_case_id": "SYN_01",
            "data_provenance": "synthetic_test_fixture",
            "verification_status": "synthetische_kontrolle"
        }
        self.assertTrue(validate_evidence_record(valid_synthetic))

        # Fehlerhafter Datensatz: Behauptet 'real_source_verified' ohne Nachweis -> MUSS FEHLSCHLAGEN
        invalid_verified_claim = {
            "mandate_case_id": "FAKE_VERIFIED_01",
            "data_provenance": "real_source_verified",
            "verification_status": "nicht_verifiziert",
            "mandate_source_url": "https://example.com"
        }
        with self.assertRaises(AssertionError):
            validate_evidence_record(invalid_verified_claim)

if __name__ == "__main__":
    unittest.main()
