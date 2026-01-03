/**
 * Polymarket Service
 * Fetches prediction market odds for macroeconomic events via Gamma API
 */
export type PolymarketMarketType = 'tariffs' | 'rate_cuts' | 'rate_hikes' | 'recession' | 'bubble_crash' | 'ww3' | 'trump_impeachment' | 'supreme_court' | 'ai_regulation' | 'china_relations' | 'geopolitics' | 'mag7_stocks' | 'semiconductors';
export interface PolymarketOdds {
    marketId: string;
    marketType: PolymarketMarketType;
    question: string;
    yesOdds: number;
    noOdds: number;
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
/**
 * Fetch all Polymarket odds for tracked markets using Gamma API
 * Replaces singular fetch loops with bulk fetch + classification
 */
export declare function fetchAllPolymarketOdds(): Promise<PolymarketOdds[]>;
/**
 * Fetch single market odds (Compatibility wrapper)
 */
export declare function fetchPolymarketOdds(marketType: PolymarketMarketType): Promise<PolymarketOdds | null>;
/**
 * Check for significant odds changes (>5% threshold) using DB history
 */
export declare function checkSignificantChanges(currentOdds: PolymarketOdds): Promise<{
    hasChange: boolean;
    changePercentage: number;
    previousOdds: number;
}>;
/**
 * Create a Polymarket update record
 */
export declare function createPolymarketUpdate(marketType: PolymarketMarketType, previousOdds: number, currentOdds: number, triggeredByNewsId?: string): PolymarketUpdate;
//# sourceMappingURL=polymarket-service.d.ts.map