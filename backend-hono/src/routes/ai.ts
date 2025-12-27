import { Hono } from 'hono';
import { z } from 'zod';
import { sql } from '../db/index.js';
import {
  calculateIVScore,
  getCurrentIVScore,
  getIVScoreHistory,
  getCurrentVIX,
} from '../services/scoring-service.js';
import {
  getUserBlindSpots,
  getActiveBlindSpots,
  upsertBlindSpot,
  deleteBlindSpot,
} from '../services/blind-spots-service.js';
import {
  getThreatHistory,
  getDailyPnL,
} from '../services/threat-service.js';
import {
  streamAIResponse,
  generateQuickPulseAnalysis,
  analyzeImage,
  generateAIResponse,
  generateThreatAnalysis,
} from '../services/ai-service.js';
import type {
  ConversationResponse,
} from '../types/ai.js';

const aiRoutes = new Hono();

// ============================================================================
// IV Scoring Endpoints
// ============================================================================

// POST /ai/score - Calculate IV score (on-demand)
const scoreRequestSchema = z.object({
  symbol: z.string().optional(),
  instrument: z.string().optional(),
});

aiRoutes.post('/score', async (c) => {
  const userId = c.get('userId');
  const body = await c.req.json();
  const result = scoreRequestSchema.safeParse(body);

  if (!result.success) {
    return c.json({ error: 'Invalid request body', details: result.error.flatten() }, 400);
  }

  try {
    const score = await calculateIVScore(userId, result.data.symbol, result.data.instrument);
    return c.json(score);
  } catch (error) {
    console.error('Failed to calculate IV score:', error);
    return c.json({ error: 'Failed to calculate IV score' }, 500);
  }
});

// GET /ai/score?symbol={symbol} - Get IV score for specific symbol (Autopilot integration)
aiRoutes.get('/score', async (c) => {
  const userId = c.get('userId');
  const symbol = c.req.query('symbol');

  if (!symbol) {
    return c.json({ error: 'Symbol parameter is required' }, 400);
  }

  try {
    const score = await getCurrentIVScore(userId, symbol);
    return c.json(score);
  } catch (error) {
    console.error('Failed to get IV score:', error);
    // Fallback: return default medium score
    return c.json({
      score: 5,
      level: 'medium',
      timestamp: new Date().toISOString(),
    });
  }
});

// GET /ai/score/current - Get current IV score (general market)
aiRoutes.get('/score/current', async (c) => {
  const userId = c.get('userId');

  try {
    const score = await getCurrentIVScore(userId);
    return c.json(score);
  } catch (error) {
    console.error('Failed to get current IV score:', error);
    return c.json({ error: 'Failed to get current IV score' }, 500);
  }
});

// GET /ai/score/history - Get historical scores
const historySchema = z.object({
  symbol: z.string().optional(),
  limit: z.coerce.number().min(1).max(100).default(100),
  offset: z.coerce.number().min(0).default(0),
});

aiRoutes.get('/score/history', async (c) => {
  const userId = c.get('userId');

  const result = historySchema.safeParse({
    symbol: c.req.query('symbol'),
    limit: c.req.query('limit'),
    offset: c.req.query('offset'),
  });

  if (!result.success) {
    return c.json({ error: 'Invalid query parameters', details: result.error.flatten() }, 400);
  }

  try {
    const history = await getIVScoreHistory(userId, result.data.symbol, result.data.limit, result.data.offset);
    return c.json(history);
  } catch (error) {
    console.error('Failed to get IV score history:', error);
    return c.json({ error: 'Failed to get IV score history' }, 500);
  }
});

// GET /ai/vix - Get live VIX ticker value
aiRoutes.get('/vix', async (c) => {
  try {
    const vix = await getCurrentVIX();
    return c.json(vix);
  } catch (error) {
    console.error('Failed to get VIX:', error);
    return c.json({
      value: 15.0,
      timestamp: new Date().toISOString(),
      source: 'fallback',
    });
  }
});

// ============================================================================
// Chat Endpoints
// ============================================================================

// GET /ai/conversations - List user conversations
aiRoutes.get('/conversations', async (c) => {
  const userId = c.get('userId');

  try {
    const conversations = await sql`
      SELECT 
        id, user_id, title, created_at, updated_at
      FROM ai_conversations
      WHERE user_id = ${userId}
      ORDER BY updated_at DESC
    `;

    const formatted: ConversationResponse[] = conversations.map((conv: any) => ({
      conversationId: conv.id.toString(),
      title: conv.title || undefined,
      updatedAt: conv.updated_at.toISOString(),
      createdAt: conv.created_at.toISOString(),
    }));

    return c.json({
      conversations: formatted,
      total: formatted.length,
    });
  } catch (error) {
    console.error('Failed to get conversations:', error);
    return c.json({ error: 'Failed to get conversations' }, 500);
  }
});

