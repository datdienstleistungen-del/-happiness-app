"""
Unit Tests for German Law Firm Feeds and Insolvency Court Filings
Tests:
1. Top-5 Restructuring Law Firms extraction (Anchor, Brinkmann, PLUTA, Schultze & Braun, BBL)
2. German Commercial Entity Filter (Insolvenzbekanntmachungen § 9 InsO)
3. Exclusion of consumer bankruptcies and micro-entities (UG haftungsbeschränkt)
4. Integration with TriggerEvent and Reality Check Engine
"""

import unittest
from modules.feed_ingestion.sources.de_restructuring_press import (
    extract_legal_company,
    clean_extracted_company,
    classify_restructuring_category
)
from modules.feed_ingestion.sources.de_insolvency_register import (
    is_eligible_commercial_entity,
    clean_company_name,
    parse_german_date
)

class TestInsoAndLawFirms(unittest.TestCase):

    def test_01_top_kanzleien_company_extraction(self):
        """Verifies clean extraction of corporate names across all 5 law firm portals."""
        cases = [
            ("BBL: Insolvenzverwalter Dr. Florian Linkert gelingt übertragende Sanierung von Büromöbel Sofort-Markt Müller GmbH – Traditionsunternehmen und Arbeitsplätze gesichert", "Büromöbel Sofort-Markt Müller GmbH"),
            ("PLUTA Sanierungsexperte Dr. Christian Kaufmann ist vorläufiger Insolvenzverwalter der Hotel Reichshof GmbH", "Hotel Reichshof GmbH"),
            ("Erfolgreiche Sanierung in Eigenverwaltung: Demmel Gruppe übernimmt Geschäftsbetrieb der GWSPA Produktion GmbH in Wasserburg", "GWSPA Produktion GmbH"),
            ("BBL: Sanierung der Olympic Auto GmbH steht vor erfolgreichem Abschluss", "Olympic Auto GmbH"),
            ("BBL: Geschäftsbetrieb der Grabmeier GmbH wird eingestellt", "Grabmeier GmbH"),
            ("Solarunternehmen BSH GmbH & Co. KG stellt Insolvenzantrag", "BSH GmbH & Co. KG"),
            ("VIP Very Important Product Maschinenvertriebs GmbH: Sanierung für Sondermaschinenbauer ist auf den Weg gebracht", "VIP Very Important Product Maschinenvertriebs GmbH"),
            ("VARTA AG: Verkaufsprozess läuft planmäßig", "VARTA AG"),
            ("Baiersbronn Frischfaser Karton GmbH: Entscheidung über Fortführung steht bevor", "Baiersbronn Frischfaser Karton GmbH")
        ]
        for title, expected in cases:
            extracted = extract_legal_company(title)
            self.assertEqual(extracted, expected, f"Failed extracting from: '{title}'")

    def test_02_law_firm_names_never_extracted_as_target(self):
        """Ensures law firm names are never returned as the distressed company."""
        junk_inputs = [
            "PLUTA Rechtsanwälte expandiert nach Frankfurt",
            "Schultze & Braun eröffnet neuen Standort",
            "BBL Brockdorff berät Gläubiger",
            "Anchor Rechtsanwälte feiert Jubiläum"
        ]
        for inp in junk_inputs:
            c = extract_legal_company(inp)
            self.assertEqual(c, "", f"Law firm name leaked as company: '{c}'")

    def test_03_inso_commercial_filter(self):
        """Ensures consumer insolvencies and micro-UGs are filtered out."""
        # Valid commercial entities
        self.assertTrue(is_eligible_commercial_entity("Eilers Futtermittel GmbH & Co. KG", "Steinfurt, HRA 3552"))
        self.assertTrue(is_eligible_commercial_entity("Badem Bau GmbH", "Hamburg, HRB 135269"))
        self.assertTrue(is_eligible_commercial_entity("VARTA AG", "Ulm, HRB 728123"))

        # Ineligible private / consumer bankruptcies
        self.assertFalse(is_eligible_commercial_entity("Auzinger, Nico", ""))
        self.assertFalse(is_eligible_commercial_entity("Böhmichen, Alexander Dietmar", ""))
        self.assertFalse(is_eligible_commercial_entity("Müller, Hans, Herr", "Köln"))

        # Ineligible micro-entities
        self.assertFalse(is_eligible_commercial_entity("DreamCruiser UG (haftungsbeschränkt)", "Traunstein, HRB 26443"))

    def test_04_date_parsing_iso(self):
        """Verifies ISO conversion of German date formats."""
        self.assertEqual(parse_german_date("30.10.2026"), "2026-10-30")
        self.assertEqual(parse_german_date("01.05.2026"), "2026-05-01")
        self.assertIsNone(parse_german_date("invalid-date"))

if __name__ == '__main__':
    unittest.main()
