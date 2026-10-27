"""
NeXus Trigger Event Data Model & Provenance Schema
Defines the canonical data model for verified corporate trigger events,
enforcing strict separation between:
1. Confirmed Corporate Event (Tatsachenbeleg)
2. Interim Mandate Hypothesis (Wirtschaftliches Potenzial)
3. Event Date (Ereignisdatum) vs Publication Date (Veröffentlichungsdatum)
"""

import uuid
import hashlib
import re
from datetime import datetime, timezone

VALID_PROVENANCE_CLASSES = {
    "real_source_verified",
    "real_source_unverified",
    "synthetic_test_fixture"
}

VALID_AXIS_A = {"nachgewiesen", "plausibel", "unbestaetigt"}
VALID_AXIS_B = {"akut", "mittel", "unklar"}
VALID_AXIS_C = {"hoch", "mittel", "spekulativ", "unbekannt"}

VALID_REPORT_TYPES = {"initial_report", "follow_up", "correction"}

VALID_MANDATE_PRIORITIES = {
    "high_priority_action_required",
    "watchlist_general_distress"
}

MANDATE_PRIORITY_LABELS = {
    "high_priority_action_required": "High Priority / C-Level Action required",
    "watchlist_general_distress": "Watchlist / General Distress"
}

try:
    from modules.feed_ingestion.reality_check import (
        MandateRealityCheckEngine,
        VALID_REALITY_CHECK_CLASSES,
        REALITY_CHECK_LABELS,
        CLASS_MANDAT_BELEGT,
        CLASS_MANDAT_PLAUSIBEL,
        CLASS_BEOBACHTEN,
        CLASS_VERWERFEN
    )
except ImportError:
    from .reality_check import (
        MandateRealityCheckEngine,
        VALID_REALITY_CHECK_CLASSES,
        REALITY_CHECK_LABELS,
        CLASS_MANDAT_BELEGT,
        CLASS_MANDAT_PLAUSIBEL,
        CLASS_BEOBACHTEN,
        CLASS_VERWERFEN
    )

