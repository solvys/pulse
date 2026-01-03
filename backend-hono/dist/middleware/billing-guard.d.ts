/**
 * Billing Guard Middleware
 * Ensures users have selected a billing tier and validates feature access
 */
import { Context, Next } from 'hono';
export type BillingTier = 'free' | 'pulse' | 'pulse_plus' | 'pulse_pro';
declare const FEATURE_TIER_MAP: Record<string, BillingTier>;
/**
 * Get user's billing tier from database
 */
export declare function getUserBillingTier(userId: string): Promise<BillingTier | null>;
/**
 * Check if user has access to a specific feature
 */
export declare function checkFeatureAccess(userTier: BillingTier | null, featureName: string): {
    hasAccess: boolean;
    requiredTier: BillingTier;
};
/**
 * Set user's billing tier
 */
export declare function setUserBillingTier(userId: string, tier: BillingTier): Promise<boolean>;
export { FEATURE_TIER_MAP };
/**
 * Middleware to require billing tier selection
 */
export declare function requireBillingTier(c: Context, next: Next): Promise<void>;
/**
 * Middleware to check feature access
 */
export declare function checkFeatureAccessMiddleware(featureName: string): (c: Context, next: Next) => Promise<void>;
//# sourceMappingURL=billing-guard.d.ts.map