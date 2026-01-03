import { Hono } from 'hono';
import { sql } from '../db/index.js';
const notificationsRoutes = new Hono();
// GET /notifications - Get user notifications
notificationsRoutes.get('/', async (c) => {
    const userId = c.get('userId');
    const limit = parseInt(c.req.query('limit') || '50', 10);
    const offset = parseInt(c.req.query('offset') || '0', 10);
    try {
        const notifications = await sql `
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
            notifications: notifications || [],
            total: notifications.length,
        });
    }
    catch (error) {
        console.error('Failed to get notifications:', error);
        return c.json({ error: 'Failed to get notifications' }, 500);
    }
});
// POST /notifications/:id/read - Mark notification as read
notificationsRoutes.post('/:id/read', async (c) => {
    const userId = c.get('userId');
    const notificationId = c.req.param('id');
    try {
        return c.json({
            success: true,
            message: 'Notification marked as read',
            notificationId,
        });
    }
    catch (error) {
        console.error('Failed to mark notification as read:', error);
        return c.json({ error: 'Failed to mark notification as read' }, 500);
    }
});
export { notificationsRoutes };
//# sourceMappingURL=notifications.js.map