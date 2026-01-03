/**
 * Conversations Handlers
 * Conversation management endpoints
 */
import { sql } from '../../../db/index.js';
import { conversationRequestSchema } from '../schemas.js';
export async function handleListConversations(c) {
    const userId = c.get('userId');
    try {
        const conversations = await sql `
      SELECT 
        id, created_at as "createdAt", updated_at as "updatedAt",
        (SELECT COUNT(*) FROM ai_messages WHERE conversation_id = ai_conversations.id) as "messageCount",
        (SELECT content FROM ai_messages WHERE conversation_id = ai_conversations.id ORDER BY created_at ASC LIMIT 1) as preview
      FROM ai_conversations
      WHERE user_id = ${userId}
      ORDER BY updated_at DESC
      LIMIT 50
    `;
        return c.json(conversations || []);
    }
    catch (error) {
        console.error('Failed to list conversations:', error);
        return c.json({ error: 'Failed to list conversations' }, 500);
    }
}
export async function handleGetConversation(c) {
    const userId = c.get('userId');
    const conversationId = c.req.param('id');
    const id = parseInt(conversationId, 10);
    if (isNaN(id)) {
        return c.json({ error: 'Invalid conversation ID' }, 400);
    }
    try {
        const [conversation] = await sql `
      SELECT id, created_at as "createdAt", updated_at as "updatedAt"
      FROM ai_conversations
      WHERE id = ${id} AND user_id = ${userId}
    `;
        if (!conversation) {
            return c.json({ error: 'Conversation not found' }, 404);
        }
        const messages = await sql `
      SELECT id, role, content, created_at as "createdAt"
      FROM ai_messages
      WHERE conversation_id = ${id}
      ORDER BY created_at ASC
    `;
        return c.json({
            ...conversation,
            messages: messages || [],
        });
    }
    catch (error) {
        console.error('Failed to get conversation:', error);
        return c.json({ error: 'Failed to get conversation' }, 500);
    }
}
export async function handleCreateConversation(c) {
    const userId = c.get('userId');
    const body = await c.req.json();
    const result = conversationRequestSchema.safeParse(body);
    if (!result.success) {
        return c.json({ error: 'Invalid request body', details: result.error.flatten() }, 400);
    }
    try {
        const [conversation] = await sql `
      INSERT INTO ai_conversations (user_id)
      VALUES (${userId})
      RETURNING id, created_at as "createdAt", updated_at as "updatedAt"
    `;
        return c.json(conversation);
    }
    catch (error) {
        console.error('Failed to create conversation:', error);
        return c.json({ error: 'Failed to create conversation' }, 500);
    }
}
export async function handleDeleteConversation(c) {
    const userId = c.get('userId');
    const conversationId = c.req.param('id');
    const id = parseInt(conversationId, 10);
    if (isNaN(id)) {
        return c.json({ error: 'Invalid conversation ID' }, 400);
    }
    try {
        await sql `
      DELETE FROM ai_messages
      WHERE conversation_id = ${id} AND user_id = ${userId}
    `;
        await sql `
      DELETE FROM ai_conversations
      WHERE id = ${id} AND user_id = ${userId}
    `;
        return c.json({ success: true });
    }
    catch (error) {
        console.error('Failed to delete conversation:', error);
        return c.json({ error: 'Failed to delete conversation' }, 500);
    }
}
//# sourceMappingURL=conversations.js.map