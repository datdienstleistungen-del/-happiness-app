"""
NeXus LLM-Gatekeeper (Stufe 2 Ingestion Filter)
Focus: C-Level-, Board- und Interim-Vakanzen in Europa
0-Kosten Free-Tier (OpenRouter :free Modelle & Mistral open-mistral-7b)
Harter Reputationsschutz ('Kalter Kaffee' Filter: Reales Ereignisdatum <= 48h)
"""

import os
import json
import re
import urllib.request
import urllib.error
from datetime import datetime, timezone

try:
    from modules.feed_ingestion.date_utils import parse_date
except ImportError:
    try:
        from .date_utils import parse_date
    except ImportError:
        parse_date = None

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
    """Robust JSON extraction from LLM response (handles code fences and raw json)."""
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
        "X-Title": "NeXus Gatekeeper"
    }
    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": "Du bist der NeXus Gatekeeper für europäische C-Level- und Board-Vakanzen. Antworte ausschließlich in validem JSON."},
            {"role": "user", "content": prompt}
        ],
        "temperature": 0.1,
        "max_tokens": 450
    }
    req = urllib.request.Request(url, data=json.dumps(payload).encode('utf-8'), headers=headers, method='POST')
    try:
        with urllib.request.urlopen(req, timeout=6) as resp:
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
            {"role": "system", "content": "Du bist der NeXus Gatekeeper für europäische C-Level- und Board-Vakanzen. Antworte ausschließlich in validem JSON."},
            {"role": "user", "content": prompt}
        ],
        "temperature": 0.1,
        "max_tokens": 450,
        "response_format": {"type": "json_object"}
    }
    req = urllib.request.Request(url, data=json.dumps(payload).encode('utf-8'), headers=headers, method='POST')
    try:
        with urllib.request.urlopen(req, timeout=6) as resp:
            data = json.loads(resp.read().decode('utf-8'))
            return data.get('choices', [{}])[0].get('message', {}).get('content', '')
    except Exception:
        return None

