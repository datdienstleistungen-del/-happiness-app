import os
import urllib.request
import urllib.parse
import json
import uuid

try:
    from modules.feed_ingestion.config import DEFAULT_USER_ID, STATUS_PENDING_REVIEW
except ImportError:
    from .config import DEFAULT_USER_ID, STATUS_PENDING_REVIEW

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
        if not company_name or company_name in ("DACH Unternehmen", "UK Enterprise", "Schweizer Unternehmen"):
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
        """Insert vetted signal into nexus_opportunities as PENDING_REVIEW (inbox status)."""
        source_url = item.get('url', '')
        title = item.get('title', '')
        company_name = item.get('company', 'Unternehmen')

        if self.opportunity_exists(source_url, title):
            return None, "DUPLICATE"

        company_id = self.get_or_create_company(user_id, company_name, item.get('region', 'DACH'))

        lead_score = int(evaluation.get('confidence_score', 0.85) * 100)
        opp_id = str(uuid.uuid4())

        situation_text = (
            f"[COMPANY]: {company_name}\n"
            f"[KAUFSIGNAL]: {item.get('title', '')}\n\n"
            f"{item.get('snippet', '')}"
        )

        payload = {
            'id': opp_id,
            'user_id': user_id,
            'company_id': company_id,
            'title': f"[{item.get('region', 'DACH')}] {company_name}: {item.get('title', '')}"[:250],
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
                    return created[0], "INSERTED"
        except urllib.error.HTTPError as e:
            err_msg = e.read().decode('utf-8', errors='ignore')
            print(f"[DB Insert Opportunity Error {e.code}] {err_msg}")
            return None, f"ERROR_{e.code}"
        except Exception as e:
            print(f"[DB Insert Opportunity Exception] {e}")
            return None, f"EXCEPTION_{e}"

        return None, "FAILED"
