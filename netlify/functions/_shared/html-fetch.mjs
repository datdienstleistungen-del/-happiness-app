/**
 * Shared HTML Fetch & Text Extraction Helper
 *
 * Gemeinsamer Fetch-Helper für alle NeXus-Funktionen, die Webseiten-Inhalte analysieren.
 * Entnimmt die Cheerio-Logik aus nexus-email-crawler.mjs — kein paralleles Writing.
 *
 * Ziel: Pro Domain nur ein Mal fetchen, Rohtext cached in raw_page_cache.
 *   - nexus-contact-intelligence.mjs
 *   - nexus-email-crawler.mjs
 *   - coach-chat.mjs
 *   - nexus-company-profile-step.mjs
 *
 * Verwenden Sie immer diesen Helper statt eigenem fetch + cheerio.load(html).
 */

import * as cheerio from 'cheerio';

const BROWSER_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'de-DE,de;q=0.9,en-US;q=0.8,en;q=0.7',
  'Cache-Control': 'no-cache',
  'Upgrade-Insecure-Requests': '1'
};

/**
 * Fetcht eine URL und gibt rohen HTML-Text zurück.
 *
 * @param {string} url - Vollständige URL (https://...)
 * @param {object} options
 * @param {number} options.timeoutMs - Timeout in ms (default 5000)
 * @returns {Promise<{ ok: boolean, url: string, finalUrl: string, status: number, html: string|null, elapsed: number }>}
 */
export async function fetchHtml(url, options = {}) {
  const { timeoutMs = 5000 } = options;
  const controller = new AbortController();
  const abortId = setTimeout(() => controller.abort(), timeoutMs);
  const t0 = Date.now();
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: BROWSER_HEADERS,
      signal: controller.signal,
      redirect: 'follow'
    });
    clearTimeout(abortId);
    const elapsed = Date.now() - t0;
    const finalUrl = res.url || url;
    if (!res.ok) {
      return { ok: false, url, finalUrl, status: res.status, html: null, elapsed };
    }
    const html = await res.text();
    return { ok: true, url, finalUrl, status: res.status, html, elapsed };
  } catch (e) {
    clearTimeout(abortId);
    return { ok: false, url, finalUrl: url, status: 0, html: null, elapsed: Date.now() - t0, error: e.message };
  }
}

/**
 * Extrahiert aus einem HTML-String reinen Fließtext.
 * Entfernt Boilerplate: Nav, Footer, Skripte, Styles, Scripts, Noscript.
 * Basierend auf der Cheerio-Logik aus nexus-email-crawler.mjs (Zeilen 250–254).
 *
 * @param {string} html - Roher HTML-Inhalt
 * @param {string} pageUrl - Quell-URL (für Titel-Extraktion, optional)
 * @returns {{ text: string, title: string, length: number }}
 */
export function extractTextFromHtml(html, pageUrl = '') {
  if (!html) return { text: '', title: '', length: 0 };

  const $ = cheerio.load(html);

  // Titel extrahieren
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = titleMatch ? titleMatch[1].trim() : '';

  // Boilerplate entfernen (exakte Selektoren aus nexus-email-crawler.mjs)
  $('script, style, noscript, nav, footer, header, iframe, svg').remove();

  // Klassen mit typischem Boilerplate-Inhalt entfernen
  $('[class*="cookie"], [class*="banner"], [class*="popup"], [class*="modal"], [id*="cookie"]').remove();

  // Text aus body extrahieren
  const bodyText = $('body').text() || '';

  // Whitespace normalisieren (Mehrzeiler → Einzeiler mit Leerzeichen)
  const cleaned = bodyText
    .replace(/[\u200B-\u200D\uFEFF]/g, '') // Zero-Width-Space entfernen
    .replace(/\s+/g, ' ')
    .trim();

  return { text: cleaned, title, length: cleaned.length };
}

/**
 * Komplett-Fetch: Holt eine URL und gibt strukturierten Fließtext zurück.
 * Kombiniert fetchHtml() + extractTextFromHtml() — das Standard-Pattern.
 *
 * @param {string} url - Vollständige URL
 * @param {object} options
 * @param {number} options.timeoutMs - Timeout in ms (default 5000)
 * @returns {Promise<{ ok: boolean, url: string, finalUrl: string, status: number, text: string, title: string, length: number, elapsed: number }>}
 */
export async function fetchAndExtractText(url, options = {}) {
  const result = await fetchHtml(url, options);
  if (!result.ok) {
    return { ...result, text: '', title: '', length: 0 };
  }
  const extracted = extractTextFromHtml(result.html, url);
  return { ...result, text: extracted.text, title: extracted.title, length: extracted.length };
}

/**
 * Ziel-URLs für eine Domain ermitteln.
 * Standard-Priorität: Startseite, Impressum, Über-uns, Leistungen, Kontakt, About.
 * Reihenfolge basiert auf nexus-contact-intelligence.mjs (Zeilen 244–256).
 *
 * @param {string} domain - Saubere Domain (z.B. "firma.de")
 * @returns {string[]} Array von URL-Strings
 */
export function getProfileUrls(domain) {
  const clean = domain.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0].toLowerCase();
  return [
    `https://${clean}`,
    `https://${clean}/impressum`,
    `https://${clean}/ueber-uns`,
    `https://${clean}/about-us`,
    `https://${clean}/leistungen`,
    `https://${clean}/kontakt`,
    `https://${clean}/about`,
    `https://${clean}/unternehmen`
  ];
}
