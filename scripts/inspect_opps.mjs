import fs from 'fs';

let envVars = {};
try {
  const envContent = fs.readFileSync('.env', 'utf-8');
  envContent.split('\n').forEach(line => {
    const [k, ...v] = line.trim().split('=');
    if (k && v.length) envVars[k.trim()] = v.join('=').trim().replace(/^["']|["']$/g, '');
  });
} catch (e) {}

const url = envVars.VITE_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const key = envVars.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!url || !key) {
  console.log('No Supabase env vars');
  process.exit(0);
}

const resp = await fetch(`${url}/rest/v1/nexus_opportunities?select=id,title,situation,pipeline_stage,review_status,created_at,source&deleted_at=is.null&order=created_at.desc&limit=30`, {
  headers: {
    'apikey': key,
    'Authorization': `Bearer ${key}`
  }
});

const data = await resp.json();
console.log(`Total Opportunities in DB: ${data.length}`);
data.forEach((d, idx) => {
  console.log(`${idx + 1}. [Stage: ${d.pipeline_stage || 'none'}] [Review: ${d.review_status || 'none'}] [Date: ${d.created_at?.slice(0, 10)}] ${d.title} (Source: ${d.source})`);
});
