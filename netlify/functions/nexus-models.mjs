// ============================================================================
// NeXus Shared AI Models Configuration
// Central single source of truth for all Netlify Functions
// ============================================================================

// 1. FREE-TIER Priority: For standard conversations, chat, coach, text polish, short classification
// Always tries $0/1M token models first before falling back to paid tiers
export const GROQ_FREE_FIRST = [
  'qwen/qwen3.8-27b',
  'allam-2-7b',
  'openai/gpt-oss-120b',
  'openai/gpt-oss-20b'
];

// 2. STRUCTURED JSON HEAVY: For complex multi-field JSON schema extraction & strategy generation
// allam-2-7b rejects json_object response_format (HTTP 400), excluded from JSON heavy profile
export const GROQ_JSON_HEAVY = [
  'qwen/qwen3.8-27b',
  'openai/gpt-oss-120b',
  'openai/gpt-oss-20b'
];

// 3. Multimodal & Vision Models
export const GROQ_VISION_MODELS = [
  'qwen/qwen3.8-27b'
];

// 4. COACH: Long system prompt requires stronger model first
export const GROQ_COACH = [
  'qwen/qwen3.8-27b',
  'openai/gpt-oss-120b',
  'allam-2-7b',
  'openai/gpt-oss-20b'
];

// 5. OpenRouter Free Tier Fallback Models (Aktualisiert auf aktive Modelle)
export const OPENROUTER_FREE_MODELS = [
  'nvidia/nemotron-3.5-lightning:free',
  'nvidia/nemotron-3-ultra-550b-a55b:free',
  'nvidia/nemotron-3.5-super-vl:free',
  'liquid/lfm-2.5-2.6b:free'
];

// 5. Mistral Default Model
export const MISTRAL_DEFAULT_MODEL = 'mistral-small-latest';

// 6. OpenAI Default Model
export const OPENAI_DEFAULT_MODEL = 'gpt-4o-mini';
