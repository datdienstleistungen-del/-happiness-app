import fs from 'fs';
import path from 'path';

// 1. Load .env
const envPath = path.resolve('.env');
const env = {};
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf8');
  content.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
      const [k, ...v] = trimmed.split('=');
      env[k.trim()] = v.join('=').trim().replace(/^['"]|['"]$/g, '');
    }
  });
}

console.log('='.repeat(70));
console.log('🔍 LLM GATEWAY CONNECTIVITY & FREE-TIER VALIDATION');
console.log('='.repeat(70));

const openrouterKey = env.OPENROUTER_API_KEY || env.VITE_OPENROUTER_API_KEY || env.OPENROUTER_API_KEY_2;
const mistralKey = env.MISTRAL_API_KEY || env.VITE_MISTRAL_API_KEY;

console.log(`\n🔑 API-Key Status:`);
console.log(`• OpenRouter: ${openrouterKey ? `Vorhanden (${openrouterKey.slice(0, 10)}...${openrouterKey.slice(-4)})` : '❌ FEHLT'}`);
console.log(`• Mistral:    ${mistralKey ? `Vorhanden (${mistralKey.slice(0, 7)}...${mistralKey.slice(-4)})` : '❌ FEHLT'}`);

// Test OpenRouter
async function testOpenRouter() {
  console.log('\n' + '-'.repeat(70));
  console.log('📡 [1/2] TEST: OPENROUTER GATEWAY & FREE-TIER');
  console.log('-'.repeat(70));

  if (!openrouterKey) {
    console.log('❌ Übersprungen: Kein OPENROUTER_API_KEY konfiguriert.');
    return { success: false, reason: 'missing_key' };
  }

  // 1. Check Key Status & Limits
  try {
    const authRes = await fetch('https://openrouter.ai/api/v1/auth/key', {
      headers: { Authorization: `Bearer ${openrouterKey}` }
    });
    if (authRes.ok) {
      const authData = await authRes.json();
      console.log('✅ OpenRouter Auth-Check: Status', authRes.status);
      console.log(`   Label: ${authData.data?.label || 'N/A'}`);
      console.log(`   Usage (Credits verbraucht): $${authData.data?.usage ?? 0}`);
      console.log(`   Limit (Budgetgrenze): ${authData.data?.limit ? '$' + authData.data.limit : 'Kein Limit gesetzt'}`);
      console.log(`   Is Free Tier: ${authData.data?.is_free_tier ? 'JA' : 'Nein / Pay-as-you-go'}`);
      console.log(`   Rate Limit: ${authData.data?.rate_limit?.requests ?? 'N/A'} req / ${authData.data?.rate_limit?.interval ?? 'N/A'}`);
    } else {
      console.log('⚠️ OpenRouter Auth Check nicht erfolgreich: Status', authRes.status);
    }
  } catch (err) {
    console.log('⚠️ Auth-Endpoint Warnung:', err.message);
  }

  // 2. Fetch Free Models
  let selectedModel = 'nvidia/nemotron-3.5-lightning:free';
  try {
    const modelsRes = await fetch('https://openrouter.ai/api/v1/models', {
      headers: { Authorization: `Bearer ${openrouterKey}` }
    });
    if (modelsRes.ok) {
      const modelsData = await modelsRes.json();
      const freeModels = modelsData.data?.filter(m => m.id?.endsWith(':free')) || [];
      console.log(`\n📋 Gefundene aktive Free-Tier Modelle (${freeModels.length} verfügbar):`);
      freeModels.slice(0, 5).forEach(m => {
        console.log(`   • ${m.id} (${m.name}) - Pricing: Prompt $${m.pricing?.prompt}/tok, Completion $${m.pricing?.completion}/tok`);
      });
      if (freeModels.length > 0) {
        selectedModel = freeModels[0].id;
      }
    }
  } catch (err) {
    console.log('⚠️ Models-Endpoint Fehler:', err.message);
  }

  // 3. Test multiple free models
  const candidateModels = [
    'liquid/lfm-2.5-2.6b:free',
    'nvidia/nemotron-3.5-super-vl:free',
    'recursive/flint-v1.0:free'
  ];

  let bestResult = null;
  for (const model of candidateModels) {
    console.log(`\n🚀 Sende minimalen Test-Request an: "${model}"...`);
    const startTime = Date.now();
    try {
      const chatRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openrouterKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://nexus-hit.netlify.app',
          'X-Title': 'NeXus Sales Intelligence Gateway Healthcheck'
        },
        body: JSON.stringify({
          model: model,
          messages: [{ role: 'user', content: 'Antworte mit einem Wort: Pong' }],
          max_tokens: 10,
          temperature: 0.1
        })
      });

      const elapsed = Date.now() - startTime;
      const statusCode = chatRes.status;
      console.log(`   Status Code: ${statusCode} (Dauer: ${elapsed}ms)`);

      if (chatRes.ok) {
        const json = await chatRes.json();
        const answer = json.choices?.[0]?.message?.content?.trim() || '(Kein Text)';
        const usage = json.usage || {};
        console.log(`✅ Antwort erhalten: "${answer}"`);
        console.log(`   Tokens: Prompt=${usage.prompt_tokens || 0}, Completion=${usage.completion_tokens || 0}, Total=${usage.total_tokens || 0}`);
        console.log(`   Finanzielle Kosten: 0,00 $ (100% Free-Tier Modell)`);
        bestResult = { success: true, status: statusCode, model, answer, cost: '0.00 $' };
        break;
      } else {
        const errText = await chatRes.text();
        console.log(`⚠️ OpenRouter ${model} HTTP ${statusCode}:`, errText.slice(0, 180));
      }
    } catch (err) {
      console.log('❌ Request Fehler:', err.message);
    }
  }
  return bestResult || { success: false, status: 500, error: 'No free model responded' };
}

