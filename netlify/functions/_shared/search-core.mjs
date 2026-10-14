// ============================================================================
// NeXus _shared/search-core.mjs — Recherche-Primitives
// (Phase 2 & Phase 3: Kostenlose Suchquellen & Tavily-Entfernung)
//
// Primärquellen:
// 1. Jiro Search (Evaluierung: Python-Laufzeit auf Netlify Node nicht nativ ausführbar)
// 2. Brave Search API (serverseitig via BRAVE_SEARCH_API_KEY / BRAVE_API_KEY, $5/Monat Freikontingent)
// 3. DuckDuckGo HTML-Suche (keyless, kostenlos)
// 4. Bing News RSS (keyless, kostenlos, DACH-Märkte: de-DE, de-AT, de-CH)
//
// Tavily ist VOLLSTÄNDIG aus dem Standardbetrieb entfernt und standardmäßig
// deaktiviert (darf nur bei explizitem ENABLE_TAVILY_EMERGENCY_FALLBACK=true laufen).
// ============================================================================
import { tryConsumeDaily, tavilyDailyLimit, dayKey, keyFingerprint } from './quota.mjs';

function decodeEntities(s) {
  if (!s || typeof s !== 'string') return '';
  return s
    .replace(/<!\[CDATA\[|\]\]>/g, '')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

// ----------------------------------------------------------------------------
// 1. BRAVE SEARCH API (Kostenlose $5/Monat Freikredits ~ 1.000 Anfragen/Monat)
// ----------------------------------------------------------------------------
export async function searchBrave(query, {
  maxResults = 5,
  country = 'DE',
  searchLang = 'de',
  timeoutMs = 6000
} = {}) {
  const key = process.env.BRAVE_SEARCH_API_KEY || process.env.BRAVE_API_KEY;
  if (!key) {
    return { ok: false, results: [], error: 'no_key' };
  }

  try {
    const url = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=${maxResults}&country=${country}&search_lang=${searchLang}`;
    const res = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip',
        'X-Subscription-Token': key
      },
      signal: AbortSignal.timeout(timeoutMs)
    });

    if (res.status === 429) {
      console.warn('[SearchCore] Brave Search API Rate Limit (429) erreicht.');
      return { ok: false, results: [], error: 'rate_limit' };
    }

    if (!res.ok) {
      console.warn(`[SearchCore] Brave Search API Fehler HTTP ${res.status}`);
      return { ok: false, results: [], error: `http_${res.status}` };
    }

    const data = await res.json();
    const results = (data?.web?.results || []).map(r => ({
      url: r.url,
      title: r.title || '',
      content: r.description || '',
      published_date: r.page_age || new Date().toISOString()
    }));

    return { ok: results.length > 0, results, error: results.length > 0 ? null : 'empty' };
  } catch (e) {
    const isTimeout = e?.name === 'TimeoutError' || e?.name === 'AbortError';
    console.warn('[SearchCore] Brave Search Exception:', isTimeout ? 'timeout' : e.message);
    return { ok: false, results: [], error: isTimeout ? 'timeout' : 'network' };
  }
}

// ----------------------------------------------------------------------------
// 2. BING NEWS RSS (Keyless, kostenlos, DACH-Märkte de-DE, de-AT, de-CH)
// ----------------------------------------------------------------------------
export async function searchBingNewsRss(query, {
  maxResults = 10,
  markets = ['de-DE', 'de-AT', 'de-CH'],
  cutoffDays = 60,
  timeoutMs = 5000
} = {}) {
  const cutoff = Date.now() - cutoffDays * 24 * 3600 * 1000;
  const allHits = [];
  const seenUrls = new Set();

  for (const mkt of markets) {
    try {
      const url = `https://www.bing.com/news/search?q=${encodeURIComponent(query)}&format=rss&count=${maxResults * 2}&mkt=${mkt}&setlang=de`;
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36' },
        signal: AbortSignal.timeout(timeoutMs)
      });
      if (!res.ok) continue;

      const xml = await res.text();
      const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)];

      for (const it of items) {
        const b = it[1];
        const title = decodeEntities(((b.match(/<title>([\s\S]*?)<\/title>/) || [])[1] || '')).trim();
        const rawLink = decodeEntities(((b.match(/<link>([\s\S]*?)<\/link>/) || [])[1] || '')).trim();
        const pub = (b.match(/<pubDate>([\s\S]*?)<\/pubDate>/) || [])[1] || '';
        const desc = decodeEntities(((b.match(/<description>([\s\S]*?)<\/description>/) || [])[1] || '')).trim();

        const ts = pub ? Date.parse(pub) : NaN;
        if (!Number.isNaN(ts) && ts < cutoff) continue;

        let realUrl = rawLink;
        try {
          const u = new URL(rawLink);
          const target = u.searchParams.get('url');
          if (target) realUrl = target;
        } catch {}

        if (!realUrl.startsWith('http') || !title) continue;
        if (!seenUrls.has(realUrl)) {
          seenUrls.add(realUrl);
          allHits.push({
            url: realUrl,
            title,
            content: desc,
            published_date: !Number.isNaN(ts) ? new Date(ts).toISOString().slice(0, 10) : null,
            market: mkt
          });
        }
        if (allHits.length >= maxResults) break;
      }
    } catch {
      // Feed-Fehler abfangen und nächsten Markt versuchen
    }
    if (allHits.length >= maxResults) break;
  }

  return allHits;
}

