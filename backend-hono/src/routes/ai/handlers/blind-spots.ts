/**
 * Blind Spots Handlers
 * Blind spot management endpoints
 */

import { Context } from 'hono';
import { getUserBlindSpots, upsertBlindSpot, deleteBlindSpot } from '../../../services/blind-spots-service.js';
import { blindSpotSchema } from '../schemas.js';

export async function handleGetBlindSpots(c: Context) {
  const userId = c.get('userId');

  try {
    const blindSpots = await getUserBlindSpots(userId);
    return c.json(blindSpots);
  } catch (error) {
    console.error('Failed to get blind spots:', error);
    return c.json({ error: 'Failed to get blind spots' }, 500);
  }
}

export async function handleUpsertBlindSpot(c: Context) {
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
}

export async function handleDeleteBlindSpot(c: Context) {
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
}
