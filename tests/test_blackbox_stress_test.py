"""
NeXus HIT - Black-Box Stresstest der Mandatsintelligenz
Umfassende Validierung der Mandatsqualifizierung unter realistischen und schwierigen Bedingungen:

8 verbindliche Testfälle mit realen, öffentlich belegbaren Unternehmensereignissen:
1. Eigenverwaltung ohne Organwechsel (Illig Maschinenbau GmbH & Co. KG)
2. Tatsächliche Organvakanz (Meyer Burger Technology AG)
3. Restrukturierung mit bestätigter externer Personalsuche (BayWa AG)
4. Restrukturierung ohne erkennbare externe Mandatschance (ZF Friedrichshafen AG)
5. Finanzielle Restrukturierung / SchVG (PREOS Global Office Real Estate AG)
6. Unternehmensübernahme / Eigentümerwechsel:
   - 6a. Vollzogene Übernahme (Vitesco Technologies Group AG) -> VERWORFEN
   - 6b. Angekündigtes Übernahmeangebot ohne Carve-Out (Covestro AG) -> STUFE 1
   - 6c. Carve-Out / Post-Merger Transformation (Covestro AG) -> STUFE 2
7. Werksschließung oder Produktionsverlagerung (Continental AG)
8. Widersprüchliche / chronologische Folgeinformationen (Aumann AG)
"""

import unittest
from datetime import datetime, timezone, timedelta

from modules.feed_ingestion.event_model import TriggerEvent
from modules.feed_ingestion.reality_check import (
    MandateRealityCheckEngine,
    CLASS_MANDAT_BELEGT,
    CLASS_MANDAT_PLAUSIBEL,
    CLASS_BEOBACHTEN,
    CLASS_VERWERFEN,
    STAGE_1_VERIFIED_EVENT,
    STAGE_2_PLAUSIBLE_CHANCE,
    STAGE_3_CONFIRMED_NEED,
    STAGE_DISCARDED
)

