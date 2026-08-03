import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Heart, Shield } from 'lucide-react';
import { guideContent } from '../content/guide-loneliness';
import './LandingPage.css';

export const guideRoutesMap = {
  de: '/de/ratgeber/niemand-zum-reden',
  en: '/en/guide/no-one-to-talk-to',
  es: '/es/guia/nadie-con-quien-hablar',
  fr: '/fr/guide/personne-a-qui-parler',
  it: '/it/guida/nessuno-con-cui-parlare',
  nl: '/nl/gids/niemand-om-mee-te-praten',
  el: '/el/odigos/kaneis-gia-na-miliseis'
};

const BASE_URL = 'https://happiness-eu.netlify.app';

export default function RatgeberNoOneToTalkTo({ locale = 'en' }) {
  const content = guideContent[locale] || guideContent['en'];

  useEffect(() => {
    // 1. Inject Title
    document.title = content.seo.title;
    
    // 2. Inject Meta Description
    let metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription) {
      metaDescription.setAttribute('content', content.seo.description);
    } else {
      metaDescription = document.createElement('meta');
      metaDescription.name = "description";
      metaDescription.content = content.seo.description;
      document.head.appendChild(metaDescription);
    }

    // 3. Inject hreflang tags for all supported languages
    const injectedLinks = [];
    Object.keys(guideRoutesMap).forEach(langCode => {
      const link = document.createElement('link');
      link.rel = 'alternate';
      link.hreflang = langCode;
      link.href = `${BASE_URL}${guideRoutesMap[langCode]}`;
      document.head.appendChild(link);
      injectedLinks.push(link);
    });

    // Add x-default (fallback) pointing to English
    const defaultLink = document.createElement('link');
    defaultLink.rel = 'alternate';
    defaultLink.hreflang = 'x-default';
    defaultLink.href = `${BASE_URL}${guideRoutesMap['en']}`;
    document.head.appendChild(defaultLink);
    injectedLinks.push(defaultLink);
    
    // Cleanup on unmount
    return () => {
      document.title = "Happiness Coach – Ein Ort zum Reden, wenn dir niemand zuhört";
      if (metaDescription) {
        metaDescription.setAttribute('content', 'Ein KI-Gesprächspartner für Momente, in denen du reden möchtest oder dich einsam fühlst. Kostenlos, ohne Registrierung, 100% vertraulich.');
      }
      injectedLinks.forEach(link => {
        if (link.parentNode) {
          link.parentNode.removeChild(link);
        }
      });
    };
  }, [content]);

  return (
    <div className="landing-page-container" style={{ maxWidth: '800px', margin: '0 auto', padding: '40px 20px', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      
      <header style={{ marginBottom: '40px', textAlign: 'center' }}>
        <h1 style={{ fontSize: '2.5rem', color: '#1a1a2e', marginBottom: '16px', lineHeight: '1.2' }}>
          {content.header.h1}
        </h1>
        <p style={{ fontSize: '1.25rem', color: '#6b7280', lineHeight: '1.6' }}>
          {content.header.subtitle}
        </p>
      </header>

      <article style={{ fontSize: '1.1rem', color: '#374151', lineHeight: '1.8' }}>
        <section style={{ marginBottom: '32px' }}>
          <p style={{ marginBottom: '16px' }}>{content.section1.p1}</p>
          <p>{content.section1.p2}</p>
        </section>

        <section style={{ marginBottom: '32px' }}>
          <h2 style={{ fontSize: '1.75rem', color: '#1a1a2e', marginBottom: '16px' }}>{content.section2.h2}</h2>
          <p style={{ marginBottom: '16px' }}>{content.section2.p1}</p>
          <p style={{ marginBottom: '16px' }}>{content.section2.p2}</p>
          <ul style={{ listStyleType: 'disc', paddingLeft: '24px', marginBottom: '16px' }}>
            {content.section2.bullets.map((bullet, idx) => (
              <li key={idx} style={{ marginBottom: '8px' }} dangerouslySetInnerHTML={{ __html: bullet }}></li>
            ))}
          </ul>
        </section>

        <section style={{ marginBottom: '32px' }}>
          <h2 style={{ fontSize: '1.75rem', color: '#1a1a2e', marginBottom: '16px' }}>{content.section3.h2}</h2>
          <p style={{ marginBottom: '16px' }}>{content.section3.p1}</p>
          <p>{content.section3.p2}</p>
        </section>

        <section style={{ 
          marginTop: '48px', 
          padding: '32px', 
          backgroundColor: '#f8fafc', 
          borderRadius: '16px', 
          border: '1px solid #e2e8f0',
          textAlign: 'center'
        }}>
          <Heart size={32} color="#1D9E75" style={{ margin: '0 auto 16px' }} />
          <h3 style={{ fontSize: '1.5rem', color: '#1a1a2e', marginBottom: '12px' }}>{content.cta.h3}</h3>
          <p style={{ marginBottom: '24px', color: '#475569' }} dangerouslySetInnerHTML={{ __html: content.cta.p1 }}></p>
          
          <Link 
            to="/" 
            style={{ 
              display: 'inline-flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              backgroundColor: '#1D9E75', 
              color: 'white', 
              padding: '12px 24px', 
              borderRadius: '8px', 
              textDecoration: 'none', 
              fontWeight: '600',
              fontSize: '1.1rem',
              transition: 'background-color 0.2s'
            }}
            onMouseOver={(e) => e.target.style.backgroundColor = '#15805e'}
            onMouseOut={(e) => e.target.style.backgroundColor = '#1D9E75'}
          >
            {content.cta.btn}
          </Link>
          
          <div style={{ marginTop: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontSize: '0.85rem', color: '#64748b' }}>
            <Shield size={14} />
            <span>{content.cta.trust}</span>
          </div>
        </section>
      </article>
      
    </div>
  );
}
