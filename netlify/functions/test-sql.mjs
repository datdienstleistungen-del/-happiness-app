export async function handler(event, context) {
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
  const headers = { 'apikey': supabaseKey, 'Authorization': 'Bearer ' + supabaseKey, 'Content-Type': 'application/json' };

  if (event.httpMethod === 'POST') {
    const { action } = JSON.parse(event.body);
    
    if (action === 'setup') {
      // 1. Reset offering
      await fetch(supabaseUrl + '/rest/v1/nexus_offerings?id=eq.6e0c2e6b-a64d-40a0-a661-e1756204a372', {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ 
          target_audience: null,
          trigger_model: {
            hypotheses: [
              { title: 'Vertriebs-Digitalisierung', keywords: ['Vertrieb', 'Digitalisierung', 'Software'], priority: 1 }
            ]
          }
        })
      });

      // 2. Clear old test hits
      await fetch(supabaseUrl + '/rest/v1/nexus_radar_hits?url=like.https://test*', {
        method: 'DELETE',
        headers
      });

      // 3. Insert new test hits
      const hits = [
        {
          user_id: '976e6211-8931-425a-a171-0c062290181b',
          offering_id: '6e0c2e6b-a64d-40a0-a661-e1756204a372',
          url: 'https://test1.com',
          url_hash: 'hash1',
          title: 'Spiegel GmbH expandiert',
          raw_content: 'Die Spiegel GmbH braucht dringend Software zur Vertriebs-Digitalisierung.',
          status: 'pending'
        },
        {
          user_id: '976e6211-8931-425a-a171-0c062290181b',
          offering_id: '6e0c2e6b-a64d-40a0-a661-e1756204a372',
          url: 'https://test2.com',
          url_hash: 'hash2',
          title: 'Spiegel GmbH zweiter Bericht',
          raw_content: 'Ein weiterer Artikel über die Spiegel GmbH. Sie sucht weiterhin Software.',
          status: 'pending'
        },
        {
          user_id: '976e6211-8931-425a-a171-0c062290181b',
          offering_id: '6e0c2e6b-a64d-40a0-a661-e1756204a372',
          url: 'https://test4.com',
          url_hash: 'hash4',
          title: 'Defekter Hit',
          raw_content: null,
          status: 'pending'
        }
      ];

      for (let hit of hits) {
        await fetch(supabaseUrl + '/rest/v1/nexus_radar_hits', { method: 'POST', headers, body: JSON.stringify(hit) });
      }
      return { statusCode: 200, body: 'Setup complete' };
    }

    if (action === 'verify') {
      const h = await (await fetch(supabaseUrl + '/rest/v1/nexus_radar_hits?url=like.https://test*&select=id,status,title,url,relevance_score,trigger_type', { headers })).json();
      const c = await (await fetch(supabaseUrl + '/rest/v1/nexus_companies?name=ilike.Spiegel%25&select=id,name,domain', { headers })).json();
      const o = await (await fetch(supabaseUrl + '/rest/v1/nexus_opportunities?select=id,company_id,offering_id,pipeline_stage', { headers })).json();
      const a = await (await fetch(supabaseUrl + '/rest/v1/nexus_activities?select=entity_type,activity_type,description', { headers })).json();
      
      return { statusCode: 200, body: JSON.stringify({ hits: h, companies: c, opportunities: o, activities: a }) };
    }
  }
  return { statusCode: 400, body: 'Bad Request' };
}
