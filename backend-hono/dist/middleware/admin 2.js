/**
 * Admin Middleware
 * Detects admin users via Clerk publicMetadata.role
 * Admin tier is NOT visible to regular users (no billing prompts)
 */
import { createMiddleware } from 'hono/factory';
import { createClerkClient } from '@clerk/backend';
import { env } from '../env.js';
// Create Clerk client instance
const clerk = createClerkClient({ secretKey: env.CLERK_SECRET_KEY });
/**
 * Middleware to detect admin role from Clerk user metadata
 * Sets c.get('isAdmin') to true if user has admin role
 */
export const adminDetectionMiddleware = createMiddleware(async (c, next) => {
    const userId = c.get('userId');
    if (!userId) {
        c.set('isAdmin', false);
        await next();
        return;
    }
    try {
        // Fetch user from Clerk to get publicMetadata
        const user = await clerk.users.getUser(userId);
        // Check if user has admin role in publicMetadata
        const isAdmin = user.publicMetadata?.role === 'admin';
        c.set('isAdmin', isAdmin);
    }
    catch (error) {
        console.error('Error checking admin status:', error);
        c.set('isAdmin', false);
    }
    await next();
});
/**
 * Middleware to require admin role
 * Returns 403 if user is not an admin
 */
export const requireAdminMiddleware = createMiddleware(async (c, next) => {
    const userId = c.get('userId');
    if (!userId) {
        return c.json({ error: 'Unauthorized' }, 401);
    }
    try {
        const user = await clerk.users.getUser(userId);
        const isAdmin = user.publicMetadata?.role === 'admin';
        if (!isAdmin) {
            return c.json({ error: 'Admin access required' }, 403);
        }
        c.set('isAdmin', true);
        await next();
        return;
    }
    catch (error) {
        console.error('Error checking admin status:', error);
        return c.json({ error: 'Failed to verify admin status' }, 500);
    }
});
/**
 * Check if a user is an admin (utility function)
 */
export async function isUserAdmin(userId) {
    try {
        const user = await clerk.users.getUser(userId);
        return user.publicMetadata?.role === 'admin';
    }
    catch (error) {
        console.error('Error checking admin status:', error);
        return false;
    }
}
//# sourceMappingURL=admin%202.js.map