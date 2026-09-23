/**
 * NeXus Entity Resolution (Phase 0)
 *
 * Löst Companies und Events auf:
 * 1. Company: Domain-Matching → Name-Matching → Neu anlegen
 * 2. Event: company + type + date → Dedup oder Neu
 *
 * DESIGN PRINZIP: UNRESOLVED statt falsche Zuordnung.
 */

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

function authHeaders(token) {
  return {
    apikey: SUPABASE_KEY,
    Authorization: `Bearer ${token || SUPABASE_KEY}`,
    'Content-Type': 'application/json',
    Prefer: 'return=representation'
  };
}

/**
 * Findet oder erstellt eine Company.
 * Priorität: Domain → Name (ilike) → Neu anlegen.
 * Bei Unsicherheit: company_name bleibt, company_id = null.
 */
export async function resolveCompany(userId, { name, domain }, token) {
  const headers = authHeaders(token);

  // 1. Versuche Domain-Matching
  if (domain && domain.length > 3) {
    const cleanDomain = domain.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0].toLowerCase();
    try {
      const domainRes = await fetch(
        `${SUPABASE_URL}/rest/v1/nexus_companies?user_id=eq.${userId}&domain=eq.${encodeURIComponent(cleanDomain)}&select=*`,
        { headers }
      );
      if (domainRes.ok) {
        const domainData = await domainRes.json();
        if (Array.isArray(domainData) && domainData.length > 0) return { company: domainData[0], isNew: false };
      }
    } catch (e) { /* ignore */ }
  }

  // 2. Versuche Name-Matching (ilike)
  if (name && name !== 'UNRESOLVED') {
    try {
      const nameRes = await fetch(
        `${SUPABASE_URL}/rest/v1/nexus_companies?user_id=eq.${userId}&name=ilike.${encodeURIComponent(name)}&select=*`,
        { headers }
      );
      if (nameRes.ok) {
        const nameData = await nameRes.json();
        if (Array.isArray(nameData) && nameData.length > 0) return { company: nameData[0], isNew: false };
      }
    } catch (e) { /* ignore */ }
  }

  // 3. Neue Company anlegen
  if (name && name !== 'UNRESOLVED') {
    try {
      const createRes = await fetch(`${SUPABASE_URL}/rest/v1/nexus_companies`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          user_id: userId,
          name: name,
          domain: domain || null,
          ai_confidence: 70
        })
      });
      if (createRes.ok) {
        const createData = await createRes.json();
        if (Array.isArray(createData) && createData.length > 0) return { company: createData[0], isNew: true };
      }
    } catch (e) { /* ignore */ }
  }

  // 4. UNRESOLVED — keine falsche Zuordnung
  return { company: null, isNew: false, unresolved: true };
}

/**
 * Findet oder erstellt ein Event.
 * Matching: company_name (ilike) + event_type + event_date (±7 Tage)
 * Bei Duplikat: source_count++, raw_event_ids++.
 */
export async function resolveEvent(userId, eventData, token) {
  const headers = authHeaders(token);

  // Event-Dedup: company + type + date (±7 Tage)
  if (eventData.company_name && eventData.company_name !== 'UNRESOLVED') {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const sevenDaysAhead = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    let existing = [];
    try {
      const dedupRes = await fetch(
        `${SUPABASE_URL}/rest/v1/nexus_events?user_id=eq.${userId}&company_name=ilike.${encodeURIComponent(eventData.company_name)}&event_type=eq.${eventData.event_type}&event_date=gte.${sevenDaysAgo}&event_date=lte.${sevenDaysAhead}&select=*`,
        { headers }
      );
      if (dedupRes.ok) {
        existing = await dedupRes.json();
      }
    } catch (e) { /* ignore */ }

    if (Array.isArray(existing) && existing.length > 0) {
      // Duplikat: aktualisiere source_count
      const existingEvent = existing[0];
      const newRawIds = [...(existingEvent.raw_event_ids || []), ...(eventData.raw_event_ids || [])];
      const newSourceCount = (existingEvent.source_count || 0) + 1;

      await fetch(`${SUPABASE_URL}/rest/v1/nexus_events?id=eq.${existingEvent.id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({
          source_count: newSourceCount,
          raw_event_ids: newRawIds,
          updated_at: new Date().toISOString()
        })
      }).catch(() => {});

      return { event: { ...existingEvent, source_count: newSourceCount }, isDuplicate: true };
    }
  }

  // Neues Event anlegen
  let data = null;
  try {
    const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/nexus_events`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        user_id: userId,
        event_type: eventData.event_type,
        event_subtype: eventData.event_subtype || null,
        title: eventData.title,
        description: eventData.description || null,
        company_id: eventData.company_id || null,
        company_name: eventData.company_name || 'UNRESOLVED',
        company_domain: eventData.company_domain || null,
        country: eventData.country || null,
        region: eventData.region || null,
        city: eventData.city || null,
        event_date: eventData.event_date || null,
        confidence: eventData.confidence || null,
        verification_status: 'unverified',
        source_count: eventData.source_count || 1,
        raw_event_ids: eventData.raw_event_ids || []
      })
    });
    if (insertRes.ok) {
      data = await insertRes.json();
    }
  } catch (e) { /* ignore */ }

  if (Array.isArray(data) && data.length > 0) return { event: data[0], isDuplicate: false };

  return { event: null, isDuplicate: false, error: 'Failed to create event' };
}

/**
 * Kombinierte Entity Resolution: Company + Event.
 */
export async function resolveEventWithCompany(userId, eventData, token) {
  // 1. Company auflösen
  const { company, isNew, unresolved } = await resolveCompany(userId, {
    name: eventData.company_name,
    domain: eventData.company_domain
  }, token);

  // 2. Event auflösen (mit oder ohne company_id)
  const eventPayload = {
    ...eventData,
    company_id: company?.id || null,
    company_name: unresolved ? 'UNRESOLVED' : (eventData.company_name || 'UNRESOLVED')
  };

  return resolveEvent(userId, eventPayload, token);
}
