import fs from 'fs';

const envFile = fs.readFileSync('C:/Projekte/happiness-app-react/.env', 'utf8');
const env = {};
envFile.split('\n').forEach(line => {
  const [k, ...v] = line.trim().split('=');
  if (k && v.length) env[k.trim()] = v.join('=').trim().replace(/^['"]|['"]$/g, '');
});

const key = env.GROQ_API_KEY || env.VITE_GROQ_API_KEY;
const res = await fetch('https://api.groq.com/openai/v1/models', {
  headers: { Authorization: `Bearer ${key}` }
});
console.log('Groq models status:', res.status);
if (res.ok) {
  const data = await res.json();
  console.log('Available Groq models:');
  data.data.forEach(m => console.log(' -', m.id));
} else {
  console.log('Error listing Groq models:', await res.text());
}
