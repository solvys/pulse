/**
 * IV Scoring System v2
 * Complete implementation based on Grok consultation spec
 * Includes: Event weights, session multipliers, VIX correlation, time decay, stacking
 */

import type { ParsedHeadline, HotPrint } from '../types/news-analysis.js'

// ============================================================================
// EVENT WEIGHT TABLE (from Grok spec)
// ============================================================================

export const EVENT_WEIGHTS: Record<string, number> = {
  // Black Swan events - rare, extreme volatility
  blackSwan: 10,
  datacenterHalt: 10,
  governmentShutdown: 10,
  majorCrisis: 10,
  
  // Fed/Policy - 8 points
  fedDecision: 8,
  fomc: 8,
  powellSpeak: 8,
  
  // Geopolitical - 8 points (Volfefe risk)
  geopolitical: 8,
  tariffs: 8,
  chinaTrade: 8,
  conflict: 8,
  
  // Inflation/Employment - 7 points
  cpiPrint: 7,
  pcePrint: 7,
  nfpPrint: 7,
  jolts: 7,
  earningsHighImpact: 7, // Mag7
  
  // Economic Health - 6 points
  gdpPrint: 6,
  ismPrint: 6,
  politicalCommentary: 6, // Lutnick/Bessent/Trump
  
  // Mid-tier - 5 points
  earningsMidCap: 5,
  retailSales: 5,
  
  // Other - 3 points
  sectorNews: 3,
  merger: 3,
  other: 3,
  default: 3,
}

// ============================================================================
// SESSION MULTIPLIERS (liquidity-based)
// ============================================================================

export interface SessionInfo {
  name: string
  multiplier: number
  start: number // Hour in ET (0-23)
  end: number
}

export const SESSIONS: SessionInfo[] = [
  { name: 'Asian', multiplier: 0.6, start: 19, end: 2 },   // 7pm-2am ET
  { name: 'London', multiplier: 0.8, start: 2, end: 8 },   // 2am-8am ET
  { name: 'NY', multiplier: 1.0, start: 8, end: 16 },      // 8am-4pm ET
  { name: 'AfterHours', multiplier: 0.7, start: 16, end: 19 }, // 4pm-7pm ET
]

export function getCurrentSession(date: Date = new Date()): SessionInfo {
  const etHour = getEasternHour(date)
  
  for (const session of SESSIONS) {
    if (session.start > session.end) {
      // Wraps around midnight (Asian session)
      if (etHour >= session.start || etHour < session.end) {
        return session
      }
    } else {
      if (etHour >= session.start && etHour < session.end) {
        return session
      }
    }
  }
  
  // Default to NY if no match (shouldn't happen)
  return SESSIONS.find(s => s.name === 'NY')!
}

function getEasternHour(date: Date): number {
  // Get UTC hour and convert to Eastern (-5, simplified)
  const utcHour = date.getUTCHours()
  return (utcHour + 24 - 5) % 24
}

// ============================================================================
// VIX CORRELATION LOGIC
// ============================================================================

export interface VIXState {
  level: number
  previousLevel: number
  timestamp: Date
  multiplier: number
  spikeAdjustment: number
}

export const VIX_MULTIPLIERS: { max: number; multiplier: number; context: string }[] = [
  { max: 15, multiplier: 0.8, context: 'Low fear, choppy PA around 20/100 EMA' },
  { max: 20, multiplier: 1.0, context: 'Neutral, base hits' },
  { max: 30, multiplier: 1.2, context: 'Elevated, trendy PA respecting 20/50 EMA' },
  { max: Infinity, multiplier: 1.5, context: 'High fear, home run potential' },
]

export function getVIXMultiplier(vixLevel: number): { multiplier: number; context: string } {
  for (const tier of VIX_MULTIPLIERS) {
    if (vixLevel < tier.max) {
      return { multiplier: tier.multiplier, context: tier.context }
    }
  }
  return { multiplier: 1.5, context: 'Extreme volatility' }
}

