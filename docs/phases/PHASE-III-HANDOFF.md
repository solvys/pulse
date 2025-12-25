# Phase 3 Handoff — Backend Deployment Complete, Frontend Integration Next

## Context

You are continuing Phase 3 of the Pulse migration project. Phase 1 (frontend migration to Next.js/Vercel) and Phase 2 (backend migration from Encore to Hono/Neon) are complete. The backend is now deployed to Fly.io and needs to be integrated with the frontend.

## Current State

### ✅ Completed

1. **Backend Deployment to Fly.io**
   - App Name: `pulse-api-withered-dust-1394`
   - URL: `https://pulse-api-withered-dust-1394.fly.dev`
   - Health endpoint: `/health` — returns `{"status":"healthy","timestamp":"...","version":"1.0.0"}`
   - Root endpoint: `/` — returns `{"name":"Pulse API","version":"1.0.0","status":"running"}`

2. **Secrets Configured**
   - `NEON_DATABASE_URL` — Connected to Neon PostgreSQL
   - `CLERK_SECRET_KEY` — Authentication configured
   - `PROJECTX_USERNAME` — TopStepX integration ready
   - `PROJECTX_API_KEY` — TopStepX API key set
   - `CORS_ORIGINS` — Set to `http://localhost:3000,https://pulse.solvys.io`

3. **Build & TypeScript Issues Fixed**
   - Clerk authentication middleware updated to use `verifyToken` API
   - TypeScript compilation errors resolved
   - Build completes successfully

4. **Project Structure**
   - Backend: `/pulse/backend-hono/`
   - Frontend: `/pulse/frontend/` (Vite + React 19)
   - Both in same monorepo

### 🔄 In Progress / Next Steps

1. **Frontend API Client**
   - Create/update API client utility to connect frontend to backend
   - Configure `VITE_API_URL` environment variable
   - Ensure all API calls use the Fly.io backend URL

2. **API Endpoint Verification**
   - Verify all frontend API calls match backend routes
   - Test authentication flow (Clerk tokens)
   - Verify CORS configuration works

3. **Integration Testing**
   - Test Journal routes (`/journal/stats`, `/journal/calendar`, `/journal/date/:date`)
   - Test ER/Blindspot routes (`/er/date/:date`, `/er/blindspots/:date`)
   - Test Econ routes (`/econ/day/:date`, `/econ/interpret`)
   - Test core routes (ProjectX, Trading, Market, News, IV Scoring)

4. **Documentation & API Mapping**
   - Verify API integrations match official documentation (Clerk, ProjectX, etc.)
   - Ensure all request/response formats match Phase 2 specifications

5. **Git Workflow**
   - Create branch `v.2.23.4`
   - Commit integration changes
   - Follow commit message format: `[v.2.23.4] feat: Connect frontend to Fly.io backend`

## Key Information

### Backend API Base URL
```
https://pulse-api-withered-dust-1394.fly.dev
```

### Required Frontend Environment Variable
```env
VITE_API_URL=https://pulse-api-withered-dust-1394.fly.dev
```

### Backend Routes Available

**Journal:**
- `GET /journal/stats?startDate=&endDate=`
- `GET /journal/calendar?month=YYYY-MM`
- `GET /journal/date/:date`

**ER/Blindspot:**
- `GET /er/date/:date`
- `GET /er/blindspots/:date`

**Econ:**
- `GET /econ/day/:date`
- `POST /econ/interpret` (body: `{date, timezone, region}`)

**Core Routes:**
- `GET /projectx/accounts`
- `GET /projectx/orders`
- `GET /market/vix`
- `GET /news/feed`
- `GET /iv-scoring/calculate?symbol=MNQ`

**Health:**
- `GET /health`
- `GET /` (root)

### Authentication

All protected routes require Clerk JWT token in Authorization header:
```
Authorization: Bearer <clerk-jwt-token>
```

The backend validates tokens using `@clerk/backend` `verifyToken` function.

## Tasks to Complete

### 1. Frontend API Client Setup

**Location:** `/pulse/frontend/lib/api-client.ts` (or similar)

Create a centralized API client that:
- Uses `VITE_API_URL` from environment
- Handles Clerk token injection (client-side via `useAuth`, server-side via middleware)
- Provides typed methods for all backend routes
- Handles errors consistently
- Includes proper TypeScript types

