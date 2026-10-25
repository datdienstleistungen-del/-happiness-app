"""
Date utility module for NeXus Feed Ingestion.
Parses multi-format announcement dates and enforces a hard max-age filter (default 48h).
"""

import re
import email.utils
from datetime import datetime, timezone, timedelta

def parse_date(date_input):
    """
    Parses date string or datetime object into timezone-aware UTC datetime.
    Supports RFC-2822 (RSS pubDate), ISO-8601, European formats, and relative strings.
    """
    if not date_input:
        return None

    if isinstance(date_input, datetime):
        if date_input.tzinfo is None:
            return date_input.replace(tzinfo=timezone.utc)
        return date_input.astimezone(timezone.utc)

    s = str(date_input).strip()
    if not s:
        return None

    # 1. Try RFC 2822 (Standard for RSS <pubDate>)
    try:
        dt = email.utils.parsedate_to_datetime(s)
        if dt is not None:
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            return dt.astimezone(timezone.utc)
    except Exception:
        pass

    # 2. Try ISO 8601
    try:
        iso_clean = s.replace('Z', '+00:00')
        dt = datetime.fromisoformat(iso_clean)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(timezone.utc)
    except Exception:
        pass

    # 3. Relative hours / minutes e.g. "vor 2 Stunden", "3 hours ago", "hace 4 horas", "il y a 2 heures"
    rel_match = re.search(r'(\d+)\s*(?:stunde|hour|heure|hora|ora|minut|tage|day|jour|giorno)', s, re.IGNORECASE)
    if rel_match:
        val = int(rel_match.group(1))
        unit = rel_match.group(0).lower()
        now = datetime.now(timezone.utc)
        if any(u in unit for u in ['minut']):
            return now - timedelta(minutes=val)
        if any(u in unit for u in ['stunde', 'hour', 'heure', 'hora', 'ora']):
            return now - timedelta(hours=val)
        if any(u in unit for u in ['tage', 'day', 'jour', 'giorno']):
            return now - timedelta(days=val)

    # 4. European Date format: DD.MM.YYYY [HH:MM[:SS]]
    eu_match = re.search(r'(\d{1,2})\.(\d{1,2})\.(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?', s)
    if eu_match:
        d, m, y = int(eu_match.group(1)), int(eu_match.group(2)), int(eu_match.group(3))
        hh = int(eu_match.group(4)) if eu_match.group(4) else 12
        mm = int(eu_match.group(5)) if eu_match.group(5) else 0
        ss = int(eu_match.group(6)) if eu_match.group(6) else 0
        try:
            return datetime(y, m, d, hh, mm, ss, tzinfo=timezone.utc)
        except Exception:
            pass

    return None

def is_signal_fresh(published_at, max_hours=48):
    """
    Evaluates whether published_at is strictly within the allowed max_hours window.
    Returns:
        (is_fresh: bool, age_hours: float, parsed_dt: datetime | None)
    """
    dt = parse_date(published_at)
    if not dt:
        # Cannot verify freshness -> treat as stale / drop
        return False, 999.0, None

    now_utc = datetime.now(timezone.utc)
    age_seconds = (now_utc - dt).total_seconds()
    age_hours = age_seconds / 3600.0

    # Allow slight forward clock skew (up to 1h)
    if age_seconds < -3600:
        return False, age_hours, dt

    if age_hours > max_hours:
        return False, age_hours, dt

    return True, age_hours, dt
