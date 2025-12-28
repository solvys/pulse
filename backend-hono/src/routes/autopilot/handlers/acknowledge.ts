/**
 * Acknowledge Handler
 * Approves or rejects a trading proposal
 */

import { Context } from 'hono';
import { sql } from '../../../db/index.js';
import { checkBlindSpots, invalidateCache } from '../../../services/autopilot-risk.js';
import { acknowledgeSchema } from '../schemas.js';

export async function handleAcknowledge(c: Context) {
  const userId = c.get('userId');
  const body = await c.req.json();
  const result = acknowledgeSchema.safeParse(body);

  if (!result.success) {
    return c.json({ error: 'Invalid request body', details: result.error.flatten() }, 400);
  }

  const { proposalId, action } = result.data;

  try {
    // Get proposal and verify ownership
    const [proposal] = await sql`
      SELECT id, status, account_id, side, size, symbol, contract_id, order_type,
             limit_price, stop_price, stop_loss_ticks, take_profit_ticks, expires_at,
             created_at
      FROM autopilot_proposals
      WHERE id = ${proposalId} AND user_id = ${userId}
    `;

    if (!proposal) {
      return c.json({ error: 'Proposal not found' }, 404);
    }

    if (proposal.status !== 'pending') {
      return c.json({ error: `Proposal is already ${proposal.status}` }, 400);
    }

    // Check if expired
    if (proposal.expires_at && new Date(proposal.expires_at) < new Date()) {
      await sql`
        UPDATE autopilot_proposals
        SET status = 'expired', updated_at = NOW()
        WHERE id = ${proposalId}
      `;
      return c.json({ error: 'Proposal has expired' }, 400);
    }

    // Re-check blind spots if >30 seconds since approval or >5 minutes old
    const proposalAge = Date.now() - new Date(proposal.created_at).getTime();
    if (action === 'approve' && (proposalAge > 30000 || proposalAge > 300000)) {
      const blindSpotCheck = await checkBlindSpots(userId);
      if (blindSpotCheck.blocked) {
        await sql`
          UPDATE autopilot_proposals
          SET status = 'rejected', updated_at = NOW()
          WHERE id = ${proposalId}
        `;
        return c.json({
          success: false,
          error: blindSpotCheck.reason || 'Proposal blocked due to active blind spot',
          blocked: true,
          reason: 'blind_spot',
        }, 400);
      }
    }

    const newStatus = action === 'approve' ? 'approved' : 'rejected';

    await sql`
      UPDATE autopilot_proposals
      SET status = ${newStatus}, updated_at = NOW()
      WHERE id = ${proposalId}
    `;

    // Log system event
    await sql`
      INSERT INTO system_events (user_id, event_type, severity, title, message, metadata)
      VALUES (
        ${userId},
        'autopilot',
        ${action === 'approve' ? 'success' : 'info'},
        ${action === 'approve' ? 'Proposal Approved' : 'Proposal Rejected'},
        ${`Proposal ${proposalId} ${action === 'approve' ? 'approved' : 'rejected'}`},
        ${JSON.stringify({ proposalId, action })}
      )
    `;

    // If rejected, invalidate cache
    if (action === 'reject') {
      invalidateCache(userId);
    }

    return c.json({
      success: true,
      proposalId,
      status: newStatus,
    });
  } catch (error) {
    console.error('Failed to acknowledge proposal:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to acknowledge proposal',
    }, 500);
  }
}
