import { Hono } from 'hono';
import { z } from 'zod';
import { sql } from '../db/index.js';
import {
  getUserBillingTier,
  setUserBillingTier,
  checkFeatureAccess,
  FEATURE_TIER_MAP,
  type BillingTier,
} from '../middleware/billing-guard.js';

const accountRoutes = new Hono();

// GET /account - Get user's primary account info
accountRoutes.get('/', async (c) => {
  const userId = c.get('userId');

  try {
    // Get the most recently synced account for the user
    const [account] = await sql`
      SELECT 
        id,
        account_id,
        account_name,
        account_type,
        balance,
        equity,
        margin_used,
        buying_power,
        last_synced_at
      FROM broker_accounts
      WHERE user_id = ${userId}
      ORDER BY last_synced_at DESC NULLS LAST, created_at DESC
      LIMIT 1
    `;

    if (!account) {
      return c.json({
        id: null,
        accountId: null,
        accountName: null,
        accountType: null,
        balance: 0,
        equity: 0,
        marginUsed: 0,
        buyingPower: 0,
        provider: 'projectx',
        isPaper: false,
        lastSyncedAt: null,
      });
    }

    return c.json({
      id: account.id,
      accountId: account.account_id,
      accountName: account.account_name,
      accountType: account.account_type || null,
      balance: account.balance,
      equity: account.equity,
      marginUsed: account.margin_used,
      buyingPower: account.buying_power,
      provider: 'projectx',
      isPaper: false,
      lastSyncedAt: account.last_synced_at || null,
    });
  } catch (error) {
    console.error('Failed to get account:', error);
    return c.json({ error: 'Failed to get account' }, 500);
  }
});


// PATCH /account/settings - Update account settings
accountRoutes.patch('/settings', async (c) => {
  const userId = c.get('userId');
  const body = await c.req.json();

  try {
    const allowedFields = ['dailyTarget', 'dailyLossLimit', 'tradingEnabled', 'autoTrade', 'riskManagement'];
    const updates = Object.keys(body)
      .filter(key => allowedFields.includes(key))
      .reduce((obj, key) => ({ ...obj, [key]: body[key] }), {});

    if (Object.keys(updates).length === 0) {
      return c.json({ error: 'No valid settings provided' }, 400);
    }

    return c.json({
      message: 'Settings updated successfully',
      settings: updates,
    });
  } catch (error) {
    console.error('Failed to update settings:', error);
    return c.json({ error: 'Failed to update settings' }, 500);
  }
});

// PATCH /account/tier - Update billing tier
const tierSchema = z.object({
  tier: z.enum(['free', 'pulse', 'pulse_plus', 'pulse_pro']),
});

accountRoutes.patch('/tier', async (c) => {
  const userId = c.get('userId');
  const result = tierSchema.safeParse(await c.req.json());

  if (!result.success) {
    return c.json({
      error: 'Invalid tier',
      validTiers: ['free', 'pulse', 'pulse_plus', 'pulse_pro'],
      details: result.error.flatten(),
    }, 400);
  }

  try {
    const success = await setUserBillingTier(userId, result.data.tier);
    if (!success) {
      return c.json({ error: 'Failed to update billing tier' }, 500);
    }

    return c.json({
      message: 'Tier updated successfully',
      tier: result.data.tier,
      effectiveDate: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Failed to update tier:', error);
    return c.json({ error: 'Failed to update billing tier' }, 500);
  }
});

// POST /account/select-tier - Force user to select tier (required on first login)
accountRoutes.post('/select-tier', async (c) => {
  const userId = c.get('userId');
  const result = tierSchema.safeParse(await c.req.json());

  if (!result.success) {
    return c.json({
      error: 'Invalid tier',
      validTiers: ['free', 'pulse', 'pulse_plus', 'pulse_pro'],
      details: result.error.flatten(),
    }, 400);
  }

  try {
    const success = await setUserBillingTier(userId, result.data.tier);
    if (!success) {
      return c.json({ error: 'Failed to set billing tier' }, 500);
    }

    return c.json({
      message: 'Billing tier selected successfully',
      tier: result.data.tier,
    });
  } catch (error) {
    console.error('Failed to select tier:', error);
    return c.json({ error: 'Failed to select billing tier' }, 500);
  }
});

// GET /account/features - List available features for user's tier
accountRoutes.get('/features', async (c) => {
  const userId = c.get('userId');

  try {
    const tier = await getUserBillingTier(userId);
    if (!tier) {
      return c.json({
        error: 'Billing tier not selected',
        message: 'Please select a billing tier first',
        requiresTierSelection: true,
      }, 403);
    }

    // Get all features and filter by tier access
    const allFeatures = Object.entries(FEATURE_TIER_MAP);

    // Resolve all access checks
    const featuresWithAccess = allFeatures.map(([name, requiredTier]) => {
      const accessCheck = checkFeatureAccess(tier, name);
      return {
        name,
        requiredTier,
        hasAccess: accessCheck.hasAccess,
      };
    });

    return c.json({
      tier,
      features: featuresWithAccess,
    });
  } catch (error) {
    console.error('Failed to get user features:', error);
    return c.json({ error: 'Failed to get user features' }, 500);
  }
});

// GET /account/tier - Get user's current billing tier
accountRoutes.get('/tier', async (c) => {
  const userId = c.get('userId');

  try {
    const tier = await getUserBillingTier(userId);
    return c.json({
      tier: tier || null,
      requiresSelection: !tier,
    });
  } catch (error) {
    console.error('Failed to get user tier:', error);
    return c.json({ error: 'Failed to get billing tier' }, 500);
  }
});

export { accountRoutes };
