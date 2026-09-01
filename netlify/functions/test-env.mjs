export async function handler(event, context) {
  return {
    statusCode: 200,
    body: JSON.stringify({
      hasServiceKey: !!process.env.SUPABASE_SERVICE_KEY,
      keyLength: process.env.SUPABASE_SERVICE_KEY ? process.env.SUPABASE_SERVICE_KEY.length : 0,
      value: process.env.SUPABASE_SERVICE_KEY
    })
  };
}