### 2. Environment Configuration

**Location:** `/pulse/frontend/.env.local` or Vercel environment variables

Set:
```env
VITE_API_URL=https://pulse-api-withered-dust-1394.fly.dev
```

### 3. Update Frontend Components

Update all components that make API calls to use the new API client:
- Journal components (calendar, stats, day detail)
- RiskFlow components (KPI cards, NewsPlanForDay)
- Econ Calendar components (interpret button, plan display)
- Any other components making backend calls

### 4. CORS Verification

Verify CORS is working:
- Test from `http://localhost:3000` (local dev)
- Test from Vercel preview URLs (should match `*.vercel.app` pattern)
- Test from production `https://pulse.solvys.io`

### 5. Integration Testing

Test each route category:
- ✅ Health check (already verified)
- Journal routes with real user data
- ER/Blindspot routes
- Econ routes (may need Playwright setup for interpretation)
- Core routes (ProjectX, Market, News, IV Scoring)

### 6. Error Handling

Ensure consistent error handling:
- 401 Unauthorized → Redirect to login or show auth error
- 404 Not Found → Show appropriate "not found" message
- 500 Server Error → Show user-friendly error message
- Network errors → Show retry option

### 7. Git Workflow

```bash
# Create branch
git checkout -b v.2.23.4

# Stage changes
git add .

# Commit with proper format
git commit -m "[v.2.23.4] feat: Connect frontend to Fly.io backend

- Add API client utility for backend communication
- Configure VITE_API_URL environment variable
- Update all frontend components to use new API client
- Verify CORS configuration and authentication flow
- Test all API endpoints end-to-end"

# Push branch
git push origin v.2.23.4
```

## Important Notes

1. **Do NOT modify frontend UI elements** — User hasn't seen the migrated version yet. Only connect APIs.

2. **Reference Phase 3 Plan** — Use `docs/phases/PHASE-III-BACKEND-DEPLOY.md` as guardrails and objectives.

3. **API Documentation** — Verify all integrations match official documentation:
   - Clerk: https://clerk.com/docs
   - ProjectX/TopStepX: Check their API docs
   - TradingView: For econ calendar iframe integration

4. **TypeScript Strict Mode** — Ensure all code passes TypeScript strict checks.

5. **Error Handling** — All API calls should have proper error handling and user feedback.

## Files to Check/Update

### Backend (already deployed, may need minor fixes)
- `/pulse/backend-hono/src/middleware/cors.ts` — CORS configuration
- `/pulse/backend-hono/src/middleware/auth.ts` — Clerk authentication
- `/pulse/backend-hono/src/routes/*.ts` — All route handlers

### Frontend (needs integration work)
- `/pulse/frontend/lib/api-client.ts` — API client utility (create/update)
- `/pulse/frontend/.env.local` — Environment variables
- `/pulse/frontend/app/**/*.tsx` — Pages using API calls
- `/pulse/frontend/components/**/*.tsx` — Components making API calls

## Success Criteria

- [ ] Frontend can successfully call all backend endpoints
- [ ] Authentication works (Clerk tokens validated)
- [ ] CORS allows requests from Vercel frontend
- [ ] All API routes return expected data structures
- [ ] Error handling is consistent and user-friendly
- [ ] TypeScript compiles without errors
- [ ] Branch `v.2.23.4` created with integration commits
- [ ] No frontend UI modifications (only API connectivity)

## Quick Start Commands

```bash
# Navigate to frontend
cd pulse/frontend

# Check current API configuration
grep -r "VITE_API_URL" .env* || echo "Not set"

# Check for existing API client
find . -name "*api*client*" -o -name "*api*.ts" -o -name "*api*.tsx"

# Test backend health
curl https://pulse-api-withered-dust-1394.fly.dev/health

# Create branch
git checkout -b v.2.23.4
```

## Questions to Resolve

1. Does the frontend already have an API client? If so, update it. If not, create one.
2. Are there any existing API calls that need to be migrated?
3. What's the current state of the frontend deployment on Vercel?
4. Are there any specific API endpoints that are critical to test first?

---

**Status:** Backend deployed and healthy. Ready for frontend integration.

**Next Action:** Create/update frontend API client and connect all API calls to Fly.io backend.
