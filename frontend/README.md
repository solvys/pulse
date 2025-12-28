# Pulse v4 Frontend

A modern React-based trading assistant frontend, designed to work with a Hono API backend.

## Features

- **Real-time Market Data**: VIX tracking, news feeds, and market intelligence
- **Trading Interface**: Position tracking, account management, and trading controls
- **AI Chat Assistant**: Interactive chat with tilt detection and emotional resonance monitoring
- **Mission Control**: Comprehensive dashboard with ER monitoring, blindspots, and algo status
- **Responsive Design**: Dark theme with customizable layouts

## Prerequisites

- **Node.js** 18+ or **Bun** 1.0+
- A Hono API backend (see Backend Integration below)

## Installation

```bash
# Using Bun (recommended)
bun install

# Or using npm
npm install
```

## Development

Start the development server:

```bash
# Using Bun
bun run dev

# Or using npm
npm run dev
```

The app will be available at `http://localhost:5173`

## Environment Variables

Create a `.env` file in the frontend directory:

```env
# API Configuration
VITE_API_BASE_URL=http://localhost:3000

# Clerk Authentication (optional - can be bypassed in dev mode)
VITE_CLERK_PUBLISHABLE_KEY=your_clerk_publishable_key

# Development Mode (bypasses authentication)
VITE_BYPASS_AUTH=true
```

## Backend Integration

This frontend is designed to work with a Hono API backend. The API client expects the following endpoints:

### Account Endpoints
- `GET /api/account` - Get user account
- `POST /api/account` - Create account
- `PATCH /api/account/settings` - Update account settings
- `PATCH /api/account/tier` - Update account tier

### RiskFlow Endpoints
- `GET /api/riskflow?limit={limit}&offset={offset}` - List RiskFlow items
- `GET /api/riskflow/feed?limit={limit}&offset={offset}` - Get RiskFlow feed
- `POST /api/riskflow/seed` - Seed RiskFlow data
- `GET /api/market/vix` - Get VIX value

### AI Endpoints
- `POST /api/ai/chat` - Send chat message
- `POST /api/ai/ntn-report` - Generate NTN report

### Trading Endpoints
- `GET /api/trading/positions` - List positions
- `POST /api/trading/positions/seed` - Seed positions

### ProjectX Endpoints
- `GET /api/projectx/accounts` - List ProjectX accounts
- `POST /api/projectx/uplink` - Uplink to ProjectX
- `POST /api/projectx/sync` - Sync ProjectX accounts

### Notifications Endpoints
- `GET /api/notifications` - List notifications
- `POST /api/notifications/{id}/read` - Mark notification as read

### ER (Emotional Resonance) Endpoints
- `GET /api/er/sessions` - Get ER sessions
- `POST /api/er/sessions` - Save ER session

### Events Endpoints
- `GET /api/events` - List events

## API Client

The frontend uses a custom API client located in `lib/apiClient.ts`. The client:

- Automatically handles authentication tokens (Bearer tokens)
- Provides type-safe service wrappers
- Handles errors consistently
- Supports development mode without authentication

## Authentication

The frontend supports Clerk authentication. In development mode, authentication can be bypassed by setting `VITE_BYPASS_AUTH=true`.

### With Clerk
1. Set `VITE_CLERK_PUBLISHABLE_KEY` in your `.env` file
2. Ensure your backend validates Clerk JWT tokens
3. The API client will automatically include the Bearer token in requests

### Without Clerk (Dev Mode)
1. Set `VITE_BYPASS_AUTH=true` in your `.env` file
2. The frontend will work without authentication
3. Your backend should handle unauthenticated requests in development

## Building for Production

```bash
# Using Bun
bun run build

# Or using npm
npm run build
```

The built files will be in the `dist` directory.

## Project Structure

```
frontend/
├── components/          # React components
│   ├── feed/           # News feed components
│   ├── layout/         # Layout components
│   ├── mission-control/ # Mission control widgets
│   └── ...
├── contexts/           # React contexts
├── lib/               # Utilities and API client
│   ├── apiClient.ts   # Hono API client
│   ├── backend.ts     # Backend hook and service wrappers
│   └── services.ts    # Service class definitions
├── types/             # TypeScript type definitions
├── hooks/             # Custom React hooks
└── utils/             # Utility functions
```

## Customization

### API Base URL
Update `VITE_API_BASE_URL` in your `.env` file or modify `lib/apiClient.ts`:

```typescript
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
```

### API Endpoints
Update endpoint paths in `lib/services.ts` to match your Hono backend routes.

### Type Definitions
Update types in `types/api.ts` to match your backend response types.

## Troubleshooting

### API Connection Issues
- Verify `VITE_API_BASE_URL` is correct
- Check CORS settings on your backend
- Ensure your backend is running

### Authentication Issues
- Check that `VITE_CLERK_PUBLISHABLE_KEY` is set correctly
- Verify your backend validates JWT tokens properly
- In dev mode, set `VITE_BYPASS_AUTH=true`

### Build Errors
- Clear `node_modules` and reinstall dependencies
- Check that all environment variables are set
- Verify TypeScript types match your backend

## License

Proprietary - Solvys Technologies / Priced In Research