// GET /ai/conversations/:id - Get conversation history with messages
aiRoutes.get('/conversations/:id', async (c) => {
  const userId = c.get('userId');
  const conversationId = c.req.param('id');

  try {
    // Verify conversation belongs to user
    const [conversation] = await sql`
      SELECT id, user_id
      FROM ai_conversations
      WHERE id = ${parseInt(conversationId)} AND user_id = ${userId}
    `;

    if (!conversation) {
      return c.json({ error: 'Conversation not found' }, 404);
    }

    // Get messages
    const messages = await sql`
      SELECT id, conversation_id, role, content, created_at
      FROM ai_messages
      WHERE conversation_id = ${parseInt(conversationId)}
      ORDER BY created_at ASC
    `;

    return c.json({
      conversationId: conversation.id.toString(),
      messages: messages.map((msg: any) => ({
        id: msg.id.toString(),
        role: msg.role,
        content: msg.content,
        timestamp: msg.created_at.toISOString(),
      })),
    });
  } catch (error) {
    console.error('Failed to get conversation:', error);
    return c.json({ error: 'Failed to get conversation' }, 500);
  }
});

// POST /ai/conversations - Create new conversation
const createConversationSchema = z.object({
  title: z.string().optional(),
});

aiRoutes.post('/conversations', async (c) => {
  const userId = c.get('userId');
  const body = await c.req.json();
  const result = createConversationSchema.safeParse(body);

  if (!result.success) {
    return c.json({ error: 'Invalid request body', details: result.error.flatten() }, 400);
  }

  try {
    const [conversation] = await sql`
      INSERT INTO ai_conversations (user_id, title)
      VALUES (${userId}, ${result.data.title || null})
      RETURNING id, user_id, title, created_at, updated_at
    `;

    return c.json({
      conversationId: conversation.id.toString(),
      title: conversation.title || undefined,
      createdAt: conversation.created_at.toISOString(),
      updatedAt: conversation.updated_at.toISOString(),
    });
  } catch (error) {
    console.error('Failed to create conversation:', error);
    return c.json({ error: 'Failed to create conversation' }, 500);
  }
});

// DELETE /ai/conversations/:id - Delete conversation
aiRoutes.delete('/conversations/:id', async (c) => {
  const userId = c.get('userId');
  const conversationId = c.req.param('id');

  try {
    // Verify conversation belongs to user
    const [conversation] = await sql`
      SELECT id
      FROM ai_conversations
      WHERE id = ${parseInt(conversationId)} AND user_id = ${userId}
    `;

    if (!conversation) {
      return c.json({ error: 'Conversation not found' }, 404);
    }

    // Delete conversation (messages will be cascade deleted)
    await sql`
      DELETE FROM ai_conversations
      WHERE id = ${parseInt(conversationId)} AND user_id = ${userId}
    `;

    return c.json({ success: true });
  } catch (error) {
    console.error('Failed to delete conversation:', error);
    return c.json({ error: 'Failed to delete conversation' }, 500);
  }
});

// POST /ai/chat - Send message, get streaming AI response
const chatRequestSchema = z.object({
  message: z.string().min(1),
  conversationId: z.string().optional(),
  model: z.enum(['grok-4', 'claude-opus-4', 'claude-sonnet-4.5']).optional(),
});

