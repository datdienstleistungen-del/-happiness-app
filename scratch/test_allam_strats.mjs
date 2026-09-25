import fs from 'fs';
import path from 'path';

const envPath = path.resolve('C:/Projekte/happiness-app-react/.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const [k, ...v] = trimmed.split('=');
      if (k && v.length) {
        process.env[k.trim()] = v.join('=').trim();
      }
    }
  });
}

const groqKey = process.env.GROQ_API_KEY;

const aiUnderstanding = {
  offering_name: "Cloudbasierte Vertriebs- und CRM-Software für wachsende IT-Unternehmen",
  target_audience: "B2B Entscheider",
  positioning: "Cloudbasierte Vertriebs- und CRM-Software für wachsende IT-Unternehmen"
};

const currentYear = new Date().getFullYear();
const systemPrompt = `Du bist NeXus HIT, ein High-Impact Intelligence Tool für B2B Sales.
HEUTIGES DATUM / AKTUELLER ZEITHORIZONT: Jahr ${currentYear}.
Deine Aufgabe: Entwickle auf Basis des tiefen semantischen Verständnisses (Offering Understanding) eine umfassende Liste von "Signal Strategies" (Suchstrategien), um im Internet nach passenden, hochaktuellen Trigger-Ereignissen (Jahr ${currentYear}) zu suchen.

ANGEBOTS-VERSTÄNDNIS (Wahrheitsschicht):
${JSON.stringify(aiUnderstanding, null, 2)}

ZIELMÄRKTE FÜR DIE SUCHE:
Global

Antworte AUSSCHLIESSLICH im folgenden JSON-Format:
{
  "strategies": [
    {
      "signal_category": "expansion",
      "trigger_name": "Expansion",
      "search_queries": [
        {
          "market": "Deutschland",
          "language": "de-DE",
          "query": "IT Vertriebsleiter ${currentYear}"
        }
      ],
      "source_hints": ["LinkedIn"],
      "why_relevant": "Relevanz"
    }
  ]
}`;

async function testAllam() {
  console.log('--- TESTING ALLAM-2-7B ---');
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${groqKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'allam-2-7b',
      messages: [{ role: 'system', content: systemPrompt }],
      temperature: 0.7,
      max_tokens: 3000,
      response_format: { type: 'json_object' }
    })
  });
  const data = await res.json();
  const text = data.choices?.[0]?.message?.content;
  console.log('Allam output:\n', text);
}

testAllam();
