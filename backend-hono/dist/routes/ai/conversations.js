import { Hono } from 'hono';
import { sql } from '../../db/index.js';
export const conversationsRoute = new Hono();
// List conversations
conversationsRoute.get('/', async (c) => {
    try {
        const userId = c.get('userId');
        if (!userId)
            return c.json({ error: 'Unauthorized' }, 401);
        const rows = await sql `
      SELECT 
        c.id as "conversationId",
        c.title,
        c.updated_at as "updatedAt",
        false as "isPinned",
        false as "isArchived",
        (SELECT COUNT(*) FROM ai_messages m WHERE m.conversation_id = c.id) as "messageCount",
        (SELECT content FROM ai_messages m WHERE m.conversation_id = c.id ORDER BY created_at DESC LIMIT 1) as "preview"
      FROM ai_conversations c
      WHERE c.user_id = ${userId}
      ORDER BY c.updated_at DESC
      LIMIT 50
    `;
        return c.json({ conversations: rows });
    }
    catch (error) {
        console.error('List Conversations Error:', error);
        return c.json({ error: 'Failed to list conversations' }, 500);
    }
});
// Get single conversation
conversationsRoute.get('/:id', async (c) => {
    try {
        const userId = c.get('userId');
        const conversationId = c.req.param('id');
        if (!userId)
            return c.json({ error: 'Unauthorized' }, 401);
        const items = await sql `
      SELECT * FROM ai_conversations 
      WHERE id = ${conversationId} AND user_id = ${userId}
    `;
        if (items.length === 0) {
            return c.json({ error: 'Conversation not found' }, 404);
        }
        const messages = await sql `
      SELECT 
        id,
        role,
        content,
        created_at as "createdAt"
      FROM ai_messages
      WHERE conversation_id = ${conversationId}
      ORDER BY created_at ASC
    `;
        return c.json({ ...items[0], messages });
    }
    catch (error) {
        console.error('Get Conversation Error:', error);
        return c.json({ error: 'Failed to get conversation' }, 500);
    }
});
//# sourceMappingURL=conversations.js.map