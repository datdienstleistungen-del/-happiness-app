/**
 * NeXus Elite Enrichment
 *
 * Verkettet die bestehenden Module zu einer Elite-Anreicherung:
 *   nexus-email-crawler.mjs → nexus-smtp-utils.mjs → Lead Package Update
 *
 * Trigger: Nur auf Anfrage (Button im Frontend), nicht automatisch.
 * Auth: JWT (eingeloggter User).
 * Gate: premiumTier != 'free' + Rate-Limit pro User.
 */

import ws from 'ws';
if (typeof globalThis.WebSocket === 'undefined') {
  globalThis.WebSocket = ws;
}
import { createClient } from '@supabase/supabase-js';
import { runEmailPatternCrawler } from './nexus-email-crawler.mjs';
import { findMxHosts, smtpCheck, isCatchAll } from './nexus-smtp-utils.mjs';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

const ELITE_TIER_LIMITS = { free: 0, pro: 3, enterprise: 20 };

// ============================================================================
// MAIN HANDLER
// ============================================================================

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type, Authorization' } };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const { leadPackageId } = JSON.parse(event.body || '{}');
    if (!leadPackageId) {
      return { statusCode: 400, body: JSON.stringify({ error: 'leadPackageId required' }) };
    }

    // 1. Auth: JWT → user
    const authHeader = event.headers.authorization;
    if (!authHeader) {
      return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };
    }

    const userSupabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });
    const { data: { user }, error: authError } = await userSupabase.auth.getUser();
    if (authError || !user) {
      return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };
    }

    // 2. Tier-Check: freeUser darf keine Elite-Calls machen
    const serviceClient = createClient(supabaseUrl, supabaseKey);
    const { data: settings } = await serviceClient
      .from('ai_settings')
      .select('premium_tier')
      .eq('user_id', user.id)
      .single();

    const premiumTier = settings?.premium_tier || 'free';
    const maxEliteCalls = ELITE_TIER_LIMITS[premiumTier] || 0;

    if (maxEliteCalls === 0) {
      return {
        statusCode: 403,
        body: JSON.stringify({
          error: 'Elite enrichment requires pro or enterprise subscription',
          tier: premiumTier
        })
      };
    }

    // 3. Rate-Limit: Elite-Calls heute prüfen
    const today = new Date().toISOString().split('T')[0];
    const { data: usage } = await serviceClient
      .from('nexus_api_usage')
      .select('elite_calls_today, last_request_date')
      .eq('user_id', user.id)
      .single();

    let eliteCallsToday = 0;
    if (usage) {
      eliteCallsToday = usage.last_request_date === today ? (usage.elite_calls_today || 0) : 0;
    }

    if (eliteCallsToday >= maxEliteCalls) {
      return {
        statusCode: 429,
        body: JSON.stringify({
          error: `Elite call limit reached. Max ${maxEliteCalls} per day for ${premiumTier} tier.`,
          used: eliteCallsToday,
          limit: maxEliteCalls
        })
      };
    }

    // 4. Lead Package laden (RLS stellt Ownership sicher)
    const { data: pkg, error: pkgError } = await serviceClient
      .from('nexus_lead_packages')
      .select('*, nexus_events(event_type, title, company_name)')
      .eq('id', leadPackageId)
      .eq('user_id', user.id)
      .single();

    if (pkgError || !pkg) {
      return { statusCode: 404, body: JSON.stringify({ error: 'Lead package not found' }) };
    }

    if (pkg.package_tier === 'elite') {
      return {
        statusCode: 200,
        body: JSON.stringify({
          status: 'already_elite',
          package: pkg,
          message: 'Package is already elite-enriched'
        })
      };
    }

    // 5. company_name + company_domain extrahieren
    const companyName = pkg.nexus_events?.company_name || pkg.company_data?.name;
    const companyDomain = pkg.company_data?.domain;

    if (!companyName) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'No company name available for enrichment' })
      };
    }

    console.log(`[EliteEnrichment] Starting for "${companyName}" (domain: ${companyDomain || 'unknown'})`);

    // 6. Email Crawler: Domain → Muster → Person → Email
    // Standard: CEO/Geschäftsführer suchen, wenn keine Rolle bekannt
    const crawlerResult = await runEmailPatternCrawler({
      companyName,
      domain: companyDomain || null,
      targetRoleOrName: 'CEO Geschäftsführer Entscheider'
    });

    if (!crawlerResult.success || !crawlerResult.person?.email) {
      console.log(`[EliteEnrichment] No email found: ${crawlerResult.reason || 'no person'}`);

      // Elite-Calls-Zähler aktualisieren (auch bei Misserfolg)
      await updateEliteCalls(serviceClient, user.id, today, usage, eliteCallsToday);

      return {
        statusCode: 200,
        body: JSON.stringify({
          status: 'no_email_found',
          package_id: leadPackageId,
          crawler_reason: crawlerResult.reason || null,
          domain: crawlerResult.domain || null
        })
      };
    }

    const person = crawlerResult.person;
    console.log(`[EliteEnrichment] Email found: ${person.email} (confidence: ${person.email_confidence})`);

    // 7. SMTP-Verify
    let emailVerification = { status: 'skipped', confidence: person.email_confidence };
    const cleanDomain = (crawlerResult.domain || '').replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];

    if (cleanDomain) {
      try {
        const mxHosts = await findMxHosts(cleanDomain);
        if (mxHosts.length > 0) {
          const mxHost = mxHosts[0];
          const catchAll = await isCatchAll(mxHost, cleanDomain);

          if (catchAll) {
            emailVerification = { status: 'catch_all', confidence: person.email_confidence, message: 'Domain accepts all addresses' };
          } else {
            const smtpResult = await smtpCheck(mxHost, person.email, 10000);
            emailVerification = {
              status: smtpResult.success ? 'verified' : 'invalid',
              confidence: smtpResult.success ? 95 : 0,
              smtp_code: smtpResult.code,
              message: smtpResult.message
            };
          }
        }
      } catch (e) {
        console.warn(`[EliteEnrichment] SMTP verify failed: ${e.message}`);
        emailVerification = { status: 'error', confidence: person.email_confidence, message: e.message };
      }
    }

    // 8. Lead Package updaten
    const contactData = {
      name: person.name,
      role: person.role,
      email: person.email,
      email_confidence: emailVerification.confidence || person.email_confidence,
      email_source: person.email_source || 'website',
      email_verification: emailVerification.status,
      email_smtp_code: emailVerification.smtp_code || null,
      linkedin_url: null,
      enriched_at: new Date().toISOString()
    };

    const { error: updateError } = await serviceClient
      .from('nexus_lead_packages')
      .update({
        contacts: [contactData],
        has_contact: true,
        package_tier: 'elite',
        updated_at: new Date().toISOString()
      })
      .eq('id', leadPackageId);

    if (updateError) {
      console.error('[EliteEnrichment] Update failed:', updateError.message);
      return { statusCode: 500, body: JSON.stringify({ error: 'Failed to update package' }) };
    }

    // 9. Elite-Calls-Zähler aktualisieren
    await updateEliteCalls(serviceClient, user.id, today, usage, eliteCallsToday);

    // 10. Kosten-Log
    try {
      await serviceClient.from('nexus_cost_log').insert({
        user_id: user.id,
        event_id: pkg.event_id,
        provider: 'email_crawler+smtp',
        operation: 'elite_enrichment',
        tokens_in: 0,
        tokens_out: 0,
        cost_usd: 0.002
      });
    } catch (e) { /* ignore */ }

    console.log(`[EliteEnrichment] Done: ${person.name} <${person.email}> (${emailVerification.status})`);

    return {
      statusCode: 200,
      body: JSON.stringify({
        status: 'enriched',
        package_id: leadPackageId,
        contact: contactData,
        email_verification: emailVerification
      })
    };

  } catch (e) {
    console.error('[EliteEnrichment] Error:', e.message);
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};

// ============================================================================
// HELPER
// ============================================================================

async function updateEliteCalls(client, userId, today, usage, currentCount) {
  const newCount = currentCount + 1;
  if (usage && usage.last_request_date === today) {
    await client.from('nexus_api_usage').update({
      elite_calls_today: newCount
    }).eq('user_id', userId);
  } else {
    await client.from('nexus_api_usage').upsert({
      user_id: userId,
      elite_calls_today: newCount,
      requests_today: usage?.requests_today || 0,
      last_request_date: today
    }, { onConflict: 'user_id' });
  }
}
