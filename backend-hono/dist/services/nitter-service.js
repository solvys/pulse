/**
 * Nitter Service
 * Scrapes news from Nitter (Twitter alternative) sources
 */
/**
 * Default Nitter sources to follow
 * Updated with specified accounts for macroeconomic data tracking
 */
export const DEFAULT_NITTER_SOURCES = [
    { handle: 'FinancialJuice', name: 'Financial Juice', category: 'financial', priority: 10 },
    { handle: 'RealDonaldTrump', name: 'Donald Trump', category: 'politics', priority: 9 },
    { handle: 'SecScottBessent', name: 'Scott Bessent', category: 'financial', priority: 9 },
    { handle: 'Deitaone', name: 'Deitaone', category: 'general', priority: 8 },
    { handle: 'OSINTDefender', name: 'OSINT Defender', category: 'general', priority: 8 },
    { handle: 'TrendSpider', name: 'TrendSpider', category: 'financial', priority: 7 },
];
/**
 * Scrape tweets from a Nitter source
 */
async function scrapeNitterSource(sourceHandle, limit = 10) {
    try {
        // Use a Nitter instance (user will configure this)
        const nitterBaseUrl = process.env.NITTER_BASE_URL || 'https://nitter.net';
        const url = `${nitterBaseUrl}/${sourceHandle}`;
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            },
        });
        if (!response.ok) {
            throw new Error(`Nitter request failed: ${response.status}`);
        }
        const html = await response.text();
        // Parse the HTML to extract tweets
        // This is a simplified parser - would need proper HTML parsing in production
        const tweets = [];
        // Extract tweet data from HTML (simplified)
        // In production, this would use cheerio or similar to parse properly
        const tweetMatches = html.match(/class="tweet-content[^"]*"[^>]*>([^<]*)</g);
        if (tweetMatches) {
            for (let i = 0; i < Math.min(tweetMatches.length, limit); i++) {
                const content = tweetMatches[i].replace(/class="tweet-content[^"]*"[^>]*>/, '').replace(/</, '');
                if (content && content.length > 20) { // Filter out very short content
                    // Check if this is macroeconomic data
                    const macroCheck = isMacroEconomicData(content);
                    // Only include items that match macro criteria
                    if (!macroCheck.isMacro) {
                        continue;
                    }
                    // Check for emoji classification (Level 4)
                    const emojiLevel = classifyEmojiLevel(content);
                    const finalLevel = emojiLevel || macroCheck.level;
                    const tweet = {
                        id: `${sourceHandle}_${Date.now()}_${i}`,
                        title: content.substring(0, 100) + (content.length > 100 ? '...' : ''),
                        content,
                        author: sourceHandle,
                        authorHandle: sourceHandle,
                        url: `${nitterBaseUrl}/${sourceHandle}/status/12345`, // Placeholder URL
                        timestamp: new Date().toISOString(),
                        likes: Math.floor(Math.random() * 1000), // Placeholder
                        retweets: Math.floor(Math.random() * 500), // Placeholder
                        replies: Math.floor(Math.random() * 200), // Placeholder
                        source: sourceHandle,
                        symbols: extractSymbols(content),
                        sentiment: analyzeSentiment(content),
                        macroLevel: finalLevel,
                    };
                    tweets.push(tweet);
                }
            }
        }
        return tweets;
    }
    catch (error) {
        console.error(`Failed to scrape Nitter source ${sourceHandle}:`, error);
        return [];
    }
}
/**
 * Extract stock symbols from content
 */
function extractSymbols(content) {
    const symbolRegex = /\$([A-Z]{1,5})/g;
    const matches = content.match(symbolRegex) || [];
    return matches.map(match => match.substring(1));
}
/**
 * Determine macroeconomic data level (1, 2, 3, or 4)
 * Level 4 is highest (emoji indicators), Level 1 is lowest (contextual)
 */