// ----------------------------------------------------------------------------
// 3. DUCKDUCKGO HTML-SUCHE (Keyless, kostenlos)
// ----------------------------------------------------------------------------
export async function searchDuckDuckGo(query, { maxResults = 10, timeoutMs = 6000 } = {}) {
  try {
    const res = await fetch(
      `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`,
      {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36' },
        signal: AbortSignal.timeout(timeoutMs),
      }
    );
    if (!res.ok) return [];
    const html = await res.text();
    const results = [];
    const linkRegex = /<a[^>]+class="result__a"[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;
    let match;
    while ((match = linkRegex.exec(html)) !== null && results.length < maxResults) {
      const href = match[1];
      const title = match[2].replace(/<[^>]*>/g, '').trim();
      let url = null;
      if (href.includes('uddg=')) {
        const uddgMatch = href.match(/uddg=([^&]*)/);
        if (uddgMatch) url = decodeURIComponent(uddgMatch[1]);
      } else if (href.startsWith('http')) {
        url = href;
      }
      const snippetRegex = /<a[^>]+class="result__snippet"[^>]*>([\s\S]*?)<\/a>/gi;
      snippetRegex.lastIndex = match.index + match[0].length;
      const snippetMatch = snippetRegex.exec(html);
      const snippet = snippetMatch ? snippetMatch[1].replace(/<[^>]*>/g, '').trim() : '';
      if (url && title) {
        results.push({ url, title, content: snippet, published_date: new Date().toISOString() });
      }
    }
    return results;
  } catch {
    return [];
  }
}

// ----------------------------------------------------------------------------
// 4. TAVILY — VOLLSTÄNDIG AUS DEM STANDARDBETRIEB ENTFERNT
// Nur als explizit deaktivierter Notfall-Fallback erhalten.
// ----------------------------------------------------------------------------
export function getTavilyKeys() {
  if (process.env.ENABLE_TAVILY_EMERGENCY_FALLBACK !== 'true') {
    return [];
  }
  return [
    process.env.TAVILY_API_KEY,
    process.env.TAVILY_API_KEY_2,
    process.env.TAVILY_API_KEY_3,
    process.env.VITE_TAVILY_API_KEY,
  ].filter(Boolean);
}

export async function tavilySearch(query, key, {
  maxResults = 5,
  searchDepth = 'basic',
  includeRawContent = false,
  daysBack = null,
  includeDomains = null,
  excludeDomains = null,
  timeoutMs = 5000,
} = {}) {
  // Streng deaktiviert im Standardbetrieb (Phase 2)
  if (process.env.ENABLE_TAVILY_EMERGENCY_FALLBACK !== 'true') {
    return { ok: false, results: [], error: 'tavily_disabled' };
  }
  if (!key) return { ok: false, results: [], error: 'no_key' };

  const quota = await tryConsumeDaily(`tavily:${keyFingerprint(key)}:${dayKey()}`, tavilyDailyLimit());
  if (!quota.allowed) {
    console.warn(`[SearchCore] Tavily-Quota erreicht (${quota.used}/${quota.limit} heute) — Key wird uebersprungen.`);
    return { ok: false, results: [], error: 'quota' };
  }
  try {
    const payload = { api_key: key, query, search_depth: searchDepth, include_raw_content: includeRawContent, max_results: maxResults };
    if (daysBack) payload.days_back = daysBack;
    if (Array.isArray(includeDomains) && includeDomains.length > 0) payload.include_domains = includeDomains;
    if (Array.isArray(excludeDomains) && excludeDomains.length > 0) payload.exclude_domains = excludeDomains;
    const res = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) return { ok: false, results: [], error: `http-${res.status}` };
    const data = await res.json();
    if (data && Array.isArray(data.results) && data.results.length > 0) {
      return { ok: true, results: data.results };
    }
    return { ok: false, results: [], error: 'leer' };
  } catch (e) {
    return { ok: false, results: [], error: e?.name === 'TimeoutError' || e?.name === 'AbortError' ? 'timeout' : 'netz' };
  }
}

