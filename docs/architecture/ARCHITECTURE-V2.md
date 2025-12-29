# Pulse Architecture v2.27.9

## Overview

Pulse is a trading intelligence platform that combines real-time market data, automated trading proposals, and AI-powered analysis. The system is built with a modern microservices architecture, separating concerns between frontend presentation, backend API services, and data persistence.

---

## System Architecture

### High-Level Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         Frontend Layer                         │
│  (React + Vite, Deployed on Vercel)                          │
│  - pulse.solvys.io                                            │
│  - React Components, Context Providers, API Client            │
└──────────────────────┬────────────────────────────────────────┘
                        │ HTTPS (REST API)
                        │ CORS-enabled
                        ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Backend API Layer                          │
│  (Hono.js, Deployed on Fly.io)                                 │
│  - pulse-api-withered-dust-1394.fly.dev                       │
│  - RESTful API endpoints, Authentication, Business Logic        │
└──────────────────────┬────────────────────────────────────────┘
                        │
        ┌───────────────┼───────────────┐
        │               │               │
        ▼               ▼               ▼
┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│   Database   │ │  ProjectX API │ │  AI Gateway  │
│  (Neon PG)   │ │  (TopStepX)  │ │  (Grok-4)    │
└──────────────┘ └──────────────┘ └──────────────┘
```

---

## Backend Architecture

### Technology Stack
- **Framework**: Hono.js (lightweight, fast web framework)
- **Runtime**: Node.js
- **Database**: Neon PostgreSQL (serverless)
- **Authentication**: Clerk (JWT-based)
- **Deployment**: Fly.io
- **Language**: TypeScript (strict mode)

### Core Services

#### 1. RiskFlow Service (`/api/riskflow`)

**Purpose**: Real-time market intelligence feed with IV impact scoring and sentiment analysis.

**Key Features**:
- News article aggregation and storage
- IV (Implied Volatility) impact scoring (0-10 scale)
- Sentiment analysis (neutral, positive, negative, bullish, bearish)
- Macro-level classification (1-4 scale)
- Breaking news detection
- Symbol-based filtering
- Scheduled events integration

**Endpoints**:
- `GET /api/riskflow/feed` - Main feed with pagination
- `GET /api/riskflow/breaking` - Breaking news for Autopilot
- `GET /api/riskflow/scheduled` - Scheduled market events
- `POST /api/riskflow/seed` - Development data seeding

**Database Schema**:
```sql
news_articles (
  id, title, summary, content, source, url,
  published_at, sentiment, iv_impact, symbols,
  is_breaking, macro_level,
  price_brain_sentiment, price_brain_classification,
  implied_points, instrument, author_handle
)
```

**Data Flow**:
1. News articles ingested from X API and Polymarket.
2. IV impact calculated based on content analysis
3. Sentiment extracted via NLP
4. Macro level assigned (1=low impact, 4=high impact)
5. Price Brain Layer scores high-impact items (Level 3-4)
6. Articles stored in `news_articles` table
7. Frontend queries via `/api/riskflow/feed`

---

#### 2. Autopilot Service (`/api/autopilot`)

**Purpose**: Automated trading proposal system with human-in-the-loop approval workflow.

**Key Features**:
- Trading strategy execution (Morning Flush, Lunch/Power Hour, 40/40 Club, etc.)
- Risk validation before proposal generation
- Human approval required before execution
- Proposal lifecycle management (draft → pending → approved/rejected → executed)
- Integration with ProjectX API for order execution
- Breaking news pause detection
- Time window restrictions
- Correlated pairs detection

**Endpoints**:
- `POST /api/autopilot/propose` - Create trading proposal
- `POST /api/autopilot/acknowledge` - Approve/reject proposal
- `GET /api/autopilot/proposals` - List user proposals
- `POST /api/autopilot/execute` - Execute approved proposal
- `GET /api/autopilot/status` - Get autopilot status
- `POST /api/autopilot/settings` - Update autopilot settings
- `GET /api/autopilot/correlated-pairs` - Get correlated trading pairs
- `POST /api/autopilot/detect-anti-lag` - Detect anti-lag opportunities
- `GET /api/autopilot/time-windows` - Get configured time windows

**Database Schema**:
```sql
autopilot_proposals (
  id, user_id, account_id, strategy_name, contract_id,
  symbol, side, size, order_type, entry_price, limit_price,
  stop_price, stop_loss_ticks, take_profit_ticks,
  status, risk_metrics, reasoning, expires_at,
  executed_at, created_at, updated_at
)

