/**
 * News Service
 * Core service for fetching, processing, and storing financial news
 *
 * Schema matches migration 12: news_articles table in Neon PostgreSQL
 */
import { sql } from '../db/index.js';
import { xClient, FINANCIAL_ACCOUNTS } from './x-client.js';
import { fetchAllPolymarketOdds, checkSignificantChanges } from './polymarket-service.js';
import { fetchGeneralNews } from './fmp-service.js';
// Keywords for macro level classification (1=low, 2=medium, 3=high, 4=critical)
const MACRO_LEVEL_KEYWORDS = {
    4: ['fed', 'fomc', 'powell', 'rate decision', 'rate cut', 'rate hike', 'cpi', 'inflation', 'nfp', 'jobs report', 'gdp'],
    3: ['earnings', 'guidance', 'revenue', 'profit', 'tariff', 'sanction', 'war', 'strike'],
    2: ['upgrade', 'downgrade', 'analyst', 'target', 'buyback', 'dividend'],
};
// Keywords for sentiment classification
const SENTIMENT_KEYWORDS = {
    bullish: ['surge', 'soar', 'rally', 'jump', 'gain', 'rise', 'beat', 'exceed', 'strong', 'bullish', 'buy', 'upgrade', 'record high'],
    bearish: ['plunge', 'crash', 'drop', 'fall', 'sink', 'miss', 'weak', 'bearish', 'sell', 'downgrade', 'cut', 'warning', 'concern'],
};
// Symbol mapping for common terms
const SYMBOL_KEYWORDS = {
    'ES': ['s&p', 'spx', 'spy', 's&p 500', 'es futures'],
    'NQ': ['nasdaq', 'qqq', 'tech', 'nq futures'],
    'YM': ['dow', 'djia', 'dow jones'],
    'CL': ['oil', 'crude', 'wti', 'brent'],
    'GC': ['gold', 'xau'],
    'ZB': ['bonds', 'treasury', 'yields', '10-year'],
};
function classifyMacroLevel(text) {
    const lowerText = text.toLowerCase();
    for (const level of [4, 3, 2]) {
        for (const keyword of MACRO_LEVEL_KEYWORDS[level]) {
            if (lowerText.includes(keyword))
                return level;
        }
    }
    return 1;
}
function classifySentiment(text) {
    const lowerText = text.toLowerCase();
    let bullishScore = 0, bearishScore = 0;
    for (const kw of SENTIMENT_KEYWORDS.bullish)
        if (lowerText.includes(kw))
            bullishScore++;
    for (const kw of SENTIMENT_KEYWORDS.bearish)
        if (lowerText.includes(kw))
            bearishScore++;
    if (bullishScore > bearishScore)
        return { score: 0.5 + (bullishScore * 0.1), label: 'Bullish' };
    if (bearishScore > bullishScore)
        return { score: -0.5 - (bearishScore * 0.1), label: 'Bearish' };
    return { score: 0, label: 'Neutral' };
}
function extractSymbols(text) {
    const lowerText = text.toLowerCase();
    const symbols = [];
    for (const [symbol, keywords] of Object.entries(SYMBOL_KEYWORDS)) {
        for (const kw of keywords) {
            if (lowerText.includes(kw)) {
                symbols.push(symbol);
                break;
            }
        }
    }
    return symbols;
}
function tweetToArticle(tweet) {
    const macroLevel = classifyMacroLevel(tweet.text);
    const sentiment = classifySentiment(tweet.text);
    const symbols = extractSymbols(tweet.text);
    const tenMinutesAgo = Date.now() - 10 * 60 * 1000;
    const isBreaking = macroLevel >= 3 && tweet.createdAt.getTime() > tenMinutesAgo;
    return {
        title: tweet.text.substring(0, 200),
        summary: tweet.text.length > 200 ? tweet.text.substring(0, 300) + '...' : tweet.text,
        content: tweet.text,
        source: 'Twitter',
        url: tweet.url,
        publishedAt: tweet.createdAt.toISOString(),
        sentiment: Math.max(-1, Math.min(1, sentiment.score)),
        ivImpact: isBreaking ? 0.5 : 0.1,
        symbols,
        isBreaking,
        macroLevel,
        priceBrainSentiment: sentiment.label,
        priceBrainClassification: macroLevel >= 3 ? 'Counter-cyclical' : 'Cyclical',
        impliedPoints: isBreaking ? (sentiment.score > 0 ? 5 : -5) : null,
        instrument: null,
        authorHandle: tweet.authorHandle,
    };
}
// ... existing interfaces ...
/**
 * Startup initialization to prefetch Polymarket odds and populate feed
 * Generates 5-10 initial "odds" notifications as requested
 */
