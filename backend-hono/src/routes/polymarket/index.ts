import { Hono } from 'hono'
import { handleGetOdds, handleGetUpdates, handleSync } from './handlers.js'

export function createPolymarketRoutes(): Hono {
  const router = new Hono()

  router.get('/odds', handleGetOdds)
  router.get('/updates', handleGetUpdates)
  router.post('/sync', handleSync)

  return router
}
