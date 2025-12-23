# Phase 3 — Migration (Backend Deployment & Integration)

> **Objective**: Deploy the Hono backend to **Fly.io**, integrate with the Vercel frontend, and implement the **Econ Calendar interpretation pipeline** (Playwright screenshot → AI extraction → cache → frontend consumption).

> **Key deliverable**: Backend is live on Fly.io, frontend can consume all APIs, and econ calendar interpretation works end-to-end.

---

## 3.1 Fly.io Deployment

### A) Dockerfile

```dockerfile
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# Production image
FROM node:20-alpine

WORKDIR /app

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY package.json ./

ENV NODE_ENV=production
ENV PORT=8080

EXPOSE 8080

CMD ["node", "dist/index.js"]
```

### B) fly.toml

```toml
app = "pulse-api"
primary_region = "ord"

[build]

[http_service]
  internal_port = 8080
  force_https = true
  auto_stop_machines = "stop"
  auto_start_machines = true
  min_machines_running = 1
  processes = ["app"]

[[http_service.checks]]
  grace_period = "10s"
  interval = "30s"
  method = "GET"
  path = "/health"
  timeout = "5s"

[env]
  NODE_ENV = "production"
```

### C) Deploy Commands

```bash
# Install Fly CLI
brew install flyctl

# Login
fly auth login

# Launch app (first time)
fly launch --name pulse-api --region ord --no-deploy

# Set secrets
fly secrets set NEON_DATABASE_URL="postgres://user:pass@host/db?sslmode=require"
fly secrets set CLERK_SECRET_KEY="sk_live_..."
fly secrets set PROJECTX_USERNAME="your-username"
fly secrets set PROJECTX_API_KEY="your-api-key"

# Deploy
fly deploy

# Check status
fly status
fly logs
```

---

## 3.2 Database Migration (Neon)

### Apply Migrations

```bash
# Connect to Neon
psql "postgres://user:pass@host/db?sslmode=require"

# Run migrations
\i migrations/1_init_schema.up.sql
\i migrations/4_create_journal_tables.up.sql
```

Or use Neon Console SQL Editor.

---

## 3.3 Econ Calendar Interpretation Pipeline

### Architecture

```mermaid
sequenceDiagram
  participant FE as Frontend (Vercel)
  participant API as Fly API (Hono)
  participant Queue as Job Queue
  participant PW as Playwright Worker
  participant TV as TradingView (iframe)
  participant AI as AI Vision/OCR
  participant DB as Neon Cache

  FE->>API: POST /econ/interpret {date,timezone,region}
  API->>Queue: Enqueue screenshot job
  Queue->>PW: Process job
  PW->>TV: Load econ calendar page
  PW->>PW: Screenshot full page
  PW->>AI: Extract events + summary (vision/OCR)
  AI-->>PW: Structured events + daily plan
  PW->>DB: Upsert econ_daily_plan
  PW-->>API: Job result
  API-->>FE: {events, plan, source: "tradingview_screenshot"}
  
  Note over FE,DB: Subsequent requests use cached data
  FE->>API: GET /econ/day/:date
  API->>DB: Query cached plan
  DB-->>API: Cached plan
  API-->>FE: Fast response
```

### A) Econ Routes (NEW)

#### `GET /econ/day/:date`
Returns cached econ calendar plan/events for a date.

**Path params:**
- `date` (format: `YYYY-MM-DD`)

**Response:**
```typescript
{
  date: string;
  plan: string;              // Daily macro plan summary
  events: Array<{
    time: string;             // HH:MM format
    currency: string;        // e.g., "USD", "EUR"
    impact: 'low' | 'medium' | 'high';
    title: string;            // Event title
  }>;
  source: 'tradingview_screenshot' | 'manual';
  cachedAt: string;          // ISO timestamp
}
```

**Implementation:**
```typescript
// src/routes/econ.ts
econRoutes.get('/day/:date', async (c) => {
  const userId = c.get('userId');
  const date = c.req.param('date');
  
  const [plan] = await sql`
    SELECT plan, events_json as events, source, updated_at as cached_at
    FROM econ_daily_plan
    WHERE user_id = ${userId}
      AND date = ${date}
    LIMIT 1
  `;
  
  if (!plan) {
    return c.json({ error: 'No plan found for this date. Use /econ/interpret to generate one.' }, 404);
  }
  
  return c.json({
    date,
    plan: plan.plan,
    events: plan.events || [],
    source: plan.source,
    cachedAt: plan.cached_at,
  });
});
```

