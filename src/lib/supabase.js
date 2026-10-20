import { createClient } from '@supabase/supabase-js'

const supabaseUrl = (typeof import.meta !== 'undefined' && import.meta?.env?.VITE_SUPABASE_URL) || (typeof process !== 'undefined' && process.env?.VITE_SUPABASE_URL) || 'https://irumowvmhvrofezwvnop.supabase.co'
const supabaseAnonKey = (typeof import.meta !== 'undefined' && import.meta?.env?.VITE_SUPABASE_ANON_KEY) || (typeof process !== 'undefined' && process.env?.VITE_SUPABASE_ANON_KEY) || 'sb_publishable_tArx0o4FeYQ3HthZ7h7hCQ_fTJslkMa'

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  realtime: (typeof window === 'undefined' && typeof WebSocket === 'undefined') ? { transport: class DummyWS {} } : undefined
})
