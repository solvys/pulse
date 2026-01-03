/**
 * Acknowledge Handler
 * Approves or rejects a trading proposal
 */
import { Context } from 'hono';
export declare function handleAcknowledge(c: Context): Promise<(Response & import("hono").TypedResponse<{
    error: string;
}, 404, "json">) | (Response & import("hono").TypedResponse<{
    error: string;
}, 400, "json">) | (Response & import("hono").TypedResponse<{
    success: true;
    proposalId: number;
    status: string;
}, import("hono/utils/http-status").ContentfulStatusCode, "json">) | (Response & import("hono").TypedResponse<{
    success: false;
    error: string;
}, 500, "json">)>;
//# sourceMappingURL=acknowledge.d.ts.map