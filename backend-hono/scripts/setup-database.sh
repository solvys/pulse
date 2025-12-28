#!/bin/bash
# Database Setup Script for Pulse API
# This script ensures all required tables exist in Neon database

set -e

echo "🚀 Setting up Pulse API database tables..."

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
  echo "❌ ERROR: DATABASE_URL environment variable is not set"
  echo "Please set DATABASE_URL to your Neon database connection string"
  exit 1
fi

echo "✅ DATABASE_URL is set"

# Run migrations in order
echo ""
echo "📦 Running migrations..."

# Migration 1: Initial schema
if [ -f "migrations/1_init_schema.up.sql" ]; then
  echo "  → Running 1_init_schema.up.sql..."
  psql "$DATABASE_URL" -f migrations/1_init_schema.up.sql
fi

# Migration 11: Billing tier tables
if [ -f "migrations/11_create_billing_tier_tables.up.sql" ]; then
  echo "  → Running 11_create_billing_tier_tables.up.sql..."
  psql "$DATABASE_URL" -f migrations/11_create_billing_tier_tables.up.sql
fi

# Migration 12: Ensure user and billing tables (comprehensive)
if [ -f "migrations/12_ensure_user_and_billing_tables.up.sql" ]; then
  echo "  → Running 12_ensure_user_and_billing_tables.up.sql..."
  psql "$DATABASE_URL" -f migrations/12_ensure_user_and_billing_tables.up.sql
fi

echo ""
echo "✅ Database setup complete!"
echo ""
echo "📋 Tables created:"
echo "  - users (Clerk user tracking)"
echo "  - user_billing (billing tiers: free, pulse, pulse_plus, pulse_pro)"
echo "  - feature_tier_mapping (feature access control)"
echo "  - broker_accounts (trading accounts)"
echo "  - projectx_credentials (ProjectX API credentials)"
echo "  - news_articles (RiskFlow articles)"
echo "  - scheduled_events (RiskFlow scheduled events)"
echo ""
echo "🔐 Clerk Authentication:"
echo "  - Users are identified by clerk_user_id (VARCHAR(255))"
echo "  - All tables use user_id VARCHAR(255) to reference Clerk users"
echo "  - No separate authentication table needed (handled by Clerk)"
echo ""
