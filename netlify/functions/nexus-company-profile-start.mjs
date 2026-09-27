/**
 * NeXus Company Profile — Start
 *
 * Startet die Profil-Extraktion für eine Firma.
 * 1. Firma auflösen: company_id vorhanden? sonst per company_name in nexus_companies
 *    suchen bzw. anlegen.
 * 2. Domain auflösen: company.domain oder per resolveCompanyWebsite().
 * 3. Ziel-URLs ermitteln (Startseite, Impressum, Über-uns, Leistungen).
 *    Duplikatschutz: laufender Job → dessen ID; frisches done-Profil → already_done.
 *
 * Auth: JWT (eingeloggter User).
 * Input: { company_id?, domain?, company_name?, trigger_context? }
 * Output: { profile_id, total_steps, company_id, domain, status? }
 *         oder { status: 'no_domain', company_id }
 */

import { createClient } from '@supabase/supabase-js';
import { getProfileUrls } from './_shared/html-fetch.mjs';
import { resolveCompanyWebsite } from './nexus-domain-discovery.mjs';

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
    const { company_id, domain, company_name, trigger_context } = JSON.parse(event.body || '{}');

    if (!company_id && !company_name) {
      return { statusCode: 400, body: JSON.stringify({ error: 'company_id or company_name required' }) };
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

    // ── 1. Company auflösen ──
    let resolvedCompanyId = company_id || null;
    let resolvedDomain = domain || null;
    let companyName = (company_name || '').trim();

    if (!resolvedCompanyId && companyName) {
      // Zuerst eigene Companies, dann globaler Fallback
      const ownRes = await serviceClient
        .from('nexus_companies')
        .select('id, name, domain')
        .eq('user_id', user.id)
        .ilike('name', companyName)
        .limit(1);
      let company = ownRes.data?.[0] || null;

      if (!company) {
        const globalRes = await serviceClient
          .from('nexus_companies')
          .select('id, name, domain')
          .ilike('name', companyName)
          .limit(1);
        company = globalRes.data?.[0] || null;
      }

      if (!company) {
        const { data: created, error: createErr } = await serviceClient
          .from('nexus_companies')
          .insert({ user_id: user.id, name: companyName, updated_at: new Date().toISOString() })
          .select('id, name, domain')
          .single();
        if (createErr) {
          console.error('[CompanyProfileStart] Company insert error:', createErr.message);
          return { statusCode: 500, body: JSON.stringify({ error: 'Company konnte nicht angelegt werden', details: createErr.message }) };
        }
        company = created;
      }

      resolvedCompanyId = company.id;
      if (!resolvedDomain && company.domain) resolvedDomain = company.domain;
      if (!companyName) companyName = company.name;
    }

    // ── 2. Domain auflösen ──
    if (!resolvedDomain && companyName) {
      console.log(`[CompanyProfileStart] Resolving domain for "${companyName}"...`);
      try {
        const discovery = await resolveCompanyWebsite(companyName);
        if (discovery?.domain) {
          resolvedDomain = discovery.domain;
          // Domain für die Zukunft speichern
          serviceClient
            .from('nexus_companies')
            .update({ domain: resolvedDomain, domain_status: 'verified', updated_at: new Date().toISOString() })
            .eq('id', resolvedCompanyId)
            .then(() => {})
            .catch(() => {});
        }
      } catch (e) {
        console.warn('[CompanyProfileStart] Domain resolution failed:', e.message);
      }
    }

    if (!resolvedDomain) {
      return {
        statusCode: 200,
        body: JSON.stringify({
          status: 'no_domain',
          company_id: resolvedCompanyId,
          message: 'Keine Firmenwebsite gefunden — Analyse ohne Web-Profil.'
        })
      };
    }

    // Duplikatschutz: Existiert bereits ein laufender Job?
    const existingRes = await serviceClient
      .from('nexus_company_profiles')
      .select('id, status')
      .eq('company_id', resolvedCompanyId)
      .eq('status', 'running')
      .order('updated_at', { ascending: false })
      .limit(1);

    if (existingRes.data && existingRes.data.length > 0) {
      console.log(`[CompanyProfileStart] Running job already exists: ${existingRes.data[0].id}`);
      return {
        statusCode: 200,
        body: JSON.stringify({
          profile_id: existingRes.data[0].id,
          company_id: resolvedCompanyId,
          domain: resolvedDomain,
          status: 'already_running',
          message: 'Ein Firmenprofil-Scan läuft bereits für dieses Unternehmen.'
        })
      };
    }

    // Frisches done-Profil (max. 7 Tage) wiederverwenden — kein Rescan
    const doneRes = await serviceClient
      .from('nexus_company_profiles')
      .select('id, updated_at')
      .eq('company_id', resolvedCompanyId)
      .eq('status', 'done')
      .order('updated_at', { ascending: false })
      .limit(1);

    if (doneRes.data && doneRes.data.length > 0) {
      const age = Date.now() - new Date(doneRes.data[0].updated_at).getTime();
      if (age < 7 * 24 * 60 * 60 * 1000) {
        console.log(`[CompanyProfileStart] Fresh done profile exists: ${doneRes.data[0].id}`);
        return {
          statusCode: 200,
          body: JSON.stringify({
            profile_id: doneRes.data[0].id,
            company_id: resolvedCompanyId,
            domain: resolvedDomain,
            status: 'already_done',
            total_steps: 0
          })
        };
      }
    }

    // Ziel-URLs ermitteln
    const pendingUrls = getProfileUrls(resolvedDomain);
    const totalSteps = pendingUrls.length;

    console.log(`[CompanyProfileStart] Starting for "${resolvedDomain}" — ${totalSteps} URLs`);

    // Neuen Job anlegen
    const { data: job, error: jobError } = await serviceClient
      .from('nexus_company_profiles')
      .insert({
        company_id: resolvedCompanyId,
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
      body: JSON.stringify({
        profile_id: job.id,
        company_id: resolvedCompanyId,
        domain: resolvedDomain,
        total_steps: totalSteps
      })
    };

  } catch (err) {
    console.error('[CompanyProfileStart] Fatal error:', err);
    return { statusCode: 500, body: JSON.stringify({ error: 'Internal server error', details: err.message }) };
  }
};
