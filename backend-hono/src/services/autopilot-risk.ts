/**
 * Autopilot Risk Validation Service
 * 
 * Validates proposals before creation and execution.
 * Includes pre-proposal validation (threats, blind spots, IV scores) and standard risk checks.
 */

import { sql } from '../db/index.js';

interface ThreatCheckResult {
  blocked: boolean;
  reason?: string;
  threats: Array<{
    type: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
  }>;
}

interface BlindSpotCheckResult {
  blocked: boolean;
  reason?: string;
  blindSpots: Array<{
    name: string;
    category: string;
    isGuardRailed: boolean;
  }>;
}

interface IVScoreResult {
  score: number;
  level: 'low' | 'medium' | 'high' | 'good';
  vix?: number;
}

interface RiskValidationResult {
  valid: boolean;
  reasons: string[];
  riskMetrics?: {
    dailyLoss: number;
    positionSize: number;
    accountBalance: number;
    concurrentPositions: number;
  };
}

// Circuit breaker state
let circuitBreakerState: {
  failures: number;
  lastFailureTime: number;
  state: 'closed' | 'open' | 'half-open';
} = {
  failures: 0,
  lastFailureTime: 0,
  state: 'closed',
};

// Cache for API responses
const cache = new Map<string, { data: any; expiresAt: number }>();

/**
 * Circuit breaker: Check if circuit is open
 */
function isCircuitOpen(): boolean {
  const now = Date.now();
  
  if (circuitBreakerState.state === 'open') {
    // Try half-open after 30 seconds
    if (now - circuitBreakerState.lastFailureTime > 30000) {
      circuitBreakerState.state = 'half-open';
      return false;
    }
    return true;
  }
  
  return false;
}

/**
 * Circuit breaker: Record failure
 */
function recordFailure(): void {
  circuitBreakerState.failures++;
  circuitBreakerState.lastFailureTime = Date.now();
  
  if (circuitBreakerState.failures >= 3) {
    circuitBreakerState.state = 'open';
  }
}

/**
 * Circuit breaker: Record success
 */
function recordSuccess(): void {
  circuitBreakerState.failures = 0;
  circuitBreakerState.state = 'closed';
}

/**
 * Make API call with circuit breaker and timeout
 */
async function apiCall<T>(
  url: string,
  options: RequestInit,
  cacheKey: string,
  cacheTTL: number
): Promise<T> {
  // Check cache
  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data as T;
  }

  // Check circuit breaker
  if (isCircuitOpen()) {
    // Use cached data if available (even if stale)
    if (cached) {
      console.warn(`Circuit breaker open, using stale cache for ${cacheKey}`);
      return cached.data as T;
    }
    throw new Error('AI integration unavailable - proposals blocked for safety');
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 2000); // 2 second timeout

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      recordFailure();
      throw new Error(`API call failed: ${response.status}`);
    }

    const data = await response.json() as T;
    
    // Cache the response
    cache.set(cacheKey, {
      data,
      expiresAt: Date.now() + cacheTTL,
    });

    recordSuccess();
    return data;
  } catch (error) {
    clearTimeout(timeoutId);
    recordFailure();
    
    // Use cached data if available
    if (cached) {
      console.warn(`API call failed, using stale cache for ${cacheKey}`);
      return cached.data as T;
    }
    
    throw error;
  }
}

/**
 * Check threat history (stub implementation - will be replaced with real endpoint)
 */
export async function checkThreatHistory(userId: string): Promise<ThreatCheckResult> {
  try {
    // TODO: Replace with real endpoint when Agent 1 is ready
    // const result = await apiCall<{ threats: Array<{ type: string; severity: string }> }>(
    //   `${process.env.API_BASE_URL || 'http://localhost:3000'}/ai/threat-history?active=true&limit=50&offset=0`,
    //   {
    //     method: 'GET',
    //     headers: {
    //       'Authorization': `Bearer ${token}`, // Get from context
    //     },
    //   },
    //   `threats:${userId}`,
    //   30000 // 30 second cache
    // );

    // Stub implementation
    console.warn('Using stub endpoint for threat-history');
    const result = { threats: [] };

    const criticalThreats = result.threats.filter((t: any) => t.severity === 'critical') as Array<{ type: string; severity: 'low' | 'medium' | 'high' | 'critical' }>;
    const highThreats = result.threats.filter((t: any) => t.severity === 'high') as Array<{ type: string; severity: 'low' | 'medium' | 'high' | 'critical' }>;

    if (criticalThreats.length > 0) {
      return {
        blocked: true,
        reason: `Critical threat detected: ${criticalThreats[0]?.type || 'unknown'}`,
        threats: criticalThreats,
      };
    }

    if (highThreats.length >= 2) {
      return {
        blocked: true,
        reason: `Multiple high-severity threats detected (${highThreats.length})`,
        threats: highThreats,
      };
    }

    return {
      blocked: false,
      threats: result.threats,
    };
  } catch (error) {
    console.error('Threat history check failed:', error);
    // Fail-safe: block if we can't check threats
    return {
      blocked: true,
      reason: 'Unable to verify threat status - blocking for safety',
      threats: [],
    };
  }
}

