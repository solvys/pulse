/**
 * Proposals Handlers
 * List and get proposal details
 */
import { Context } from 'hono';
export declare function handleListProposals(c: Context): Promise<(Response & import("hono").TypedResponse<{
    error: string;
    details: {
        formErrors: string[];
        fieldErrors: {
            status?: string[] | undefined;
            limit?: string[] | undefined;
            strategy?: string[] | undefined;
            offset?: string[] | undefined;
        };
    };
}, 400, "json">) | (Response & import("hono").TypedResponse<{
    proposals: any;
    total: any;
}, import("hono/utils/http-status").ContentfulStatusCode, "json">) | (Response & import("hono").TypedResponse<{
    error: string;
}, 500, "json">)>;
export declare function handleGetProposal(c: Context): Promise<Response & import("hono").TypedResponse<any, import("hono/utils/http-status").ContentfulStatusCode, "json">>;
//# sourceMappingURL=proposals.d.ts.map