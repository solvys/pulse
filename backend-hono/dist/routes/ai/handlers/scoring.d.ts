/**
 * Scoring Handlers
 * IV score and VIX endpoints
 */
import { Context } from 'hono';
export declare function handleCalculateScore(c: Context): Promise<(Response & import("hono").TypedResponse<{
    error: string;
    details: {
        formErrors: string[];
        fieldErrors: {
            symbol?: string[] | undefined;
            instrument?: string[] | undefined;
        };
    };
}, 400, "json">) | (Response & import("hono").TypedResponse<{
    score: number;
    level: "low" | "medium" | "high" | "good";
    timestamp: string;
    vix?: number | undefined;
    instrument?: string | undefined;
    color?: string | undefined;
}, import("hono/utils/http-status").ContentfulStatusCode, "json">) | (Response & import("hono").TypedResponse<{
    error: string;
}, 500, "json">)>;
export declare function handleGetScore(c: Context): Promise<(Response & import("hono").TypedResponse<{
    error: string;
}, 400, "json">) | (Response & import("hono").TypedResponse<{
    score: number;
    level: string;
    timestamp: string;
}, import("hono/utils/http-status").ContentfulStatusCode, "json">)>;
export declare function handleGetCurrentScore(c: Context): Promise<(Response & import("hono").TypedResponse<{
    score: number;
    level: "low" | "medium" | "high" | "good";
    timestamp: string;
    vix?: number | undefined;
    instrument?: string | undefined;
    color?: string | undefined;
}, import("hono/utils/http-status").ContentfulStatusCode, "json">) | (Response & import("hono").TypedResponse<{
    error: string;
}, 500, "json">)>;
export declare function handleGetScoreHistory(c: Context): Promise<(Response & import("hono").TypedResponse<{
    error: string;
    details: {
        formErrors: string[];
        fieldErrors: {
            symbol?: string[] | undefined;
            limit?: string[] | undefined;
            offset?: string[] | undefined;
        };
    };
}, 400, "json">) | (Response & import("hono").TypedResponse<{
    scores: {
        id?: number | undefined;
        userId?: string | undefined;
        symbol?: string | undefined;
        score: number;
        level: "low" | "medium" | "high" | "good";
        vix?: number | undefined;
        impliedPoints?: number | undefined;
        color?: "gray" | "green" | "orange" | "red" | undefined;
        confidence?: number | undefined;
        factors?: string[] | undefined;
        recommendation?: string | undefined;
        instrument?: string | undefined;
        timestamp: string;
    }[];
    total: number;
}, import("hono/utils/http-status").ContentfulStatusCode, "json">) | (Response & import("hono").TypedResponse<{
    error: string;
}, 500, "json">)>;
export declare function handleGetVIX(c: Context): Promise<(Response & import("hono").TypedResponse<{
    value: number;
    timestamp: string;
    source: string;
}, import("hono/utils/http-status").ContentfulStatusCode, "json">) | (Response & import("hono").TypedResponse<{
    error: string;
}, 500, "json">)>;
//# sourceMappingURL=scoring.d.ts.map