export function calculateVIXSpikeAdjustment(
  currentVix: number,
  previousVix: number,
  minutesElapsed: number
): number {
  if (minutesElapsed > 15 || previousVix === 0) return 0
  
  const pctChange = ((currentVix - previousVix) / previousVix) * 100
  
  if (pctChange > 5) return 2   // VIX spike >5% in 15 min: +2
  if (pctChange < -5) return -1 // VIX drop >5%: -1
  return 0
}

export function getNoEventBaseline(vixLevel: number): number {
  // Score = VIX / 3, cap at 10
  return Math.min(10, vixLevel / 3)
}

// ============================================================================
// TIME DECAY (exponential)
// ============================================================================

export const DECAY_HALF_LIVES: Record<string, number> = {
  // Red Folder events - 120 min
  fedDecision: 120,
  fomc: 120,
  powellSpeak: 120,
  cpiPrint: 120,
  pcePrint: 120,
  nfpPrint: 120,
  
  // Geopolitical/Political - 90 min
  geopolitical: 90,
  tariffs: 90,
  chinaTrade: 90,
  conflict: 90,
  politicalCommentary: 90,
  
  // Earnings/Options - 60 min
  earningsHighImpact: 60,
  earningsMidCap: 60,
  
  // Other - 30 min
  default: 30,
}

export function calculateDecayedScore(
  baseScore: number,
  eventType: string,
  minutesSinceEvent: number
): number {
  const halfLife = DECAY_HALF_LIVES[eventType] ?? DECAY_HALF_LIVES.default
  const decayFactor = Math.pow(0.5, minutesSinceEvent / halfLife)
  return baseScore * decayFactor
}

// ============================================================================
// ACTIVITY LEVEL BASELINE
// ============================================================================

export interface ActivityLevel {
  isHighIV: boolean
  baseline: number
  context: string
}

export function getActivityBaseline(
  eventCount: number,
  isEarningsSeason: boolean,
  isFOMCWeek: boolean
): ActivityLevel {
  const isHighIV = eventCount >= 3 || isEarningsSeason || isFOMCWeek
  
  if (isHighIV) {
    return {
      isHighIV: true,
      baseline: 4,
      context: 'Elevated ambient vol, trendy PA respecting 20/50 EMA; use Anchored VWAP',
    }
  }
  
  return {
    isHighIV: false,
    baseline: 1,
    context: 'Floor for choppy PA around 20/100 EMA; use ORB/Power Hour',
  }
}

// ============================================================================
// STACKING LOGIC
// ============================================================================

export interface StackedEvent {
  eventType: string
  baseScore: number
  timestamp: Date
  decayedScore?: number
}

export function calculateStackedScore(
  events: StackedEvent[],
  now: Date = new Date()
): { score: number; synergy: boolean; events: StackedEvent[] } {
  if (events.length === 0) {
    return { score: 0, synergy: false, events: [] }
  }
  
  // Calculate decayed scores for all events
  const processedEvents = events.map(event => {
    const minutesSince = (now.getTime() - event.timestamp.getTime()) / 60000
    const decayed = calculateDecayedScore(event.baseScore, event.eventType, minutesSince)
    return { ...event, decayedScore: decayed }
  })
  
  // Sum all decayed scores
  let totalScore = processedEvents.reduce((sum, e) => sum + (e.decayedScore ?? 0), 0)
  
  // Check for synergy (events <30 min apart)
  let synergy = false
  if (events.length >= 2) {
    const sortedByTime = [...events].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
    for (let i = 1; i < sortedByTime.length; i++) {
      const gap = (sortedByTime[i].timestamp.getTime() - sortedByTime[i - 1].timestamp.getTime()) / 60000
      if (gap < 30) {
        synergy = true
        break
      }
    }
  }
  
  // Apply synergy boost
  if (synergy) {
    totalScore *= 1.2
  }
  
  // Cap at 10
  totalScore = Math.min(10, totalScore)
  
  return { score: totalScore, synergy, events: processedEvents }
}

