# Database Setup for Pulse API

This document describes how to set up the Neon database for the Pulse API with Clerk authentication and billing tiers.

## Required Tables

The database requires the following tables for full functionality:

### Core User Tables
- **users** - Tracks Clerk user metadata (email, name, last login)
- **user_billing** - Stores billing tier for each user (free, pulse, pulse_plus, pulse_pro)
- **feature_tier_mapping** - Maps features to required billing tiers

### Account Tables
- **broker_accounts** - Trading accounts linked to users
- **projectx_credentials** - ProjectX API credentials (encrypted)

### RiskFlow Tables
- **news_articles** - RiskFlow articles with IV impact scoring
- **scheduled_events** - Scheduled market events for RiskFlow

## Setup Instructions

### Option 1: Run Migration Script (Recommended)

```bash
cd pulse/backend-hono
export DATABASE_URL="your-neon-database-url"
./scripts/setup-database.sh
```

### Option 2: Run Migration Manually

1. Connect to your Neon database using the SQL Editor or `psql`
2. Run the migration file:

```sql
-- Run this in your Neon SQL Editor
\i migrations/12_ensure_user_and_billing_tables.up.sql
```

### Option 3: Run All Migrations in Order

If setting up a fresh database, run migrations in this order:

1. `migrations/1_init_schema.up.sql` - Core tables
2. `migrations/11_create_billing_tier_tables.up.sql` - Billing tiers
3. `migrations/12_ensure_user_and_billing_tables.up.sql` - Comprehensive setup (includes all above)

## Clerk Authentication Integration

The database is designed to work with Clerk authentication:

- **User IDs**: All tables use `user_id VARCHAR(255)` to store Clerk user IDs
- **Users Table**: Optional metadata table for tracking user information
- **No Auth Table**: Authentication is handled entirely by Clerk

### Example Clerk User ID Format
```
user_2abc123def456ghi789
```

## Billing Tiers

The system supports four billing tiers:

1. **free** - Basic features
2. **pulse** - PsychAssist, basic RiskFlow
3. **pulse_plus** - Full RiskFlow, autonomous trading
4. **pulse_pro** - Custom AI agents, priority support

### Setting a User's Billing Tier

```sql
INSERT INTO user_billing (user_id, billing_tier)
VALUES ('user_2abc123def456ghi789', 'pulse')
ON CONFLICT (user_id) 
DO UPDATE SET billing_tier = EXCLUDED.billing_tier;
```

## Verification

After running migrations, verify tables exist:

```sql
-- Check users table
SELECT * FROM users LIMIT 1;

-- Check billing table
SELECT * FROM user_billing LIMIT 1;

-- Check feature mappings
SELECT * FROM feature_tier_mapping;

-- Check broker accounts
SELECT * FROM broker_accounts LIMIT 1;

-- Check news articles (RiskFlow)
SELECT COUNT(*) FROM news_articles;
```

## Troubleshooting

### UUID Extension Error
If you get an error about `uuid_generate_v4()`, ensure the uuid-ossp extension is enabled:

```sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
```

### Table Already Exists
The migration uses `CREATE TABLE IF NOT EXISTS`, so it's safe to run multiple times. Existing data will not be affected.

### Permission Errors
Ensure your database user has CREATE TABLE and CREATE INDEX permissions.

## Next Steps

After database setup:

1. Configure `DATABASE_URL` in your environment variables
2. Test the API endpoints:
   - `POST /api/account` - Create account (auto-creates billing tier)
   - `GET /api/account/tier` - Get user's billing tier
   - `GET /api/account/features` - List available features
3. Seed sample data (optional):
   - `POST /api/riskflow/seed` - Seed sample RiskFlow articles
