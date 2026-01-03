/**
 * Autopilot Route Schemas
 * Validation schemas for autopilot API endpoints
 */
import { z } from 'zod';
export declare const proposeSchema: z.ZodObject<{
    strategyName: z.ZodString;
    accountId: z.ZodNumber;
    contractId: z.ZodOptional<z.ZodString>;
    symbol: z.ZodString;
    side: z.ZodEnum<["buy", "sell", "long", "short"]>;
    size: z.ZodNumber;
    orderType: z.ZodEnum<["limit", "market", "stop", "trailingStop", "joinBid", "joinAsk"]>;
    limitPrice: z.ZodOptional<z.ZodNumber>;
    stopPrice: z.ZodOptional<z.ZodNumber>;
    stopLossTicks: z.ZodOptional<z.ZodNumber>;
    takeProfitTicks: z.ZodOptional<z.ZodNumber>;
    reasoning: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    symbol: string;
    accountId: number;
    side: "buy" | "sell" | "long" | "short";
    size: number;
    orderType: "market" | "limit" | "stop" | "trailingStop" | "joinBid" | "joinAsk";
    strategyName: string;
    limitPrice?: number | undefined;
    stopPrice?: number | undefined;
    stopLossTicks?: number | undefined;
    takeProfitTicks?: number | undefined;
    contractId?: string | undefined;
    reasoning?: string | undefined;
}, {
    symbol: string;
    accountId: number;
    side: "buy" | "sell" | "long" | "short";
    size: number;
    orderType: "market" | "limit" | "stop" | "trailingStop" | "joinBid" | "joinAsk";
    strategyName: string;
    limitPrice?: number | undefined;
    stopPrice?: number | undefined;
    stopLossTicks?: number | undefined;
    takeProfitTicks?: number | undefined;
    contractId?: string | undefined;
    reasoning?: string | undefined;
}>;
export declare const acknowledgeSchema: z.ZodObject<{
    proposalId: z.ZodNumber;
    action: z.ZodEnum<["approve", "reject"]>;
}, "strip", z.ZodTypeAny, {
    proposalId: number;
    action: "approve" | "reject";
}, {
    proposalId: number;
    action: "approve" | "reject";
}>;
export declare const listProposalsSchema: z.ZodObject<{
    status: z.ZodOptional<z.ZodEnum<["draft", "pending", "approved", "rejected", "expired", "executed", "failed"]>>;
    strategy: z.ZodOptional<z.ZodString>;
    limit: z.ZodDefault<z.ZodNumber>;
    offset: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    limit: number;
    offset: number;
    status?: "failed" | "draft" | "pending" | "approved" | "rejected" | "expired" | "executed" | undefined;
    strategy?: string | undefined;
}, {
    status?: "failed" | "draft" | "pending" | "approved" | "rejected" | "expired" | "executed" | undefined;
    limit?: number | undefined;
    strategy?: string | undefined;
    offset?: number | undefined;
}>;
export declare const updateSettingsSchema: z.ZodObject<{
    enabled: z.ZodOptional<z.ZodBoolean>;
    dailyLossLimit: z.ZodOptional<z.ZodNumber>;
    maxPositionSize: z.ZodOptional<z.ZodNumber>;
    defaultOrderType: z.ZodOptional<z.ZodString>;
    requireStopLoss: z.ZodOptional<z.ZodBoolean>;
    strategyEnabled: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodBoolean>>;
    positionSizingMethod: z.ZodOptional<z.ZodString>;
    positionSizingValue: z.ZodOptional<z.ZodNumber>;
    riskLevel: z.ZodOptional<z.ZodEnum<["low", "medium", "high"]>>;
    selectedInstrument: z.ZodOptional<z.ZodString>;
    primaryInstrument: z.ZodOptional<z.ZodString>;
    correlatedPairSymbol: z.ZodOptional<z.ZodString>;
    rsiOverboughtThreshold: z.ZodOptional<z.ZodNumber>;
    rsiOversoldThreshold: z.ZodOptional<z.ZodNumber>;
    semiAutopilotWindow: z.ZodOptional<z.ZodAny>;
    fullAutopilotWindow: z.ZodOptional<z.ZodAny>;
}, "strip", z.ZodTypeAny, {
    selectedInstrument?: string | undefined;
    dailyLossLimit?: number | undefined;
    enabled?: boolean | undefined;
    maxPositionSize?: number | undefined;
    defaultOrderType?: string | undefined;
    requireStopLoss?: boolean | undefined;
    strategyEnabled?: Record<string, boolean> | undefined;
    positionSizingMethod?: string | undefined;
    positionSizingValue?: number | undefined;
    riskLevel?: "low" | "medium" | "high" | undefined;
    primaryInstrument?: string | undefined;
    correlatedPairSymbol?: string | undefined;
    rsiOverboughtThreshold?: number | undefined;
    rsiOversoldThreshold?: number | undefined;
    semiAutopilotWindow?: any;
    fullAutopilotWindow?: any;
}, {
    selectedInstrument?: string | undefined;
    dailyLossLimit?: number | undefined;
    enabled?: boolean | undefined;
    maxPositionSize?: number | undefined;
    defaultOrderType?: string | undefined;
    requireStopLoss?: boolean | undefined;
    strategyEnabled?: Record<string, boolean> | undefined;
    positionSizingMethod?: string | undefined;
    positionSizingValue?: number | undefined;
    riskLevel?: "low" | "medium" | "high" | undefined;
    primaryInstrument?: string | undefined;
    correlatedPairSymbol?: string | undefined;
    rsiOverboughtThreshold?: number | undefined;
    rsiOversoldThreshold?: number | undefined;
    semiAutopilotWindow?: any;
    fullAutopilotWindow?: any;
}>;
export declare const detectAntiLagSchema: z.ZodObject<{
    primarySymbol: z.ZodString;
    correlatedSymbol: z.ZodString;
    lookbackSeconds: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    primarySymbol: string;
    correlatedSymbol: string;
    lookbackSeconds?: number | undefined;
}, {
    primarySymbol: string;
    correlatedSymbol: string;
    lookbackSeconds?: number | undefined;
}>;
//# sourceMappingURL=schemas.d.ts.map