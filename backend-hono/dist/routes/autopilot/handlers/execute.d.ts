/**
 * Execute Handler
 * Executes an approved trading proposal
 */
import { Context } from 'hono';
export declare function handleExecute(c: Context): Promise<(Response & import("hono").TypedResponse<{
    error: string;
}, 400, "json">) | (Response & import("hono").TypedResponse<{
    error: string;
}, 404, "json">) | (Response & import("hono").TypedResponse<{
    success: true;
    orderId: number;
    executionId: any;
    executionDetails: {
        proposalId: number;
        contractId: any;
        symbol: any;
        side: any;
        size: any;
    };
}, import("hono/utils/http-status").ContentfulStatusCode, "json">) | (Response & import("hono").TypedResponse<{
    success: false;
    error: string;
}, 500, "json">)>;
//# sourceMappingURL=execute.d.ts.map