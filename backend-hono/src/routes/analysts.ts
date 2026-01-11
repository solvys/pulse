import { Hono } from 'hono'
import type { Context } from 'hono'
import { authMiddleware } from '../middleware/auth.js'
import { createAnalystReportService } from '../services/analyst-report-service.js'

const analystService = createAnalystReportService()

interface AuthPayload {
  sub?: string
  user_id?: string
  userId?: string
}

const getUserId = (c: Context): string | null => {
  const payload = c.get('auth') as AuthPayload | undefined
  return payload?.sub ?? payload?.user_id ?? payload?.userId ?? null
}

export const createAnalystRoutes = () => {
  const router = new Hono()

  router.get('/reports', authMiddleware, async (c) => {
    const userId = getUserId(c)
    if (!userId) {
      return c.json({ error: 'Unauthorized' }, 401)
    }

    const refresh = c.req.query('refresh') === 'true'
    const instrument = c.req.query('instrument') ?? 'MNQ'

    if (refresh) {
      await analystService.generateReports(userId, instrument)
    }

    const reports = await analystService.listLatestReports(userId)
    return c.json({ reports })
  })

  router.post('/reports/run', authMiddleware, async (c) => {
    const userId = getUserId(c)
    if (!userId) {
      return c.json({ error: 'Unauthorized' }, 401)
    }

    let body: Record<string, unknown> = {}
    try {
      body = await c.req.json()
    } catch {
      body = {}
    }

    const instrument = typeof body.instrument === 'string' ? body.instrument : 'MNQ'
    const reports = await analystService.generateReports(userId, instrument)
    return c.json({ reports })
  })

  return router
}

export default createAnalystRoutes
