import fs from 'fs';

const envFile = fs.readFileSync('C:/Projekte/happiness-app-react/.env', 'utf8');
const env = {};
envFile.split('\n').forEach(line => {
  const [k, ...v] = line.trim().split('=');
  if (k && v.length) env[k.trim()] = v.join('=').trim().replace(/^['"]|['"]$/g, '');
});

console.log('--- PROVIDER KEY STATUS ---');
console.log('GROQ_API_KEY set:', Boolean(env.GROQ_API_KEY || env.VITE_GROQ_API_KEY));
console.log('GROQ_API_KEY_2 set:', Boolean(env.GROQ_API_KEY_2));
console.log('DEEPSEEK_API_KEY set:', Boolean(env.DEEPSEEK_API_KEY));
console.log('MISTRAL_API_KEY set:', Boolean(env.MISTRAL_API_KEY || env.VITE_MISTRAL_API_KEY));
console.log('OPENROUTER_API_KEY set:', Boolean(env.OPENROUTER_API_KEY || env.VITE_OPENROUTER_API_KEY));
console.log('OPENAI_API_KEY set:', Boolean(env.OPENAI_API_KEY));
