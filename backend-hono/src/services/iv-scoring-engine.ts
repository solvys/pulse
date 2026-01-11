import { HotPrint, IVScoreResult, ParsedHeadline } from '../types/news-analysis.js'

type BaseWeightKey =
  | 'fedDecision'
  | 'cpiPrint'
  | 'ppiPrint'
  | 'nfpPrint'
  | 'gdpPrint'
  | 'earnings'
  | 'geopolitical'
  | 'bankingCrisis'
  | 'technicalBreak'
  | 'economicData'

const baseWeights: Record<BaseWeightKey, number> = {
  fedDecision: 10,
  cpiPrint: 8,
  ppiPrint: 7,
  nfpPrint: 7,
  gdpPrint: 6,
  earnings: 5,
  geopolitical: 8,
  bankingCrisis: 9,
  technicalBreak: 4,
  economicData: 5
}

const getEasternHour = (date: Date) => {
  const utcHour = date.getUTCHours()
  // approximate ET as UTC-5 (ignoring DST for simplicity)
  const eastern = (utcHour + 24 - 5) % 24
  return eastern
}

const isPreMarket = (date: Date) => {
  const hour = getEasternHour(date)
  return hour >= 4 && hour < 9
}

const isFomcWindow = (date: Date) => {
  const hour = getEasternHour(date)
  return hour >= 13 && hour <= 16
}

const clampScore = (value: number) => Math.min(10, Math.max(0, value))

const scoreToPoints = (score: number) => {
  if (score <= 0) return { es: 0, nq: 0 }
  if (score <= 3) {
    const es = 5 * score
    return { es, nq: es * 1.8 }
  }
  if (score <= 6) {
    const es = 10 * (score - 2)
    return { es, nq: es * 1.8 }
  }
  if (score <= 8) {
    const es = 20 * (score - 5)
    return { es, nq: es * 1.8 }
  }
  const es = 40 * (score - 7)
  return { es, nq: es * 1.8 }
}

export interface ScoreNewsOptions {
  now?: Date
}

export const scoreNews = (
  parsed: ParsedHeadline,
  hotPrint?: HotPrint | null,
  options?: ScoreNewsOptions
): IVScoreResult => {
  const now = options?.now ?? new Date()
  const eventType = (parsed.eventType as BaseWeightKey | undefined) ?? 'economicData'
  let score = baseWeights[eventType] ?? 3
  const rationale: string[] = [`Base weight for ${eventType}: ${score}`]

  if (parsed.isBreaking) {
    score += 1
    rationale.push('Breaking headline +1')
  }
  if (parsed.urgency === 'immediate') {
    score += 0.5
    rationale.push('Immediate urgency +0.5')
  }
  if (parsed.marketReaction?.direction) {
    score += parsed.marketReaction.intensity === 'severe' ? 1 : 0.5
    rationale.push('Market reaction language adds weight')
  }
  if (parsed.magnitude && parsed.magnitude > 25) {
    score += parsed.magnitude > 50 ? 1.5 : 0.75
    rationale.push('Large magnitude adjustment')
  }
  if (parsed.numbers?.actual && parsed.numbers?.forecast) {
    const deviation = Math.abs(parsed.numbers.actual - parsed.numbers.forecast)
    if (deviation > 20) {
      score += deviation > 50 ? 2 : 1
      rationale.push(`Deviation of ${deviation} adds impact`)
    }
  }
  if (hotPrint?.deviation) {
    score += hotPrint.deviation > 1 ? 2 : 1
    rationale.push('Hot print deviation boost')
  }
  if (isPreMarket(now)) {
    score += 1
    rationale.push('Pre-market timing +1')
  }
  if (isFomcWindow(now) && eventType === 'fedDecision') {
    score += 2
    rationale.push('FOMC window amplification +2')
  }

  score = clampScore(score)
  const { es, nq } = scoreToPoints(score)

  return {
    eventType,
    score,
    rationale,
    impliedESPoints: Number(es.toFixed(1)),
    impliedNQPoints: Number(nq.toFixed(1)),
    timestamp: now.toISOString()
  }
}

