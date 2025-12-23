import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'app.topstepx.com',
      },
    ],
  },
  // Allow iframes from TradingView and TopStepX
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: "frame-src 'self' https://www.tradingview.com https://app.topstepx.com;",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
