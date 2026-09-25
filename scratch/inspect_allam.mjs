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
HEUTIGES DATUM: ${currentYear}.
Entwickle 3 Signal Strategies im JSON-Format:
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

async function testAll() {
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
  console.log('Allam response:', JSON.stringify(data, null, 2));
}

testAll();
