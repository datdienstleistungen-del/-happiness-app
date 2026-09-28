// ============================================================================
// NeXus _shared/search-core.mjs — Recherche-Primitives (Phase 2)
// Buedelt die 7x kopierte DuckDuckGo-HTML-Parsing-Funktion und die
// Tavily-Multi-Key-Aufrufe (bisher cron-search, cron-event-search,
// nexus-research, nexus-llm, coach-chat, nexus-contact-intelligence, ...).
// ============================================================================

// Tavily-Key-Pool (Multi-Key Failover). Reihenfolge = Prioritaet.
// VITE_TAVILY_API_KEY als letzte Option: historischer Alias einiger Functions.
export function getTavilyKeys() {
  return [
    process.env.TAVILY_API_KEY,
    process.env.TAVILY_API_KEY_2,
    process.env.TAVILY_API_KEY_3,
    process.env.VITE_TAVILY_API_KEY,
  ].filter(Boolean);
}

// DuckDuckGo HTML-Suche (keyless). Liefert IMMER ein Array ([] bei Fehler).
// Ergebnis-Shape kanonisch: { url, title, content, published_date }.
export async function searchDuckDuckGo(query, { maxResults = 10, timeoutMs = 6000 } = {}) {
  try {
    const res = await fetch(
      `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`,
      {
        // Chrome-UA (DDG blockt generische Bots zuverlaessiger)
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' },
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

// Einzelner Tavily-Call. Liefert { ok, results, error? } — wirft nie.
export async function tavilySearch(query, key, {
  maxResults = 5,
  searchDepth = 'advanced',
  includeRawContent = true,
  daysBack = null,
  includeDomains = null,
  timeoutMs = 5000,
} = {}) {
  try {
    const payload = { api_key: key, query, search_depth: searchDepth, include_raw_content: includeRawContent, max_results: maxResults };
    if (daysBack) payload.days_back = daysBack;
    if (Array.isArray(includeDomains) && includeDomains.length > 0) payload.include_domains = includeDomains;
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

// Komplette Kette: alle Tavily-Keys der Reihe nach, dann DuckDuckGo-Fallback.
// Liefert { results, source } mit source = 'tavily' | 'ddg' | null.
// _source-Labels sind konfigurierbar, weil sie in die DB geschrieben werden.
export async function searchWithFallback(query, {
  maxResults = 5,
  ddgResults = 5,
  searchDepth = 'advanced',
  includeRawContent = true,
  daysBack = null,
  timeoutMs = 5000,
  tavilySource = 'Tavily Deep Search',
  ddgSource = 'DuckDuckGo Search (Fallback)',
} = {}) {
  const keys = getTavilyKeys();
  for (const key of keys) {
    const out = await tavilySearch(query, key, { maxResults, searchDepth, includeRawContent, daysBack, timeoutMs });
    if (out.ok) {
      return { results: out.results.map((r) => ({ ...r, _source: tavilySource })), source: 'tavily' };
    }
  }
  const ddg = await searchDuckDuckGo(query, { maxResults: ddgResults });
  if (ddg.length > 0) {
    return { results: ddg.map((r) => ({ ...r, _source: ddgSource })), source: 'ddg' };
  }
  return { results: [], source: null };
}
