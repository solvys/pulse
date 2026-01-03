/**
 * Admin Routes
 * Admin-only API endpoints for annotations and management
 */
import { Hono } from 'hono';
import { requireAdminMiddleware } from '../middleware/admin.js';
import { createAnnotation, getAnnotationsForTarget, listAllAnnotations, deleteAnnotation, getAnnotationStats, } from '../services/admin-annotations-service.js';
const adminRoutes = new Hono();
// All admin routes require admin role
adminRoutes.use('/*', requireAdminMiddleware);
// Create a new annotation
adminRoutes.post('/annotations', async (c) => {
    const userId = c.get('userId');
    const body = await c.req.json();
    const { targetType, targetId, selectedText, comment } = body;
    if (!targetType || !targetId || !comment) {
        return c.json({ error: 'targetType, targetId, and comment are required' }, 400);
    }
    if (!['ai_message', 'news_article', 'iv_score'].includes(targetType)) {
        return c.json({ error: 'Invalid targetType. Must be: ai_message, news_article, or iv_score' }, 400);
    }
    try {
        const annotation = await createAnnotation(userId, targetType, targetId, comment, selectedText);
        return c.json({ annotation });
    }
    catch (error) {
        console.error('Error creating annotation:', error);
        return c.json({ error: 'Failed to create annotation' }, 500);
    }
});
// List all annotations with pagination
adminRoutes.get('/annotations', async (c) => {
    const limit = parseInt(c.req.query('limit') || '50');
    const offset = parseInt(c.req.query('offset') || '0');
    try {
        const annotations = await listAllAnnotations(limit, offset);
        return c.json({ annotations });
    }
    catch (error) {
        console.error('Error listing annotations:', error);
        return c.json({ error: 'Failed to list annotations' }, 500);
    }
});
// Get annotation stats
adminRoutes.get('/annotations/stats', async (c) => {
    try {
        const stats = await getAnnotationStats();
        return c.json(stats);
    }
    catch (error) {
        console.error('Error getting annotation stats:', error);
        return c.json({ error: 'Failed to get annotation stats' }, 500);
    }
});
// Get annotations for a specific target
adminRoutes.get('/annotations/:targetType/:targetId', async (c) => {
    const { targetType, targetId } = c.req.param();
    try {
        const annotations = await getAnnotationsForTarget(targetType, targetId);
        return c.json({ annotations });
    }
    catch (error) {
        console.error('Error getting annotations:', error);
        return c.json({ error: 'Failed to get annotations' }, 500);
    }
});
// Delete an annotation
adminRoutes.delete('/annotations/:id', async (c) => {
    const userId = c.get('userId');
    const id = parseInt(c.req.param('id'));
    if (isNaN(id)) {
        return c.json({ error: 'Invalid annotation ID' }, 400);
    }
    try {
        const deleted = await deleteAnnotation(id, userId);
        if (!deleted) {
            return c.json({ error: 'Annotation not found or access denied' }, 404);
        }
        return c.json({ success: true });
    }
    catch (error) {
        console.error('Error deleting annotation:', error);
        return c.json({ error: 'Failed to delete annotation' }, 500);
    }
});
// Check admin status (useful for frontend)
adminRoutes.get('/status', async (c) => {
    return c.json({ isAdmin: true });
});
export { adminRoutes };
//# sourceMappingURL=admin.js.map