// Test Mistral
async function testMistral() {
  console.log('\n' + '-'.repeat(70));
  console.log('📡 [2/2] TEST: MISTRAL AI GATEWAY');
  console.log('-'.repeat(70));

  if (!mistralKey) {
    console.log('❌ Übersprungen: Kein MISTRAL_API_KEY konfiguriert.');
    return { success: false, reason: 'missing_key' };
  }

  // 1. Check Models Endpoint
  try {
    const modelsRes = await fetch('https://api.mistral.ai/v1/models', {
      headers: { Authorization: `Bearer ${mistralKey}` }
    });
    console.log(`   Models API Status: ${modelsRes.status}`);
  } catch (err) {
    console.log('⚠️ Mistral Models Query Fehler:', err.message);
  }

  // 2. Minimal Chat Request
  const mistralModels = ['mistral-small-latest', 'open-mistral-7b'];
  let mistralResult = null;

  for (const model of mistralModels) {
    console.log(`\n🚀 Sende minimalen Test-Request an Mistral: "${model}"...`);
    const startTime = Date.now();
    try {
      const chatRes = await fetch('https://api.mistral.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${mistralKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: model,
          messages: [{ role: 'user', content: 'Antworte nur mit einem Wort: Pong' }],
          max_tokens: 10,
          temperature: 0.1
        })
      });

      const elapsed = Date.now() - startTime;
      const statusCode = chatRes.status;
      console.log(`   Status Code: ${statusCode} (Dauer: ${elapsed}ms)`);

      const reqRemaining = chatRes.headers.get('x-ratelimit-remaining-req-minute');
      const tokRemaining = chatRes.headers.get('x-ratelimit-remaining-tok-minute');
      if (reqRemaining) console.log(`   Rate-Limits: ${reqRemaining} req/min verbleibend, ${tokRemaining} tok/min verbleibend`);

      if (chatRes.ok) {
        const json = await chatRes.json();
        const answer = json.choices?.[0]?.message?.content?.trim() || '(Kein Text)';
        const usage = json.usage || {};
        console.log(`✅ Antwort erhalten: "${answer}"`);
        console.log(`   Tokens: Prompt=${usage.prompt_tokens || 0}, Completion=${usage.completion_tokens || 0}, Total=${usage.total_tokens || 0}`);
        mistralResult = { success: true, status: statusCode, model, answer, reqRemaining };
        break;
      } else {
        const errText = await chatRes.text();
        console.log(`⚠️ Mistral ${model} HTTP ${statusCode} Fehler:`, errText.slice(0, 180));
        mistralResult = { success: false, status: statusCode, error: errText };
      }
    } catch (err) {
      console.log('❌ Request Fehler:', err.message);
      mistralResult = { success: false, error: err.message };
    }
  }
  return mistralResult;
}

async function run() {
  const orResult = await testOpenRouter();
  const mistralResult = await testMistral();

  console.log('\n' + '='.repeat(70));
  console.log('📊 ZUSAMMENFASSUNG DES GATEWAY-CHECKS:');
  console.log('='.repeat(70));
  console.log(`• OpenRouter Free-Tier: ${orResult.success ? `✅ STATUS 200 OK (Kosten: 0,00 $, Modell: ${orResult.model})` : `❌ FEHLER (Status ${orResult.status})`}`);
  console.log(`• Mistral AI Gateway:   ${mistralResult.success ? `✅ STATUS 200 OK (Modell: ${mistralResult.model})` : `❌ FEHLER (Status ${mistralResult.status})`}`);
  console.log('='.repeat(70) + '\n');
}

run();