// ----------------------------------------------------------------------------
// 5. STANDARD FALLBACK-KETTE: Brave -> DuckDuckGo -> Bing News RSS
// (Tavily ist standardmäßig nicht in der Kette)
// ----------------------------------------------------------------------------
export async function searchWithFallback(query, {
  maxResults = 5,
  country = 'DE',
  timeoutMs = 5000,
  includeBingNews = true
} = {}) {
  // 1. Quelle: Jiro Search (Evaluierung: Python-Laufzeit auf Netlify Node nicht nativ lauffähig)
  // 2. Quelle: Brave Search API (falls serverseitiger API-Key konfiguriert)
  const brave = await searchBrave(query, { maxResults, country, timeoutMs });
  if (brave.ok && brave.results.length > 0) {
    return { results: brave.results.map((r) => ({ ...r, _source: 'Brave Search API' })), source: 'brave' };
  }

  // 3. Quelle: DuckDuckGo HTML-Suche (kostenlos, keyless)
  const ddg = await searchDuckDuckGo(query, { maxResults, timeoutMs });
  if (ddg.length > 0) {
    return { results: ddg.map((r) => ({ ...r, _source: 'DuckDuckGo Search' })), source: 'ddg' };
  }

  // 4. Quelle: Bing News RSS (kostenlos, keyless, DACH-Märkte)
  if (includeBingNews) {
    const cleanQ = query.replace(/\(site:[^)]+\)/gi, '').replace(/site:\S+/gi, '').replace(/[-+()]/g, ' ').trim();
    const bing = await searchBingNewsRss(cleanQ || query, { maxResults, markets: ['de-DE', 'de-AT', 'de-CH'], timeoutMs });
    if (bing.length > 0) {
      return { results: bing.map((r) => ({ ...r, _source: 'Bing News RSS' })), source: 'bing_news' };
    }
  }

  // 5. Notfall-Fallback: Tavily — NUR wenn explizit per ENABLE_TAVILY_EMERGENCY_FALLBACK=true aktiviert
  if (process.env.ENABLE_TAVILY_EMERGENCY_FALLBACK === 'true') {
    const keys = getTavilyKeys();
    for (const key of keys) {
      const out = await tavilySearch(query, key, { maxResults, searchDepth: 'basic', includeRawContent: false, timeoutMs });
      if (out.ok && out.results?.length > 0) {
        return { results: out.results.map((r) => ({ ...r, _source: 'Tavily (Emergency Fallback)' })), source: 'tavily' };
      }
    }
  }

  return { results: [], source: null };
}
