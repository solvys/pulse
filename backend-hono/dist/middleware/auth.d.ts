declare module 'hono' {
    interface ContextVariableMap {
        userId: string;
    }
}
export declare const authMiddleware: import("hono").MiddlewareHandler<any, string, {}, Response | (Response & import("hono").TypedResponse<{
    error: string;
}, 401, "json">)>;
//# sourceMappingURL=auth.d.ts.map