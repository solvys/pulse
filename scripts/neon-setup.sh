#!/bin/bash

echo "🔧 Neon Database Setup for Cursor"
echo "=================================="

# Check if NEON_DATABASE_URL is set
if [ -z "$NEON_DATABASE_URL" ]; then
    echo "❌ NEON_DATABASE_URL not found in environment"
    echo ""
    echo "📋 To set up Neon connection:"
    echo "1. Go to https://console.neon.tech/"
    echo "2. Copy your connection string from the dashboard"
    echo "3. Run: export NEON_DATABASE_URL='your_connection_string_here'"
    echo ""
    echo "Example:"
    echo "export NEON_DATABASE_URL='postgres://pulse_user:password@ep-xyz.us-east-1.aws.neon.tech/neondb?sslmode=require'"
    exit 1
fi

echo "✅ NEON_DATABASE_URL found"
echo "🔍 Testing connection..."

# Test the connection
if psql "$NEON_DATABASE_URL" -c "SELECT version();" >/dev/null 2>&1; then
    echo "✅ Connection successful!"
    
    # Show database info
    echo ""
    echo "📊 Database Info:"
    psql "$NEON_DATABASE_URL" -c "SELECT current_database(), current_user, version();" -t
    
    echo ""
    echo "🗂️  Tables in public schema:"
    psql "$NEON_DATABASE_URL" -c "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;" -t
    
else
    echo "❌ Connection failed. Please check your NEON_DATABASE_URL"
    exit 1
fi

echo ""
echo "🎉 Neon is ready for use in Cursor!"
