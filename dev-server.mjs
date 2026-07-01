import { createServer } from 'http'
import { readFileSync } from 'fs'
const handler = (await import('./netlify/functions/chat.js')).handler
const server = createServer(async (req, res) => {
  if (req.method === 'POST' && req.url === '/api/chat') {
    let body = ''
    for await (const chunk of req) body += chunk
    const event = { httpMethod: 'POST', body }
    const result = await handler(event)
    res.writeHead(result.statusCode, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' })
    res.end(result.body)
  } else {
    res.writeHead(404)
    res.end()
  }
})
server.listen(3001, () => console.log('API: http://localhost:3001'))
