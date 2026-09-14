export async function handler(event, context) {
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      hasGroq: !!process.env.GROQ_API_KEY || !!process.env.VITE_GROQ_API_KEY,
      hasDeepSeek: !!process.env.DEEPSEEK_API_KEY || !!process.env.VITE_DEEPSEEK_API_KEY,
      hasGemini: !!process.env.GEMINI_API_KEY || !!process.env.GOOGLE_GENERATIVE_AI_API_KEY,
      hasMistral: !!process.env.MISTRAL_API_KEY || !!process.env.VITE_MISTRAL_API_KEY,
      hasOpenRouter: !!process.env.OPENROUTER_API_KEY || !!process.env.VITE_OPENROUTER_API_KEY,
      hasTavily: !!process.env.TAVILY_API_KEY || !!process.env.VITE_TAVILY_API_KEY,
      hasSupabaseService: !!process.env.SUPABASE_SERVICE_KEY
    })
  };
}
