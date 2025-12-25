# Fly.io Deployment Guide for Pulse API

## Important: No New Repository Needed!

**You do NOT need to create a new repository.** Deploy directly from the `backend-hono/` directory.

## Prerequisites

1. **Fly CLI installed**: `brew install flyctl`
2. **Logged into Fly.io**: `fly auth login`
3. **All secrets ready** (see below)

## Deployment Steps

### 1. Navigate to Backend Directory

```bash
cd backend-hono
```

### 2. First-Time Setup (Only if app doesn't exist)

```bash
# Launch app (creates fly.toml if needed, but we already have one)
fly launch --name pulse-api --region ord --no-deploy
```

**Note**: If the app already exists, skip this step.

### 3. Set Required Secrets

Set all environment variables as Fly.io secrets:

```bash
fly secrets set NEON_DATABASE_URL="postgres://user:pass@host/db?sslmode=require"
fly secrets set CLERK_SECRET_KEY="sk_live_..."
fly secrets set PROJECTX_USERNAME="your-username"
fly secrets set PROJECTX_API_KEY="your-api-key"
```

**Optional secrets** (if needed):
```bash
fly secrets set CORS_ORIGINS="http://localhost:3000,https://pulse.solvys.io"
fly secrets set LOG_LEVEL="info"
```

### 4. Verify Build Works Locally

```bash
npm install
npm run build
```

The build should complete without errors. If you see TypeScript errors, fix them before deploying.

### 5. Deploy to Fly.io

```bash
fly deploy
```

### 6. Check Deployment Status

```bash
# Check app status
fly status

# View logs
fly logs

# Check health endpoint
curl https://pulse-api.fly.dev/health
```

## Troubleshooting

### Build Fails During Deployment

1. **Check TypeScript errors locally**: `npm run build`
2. **Verify all dependencies are in package.json**
3. **Check Dockerfile is correct**

### App Crashes After Deployment

1. **Check logs**: `fly logs`
2. **Verify all secrets are set**: `fly secrets list`
3. **Check database connection**: Ensure `NEON_DATABASE_URL` is correct
4. **Verify Clerk key**: Ensure `CLERK_SECRET_KEY` is valid

### Health Check Fails

1. **Check database connectivity**: The `/health` endpoint tests the database
2. **Verify Neon database is accessible** from Fly.io
3. **Check network/firewall settings**

### CORS Errors

1. **Verify CORS_ORIGINS secret** includes your frontend URL
2. **Check CORS middleware** in `src/middleware/cors.ts`
3. **Ensure frontend uses correct API URL**

## Environment Variables Reference

| Variable | Required | Description |
|----------|----------|-------------|
| `NEON_DATABASE_URL` | ✅ Yes | Neon PostgreSQL connection string |
| `CLERK_SECRET_KEY` | ✅ Yes | Clerk secret key for authentication |
| `PROJECTX_USERNAME` | Optional | TopStepX username |
| `PROJECTX_API_KEY` | Optional | TopStepX API key |
| `CORS_ORIGINS` | Optional | Comma-separated list of allowed origins (default: localhost:3000) |
| `LOG_LEVEL` | Optional | Logging level: debug, info, warn, error (default: info) |
| `PORT` | Auto-set | Server port (default: 8080, set by Fly.io) |
| `NODE_ENV` | Auto-set | Environment (set to "production" by Fly.io) |

## Getting Your Fly.io URL

After deployment, your API will be available at:
- `https://pulse-api.fly.dev` (or your custom domain if configured)

Update your frontend's `VITE_API_URL` environment variable to point to this URL.

## Frontend Analytics (Vercel Web Analytics)

The frontend is configured with Vercel Web Analytics for monitoring user interactions, page views, and performance metrics.

**Setup:**
- The `@vercel/analytics` package is installed in `frontend/package.json`
- The `Analytics` component is integrated in `frontend/app/layout.tsx`
- Web Analytics must be enabled in the Vercel dashboard

**To enable:**
1. Go to your Vercel dashboard and select the Pulse project
2. Click the **Analytics** tab and click **Enable**
3. Deploy the frontend

See `docs/integration/VERCEL-ANALYTICS.md` for complete setup and usage instructions.

## Next Steps

1. ✅ Backend deployed to Fly.io
2. ✅ Update frontend `VITE_API_URL` to point to Fly.io backend
3. ✅ Test API connectivity from frontend
4. ✅ Verify all routes work correctly
5. ✅ (Optional) Set up Vercel Web Analytics for monitoring
