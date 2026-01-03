/**
 * Correlated Pairs Handler
 * Get available correlated pairs for an instrument
 */
import { getAvailableCorrelatedPairs, checkAssetClassMatch } from '../../../services/anti-lag-detector.js';
export async function handleCorrelatedPairs(c) {
    const symbol = c.req.query('symbol');
    if (!symbol) {
        return c.json({ error: 'symbol query parameter required' }, 400);
    }
    try {
        const availablePairs = getAvailableCorrelatedPairs(symbol);
        const warnings = [];
        // Check asset class matches for each pair
        availablePairs.forEach(pair => {
            const match = checkAssetClassMatch(symbol, pair.symbol);
            if (!match.match && match.warning) {
                warnings.push(match.warning);
            }
        });
        // Determine asset class
        const assetClass = symbol.toUpperCase().includes('GOLD') || symbol.toUpperCase().includes('SILVER')
            ? 'safe_haven'
            : 'risk';
        return c.json({
            instrument: symbol,
            assetClass,
            availablePairs,
            warnings: warnings.length > 0 ? warnings : undefined,
        });
    }
    catch (error) {
        console.error('Failed to get correlated pairs:', error);
        return c.json({ error: 'Failed to get correlated pairs' }, 500);
    }
}
//# sourceMappingURL=correlated-pairs.js.map