/**
 * Execute Handler
 * Executes an approved trading proposal
 */
import { sql } from '../../../db/index.js';
import { placeOrder, searchContracts, OrderType, OrderSide } from '../../../services/projectx-service.js';
export async function handleExecute(c) {
    const userId = c.get('userId');
    const body = await c.req.json();
    const proposalId = body.proposalId;
    if (!proposalId || typeof proposalId !== 'number') {
        return c.json({ error: 'proposalId is required' }, 400);
    }
    try {
        // Get proposal and verify it's approved
        const [proposal] = await sql `
      SELECT id, account_id, strategy_name, contract_id, symbol, side, size,
             order_type, limit_price, stop_price, stop_loss_ticks, take_profit_ticks, status
      FROM autopilot_proposals
      WHERE id = ${proposalId} AND user_id = ${userId}
    `;
        if (!proposal) {
            return c.json({ error: 'Proposal not found' }, 404);
        }
        if (proposal.status !== 'approved') {
            return c.json({ error: `Proposal is not approved (status: ${proposal.status})` }, 400);
        }
        // Get contract ID if not provided
        let contractId = proposal.contract_id;
        if (!contractId && proposal.symbol) {
            const contracts = await searchContracts(userId, proposal.symbol, false);
            if (contracts.length === 0) {
                return c.json({ error: `Contract not found for symbol: ${proposal.symbol}` }, 400);
            }
            contractId = contracts[0].id;
        }
        if (!contractId) {
            return c.json({ error: 'Contract ID is required' }, 400);
        }
        // Map order type to ProjectX enum
        const orderTypeMap = {
            limit: OrderType.Limit,
            market: OrderType.Market,
            stop: OrderType.Stop,
            trailingStop: OrderType.TrailingStop,
            joinBid: OrderType.JoinBid,
            joinAsk: OrderType.JoinAsk,
        };
        // Map side to ProjectX enum
        const sideMap = {
            buy: OrderSide.Bid,
            sell: OrderSide.Ask,
            long: OrderSide.Bid,
            short: OrderSide.Ask,
        };
        // Build bracket orders if provided
        const stopLossBracket = proposal.stop_loss_ticks
            ? { ticks: proposal.stop_loss_ticks, type: OrderType.Stop }
            : null;
        const takeProfitBracket = proposal.take_profit_ticks
            ? { ticks: proposal.take_profit_ticks, type: OrderType.Limit }
            : null;
        // Execute order via ProjectX
        const orderResult = await placeOrder(userId, {
            accountId: proposal.account_id,
            contractId: contractId,
            type: orderTypeMap[proposal.order_type] || OrderType.Limit,
            side: sideMap[proposal.side] || OrderSide.Bid,
            size: proposal.size,
            limitPrice: proposal.limit_price || null,
            stopPrice: proposal.stop_price || null,
            stopLossBracket,
            takeProfitBracket,
        });
        // Record execution
        const [execution] = await sql `
      INSERT INTO autopilot_executions (
        proposal_id, user_id, account_id, projectx_order_id,
        contract_id, symbol, side, size, status
      )
      VALUES (
        ${proposalId}, ${userId}, ${proposal.account_id}, ${orderResult.orderId},
        ${contractId}, ${proposal.symbol}, ${proposal.side}, ${proposal.size}, 'executed'
      )
      RETURNING id, execution_timestamp
    `;
        // Update proposal status
        await sql `
      UPDATE autopilot_proposals
      SET status = 'executed', executed_at = NOW(), updated_at = NOW()
      WHERE id = ${proposalId}
    `;
        // Record trade in trades table
        await sql `
      INSERT INTO trades (
        user_id, account_id, contract_id, symbol, side, size,
        entry_price, strategy, opened_at
      )
      VALUES (
        ${userId}, ${proposal.account_id}, ${contractId}, ${proposal.symbol},
        ${proposal.side}, ${proposal.size}, ${proposal.limit_price || proposal.stop_price},
        ${`autopilot:${proposal.strategy_name}`}, NOW()
      )
    `;
        // Log system event
        await sql `
      INSERT INTO system_events (user_id, event_type, severity, title, message, metadata)
      VALUES (
        ${userId},
        'trade',
        'success',
        'Autopilot Trade Executed',
        ${`Executed: ${proposal.side.toUpperCase()} ${proposal.size} ${proposal.symbol} via ${proposal.strategy_name}`},
        ${JSON.stringify({ proposalId, orderId: orderResult.orderId, executionId: execution.id })}
      )
    `;
        return c.json({
            success: true,
            orderId: orderResult.orderId,
            executionId: execution.id,
            executionDetails: {
                proposalId,
                contractId,
                symbol: proposal.symbol,
                side: proposal.side,
                size: proposal.size,
            },
        });
    }
    catch (error) {
        console.error('Failed to execute proposal:', error);
        // Update proposal status to failed
        await sql `
      UPDATE autopilot_proposals
      SET status = 'failed', updated_at = NOW()
      WHERE id = ${proposalId}
    `.catch(() => { });
        // Record failed execution
        await sql `
      INSERT INTO autopilot_executions (
        proposal_id, user_id, account_id, status, error_message
      )
      VALUES (
        ${proposalId}, ${userId}, 0, 'failed',
        ${error instanceof Error ? error.message : 'Unknown error'}
      )
    `.catch(() => { });
        return c.json({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to execute proposal',
        }, 500);
    }
}
//# sourceMappingURL=execute.js.map