class TestBlackBoxMandateStressTest(unittest.TestCase):
    """
    Strikte Testsuite für die 8 Konstellationen des Black-Box-Stresstests.
    """

    def setUp(self):
        self.now = datetime.now(timezone.utc)
        self.recent_date = (self.now - timedelta(days=2)).isoformat()
        self.older_date = (self.now - timedelta(days=15)).isoformat()

    def test_case_1_eigenverwaltung_ohne_organwechsel(self):
        """
        Fall 1: Eigenverwaltung ohne Organwechsel
        Referenzfall: Illig Maschinenbau GmbH & Co. KG
        - Restrukturierungsereignis: VERIFIZIERT
        - Organvakuum: NICHT NACHGEWIESEN (Geschäftsführung bleibt im Amt)
        - Externe Suche: NICHT BESTÄTIGT
        - Zielfunktion: CRO / Interim-Management (keinesfalls Sanierungsvorstand)
        - Mandatsstufe: STUFE 2 – PLAUSIBLE MANDATSCHANCE
        """
        ev = TriggerEvent(
            company_name="Illig Maschinenbau GmbH & Co. KG",
            country="DE",
            category="insolvenzantrag_eigenverwaltung",
            description="Antrag auf Sanierung in Eigenverwaltung gestellt",
            source_url="https://www.inso-news.de/illig-maschinenbau-eigenverwaltung-2024",
            source_type="press_release",
            published_at=self.recent_date,
            evidence_text="Das Amtsgericht Heilbronn hat dem Antrag auf vorläufige Eigenverwaltung stattgegeben. Die Geschäftsführung bleibt vollumfänglich im Amt und führt den Geschäftsbetrieb uneingeschränkt fort."
        )
        rc = ev.reality_check

        # 1. Was ist nachweislich passiert?
        self.assertEqual(rc["criteria_eval"]["event_validity"], "bestaetigt")
        self.assertIn("Eigenverwaltung", rc["facts_proven"])

        # 2. Organvakuum
        self.assertEqual(rc["organ_vacuum_status"], "NICHT NACHGEWIESEN")
        self.assertIn("Eigenverwaltung begründet allein kein Organvakuum", rc["organ_vacuum_details"])

        # 3. Rollendifferenzierung
        self.assertEqual(rc["target_role_label"], "CRO / Interim-Management")
        self.assertNotEqual(rc["target_role_label"], "CRO / Sanierungsvorstand")

        # 4. Externe Suche
        self.assertEqual(rc["external_search_status"], "NICHT BESTÄTIGT")

        # 5. Mandatsstufe & Gewissheit
        self.assertEqual(rc["stage_level"], "STUFE 2")
        self.assertEqual(rc["qualification_stage"], STAGE_2_PLAUSIBLE_CHANCE)
        self.assertEqual(rc["mandate_certainty"], "Plausibel (Stufe 2)")
        self.assertIn("Ein plausibler Bedarf ist noch kein vergebenes Mandat", rc["mandate_hypothesis"])

    def test_case_2_tatsaechliche_organvakanz_executive(self):
        """
        Fall 2: Tatsächliche Organvakanz
        Referenzfall: Meyer Burger Technology AG
        - Ereignis: CEO scheidet mit sofortiger Wirkung aus
        - Organvakuum: BESTANDEN (CEO-Ausscheiden nachgewiesen)
        - Zielfunktion: CEO / Geschäftsführer (nicht fälschlich Verwaltungsrat!)
        - Externe Suche: NICHT BESTÄTIGT
        - Mandatsstufe: STUFE 2 – PLAUSIBLE MANDATSCHANCE
        """
        ev = TriggerEvent(
            company_name="Meyer Burger Technology AG",
            country="CH",
            category="c_level_vakanz",
            description="CEO scheidet mit sofortiger Wirkung aus der Geschäftsleitung aus",
            source_url="https://www.six-exchange-regulation.com/de/home/publications/ad-hoc-notices/2024/meyer-burger.html",
            source_type="ad_hoc",
            published_at=self.recent_date,
            evidence_text="CEO Gunter Erfurt tritt per sofort zurück und scheidet aus der Geschäftsleitung aus. Der Verwaltungsrat leitet die Suche nach einer dauerhaften operativen Führung ein."
        )
        rc = ev.reality_check

        self.assertEqual(rc["organ_vacuum_status"], "BESTANDEN")
        self.assertEqual(rc["target_role_label"], "CEO / Geschäftsführer")
        self.assertNotEqual(rc["target_role_label"], "Verwaltungsrat / Aufsichtsrat")
        self.assertNotEqual(rc["target_role_label"], "CRO / Interim-Management")
        self.assertEqual(rc["external_search_status"], "NICHT BESTÄTIGT")
        self.assertEqual(rc["stage_level"], "STUFE 2")
        self.assertEqual(rc["qualification_stage"], STAGE_2_PLAUSIBLE_CHANCE)

    def test_case_3_restrukturierung_mit_bestaetigter_suche(self):
        """
        Fall 3: Restrukturierung mit bestätigter externer Personalsuche
        Referenzfall: BayWa AG
        - Ereignis: Schwere Krise, Sanierungsgutachten und explizite Suche nach CRO
        - Organvakuum: NICHT NACHGEWIESEN
        - Zielfunktion: CRO / Interim-Management
        - Externe Suche: BESTÄTIGT
        - Mandatsstufe: STUFE 3 – BESTÄTIGTER MANDATSBEDARF
        """
        ev = TriggerEvent(
            company_name="BayWa AG",
            country="DE",
            category="unternehmenskrise_restrukturierung",
            description="Sanierungsgutachten beauftragt und externe Interims-Führung gesucht",
            source_url="https://www.eqs-news.com/de/news/corporate/baywa-restrukturierung-cro/2024",
            source_type="ad_hoc",
            published_at=self.recent_date,
            evidence_text="Die BayWa AG befindet sich in einer angespannten Liquiditätskrise. Die Gesellschaft sucht interim cro und hat eine mandatierte Personalberatung mit Suche nach Sanierungsführung beauftragt."
        )
        rc = ev.reality_check

        self.assertEqual(rc["criteria_eval"]["event_validity"], "bestaetigt")
        self.assertEqual(rc["organ_vacuum_status"], "NICHT NACHGEWIESEN")
        self.assertEqual(rc["external_search_status"], "BESTÄTIGT")
        self.assertEqual(rc["target_role_label"], "CRO / Interim-Management")
        self.assertEqual(rc["stage_level"], "STUFE 3")
        self.assertEqual(rc["qualification_stage"], STAGE_3_CONFIRMED_NEED)
        self.assertEqual(rc["mandate_certainty"], "Bestätigt (Stufe 3)")

    def test_case_4_restrukturierung_ohne_externe_mandatschance(self):
        """
        Fall 4: Restrukturierung ohne erkennbare externe Mandatschance
        Referenzfall: ZF Friedrichshafen AG
        - Ereignis: Konzernweites Effizienzprogramm / interner Stellenabbau
        - Keine externe Suche, kein Organvakuum
        - Mandatsstufe: STUFE 1 – VERIFIZIERTES EREIGNIS (Beobachtung)
        - Zielfunktion: Keine externe Organfunktion ableitbar
        """
        ev = TriggerEvent(
            company_name="ZF Friedrichshafen AG",
            country="DE",
            category="unternehmenskrise_restrukturierung",
            description="Konzernweites Effizienzprogramm zur Anpassung der Kapazitäten",
            source_url="https://www.zf.com/press/de/restrukturierung-2024.html",
            source_type="press_release",
            published_at=self.recent_date,
            evidence_text="ZF hat ein Restrukturierungsprogramm angekündigt. Vorstand und Gesamtbetriebsrat einigten sich auf einen internen Stellenabbau. Die Umsetzung erfolgt durch die bestehende Geschäftsführung ohne externe Mandatierung."
        )
        rc = ev.reality_check

        self.assertEqual(rc["criteria_eval"]["event_validity"], "bestaetigt")
        self.assertEqual(rc["organ_vacuum_status"], "NICHT NACHGEWIESEN")
        self.assertEqual(rc["external_search_status"], "NICHT BESTÄTIGT")
        self.assertEqual(rc["stage_level"], "STUFE 1")
        self.assertEqual(rc["qualification_stage"], STAGE_1_VERIFIED_EVENT)
        self.assertEqual(rc["target_role_label"], "Keine externe Organfunktion ableitbar")
        self.assertEqual(rc["mandate_certainty"], "Unbestätigt (Stufe 1)")

    def test_case_5_finanzielle_restrukturierung_schvg(self):
        """
        Fall 5: Finanzielle Restrukturierung
        Referenzfall: PREOS Global Office Real Estate AG
        - Ereignis: SchVG Gläubigerabstimmung, Laufzeitverlängerung, Stillhalteabkommen
        - Organvakuum: NICHT NACHGEWIESEN
        - Zielfunktion: CFO / Finanzrestrukturierung
        - Externe Suche: NICHT BESTÄTIGT
        - Mandatsstufe: STUFE 2 – PLAUSIBLE MANDATSCHANCE
        """
        ev = TriggerEvent(
            company_name="PREOS Global Office Real Estate AG",
            country="DE",
            category="finanzierung_anleihen_restrukturierung",
            description="Abstimmung ohne Versammlung nach SchVG für Wandelschuldverschreibung einberufen",
            source_url="https://www.eqs-news.com/de/news/corporate/preos-schvg-anleihe/2024",
            source_type="ad_hoc",
            published_at=self.recent_date,
            evidence_text="PREOS lädt die Anleihegläubiger zu einer Abstimmung ohne Versammlung nach dem SchVG ein. Stillhalteabkommen mit Gläubigern und Restrukturierungskonzept vorgelegt."
        )
        rc = ev.reality_check

        self.assertEqual(rc["organ_vacuum_status"], "NICHT NACHGEWIESEN")
        self.assertEqual(rc["target_role_label"], "CFO / Finanzrestrukturierung")
        self.assertEqual(rc["external_search_status"], "NICHT BESTÄTIGT")
        self.assertEqual(rc["stage_level"], "STUFE 2")
        self.assertEqual(rc["qualification_stage"], STAGE_2_PLAUSIBLE_CHANCE)
        self.assertEqual(rc["mandate_certainty"], "Plausibel (Stufe 2)")

    def test_case_6a_uebernahme_vollzogen(self):
        """
        Fall 6a: Vollzogene Unternehmensübernahme
        Referenzfall: Vitesco Technologies Group AG / Schaeffler AG
        - Ereignis: Übernahme vollzogen, Geschäftsbetrieb übernommen
        - Ergebnis: VERWORFEN (Transaktion bereits abgeschlossen / Problem gelöst)
        """
        ev = TriggerEvent(
            company_name="Vitesco Technologies Group AG",
            country="DE",
            category="unternehmenskrise_restrukturierung",
            description="Übernahmeangebot der Schaeffler AG vollzogen",
            source_url="https://www.eqs-news.com/de/news/corporate/vitesco-schaeffler-vollzug/2024",
            source_type="ad_hoc",
            published_at=self.recent_date,
            evidence_text="Schaeffler hat das freiwillige Erwerbsangebot vollzogen. Übernahme vollzogen und Geschäftsbetrieb übernommen. Integration läuft."
        )
        rc = ev.reality_check

        self.assertEqual(rc["status"], CLASS_VERWERFEN)
        self.assertEqual(rc["stage_level"], "VERWORFEN")
        self.assertEqual(rc["qualification_stage"], STAGE_DISCARDED)
        self.assertEqual(rc["target_role_label"], "Keine externe Organfunktion ableitbar")

    def test_case_6b_eigentuemerwechsel_mit_carveout(self):
        """
        Fall 6b: Eigentümerwechsel mit Carve-Out & PMI
        Referenzfall: Covestro AG
        - Ereignis: Carve-Out und Post-Merger Integration nach Eigentümerwechsel
        - Organvakuum: NICHT NACHGEWIESEN
        - Zielfunktion: COO / operative Transformation
        - Externe Suche: NICHT BESTÄTIGT
        - Mandatsstufe: STUFE 2 – PLAUSIBLE MANDATSCHANCE
        """
        ev = TriggerEvent(
            company_name="Covestro AG",
            country="DE",
            category="transformation_sanierung",
            description="Carve-out und Vorbereitung der post-merger integration operations",
            source_url="https://www.handelsblatt.com/unternehmen/industrie/covestro-carveout/2024",
            source_type="press_release",
            published_at=self.recent_date,
            evidence_text="Nach Eigentümerwechsel steht ein komplexer Carve-Out und die post-merger integration bevor. Operative Transformation eingeleitet."
        )
        rc = ev.reality_check

        self.assertEqual(rc["organ_vacuum_status"], "NICHT NACHGEWIESEN")
        self.assertEqual(rc["target_role_label"], "COO / operative Transformation")
        self.assertEqual(rc["external_search_status"], "NICHT BESTÄTIGT")
        self.assertEqual(rc["stage_level"], "STUFE 2")
        self.assertEqual(rc["qualification_stage"], STAGE_2_PLAUSIBLE_CHANCE)

    def test_case_7_werksschliessung_produktionsverlagerung(self):
        """
        Fall 7: Werksschließung oder Produktionsverlagerung
        Referenzfall: Continental AG
        - Ereignis: Schließung des Produktionsstandorts Gifhorn & Verlagerung
        - Organvakuum: NICHT NACHGEWIESEN (Vorstand bleibt im Amt)
        - Zielfunktion: COO / operative Transformation
        - Externe Suche: NICHT BESTÄTIGT
        - Mandatsstufe: STUFE 2 – PLAUSIBLE MANDATSCHANCE
        """
        ev = TriggerEvent(
            company_name="Continental AG",
            country="DE",
            category="transformation_sanierung",
            description="Schließung des Produktionsstandorts Gifhorn beschlossen",
            source_url="https://www.continental.com/de/presse/gifhorn-werksschliessung",
            source_type="press_release",
            published_at=self.recent_date,
            evidence_text="Continental schließt das Werk in Gifhorn bis Ende 2027. Werksschließung und Produktionsverlagerung von Komponenten nach Osteuropa zur Standortsicherung eingeleitet."
        )
        rc = ev.reality_check

        self.assertEqual(rc["organ_vacuum_status"], "NICHT NACHGEWIESEN")
        self.assertEqual(rc["target_role_label"], "COO / operative Transformation")
        self.assertEqual(rc["external_search_status"], "NICHT BESTÄTIGT")
        self.assertEqual(rc["stage_level"], "STUFE 2")
        self.assertEqual(rc["qualification_stage"], STAGE_2_PLAUSIBLE_CHANCE)
        self.assertEqual(rc["mandate_certainty"], "Plausibel (Stufe 2)")

    def test_case_8_widerspruechliche_chronologische_folgeinformation(self):
        """
        Fall 8: Widersprüchliche oder veraltete Informationen (Chronologie-Test)
        Referenzfall: Aumann AG
        - T1: CFO scheidet aus -> STUFE 2 (Organvakuum: BESTANDEN)
        - T2 (Folgemeldung): Neuer CFO bestellt, Nachfolge geregelt -> Statuswechsel auf VERWERFEN (Organvakuum: NICHT NACHGEWIESEN)
        """
        ev_t1 = {
            "company_name": "Aumann AG",
            "country": "DE",
            "category": "c_level_vakanz",
            "description": "CFO scheidet aus dem Vorstand aus",
            "source_url": "https://www.eqs-news.com/aumann-cfo-exit",
            "published_at": self.older_date,
            "evidence_text": "Der bisherige CFO scheidet per sofort aus dem Vorstand aus. Nachfolge ist unbesetzt."
        }
        res_t1 = MandateRealityCheckEngine.evaluate(ev_t1)
        self.assertEqual(res_t1["status"], CLASS_MANDAT_PLAUSIBEL)
        self.assertEqual(res_t1["stage_level"], "STUFE 2")
        self.assertEqual(res_t1["organ_vacuum_status"], "BESTANDEN")

        ev_t2 = {
            "company_name": "Aumann AG",
            "country": "DE",
            "category": "organ_mutation",
            "description": "Nachfolge geregelt: Neuer CFO bestellt",
            "source_url": "https://www.eqs-news.com/aumann-neuer-cfo",
            "published_at": self.recent_date,
            "evidence_text": "Dr. Christian Müller wird zum neuen CFO bestellt und tritt CFO-Amt an. Nachfolge geregelt."
        }

        res_t2, transition_log = MandateRealityCheckEngine.reevaluate_on_follow_up(ev_t1, ev_t2)
        self.assertEqual(res_t2["status"], CLASS_VERWERFEN)
        self.assertEqual(res_t2["stage_level"], "VERWORFEN")
        self.assertEqual(res_t2["organ_vacuum_status"], "NICHT NACHGEWIESEN")
        self.assertTrue(transition_log["status_changed"])
        self.assertIn("personell bereits fest nachbesetzt", transition_log["transition_rationale"])

if __name__ == "__main__":
    unittest.main()
