import { useState } from 'react'
import { useLanguage } from '../i18n/translations'
import './LegalPage.css'

export default function LegalPage() {
  const { t, lang } = useLanguage()
  const [activeTab, setActiveTab] = useState('impressum')

  const content = {
    impressum: {
      de: {
        title: 'Impressum',
        content: `
## Angaben gemäß § 5 TMG

**Verantwortlich für den Inhalt:**
Harro Goerndt
D.A.T Dienstleistungen
Weserstraße 16
26382 Wilhelmshaven
E-Mail: datdienstleistungen@gmail.com

## Kontakt
D.A.T Dienstleistungen
Weserstraße 16
26382 Wilhelmshaven
E-Mail: datdienstleistungen@gmail.com

## Umsatzsteuer-ID
Umsatzsteuer-Identifikationsnummer gemäß § 27a Umsatzsteuergesetz: [wird nachgetragen]

## Verantwortlich für den Inhalt nach § 55 Abs. 2 RStV
Harro Goerndt
D.A.T Dienstleistungen
Weserstraße 16
26382 Wilhelmshaven

## Streitschlichtung
Die Europäische Kommission stellt eine Plattform zur Online-Streitbeilegung (OS) bereit: https://ec.europa.eu/consumers/odr/. Wir sind nicht bereit oder verpflichtet, an Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle teilzunehmen.

## Haftung für Inhalte
Als Diensteanbieter sind wir gemäß § 7 Abs. 1 TMG für eigene Inhalte auf diesen Seiten nach den allgemeinen Gesetzen verantwortlich. Nach §§ 8 bis 10 TMG sind wir als Diensteanbieter jedoch nicht verpflichtet, übermittelte oder gespeicherte fremde Informationen zu überwachen oder nach Umständen zu forschen, die auf eine rechtswidrige Tätigkeit hinweisen.

## Haftung für Links
Unser Angebot enthält Links zu externen Websites Dritter, auf deren Inhalte wir keinen Einfluss haben. Deshalb können wir für diese fremden Inhalte auch keine Gewähr übernehmen. Für die Inhalte der verlinkten Seiten ist stets der jeweilige Anbieter oder Betreiber der Seiten verantwortlich.
        `
      },
      en: {
        title: 'Legal Notice',
        content: `
## Information according to § 5 TMG

**Responsible for content:**
Harro Goerndt
D.A.T Dienstleistungen
Weserstraße 16
26382 Wilhelmshaven, Germany
Email: datdienstleistungen@gmail.com

## Contact
D.A.T Dienstleistungen
Weserstraße 16
26382 Wilhelmshaven, Germany
Email: datdienstleistungen@gmail.com

## Dispute Resolution
The European Commission provides a platform for online dispute resolution (OS): https://ec.europa.eu/consumers/odr/. We are not willing or obligated to participate in dispute resolution proceedings before a consumer arbitration board.
        `
      }
    },
    datenschutz: {
      de: {
        title: 'Datenschutzerklärung',
        content: `
## 1. Datenschutz auf einen Blick

### Allgemeine Hinweise
Die folgenden Hinweise geben einen einfachen Überblick darüber, was mit Ihren personenbezogenen Daten passiert, wenn Sie diese Website nutzen. Personenbezogene Daten sind alle Daten, mit denen Sie persönlich identifiziert werden können.

### Datenerfassung auf dieser Website

**Wer ist verantwortlich für die Datenerfassung auf dieser Website?**
Die Datenverarbeitung auf dieser Website erfolgt durch den Websitebetreiber:
Harro Goerndt
D.A.T Dienstleistungen
Weserstraße 16
26382 Wilhelmshaven
E-Mail: datdienstleistungen@gmail.com

### Wie erfassen wir Ihre Daten?
Ihre Daten werden zum einen dadurch erhoben, dass Sie uns diese mitteilen. Hierbei kann es sich z.B. um Daten handeln, die Sie in ein Kontaktformular eingeben.

Andere Daten werden automatisch oder nach Ihrer Einwilligung beim Besuch der Website durch unsere IT-Systeme erfasst. Das sind vor allem technische Daten (z.B. Internetbrowser, Betriebssystem oder Uhrzeit des Seitenaufrufs).

### Wofür nutzen wir Ihre Daten?
Ein Teil der Daten wird erhoben, um eine fehlerfreie Bereitstellung der Website zu gewährleisten. Andere Daten können zur Analyse Ihres Nutzerverhaltens verwendet werden.

### Welche Rechte haben Sie bezüglich Ihrer Daten?
Sie haben jederzeit das Recht, unentgeltlich Auskunft über Herkunft, Empfänger und Zweck Ihrer gespeicherten personenbezogenen Daten zu erhalten. Sie haben außerdem ein Recht, die Berichtigung oder Löschung dieser Daten zu verlangen. Wenn Sie eine Einwilligung zur Datenverarbeitung erteilt haben, können Sie diese Einwilligung jederzeit für die Zukunft widerrufen. Hierzu sowie zu weiteren Fragen zum Thema Datenschutz können Sie sich jederzeit an uns wenden.

## 2. Hosting

Diese Website wird bei Netlify gehostet. Anbieter ist die Netlify, Inc., 44 Montgomery Street, Suite 300, San Francisco, California 94104, USA.

Netlify verarbeitet personenbezogene Daten nur im Rahmen der Erfüllung unserer vertraglichen Verpflichtungen und auf Grundlage unserer berechtigten Interessen an der sicheren und effizienten Bereitstellung unseres Online-Angebots.

## 3. Allgemeine Informationen und Pflichtinformationen

### Datenschutz
Die Betreiber dieser Seiten nehmen den Schutz Ihrer persönlichen Daten sehr ernst. Wir behandeln Ihre personenbezogenen Daten vertraulich und entsprechend der gesetzlichen Datenschutzvorschriften sowie dieser Datenschutzerklärung.

Wenn Sie diese Website nutzen, werden verschiedene personenbezogene Daten erhoben. Personenbezogene Daten sind Daten, mit denen Sie persönlich identifiziert werden können. Die vorliegende Datenschutzerklärung erläutert, welche Daten wir erheben und wofür wir sie nutzen.

### Verantwortliche Stelle
Die verantwortliche Stelle für die Datenverarbeitung auf dieser Website ist:

Harro Goerndt
D.A.T.Dienstleistungen
E-Mail: datdienstleistungen@gmail.com

### Widerruf Ihrer Einwilligung zur Datenverarbeitung
Viele Datenverarbeitungsvorgänge sind nur mit Ihrer ausdrücklichen Einwilligung möglich. Sie können eine bereits erteilte Einwilligung jederzeit widerrufen. Dazu reicht eine formlose Mitteilung per E-Mail an uns. Die Rechtmäßigkeit der bis zum Widerruf erfolgten Datenverarbeitung bleibt vom Widerruf unberührt.

### Auskunft, Löschung und Berichtigung
Sie haben im Rahmen der geltenden gesetzlichen Bestimmungen jederzeit das Recht auf unentgeltliche Auskunft über Ihre gespeicherten personenbezogenen Daten, deren Herkunft und Empfänger und den Zweck der Datenverarbeitung und ggf. ein Recht auf Berichtigung oder Löschung dieser Daten. Hierzu sowie zu weiteren Fragen zum Thema personenbezogene Daten können Sie sich jederzeit an uns wenden.

### SSL- bzw. TLS-Verschlüsselung
Diese Seite nutzt aus Sicherheitsgründen und zum Schutz der Übertragung vertraulicher Inhalte eine SSL-bzw. TLS-Verschlüsselung. Eine verschlüsselte Verbindung erkennen Sie daran, dass die Adresszeile des Browsers von „http://“ auf „https://“ wechselt und an dem Schloss-Symbol in Ihrer Browserzeile.

## 4. Datenerfassung auf dieser Website

### Server-Log-Dateien
Der Provider der Seiten erhebt und speichert automatisch Informationen in so genannten Server-Log-Dateien, die Ihr Browser automatisch an uns übermittelt. Dies sind:
- Browsertyp und Browserversion
- verwendetes Betriebssystem
- Referrer URL
- Hostname des zugreifenden Rechners
- Uhrzeit der Serveranfrage
- IP-Adresse

Eine Zusammenführung dieser Daten mit anderen Datenquellen wird nicht vorgenommen.

### Registrierung auf dieser Website
Sie können sich auf dieser Website registrieren. Die dabei eingegebenen personenbezogenen Daten werden nur für die Nutzung des jeweiligen Angebots verwendet. Bei der Registrierung werden folgende Daten verarbeitet:
- E-Mail-Adresse
- Gewähltes Passwort (verschlüsselt gespeichert)

### AI Chat (KI-Assistent)
Wenn Sie den KI-Chat nutzen, werden Ihre Gesprächsverläufe gespeichert, um Ihnen personalisierte Antworten geben zu können. Sie können Ihre Gesprächsverläufe jederzeit über die Export-Funktion herunterladen und über die Lösch-Funktion vollständig entfernen.

Die Daten werden auf Servern in Europa (Supabase, EU-West-1, Irland) gespeichert und unterliegen dem europäischen Datenschutz (DSGVO).

### Zahlungen über Stripe
Für die Abwicklung von Zahlungen nutzen wir Stripe. Anbieter ist die Stripe, Inc., 354 Oyster Point Blvd, South San Francisco, CA 94080, USA.

Bei einer Zahlung werden folgende Daten an Stripe übermittelt:
- Name
- E-Mail-Adresse
- Zahlungsinformationen (IBAN, Kreditkarte)
- IP-Adresse

Stripe verarbeitet Zahlungsdaten im Rahmen der DSGVO. Weitere Informationen zum Datenschutz bei Stripe finden Sie unter: https://stripe.com/privacy

## 5. Plugins und Tools

### Google Web Fonts
Diese Seite nutzt zur einheitlichen Darstellung von Schriftarten so genannte Web Fonts, die von Google bereitgestellt werden. Beim Aufruf einer Seite lädt Ihr Browser die benötigten Web Fonts in Ihren Browsercache, um Texte und Schriftarten korrekt anzuzeigen.

Dazu muss der von Ihnen verwendete Browser Verbindung zu den Servern von Google aufnehmen. Hierdurch erlangt Google Kenntnis darüber, dass Ihre IP-Adresse verwendet wird, um diese Website aufzurufen. Die Nutzung von Google Web Fonts erfolgt im Interesse einer einheitlichen und ansprechenden Darstellung unseres Online-Angebots.

## 6. Ihre Rechte als Betroffener

Sie haben jederzeit das Recht:
- Auskunft über Ihre gespeicherten Daten zu erhalten (Art. 15 DSGVO)
- Ihre gespeicherten Daten berichtigen zu lassen (Art. 16 DSGVO)
- Ihre gespeicherten Daten löschen zu lassen (Art. 17 DSGVO)
- Die Einschränkung der Verarbeitung Ihrer Daten zu verlangen (Art. 18 DSGVO)
- Widerspruch gegen die Verarbeitung Ihrer Daten einzulegen (Art. 21 DSGVO)
- Ihre Daten in einem strukturierten, gängigen und maschinenlesbaren Format zu erhalten (Art. 20 DSGVO)

### Beschwerde bei der Aufsichtsbehörde
Sie haben das Recht, sich bei einer Aufsichtsbehörde über die Verarbeitung Ihrer personenbezogenen Daten zu beschweren.

## 7. Änderungen dieser Datenschutzerklärung
Wir behalten uns vor, diese Datenschutzerklärung anzupassen, damit sie stets den aktuellen rechtlichen Anforderungen entspricht oder um Änderungen unserer Leistungen in der Datenschutzerklärung umzusetzen.
        `
      },
      en: {
        title: 'Privacy Policy',
        content: `
## 1. Privacy at a Glance

### General Information
The following information provides a simple overview of what happens to your personal data when you visit this website. Personal data is any data that can be used to personally identify you.

### Data Collection on this Website

**Who is responsible for data collection on this website?**
Data processing on this website is carried out by the website operator:
Harro Goerndt
D.A.T Dienstleistungen
Weserstraße 16
26382 Wilhelmshaven, Germany
Email: datdienstleistungen@gmail.com

### How do we collect your data?
Your data is collected when you provide it to us. This may include data you enter in a contact form.

Other data is collected automatically by our IT systems when you visit the website. This is primarily technical data (e.g., internet browser, operating system, or time of page access).

### What do we use your data for?
Some of the data is collected to ensure the website functions properly. Other data may be used to analyze your user behavior.

### What rights do you have regarding your data?
You have the right to receive information about the origin, recipients, and purpose of your stored personal data at any time. You also have the right to request the correction or deletion of this data. If you have given consent to data processing, you can revoke this consent at any time.

## 2. Hosting

This website is hosted by Netlify. Provider is Netlify, Inc., 44 Montgomery Street, Suite 300, San Francisco, California 94104, USA.

## 3. Payment Processing (Stripe)

For payment processing, we use Stripe. Provider is Stripe, Inc., 354 Oyster Point Blvd, South San Francisco, CA 94080, USA.

When a payment is made, the following data is transmitted to Stripe:
- Name
- Email address
- Payment information (IBAN, credit card)
- IP address

For more information on privacy at Stripe, visit: https://stripe.com/privacy

## 4. Your Rights

You have the right at any time:
- To receive information about your stored data (Art. 15 GDPR)
- To have your stored data corrected (Art. 16 GDPR)
- To have your stored data deleted (Art. 17 GDPR)
- To restrict the processing of your data (Art. 18 GDPR)
- To object to the processing of your data (Art. 21 GDPR)
- To receive your data in a structured, common, and machine-readable format (Art. 20 GDPR)
        `
      }
    },
    agb: {
      de: {
        title: 'Allgemeine Geschäftsbedingungen (AGB)',
        content: `
## 1. Geltungsbereich

Diese Allgemeinen Geschäftsbedingungen (nachfolgend „AGB") gelten für alle Verträge über die Lieferung von Waren und die Erbringung von Dienstleistungen zwischen

Harro Goerndt
D.A.T Dienstleistungen
Weserstraße 16
26382 Wilhelmshaven
E-Mail: datdienstleistungen@gmail.com

und ihren Kunden. Die AGB gelten in der jeweils zum Zeitpunkt des Vertragsschlusses gültigen Fassung.

## 2. Vertragsschluss

Der Vertrag kommt durch die Annahme des Angebots des Anbieters durch den Kunden zustande. Der Kunde nimmt das Angebot durch Registrierung auf der Website und Nutzung der angebotenen Dienstleistungen an.

## 3. Leistungen

### AI Chat (Künstliche Intelligenz)
Der Happiness AI Chat bietet eine künstliche Intelligenz, die Nutzern bei alltäglichen Fragen helfen kann. Die Antworten der KI stellen keine rechtliche, medizinische oder finanzielle Beratung dar.

### Preisgestaltung
Die Nutzung des AI Chat ist bis zu 20 Fragen kostenlos. Danach ist eine Bezahlung von 4,99 EUR pro Monat erforderlich, um weiterhin unbegrenzt Fragen stellen zu können.

### Zahlungsarten
Folgende Zahlungsarten werden akzeptiert:
- SEPA-Lastschrift (Sofortüberweisung)
- Kreditkarte (Visa, Mastercard)

Die Zahlung erfolgt über den Zahlungsdienstleister Stripe.

## 4. Preise und Zahlung

### Preise
Alle Preise verstehen sich inklusive der gesetzlichen Mehrwertsteuer. Der Preis wird dem Kunden vor Abschluss des Kaufvorgangs angezeigt.

### Zahlungsabwicklung
Die Zahlung erfolgt über Stripe. Der Kunde willigt ein, dass seine Zahlungsdaten an Stripe zur Abwicklung der Zahlung übermittelt werden.

### Wiederkehrende Zahlungen
Bei Abonnements wird der Betrag automatisch zum Beginn eines jeden Monats von dem vom Kunden angegebenen Zahlungsmittel abgebucht.

## 5. Kündigungsrecht

### Kündigung durch den Kunden
Der Kunde kann sein Abonnement jederzeit mit einer Frist von 30 Tagen zum Monatsende kündigen. Die Kündigung erfolgt über die Einstellungen in seinem Account oder per E-Mail an datdienstleistungen@gmail.com.

### Kündigung durch den Anbieter
Der Anbieter kann das Abonnement mit einer Frist von 30 Tagen kündigen, wenn der Kunde gegen wesentliche Bestimmungen dieser AGB verstößt.

## 6. Widerrufsrecht

### Verbraucher
Verbraucher haben ein 14-tägiges Widerrufsrecht. Ein Verbraucher ist jede natürliche Person, die ein Rechtsgeschäft zu Zwecken abstießt, die überwiegend weder ihrer gewerblichen noch ihrer selbständigen beruflichen Tätigkeit zugerechnet werden können.

### Widerrufsbelehrung
Das Widerrufsrecht erlischt vorzeitig, wenn der Verbraucher ausdrücklich zugestimmt hat, dass der Anbieter mit der Ausführung der Dienstleistung vor Ablauf der Widerrufsfrist beginnt. Der Verbraucher bestätigt mit seiner Zustimmung, dass er von seinem Widerrufsrecht weiß, wenn er die Dienstleistung vor Ablauf der Widerrufsfrist in Anspruch nimmt.

## 7. Haftung

### Haftung für Inhalte
Der Anbieter haftet für eigene Inhalte auf diesen Seiten nach den allgemeinen Gesetzen. Eine Haftung für die Inhalte der verlinkten Seiten besteht jedoch nur, wenn Kenntnis von einem Rechtsverstoß vorliegt und die Entfernung technisch möglich und zumutbar ist.

### Haftung für Fehler in der KI
Die Antworten des Happiness AI basieren auf künstlicher Intelligenz und können Fehler enthalten. Der Anbieter haftet nicht für Schäden, die durch die Nutzung der KI-Antworten entstehen.

## 8. Urheberrecht

Die durch den Anbieter erstellten Inhalte und Werke auf diesen Seiten unterliegen dem deutschen Urheberrecht. Die Vervielfältigung, Bearbeitung, Verbreitung und jede Art der Verwertung außerhalb der Grenzen des Urheberrechtes bedürfen der schriftlichen Zustimmung des jeweiligen Autors bzw. Erstellers.

## 9. Datenschutz

Die Erhebung und Verwendung personenbezogener Daten des Kunden erfolgt unter Beachtung der geltenden datenschutzrechtlichen Bestimmungen, insbesondere der DSGVO. Nähere Informationen finden Sie in unserer Datenschutzerklärung.

## 10. Schlussbestimmungen

Es gilt das Recht der Bundesrepublik Deutschland. Ausgeschlossen ist die Anwendung des UN-Kaufrechts (CISG). Sollten einzelne Bestimmungen dieser AGB unwirksam sein oder werden, so wird die Wirksamkeit der übrigen Bestimmungen hiervon nicht berührt.
        `
      },
      en: {
        title: 'Terms of Service',
        content: `
## 1. Scope

These Terms of Service apply to all contracts for the delivery of goods and the provision of services between:

Harro Goerndt
D.A.T Dienstleistungen
Weserstraße 16
26382 Wilhelmshaven, Germany
Email: datdienstleistungen@gmail.com

and their customers.

## 2. Services

### AI Chat (Artificial Intelligence)
The Happiness AI Chat offers artificial intelligence that can help users with everyday questions. The AI's responses do not constitute legal, medical, or financial advice.

### Pricing
Using the AI Chat is free for up to 20 questions. After that, a payment of 4.99 EUR per month is required to continue asking unlimited questions.

### Payment Methods
The following payment methods are accepted:
- SEPA Direct Debit (instant transfer)
- Credit card (Visa, Mastercard)

Payment is processed through Stripe.

## 3. Cancellation

### Cancellation by the Customer
The customer can cancel their subscription at any time with 30 days notice until the end of the month.

### Cancellation by the Provider
The provider may cancel the subscription with 30 days notice if the customer violates essential provisions of these terms.

## 4. Liability

The responses of the Happiness AI are based on artificial intelligence and may contain errors. The provider is not liable for damages arising from the use of AI responses.

## 5. Privacy

The collection and use of customer personal data is carried out in compliance with applicable data protection regulations, particularly the GDPR. For more information, please see our Privacy Policy.

## 6. Final Provisions

German law applies. Should individual provisions of these terms be or become invalid, this shall not affect the validity of the remaining provisions.
        `
      }
    }
  }

  const tabs = [
    { id: 'impressum', label: lang === 'de' ? 'Impressum' : 'Legal Notice' },
    { id: 'datenschutz', label: lang === 'de' ? 'Datenschutz' : 'Privacy' },
    { id: 'agb', label: 'AGB' },
  ]

  const currentContent = content[activeTab]?.[lang] || content[activeTab]?.de

  return (
    <div className="legal-page">
      <div className="legal-container">
        <div className="legal-tabs">
          {tabs.map(tab => (
            <button
              key={tab.id}
              className={`legal-tab ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="legal-content">
          <h1>{currentContent.title}</h1>
          <div className="legal-text">
            {currentContent.content.split('\n').map((line, i) => {
              if (line.startsWith('## ')) {
                return <h2 key={i}>{line.replace('## ', '')}</h2>
              }
              if (line.startsWith('### ')) {
                return <h3 key={i}>{line.replace('### ', '')}</h3>
              }
              if (line.startsWith('- ')) {
                return <li key={i}>{line.replace('- ', '')}</li>
              }
              if (line.trim() === '') {
                return <br key={i} />
              }
              return <p key={i}>{line}</p>
            })}
          </div>
        </div>

        <div className="legal-footer">
          <p>© {new Date().getFullYear()} Harro Goerndt · D.A.T Dienstleistungen · Wilhelmshaven</p>
        </div>
      </div>
    </div>
  )
}
