import crypto from 'crypto';
import { getTavilyKeys, searchWithFallback } from './_shared/search-core.mjs';
import { isBlockedUrl } from './_shared/url-rules.mjs';

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
  if (!supabaseUrl || !supabaseKey) {
    return { statusCode: 500, body: JSON.stringify({ error: "Missing config for B1 Search Cron" }) };
  }

  const BATCH_SIZE = 3; // Wir scannen max. 3 Offerings pro Lauf (um Netlify Limits zu respektieren)

  try {
    // 1.5 Stale-Locks freigeben: Offerings die >30 Min als laufend markiert sind,
    // aber nie entsperrt wurden (Crash/Timeout) — sonst werden sie nie wieder geclaimt
    try {
      const cutoff = new Date(Date.now() - 30 * 60 * 1000).toISOString();
      for (const filter of [`last_scanned_at=lt.${cutoff}`, 'last_scanned_at=is.null']) {
        const staleRes = await fetch(`${supabaseUrl}/rest/v1/nexus_offerings?is_scanning=eq.true&${filter}`, {
          method: 'PATCH',
          headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${authToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ is_scanning: false })
        });
        if (staleRes.ok) {
          const unlocked = await staleRes.json();
          if (unlocked?.length > 0) console.log(`B1 Cron: ${unlocked.length} stale Offering-Locks freigegeben.`);
        }
      }
    } catch (e) { console.warn('B1 Cron: Stale-Unlock fehlgeschlagen:', e.message); }

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
    const runStart = Date.now(); // Laufbudget: 24s gegen Netlify Scheduled-Limit 30s (nicht konfigurierbar)
    for (const offering of offerings) {
      if (Date.now() - runStart > 24000) { console.warn('B1 Cron: Zeitbudget 24s erschöpft - breche ab vor 30s Scheduled-Limit.'); break; }
      // Signal-Strategien laden (preferiert) oder Fallback auf target_audience
      let searchQueries = [];
      try {
        const stratRes = await fetch(`${supabaseUrl}/rest/v1/nexus_signal_strategies?offering_id=eq.${offering.id}&select=search_queries`, {
          headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${authToken}` }
        });
        if (stratRes.ok) {
          const strats = await stratRes.json();
          for (const s of strats) {
            if (Array.isArray(s.search_queries)) {
              for (const sq of s.search_queries) {
                if (sq.query) searchQueries.push(sq.query);
              }
            }
          }
        }
      } catch (e) {
        console.warn(`B1 Cron: Fehler beim Laden der Signal-Strategien für Offering ${offering.id}:`, e.message);
      }

      // Fallback: target_audience wenn keine Signal-Strategien vorhanden
      if (searchQueries.length === 0 && offering.target_audience) {
        searchQueries = [offering.target_audience];
      }

      if (searchQueries.length === 0) {
        // Fallback: Entsperren, wenn weder Strategien noch Zielgruppe definiert ist
        await fetch(`${supabaseUrl}/rest/v1/nexus_offerings?id=eq.${offering.id}`, {
          method: 'PATCH',
          headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ is_scanning: false })
        });
        continue;
      }

      console.log(`B1 Cron: Starte Tavily Search für Offering ${offering.id} (${searchQueries.length} Queries)`);

      try {
        // 4. Tavily Deep Search (Datengewinnung mit Multi-Key Failover & DuckDuckGo
        // Fallback) — Kette via _shared/search-core.mjs. Die _source-Labels
        // bleiben identisch, weil sie in die DB geschrieben werden.
        const allResults = [];
        for (const query of searchQueries.slice(0, 5)) { // Max 5 Queries pro Offering (Netlify Timeout)
          const { results } = await searchWithFallback(query, {
            maxResults: 5,
            ddgResults: 5,
            searchDepth: 'advanced',
            includeRawContent: true,
            daysBack: 7,
            timeoutMs: 5000,
            tavilySource: 'Tavily Deep Search (B1 Cron)',
            ddgSource: 'DuckDuckGo Search (B1 Fallback)',
          });
          allResults.push(...results);
        }

        // 5. Ergebnisse normalisieren & hashen — Blocklist-Filter (Phase 5a):
        // Jobboersen/Social/Kleinanzeigen raus, bevor sie die DB erreichen.
        const keptResults = allResults.filter(r => !isBlockedUrl(r.url));
        const blockedCount = allResults.length - keptResults.length;
        if (blockedCount > 0) {
          console.log(`B1 Cron: ${blockedCount} Treffer durch URL-Blocklist gefiltert (${keptResults.length} bleiben).`);
        }
        const rowsToInsert = keptResults.map(r => {
          const hash = crypto.createHash('md5').update(r.url || '').digest('hex');
          return {
            user_id: offering.user_id,
            offering_id: offering.id,
            url: r.url,
            url_hash: hash,
            source: r._source || 'Tavily Deep Search (B1 Cron)',
            title: r.title || '',
            raw_content: r.content || r.snippet || '',
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