/**
 * Check blind spots (stub implementation - will be replaced with real endpoint)
 */
export async function checkBlindSpots(userId: string): Promise<BlindSpotCheckResult> {
  try {
    // TODO: Replace with real endpoint when Agent 1 is ready
    // const result = await apiCall<{ blindSpots: Array<{ name: string; isActive: boolean; isGuardRailed: boolean; category: string }> }>(
    //   `${process.env.API_BASE_URL || 'http://localhost:3000'}/ai/blind-spots`,
    //   {
    //     method: 'GET',
    //     headers: {
    //       'Authorization': `Bearer ${token}`,
    //     },
    //   },
    //   `blindspots:${userId}`,
    //   60000 // 60 second cache
    // );

    // Stub implementation
    console.warn('Using stub endpoint for blind-spots');
    const result = { blindSpots: [] };

    const guardRailedActive = result.blindSpots.filter(
      (bs: any) => bs.isGuardRailed === true && bs.isActive === true
    ) as Array<{ name: string; category: string; isGuardRailed: boolean }>;
    const riskCategoryActive = result.blindSpots.filter(
      (bs: any) => bs.category === 'risk' && bs.isActive === true && bs.isGuardRailed === false
    ) as Array<{ name: string; category: string; isGuardRailed: boolean }>;

    if (guardRailedActive.length > 0) {
      return {
        blocked: true,
        reason: `Guard-railed blind spot active: ${guardRailedActive[0]?.name || 'unknown'}`,
        blindSpots: guardRailedActive,
      };
    }

    if (riskCategoryActive.length > 0) {
      return {
        blocked: true,
        reason: `Risk category blind spot active: ${riskCategoryActive[0]?.name || 'unknown'}`,
        blindSpots: riskCategoryActive,
      };
    }

    return {
      blocked: false,
      blindSpots: result.blindSpots,
    };
  } catch (error) {
    console.error('Blind spots check failed:', error);
    // Fail-safe: block if we can't check blind spots
    return {
      blocked: true,
      reason: 'Unable to verify blind spots - blocking for safety',
      blindSpots: [],
    };
  }
}

/**
 * Get IV score (stub implementation - will be replaced with real endpoint)
 */
export async function getIVScore(userId: string, symbol: string): Promise<IVScoreResult> {
  try {
    // TODO: Replace with real endpoint when Agent 1 is ready
    // const result = await apiCall<{ score: number; level: string; vix?: number }>(
    //   `${process.env.API_BASE_URL || 'http://localhost:3000'}/ai/score?symbol=${encodeURIComponent(symbol)}`,
    //   {
    //     method: 'GET',
    //     headers: {
    //       'Authorization': `Bearer ${token}`,
    //     },
    //   },
    //   `ivscore:${userId}:${symbol}`,
    //   30000 // 30 second cache
    // );

    // Stub implementation
    console.warn(`Using stub endpoint for IV score (symbol: ${symbol})`);
    return {
      score: 5,
      level: 'medium',
    };
  } catch (error) {
    console.error('IV score check failed:', error);
    // Fallback to default
    return {
      score: 5,
      level: 'medium',
    };
  }
}

/**
 * Validate trading frequency
 */
