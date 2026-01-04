import { Hono } from 'hono'
import type { Context } from 'hono'
import { authMiddleware } from '../middleware/auth'
import { createPsychAssistService } from '../services/psych-assist-service'

const service = createPsychAssistService()

interface AuthPayload {
  sub?: string
  user_id?: string
  userId?: string
}

const getUserId = (c: Context): string | null => {
  const payload = c.get('auth') as AuthPayload | undefined
  return payload?.sub ?? payload?.user_id ?? payload?.userId ?? null
}

export const createPsychAssistRoutes = () => {
  const router = new Hono()

  router.use('*', authMiddleware)

  router.get('/profile', async (c) => {
    const userId = getUserId(c)
    if (!userId) {
      return c.json({ error: 'Unauthorized' }, 401)
    }

    const profile = await service.getProfile(userId)
    return c.json({ profile })
  })

  router.put('/profile', async (c) => {
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

    const blindSpots = Array.isArray(body.blindSpots) ? (body.blindSpots as string[]) : undefined
    const goal = typeof body.goal === 'string' ? body.goal : undefined
    const orientationComplete =
      body.orientationComplete === true || body.source === 'orientation'

    const profile = await service.updateProfile(userId, {
      blindSpots,
      goal,
      orientationComplete
    })

    return c.json({ profile })
  })

  router.post('/scores', async (c) => {
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

    const profile = await service.updateScores(userId, body as Record<string, unknown>)
    return c.json({ profile })
  })

  return router
}

export default createPsychAssistRoutes
