/**
 * Correlated Pairs Handler
 * Get available correlated pairs for an instrument
 */
import { Context } from 'hono';
export declare function handleCorrelatedPairs(c: Context): Promise<(Response & import("hono").TypedResponse<{
    error: string;
}, 400, "json">) | (Response & import("hono").TypedResponse<{
    instrument: string;
    assetClass: string;
    availablePairs: {
        symbol: string;
        assetClass: "risk" | "safe_haven" | "unknown";
        recommended: boolean;
    }[];
    warnings: string[] | undefined;
}, import("hono/utils/http-status").ContentfulStatusCode, "json">) | (Response & import("hono").TypedResponse<{
    error: string;
}, 500, "json">)>;
//# sourceMappingURL=correlated-pairs.d.ts.map