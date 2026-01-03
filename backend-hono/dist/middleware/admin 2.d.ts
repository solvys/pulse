/**
 * Admin Middleware
 * Detects admin users via Clerk publicMetadata.role
 * Admin tier is NOT visible to regular users (no billing prompts)
 */
declare module 'hono' {
    interface ContextVariableMap {
        isAdmin: boolean;
    }
}
/**
 * Middleware to detect admin role from Clerk user metadata
 * Sets c.get('isAdmin') to true if user has admin role
 */
export declare const adminDetectionMiddleware: import("hono").MiddlewareHandler<any, string, {}, Response>;
/**
 * Middleware to require admin role
 * Returns 403 if user is not an admin
 */
export declare const requireAdminMiddleware: import("hono").MiddlewareHandler<any, string, {}, Response | (Response & import("hono").TypedResponse<{
    error: string;
}, 401, "json">)>;
/**
 * Check if a user is an admin (utility function)
 */
export declare function isUserAdmin(userId: string): Promise<boolean>;
//# sourceMappingURL=admin%202.d.ts.map