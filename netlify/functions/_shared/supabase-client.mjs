/**
 * Shared Supabase Server Client Helper for Netlify Functions (Node.js 20+)
 * Optimized for serverless execution:
 * - Caches static clients (e.g. Service Role or anon without user token) to avoid connection churn
 * - Configures auth with no session persistence or auto-refresh timers
 * - Provides 'ws' transport to satisfy realtime-js WebSocket factory check without active subscriptions
 */
import { createClient } from '@supabase/supabase-js';
import ws from 'ws';

// Memory cache across warm serverless container invocations
const serverClientCache = new Map();

export function createServerClient(url, key, options = {}) {
  const { auth = {}, realtime = {}, global = {}, ...rest } = options;
  const hasCustomAuthHeader = Boolean(global.headers && (global.headers.Authorization || global.headers.authorization));

  // Only cache clients that do NOT carry request-specific auth headers or custom options
  const isCachable = !hasCustomAuthHeader && Object.keys(rest).length === 0 && Object.keys(auth).length === 0;
  const cacheKey = `${url}::${key}`;

  if (isCachable && serverClientCache.has(cacheKey)) {
    return serverClientCache.get(cacheKey);
  }

  const client = createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
      ...auth
    },
    realtime: { transport: ws, ...realtime },
    global: { ...global },
    ...rest
  });

  if (isCachable) {
    serverClientCache.set(cacheKey, client);
  }

  return client;
}
