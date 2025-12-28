/**
 * Quick Pulse Handlers
 * Quick pulse analysis endpoints
 */

import { Context } from 'hono';
import { sql } from '../../../db/index.js';
import { getCurrentIVScore, getCurrentVIX } from '../../../services/scoring-service.js';
import { generateQuickPulseAnalysis, analyzeImage } from '../../../services/ai-service.js';

export async function handleQuickPulse(c: Context) {
  const userId = c.get('userId');

  try {
    const ivScore = await getCurrentIVScore(userId);
    const vix = await getCurrentVIX();

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

    const analysis = await generateQuickPulseAnalysis(
      ivScore.score,
      vix.value,
      undefined,
      screenshotAnalysis
    );

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
}

export async function handleGetCachedPulse(c: Context) {
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
}
