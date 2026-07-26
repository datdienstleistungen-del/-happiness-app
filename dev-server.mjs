import { createServer } from 'http'
import { existsSync } from 'fs'
import { join } from 'path'

// Cache loaded handlers
const handlers = {}

async function getHandler(name) {
  if (handlers[name]) return handlers[name]
  
  // Try importing .mjs first, then .cjs, then .js
  const paths = [
    `./netlify/functions/${name}.mjs`,
    `./netlify/functions/${name}.cjs`,
    `./netlify/functions/${name}.js`
  ]
  
  for (const p of paths) {
    if (existsSync(p)) {
      const mod = await import(p)
      handlers[name] = mod.handler
      return mod.handler
    }
  }
  return null
}

const server = createServer(async (req, res) => {
  // Support CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(200, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
    })
    res.end()
    return
  }

  // Parse path and search params
  const urlObj = new URL(req.url, `http://${req.headers.host || 'localhost'}`)
  const match = urlObj.pathname.match(/^\/api\/([a-zA-Z0-9_-]+)$/)
  
  if (match) {
    const functionName = match[1]
    try {
      const handler = await getHandler(functionName)
      if (handler) {
        let body = ''
        for await (const chunk of req) body += chunk
        
        // Build lambda event object
        const event = {
          httpMethod: req.method,
          body,
          headers: req.headers,
          queryStringParameters: Object.fromEntries(urlObj.searchParams.entries())
        }
        
        const result = await handler(event)
        
        const responseHeaders = {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          ...(result.headers || {})
        }
        
        res.writeHead(result.statusCode || 200, responseHeaders)
        res.end(result.body)
        return
      }
    } catch (err) {
      console.error(`Error executing Netlify function ${functionName}:`, err)
      res.writeHead(500, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' })
      res.end(JSON.stringify({ error: err.message }))
      return
    }
  }
  
  res.writeHead(404, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' })
  res.end(JSON.stringify({ error: 'Function not found' }))
})

const PORT = 3001
server.listen(PORT, () => {
  console.log(`Dev API server running on http://localhost:${PORT}`)
})
