import crypto from 'crypto';

export async function handler(event, context) {
  // 1. Setup & Environment
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

  let authToken = supabaseKey;
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY && !process.env.SUPABASE_SERVICE_KEY && process.env.TEST_USER_EMAIL && process.env.TEST_USER_PASSWORD) {
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
  const tavilyApiKey = process.env.TAVILY_API_KEY;

  if (!supabaseUrl || !supabaseKey || !tavilyApiKey) {
    return { statusCode: 500, body: JSON.stringify({ error: "Missing config for B1 Search Cron" }) };
  }

  const BATCH_SIZE = 3; // Wir scannen max. 3 Offerings pro Lauf (um Netlify Limits zu respektieren)

  try {
    // 2. Atomarer Claim von Offerings (Die am längsten nicht gescannt wurden)
    // Aufruf unserer neuen Supabase RPC-Funktion
    const claimRes = await fetch(`${supabaseUrl}/rest/v1/rpc/claim_offerings_for_scan`, {
      method: 'POST',
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ batch_size: BATCH_SIZE })
    });

    if (!claimRes.ok) {
      console.error("Fehler beim Claiming der Offerings:", await claimRes.text());
      return { statusCode: 500, body: "Claim RPC failed" };
    }

    const offerings = await claimRes.json();
    console.log(`B1 Cron: ${offerings.length} Offerings erfolgreich geclaimt.`);

    if (offerings.length === 0) {
      return { statusCode: 200, body: "Keine Offerings zu scannen." };
    }

    // 3. Iteration über die geclaimten Offerings
    for (const offering of offerings) {
      const searchQuery = offering.target_audience; // Die Zielgruppe ist unser primärer Radar-Suchvektor
      if (!searchQuery) {
        // Fallback: Entsperren, wenn keine Zielgruppe definiert ist
        await fetch(`${supabaseUrl}/rest/v1/nexus_offerings?id=eq.${offering.id}`, {
          method: 'PATCH',
          headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ is_scanning: false })
        });
        continue;
      }

      console.log(`B1 Cron: Starte Tavily Search für Offering ${offering.id} (Query: ${searchQuery})`);

      try {
        // 4. Tavily Deep Search (Datengewinnung)
        const tavilyRes = await fetch('https://api.tavily.com/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            api_key: tavilyApiKey,
            query: searchQuery,
            search_depth: "advanced",
            include_raw_content: true,
            max_results: 15,
            days_back: 7
          })
        });

        if (!tavilyRes.ok) {
          throw new Error(`Tavily API Fehler: ${tavilyRes.statusText}`);
        }

        const tavilyData = await tavilyRes.json();
        const results = tavilyData.results || [];

        // 5. Ergebnisse normalisieren & hashen
        const rowsToInsert = results.map(r => {
          const hash = crypto.createHash('md5').update(r.url || '').digest('hex');
          return {
            user_id: offering.user_id,
            offering_id: offering.id,
            url: r.url,
            url_hash: hash,
            source: 'Tavily Deep Search (B1 Cron)',
            title: r.title || '',
            raw_content: r.content || '',
            published_at: r.published_date || null,
            status: 'pending'
          };
        });

        // 6. Bulk Insert in nexus_radar_hits (Ignoriert Duplikate durch Unique Constraint)
        if (rowsToInsert.length > 0) {
          const insertRes = await fetch(`${supabaseUrl}/rest/v1/nexus_radar_hits`, {
            method: 'POST',
            headers: {
              'apikey': supabaseKey,
              'Authorization': `Bearer ${authToken}`,
              'Content-Type': 'application/json',
              'Prefer': 'resolution=ignore-duplicates' 
            },
            body: JSON.stringify(rowsToInsert)
          });
          
          if (!insertRes.ok) {
            const errBody = await insertRes.text();
            if (insertRes.status === 409) {
              console.log(`B1 Cron: ${rowsToInsert.length} Hits für Offering ${offering.id} gesucht, ${rowsToInsert.length} Duplikate übersprungen.`);
            } else {
              throw new Error(`DB Insert Fehler: ${errBody}`);
            }
          } else {
            console.log(`B1 Cron: ${rowsToInsert.length} Hits für Offering ${offering.id} eingefügt.`);
          }
        }

        // 7. Erfolg: Offering entsperren UND last_scanned_at updaten
        await fetch(`${supabaseUrl}/rest/v1/nexus_offerings?id=eq.${offering.id}`, {
          method: 'PATCH',
          headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ is_scanning: false, last_scanned_at: new Date().toISOString() })
        });

      } catch (err) {
        console.error(`B1 Cron: Fehler bei Offering ${offering.id}:`, err.message);
        
        // 8. Fehlerfall: Offering nur entsperren! last_scanned_at bleibt unberührt!
        await fetch(`${supabaseUrl}/rest/v1/nexus_offerings?id=eq.${offering.id}`, {
          method: 'PATCH',
          headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ is_scanning: false })
        });
      }
    }

    return { statusCode: 200, body: JSON.stringify({ message: "B1 Scan erfolgreich abgeschlossen" }) };

  } catch (globalErr) {
    console.error("B1 Cron: Globaler Fehler:", globalErr);
    return { statusCode: 500, body: JSON.stringify({ error: globalErr.message }) };
  }
}