autopilot_executions (
  id, proposal_id, user_id, account_id, projectx_order_id,
  contract_id, symbol, side, size, execution_price,
  execution_timestamp, status, error_message, created_at
)
```

**Workflow**:
1. Strategy engine analyzes market conditions
2. Risk validation checks (position size, account balance, daily limits)
3. Proposal created with status `pending`
4. User reviews proposal in frontend
5. User approves/rejects via `/api/autopilot/acknowledge`
6. Approved proposals can be executed via `/api/autopilot/execute`
7. Execution calls ProjectX API to place order
8. Execution result stored in `autopilot_executions`

**Safety Features**:
- Breaking news detection pauses autopilot (5-10 minute cooldown)
- Time window restrictions (e.g., no trading during lunch hour)
- Risk limits enforced (max position size, daily loss limits)
- Human approval required for all trades
- Proposal expiration (default 5 minutes)

---

#### 3. Price Brain Layer Service

**Purpose**: AI-powered analysis of high-impact market news using Grok-4 via AI Gateway.

**Key Features**:
- Sentiment classification (Bullish, Bearish, Neutral)
- Market classification (Cyclical, Counter-cyclical, Neutral)
- Implied points estimation (for Level 3-4 macro events)
- Confidence scoring (0-1 scale)
- Instrument-specific analysis

**Integration**:
- Uses `generateText` from Vercel AI SDK
- Model: Grok-4 via AI Gateway
- Temperature: 0.3 (low for consistency)
- Max tokens: 500

**Data Flow**:
1. RiskFlow article with macro level 3 or 4 triggers Price Brain scoring
2. Article title, content, macro level, symbols sent to Grok-4
3. AI analyzes and returns JSON with sentiment, classification, implied points
4. Score stored in `news_articles` table (`price_brain_sentiment`, `price_brain_classification`, `implied_points`)
5. Frontend displays Price Brain score in RiskFlow cards

**Service Location**: `backend-hono/src/services/price-brain-service.ts`

---

### Supporting Services

#### Account Service (`/api/account`)
- User account management
- Billing tier management (free, pulse, pulse_plus, pulse_pro)
- Broker account synchronization
- Feature access control

#### Trading Service (`/api/trading`)
- Position management
- Order execution
- PnL tracking

#### ProjectX Service (`/api/projectx`)
- TopStepX API integration
- Account synchronization
- Order placement
- Real-time market data

#### Market Service (`/api/market`)
- VIX data
- Market indicators
- Public endpoints (no auth required)

#### AI Service (`/api/ai`)
- Chat interface
- Conversation management
- Tilt detection (future)

#### Notifications Service (`/notifications`)
- User notifications
- Real-time alerts

---

### Middleware Stack

1. **CORS Middleware** (`cors.ts`)
   - Allows requests from `pulse.solvys.io` and Vercel preview deployments
   - Handles preflight OPTIONS requests
   - Credentials enabled

2. **Auth Middleware** (`auth.ts`)
   - Validates Clerk JWT tokens
   - Extracts `userId` from token
   - Protects routes in `protectedRoutes` array

3. **Logger Middleware** (`logger.ts`)
   - Request/response logging
   - Error tracking

4. **Billing Guard Middleware** (`billing-guard.ts`)
   - Enforces billing tier requirements
   - Feature access control

---

### Database Schema (Key Tables)

```sql
-- User Management
users (
  id UUID, clerk_user_id VARCHAR(255) UNIQUE,
  email, first_name, last_name,
  created_at, updated_at, last_login_at
)

user_billing (
  user_id VARCHAR(255) PRIMARY KEY,
  tier VARCHAR(50), -- free, pulse, pulse_plus, pulse_pro
  created_at, updated_at
)