def verify_mandate_signal_llm(item, eval_result):
    """
    STUFE 2: Semantischer LLM Gatekeeper mit zwingendem Reputationsschutz ('Kalter Kaffee').
    Gibt (is_valid: bool, reason: str, extracted_data: dict) zurück.
    """
    title = item.get('title', '')
    company = item.get('company', '')
    region = item.get('region', 'EU')
    snippet = item.get('snippet', '')
    published_at = item.get('published_at', '')

    now_utc = datetime.now(timezone.utc)
    today_str = now_utc.strftime('%Y-%m-%d')

    prompt = f"""Prüfe diese europäische Wirtschaftsmeldung streng auf Relevanz und zeitliche Frische für den NeXus Mandate Origination Desk:
- HEUTIGES DATUM (TODAY): {today_str}

# HARTER REPUTATIONSSCHUTZ GEGEN VERALTETE MELDUNGEN ('KALTER KAFFEE'):
1. Extrahiere zwingend das tatsächliche 'event_date' (YYYY-MM-DD): Datum des realen Vorfalls (Rücktritt, Abberufung, Amtsniederlegung, Beschluss, Sanierungsantrag).
2. Liegt das reale Ereignis mehr als 48 Stunden vor heute ({today_str}) zurück, MUSS 'is_fresh' auf false gesetzt werden.
   ACHTUNG: Auch wenn der Artikel erst heute veröffentlicht oder indexiert wurde, aber über ein historisches Ereignis berichtet (z. B. vor Wochen oder Monaten), ist dies 'Kalter Kaffee' und MUSS mit is_fresh: false verworfen werden!
3. Nur wenn das Ereignis maximal 48 Stunden vor {today_str} stattfand, ist is_fresh: true.

# FOKUS (MANDATSBEDARF):
- Echte personelle Veränderungen auf Organ-/Board-/C-Level-Ebene (Vorstand, Aufsichtsrat, CEO, CFO, CRO, Geschäftsführer, Partner) oder gravierende Restrukturierung (StaRUG, Sanierung, Insolvenz in Eigenverwaltung, M&A).
- Sofortiger Ausschluss: Operativer Vertrieb (Vertriebsleiter, Sales Manager, Junior), Trainer/Sport, Politik, Kleinbetriebe (Gastro, Handwerk, Kiosk), allgemeine Marktberichte ohne konkreten Mandatsanlass.
- Grundsatz: Lieber ein Drop als ein fehlerhafter, halluzinierter oder veralteter Lead.

MELDUNG:
Unternehmen: {company}
Region: {region}
Titel: {title}
Textauszug: {snippet}
Publikationsdatum: {published_at or today_str}

Antworte AUSSCHLIESSLICH im folgenden JSON-Format:
{{
  "is_valid_mandate_event": true | false,
  "is_fresh": true | false,
  "event_date": "YYYY-MM-DD des realen Vorfalls oder null",
  "company_name": "Offizieller Firmenname",
  "legal_form": "AG | SE | GmbH | PLC | SA | Ltd | Unbekannt",
  "person_name": "Name der Person oder leer",
  "role": "Organrolle (z.B. CEO, CFO, Aufsichtsrat, GF)",
  "event_type": "Rücktritt | Abberufung | Nachfolge | Sanierung | M&A",
  "confidence": 0.0 - 1.0,
  "rejection_reason": "Grund für Drop falls is_valid_mandate_event oder is_fresh false, sonst leer"
}}"""

    raw_response = None

    # 1. OpenRouter Free Models
    for model in OPENROUTER_MODELS:
        raw_response = call_openrouter(prompt, model)
        if raw_response:
            break

    # 2. Mistral Fallback Models
    if not raw_response:
        for model in MISTRAL_MODELS:
            raw_response = call_mistral(prompt, model)
            if raw_response:
                break

    if not raw_response:
        # Gateway nicht erreichbar -> Zero-Tolerance Safe Drop
        return False, "GATEKEEPER_OFFLINE_SAFE_DROP", None

    parsed = extract_json_from_text(raw_response)
    if not parsed or not isinstance(parsed, dict):
        return False, "INVALID_LLM_JSON_RESPONSE", None

    is_valid = bool(parsed.get('is_valid_mandate_event'))
    confidence = float(parsed.get('confidence', 0.0))
    reason = parsed.get('rejection_reason', 'Nicht qualifiziert')

    if not is_valid:
        return False, f"LLM_REJECTED: {reason}", parsed

    # ── HARTER REPUTATIONSSCHUTZ: Kalter Kaffee Filter (> 48h) ──
    if parsed.get('is_fresh') is False:
        return False, f"REJECTED_STALE_EVENT_DATE (Kalter Kaffee): Vorfall als veraltet eingestuft. Event-Datum: {parsed.get('event_date')}", parsed

    extracted_date_str = parsed.get('event_date') or published_at
    if extracted_date_str and parse_date:
        event_dt = parse_date(extracted_date_str)
        if event_dt:
            age_hours = (now_utc - event_dt).total_seconds() / 3600.0
            if age_hours > 48.0:
                parsed['is_fresh'] = False
                return False, f"REJECTED_STALE_EVENT_DATE (Kalter Kaffee): Ereignisdatum {extracted_date_str} liegt {int(age_hours)}h zurück (> 48h)", parsed
            if age_hours < -72.0:
                # Mehr als 3 Tage in der Zukunft -> Datumsfehler
                return False, f"REJECTED_INVALID_FUTURE_DATE: {extracted_date_str}", parsed

    if confidence < 0.85:
        return False, f"LOW_CONFIDENCE: {int(confidence*100)}% (< 85%)", parsed

    # Check that event_type is not missing/empty
    event = (parsed.get('event_type') or '').strip()
    if not event or event.lower() in ('keine angabe', 'none', 'null'):
        return False, "MISSING_VERIFIED_EVENT", parsed

    parsed['is_fresh'] = True
    return True, "QUALIFIED", parsed
