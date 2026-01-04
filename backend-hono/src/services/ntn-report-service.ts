import { query } from '../db/optimized'
import { createAiModelService } from './ai-model-service'
import type { AiModelKey } from '../config/ai-config'
import { createFmpService, type NormalizedEconomicEvent } from './fmp-service'
import { generateMockNewsPage } from '../utils/mock-generator'

export interface NtnReportRecord {
  id: string
  userId: string
  reportDate: string
  reportType: string
  content: string
  metadata: Record<string, unknown> | null
  model: string | null
  generatedAt: string
}

export interface GenerateNtnReportOptions {
  reportType?: string
  forceRefresh?: boolean
}

export interface GenerateNtnReportResult {
  report: {
    content: string
    reportType: string
    generatedAt: string
  }
  metadata: Record<string, unknown> | null
  model: string | null
}

interface MarketHeadline {
  id: string
  title: string
  summary: string
  symbols: string[]
  publishedAt: string
}

interface MarketContext {
  prints: NormalizedEconomicEvent[]
  headlines: MarketHeadline[]
}

const DEFAULT_MODEL: AiModelKey = 'sonnet'
const DEFAULT_REPORT_TYPE = 'daily'
const CACHE_WINDOW_MS = 15 * 60 * 1000 // 15 minutes

const SYSTEM_PROMPT = `You are Price, Priced-In Research's intraday risk analyst.
Build a Need-To-Know note that is surgical, trader-ready, and explicitly action-oriented.
Your tone is clinical and time-sensitive.
Never exceed 240 words. Favor bullet structure over prose.
The sections (in order) must be: MARKET REGIME, FLOW WATCH, HOT RISK, SETUPS & EXECUTION, RISK PLAN.
Tie every takeaway to tradable implications, include levels when possible, and highlight asymmetry.`

const sanitizeReportType = (value?: string): string => {
  if (!value) return DEFAULT_REPORT_TYPE
  const normalized = value.trim().toLowerCase()
  if (!normalized) return DEFAULT_REPORT_TYPE
  return normalized.replace(/[^a-z0-9_-]/g, '') || DEFAULT_REPORT_TYPE
}

const mapRow = (row: Record<string, unknown>): NtnReportRecord => ({
  id: String(row.id),
  userId: String(row.user_id),
  reportDate: String(row.report_date),
  reportType: String(row.report_type),
  content: String(row.content),
  metadata: (row.metadata as Record<string, unknown> | null) ?? null,
  model: row.model ? String(row.model) : null,
  generatedAt: String(row.generated_at)
})

const buildHeadlineSummary = (headline: MarketHeadline) =>
  `• ${headline.title} — ${headline.summary} (${headline.symbols.slice(0, 3).join('/') || 'broad market'})`

const buildPrintSummary = (event: NormalizedEconomicEvent) => {
  const actual = typeof event.actual === 'number' ? event.actual : null
  const forecast = typeof event.forecast === 'number' ? event.forecast : null
  const change =
    actual !== null && forecast !== null ? `Δ ${(actual - forecast).toFixed(2)}` : ''
  return `• ${event.name} | Actual: ${actual ?? 'n/a'} | Forecast: ${forecast ?? 'n/a'} ${change}`
}

const composeUserPrompt = (context: MarketContext, reportType: string) => {
  const headlineBlock =
    context.headlines.length > 0
      ? context.headlines.map(buildHeadlineSummary).join('\n')
      : '• No curated RiskFlow headlines available. Assume positioning is headline-starved.'

  const printsBlock =
    context.prints.length > 0
      ? context.prints.map(buildPrintSummary).join('\n')
      : '• No verified macro prints inside the monitoring window.'

  return [
    `Report Type: ${reportType}`,
    'Economic Prints (latest first):',
    printsBlock,
    'RiskFlow Headlines:',
    headlineBlock,
    'Use the context above plus your macro intuition to generate the NTN.'
  ].join('\n\n')
}

const buildFallbackReport = (context: MarketContext, reportType: string) => {
  const sections: string[] = []
  sections.push(`NTN REPORT (${reportType.toUpperCase()}) — CONTINGENCY OUTPUT`)

  const headline = context.headlines[0]
  if (headline) {
    sections.push(
      `MARKET REGIME: ${headline.title} is today’s anchor. Tape biases toward ${headline.symbols[0] ?? 'index complex'} with traders leaning into the story.`,
    )
  } else {
    sections.push('MARKET REGIME: Limited vetted flow. Treat regime as range-bound until confirmed catalysts fire.')
  }

  const hotPrint = context.prints.find((event) => event.isHot)
  if (hotPrint) {
    sections.push(
      `HOT RISK: ${hotPrint.name} flagged as a hot print. Actual ${hotPrint.actual ?? 'n/a'} vs ${hotPrint.forecast ?? 'n/a'} keeps volatility elevated.`,
    )
  } else {
    sections.push('HOT RISK: No validated hot prints inside the window. Watch for unscheduled tape bombs.')
  }

  sections.push(
    'SETUPS & EXECUTION: Focus on liquid index futures (ES, NQ). Keep risk tight (max 0.5% per idea) until verified flow returns.',
  )
  sections.push(
    'RISK PLAN: Fade emotional trades, respect circuit breakers, and reset if conviction drops below 3/5. This is an automated fallback — rerun once live data stabilizes.',
  )

  return sections.join('\n\n')
}

