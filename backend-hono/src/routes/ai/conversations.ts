
import { Hono } from 'hono';
import { sql } from '../../db/index.js';

export const conversationsRoute = new Hono();

// List conversations
conversationsRoute.get('/', async (c) => {
  try {
    const userId = c.get('userId');
    if (!userId) return c.json({ error: 'Unauthorized' }, 401);

    const rows = await sql`
      SELECT 
        c.conversation_id as "conversationId",
        c.title,
        c.updated_at as "updatedAt",
        c.pinned as "isPinned",
        c.archived as "isArchived",
        (SELECT COUNT(*) FROM messages m WHERE m.conversation_id = c.conversation_id) as "messageCount",
        (SELECT content FROM messages m WHERE m.conversation_id = c.conversation_id ORDER BY created_at DESC LIMIT 1) as "preview"
      FROM conversations c
      WHERE c.user_id = ${userId} AND c.archived = false
      ORDER BY c.updated_at DESC
      LIMIT 50
    `;

    return c.json({ conversations: rows });
  } catch (error) {
    console.error('List Conversations Error:', error);
    return c.json({ error: 'Failed to list conversations' }, 500);
  }
});

// Get single conversation
conversationsRoute.get('/:id', async (c) => {
  try {
    const userId = c.get('userId');
    const conversationId = c.req.param('id');
    if (!userId) return c.json({ error: 'Unauthorized' }, 401);

    const items = await sql`
      SELECT * FROM conversations 
      WHERE conversation_id = ${conversationId} AND user_id = ${userId}
    `;

    if (items.length === 0) {
      return c.json({ error: 'Conversation not found' }, 404);
    }

    const messages = await sql`
      SELECT 
        id,
        role,
        content,
        created_at as "createdAt"
      FROM messages
      WHERE conversation_id = ${conversationId}
      ORDER BY created_at ASC
    `;

    return c.json({ ...items[0], messages });
  } catch (error) {
    console.error('Get Conversation Error:', error);
    return c.json({ error: 'Failed to get conversation' }, 500);
  }
});
