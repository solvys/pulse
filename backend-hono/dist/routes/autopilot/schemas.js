/**
 * Autopilot Route Schemas
 * Validation schemas for autopilot API endpoints
 */
import { z } from 'zod';
export const proposeSchema = z.object({
    strategyName: z.string().min(1),
    accountId: z.number(),
    contractId: z.string().optional(),
    symbol: z.string().min(1),
    side: z.enum(['buy', 'sell', 'long', 'short']),
    size: z.number().positive(),
    orderType: z.enum(['limit', 'market', 'stop', 'trailingStop', 'joinBid', 'joinAsk']),
    limitPrice: z.number().optional(),
    stopPrice: z.number().optional(),
    stopLossTicks: z.number().optional(),
    takeProfitTicks: z.number().optional(),
    reasoning: z.string().optional(),
});
export const acknowledgeSchema = z.object({
    proposalId: z.number(),
    action: z.enum(['approve', 'reject']),
});
export const listProposalsSchema = z.object({
    status: z.enum(['draft', 'pending', 'approved', 'rejected', 'expired', 'executed', 'failed']).optional(),
    strategy: z.string().optional(),
    limit: z.coerce.number().min(1).max(100).default(50),
    offset: z.coerce.number().min(0).default(0),
});
export const updateSettingsSchema = z.object({
    enabled: z.boolean().optional(),
    dailyLossLimit: z.number().optional(),
    maxPositionSize: z.number().optional(),
    defaultOrderType: z.string().optional(),
    requireStopLoss: z.boolean().optional(),
    strategyEnabled: z.record(z.boolean()).optional(),
    positionSizingMethod: z.string().optional(),
    positionSizingValue: z.number().optional(),
    riskLevel: z.enum(['low', 'medium', 'high']).optional(),
    selectedInstrument: z.string().optional(),
    primaryInstrument: z.string().optional(),
    correlatedPairSymbol: z.string().optional(),
    rsiOverboughtThreshold: z.number().optional(),
    rsiOversoldThreshold: z.number().optional(),
    semiAutopilotWindow: z.any().optional(),
    fullAutopilotWindow: z.any().optional(),
});
export const detectAntiLagSchema = z.object({
    primarySymbol: z.string().min(1),
    correlatedSymbol: z.string().min(1),
    lookbackSeconds: z.number().optional(),
});
//# sourceMappingURL=schemas.js.map