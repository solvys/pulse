/**
 * Anti-Lag Handler
 * Detect anti-lag between primary and correlated pair
 */
import { Context } from 'hono';
export declare function handleDetectAntiLag(c: Context): Promise<(Response & import("hono").TypedResponse<{
    error: string;
    details: {
        formErrors: string[];
        fieldErrors: {
            primarySymbol?: string[] | undefined;
            correlatedSymbol?: string[] | undefined;
            lookbackSeconds?: string[] | undefined;
        };
    };
}, 400, "json">) | (Response & import("hono").TypedResponse<{
    detected: boolean;
    eventType?: "anti_lag" | "contra_anti_lag" | undefined;
    metrics?: {
        tickRateIncreasePrimary: number;
        tickRateIncreaseCorrelated: number;
        candleTicksPrimary: number;
    } | undefined;
    confidence: number;
}, import("hono/utils/http-status").ContentfulStatusCode, "json">) | (Response & import("hono").TypedResponse<{
    error: string;
}, 500, "json">)>;
//# sourceMappingURL=anti-lag.d.ts.map