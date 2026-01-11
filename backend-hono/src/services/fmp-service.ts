import { defaultFmpConfig, fmpEndpoints } from '../config/fmp-config.js'
import { createRateLimiter } from './rate-limiter.js'

type Env = Record<string, string | undefined>

const hasGlobalFetch = typeof fetch !== 'undefined'

const getEnv = (key: string): string | undefined => {
  const env = (globalThis as { process?: { env?: Env } }).process?.env
  return env?.[key]
}

export interface FmpEconomicEvent {
  event: string
  country?: string
  impact?: string
  actual?: number | null
  previous?: number | null
  estimate?: number | null
  unit?: string
  date?: string
  time?: string
}

export interface NormalizedEconomicEvent {
  id: string
  name: string
  country?: string
  impact?: string
  actual?: number | null
  forecast?: number | null
  previous?: number | null
  releaseTime: string
  deviation?: number
  isHot: boolean
  eventType?: string
}

export interface LatestPrintsResult {
  events: NormalizedEconomicEvent[]
  fetchedAt: string
}

const toIso = (input: Date) => input.toISOString()

const ensureFetch = () => {
  if (!hasGlobalFetch) {
    throw new Error('Global fetch is not available in this environment')
  }
}

const buildUrl = (base: string, path: string, apiKey?: string) => {
  const separator = path.includes('?') ? '&' : '?'
  const keyPart = apiKey ? `${separator}apikey=${apiKey}` : ''
  return `${base}${path}${keyPart}`
}

const detectEventType = (name: string) => {
  const upper = name.toUpperCase()
  if (upper.includes('CPI')) return 'CPI'
  if (upper.includes('PPI')) return 'PPI'
  if (upper.includes('GDP')) return 'GDP'
  if (upper.includes('PAYROLL') || upper.includes('NFP')) return 'NFP'
  if (upper.includes('FED') || upper.includes('FOMC')) return 'FOMC'
  return undefined
}

const computeDeviation = (actual?: number | null, forecast?: number | null) => {
  if (actual === undefined || forecast === undefined || actual === null || forecast === null) {
    return undefined
  }
  if (forecast === 0) return undefined
  return Math.abs(actual - forecast) / Math.abs(forecast)
}

const isHotPrint = (
  event: NormalizedEconomicEvent,
  thresholds = defaultFmpConfig.thresholds
): boolean => {
  const deviation = event.deviation ?? computeDeviation(event.actual ?? undefined, event.forecast ?? undefined)

  if (event.eventType === 'CPI' || event.eventType === 'PPI') {
    const delta = Math.abs((event.actual ?? 0) - (event.forecast ?? 0))
    return delta >= thresholds.cpiPpiDeviation
  }

  if (event.eventType === 'GDP') {
    const delta = Math.abs((event.actual ?? 0) - (event.forecast ?? 0))
    return delta >= thresholds.gdpDeviation
  }

  if (event.eventType === 'NFP') {
    const delta = Math.abs((event.actual ?? 0) - (event.forecast ?? 0))
    return delta >= thresholds.nfpAbsolute
  }

  if (event.eventType === 'FOMC') {
    const delta = Math.abs((event.actual ?? 0) - (event.forecast ?? 0))
    return delta >= thresholds.rateDecisionDelta
  }

  if (deviation === undefined) return false
  return deviation >= thresholds.defaultDeviation
}

export const createFmpService = () => {
  const config = {
    ...defaultFmpConfig,
    apiKey: getEnv('FMP_API_KEY') ?? defaultFmpConfig.apiKey
  }

  const limiter = createRateLimiter({
    defaultRule: { limit: 120, windowMs: 60_000 },
    baseBackoffMs: 500,
    maxBackoffMs: 20_000,
    jitterMs: 200,
    maxRetries: 4
  })

  const fetchJson = async <T>(url: string): Promise<T> => {
    ensureFetch()
    const response = await limiter.schedule(() => fetch(url))
    if (!response.ok) {
      const body = await response.text().catch(() => '')
      const error = new Error(`FMP error: ${response.status}`)
      ;(error as { status?: number; body?: string }).status = response.status
      ;(error as { body?: string }).body = body
      throw error
    }
    return response.json() as Promise<T>
  }

  const normalize = (raw: FmpEconomicEvent): NormalizedEconomicEvent => {
    const name = raw.event
    const releaseTime = raw.date
      ? `${raw.date}${raw.time ? `T${raw.time}Z` : 'T00:00:00Z'}`
      : toIso(new Date())
    const eventType = detectEventType(name)
    const forecast = raw.estimate ?? raw.previous ?? null
    const deviation = computeDeviation(raw.actual ?? undefined, forecast ?? undefined)

    const normalized: NormalizedEconomicEvent = {
      id: `${name}-${releaseTime}`,
      name,
      country: raw.country,
      impact: raw.impact,
      actual: raw.actual ?? null,
      forecast,
      previous: raw.previous ?? null,
      releaseTime,
      deviation,
      eventType,
      isHot: false
    }

    normalized.isHot = isHotPrint(normalized)
    return normalized
  }

  const getEconomicCalendar = async (date: string): Promise<NormalizedEconomicEvent[]> => {
    const url = buildUrl(config.baseUrl, fmpEndpoints.economicCalendar({ from: date, to: date }), config.apiKey)
    const data = await fetchJson<FmpEconomicEvent[]>(url)
    return data.map(normalize)
  }

  const getLatestPrints = async (): Promise<LatestPrintsResult> => {
    const now = new Date()
    const from = new Date(now.getTime() - config.windowMinutes * 60_000)
    const fromStr = toIso(from).slice(0, 10)
    const toStr = toIso(now).slice(0, 10)

    const url = buildUrl(config.baseUrl, fmpEndpoints.economicCalendar({ from: fromStr, to: toStr }), config.apiKey)
    const data = await fetchJson<FmpEconomicEvent[]>(url)
    const normalized = data.map(normalize)
    return {
      events: normalized,
      fetchedAt: toIso(now)
    }
  }

  const detectHotPrint = (event: NormalizedEconomicEvent) => isHotPrint(event)

  return {
    getEconomicCalendar,
    getLatestPrints,
    detectHotPrint
  }
}

