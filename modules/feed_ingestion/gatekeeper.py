"""
NeXus LLM-Gatekeeper (Stufe 2 Ingestion Filter)
Focus: C-Level-, Board- und Interim-Vakanzen in Europa
0-Kosten Free-Tier (OpenRouter :free Modelle & Mistral open-mistral-7b)
"""

import os
import json
import re
import urllib.request
import urllib.error

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
    # Strip markdown code blocks
    cleaned = re.sub(r'^```(?:json)?\s*', '', text.strip(), flags=re.MULTILINE)
    cleaned = re.sub(r'\s*```$', '', cleaned.strip(), flags=re.MULTILINE)
    
    # Try direct parse
    try:
        return json.loads(cleaned)
    except Exception:
        pass
        
    # Regex extract first { ... }
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
        "max_tokens": 400
    }
    req = urllib.request.Request(url, data=json.dumps(payload).encode('utf-8'), headers=headers, method='POST')
    try:
        with urllib.request.urlopen(req, timeout=5) as resp:
            data = json.loads(resp.read().decode('utf-8'))
            return data.get('choices', [{}])[0].get('message', {}).get('content', '')
    except Exception as e:
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
        "max_tokens": 400,
        "response_format": {"type": "json_object"}
    }
    req = urllib.request.Request(url, data=json.dumps(payload).encode('utf-8'), headers=headers, method='POST')
    try:
        with urllib.request.urlopen(req, timeout=5) as resp:
            data = json.loads(resp.read().decode('utf-8'))
            return data.get('choices', [{}])[0].get('message', {}).get('content', '')
    except Exception as e:
        return None

def verify_mandate_signal_llm(item, eval_result):
    """
    STUFE 2: Semantischer LLM Gatekeeper.
    Gibt (is_valid: bool, reason: str, extracted_data: dict) zurück.
    """
    title = item.get('title', '')
    company = item.get('company', '')
    region = item.get('region', 'EU')
    snippet = item.get('snippet', '')

    prompt = f"""Prüfe diese europäische Wirtschaftsmeldung streng auf Relevanz für den NeXus Mandate Origination Desk:
- Fokus: Echte personelle Veränderungen auf Organ-/Board-/C-Level-Ebene (Vorstand, Aufsichtsrat, CEO, CFO, CRO, Geschäftsführer, Partner) oder gravierende Restrukturierung (StaRUG, Sanierung, Insolvenz in Eigenverwaltung, M&A).
- Sofortiger Ausschluss: Operativer Vertrieb (Vertriebsleiter, Sales Manager, Junior), Trainer/Sport, Politik, Kleinbetriebe (Gastro, Handwerk, Kiosk), allgemeine Marktberichte ohne konkreten Mandatsanlass.
- Grundsatz: Lieber ein Drop als ein fehlerhafter oder halluzinierter Lead.

MELDUNG:
Unternehmen: {company}
Region: {region}
Titel: {title}
Textauszug: {snippet}

Antworte AUSSCHLIESSLICH im folgenden JSON-Format:
{{
  "is_valid_mandate_event": true | false,
  "company_name": "Offizieller Firmenname",
  "legal_form": "AG | SE | GmbH | PLC | SA | Ltd | Unbekannt",
  "person_name": "Name der Person oder leer",
  "role": "Organrolle (z.B. CEO, CFO, Aufsichtsrat, GF)",
  "event_type": "Rücktritt | Abberufung | Nachfolge | Sanierung | M&A",
  "confidence": 0.0 - 1.0,
  "rejection_reason": "Grund für Drop falls is_valid_mandate_event false, sonst leer"
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

    if confidence < 0.85:
        return False, f"LOW_CONFIDENCE: {int(confidence*100)}% (< 85%)", parsed

    # Check that person or event is not missing/empty
    event = (parsed.get('event_type') or '').strip()
    if not event or event.lower() in ('keine angabe', 'none', 'null'):
        return False, "MISSING_VERIFIED_EVENT", parsed

    return True, "QUALIFIED", parsed
