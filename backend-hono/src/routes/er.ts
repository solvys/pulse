import { Hono } from 'hono';
import { z } from 'zod';
import { sql } from '../db/index.js';

const erRoutes = new Hono();

// GET /er/date/:date - Emotional Resonance scores by hour for a specific date
erRoutes.get('/date/:date', async (c) => {
  const userId = c.get('userId');
  const date = c.req.param('date');

  const storedScores = await sql`
    SELECT hour, score
    FROM emotional_resonance_scores
    WHERE user_id = ${userId}
      AND DATE(recorded_at) = ${date}::date
    ORDER BY hour
  `;

  if (storedScores.length > 0) {
    return c.json({
      erByTime: storedScores.map((s) => ({
        hour: s.hour,
        score: Number(s.score),
      })),
    });
  }

  const tradePatterns = await sql`
    WITH ordered_trades AS (
      SELECT 
        opened_at,
        pnl,
        LAG(pnl) OVER (ORDER BY opened_at) as prev_pnl
      FROM trades
      WHERE user_id = ${userId}
        AND DATE(opened_at) = ${date}::date
    )
    SELECT
      EXTRACT(HOUR FROM opened_at)::integer as hour,
      COUNT(*)::integer as trade_count,
      SUM(CASE WHEN pnl < 0 THEN 1 ELSE 0 END)::integer as losses,
      SUM(CASE WHEN pnl < 0 AND prev_pnl < 0 THEN 1 ELSE 0 END)::integer as revenge_trades
    FROM ordered_trades
    GROUP BY EXTRACT(HOUR FROM opened_at)
    ORDER BY hour
  `;

  const erByTime = tradePatterns.map((p) => {
    const revengeRatio = p.revenge_trades / Math.max(p.losses, 1);
    const overtradingFactor = Math.min(p.trade_count / 5, 2);
    const score = Math.min(10, revengeRatio * 3 + overtradingFactor * 2);
    return {
      hour: p.hour,
      score: Math.round(score * 10) / 10,
    };
  });

  return c.json({ erByTime });
});

// GET /er/blindspots/:date - Blindspot Management Rating (0-10) for a specific date
erRoutes.get('/blindspots/:date', async (c) => {
  const userId = c.get('userId');
  const date = c.req.param('date');

  const stored = await sql`
    SELECT rating as score, notes as summary
    FROM blindspot_ratings
    WHERE user_id = ${userId}
      AND DATE(recorded_at) = ${date}::date
    LIMIT 1
  `;

  if (stored.length > 0) {
    return c.json({
      score: stored[0].score,
      summary: stored[0].summary || 'No summary available',
    });
  }

  const patterns = await sql`
    WITH ordered_trades AS (
      SELECT 
        opened_at,
        pnl,
        size,
        LAG(pnl) OVER (ORDER BY opened_at) as prev_pnl
      FROM trades
      WHERE user_id = ${userId}
        AND DATE(opened_at) = ${date}::date
    )
    SELECT
      COUNT(*)::integer as total_trades,
      SUM(CASE WHEN pnl < 0 AND prev_pnl < 0 THEN 1 ELSE 0 END)::integer as revenge_count,
      SUM(CASE WHEN EXTRACT(HOUR FROM opened_at) < 9 OR 
        EXTRACT(HOUR FROM opened_at) > 15 THEN 1 ELSE 0 END)::integer as off_hours_count,
      AVG(size) as avg_size,
      MAX(size) as max_size
    FROM ordered_trades
  `;

  const p = patterns[0] || {
    total_trades: 0,
    revenge_count: 0,
    off_hours_count: 0,
    avg_size: 0,
    max_size: 0,
  };

  let score = 10;
  const issues: string[] = [];

  if (p.revenge_count > 0) {
    score -= p.revenge_count * 1.5;
    issues.push('revenge trading detected');
  }

  if (p.off_hours_count > 2) {
    score -= 1;
    issues.push('excessive off-hours trading');
  }

  if (p.max_size > p.avg_size * 2 && p.avg_size > 0) {
    score -= 1.5;
    issues.push('position size inconsistency');
  }

  score = Math.max(0, Math.round(score * 10) / 10);

  const summary =
    score >= 8
      ? 'Excellent blindspot awareness'
      : score >= 5
        ? `Good awareness with some lapses: ${issues.join(', ')}`
        : `Significant blindspots detected: ${issues.join(', ')}`;

  return c.json({ score, summary });
});

// POST /er/sessions - Save ER monitoring session
const saveSessionSchema = z.object({
  finalScore: z.number().min(0).max(10),
  timeInTiltSeconds: z.number().int().min(0).default(0),
  infractionCount: z.number().int().min(0).default(0),
  sessionDurationSeconds: z.number().int().min(0),
  maxTiltScore: z.number().min(0).max(10).optional(),
  maxTiltTime: z.number().int().min(0).optional(),
  sessionId: z.string().optional(),
});

erRoutes.post('/sessions', async (c) => {
  const userId = c.get('userId');
  const body = await c.req.json();
  const result = saveSessionSchema.safeParse(body);

  if (!result.success) {
    return c.json({ error: 'Invalid request body', details: result.error.flatten() }, 400);
  }

  const {
    finalScore,
    timeInTiltSeconds,
    infractionCount,
    sessionDurationSeconds,
    maxTiltScore,
    maxTiltTime,
    sessionId,
  } = result.data;

  try {
    const [session] = await sql`
      INSERT INTO er_sessions (
        user_id,
        session_id,
        final_score,
        time_in_tilt_seconds,
        infraction_count,
        session_duration_seconds,
        max_tilt_score,
        max_tilt_time
      )
      VALUES (
        ${userId},
        ${sessionId || null},
        ${finalScore},
        ${timeInTiltSeconds},
        ${infractionCount},
        ${sessionDurationSeconds},
        ${maxTiltScore ?? null},
        ${maxTiltTime ?? null}
      )
      RETURNING id, created_at
    `;

    return c.json({
      id: session.id,
      sessionId: session.session_id,
      createdAt: session.created_at,
    });
  } catch (error) {
    console.error('Failed to save ER session:', error);
    return c.json({ error: 'Failed to save ER session' }, 500);
  }
});

export { erRoutes };