#### `POST /econ/interpret`
Triggers Playwright screenshot + AI extraction for a date.

**Request body:**
```typescript
{
  date: string;              // YYYY-MM-DD
  timezone: string;           // e.g., "America/New_York"
  region: string;             // e.g., "US"
}
```

**Response:**
```typescript
{
  jobId: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  message: string;
}
```

**Implementation:**
```typescript
econRoutes.post('/interpret', async (c) => {
  const userId = c.get('userId');
  const { date, timezone, region } = await c.req.json();
  
  // Validate
  if (!date || !timezone || !region) {
    return c.json({ error: 'date, timezone, and region required' }, 400);
  }
  
  // Check if already cached (within last 6 hours)
  const [existing] = await sql`
    SELECT updated_at
    FROM econ_daily_plan
    WHERE user_id = ${userId}
      AND date = ${date}
      AND updated_at > NOW() - INTERVAL '6 hours'
  `;
  
  if (existing) {
    return c.json({
      jobId: null,
      status: 'completed',
      message: 'Plan already cached (refreshed within 6 hours)',
    });
  }
  
  // Enqueue Playwright job (or run synchronously if small)
  const jobId = `econ-${userId}-${date}-${Date.now()}`;
  
  // For MVP: Run synchronously (in production, use a job queue)
  try {
    const result = await interpretEconCalendar(date, timezone, region);
    
    // Store in cache
    await sql`
      INSERT INTO econ_daily_plan (user_id, date, plan, events_json, source, timezone, region)
      VALUES (${userId}, ${date}, ${result.plan}, ${JSON.stringify(result.events)}, 'tradingview_screenshot', ${timezone}, ${region})
      ON CONFLICT (user_id, date)
      DO UPDATE SET
        plan = EXCLUDED.plan,
        events_json = EXCLUDED.events_json,
        source = EXCLUDED.source,
        updated_at = NOW()
    `;
    
    return c.json({
      jobId,
      status: 'completed',
      message: 'Plan extracted and cached',
    });
  } catch (error) {
    console.error('Econ interpretation failed:', error);
    return c.json({
      jobId,
      status: 'failed',
      message: 'Failed to extract plan. Please try again.',
    }, 500);
  }
});
```

### B) Playwright Screenshot Service

**File: `src/services/econ-interpreter.ts`**

```typescript
import { chromium } from 'playwright';
import { anthropic } from '@ai-sdk/anthropic';
import { generateObject } from 'ai';

interface EconEvent {
  time: string;
  currency: string;
  impact: 'low' | 'medium' | 'high';
  title: string;
}

interface EconPlan {
  plan: string;
  events: EconEvent[];
}

export async function interpretEconCalendar(
  date: string,
  timezone: string,
  region: string
): Promise<EconPlan> {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  try {
    // Load TradingView econ calendar
    const url = `https://www.tradingview.com/economic-calendar/?region=${region}`;
    await page.goto(url, { waitUntil: 'networkidle' });
    
    // Wait for calendar to load
    await page.waitForSelector('[data-name="economic-calendar"]', { timeout: 10000 });
    
    // Screenshot the calendar section
    const screenshot = await page.screenshot({
      type: 'png',
      fullPage: false,
      clip: { x: 0, y: 0, width: 1200, height: 800 }, // Adjust to calendar area
    });
    
    // Convert to base64 for AI
    const base64Image = screenshot.toString('base64');
    
    // Extract events using AI vision
    const { object } = await generateObject({
      model: anthropic('claude-3-5-sonnet-20241022'),
      schema: {
        type: 'object',
        properties: {
          plan: {
            type: 'string',
            description: 'A concise daily macro plan summary (2-3 sentences)',
          },
          events: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                time: { type: 'string' },
                currency: { type: 'string' },
                impact: { type: 'string', enum: ['low', 'medium', 'high'] },
                title: { type: 'string' },
              },
            },
          },
        },
      },
      prompt: `Extract the economic calendar events for ${date} (${timezone}) from this TradingView screenshot. 
      Return a daily macro plan summary and a structured list of events with time, currency, impact level, and title.`,
      images: [`data:image/png;base64,${base64Image}`],
    });
    
    return {
      plan: object.plan,
      events: object.events,
    };
  } finally {
    await browser.close();
  }
}
```

### C) Database Schema for Econ Cache

**Migration: `5_create_econ_tables.up.sql`**

```sql
CREATE TABLE IF NOT EXISTS econ_daily_plan (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  date DATE NOT NULL,
  plan TEXT NOT NULL,
  events_json JSONB,
  source VARCHAR(50) NOT NULL DEFAULT 'tradingview_screenshot',
  timezone VARCHAR(50),
  region VARCHAR(10),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, date)
);

