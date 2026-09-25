// ============================================================================
// NeXus Shared AI Models Configuration
// Central single source of truth for all Netlify Functions
// ============================================================================

// 1. FREE-TIER Priority: For standard conversations, chat, coach, text polish, short classification
// Always tries $0/1M token models first before falling back to paid tiers
export const GROQ_FREE_FIRST = [
  'allam-2-7b',
  'openai/gpt-oss-20b',
  'openai/gpt-oss-120b',
  'qwen/qwen3.8-27b'
];

// 2. STRUCTURED JSON HEAVY: For complex multi-field JSON schema extraction & strategy generation
// allam-2-7b struggles with large json_object schemas, so gpt-oss-20b is preferred for JSON reliability
export const GROQ_JSON_HEAVY = [
  'openai/gpt-oss-20b',
  'openai/gpt-oss-120b',
  'qwen/qwen3.8-27b',
  'allam-2-7b'
];

// 3. Multimodal & Vision Models
export const GROQ_VISION_MODELS = [
  'qwen/qwen3.8-27b'
];

// 4. OpenRouter Free Tier Fallback Models
export const OPENROUTER_FREE_MODELS = [
  'nex-agi/nex-n2.5-mini:free',
  'nvidia/nemotron-3.5-lightning:free',
  'google/gemma-4-26b-a4b-it:free'
];

// 5. Mistral Default Model
export const MISTRAL_DEFAULT_MODEL = 'mistral-small-latest';

// 6. OpenAI Default Model
export const OPENAI_DEFAULT_MODEL = 'gpt-4o-mini';
