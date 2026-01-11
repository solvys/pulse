/**
 * Feed Poller Service
 * Continuously polls X API for new news items and broadcasts Level 4 events instantly
 * Runs independently of HTTP requests for real-time updates
 */

import { createXApiService, type ParsedTweetNews } from '../x-api-service.js';
import * as newsCache from './news-cache.js';
import { enrichFeedWithAnalysis } from './feed-service.js';
import { broadcastLevel4 } from './sse-broadcaster.js';
import type { FeedItem, NewsSource, UrgencyLevel } from '../../types/riskflow.js';

const POLL_INTERVAL_MS = 15_000; // Poll every 15 seconds for instant Level 4 detection
const isDev = process.env.NODE_ENV !== 'production';
let pollInterval: ReturnType<typeof setInterval> | null = null;
let isPolling = false;

/**
 * Poll for new feed items and process them
 */
async function pollForNewItems(): Promise<void> {
  if (isPolling) {
    return; // Prevent concurrent polls
  }

  isPolling = true;

  try {
    // Skip if no X API token in production
    if (!isDev && !process.env.X_API_BEARER_TOKEN) {
      return;
    }

    const xApiService = createXApiService();
    const tweets = await xApiService.fetchLatestTweets();

    if (tweets.length === 0) {
      return;
    }

    // Check which tweets are already cached
    const tweetIds = tweets.map(t => t.tweetId);
    const cachedIds = await newsCache.getCachedTweetIds(tweetIds);
    const newTweets = tweets.filter(t => !cachedIds.has(t.tweetId));

    if (newTweets.length === 0) {
      return; // No new items
    }

    console.log(`[FeedPoller] Found ${newTweets.length} new items (${cachedIds.size} already cached)`);

    // Convert to FeedItems
    const newItems: FeedItem[] = newTweets.map(tweet => ({
      id: tweet.tweetId,
      source: tweet.source as NewsSource,
      headline: tweet.headline,
      body: tweet.body,
      symbols: tweet.symbols,
      tags: tweet.tags,
      isBreaking: tweet.isBreaking,
      urgency: (tweet.isBreaking ? 'immediate' : 'normal') as UrgencyLevel,
      publishedAt: tweet.publishedAt,
    }));

    // Enrich with AI analysis (this calculates IV scores and macro levels)
    const enrichedItems = await enrichFeedWithAnalysis(newItems);

    // Store all items in database
    await newsCache.storeFeedItems(enrichedItems);

    // Broadcast Level 4 items immediately via SSE
    const level4Items = enrichedItems.filter(item => item.macroLevel === 4);
    for (const item of level4Items) {
      console.log(`[FeedPoller] Broadcasting Level 4 item: ${item.headline}`);
      broadcastLevel4(item);
    }

    if (level4Items.length > 0) {
      console.log(`[FeedPoller] Broadcast ${level4Items.length} Level 4 items via SSE`);
    }
  } catch (error) {
    console.error('[FeedPoller] Poll error:', error);
  } finally {
    isPolling = false;
  }
}

/**
 * Start the continuous polling service
 */
export function startFeedPoller(): void {
  if (pollInterval) {
    console.log('[FeedPoller] Already running');
    return;
  }

  console.log(`[FeedPoller] Starting continuous polling (every ${POLL_INTERVAL_MS / 1000}s)`);
  
  // Poll immediately on startup
  pollForNewItems();

  // Then poll at regular intervals
  pollInterval = setInterval(() => {
    pollForNewItems();
  }, POLL_INTERVAL_MS);
}

/**
 * Stop the polling service
 */
export function stopFeedPoller(): void {
  if (pollInterval) {
    clearInterval(pollInterval);
    pollInterval = null;
    console.log('[FeedPoller] Stopped');
  }
}

/**
 * Get polling status
 */
export function isPollingActive(): boolean {
  return pollInterval !== null;
}
