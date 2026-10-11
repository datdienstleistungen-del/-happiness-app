/**
 * Shared Supabase Server Client Helper for Netlify Functions (Node.js 20+)
 * Provides the required 'ws' transport to prevent "Node.js 20 detected without native WebSocket support" error.
 */
import { createClient } from '@supabase/supabase-js';
import ws from 'ws';

export function createServerClient(url, key, options = {}) {
  const { auth = {}, realtime = {}, ...rest } = options;
  return createClient(url, key, {
    auth: { persistSession: false, ...auth },
    realtime: { transport: ws, ...realtime },
    ...rest
  });
}
