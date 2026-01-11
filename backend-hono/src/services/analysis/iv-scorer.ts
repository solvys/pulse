/**
 * IV Scorer Service
 * Calculate Implied Volatility impact scores for news events
 * Day 16 - Phase 5 Implementation
 */

import type { ParsedHeadline, HotPrint, IVScoreResult } from '../../types/news-analysis.js'
import { hasLevel4Emoji, MAJOR_MACRO_PRINTS } from '../headline-parser.js'

// Base impact weights by event type
const EVENT_WEIGHTS: Record<string, number> = {
  fedDecision: 10,
  cpiPrint: 8,
  ppiPrint: 7,
  nfpPrint: 7,
  gdpPrint: 6,
  earnings: 5,
  geopolitical: 8,
  bankingCrisis: 9,
  technicalBreak: 4,
  economicData: 5,
  retailSales: 5,
  ism: 5,
  jobless: 4,
  housing: 4,
  trade: 5,
  default: 3,
}

// Urgency multipliers
const URGENCY_MULTIPLIERS: Record<string, number> = {
  immediate: 1.3,
  high: 1.15,
  normal: 1.0,
}

// Time-based volatility windows (Eastern Time)
interface TimeWindow {
  start: number
  end: number
  multiplier: number
  label: string
}

const VOLATILITY_WINDOWS: TimeWindow[] = [
  { start: 4, end: 9, multiplier: 1.2, label: 'Pre-market' },
  { start: 9, end: 10, multiplier: 1.3, label: 'Open' },
  { start: 13, end: 16, multiplier: 1.25, label: 'FOMC window' },
  { start: 15, end: 16, multiplier: 1.15, label: 'Power hour' },
]

export interface IVScoreInput {
  parsed: ParsedHeadline
  hotPrint?: HotPrint | null
  timestamp?: Date
}

export interface ExtendedIVScore extends IVScoreResult {
  macroLevel: 1 | 2 | 3 | 4
  sentiment: 'bullish' | 'bearish' | 'neutral'
  tradingImplication: string
}

/**
 * Calculate IV impact score for a parsed headline
 */
export function calculateIVScore(input: IVScoreInput): ExtendedIVScore {
  const { parsed, hotPrint, timestamp = new Date() } = input
  const rationale: string[] = []
  
  // Get base weight from event type
  const eventType = parsed.eventType ?? 'default'
  let score = EVENT_WEIGHTS[eventType] ?? EVENT_WEIGHTS.default
  rationale.push(`Base weight for ${eventType}: ${score}`)

  // Breaking news boost
  if (parsed.isBreaking) {
    score += 1.5
    rationale.push('Breaking headline: +1.5')
  }

  // Urgency multiplier
  const urgencyMult = URGENCY_MULTIPLIERS[parsed.urgency] ?? 1.0
  if (urgencyMult > 1.0) {
    score *= urgencyMult
    rationale.push(`Urgency (${parsed.urgency}): ×${urgencyMult}`)
  }

  // Market reaction language
  if (parsed.marketReaction?.direction) {
    const intensityBoost = parsed.marketReaction.intensity === 'severe' ? 1.5 : 
                           parsed.marketReaction.intensity === 'moderate' ? 0.75 : 0.25
    score += intensityBoost
    rationale.push(`Market reaction (${parsed.marketReaction.intensity}): +${intensityBoost}`)
  }

  // Magnitude adjustment
  if (parsed.magnitude) {
    if (parsed.magnitude > 50) {
      score += 2
      rationale.push('Large magnitude (>50): +2')
    } else if (parsed.magnitude > 25) {
      score += 1
      rationale.push('Moderate magnitude (>25): +1')
    }
  }

  // Numerical deviation (actual vs forecast)
  if (parsed.numbers?.actual !== undefined && parsed.numbers?.forecast !== undefined) {
    const deviation = Math.abs(parsed.numbers.actual - parsed.numbers.forecast)
    const forecastValue = Math.abs(parsed.numbers.forecast) || 1
    const deviationPct = (deviation / forecastValue) * 100
    
    if (deviationPct > 50) {
      score += 2.5
      rationale.push(`Large deviation (${deviationPct.toFixed(1)}%): +2.5`)
    } else if (deviationPct > 20) {
      score += 1.5
      rationale.push(`Moderate deviation (${deviationPct.toFixed(1)}%): +1.5`)
    } else if (deviationPct > 10) {
      score += 0.75
      rationale.push(`Mild deviation (${deviationPct.toFixed(1)}%): +0.75`)
    }
  }

  // Hot print boost
  if (hotPrint) {
    const impactBoost = hotPrint.impact === 'high' ? 2.5 : 
                        hotPrint.impact === 'medium' ? 1.5 : 0.75
    score += impactBoost
    rationale.push(`Hot print (${hotPrint.impact}): +${impactBoost}`)
  }

  // Time-based adjustments
  const easternHour = getEasternHour(timestamp)
  for (const window of VOLATILITY_WINDOWS) {
    if (easternHour >= window.start && easternHour < window.end) {
      // Special case: FOMC window only applies to Fed events
      if (window.label === 'FOMC window' && eventType !== 'fedDecision') {
        continue
      }
      score *= window.multiplier
      rationale.push(`${window.label} timing: ×${window.multiplier}`)
      break
    }
  }

  // Clamp final score
  score = Math.min(10, Math.max(0, score))

  // Calculate implied points
  const { es, nq } = scoreToPoints(score)

  // Determine macro level (1-4 scale)
  const macroLevel = calculateMacroLevel(score, parsed, hotPrint)

  // Determine sentiment
  const sentiment = determineSentiment(parsed, hotPrint)

  // Generate trading implication
  const tradingImplication = generateTradingImplication(score, macroLevel, sentiment, eventType)

  return {
    eventType,
    score: Number(score.toFixed(2)),
    rationale,
    impliedESPoints: es,
    impliedNQPoints: nq,
    timestamp: timestamp.toISOString(),
    macroLevel,
    sentiment,
    tradingImplication,
  }
}

