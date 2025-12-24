# Vercel Web Analytics Setup Guide

This guide will help you set up and use Vercel Web Analytics on the Pulse frontend project (Vite + React).

## Prerequisites

- A Vercel account. If you don't have one, you can [sign up for free](https://vercel.com/signup).
- The Pulse project deployed to Vercel, or ready to be deployed.

## Setup Steps

### 1. Enable Web Analytics in Vercel Dashboard

1. Go to the [Vercel Dashboard](https://vercel.com/dashboard)
2. Select the **Pulse** project
3. Click the **Analytics** tab
4. Click **Enable** from the dialog

> **💡 Note:** Enabling Web Analytics will add new routes (scoped at `/_vercel/insights/*`) after your next deployment.

### 2. Add `@vercel/analytics` Package

Add the `@vercel/analytics` package to the frontend project:

```bash
cd frontend

npm install @vercel/analytics
# or
pnpm add @vercel/analytics
# or
yarn add @vercel/analytics
```

### 3. Add Analytics Component to React App

Update the main entry point to include the Analytics component. For Vite + React projects, use the `react` import.

**File:** `frontend/src/main.tsx`

```tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { ClerkProvider } from '@clerk/clerk-react'
import { Analytics } from '@vercel/analytics/react'
import App from './App.tsx'
import './index.css'

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY

if (!PUBLISHABLE_KEY) {
  throw new Error("Missing Publishable Key")
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ClerkProvider publishableKey={PUBLISHABLE_KEY}>
      <BrowserRouter>
        <App />
        <Analytics />
      </BrowserRouter>
    </ClerkProvider>
  </React.StrictMode>,
)
```

The key changes:
- Import `Analytics` from `@vercel/analytics/react` (not `/next`)
- Add `<Analytics />` component inside the React tree

### 4. Deploy to Vercel

Deploy your app with the updated analytics configuration. With your Git repository connected, simply push to your main branch and Vercel will automatically deploy.

```bash
git add .
git commit -m "feat: Add Vercel Analytics"
git push
```

Once deployed, Vercel Web Analytics will start tracking visitors and page views automatically.

### 5. Verify Analytics is Working

After deployment:

1. Visit your deployed Pulse application
2. Open your browser's **Network** tab (DevTools)
3. Look for a request to `/_vercel/insights/view`

You should see a successful fetch/XHR request to this endpoint, confirming that analytics tracking is active.

### 6. View Your Data in Dashboard

Once your app is deployed and users have visited your site:

1. Go to your [Vercel Dashboard](https://vercel.com/dashboard)
2. Select the **Pulse** project
3. Click the **Analytics** tab

After a few days of visitor data, you'll be able to explore:
- Page views and visitor counts
- Top pages and user paths
- Traffic sources and geographic data
- Real user monitoring (RUM) metrics

## Features Available

### Basic Analytics (All Plans)
- Page views and unique visitors
- Top pages
- Bounce rate and session duration
- Geographic data
- Device and browser information

### Advanced Features (Pro & Enterprise)
- Custom events tracking (button clicks, form submissions, purchases, etc.)
- Advanced filtering and segmentation
- Audience insights
- Performance monitoring

## Custom Events (Pro & Enterprise)

To track custom events like button clicks or form submissions, use the `track` function:

```typescript
import { track } from '@vercel/analytics';

// Track a custom event
function handleClick() {
  track('button_clicked', {
    button_name: 'submit',
    page: 'trading_dashboard'
  });
}
```

See the [Custom Events Documentation](https://vercel.com/docs/analytics/custom-events) for more details.

## Environment Variables for Vite

Pulse uses these environment variables (set in Vercel Dashboard → Settings → Environment Variables):

| Variable | Description | Required |
|----------|-------------|----------|
| `VITE_CLERK_PUBLISHABLE_KEY` | Clerk authentication publishable key | Yes |
| `VITE_API_URL` | Backend API URL (Fly.io) | Yes |

> **Note:** Vite uses the `VITE_` prefix for environment variables (not `NEXT_PUBLIC_`).

## Privacy and Compliance

Vercel Web Analytics is designed with privacy in mind:
- No cookies are used (completely cookie-free)
- GDPR, CCPA, and other privacy regulations compliant
- First-party data collection (no third-party tracking)
- No personal data is collected

See [Privacy Policy Documentation](https://vercel.com/docs/analytics/privacy-policy) for complete details.

## Troubleshooting

### Analytics Not Showing Data

1. **Verify deployment:** Ensure you deployed the updated code with the `<Analytics />` component
2. **Check browser console:** Look for any errors in the browser DevTools console
3. **Verify network request:** Check that `/_vercel/insights/view` request is successful (Status 200)
4. **Wait for data:** It can take a few minutes for initial data to appear

### `/_vercel/insights/view` Returns 401/403

- **Cause:** Web Analytics might not be enabled on your Vercel project
- **Solution:** Go to your Vercel dashboard, select the project, and enable Analytics from the Analytics tab

## Additional Resources

- [Vercel Analytics Documentation](https://vercel.com/docs/analytics)
- [Vercel Analytics Package Reference](https://www.npmjs.com/package/@vercel/analytics)
- [Vite Environment Variables](https://vitejs.dev/guide/env-and-mode.html)

## Support

For issues or questions:
- Check Vercel's [Analytics documentation](https://vercel.com/docs/analytics)
- Review the [troubleshooting section](#troubleshooting) above
- Contact Vercel support through your dashboard
