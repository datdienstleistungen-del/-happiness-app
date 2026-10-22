import fs from 'fs';

const envFile = fs.readFileSync('C:/Projekte/happiness-app-react/.env', 'utf8');
const env = {};
envFile.split('\n').forEach(line => {
  const [k, ...v] = line.trim().split('=');
  if (k && v.length) env[k.trim()] = v.join('=').trim().replace(/^['"]|['"]$/g, '');
});

const key = env.OPENROUTER_API_KEY || env.VITE_OPENROUTER_API_KEY;

// Fetch free models from OpenRouter
const res = await fetch('https://openrouter.ai/api/v1/models', {
  headers: { Authorization: `Bearer ${key}` }
});
const data = await res.json();
const freeModels = data.data.filter(m => m.id.endsWith(':free'));
console.log(`Found ${freeModels.length} free models on OpenRouter:`);
freeModels.slice(0, 15).forEach(m => console.log(' -', m.id, `(${m.name})`));
