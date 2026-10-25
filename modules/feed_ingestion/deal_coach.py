"""
NeXus DealCoach - Automatisierte Revisions- und Vorsortierungs-Instanz (Stufe 2)
Focus: European Mandate Origination Desk (C-Level, Interim & Board Vacancies)

Prüft strikt:
1. Vakuum-Check: Ist der Posten tatsächlich unbesetzt oder droht sofortiger Stillstand?
   (Keine planmäßigen Wechsel, keine Pensionierungen mit Vorlauf).
2. Dringlichkeit & Handlungsdruck: Gibt es eine Überbrückung/Notlösung (z.B. AR springt ein)
   oder akuten Restrukturierungsdruck (StaRUG, CRO, Eigenverwaltung)?
3. Klassifizierung in Verwertungs-Töpfe:
   - tier: "TIER_1_TOP" (Großunternehmen/Börse, Budget 150k–320k €, C-Level Organ)
   - tier: "TIER_2_MID" (Mittelstand ab 20 Mio. €, PMO / operative Leitung)
   - tier: "REJECTED" (Kein Handlungsdruck, interner Nachfolger bereits aktiv, Routine)
4. Harter Reputationsschutz ('Kalter Kaffee'): Reales Vorfallsdatum <= 48h.
"""

import os
import json
import re
import urllib.request
import urllib.error
from datetime import datetime, timezone

try:
    from modules.feed_ingestion.date_utils import parse_date
    from modules.feed_ingestion.config import LEGAL_FORM_WHITELIST
except ImportError:
    from .date_utils import parse_date
    from .config import LEGAL_FORM_WHITELIST

