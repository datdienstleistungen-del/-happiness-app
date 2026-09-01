export async function handler(event, context) {
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

  let authToken = supabaseKey;
  if (!process.env.SUPABASE_SERVICE_KEY && process.env.TEST_USER_EMAIL && process.env.TEST_USER_PASSWORD) {
    const authRes = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { 'apikey': supabaseKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: process.env.TEST_USER_EMAIL, password: process.env.TEST_USER_PASSWORD })
    });
    if (authRes.ok) {
      const authData = await authRes.json();
      authToken = authData.access_token;
    }
  }
  
  // Konfigurierbarer AI Provider (Standard: mistral)
  const aiProvider = process.env.BACKGROUND_AI_PROVIDER || 'mistral';
  const aiKey = aiProvider === 'deepseek' ? process.env.DEEPSEEK_API_KEY : process.env.MISTRAL_API_KEY;

  if (!supabaseUrl || !supabaseKey || !aiKey) {
    return { statusCode: 500, body: JSON.stringify({ error: "Missing config for B2 Eval Cron" }) };
  }

  console.log('Key prefix:', supabaseKey.substring(0, 10)); const BATCH_SIZE = 5; // Wir bewerten 5 Hits pro Lauf, um Timeouts zu vermeiden

  try {
    // 1. Reset von "Steckengebliebenen" (Crashed) Hits (via RPC um RLS zu umgehen)
    const resetRes = await fetch(`${supabaseUrl}/rest/v1/rpc/reset_crashed_radar_hits`, {
      method: 'POST',
      headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${authToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ hours_old: 1 })
    });
    if (!resetRes.ok) console.warn("B2 Cron: Konnte hängengebliebene Hits nicht zurücksetzen.");

    // 2. Atomarer Claim von pending Hits (RPC)
    const claimRes = await fetch(`${supabaseUrl}/rest/v1/rpc/claim_pending_radar_hits`, {
      method: 'POST',
      headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${authToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ batch_size: BATCH_SIZE })
    });

    console.log('Claim Res:', claimRes.status, await claimRes.clone().text()); if (!claimRes.ok) {
      console.error("Fehler beim Claiming der Hits:", await claimRes.text());
      return { statusCode: 500, body: "Hit Claim RPC failed" };
    }

    const hits = await claimRes.json();
    console.log(`B2 Cron: ${hits.length} pending Hits für KI-Auswertung geclaimt.`);

    if (hits.length === 0) {
      return { statusCode: 200, body: "Keine Hits zur Auswertung vorhanden." };
    }

    // Hole alle benötigten Offerings, um den Kontext zu haben
    const offeringIds = [...new Set(hits.map(h => h.offering_id))];
    const offRes = await fetch(`${supabaseUrl}/rest/v1/nexus_offerings?id=in.(${offeringIds.join(',')})`, {
      headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
    });
    const offeringsArray = offRes.ok ? await offRes.json() : [];
    const offeringsMap = {};
    offeringsArray.forEach(o => offeringsMap[o.id] = o);

    // 3. Iteration über die Hits und KI-Bewertung
    for (const hit of hits) {
      const offering = offeringsMap[hit.offering_id];
      if (!offering) {
        // Fallback: Irrelevant, wenn Offering fehlt
        await updateHit(hit.id, 'irrelevant', 0, 'Offering wurde gelöscht.', 'none', supabaseUrl, supabaseKey);
        continue;
      }

      console.log(`B2 Cron: Analysiere Hit ${hit.id} mit Provider ${aiProvider}`);
      
      const contentExcerpt = hit.raw_content ? hit.raw_content.substring(0, 3000) : hit.title;
      const prompt = `Analysiere diesen Textausschnitt und bewerte die Relevanz für das folgende Angebot.
      
ANGEBOT DES NUTZERS (DARAUF BASIERT DIE RELEVANZ!):
Titel: ${offering.offering_name}
Zielgruppe: ${offering.target_audience}
Nutzen/Value Proposition: ${offering.positioning || 'Keine Angabe'}

GEFUNDENER TEXT:
URL: ${hit.url}
Titel: ${hit.title}
Text: ${contentExcerpt}

Bewerte, ob dieser Text ein konkretes Ereignis (Trigger) oder einen Bedarf enthält, der zeigt, dass der Verfasser oder das genannte Unternehmen das obige Angebot des Nutzers jetzt brauchen könnte.

WICHTIG - KEINE ERFUNDENEN DATEN:
Erfinde NICHTS. Nutze NUR echte Firmennamen aus dem Text. Findest du keine konkrete Firma, gib null zurück.

Antworte strikt in JSON mit exakt diesen 6 Feldern:
1. "status": "relevant" oder "irrelevant"
2. "relevance_score": Zahl zwischen 0 und 100
3. "relevance_reason": Warum ist es relevant? Beziehe dich explizit auf das Angebot des Nutzers. (oder "N/A" falls irrelevant)
4. "trigger_type": Benenne die Art des Ereignisses in 1-3 Worten (z.B. "Expansion", "Neuorientierung", "Personalwechsel"). (oder "N/A")
5. "firmenname": Der exakte Name des B2B-Unternehmens, um das es in dem Text geht. WICHTIG: Nutze NUR echte Firmennamen aus dem Text. (oder null, falls keine konkrete Firma genannt wird)
6. "domain": Die Web-Domain der gefundenen Firma, falls sie im Text erwähnt wird (z.B. "firma.de"). (oder null)`;

      try {
        let aiResult;
        if (aiProvider === 'deepseek') {
          // DeepSeek API
          const dsRes = await fetch('https://api.deepseek.com/v1/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${aiKey}` },
            body: JSON.stringify({
              model: "deepseek-chat",
              response_format: { type: "json_object" },
              messages: [{ role: "system", content: "Du bist ein Vertriebsassistent. Antworte immer im JSON-Format." }, { role: "user", content: prompt }]
            })
          });
          const dsData = await dsRes.json();
          aiResult = JSON.parse(dsData.choices[0].message.content);
        } else {
          // Mistral API (Standard)
          const mRes = await fetch('https://api.mistral.ai/v1/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${aiKey}` },
            body: JSON.stringify({
              model: "mistral-small-latest",
              response_format: { type: "json_object" },
              messages: [{ role: "user", content: prompt }]
            })
          });
          const mData = await mRes.json();
          aiResult = JSON.parse(mData.choices[0].message.content);
        }

        console.log(`DEBUG: AI Result für Hit ${hit.id}:`, JSON.stringify(aiResult));

        // 4. Update in Supabase
        const finalStatus = (aiResult.status === 'relevant' && aiResult.relevance_score >= 50) ? 'relevant' : 'irrelevant';
        await updateHit(hit.id, finalStatus, aiResult.relevance_score, aiResult.relevance_reason, aiResult.trigger_type, supabaseUrl, supabaseKey, authToken);

        // 5. Automatische Opportunity erstellen (nur wenn relevant und Firma erkannt)
        if (finalStatus === 'relevant' && aiResult.firmenname && aiResult.firmenname !== 'N/A' && String(aiResult.firmenname).toLowerCase() !== 'null') {
          await createOpportunityFromHit(hit, offering, aiResult, supabaseUrl, supabaseKey, authToken);
        }

      } catch (err) {
        console.error(`B2 Cron: KI Fehler bei Hit ${hit.id}:`, err.message);
        // Wir setzen den Hit auf pending zurück, damit er später nochmal versucht wird
        await fetch(`${supabaseUrl}/rest/v1/nexus_radar_hits?id=eq.${hit.id}`, {
          method: 'PATCH',
          headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${authToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'pending', processing_started_at: null })
        });
      }
    }

    return { statusCode: 200, body: JSON.stringify({ message: `B2 Intelligence erfolgreich abgeschlossen. ${hits.length} Hits bewertet.` }) };

  } catch (globalErr) {
    console.error("B2 Cron: Globaler Fehler:", globalErr);
    return { statusCode: 500, body: JSON.stringify({ error: globalErr.message }) };
  }
}

