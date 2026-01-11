import { query } from '../db/optimized.js'

export type AnalystType = 'market_data' | 'news_sentiment' | 'technical'

export interface AnalystReportRecord {
  id: string
  userId: string
  agentType: AnalystType
  reportData: Record<string, unknown>
  confidenceScore: number | null
  createdAt: string
}

const mapRow = (row: Record<string, unknown>): AnalystReportRecord => ({
  id: String(row.id),
  userId: String(row.user_id),
  agentType: row.agent_type as AnalystType,
  reportData: (row.report_data as Record<string, unknown>) ?? {},
  confidenceScore:
    row.confidence_score !== null && row.confidence_score !== undefined
      ? Number(row.confidence_score)
      : null,
  createdAt: String(row.created_at)
})

const buildMarketReport = (instrument: string) => ({
  title: `${instrument.toUpperCase()} Market Regime`,
  summary:
    'Liquidity stacks against VWAP with slow grind higher. Treat the session as a low IV, base-hit environment and lean on VWAP +/- 25bp for rotations.',
  metrics: [
    { label: 'Regime', value: 'Range with bullish bias' },
    { label: 'Volatility', value: 'Low IV day' },
    { label: 'Support', value: '20 EMA cluster / 18,150' },
    { label: 'Resistance', value: '18,320 liquidity shelf' }
  ]
})

const buildNewsReport = () => ({
  title: 'Tape Check / Macro Risk',
  summary:
    'RiskFlow highlights Lutnick, Bessent, and tariff chatter as dominant narratives. Flow skew is mildly bullish but watch for tariff remarks that can flip sentiment.',
  metrics: [
    { label: 'Sentiment', value: 'Cautious Bullish' },
    { label: 'IV Impact', value: 'Greater (3/5)' },
    { label: 'Macro Level', value: 'Level 2 – policy-driven' },
    { label: 'Headline', value: 'Tariff commentary priced for +45bps NQ reaction' }
  ]
})

const buildTechnicalReport = (instrument: string) => ({
  title: `${instrument.toUpperCase()} Technical Stack`,
  summary:
    'Momentum holds above the 20/50 EMA stack with buyers defending each fade. Respect breakout levels but be ready to fade mean reversion if momentum stalls.',
  metrics: [
    { label: 'Trend', value: 'Trend up' },
    { label: 'Pattern', value: 'Ascending channel' },
    { label: 'Entry Zone', value: '18,190-18,210 pullbacks' },
    { label: 'Risk Guard', value: 'Invalid < 18,140 (VWAP - 0.5%)' }
  ]
})

export const createAnalystReportService = () => {
  const persistReport = async (
    userId: string,
    agentType: AnalystType,
    reportData: Record<string, unknown>,
    confidenceScore: number
  ): Promise<AnalystReportRecord> => {
    const result = await query(
      `
      INSERT INTO agent_reports (
        user_id,
        agent_type,
        report_data,
        confidence_score,
        model,
        latency_ms
      )
      VALUES ($1, $2, $3::jsonb, $4, $5, $6)
      RETURNING *
      `,
      [userId, agentType, JSON.stringify(reportData), confidenceScore, 'price-firmware', 50]
    )

    return mapRow(result.rows[0] as Record<string, unknown>)
  }

  const listLatestReports = async (userId: string): Promise<AnalystReportRecord[]> => {
    const result = await query(
      `
      SELECT DISTINCT ON (agent_type) *
      FROM agent_reports
      WHERE user_id = $1
      ORDER BY agent_type, created_at DESC
      `,
      [userId]
    )
    return result.rows.map((row) => mapRow(row as Record<string, unknown>))
  }

  const generateReports = async (userId: string, instrument = 'MNQ') => {
    const reports = await Promise.all([
      persistReport(userId, 'market_data', buildMarketReport(instrument), 0.72),
      persistReport(userId, 'news_sentiment', buildNewsReport(), 0.64),
      persistReport(userId, 'technical', buildTechnicalReport(instrument), 0.68)
    ])
    return reports
  }

  return {
    generateReports,
    listLatestReports
  }
}
