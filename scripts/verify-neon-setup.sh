#!/bin/bash

echo "🔍 Verifying Neon Database Setup"
echo "================================="

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
    echo "⚠️  DATABASE_URL not set, using local default..."
    export DATABASE_URL="postgres://tifos@localhost:5432/pulse_dev"
fi

echo "📍 Using DATABASE_URL: $DATABASE_URL"
echo ""

# Test connection
echo "🔗 Testing database connection..."
if psql "$DATABASE_URL" -c "SELECT 1;" >/dev/null 2>&1; then
    echo "✅ Database connection successful!"
else
    echo "❌ Database connection failed"
    echo "   Make sure PostgreSQL is running: brew services start postgresql@14"
    exit 1
fi

echo ""
echo "📊 Database Status:"
psql "$DATABASE_URL" -c "SELECT current_database(), current_user, pg_size_pretty(pg_database_size(current_database()));" -t

echo ""
echo "🗂️  Tables in database:"
psql "$DATABASE_URL" -c "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;" -t

echo ""
echo "🎉 Local Neon database is ready for development!"
echo ""
echo "💡 Usage:"
echo "   psql '$DATABASE_URL'  # Connect to database"
echo "   ./neon-setup.sh       # Test cloud Neon connection"
echo "   Cursor → Install PostgreSQL extension for GUI access"
