import {
  GrokAnalyzedArticle,
  GrokBatchAnalysisResult,
  GrokHeadlineRequest,
  GrokHeadlineResponse,
  ParsedHeadline,
  RawArticle
} from '../types/news-analysis.js'
import { buildHeadlineParsePrompt } from '../prompts/grok-prompts.js'
import { parseHeadline } from './headline-parser.js'
import { detectHotPrint } from './hot-print-detector.js'
import { scoreNews } from './iv-scoring-engine.js'

const chunk = <T>(items: T[], size: number): T[][] => {
  const result: T[][] = []
  for (let i = 0; i < items.length; i += size) {
    result.push(items.slice(i, i + size))
  }
  return result
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

interface GrokServiceConfig {
  apiKey?: string
  baseUrl?: string
  model?: string
  timeoutMs?: number
  maxBatchSize?: number
  maxRetries?: number
}

const defaultConfig: Required<Omit<GrokServiceConfig, 'apiKey'>> = {
  baseUrl: 'https://api.x.ai/v1', // per docs/TECHNOLOGY-GAP-ANALYSIS.md
  model: 'grok-beta',
  timeoutMs: 20_000,
  maxBatchSize: 10,
  maxRetries: 2
}

const isRetryableStatus = (status: number) => status === 429 || status >= 500

const parseJsonSafe = <T>(input: string): T | null => {
  try {
    return JSON.parse(input) as T
  } catch {
    return null
  }
}

interface DeterministicAnalysis {
  article: RawArticle
  parsed: ParsedHeadline
  confident: boolean
  hotPrint?: ReturnType<typeof detectHotPrint>
}

export class GrokService {
  private config: Required<GrokServiceConfig>
  private apiKey: string

  constructor(config?: GrokServiceConfig) {
    this.apiKey = config?.apiKey ?? process.env.GROK_API_KEY ?? ''
    if (!this.apiKey) {
      throw new Error('GROK_API_KEY is not set')
    }
    this.config = {
      apiKey: this.apiKey,
      baseUrl: config?.baseUrl ?? defaultConfig.baseUrl,
      model: config?.model ?? defaultConfig.model,
      timeoutMs: config?.timeoutMs ?? defaultConfig.timeoutMs,
      maxBatchSize: config?.maxBatchSize ?? defaultConfig.maxBatchSize,
      maxRetries: config?.maxRetries ?? defaultConfig.maxRetries
    }
  }

  private async callGrok(prompt: string): Promise<string> {
    const { baseUrl, model, timeoutMs, maxRetries } = this.config
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)

    try {
      for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
        const response = await fetch(`${baseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model,
            temperature: 0.1,
            messages: [
              { role: 'system', content: 'You are a deterministic financial news parser.' },
              { role: 'user', content: prompt }
            ]
          }),
          signal: controller.signal
        })

        if (!response.ok) {
          if (isRetryableStatus(response.status) && attempt < maxRetries) {
            await sleep(500 * (attempt + 1))
            continue
          }
          const errorBody = await response.text().catch(() => '')
          throw new Error(`Grok API error ${response.status}: ${errorBody}`)
        }

        const json = (await response.json()) as {
          choices?: Array<{ message?: { content?: string } }>
        }
        const content = json.choices?.[0]?.message?.content
        if (!content) throw new Error('Grok API returned empty content')
        return content
      }
      throw new Error('Exceeded maximum Grok retries')
    } finally {
      clearTimeout(timer)
    }
  }

  private createDeterministicAnalysis(articles: RawArticle[]): DeterministicAnalysis[] {
    return articles.map((article) => {
      const { parsed, isConfident } = parseHeadline(article.headline ?? article.text ?? '', {
        source: article.source
      })
      let hotPrint = null
      if (parsed.numbers?.actual !== undefined && parsed.numbers.forecast !== undefined && parsed.eventType) {
        hotPrint = detectHotPrint({
          type: parsed.eventType,
          actual: parsed.numbers.actual,
          forecast: parsed.numbers.forecast,
          previous: parsed.numbers.previous,
          unit: parsed.numbers.unit
        })
      }
      return {
        article,
        parsed,
        confident: isConfident,
        hotPrint: hotPrint ?? undefined
      }
    })
  }

  private async analyzeWithGrok(requests: GrokHeadlineRequest[]): Promise<GrokHeadlineResponse[]> {
    if (requests.length === 0) return []
    const batches = chunk(requests, this.config.maxBatchSize)
    const responses: GrokHeadlineResponse[] = []
    for (const batch of batches) {
      const prompt = buildHeadlineParsePrompt(batch)
      const content = await this.callGrok(prompt)
      const parsed = parseJsonSafe<GrokHeadlineResponse[]>(content)
      if (!parsed) {
        throw new Error('Failed to parse Grok JSON response')
      }
      responses.push(...parsed)
    }
    return responses
  }

  async analyzeNewsBatch(articles: RawArticle[]): Promise<GrokBatchAnalysisResult> {
    const deterministic = this.createDeterministicAnalysis(articles)
    const uncertain = deterministic.filter((d) => !d.confident)

    let grokResponses: Record<string, { parsed: ParsedHeadline; hotPrint?: ReturnType<typeof detectHotPrint> }> = {}
    if (uncertain.length > 0) {
      const grokRequests: GrokHeadlineRequest[] = uncertain.map((d) => ({
        id: d.article.id,
        headline: d.article.headline ?? d.article.text ?? '',
        body: d.article.text,
        source: d.article.source
      }))
      const parsedResponses = await this.analyzeWithGrok(grokRequests)
      grokResponses = parsedResponses.reduce<Record<string, { parsed: ParsedHeadline; hotPrint?: ReturnType<typeof detectHotPrint> }>>(
        (acc, item) => {
          acc[item.id] = {
            parsed: item.parsed,
            hotPrint: item.hotPrint ?? undefined
          }
          return acc
        },
        {}
      )
    }

    const items: GrokAnalyzedArticle[] = deterministic.map((det) => {
      const fallback = grokResponses[det.article.id]
      const parsed = fallback?.parsed ?? det.parsed
      const hotPrint = fallback?.hotPrint ?? det.hotPrint
      const ivScore = scoreNews(parsed, hotPrint ?? undefined)

      return {
        raw: det.article,
        parsed,
        hotPrint: hotPrint ?? null,
        ivScore,
        errors: fallback ? undefined : det.confident ? undefined : ['Grok response missing'],
        latencyMs: undefined
      }
    })

    const failedItemIds = deterministic
      .filter((det) => !det.confident && !grokResponses[det.article.id])
      .map((det) => det.article.id)

    return {
      items,
      failedItemIds
    }
  }

  async parseFinancialHeadline(headline: string, source: RawArticle['source']): Promise<ParsedHeadline> {
    const { parsed, isConfident } = parseHeadline(headline, { source })
    if (isConfident) return parsed
    const response = await this.analyzeWithGrok([{ id: 'single', headline, source }])
    const parsedResponse = response[0]?.parsed
    if (!parsedResponse) {
      return parsed
    }
    return parsedResponse
  }

  async detectHotPrint(text: string) {
    // Try deterministic parse first
    const { parsed } = parseHeadline(text, { source: 'Custom' })
    if (parsed.numbers?.actual !== undefined && parsed.numbers?.forecast !== undefined && parsed.eventType) {
      const hot = detectHotPrint({
        type: parsed.eventType,
        actual: parsed.numbers.actual,
        forecast: parsed.numbers.forecast,
        previous: parsed.numbers.previous,
        unit: parsed.numbers.unit
      })
      if (hot) return hot
    }
    const response = await this.analyzeWithGrok([{ id: 'hotprint', headline: text, source: 'Custom' }])
    return response[0]?.hotPrint ?? null
  }
}

