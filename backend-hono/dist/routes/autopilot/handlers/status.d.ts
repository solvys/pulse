/**
 * Status Handler
 * Get autopilot status and settings
 */
import { Context } from 'hono';
export declare function handleStatus(c: Context): Promise<(Response & import("hono").TypedResponse<{
    enabled: any;
    settings: any;
    activeProposals: any;
    recentExecutions: any;
    riskMetrics: {
        dailyLoss: number;
        tradesToday: any;
    };
}, import("hono/utils/http-status").ContentfulStatusCode, "json">) | (Response & import("hono").TypedResponse<{
    error: string;
}, 500, "json">)>;
//# sourceMappingURL=status.d.ts.map