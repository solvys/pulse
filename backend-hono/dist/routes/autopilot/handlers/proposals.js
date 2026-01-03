/**
 * Proposals Handlers
 * List and get proposal details
 */
import { sql } from '../../../db/index.js';
import { listProposalsSchema } from '../schemas.js';
export async function handleListProposals(c) {
    const userId = c.get('userId');
    const result = listProposalsSchema.safeParse({
        status: c.req.query('status'),
        strategy: c.req.query('strategy'),
        limit: c.req.query('limit'),
        offset: c.req.query('offset'),
    });
    if (!result.success) {
        return c.json({ error: 'Invalid query parameters', details: result.error.flatten() }, 400);
    }
    const { status, strategy, limit, offset } = result.data;
    try {
        let query = sql `
      SELECT 
        id, account_id as "accountId", strategy_name as "strategyName",
        contract_id as "contractId", symbol, side, size, order_type as "orderType",
        limit_price as "limitPrice", stop_price as "stopPrice",
        stop_loss_ticks as "stopLossTicks", take_profit_ticks as "takeProfitTicks",
        status, risk_metrics as "riskMetrics", reasoning,
        created_at as "createdAt", updated_at as "updatedAt",
        expires_at as "expiresAt", executed_at as "executedAt"
      FROM autopilot_proposals
      WHERE user_id = ${userId}
    `;
        if (status) {
            query = sql `${query} AND status = ${status}`;
        }
        if (strategy) {
            query = sql `${query} AND strategy_name = ${strategy}`;
        }
        query = sql `${query} ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`;
        const proposals = await query;
        // Get total count
        let countQuery = sql `SELECT COUNT(*)::integer as count FROM autopilot_proposals WHERE user_id = ${userId}`;
        if (status) {
            countQuery = sql `${countQuery} AND status = ${status}`;
        }
        if (strategy) {
            countQuery = sql `${countQuery} AND strategy_name = ${strategy}`;
        }
        const [countResult] = await countQuery;
        return c.json({
            proposals: proposals || [],
            total: countResult?.count || 0,
        });
    }
    catch (error) {
        console.error('Failed to list proposals:', error);
        return c.json({ error: 'Failed to list proposals' }, 500);
    }
}
export async function handleGetProposal(c) {
    const userId = c.get('userId');
    const proposalId = c.req.param('id');
    const id = parseInt(proposalId, 10);
    if (isNaN(id)) {
        return c.json({ error: 'Invalid proposal ID' }, 400);
    }
    try {
        const [proposal] = await sql `
      SELECT 
        id, account_id as "accountId", strategy_name as "strategyName",
        contract_id as "contractId", symbol, side, size, order_type as "orderType",
        limit_price as "limitPrice", stop_price as "stopPrice",
        stop_loss_ticks as "stopLossTicks", take_profit_ticks as "takeProfitTicks",
        status, risk_metrics as "riskMetrics", reasoning,
        created_at as "createdAt", updated_at as "updatedAt",
        expires_at as "expiresAt", executed_at as "executedAt"
      FROM autopilot_proposals
      WHERE id = ${id} AND user_id = ${userId}
    `;
        if (!proposal) {
            return c.json({ error: 'Proposal not found' }, 404);
        }
        return c.json(proposal);
    }
    catch (error) {
        console.error('Failed to get proposal:', error);
        return c.json({ error: 'Failed to get proposal' }, 500);
    }
}
//# sourceMappingURL=proposals.js.map