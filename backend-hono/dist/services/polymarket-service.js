/**
 * Polymarket Service
 * Fetches prediction market odds for macroeconomic events via Gamma API
 */
import { sql } from '../db/index.js';
// Gamma API URL (Better for discovery)
const GAMMA_API_URL = 'https://gamma-api.polymarket.com';
// Mapping topics to search keywords for better API discovery
const TOPIC_KEYWORDS = {
    'tariffs': ['Tariff', 'Trade War', 'Trump Tariff'],
    'rate_cuts': ['Rate Cut', 'Fed Cut', 'FOMC'],
    'rate_hikes': ['Rate Hike', 'Fed Hike', 'Interest Rate'],
    'recession': ['Recession', 'US Recession', 'Hard Landing'],
    'bubble_crash': ['Market Crash', 'Bubble', 'S&P 500 Crash'],
    'ww3': ['World War 3', 'WW3', 'Nuclear'],
    'trump_impeachment': ['Impeachment', 'Trump Impeach'],
    'supreme_court': ['Supreme Court', 'SCOTUS'],
    'ai_regulation': ['AI', 'Artificial Intelligence', 'AGI', 'OpenAI'],
    'china_relations': ['China', 'Taiwan', 'US-China'],
    'geopolitics': ['Geopolitics', 'War', 'Conflict', 'Middle East'],
    'mag7_stocks': ['NVIDIA', 'NVDA', 'Apple', 'AAPL', 'Microsoft', 'MSFT', 'Amazon', 'AMZN', 'Google', 'GOOGL', 'Meta', 'Tesla', 'TSLA'],
    'semiconductors': ['AMD', 'TSM', 'SMCI', 'Broadcom', 'AVGO'],
};
/**
 * Save snapshot to database
 */
async function saveMarketSnapshot(odds) {
    try {
        await sql `
            INSERT INTO polymarket_odds (market_id, market_type, yes_odds, no_odds, timestamp)
            VALUES (${odds.marketId}, ${odds.marketType}, ${odds.yesOdds}, ${odds.noOdds}, NOW())
            ON CONFLICT (market_id, timestamp) DO NOTHING
        `;
    }
    catch (e) {
        console.error('Failed to save polymarket snapshot:', e);
    }
}
/**
 * Fetch all active events from Gamma API
 */
async function fetchGammaEvents() {
    try {
        // Fetch top 50 active events sorted by volume
        const response = await fetch(`${GAMMA_API_URL}/events?closed=false&limit=50&sort=volume`);
        if (!response.ok)
            throw new Error(`Gamma API Error: ${response.status}`);
        const data = await response.json();
        return Array.isArray(data) ? data : [];
    }
    catch (e) {
        console.error('Failed to fetch Gamma events:', e);
        return [];
    }
}
/**
 * Fetch all Polymarket odds for tracked markets using Gamma API
 * Replaces singular fetch loops with bulk fetch + classification
 */
export async function fetchAllPolymarketOdds() {
    try {
        const events = await fetchGammaEvents();
        const marketTypes = Object.keys(TOPIC_KEYWORDS);
        const result = [];
        // Iterate types to find best matching details
        for (const type of marketTypes) {
            const keywords = TOPIC_KEYWORDS[type];
            // Find matching event
            const match = events.find(e => {
                const text = (e.title + ' ' + e.slug + ' ' + (e.markets[0]?.question || '')).toLowerCase();
                return keywords.some(k => text.includes(k.toLowerCase()));
            });
            if (match && match.markets.length > 0) {
                // Use the first market in the event usually
                const market = match.markets[0];
                // Parse odd - Gamma API returns strings for arrays sometimes
                let outcomes = [];
                let prices = [];
                try {
                    outcomes = typeof market.outcomes === 'string' ? JSON.parse(market.outcomes) : (market.outcomes || []);
                    prices = typeof market.outcomePrices === 'string' ? JSON.parse(market.outcomePrices) : (market.outcomePrices || []);
                }
                catch (e) {
                    console.error('Failed to parse outcomes/prices:', e);
                }
                let yesIndex = outcomes.findIndex(o => o === 'Yes' || o === 'Trump' || o === 'Republicans' || o === 'Long');
                if (yesIndex === -1)
                    yesIndex = 0;
                let noIndex = yesIndex === 0 ? 1 : 0;
                let yesPrice = parseFloat(prices[yesIndex] || '0');
                let noPrice = parseFloat(prices[noIndex] || '0');
                if (isNaN(yesPrice))
                    yesPrice = 0;
                if (isNaN(noPrice))
                    noPrice = 0;
                const odds = {
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
    }
    catch (error) {
        console.error('Failed to fetch all Polymarket odds:', error);
        return [];
    }
}
/**
 * Fetch single market odds (Compatibility wrapper)
 */
export async function fetchPolymarketOdds(marketType) {
    const all = await fetchAllPolymarketOdds();
    return all.find(o => o.marketType === marketType) || null;
}
/**
 * Check for significant odds changes (>5% threshold) using DB history
 */
export async function checkSignificantChanges(currentOdds) {
    try {
        // Get snapshot from ~60 mins ago
        const rows = await sql `
            SELECT yes_odds FROM polymarket_odds
            WHERE market_id = ${currentOdds.marketId}
            AND timestamp > NOW() - INTERVAL '65 minutes'
            AND timestamp < NOW() - INTERVAL '55 minutes'
            ORDER BY timestamp DESC
            LIMIT 1
        `;
        if (rows.length === 0) {
            // Try getting the oldest record if < 60 mins exist
            const oldRows = await sql `
                SELECT yes_odds FROM polymarket_odds
                WHERE market_id = ${currentOdds.marketId}
                ORDER BY timestamp ASC
                LIMIT 1
            `;
            if (oldRows.length === 0)
                return { hasChange: false, changePercentage: 0, previousOdds: 0 };
            const prev = Number(oldRows[0].yes_odds);
            const change = Math.abs(currentOdds.yesOdds - prev);
            return { hasChange: change > 0.05, changePercentage: change * 100, previousOdds: prev };
        }
        const prev = Number(rows[0].yes_odds);
        const change = Math.abs(currentOdds.yesOdds - prev);
        return {
            hasChange: change > 0.05,
            changePercentage: change * 100,
            previousOdds: prev
        };
    }
    catch (e) {
        console.error('Error checking significant changes:', e);
        return { hasChange: false, changePercentage: 0, previousOdds: 0 };
    }
}
/**
 * Create a Polymarket update record
 */
export function createPolymarketUpdate(marketType, previousOdds, currentOdds, triggeredByNewsId) {
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
//# sourceMappingURL=polymarket-service.js.map