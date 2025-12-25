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

export { accountRoutes };