export function isMacroEconomicData(content) {
    const lowerContent = content.toLowerCase();
    // Level 4: Emoji indicators (highest priority)
    const level4Emojis = ['🔴', '⚠️', '[🔴⚠️]'];
    const hasLevel4Emoji = level4Emojis.some(emoji => content.includes(emoji));
    if (hasLevel4Emoji) {
        return { isMacro: true, level: 4 };
    }
    // Level 3: High importance macroeconomic events
    const level3Keywords = [
        'interest rate', 'rate decision', 'fomc', 'federal reserve', 'fed meeting',
        'cpi', 'consumer price index', 'inflation report',
        'nfp', 'non-farm payroll', 'jobs report',
        'pce', 'personal consumption expenditure',
        'tariff', 'china trade', 'trade war'
    ];
    const hasLevel3 = level3Keywords.some(keyword => lowerContent.includes(keyword));
    if (hasLevel3) {
        return { isMacro: true, level: 3 };
    }
    // Level 2: Moderate importance indicators
    const level2Keywords = [
        'jobless claims', 'unemployment claims',
        'retail sales',
        'manufacturing pmi', 'services pmi', 'pmi',
        'consumer confidence',
        'silver', 'gold'
    ];
    const hasLevel2 = level2Keywords.some(keyword => lowerContent.includes(keyword));
    if (hasLevel2) {
        return { isMacro: true, level: 2 };
    }
    // Level 1: Notable individual commentary or minor geopolitical
    const notableIndividuals = ['howard lutnick', 'peter navarro'];
    const highLevelKeywords = ['fed', 'powell', 'rate cut', 'inflation', 'recession', 'cpi', 'nfp', 'fomc', 'tariff', 'china'];
    const hasNotableIndividual = notableIndividuals.some(individual => lowerContent.includes(individual));
    const hasHighLevelKeyword = highLevelKeywords.some(keyword => lowerContent.includes(keyword));
    // Level 1 if notable individual mentions high-level keywords
    if (hasNotableIndividual && hasHighLevelKeyword) {
        return { isMacro: true, level: 1 };
    }
    // Level 1: Minor geopolitical occurrences
    const minorGeoKeywords = ['war', 'conflict', 'tension'];
    const hasMinorGeo = minorGeoKeywords.some(keyword => lowerContent.includes(keyword));
    if (hasMinorGeo) {
        return { isMacro: true, level: 1 };
    }
    // Market-moving commentary keywords (can be Level 1-3 depending on context)
    const marketMovingKeywords = ['fed', 'powell', 'rate cut', 'inflation', 'recession'];
    const hasMarketMoving = marketMovingKeywords.some(keyword => lowerContent.includes(keyword));
    if (hasMarketMoving) {
        return { isMacro: true, level: 1 };
    }
    return { isMacro: false, level: 1 };
}
/**
 * Deduplicate news items by content hash, URL, and title similarity
 */
const seenItems = new Map();
const DEDUP_TTL = 24 * 60 * 60 * 1000; // 24 hours
function normalizeText(text) {
    return text.toLowerCase().trim().replace(/\s+/g, ' ');
}
function createContentHash(content) {
    const normalized = normalizeText(content);
    // Simple hash function (in production, use crypto.createHash)
    let hash = 0;
    for (let i = 0; i < normalized.length; i++) {
        const char = normalized.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32bit integer
    }
    return hash.toString(36);
}
function calculateSimilarity(str1, str2) {
    const s1 = normalizeText(str1);
    const s2 = normalizeText(str2);
    const longer = s1.length > s2.length ? s1 : s2;
    const shorter = s1.length > s2.length ? s2 : s1;
    if (longer.length === 0)
        return 1.0;
    const distance = levenshteinDistance(longer, shorter);
    return (longer.length - distance) / longer.length;
}
function levenshteinDistance(str1, str2) {
    const matrix = [];
    for (let i = 0; i <= str2.length; i++) {
        matrix[i] = [i];
    }
    for (let j = 0; j <= str1.length; j++) {
        matrix[0][j] = j;
    }
    for (let i = 1; i <= str2.length; i++) {
        for (let j = 1; j <= str1.length; j++) {
            if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            }
            else {
                matrix[i][j] = Math.min(matrix[i - 1][j - 1] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j] + 1);
            }
        }
    }
    return matrix[str2.length][str1.length];
}
export function deduplicateNewsItems(items) {
    const now = Date.now();
    // Clean up old entries
    for (const [key, value] of seenItems.entries()) {
        if (now - value.timestamp > DEDUP_TTL) {
            seenItems.delete(key);
        }
    }
    const uniqueItems = [];
    for (const item of items) {
        // Check by URL first (most reliable)
        if (item.url) {
            const urlKey = `url:${item.url}`;
            if (seenItems.has(urlKey)) {
                continue;
            }
            seenItems.set(urlKey, { hash: '', timestamp: now });
        }
        // Check by content hash
        const contentHash = createContentHash(item.content || item.title);
        const hashKey = `hash:${contentHash}`;
        if (seenItems.has(hashKey)) {
            continue;
        }
        // Check by title similarity (fuzzy matching)
        let isDuplicate = false;
        for (const existingItem of uniqueItems) {
            const similarity = calculateSimilarity(item.title, existingItem.title);
            if (similarity > 0.85) { // 85% similarity threshold
                isDuplicate = true;
                break;
            }
        }
        if (!isDuplicate) {
            seenItems.set(hashKey, { hash: contentHash, timestamp: now });
            uniqueItems.push(item);
        }
    }
    return uniqueItems;
}
/**
 * Classify emoji level (Level 4 importance)
 * Items with 🔴, ⚠️, or [🔴⚠️] are classified as Level 4
 */
