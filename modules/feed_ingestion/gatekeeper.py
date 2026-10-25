"""
NeXus LLM-Gatekeeper & DealCoach Interface (Stufe 2 Ingestion Filter)
Delegiert an das Modul DealCoach für automatisiertes Audit, Vakuum-Check und Tier-Klassifizierung.
"""

try:
    from modules.feed_ingestion.deal_coach import audit_mandate_lead
except ImportError:
    from .deal_coach import audit_mandate_lead

def verify_mandate_signal_llm(item, eval_result):
    """
    STUFE 2: DealCoach Automatisierte Revision & Vorsortierungs-Instanz.
    Gibt (is_valid: bool, reason: str, audit_data: dict) zurück.
    """
    return audit_mandate_lead(item, eval_result)
