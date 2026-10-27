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

# Zielfunktionen
ROLES = {
    "CRO": "Chief Restructuring Officer (CRO / Sanierungsvorstand)",
    "INTERIM_CFO": "Interim-CFO (Refinanzierung, SchVG-Verhandlung, Liquidität)",
    "INTERIM_CEO": "Interim-CEO (Vorstandsvorsitzender ad interim)",
    "INTERIM_COO": "Interim-COO (Werks- & Operations-Sanierung)",
    "PMI_LEAD": "PMI-Leitung (Post-Merger-Integration / Carve-Out)",
    "TRANSFORMATION": "Transformations- / Restrukturierungsleitung",
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
        # KRITERIUM B: Tatsächlicher Handlungsdruck
        # =====================================================================
        # Gegenindikatoren für gelöste oder abgeschlossene Situationen
        is_solved = any(k in combined_text for k in [
            "investorenprozess erfolgreich abgeschlossen",
            "übernahme vollzogen",
            "geschäftsbetrieb übernommen",
            "übernimmt geschäftsbetrieb",
            "fortführung gesichert",
            "zukunft gesichert",
            "zukunftslösung",
            "veräußert an",
            "veräussert an",
            "erfolgreichen abschluss",
            "fertiggestellt"
        ])

        # Prüfen, ob Führungsposition bereits fest neu besetzt wurde
        is_already_staffed = any(k in combined_text for k in [
            "wird neuer cfo",
            "ist neuer cfo",
            "tritt cfo-amt an",
            "wird neuer ceo",
            "zum neuen ceo bestellt",
            "wird zum neuen ceo",
            "neuer vorstandsvorsitzender bestellt"
        ])

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

        # =====================================================================
        # KRITERIUM C: Externe Mandatsfähigkeit & Zielfunktion
        # =====================================================================
        target_role = "KEINE"
        mandate_feasibility = "ausgeschlossen"

        if is_eigenverwaltung:
            target_role = "CRO"
            mandate_feasibility = "plausibel"
        elif is_schvg_debt:
            target_role = "INTERIM_CFO"
            mandate_feasibility = "plausibel"
        elif is_c_level_vacant:
            if "cfo" in combined_text or "finanz" in combined_text:
                target_role = "INTERIM_CFO"
            else:
                target_role = "INTERIM_CEO"
            mandate_feasibility = "plausibel"
        elif "post-merger" in combined_text or "carve-out" in combined_text:
            target_role = "PMI_LEAD"
            mandate_feasibility = "plausibel"
        elif category in ("unternehmenskrise_restrukturierung", "transformation_sanierung"):
            target_role = "TRANSFORMATION"
            mandate_feasibility = "plausibel" if not is_solved and not is_regular_insolvency else "unwahrscheinlich"

        # =====================================================================
        # KRITERIUM D: Konkrete Mandatschance (Synthese in die 4 Klassen)
        # =====================================================================
        # 1. Belegtes Mandat (Konkrete externe Suche oder Ausschreibung durch Quelle belegt)
        has_explicit_mandate_proof = any(k in combined_text for k in [
            "sucht externen interim", "sucht interim cro", "sucht interim cfo",
            "mandatierte personalberatung mit suche", "interim management mandatiert",
            "ad-interim leitung ausgeschrieben"
        ])

        # Listen für Begründung
        missing_information = []
        counter_indicators = []

        if has_explicit_mandate_proof:
            status = CLASS_MANDAT_BELEGT
            rationale = "Externe Mandatssuche oder Vergabe ist durch die Primärquelle ausdrücklich belegt."
        elif is_solved:
            status = CLASS_VERWERFEN
            counter_indicators.append("Sanierung oder Investorenprozess bereits erfolgreich abgeschlossen bzw. Betrieb vollständig übernommen.")
            rationale = f"Problem ist durch vollzogene Transaktion oder Sanierungslösung bereits gelöst. Kein offener externer Restrukturierungsbedarf für {company}."
        elif is_already_staffed:
            status = CLASS_VERWERFEN
            counter_indicators.append("Führungsposition wurde in der Meldung bereits fest neu besetzt.")
            rationale = f"Die gemeldete Führungsposition bei {company} ist nicht mehr vakant, sondern wurde personell bereits nachbesetzt."
        elif "auftrag" in combined_text and not any(k in combined_text for k in ["krise", "sanierung", "restrukturierung", "insolvenz"]):
            status = CLASS_VERWERFEN
            counter_indicators.append("Reine operative Auftrags- oder Produktmeldung ohne Krisen- oder Vakanzdruck.")
            rationale = f"Meldung betrifft das reguläre operative Auftragsgeschäft ({company}). Kein Mandatspotenzial."
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
        elif is_c_level_vacant:
            status = CLASS_MANDAT_PLAUSIBEL
            missing_information.append("Interne Nachfolgelösung oder Interimsüberbrückung durch Aufsichtsrat nicht ausgeschlossen.")
            missing_information.append("Kein Beleg für Beauftragung eines Executive-Search- oder Interim-Providers.")
            rationale = f"Akute Organvakanz auf C-Level bei {company}. Externe Überbrückung durch {ROLES.get(target_role)} plausibel, tatsächliche externe Suche noch nicht belegt."
        else:
            status = CLASS_BEOBACHTEN
            missing_information.append("Sachverhalt indiziert Sondersituation, reicht aber für eine spezifische Mandatshypothese nicht aus.")
            rationale = f"Relevantes Marktsignal, das jedoch zunächst weiter beobachtet werden muss."

        # Wenn der Status nicht plausibel oder belegt ist, Rolle auf KEINE setzen
        if status in (CLASS_BEOBACHTEN, CLASS_VERWERFEN) and not is_regular_insolvency:
            if not is_solved and not is_already_staffed:
                target_role = "KEINE"

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
            "target_role": target_role,
            "target_role_label": ROLES.get(target_role, target_role),
            "facts_proven": facts_proven,
            "source_proof": source_url,
            "source_date": pub_at or event_date,
            "mandate_hypothesis": mandate_hypothesis,
            "missing_information": missing_information,
            "counter_indicators": counter_indicators,
            "rationale": rationale,
            "checked_at": now_iso,
            "criteria_eval": {
                "event_validity": validity_status,
                "action_pressure": "akut" if (is_eigenverwaltung or is_schvg_debt or is_c_level_vacant) else ("geloest" if is_solved else "mittel"),
                "mandate_feasibility": mandate_feasibility,
                "concrete_mandate_proof": "belegt" if has_explicit_mandate_proof else "nicht_belegt"
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