// ============================================================================
// INSTRUMENT BETA TABLE
// Beta = correlation to SPX volatility (1.0 = moves with SPX, <1 = less volatile)
// ============================================================================

export const INSTRUMENT_BETAS: Record<string, { beta: number; tickValue: number; tickSize: number; currentPrice: number; notes: string }> = {
  // Equity Index Futures
  '/ES': { beta: 1.0, tickValue: 12.50, tickSize: 0.25, currentPrice: 6000, notes: 'E-mini S&P 500 - Base reference' },
  '/MES': { beta: 1.0, tickValue: 1.25, tickSize: 0.25, currentPrice: 6000, notes: 'Micro E-mini S&P 500' },
  '/NQ': { beta: 1.2, tickValue: 5.00, tickSize: 0.25, currentPrice: 21000, notes: 'E-mini Nasdaq 100 - Tech-heavy' },
  '/MNQ': { beta: 1.2, tickValue: 0.50, tickSize: 0.25, currentPrice: 21000, notes: 'Micro E-mini Nasdaq 100' },
  '/YM': { beta: 0.95, tickValue: 5.00, tickSize: 1.0, currentPrice: 44000, notes: 'E-mini Dow Jones - Industrials' },
  '/MYM': { beta: 0.95, tickValue: 0.50, tickSize: 1.0, currentPrice: 44000, notes: 'Micro E-mini Dow Jones' },
  '/RTY': { beta: 1.1, tickValue: 5.00, tickSize: 0.10, currentPrice: 2200, notes: 'E-mini Russell 2000 - Small caps' },
  '/M2K': { beta: 1.1, tickValue: 0.50, tickSize: 0.10, currentPrice: 2200, notes: 'Micro E-mini Russell 2000' },
  
  // Commodities
  '/CL': { beta: 0.6, tickValue: 10.00, tickSize: 0.01, currentPrice: 75, notes: 'Crude Oil - Energy sector proxy' },
  '/MCL': { beta: 0.6, tickValue: 1.00, tickSize: 0.01, currentPrice: 75, notes: 'Micro Crude Oil' },
  '/GC': { beta: 0.2, tickValue: 10.00, tickSize: 0.10, currentPrice: 2650, notes: 'Gold - Safe-haven, inverse correlation' },
  '/MGC': { beta: 0.2, tickValue: 1.00, tickSize: 0.10, currentPrice: 2650, notes: 'Micro Gold' },
  '/SI': { beta: 0.4, tickValue: 25.00, tickSize: 0.005, currentPrice: 30, notes: 'Silver - Industrial/vol proxy' },
  '/SIL': { beta: 0.4, tickValue: 2.50, tickSize: 0.005, currentPrice: 30, notes: 'Micro Silver' },
  '/NG': { beta: 0.5, tickValue: 10.00, tickSize: 0.001, currentPrice: 3.50, notes: 'Natural Gas - High volatility' },
  
  // Currencies (low SPX correlation)
  '/6E': { beta: 0.3, tickValue: 12.50, tickSize: 0.00005, currentPrice: 1.08, notes: 'Euro FX' },
  '/6J': { beta: 0.25, tickValue: 12.50, tickSize: 0.0000005, currentPrice: 0.0067, notes: 'Japanese Yen' },
  '/6B': { beta: 0.35, tickValue: 6.25, tickSize: 0.0001, currentPrice: 1.27, notes: 'British Pound' },
  
  // Bonds (inverse correlation during risk-off)
  '/ZB': { beta: -0.3, tickValue: 31.25, tickSize: 0.03125, currentPrice: 118, notes: '30-Year Treasury Bond' },
  '/ZN': { beta: -0.25, tickValue: 15.625, tickSize: 0.015625, currentPrice: 110, notes: '10-Year Treasury Note' },
}

// ============================================================================
// IMPLIED POINTS CALCULATION (Rule of 16)
// Formula: Daily Expected Move = Price × (VIX / 16) / 100 × Beta
// ============================================================================

