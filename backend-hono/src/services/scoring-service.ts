/**
 * IV Scoring Service
 * Handles IV score calculation, caching, and symbol-specific scoring
 */

import { sql } from '../db/index.js';
import { env } from '../env.js';
import type { IVScore, IVScoreResponse } from '../types/ai.js';

// Cache for IV scores (in-memory, 1 minute TTL)
interface ScoreCache {
  score: IVScoreResponse;
  timestamp: number;
  symbol?: string;
}

const scoreCache = new Map<string, ScoreCache>();
const CACHE_TTL = 60 * 1000; // 1 minute in milliseconds

/**
 * Fetch VIX level from Google Finance (free, no API key required)
 * Uses Google Finance quote page which embeds JSON data
 */
async function fetchVIXFromGoogleFinance(): Promise<number> {
  try {
    const url = 'https://www.google.com/finance/quote/VIX:INDEXCBOE';
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    });

    if (!response.ok) {
      throw new Error(`Google Finance returned ${response.status}`);
    }

    const html = await response.text();
    
    // Google Finance embeds JSON data in a script tag
    // Look for the price data in the HTML
    const priceMatch = html.match(/"l":\s*"([0-9.]+)"/);
    if (priceMatch && priceMatch[1]) {
      return parseFloat(priceMatch[1]);
    }

    // Alternative: Look for JSON data structure
    const jsonMatch = html.match(/\["VIX:INDEXCBOE",[^\]]+\]/);
    if (jsonMatch) {
      try {
        const data = JSON.parse(jsonMatch[0]);
        if (data && data.length > 1 && typeof data[1] === 'number') {
          return data[1];
        }
      } catch (e) {
        // Continue to fallback
      }
    }

    // Fallback: Try to get from database market_indicators
    const [vix] = await sql`
      SELECT value
      FROM market_indicators
      WHERE indicator = 'VIX'
      ORDER BY timestamp DESC
      LIMIT 1
    `;

    return vix?.value || 15.0;
  } catch (error) {
    console.error('Failed to fetch VIX from Google Finance:', error);
    
    // Fallback: Try to get from database market_indicators
    try {
      const [vix] = await sql`
        SELECT value
        FROM market_indicators
        WHERE indicator = 'VIX'
        ORDER BY timestamp DESC
        LIMIT 1
      `;
      return vix?.value || 15.0;
    } catch (dbError) {
      console.error('Failed to fetch VIX from database:', dbError);
      // Return default VIX level
      return 15.0;
    }
  }
}

/**
 * Calculate base IV score from VIX level
 * Formula: score = (VIX / 22) * 10, capped at 10
 */
function calculateBaseScore(vix: number): number {
  const score = (vix / 22) * 10;
  return Math.min(10, Math.max(1, Math.round(score * 10) / 10));
}

/**
 * Determine level from score
 */
function getLevelFromScore(score: number): 'low' | 'medium' | 'high' | 'good' {
  if (score >= 1 && score <= 3) return 'low';
  if (score >= 4 && score <= 6) return 'medium';
  if (score >= 7 && score <= 8) return 'good';
  return 'high';
}

/**
 * Determine color from score
 */
function getColorFromScore(score: number): 'gray' | 'green' | 'orange' | 'red' {
  if (score === 1) return 'gray';
  if (score >= 3 && score <= 5.9) return 'green';
  if (score >= 6 && score <= 8.4) return 'orange';
  return 'red';
}

/**
 * Calculate implied points based on IV percentage and instrument
 */
function calculateImpliedPoints(
  ivPercentage: number,
  instrumentTickValue: number = 5.0
): number {
  return (ivPercentage / 100) * instrumentTickValue;
}

/**
 * Get cached score if available and not expired
 */
function getCachedScore(symbol?: string): IVScoreResponse | null {
  const cacheKey = symbol || 'general';
  const cached = scoreCache.get(cacheKey);

  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.score;
  }

  return null;
}

/**
 * Cache a score
 */
function cacheScore(score: IVScoreResponse, symbol?: string): void {
  const cacheKey = symbol || 'general';
  scoreCache.set(cacheKey, {
    score,
    timestamp: Date.now(),
    symbol,
  });
}

/**
 * Calculate IV score for a symbol or general market
 * Uses formula-based calculation with optional AI enhancement
 */
