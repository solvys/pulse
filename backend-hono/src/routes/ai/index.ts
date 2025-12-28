/**
 * AI Routes
 * Main route registration for AI endpoints
 */

import { Hono } from 'hono';
import * as scoringHandlers from './handlers/scoring.js';
import * as conversationHandlers from './handlers/conversations.js';
import * as chatHandlers from './handlers/chat.js';
import * as quickPulseHandlers from './handlers/quick-pulse.js';
import * as threatHandlers from './handlers/threat.js';
import * as blindSpotHandlers from './handlers/blind-spots.js';
import * as legacyHandlers from './handlers/legacy.js';

const aiRoutes = new Hono();

// IV Scoring Endpoints
aiRoutes.post('/score', scoringHandlers.handleCalculateScore);
aiRoutes.get('/score', scoringHandlers.handleGetScore);
aiRoutes.get('/score/current', scoringHandlers.handleGetCurrentScore);
aiRoutes.get('/score/history', scoringHandlers.handleGetScoreHistory);
aiRoutes.get('/vix', scoringHandlers.handleGetVIX);

// Conversation Endpoints
aiRoutes.get('/conversations', conversationHandlers.handleListConversations);
aiRoutes.get('/conversations/:id', conversationHandlers.handleGetConversation);
aiRoutes.post('/conversations', conversationHandlers.handleCreateConversation);
aiRoutes.delete('/conversations/:id', conversationHandlers.handleDeleteConversation);

// Chat Endpoint (main streaming endpoint)
aiRoutes.post('/chat', chatHandlers.handleChat);

// Quick Pulse Endpoints
aiRoutes.post('/quick-pulse', quickPulseHandlers.handleQuickPulse);
aiRoutes.get('/quick-pulse/cached', quickPulseHandlers.handleGetCachedPulse);

// Threat History Endpoints
aiRoutes.get('/threat-history', threatHandlers.handleGetThreatHistory);
aiRoutes.post('/threat-history/analyze', threatHandlers.handleAnalyzeThreats);

// Blind Spots Endpoints
aiRoutes.get('/blind-spots', blindSpotHandlers.handleGetBlindSpots);
aiRoutes.post('/blind-spots', blindSpotHandlers.handleUpsertBlindSpot);
aiRoutes.delete('/blind-spots/:id', blindSpotHandlers.handleDeleteBlindSpot);

// POST /ai/ntn-report - Generate NTN (Non-Trading News) report
aiRoutes.post('/ntn-report', async (c) => {
  const userId = c.get('userId');

  try {
    return c.json({
      report: {
        content: 'NTN Report: Market analysis and insights would be generated here.',
        generatedAt: new Date().toISOString(),
        userId,
      }
    });
  } catch (error) {
    console.error('Failed to generate NTN report:', error);
    return c.json({ error: 'Failed to generate NTN report' }, 500);
  }
});

// Legacy Endpoints (for frontend compatibility)
aiRoutes.get('/user-settings', legacyHandlers.handleGetUserSettings);
aiRoutes.get('/get-conversation', legacyHandlers.handleGetConversation);
aiRoutes.post('/check-tape', legacyHandlers.handleCheckTape);
aiRoutes.post('/generate-daily-recap', legacyHandlers.handleGenerateDailyRecap);

export { aiRoutes };