aiRoutes.post('/chat', async (c) => {
  const userId = c.get('userId');
  const body = await c.req.json();
  const result = chatRequestSchema.safeParse(body);

  if (!result.success) {
    return c.json({ error: 'Invalid request body', details: result.error.flatten() }, 400);
  }

  const { message, conversationId, model = 'grok-4' } = result.data;

  try {
    let convId: number;

    // Get or create conversation
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

    // Store user message
    await sql`
      INSERT INTO ai_messages (conversation_id, role, content)
      VALUES (${convId}, 'user', ${message})
    `;

    // Get conversation history for context
    const historyMessages = await sql`
      SELECT role, content
      FROM ai_messages
      WHERE conversation_id = ${convId}
      ORDER BY created_at ASC
      LIMIT 20
    `;

    const conversationHistory = historyMessages.map((msg: any) => ({
      role: msg.role as 'user' | 'assistant',
      content: msg.content,
    }));

    // Get blind spots for context
    const activeBlindSpots = await getActiveBlindSpots(userId);
    const blindSpotContext = activeBlindSpots.length > 0
      ? [`Active blind spots: ${activeBlindSpots.map(bs => bs.name).join(', ')}`]
      : [];

    // Generate AI response with 3-tier fallback: Opus -> Grok -> Sonnet 4.5
    let fullResponse = '';
    const fallbackModels: Array<'claude-opus-4' | 'grok-4' | 'claude-sonnet-4.5'> = 
      model === 'claude-opus-4' 
        ? ['claude-opus-4', 'grok-4', 'claude-sonnet-4.5']
        : model === 'grok-4'
        ? ['grok-4', 'claude-opus-4', 'claude-sonnet-4.5']
        : model === 'claude-sonnet-4.5'
        ? ['claude-sonnet-4.5', 'claude-opus-4', 'grok-4']
        : ['claude-opus-4', 'grok-4', 'claude-sonnet-4.5']; // Default fallback chain

    let lastError: Error | null = null;
    for (const fallbackModel of fallbackModels) {
      try {
        for await (const chunk of streamAIResponse(
          message,
          conversationHistory.slice(0, -1), // Exclude the current message
          fallbackModel,
          blindSpotContext
        )) {
          fullResponse += chunk;
        }
        // Success - break out of fallback loop
        break;
      } catch (error) {
        console.error(`AI response error with ${fallbackModel}:`, error);
        lastError = error instanceof Error ? error : new Error(String(error));
        // Continue to next fallback model
        fullResponse = ''; // Reset response for next attempt
      }
    }

    // If all models failed, use fallback message
    if (!fullResponse && lastError) {
      console.error('All AI models failed, using fallback message');
      fullResponse = "I'm having trouble processing that right now. Please try again.";
    }

    // Store assistant message
    await sql`
      INSERT INTO ai_messages (conversation_id, role, content)
      VALUES (${convId}, 'assistant', ${fullResponse})
    `;

    // Update conversation updated_at
    await sql`
      UPDATE ai_conversations
      SET updated_at = NOW()
      WHERE id = ${convId}
    `;

    // Return response matching frontend API contract
    return c.json({
      message: fullResponse,
      conversationId: convId.toString(),
      messageId: Date.now().toString(),
      references: activeBlindSpots.length > 0 ? activeBlindSpots.map(bs => bs.name) : undefined,
    });
  } catch (error) {
    console.error('Chat error:', error);
    return c.json({ error: 'Failed to process chat message' }, 500);
  }
});

// ============================================================================
// Quick Pulse Analysis Endpoints
// ============================================================================

// POST /ai/quick-pulse - Generate quick pulse analysis
aiRoutes.post('/quick-pulse', async (c) => {
  const userId = c.get('userId');

  try {
    // Get current IV score and VIX
    const ivScore = await getCurrentIVScore(userId);
    const vix = await getCurrentVIX();

    // Check for screenshot upload (web app)
    let screenshotAnalysis: string | undefined;
    const formData = await c.req.formData();
    const screenshot = formData.get('screenshot');

    if (screenshot && typeof screenshot !== 'string') {
      const arrayBuffer = await screenshot.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      screenshotAnalysis = await analyzeImage(
        buffer,
        'Analyze this TopStepX trading interface screenshot. Identify current market state, positions, and key indicators.',
        `Current VIX: ${vix.value}, IV Score: ${ivScore.score}`
      );
    }

    // Generate analysis
    const analysis = await generateQuickPulseAnalysis(
      ivScore.score,
      vix.value,
      undefined,
      screenshotAnalysis
    );

    // Cache analysis for 1 minute
    const expiresAt = new Date(Date.now() + 60 * 1000);
    await sql`
      INSERT INTO pulse_analysis (user_id, analysis, screenshot_url, expires_at)
      VALUES (${userId}, ${JSON.stringify({ analysis, ivScore, vix })}, ${screenshot ? 'screenshot' : null}, ${expiresAt})
    `;

    return c.json({
      analysis,
      ivScore: ivScore.score,
      vix: vix.value,
      timestamp: new Date().toISOString(),
      cached: false,
    });
  } catch (error) {
    console.error('Quick pulse analysis error:', error);
    return c.json({ error: 'Failed to generate quick pulse analysis' }, 500);
  }
});

