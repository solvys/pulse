# Pulse API (Hono + Neon PostgreSQL)

Backend API for Pulse Trading Platform, built with Hono and Neon PostgreSQL.

## Tech Stack

- **Hono** - Fast, lightweight web framework
- **Neon PostgreSQL** - Serverless Postgres database
- **Clerk** - Authentication
- **Zod** - Schema validation
- **Pino** - Logging

## Getting Started

### Prerequisites

- Node.js 20+
- Neon PostgreSQL database
- Clerk account

### Installation

```bash
npm install
```

### Environment Variables

Copy `.env.example` to `.env` and fill in your values:

```bash
cp .env.example .env
```

Required variables:
- `NEON_DATABASE_URL` - Neon PostgreSQL connection string
- `CLERK_SECRET_KEY` - Clerk secret key
- `PORT` - Server port (default: 8080)

### Database Migrations

Apply migrations to your Neon database:

```bash
# Connect to Neon via psql
psql "$NEON_DATABASE_URL"

# Run migrations
\i migrations/1_init_schema.up.sql
\i migrations/4_create_journal_tables.up.sql
\i migrations/5_create_econ_tables.up.sql
```

### Development

```bash
npm run dev
```

### Production Build

```bash
npm run build
npm start
```

## API Routes

### Core Routes (migrated from Encore)
- `GET /projectx/accounts` - List user accounts
- `POST /projectx/sync` - Sync TopStepX accounts
- `GET /projectx/orders` - List orders
- `POST /projectx/order` - Place order
- `GET /projectx/contracts/:symbol` - Get contract info
- `POST /trading/record` - Record trade
- `GET /trading/history` - Get trade history
- `GET /market/data/:symbol` - Get market data
- `GET /market/bars/:symbol` - Get historical bars
- `GET /market/vix` - Get VIX data
- `GET /news/feed` - News feed
- `GET /iv-scoring/calculate` - Calculate IV score

### Journal Routes (NEW)
- `GET /journal/stats` - Aggregated trading statistics
- `GET /journal/calendar?month=YYYY-MM` - Calendar P&L data
- `GET /journal/date/:date` - Date detail with orders

### ER/Blindspot Routes (NEW)
- `GET /er/date/:date` - Emotional Resonance scores by hour
- `GET /er/blindspots/:date` - Blindspot Management Rating

### Econ Routes (NEW)
- `GET /econ/day/:date` - Cached econ calendar plan
- `POST /econ/interpret` - Trigger econ calendar interpretation

### Health
- `GET /health` - Health check endpoint

## Deployment to Fly.io

### First-time Setup

```bash
# Install Fly CLI
brew install flyctl

# Login
fly auth login

# Launch app
fly launch --name pulse-api --region ord --no-deploy

# Set secrets
fly secrets set NEON_DATABASE_URL="postgres://..."
fly secrets set CLERK_SECRET_KEY="sk_live_..."
```

### Deploy

```bash
fly deploy
```

### Check Status

```bash
fly status
fly logs
```

## Project Structure

```
backend-hono/
├── src/
│   ├── index.ts           # Main entry point
│   ├── env.ts             # Environment validation
│   ├── db/
│   │   └── index.ts       # Neon database client
│   ├── middleware/
│   │   ├── auth.ts        # Clerk auth middleware
│   │   ├── cors.ts        # CORS configuration
│   │   └── logger.ts      # Pino logger
│   └── routes/
│       ├── index.ts       # Route registration
│       ├── projectx.ts    # ProjectX routes
│       ├── trading.ts     # Trading routes
│       ├── market.ts      # Market data routes
│       ├── news.ts        # News routes
│       ├── iv-scoring.ts  # IV scoring routes
│       ├── journal.ts     # Journal routes
│       ├── er.ts          # ER/Blindspot routes
│       └── econ.ts        # Econ calendar routes
├── migrations/            # SQL migrations
├── Dockerfile             # Docker build
├── fly.toml               # Fly.io config
└── package.json
```

## Phase 2 Exit Criteria

- [x] All Encore dependencies removed
- [x] All core routes migrated (ProjectX, Trading, Market, News, IV Scoring)
- [x] Journal routes implemented
- [x] ER/Blindspot routes implemented
- [x] Database migrations created
- [x] Type-safe with Zod validation
- [x] Fly.io deployment configuration ready
- [ ] **No deployment yet** (Phase 3)
