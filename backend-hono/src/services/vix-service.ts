/**
 * VIX Service
 * Real-time VIX fetching with caching, spike detection, and multiplier logic
 */

export interface VIXData {
  level: number
  previousLevel: number
  timestamp: Date
  percentChange: number
  isSpike: boolean
  spikeDirection: 'up' | 'down' | 'none'
  staleMinutes: number
}

interface VIXCache {
  level: number
  previousLevel: number
  timestamp: Date
  fetchedAt: Date
}

// In-memory cache
let vixCache: VIXCache | null = null
const CACHE_TTL_MS = 60_000 // 1 minute cache
const STALE_THRESHOLD_MS = 15 * 60_000 // 15 minutes = stale

// VIX history for spike detection (last 15 readings)
const vixHistory: { level: number; timestamp: Date }[] = []
const MAX_HISTORY = 15

/**
 * Fetch current VIX level
 * Uses FMP API if available, falls back to cached value
 */
export async function fetchVIX(): Promise<VIXData> {
  const now = new Date()
  
  // Check cache first
  if (vixCache && (now.getTime() - vixCache.fetchedAt.getTime()) < CACHE_TTL_MS) {
    return buildVIXData(vixCache, now)
  }
  
  // Try to fetch fresh VIX
  try {
    const fmpApiKey = process.env.FMP_API_KEY
    if (!fmpApiKey) {
      console.warn('[VIX] No FMP_API_KEY set, using fallback')
      return getFallbackVIX(now)
    }
    
    const response = await fetch(
      `https://financialmodelingprep.com/api/v3/quote/%5EVIX?apikey=${fmpApiKey}`,
      { signal: AbortSignal.timeout(5000) }
    )
    
    if (!response.ok) {
      throw new Error(`FMP API error: ${response.status}`)
    }
    
    const data = await response.json()
    
    if (!Array.isArray(data) || data.length === 0 || typeof data[0]?.price !== 'number') {
      throw new Error('Invalid VIX response format')
    }
    
    const newLevel = data[0].price
    const previousLevel = vixCache?.level ?? newLevel
    
    // Update cache
    vixCache = {
      level: newLevel,
      previousLevel,
      timestamp: now,
      fetchedAt: now,
    }
    
    // Add to history for spike detection
    vixHistory.push({ level: newLevel, timestamp: now })
    if (vixHistory.length > MAX_HISTORY) {
      vixHistory.shift()
    }
    
    console.log(`[VIX] Fetched: ${newLevel.toFixed(2)} (prev: ${previousLevel.toFixed(2)})`)
    
    return buildVIXData(vixCache, now)
  } catch (error) {
    console.error('[VIX] Fetch error:', error)
    return getFallbackVIX(now)
  }
}

/**
 * Build VIX data response with spike detection
 */
function buildVIXData(cache: VIXCache, now: Date): VIXData {
  const staleMinutes = Math.floor((now.getTime() - cache.timestamp.getTime()) / 60000)
  const percentChange = cache.previousLevel > 0
    ? ((cache.level - cache.previousLevel) / cache.previousLevel) * 100
    : 0
  
  // Spike detection: >5% change in 15 minutes
  let isSpike = false
  let spikeDirection: 'up' | 'down' | 'none' = 'none'
  
  if (vixHistory.length >= 2) {
    const oldest = vixHistory[0]
    const newest = vixHistory[vixHistory.length - 1]
    const minutesElapsed = (newest.timestamp.getTime() - oldest.timestamp.getTime()) / 60000
    
    if (minutesElapsed <= 15) {
      const historicalChange = ((newest.level - oldest.level) / oldest.level) * 100
      if (Math.abs(historicalChange) > 5) {
        isSpike = true
        spikeDirection = historicalChange > 0 ? 'up' : 'down'
      }
    }
  }
  
  return {
    level: cache.level,
    previousLevel: cache.previousLevel,
    timestamp: cache.timestamp,
    percentChange: Number(percentChange.toFixed(2)),
    isSpike,
    spikeDirection,
    staleMinutes,
  }
}

/**
 * Get fallback VIX (last known or default)
 */
function getFallbackVIX(now: Date): VIXData {
  if (vixCache) {
    const staleMinutes = Math.floor((now.getTime() - vixCache.timestamp.getTime()) / 60000)
    console.warn(`[VIX] Using stale cache (${staleMinutes} min old)`)
    return buildVIXData(vixCache, now)
  }
  
  // Default VIX if nothing available
  console.warn('[VIX] No cache available, using default VIX=20')
  return {
    level: 20,
    previousLevel: 20,
    timestamp: now,
    percentChange: 0,
    isSpike: false,
    spikeDirection: 'none',
    staleMinutes: 0,
  }
}

/**
 * Get VIX spike adjustment for scoring
 * +2 if VIX spiked up >5% in 15 min
 * -1 if VIX dropped >5% in 15 min
 */
export function getVIXSpikeAdjustment(vixData: VIXData): number {
  if (!vixData.isSpike) return 0
  return vixData.spikeDirection === 'up' ? 2 : -1
}

/**
 * Check if VIX data is stale (>15 min old)
 */
export function isVIXStale(vixData: VIXData): boolean {
  return vixData.staleMinutes > 15
}

/**
 * Get VIX multiplier for IV scoring
 */
export function getVIXScoringMultiplier(vixLevel: number): {
  multiplier: number
  context: string
  tier: string
} {
  if (vixLevel < 15) {
    return { multiplier: 0.8, context: 'Low fear, choppy PA', tier: 'low' }
  }
  if (vixLevel < 20) {
    return { multiplier: 1.0, context: 'Neutral, base hits', tier: 'neutral' }
  }
  if (vixLevel < 30) {
    return { multiplier: 1.2, context: 'Elevated, trendy PA', tier: 'elevated' }
  }
  return { multiplier: 1.5, context: 'High fear, home runs', tier: 'extreme' }
}

/**
 * Calculate no-event baseline from VIX
 * Score = VIX / 3, capped at 10
 */
export function getVIXBaseline(vixLevel: number): number {
  return Math.min(10, Math.max(0, vixLevel / 3))
}

/**
 * Clear cache (for testing)
 */
export function clearVIXCache(): void {
  vixCache = null
  vixHistory.length = 0
}
