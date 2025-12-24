# Neon Database Configuration

## Current Status
- ✅ Backend deployed to Fly.io with Neon database
- ✅ Database URL configured in Fly.io secrets
- 🔄 Local development connection needs setup

## Setup Instructions

### 1. Get Your Neon Connection String
1. Go to [Neon Console](https://console.neon.tech/)
2. Select your project (likely named `pulse-api` or similar)
3. Copy the connection string from the dashboard
4. It should look like: `postgres://user:password@host/database?sslmode=require`

### 2. Set Environment Variable
```bash
# For current session
export NEON_DATABASE_URL="your_connection_string_here"

# Or add to your shell profile (~/.zshrc, ~/.bashrc)
echo 'export NEON_DATABASE_URL="your_connection_string_here"' >> ~/.zshrc
source ~/.zshrc
```

### 3. Test Connection
```bash
# Run the setup script
./neon-setup.sh

# Or test manually
psql "$NEON_DATABASE_URL" -c "SELECT version();"
```

### 4. Cursor Integration Options

#### Option A: VS Code Extension (Recommended)
1. Install "PostgreSQL" extension by Chris Kolkman
2. Add database connection in VS Code settings
3. Use the connection string from Neon console

#### Option B: Terminal Integration
- Use the `./neon-setup.sh` script for quick testing
- Run psql commands directly in Cursor terminal

#### Option C: MCP Integration (Advanced)
If you want AI-assisted database queries, you could set up MCP with database tools, but standard VS Code extensions are sufficient for most use cases.

## Current Database Schema
Based on your backend migration files, your database includes:
- User authentication tables
- Journal tables (stats, calendar, entries)
- ER/Blindspot tables
- Econ calendar tables
- ProjectX integration tables

## Connection Example
```bash
psql "postgres://pulse_user:password@ep-xyz.us-east-1.aws.neon.tech/neondb?sslmode=require" -c "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';"
```