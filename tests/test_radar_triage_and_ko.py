"""
Unit Tests zur Absicherung der K.O.-Filter und Triage-Logik im Primär-Radar:
1. Reines Korrektur-/Berichtigungsverfahren (z.B. CATNOIR) wird verworfen (TIER_3 / discarded).
2. Deutsche Primär-Quellen erzeugen ohne explizites Testflag KEINE synthetischen Mock-Fixtures.
3. SHAB-Crawler filtert administrative Berichtigungen ohne Insolvenztatbestand aus.
4. Echte Organvakanz mit verifiziertem Austritt (z.B. cosquare AG) wird positiv erkannt.
"""

import unittest
from modules.feed_ingestion.deal_coach import audit_mandate_lead
from modules.feed_ingestion.sources.de_announcements import get_verified_statutory_bulletins, fetch_de_announcements
from modules.feed_ingestion.sources.swiss_shab import check_shab_mutation_relevance

class TestRadarTriageAndKO(unittest.TestCase):

    def test_ko_rule_drops_pure_register_corrections(self):
        """CATNOIR-Szenario: Eine bloße Berichtigung von Registern oder Übersetzungen darf keinen Mandatsdruck erzeugen."""
        item = {
            "title": "Tagesregister-Nr. 20401 vom 19.10.2026 / Berichtigung",
            "company": "CATNOIR Schweiz AG",
            "snippet": "Uebersetzungen der Firma neu: CATNOIR Suisse SA / CATNOIR Switzerland Ltd. Berichtigung des im Tagesregister...",
            "source_url": "https://shab.ch/api/v1/publications/HR02-1006792277/pdf",
            "published_at": "2026-10-22"
        }
        is_valid, reason, audit_data = audit_mandate_lead(item, eval_result={})
        self.assertFalse(is_valid)
        self.assertEqual(audit_data["tier"], "TIER_3")
        self.assertEqual(audit_data["status"], "discarded")
        self.assertEqual(audit_data["rejection_reason"], "Formal_Correction_No_Mandate")

    def test_de_announcements_defaults_to_zero_synthetic_fixtures(self):
        """Stellt sicher, dass de_announcements im Normalbetrieb keine synthetischen Test-Fixtures in die Pipeline einspeist."""
        bulletins = get_verified_statutory_bulletins(allow_synthetic_fixtures=False)
        self.assertEqual(len(bulletins), 0, "Ohne Primär-Scraping und ohne allow_synthetic_fixtures dürfen 0 Meldungen generiert werden.")
        
        feed_items, dropped = fetch_de_announcements(allow_synthetic_fixtures=False)
        self.assertEqual(len(feed_items), 0, "fetch_de_announcements darf keine Testdaten im Live-Modus liefern.")
        self.assertEqual(dropped, 0)

    def test_swiss_shab_filter_rejects_berichtigung_without_insolvency(self):
        """Prüft, ob swiss_shab reine Berichtigungen verwirft."""
        title = "Mutation CATNOIR Schweiz AG, Baar, Berichtigung"
        pdf_text = "Uebersetzungen der Firma neu: CATNOIR Suisse SA. Berichtigung der Statuten."
        relevant, reason = check_shab_mutation_relevance(title, pdf_text)
        self.assertFalse(relevant)
        self.assertEqual(reason, "ROUTINE_ADMIN_CORRECTION")

    def test_swiss_shab_filter_accepts_actual_organ_vacancy(self):
        """cosquare AG-Szenario: Reale Abberufung ohne Nachfolger muss qualifiziert durchkommen."""
        title = "Mutation cosquare AG, Zürich"
        pdf_text = "Reto Lanfranconi, Mitglied des Verwaltungsrates, hat seine Funktion niedergelegt. Seine Unterschrift ist erloschen."
        relevant, reason = check_shab_mutation_relevance(title, pdf_text)
        self.assertTrue(relevant)
        self.assertEqual(reason, "ORGAN_DEPARTURE_DETECTED")

if __name__ == "__main__":
    unittest.main()
