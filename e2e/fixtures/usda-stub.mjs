// A stand-in for FoodData Central, so the e2e suite never touches the real
// service or its hourly rate limit. It knows no foods: every search comes back
// empty, which leaves the ingredient unmatched for the cook to fill in by hand.
// A query containing "offline" answers 503, which the app treats as the
// service being down.
import { createServer } from 'node:http'

const port = Number(process.env.PORT ?? 3101)

createServer((request, response) => {
  let body = ''
  request.on('data', (chunk) => (body += chunk))
  request.on('end', () => {
    const url = new URL(request.url ?? '/', `http://127.0.0.1:${port}`)
    if (request.method === 'GET' && url.pathname === '/') {
      response.writeHead(200).end('ok')
      return
    }
    let query = ''
    try {
      query = String(JSON.parse(body || '{}').query ?? '')
    } catch {
      // A malformed body is just a search for nothing.
    }
    if (query.toLowerCase().includes('offline')) {
      response.writeHead(503).end()
      return
    }
    response.writeHead(200, { 'content-type': 'application/json' })
    response.end(url.pathname === '/v1/foods/search' ? JSON.stringify({ foods: [] }) : '[]')
  })
}).listen(port, '127.0.0.1')
