/**
 * Legacy Handlers
 * Legacy endpoints for frontend compatibility
 */

import { Context } from 'hono';
import { sql } from '../../../db/index.js';
import { getCurrentIVScore, getCurrentVIX } from '../../../services/scoring-service.js';
import { generateQuickPulseAnalysis, generateAIResponse } from '../../../services/ai-service.js';
import { getThreatHistory, getDailyPnL } from '../../../services/threat-service.js';

export async function handleGetUserSettings(c: Context) {
  try {
    return c.json({
      usualTradesPerDuration: 10,
      durationWindow: '24h',
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
}

export async function handleGetConversation(c: Context) {
  const userId = c.get('userId');
  const conversationId = c.req.query('conversationId');

  if (!conversationId) {
    return c.json({ error: 'conversationId is required' }, 400);
  }

  try {
    const [conversation] = await sql`
      SELECT id, user_id
      FROM ai_conversations
      WHERE id = ${parseInt(conversationId)} AND user_id = ${userId}
    `;

    if (!conversation) {
      return c.json({ error: 'Conversation not found' }, 404);
    }

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
}

export async function handleCheckTape(c: Context) {
  const userId = c.get('userId');

  try {
    const ivScore = await getCurrentIVScore(userId);
    const vix = await getCurrentVIX();

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
}

export async function handleGenerateDailyRecap(c: Context) {
  const userId = c.get('userId');

  try {
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

    const threats = await getThreatHistory(userId, true);

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
      recap: '',
    });
  }
}
