// ============================================================================
// NeXus _shared/llm-core.mjs — Einheitliche Provider-Kette (Phase 2)
// Buerdet die bisher ~21x kopierte Kette (Groq -> OpenRouter -> Mistral ->
// OpenAI/DeepSeek) mit Deadline-Budget, 429-Failover und json_mode-Retry ab.
// Modell-Listen kommen AUSCHLIESSLICH aus ../nexus-models.mjs (Single Source).
// Die Stufenreihenfolge ist pro Aufruf konfigurierbar (providers), weil die
// Dateien historisch unterschiedlich sortiert waren (z.B. DeepSeek vor/nach
// Mistral).
// ============================================================================
import {
  GROQ_FREE_FIRST,
  GROQ_JSON_HEAVY,
  GROQ_COACH,
  GROQ_VISION_MODELS,
  OPENROUTER_FREE_MODELS,
  MISTRAL_DEFAULT_MODEL,
  OPENAI_DEFAULT_MODEL,
} from '../nexus-models.mjs';

export const PROFILES = {
  free: GROQ_FREE_FIRST,       // Standard-Gespraech / Kurz-Klassifikation
  json: GROQ_JSON_HEAVY,       // komplexe JSON-Schemas
  coach: GROQ_COACH,           // langer System-Prompt (Reihenfolge nicht aendern!)
  vision: GROQ_VISION_MODELS,  // Multimodal
};

const ERROR_TAG = (e) => (e?.name === 'AbortError' || e?.name === 'TimeoutError' ? 'timeout' : 'netz');

async function postJSON(url, headers, payload, timeoutMs) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(Math.max(1, Math.round(timeoutMs))),
  });
  return res;
}

const chatBody = (model, messages, temperature, max_tokens, withJson, extraBody = {}) => {
  const payload = { model, messages, temperature, max_tokens, ...extraBody };
  if (withJson) payload.response_format = { type: 'json_object' };
  return payload;
};

const firstText = (data) => data?.choices?.[0]?.message?.content;
const firstUsage = (data) => data?.usage ?? null;

// Annahme-Filter: Optionale Funktion, die unerwuenschte Outputs (z.B.
// Garbage-Marker wie "[SEARCH]"-Blodia) auf Stufe-Ebene aussortiert — dann
// faellt die Kette wie bei "leer" auf die naechste Stufe durch.
const accepted = (ctx, text) => Boolean(text) && (typeof ctx.acceptText !== 'function' || ctx.acceptText(text));

// --- Stufen (jede liefert { text, provider, model } oder null) ---

async function stageGroq(ctx) {
  const keys = [process.env.GROQ_API_KEY || process.env.VITE_GROQ_API_KEY, process.env.GROQ_API_KEY_2].filter(Boolean);
  if (keys.length === 0) { ctx.fail('groq:kein-key'); return null; }
  for (const key of keys) {
    for (const model of ctx.groqModels) {
      if (ctx.skipModels.has(model)) continue;
      if (ctx.remaining() < 1500) { ctx.fail('groq:budget'); return null; }
      // jsonMode: bei 400 auf response_format einmal ohne json_mode wiederholen
      const variants = ctx.jsonMode ? [true, false] : [false];
      for (const withJson of variants) {
        try {
          const res = await postJSON(
            'https://api.groq.com/openai/v1/chat/completions',
            { Authorization: `Bearer ${key}` },
            chatBody(model, ctx.messages, ctx.temperature, ctx.max_tokens, withJson, ctx.extraBody),
            Math.min(9000, ctx.remaining())
          );
          if (res.status === 429) break;            // -> naechstes Modell
          if (res.status === 400 && withJson) { ctx.fail(`groq:${model}:400-json`); continue; }
          if (!res.ok) { ctx.fail(`groq:${model}:${res.status}`); break; }
          const data = await res.json();
          const text = firstText(data);
          if (accepted(ctx, text)) return { text, provider: 'groq', model, usage: firstUsage(data) };
          ctx.fail(`groq:${model}:leer`);
          break;                                     // -> naechstes Modell
        } catch (e) {
          ctx.fail(`groq:${model}:${ERROR_TAG(e)}`);
          break;
        }
      }
    }
  }
  return null;
}