/**
 * Get Eastern Time hour from date
 */
function getEasternHour(date: Date): number {
  const utcHour = date.getUTCHours()
  // Approximate ET as UTC-5 (simplified, ignoring DST)
  return (utcHour + 24 - 5) % 24
}

/**
 * Convert score to implied ES/NQ point movements
 */
function scoreToPoints(score: number): { es: number; nq: number } {
  if (score <= 0) return { es: 0, nq: 0 }
  
  // Non-linear scaling for higher scores
  let esPoints: number
  if (score <= 3) {
    esPoints = score * 5
  } else if (score <= 6) {
    esPoints = 15 + (score - 3) * 10
  } else if (score <= 8) {
    esPoints = 45 + (score - 6) * 20
  } else {
    esPoints = 85 + (score - 8) * 40
  }

  // NQ typically moves ~1.8x ES
  const nqPoints = esPoints * 1.8

  return {
    es: Number(esPoints.toFixed(1)),
    nq: Number(nqPoints.toFixed(1)),
  }
}

/**
 * Calculate macro level (1-4)
 */
function calculateMacroLevel(
  score: number,
  parsed: ParsedHeadline,
  hotPrint: HotPrint | null | undefined
): 1 | 2 | 3 | 4 {
  const hasEmoji = hasLevel4Emoji(parsed.raw)
  const isMajorPrint = MAJOR_MACRO_PRINTS.includes(parsed.eventType ?? '')

  if (hasEmoji || isMajorPrint) return 4
  if (hotPrint?.impact === 'medium' || score >= 6) return 3
  if (score >= 4) return 2
  return 1
}

/**
 * Determine sentiment from parsed data
 */
function determineSentiment(
  parsed: ParsedHeadline,
  hotPrint: HotPrint | null | undefined
): 'bullish' | 'bearish' | 'neutral' {
  // Market reaction is most direct signal
  if (parsed.marketReaction?.direction === 'up') return 'bullish'
  if (parsed.marketReaction?.direction === 'down') return 'bearish'

  // Direction field
  if (parsed.direction === 'up') return 'bullish'
  if (parsed.direction === 'down') return 'bearish'

  // Action-based inference
  const bullishActions = ['raises', 'hikes', 'beats', 'surges', 'rallies', 'jumps']
  const bearishActions = ['cuts', 'slashes', 'misses', 'tumbles', 'drops', 'sinks']
  
  const action = parsed.action?.toLowerCase() ?? ''
  if (bullishActions.some(a => action.includes(a))) return 'bullish'
  if (bearishActions.some(a => action.includes(a))) return 'bearish'

  // Hot print direction
  if (hotPrint) {
    // For inflation data, below forecast is typically bullish for equities
    const inflationEvents = ['cpiPrint', 'ppiPrint']
    if (inflationEvents.includes(parsed.eventType ?? '')) {
      return hotPrint.direction === 'below' ? 'bullish' : 'bearish'
    }
    // For growth data, above forecast is typically bullish
    return hotPrint.direction === 'above' ? 'bullish' : 'bearish'
  }

  return 'neutral'
}

/**
 * Generate trading implication text
 */
function generateTradingImplication(
  score: number,
  macroLevel: number,
  sentiment: string,
  eventType: string
): string {
  if (score <= 2) {
    return 'Low impact event. Monitor but no immediate action required.'
  }

  if (score <= 4) {
    return `Moderate ${eventType} event. Watch for ${sentiment === 'bullish' ? 'support' : 'resistance'} levels.`
  }

  if (score <= 6) {
    const action = sentiment === 'bullish' ? 'long entries on pullbacks' : 
                   sentiment === 'bearish' ? 'short entries on bounces' : 
                   'wait for directional confirmation'
    return `Notable ${eventType} impact. Consider ${action}.`
  }

  if (score <= 8) {
    return `High impact ${eventType}. Expect elevated volatility. ${sentiment === 'neutral' ? 'Wait for market structure' : `Bias ${sentiment}.`}`
  }

  return `Critical ${eventType} event. Maximum volatility expected. Trade with caution, reduce size.`
}

/**
 * Batch score multiple headlines
 */
export function batchCalculateIVScores(
  inputs: IVScoreInput[]
): ExtendedIVScore[] {
  return inputs.map(calculateIVScore)
}

/**
 * Get event type weight
 */
export function getEventWeight(eventType: string): number {
  return EVENT_WEIGHTS[eventType] ?? EVENT_WEIGHTS.default
}
