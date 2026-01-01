/**
 * Polymarket Service
 * Fetches prediction market odds for macroeconomic events via Gamma API
 */

import { sql } from '../db/index.js';

// Gamma API URL (Better for discovery)
const GAMMA_API_URL = 'https://gamma-api.polymarket.com';

export type PolymarketMarketType =
  | 'tariffs'
  | 'supreme_court_tariffs'
  | 'trump_impeachment'
  | 'fed_chair'
  | 'emergency_rate_cut'
  | 'regional_bank_failure'
  | 'gold_new_highs'
  | 'silver_new_highs'
  | 'interest_rate_futures';

// Macro level mapping for each market type
export const MARKET_MACRO_LEVELS: Record<PolymarketMarketType, number> = {
  'tariffs': 3,
  'supreme_court_tariffs': 3,
  'trump_impeachment': 2,
  'fed_chair': 4,
  'emergency_rate_cut': 3,
  'regional_bank_failure': 3,
  'gold_new_highs': 2,
  'silver_new_highs': 3,
  'interest_rate_futures': 4,
};

// Mapping topics to search keywords for better API discovery
const TOPIC_KEYWORDS: Record<PolymarketMarketType, string[]> = {
  'tariffs': ['Tariff', 'Trade War', 'Trump Tariff', 'China Tariff', 'EU Tariff'],
  'supreme_court_tariffs': ['Supreme Court', 'SCOTUS', 'Tariff', 'Trade', 'Court Ruling'],
  'trump_impeachment': ['Impeachment', 'Trump Impeach', 'Impeach Trump'],
  'fed_chair': ['Fed Chair', 'Federal Reserve Chair', 'Powell', 'Fed Nominee', 'FOMC Chair'],
  'emergency_rate_cut': ['Emergency Rate Cut', 'Fed Emergency', 'Emergency Cut', 'FOMC Emergency'],
  'regional_bank_failure': ['Bank Failure', 'Regional Bank', 'Bank Collapse', 'Bank Crisis', 'Bank Run'],
  'gold_new_highs': ['Gold', 'Gold High', 'Gold Price', 'XAU', 'Gold Record'],
  'silver_new_highs': ['Silver', 'Silver High', 'Silver Price', 'XAG', 'Silver Record'],
  'interest_rate_futures': ['Interest Rate', 'Fed Funds', 'Rate Futures', 'FOMC Rate', 'Fed Rate'],
};

// Filter out irrelevant markets (nukes, WW3, etc.)
const IRRELEVANT_KEYWORDS = [
  'nuclear weapon',
  'nuclear war',
  'ww3',
  'world war 3',
  'nuke',
  'atomic bomb',
  'nuclear detonation',
  'nuclear attack',
];

/**
 * Check if a market is relevant (not filtered out)
 */
function isRelevantMarket(event: GammaEvent): boolean {
  const text = (event.title + ' ' + event.slug + ' ' + (event.markets[0]?.question || '')).toLowerCase();
  return !IRRELEVANT_KEYWORDS.some(keyword => text.includes(keyword));
}

export interface PolymarketOdds {
  marketId: string;
  marketType: PolymarketMarketType;
  question: string;
  yesOdds: number; // 0-1 probability
  noOdds: number; // 0-1 probability
  timestamp: string;
  slug: string;
}

export interface PolymarketUpdate {
  id: string;
  marketType: PolymarketMarketType;
  previousOdds: number;
  currentOdds: number;
  changePercentage: number;
  triggeredByNewsId?: string;
  timestamp: string;
}

interface GammaEvent {
  id: string;
  title: string;
  slug: string;
  markets: {
    id: string;
    question: string;
    outcomes: string[] | string; // Can be stringified JSON
    outcomePrices: string[] | string; // Can be stringified JSON
    volume?: number;
    active?: boolean;
    closed?: boolean;
  }[];
}

/**
 * Save snapshot to database
 */
async function saveMarketSnapshot(odds: PolymarketOdds) {
  try {
    await sql`
            INSERT INTO polymarket_odds (market_id, market_type, yes_odds, no_odds, timestamp)
            VALUES (${odds.marketId}, ${odds.marketType}, ${odds.yesOdds}, ${odds.noOdds}, NOW())
            ON CONFLICT (market_id, timestamp) DO NOTHING
        `;
  } catch (e) {
    console.error('Failed to save polymarket snapshot:', e);
  }
}

/**
 * Fetch all active events from Gamma API
 */
async function fetchGammaEvents(): Promise<GammaEvent[]> {
  try {
    // Fetch top 50 active events sorted by volume
    const response = await fetch(`${GAMMA_API_URL}/events?closed=false&limit=50&sort=volume`);
    if (!response.ok) throw new Error(`Gamma API Error: ${response.status}`);
    const data = await response.json() as any;
    return Array.isArray(data) ? data : [];
  } catch (e) {
    console.error('Failed to fetch Gamma events:', e);
    return [];
  }
}

/**
 * Fetch all Polymarket odds for tracked markets using Gamma API
 * Replaces singular fetch loops with bulk fetch + classification
 */
