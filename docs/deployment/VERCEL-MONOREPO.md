# Vercel Monorepo Deployment - Frontend Only

## Official Documentation

**Primary Reference:**  
https://vercel.com/docs/monorepos

**Root Directory Configuration:**  
https://vercel.com/docs/projects/overview/root-directory

## Quick Setup for Frontend Deployment

### Option 1: Vercel Dashboard Configuration

1. **Import Project**
   - Go to https://vercel.com/new
   - Import your repository (`solvys/pulse`)

2. **Configure Root Directory**
   - In project settings → **"Root Directory"**
   - Set to: `frontend`
   - This tells Vercel to treat `frontend/` as the project root

3. **Build Settings** (Auto-detected, but verify)
   - **Framework Preset:** Next.js
   - **Root Directory:** `frontend`
   - **Build Command:** `npm run build` (runs in `frontend/`)
   - **Output Directory:** `.next` (Next.js default)
   - **Install Command:** `npm install` (runs in `frontend/`)

4. **Environment Variables**
   - Set in Vercel dashboard → Settings → Environment Variables:
     - `VITE_API_URL=https://pulse-api-withered-dust-1394.fly.dev`
     - `VITE_CLERK_PUBLISHABLE_KEY=pk_live_...`
     - `CLERK_SECRET_KEY=sk_live_...`
     - Any other required variables

### Option 2: Vercel CLI Configuration

```bash
cd frontend
vercel --cwd .
```

### Option 3: Root-Level `vercel.json` (Recommended for Monorepos)

Use a single, root-level `vercel.json` to control the build commands (✅ **this repo is configured this way**).

Important: if your Vercel Project **Root Directory is set to `frontend`**, then commands run inside `frontend/` already — so **do not** `cd frontend` in your commands.

```json
{
  "installCommand": "npm install",
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "framework": "vite",
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ],
  "regions": ["iad1"]
}
```

**This approach:**
- ✅ Keeps configuration version-controlled in git
- ✅ Avoids relying on Vercel dashboard “Root Directory” settings
- ✅ Explicitly runs install/build inside `frontend/`
- ✅ Works even though the repo root does not have a `package.json`

**Note:** If you prefer using the Vercel dashboard Root Directory = `frontend`, you can do that too—just keep `vercel.json` in the effective project root and avoid duplicates.

## Key Configuration Points

### Root Directory Setting
- **Location:** Vercel Dashboard → Project Settings → General → Root Directory
- **Value:** `frontend`
- **Effect:** All commands run relative to `frontend/` directory

### Build Settings
- **Framework:** Next.js (auto-detected)
- **Build Command:** `npm run build`
- **Output Directory:** `.next`
- **Install Command:** `npm install`

### Environment Variables
Set these in Vercel Dashboard → Settings → Environment Variables:

```bash
VITE_API_URL=https://pulse-api-withered-dust-1394.fly.dev
VITE_CLERK_PUBLISHABLE_KEY=pk_live_YOUR_KEY
CLERK_SECRET_KEY=sk_live_YOUR_KEY
```

## Verification

After deployment:
1. Check build logs to ensure commands run in `frontend/` directory
2. Verify environment variables are accessible
3. Test API calls to backend (should use `VITE_API_URL`)

## Troubleshooting

**Issue:** Build fails with "package.json not found"
- **Solution:** Ensure Root Directory is set to `frontend` in Vercel dashboard

**Issue:** Environment variables not accessible
- **Solution:** Verify variables are set for correct environment (Production/Preview/Development)

**Issue:** Build runs from wrong directory
- **Solution:** Double-check Root Directory setting in project settings

## References

- **Monorepo Guide:** https://vercel.com/docs/monorepos
- **Root Directory:** https://vercel.com/docs/projects/overview/root-directory
- **Next.js Deployment:** https://vercel.com/docs/frameworks/nextjs
- **Environment Variables:** https://vercel.com/docs/projects/environment-variables
