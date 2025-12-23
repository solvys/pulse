import { Hono } from 'hono';
import { z } from 'zod';
import { sql } from '../db/index.js';

const journalRoutes = new Hono();

// GET /journal/stats - Aggregated trading statistics for journal KPIs
journalRoutes.get('/stats', async (c) => {
  const userId = c.get('userId');
  const startDate = c.req.query('startDate') || '1970-01-01';
  const endDate = c.req.query('endDate') || new Date().toISOString();

  const stats = await sql`
    SELECT
      COUNT(*)::integer as total_trades,
      COUNT(*) FILTER (WHERE pnl > 0)::integer as winning_trades,
      ROUND(AVG(pnl)::numeric, 2) as avg_pnl,
      ROUND(SUM(pnl)::numeric, 2) as total_pnl,
      MAX(pnl) as best_trade,
      MIN(pnl) as worst_trade,
      ROUND(SUM(CASE WHEN pnl > 0 THEN pnl ELSE 0 END)::numeric, 2) as gross_profit,
      ROUND(ABS(SUM(CASE WHEN pnl < 0 THEN pnl ELSE 0 END))::numeric, 2) as gross_loss
    FROM trades
    WHERE user_id = ${userId}
      AND opened_at >= ${startDate}
      AND opened_at <= ${endDate}
  `;

  const s = stats[0] || {
    total_trades: 0,
    winning_trades: 0,
    avg_pnl: 0,
    total_pnl: 0,
    best_trade: 0,
    worst_trade: 0,
    gross_profit: 0,
    gross_loss: 0,
  };

  const winRate =
    s.total_trades > 0
      ? Math.round((s.winning_trades / s.total_trades) * 100 * 10) / 10
      : 0;

  const profitFactor =
    s.gross_loss > 0
      ? Math.round((s.gross_profit / s.gross_loss) * 10) / 10
      : s.gross_profit || 0;

  const recentTrades = await sql`
    SELECT pnl > 0 as is_win
    FROM trades
    WHERE user_id = ${userId}
    ORDER BY closed_at DESC NULLS LAST, opened_at DESC
    LIMIT 10
  `;

  let streak: { type: 'win' | 'loss'; count: number } = { type: 'win', count: 0 };
  for (const trade of recentTrades) {
    if (streak.count === 0) {
      streak.type = trade.is_win ? 'win' : 'loss';
      streak.count = 1;
    } else if (
      (trade.is_win && streak.type === 'win') ||
      (!trade.is_win && streak.type === 'loss')
    ) {
      streak.count++;
    } else {
      break;
    }
  }

  return c.json({
    winRate,
    avgPnL: Number(s.avg_pnl) || 0,
    totalTrades: s.total_trades || 0,
    totalPnL: Number(s.total_pnl) || 0,
    profitFactor,
    bestTrade: Number(s.best_trade) || 0,
    worstTrade: Number(s.worst_trade) || 0,
    currentStreak: streak,
  });
});

// GET /journal/calendar - P&L status for each day in a month
const calendarSchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/),
});

journalRoutes.get('/calendar', async (c) => {
  const userId = c.get('userId');
  const month = c.req.query('month');

  if (!month) {
    return c.json({ error: 'month parameter required (YYYY-MM)' }, 400);
  }

  const result = calendarSchema.safeParse({ month });
  if (!result.success) {
    return c.json({ error: 'Invalid month format. Use YYYY-MM' }, 400);
  }

  const startOfMonth = `${month}-01`;
  const endOfMonth = `${month}-31`;

  const days = await sql`
    SELECT
      DATE(opened_at)::text as date,
      ROUND(SUM(pnl)::numeric, 2) as pnl,
      COUNT(*)::integer as trade_count
    FROM trades
    WHERE user_id = ${userId}
      AND DATE(opened_at) >= ${startOfMonth}::date
      AND DATE(opened_at) <= ${endOfMonth}::date
    GROUP BY DATE(opened_at)
    ORDER BY date
  `;

  return c.json({
    days: days.map((day) => ({
      date: day.date,
      pnl: Number(day.pnl),
      tradeCount: day.trade_count,
      status:
        Number(day.pnl) > 0
          ? 'profitable'
          : Number(day.pnl) < 0
            ? 'loss'
            : day.trade_count > 0
              ? 'breakeven'
              : 'no-trades',
    })),
  });
});

// GET /journal/date/:date - Detailed breakdown for a specific date
journalRoutes.get('/date/:date', async (c) => {
  const userId = c.get('userId');
  const date = c.req.param('date');

  const orders = await sql`
    SELECT
      id, opened_at as "time", symbol, side, size,
      entry_price as "entryPrice", exit_price as "exitPrice", pnl
    FROM trades
    WHERE user_id = ${userId}
      AND DATE(opened_at) = ${date}::date
    ORDER BY opened_at
  `;

  const pnlByTime = await sql`
    SELECT
      EXTRACT(HOUR FROM opened_at)::integer as hour,
      ROUND(SUM(pnl)::numeric, 2) as pnl
    FROM trades
    WHERE user_id = ${userId}
      AND DATE(opened_at) = ${date}::date
    GROUP BY EXTRACT(HOUR FROM opened_at)
    ORDER BY hour
  `;

  const totals = await sql`
    SELECT ROUND(SUM(pnl)::numeric, 2) as net_pnl
    FROM trades
    WHERE user_id = ${userId}
      AND DATE(opened_at) = ${date}::date
  `;

  return c.json({
    date,
    netPnL: Number(totals[0]?.net_pnl) || 0,
    pnlByTime: pnlByTime.map((p) => ({
      hour: p.hour,
      pnl: Number(p.pnl),
    })),
    orders: orders.map((o) => ({
      id: o.id,
      time: o.time,
      symbol: o.symbol,
      side: o.side,
      size: o.size,
      entryPrice: Number(o.entryPrice),
      exitPrice: Number(o.exitPrice),
      pnl: Number(o.pnl),
    })),
  });
});

export { journalRoutes };