CREATE INDEX idx_econ_user_date ON econ_daily_plan(user_id, date);
CREATE INDEX idx_econ_updated ON econ_daily_plan(updated_at);
```

**Rollback: `5_create_econ_tables.down.sql`**

```sql
DROP TABLE IF EXISTS econ_daily_plan;
```

---

## 3.4 Frontend Integration

### A) Update Frontend API Client

The frontend (Phase 1) should consume:

- `GET /econ/day/:date` - Fast cached retrieval
- `POST /econ/interpret` - Trigger extraction (shows loading state)

### B) Econ Calendar Component Behavior

```typescript
// components/econ/EconCalendarPage.tsx
'use client';

export function EconCalendarPage() {
  const [plan, setPlan] = useState<EconPlan | null>(null);
  const [loading, setLoading] = useState(false);
  
  const handleInterpret = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/econ/interpret', {
        method: 'POST',
        body: JSON.stringify({
          date: new Date().toISOString().split('T')[0],
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          region: 'US',
        }),
      });
      
      const { jobId, status } = await res.json();
      
      if (status === 'completed') {
        // Fetch the cached plan
        const planRes = await fetch(`/api/econ/day/${date}`);
        const planData = await planRes.json();
        setPlan(planData);
      }
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div>
      {/* Simple local calendar (non-clickable) */}
      <SimpleCalendar />
      
      {/* TradingView iframe */}
      <TradingViewIframe />
      
      {/* Interpret button */}
      <Button onClick={handleInterpret} disabled={loading}>
        {loading ? 'Interpreting...' : 'Interpret Today'}
      </Button>
      
      {/* Plan display */}
      {plan && (
        <div>
          <h3>Daily Macro Plan</h3>
          <p>{plan.plan}</p>
          <ul>
            {plan.events.map((event, i) => (
              <li key={i}>
                {event.time} {event.currency} {event.impact} - {event.title}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
```

---

## 3.5 CORS Configuration

Ensure Fly API allows Vercel frontend:

```typescript
// src/middleware/cors.ts
import { cors } from 'hono/cors';

export const corsMiddleware = cors({
  origin: [
    'http://localhost:3000',
    'https://pulse.solvys.io',
    'https://*.vercel.app', // Vercel preview URLs
  ],
  credentials: true,
  allowHeaders: ['Content-Type', 'Authorization'],
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
});
```

---

## 3.6 Health Check

```typescript
// src/index.ts
app.get('/health', async (c) => {
  const dbHealthy = await checkDatabase();
  return c.json({
    status: dbHealthy ? 'healthy' : 'unhealthy',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || 'unknown',
  }, dbHealthy ? 200 : 503);
});
```

---

## 3.7 Phase 3 Exit Criteria

- Backend deployed to Fly.io
- Health check passes
- All routes accessible from Vercel frontend
- CORS configured correctly
- Database migrations applied to Neon
- Econ interpretation pipeline works end-to-end:
  - Playwright screenshot captures TradingView calendar
  - AI extracts events + plan
  - Results cached in Neon
  - Frontend can retrieve cached plan
- Frontend can display "NewsPlanForDay" in RiskFlow KPI Card4
- All integration tests pass

---

## 3.8 Monitoring & Observability

### Logging
Use structured logging (pino):

```typescript
import pino from 'pino';

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
});

// In routes
logger.info({ userId, date }, 'Econ interpretation requested');
logger.error({ error, jobId }, 'Econ interpretation failed');
```

### Error Handling
Wrap Playwright operations in try/catch and return user-friendly errors:

```typescript
try {
  const result = await interpretEconCalendar(date, timezone, region);
  // ...
} catch (error) {
  logger.error({ error, date, userId }, 'Econ interpretation failed');
  return c.json({
    error: 'Failed to interpret calendar. Please try again later.',
  }, 500);
}
```
