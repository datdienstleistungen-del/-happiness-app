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

// 4. COACH: Long system prompt requires stronger model first
// TESTED 25.09.2026: allam-2-7b fails on 59-line system prompt (returns empty 2-char output)
// qwen/qwen3.8-27b succeeds (1212 chars, all quality checks passed, 1.1s)
// Do NOT reorder to save costs — allam-2-7b cannot handle this prompt complexity
export const GROQ_COACH = [
  'qwen/qwen3.8-27b',
  'openai/gpt-oss-20b',
  'allam-2-7b',
  'openai/gpt-oss-120b'
];

// 4. OpenRouter Free Tier Fallback Models
// 27.09.2026 geprüft: nex-agi/nex-n2.5-mini:free existiert nicht mehr (404),
// die freien Modelle sind über die Models-API aktuell gehalten
export const OPENROUTER_FREE_MODELS = [
  'qwen/qwen3.8-27b:free',
  'google/gemma-4-31b-it:free',
  'nvidia/nemotron-3-super-120b-a12b:free'
];

// 5. Mistral Default Model
export const MISTRAL_DEFAULT_MODEL = 'mistral-small-latest';

// 6. OpenAI Default Model
export const OPENAI_DEFAULT_MODEL = 'gpt-4o-mini';
