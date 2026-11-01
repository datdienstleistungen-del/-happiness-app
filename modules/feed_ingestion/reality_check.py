"""
NeXus HIT - Mandate Reality Check Engine
Verbindliches Korrektiv zur systematischen Validierung von Trigger-Events:
Prüft nach der Ereigniserkennung und vor der Priorisierung, ob ein reales
externes Interim-Management-, CRO-, CFO- oder Transformationsmandat entstehen könnte.

Grundsatz:
Ein belegtes Ereignis ist noch kein belegter Mandatsbedarf.
Ein plausibler Mandatsbedarf ist noch kein verfügbares Mandat.
Die menschliche Entscheidung ist die abschließende Freigabe (Human-in-the-Loop).
"""

import re
from datetime import datetime, timezone

# Die vier verbindlichen, streng getrennten Klassen
CLASS_MANDAT_BELEGT = "MANDAT_BELEGT"
CLASS_MANDAT_PLAUSIBEL = "MANDAT_PLAUSIBEL"
CLASS_BEOBACHTEN = "BEOBACHTEN"
CLASS_VERWERFEN = "VERWERFEN"

VALID_REALITY_CHECK_CLASSES = {
    CLASS_MANDAT_BELEGT,
    CLASS_MANDAT_PLAUSIBEL,
    CLASS_BEOBACHTEN,
    CLASS_VERWERFEN
}

REALITY_CHECK_LABELS = {
    CLASS_MANDAT_BELEGT: "Mandat belegt (Externe Suche / Vergabe nachgewiesen)",
    CLASS_MANDAT_PLAUSIBEL: "Mandat plausibel (Bedarf plausibel, Suche unbestätigt)",
    CLASS_BEOBACHTEN: "Beobachten (Frühes / generelles Signal auf Watchlist)",
    CLASS_VERWERFEN: "Verwerfen (Gelöst / Abgeschlossen / Ungeeignet)"
}

# ── DREI VERBINDLICHE QUALIFIZIERUNGSSTUFEN ──
STAGE_1_VERIFIED_EVENT = "STUFE 1 – VERIFIZIERTES EREIGNIS"
STAGE_2_PLAUSIBLE_CHANCE = "STUFE 2 – PLAUSIBLE MANDATSCHANCE"
STAGE_3_CONFIRMED_NEED = "STUFE 3 – BESTÄTIGTER MANDATSBEDARF"
STAGE_DISCARDED = "VERWORFEN"

VALID_STAGES = {
    STAGE_1_VERIFIED_EVENT,
    STAGE_2_PLAUSIBLE_CHANCE,
    STAGE_3_CONFIRMED_NEED,
    STAGE_DISCARDED
}

STAGE_LABELS = {
    STAGE_1_VERIFIED_EVENT: "Stufe 1 – Verifiziertes Ereignis (Unternehmensereignis belegt, Mandatsbedarf unklar)",
    STAGE_2_PLAUSIBLE_CHANCE: "Stufe 2 – Plausible Mandatschance (Konkreter Handlungsdruck, Suche unbestätigt)",
    STAGE_3_CONFIRMED_NEED: "Stufe 3 – Bestätigter Mandatsbedarf (Konkrete externe Suche / Ausschreibung nachgewiesen)",
    STAGE_DISCARDED: "Verworfen (Gelöst / Nachfolge besetzt / Routine)"
}

# Freshness-Klassen für den kommerziellen Vertrieb an Interim-Provider
FRESHNESS_HOT = "HOT_FIRST_MOVER"
FRESHNESS_MONITORING = "MONITORING"
FRESHNESS_ARCHIVE = "ARCHIVE"

VALID_FRESHNESS_CLASSES = {
    FRESHNESS_HOT,
    FRESHNESS_MONITORING,
    FRESHNESS_ARCHIVE
}

FRESHNESS_LABELS = {
    FRESHNESS_HOT: "🔥 HOT / FIRST-MOVER (< 7 Tage)",
    FRESHNESS_MONITORING: "⏳ MONITORING (7–30 Tage)",
    FRESHNESS_ARCHIVE: "📁 ARCHIV (> 30 Tage)"
}

ADVISOR_PATTERNS = [
    r'sanierungsgeschäftsführer(?:\s+bestellt|\s+berufen)?',
    r'sachwalter(?:\s+bestellt|\s+eingesetzt|\s+wurde)?',
    r'restrukturierungsberater\s+mandatiert',
    r'eigenverwaltung\s+unter\s+führung\s+von',
    r'generalbevollmächtigte[rn]?',
    r'sanierungsexperte\s+.*?\b(?:bestellt|berufen|begleitet|als)',
    r'(?:kanzlei|sozietät|rechtsanwalt|ra|dr\.)\s+.*?\b(?:als\s+sanierungsgeschäftsführer|sachwalter|generalbevollmächtigter)',
    r'mandatierte\s+(?:kanzlei|beratung)',
    r'begleitet\s+von\s+.*?\b(?:kanzlei|beratung|sanierungsexperten|rechtsanwält)',
    r'unter\s+führung\s+von\s+.*?\b(?:kanzlei|sanierungsberater|rechtsanwalt)'
]

