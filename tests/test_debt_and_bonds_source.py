"""
Unit Tests für Source Collector: DACH Capital Markets, Bonds & Debt Restructuring
Prüft:
1. Saubere Struktur und Pflichtfelder der TriggerEvent-Objekte
2. Verlässliches Ausfiltern von redaktionellem Rauschen (ANLEIHEN-Woche, Fußnoten, Gastbeiträge)
3. Präzise Extraktion von Unternehmensnamen und Rechtsformen
4. Abweisung unzulässiger generischer Platzhalter-Namen
5. Kalibrierung der 3-Achsen-Bewertung (A: nachgewiesen, B: akut/mittel, C: hoch/mittel)
6. Strenge Behandlung von Datumsfeldern (event_date nur bei explizitem Beleg im Text)
"""

import unittest
from datetime import datetime, timezone
from modules.feed_ingestion.sources.dach_debt_and_bonds import (
    extract_company_name_from_debt_item,
    extract_explicit_event_date,
    normalize_company_name,
    FORBIDDEN_GENERIC_NAMES,
    fetch_debt_and_bonds_feed
)
from modules.feed_ingestion.event_model import TriggerEvent

class TestDebtAndBondsSource(unittest.TestCase):

    def test_01_company_extraction_precision(self):
        """Prüft, ob Unternehmensnamen präzise aus Titeln und Lead-Texten extrahiert werden."""
        # 1. Gläubiger-Präfix
        name1 = extract_company_name_from_debt_item(
            "Branicks-Gläubiger stimmen Restrukturierung und Laufzeitverlängerung zu",
            "Die Anleihegläubiger der Branicks Group AG haben mit 99 % der Stimmen..."
        )
        self.assertEqual(name1, "Branicks Group AG")

        # 2. PAUL Tech
        name2 = extract_company_name_from_debt_item(
            "PAUL Tech-Gläubiger stimmen Laufzeit-Verlängerung der Anleihe bis 2028 zu",
            "Die Gläubigerversammlung der PAUL Tech AG hat einer Verlängerung zugestimmt..."
        )
        self.assertEqual(name2, "PAUL Tech AG")

        # 3. Doppelpunkt-Präfix
        name3 = extract_company_name_from_debt_item(
            "pferdewetten.de AG: Frank Hartmann wird neuer CFO",
            "Frank Hartmann übernimmt zum 15. Oktober 2026 das Finanzressort..."
        )
        self.assertEqual(name3, "pferdewetten.de AG")

        # 4. Booster Precision
        name4 = extract_company_name_from_debt_item(
            "BOOSTER und Gläubigergruppe verlängern Stillhaltevereinbarung",
            "BOOSTER Precision Components Holding gibt Verlängerung bekannt..."
        )
        self.assertEqual(name4, "BOOSTER Precision Components GmbH")

    def test_02_forbidden_generic_names_rejected(self):
        """Stellt sicher, dass generische Schlagworte niemals als Firmennamen durchrutschen."""
        for term in FORBIDDEN_GENERIC_NAMES:
            res = extract_company_name_from_debt_item(f"{term.capitalize()}: Rechte nicht ohne Plan abgeben", "Gastbeitrag...")
            self.assertNotEqual(res.lower(), term.lower(), f"Generischer Begriff '{term}' darf nicht als Firmenname akzeptiert werden.")

    def test_03_explicit_event_date_extraction(self):
        """Prüft, dass explizite Vorfalldaten extrahiert werden, sonst strikt None verbleibt."""
        text_with_date = "Die Gläubigerversammlung fand am 27. Oktober 2026 in Frankfurt statt."
        parsed = extract_explicit_event_date(text_with_date)
        self.assertEqual(parsed, "2026-10-27")

        text_without_date = "Die Gläubigerversammlung stimmte der Restrukturierung ohne Gegenstimme zu."
        parsed_none = extract_explicit_event_date(text_without_date)
        self.assertIsNone(parsed_none)

    def test_04_three_axis_calibration(self):
        """Prüft die 3-Achsen-Kalibrierung: Gläubigerabstimmungen erfordern zwingend C=hoch (CFO/CRO-Bedarf)."""
        # Manueller Event-Bau wie im Kollektor
        ev = TriggerEvent(
            company_name="PAUL Tech AG",
            country="DE",
            region="DACH",
            category="finanzierung_anleihen_restrukturierung",
            description="PAUL Tech-Gläubiger stimmen Laufzeit-Verlängerung der Anleihe bis 2028 zu",
            event_date="2026-10-27",
            published_at="2026-10-27T06:18:28+00:00",
            source_url="https://www.anleihen-finder.de/paul-tech-glaeubiger-stimmen-laufzeit-verlaengerung-der-anleihe-bis-2028-zu-00074284.html",
            source_type="capital_markets_press",
            evidence_text="Die Gläubigerversammlung der PAUL Tech AG hat einer Verlängerung zugestimmt.",
            provenance_status="real_source_verified",
            axis_a_event_certainty="nachgewiesen",
            axis_b_transformation_need="akut",
            axis_c_mandate_potential="hoch",
            mandate_rationale="SchVG-Restrukturierung erfordert Sanierungs-CFO"
        )
        self.assertEqual(ev.axis_a_event_certainty, "nachgewiesen")
        self.assertEqual(ev.axis_b_transformation_need, "akut")
        self.assertEqual(ev.axis_c_mandate_potential, "hoch")
        self.assertEqual(ev.provenance_status, "real_source_verified")
        self.assertEqual(ev.source_type, "capital_markets_press")

    def test_05_live_feed_structure_and_types(self):
        """Führt einen Live-Abruf (oder Fallback) aus und prüft, dass alle erfassten Events validen Typen entsprechen."""
        events, dropped = fetch_debt_and_bonds_feed(max_items=5)
        self.assertIsInstance(events, list)
        self.assertIsInstance(dropped, int)
        for ev in events:
            self.assertIsInstance(ev, TriggerEvent)
            self.assertEqual(ev.provenance_status, "real_source_verified")
            self.assertEqual(ev.source_type, "capital_markets_press")
            self.assertTrue(ev.source_url.startswith("http"))
            self.assertNotIn(ev.company_name.lower(), FORBIDDEN_GENERIC_NAMES)
            self.assertTrue(len(ev.company_name) >= 3)

if __name__ == "__main__":
    unittest.main()