export function classifyEmojiLevel(content) {
    const level4Emojis = ['🔴', '⚠️', '[🔴⚠️]'];
    const hasLevel4Emoji = level4Emojis.some(emoji => content.includes(emoji));
    return hasLevel4Emoji ? 4 : null;
}
/**
 * Simple sentiment analysis
 */
function analyzeSentiment(content) {
    const lowerContent = content.toLowerCase();
    const positiveWords = ['bullish', 'buy', 'up', 'gain', 'profit', 'higher', 'rally', 'surge', 'breakout'];
    const negativeWords = ['bearish', 'sell', 'down', 'loss', 'crash', 'lower', 'drop', 'fall', 'decline'];
    const positiveCount = positiveWords.reduce((count, word) => count + (lowerContent.split(word).length - 1), 0);
    const negativeCount = negativeWords.reduce((count, word) => count + (lowerContent.split(word).length - 1), 0);
    if (positiveCount > negativeCount)
        return 'positive';
    if (negativeCount > positiveCount)
        return 'negative';
    return 'neutral';
}
/**
 * Fetch news from all configured Nitter sources
 * Applies macro filtering, deduplication, and emoji classification
 */
export async function fetchNitterNews(sources = DEFAULT_NITTER_SOURCES, limitPerSource = 5) {
    const allNews = [];
    for (const source of sources) {
        try {
            const sourceNews = await scrapeNitterSource(source.handle, limitPerSource);
            allNews.push(...sourceNews);
        }
        catch (error) {
            console.error(`Failed to fetch from ${source.handle}:`, error);
        }
        // Add small delay to be respectful to Nitter instances
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
    // Apply macro filtering - only keep items that match macro criteria
    const macroFilteredNews = allNews.map(item => {
        const content = `${item.title} ${item.content}`;
        const macroCheck = isMacroEconomicData(content);
        if (macroCheck.isMacro) {
            item.macroLevel = macroCheck.level;
            return item;
        }
        return null;
    }).filter((item) => item !== null);
    // Apply deduplication
    const deduplicatedNews = deduplicateNewsItems(macroFilteredNews);
    // Apply emoji classification (overrides macro level if Level 4)
    const classifiedNews = deduplicatedNews.map(item => {
        const content = `${item.title} ${item.content}`;
        const emojiLevel = classifyEmojiLevel(content);
        if (emojiLevel === 4) {
            item.macroLevel = 4; // Override with Level 4 if emoji detected
        }
        return item;
    });
    // Sort by macro level (4 > 3 > 2 > 1), then priority, then timestamp
    return classifiedNews.sort((a, b) => {
        const levelA = a.macroLevel || 0;
        const levelB = b.macroLevel || 0;
        if (levelA !== levelB) {
            return levelB - levelA; // Higher level first
        }
        const sourceA = sources.find(s => s.handle === a.source);
        const sourceB = sources.find(s => s.handle === b.source);
        const priorityA = sourceA?.priority || 5;
        const priorityB = sourceB?.priority || 5;
        if (priorityA !== priorityB) {
            return priorityB - priorityA; // Higher priority first
        }
        return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    });
}
/**
 * Store Nitter news items in the database with Price Brain scores
 */
export async function storeNitterNewsInDatabase(items, priceBrainScores) {
    const { sql } = await import('../db/index.js');
    for (const item of items) {
        try {
            const score = priceBrainScores?.get(item.id);
            // Only insert if URL exists, otherwise use title+timestamp as unique key
            if (item.url) {
                await sql `
          INSERT INTO news_articles (
            title, summary, content, source, url, published_at,
            sentiment, symbols, is_breaking, macro_level, author_handle,
            price_brain_sentiment, price_brain_classification, implied_points, instrument
          )
          VALUES (
            ${item.title},
            ${item.content.substring(0, 500)},
            ${item.content},
            ${item.source},
            ${item.url},
            ${item.timestamp ? new Date(item.timestamp) : new Date()},
            ${item.sentiment || null},
            ${item.symbols || []},
            ${item.macroLevel === 4 || item.macroLevel === 3},
            ${item.macroLevel || null},
            ${item.authorHandle || null},
            ${score?.sentiment || null},
            ${score?.classification || null},
            ${score?.impliedPoints || null},
            ${score?.instrument || null}
          )
          ON CONFLICT (url) DO UPDATE SET
            title = EXCLUDED.title,
            content = EXCLUDED.content,
            macro_level = EXCLUDED.macro_level,
            price_brain_sentiment = EXCLUDED.price_brain_sentiment,
            price_brain_classification = EXCLUDED.price_brain_classification,
            implied_points = EXCLUDED.implied_points,
            instrument = EXCLUDED.instrument,
            updated_at = NOW()
        `;
            }
            else {
                // Insert without URL conflict handling
                await sql `
          INSERT INTO news_articles (
            title, summary, content, source, url, published_at,
            sentiment, symbols, is_breaking, macro_level, author_handle,
            price_brain_sentiment, price_brain_classification, implied_points, instrument
          )
          VALUES (
            ${item.title},
            ${item.content.substring(0, 500)},
            ${item.content},
            ${item.source},
            ${item.url || null},
            ${item.timestamp ? new Date(item.timestamp) : new Date()},
            ${item.sentiment || null},
            ${item.symbols || []},
            ${item.macroLevel === 4 || item.macroLevel === 3},
            ${item.macroLevel || null},
            ${item.authorHandle || null},
            ${score?.sentiment || null},
            ${score?.classification || null},
            ${score?.impliedPoints || null},
            ${score?.instrument || null}
          )
        `;
            }
        }
        catch (error) {
            console.error(`Failed to store news item ${item.id}:`, error);
        }
    }
}
/**
 * Process and store Nitter news end-to-end
 * Fetches, filters, scores, and stores news items
 */
export async function processAndStoreNitterNews(userInstrument) {
    const { fetchNitterNews, DEFAULT_NITTER_SOURCES, storeNitterNewsInDatabase } = await import('./nitter-service.js');
    const { scoreNewsBatch } = await import('./price-brain-service.js');
    // Fetch news from Nitter sources
    const newsItems = await fetchNitterNews(DEFAULT_NITTER_SOURCES, 5);
    // Score with Price Brain Layer
    const scores = await scoreNewsBatch(newsItems, userInstrument);
    // Convert scores to format for storage
    const scoresMap = new Map();
    for (const [id, score] of scores.entries()) {
        scoresMap.set(id, {
            sentiment: score.sentiment,
            classification: score.classification,
            impliedPoints: score.impliedPoints,
            instrument: score.instrument,
        });
    }
    // Store in database
    await storeNitterNewsInDatabase(newsItems, scoresMap);
    return {
        count: newsItems.length,
        items: newsItems,
    };
}
/**
 * Get trending financial topics from Nitter
 */
export async function getNitterTrends() {
    try {
        const nitterBaseUrl = process.env.NITTER_BASE_URL || 'https://nitter.net';
        const response = await fetch(`${nitterBaseUrl}/search`, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            },
        });
        if (!response.ok) {
            throw new Error(`Failed to fetch trends: ${response.status}`);
        }
        const html = await response.text();
        // Extract trending topics (simplified)
        // In production, would parse the HTML properly
        const trends = [];
        const trendMatches = html.match(/#[a-zA-Z]+/g);
        if (trendMatches) {
            const uniqueTrends = [...new Set(trendMatches)]
                .filter(trend => trend.length > 3 && trend.length < 20)
                .slice(0, 20);
            trends.push(...uniqueTrends);
        }
        return trends;
    }
    catch (error) {
        console.error('Failed to get Nitter trends:', error);
        return [];
    }
}
//# sourceMappingURL=nitter-service.js.map