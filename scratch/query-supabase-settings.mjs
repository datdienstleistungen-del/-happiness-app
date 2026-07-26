async function run() {
  console.log('Querying Supabase settings via REST...')
  const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_tArx0o4FeYQ3HthZ7h7hCQ_fTJslkMa'
  
  try {
    const res = await fetch('https://irumowvmhvrofezwvnop.supabase.co/rest/v1/ai_settings?select=*', {
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`
      }
    })
    const data = await res.json()
    console.log('ai_settings contents:', JSON.stringify(data, null, 2))
  } catch (e) {
    console.error('Error fetching ai_settings:', e.message)
  }

  try {
    const res = await fetch('https://irumowvmhvrofezwvnop.supabase.co/rest/v1/profiles?select=*&limit=1', {
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`
      }
    })
    const data = await res.json()
    console.log('profiles columns:', Object.keys(data[0] || {}))
  } catch (e) {
    console.error('Error fetching profiles:', e.message)
  }
}
run()
