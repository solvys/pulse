/**
 * Nitter Service
 * Scrapes news from Nitter (Twitter alternative) sources
 */

export interface NitterNewsItem {
  id: string;
  title: string;
  content: string;
  author: string;
  authorHandle: string;
  url: string;
  timestamp: string;
  likes: number;
  retweets: number;
  replies: number;
  images?: string[];
  hashtags?: string[];
  symbols?: string[];
  sentiment?: 'positive' | 'negative' | 'neutral';
  sentimentScore?: number;
  source: string; // The Nitter source (e.g., 'cnbc', 'business')
}

export interface NitterSource {
  handle: string; // Twitter handle (e.g., 'cnbc', 'business')
  name: string; // Display name
  category: 'financial' | 'business' | 'crypto' | 'politics' | 'general';
  priority: number; // 1-10, higher = more important
}

/**
 * Default Nitter sources to follow
 * User will provide their specific sources
 */
export const DEFAULT_NITTER_SOURCES: NitterSource[] = [
  { handle: 'cnbc', name: 'CNBC', category: 'financial', priority: 10 },
  { handle: 'business', name: 'Bloomberg Business', category: 'business', priority: 9 },
  { handle: 'FinancialTimes', name: 'Financial Times', category: 'financial', priority: 8 },
  { handle: 'WSJmarkets', name: 'Wall Street Journal Markets', category: 'financial', priority: 9 },
  { handle: 'businessinsider', name: 'Business Insider', category: 'business', priority: 7 },
  { handle: 'Forbes', name: 'Forbes', category: 'business', priority: 6 },
];

/**
 * Scrape tweets from a Nitter source
 */
async function scrapeNitterSource(sourceHandle: string, limit = 10): Promise<NitterNewsItem[]> {
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
    const tweets: NitterNewsItem[] = [];

    // Extract tweet data from HTML (simplified)
    // In production, this would use cheerio or similar to parse properly
    const tweetMatches = html.match(/class="tweet-content[^"]*"[^>]*>([^<]*)</g);

    if (tweetMatches) {
      for (let i = 0; i < Math.min(tweetMatches.length, limit); i++) {
        const content = tweetMatches[i].replace(/class="tweet-content[^"]*"[^>]*>/, '').replace(/</, '');

        if (content && content.length > 20) { // Filter out very short content
          const tweet: NitterNewsItem = {
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
          };

          tweets.push(tweet);
        }
      }
    }

    return tweets;
  } catch (error) {
    console.error(`Failed to scrape Nitter source ${sourceHandle}:`, error);
    return [];
  }
}

/**
 * Extract stock symbols from content
 */
function extractSymbols(content: string): string[] {
  const symbolRegex = /\$([A-Z]{1,5})/g;
  const matches = content.match(symbolRegex) || [];
  return matches.map(match => match.substring(1));
}

/**
 * Simple sentiment analysis
 */
function analyzeSentiment(content: string): 'positive' | 'negative' | 'neutral' {
  const lowerContent = content.toLowerCase();

  const positiveWords = ['bullish', 'buy', 'up', 'gain', 'profit', 'higher', 'rally', 'surge', 'breakout'];
  const negativeWords = ['bearish', 'sell', 'down', 'loss', 'crash', 'lower', 'drop', 'fall', 'decline'];

  const positiveCount = positiveWords.reduce((count, word) =>
    count + (lowerContent.split(word).length - 1), 0);
  const negativeCount = negativeWords.reduce((count, word) =>
    count + (lowerContent.split(word).length - 1), 0);

  if (positiveCount > negativeCount) return 'positive';
  if (negativeCount > positiveCount) return 'negative';
  return 'neutral';
}

/**
 * Fetch news from all configured Nitter sources
 */
export async function fetchNitterNews(
  sources: NitterSource[] = DEFAULT_NITTER_SOURCES,
  limitPerSource = 5
): Promise<NitterNewsItem[]> {
  const allNews: NitterNewsItem[] = [];

  for (const source of sources) {
    try {
      const sourceNews = await scrapeNitterSource(source.handle, limitPerSource);
      allNews.push(...sourceNews);
    } catch (error) {
      console.error(`Failed to fetch from ${source.handle}:`, error);
    }

    // Add small delay to be respectful to Nitter instances
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  // Sort by priority and timestamp
  return allNews.sort((a, b) => {
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
 * Get trending financial topics from Nitter
 */
export async function getNitterTrends(): Promise<string[]> {
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
    const trends: string[] = [];
    const trendMatches = html.match(/#[a-zA-Z]+/g);

    if (trendMatches) {
      const uniqueTrends = [...new Set(trendMatches)]
        .filter(trend => trend.length > 3 && trend.length < 20)
        .slice(0, 20);

      trends.push(...uniqueTrends);
    }

    return trends;
  } catch (error) {
    console.error('Failed to get Nitter trends:', error);
    return [];
  }
}