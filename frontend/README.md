# Pulse Frontend

Next.js 14 App Router frontend for Pulse - Integrated Trading Environment.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Create `.env.local` file:
```env
# Clerk Authentication
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...

# Backend API
NEXT_PUBLIC_API_URL=http://localhost:8080

# AI Provider (for Price chat)
ANTHROPIC_API_KEY=sk-ant-...
```

3. Run development server:
```bash
npm run dev
```

## Project Structure

- `app/` - Next.js App Router pages and API routes
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

## Features

- **AppShell** with 3 layout modes (Combined, Tickers Only, Moveable)
- **Navigation** with Rail + Peek/Pin Sidebar
- **The Tape** - News feed with IV impact and sentiment
- **Price** - AI chat assistant
- **RiskFlow** - KPI dashboard with area charts
- **Journal** - P&L calendar and day detail modal
- **Econ Calendar** - TradingView integration with interpretation

## Deployment

Deploy to Vercel:

1. Connect your repository to Vercel
2. Set environment variables in Vercel dashboard
3. Deploy

The project includes `vercel.json` for deployment configuration.

## Build

```bash
npm run build
```

Note: Build requires all environment variables to be set.
