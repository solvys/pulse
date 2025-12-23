import { Hono } from 'hono';
import { z } from 'zod';
import { sql } from '../db/index.js';

const econRoutes = new Hono();

// GET /econ/day/:date - Returns cached econ calendar plan/events for a date
econRoutes.get('/day/:date', async (c) => {
  const userId = c.get('userId');
  const date = c.req.param('date');

  const plan = await sql`
    SELECT plan, events_json as events, source, updated_at as cached_at
    FROM econ_daily_plan
    WHERE user_id = ${userId}
      AND date = ${date}::date
    LIMIT 1
  `;

  if (plan.length === 0) {
    return c.json(
      { error: 'No plan found for this date. Use /econ/interpret to generate one.' },
      404
    );
  }

  const p = plan[0];
  return c.json({
    date,
    plan: p.plan,
    events: p.events || [],
    source: p.source,
    cachedAt: p.cached_at,
  });
});

// POST /econ/interpret - Triggers extraction for a date (placeholder for Phase 3 Playwright implementation)
const interpretSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  timezone: z.string().min(1),
  region: z.string().min(1),
});

econRoutes.post('/interpret', async (c) => {
  const userId = c.get('userId');
  const body = await c.req.json();

  const result = interpretSchema.safeParse(body);
  if (!result.success) {
    return c.json({ error: 'date, timezone, and region required' }, 400);
  }

  const { date, timezone, region } = result.data;

  const existing = await sql`
    SELECT updated_at
    FROM econ_daily_plan
    WHERE user_id = ${userId}
      AND date = ${date}::date
      AND updated_at > NOW() - INTERVAL '6 hours'
  `;

  if (existing.length > 0) {
    return c.json({
      jobId: null,
      status: 'completed',
      message: 'Plan already cached (refreshed within 6 hours)',
    });
  }

  const jobId = `econ-${userId}-${date}-${Date.now()}`;

  try {
    const mockPlan = `Market focus for ${date}: Monitor key economic releases. ${region} session expected to be active.`;
    const mockEvents = [
      { time: '09:30', currency: 'USD', impact: 'high', title: 'Market Open' },
      { time: '10:00', currency: 'USD', impact: 'medium', title: 'Economic Data Release' },
    ];

    await sql`
      INSERT INTO econ_daily_plan (user_id, date, plan, events_json, source, timezone, region)
      VALUES (${userId}, ${date}::date, ${mockPlan}, ${JSON.stringify(mockEvents)}, 'placeholder', ${timezone}, ${region})
      ON CONFLICT (user_id, date)
      DO UPDATE SET
        plan = EXCLUDED.plan,
        events_json = EXCLUDED.events_json,
        source = EXCLUDED.source,
        updated_at = NOW()
    `;

    return c.json({
      jobId,
      status: 'completed',
      message: 'Plan extracted and cached (placeholder - Playwright integration in Phase 3)',
    });
  } catch (error) {
    console.error('Econ interpretation failed:', error);
    return c.json(
      {
        jobId,
        status: 'failed',
        message: 'Failed to extract plan. Please try again.',
      },
      500
    );
  }
});

export { econRoutes };
