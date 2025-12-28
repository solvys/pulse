/**
 * Polymarket Service
 * Fetches prediction market odds for macroeconomic events
 */

export type PolymarketMarketType = 
  | 'rate_cut' 
  | 'cpi' 
  | 'nfp' 
  | 'interest_rate'
  | 'jerome_powell'
  | 'donald_trump_tariffs'
  | 'politics'
  | 'gdp'
  | 'interest_rate_futures';

export interface PolymarketOdds {
  marketId: string;
  marketType: PolymarketMarketType;
  question: string;
  yesOdds: number; // 0-1 probability
  noOdds: number; // 0-1 probability
  timestamp: string;
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

/**
 * Fetch Polymarket odds for a specific market type
 * Note: This is a placeholder implementation. Actual Polymarket API integration
 * would require API key and proper endpoint configuration.
 */
export async function fetchPolymarketOdds(
  marketType: PolymarketMarketType
): Promise<PolymarketOdds | null> {
  try {
    // TODO: Implement actual Polymarket API integration
    // For now, return null to indicate API not configured
    // When implemented, this would:
    // 1. Call Polymarket API with market type
    // 2. Parse response to get yes/no odds
    // 3. Return structured PolymarketOdds object
    
    console.warn(`Polymarket API not yet configured for ${marketType}`);
    return null;
  } catch (error) {
    console.error(`Failed to fetch Polymarket odds for ${marketType}:`, error);
    return null;
  }
}

/**
 * Fetch all Polymarket odds for tracked markets
 * Includes: CPI, NFP, Jerome Powell, Donald Trump tariffs, Politics, GDP, Interest Rate Futures
 */
export async function fetchAllPolymarketOdds(): Promise<PolymarketOdds[]> {
  const marketTypes: PolymarketMarketType[] = [
    'rate_cut',
    'cpi',
    'nfp',
    'interest_rate',
    'jerome_powell',
    'donald_trump_tariffs',
    'politics',
    'gdp',
    'interest_rate_futures',
  ];

  const oddsPromises = marketTypes.map(type => fetchPolymarketOdds(type));
  const results = await Promise.all(oddsPromises);
  
  return results.filter((odds): odds is PolymarketOdds => odds !== null);
}

/**
 * Check for significant odds changes (>5% threshold)
 * Compares current odds with previous odds from database/cache
 */
export async function checkSignificantChanges(
  currentOdds: PolymarketOdds,
  previousOdds: number | null
): Promise<{ hasChange: boolean; changePercentage: number }> {
  if (previousOdds === null) {
    return { hasChange: false, changePercentage: 0 };
  }

  const changePercentage = Math.abs(currentOdds.yesOdds - previousOdds) * 100;
  const threshold = 0.05; // 5%

  return {
    hasChange: changePercentage >= threshold,
    changePercentage,
  };
}

/**
 * Create a Polymarket update record when significant change detected
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
