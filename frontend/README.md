# Pulse Frontend

Vite + React frontend for Pulse - Integrated Trading Environment.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Create `.env.local` file:
```env
# Clerk Authentication (Required)
VITE_CLERK_PUBLISHABLE_KEY=pk_live_...

# Backend API (Required)
VITE_API_URL=https://pulse-api-withered-dust-1394.fly.dev
```

3. Run development server:
```bash
npm run dev
```

## Project Structure

- `src/` - Source code
  - `components/` - React components organized by feature
    - `layout/` - AppShell, HeaderBar, LayoutManager
    - `navigation/` - NavRail, NavSidebar
    - `tape/` - The Tape news feed
    - `price/` - Price AI chat interface
    - `riskflow/` - RiskFlow KPI dashboard
    - `journal/` - Journal calendar and day details
    - `econ/` - Econ Calendar with TradingView iframe
  - `lib/` - Utilities and API client
  - `types/` - TypeScript type definitions
  - `hooks/` - React hooks
  - `pages/` - Sign-in/Sign-up pages
- `public/` - Static assets
- `index.html` - Entry HTML file

## Features

- **AppShell** with 3 layout modes (Combined, Tickers Only, Moveable)
- **Navigation** with Rail + Peek/Pin Sidebar
- **The Tape** - News feed with IV impact and sentiment
- **Price** - AI chat assistant
- **RiskFlow** - KPI dashboard with area charts
- **Journal** - P&L calendar and day detail modal
- **Econ Calendar** - TradingView integration with interpretation

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_CLERK_PUBLISHABLE_KEY` | ✅ Yes | Clerk authentication key |
| `VITE_API_URL` | ✅ Yes | Backend API URL (Fly.io deployment) |

## Deployment

### Vercel Deployment Steps

1. **Connect Repository to Vercel**
   - Go to https://vercel.com/new
   - Import your `solvys/pulse` repository
   - Set **Root Directory** to `frontend`

2. **Configure Build Settings**
   - **Framework Preset:** Vite (auto-detected)
   - **Root Directory:** `frontend`
   - **Build Command:** `npm run build` (runs in `frontend/`)
   - **Output Directory:** `dist`
   - **Install Command:** `npm install`

3. **Set Environment Variables**
   In Vercel Dashboard → Project Settings → Environment Variables:
   - `VITE_CLERK_PUBLISHABLE_KEY` (required) - Get from Clerk Dashboard → API Keys
   - `VITE_API_URL` (required) - Fly.io backend URL: `https://pulse-api-withered-dust-1394.fly.dev`

4. **Deploy**
   - Click "Deploy"
   - Monitor build logs
   - Visit the deployment URL once complete

### Local Testing Before Deployment

```bash
# Test production build locally
cd frontend
npm run build
npm run start  # Serves on http://localhost:4173

# Test development server
npm run dev    # Serves on http://localhost:3000
```

### Current Status

✅ **Ready for Deployment:** App builds successfully and serves correctly
✅ **Vite Configuration:** Properly configured for Vercel
✅ **Environment Variables:** Documented and minimal (only Clerk required)
✅ **Mock Data:** All backend features use placeholder data

**Note:** The app is now configured for real backend integration with Fly.io. Ensure `VITE_API_URL` points to your deployed backend.

## Build

```bash
npm run build
```

Output will be in the `dist/` directory.
