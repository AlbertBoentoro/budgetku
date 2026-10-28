import type { NextConfig } from "next";

// Baseline security headers for every route. A full script/style CSP is
// intentionally not set yet: the app loads Google Fonts (Material Symbols)
// and Next.js inline scripts, so a strict CSP needs nonces and separate
// testing. The CSP below only uses directives that cannot block those assets.
// HSTS is already sent by Vercel for this deployment.
const securityHeaders = [
  // Block the app from being embedded in any frame (clickjacking).
  // frame-ancestors is the modern form; X-Frame-Options covers older browsers.
  {
    key: "Content-Security-Policy",
    value: "frame-ancestors 'none'; base-uri 'self'; object-src 'none'",
  },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), browsing-topics=()",
  },
];

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  experimental: {
    agentUpgrade: "security",
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