export async function initializePolymarketFeed() {
    console.log('Initializing Polymarket Odds Prefetch...');
    try {
        const odds = await fetchAllPolymarketOdds();
        console.log(`Fetched ${odds.length} Polymarket markets for initialization.`);
        // Take top 10 markets to populate the feed immediately
        const initialArticles = odds.slice(0, 10).map(m => ({
            title: `PREDICTION ODDS SNAPSHOT: ${m.question}`,
            summary: `Current Market Odds: Yes ${(m.yesOdds * 100).toFixed(1)}% | No ${(m.noOdds * 100).toFixed(1)}%`,
            content: `Initial market snapshot for ${m.marketType}. Link: https://polymarket.com/event/${m.slug}`,
            source: 'Polymarket',
            url: `https://polymarket.com/event/${m.slug}`,
            publishedAt: new Date().toISOString(),
            sentiment: m.yesOdds > 0.6 ? 0.5 : (m.yesOdds < 0.4 ? -0.5 : 0),
            ivImpact: 0.1,
            symbols: ['MACRO'],
            isBreaking: false,
            macroLevel: 2,
            priceBrainSentiment: 'Neutral',
            priceBrainClassification: 'Cyclical',
            impliedPoints: null,
            instrument: null,
            authorHandle: 'Polymarket'
        }));
        await storeArticles(initialArticles);
        console.log(`Stored ${initialArticles.length} initial Polymarket items.`);
    }
    catch (e) {
        console.error('Failed to prefetch Polymarket odds:', e);
    }
}
/**
 * Helper to store articles in the database
 */
async function storeArticles(articles) {
    let stored = 0;
    for (const article of articles) {
        try {
            await sql `
      INSERT INTO news_articles (
        title, summary, content, source, url, published_at,
        sentiment, iv_impact, symbols, is_breaking, macro_level,
        price_brain_sentiment, price_brain_classification, implied_points,
        instrument, author_handle
      ) VALUES (
        ${article.title}, ${article.summary}, ${article.content}, ${article.source},
        ${article.url}, ${article.publishedAt}::timestamptz,
        ${article.sentiment}, ${article.ivImpact}, ${article.symbols},
        ${article.isBreaking}, ${article.macroLevel},
        ${article.priceBrainSentiment}, ${article.priceBrainClassification},
        ${article.impliedPoints}, ${article.instrument}, ${article.authorHandle}
      )
      ON CONFLICT (url) DO UPDATE SET
        is_breaking = EXCLUDED.is_breaking,
        updated_at = NOW()
    `;
            stored++;
        }
        catch (err) {
            if (!(err instanceof Error) || !err.message.includes('duplicate')) {
                console.warn('Failed to store article:', err);
            }
        }
    }
    return stored;
}
/**
 * Fetch fresh news from multiple sources and store in database
 * Priority:
 * 1. Official X API (Speed + Reliability)
 * 2. Polymarket Signals (Macro/Sentiment)
 * 3. FMP News (Tertiary Fallback)
 */
export async function fetchAndStoreNews(limit = 15) {
    try {
        let articles = [];
        // 1. Fetch X API (Primary)
        try {
            const xTweets = await xClient.fetchAllFinancialNews(Math.ceil(limit / FINANCIAL_ACCOUNTS.length));
            if (xTweets.length > 0) {
                // Filter X API news: Only Level 3 (high) or Level 4 (critical) 
                // This is a temporary measure due to the free plan limits.
                const filteredArticles = xTweets
                    .map(tweetToArticle)
                    .filter(article => (article.macroLevel || 0) >= 3);
                articles.push(...filteredArticles);
            }
        }
        catch (e) {
            console.error('X Source failed:', e);
        }
        // 2. Fetch Polymarket Signals (Secondary)
        try {
            const polyOdds = await fetchAllPolymarketOdds();
            for (const odds of polyOdds) {
                const { hasChange, changePercentage, previousOdds } = await checkSignificantChanges(odds);
                if (hasChange) {
                    // Create a specialized news article for the signal
                    const signalArticle = {
                        title: `ODDS ALERT: ${odds.question}`,
                        summary: `${odds.question} probability shifted by ${changePercentage.toFixed(1)}% to ${(odds.yesOdds * 100).toFixed(1)}%.`,
                        content: `Polymarket crowd sentiment shift. Previous: ${(previousOdds * 100).toFixed(1)}%, Current: ${(odds.yesOdds * 100).toFixed(1)}%. Market: ${odds.marketType}`,
                        source: 'Polymarket',
                        url: `https://polymarket.com/event/${odds.slug}`,
                        publishedAt: new Date().toISOString(),
                        sentiment: odds.yesOdds > 0.6 ? 0.8 : (odds.yesOdds < 0.4 ? -0.8 : 0), // Simple heuristic
                        ivImpact: changePercentage > 10 ? 0.9 : 0.4,
                        symbols: ['MACRO'],
                        isBreaking: changePercentage > 10,
                        macroLevel: changePercentage > 10 ? 4 : 3,
                        priceBrainSentiment: odds.yesOdds > 0.5 ? 'Bullish' : 'Bearish', // Context dependent really
                        priceBrainClassification: 'Counter-cyclical',
                        impliedPoints: null,
                        instrument: null,
                        authorHandle: 'Polymarket'
                    };
                    articles.push(signalArticle);
                }
            }
        }
        catch (e) {
            console.error('Polymarket fetch failed:', e);
        }
        // 3. Fetch FMP (Tertiary) if we need more volume
        if (articles.length < limit) {
            try {
                const fmpNews = await fetchGeneralNews(limit - articles.length);
                const fmpArticles = fmpNews.map((n) => ({
                    title: n.title,
                    summary: n.text ? n.text.substring(0, 300) + '...' : n.title,
                    content: n.text,
                    source: 'FMP',
                    url: n.url,
                    publishedAt: n.publishedDate,
                    sentiment: 0,
                    ivImpact: 0.1,
                    symbols: [n.symbol],
                    isBreaking: false,
                    macroLevel: 1,
                    priceBrainSentiment: 'Neutral',
                    priceBrainClassification: 'Cyclical',
                    impliedPoints: null,
                    instrument: null,
                    authorHandle: n.site
                }));
                articles.push(...fmpArticles);
            }
            catch (e) {
                console.error('FMP fetch failed:', e);
            }
        }
        const stored = await storeArticles(articles);
        return { fetched: articles.length, stored };
    }
    catch (error) {
        console.error('Failed to fetch news:', error);
        return { fetched: 0, stored: 0 };
    }
}
/**
 * Get news feed from database
 */
