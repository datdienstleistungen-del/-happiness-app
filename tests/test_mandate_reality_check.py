"""
NeXus HIT - Unit Test Suite for Mandate Reality Check Engine
Verifies the mandatory corrective separating corporate trigger events from interim mandate needs:
1. Criteria A (Validität), B (Handlungsdruck), C (Organ-Fähigkeit), D (Mandatschance)
2. Four mutually exclusive classes: MANDAT_BELEGT, MANDAT_PLAUSIBEL, BEOBACHTEN, VERWERFEN
3. Negative filters and counter-indicators (Regelinsolvenz, Vollzug, Nachbesetzung)
4. Follow-up re-evaluation and audit history chain
5. Human-in-the-Loop review persistence
"""

import unittest
from datetime import datetime, timezone

from modules.feed_ingestion.event_model import TriggerEvent
from modules.feed_ingestion.reality_check import (
    MandateRealityCheckEngine,
    CLASS_MANDAT_BELEGT,
    CLASS_MANDAT_PLAUSIBEL,
    CLASS_BEOBACHTEN,
    CLASS_VERWERFEN
)

class TestMandateRealityCheck(unittest.TestCase):

    def test_positive_eigenverwaltung_cro(self):
        """Eigenverwaltung erfordert zwingend Sanierungsführung -> MANDAT_PLAUSIBEL mit CRO."""
        ev = TriggerEvent(
            company_name="Weha Ludwig Werwein GmbH",
            country="DE",
            category="insolvenzantrag_eigenverwaltung",
            description="Antrag auf Sanierung in Eigenverwaltung gestellt",
            source_url="https://www.inso-news.de/weha-eigenverwaltung",
            source_type="press_release",
            evidence_text="Das Amtsgericht Augsburg hat dem Antrag auf Sanierung in Eigenverwaltung stattgegeben. Der Geschäftsbetrieb läuft uneingeschränkt weiter."
        )
        rc = ev.reality_check
        self.assertEqual(rc["status"], CLASS_MANDAT_PLAUSIBEL)
        self.assertEqual(rc["target_role"], "CRO")
        self.assertEqual(rc["criteria_eval"]["event_validity"], "bestaetigt")
        self.assertEqual(rc["criteria_eval"]["action_pressure"], "akut")
        self.assertEqual(rc["criteria_eval"]["mandate_feasibility"], "plausibel")
        self.assertEqual(rc["criteria_eval"]["concrete_mandate_proof"], "nicht_belegt")
        self.assertTrue(len(rc["missing_information"]) > 0)
        self.assertIn("Ein plausibler Bedarf", rc["mandate_hypothesis"])

    def test_positive_schvg_debt_restructuring_cfo(self):
        """SchVG Gläubigerabstimmung / Stillhalteabkommen -> MANDAT_PLAUSIBEL mit INTERIM_CFO."""
        ev = TriggerEvent(
            company_name="PAUL Tech AG",
            country="DE",
            category="finanzierung_anleihen_restrukturierung",
            description="Einladung zur Abstimmung ohne Versammlung nach SchVG für Anleihe 2020/2025",
            source_url="https://www.eqs-news.com/de/news/corporate/paul-tech-ag-abstimmung/123",
            source_type="ad_hoc",
            evidence_text="Die PAUL Tech AG lädt die Anleihegläubiger zu einer Abstimmung ohne Versammlung ein. Hintergrund ist ein Stillhalteabkommen und ein Restrukturierungskonzept."
        )
        rc = ev.reality_check
        self.assertEqual(rc["status"], CLASS_MANDAT_PLAUSIBEL)
        self.assertEqual(rc["target_role"], "INTERIM_CFO")
        self.assertEqual(rc["criteria_eval"]["action_pressure"], "akut")
        self.assertIn("Stillhalteabkommen", rc["rationale"])

    def test_explicit_mandate_proof_mandat_belegt(self):
        """Konkret nachgewiesene externe Mandatssuche -> MANDAT_BELEGT."""
        ev = TriggerEvent(
            company_name="Alpha Restruct AG",
            country="DE",
            category="transformation_sanierung",
            description="Unternehmen mandatiert Personalberatung mit Suche nach Sanierungsvorstand",
            source_url="https://www.finance-magazin.de/alpha-mandat",
            source_type="press_release",
            evidence_text="Aufsichtsrat bestätigt: Gesellschaft sucht externen interim CRO zur Leitung der operativen Transformation."
        )
        rc = ev.reality_check
        self.assertEqual(rc["status"], CLASS_MANDAT_BELEGT)
        self.assertEqual(rc["criteria_eval"]["concrete_mandate_proof"], "belegt")
        self.assertIn("ausdrücklich belegt", rc["rationale"])

    def test_counter_indicator_already_solved_takeover(self):
        """Investorenprozess abgeschlossen / Betrieb übernommen -> VERWERFEN."""
        ev = TriggerEvent(
            company_name="GWSPA Produktion GmbH",
            country="DE",
            category="unternehmenskrise_restrukturierung",
            description="Demmel Gruppe übernimmt Geschäftsbetrieb der insolventen GWSPA",
            source_url="https://www.inso-news.de/gwspa-demmel",
            source_type="press_release",
            evidence_text="Der Investorenprozess ist erfolgreich abgeschlossen. Die Demmel AG übernimmt Geschäftsbetrieb und alle 120 Mitarbeiter."
        )
        rc = ev.reality_check
        self.assertEqual(rc["status"], CLASS_VERWERFEN)
        self.assertTrue(any("erfolgreich abgeschlossen" in ci or "übernommen" in ci for ci in rc["counter_indicators"]))
        self.assertIn("bereits gelöst", rc["rationale"].lower())

    def test_counter_indicator_position_already_staffed(self):
        """Führungsposition wurde in der Meldung bereits fest neu besetzt -> VERWERFEN."""
        ev = TriggerEvent(
            company_name="pferdewetten.de AG",
            country="DE",
            category="c_level_vakanz",
            description="Dr. Frank Stern wird neuer CFO der pferdewetten.de AG",
            source_url="https://www.dgap.de/pferdewetten-cfo",
            source_type="ad_hoc",
            evidence_text="Der Aufsichtsrat hat Dr. Frank Stern zum neuen CFO bestellt. Er tritt CFO-Amt per 1. November an."
        )
        rc = ev.reality_check
        self.assertEqual(rc["status"], CLASS_VERWERFEN)
        self.assertTrue(any("fest neu besetzt" in ci for ci in rc["counter_indicators"]))

    def test_counter_indicator_routine_contract(self):
        """Operative Auftragsmeldung ohne Krise -> VERWERFEN."""
        ev = TriggerEvent(
            company_name="CeoTronics AG",
            country="DE",
            category="auftrag_routine",
            description="CeoTronics erhält Großauftrag von europäischer Sicherheitsbehörde",
            source_url="https://www.dgap.de/ceotronics-auftrag",
            source_type="press_release",
            evidence_text="Das Unternehmen hat einen Großauftrag über Funktechnik im Volumen von 4,5 Mio. Euro verbucht."
        )
        rc = ev.reality_check
        self.assertEqual(rc["status"], CLASS_VERWERFEN)
        self.assertTrue(any("Auftrags" in ci or "operativ" in ci for ci in rc["counter_indicators"]))

    def test_regular_insolvency_fremdverwaltung_watchlist(self):
        """Regelinsolvenz mit Fremdverwaltung (Gerichtlicher Verwalter) -> BEOBACHTEN (Watchlist)."""
        ev = TriggerEvent(
            company_name="BSH Solar GmbH",
            country="DE",
            category="unternehmenskrise_restrukturierung",
            description="Amtsgericht eröffnet Insolvenzverfahren über BSH Solar",
            source_url="https://www.insolvenzbekanntmachungen.de/bsh",
            source_type="official_register",
            evidence_text="Das Amtsgericht hat das Insolvenzverfahren eröffnet und Rechtsanwalt Dr. Meyer zum Insolvenzverwalter bestellt."
        )
        rc = ev.reality_check
        self.assertEqual(rc["status"], CLASS_BEOBACHTEN)
        self.assertTrue(any("Regelinsolvenz" in ci or "Fremdverwaltung" in ci for ci in rc["counter_indicators"]))
        self.assertIn("Fremdverwaltung", rc["rationale"])

    def test_follow_up_evolution_to_verwerfen(self):
        """Folgemeldung über M&A-Vollzug überführt MANDAT_PLAUSIBEL in VERWERFEN und loggt Historie."""
        ev = TriggerEvent(
            company_name="Innovatech GmbH",
            country="DE",
            category="insolvenzantrag_eigenverwaltung",
            description="Schutzschirmverfahren eingeleitet",
            source_url="https://inso.de/innovatech-schutzschirm",
            source_type="press_release",
            evidence_text="Innovatech nutzt Schutzschirmverfahren für Neuausrichtung."
        )
        self.assertEqual(ev.reality_check["status"], CLASS_MANDAT_PLAUSIBEL)
        self.assertEqual(len(ev.reality_check_history), 0)

        # Folgemeldung: Zukunftslösung vollzogen
        ev.add_follow_up({
            "description": "Investor übernimmt Geschäftsbetrieb der Innovatech vollständig",
            "evidence_text": "Investorenprozess erfolgreich abgeschlossen. Übernahme vollzogen, Zukunft gesichert.",
            "source_url": "https://inso.de/innovatech-deal"
        })

        self.assertEqual(ev.reality_check["status"], CLASS_VERWERFEN)
        self.assertEqual(len(ev.reality_check_history), 1)
        hist = ev.reality_check_history[0]
        self.assertTrue(hist["status_changed"])
        self.assertEqual(hist["previous_status"], CLASS_MANDAT_PLAUSIBEL)
        self.assertEqual(hist["new_status"], CLASS_VERWERFEN)
        self.assertIn("Statusänderung von MANDAT_PLAUSIBEL auf VERWERFEN", hist["transition_rationale"])

    def test_human_review_preservation(self):
        """Menschliche Prüfentscheidung bleibt bei automatischen Re-Evaluationsläufen erhalten."""
        ev = TriggerEvent(
            company_name="Sample AG",
            country="DE",
            category="unternehmenskrise_restrukturierung",
            description="Restrukturierungsverhandlungen laufen",
            source_url="https://sample.de/press",
            source_type="press_release",
            evidence_text="Vorstand führt Gespräche mit Banken."
        )
        ev.reality_check["human_review"] = {
            "reviewed": True,
            "reviewed_at": datetime.now(timezone.utc).isoformat(),
            "reviewer_decision": "MANDAT_PLAUSIBEL",
            "reviewer_notes": "Aufsichtsratsvorsitzender signalisiert externen CRO-Bedarf im Interview.",
            "confirmed": True
        }

        # Re-evaluate
        new_rc = MandateRealityCheckEngine.evaluate(ev.to_dict(), previous_check=ev.reality_check)
        self.assertTrue(new_rc["human_review"]["reviewed"])
        self.assertEqual(new_rc["human_review"]["reviewer_decision"], "MANDAT_PLAUSIBEL")
        self.assertIn("CRO-Bedarf", new_rc["human_review"]["reviewer_notes"])

    def test_deag_leadership_change_future_start_date_verwerfen(self):
        """DEAG-Fall: Fest benannter Nachfolger mit künftigem Amtsantritt führt zu VERWERFEN, nicht Interim-Bedarf."""
        ev = TriggerEvent(
            company_name="DEAG Deutsche Entertainment AG",
            country="DE",
            category="c_level_vakanz",
            description="DEAG: Markus Breitenecker wird zum 01. November 2026 neuer CEO",
            source_url="https://www.anleihen-finder.de/deag-markus-breitenecker-wird-zum-01-november-2026-neuer-ceo-00073962.html",
            source_type="ad_hoc",
            evidence_text="Staffelübergabe bei DEAG: Markus Breitenecker übernimmt Vorstandsvorsitz von Detlef Kornett zum 01. November 2026."
        )
        rc = ev.reality_check
        self.assertEqual(rc["status"], CLASS_VERWERFEN)
        self.assertEqual(rc["target_role"], "KEINE")
        self.assertEqual(rc["target_role_label"], "Keine externe Organfunktion ableitbar")
        self.assertTrue(any("fest neu besetzt" in ci for ci in rc["counter_indicators"]))
        
        prio, action = ev.determine_mandate_priority()
        self.assertEqual(prio, "watchlist_general_distress")
        self.assertEqual(action, "passiv_nachfolge_besetzt")

    def test_pferdewetten_and_photon_energy_rejection(self):
        """pferdewetten.de und Photon Energy: Neue CFOs bereits ernannt -> VERWERFEN, KEINE, passiv_nachfolge_besetzt."""
        for cname, title, snippet in [
            ("pferdewetten.de AG", "pferdewetten.de AG: Frank Hartmann wird neuer CFO", "Frank Hartmann wird neuer CFO der pferdewetten.de AG."),
            ("Photon Energy Group", "Photon Energy Group: Andrej Horansky ist neuer CFO", "Photon Energy Group beruft Andrej Horansky zum neuen CFO.")
        ]:
            ev = TriggerEvent(
                company_name=cname,
                country="DE",
                category="c_level_vakanz",
                description=title,
                source_url="https://www.anleihen-finder.de/sample-news",
                source_type="press_release",
                evidence_text=snippet
            )
            rc = ev.reality_check
            self.assertEqual(rc["status"], CLASS_VERWERFEN, f"Failed on {cname}")
            self.assertEqual(rc["target_role"], "KEINE", f"Target role must be KEINE for {cname}")
            prio, action = ev.determine_mandate_priority()
            self.assertEqual(prio, "watchlist_general_distress", f"Priority must be watchlist for {cname}")
            self.assertEqual(action, "passiv_nachfolge_besetzt", f"Action must be passiv_nachfolge_besetzt for {cname}")

    def test_verwerfen_target_role_is_strictly_keine(self):
        """Alle verworfenen Ereignisse müssen zwingend target_role='KEINE' ausweisen."""
        ev = TriggerEvent(
            company_name="Solved Precision GmbH",
            country="DE",
            category="unternehmenskrise_restrukturierung",
            description="Investorenprozess erfolgreich abgeschlossen",
            source_url="https://sample.de/inso-solved",
            source_type="press_release",
            evidence_text="Übernahme vollzogen, Betrieb gerettet."
        )
        rc = ev.reality_check
        self.assertEqual(rc["status"], CLASS_VERWERFEN)
        self.assertEqual(rc["target_role"], "KEINE")

    def test_restructuring_advisor_counter_indicator_and_downgrade(self):
        """Sachwalter / Sanierungsberater bereits benannt -> BEOBACHTEN, KEINE, passiv_berater_benannt."""
        ev = TriggerEvent(
            company_name="Wohnstift Innblick GmbH",
            country="DE",
            category="insolvenzantrag_eigenverwaltung",
            description="Wohnstift Innblick saniert sich in Eigenverwaltung",
            source_url="https://www.anchor.eu/wohnstift-innblick",
            source_type="law_firm_press",
            evidence_text="Zum vorläufigen Sachwalter wurde Rechtsanwalt Dr. Julian Hageböke bestellt. Die Anchor-Sanierungsexperten begleiten das Verfahren.",
            published_at="2026-10-26T10:00:00+00:00"
        )
        rc = ev.reality_check
        self.assertEqual(rc["status"], CLASS_BEOBACHTEN)
        self.assertEqual(rc["target_role"], "KEINE")
        self.assertTrue(ev.is_advisor_mandated)
        self.assertTrue(any("Sanierungsführung / Berater / Sachwalter" in ci for ci in rc["counter_indicators"]))
        self.assertEqual(ev.mandate_priority, "watchlist_general_distress")
        self.assertEqual(ev.action_type, "passiv_berater_benannt")

    def test_archive_scoring_older_than_30_days(self):
        """Signal älter als 30 Tage (z.B. ABO Energy August 2026) -> ARCHIVE, BEOBACHTEN, KEINE, passiv_archiv_aelter_30d."""
        ev = TriggerEvent(
            company_name="ABO Energy GmbH & Co. KGaA",
            country="DE",
            category="finanzierung_anleihen_restrukturierung",
            description="ABO Energy: Stillhaltevereinbarung mit Finanzierungspartnern bis 30.11.2026 verlängert",
            source_url="https://www.anleihen-finder.de/abo-energy-stillhaltevereinbarung",
            source_type="ad_hoc",
            evidence_text="Adhoc-Mitteilung: Stillhaltevereinbarung verlängert und Restrukturierungskonzept fortgesetzt.",
            published_at="2026-08-01T06:50:47+00:00"
        )
        rc = ev.reality_check
        self.assertEqual(ev.freshness_category, "ARCHIVE")
        self.assertGreater(ev.age_days, 30.0)
        self.assertEqual(rc["status"], CLASS_BEOBACHTEN)
        self.assertEqual(rc["target_role"], "KEINE")
        self.assertTrue(any("über 30 Tage zurück" in ci for ci in rc["counter_indicators"]))
        self.assertEqual(ev.mandate_priority, "watchlist_general_distress")
        self.assertEqual(ev.action_type, "passiv_archiv_aelter_30d")

    def test_hot_first_mover_scoring_within_7_days(self):
        """Frische Meldung der letzten Tage (< 7 Tage) ohne Berater -> HOT_FIRST_MOVER, MANDAT_PLAUSIBEL."""
        ev = TriggerEvent(
            company_name="PAUL Tech AG",
            country="DE",
            category="finanzierung_anleihen_restrukturierung",
            description="Einladung zur Abstimmung ohne Versammlung nach SchVG für Anleihe 2020/2025",
            source_url="https://www.eqs-news.com/paul-tech-abstimmung",
            source_type="ad_hoc",
            evidence_text="Die PAUL Tech AG lädt die Anleihegläubiger zu einer Abstimmung ohne Versammlung ein. Stillhalteabkommen vereinbart.",
            published_at="2026-10-27T12:00:00+00:00"
        )
        rc = ev.reality_check
        self.assertEqual(ev.freshness_category, "HOT_FIRST_MOVER")
        self.assertLessEqual(ev.age_days, 7.0)
        self.assertEqual(rc["status"], CLASS_MANDAT_PLAUSIBEL)
        self.assertEqual(rc["target_role"], "INTERIM_CFO")
        self.assertEqual(ev.mandate_priority, "high_priority_action_required")

if __name__ == "__main__":
    unittest.main()