export interface ImpliedPoints {
  impliedPct: number
  basePoints: number
  adjustedPoints: number
  adjustedTicks: number
  tickValue: number
  dollarRisk: number
  instrument: string
  beta: number
}

export function calculateImpliedPoints(
  vixLevel: number,
  currentPrice: number | undefined,
  instrument: string
): ImpliedPoints {
  // Get instrument config (or defaults)
  const instrumentConfig = INSTRUMENT_BETAS[instrument] ?? {
    beta: 1.0,
    tickValue: 1.0,
    tickSize: 0.25,
    currentPrice: 6000,
    notes: 'Unknown instrument - using /ES defaults'
  }
  
  // Use provided price or fallback to config price
  const price = currentPrice ?? instrumentConfig.currentPrice
  
  // Rule of 16: Implied daily % move = VIX / 16
  // e.g., VIX 20 = 1.25% expected daily move
  const impliedPct = vixLevel / 16
  
  // Base points = Price × Implied%
  // e.g., 6000 × 1.25% = 75 points for /ES
  const basePoints = price * (impliedPct / 100)
  
  // Adjusted points = Base × Beta
  // e.g., /NQ with beta 1.2 = 75 × 1.2 = 90 points
  const adjustedPoints = basePoints * Math.abs(instrumentConfig.beta)
  
  // Convert to ticks for the instrument
  const adjustedTicks = adjustedPoints / instrumentConfig.tickSize
  
  // Calculate dollar risk per contract
  const dollarRisk = adjustedTicks * instrumentConfig.tickValue
  
  return {
    impliedPct: Number(impliedPct.toFixed(2)),
    basePoints: Number(basePoints.toFixed(1)),
    adjustedPoints: Number(adjustedPoints.toFixed(1)),
    adjustedTicks: Math.round(adjustedTicks),
    tickValue: instrumentConfig.tickValue,
    dollarRisk: Number(dollarRisk.toFixed(2)),
    instrument,
    beta: instrumentConfig.beta,
  }
}

/**
 * Get instrument config by symbol
 */
export function getInstrumentConfig(instrument: string) {
  return INSTRUMENT_BETAS[instrument] ?? null
}

/**
 * List all supported instruments
 */
export function getSupportedInstruments(): string[] {
  return Object.keys(INSTRUMENT_BETAS)
}

// ============================================================================
// RED FOLDER INSTANT TRIGGERS
// ============================================================================

export const INSTANT_TRIGGERS: Record<string, number> = {
  // Set to 10 - Black Swan only
  blackSwan: 10,
  datacenterHalt: 10,
  governmentShutdown: 10,
  majorCrisis: 10,
  
  // Set to 8+ - Fed/Geo surprises
  fedDecision: 8,
  fomc: 8,
  powellSpeak: 8,
  geopolitical: 8,
  tariffs: 8,
  
  // Set to 6-7 - Macro surprises
  cpiPrint: 7,
  nfpPrint: 7,
  gdpPrint: 6,
}

export function isInstantTrigger(eventType: string): { isInstant: boolean; minScore: number } {
  const minScore = INSTANT_TRIGGERS[eventType]
  return {
    isInstant: minScore !== undefined,
    minScore: minScore ?? 0,
  }
}

// ============================================================================
// EDGE CASES
// ============================================================================

export interface EdgeCaseResult {
  triggered: boolean
  score?: number
  message?: string
  holdMinutes?: number
}

export function checkEdgeCases(
  eventType: string,
  vixLevel: number,
  isMarketClosed: boolean
): EdgeCaseResult {
  // Black Swan: Auto-10, hold 60 min if VIX >25
  if (eventType === 'blackSwan' || eventType === 'datacenterHalt' || eventType === 'majorCrisis') {
    return {
      triggered: true,
      score: 10,
      message: "Get focused 'cause this one of them ones",
      holdMinutes: vixLevel > 25 ? 60 : 30,
    }
  }
  
  // Extreme VIX (>50): Auto-10
  if (vixLevel > 50) {
    return {
      triggered: true,
      score: 10,
      message: "Get focused 'cause this one of them ones - Extreme VIX",
    }
  }
  
  // Market closed: Apply 0.5 decay multiplier daily
  if (isMarketClosed) {
    return {
      triggered: true,
      message: 'Market closed - using last close VIX with 0.5 daily decay',
    }
  }
  
  return { triggered: false }
}

