# Vercel AI Gateway Setup

This project uses **Vercel AI Gateway** for centralized billing and API management.

## Benefits

- ✅ **Centralized Billing**: Pay for all AI usage through Vercel dashboard
- ✅ **No Markup**: Same rates as provider list prices
- ✅ **Single API Key**: One key for all AI providers
- ✅ **Unified Management**: Monitor and manage all AI usage in one place

## Setup Steps

### 1. Get Your Vercel AI Gateway API Key

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Navigate to your project settings
3. Go to **AI Gateway** section
4. Create a new gateway or use existing one
5. Copy your **Gateway API Key**

### 2. Set Environment Variable

Add to your `.env` file:

```bash
VERCEL_AI_GATEWAY_API_KEY=your_gateway_api_key_here
```

### 3. Purchase Credits (Optional)

- Go to Vercel Dashboard → AI Gateway → Credits
- Purchase credits to pay for AI usage
- Credits are used automatically when making API calls

### 4. Supported Models

The following models are configured to work with Vercel AI Gateway:

- **Anthropic Claude Opus 4.5**: `anthropic/claude-opus-4-20250514`
- **XAI Grok 4**: `xai/grok-4`
- **XAI Grok Vision 1212**: `xai/grok-2-1212`

## How It Works

1. When `VERCEL_AI_GATEWAY_API_KEY` is set, all AI requests route through Vercel AI Gateway
2. Vercel handles billing and rate limiting
3. You pay only for what you use at provider list prices
4. All usage is tracked in Vercel dashboard

## Fallback Behavior

If `VERCEL_AI_GATEWAY_API_KEY` is not set, the system will fall back to direct provider API keys:
- `ANTHROPIC_API_KEY` for Claude models
- `XAI_API_KEY` for Grok models

## Pricing

- **No markup**: You pay the same rates as if using providers directly
- **Pay-as-you-go**: Only charged for actual API usage
- **Transparent**: See all costs in Vercel dashboard

## Documentation

- [Vercel AI Gateway Docs](https://vercel.com/docs/ai-gateway)
- [Getting Started Guide](https://vercel.com/docs/ai-gateway/getting-started)
- [Pricing Information](https://vercel.com/docs/ai-gateway/pricing)
