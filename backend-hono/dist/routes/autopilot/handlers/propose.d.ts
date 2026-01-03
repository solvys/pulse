/**
 * Propose Handler
 * Creates a trading proposal with risk validation
 */
import { Context } from 'hono';
export declare function handlePropose(c: Context): Promise<(Response & import("hono").TypedResponse<{
    error: string;
    details: {
        formErrors: string[];
        fieldErrors: {
            symbol?: string[] | undefined;
            accountId?: string[] | undefined;
            side?: string[] | undefined;
            size?: string[] | undefined;
            orderType?: string[] | undefined;
            limitPrice?: string[] | undefined;
            stopPrice?: string[] | undefined;
            stopLossTicks?: string[] | undefined;
            takeProfitTicks?: string[] | undefined;
            contractId?: string[] | undefined;
            strategyName?: string[] | undefined;
            reasoning?: string[] | undefined;
        };
    };
}, 400, "json">) | (Response & import("hono").TypedResponse<{
    success: false;
    error: string;
    blocked: true;
    reason: string;
}, 400, "json">) | (Response & import("hono").TypedResponse<{
    success: true;
    proposalId: any;
    status: any;
    riskMetrics: {
        dailyLoss: number;
        positionSize: number;
        accountBalance: number;
        concurrentPositions: number;
    } | undefined;
    expiresAt: any;
    ivScore: {
        score: number;
        level: "low" | "medium" | "high" | "good";
    } | null;
}, import("hono/utils/http-status").ContentfulStatusCode, "json">) | (Response & import("hono").TypedResponse<{
    success: false;
    error: string;
}, 500, "json">)>;
//# sourceMappingURL=propose.d.ts.map