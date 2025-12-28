import { Hono } from 'hono';
import { z } from 'zod';
import { sql } from '../db/index.js';
import {
  fetchAllPolymarketOdds,
  fetchPolymarketOdds,
  checkSignificantChanges,
  createPolymarketUpdate,
} from '../services/polymarket-service.js';

const polymarketRoutes = new Hono();

// GET /polymarket/odds - Get current odds for all markets
polymarketRoutes.get('/odds', async (c) => {
  try {
    // First try to get from database (latest)
    const latestOdds = await sql`
      SELECT DISTINCT ON (market_type)
        market_id, market_type, yes_odds, no_odds, timestamp
      FROM polymarket_odds
      ORDER BY market_type, timestamp DESC
    `;

    if (latestOdds && latestOdds.length > 0) {
      return c.json({
        success: true,
        data: {
          odds: latestOdds.map((odds: any) => ({
            marketId: odds.market_id,
            marketType: odds.market_type,
            yesOdds: Number(odds.yes_odds),
            noOdds: Number(odds.no_odds),
            timestamp: odds.timestamp.toISOString(),
          })),
        },
      });
    }

    // If no database entries, try to fetch from API
    const apiOdds = await fetchAllPolymarketOdds();
    
    if (apiOdds.length === 0) {
      return c.json({
        success: true,
        data: {
          odds: [],
          message: 'No Polymarket odds available. API may not be configured.',
        },
      });
    }

    return c.json({
      success: true,
      data: {
        odds: apiOdds,
      },
    });
  } catch (error) {
    console.error('Failed to fetch Polymarket odds:', error);
    return c.json({
      success: false,
      error: 'Failed to fetch Polymarket odds',
    }, 500);
  }
});

// GET /polymarket/updates - Get recent significant updates
const updatesSchema = z.object({
  limit: z.coerce.number().min(1).max(100).default(20),
  marketType: z.enum([
    'rate_cut', 'cpi', 'nfp', 'interest_rate',
    'jerome_powell', 'donald_trump_tariffs', 'politics',
    'gdp', 'interest_rate_futures'
  ]).optional(),
});

polymarketRoutes.get('/updates', async (c) => {
  const result = updatesSchema.safeParse({
    limit: c.req.query('limit'),
    marketType: c.req.query('marketType'),
  });

  if (!result.success) {
    return c.json({
      success: false,
      error: 'Invalid query parameters',
      details: result.error.flatten(),
    }, 400);
  }

  try {
    const { limit, marketType } = result.data;

    let updates;
    if (marketType) {
      updates = await sql`
        SELECT 
          id, market_type, previous_odds, current_odds,
          change_percentage, triggered_by_news_id, created_at
        FROM polymarket_updates
        WHERE market_type = ${marketType}
        ORDER BY created_at DESC
        LIMIT ${limit}
      `;
    } else {
      updates = await sql`
        SELECT 
          id, market_type, previous_odds, current_odds,
          change_percentage, triggered_by_news_id, created_at
        FROM polymarket_updates
        ORDER BY created_at DESC
        LIMIT ${limit}
      `;
    }

    return c.json({
      success: true,
      data: {
        updates: updates.map((update: any) => ({
          id: update.id.toString(),
          marketType: update.market_type,
          previousOdds: Number(update.previous_odds),
          currentOdds: Number(update.current_odds),
          changePercentage: Number(update.change_percentage),
          triggeredByNewsId: update.triggered_by_news_id?.toString(),
          timestamp: update.created_at.toISOString(),
        })),
      },
    });
  } catch (error) {
    console.error('Failed to fetch Polymarket updates:', error);
    return c.json({
      success: false,
      error: 'Failed to fetch Polymarket updates',
    }, 500);
  }
});

// POST /polymarket/sync - Manual sync trigger (for cron)
polymarketRoutes.post('/sync', async (c) => {
  try {
    const allOdds = await fetchAllPolymarketOdds();
    
    if (allOdds.length === 0) {
      return c.json({
        success: false,
        message: 'No odds fetched. Polymarket API may not be configured.',
      }, 400);
    }

    // Store odds in database
    for (const odds of allOdds) {
      // Get previous odds for comparison
      const [previous] = await sql`
        SELECT yes_odds
        FROM polymarket_odds
        WHERE market_type = ${odds.marketType}
        ORDER BY timestamp DESC
        LIMIT 1
      `;

      // Store current odds
      await sql`
        INSERT INTO polymarket_odds (
          market_id, market_type, yes_odds, no_odds, timestamp
        ) VALUES (
          ${odds.marketId},
          ${odds.marketType},
          ${odds.yesOdds},
          ${odds.noOdds},
          ${odds.timestamp}::timestamp
        )
        ON CONFLICT (market_id, timestamp) DO NOTHING
      `;

      // Check for significant changes
      if (previous) {
        const changeCheck = await checkSignificantChanges(
          odds,
          Number(previous.yes_odds)
        );

        if (changeCheck.hasChange) {
          const update = createPolymarketUpdate(
            odds.marketType,
            Number(previous.yes_odds),
            odds.yesOdds
          );

          await sql`
            INSERT INTO polymarket_updates (
              market_type, previous_odds, current_odds,
              change_percentage
            ) VALUES (
              ${update.marketType},
              ${update.previousOdds},
              ${update.currentOdds},
              ${update.changePercentage}
            )
          `;
        }
      }
    }

    return c.json({
      success: true,
      message: 'Polymarket sync completed',
      oddsCount: allOdds.length,
    });
  } catch (error) {
    console.error('Failed to sync Polymarket data:', error);
    return c.json({
      success: false,
      error: 'Failed to sync Polymarket data',
    }, 500);
  }
});

export { polymarketRoutes };