async function createOpportunityFromHit(hit, offering, aiResult, supabaseUrl, supabaseKey, authToken) {
  try {
    const headers = { 'apikey': supabaseKey, 'Authorization': `Bearer ${authToken || supabaseKey}`, 'Content-Type': 'application/json', 'Prefer': 'return=representation' };
    
    // 1. Company dedup (by domain or name+user_id)
    let company = null;
    if (aiResult.domain && aiResult.domain !== 'N/A' && String(aiResult.domain).toLowerCase() !== 'null') {
      const getC = await fetch(`${supabaseUrl}/rest/v1/nexus_companies?user_id=eq.${hit.user_id}&domain=eq.${encodeURIComponent(aiResult.domain)}&select=*`, { headers });
      if (getC.ok) {
        const cData = await getC.json();
        if (cData.length > 0) company = cData[0];
      }
    }
    
    if (!company) {
      // Fallback: search by name
      const getC = await fetch(`${supabaseUrl}/rest/v1/nexus_companies?user_id=eq.${hit.user_id}&name=ilike.${encodeURIComponent(aiResult.firmenname)}&select=*`, { headers });
      if (getC.ok) {
        const cData = await getC.json();
        if (cData.length > 0) company = cData[0];
      }
    }

    if (!company) {
      // Create company
      const postC = await fetch(`${supabaseUrl}/rest/v1/nexus_companies`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          user_id: hit.user_id,
          name: aiResult.firmenname,
          domain: aiResult.domain && aiResult.domain !== 'N/A' && String(aiResult.domain).toLowerCase() !== 'null' ? aiResult.domain : null,
          ai_confidence: aiResult.relevance_score || 85
        })
      });
      if (postC.ok) {
        const cData = await postC.json();
        company = cData[0];
      }
    }

    if (!company || !company.id) {
      console.warn(`B2 Cron: Konnte Company für Hit ${hit.id} nicht anlegen/finden.`);
      return;
    }

    // 2. Link Company to Offering (M:N)
    await fetch(`${supabaseUrl}/rest/v1/nexus_company_offerings?on_conflict=company_id,offering_id`, {
      method: 'POST',
      headers: { ...headers, 'Prefer': 'resolution=ignore-duplicates' },
      body: JSON.stringify({ company_id: company.id, offering_id: offering.id })
    });

    // 3. Create Trigger Event
    let triggerEvent = null;
    const postT = await fetch(`${supabaseUrl}/rest/v1/nexus_trigger_events`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        user_id: hit.user_id,
        company_id: company.id,
        signal_type: aiResult.trigger_type || 'KI_DETECTED',
        content: `Radar Hit: ${hit.title}\nGrund: ${aiResult.relevance_reason}`,
        source: 'Cron Radar B2',
        confidence_score: (aiResult.relevance_score || 80) / 100.0,
        status: 'new'
      })
    });
    if (postT.ok) {
      const tData = await postT.json();
      triggerEvent = tData[0];
    }

    if (!triggerEvent || !triggerEvent.id) return;

    // 4. Opportunity Dedup
    let opp = null;
    const getOpp = await fetch(`${supabaseUrl}/rest/v1/nexus_opportunities?user_id=eq.${hit.user_id}&company_id=eq.${company.id}&offering_id=eq.${offering.id}&select=*`, { headers });
    if (getOpp.ok) {
      const oData = await getOpp.json();
      // TODO (Architektur-Annahme): Aktuell gibt es im Frontend noch kein Kanban/Drag&Drop für Stages.
      // Falls später eigene Stage-Namen (z.B. 'closed_won', 'abgeschlossen') eingeführt werden, 
      // MUSS diese Filter-Logik ('won', 'lost', 'closed') hier zwingend angepasst werden, 
      // andernfalls werden geschlossene Opportunities fälschlicherweise als "offen" behandelt!
      opp = oData.find(o => o.pipeline_stage !== 'won' && o.pipeline_stage !== 'lost' && o.pipeline_stage !== 'closed');
    }

    let isNewOpp = false;
    if (!opp) {
      // Create Opportunity
      const postO = await fetch(`${supabaseUrl}/rest/v1/nexus_opportunities`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          user_id: hit.user_id,
          company_id: company.id,
          offering_id: offering.id,
          pipeline_stage: 'opportunity',
          source: 'Trigger Radar',
          created_from: 'AI'
        })
      });
      if (postO.ok) {
        const oData = await postO.json();
        opp = oData[0];
        isNewOpp = true;
      }
    }

    if (!opp || !opp.id) return;

    // 5. Link Trigger to Opportunity
    await fetch(`${supabaseUrl}/rest/v1/nexus_opportunity_triggers?on_conflict=opportunity_id,trigger_id`, {
      method: 'POST',
      headers: { ...headers, 'Prefer': 'resolution=ignore-duplicates' },
      body: JSON.stringify({ opportunity_id: opp.id, trigger_id: triggerEvent.id })
    });

    // 6. Log Activity
    await fetch(`${supabaseUrl}/rest/v1/nexus_activities`, {
      method: 'POST',
      headers: { ...headers, 'Prefer': 'return=minimal' },
      body: JSON.stringify({
        user_id: hit.user_id,
        entity_type: 'opportunity',
        entity_id: opp.id,
        actor_type: 'SYSTEM',
        actor_name: 'NeXus AI Cron',
        activity_type: isNewOpp ? 'status_changed' : 'trigger_added',
        description: isNewOpp ? 'Opportunity automatisch aus Radar-Hit generiert' : 'Weiteres Radar-Signal zur offenen Opportunity hinzugefügt'
      })
    });

    console.log(`B2 Cron: Opportunity ${opp.id} (Neu: ${isNewOpp}) für Firma ${company.name} erfolgreich mit Hit verknüpft!`);
  } catch (err) {
    console.error(`B2 Cron: Fehler in createOpportunityFromHit für Hit ${hit.id}:`, err.message);
  }
}

async function updateHit(id, status, score, reason, type, supabaseUrl, supabaseKey, authToken) {
  const res = await fetch(`${supabaseUrl}/rest/v1/rpc/save_hit_evaluation`, {
    method: 'POST',
    headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${authToken || supabaseKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      hit_id: id,
      new_status: status,
      score: score || 0,
      reason: reason || '',
      type: type || ''
    })
  });
  if (!res.ok) console.error(`B2 Cron: Fehler beim Speichern von Hit ${id}:`, await res.text());
}
