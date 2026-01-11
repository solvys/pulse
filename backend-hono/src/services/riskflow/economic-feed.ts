/**
 * Economic Feed Service
 * Pulls latest economic prints from FMP and emits as feed items for RiskFlow
 * Used as a fallback when X headlines are late/missing for economic releases.
 */

import { createFmpService } from '../fmp-service.js'
import { calculateIVScore } from '../analysis/iv-scorer.js'
import type { FeedItem, NewsSource, SentimentDirection } from '../../types/riskflow.js'
import type { HotPrint, ParsedHeadline } from '../../types/news-analysis.js'

const fmp = createFmpService()
const ECON_SOURCE: NewsSource = 'EconomicCalendar'

/**
 * Convert economic event to a feed item
 */
type NormalizedEvent = {
  id: string
  name: string
  eventType?: string
  actual: number | null
  forecast: number | null
  previous: number | null
  releaseTime: string
  deviation: number
  isHot: boolean
}

function econEventToFeedItem(event: NormalizedEvent): FeedItem {
  const headlineParts = [
    event.name,
    event.actual !== null && event.actual !== undefined ? `Actual: ${event.actual}` : null,
    event.forecast !== null && event.forecast !== undefined ? `Forecast: ${event.forecast}` : null,
    event.previous !== null && event.previous !== undefined ? `Prev: ${event.previous}` : null,
  ].filter(Boolean)

  const headline = headlineParts.join(' | ')
  const tags = [event.eventType ?? 'ECON', 'ECON_DATA']

  const hotPrint: HotPrint | null = event.isHot
    ? {
        type: event.eventType ?? 'economicData',
        actual: event.actual ?? 0,
        forecast: event.forecast ?? 0,
        previous: event.previous ?? undefined,
        deviation: event.deviation ?? 0,
        direction: event.actual !== null && event.forecast !== null && event.actual < event.forecast ? 'below' : 'above',
        impact: 'high',
        tradingImplication: 'High impact economic release',
        releaseTime: event.releaseTime,
      }
    : null

  const parsed: ParsedHeadline = {
    raw: headline,
    source: ECON_SOURCE,
    symbols: [],
    tags,
    isBreaking: true,
    urgency: 'immediate',
    eventType: event.eventType ?? 'economicData',
    numbers: {
      actual: event.actual ?? undefined,
      forecast: event.forecast ?? undefined,
      previous: event.previous ?? undefined,
    },
    confidence: 0.9,
  }

  const iv = calculateIVScore({
    parsed,
    hotPrint,
    timestamp: new Date(event.releaseTime),
  })

  return {
    id: event.id,
    source: ECON_SOURCE,
    headline,
    body: undefined,
    symbols: [],
    tags,
    isBreaking: true,
    urgency: 'immediate',
    sentiment: iv.sentiment as SentimentDirection,
    ivScore: iv.score,
    macroLevel: iv.macroLevel,
    publishedAt: event.releaseTime,
    analyzedAt: new Date().toISOString(),
  }
}

function normalizeEvent(event: Awaited<ReturnType<ReturnType<typeof createFmpService>['getLatestPrints']>>['events'][number]): NormalizedEvent {
  return {
    id: event.id,
    name: event.name,
    eventType: event.eventType,
    actual: event.actual ?? null,
    forecast: event.forecast ?? null,
    previous: event.previous ?? null,
    releaseTime: event.releaseTime,
    deviation: event.deviation ?? 0,
    isHot: event.isHot,
  }
}

/**
 * Fetch latest economic prints (time-windowed) and map to feed items
 */
export async function fetchEconomicFeed(): Promise<FeedItem[]> {
  try {
    const latest = await fmp.getLatestPrints()
    if (!latest?.events?.length) return []

    const normalized = latest.events.map(normalizeEvent)
    return normalized.map(econEventToFeedItem)
  } catch (error) {
    console.error('[EconomicFeed] Failed to fetch economic prints:', error)
    return []
  }
}
