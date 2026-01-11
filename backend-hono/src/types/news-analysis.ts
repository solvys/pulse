export type NewsSource =
  | 'FinancialJuice'
  | 'InsiderWire'
  | 'EconomicCalendar'
  | 'TrendSpider'
  | 'Barchart'
  | 'Grok'
  | 'Custom'

export type UrgencyLevel = 'immediate' | 'high' | 'normal'

export type MarketDirection = 'up' | 'down' | 'mixed'

export type HotPrintImpact = 'low' | 'medium' | 'high'

export interface RawArticle {
  id: string
  source: NewsSource
  headline: string
  text?: string
  publishedAt?: string
  symbols?: string[]
  metadata?: Record<string, unknown>
}

export interface ParsedHeadlineNumbers {
  actualText?: string
  forecastText?: string
  previousText?: string
  actual?: number
  forecast?: number
  previous?: number
  unit?: string
}

export interface ParsedHeadline {
  raw: string
  source: NewsSource
  entity?: string
  action?: string
  target?: string
  magnitude?: number
  unit?: string
  symbols: string[]
  isBreaking: boolean
  urgency: UrgencyLevel
  direction?: MarketDirection
  eventType?: string
  tags: string[]
  marketReaction?: {
    direction: MarketDirection
    intensity: 'mild' | 'moderate' | 'severe'
  }
  numbers?: ParsedHeadlineNumbers
  confidence: number // 0-1 scale indicating deterministic parse confidence
}

export interface EconomicPrint {
  id: string
  type: string
  actual: number
  forecast: number
  previous?: number
  unit?: string
  releaseTime: string
  source?: NewsSource
}

export interface HotPrint {
  type: string
  actual: number
  forecast: number
  previous?: number
  deviation: number
  direction: 'above' | 'below'
  impact: HotPrintImpact
  tradingImplication: string
  releaseTime?: string
}

export interface IVScoreResult {
  eventType: string
  score: number // 0-10
  rationale: string[]
  impliedESPoints: number
  impliedNQPoints: number
  timestamp: string
}

export interface GrokHeadlineRequest {
  id: string
  headline: string
  body?: string
  source: NewsSource
}

export interface GrokHeadlineResponse {
  id: string
  parsed: ParsedHeadline
  hotPrint?: HotPrint | null
  ivScore?: IVScoreResult | null
}

export interface GrokAnalyzedArticle {
  raw: RawArticle
  parsed: ParsedHeadline
  hotPrint?: HotPrint | null
  ivScore?: IVScoreResult | null
  errors?: string[]
  latencyMs?: number
}

export interface GrokBatchAnalysisResult {
  items: GrokAnalyzedArticle[]
  failedItemIds: string[]
}


