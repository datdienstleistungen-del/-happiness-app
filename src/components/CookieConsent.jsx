import React, { useState, useEffect } from 'react';
import './CookieConsent.css';

const STORAGE_KEY = 'nexus_cookie_consent';

export default function CookieConsent() {
  const [status, setStatus] = useState('loading');

  useEffect(() => {
    // 1. SEO / Search Engine Bot Bypass:
    // Suchmaschinen (Googlebot, Bingbot, etc.) niemals blockieren,
    // damit der öffentliche Content und das Ranking 100% erhalten bleiben.
    const isBot = /bot|googlebot|crawler|spider|robot|crawling|bingbot|duckduckbot/i.test(navigator.userAgent || '');
    if (isBot) {
      setStatus('accepted');
      return;
    }

    // 2. Bestehende Entscheidung prüfen
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'accepted') {
      setStatus('accepted');
    } else if (saved === 'rejected') {
      setStatus('rejected');
    } else {
      setStatus('undecided');
    }
  }, []);

  const handleAccept = () => {
    localStorage.setItem(STORAGE_KEY, 'accepted');
    document.cookie = `nexus_consent=true; path=/; max-age=31536000; SameSite=Lax`;
    setStatus('accepted');
  };

  const handleReject = () => {
    localStorage.setItem(STORAGE_KEY, 'rejected');
    setStatus('rejected');
  };

  const handleLeave = () => {
    window.location.href = 'https://www.google.de';
  };

  if (status === 'loading' || status === 'accepted') {
    return null;
  }

  // 1. ZUGRIFF VERWEIGERT (WALL SCREEN WENN ABGELEHNT)
  if (status === 'rejected') {
    return (
      <div className="nexus-cookie-overlay" role="dialog" aria-modal="true">
        <div className="nexus-cookie-card nexus-wall">
          <div className="nexus-cookie-header">
            <span className="nexus-cookie-icon">⛔</span>
            <h2 className="nexus-cookie-title">Zugriff verweigert</h2>
          </div>
          <div className="nexus-cookie-body">
            <p>
              Ohne deine Zustimmung zu den technisch notwendigen Sicherheits- und Sitzungsdaten kann
              <strong> NeXus Revenue OS</strong> aus Sicherheitsgründen nicht geladen werden.
            </p>
            <p style={{ marginTop: '0.75rem', fontSize: '0.85rem', color: '#94a3b8' }}>
              Diese Daten sind technisch zwingend erforderlich, um deine Anfragen vor automatisiertem Bot-Missbrauch zu schützen und deinen Login aufrechtzuerhalten.
            </p>
          </div>
          <div className="nexus-cookie-actions">
            <button className="nexus-cookie-btn-accept" onClick={handleAccept}>
              Doch akzeptieren & fortfahren
            </button>
            <button className="nexus-cookie-btn-reject" onClick={handleLeave}>
              Seite verlassen
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 2. INITIALES CONSENT-MODAL (AKZEPTIEREN & FORTFAHREN)
  return (
    <div className="nexus-cookie-overlay" role="dialog" aria-modal="true">
      <div className="nexus-cookie-card">
        <div className="nexus-cookie-header">
          <span className="nexus-cookie-icon">🍪</span>
          <h2 className="nexus-cookie-title">Sicherheits- & Cookie-Einstellungen</h2>
        </div>
        <div className="nexus-cookie-body">
          <p>
            NeXus verwendet essenzielle Cookies und browserbasierte Sicherheits-Tokens, um deine Sitzung,
            deine B2B-Sales-Intelligence und den Zugriff auf unsere KI-Systeme vor Missbrauch zu schützen.
          </p>
          <ul className="nexus-cookie-features">
            <li>
              <span>🔐</span>
              <span><strong>Essenzielle Sicherheitsdaten:</strong> Authentifizierung, Schutz vor unbefugten Bot-Angriffen und API-Schutz.</span>
            </li>
            <li>
              <span>⚙️</span>
              <span><strong>Funktionale Daten:</strong> Speicherung deiner Sprachauswahl und UI-Einstellungen.</span>
            </li>
          </ul>
        </div>
        <div className="nexus-cookie-actions">
          <button className="nexus-cookie-btn-accept" onClick={handleAccept}>
            ✅ Akzeptieren & Fortfahren
          </button>
          <button className="nexus-cookie-btn-reject" onClick={handleReject}>
            ❌ Ablehnen
          </button>
        </div>
        <div className="nexus-cookie-footer">
          <a href="/legal/datenschutz" target="_blank" rel="noopener noreferrer">Datenschutz</a>
          •
          <a href="/legal/impressum" target="_blank" rel="noopener noreferrer">Impressum</a>
        </div>
      </div>
    </div>
  );
}
