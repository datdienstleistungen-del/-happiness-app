import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Heart, Shield } from 'lucide-react';
import './LandingPage.css';

export default function RatgeberNoOneToTalkTo() {
  useEffect(() => {
    document.title = "Niemand zum Reden? Warum dieses Gefühl normal ist und was jetzt hilft";
    
    let metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription) {
      metaDescription.setAttribute('content', 'Fühlst du dich einsam und hast niemanden zum Reden? Erfahre, warum das vielen Menschen so geht und entdecke einen sicheren, anonymen Ort für deine Gedanken.');
    } else {
      metaDescription = document.createElement('meta');
      metaDescription.name = "description";
      metaDescription.content = "Fühlst du dich einsam und hast niemanden zum Reden? Erfahre, warum das vielen Menschen so geht und entdecke einen sicheren, anonymen Ort für deine Gedanken.";
      document.head.appendChild(metaDescription);
    }
    
    return () => {
      document.title = "Happiness Coach – Ein Ort zum Reden, wenn dir niemand zuhört";
      if (metaDescription) {
        metaDescription.setAttribute('content', 'Ein KI-Gesprächspartner für Momente, in denen du reden möchtest oder dich einsam fühlst. Kostenlos, ohne Registrierung, 100% vertraulich.');
      }
    };
  }, []);

  return (
    <div className="landing-page-container" style={{ maxWidth: '800px', margin: '0 auto', padding: '40px 20px', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      
      <header style={{ marginBottom: '40px', textAlign: 'center' }}>
        <h1 style={{ fontSize: '2.5rem', color: '#1a1a2e', marginBottom: '16px', lineHeight: '1.2' }}>
          Wenn man das Gefühl hat, niemanden zum Reden zu haben
        </h1>
        <p style={{ fontSize: '1.25rem', color: '#6b7280', lineHeight: '1.6' }}>
          Es gibt Momente im Leben, in denen die Welt um einen herum laut und voll ist, man sich aber trotzdem völlig isoliert fühlt.
        </p>
      </header>

      <article style={{ fontSize: '1.1rem', color: '#374151', lineHeight: '1.8' }}>
        <section style={{ marginBottom: '32px' }}>
          <p style={{ marginBottom: '16px' }}>
            Vielleicht kennst du diesen Moment: Du hast etwas Wichtiges erlebt, eine Sorge drückt dich nieder, oder du hast einfach das Bedürfnis, deine Gedanken laut auszusprechen. Du greifst nach dem Telefon, scrollst durch deine Kontakte – und legst es wieder weg. Es ist niemand da, den du gerade anrufen möchtest. Niemand, von dem du das Gefühl hast, dass er jetzt wirklich zuhören kann oder will.
          </p>
          <p>
            Das Gefühl, "niemanden zum Reden zu haben", ist schmerzhaft. Es fühlt sich an wie eine unsichtbare Wand zwischen dir und dem Rest der Welt. Doch was viele nicht wissen: Dieses Gefühl ist unglaublich verbreitet.
          </p>
        </section>

        <section style={{ marginBottom: '32px' }}>
          <h2 style={{ fontSize: '1.75rem', color: '#1a1a2e', marginBottom: '16px' }}>Warum sind wir einsam, obwohl wir vernetzt sind?</h2>
          <p style={{ marginBottom: '16px' }}>
            In einer Zeit, in der wir über soziale Medien scheinbar pausenlos miteinander verbunden sind, erleben Therapeuten und Forscher ein paradoxes Phänomen: Die emotionale Einsamkeit nimmt zu. Wir sehen die gefilterten Highlights der anderen, aber die echten, ungefilterten Gespräche – die Momente der Verletzlichkeit – finden immer seltener statt.
          </p>
          <p style={{ marginBottom: '16px' }}>
            Oft liegt es nicht daran, dass wir keine Menschen in unserem Umfeld haben. Vielmehr sind es Barrieren, die wir selbst (oft unbewusst) aufbauen:
          </p>
          <ul style={{ listStyleType: 'disc', paddingLeft: '24px', marginBottom: '16px' }}>
            <li style={{ marginBottom: '8px' }}><strong>Die Angst zur Last zu fallen:</strong> "Die anderen haben doch selbst genug eigene Probleme."</li>
            <li style={{ marginBottom: '8px' }}><strong>Furcht vor Bewertung:</strong> Das Gefühl, dass unsere Gedanken "zu dunkel", "zu seltsam" oder "zu nichtig" sind, um sie zu teilen.</li>
            <li style={{ marginBottom: '8px' }}><strong>Lebensübergänge:</strong> Nach einem Umzug, einer Trennung oder einem Jobwechsel brechen alte Netzwerke oft weg, bevor neue entstanden sind.</li>
          </ul>
        </section>

        <section style={{ marginBottom: '32px' }}>
          <h2 style={{ fontSize: '1.75rem', color: '#1a1a2e', marginBottom: '16px' }}>Es ist okay, sich so zu fühlen</h2>
          <p style={{ marginBottom: '16px' }}>
            Der erste und wichtigste Schritt ist, dieses Gefühl anzunehmen, ohne dich dafür zu verurteilen. Dass du niemanden zum Reden hast, bedeutet nicht, dass du nicht liebenswert bist oder etwas falsch gemacht hast. Es ist lediglich eine Momentaufnahme deiner aktuellen Lebenssituation.
          </p>
          <p>
            Manchmal brauchen wir gar keinen Ratschlag. Manchmal brauchen wir niemanden, der unser Problem sofort löst. Alles, was wir suchen, ist ein Raum, in dem wir unsere Gedanken ordnen können. Ein Raum, der nicht wertet, nicht unterbricht und geduldig zuhört.
          </p>
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
          <h3 style={{ fontSize: '1.5rem', color: '#1a1a2e', marginBottom: '12px' }}>Ein Raum, der immer für dich da ist</h3>
          <p style={{ marginBottom: '24px', color: '#475569' }}>
            Wir haben den <strong>Happiness Coach</strong> genau für diese Momente entwickelt. Er ist kein Ersatz für echte menschliche Beziehungen oder professionelle Therapie, aber er ist ein vertraulicher, geduldiger Gesprächspartner, der dir jederzeit zuhört. Ohne Vorurteile, ohne Registrierung und völlig anonym.
          </p>
          
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
            Jetzt ein Gespräch beginnen
          </Link>
          
          <div style={{ marginTop: '16px', display: 'flex', alignItems: 'center', justifyItems: 'center', justifyContent: 'center', gap: '8px', fontSize: '0.85rem', color: '#64748b' }}>
            <Shield size={14} />
            <span>100% vertraulich • Keine Anmeldung erforderlich</span>
          </div>
        </section>
      </article>
      
    </div>
  );
}