# ── ORGANBEDARF UND OPERATIVER MANAGEMENTBEDARF (7 ZIELFUNKTIONEN) ──
ROLES = {
    "CRO_ORGAN": "CRO / Sanierungsvorstand",
    "CRO_INTERIM": "CRO / Interim-Management",
    "CEO_ORGAN": "CEO / Geschäftsführer",
    "CFO_FINANCE": "CFO / Finanzrestrukturierung",
    "COO_OPS": "COO / operative Transformation",
    "BOARD_MEMBER": "Verwaltungsrat / Aufsichtsrat",
    "C_LEVEL_OTHER": "Sonstige C-Level-Funktionen",
    # Abwärtskompatible Aliase
    "CRO": "CRO / Interim-Management",
    "INTERIM_CFO": "CFO / Finanzrestrukturierung",
    "INTERIM_CEO": "CEO / Geschäftsführer",
    "INTERIM_COO": "COO / operative Transformation",
    "BOARD": "Verwaltungsrat / Aufsichtsrat",
    "PMI_LEAD": "COO / operative Transformation",
    "TRANSFORMATION": "COO / operative Transformation",
    "KEINE": "Keine externe Organfunktion ableitbar"
}

class MandateRealityCheckEngine:
    """
    Führt die 4 Prüfschritte durch:
    A. Ereignisvalidität
    B. Tatsächlicher Handlungsdruck
    C. Externe Mandatsfähigkeit
    D. Konkrete Mandatschance
    """

    @classmethod
    def evaluate(cls, event_data, previous_check=None):
        """
        Führt den vollständigen Reality Check für ein TriggerEvent durch.
        event_data kann ein TriggerEvent-Objekt oder ein Dict sein.
        """
        if hasattr(event_data, "to_dict"):
            d = event_data.to_dict()
        else:
            d = dict(event_data)

        company = (d.get("company_name") or "").strip()
        category = (d.get("category") or "").strip()
        description = (d.get("description") or "").strip()
        evidence_text = (d.get("evidence_text") or "").strip()
        source_url = (d.get("source_url") or "").strip()
        pub_at = d.get("published_at")
        event_date = d.get("event_date")

        combined_text = f"{company} {category} {description} {evidence_text}".lower()

        # =====================================================================
        # KRITERIUM A: Ereignisvalidität
        # =====================================================================
        has_source = bool(source_url and source_url.startswith("http"))
        has_dates = bool(pub_at or event_date)
        is_substantive = len(evidence_text) >= 15 or len(description) >= 15

        validity_status = "bestaetigt" if (has_source and has_dates and is_substantive) else "zweifelhaft"

        # =====================================================================
        # KRITERIUM B: Tatsächlicher Handlungsdruck & Frische-Scoring
        # =====================================================================
        # Freshness / Alters-Scoring auf Basis des Original-Publikationsdatums
        reference_date_str = pub_at or event_date or d.get("captured_at")
        age_days = None
        if reference_date_str:
            try:
                clean_dt_str = str(reference_date_str).replace("Z", "+00:00")
                dt = datetime.fromisoformat(clean_dt_str)
                if dt.tzinfo is None:
                    dt = dt.replace(tzinfo=timezone.utc)
                age_days = max(0.0, round((datetime.now(timezone.utc) - dt).total_seconds() / 86400.0, 1))
            except Exception:
                age_days = None

        if age_days is not None:
            if age_days <= 7.0:
                freshness_category = FRESHNESS_HOT
            elif age_days <= 30.0:
                freshness_category = FRESHNESS_MONITORING
            else:
                freshness_category = FRESHNESS_ARCHIVE
        else:
            freshness_category = FRESHNESS_HOT

        freshness_label = FRESHNESS_LABELS.get(freshness_category, freshness_category)

        # Volltext-Prüfung auf bereits mandatierte Sanierungsberater / Sachwalter
        is_advisor_mandated = any(re.search(pat, combined_text, re.IGNORECASE) for pat in ADVISOR_PATTERNS)

        # Gegenindikatoren für gelöste oder abgeschlossene Situationen
        is_solved = any(k in combined_text for k in [
            "investorenprozess erfolgreich abgeschlossen",
            "übernahme vollzogen", "uebernahme vollzogen",
            "geschäftsbetrieb übernommen", "geschaeftsbetrieb uebernommen",
            "übernimmt geschäftsbetrieb", "uebernimmt geschaeftsbetrieb",
            "fortführung gesichert", "fortfuehrung gesichert",
            "zukunft gesichert",
            "zukunftslösung", "zukunftsloesung",
            "veräußert an", "veräussert an", "veraeussert an", "veraeußert an",
            "erfolgreichen abschluss",
            "fertiggestellt"
        ])

        # Prüfen, ob Führungsposition bereits fest neu besetzt wurde (auch bei künftigem Amtsantritt)
        staffed_patterns = [
            r'(?:wird|ist|berufen|bestellt|ernannt)\s+(?:zum|ab|per)?\s*.*?\bneue[rn]?\s+(?:ceo|cfo|cro|coo|vorstandsvorsitzende[rn]?|geschäftsführer(?:in)?|vorstand)\b',
            r'\b(?:übernimmt|antritt|nachfolge)\b.*?\b(?:vorstandsvorsitz|geschäftsführung|leitung|nachfolge|cfo|ceo)\b',
            r'\bstaffelübergabe\b',
            r'\b(?:nachfolge|nachfolger(?:in)?)\b.*?\b(?:geregelt|benannt|bestellt|geklärt|gesichert)\b',
            r'\bappointment\s+of\b.*?\bas\s+(?:new\s+)?(?:ceo|cfo|cro)\b',
            r'\bnamed\s+(?:as\s+)?(?:new\s+)?(?:ceo|cfo|cro)\b',
            r'wird\s+neue[rn]?\s+cfo',
            r'ist\s+neue[rn]?\s+cfo',
            r'tritt\s+cfo-amt\s+an',
            r'wird\s+neue[rn]?\s+ceo',
            r'ist\s+neue[rn]?\s+ceo',
            r'zum\s+neuen\s+ceo\s+bestellt',
            r'neuer\s+vorstandsvorsitzender\s+bestellt'
        ]
        is_already_staffed = any(re.search(pat, combined_text, re.IGNORECASE) for pat in staffed_patterns)

        # Fremdverwaltung / Regelinsolvenz (Organe entmachtet)
        is_regular_insolvency = (
            any(k in combined_text for k in [
                "vorläufigen insolvenzverwalter bestellt",
                "insolvenzverwalter bestellt",
                "regelinsolvenz",
                "insolvenzverfahren eröffnet",
                "stellt insolvenzantrag",
                "insolvenzantrag gestellt"
            ]) and
            "eigenverwaltung" not in combined_text and
            "schutzschirm" not in combined_text
        )

        # Akuter Handlungsdruck vorhanden?
        is_eigenverwaltung = (
            any(k in combined_text for k in ["eigenverwaltung", "schutzschirm", "starug", "sanierungsgeschäftsführer"]) or
            category == "insolvenzantrag_eigenverwaltung"
        )
        is_schvg_debt = (
            category == "finanzierung_anleihen_restrukturierung" or
            any(k in combined_text for k in [
                "stillhaltevereinbarung", "stillhalteabkommen", "standstill",
                "gläubigerabstimmung", "gläubigerversammlung", "abstimmung ohne versammlung",
                "covenant breach", "restrukturierungskonzept", "anleihebedingungen"
            ])
        )
        is_c_level_vacant = (
            (category in ("c_level_vakanz", "organ_vakanz") or
             any(k in combined_text for k in ["amtsniederlegung", "rücktritt per sofort", "abberufen", "vorstand scheidet aus", "organ-vakuum"])) and
            not is_already_staffed
        )

        # ── ORGANVAKUUM-PRÜFUNG (ANFORDERUNG 1) ──
        # Ein Restrukturierungsereignis, eine Eigenverwaltung oder ein Insolvenzverfahren
        # begründet allein noch kein Organvakuum.
        # Ein Organvakuum darf nur als BESTANDEN ausgewiesen werden, wenn konkrete Belege vorliegen für:
        # - Ausscheiden eines Geschäftsführers oder Vorstandsmitglieds ohne geregelte Nachfolge.
        # - Vakante Organposition.
        # - Dokumentierte Suche nach einer neuen Organbesetzung.
        # - Sonstige nachweisbare Führungslücke auf Organebene.
        # Fehlen solche Belege, lautet das Ergebnis: NICHT NACHGEWIESEN.
        organ_exit_patterns = [
            r'\b(?:nicht mehr|ausgeschieden als|abberufen als|scheidet als)\s+(?:geschäftsführer(?:in)?|vorstand|vorstandsmitglied|verwaltungsrat[a-z]*|vr-mitglied|ceo|cfo|cro|coo|director|board)\b',
            r'\b(?:vorstand|geschäftsführer|verwaltungsrat[a-z]*|vr-mitglied|ceo|cfo|cro|coo|director|board member)(?:\s+[a-zäöüß\.\-]+){0,4}\s+(?:scheidet aus|legt amt nieder|tritt zurück|verlässt das unternehmen|wurde abberufen|stepped down)\b',
            r'\b(?:tritt per sofort zurück|tritt mit sofortiger wirkung zurück|scheidet per sofort aus|scheidet mit sofortiger wirkung aus)\b',
            r'\b(?:scheidet|ausgeschieden)\s+(?:aus\s+dem\s+vorstand|aus\s+der\s+geschäftsführung|aus\s+der\s+geschäftsleitung)\b',
            r'\b(?:vorstandsmandat|geschäftsführungsmandat|verwaltungsratsmandat)\s+erloschen\b',
            r'\berloschene unterschriften\b.*?\b(?:geschäftsführer|vorstand|verwaltungsrat[a-z]*|direktor)\b',
            r'\bausgeschiedene personen\b.*?\b(?:geschäftsführer|vorstand|verwaltungsrat[a-z]*|direktor)\b',
            r'\bamtsniederlegung\s+(?:des|der)?\s*(?:vorstand|geschäftsführ|verwaltungsrat[a-z]*|ceo|cfo)\b',
            r'\brücktritt\s+(?:per sofort|mit sofortiger wirkung)\b',
            r'\bausscheiden\s+(?:eines|einer)?\s*(?:mitglieds|vorstands|geschäftsführers|verwaltungsrats|mitgliedes)\b',
            r'\bstepped down\b.*?\b(?:board|director|executive|vacancy)\b',
            r'\bunstaffed organ vacancy\b',
            r'\b(?:vakante|offene|unbesetzte)\s+(?:organposition|vorstandsposition|geschäftsführerposition|führungsposition auf organebene)\b',
            r'\b(?:führungsvakuum|organ-?vakuum)\b',
            r'\bsucht\s+(?:neue[rn]?|nachfolge für)\s+(?:vorstand|geschäftsführer|ceo|cfo|cro|verwaltungsrat[a-z]*)\b',
            r'\b(?:suche nach|ausschreibung)\s+.*?\b(?:organbesetzung|vorstandsnachfolge|geschäftsführungsnachfolge)\b'
        ]
        has_proven_organ_exit = any(re.search(pat, combined_text, re.IGNORECASE) for pat in organ_exit_patterns) and not is_already_staffed

        if has_proven_organ_exit:
            organ_vacuum_status = "BESTANDEN"
            organ_vacuum_details = "BESTANDEN: Reale Organvakanz / Ausscheiden von Organmitgliedern ohne geregelte Nachfolge belegt."
        else:
            organ_vacuum_status = "NICHT NACHGEWIESEN"
            if is_eigenverwaltung:
                organ_vacuum_details = "NICHT NACHGEWIESEN: Geschäftsführung führt den Betrieb in Eigenverwaltung fort; Eigenverwaltung begründet allein kein Organvakuum."
            elif is_schvg_debt:
                organ_vacuum_details = "NICHT NACHGEWIESEN: SchVG-Gläubigerabstimmung betrifft Anleihe-Restrukturierung; kein Organausscheiden belegt."
            elif is_regular_insolvency:
                organ_vacuum_details = "NICHT NACHGEWIESEN: Regelinsolvenz mit Fremdverwaltung (Insolvenzverwalter bestellt; kein C-Level-Organvakuum im Sinne einer Interimssuche)."
            else:
                organ_vacuum_details = "NICHT NACHGEWIESEN: Keine konkreten Belege für ein Organausscheiden oder eine vakante Organposition vorhanden."

        # =====================================================================
        # KRITERIUM C: Externe Mandatsfähigkeit & Zielfunktion
        # Zwingende Differenzierung der 7 Rollenkategorien (Anforderung 3):
        # - CRO / Sanierungsvorstand
        # - CRO / Interim-Management
        # - CEO / Geschäftsführer
        # - CFO / Finanzrestrukturierung
        # - COO / operative Transformation
        # - Verwaltungsrat / Aufsichtsrat
        # - Sonstige C-Level-Funktionen
        # (Ein Verwaltungsratsvakuum darf nicht automatisch als CRO-Bedarf klassifiziert werden!)
        # =====================================================================
        target_role = "KEINE"
        mandate_feasibility = "ausgeschlossen"

        # Prüfe Schweizer Verwaltungsrats-Vakanz:
        # Nur wenn tatsächlich das Organ des Verwaltungsrats / Aufsichtsrats vakant ist,
        # und NICHT wenn der Verwaltungsrat lediglich den Rücktritt eines CEOs oder CFOs verkündet.
        is_swiss_board = (
            (
                "vr-präsident" in combined_text or "vr-mitglied" in combined_text or
                "mitglied des verwaltungsrat" in combined_text or "verwaltungsratsmitglied" in combined_text or
                "board director" in combined_text or
                (category == "c_level_vakanz_ch" and not any(k in combined_text for k in ["ceo", "cfo", "cro", "coo", "geschäftsführer"])) or
                (("verwaltungsrat" in combined_text or "aufsichtsrat" in combined_text) and not any(k in combined_text for k in ["ceo", "cfo", "cro", "coo", "geschäftsführer", "eigenverwaltung"]))
            ) and
            not any(k in combined_text for k in ["eigenverwaltung", "starug", "cro", "sanierungsgeschäftsführer"])
        )

        # Operative Transformation (Werksschließung, Standortverlagerung, Carve-Out)
        is_ops_transformation = (
            any(k in combined_text for k in [
                "werksschließung", "werksschliessung", "standortschließung", "standortschliessung",
                "betriebsschließung", "betriebsschliessung", "produktionsverlagerung", "betriebsverlagerung",
                "carve-out", "post-merger integration", "post-merger"
            ]) and not is_solved and not is_regular_insolvency and not is_advisor_mandated
        )

        # 1. Belegtes Mandat (Konkrete externe Suche oder Ausschreibung durch Quelle belegt)
        has_explicit_mandate_proof = any(k in combined_text for k in [
            "sucht externen interim", "sucht interim cro", "sucht interim cfo",
            "mandatierte personalberatung mit suche", "interim management mandatiert",
            "ad-interim leitung ausgeschrieben"
        ])

        if has_explicit_mandate_proof:
            if "cro" in combined_text or "sanierung" in combined_text or "restrukturierung" in combined_text:
                target_role = "CRO_ORGAN" if (has_proven_organ_exit and "gmbh" not in combined_text.lower()) else "CRO_INTERIM"
            elif "cfo" in combined_text or "finanz" in combined_text:
                target_role = "INTERIM_CFO"
            elif "coo" in combined_text or "betrieb" in combined_text:
                target_role = "INTERIM_COO"
            elif "ceo" in combined_text or "geschäftsführer" in combined_text:
                target_role = "INTERIM_CEO"
            elif "verwaltungsrat" in combined_text or "aufsichtsrat" in combined_text:
                target_role = "BOARD_MEMBER"
            else:
                target_role = "CRO_INTERIM"
            mandate_feasibility = "belegt"
        elif is_eigenverwaltung and not is_advisor_mandated:
            target_role = "CRO_ORGAN" if (has_proven_organ_exit and "gmbh" not in combined_text.lower()) else "CRO_INTERIM"
            mandate_feasibility = "plausibel"
        elif is_schvg_debt:
            target_role = "INTERIM_CFO"  # CFO / Finanzrestrukturierung
            mandate_feasibility = "plausibel"
        elif is_c_level_vacant or has_proven_organ_exit:
            if "ceo" in combined_text or "geschäftsführer" in combined_text or "vorstandsvorsitz" in combined_text:
                target_role = "INTERIM_CEO"
            elif "cfo" in combined_text or "finanz" in combined_text:
                target_role = "INTERIM_CFO"
            elif "coo" in combined_text or "betrieb" in combined_text or "produktion" in combined_text or "werk" in combined_text:
                target_role = "INTERIM_COO"
            elif "cro" in combined_text or "sanierung" in combined_text or "restrukturierung" in combined_text:
                target_role = "CRO_ORGAN" if (has_proven_organ_exit and "gmbh" not in combined_text.lower()) else "CRO_INTERIM"
            elif "verwaltungsrat" in combined_text or "aufsichtsrat" in combined_text or is_swiss_board:
                target_role = "BOARD_MEMBER"
            else:
                target_role = "INTERIM_CEO"
            mandate_feasibility = "plausibel"
        elif is_swiss_board:
            target_role = "BOARD_MEMBER"  # Verwaltungsrat / Aufsichtsrat
            mandate_feasibility = "plausibel"
        elif is_ops_transformation:
            target_role = "COO_OPS"
            mandate_feasibility = "plausibel"
        elif "post-merger" in combined_text or "carve-out" in combined_text:
            target_role = "COO_OPS" if "operations" in combined_text else "PMI_LEAD"
            mandate_feasibility = "plausibel"
        elif category in ("unternehmenskrise_restrukturierung", "transformation_sanierung"):
            target_role = "TRANSFORMATION"
            mandate_feasibility = "plausibel" if not is_solved and not is_regular_insolvency and not is_advisor_mandated else "unwahrscheinlich"

        # =====================================================================
        # KRITERIUM D: Konkrete Mandatschance (Synthese in die 4 Klassen)
        # =====================================================================

        # Listen für Begründung
        missing_information = []
        counter_indicators = []

        # Gegenindikatoren systematisch registrieren
        if is_advisor_mandated:
            counter_indicators.append("Sanierungsführung / Berater / Sachwalter in der Primärquelle bereits benannt. Kein offenes First-Mover-Mandat.")
        if freshness_category == FRESHNESS_ARCHIVE:
            counter_indicators.append(f"Meldung liegt über 30 Tage zurück ({int(age_days) if age_days is not None else '>30'} Tage). Akutes First-Mover-Mandatsfenster geschlossen; Fall im Archiv zur Beobachtung von Folgephasen.")

        if has_explicit_mandate_proof:
            status = CLASS_MANDAT_BELEGT
            rationale = "Externe Mandatssuche oder Vergabe ist durch die Primärquelle ausdrücklich belegt."
        elif is_solved:
            status = CLASS_VERWERFEN
            counter_indicators.append("Sanierung oder Investorenprozess bereits erfolgreich abgeschlossen bzw. Betrieb vollständig übernommen.")
            rationale = f"Problem ist durch vollzogene Transaktion oder Sanierungslösung bereits gelöst. Kein offener externer Restrukturierungsbedarf für {company}."
        elif is_already_staffed:
            status = CLASS_VERWERFEN
            counter_indicators.append("Führungsposition wurde in der Meldung bereits fest neu besetzt (auch bei künftigem Amtsantritt).")
            rationale = f"Die gemeldete Führungsposition bei {company} ist personell bereits fest nachbesetzt. Kein akutes externes Interim-Mandat ableitbar."
        elif "auftrag" in combined_text and not any(k in combined_text for k in ["krise", "sanierung", "restrukturierung", "insolvenz"]):
            status = CLASS_VERWERFEN
            counter_indicators.append("Reine operative Auftrags- oder Produktmeldung ohne Krisen- oder Vakanzdruck.")
            rationale = f"Meldung betrifft das reguläre operative Auftragsgeschäft ({company}). Kein Mandatspotenzial."
        elif is_advisor_mandated:
            status = CLASS_BEOBACHTEN
            rationale = f"Sanierungsführung oder rechtlicher Berater / Sachwalter ist für {company} in der Primärquelle bereits benannt. Kein offenes First-Mover-Mandat für externe Provider; Verbleib auf Watchlist."
        elif freshness_category == FRESHNESS_ARCHIVE:
            status = CLASS_BEOBACHTEN
            rationale = f"Veröffentlichung liegt über 30 Tage zurück ({int(age_days) if age_days is not None else '>30'} Tage, Archiv/Historie). Mandate für CRO/CFO sind in dieser Phase typischerweise bereits besetzt. Kein akutes First-Mover-Mandat; Fall im Archiv."
        elif is_regular_insolvency:
            status = CLASS_BEOBACHTEN
            counter_indicators.append("Regelinsolvenz mit Fremdverwaltung: Gerichtlich bestellter Insolvenzverwalter führt das Verfahren; Organe sind entmachtet.")
            missing_information.append("Kein Hinweis auf geplante Überführung in eine Eigenverwaltung oder Beauftragung externer Organe.")
            rationale = f"Regelinsolvenz mit Fremdverwaltung. Externe Mandate durch die Alt-Organe sind rechtlich ausgeschlossen; Verwalter führt das operative Verfahren. Als Marktfall auf der Watchlist."
        elif category == "c_level_vakanz_ch" and any(k in combined_text for k in ["kollektivprokura", "prokura erloschen", "unterschrift zu zweit"]):
            status = CLASS_BEOBACHTEN
            counter_indicators.append("Mutation betrifft lediglich nachgeordnete Kollektivprokura unterhalb Organebene.")
            missing_information.append("Kein Board- oder C-Level-Vakuum belegt.")
            rationale = f"Registeränderung im Schweizer Handelsamtsblatt betrifft nachgeordnete Zeichnungsberechtigung, kein offenes C-Level-Mandat."
        elif is_eigenverwaltung:
            status = CLASS_MANDAT_PLAUSIBEL
            missing_information.append("Konkrete Ausschreibung oder externe Mandatsvergabe ist öffentlich noch nicht belegt.")
            missing_information.append("Bestehende Sanierungsberater oder CRO-Besetzung im Schutzschirmantrag noch nicht namentlich verifiziert.")
            rationale = f"Eigenverwaltung / Schutzschirm erfordert zwingend erfahrene Sanierungsführung ({ROLES.get(target_role)}), da die Geschäftsführung im Amt bleibt. Hoher plausibler Bedarf, konkrete externe Suche noch unbestätigt."
        elif is_schvg_debt:
            status = CLASS_MANDAT_PLAUSIBEL
            missing_information.append("Öffentliche Quelle belegt Gläubigerabstimmung / Stillhalteabkommen, jedoch keine externe Personalberatung.")
            missing_information.append("Unklar, ob bestehendes CFO-Team Verhandlungen führt oder Interims-Experten hinzugezogen werden.")
            rationale = f"Akuter Verhandlungsdruck mit Anleihegläubigern nach SchVG bzw. Stillhalteabkommen mit Banken. Erheblicher plausibler Bedarf an erfahrenem {ROLES.get(target_role)} für Liquiditäts- und Sanierungskonzepte."
        elif is_c_level_vacant or has_proven_organ_exit:
            status = CLASS_MANDAT_PLAUSIBEL
            missing_information.append("Interne Nachfolgelösung oder Interimsüberbrückung durch Aufsichtsrat nicht ausgeschlossen.")
            missing_information.append("Kein Beleg für Beauftragung eines Executive-Search- oder Interim-Providers.")
            rationale = f"Akute Organvakanz ({ROLES.get(target_role)}) bei {company}. Externe Überbrückung plausibel, tatsächliche externe Suche noch nicht belegt."
        elif is_ops_transformation:
            status = CLASS_MANDAT_PLAUSIBEL
            missing_information.append("Konkrete Ausschreibung oder externe Mandatsvergabe für Transformationsleitung öffentlich noch nicht belegt.")
            missing_information.append("Unbestätigt, ob operative Maßnahmen (Standortschließung / Verlagerung / Carve-Out) rein intern geführt oder durch Interims-Manager begleitet werden.")
            rationale = f"Operative Transformationsmaßnahme (Werksschließung, Standortverlagerung oder Carve-Out) bei {company}. Plausibler Bedarf an erfahrenem {ROLES.get(target_role, target_role)}, externe Suche unbestätigt."
        else:
            status = CLASS_BEOBACHTEN
            missing_information.append("Sachverhalt indiziert Sondersituation, reicht aber für eine spezifische Mandatshypothese nicht aus.")
            rationale = f"Relevantes Marktsignal, das jedoch zunächst weiter beobachtet werden muss."

        # Wenn der Status verworfen oder beobachten ist, keine fiktive Organrolle vortäuschen
        if status in (CLASS_BEOBACHTEN, CLASS_VERWERFEN):
            target_role = "KEINE"

        # ── QUALIFIZIERUNGSSTUFE BESTIMMEN (ANFORDERUNG 2 & 4) ──
        if has_explicit_mandate_proof:
            qualification_stage = STAGE_3_CONFIRMED_NEED
            stage_level = "STUFE 3"
            external_search_status = "BESTÄTIGT"
            mandate_certainty = "Bestätigt (Stufe 3)"
            professional_deduction = "Dokumentierte externe Suche oder Ausschreibung durch Primärquelle nachgewiesen."
        elif status == CLASS_MANDAT_PLAUSIBEL:
            qualification_stage = STAGE_2_PLAUSIBLE_CHANCE
            stage_level = "STUFE 2"
            external_search_status = "NICHT BESTÄTIGT"
            mandate_certainty = "Plausibel (Stufe 2)"
            if is_eigenverwaltung:
                professional_deduction = "Eigenverwaltung / Schutzschirm erfordert typischerweise erfahrene Sanierungsführung (CRO/Sanierungsbegleitung), da das Management im Amt bleibt. Externe Suche ist jedoch unbestätigt."
            elif is_schvg_debt:
                professional_deduction = "Verhandlungsdruck mit Anleihegläubigern nach SchVG erfordert Finanz- & Sanierungs-Expertise (Interim-CFO). Externe Beauftragung ist unbestätigt."
            elif is_c_level_vacant or has_proven_organ_exit:
                professional_deduction = f"Organvakanz ({ROLES.get(target_role, target_role)}) begründet akuten Überbrückungs- und Nachfolgebedarf. Externe Mandatierung noch unbestätigt."
            elif is_ops_transformation:
                professional_deduction = f"Operative Transformationsmaßnahme (Standortschließung, Produktionsverlagerung oder Carve-Out) begründet plausiblen Bedarf an {ROLES.get(target_role, target_role)}. Externe Suche unbestätigt."
            else:
                professional_deduction = f"Wirtschaftlicher Handlungsdruck begründet plausiblen externen Managementbedarf ({ROLES.get(target_role, target_role)}). Externe Suche unbestätigt."
        elif status == CLASS_BEOBACHTEN:
            qualification_stage = STAGE_1_VERIFIED_EVENT
            stage_level = "STUFE 1"
            external_search_status = "NICHT BESTÄTIGT"
            mandate_certainty = "Unbestätigt (Stufe 1)"
            professional_deduction = "Relevantes Unternehmensereignis durch Primärquelle nachgewiesen. Ein konkreter externer Mandatsbedarf ist noch nicht erkennbar (Beobachtung)."
        else: # VERWERFEN
            qualification_stage = STAGE_DISCARDED
            stage_level = "VERWORFEN"
            external_search_status = "NICHT BESTÄTIGT"
            mandate_certainty = "Ausgeschlossen"
            professional_deduction = "Ereignis begründet keinen Mandatsbedarf (bereits gelöst, nachbesetzt oder ungeeignet)."

        # Strukturierte Fakten vs. Schlussfolgerungen
        facts_proven = description or evidence_text
        mandate_hypothesis = (
            f"Bedarf an externem {ROLES.get(target_role, target_role)} plausibel abgeleitet aus: {category}. "
            f"Hinweis: Ein plausibler Bedarf ist noch kein vergebenes Mandat."
        ) if status == CLASS_MANDAT_PLAUSIBEL else (
            f"Konkretes Mandat für {ROLES.get(target_role, target_role)} durch Quelle belegt." if status == CLASS_MANDAT_BELEGT else (
                f"Beobachtungsfall auf der Watchlist; kein unmittelbarer externer Mandatsansatz." if status == CLASS_BEOBACHTEN else
                f"Kein Mandatsansatz; Ereignis verworfen (abgeschlossen, besetzt oder ungeeignet)."
            )
        )

        now_iso = datetime.now(timezone.utc).isoformat()

        # Erhalte bestehende Human-Review-Entscheidungen, falls vorhanden
        human_review = {
            "reviewed": False,
            "reviewed_at": None,
            "reviewer_decision": None,
            "reviewer_notes": "",
            "confirmed": False
        }
        if previous_check and isinstance(previous_check, dict) and previous_check.get("human_review"):
            human_review = previous_check["human_review"]

        return {
            "status": status,
            "status_label": REALITY_CHECK_LABELS.get(status, status),
            "qualification_stage": qualification_stage,
            "stage_level": stage_level,
            "stage_label": STAGE_LABELS.get(qualification_stage, qualification_stage),
            "organ_vacuum_status": organ_vacuum_status,
            "organ_vacuum_details": organ_vacuum_details,
            "external_search_status": external_search_status,
            "target_role": target_role,
            "target_role_label": ROLES.get(target_role, target_role),
            "facts_proven": facts_proven,
            "source_proof": source_url,
            "source_date": pub_at or event_date,
            "professional_deduction": professional_deduction,
            "mandate_hypothesis": mandate_hypothesis,
            "missing_information": missing_information,
            "counter_indicators": counter_indicators,
            "mandate_certainty": mandate_certainty,
            "rationale": rationale,
            "freshness_category": freshness_category,
            "freshness_label": freshness_label,
            "age_days": age_days,
            "is_advisor_mandated": is_advisor_mandated,
            "checked_at": now_iso,
            "criteria_eval": {
                "event_validity": validity_status,
                "action_pressure": "akut" if (is_eigenverwaltung or is_schvg_debt or is_c_level_vacant) and not is_advisor_mandated and freshness_category != FRESHNESS_ARCHIVE else ("geloest" if is_solved else "mittel"),
                "mandate_feasibility": mandate_feasibility,
                "concrete_mandate_proof": "belegt" if has_explicit_mandate_proof else "nicht_belegt",
                "organ_vacuum": organ_vacuum_status,
                "qualification_stage": stage_level
            },
            "human_review": human_review
        }

    @classmethod
    def reevaluate_on_follow_up(cls, current_event_dict, incoming_event_dict):
        """
        Prüft bei Eintreffen eines Folgeereignisses, ob sich die bisherige Mandatseinschätzung ändert.
        Erzeugt einen Revisions-Logeintrag für die Historie.
        """
        old_check = current_event_dict.get("reality_check") or cls.evaluate(current_event_dict)
        old_status = old_check.get("status")

        # Temporäre Vereinigung zur Neubewertung
        merged = dict(current_event_dict)
        incoming_ev = (incoming_event_dict.get("evidence_text") or "").strip()
        incoming_desc = (incoming_event_dict.get("description") or "").strip()
        merged["evidence_text"] = f"{merged.get('evidence_text', '')} | {incoming_ev}".strip()
        merged["description"] = f"{merged.get('description', '')} | {incoming_desc}".strip()

        new_check = cls.evaluate(merged, previous_check=old_check)
        new_status = new_check.get("status")

        status_changed = (old_status != new_status)
        change_entry = {
            "evaluated_at": datetime.now(timezone.utc).isoformat(),
            "previous_status": old_status,
            "new_status": new_status,
            "status_changed": status_changed,
            "incoming_evidence_snippet": incoming_ev[:200] if incoming_ev else incoming_desc[:200],
            "transition_rationale": (
                f"Statusänderung von {old_status} auf {new_status} infolge Folgemeldung: {new_check.get('rationale')}"
                if status_changed else
                f"Status {old_status} durch Folgemeldung bestätigt."
            )
        }

        return new_check, change_entry