async function stageOpenRouter(ctx) {
  const keys = [process.env.OPENROUTER_API_KEY || process.env.VITE_OPENROUTER_API_KEY, process.env.OPENROUTER_API_KEY_2].filter(Boolean);
  if (keys.length === 0) { ctx.fail('openrouter:kein-key'); return null; }
  for (const key of keys) {
    for (const model of OPENROUTER_FREE_MODELS) {
      if (ctx.skipModels.has(model)) continue;
      if (ctx.remaining() < 1200) { ctx.fail('openrouter:budget'); return null; }
      try {
        const res = await postJSON(
          'https://openrouter.ai/api/v1/chat/completions',
          {
            Authorization: `Bearer ${key}`,
            'HTTP-Referer': 'https://nexus-hit.netlify.app',
            'X-Title': ctx.xTitle,
          },
          chatBody(model, ctx.messages, ctx.temperature, ctx.max_tokens, false, ctx.extraBody),
          Math.min(4000, ctx.remaining())
        );
        if (res.status === 429) { ctx.fail(`openrouter:429-${model}`); break; }
        if (!res.ok) { ctx.fail(`openrouter:${model}:${res.status}`); continue; }
        const data = await res.json();
        const text = data?.choices?.[0]?.message?.content || data?.choices?.[0]?.message?.reasoning;
        if (accepted(ctx, text)) return { text, provider: 'openrouter', model, usage: firstUsage(data) };
        ctx.fail(`openrouter:${model}:leer`);
      } catch (e) {
        ctx.fail(`openrouter:${model}:${ERROR_TAG(e)}`);
      }
    }
  }
  return null;
}

async function stageMistral(ctx) {
  const keys = [process.env.MISTRAL_API_KEY || process.env.VITE_MISTRAL_API_KEY, process.env.MISTRAL_API_KEY_2].filter(Boolean);
  if (keys.length === 0) { ctx.fail('mistral:kein-key'); return null; }
  if (ctx.remaining() < 1200) { ctx.fail('mistral:budget'); return null; }
  for (const key of keys) {
    try {
      const res = await postJSON(
        'https://api.mistral.ai/v1/chat/completions',
        { Authorization: `Bearer ${key}` },
        chatBody(MISTRAL_DEFAULT_MODEL, ctx.messages, ctx.temperature, ctx.max_tokens, ctx.jsonMode, ctx.extraBody),
        Math.min(4000, ctx.remaining())
      );
      if (res.ok) {
        const data = await res.json();
        const text = firstText(data);
        if (accepted(ctx, text)) return { text, provider: 'mistral', model: MISTRAL_DEFAULT_MODEL, usage: firstUsage(data) };
        ctx.fail('mistral:leer');
      } else {
        ctx.fail(`mistral:${res.status}`);
      }
    } catch (e) {
      ctx.fail(`mistral:${ERROR_TAG(e)}`);
    }
  }
  return null;
}

async function stageOpenAI(ctx) {
  const keys = [process.env.OPENAI_API_KEY, process.env.OPENAI_API_KEY_2].filter(Boolean);
  if (keys.length === 0) { ctx.fail('openai:kein-key'); return null; }
  if (ctx.remaining() < 1000) { ctx.fail('openai:budget'); return null; }
  for (const key of keys) {
    try {
      const res = await postJSON(
        'https://api.openai.com/v1/chat/completions',
        { Authorization: `Bearer ${key}` },
        chatBody(OPENAI_DEFAULT_MODEL, ctx.messages, ctx.temperature, ctx.max_tokens, ctx.jsonMode, ctx.extraBody),
        Math.min(4000, ctx.remaining())
      );
      if (res.ok) {
        const data = await res.json();
        const text = firstText(data);
        if (accepted(ctx, text)) return { text, provider: 'openai', model: OPENAI_DEFAULT_MODEL, usage: firstUsage(data) };
        ctx.fail('openai:leer');
      } else {
        ctx.fail(`openai:${res.status}`);
      }
    } catch (e) {
      ctx.fail(`openai:${ERROR_TAG(e)}`);
    }
  }
  return null;
}

