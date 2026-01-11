import { pingDb } from '../db/optimized.js'
import { defaultAiConfig } from '../config/ai-config.js'
import { clerkHealth } from './clerk-auth.js'

type ComponentStatus = 'ok' | 'degraded' | 'error'

export interface HealthStatus {
  status: ComponentStatus
  timestamp: string
  components: Record<
    'database' | 'aiGateway' | 'clerk',
    {
      status: ComponentStatus
      details?: Record<string, unknown>
    }
  >
}

const fetchWithTimeout = async (url: string, options: RequestInit, timeoutMs: number) => {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    })
    return response
  } finally {
    clearTimeout(timeout)
  }
}

const checkDatabase = async () => {
  try {
    await pingDb()
    return { status: 'ok' as ComponentStatus }
  } catch (error) {
    return {
      status: 'error' as ComponentStatus,
      details: {
        message: error instanceof Error ? error.message : String(error)
      }
    }
  }
}

const checkAiGateway = async () => {
  const baseUrl =
    defaultAiConfig.models.grok.baseUrl ??
    process.env.VERCEL_AI_GATEWAY_BASE_URL ??
    'https://ai-gateway.vercel.sh/v1/chat/completions'
  const apiKey = process.env.VERCEL_AI_GATEWAY_API_KEY

  if (!apiKey) {
    return {
      status: 'error' as ComponentStatus,
      details: { error: 'Missing VERCEL_AI_GATEWAY_API_KEY' }
    }
  }

  try {
    const response = await fetchWithTimeout(
      baseUrl,
      {
        method: 'HEAD',
        headers: {
          Authorization: `Bearer ${apiKey}`
        }
      },
      4000
    )

    const statusCode = response.status
    const isHealthy = statusCode >= 200 && statusCode < 400

    return {
      status: isHealthy ? ('ok' as ComponentStatus) : ('degraded' as ComponentStatus),
      details: {
        statusCode
      }
    }
  } catch (error) {
    return {
      status: 'error' as ComponentStatus,
      details: {
        message: error instanceof Error ? error.message : String(error)
      }
    }
  }
}

const checkClerk = () => {
  const details = clerkHealth()
  return {
    status: details.hasSecret ? ('ok' as ComponentStatus) : ('error' as ComponentStatus),
    details
  }
}

export const createHealthService = () => {
  const checkAll = async (): Promise<HealthStatus> => {
    const [database, aiGateway, clerk] = await Promise.all([
      checkDatabase(),
      checkAiGateway(),
      checkClerk()
    ])

    const components = { database, aiGateway, clerk }
    const hasError = Object.values(components).some((component) => component.status === 'error')
    const hasDegraded = Object.values(components).some((component) => component.status === 'degraded')

    const status: ComponentStatus = hasError ? 'error' : hasDegraded ? 'degraded' : 'ok'

    return {
      status,
      timestamp: new Date().toISOString(),
      components
    }
  }

  return { checkAll }
}
