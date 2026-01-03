/**
 * Quick Pulse Handlers
 * Quick pulse analysis endpoints
 */
import { Context } from 'hono';
export declare function handleQuickPulse(c: Context): Promise<(Response & import("hono").TypedResponse<{
    analysis: string;
    ivScore: number;
    vix: number;
    timestamp: string;
    cached: false;
}, import("hono/utils/http-status").ContentfulStatusCode, "json">) | (Response & import("hono").TypedResponse<{
    error: string;
}, 500, "json">)>;
export declare function handleGetCachedPulse(c: Context): Promise<Response & import("hono").TypedResponse<any, import("hono/utils/http-status").ContentfulStatusCode, "json">>;
//# sourceMappingURL=quick-pulse.d.ts.map