// ============================================================================
// MULTI-SESSION SPILLOVER
// ============================================================================

export function calculateSpillover(previousSessionScore: number): number {
  // Carry 20% of prior session's final score into next
  return previousSessionScore * 0.2
}

// ============================================================================
// MAIN SCORING FUNCTION
// ============================================================================

export interface IVScoreInputV2 {
  events: StackedEvent[]
  vixLevel: number
  previousVixLevel?: number
  vixUpdateMinutes?: number
  currentPrice: number
  instrument: string
  isMarketClosed?: boolean
  isEarningsSeason?: boolean
  isFOMCWeek?: boolean
  previousSessionScore?: number
}

export interface IVScoreResultV2 {
  score: number
  impliedPoints: ImpliedPoints
  session: SessionInfo
  vixMultiplier: number
  vixContext: string
  activityBaseline: number
  stackedEvents: number
  synergy: boolean
  rationale: string[]
  alert?: string
}

export function calculateIVScoreV2(input: IVScoreInputV2): IVScoreResultV2 {
  const {
    events,
    vixLevel,
    previousVixLevel = vixLevel,
    vixUpdateMinutes = 0,
    currentPrice,
    instrument,
    isMarketClosed = false,
    isEarningsSeason = false,
    isFOMCWeek = false,
    previousSessionScore = 0,
  } = input
  
  const rationale: string[] = []
  const now = new Date()
  
  // Check edge cases first
  for (const event of events) {
    const edgeCase = checkEdgeCases(event.eventType, vixLevel, isMarketClosed)
    if (edgeCase.triggered && edgeCase.score !== undefined) {
      const points = calculateImpliedPoints(vixLevel, currentPrice, instrument)
      return {
        score: edgeCase.score,
        impliedPoints: points,
        session: getCurrentSession(now),
        vixMultiplier: getVIXMultiplier(vixLevel).multiplier,
        vixContext: getVIXMultiplier(vixLevel).context,
        activityBaseline: 10,
        stackedEvents: events.length,
        synergy: false,
        rationale: [edgeCase.message!],
        alert: edgeCase.message,
      }
    }
  }
  
  // Get session multiplier
  const session = getCurrentSession(now)
  rationale.push(`Session: ${session.name} (×${session.multiplier})`)
  
  // Get VIX multiplier
  const { multiplier: vixMult, context: vixContext } = getVIXMultiplier(vixLevel)
  rationale.push(`VIX ${vixLevel.toFixed(1)}: ×${vixMult} (${vixContext})`)
  
  // Get VIX spike adjustment
  const spikeAdj = calculateVIXSpikeAdjustment(vixLevel, previousVixLevel, vixUpdateMinutes)
  if (spikeAdj !== 0) {
    rationale.push(`VIX spike adjustment: ${spikeAdj > 0 ? '+' : ''}${spikeAdj}`)
  }
  
  // Get activity baseline
  const activity = getActivityBaseline(events.length, isEarningsSeason, isFOMCWeek)
  rationale.push(`Activity baseline: ${activity.baseline} (${activity.isHighIV ? 'High IV' : 'Low IV'})`)
  
  // Calculate stacked score from events
  let score: number
  let synergy = false
  
  if (events.length === 0) {
    // No events - use VIX baseline
    score = getNoEventBaseline(vixLevel)
    rationale.push(`No events - VIX baseline: ${score.toFixed(1)}`)
  } else {
    const stacked = calculateStackedScore(events, now)
    score = stacked.score
    synergy = stacked.synergy
    
    if (synergy) {
      rationale.push('Synergy boost applied (events <30 min apart): ×1.2')
    }
    rationale.push(`Stacked events score: ${score.toFixed(2)}`)
  }
  
  // Apply session multiplier
  score *= session.multiplier
  rationale.push(`After session multiplier: ${score.toFixed(2)}`)
  
  // Apply VIX multiplier
  score *= vixMult
  rationale.push(`After VIX multiplier: ${score.toFixed(2)}`)
  
  // Add VIX spike adjustment
  score += spikeAdj
  
  // Add spillover from previous session
  if (previousSessionScore > 0) {
    const spillover = calculateSpillover(previousSessionScore)
    score += spillover
    rationale.push(`Spillover from previous session: +${spillover.toFixed(2)}`)
  }
  
  // Ensure score is within bounds
  score = Math.max(0, Math.min(10, score))
  
  // Add activity baseline floor
  score = Math.max(score, activity.baseline)
  
  rationale.push(`Final score: ${score.toFixed(1)}`)
  
  // Calculate implied points
  const impliedPoints = calculateImpliedPoints(vixLevel, currentPrice, instrument)
  rationale.push(`Implied move: ±${impliedPoints.adjustedPoints} points (${instrument}, β=${impliedPoints.beta})`)
  
  // Determine if alert needed
  let alert: string | undefined
  if (score >= 8) {
    alert = "Get focused 'cause this one of them ones"
  }
  
  return {
    score: Number(score.toFixed(1)),
    impliedPoints,
    session,
    vixMultiplier: vixMult,
    vixContext,
    activityBaseline: activity.baseline,
    stackedEvents: events.length,
    synergy,
    rationale,
    alert,
  }
}