export async function calculateIVScore(
  userId?: string,
  symbol?: string,
  instrument?: string
): Promise<IVScoreResponse> {
  // Check cache first
  const cached = getCachedScore(symbol);
  if (cached) {
    return cached;
  }

  // Fetch current VIX level from Google Finance
  const vix = await fetchVIXFromGoogleFinance();

  // Calculate base score
  let score = calculateBaseScore(vix);

  // TODO: Apply AI enhancement based on market context
  // For now, use base calculation
  // AI enhancement would consider:
  // - Market regime (trending vs ranging)
  // - News sentiment
  // - Time of day
  // - Symbol-specific volatility

  // Determine level and color
  const level = getLevelFromScore(score);
  const color = getColorFromScore(score);

  // Calculate implied points (placeholder - would need actual IV percentage)
  const impliedPoints = calculateImpliedPoints(score * 10, 5.0);

  const result: IVScoreResponse = {
    score,
    level,
    timestamp: new Date().toISOString(),
    vix,
    instrument: instrument || symbol,
    color,
  };

  // Cache the result
  cacheScore(result, symbol);

  // Store in database for history
  try {
    await sql`
      INSERT INTO iv_scores (
        user_id, symbol, score, level, vix, implied_points,
        color, instrument, timestamp
      )
      VALUES (
        ${userId || null}, ${symbol || null}, ${score}, ${level}, ${vix},
        ${impliedPoints}, ${color}, ${instrument || symbol || null}, NOW()
      )
    `;
  } catch (error) {
    console.error('Failed to store IV score in database:', error);
    // Don't fail if database write fails
  }

  return result;
}

/**
 * Get current IV score (cached or fresh)
 */
export async function getCurrentIVScore(
  userId?: string,
  symbol?: string
): Promise<IVScoreResponse> {
  return calculateIVScore(userId, symbol);
}

/**
 * Get IV score history
 */
export async function getIVScoreHistory(
  userId: string,
  symbol?: string,
  limit: number = 100,
  offset: number = 0
): Promise<{ scores: IVScore[]; total: number }> {
  let scores;
  let countResult;

  if (symbol) {
    scores = await sql`
      SELECT 
        id, user_id as "userId", symbol, score, level, vix,
        implied_points as "impliedPoints", color, confidence,
        factors, recommendation, instrument, timestamp
      FROM iv_scores
      WHERE user_id = ${userId} AND symbol = ${symbol}
      ORDER BY timestamp DESC
      LIMIT ${limit} OFFSET ${offset}
    `;

    countResult = await sql`
      SELECT COUNT(*)::integer as count
      FROM iv_scores
      WHERE user_id = ${userId} AND symbol = ${symbol}
    `;
  } else {
    scores = await sql`
      SELECT 
        id, user_id as "userId", symbol, score, level, vix,
        implied_points as "impliedPoints", color, confidence,
        factors, recommendation, instrument, timestamp
      FROM iv_scores
      WHERE user_id = ${userId}
      ORDER BY timestamp DESC
      LIMIT ${limit} OFFSET ${offset}
    `;

    countResult = await sql`
      SELECT COUNT(*)::integer as count
      FROM iv_scores
      WHERE user_id = ${userId}
    `;
  }

  return {
    scores: scores.map((row: any) => ({
      id: row.id,
      userId: row.userId,
      symbol: row.symbol,
      score: row.score,
      level: row.level,
      vix: row.vix,
      impliedPoints: row.impliedPoints,
      color: row.color,
      confidence: row.confidence,
      factors: row.factors,
      recommendation: row.recommendation,
      instrument: row.instrument,
      timestamp: row.timestamp.toISOString(),
    })),
    total: countResult[0]?.count || 0,
  };
}

/**
 * Get current VIX level
 */
export async function getCurrentVIX(): Promise<{ value: number; timestamp: string; source: string }> {
  try {
    const vix = await fetchVIXFromGoogleFinance();
    return {
      value: vix,
      timestamp: new Date().toISOString(),
      source: 'google_finance',
    };
  } catch (error) {
    console.error('Failed to get VIX:', error);
    return {
      value: 15.0,
      timestamp: new Date().toISOString(),
      source: 'fallback',
    };
  }
}

/**
 * Clear score cache (useful for testing or manual refresh)
 */
export function clearScoreCache(symbol?: string): void {
  if (symbol) {
    scoreCache.delete(symbol);
  } else {
    scoreCache.clear();
  }
}
