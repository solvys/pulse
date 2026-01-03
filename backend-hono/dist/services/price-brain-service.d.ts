/**
 * Price Brain Layer Service
 * Agentic AI features via AI Gateway for news scoring
 */
export interface PriceBrainScore {
    sentiment: 'Bullish' | 'Bearish' | 'Neutral';
    classification: 'Cyclical' | 'Counter-cyclical' | 'Neutral';
    impliedPoints: number | null;
    instrument: string | null;
    confidence: number;
}
export interface NewsItemForScoring {
    title: string;
    content: string;
    macroLevel: 1 | 2 | 3 | 4;
    source?: string;
    symbols?: string[];
}
/**
 * Score news item using Price Brain Layer (AI Gateway)
 */
export declare function scoreNewsWithPriceBrain(newsItem: NewsItemForScoring, userInstrument?: string): Promise<PriceBrainScore>;
/**
 * Score multiple news items in batch
 */
export declare function scoreNewsBatch(newsItems: Array<{
    id: string;
    title: string;
    content: string;
    macroLevel?: 1 | 2 | 3 | 4;
    source?: string;
    symbols?: string[];
}>, userInstrument?: string): Promise<Map<string, PriceBrainScore>>;
//# sourceMappingURL=price-brain-service.d.ts.map