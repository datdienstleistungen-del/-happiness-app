"""
NeXus HIT - Regressionstests für Präzisionskorrektur nach End-to-End-Praxistest
Validiert die Behebung der 4 Fehlerursachen:
1. Weha Ludwig Werwein GmbH: Abgeschlossene übertragende Sanierung -> VERWORFEN (vs. Eröffnungsantrag -> STUFE 2)
2. Dexus Finance Pty: Hauptversammlungsrede ohne Organvakanz -> VERWORFEN
3. Technology Media / B2i Digital: Investorenkonferenz ohne Organvakanz -> VERWORFEN
4. STRATEC SE: Angekündigter Spartenverkauf / Divestment ohne operative Entflechtung -> STUFE 1

Validiert gleichzeitig den Erhalt aller validen Chancen und Referenzfälle:
- Weinkellereien Aarau AG -> STUFE 2 (Verwaltungsrat / Aufsichtsrat, BESTANDEN)
- BOOSTER Precision Components GmbH -> STUFE 2 (CFO / Finanzrestrukturierung)
- Branicks Group AG -> STUFE 2 (CFO / Finanzrestrukturierung)
- PAUL Tech AG -> STUFE 2 (CFO / Finanzrestrukturierung)
- Weha Ludwig Werwein GmbH (Eröffnungsantrag) -> STUFE 2 (CRO / Interim-Management)
- cosquare AG -> STUFE 2 (Verwaltungsrat / Aufsichtsrat)
"""

import unittest
from datetime import datetime, timezone, timedelta

from modules.feed_ingestion.event_model import TriggerEvent
from modules.feed_ingestion.reality_check import (
    CLASS_MANDAT_BELEGT,
    CLASS_MANDAT_PLAUSIBEL,
    CLASS_BEOBACHTEN,
    CLASS_VERWERFEN,
    STAGE_1_VERIFIED_EVENT,
    STAGE_2_PLAUSIBLE_CHANCE,
    STAGE_3_CONFIRMED_NEED,
    STAGE_DISCARDED
)

