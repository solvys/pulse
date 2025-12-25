import { Hono } from 'hono';
import { sql } from '../db/index.js';

const aiRoutes = new Hono();

// GET /ai/conversations - Get AI conversation threads
aiRoutes.get('/conversations', async (c) => {
  const userId = c.get('userId');

  try {
    // For now, return empty array since chat_threads table is in Encore backend
    // This can be migrated later if needed
    return c.json({
      conversations: [],
      total: 0,
    });
  } catch (error) {
    console.error('Failed to get conversations:', error);
    return c.json({ error: 'Failed to get conversations' }, 500);
  }
});

export { aiRoutes };
