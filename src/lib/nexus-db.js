import { supabase } from './supabase'

/**
 * NeXus Database Helper V2 (Sales Operating System Architecture)
 * 
 * Speichert und lädt NeXus-Daten aus Supabase.
 * Soft-Deletes: Alle GET-Abfragen ignorieren Sätze mit deleted_at != null.
 */

// -----------------------------------------------------------------------------
// 1. ANALYSEN (Legacy / Core AI Brain)
// -----------------------------------------------------------------------------

export async function saveAnalysis({ angbot, branche, analyseResult, userId }) {
  const { data, error } = await supabase
    .from('nexus_analyses')
    .insert({
      user_id: userId,
      angebot: angbot,
      branche: branche,
      analyse_result: analyseResult,
      zielgruppe: analyseResult?.zielgruppe || null,
      schmerzpunkte: analyseResult?.schmerzpunkte || null,
      trigger_events: analyseResult?.trigger_events || null,
      vertriebsstrategie: analyseResult?.vertriebsstrategie || null,
      pitch_grundlage: analyseResult?.pitch_grundlage || null,
      updated_at: new Date().toISOString()
    })
    .select()
    .single()

  if (error) {
    console.error('[NeXus DB] Save analysis error:', error.message)
    return null
  }
  return data
}

export async function getAnalyses(userId, limit = 20) {
  const { data, error } = await supabase
    .from('nexus_analyses')
    .select('*')
    .eq('user_id', userId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    console.error('[NeXus DB] Get analyses error:', error.message)
    return []
  }
  return data
}

export async function getAnalysisById(analysisId) {
  const { data, error } = await supabase
    .from('nexus_analyses')
    .select('*')
    .eq('id', analysisId)
    .is('deleted_at', null)
    .single()

  if (error) {
    console.error('[NeXus DB] Get analysis by id error:', error.message)
    return null
  }
  return data
}

// -----------------------------------------------------------------------------
// 2. OFFERINGS (Angebote)
// -----------------------------------------------------------------------------

export async function createOffering(userId, data) {
  const { data: result, error } = await supabase
    .from('nexus_offerings')
    .insert({ user_id: userId, ...data, updated_at: new Date().toISOString() })
    .select()
    .single()
  
  if (error) { console.error('[NeXus DB] Create offering error:', error.message); return null; }
  return result;
}

export async function getOfferings(userId) {
  const { data, error } = await supabase
    .from('nexus_offerings')
    .select('*')
    .eq('user_id', userId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });
  return error ? [] : data;
}

export async function getOfferingById(id) {
  const { data, error } = await supabase.from('nexus_offerings').select('*').eq('id', id).single();
  return error ? null : data;
}

// -----------------------------------------------------------------------------
// 2b. SIGNAL STRATEGIES (Suchstrategien pro Offering)
// -----------------------------------------------------------------------------

export async function getSignalStrategies(offeringId) {
  const { data, error } = await supabase
    .from('nexus_signal_strategies')
    .select('*')
    .eq('offering_id', offeringId)
    .order('created_at', { ascending: false });
  return error ? [] : data;
}

