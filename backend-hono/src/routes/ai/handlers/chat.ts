/**
 * Chat Handler
 * Main chat endpoint with streaming AI responses
 */

import { Context } from 'hono';
import { sql } from '../../../db/index.js';
import { getActiveBlindSpots } from '../../../services/blind-spots-service.js';
import { createStreamingChatResponse } from '../../../services/ai-service.js';
import { chatRequestSchema } from '../schemas.js';

// UIMessage type definition (matches @ai-sdk/react UIMessage structure)
type UIMessage = {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  parts?: Array<{ type: string; text?: string; [key: string]: any }>;
};

export async function handleChat(c: Context) {
  const userId = c.get('userId');
  const body = await c.req.json();
  const result = chatRequestSchema.safeParse(body);

  if (!result.success) {
    return c.json({ error: 'Invalid request body', details: result.error.flatten() }, 400);
  }

  const { messages: uiMessages, conversationId, model = 'grok-4' } = result.data;

  if (!uiMessages || uiMessages.length === 0) {
    return c.json({ error: 'Messages array is required' }, 400);
  }

  const lastMessage = uiMessages[uiMessages.length - 1];
  if (lastMessage.role !== 'user') {
    return c.json({ error: 'Last message must be from user' }, 400);
  }

  try {
    let convId: number;

    if (conversationId) {
      const [existing] = await sql`
        SELECT id
        FROM ai_conversations
        WHERE id = ${parseInt(conversationId)} AND user_id = ${userId}
      `;

      if (!existing) {
        return c.json({ error: 'Conversation not found' }, 404);
      }

      convId = existing.id;
    } else {
      const [newConv] = await sql`
        INSERT INTO ai_conversations (user_id)
        VALUES (${userId})
        RETURNING id
      `;
      convId = newConv.id;
    }

    const userMessageContent = lastMessage.content;
    await sql`
      INSERT INTO ai_messages (conversation_id, role, content)
      VALUES (${convId}, 'user', ${userMessageContent})
    `;

    const activeBlindSpots = await getActiveBlindSpots(userId);
    const blindSpotContext = activeBlindSpots.length > 0
      ? [`Active blind spots: ${activeBlindSpots.map(bs => bs.name).join(', ')}`]
      : [];

    const formattedUIMessages: UIMessage[] = uiMessages.map((msg) => ({
      id: msg.id || `msg-${Date.now()}-${Math.random()}`,
      role: msg.role,
      content: msg.content || (msg.parts?.find((p: any) => p.type === 'text')?.text || ''),
      parts: msg.parts || [{ type: 'text', text: msg.content }],
    }));

    const streamingResponse = await createStreamingChatResponse(
      formattedUIMessages,
      model,
      blindSpotContext,
      async (fullResponse: string) => {
        try {
          await sql`
            INSERT INTO ai_messages (conversation_id, role, content)
            VALUES (${convId}, 'assistant', ${fullResponse})
          `;

          await sql`
            UPDATE ai_conversations
            SET updated_at = NOW()
            WHERE id = ${convId}
          `;
        } catch (error) {
          console.error('Error storing assistant message:', error);
        }
      }
    );

    return new Response(streamingResponse.body, {
      status: streamingResponse.status,
      statusText: streamingResponse.statusText,
      headers: {
        ...Object.fromEntries(streamingResponse.headers.entries()),
        'X-Conversation-Id': convId.toString(),
        'X-References': activeBlindSpots.length > 0 ? activeBlindSpots.map(bs => bs.name).join(',') : '',
      },
    });
  } catch (error) {
    console.error('Chat error:', error);
    return c.json({ 
      error: 'Failed to process chat message',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
}
