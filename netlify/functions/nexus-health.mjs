/**
 * NeXus System & LLM Provider Health Monitoring
 * 
 * Liefert Live-Metriken zu:
 * - Provider-Status (Groq, OpenRouter, Mistral, OpenAI, DeepSeek)
 * - Aktive Cooldowns & Fehlerraten
 * - Aktive Rate-Limits & Schutzmaßnahmen
 */

import { getProviderHealthSnapshot } from './_shared/quota.mjs';

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization'
      }
    };
  }

  try {
    const health = await getProviderHealthSnapshot();
    const allProvidersHealthy = Object.values(health).every(p => p.status === 'HEALTHY');

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        status: allProvidersHealthy ? 'OK' : 'DEGRADED',
        timestamp: new Date().toISOString(),
        system: {
          name: 'NeXus Revenue OS',
          version: '2.0.0',
          protection: {
            rate_limiting: {
              max_scans_per_user_per_day: 10,
              max_pitches_per_user_per_hour: 5
            },
            cost_control: {
              max_tokens_per_user_per_day: 100000,
              primary_provider: 'deepseek (v3 reasoning/chat)',
              fallback_chain: ['deepseek', 'mistral', 'openrouter', 'groq', 'openai']
            },
            caching: {
              scan_cache_ttl_hours: 24,
              force_refresh_supported: true
            },
            privacy: {
              rls_enabled: true,
              tenant_isolation: 'user_id'
            }
          }
        },
        providers: health
      }, null, 2)
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ error: error.message })
    };
  }
};
