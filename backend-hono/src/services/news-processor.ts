import { ParsedTweetNews } from './x-api-service.js'
import { NormalizedEconomicEvent } from './fmp-service.js'
import { defaultFmpConfig } from '../config/fmp-config.js'

export type StandardizedSource = 'X' | 'FMP'

export interface StandardizedNewsArticle {
  id: string
  source: StandardizedSource
  origin: string
  headline: string
  body: string
  symbols: string[]
  isBreaking: boolean
  macroLevel: 1 | 2 | 3 | 4
  publishedAt: string
  tags: string[]
  raw: unknown
}

type InputPayload = { source: 'X'; data: ParsedTweetNews } | { source: 'FMP'; data: NormalizedEconomicEvent }

const timeBucket = (publishedAt: string, windowMs = 5 * 60 * 1000) => {
  const ts = new Date(publishedAt).getTime()
  return Math.floor(ts / windowMs).toString()
}

const normalizeHeadline = (headline: string) =>
  headline
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[^\w\s$]/g, '')
    .trim()

const macroBumpForSymbols = (symbols: string[]) => {
  const highImpact = ['SPY', 'QQQ', 'SPX', 'ES', 'NQ']
  return symbols.some((sym) => highImpact.includes(sym)) ? 1 : 0
}

const unique = <T>(items: T[]) => Array.from(new Set(items))

const extractSymbolsFromText = (text: string) => {
  const matches = text.match(/\$[A-Z]{1,5}\b/g) ?? []
  return unique(matches.map((m) => m.replace('$', '').toUpperCase()))
}

const baseMacroScore = (
  isBreaking: boolean,
  tags: string[],
  symbols: string[],
  isHot?: boolean,
  eventType?: string
): 1 | 2 | 3 | 4 => {
  if (isBreaking || isHot) return 4
  if (eventType && defaultFmpConfig.importantEvents.some((k) => eventType.toUpperCase().includes(k.toUpperCase()))) {
    return 3
  }
  const bump = macroBumpForSymbols(symbols)
  if (bump > 0) return 3
  if (tags.some((t) => ['CPI', 'PPI', 'GDP', 'NFP', 'FOMC'].includes(t.toUpperCase()))) {
    return 3
  }
  return 2
}

const mergeSymbols = (primary: string[], fallbackText?: string) => {
  if (primary.length > 0) return primary
  if (!fallbackText) return []
  return extractSymbolsFromText(fallbackText)
}

export const createNewsProcessor = () => {
  const recentHashes = new Map<string, number>()
  const dedupeWindowMs = 10 * 60 * 1000

  const registerHash = (hash: string) => {
    recentHashes.set(hash, Date.now())
  }

  const evictOld = () => {
    const now = Date.now()
    for (const [hash, ts] of recentHashes.entries()) {
      if (now - ts > dedupeWindowMs) {
        recentHashes.delete(hash)
      }
    }
  }

  const buildHash = (headline: string, publishedAt: string, symbols: string[]) => {
    const norm = normalizeHeadline(headline)
    const bucket = timeBucket(publishedAt)
    const symKey = symbols.slice(0, 3).sort().join(',')
    return `${norm}|${bucket}|${symKey}`
  }

  const standardizeX = (payload: ParsedTweetNews): StandardizedNewsArticle => {
    const symbols = mergeSymbols(payload.symbols, payload.body)
    const macroLevel = baseMacroScore(payload.isBreaking, payload.tags, symbols)
    return {
      id: `x-${payload.tweetId}`,
      source: 'X',
      origin: payload.source,
      headline: payload.headline,
      body: payload.body,
      symbols,
      isBreaking: payload.isBreaking,
      macroLevel,
      publishedAt: payload.publishedAt,
      tags: payload.tags,
      raw: payload.raw
    }
  }

  const standardizeFmp = (event: NormalizedEconomicEvent): StandardizedNewsArticle => {
    const inferredSymbols = event.eventType ? ['SPY', 'QQQ'] : []
    const macroLevel = baseMacroScore(event.isHot, [], inferredSymbols, event.isHot, event.eventType)
    return {
      id: `fmp-${event.id}`,
      source: 'FMP',
      origin: event.eventType ?? event.name,
      headline: event.name,
      body: `Actual: ${event.actual ?? 'N/A'} | Forecast: ${event.forecast ?? 'N/A'} | Previous: ${
        event.previous ?? 'N/A'
      }`,
      symbols: inferredSymbols,
      isBreaking: event.isHot,
      macroLevel,
      publishedAt: event.releaseTime,
      tags: event.eventType ? [event.eventType] : [],
      raw: event
    }
  }

  const processIncomingData = (input: InputPayload): StandardizedNewsArticle => {
    const article = input.source === 'X' ? standardizeX(input.data) : standardizeFmp(input.data)
    const hash = buildHash(article.headline, article.publishedAt, article.symbols)
    evictOld()
    registerHash(hash)
    return article
  }

  const deduplicate = (articles: StandardizedNewsArticle[]) => {
    evictOld()
    const uniqueArticles: StandardizedNewsArticle[] = []
    for (const article of articles) {
      const hash = buildHash(article.headline, article.publishedAt, article.symbols)
      if (recentHashes.has(hash)) {
        continue
      }
      registerHash(hash)
      uniqueArticles.push(article)
    }
    return uniqueArticles
  }

  return {
    processIncomingData,
    deduplicate
  }
}