// GET /ai/quick-pulse/cached - Get cached analysis
aiRoutes.get('/quick-pulse/cached', async (c) => {
  const userId = c.get('userId');

  try {
    const [cached] = await sql`
      SELECT analysis, created_at, expires_at
      FROM pulse_analysis
      WHERE user_id = ${userId}
        AND expires_at > NOW()
      ORDER BY created_at DESC
      LIMIT 1
    `;

    if (!cached) {
      return c.json({ error: 'No cached analysis available' }, 404);
    }

    const analysisData = cached.analysis as any;
    return c.json({
      ...analysisData,
      timestamp: cached.created_at.toISOString(),
      cached: true,
    });
  } catch (error) {
    console.error('Failed to get cached analysis:', error);
    return c.json({ error: 'Failed to get cached analysis' }, 500);
  }
});

// ============================================================================
// Threat History Endpoints
// ============================================================================

// GET /ai/threat-history - Get threat history for user
aiRoutes.get('/threat-history', async (c) => {
  const userId = c.get('userId');
  const activeOnly = c.req.query('active') === 'true';

  try {
    const threatHistory = await getThreatHistory(userId, activeOnly);
    return c.json(threatHistory);
  } catch (error) {
    console.error('Failed to get threat history:', error);
    return c.json({ error: 'Failed to get threat history' }, 500);
  }
});

// POST /ai/threat-history/analyze - AI-powered threat analysis
const threatAnalysisSchema = z.object({
  timeRange: z.enum(['day', 'week', 'month']).optional(),
  includeAnalysis: z.boolean().optional(),
});

aiRoutes.post('/threat-history/analyze', async (c) => {
  const userId = c.get('userId');
  const body = await c.req.json();
  const result = threatAnalysisSchema.safeParse(body);

  if (!result.success) {
    return c.json({ error: 'Invalid request body', details: result.error.flatten() }, 400);
  }

  try {
    const threatHistory = await getThreatHistory(userId, false);
    const dailyPnL = await getDailyPnL(userId);

    if (result.data.includeAnalysis && threatHistory.threats.length > 0) {
      const threatData = JSON.stringify(threatHistory.threats, null, 2);
      const tradingHistory = `Daily P&L: ${dailyPnL}`;

      const analysis = await generateThreatAnalysis(threatData, tradingHistory);
      return c.json({
        ...threatHistory,
        analysis,
      });
    }

    return c.json(threatHistory);
  } catch (error) {
    console.error('Failed to analyze threats:', error);
    return c.json({ error: 'Failed to analyze threats' }, 500);
  }
});

// ============================================================================
// Blind Spots Endpoints
// ============================================================================

// GET /ai/blind-spots - Get user's blind spots
aiRoutes.get('/blind-spots', async (c) => {
  const userId = c.get('userId');

  try {
    const blindSpots = await getUserBlindSpots(userId);
    return c.json(blindSpots);
  } catch (error) {
    console.error('Failed to get blind spots:', error);
    return c.json({ error: 'Failed to get blind spots' }, 500);
  }
});

// POST /ai/blind-spots - Add/update blind spot
const blindSpotSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
  category: z.enum(['behavioral', 'risk', 'execution', 'custom']).optional(),
  isActive: z.boolean().optional(),
});

aiRoutes.post('/blind-spots', async (c) => {
  const userId = c.get('userId');
  const body = await c.req.json();
  const result = blindSpotSchema.safeParse(body);

  if (!result.success) {
    return c.json({ error: 'Invalid request body', details: result.error.flatten() }, 400);
  }

  try {
    const blindSpot = await upsertBlindSpot(userId, result.data.id, result.data);
    return c.json(blindSpot);
  } catch (error) {
    console.error('Failed to upsert blind spot:', error);
    return c.json({ error: 'Failed to upsert blind spot' }, 500);
  }
});

// DELETE /ai/blind-spots/:id - Remove blind spot
aiRoutes.delete('/blind-spots/:id', async (c) => {
  const userId = c.get('userId');
  const blindSpotId = c.req.param('id');

  try {
    await deleteBlindSpot(userId, blindSpotId);
    return c.json({ success: true });
  } catch (error) {
    console.error('Failed to delete blind spot:', error);
    if (error instanceof Error && error.message.includes('guard-railed')) {
      return c.json({ error: 'Cannot delete guard-railed blind spot' }, 400);
    }
    return c.json({ error: 'Failed to delete blind spot' }, 500);
  }
});

