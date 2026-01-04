import { Hono } from 'hono'
import type { Context } from 'hono'
import type { ContentfulStatusCode } from 'hono/utils/http-status'
import { authMiddleware } from '../middleware/auth'
import { createChatService } from '../services/chat-service'
import { createNtnReportService } from '../services/ntn-report-service'

const isDev = process.env.NODE_ENV !== 'production'

interface AuthPayload {
  sub?: string
  user_id?: string
  userId?: string
}

const getUserId = (c: Context): string | null => {
  const payload = c.get('auth') as AuthPayload | undefined
  return payload?.sub ?? payload?.user_id ?? payload?.userId ?? null
}

const parseNumber = (value: string | null | undefined, fallback: number) => {
  if (!value) return fallback
  const parsed = Number.parseInt(value, 10)
  return Number.isNaN(parsed) ? fallback : parsed
}

const isContentfulStatus = (value: number): value is ContentfulStatusCode => {
  return value >= 100 && value <= 599 && value !== 101 && value !== 204 && value !== 205 && value !== 304
}

const resolveErrorStatus = (error: unknown): ContentfulStatusCode => {
  if (!error || typeof error !== 'object') return 500
  const status = (error as { status?: number }).status ?? (error as { statusCode?: number }).statusCode
  if (typeof status === 'number' && isContentfulStatus(status)) return status
  const message = 'message' in error ? String((error as { message?: string }).message) : ''
  if (message.toLowerCase().includes('rate limit')) return 429
  if (message.toLowerCase().includes('invalid chat request')) return 400
  return 500
}

const buildRequestId = () => {
  try {
    return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`
  } catch {
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`
  }
}

export const createAiChatRoutes = () => {
  const router = new Hono()
  const chatService = createChatService()
  const ntnReportService = createNtnReportService()

  router.post('/chat', authMiddleware, async (c) => {
    const requestId = c.req.header('x-request-id') ?? buildRequestId()
    const userId = getUserId(c)
    if (!userId) {
      return c.json({ error: 'Unauthorized' }, 401)
    }

    let body: unknown
    try {
      body = await c.req.json()
    } catch (error) {
      console.warn('[ai-chat] invalid json payload', { requestId, userId })
      return c.json({ error: 'Invalid JSON payload', requestId }, 400)
    }

    try {
      const result = await chatService.handleChat(userId, body, c.req.header('accept'))
      if (result.type === 'stream') {
        return result.response
      }
      return c.json(result.body, 200, {
        'X-Conversation-Id': result.body.conversationId,
        'X-Request-Id': requestId
      })
    } catch (error) {
      const status = resolveErrorStatus(error)
      const message = error instanceof Error ? error.message : 'Chat request failed'
      console.error('[ai-chat] request failed', {
        requestId,
        userId,
        status,
        message,
        name: error instanceof Error ? error.name : 'UnknownError',
        stack: isDev && error instanceof Error ? error.stack : undefined
      })
      return c.json(
        {
          error: message,
          requestId,
          ...(isDev && error instanceof Error ? { stack: error.stack } : {})
        },
        status,
        { 'X-Request-Id': requestId }
      )
    }
  })

  router.get('/conversations', authMiddleware, async (c) => {
    const userId = getUserId(c)
    if (!userId) {
      return c.json({ error: 'Unauthorized' }, 401)
    }
    const limit = parseNumber(c.req.query('limit'), 50)
    const offset = parseNumber(c.req.query('offset'), 0)
    const conversations = await chatService.listConversations(userId, { limit, offset })
    return c.json({ conversations })
  })

  router.get('/conversations/:id', authMiddleware, async (c) => {
    const userId = getUserId(c)
    if (!userId) {
      return c.json({ error: 'Unauthorized' }, 401)
    }
    const conversationId = c.req.param('id')
    const result = await chatService.getConversation(userId, conversationId)
    if (!result) {
      return c.json({ error: 'Conversation not found' }, 404)
    }
    return c.json(result)
  })

  router.post('/ntn-report', authMiddleware, async (c) => {
    const requestId = c.req.header('x-request-id') ?? buildRequestId()
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

    const reportType = typeof body.reportType === 'string' ? body.reportType : undefined
    const forceRefresh = Boolean(body.forceRefresh)

    try {
      const result = await ntnReportService.generateReport(userId, {
        reportType,
        forceRefresh
      })
      return c.json(result, 200, {
        'X-Request-Id': requestId
      })
    } catch (error) {
      const status = resolveErrorStatus(error)
      const message =
        error instanceof Error ? error.message : 'Failed to generate NTN report'
      console.error('[ntn-report] generation failed', {
        requestId,
        userId,
        status,
        message,
        name: error instanceof Error ? error.name : 'UnknownError',
        stack: isDev && error instanceof Error ? error.stack : undefined
      })
      return c.json(
        {
          error: message,
          requestId
        },
        status,
        { 'X-Request-Id': requestId }
      )
    }
  })

  return router
}

export default createAiChatRoutes
