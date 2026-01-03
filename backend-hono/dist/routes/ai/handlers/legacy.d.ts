/**
 * Legacy Handlers
 * Legacy endpoints for frontend compatibility
 */
import { Context } from 'hono';
export declare function handleGetUserSettings(c: Context): Promise<Response & import("hono").TypedResponse<{
    usualTradesPerDuration: number;
    durationWindow: string;
    selectedInstrument: null;
}, import("hono/utils/http-status").ContentfulStatusCode, "json">>;
export declare function handleGetConversation(c: Context): Promise<(Response & import("hono").TypedResponse<{
    error: string;
}, 400, "json">) | (Response & import("hono").TypedResponse<{
    error: string;
}, 404, "json">) | (Response & import("hono").TypedResponse<{
    conversationId: any;
    messages: any;
}, import("hono/utils/http-status").ContentfulStatusCode, "json">) | (Response & import("hono").TypedResponse<{
    error: string;
}, 500, "json">)>;
export declare function handleCheckTape(c: Context): Promise<Response & import("hono").TypedResponse<{
    message: string;
    insights: ({
        type: string;
        value: number;
        level: "low" | "medium" | "high" | "good";
    } | {
        type: string;
        value: number;
    })[];
}, import("hono/utils/http-status").ContentfulStatusCode, "json">>;
export declare function handleGenerateDailyRecap(c: Context): Promise<Response & import("hono").TypedResponse<{
    message: string;
    recap: string;
}, import("hono/utils/http-status").ContentfulStatusCode, "json">>;
//# sourceMappingURL=legacy.d.ts.map