export const createNtnReportService = (deps: {
  modelService?: ReturnType<typeof createAiModelService>
  fmpService?: ReturnType<typeof createFmpService>
} = {}) => {
  const modelService = deps.modelService ?? createAiModelService()
  const fmpService = deps.fmpService ?? createFmpService()

  const fetchMarketContext = async (): Promise<MarketContext> => {
    const context: MarketContext = {
      prints: [],
      headlines: generateMockNewsPage()
        .items.slice(0, 6)
        .map((item) => ({
          id: item.id,
          title: item.title,
          summary: item.summary,
          symbols: item.symbols,
          publishedAt: item.published_at
        }))
    }

    try {
      const latest = await fmpService.getLatestPrints()
      context.prints = latest.events.slice(0, 6)
    } catch (error) {
      console.warn('[ntn-report] failed to fetch latest prints', {
        message: error instanceof Error ? error.message : String(error)
      })
    }

    return context
  }

  const getLatestReport = async (userId: string, reportType: string): Promise<NtnReportRecord | null> => {
    const result = await query(
      `
        SELECT *
        FROM ntn_reports
        WHERE user_id = $1 AND report_type = $2
        ORDER BY generated_at DESC
        LIMIT 1
      `,
      [userId, reportType]
    )
    if (!result.rows.length) {
      return null
    }
    return mapRow(result.rows[0] as Record<string, unknown>)
  }

  const persistReport = async (
    userId: string,
    reportType: string,
    content: string,
    metadata: Record<string, unknown>,
    model: string | null
  ) => {
    const result = await query(
      `
        INSERT INTO ntn_reports (user_id, report_date, report_type, content, metadata, model)
        VALUES ($1, CURRENT_DATE, $2, $3, $4, $5)
        ON CONFLICT (user_id, report_type, report_date)
        DO UPDATE SET
          content = EXCLUDED.content,
          metadata = EXCLUDED.metadata,
          model = EXCLUDED.model,
          generated_at = NOW()
        RETURNING *
      `,
      [userId, reportType, content, metadata ?? {}, model]
    )
    return mapRow(result.rows[0] as Record<string, unknown>)
  }

  const generateReport = async (userId: string, options: GenerateNtnReportOptions = {}) => {
    const reportType = sanitizeReportType(options.reportType)

    if (!options.forceRefresh) {
      const existing = await getLatestReport(userId, reportType)
      if (existing) {
        const ageMs = Date.now() - new Date(existing.generatedAt).getTime()
        if (ageMs < CACHE_WINDOW_MS) {
          return {
            report: {
              content: existing.content,
              reportType: existing.reportType,
              generatedAt: existing.generatedAt
            },
            metadata: existing.metadata,
            model: existing.model
          }
        }
      }
    }

    const context = await fetchMarketContext()
    const prompt = composeUserPrompt(context, reportType)

    let content: string
    let model: AiModelKey | null = DEFAULT_MODEL

    try {
      const result = await modelService.generateChat({
        model: DEFAULT_MODEL,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: prompt }
        ]
      })
      content = result.text
      model = result.model
    } catch (error) {
      console.error('[ntn-report] ai generation failed, falling back to template', {
        message: error instanceof Error ? error.message : String(error)
      })
      content = buildFallbackReport(context, reportType)
      model = null
    }

    const metadata = {
      context: {
        prints: context.prints.slice(0, 5).map((event) => ({
          id: event.id,
          name: event.name,
          actual: event.actual,
          forecast: event.forecast,
          isHot: event.isHot
        })),
        headlines: context.headlines.slice(0, 5)
      },
      generatedFrom: model ?? 'fallback'
    }

    const record = await persistReport(userId, reportType, content, metadata, model)

    return {
      report: {
        content: record.content,
        reportType: record.reportType,
        generatedAt: record.generatedAt
      },
      metadata: record.metadata,
      model: record.model
    } satisfies GenerateNtnReportResult
  }

  return {
    generateReport,
    getLatestReport
  }
}