def load_env():
    """Load environment variables from .env file."""
    env = {}
    env_file = os.path.join(os.getcwd(), '.env')
    if os.path.exists(env_file):
        with open(env_file, 'r', encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#') and '=' in line:
                    k, v = line.split('=', 1)
                    env[k.strip()] = v.strip().strip("'\"")
    return env

ENV = load_env()
OPENROUTER_KEY = os.environ.get('OPENROUTER_API_KEY') or ENV.get('OPENROUTER_API_KEY') or ENV.get('VITE_OPENROUTER_API_KEY')
MISTRAL_KEY = os.environ.get('MISTRAL_API_KEY') or ENV.get('MISTRAL_API_KEY') or ENV.get('VITE_MISTRAL_API_KEY')

OPENROUTER_MODELS = [
    'nvidia/nemotron-3.5-super-vl:free',
    'recursive/flint-v1.0:free'
]

MISTRAL_MODELS = [
    'open-mistral-7b',
    'mistral-small-latest'
]

def extract_json_from_text(text):
    """Robust JSON extraction from LLM response."""
    if not text:
        return None
    cleaned = re.sub(r'^```(?:json)?\s*', '', text.strip(), flags=re.MULTILINE)
    cleaned = re.sub(r'\s*```$', '', cleaned.strip(), flags=re.MULTILINE)

    try:
        return json.loads(cleaned)
    except Exception:
        pass

    match = re.search(r'(\{[\s\S]*\})', text)
    if match:
        try:
            return json.loads(match.group(1))
        except Exception:
            pass
    return None

def call_openrouter(prompt, model):
    if not OPENROUTER_KEY:
        return None
    url = "https://openrouter.ai/api/v1/chat/completions"
    headers = {
        "Authorization": f"Bearer {OPENROUTER_KEY}",
        "Content-Type": "application/json",
        "HTTP-Referer": "https://nexus-hit.netlify.app",
        "X-Title": "NeXus DealCoach Revision"
    }
    payload = {
        "model": model,
        "messages": [
            {
                "role": "system",
                "content": "Du bist der NeXus DealCoach – die automatisierte Revisions- und Vorsortierungs-Instanz (Stufe 2) für den europäischen Mandate Origination Desk. Prüfe knallhart, objektiv und antworte ausschließlich in validem JSON."
            },
            {"role": "user", "content": prompt}
        ],
        "temperature": 0.1,
        "max_tokens": 550
    }
    req = urllib.request.Request(url, data=json.dumps(payload).encode('utf-8'), headers=headers, method='POST')
    try:
        with urllib.request.urlopen(req, timeout=7) as resp:
            data = json.loads(resp.read().decode('utf-8'))
            return data.get('choices', [{}])[0].get('message', {}).get('content', '')
    except Exception:
        return None

def call_mistral(prompt, model):
    if not MISTRAL_KEY:
        return None
    url = "https://api.mistral.ai/v1/chat/completions"
    headers = {
        "Authorization": f"Bearer {MISTRAL_KEY}",
        "Content-Type": "application/json"
    }
    payload = {
        "model": model,
        "messages": [
            {
                "role": "system",
                "content": "Du bist der NeXus DealCoach – die automatisierte Revisions- und Vorsortierungs-Instanz (Stufe 2) für den europäischen Mandate Origination Desk. Prüfe knallhart, objektiv und antworte ausschließlich in validem JSON."
            },
            {"role": "user", "content": prompt}
        ],
        "temperature": 0.1,
        "max_tokens": 550,
        "response_format": {"type": "json_object"}
    }
    req = urllib.request.Request(url, data=json.dumps(payload).encode('utf-8'), headers=headers, method='POST')
    try:
        with urllib.request.urlopen(req, timeout=7) as resp:
            data = json.loads(resp.read().decode('utf-8'))
            return data.get('choices', [{}])[0].get('message', {}).get('content', '')
    except Exception:
        return None

def audit_mandate_lead(item, eval_result):
    """
    DEALCOACH AUDIT (STUFE 2):
    Führt die semantische Revision und Einstufung in Verwertungs-Töpfe durch.
    Returns: (is_valid: bool, reason: str, audit_data: dict)
    """
    title = item.get('title', '')
    company = item.get('company', '')
    region = item.get('region', 'EU')
    snippet = item.get('snippet', '')
    published_at = item.get('published_at', '')

    now_utc = datetime.now(timezone.utc)
    today_str = now_utc.strftime('%Y-%m-%d')

    prompt = f"""Du bist der NeXus DealCoach. Analysiere diese europäische Wirtschaftsmeldung streng als automatisierte Revisions- und Vorsortierungs-Instanz:
HEUTIGES DATUM: {today_str}

DEINE PRÜF-KRITERIEN:

1. VAKUUM-CHECK:
   - Ist der Organ-Posten (Vorstand, CEO, CFO, CRO, Aufsichtsrat, GF) TATSÄCHLICH unbesetzt oder droht sofortiger Stillstand?
   - Sofortiger Ausschluss (tier: "REJECTED"):
     * Planmäßige Wechsel mit monatelangem Vorlauf / reguläres Vertragsende zum Jahresende.
     * Pensionierungen mit geordneter Übergabe.
     * Wenn der Nachfolger bereits ernannt und voll im Amt ist (kein Führungs-Vakuum).

2. DRINGLICHKEIT & HANDLUNGSDRUCK:
   - Gibt es eine Notlösung / Not-Governance (z.B. Aufsichtsrat/Verwaltungsrat springt interimistisch ein)?
   - Oder akuter Sanierungsdruck (StaRUG, Insolvenz in Eigenverwaltung, Schutzschirm, CRO-Bedarf, Schulden-Restrukturierung)?
   - Per sofort wirksame Abberufung / Amtsniederlegung?

3. KLASSIFIZIERUNG IN VERWERTUNGS-TÖPFE (tier):
   - "TIER_1_TOP":
     Großunternehmen / Börsennotiert (AG, SE, Plc, SA, NV, SpA, Corp, FTSE, DAX, SMI) oder Umsatz > 250 Mio. €.
     Bedarf auf C-Level / Organ-Ebene (CEO, CFO, CRO, Board).
     Mandatsbudget: 150.000 € – 320.000 €.
   - "TIER_2_MID":
     Gehobener Mittelstand (ab 20 Mio. €) / Groß-GmbH / Industrie-Mittelstand.
     Operative Leitung, PMO, Restrukturierungs-Team oder Interims-Leitung.
     Mandatsbudget: 80.000 € – 150.000 €.
   - "REJECTED":
     Kein akuter Handlungsdruck, geordnete Routine, Kleingewerbe oder kein Mandatsbedarf.

4. HARTER REPUTATIONSSCHUTZ ('KALTER KAFFEE'):
   - Extrahiere das reale 'event_date' (YYYY-MM-DD) des Beschlusses/Vorfalls.
   - Liegt event_date mehr als 48 Stunden vor heute ({today_str}), gilt zwingend: tier: "REJECTED" und is_fresh: false!

MELDUNG:
Unternehmen: {company}
Region: {region}
Titel: {title}
Textauszug: {snippet}
Publikationsdatum: {published_at or today_str}

Antworte AUSSCHLIESSLICH in diesem JSON-Format:
{{
  "tier": "TIER_1_TOP" | "TIER_2_MID" | "REJECTED",
  "is_valid_mandate_event": true | false,
  "is_fresh": true | false,
  "event_date": "YYYY-MM-DD des realen Vorfalls oder null",
  "company_name": "Exakter Firmenname",
  "legal_form": "AG | SE | KGaA | Plc | SA | NV | SpA | Corp | Groß-GmbH | Unbekannt",
  "role": "Organrolle (z.B. CEO, CFO, CRO, Aufsichtsrat)",
  "person_name": "Name der Person oder leer",
  "event_type": "Abrupte Organ-Vakanz & Rücktritt | Restrukturierung & CRO | Not-Governance & AR-Interim | M&A Board-Umbau | PE Carve-Out | Finanzielle Sondersituation",
  "vacuum_check": "BESTANDEN: [Begründung, warum Vakuum droht]" | "FEHLGESCHLAGEN: [Grund]",
  "urgency_check": "HOCH: [Grund für Handlungsdruck]" | "GERING: [Grund]",
  "audit_verdict": "QUALIFIZIERT_MANDATSBEDARF" | "REJECTED",
  "audit_rationale": "Prägnante 2-3 Sätze DealCoach-Begründung, warum akuter Mandatsbedarf besteht.",
  "estimated_budget": "150k - 320k €" | "80k - 150k €" | "k.A.",
  "confidence": 0.0 - 1.0,
  "rejection_reason": "Grund falls REJECTED, sonst leer"
}}"""

    raw_response = None

    # 1. OpenRouter Free Models
    for model in OPENROUTER_MODELS:
        raw_response = call_openrouter(prompt, model)
        if raw_response:
            break

    # 2. Mistral Fallback
    if not raw_response:
        for model in MISTRAL_MODELS:
            raw_response = call_mistral(prompt, model)
            if raw_response:
                break

    if not raw_response:
        return False, "DEALCOACH_OFFLINE_SAFE_DROP", None

    parsed = extract_json_from_text(raw_response)
    if not parsed or not isinstance(parsed, dict):
        return False, "INVALID_DEALCOACH_JSON_RESPONSE", None

    tier = parsed.get('tier', 'REJECTED')
    is_valid = bool(parsed.get('is_valid_mandate_event')) and tier != 'REJECTED'
    confidence = float(parsed.get('confidence', 0.0))
    reason = parsed.get('rejection_reason') or parsed.get('audit_rationale') or 'DealCoach: Nicht qualifiziert'

    if not is_valid or tier == 'REJECTED':
        parsed['status'] = "REJECTED"
        parsed['tier'] = "REJECTED"
        parsed['is_fresh'] = False
        return False, f"DEALCOACH_REJECTED: {reason}", parsed

    # ── HARTER REPUTATIONSSCHUTZ: 48h Filter ──
    if parsed.get('is_fresh') is False:
        parsed['status'] = "REJECTED"
        parsed['tier'] = "REJECTED"
        parsed['is_fresh'] = False
        return False, f"REJECTED_STALE_EVENT_DATE (Kalter Kaffee): Vorfall liegt >48h zurück ({parsed.get('event_date')})", parsed

    extracted_date_str = parsed.get('event_date') or published_at
    if not extracted_date_str:
        parsed['status'] = "REJECTED"
        parsed['tier'] = "REJECTED"
        parsed['is_fresh'] = False
        return False, "REJECTED_MISSING_EVENT_DATE: Kein verifizierbares Datum", parsed

    if extracted_date_str and parse_date:
        event_dt = parse_date(extracted_date_str)
        if event_dt:
            age_hours = (now_utc - event_dt).total_seconds() / 3600.0
            if age_hours > 48.0:
                parsed['is_fresh'] = False
                parsed['status'] = "REJECTED"
                parsed['tier'] = "REJECTED"
                return False, f"REJECTED_STALE_EVENT_DATE (Kalter Kaffee): Vorfall {extracted_date_str} liegt {int(age_hours)}h zurück", parsed
        else:
            parsed['is_fresh'] = False
            parsed['status'] = "REJECTED"
            parsed['tier'] = "REJECTED"
            return False, f"REJECTED_UNPARSEABLE_DATE: {extracted_date_str}", parsed

    # ── RECHTSFORM-WHITELIST CHECK ──
    detected_legal_form = (parsed.get('legal_form') or '').upper().strip()
    comp_clean = (parsed.get('company_name') or company or '').upper().strip()
    is_form_whitelisted = any(bool(re.search(rf'\b{re.escape(f)}\b', detected_legal_form) or re.search(rf'\b{re.escape(f)}\b', comp_clean)) for f in LEGAL_FORM_WHITELIST)

    if not is_form_whitelisted:
        is_major = bool(re.search(r'\b(DAIMLER|SIEMENS|VOLKSWAGEN|BMW|BASF|BAYER|ALLIANZ|SAP|TELEKOM|E\.ON|RWE|AIRBUS|NESTLE|NOVARTIS|ROCHE|UBS|GLENCORE|ABB|SHELL|BP|VODAFONE|BARCLAYS|HSBC|SANTANDER|BBVA|TELEFONICA|TOTALENERGIES|SANOFI|AXA|BNP|STELLANTIS|ATLASSIAN|SITIME|PESCANOVA)\b', comp_clean))
        if not is_major:
            parsed['status'] = "REJECTED"
            parsed['tier'] = "REJECTED"
            return False, f"REJECTED_NON_WHITELIST_LEGAL_FORM: '{detected_legal_form or comp_clean}'", parsed

    # ── VAKUUM & DRINGLICHKEITS-VALIDIERUNG ──
    vac_check = (parsed.get('vacuum_check') or '').upper()
    if 'FEHLGESCHLAGEN' in vac_check:
        parsed['status'] = "REJECTED"
        parsed['tier'] = "REJECTED"
        return False, f"DEALCOACH_VACUUM_CHECK_FAILED: {parsed.get('vacuum_check')}", parsed

    if confidence < 0.82:
        parsed['status'] = "REJECTED"
        parsed['tier'] = "REJECTED"
        return False, f"LOW_CONFIDENCE: {int(confidence*100)}% (< 82%)", parsed

    parsed['is_fresh'] = True
    parsed['status'] = "QUALIFIED"
    parsed['tier'] = tier if tier in ("TIER_1_TOP", "TIER_2_MID") else "TIER_2_MID"

    return True, "DEALCOACH_QUALIFIED", parsed