async function stageDeepSeek(ctx) {
  const key = process.env.DEEPSEEK_API_KEY;
  if (!key || process.env.DEEPSEEK_ENABLED === 'false') {
    ctx.fail(key ? 'deepseek:disabled' : 'deepseek:kein-key');
    return null;
  }
  if (ctx.remaining() < 1200) { ctx.fail('deepseek:budget'); return null; }
  try {
    const res = await postJSON(
      'https://api.deepseek.com/v1/chat/completions',
      { Authorization: `Bearer ${key}` },
      chatBody('deepseek-chat', ctx.messages, ctx.temperature, ctx.max_tokens, ctx.jsonMode, ctx.extraBody),
      Math.min(4000, ctx.remaining())
    );
    if (res.ok) {
    const data = await res.json();
    const text = firstText(data);
    if (accepted(ctx, text)) return { text, provider: 'deepseek', model: 'deepseek-chat', usage: firstUsage(data) };
      ctx.fail('deepseek:leer');
    } else {
      ctx.fail(`deepseek:${res.status}`);
    }
  } catch (e) {
    ctx.fail(`deepseek:${ERROR_TAG(e)}`);
  }
  return null;
}

const STAGES = {
  groq: stageGroq,
  openrouter: stageOpenRouter,
  mistral: stageMistral,
  openai: stageOpenAI,
  deepseek: stageDeepSeek,
};

export const DEFAULT_PROVIDERS = ['groq', 'openrouter', 'mistral', 'openai'];

/**
 * Fuehrt die Kette aus. Wirft mit aggregiertem Fehler-Protokoll, wenn alle
 * Provider ausgelastet/unerreichbar waren. Liefert { text, provider, model }.
 *
 * @param messages  OpenAI-konformes Array [{role, content}] (content darf
 *                  fuer Vision auch ein Array sein)
 * @param opts.profile      'free' | 'json' | 'coach' | 'vision'
 * @param opts.models       Groq-Modell-Liste (ersetzt profile)
 * @param opts.jsonMode     response_format: json_object (Groq mit 400-Retry)
 * @param opts.totalBudgetMs Deadline fuer die GESAMTE Kette
 * @param opts.providers    Stufen in gewuenschter Reihenfolge
 * @param opts.xTitle       OpenRouter X-Title-Header
 */
export async function callLLM(messages, {
  profile = 'free',
  models = null,
  temperature = 0.7,
  max_tokens = 4096,
  jsonMode = false,
  totalBudgetMs = 20000,
  providers = DEFAULT_PROVIDERS,
  xTitle = 'NeXus',
  acceptText = null,
  extraBody = {},
  skipModels = [],
} = {}) {
  const deadline = Date.now() + totalBudgetMs;
  const errors = [];
  const ctx = {
    messages,
    temperature,
    max_tokens,
    jsonMode,
    xTitle,
    extraBody,
    groqModels: models || PROFILES[profile] || GROQ_FREE_FIRST,
    acceptText,
    skipModels: new Set(skipModels),
    remaining: () => deadline - Date.now(),
    fail: (tag) => errors.push(tag),
  };

  for (const name of providers) {
    const stage = STAGES[name];
    if (!stage) { ctx.fail(`${name}:unbekannt`); continue; }
    const out = await stage(ctx);
    if (out) return out;
  }

  throw new Error(`Alle KI-Provider sind derzeit ausgelastet oder nicht erreichbar. (${errors.slice(0, 10).join(', ')})`);
}
