# Handoff: Pulse Backend Authentication & Feed Stability Issues

## Previous Session Summary
✅ **Fixed**: CORS and HTTP/2 protocol errors were resolved by updating `fly.toml`:
- Changed `primary_region` from `iad` to `ord`
- Set `min_machines_running = 1`
- Added HTTP health check on `/health`
- Changes pushed to branch `v2.28.1`

❌ **Still Broken**: Authentication (401 errors) and feed data flooding

---

## Current Error State

### Browser Console Errors
```
GET https://pulse-api-withered-dust-1394.fly.dev/api/account 401 (Unauthorized)
GET https://pulse-api-withered-dust-1394.fly.dev/api/riskflow/feed?limit=50 401 (Unauthorized)
Failed to fetch account: {code: 'unauthenticated', message: 'HTTP 401: ', status: 401}
```

**Issue**: Thousands of 401 errors spewing in 30 seconds. Even when logged in via Clerk, auth tokens aren't being accepted.

### Mock Data Feed Flooding
When mock data feed is enabled, it floods with 3000+ newsfeed notification cards in an uncontrollable stream.

---

## Investigation Required

### 1. Authentication Flow (Priority: CRITICAL)
**Current Architecture:**
- Frontend: Clerk authentication
- Backend: `backend-hono/src/middleware/auth.ts` verifies Clerk JWT tokens
- Secret: `CLERK_SECRET_KEY` is set in Fly.io secrets

**Questions to answer:**
- [ ] Is frontend sending `Authorization: Bearer <token>` header correctly?
- [ ] Is `CLERK_SECRET_KEY` on Fly.io matching Clerk dashboard?
- [ ] Is the token being extracted and verified correctly?

**Files to review:**
- `backend-hono/src/middleware/auth.ts` - Auth verification logic
- `frontend/lib/apiClient.ts` - How tokens are attached to requests
- `frontend/contexts/` - Clerk provider setup

### 2. Vercel AI Gateway Integration
**User reports:** "Is there anything we need to set up in Vercel's AI gateway?"

**Research needed:**
- [ ] Read Vercel AI SDK cookbook (open source docs)
- [ ] Verify architecture matches required setup
- [ ] Check if `VERCEL_AI_GATEWAY_API_KEY` is configured correctly
- [ ] Verify AI routes are using gateway properly

**Files to review:**
- `backend-hono/src/routes/` - AI-related routes
- `backend-hono/src/env.ts` - `VERCEL_AI_GATEWAY_API_KEY` usage

### 3. Rate Limiting / Error Flooding (Priority: HIGH)
**Problem**: 2000+ errors in 30 seconds when auth fails

**Fixes needed:**
- [ ] Add retry backoff on auth failure in frontend
- [ ] Stop polling when receiving 401s
- [ ] Add rate limiting to prevent error cascades

**Files to review:**
- `frontend/lib/apiClient.ts` - Request handling
- `frontend/components/` - Components that poll data

### 4. Mock Data Feed Flooding (Priority: MEDIUM)
**Problem**: Mock data generates 3000+ newsfeed items uncontrollably

**Fixes needed:**
- [ ] Limit mock data batch size
- [ ] Add proper pagination/virtualization
- [ ] Only render visible items in viewport

**Files to review:**
- `frontend/components/` - RiskFlow/newsfeed components
- Mock data generation logic

---

## Key Files & Architecture

### Backend (Hono on Fly.io)
```
backend-hono/
├── src/
│   ├── index.ts              # Entry point, middleware order
│   ├── middleware/
│   │   ├── auth.ts           # Clerk JWT verification
│   │   └── cors.ts           # CORS configuration
│   ├── routes/
│   │   ├── account.ts        # Account endpoints (401 errors here)
│   │   └── riskflow.ts       # RiskFlow feed (401 errors here)
│   └── env.ts                # Environment variable schema
├── fly.toml                  # Fly.io configuration (recently fixed)
└── Dockerfile
```

### Frontend (React + Vite on Vercel)
```
frontend/
├── lib/
│   └── apiClient.ts          # API client with auth token
├── components/
│   ├── chat/                 # AI chat components
│   └── ...                   # Other components
├── contexts/                 # Clerk provider, etc.
└── vite.config.ts
```

### Environment Variables
**Fly.io (Backend):**
- `CLERK_SECRET_KEY` - Must match Clerk dashboard
- `CORS_ORIGINS` - Should include `https://pulse.solvys.io`
- `VERCEL_AI_GATEWAY_API_KEY`
- `NEON_DATABASE_URL`

**Vercel (Frontend):**
- `VITE_API_URL` - Backend URL (check if set correctly to Fly.io)
- Clerk publishable key

---

## Immediate Actions

### Step 1: Debug Auth Flow
```bash
# Check Clerk secret key format on Fly.io
flyctl secrets list -a pulse-api-withered-dust-1394

# Watch backend logs while making a request
flyctl logs -a pulse-api-withered-dust-1394
```

### Step 2: Test Auth Manually
```bash
# Get a token from browser (Network tab > request > Authorization header)
# Then test directly:
curl -X GET https://pulse-api-withered-dust-1394.fly.dev/api/account \
  -H "Authorization: Bearer <YOUR_TOKEN>" \
  -H "Origin: https://pulse.solvys.io" \
  -v
```

### Step 3: Add Error Rate Limiting
In `frontend/lib/apiClient.ts`, add:
- Retry backoff on 401/403
- Stop polling on auth failure
- Max retry limits

### Step 4: Research Vercel AI Gateway
- Visit: https://sdk.vercel.ai/docs (Vercel AI SDK docs)
- Check if current implementation matches required setup

---

## Success Criteria
- [ ] Frontend successfully authenticates to backend (no 401s)
- [ ] Error count stays reasonable (< 10 per minute during normal operation)
- [ ] Mock data feed shows controlled number of items (paginated)
- [ ] AI features work via Vercel AI Gateway (if applicable)

---

## Branch Info
- **Current branch**: `v2.28.1`
- **Previous fixes**: CORS/HTTP2 protocol errors (deployed and working)
