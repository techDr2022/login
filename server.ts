import { loadEnvConfig } from '@next/env'
import { createServer } from 'http'
import { parse } from 'url'
import next from 'next'

// Socket (and Prisma) load after env files. Next's bundler must not import @next/env.
loadEnvConfig(process.cwd(), process.env.NODE_ENV !== 'production')

const dev = process.env.NODE_ENV !== 'production'
const hostname = process.env.HOSTNAME || 'localhost'
const port = parseInt(process.env.PORT || '3000', 10)

const app = next({ dev, hostname, port })
const handle = app.getRequestHandler()

app.prepare().then(async () => {
  const httpServer = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url!, true)
      await handle(req, res, parsedUrl)
    } catch (err) {
      console.error('Error occurred handling', req.url, err)
      res.statusCode = 500
      res.end('internal server error')
    }
  })

  const { initializeSocketIO } = await import('./lib/socket/server')
  initializeSocketIO(httpServer)

  httpServer
    .once('error', (err) => {
      console.error(err)
      process.exit(1)
    })
    .listen(port, () => {
      console.log(`> Ready on http://${hostname}:${port}`)
    })
})

