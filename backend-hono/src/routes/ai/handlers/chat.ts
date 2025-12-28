/**
 * Chat Handler
 * Main chat endpoint with streaming AI responses
 */

import { Context } from 'hono';
import { sql } from '../../../db/index.js';
import { getActiveBlindSpots } from '../../../services/blind-spots-service.js';
import { createStreamingChatResponse } from '../../../services/ai-service.js';
import { chatRequestSchema } from '../schemas.js';
import { getRelevantAnnotationsForContext } from '../../../services/admin-annotations-service.js';

// UIMessage type definition (matches @ai-sdk/react UIMessage structure)
type UIMessage = {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  parts?: Array<{ type: string; text?: string;[key: string]: any }>;
};

export async function handleChat(c: Context) {
  const userId = c.get('userId');

  // #region agent log - hypothesis B, E
  fetch('http://127.0.0.1:7244/ingest/fbebf980-5e49-4327-9406-872372234680', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      location: 'chat.ts:handleChat',
      message: 'Chat request received',
      data: { userId, method: c.req.method, path: c.req.path },
      timestamp: Date.now(),
      sessionId: 'debug-session',
      runId: 'initial',
      hypothesisId: 'B,E'
    })
  }).catch(() => { });
  // #endregion

  const body = await c.req.json();
  const result = chatRequestSchema.safeParse(body);

  if (!result.success) {
    // #region agent log - hypothesis B
    fetch('http://127.0.0.1:7244/ingest/fbebf980-5e49-4327-9406-872372234680', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        location: 'chat.ts:validation-failed',
        message: 'Request validation failed',
        data: { errors: result.error.flatten(), userId },
        timestamp: Date.now(),
        sessionId: 'debug-session',
        runId: 'initial',
        hypothesisId: 'B'
      })
    }).catch(() => { });
    // #endregion
    return c.json({ error: 'Invalid request body', details: result.error.flatten() }, 400);
  }

  const { messages: uiMessages, conversationId, model = 'claude-opus-4' } = result.data;

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

    // Fetch recent news items for context (last 10 items, Level 3 and 4 only)
    const recentNews = await sql`
      SELECT title, content, source, macro_level, price_brain_sentiment, price_brain_classification
      FROM news_articles
      WHERE macro_level IN (3, 4)
      ORDER BY published_at DESC
      LIMIT 10
    `;

    const newsContext = recentNews.length > 0
      ? [`Recent high-priority news (${recentNews.length} items):\n${recentNews.map((n: any) =>
        `- [Level ${n.macro_level}] ${n.title} (${n.source}) - ${n.price_brain_sentiment || 'Neutral'} / ${n.price_brain_classification || 'Neutral'}`
      ).join('\n')}`]
      : [];

    // Fetch admin annotations for RAG-based learning (improves IV scoring and analysis)
    let adminAnnotations: string[] = [];
    try {
      adminAnnotations = await getRelevantAnnotationsForContext(15);
    } catch (error) {
      console.error('Error fetching admin annotations:', error);
      // Continue without annotations if fetch fails
    }

    const context = [...blindSpotContext, ...newsContext, ...adminAnnotations];

    const formattedUIMessages: UIMessage[] = uiMessages.map((msg) => ({
      id: msg.id || `msg-${Date.now()}-${Math.random()}`,
      role: msg.role,
      content: msg.content || (msg.parts?.find((p: any) => p.type === 'text')?.text || ''),
      parts: msg.parts || [{ type: 'text', text: msg.content }],
    }));

    const streamingResponse = await createStreamingChatResponse(
      formattedUIMessages,
      model,
      context,
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
      },
      // Enable tools for all models or conditionally
      true
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
