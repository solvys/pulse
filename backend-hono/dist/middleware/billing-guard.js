/**
 * Billing Guard Middleware
 * Ensures users have selected a billing tier and validates feature access
 */
import { sql } from '../db/index.js';
// Feature to tier mapping
const FEATURE_TIER_MAP = {
    'basic_news_feed': 'free',
    'basic_iv_scores': 'free',
    'psychassist': 'pulse',
    'basic_riskflow': 'pulse',
    'trading_psych_agent': 'pulse',
    'full_riskflow': 'pulse_plus',
    'autonomous_trading': 'pulse_plus',
    'risk_management_tools': 'pulse_plus',
    'polymarket_integration': 'pulse_plus',
    'custom_ai_agents': 'pulse_pro',
    'multi_account_management': 'pulse_pro',
    'risk_event_playbook': 'pulse_pro',
    'priority_support': 'pulse_pro',
};
// Tier hierarchy (higher number = more features)
const TIER_HIERARCHY = {
    'free': 0,
    'pulse': 1,
    'pulse_plus': 2,
    'pulse_pro': 3,
};
/**
 * Get user's billing tier from database
 */
export async function getUserBillingTier(userId) {
    try {
        const [billing] = await sql `
      SELECT billing_tier
      FROM user_billing
      WHERE user_id = ${userId}
    `;
        return billing?.billing_tier || null;
    }
    catch (error) {
        console.error('Failed to get user billing tier:', error);
        return null;
    }
}
/**
 * Check if user has access to a specific feature
 */
export function checkFeatureAccess(userTier, featureName) {
    const requiredTier = FEATURE_TIER_MAP[featureName] || 'pulse_pro';
    if (!userTier) {
        return { hasAccess: false, requiredTier };
    }
    const userTierLevel = TIER_HIERARCHY[userTier];
    const requiredTierLevel = TIER_HIERARCHY[requiredTier];
    return {
        hasAccess: userTierLevel >= requiredTierLevel,
        requiredTier,
    };
}
/**
 * Set user's billing tier
 */
export async function setUserBillingTier(userId, tier) {
    try {
        await sql `
      INSERT INTO user_billing (user_id, billing_tier, tier_selected_at, updated_at)
      VALUES (${userId}, ${tier}, NOW(), NOW())
      ON CONFLICT (user_id) DO UPDATE SET
        billing_tier = EXCLUDED.billing_tier,
        tier_selected_at = CASE 
          WHEN user_billing.billing_tier IS NULL THEN NOW()
          ELSE user_billing.tier_selected_at
        END,
        updated_at = NOW()
    `;
        return true;
    }
    catch (error) {
        console.error('Failed to set user billing tier:', error);
        return false;
    }
}
// Export FEATURE_TIER_MAP for use in routes
export { FEATURE_TIER_MAP };
/**
 * Middleware to require billing tier selection
 */
export async function requireBillingTier(c, next) {
    const userId = c.get('userId');
    if (!userId) {
        c.json({ error: 'Unauthorized' }, 401);
        return;
    }
    const tier = await getUserBillingTier(userId);
    if (!tier) {
        c.json({
            error: 'Billing tier not selected',
            message: 'Please select a billing tier to continue',
            requiresTierSelection: true,
        }, 403);
        return;
    }
    await next();
}
/**
 * Middleware to check feature access
 */
export function checkFeatureAccessMiddleware(featureName) {
    return async (c, next) => {
        const userId = c.get('userId');
        if (!userId) {
            c.json({ error: 'Unauthorized' }, 401);
            return;
        }
        const tier = await getUserBillingTier(userId);
        const access = checkFeatureAccess(tier, featureName);
        if (!access.hasAccess) {
            c.json({
                error: 'Feature not available',
                message: `This feature requires ${access.requiredTier} tier. Please upgrade to unlock.`,
                requiredTier: access.requiredTier,
                currentTier: tier || 'none',
            }, 403);
            return;
        }
        await next();
    };
}
//# sourceMappingURL=billing-guard.js.map