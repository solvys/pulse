/**
 * News Service
 * Core service for fetching, processing, and storing financial news
 * 
 * Schema matches migration 12: news_articles table in Neon PostgreSQL
 */

import { sql } from '../db/index.js';
import { xClient, Tweet, FINANCIAL_ACCOUNTS, HIGH_PRIORITY_ACCOUNTS } from './x-client.js';
import { fetchAllPolymarketOdds, checkSignificantChanges, PolymarketOdds, MARKET_MACRO_LEVELS } from './polymarket-service.js';
import { fetchGeneralNews, FMPArticle } from './fmp-service.js';
import { analyzeArticleWithPriceBrain, type ArticleInput, type PriceBrainAnalysis } from './price-brain-service.js';
import { logger } from '../middleware/logger.js';

export type NewsCategory = 'Odds Shifts' | 'Macro' | 'Commentary';

export interface NewsArticle {
    id: string;
    title: string;
    summary: string | null;
    content: string | null;
    source: string;
    url: string;
    publishedAt: string;
    sentiment: number | null;
    ivImpact: number | null;
    symbols: string[];
    isBreaking: boolean;
    macroLevel: number | null;
    priceBrainSentiment: string | null;
    priceBrainClassification: string | null;
    impliedPoints: number | null;
    instrument: string | null;
    authorHandle: string | null;
    category: NewsCategory | null;
}

