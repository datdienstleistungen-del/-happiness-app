import os
import urllib.request
import json

try:
    from modules.feed_ingestion.db_client import load_env
except ImportError:
    from .db_client import load_env

def send_telegram_alert(new_signals):
    """
    Sends mobile alert via Telegram Bot API when new signals are ingested into the inbox.
    Gracefully skips if NOTIFY_TELEGRAM_BOT_TOKEN or NOTIFY_TELEGRAM_CHAT_ID is missing.
    """
    if not new_signals:
        return False

    env = load_env()
    bot_token = os.environ.get('NOTIFY_TELEGRAM_BOT_TOKEN') or env.get('NOTIFY_TELEGRAM_BOT_TOKEN')
    chat_id = os.environ.get('NOTIFY_TELEGRAM_CHAT_ID') or env.get('NOTIFY_TELEGRAM_CHAT_ID')

    if not bot_token or not chat_id:
        print("[Telegram Notifier] ℹ️ Mobile Alerts übersprungen: NOTIFY_TELEGRAM_BOT_TOKEN oder NOTIFY_TELEGRAM_CHAT_ID nicht in .env konfiguriert.")
        return False

    count = len(new_signals)
    lines = [
        f"🔔 <b>Nexus Radar: {count} neue{'s' if count == 1 else ''} Signal{'e' if count > 1 else ''} im Posteingang eingetroffen!</b>\n"
    ]

    for s in new_signals[:5]:
        company = s.get('company', 'Unternehmen')
        category = s.get('category', 'LEADERSHIP')
        prio = s.get('prio', 'HOCH')
        lines.append(f"• <b>Prio: {prio} ({category})</b> | <b>{company}</b>")

    if count > 5:
        lines.append(f"\n<i>... und {count - 5} weitere Meldungen.</i>")

    lines.append("\n👉 <i>Bitte in NeXus (HITL-Inbox) prüfen und freigeben.</i>")

    message_text = "\n".join(lines)
    api_url = f"https://api.telegram.org/bot{bot_token}/sendMessage"

    payload = {
        'chat_id': chat_id,
        'text': message_text,
        'parse_mode': 'HTML',
        'disable_web_page_preview': True
    }

    try:
        req = urllib.request.Request(
            api_url,
            data=json.dumps(payload).encode('utf-8'),
            headers={'Content-Type': 'application/json'},
            method='POST'
        )
        with urllib.request.urlopen(req, timeout=8) as resp:
            data = json.loads(resp.read().decode('utf-8'))
            if data.get('ok'):
                print(f"[Telegram Notifier] ✅ Mobile Alarm erfolgreich an Chat {chat_id} gesendet.")
                return True
            else:
                print(f"[Telegram Notifier] ⚠️ Telegram API Antwort: {data}")
    except Exception as e:
        print(f"[Telegram Notifier] ⚠️ Fehler beim Senden des Telegram-Alarms: {e}")

    return False