// ============================================================================
// User Settings Endpoint (for Autopilot)
// ============================================================================

// GET /ai/user-settings - Get user settings (for Autopilot: "usual trades per duration")
aiRoutes.get('/user-settings', async (c) => {
  // const userId = c.get('userId'); // Reserved for future use

  try {
    // Check if user_settings table exists, otherwise return defaults
    // For now, return default values - this would need to be implemented based on actual settings table structure
    return c.json({
      usualTradesPerDuration: 10, // Default
      durationWindow: '24h', // Default
      selectedInstrument: null,
    });
  } catch (error) {
    console.error('Failed to get user settings:', error);
    return c.json({
      usualTradesPerDuration: 10,
      durationWindow: '24h',
      selectedInstrument: null,
    });
  }
});

// GET /ai/get-conversation - Get conversation (frontend compatibility)
aiRoutes.get('/get-conversation', async (c) => {
  const userId = c.get('userId');
  const conversationId = c.req.query('conversationId');

  if (!conversationId) {
    return c.json({ error: 'conversationId is required' }, 400);
  }

  try {
    // Verify conversation belongs to user
    const [conversation] = await sql`
      SELECT id, user_id
      FROM ai_conversations
      WHERE id = ${parseInt(conversationId)} AND user_id = ${userId}
    `;

    if (!conversation) {
      return c.json({ error: 'Conversation not found' }, 404);
    }

    // Get messages
    const messages = await sql`
      SELECT id, conversation_id, role, content, created_at
      FROM ai_messages
      WHERE conversation_id = ${parseInt(conversationId)}
      ORDER BY created_at ASC
    `;

    return c.json({
      conversationId: conversation.id.toString(),
      messages: messages.map((msg: any) => ({
        id: msg.id.toString(),
        role: msg.role,
        content: msg.content,
        timestamp: msg.created_at.toISOString(),
      })),
    });
  } catch (error) {
    console.error('Failed to get conversation:', error);
    return c.json({ error: 'Failed to get conversation' }, 500);
  }
});

// POST /ai/check-tape - Check the tape (market analysis)
aiRoutes.post('/check-tape', async (c) => {
  const userId = c.get('userId');

  try {
    // Get current market state
    const ivScore = await getCurrentIVScore(userId);
    const vix = await getCurrentVIX();

    // Generate tape analysis
    const analysis = await generateQuickPulseAnalysis(
      ivScore.score,
      vix.value,
      { timestamp: new Date().toISOString() }
    );

    return c.json({
      message: analysis,
      insights: [
        { type: 'iv_score', value: ivScore.score, level: ivScore.level },
        { type: 'vix', value: vix.value },
      ],
    });
  } catch (error) {
    console.error('Check tape error:', error);
    return c.json({
      message: "I'm having trouble checking the tape right now. Please try again in a moment.",
      insights: [],
    });
  }
});

// POST /ai/generate-daily-recap - Generate daily recap
aiRoutes.post('/generate-daily-recap', async (c) => {
  const userId = c.get('userId');

  try {
    // Get today's trading data
    const dailyPnL = await getDailyPnL(userId);
    const today = new Date().toISOString().split('T')[0];

    const [tradeStats] = await sql`
      SELECT 
        COUNT(*)::integer as trade_count,
        SUM(CASE WHEN pnl > 0 THEN 1 ELSE 0 END)::integer as wins,
        SUM(CASE WHEN pnl < 0 THEN 1 ELSE 0 END)::integer as losses
      FROM trades
      WHERE user_id = ${userId}
        AND DATE(opened_at) = ${today}::date
    `;

    // Get threats for today
    const threats = await getThreatHistory(userId, true);

    // Generate recap using AI
    const recapPrompt = `Generate a daily trading recap for today (${today}):

Daily P&L: $${dailyPnL.toFixed(2)}
Total Trades: ${tradeStats?.trade_count || 0}
Wins: ${tradeStats?.wins || 0}
Losses: ${tradeStats?.losses || 0}
Threats Detected: ${threats.threats.length}

Provide a concise, encouraging recap that highlights key achievements and areas for improvement.`;

    const recap = await generateAIResponse(recapPrompt, 'grok-4');

    return c.json({
      message: recap,
      recap: recap,
    });
  } catch (error) {
    console.error('Daily recap error:', error);
    return c.json({
      message: "I'm having trouble generating your daily recap right now. Please try again later.",
    });
  }
});


export { aiRoutes };
