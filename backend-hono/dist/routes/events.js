import { Hono } from 'hono';
import { sql } from '../db/index.js';
const eventsRoutes = new Hono();
// GET /events - Get system events (same as notifications for now)
eventsRoutes.get('/', async (c) => {
    const userId = c.get('userId');
    const limit = parseInt(c.req.query('limit') || '50', 10);
    const offset = parseInt(c.req.query('offset') || '0', 10);
    try {
        const events = await sql `
      SELECT
        id,
        event_type as "eventType",
        severity,
        title,
        message,
        metadata,
        created_at as "createdAt"
      FROM system_events
      WHERE user_id = ${userId}
      ORDER BY created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `;
        return c.json({
            events: events || [],
            total: events.length,
        });
    }
    catch (error) {
        console.error('Failed to get events:', error);
        return c.json({ error: 'Failed to get events' }, 500);
    }
});
export { eventsRoutes };
//# sourceMappingURL=events.js.map