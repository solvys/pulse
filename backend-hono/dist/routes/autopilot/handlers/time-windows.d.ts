/**
 * Time Windows Handler
 * Get configured time windows
 */
import { Context } from 'hono';
export declare function handleTimeWindows(c: Context): Promise<(Response & import("hono").TypedResponse<{
    semiAutopilotWindow: any;
    fullAutopilotWindow: any;
    placeholderWindow3: any;
}, import("hono/utils/http-status").ContentfulStatusCode, "json">) | (Response & import("hono").TypedResponse<{
    error: string;
}, 500, "json">)>;
//# sourceMappingURL=time-windows.d.ts.map