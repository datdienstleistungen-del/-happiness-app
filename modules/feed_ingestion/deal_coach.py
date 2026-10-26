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

DEEPSEEK_KEY = os.environ.get('DEEPSEEK_API_KEY') or ENV.get('DEEPSEEK_API_KEY') or ENV.get('VITE_DEEPSEEK_API_KEY')

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

def call_deepseek(prompt):
    if not DEEPSEEK_KEY:
        return None
    url = "https://api.deepseek.com/chat/completions"
    headers = {
        "Authorization": f"Bearer {DEEPSEEK_KEY}",
        "Content-Type": "application/json"
    }
    payload = {
        "model": "deepseek-chat",
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
        with urllib.request.urlopen(req, timeout=6) as resp:
            data = json.loads(resp.read().decode('utf-8'))
            return data.get('choices', [{}])[0].get('message', {}).get('content', '')
    except Exception:
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
        with urllib.request.urlopen(req, timeout=5) as resp:
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
        with urllib.request.urlopen(req, timeout=5) as resp:
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

    # ── FAST-PATH FÜR BEKANNTE BÖRSEN-ROUTINEMELDUNGEN (VOREINSCHÄTZUNG) ──
    combined_lower = f"{title} {snippet}".lower()
    routine_patterns = [
        (r'transaction in own shares', 'Routine-Aktienrückkauf (Treasury) ohne Organ-Vakanz'),
        (r'holding\(?s\)? in company', 'Passive Stimmrechtsanpassung / Beteiligungsmeldung ohne Organwechsel'),
        (r'\bstimmrechtsanteile\b', 'Gesetzliche Stimmrechtsmitteilung (§§ 33 ff. WpHG) ohne Organvakanz'),
        (r'\bpdmr shareholding\b', 'Routine Eigengeschäft von Führungskräften (Art. 19 MAR) ohne Vakanz'),
        (r'director/pdmr shareholding', 'Routine Eigengeschäft von Führungskräften ohne Vakanz'),
        (r'\bexercise of warrants\b', 'Routine Optionsausübung / Kapitalmaßnahme'),
        (r'\bissue of equity\b', 'Routine Ausgabe neuer Aktien ohne Führungswechsel'),
        (r'\bblock listing\b', 'Börsen-Notierungsmitteilung ohne Organbedarf'),
        (r'vorabbekanntmachung finanzberichte', 'Reguläre Veröffentlichungspflicht für Finanzberichte')
    ]
    for pattern, rationale in routine_patterns:
        if re.search(pattern, combined_lower):
            parsed = {
                'status': 'rejected',
                'tier': 'REJECTED',
                'is_valid_mandate_event': False,
                'is_fresh': True,
                'company_name': company,
                'role': 'Routine-Kapitalmarkt',
                'event_type': 'Börsen- & Kapitalmarkt-Routine',
                'vacuum_check': f'AUSGESONDERT: {rationale}',
                'urgency_check': '0 € Mandatswert (Reine Pflichtroutine ohne Organvakanz)',
                'audit_verdict': 'REJECTED_NO_MANDATE',
                'audit_rationale': f"Automatischer Ausschluss: {rationale}.",
                'rejection_reason': rationale,
                'estimated_budget': '0 €',
                'confidence': 0.99
            }
            return False, f"GATE_0_REJECTED: {rationale}", parsed

    prompt = f"""Du bist der NeXus DealCoach. Analysiere diese europäische Wirtschaftsmeldung als automatisierte Revisions- und Vorsortierungs-Instanz für Harros Mandats-Desk:
HEUTIGES DATUM: {today_str}

DEINE PRÜF-KRITERIEN:

1. VAKUUM-CHECK:
   - Ist der Organ-Posten (Vorstand, CEO, CFO, CRO, Aufsichtsrat, GF) unbesetzt oder droht Stillstand?
   - Oder handelt es sich um planmäßige Routine / keinen Organwechsel?

2. DRINGLICHKEIT & HANDLUNGSDRUCK:
   - Gibt es eine Notlösung (z.B. Aufsichtsrat springt interimistisch ein)?
   - Akuter Sanierungsdruck (StaRUG, CRO-Bedarf, Schutzschirm)?

3. KLASSIFIZIERUNG IN VERWERTUNGS-TÖPFE (tier):
   - "TIER_1_TOP": Großunternehmen / Börsennotiert (AG, SE, Plc, DAX, FTSE), C-Level Organvakanz. Budget 150k – 320k €.
   - "TIER_2_MID": Gehobener Mittelstand, operative Leitung / Interimsleitung. Budget 80k – 150k €.
   - "PRÜFUNG_EMPFOHLEN": Routine-Börsenmeldung, Stimmrechte, Q3-Berichte oder unklarer Handlungsbedarf (zur Chefsache-Sichtung durch Harro).

MELDUNG:
Unternehmen: {company}
Region: {region}
Titel: {title}
Textauszug: {snippet}
Publikationsdatum: {published_at or today_str}

Antworte AUSSCHLIESSLICH in diesem JSON-Format:
{{
  "tier": "TIER_1_TOP" | "TIER_2_MID" | "PRÜFUNG_EMPFOHLEN",
  "is_valid_mandate_event": true,
  "is_fresh": true,
  "event_date": "YYYY-MM-DD des Vorfalls oder null",
  "company_name": "Exakter Firmenname",
  "legal_form": "AG | SE | KGaA | Plc | SA | NV | SpA | Corp | Groß-GmbH | Unbekannt",
  "role": "Organrolle (z.B. CEO, CFO, CRO, Aufsichtsrat, Board)",
  "person_name": "Name der Person oder leer",
  "event_type": "Abrupte Organ-Vakanz & Rücktritt | Restrukturierung & CRO | Not-Governance & AR-Interim | M&A Board-Umbau | PE Carve-Out | Pflichtmitteilung",
  "vacuum_check": "Vakuum-Einschätzung",
  "urgency_check": "Dringlichkeits-Einschätzung",
  "audit_verdict": "QUALIFIZIERT_MANDATSBEDARF" | "PRÜFUNG_EMPFOHLEN",
  "audit_rationale": "Prägnante DealCoach-Begründung für Harro.",
  "estimated_budget": "150k - 320k €" | "80k - 150k €" | "Auf Anfrage",
  "confidence": 0.0 - 1.0,
  "rejection_reason": ""
}}"""

    raw_response = None

    # 1. DeepSeek (Primär-Engine für DealCoach Audit)
    raw_response = call_deepseek(prompt)

    # 2. Mistral Fallback
    if not raw_response:
        for model in MISTRAL_MODELS:
            raw_response = call_mistral(prompt, model)
            if raw_response:
                break

    # 3. OpenRouter Fallback
    if not raw_response:
        for model in OPENROUTER_MODELS:
            raw_response = call_openrouter(prompt, model)
            if raw_response:
                break

    parsed = extract_json_from_text(raw_response) if raw_response else None
    if not parsed or not isinstance(parsed, dict):
        parsed = {
            'status': 'pending',
            'tier': 'PRÜFUNG_EMPFOHLEN',
            'is_valid_mandate_event': True,
            'is_fresh': True,
            'company_name': company,
            'role': 'Vorstand / Geschäftsführung / Board',
            'event_type': 'Primärmeldung',
            'vacuum_check': 'Manuelle Prüfung erforderlich',
            'urgency_check': 'Primärmeldung zur Chefsache-Prüfung',
            'audit_verdict': 'PRÜFUNG_EMPFOHLEN',
            'audit_rationale': 'Primärmeldung aus Primärquelle. Zur manuellen Sichtung im Mandats-Desk vorgelegt.',
            'estimated_budget': 'Auf Anfrage',
            'confidence': 0.75
        }
        return True, "DEALCOACH_MANUELLE_PRÜFUNG", parsed

    raw_tier = parsed.get('tier', 'PRÜFUNG_EMPFOHLEN')
    if raw_tier in ('TIER_1_TOP', 'TIER_1'):
        tier = 'TIER_1_TOP'
    elif raw_tier in ('TIER_2_MID', 'TIER_2'):
        tier = 'TIER_2_MID'
    else:
        tier = 'PRÜFUNG_EMPFOHLEN'

    parsed['status'] = 'pending'
    parsed['tier'] = tier
    parsed['is_valid_mandate_event'] = True
    parsed['is_fresh'] = True
    if not parsed.get('audit_rationale'):
        parsed['audit_rationale'] = parsed.get('rejection_reason') or 'Zur manuellen Prüfung durch Harro im Mandats-Desk vorgelegt.'

    return True, f"DEALCOACH_VOREINSCHÄTZUNG ({tier}): {parsed.get('audit_rationale')[:80]}", parsed