export async function getNewsFeed(options) {
    const { symbol, limit = 15, offset = 0 } = options;
    try {
        let articles;
        if (symbol) {
            articles = await sql `
        SELECT * FROM news_articles
        WHERE ${symbol} = ANY(symbols) OR symbols = '{}'
        ORDER BY published_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
        }
        else {
            articles = await sql `
        SELECT * FROM news_articles
        ORDER BY published_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
        }
        const [countResult] = await sql `SELECT COUNT(*)::integer as count FROM news_articles`;
        return {
            articles: articles.map((row) => ({
                id: row.id,
                title: row.title,
                summary: row.summary,
                content: row.content,
                source: row.source,
                url: row.url,
                publishedAt: row.published_at?.toISOString() || new Date().toISOString(),
                sentiment: row.sentiment,
                ivImpact: row.iv_impact,
                symbols: row.symbols || [],
                isBreaking: row.is_breaking,
                macroLevel: row.macro_level,
                priceBrainSentiment: row.price_brain_sentiment,
                priceBrainClassification: row.price_brain_classification,
                impliedPoints: row.implied_points,
                instrument: row.instrument,
                authorHandle: row.author_handle,
            })),
            total: countResult?.count || 0,
        };
    }
    catch (error) {
        console.error('Failed to get news feed:', error);
        return { articles: [], total: 0 };
    }
}
/**
 * Get breaking news for autopilot pause decisions
 */
export async function getBreakingNews(options) {
    const { symbol, minutesBack = 10 } = options;
    const cutoff = new Date(Date.now() - minutesBack * 60 * 1000);
    try {
        const articles = await sql `
      SELECT * FROM news_articles
      WHERE is_breaking = true AND published_at > ${cutoff.toISOString()}::timestamptz
      ORDER BY published_at DESC LIMIT 10
    `;
        const hasBreaking = articles.length > 0;
        const pauseUntil = hasBreaking && articles[0]
            ? new Date(new Date(articles[0].published_at).getTime() + 10 * 60 * 1000).toISOString()
            : null;
        return {
            hasBreaking,
            articles: articles.map((row) => ({
                id: row.id,
                title: row.title,
                summary: row.summary,
                content: row.content,
                source: row.source,
                url: row.url,
                publishedAt: row.published_at?.toISOString(),
                sentiment: row.sentiment,
                ivImpact: row.iv_impact,
                symbols: row.symbols || [],
                isBreaking: row.is_breaking,
                macroLevel: row.macro_level,
                priceBrainSentiment: row.price_brain_sentiment,
                priceBrainClassification: row.price_brain_classification,
                impliedPoints: row.implied_points,
                instrument: row.instrument,
                authorHandle: row.author_handle,
            })),
            pauseUntil,
        };
    }
    catch (error) {
        console.error('Failed to get breaking news:', error);
        return { hasBreaking: false, articles: [], pauseUntil: null };
    }
}
//# sourceMappingURL=news-service.js.map