// Keywords for macro level classification (1=low, 2=medium, 3=high, 4=critical)
const MACRO_LEVEL_KEYWORDS: Record<number, string[]> = {
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
const SYMBOL_KEYWORDS: Record<string, string[]> = {
    'ES': ['s&p', 'spx', 'spy', 's&p 500', 'es futures'],
    'NQ': ['nasdaq', 'qqq', 'tech', 'nq futures'],
    'YM': ['dow', 'djia', 'dow jones'],
    'CL': ['oil', 'crude', 'wti', 'brent'],
    'GC': ['gold', 'xau'],
    'ZB': ['bonds', 'treasury', 'yields', '10-year'],
};

function classifyMacroLevel(text: string): number {
    const lowerText = text.toLowerCase();
    for (const level of [4, 3, 2] as const) {
        for (const keyword of MACRO_LEVEL_KEYWORDS[level]) {
            if (lowerText.includes(keyword)) return level;
        }
    }
    return 1;
}

function classifySentiment(text: string): { score: number; label: string } {
    const lowerText = text.toLowerCase();
    let bullishScore = 0, bearishScore = 0;

    for (const kw of SENTIMENT_KEYWORDS.bullish) if (lowerText.includes(kw)) bullishScore++;
    for (const kw of SENTIMENT_KEYWORDS.bearish) if (lowerText.includes(kw)) bearishScore++;

    if (bullishScore > bearishScore) return { score: 0.5 + (bullishScore * 0.1), label: 'Bullish' };
    if (bearishScore > bullishScore) return { score: -0.5 - (bearishScore * 0.1), label: 'Bearish' };
    return { score: 0, label: 'Neutral' };
}

function extractSymbols(text: string): string[] {
    const lowerText = text.toLowerCase();
    const symbols: string[] = [];
    for (const [symbol, keywords] of Object.entries(SYMBOL_KEYWORDS)) {
        for (const kw of keywords) {
            if (lowerText.includes(kw)) { symbols.push(symbol); break; }
        }
    }
    return symbols;
}

/**
 * Detect category for X API articles
 */
function detectCategory(text: string, authorHandle: string | null): NewsCategory {
    const lowerText = text.toLowerCase();
    const lowerAuthor = (authorHandle || '').toLowerCase();
    
    // Odds Shifts: Mentions of traders, bets, odds, polymarket, prediction markets
    if (lowerText.includes('trader') && lowerText.includes('bet') ||
        lowerText.includes('odds') && (lowerText.includes('shift') || lowerText.includes('move')) ||
        lowerText.includes('polymarket') ||
        lowerText.includes('prediction market')) {
        return 'Odds Shifts';
    }
    
    // Commentary: Mentions of officials, fed, powell, treasury, sec, cftc, etc.
    if (lowerText.includes('fed chair') || lowerText.includes('powell') || lowerText.includes('jerome') ||
        lowerText.includes('treasury') || lowerText.includes('yellen') ||
        lowerText.includes('sec') || lowerText.includes('cftc') ||
        lowerText.includes('official') || lowerText.includes('spokesperson') ||
        lowerText.includes('statement') || lowerText.includes('comment')) {
        return 'Commentary';
    }
    
    // Macro: Economic data, GDP, CPI, NFP, inflation, rates, etc.
    if (lowerText.includes('gdp') || lowerText.includes('cpi') || lowerText.includes('nfp') ||
        lowerText.includes('inflation') || lowerText.includes('unemployment') ||
        lowerText.includes('rate cut') || lowerText.includes('rate hike') ||
        lowerText.includes('fomc') || lowerText.includes('economic data')) {
        return 'Macro';
    }
    
    // Default to Commentary for official accounts, Macro for others
    if (lowerAuthor.includes('financialjuice') || lowerAuthor.includes('insiderwire') || 
        lowerAuthor.includes('zaboradar') || lowerAuthor.includes('firstsquawk')) {
        return 'Commentary';
    }
    
    return 'Macro';
}

async function tweetToArticle(tweet: Tweet): Promise<Omit<NewsArticle, 'id'>> {
    const macroLevel = classifyMacroLevel(tweet.text);
    const sentiment = classifySentiment(tweet.text);
    const symbols = extractSymbols(tweet.text);
    const tenMinutesAgo = Date.now() - 10 * 60 * 1000;
    const isBreaking = macroLevel >= 3 && tweet.createdAt.getTime() > tenMinutesAgo;
    const category = detectCategory(tweet.text, tweet.authorHandle);

    let priceBrainAnalysis: PriceBrainAnalysis | null = null;
    if (macroLevel >= 3) {
        priceBrainAnalysis = await analyzeArticleWithPriceBrain({
            title: tweet.text.substring(0, 200),
            content: tweet.text,
            summary: tweet.text.length > 200 ? tweet.text.substring(0, 300) + '...' : tweet.text,
            macroLevel,
            symbols,
            source: 'X',
        });
    }

    return {
        title: tweet.text.substring(0, 200),
        summary: tweet.text.length > 200 ? tweet.text.substring(0, 300) + '...' : tweet.text,
        content: tweet.text,
        source: 'X',
        url: tweet.url,
        publishedAt: tweet.createdAt.toISOString(),
        sentiment: Math.max(-1, Math.min(1, sentiment.score)),
        ivImpact: isBreaking ? 0.5 : 0.1,
        symbols,
        isBreaking,
        macroLevel,
        priceBrainSentiment: priceBrainAnalysis?.sentiment || sentiment.label,
        priceBrainClassification: priceBrainAnalysis?.classification || (macroLevel >= 3 ? 'Counter-cyclical' : 'Cyclical'),
        impliedPoints: priceBrainAnalysis?.impliedPoints || (isBreaking ? (sentiment.score > 0 ? 5 : -5) : null),
        instrument: priceBrainAnalysis?.instrument || null,
        authorHandle: tweet.authorHandle,
        category,
    };
}



// ... existing interfaces ...

/**
 * Startup initialization to prefetch Polymarket odds and populate feed
 * Fresh fetch on app open - only shows significant shifts within 24 hours
 */
export async function initializePolymarketFeed() {
    logger.info('Initializing Polymarket Odds Prefetch (fresh fetch on app open)...');
    try {
        const odds = await fetchAllPolymarketOdds();
        logger.info({ count: odds.length }, 'Fetched Polymarket markets for initialization');

        // Only show markets with significant shifts within 24 hours
        const articlesWithShifts: Omit<NewsArticle, 'id'>[] = [];
        
        for (const m of odds) {
            const { hasChange, changePercentage, previousOdds, isStale } = await checkSignificantChanges(m);
            
            // Skip stale data (>24 hours old) or no significant change
            if (isStale || !hasChange) {
                continue;
            }
            
            const macroLevel = MARKET_MACRO_LEVELS[m.marketType] || 2;
            
            articlesWithShifts.push({
                title: `ODDS SHIFT: ${m.question}`,
                summary: `${m.question} probability shifted by ${changePercentage.toFixed(1)}% to ${(m.yesOdds * 100).toFixed(1)}% (was ${(previousOdds * 100).toFixed(1)}%)`,
                content: `Polymarket odds shift detected. Previous: ${(previousOdds * 100).toFixed(1)}%, Current: ${(m.yesOdds * 100).toFixed(1)}%. Market: ${m.marketType}`,
            source: 'Polymarket',
            url: `https://polymarket.com/event/${m.slug}`,
            publishedAt: new Date().toISOString(),
            sentiment: m.yesOdds > 0.6 ? 0.5 : (m.yesOdds < 0.4 ? -0.5 : 0),
                ivImpact: changePercentage > 10 ? 0.9 : 0.4,
            symbols: ['MACRO'],
                isBreaking: changePercentage > 10,
                macroLevel,
            priceBrainSentiment: 'Neutral',
                priceBrainClassification: 'Counter-cyclical',
            impliedPoints: null,
            instrument: null,
                authorHandle: 'Polymarket',
                category: 'Odds Shifts'
            });
        }

        if (articlesWithShifts.length > 0) {
            await storeArticles(articlesWithShifts);
            logger.info({ count: articlesWithShifts.length }, 'Stored Polymarket odds shifts (fresh fetch)');
        } else {
            logger.info('No significant Polymarket shifts within 24 hours');
        }

    } catch (e) {
        logger.error({ error: e }, 'Failed to prefetch Polymarket odds');
    }
}

/**
 * Helper to store articles in the database
 * Returns array of stored article URLs for Price Brain analysis
 */
async function storeArticles(articles: Omit<NewsArticle, 'id'>[]): Promise<{ stored: number; storedUrls: string[] }> {
    let stored = 0;
    const storedUrls: string[] = [];
    
    for (const article of articles) {
        try {
            await sql`
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
            storedUrls.push(article.url);
        } catch (err) {
            if (!(err instanceof Error) || !err.message.includes('duplicate')) {
                logger.warn({ err, articleTitle: article.title }, 'Failed to store article');
            }
        }
    }
    return { stored, storedUrls };
}

/**
 * Update article with Price Brain analysis results
 */
async function updateArticleWithPriceBrain(
    url: string,
    analysis: { sentiment: string; classification: string; impliedPoints: number | null; instrument: string | null }
): Promise<void> {
    try {
        await sql`
            UPDATE news_articles
            SET 
                price_brain_sentiment = ${analysis.sentiment},
                price_brain_classification = ${analysis.classification},
                implied_points = ${analysis.impliedPoints},
                instrument = ${analysis.instrument},
                updated_at = NOW()
            WHERE url = ${url}
        `;
        logger.debug({ url, sentiment: analysis.sentiment }, 'Updated article with Price Brain analysis');
    } catch (err) {
        logger.error({ err, url }, 'Failed to update article with Price Brain analysis');
    }
}

/**
 * Prefetch Level 3-4 news items from high-priority accounts
 * Fetches the last 15 items from @financialjuice and @insiderwire, filtered to Level 3-4 only
 */
export async function prefetchHighPriorityNews(): Promise<{ fetched: number; stored: number }> {
    try {
        logger.info({ accounts: HIGH_PRIORITY_ACCOUNTS }, 'Starting high-priority news prefetch');
        
        let allTweets: Tweet[] = [];
        
        // Fetch from high-priority accounts
        // STRICT: Abort immediately on any authentication error
        for (const account of HIGH_PRIORITY_ACCOUNTS) {
            try {
                // Fetch 15 tweets per account to ensure we get enough Level 3-4 items
                const tweets = await xClient.fetchAccountTweets(account, 15);
                allTweets.push(...tweets);
                logger.debug({ account, count: tweets.length }, 'Fetched tweets from high-priority account');
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                const errorStack = error instanceof Error ? error.stack : undefined;
                const errorLower = errorMessage.toLowerCase();
                
                // Strict authentication error detection - case-insensitive with precise patterns
                // Check status code first (most reliable), then use word boundaries to avoid false positives
                const hasAuthStatusCode = (error as any)?.statusCode === 401 || (error as any)?.statusCode === 403;
                
                const isAuthError = 
                    hasAuthStatusCode ||
                    // Status codes with word boundaries to avoid false positives (e.g., "14031" won't match)
                    /\b401\b/.test(errorMessage) || 
                    /\b403\b/.test(errorMessage) ||
                    // Case-insensitive auth-related keywords
                    errorLower.includes('authentication') ||
                    errorLower.includes('unauthorized') ||
                    errorLower.includes('forbidden') ||
                    errorLower.includes('invalid_token') ||
                    (errorLower.includes('token') && (errorLower.includes('invalid') || errorLower.includes('expired') || errorLower.includes('missing'))) ||
                    errorLower.includes('x_bearer_token') ||
                    errorLower.includes('bearer token') ||
                    errorLower.includes('not configured') ||
                    errorLower.includes('credentials') ||
                    errorLower.includes('authorization');
                
                if (isAuthError) {
                    logger.error({ 
                        error: errorMessage,
                        errorStack,
                        account,
                        statusCode: (error as any)?.statusCode,
                        errorData: (error as any)?.errorData,
                        hint: 'X_BEARER_TOKEN authentication failed. Verify token is set correctly in Fly.io secrets and has proper permissions.'
                    }, 'X API authentication failed - ABORTING prefetch');
                    
                    // STRICT: Immediately abort prefetch on auth error - don't try other accounts
                    throw error;
                } else {
                    logger.error({ 
                        error: errorMessage,
                        errorStack,
                        account
                    }, 'Failed to fetch from high-priority account (non-auth error - continuing)');
                    // Continue with other accounts on non-auth errors
                }
            }
        }
        
        if (allTweets.length === 0) {
            logger.warn('No tweets fetched from high-priority accounts');
            return { fetched: 0, stored: 0 };
        }
        
        // Convert to articles and filter for Level 3-4 only
        const articlePromises = allTweets.map(tweetToArticle);
        const allArticles = await Promise.all(articlePromises);
        const articles = allArticles.filter(article => (article.macroLevel || 0) >= 3);
        
        logger.info({ 
            totalTweets: allTweets.length, 
            level3_4Articles: articles.length 
        }, 'High-priority prefetch filtered to Level 3-4');
        
        if (articles.length === 0) {
            logger.info('No Level 3-4 articles found in high-priority prefetch');
            return { fetched: allTweets.length, stored: 0 };
        }
        
        // Store articles
        const { stored } = await storeArticles(articles);
        
        // Analyze with Price Brain Layer (all are Level 3-4)
        for (const article of articles) {
            try {
                const analysis = await analyzeArticleWithPriceBrain({
                    title: article.title,
                    content: article.content || article.summary || '',
                    summary: article.summary,
                    macroLevel: article.macroLevel || 0,
                    symbols: article.symbols || [],
                    source: article.source,
                });

                if (analysis) {
                    await updateArticleWithPriceBrain(article.url, {
                        sentiment: analysis.sentiment,
                        classification: analysis.classification,
                        impliedPoints: analysis.impliedPoints,
                        instrument: analysis.instrument || null,
                    });
                }
            } catch (error) {
                logger.error({ 
                    error, 
                    articleTitle: article.title.substring(0, 50) 
                }, 'Price Brain analysis failed for prefetched article');
            }
        }
        
        logger.info({ 
            fetched: allTweets.length, 
            stored,
            level3_4Count: articles.length 
        }, 'High-priority news prefetch complete');
        
        return { fetched: allTweets.length, stored };
    } catch (error) {
        logger.error({ error }, 'High-priority news prefetch failed');
        return { fetched: 0, stored: 0 };
    }
}

/**
 * Fetch fresh news from multiple sources and store in database
 * Priority:
 * 1. Official X API (Speed + Reliability)
 * 2. Polymarket Signals (Macro/Sentiment)
 * 3. FMP News (Tertiary Fallback)
 */
export async function fetchAndStoreNews(limit: number = 15): Promise<{ fetched: number; stored: number }> {
    try {
        let articles: Omit<NewsArticle, 'id'>[] = [];

        // 1. Fetch X API (Primary)
        try {
            const xTweets = await xClient.fetchAllFinancialNews(Math.ceil(limit / FINANCIAL_ACCOUNTS.length));
            if (xTweets.length > 0) {
                // Convert all tweets to articles - no filtering by macro level
                // Price Brain Layer will analyze Level 3-4 articles separately
                const xArticles = await Promise.all(xTweets.map(tweetToArticle));
                articles.push(...xArticles);
                logger.info({ count: xArticles.length }, 'Fetched X API articles');
            } else {
                logger.warn('No tweets returned from X API - check X_BEARER_TOKEN and rate limits');
            }
        } catch (e) {
            const errorMessage = e instanceof Error ? e.message : String(e);
            const isAuthError = errorMessage.includes('401') || errorMessage.includes('403') || errorMessage.includes('Authentication');
            
            if (isAuthError) {
                logger.error({ 
                    error: errorMessage,
                    hint: 'X_BEARER_TOKEN may be invalid or expired. Check Fly.io secrets.'
                }, 'X API authentication failed');
            } else {
                logger.error({ 
                    error: errorMessage,
                    stack: e instanceof Error ? e.stack : undefined
                }, 'X Source failed');
            }
            // Continue with other sources even if X API fails
        }

        // 2. Fetch Polymarket Signals (Secondary) - Only significant shifts within 24 hours
        try {
            const polyOdds = await fetchAllPolymarketOdds();
            for (const odds of polyOdds) {
                const { hasChange, changePercentage, previousOdds, isStale } = await checkSignificantChanges(odds);
                
                // Skip stale data (>24 hours old) or no significant change
                if (isStale || !hasChange) {
                    continue;
                }
                
                const macroLevel = MARKET_MACRO_LEVELS[odds.marketType] || 2;
                
                    // Create a specialized news article for the signal
                    const signalArticle: Omit<NewsArticle, 'id'> = {
                    title: `ODDS SHIFT: ${odds.question}`,
                    summary: `${odds.question} probability shifted by ${changePercentage.toFixed(1)}% to ${(odds.yesOdds * 100).toFixed(1)}% (was ${(previousOdds * 100).toFixed(1)}%)`,
                        content: `Polymarket crowd sentiment shift. Previous: ${(previousOdds * 100).toFixed(1)}%, Current: ${(odds.yesOdds * 100).toFixed(1)}%. Market: ${odds.marketType}`,
                        source: 'Polymarket',
                        url: `https://polymarket.com/event/${odds.slug}`,
                        publishedAt: new Date().toISOString(),
                    sentiment: odds.yesOdds > 0.6 ? 0.8 : (odds.yesOdds < 0.4 ? -0.8 : 0),
                        ivImpact: changePercentage > 10 ? 0.9 : 0.4,
                        symbols: ['MACRO'],
                        isBreaking: changePercentage > 10,
                    macroLevel,
                    priceBrainSentiment: odds.yesOdds > 0.5 ? 'Bullish' : 'Bearish',
                        priceBrainClassification: 'Counter-cyclical',
                        impliedPoints: null,
                        instrument: null,
                    authorHandle: 'Polymarket',
                    category: 'Odds Shifts'
                    };
                    articles.push(signalArticle);
            }
        } catch (e) {
            logger.error({ error: e }, 'Polymarket fetch failed');
        }

        // 3. Fetch FMP (Tertiary) if we need more volume
        if (articles.length < limit) {
            try {
                const fmpNews = await fetchGeneralNews(limit - articles.length);
                const fmpArticles = fmpNews.map((n: FMPArticle) => ({
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
                    authorHandle: n.site,
                    category: 'Macro' as NewsCategory
                }));
                articles.push(...fmpArticles);
            } catch (e) {
                console.error('FMP fetch failed:', e);
            }
        }

        const { stored, storedUrls } = await storeArticles(articles);
        
        // Analyze Level 3-4 articles with Price Brain Layer
        const highImpactArticles = articles.filter(a => (a.macroLevel || 0) >= 3);
        
        if (highImpactArticles.length > 0) {
            logger.info({ count: highImpactArticles.length }, 'Analyzing high-impact articles with Price Brain');
            
            // Process Price Brain analysis for Level 3-4 articles
            for (const article of highImpactArticles) {
                try {
                    const analysis = await analyzeArticleWithPriceBrain({
                        title: article.title,
                        content: article.content || article.summary || '',
                        summary: article.summary,
                        macroLevel: article.macroLevel || 0,
                        symbols: article.symbols || [],
                        source: article.source,
                    });

                    if (analysis) {
                        // Update the article in database with Price Brain results
                        await updateArticleWithPriceBrain(article.url, {
                            sentiment: analysis.sentiment,
                            classification: analysis.classification,
                            impliedPoints: analysis.impliedPoints,
                            instrument: analysis.instrument || null,
                        });
                    }
                } catch (error) {
                    logger.error({ 
                        error, 
                        articleTitle: article.title.substring(0, 50) 
                    }, 'Price Brain analysis failed for article');
                    // Continue processing other articles even if one fails
                }
            }
        }

        return { fetched: articles.length, stored };
    } catch (error) {
        logger.error({ error }, 'Failed to fetch news');
        return { fetched: 0, stored: 0 };
    }
}