-- Trading
broker_accounts (
  id, user_id, account_id, account_name,
  balance, equity, margin_used, buying_power,
  last_synced_at, created_at
)

-- RiskFlow
news_articles (
  id, title, summary, content, source, url,
  published_at, sentiment, iv_impact, symbols,
  is_breaking, macro_level,
  price_brain_sentiment, price_brain_classification,
  implied_points, instrument, author_handle
)

scheduled_events (
  id, title, scheduled_time, source, impact,
  symbols, is_commentary, event_type
)

-- Autopilot
autopilot_proposals (...)
autopilot_executions (...)
```

---

## Frontend Architecture

### Technology Stack
- **Framework**: React 18
- **Build Tool**: Vite
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **State Management**: React Context API
- **Deployment**: Vercel

### Key Components

#### RiskFlow Components
- `NewsFeed.tsx` - Main RiskFlow feed container
- `FeedSection.tsx` - "The Tape" feed display
- `NewsSection.tsx` - News section with RiskFlow items
- `MinimalFeedSection.tsx` - Minimal feed widget
- `MinimalTapeWidget.tsx` - Compact tape widget
- `FloatingWidget.tsx` - Floating notifications for breaking news

#### Autopilot Components
- `mission-control/MissionControlPanel.tsx` - Main autopilot dashboard
- `mission-control/AlgoStatusWidget.tsx` - Autopilot status display
- (Autopilot UI components to be implemented)

#### Layout Components
- `MainLayout.tsx` - Main app layout
- `TopHeader.tsx` - Top navigation bar
- `NavSidebar.tsx` - Side navigation
- `SettingsPanel.tsx` - User settings panel

### API Client Architecture

**Location**: `frontend/lib/services.ts`

**Services**:
- `AccountService` - Account management
- `RiskFlowService` - RiskFlow feed queries
- `AIService` - AI chat interface
- `TradingService` - Trading operations
- `ProjectXService` - ProjectX integration
- `NotificationsService` - Notifications
- `ERService` - Emotional Resonance
- `EventsService` - Scheduled events
- `PolymarketService` - Polymarket odds

**API Client** (`apiClient.ts`):
- Handles authentication (Clerk JWT)
- Base URL configuration (`VITE_API_BASE_URL`)
- Error handling
- Request/response interceptors

### State Management

**Settings Context** (`SettingsContext.tsx`):
- User preferences
- Mock data toggle (`mockDataEnabled`)
- Trading model settings
- UI preferences

**Mock Data Generator** (`mockDataGenerator.ts`):
- Generates sample RiskFlow items for testing
- Used when `mockDataEnabled` is true
- Provides realistic-looking data for UI/UX testing

---

## Data Flow Examples

### RiskFlow Feed Display

```
1. User opens Pulse frontend
2. FeedSection component mounts
3. Calls backend.riskflow.list({ limit: 50 })
4. API Client sends GET /api/riskflow/feed?limit=50
5. Backend queries news_articles table
6. Returns articles with IV impact, sentiment, Price Brain scores
7. Frontend maps articles to RiskFlowItem[]
8. FeedSection renders cards with impact indicators
```

### Autopilot Proposal Workflow

```
1. Autopilot strategy engine detects trading opportunity
2. Risk validation checks pass
3. POST /api/autopilot/propose creates proposal
4. Proposal stored with status 'pending'
5. Frontend polls GET /api/autopilot/proposals
6. User sees proposal in UI
7. User clicks "Approve"
8. POST /api/autopilot/acknowledge updates status to 'approved'
9. User clicks "Execute"
10. POST /api/autopilot/execute calls ProjectX API
11. Order placed, execution stored in autopilot_executions
```

### Price Brain Layer Scoring

```
1. News article ingested with macro_level = 4
2. Backend triggers Price Brain scoring
3. scoreNewsWithPriceBrain() called with article data
4. Grok-4 analyzes via AI Gateway
5. Returns JSON: { sentiment: "Bullish", classification: "Counter-cyclical", impliedPoints: 15, confidence: 0.85 }
6. Score stored in news_articles table
7. Frontend displays Price Brain badge on RiskFlow card
```

---

## Security & Authentication

### Authentication Flow
1. User authenticates via Clerk (OAuth, email/password, etc.)
2. Clerk returns JWT token
3. Frontend stores token in memory/state
4. API Client includes token in `Authorization: Bearer <token>` header
5. Backend validates token via Clerk API
6. `authMiddleware` extracts `userId` from token
7. `userId` stored in Hono context for route handlers

### CORS Configuration
- **Allowed Origins**: `pulse.solvys.io`, `*.vercel.app`, `*.solvys.io`
- **Credentials**: Enabled
- **Methods**: GET, POST, PUT, DELETE, OPTIONS, PATCH, HEAD
- **Headers**: Content-Type, Authorization, X-Requested-With, etc.

### Billing Tier Access Control
- Features gated by billing tier (free, pulse, pulse_plus, pulse_pro)
- `feature_tier_mapping` table defines feature access
- `billing-guard.ts` middleware enforces access
- Frontend shows upgrade prompts for locked features

---

## Deployment

### Backend (Fly.io)
- **App Name**: `pulse-api-withered-dust-1394`
- **Region**: Auto-scaling
- **Health Check**: `GET /health`
- **Environment Variables**: `DATABASE_URL`, `CLERK_SECRET_KEY`, `CORS_ORIGINS`, etc.

### Frontend (Vercel)
- **Domain**: `pulse.solvys.io`
- **Build Command**: `bun run build`
- **Output Directory**: `dist`
- **Environment Variables**: `VITE_API_BASE_URL`, `VITE_CLERK_PUBLISHABLE_KEY`, etc.

### Database (Neon)
- **Provider**: Neon PostgreSQL
- **Type**: Serverless
- **Migrations**: Manual via `setup-database.sh` or Fly.io deployment hooks

---

## Environment Variables

### Backend
```bash
DATABASE_URL=postgresql://...
CLERK_SECRET_KEY=sk_...
CORS_ORIGINS=https://pulse.solvys.io,https://*.vercel.app
NODE_ENV=production
PORT=8080
```

### Frontend
```bash
VITE_API_BASE_URL=https://pulse-api-withered-dust-1394.fly.dev
VITE_CLERK_PUBLISHABLE_KEY=pk_...
VITE_BYPASS_AUTH=false
```

---

## Known Issues & Future Improvements

### Current Issues
1. **CORS Errors**: Some requests blocked by CORS policy (investigating)
2. **ERR_HTTP2_PROTOCOL_ERROR**: HTTP/2 protocol errors (may be Fly.io related)
3. **TypeScript Strictness**: Some implicit `any` types need explicit annotations

### Future Improvements
1. WebSocket support for real-time RiskFlow updates
2. Autopilot UI components (currently backend-only)
3. Enhanced Price Brain Layer with more models
4. Caching layer for RiskFlow queries
5. Rate limiting on API endpoints
6. Comprehensive error tracking (Sentry, etc.)

---

## Development Workflow

### Branch Naming
- Format: `v.{MONTH}.{DATE}.{PATCH}`
- Example: `v.2.27.9`

### Commit Format
- Format: `[v.X.X.X] type: message`
- Example: `[v.2.27.9] fix: Add explicit return types to billing-guard middleware`

### Testing
- Mock data feed available via Settings → Developer Settings
- Test autopilot proposals via `/api/autopilot/test` (when `AUTOPILOT_TEST_MODE=true`)

---

## API Documentation

### Base URL
- **Production**: `https://pulse-api-withered-dust-1394.fly.dev`
- **Local**: `http://localhost:8080`

### Authentication
All protected endpoints require `Authorization: Bearer <clerk_jwt_token>` header.

### Response Format
```json
{
  "articles": [...],
  "error": "...",
  "details": {...}
}
```

---

## Conclusion

Pulse v2.27.9 represents a modern, scalable architecture with clear separation of concerns:
- **RiskFlow**: Real-time market intelligence
- **Autopilot**: Automated trading with human oversight
- **Price Brain Layer**: AI-powered analysis

The system is designed for reliability, security, and extensibility, with room for future enhancements in real-time communication, caching, and advanced AI features.
