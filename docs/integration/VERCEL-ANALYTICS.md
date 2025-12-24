# Vercel Web Analytics Setup Guide

This guide will help you set up and use Vercel Web Analytics on the Pulse frontend project.

## Prerequisites

- A Vercel account. If you don't have one, you can [sign up for free](https://vercel.com/signup).
- The Pulse project deployed to Vercel, or ready to be deployed.
- The Vercel CLI installed. If you don't have it, you can install it using:

```bash
npm install vercel
# or
pnpm add vercel
# or
yarn add vercel
# or
bun add vercel
```

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
# or
bun add @vercel/analytics
```

### 3. Add Analytics Component to Next.js App Layout

Update the root layout to include the Analytics component. The `Analytics` component offers seamless integration with Next.js, including automatic route tracking.

**File:** `frontend/app/layout.tsx`

```tsx
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ClerkProvider } from '@clerk/nextjs';
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Pulse - Integrated Trading Environment",
  description: "AI-powered trading environment with RiskFlow, Journal, and Econ Calendar",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body
          className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        >
          {children}
          <Analytics />
        </body>
      </html>
    </ClerkProvider>
  );
}
```

The key changes:
- Line 5: Import `Analytics` from `@vercel/analytics/next`
- Line 28: Add `<Analytics />` component at the end of the body

### 4. Deploy to Vercel

Deploy your app with the updated analytics configuration:

```bash
cd frontend
vercel deploy
```

Or if you've connected your Git repository (recommended), simply push to your main branch and Vercel will automatically deploy.

> **💡 Tip:** For seamless CI/CD, connect your Git repository to Vercel. This enables automatic deployments on every push to main without terminal commands.

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

See the [Custom Events Documentation](/docs/analytics/custom-events) for more details.

## Filtering and Analysis

Once you have data, you can:
- Filter by date range, page, device, browser, and country
- Create custom dashboards
- Export reports
- Set up alerts

See the [Filtering Documentation](/docs/analytics/filtering) for detailed instructions.

## Privacy and Compliance

Vercel Web Analytics is designed with privacy in mind:
- No cookies are used (completely cookie-free)
- GDPR, CCPA, and other privacy regulations compliant
- First-party data collection (no third-party tracking)
- No personal data is collected

See [Privacy Policy Documentation](/docs/analytics/privacy-policy) for complete details.

## Troubleshooting

### Analytics Not Showing Data

1. **Verify deployment:** Ensure you deployed the updated code with the `<Analytics />` component
2. **Check browser console:** Look for any errors in the browser DevTools console
3. **Verify network request:** Check that `/_vercel/insights/view` request is successful (Status 200)
4. **Wait for data:** It can take a few minutes for initial data to appear

### `/_vercel/insights/view` Returns 401/403

- **Cause:** Web Analytics might not be enabled on your Vercel project
- **Solution:** Go to your Vercel dashboard, select the project, and enable Analytics from the Analytics tab

### Performance Issues

If the analytics script affects page load time:

```typescript
// The script is loaded as deferred, so it shouldn't impact performance
// If you experience issues, check:
// 1. Network speed in DevTools
// 2. Total script size (should be < 50KB)
// 3. Server response time
```

## Next Steps

Now that Vercel Web Analytics is set up:

1. **Monitor basic metrics** - Get familiar with visitor trends and top pages
2. **Set up custom events** - Start tracking user interactions (Pro/Enterprise)
3. **Analyze performance** - Use performance metrics to optimize Pulse
4. **Create dashboards** - Build custom views of your most important metrics

## Additional Resources

- [Vercel Analytics Documentation](https://vercel.com/docs/analytics)
- [Vercel Analytics Package Reference](https://www.npmjs.com/package/@vercel/analytics)
- [Web Vitals Documentation](https://web.dev/vitals)
- [Privacy Documentation](/docs/analytics/privacy-policy)

## Support

For issues or questions:
- Check Vercel's [Analytics documentation](https://vercel.com/docs/analytics)
- Review the [troubleshooting section](#troubleshooting) above
- Contact Vercel support through your dashboard