export async function fetchAllPolymarketOdds(): Promise<PolymarketOdds[]> {
  try {
    const events = await fetchGammaEvents();
    // Filter out irrelevant markets first
    const relevantEvents = events.filter(isRelevantMarket);
    
    const marketTypes = Object.keys(TOPIC_KEYWORDS) as PolymarketMarketType[];
    const result: PolymarketOdds[] = [];

    // Iterate types to find best matching details
    for (const type of marketTypes) {
      const keywords = TOPIC_KEYWORDS[type];

      // Find matching event from relevant events only
      const match = relevantEvents.find(e => {
        const text = (e.title + ' ' + e.slug + ' ' + (e.markets[0]?.question || '')).toLowerCase();
        return keywords.some(k => text.includes(k.toLowerCase()));
      });

      if (match && match.markets.length > 0) {
        // Use the first market in the event usually
        const market = match.markets[0];

        // Parse odd - Gamma API returns strings for arrays sometimes
        let outcomes: string[] = [];
        let prices: string[] = [];

        try {
          outcomes = typeof market.outcomes === 'string' ? JSON.parse(market.outcomes) : (market.outcomes || []);
          prices = typeof market.outcomePrices === 'string' ? JSON.parse(market.outcomePrices) : (market.outcomePrices || []);
        } catch (e) {
          console.error('Failed to parse outcomes/prices:', e);
        }

        let yesIndex = outcomes.findIndex(o => o === 'Yes' || o === 'Trump' || o === 'Republicans' || o === 'Long');
        if (yesIndex === -1) yesIndex = 0;
        let noIndex = yesIndex === 0 ? 1 : 0;

        let yesPrice = parseFloat(prices[yesIndex] || '0');
        let noPrice = parseFloat(prices[noIndex] || '0');

        if (isNaN(yesPrice)) yesPrice = 0;
        if (isNaN(noPrice)) noPrice = 0;

        const odds: PolymarketOdds = {
          marketId: market.id,
          marketType: type,
          question: market.question || match.title,
          slug: match.slug,
          yesOdds: yesPrice,
          noOdds: noPrice,
          timestamp: new Date().toISOString()
        };

        result.push(odds);

        // Save snapshot immediately
        await saveMarketSnapshot(odds);
      }
    }

    return result;

  } catch (error) {
    console.error('Failed to fetch all Polymarket odds:', error);
    return [];
  }
}

/**
 * Fetch single market odds (Compatibility wrapper)
 */
export async function fetchPolymarketOdds(marketType: PolymarketMarketType): Promise<PolymarketOdds | null> {
  const all = await fetchAllPolymarketOdds();
  return all.find(o => o.marketType === marketType) || null;
}

/**
 * Check for significant odds changes (>5% threshold) within last 24 hours
 * Returns null if data is stale (>24 hours old)
 */
export async function checkSignificantChanges(
  currentOdds: PolymarketOdds
): Promise<{ hasChange: boolean; changePercentage: number; previousOdds: number; isStale: boolean }> {
  try {
    // Get snapshot from 24 hours ago (or most recent if less than 24h exists)
    const rows = await sql`
            SELECT yes_odds, timestamp FROM polymarket_odds
            WHERE market_id = ${currentOdds.marketId}
            AND timestamp > NOW() - INTERVAL '24 hours'
            ORDER BY timestamp DESC
            LIMIT 1
        `;

    if (rows.length === 0) {
      // Check if any data exists at all
      const anyRows = await sql`
                SELECT yes_odds, timestamp FROM polymarket_odds
                WHERE market_id = ${currentOdds.marketId}
                ORDER BY timestamp DESC
                LIMIT 1
            `;
      
      if (anyRows.length === 0) {
        // No previous data - this is a new market
        return { hasChange: false, changePercentage: 0, previousOdds: 0, isStale: false };
      }

      // Data exists but is older than 24 hours - mark as stale
      const prev = Number(anyRows[0].yes_odds);
      const change = Math.abs(currentOdds.yesOdds - prev);
      return { 
        hasChange: change > 0.05, 
        changePercentage: change * 100, 
        previousOdds: prev,
        isStale: true // Stale data - don't show in feed
      };
    }

    const prev = Number(rows[0].yes_odds);
    const change = Math.abs(currentOdds.yesOdds - prev);

    return {
      hasChange: change > 0.05,
      changePercentage: change * 100,
      previousOdds: prev,
      isStale: false // Data is fresh (<24 hours)
    };

  } catch (e) {
    console.error('Error checking significant changes:', e);
    return { hasChange: false, changePercentage: 0, previousOdds: 0, isStale: true };
  }
}

/**
 * Create a Polymarket update record
 */
export function createPolymarketUpdate(
  marketType: PolymarketMarketType,
  previousOdds: number,
  currentOdds: number,
  triggeredByNewsId?: string
): PolymarketUpdate {
  const changePercentage = Math.abs(currentOdds - previousOdds) * 100;

  return {
    id: `${marketType}_${Date.now()}`,
    marketType,
    previousOdds,
    currentOdds,
    changePercentage,
    triggeredByNewsId,
    timestamp: new Date().toISOString(),
  };
}