export async function generateSignalStrategies(offeringId, aiUnderstanding, targetMarkets, uiLanguage = 'de') {
  const { data: { session } } = await supabase.auth.getSession()
  const token = session?.access_token || ''

  const res = await fetch('/.netlify/functions/nexus-generate-strategies', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ offeringId, aiUnderstanding, targetMarkets, uiLanguage })
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Strategy generation failed: ${res.statusText}`);
  }

  const result = await res.json();
  return result.strategies || [];
}

// -----------------------------------------------------------------------------
// 3. COMPANIES (Firmen)
// -----------------------------------------------------------------------------

export async function createCompany(userId, data) {
  const { data: result, error } = await supabase
    .from('nexus_companies')
    .insert({ user_id: userId, ...data, updated_at: new Date().toISOString() })
    .select()
    .single()
  
  if (error) { 
    console.error('[NeXus DB] Create company error:', error.message); 
    throw new Error(`Company DB Error: ${error.message}`); 
  }
  return result;
}

export async function updateCompany(id, updates) {
  const { data, error } = await supabase
    .from('nexus_companies')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
  
  if (error) { console.error('[NeXus DB] Update company error:', error.message); return null; }
  return data;
}

export async function getCompanyByDomain(userId, domain) {
  if (!domain || domain.trim() === '') return null;
  const { data, error } = await supabase
    .from('nexus_companies')
    .select('*')
    .eq('user_id', userId)
    .eq('domain', domain)
    .is('deleted_at', null)
    .single()
  return error ? null : data;
}

export async function linkCompanyOffering(companyId, offeringId) {
  const { error } = await supabase
    .from('nexus_company_offerings')
    .upsert({ company_id: companyId, offering_id: offeringId }, { onConflict: 'company_id, offering_id' })
  if (error) console.error('[NeXus DB] Link company offering error:', error.message);
  return !error;
}

// -----------------------------------------------------------------------------
// 4. CONTACTS (Entscheider)
// -----------------------------------------------------------------------------

export async function createContact(userId, companyId, data) {
  const { data: result, error } = await supabase
    .from('nexus_contacts')
    .insert({ user_id: userId, company_id: companyId, ...data, updated_at: new Date().toISOString() })
    .select()
    .single()
  if (error) { console.error('[NeXus DB] Create contact error:', error.message); return null; }
  return result;
}

export async function getContactsByCompany(companyId) {
  const { data, error } = await supabase
    .from('nexus_contacts')
    .select('*')
    .eq('company_id', companyId)
    .is('deleted_at', null)
  return error ? [] : data;
}

// -----------------------------------------------------------------------------
// 5. TRIGGERS & RESEARCH (Signale)
// -----------------------------------------------------------------------------

export async function createTriggerEvent(userId, data) {
  const { data: result, error } = await supabase
    .from('nexus_trigger_events')
    .insert({ user_id: userId, ...data, updated_at: new Date().toISOString() })
    .select()
    .single()
  if (error) { 
    console.error('[NeXus DB] Create trigger error:', error.message); 
    throw new Error(error.message); 
  }
  return result;
}

export async function updateTriggerEvent(id, updates) {
  const { data, error } = await supabase
    .from('nexus_trigger_events')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
  return error ? null : data;
}

export async function getTriggerEvents(userId, status = null, limit = 50) {
  let query = supabase.from('nexus_trigger_events').select('*').eq('user_id', userId).is('deleted_at', null).order('created_at', { ascending: false }).limit(limit);
  if (status) query = query.eq('status', status);
  const { data, error } = await query;
  return error ? [] : data;
}

export async function getRadarHits(userId, offeringId = null, limit = 50) {
  let query = supabase.from('nexus_radar_hits')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'relevant')
    .order('created_at', { ascending: false })
    .limit(limit);
  
  if (offeringId) {
    query = query.eq('offering_id', offeringId);
  }
  
  const { data, error } = await query;
  if (error) {
    console.error('[NeXus DB] Get radar hits error:', error.message);
    return [];
  }
  return data;
}

export async function createResearch(userId, triggerId, data) {
  const { data: result, error } = await supabase
    .from('nexus_research')
    .insert({ user_id: userId, trigger_id: triggerId, ...data, updated_at: new Date().toISOString() })
    .select()
    .single()
  if (error) { console.error('[NeXus DB] Create research error:', error.message); return null; }
  return result;
}

// -----------------------------------------------------------------------------
// 6. OPPORTUNITIES (CRM)
// -----------------------------------------------------------------------------

export async function createOpportunity(userId, companyId, data) {
  const { data: result, error } = await supabase
    .from('nexus_opportunities')
    .insert({ user_id: userId, company_id: companyId, ...data, updated_at: new Date().toISOString() })
    .select()
    .single()
  
  if (error) { 
    console.error('[NeXus DB] Create opportunity error:', error.message); 
    throw new Error(`Opportunity DB Error: ${error.message}`); 
  }
  return result;
}

export async function updateOpportunity(id, updates) {
  const { data, error } = await supabase
    .from('nexus_opportunities')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
  return error ? null : data;
}

export async function getOpportunities(userId, pipelineStage = null) {
  let query = supabase.from('nexus_opportunities').select('*, nexus_companies(*)').eq('user_id', userId).is('deleted_at', null).order('created_at', { ascending: false });
  if (pipelineStage) query = query.eq('pipeline_stage', pipelineStage);
  const { data, error } = await query;
  return error ? [] : data;
}

export async function getOpportunityById(id) {
  const { data, error } = await supabase.from('nexus_opportunities').select('*, nexus_companies(*)').eq('id', id).is('deleted_at', null).single();
  return error ? null : data;
}

export async function getOpportunityContext(id) {
  // Fetch everything needed for the Lead-Akte except activities (because of polymorphic relation)
  const { data, error } = await supabase
    .from('nexus_opportunities')
    .select(`
      *,
      company:nexus_companies(*),
      offering:nexus_offerings(*),
      contacts:nexus_opportunity_contacts(nexus_contacts(*)),
      triggers:nexus_opportunity_triggers(nexus_trigger_events(*)),
      generated_content:nexus_generated_content(*)
      
    `)
    .eq('id', id)
    .single();

  if (error || !data) return null;

  // Fetch activities separately since they use a polymorphic entity_id
  const { data: acts } = await supabase
    .from('nexus_activities')
    .select('*')
    .eq('entity_type', 'opportunity')
    .eq('entity_id', id);

  data.activities = acts || [];

  // Fetch research based on the triggers associated with this opportunity
  const triggerIds = data.triggers ? data.triggers.map(t => t.nexus_trigger_events?.id).filter(Boolean) : [];
  if (triggerIds.length > 0) {
    const { data: researchData, error: researchErr } = await supabase
      .from('nexus_research')
      .select('*')
      .in('trigger_id', triggerIds);
      
    if (researchErr) {
      console.error('[NeXus DB] Error fetching research for triggers:', researchErr);
      data.research = [];
    } else {
      data.research = researchData || [];
    }
  } else {
    data.research = [];
  }
  return data;
}

export async function saveOpportunityContact(userId, companyId, opportunityId, contactName, contactRole, source = 'tavily', confidence = 0) {
  // Split name into first_name + last_name
  const nameParts = (contactName || '').trim().split(/\s+/);
  const firstName = nameParts[0] || '';
  const lastName = nameParts.slice(1).join(' ') || '';

  // 1. Insert into nexus_contacts
  const { data: contact, error: err1 } = await supabase
    .from('nexus_contacts')
    .insert({ user_id: userId, company_id: companyId, first_name: firstName, last_name: lastName, role: contactRole })
    .select()
    .single();
  
  if (err1) { console.error('[NeXus DB] saveOpportunityContact insert error:', err1); return null; }

  // 2. Link to opportunity
  const { error: err2 } = await supabase
    .from('nexus_opportunity_contacts')
    .insert({ opportunity_id: opportunityId, contact_id: contact.id, is_primary: true });
    
  if (err2) { console.error('[NeXus DB] saveOpportunityContact link error:', err2); return null; }
  
  // 3. Log Activity
  await logActivity(userId, 'opportunity', opportunityId, 'SYSTEM', 'NeXus AI', 'contact_added', `Ansprechpartner ${contactName} gefunden (Quelle: ${source}).`);

  return contact;
}

export async function deleteOpportunity(id) {
  // Soft delete
  const { error } = await supabase
    .from('nexus_opportunities')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id);
  if (error) { console.error('[NeXus DB] Delete opportunity error:', error.message); return false; }
  return true;
}

export async function linkContactToOpportunity(opportunityId, contactId, role = 'Decision Maker', isPrimary = false) {
  const { error } = await supabase
    .from('nexus_opportunity_contacts')
    .upsert({ opportunity_id: opportunityId, contact_id: contactId, role_in_opportunity: role, is_primary: isPrimary }, { onConflict: 'opportunity_id, contact_id' })
  return !error;
}

export async function linkTriggerToOpportunity(opportunityId, triggerId) {
  const { error } = await supabase
    .from('nexus_opportunity_triggers')
    .upsert({ opportunity_id: opportunityId, trigger_id: triggerId }, { onConflict: 'opportunity_id, trigger_id' })
  return !error;
}

// -----------------------------------------------------------------------------
// 7. CONTENT & ACTIVITY (Execution & Auditing)
// -----------------------------------------------------------------------------

export async function saveGeneratedContent(userId, opportunityId, type, content, metadata = {}) {
  const contentStr = typeof content === 'object' ? JSON.stringify(content) : content;
  
  // Map internal frontend types to strict database enum values
  let dbType = 'email';
  if (type === 'sales_pitch') dbType = 'pitch';
  else if (type === 'forum_response') dbType = 'linkedin';
  
  const { data, error } = await supabase
    .from('nexus_generated_content')
    .insert({ 
      user_id: userId, 
      opportunity_id: opportunityId, 
      type: dbType, 
      content: contentStr, 
      ...metadata,
      updated_at: new Date().toISOString() 
    })
    .select()
    .single()
  if (error) { console.error('[NeXus DB] Save content error:', error.message); return null; }
  return data;
}

export async function logActivity(userId, entityType, entityId, actorType, actorName, activityType, description, metadata = {}) {
  const { data, error } = await supabase
    .from('nexus_activities')
    .insert({
      user_id: userId,
      entity_type: entityType,
      entity_id: entityId,
      actor_type: actorType,
      actor_name: actorName,
      activity_type: activityType,
      description: description,
      metadata: metadata
    })
    .select()
    .single()
  if (error) { console.error('[NeXus DB] Log activity error:', error.message); return null; }
  return data;
}

export async function getActivitiesForEntity(entityType, entityId) {
  const { data, error } = await supabase
    .from('nexus_activities')
    .select('*')
    .eq('entity_type', entityType)
    .eq('entity_id', entityId)
    .order('created_at', { ascending: false })
  return error ? [] : data;
}

// -----------------------------------------------------------------------------
// 8. DASHBOARD STATS
// -----------------------------------------------------------------------------

export async function getDashboardStats(userId) {
  const { count: totalOpps } = await supabase.from('nexus_opportunities').select('*', { count: 'exact', head: true }).eq('user_id', userId).is('deleted_at', null)
  const { count: newTriggers } = await supabase.from('nexus_radar_hits').select('*', { count: 'exact', head: true }).eq('user_id', userId).eq('status', 'relevant')
  
  return {
    totalOpps: totalOpps || 0,
    newTriggers: newTriggers || 0,
    totalAnalyses: totalOpps || 0, // Legacy key kept for UI compatibility, now counts opportunities
    winRate: 0,
    pipelineValue: 0
  }
}

export async function wipeAllUserData(userId) {
  const now = new Date().toISOString();
  // Soft-delete all user data across all tables
  await supabase.from('nexus_offerings').update({ deleted_at: now }).eq('user_id', userId).is('deleted_at', null);
  await supabase.from('nexus_opportunities').update({ deleted_at: now }).eq('user_id', userId).is('deleted_at', null);
  await supabase.from('nexus_trigger_events').update({ deleted_at: now }).eq('user_id', userId).is('deleted_at', null);
  await supabase.from('nexus_radar_hits').delete().eq('user_id', userId);
  await supabase.from('nexus_signal_strategies').delete().eq('user_id', userId);
  await supabase.from('nexus_contacts').delete().eq('user_id', userId);
  await supabase.from('nexus_generated_content').delete().eq('user_id', userId);
  await supabase.from('nexus_activities').delete().eq('user_id', userId);
  return true;
}
