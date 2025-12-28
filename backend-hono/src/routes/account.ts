import { Hono } from 'hono';
import { sql } from '../db/index.js';

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
accountRoutes.patch('/tier', async (c) => {
  const userId = c.get('userId');
  const body = await c.req.json();

  const { tier } = body;
  const validTiers = ['free', 'pulse', 'pulse_plus', 'pulse_pro'];

  if (!tier || !validTiers.includes(tier)) {
    return c.json({
      error: 'Invalid tier',
      validTiers
    }, 400);
  }

  try {
    return c.json({
      message: 'Tier updated successfully',
      tier,
      effectiveDate: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Failed to update tier:', error);
    return c.json({ error: 'Failed to update billing tier' }, 500);
  }
});
export { accountRoutes };