class TestPrecisionCorrectionsPraxistest(unittest.TestCase):

    def setUp(self):
        self.now = datetime.now(timezone.utc)
        self.recent_date = (self.now - timedelta(days=2)).isoformat()

    def test_01_weha_abgeschlossene_sanierung_verwerfen_vs_eroeffnung(self):
        """
        Fehler 1: Unterscheidung zwischen laufender Eigenverwaltung und abgeschlossener Sanierung.
        - Fall A: Abgeschlossene übertragende Sanierung mit Investorenlösung -> VERWORFEN
        - Fall B: Eröffnungsantrag Eigenverwaltung (Referenzfall) -> STUFE 2
        """
        # Fall A: Abgeschlossene Sanierung (Praxistest Fall 10)
        ev_completed = TriggerEvent(
            company_name="Weha Ludwig Werwein GmbH",
            country="DE",
            category="insolvenzantrag_eigenverwaltung",
            description="Investorenlösung für Traditionsunternehmen: Weha Ludwig Werwein GmbH gerettet",
            source_url="https://www.inso-news.de/weha-investorenloesung-gerettet-2026",
            source_type="press_release",
            published_at=self.recent_date,
            evidence_text="Für den Geschäftsbetrieb der Weha Ludwig Werwein GmbH aus Königsbrunn bei Augsburg ist eine Investorenlösung umgesetzt worden. Im Rahmen des Eigenverwaltungsverfahrens wurde der Geschäftsbetrieb mit Wirkung zum 1. Oktober 2026 auf die neu gegründete Weha GmbH i. G. übertragen. Sämtliche 44 Arbeitnehmerinnen und Arbeitnehmer wurden von der Erwerberin übernommen."
        )
        rc_completed = ev_completed.reality_check
        self.assertEqual(rc_completed["status"], CLASS_VERWERFEN)
        self.assertEqual(rc_completed["stage_level"], "VERWORFEN")
        self.assertEqual(rc_completed["target_role"], "KEINE")
        self.assertEqual(rc_completed["organ_vacuum_status"], "NICHT NACHGEWIESEN")
        self.assertTrue(any("übertragende Sanierung" in ci or "erfolgreich abgeschlossen" in ci for ci in rc_completed["counter_indicators"]))

        # Fall B: Eröffnungsantrag (Referenzfall) bleibt Stufe 2
        ev_opening = TriggerEvent(
            company_name="Weha Ludwig Werwein GmbH",
            country="DE",
            category="insolvenzantrag_eigenverwaltung",
            description="Antrag auf Sanierung in Eigenverwaltung gestellt",
            source_url="https://www.inso-news.de/weha-eigenverwaltung-antrag",
            source_type="press_release",
            published_at=self.recent_date,
            evidence_text="Das Amtsgericht Augsburg hat dem Antrag auf Sanierung in Eigenverwaltung stattgegeben. Der Geschäftsbetrieb läuft uneingeschränkt weiter."
        )
        rc_opening = ev_opening.reality_check
        self.assertEqual(rc_opening["status"], CLASS_MANDAT_PLAUSIBEL)
        self.assertEqual(rc_opening["stage_level"], "STUFE 2")
        self.assertEqual(rc_opening["target_role_label"], "CRO / Interim-Management")
        self.assertEqual(rc_opening["organ_vacuum_status"], "NICHT NACHGEWIESEN")

    def test_02_dexus_finance_agm_speech_ceo_verwerfen(self):
        """
        Fehler 2: CEO-Begriff in Hauptversammlungsrede ohne Personalveränderung / Vakanz.
        - Reine AGM-Rede von Chair und CEO darf keine Vakanz auslösen -> VERWORFEN
        """
        ev_dexus = TriggerEvent(
            company_name="Dexus Finance Pty",
            country="DE",
            category="c_level_vakanz",
            description="Dexus Finance Pty: 25 Ad-hoc EN Dexus Finance Pty Limited: 2026 AGM Chair and Group CEO address",
            source_url="https://www.dgap.de/dexus-agm-speech",
            source_type="ad_hoc",
            published_at=self.recent_date,
            evidence_text="Dexus Finance Pty Limited: 2026 AGM Chair and Group CEO address delivered to shareholders."
        )
        rc_dexus = ev_dexus.reality_check
        self.assertEqual(rc_dexus["status"], CLASS_VERWERFEN)
        self.assertEqual(rc_dexus["stage_level"], "VERWORFEN")
        self.assertEqual(rc_dexus["target_role"], "KEINE")
        self.assertEqual(rc_dexus["organ_vacuum_status"], "NICHT NACHGEWIESEN")
        self.assertIn("Routine-Hauptversammlungsrede", rc_dexus["organ_vacuum_details"])

    def test_03_technology_media_investor_conference_verwerfen(self):
        """
        Fehler 3: Investorenkonferenz ohne personelle Veränderung.
        - Reines Investorentreffen auf Technologiekonferenz -> VERWORFEN
        """
        ev_tech = TriggerEvent(
            company_name="Technology Media And",
            country="DE",
            category="c_level_vakanz",
            description="Technology Media And: Corporate EN Technology, Media and Internet Companies Meet Institutional Investors at the 15th Annual ROTH Technology Conference",
            source_url="https://www.dgap.de/technology-media-conference",
            source_type="ad_hoc",
            published_at=self.recent_date,
            evidence_text="Technology, Media and Internet Companies Meet Institutional Investors at the 15th Annual ROTH Technology Conference."
        )
        rc_tech = ev_tech.reality_check
        self.assertEqual(rc_tech["status"], CLASS_VERWERFEN)
        self.assertEqual(rc_tech["stage_level"], "VERWORFEN")
        self.assertEqual(rc_tech["target_role"], "KEINE")
        self.assertEqual(rc_tech["organ_vacuum_status"], "NICHT NACHGEWIESEN")
        self.assertIn("Konferenzmeldung", rc_tech["organ_vacuum_details"])

    def test_04_stratec_carveout_spartenverkauf_stufe1(self):
        """
        Fehler 4: Angekündigter Spartenverkauf / Divestment ohne operative Trennung.
        - Verkauf eines Geschäftsbereichs ist ein verifiziertes Ereignis -> STUFE 1
        - Kein automatischer COO-Bedarf ohne konkrete operative Entflechtung
        """
        ev_stratec = TriggerEvent(
            company_name="Stratec Verkauft Verlustbringenden",
            country="DE",
            category="c_level_vakanz",
            description="Stratec Verkauft Verlustbringenden: Ad-hoc STRATEC VERKAUFT VERLUSTBRINGENDEN GESCHÄFTSBEREICH, NIMMT WERTMINDERUNGEN VOR UND PASST AUSBLICK AN",
            source_url="https://www.dgap.de/stratec-spartenverkauf",
            source_type="ad_hoc",
            published_at=self.recent_date,
            evidence_text="STRATEC SE: Ad-hoc STRATEC VERKAUFT VERLUSTBRINGENDEN GESCHÄFTSBEREICH, NIMMT WERTMINDERUNGEN VOR UND PASST AUSBLICK AN."
        )
        rc_stratec = ev_stratec.reality_check
        self.assertEqual(rc_stratec["status"], CLASS_BEOBACHTEN)
        self.assertEqual(rc_stratec["stage_level"], "STUFE 1")
        self.assertEqual(rc_stratec["qualification_stage"], STAGE_1_VERIFIED_EVENT)
        self.assertEqual(rc_stratec["target_role"], "KEINE")
        self.assertEqual(rc_stratec["organ_vacuum_status"], "NICHT NACHGEWIESEN")
        self.assertIn("Angekündigte Transaktion oder Spartenverkauf", rc_stratec["rationale"])

    def test_05_valide_chancen_praxistest_erhalten(self):
        """
        Sicherstellung: Alle 4 validen Praxistest-Fälle verbleiben zwingend auf STUFE 2.
        - Weinkellereien Aarau AG
        - BOOSTER Precision Components
        - Branicks Group AG
        - PAUL Tech AG
        """
        # 1. Weinkellereien Aarau AG (echtes VR-Ausscheiden)
        ev_aarau = TriggerEvent(
            company_name="Weinkellereien Aarau AG",
            country="CH",
            category="c_level_vakanz_ch",
            description="Weinkellereien Aarau AG: Mutation Weinkellereien Aarau AG, Aarau",
            source_url="https://www.shab.ch/aarau-mutation",
            source_type="gazette",
            published_at=self.recent_date,
            evidence_text="Ausgeschiedene Personen und erloschene Unterschriften: Stucky, Ulrich, von Bettmeralp, in Aarau, Mitglied des Verwaltungsrates, mit Kollektivunterschrift zu zweien."
        )
        rc_aarau = ev_aarau.reality_check
        self.assertEqual(rc_aarau["stage_level"], "STUFE 2")
        self.assertEqual(rc_aarau["organ_vacuum_status"], "BESTANDEN")
        self.assertEqual(rc_aarau["target_role_label"], "Verwaltungsrat / Aufsichtsrat")

        # 2. BOOSTER Precision Components (Stillhalteabkommen / SchVG)
        ev_booster = TriggerEvent(
            company_name="BOOSTER Precision Components GmbH",
            country="DE",
            category="finanzierung_anleihen_restrukturierung",
            description="BOOSTER und Ad-hoc-Gläubigergruppe verlängern Stillhaltevereinbarung erneut",
            source_url="https://www.eqs-news.com/booster-stillhalteabkommen",
            source_type="ad_hoc",
            published_at=self.recent_date,
            evidence_text="Mitteilung der BOOSTER Precision Components Holding GmbH: BOOSTER Precision Components Holding gibt Verlängerung der Stillhaltevereinbarung mit Ad-hoc-Gläubigergruppe bekannt."
        )
        rc_booster = ev_booster.reality_check
        self.assertEqual(rc_booster["stage_level"], "STUFE 2")
        self.assertEqual(rc_booster["target_role_label"], "CFO / Finanzrestrukturierung")
        self.assertEqual(rc_booster["organ_vacuum_status"], "NICHT NACHGEWIESEN")

        # 3. Branicks Group AG (Restrukturierungskonzept & Gläubigerabstimmung)
        ev_branicks = TriggerEvent(
            company_name="Branicks Group AG",
            country="DE",
            category="finanzierung_anleihen_restrukturierung",
            description="Branicks-Gläubiger stimmen Restrukturierung und Laufzeitverlängerung zu",
            source_url="https://www.eqs-news.com/branicks-glaeubiger",
            source_type="ad_hoc",
            published_at=self.recent_date,
            evidence_text="Sanierungskonzept soll bis Ende 2026 in Kraft treten Die Anleihegläubiger der Branicks Group AG haben dem Restrukturierungskonzept zugestimmt."
        )
        rc_branicks = ev_branicks.reality_check
        self.assertEqual(rc_branicks["stage_level"], "STUFE 2")
        self.assertEqual(rc_branicks["target_role_label"], "CFO / Finanzrestrukturierung")

        # 4. PAUL Tech AG (Anleiheverlängerung & Gläubigerabstimmung)
        ev_paul = TriggerEvent(
            company_name="PAUL Tech AG",
            country="DE",
            category="finanzierung_anleihen_restrukturierung",
            description="PAUL Tech-Gläubiger stimmen Laufzeit-Verlängerung der Anleihe bis 2028 zu",
            source_url="https://www.eqs-news.com/paul-tech-anleihe",
            source_type="ad_hoc",
            published_at=self.recent_date,
            evidence_text="Die Gläubigerversammlung der PAUL Tech AG hat eine Anpassung der Anleihebedingungen und Restrukturierung beschlossen."
        )
        rc_paul = ev_paul.reality_check
        self.assertEqual(rc_paul["stage_level"], "STUFE 2")
        self.assertEqual(rc_paul["target_role_label"], "CFO / Finanzrestrukturierung")

    def test_06_referenzfall_cosquare_ag_erhalten(self):
        """
        Referenzfall cosquare AG:
        - Reales Ausscheiden eines Verwaltungsratsmitglieds
        - Organvakuum: BESTANDEN
        - Zielfunktion: Verwaltungsrat / Aufsichtsrat
        - Stufe: STUFE 2
        """
        ev_cosquare = TriggerEvent(
            company_name="cosquare AG",
            country="CH",
            category="c_level_vakanz_ch",
            description="Ausscheiden eines Mitglieds des Verwaltungsrats mit sofortiger Wirkung",
            source_url="https://www.shab.ch/cosquare",
            source_type="gazette",
            published_at=self.recent_date,
            evidence_text="Senior board director stepped down with immediate effect, leaving an unstaffed organ vacancy. Ausgeschiedene Personen: Lanfranconi, Mitglied des Verwaltungsrates, Unterschrift erloschen."
        )
        rc_cosquare = ev_cosquare.reality_check
        self.assertEqual(rc_cosquare["organ_vacuum_status"], "BESTANDEN")
        self.assertEqual(rc_cosquare["target_role_label"], "Verwaltungsrat / Aufsichtsrat")
        self.assertEqual(rc_cosquare["stage_level"], "STUFE 2")
        self.assertEqual(rc_cosquare["external_search_status"], "NICHT BESTÄTIGT")

if __name__ == "__main__":
    unittest.main()