// ============================================================================
// EVENT TYPE CLASSIFIER (from headline parsing)
// ============================================================================

export function classifyEventType(parsed: ParsedHeadline): string {
  const headline = (parsed.raw ?? '').toLowerCase()
  const eventType = parsed.eventType?.toLowerCase() ?? ''
  
  // Black Swan detection
  if (headline.includes('halt') && (headline.includes('datacenter') || headline.includes('trading'))) {
    return 'datacenterHalt'
  }
  if (headline.includes('shutdown') && headline.includes('government')) {
    return 'governmentShutdown'
  }
  if (headline.includes('crisis') || headline.includes('collapse') || headline.includes('emergency')) {
    return 'majorCrisis'
  }
  
  // Fed/Policy
  if (eventType === 'feddecision' || headline.includes('fomc') || headline.includes('fed ')) {
    if (headline.includes('powell')) return 'powellSpeak'
    return 'fedDecision'
  }
  
  // Geopolitical
  if (headline.includes('tariff')) return 'tariffs'
  if (headline.includes('china') && headline.includes('trade')) return 'chinaTrade'
  if (headline.includes('war') || headline.includes('attack') || headline.includes('missile')) return 'conflict'
  if (eventType === 'geopolitical') return 'geopolitical'
  
  // Economic Data
  if (eventType === 'cpiprint' || headline.includes('cpi')) return 'cpiPrint'
  if (eventType === 'pceprint' || headline.includes('pce')) return 'pcePrint'
  if (eventType === 'nfpprint' || headline.includes('nfp') || headline.includes('payrolls')) return 'nfpPrint'
  if (headline.includes('jolts')) return 'jolts'
  if (eventType === 'gdpprint' || headline.includes('gdp')) return 'gdpPrint'
  if (headline.includes('ism')) return 'ismPrint'
  
  // Political Commentary
  if (headline.includes('trump') || headline.includes('lutnick') || headline.includes('bessent')) {
    return 'politicalCommentary'
  }
  
  // Earnings
  if (eventType === 'earnings' || headline.includes('earnings')) {
    // Check for Mag7
    const mag7 = ['aapl', 'msft', 'googl', 'amzn', 'meta', 'nvda', 'tsla']
    if (mag7.some(ticker => headline.includes(ticker))) {
      return 'earningsHighImpact'
    }
    return 'earningsMidCap'
  }
  
  // Other
  if (headline.includes('merger') || headline.includes('acquisition')) return 'merger'
  if (headline.includes('retail sales')) return 'retailSales'
  
  return 'other'
}