/**
 * Get news feed from database
 */
export async function getNewsFeed(options: {
    symbol?: string;
    limit?: number;
    offset?: number;
}): Promise<{ articles: NewsArticle[]; total: number }> {
    const { symbol, limit = 15, offset = 0 } = options;

    try {
        let articles;
        if (symbol) {
            articles = await sql`
        SELECT * FROM news_articles
        WHERE ${symbol} = ANY(symbols) OR symbols = '{}'
        ORDER BY published_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
        } else {
            articles = await sql`
        SELECT * FROM news_articles
        ORDER BY published_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
        }

        const [countResult] = await sql`SELECT COUNT(*)::integer as count FROM news_articles`;

        return {
            articles: articles.map((row: any) => ({
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
    } catch (error) {
        console.error('Failed to get news feed:', error);
        return { articles: [], total: 0 };
    }
}

/**
 * Get breaking news for autopilot pause decisions
 */
export async function getBreakingNews(options: {
    symbol?: string;
    minutesBack?: number;
}): Promise<{ hasBreaking: boolean; articles: NewsArticle[]; pauseUntil: string | null }> {
    const { symbol, minutesBack = 10 } = options;
    const cutoff = new Date(Date.now() - minutesBack * 60 * 1000);

    try {
        const articles = await sql`
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
            articles: articles.map((row: any) => ({
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
    } catch (error) {
        console.error('Failed to get breaking news:', error);
        return { hasBreaking: false, articles: [], pauseUntil: null };
    }
}