export async function validateTradingFrequency(
  userId: string,
  accountId: number
): Promise<{ valid: boolean; reason?: string; currentCount: number; limit: number }> {
  try {
    // Get user's "usual trades per duration" setting
    const [setting] = await sql`
      SELECT usual_trades_per_duration, trades_per_duration
      FROM user_settings
      WHERE user_id = ${userId}
      LIMIT 1
    `.catch(async () => {
      // Try autopilot_settings as fallback
      return await sql`
        SELECT NULL as usual_trades_per_duration, NULL as trades_per_duration
        FROM autopilot_settings
        WHERE user_id = ${userId}
        LIMIT 1
      `;
    });

    const limit = setting?.usual_trades_per_duration || setting?.trades_per_duration || 10;
    const durationHours = 24; // Default: per day

    // Count proposals in last duration window
    const cutoffTime = new Date();
    cutoffTime.setHours(cutoffTime.getHours() - durationHours);

    const [countResult] = await sql`
      SELECT COUNT(*)::integer as count
      FROM autopilot_proposals
      WHERE user_id = ${userId}
        AND account_id = ${accountId}
        AND created_at >= ${cutoffTime.toISOString()}
    `;

    const currentCount = countResult?.count || 0;

    if (currentCount >= limit) {
      return {
        valid: false,
        reason: `Trading frequency limit exceeded: ${currentCount}/${limit} proposals in last ${durationHours} hours`,
        currentCount,
        limit,
      };
    }

    return {
      valid: true,
      currentCount,
      limit,
    };
  } catch (error) {
    console.error('Trading frequency validation failed:', error);
    // Allow if we can't check (don't block on this)
    return {
      valid: true,
      currentCount: 0,
      limit: 10,
    };
  }
}

/**
 * Validate standard risk parameters
 */
export async function validateRisk(
  userId: string,
  accountId: number,
  proposalSize: number,
  proposalPrice?: number
): Promise<RiskValidationResult> {
  const reasons: string[] = [];

  try {
    // Get account balance
    const [account] = await sql`
      SELECT balance, equity, buying_power, margin_used
      FROM broker_accounts
      WHERE user_id = ${userId} AND account_id = ${accountId}
      LIMIT 1
    `;

    if (!account) {
      return {
        valid: false,
        reasons: ['Account not found'],
      };
    }

    // Get autopilot settings
    const [settings] = await sql`
      SELECT daily_loss_limit, max_position_size, require_stop_loss
      FROM autopilot_settings
      WHERE user_id = ${userId}
      LIMIT 1
    `;

    const dailyLossLimit = settings?.daily_loss_limit || 500;
    const maxPositionSize = settings?.max_position_size || 5;
    const requireStopLoss = settings?.require_stop_loss ?? true;

    // Check daily loss limit
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [dailyLossResult] = await sql`
      SELECT COALESCE(SUM(pnl), 0)::decimal as daily_loss
      FROM trades
      WHERE user_id = ${userId}
        AND account_id = ${accountId}
        AND opened_at >= ${today.toISOString()}
        AND strategy LIKE 'autopilot%'
    `;

    const dailyLoss = Math.abs(Number(dailyLossResult?.daily_loss || 0));
    if (dailyLoss >= dailyLossLimit) {
      reasons.push(`Daily loss limit exceeded: $${dailyLoss.toFixed(2)}/${dailyLossLimit}`);
    }

    // Check position size
    if (proposalSize > maxPositionSize) {
      reasons.push(`Position size exceeds limit: ${proposalSize}/${maxPositionSize} contracts`);
    }

    // Check buying power (rough estimate)
    const estimatedMargin = proposalPrice ? proposalPrice * proposalSize * 0.1 : 0; // Rough 10% margin estimate
    if (account.buying_power && estimatedMargin > account.buying_power) {
      reasons.push(`Insufficient buying power: estimated ${estimatedMargin.toFixed(2)} > ${account.buying_power}`);
    }

    // Check concurrent positions
    const [positionsResult] = await sql`
      SELECT COUNT(*)::integer as count
      FROM trades
      WHERE user_id = ${userId}
        AND account_id = ${accountId}
        AND closed_at IS NULL
        AND strategy LIKE 'autopilot%'
    `;

    const concurrentPositions = positionsResult?.count || 0;
    const maxConcurrent = 10; // Default max concurrent positions
    if (concurrentPositions >= maxConcurrent) {
      reasons.push(`Maximum concurrent positions reached: ${concurrentPositions}/${maxConcurrent}`);
    }

    return {
      valid: reasons.length === 0,
      reasons,
      riskMetrics: {
        dailyLoss,
        positionSize: proposalSize,
        accountBalance: Number(account.balance),
        concurrentPositions,
      },
    };
  } catch (error) {
    console.error('Risk validation failed:', error);
    return {
      valid: false,
      reasons: ['Risk validation error'],
    };
  }
}

/**
 * Invalidate cache for a user (call when proposal is rejected)
 */
export function invalidateCache(userId: string): void {
  cache.delete(`threats:${userId}`);
  cache.delete(`blindspots:${userId}`);
  // Note: IV score cache is per symbol, so we'd need to know which symbols to invalidate
}
