/**
 * NeXus Company Profile — Start
 *
 * Startet die Profil-Extraktion für eine Firma.
 * Ermittelt Ziel-URLs (Startseite, Impressum, Über-uns, Leistungen).
 * Duplikatschutz: Existiert bereits ein laufender Job → gibt dessen ID zurück.
 *
 * Auth: JWT (eingeloggter User).
 * Input: { company_id, domain }
 * Output: { profile_id, total_steps }
 */

import { createClient } from '@supabase/supabase-js';
import { getProfileUrls } from '../shared/html-fetch.mjs';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type, Authorization' } };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const { company_id, domain, trigger_context } = JSON.parse(event.body || '{}');

    if (!company_id || !domain) {
      return { statusCode: 400, body: JSON.stringify({ error: 'company_id and domain required' }) };
    }

    // Auth
    const authHeader = event.headers.authorization;
    if (!authHeader) return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };

    const userSupabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });
    const { data: { user }, error: authError } = await userSupabase.auth.getUser();
    if (authError || !user) return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };

    const serviceClient = createClient(supabaseUrl, supabaseKey);

    // Duplikatschutz: Existiert bereits ein laufender Job?
    const existingRes = await serviceClient
      .from('nexus_company_profiles')
      .select('id, status')
      .eq('company_id', company_id)
      .eq('status', 'running')
      .order('updated_at', { ascending: false })
      .limit(1);

    if (existingRes.data && existingRes.data.length > 0) {
      console.log(`[CompanyProfileStart] Running job already exists: ${existingRes.data[0].id}`);
      return {
        statusCode: 200,
        body: JSON.stringify({
          profile_id: existingRes.data[0].id,
          status: 'already_running',
          message: 'Ein Firmenprofil-Scan läuft bereits für dieses Unternehmen.'
        })
      };
    }

    // Ziel-URLs ermitteln
    const pendingUrls = getProfileUrls(domain);
    const totalSteps = pendingUrls.length;

    console.log(`[CompanyProfileStart] Starting for "${domain}" — ${totalSteps} URLs`);

    // Neuen Job anlegen
    const { data: job, error: jobError } = await serviceClient
      .from('nexus_company_profiles')
      .insert({
        company_id,
        status: 'running',
        user_id: user.id,
        current_step: 0,
        pending_urls: pendingUrls,
        sources: [],
        raw_page_cache: {},
        description: null,
        services: [],
        target_audience: null,
        legal_form_location: null,
        trigger_context: trigger_context || null,
        pain_points: null,
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (jobError) {
      console.error('[CompanyProfileStart] Insert error:', jobError);
      return { statusCode: 500, body: JSON.stringify({ error: 'Failed to create profile job', details: jobError.message }) };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ profile_id: job.id, total_steps })
    };

  } catch (err) {
    console.error('[CompanyProfileStart] Fatal error:', err);
    return { statusCode: 500, body: JSON.stringify({ error: 'Internal server error', details: err.message }) };
  }
};