class TriggerEvent:
    def __init__(
        self,
        company_name,
        country,
        category,
        description,
        source_url,
        source_type,
        evidence_text,
        event_id=None,
        region=None,
        event_date=None,
        published_at=None,
        captured_at=None,
        last_checked_at=None,
        provenance_status="real_source_unverified",
        uncertainties=None,
        report_type="initial_report",
        history=None,
        axis_a_event_certainty="plausibel",
        axis_b_transformation_need="mittel",
        axis_c_mandate_potential="unbekannt",
        mandate_rationale="",
        counter_indicators=None,
        court_and_reg=None,
        legal_form=None,
        requires_manual_link_review=False,
        mandate_priority=None,
        mandate_priority_label=None,
        action_type=None,
        reality_check=None,
        reality_check_history=None
    ):
        self.event_id = event_id or str(uuid.uuid4())
        self.company_name = (company_name or "").strip()
        self.country = (country or "DE").upper().strip()
        self.region = (region or "").strip()
        self.category = category
        self.description = (description or "").strip()
        
        # Strict Date Separation: event_date is only set if proven!
        self.event_date = str(event_date).strip() if event_date else None
        self.published_at = str(published_at).strip() if published_at else datetime.now(timezone.utc).isoformat()
        
        self.source_url = (source_url or "").strip()
        self.source_type = source_type
        self.evidence_text = (evidence_text or "").strip()
        
        now_iso = datetime.now(timezone.utc).isoformat()
        self.captured_at = captured_at or now_iso
        self.last_checked_at = last_checked_at or now_iso
        
        if provenance_status not in VALID_PROVENANCE_CLASSES:
            raise ValueError(f"Invalid provenance_status '{provenance_status}'. Must be one of {VALID_PROVENANCE_CLASSES}")
        self.provenance_status = provenance_status
        
        self.uncertainties = uncertainties or []
        self.report_type = report_type if report_type in VALID_REPORT_TYPES else "initial_report"
        self.history = history or []
        
        # 3-Axis Evaluation (strict separation)
        self.axis_a_event_certainty = axis_a_event_certainty if axis_a_event_certainty in VALID_AXIS_A else "plausibel"
        self.axis_b_transformation_need = axis_b_transformation_need if axis_b_transformation_need in VALID_AXIS_B else "mittel"
        self.axis_c_mandate_potential = axis_c_mandate_potential if axis_c_mandate_potential in VALID_AXIS_C else "unbekannt"
        self.mandate_rationale = (mandate_rationale or "").strip()
        
        self.counter_indicators = counter_indicators or []
        self.court_and_reg = (court_and_reg or "").strip()
        self.legal_form = (legal_form or "").strip()
        self.requires_manual_link_review = bool(requires_manual_link_review)

        # Lead Qualification: Acute Action Pressure vs Passive / Watchlist
        if mandate_priority in VALID_MANDATE_PRIORITIES:
            self.mandate_priority = mandate_priority
            self.action_type = action_type or "unspecified"
        else:
            calc_pri, calc_act = self.determine_mandate_priority()
            self.mandate_priority = calc_pri
            self.action_type = action_type or calc_act
            
        self.mandate_priority_label = mandate_priority_label or MANDATE_PRIORITY_LABELS.get(self.mandate_priority, "Watchlist / General Distress")

        # Mandate Reality Check Corrective
        self.reality_check_history = reality_check_history or []
        self.reality_check = reality_check if (reality_check and isinstance(reality_check, dict)) else None
        if self.reality_check is None:
            self.reality_check = MandateRealityCheckEngine.evaluate(self)

    def determine_mandate_priority(self):
        """
        Differentiates corporate trigger events into actionable C-Level interim mandates
        vs. general distress signals on a watchlist.
        """
        text = f"{self.company_name} {self.category} {self.description} {self.evidence_text}".lower()
        
        # 1. Negative / Passive filters (Watchlist / General Distress)
        # Routine order / contract / project completion
        if any(k in text for k in ["auftrag", "fertiggestellt"]) and not any(k in text for k in ["krise", "restrukturierung", "insolvenz"]):
            return "watchlist_general_distress", "passiv_auftrag_routine"
            
        # Routine subordinate procuration / mutation (SHAB / Register)
        if self.category == "c_level_vakanz_ch" and any(k in text for k in ["kollektivprokura", "prokura erloschen", "unterschrift zu zweit"]):
            return "watchlist_general_distress", "passiv_prokura_mutation"
            
        # Already completed M&A / Investor process closed / takeover finished (kein akutes Organ-Vakuum)
        if any(k in text for k in [
            "investorenprozess erfolgreich abgeschlossen", "übernahme vollzogen", "geschäftsbetrieb übernommen",
            "fortführung gesichert", "übernimmt geschäftsbetrieb", "erfolgreichen abschluss",
            "investorenprozess abgeschlossen", "zukunft gesichert", "zukunftslösung", "veräußert", "veräussert"
        ]):
            return "watchlist_general_distress", "passiv_m_and_a_abschluss"

        # Already staffed / appointed successor (no open interim mandate)
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
        is_already_staffed = any(re.search(pat, text, re.IGNORECASE) for pat in staffed_patterns)
        if is_already_staffed:
            return "watchlist_general_distress", "passiv_nachfolge_besetzt"

        # Regular insolvency with external court administrator (entmachtete Organe, Fremdverwaltung)
        if any(k in text for k in [
            "vorläufigen insolvenzverwalter bestellt", "insolvenzverwalter bestellt", "regelinsolvenz",
            "insolvenzverfahren eröffnet", "stellt insolvenzantrag", "insolvenzantrag gestellt"
        ]) and "eigenverwaltung" not in text and "schutzschirm" not in text:
            return "watchlist_general_distress", "passiv_regelinsolvenz"
            
        # 2. Acute Handlungsdruck / Organ-Vakuum (High Priority / C-Level Action required)
        # C-Level vacancy / CFO departure
        if not is_already_staffed and (
            self.category in ("c_level_vakanz", "organ_vakanz") or
            any(k in text for k in ["vorstandswechsel", "amtsniederlegung", "rücktritt per sofort", "vorstand scheidet aus", "organ-vakuum"])
        ):
            return "high_priority_action_required", "c_level_organ_vakuum"
            
        # Eigenverwaltung / Schutzschirm (CRO required)
        if any(k in text for k in ["eigenverwaltung", "schutzschirm", "sanierungsgeschäftsführer", "starug"]) or self.category == "insolvenzantrag_eigenverwaltung":
            return "high_priority_action_required", "cro_eigenverwaltung"
            
        # Acute bond restructuring / SchVG creditor vote / Standstill / Covenant breach
        if self.category == "finanzierung_anleihen_restrukturierung" or any(k in text for k in [
            "stillhaltevereinbarung", "stillhalteabkommen", "standstill", "gläubigerabstimmung",
            "gläubigerversammlung", "abstimmung ohne versammlung", "covenant", "restrukturierungskonzept"
        ]):
            return "high_priority_action_required", "schvg_glaeubiger_druck"
            
        return "watchlist_general_distress", "watchlist_general"

    def get_dedup_hash(self):
        """Generates a stable normalized deduplication key."""
        clean_name = self.company_name.lower()
        # Strip common prefixes and descriptors for stable cross-run hashing
        clean_name = re.sub(r'^(?:(?:\d{1,2}\.\s+)?(?:januar|februar|märz|april|mai|juni|juli|august|september|oktober|november|dezember)\s+\d{4}[\.:,]?\s*)', '', clean_name)
        clean_name = re.sub(r'^(?:der|die|das|des|dem|den|ein|eine|einer|eines|einem|einen)\s+', '', clean_name)
        clean_name = re.sub(r'^(?:solarunternehmen|diagnostik-startup|startup|automobilzulieferer|zulieferer|hersteller|betreiber|krankenhausbetreiber|klinikbetreiber|unternehmen|traditionsunternehmen|familienunternehmen)\s+', '', clean_name)
        clean_name = re.sub(r'^(?:der|die|das|des|dem|den)\s+', '', clean_name)
        norm_company = ''.join(e for e in clean_name if e.isalnum())
        norm_cat = self.category.lower().strip()
        # Use event_date or published year-month
        date_token = self.event_date or (self.published_at[:7] if self.published_at else "nodate")
        raw_key = f"{norm_company}:{self.country}:{norm_cat}:{date_token}"
        return hashlib.sha256(raw_key.encode('utf-8')).hexdigest()[:16]

    def add_follow_up(self, new_event_data):
        """
        Appends follow-up information without overwriting existing primary sources or dates.
        Updates last_checked_at and creates an immutable entry in the history chain.
        """
        history_entry = {
            "recorded_at": self.last_checked_at,
            "source_url": self.source_url,
            "source_type": self.source_type,
            "evidence_text": self.evidence_text,
            "description": self.description,
            "published_at": self.published_at,
            "event_date": self.event_date,
            "report_type": self.report_type
        }
        self.history.append(history_entry)

        now_iso = datetime.now(timezone.utc).isoformat()
        self.last_checked_at = now_iso
        self.report_type = "follow_up"

        # Integrate new evidence
        new_evidence = (new_event_data.get("evidence_text") or "").strip()
        if new_evidence and new_evidence != self.evidence_text and new_evidence not in self.evidence_text:
            self.evidence_text = f"{self.evidence_text}\n[Folgemeldung {now_iso[:10]}]: {new_evidence}"

        new_desc = (new_event_data.get("description") or "").strip()
        if new_desc and new_desc != self.description and new_desc not in self.description:
            self.description = f"{self.description} | {new_desc}"

        # If a verified event_date was discovered and previously missing, safely record it
        if not self.event_date and new_event_data.get("event_date"):
            self.event_date = str(new_event_data["event_date"]).strip()

        # Update evaluation dimensions if new verified evidence is stronger
        if new_event_data.get("axis_a_event_certainty"):
            self.axis_a_event_certainty = new_event_data["axis_a_event_certainty"]
        if new_event_data.get("axis_b_transformation_need"):
            self.axis_b_transformation_need = new_event_data["axis_b_transformation_need"]
        if new_event_data.get("axis_c_mandate_potential"):
            self.axis_c_mandate_potential = new_event_data["axis_c_mandate_potential"]
        if new_event_data.get("mandate_rationale"):
            self.mandate_rationale = new_event_data["mandate_rationale"]

        # Re-evaluate Mandate Reality Check on follow-up events
        new_rc, rc_change = MandateRealityCheckEngine.reevaluate_on_follow_up(self.to_dict(), new_event_data)
        self.reality_check = new_rc
        self.reality_check_history.append(rc_change)

    def to_dict(self):
        return {
            "event_id": self.event_id,
            "company_name": self.company_name,
            "country": self.country,
            "region": self.region,
            "category": self.category,
            "description": self.description,
            "event_date": self.event_date,
            "published_at": self.published_at,
            "source_url": self.source_url,
            "source_type": self.source_type,
            "evidence_text": self.evidence_text,
            "captured_at": self.captured_at,
            "last_checked_at": self.last_checked_at,
            "provenance_status": self.provenance_status,
            "uncertainties": self.uncertainties,
            "report_type": self.report_type,
            "history": self.history,
            "axis_a_event_certainty": self.axis_a_event_certainty,
            "axis_b_transformation_need": self.axis_b_transformation_need,
            "axis_c_mandate_potential": self.axis_c_mandate_potential,
            "mandate_rationale": self.mandate_rationale,
            "counter_indicators": self.counter_indicators,
            "court_and_reg": self.court_and_reg,
            "legal_form": self.legal_form,
            "requires_manual_link_review": self.requires_manual_link_review,
            "mandate_priority": self.mandate_priority,
            "mandate_priority_label": self.mandate_priority_label,
            "action_type": self.action_type,
            "reality_check": getattr(self, "reality_check", None),
            "reality_check_history": getattr(self, "reality_check_history", [])
        }

    @classmethod
    def from_dict(cls, data):
        return cls(
            event_id=data.get("event_id"),
            company_name=data.get("company_name", ""),
            country=data.get("country", "DE"),
            region=data.get("region"),
            category=data.get("category", "unternehmenskrise_restrukturierung"),
            description=data.get("description", ""),
            event_date=data.get("event_date"),
            published_at=data.get("published_at"),
            source_url=data.get("source_url", ""),
            source_type=data.get("source_type", "unspecified"),
            evidence_text=data.get("evidence_text", ""),
            captured_at=data.get("captured_at"),
            last_checked_at=data.get("last_checked_at"),
            provenance_status=data.get("provenance_status", "real_source_unverified"),
            uncertainties=data.get("uncertainties"),
            report_type=data.get("report_type", "initial_report"),
            history=data.get("history"),
            axis_a_event_certainty=data.get("axis_a_event_certainty", "plausibel"),
            axis_b_transformation_need=data.get("axis_b_transformation_need", "mittel"),
            axis_c_mandate_potential=data.get("axis_c_mandate_potential", "unbekannt"),
            mandate_rationale=data.get("mandate_rationale", ""),
            counter_indicators=data.get("counter_indicators"),
            court_and_reg=data.get("court_and_reg"),
            legal_form=data.get("legal_form"),
            requires_manual_link_review=data.get("requires_manual_link_review", False),
            mandate_priority=data.get("mandate_priority"),
            mandate_priority_label=data.get("mandate_priority_label"),
            action_type=data.get("action_type"),
            reality_check=data.get("reality_check"),
            reality_check_history=data.get("reality_check_history")
        )
