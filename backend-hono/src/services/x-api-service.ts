import { createRateLimiter } from './rate-limiter.js'
import { defaultXApiConfig, XApiSource, xApiEndpoints } from '../config/x-api-config.js'

type Env = Record<string, string | undefined>

const hasGlobalFetch = typeof fetch !== 'undefined'

const getEnv = (key: string): string | undefined => {
  const env = (globalThis as { process?: { env?: Env } }).process?.env
  return env?.[key]
}

export interface XApiTweet {
  id: string
  text: string
  created_at: string
  author_id?: string
  entities?: {
    cashtags?: { tag: string }[]
    hashtags?: { tag: string }[]
  }
}

export interface ParsedTweetNews {
  source: XApiSource
  tweetId: string
  headline: string
  body: string
  symbols: string[]
  tags: string[]
  isBreaking: boolean
  publishedAt: string
  raw: XApiTweet
}

interface XApiConfigOverride {
  bearerToken?: string
}

const unique = <T>(items: T[]) => Array.from(new Set(items))

const pickHeadline = (text: string) => {
  const parts = text.split(/[\.\n]/).map((p) => p.trim()).filter(Boolean)
  return parts[0] ?? text.slice(0, 180)
}

const breakingRegex = /\b(BREAKING|URGENT|JUST IN|FLASH|ALERT|NEWS)\b/i
const econKeywords = ['CPI', 'PPI', 'GDP', 'NFP', 'JOBS', 'PAYROLLS', 'ISM', 'PMI']

const extractSymbols = (text: string, entities?: XApiTweet['entities']) => {
  const symbolsFromText =
    text.match(/\$[A-Z]{1,5}\b/g)?.map((s) => s.replace('$', '').toUpperCase()) ?? []
  const symbolsFromEntities =
    entities?.cashtags?.map((c) => c.tag.toUpperCase()) ?? []
  return unique([...symbolsFromText, ...symbolsFromEntities])
}

const extractTags = (text: string, entities?: XApiTweet['entities']) => {
  const keywordTags = econKeywords.filter((k) => text.toUpperCase().includes(k))
  const hashTags = entities?.hashtags?.map((h) => h.tag.toUpperCase()) ?? []
  return unique([...keywordTags, ...hashTags])
}

const withTimeout = async (url: string, init: RequestInit, timeoutMs: number) => {
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : undefined
  const timer =
    controller && timeoutMs > 0 ? setTimeout(() => controller.abort(), timeoutMs) : undefined
  try {
    const response = await fetch(url, {
      ...init,
      signal: controller?.signal
    })
    return response
  } finally {
    if (timer) {
      clearTimeout(timer)
    }
  }
}

export const createXApiService = (override?: XApiConfigOverride) => {
  const config = {
    ...defaultXApiConfig,
    bearerToken: override?.bearerToken ?? getEnv('X_API_BEARER_TOKEN') ?? defaultXApiConfig.bearerToken
  }

  const limiter = createRateLimiter({
    defaultRule: config.rateLimit,
    baseBackoffMs: config.backoff.baseMs,
    maxBackoffMs: config.backoff.maxMs,
    jitterMs: config.backoff.jitterMs,
    maxRetries: config.backoff.maxRetries
  })

  const userIdCache = new Map<string, string>()

  const ensureFetchAvailable = () => {
    if (!hasGlobalFetch) {
      throw new Error('Global fetch is not available in this environment')
    }
  }

  const fetchJson = async <T>(url: string): Promise<T> => {
    ensureFetchAvailable()
    if (!config.bearerToken) {
      throw new Error('X API bearer token is missing')
    }

    const response = await limiter.schedule(() =>
      withTimeout(
        url,
        {
          headers: {
            Authorization: `Bearer ${config.bearerToken}`
          }
        },
        config.requestTimeoutMs
      )
    )

    if (!response.ok) {
      const body = await response.text().catch(() => '')
      const error = new Error(`X API error: ${response.status}`)
      ;(error as { status?: number; body?: string }).status = response.status
      ;(error as { body?: string }).body = body
      throw error
    }

    return response.json() as Promise<T>
  }

  const resolveUserId = async (handle: string): Promise<string> => {
    if (userIdCache.has(handle)) {
      return userIdCache.get(handle) as string
    }
    const url = `${config.baseUrl}${xApiEndpoints.userByUsername(handle)}`
    const data = await fetchJson<{ data?: { id: string } }>(url)
    const id = data.data?.id
    if (!id) {
      throw new Error(`Failed to resolve user id for ${handle}`)
    }
    userIdCache.set(handle, id)
    return id
  }

  const fetchTimeline = async (handle: string): Promise<XApiTweet[]> => {
    const userId = await resolveUserId(handle)
    const url = `${config.baseUrl}${xApiEndpoints.userTimeline(userId)}`
    const data = await fetchJson<{ data?: XApiTweet[] }>(url)
    return data.data ?? []
  }

  const parseNewsFromTweet = (source: XApiSource, tweet: XApiTweet): ParsedTweetNews => {
    const text = tweet.text.trim()
    const symbols = extractSymbols(text, tweet.entities)
    const tags = extractTags(text, tweet.entities)
    const isBreaking = breakingRegex.test(text) || tags.includes('BREAKING')

    return {
      source,
      tweetId: tweet.id,
      headline: pickHeadline(text),
      body: text,
      symbols,
      tags,
      isBreaking,
      publishedAt: tweet.created_at,
      raw: tweet
    }
  }

  const fetchLatestTweets = async (): Promise<ParsedTweetNews[]> => {
    const sources = Object.entries(config.sources) as [XApiSource, { handle: string }][]
    const timelines = await Promise.all(
      sources.map(async ([source, meta]) => {
        const tweets = await fetchTimeline(meta.handle)
        return tweets.map((tweet) => parseNewsFromTweet(source, tweet))
      })
    )
    return timelines.flat()
  }

  return {
    fetchLatestTweets,
    parseNewsFromTweet
  }
}

