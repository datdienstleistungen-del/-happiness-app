import os
import urllib.request
import urllib.parse
import json
import uuid
from datetime import datetime, timezone

try:
    from modules.feed_ingestion.config import (
        DEFAULT_USER_ID, STATUS_PENDING_REVIEW,
        ROLE_BLACKLIST, ROLE_WHITELIST, MANDATORY_EVENT_KEYWORDS
    )
except ImportError:
    from .config import (
        DEFAULT_USER_ID, STATUS_PENDING_REVIEW,
        ROLE_BLACKLIST, ROLE_WHITELIST, MANDATORY_EVENT_KEYWORDS
    )

def is_text_blacklisted_role(text):
    if not text:
        return False
    t = text.lower()
    for b in ROLE_BLACKLIST:
        if b.lower() in t:
            # Check if an organ/c-level whitelist role is present
            has_white = any(w.lower() in t for w in ROLE_WHITELIST)
            if not has_white:
                return True
    return False

def load_env():
    """Load environment variables from .env file if not present in os.environ."""
    env_vars = {}
    env_file = os.path.join(os.getcwd(), '.env')
    if os.path.exists(env_file):
        with open(env_file, 'r', encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#') and '=' in line:
                    k, v = line.split('=', 1)
                    env_vars[k.strip()] = v.strip().strip("'\"")
    return env_vars

class SupabaseClient:
    def __init__(self):
        env = load_env()
        self.supabase_url = os.environ.get('VITE_SUPABASE_URL') or env.get('VITE_SUPABASE_URL')
        self.api_key = (
            os.environ.get('SUPABASE_SERVICE_KEY') or
            env.get('SUPABASE_SERVICE_KEY') or
            os.environ.get('VITE_SUPABASE_ANON_KEY') or
            env.get('VITE_SUPABASE_ANON_KEY')
        )
        if not self.supabase_url or not self.api_key:
            raise ValueError("Supabase URL or API Key missing. Please check .env file.")

        self.base_rest = self.supabase_url.rstrip('/') + '/rest/v1'

    def _headers(self, return_rep=False):
        h = {
            'apikey': self.api_key,
            'Authorization': f'Bearer {self.api_key}',
            'Content-Type': 'application/json'
        }
        if return_rep:
            h['Prefer'] = 'return=representation'
        return h

    def opportunity_exists(self, source_url, title=""):
        """Check if an opportunity already exists by source URL or exact title."""
        if source_url:
            query = urllib.parse.urlencode({'source': f'eq.{source_url}', 'select': 'id,title'})
            req = urllib.request.Request(f"{self.base_rest}/nexus_opportunities?{query}", headers=self._headers())
            try:
                with urllib.request.urlopen(req, timeout=8) as resp:
                    res = json.loads(resp.read().decode('utf-8'))
                    if res and len(res) > 0:
                        return True
            except Exception as e:
                print(f"[DB Dedup Check Error - Source] {e}")

        if title:
            query = urllib.parse.urlencode({'title': f'eq.{title}', 'select': 'id'})
            req = urllib.request.Request(f"{self.base_rest}/nexus_opportunities?{query}", headers=self._headers())
            try:
                with urllib.request.urlopen(req, timeout=8) as resp:
                    res = json.loads(resp.read().decode('utf-8'))
                    if res and len(res) > 0:
                        return True
            except Exception as e:
                print(f"[DB Dedup Check Error - Title] {e}")

        return False

    def get_or_create_company(self, user_id, company_name, region="DACH"):
        """Find or create company in nexus_companies table."""
        if not company_name or company_name.lower() in ("dach unternehmen", "uk enterprise", "schweizer unternehmen", "unternehmen"):
            return None

        clean_name = company_name.strip()
        query = urllib.parse.urlencode({'name': f'ilike.{clean_name}', 'select': 'id,name'})
        req = urllib.request.Request(f"{self.base_rest}/nexus_companies?{query}", headers=self._headers())
        try:
            with urllib.request.urlopen(req, timeout=8) as resp:
                res = json.loads(resp.read().decode('utf-8'))
                if res and len(res) > 0:
                    return res[0]['id']
        except Exception as e:
            print(f"[DB Company Lookup Error] {e}")

        # Create new company
        company_id = str(uuid.uuid4())
        payload = {
            'id': company_id,
            'user_id': user_id,
            'name': clean_name,
            'country': region,
            'description': f'Automatisch erfasst via Regulatory Feed Ingestion ({region})'
        }
        req = urllib.request.Request(
            f"{self.base_rest}/nexus_companies",
            data=json.dumps(payload).encode('utf-8'),
            headers=self._headers(return_rep=True),
            method='POST'
        )
        try:
            with urllib.request.urlopen(req, timeout=8) as resp:
                created = json.loads(resp.read().decode('utf-8'))
                if created and len(created) > 0:
                    return created[0]['id']
        except Exception as e:
            print(f"[DB Company Insert Error] {e}")

        return company_id

    def insert_opportunity(self, item, evaluation, user_id=DEFAULT_USER_ID):
        """
        Insert vetted signal into nexus_opportunities as PENDING_REVIEW (inbox status)
        and synchronously link a relational nexus_trigger_events entry.
        """
        source_url = (item.get('url') or '').strip()
        title = (item.get('title') or '').strip()
        company_name = (item.get('company') or '').strip()
        snippet = (item.get('snippet') or '').strip()

        # Zero-Tolerance Gatekeeper: No missing event, no truncated URLs, no placeholders
        if not title or title.lower() in ('keine angabe', 'none', 'null', 'unternehmen') or len(title) < 10:
            return None, "DROPPED_NO_EVENT"
        if not source_url or source_url.endswith('...') or source_url.endswith('…') or len(source_url) < 15:
            return None, "DROPPED_INVALID_URL"
        if not company_name or company_name.lower() in ('unternehmen', 'dach unternehmen', 'uk enterprise', 'schweizer unternehmen', 'null'):
            return None, "DROPPED_NO_COMPANY"
        if is_text_blacklisted_role(f"{title} {snippet}"):
            return None, "DROPPED_BLACKLISTED_ROLE"

        if self.opportunity_exists(source_url, title):
            return None, "DUPLICATE"

        company_id = self.get_or_create_company(user_id, company_name, item.get('region', 'DACH'))

        lead_score = int(evaluation.get('confidence_score', 0.85) * 100)
        opp_id = str(uuid.uuid4())
        trigger_id = str(uuid.uuid4())

        event_date_val = item.get('event_date') or item.get('published_at') or datetime.now(timezone.utc).strftime('%Y-%m-%d')
        situation_text = (
            f"[COMPANY]: {company_name}\n"
            f"[KAUFSIGNAL]: {title}\n"
            f"[EREIGNISDATUM]: {event_date_val}\n\n"
            f"{snippet}"
        )

        payload = {
            'id': opp_id,
            'user_id': user_id,
            'company_id': company_id,
            'title': f"[{item.get('region', 'DACH')}] {company_name}: {title}"[:250],
            'situation': situation_text,
            'relevance_logic': evaluation.get('relevance_logic', ''),
            'strategic_angle': evaluation.get('strategic_angle', ''),
            'source': source_url,
            'created_from': 'AI',
            'priority': evaluation.get('priority_db', 'hoch'),
            'confidence_score': evaluation.get('confidence_score', 0.85),
            'lead_score': lead_score,
            'review_status': STATUS_PENDING_REVIEW,
            'pipeline_stage': 'opportunity'
        }

        req = urllib.request.Request(
            f"{self.base_rest}/nexus_opportunities",
            data=json.dumps(payload).encode('utf-8'),
            headers=self._headers(return_rep=True),
            method='POST'
        )

        try:
            with urllib.request.urlopen(req, timeout=10) as resp:
                created = json.loads(resp.read().decode('utf-8'))
                if created and len(created) > 0:
                    created_opp = created[0]
                    # Also create trigger event and relational link
                    try:
                        trig_payload = {
                            'id': trigger_id,
                            'user_id': user_id,
                            'title': title[:250],
                            'content': situation_text,
                            'company_name': company_name,
                            'source': source_url,
                            'source_url': source_url,
                            'confidence_score': evaluation.get('confidence_score', 0.85),
                            'trigger_score': lead_score,
                            'signal_type': evaluation.get('category', 'ORGANVAKANZ & LEADERSHIP'),
                            'event_date': event_date_val
                        }
                        trig_req = urllib.request.Request(
                            f"{self.base_rest}/nexus_trigger_events",
                            data=json.dumps(trig_payload).encode('utf-8'),
                            headers=self._headers(return_rep=True),
                            method='POST'
                        )
                        with urllib.request.urlopen(trig_req, timeout=8) as trig_resp:
                            pass

                        link_payload = {
                            'opportunity_id': opp_id,
                            'trigger_id': trigger_id
                        }
                        link_req = urllib.request.Request(
                            f"{self.base_rest}/nexus_opportunity_triggers",
                            data=json.dumps(link_payload).encode('utf-8'),
                            headers=self._headers(return_rep=True),
                            method='POST'
                        )
                        with urllib.request.urlopen(link_req, timeout=8) as link_resp:
                            pass
                    except Exception as trig_err:
                        print(f"[DB Trigger Link Error (non-fatal)] {trig_err}")

                    return created_opp, "INSERTED"
        except urllib.error.HTTPError as e:
            err_msg = e.read().decode('utf-8', errors='ignore')
            print(f"[DB Insert Opportunity Error {e.code}] {err_msg}")
            return None, f"ERROR_{e.code}"
        except Exception as e:
            print(f"[DB Insert Opportunity Exception] {e}")
            return None, f"EXCEPTION_{e}"

        return None, "FAILED"

    def cleanup_stale_pending_opportunities(self, max_hours=48):
        """
        Deep Zero-Tolerance Database Cleaner:
        Deletes all pending/unreviewed opportunities that:
        1. Have no valid event, empty situation, or 'Keine Angabe'.
        2. Match role blacklist (Vertriebsleiter, Sales Manager, etc.).
        3. Have truncated source URLs ending in '...'.
        4. Match noise keywords (misenso, pizza, zirkus, etc.).
        5. Are older than max_hours.
        Returns: (deleted_count, deleted_titles)
        """
        query = 'review_status=in.(pending,unreviewed,PENDING_REVIEW)&select=id,title,situation,source,created_at'
        req = urllib.request.Request(f"{self.base_rest}/nexus_opportunities?{query}", headers=self._headers())
        try:
            with urllib.request.urlopen(req, timeout=12) as resp:
                pending = json.loads(resp.read().decode('utf-8'))
        except Exception as e:
            print(f"[DB Cleanup Error - Fetching pending] {e}")
            return 0, []

        now_utc = datetime.now(timezone.utc)
        to_delete_ids = []
        deleted_titles = []

        noise_keywords = [
            'misenso', 'aluwag', 'zirkus', 'pizza', 'krawatten', 'sportzentrum',
            'kita', 'hofladen', 'marriott', 'pleite', 'konkurs'
        ]

        for item in pending:
            opp_id = item.get('id')
            raw_title = item.get('title') or ''
            title_lower = raw_title.lower()
            raw_situation = item.get('situation') or ''
            situation_lower = raw_situation.lower()
            source = (item.get('source') or '').strip()
            created_at_str = item.get('created_at')

            is_invalid = False
            drop_reason = ""

            # Check 1: Missing event or situation
            if not raw_situation.strip() or not raw_title.strip() or raw_title.strip() == 'None':
                is_invalid = True
                drop_reason = "EMPTY_EVENT_OR_TITLE"
            elif 'keine angabe' in title_lower or 'keine angabe' in situation_lower:
                is_invalid = True
                drop_reason = "KEINE_ANGABE"

            # Check 2: Blacklisted roles (Seniority filter)
            elif is_text_blacklisted_role(f"{raw_title} {raw_situation}"):
                is_invalid = True
                drop_reason = "BLACKLISTED_ROLE"

            # Check 3: Truncated source URL
            elif source.endswith('...') or source.endswith('…'):
                is_invalid = True
                drop_reason = "TRUNCATED_URL"

            # Check 4: Noise keywords
            elif any(k in title_lower or k in situation_lower for k in noise_keywords):
                is_invalid = True
                drop_reason = "NOISE_KEYWORD"

            # Check 5: Age > max_hours
            elif created_at_str:
                try:
                    iso_clean = created_at_str.replace('Z', '+00:00')
                    dt = datetime.fromisoformat(iso_clean)
                    if dt.tzinfo is None:
                        dt = dt.replace(tzinfo=timezone.utc)
                    age_hours = (now_utc - dt.astimezone(timezone.utc)).total_seconds() / 3600.0
                    if age_hours > max_hours:
                        is_invalid = True
                        drop_reason = f"AGE_OVER_{max_hours}H"
                except Exception:
                    pass

            if is_invalid and opp_id:
                to_delete_ids.append(opp_id)
                deleted_titles.append(f"[{drop_reason}] {raw_title[:60]}")

        deleted_count = 0
        for opp_id in to_delete_ids:
            del_req = urllib.request.Request(
                f"{self.base_rest}/nexus_opportunities?id=eq.{opp_id}",
                headers=self._headers(),
                method='DELETE'
            )
            try:
                with urllib.request.urlopen(del_req, timeout=8) as del_resp:
                    if del_resp.status in (200, 204):
                        deleted_count += 1
            except Exception as e:
                print(f"[DB Delete Error {opp_id}] {e}")

        # Also clean up dummy lead packages (sucht Vertriebsleiter / Baustoffindustrie)
        try:
            pkg_query = urllib.parse.urlencode({
                'or': '(headline.ilike.*Vertriebsleiter*,headline.ilike.*Baustoff*,summary.ilike.*Vertriebsleiter*)',
                'select': 'id,headline'
            })
            pkg_req = urllib.request.Request(f"{self.base_rest}/nexus_lead_packages?{pkg_query}", headers=self._headers())
            with urllib.request.urlopen(pkg_req, timeout=8) as pkg_resp:
                dummy_pkgs = json.loads(pkg_resp.read().decode('utf-8'))
                for p in dummy_pkgs:
                    del_p_req = urllib.request.Request(
                        f"{self.base_rest}/nexus_lead_packages?id=eq.{p['id']}",
                        headers=self._headers(),
                        method='DELETE'
                    )
                    with urllib.request.urlopen(del_p_req, timeout=8) as del_p_resp:
                        pass
        except Exception as e:
            print(f"[DB Package Cleanup Error] {e}")

        return deleted_count, deleted_titles
