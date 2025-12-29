# Clerk JWT Token Configuration Guide

## Required Configuration

### 1. API Keys Setup

**Frontend (Vercel):**
```bash
VITE_CLERK_PUBLISHABLE_KEY=pk_test_... or pk_live_...
```

**Backend (Fly.io):**
```bash
CLERK_SECRET_KEY=sk_test_... or sk_live_...
```

**Verification:**
- Both keys must be from the same Clerk application
- Use `test` keys for development, `live` keys for production
- Keys are found in: Clerk Dashboard → API Keys

### 2. Clerk Dashboard Settings

#### Session Token Settings
1. Go to: Clerk Dashboard → Sessions → Session Token Settings
2. Ensure "Session Tokens" are enabled
3. Default expiration: 7 days (adjust if needed)

#### Allowed Origins
1. Go to: Clerk Dashboard → Settings → Domains
2. Add your frontend domain: `https://pulse.solvys.io`
3. Add localhost for development: `http://localhost:3000`

#### CORS Configuration
- Backend must allow requests from your frontend domain
- Set in Fly.io secrets: `CORS_ORIGINS=https://pulse.solvys.io,http://localhost:3000`

### 3. Token Flow Verification

**Frontend:**
```typescript
// Gets JWT session token from Clerk
const token = await getToken(); // Returns JWT string
// Sends as: Authorization: Bearer <JWT_TOKEN>
```

**Backend:**
```typescript
// Verifies JWT with Clerk secret key
const payload = await verifyToken(token, {
  secretKey: env.CLERK_SECRET_KEY,
});
// Extracts userId from: payload.sub
```

### 4. Common Issues & Solutions

#### Issue: 401 Unauthorized
**Causes:**
- Token missing or null
- Token expired
- Secret key mismatch
- Token from different Clerk instance

**Solutions:**
- Verify `CLERK_SECRET_KEY` matches frontend's Clerk instance
- Check token expiration settings
- Ensure user is signed in before making requests

#### Issue: Token Not Available
**Causes:**
- User not signed in
- ClerkProvider not properly initialized
- Missing `VITE_CLERK_PUBLISHABLE_KEY`

**Solutions:**
- Verify ClerkProvider wraps the app
- Check environment variables are set
- Ensure user completes sign-in flow

### 5. Testing Token Flow

**Manual Test:**
1. Sign in to the app
2. Open browser console
3. Check Network tab for `/api/ai/chat` request
4. Verify `Authorization: Bearer <token>` header is present
5. Check backend logs for successful token verification

**Backend Logs:**
```
[AUTH] Verifying token for /api/ai/chat, CLERK_SECRET_KEY prefix: sk_test_...
[AUTH] verifyToken result: { hasPayload: true, sub: 'user_...' }
```

### 6. Production Checklist

- [ ] Use `pk_live_...` and `sk_live_...` keys in production
- [ ] Set `CORS_ORIGINS` to production domain only
- [ ] Verify session token expiration matches requirements
- [ ] Test token flow in production environment
- [ ] Monitor backend logs for authentication errors
- [ ] Set up error alerts for 401 responses

## Current Configuration

**Clerk Versions:**
- Frontend: `@clerk/clerk-react@^5.35.2`
- Backend: `@clerk/backend@^1.27.0`

**Token Type:** Default Clerk Session JWT Token
**Token Lifetime:** 7 days (Clerk default)
**Verification Method:** `verifyToken()` from `@clerk/backend`
