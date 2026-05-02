import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

// Strict CSP for the marketing site.
// Static-rendered pages can't use nonces, so we allow 'unsafe-inline' for both
// scripts and styles. Without 'unsafe-inline' on script-src, Next.js's inline
// hydration scripts (the __next_f.push() bootstrap) get blocked and React never
// hydrates the client components — interactive forms fall through to native
// HTML submission. The proper long-term fix is nonce-based CSP via proxy.ts
// (deferred to Phase 7 polish), which keeps a strict posture while supporting
// hydration of static-rendered pages.
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' blob: data:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "frame-src 'none'",
  "manifest-src 'self'",
  "media-src 'self'",
  "worker-src 'self' blob:",
  "upgrade-insecure-requests",
].join("; ");

const permissionsPolicy = [
  "accelerometer=()",
  "autoplay=()",
  "camera=()",
  "display-capture=()",
  "encrypted-media=()",
  "fullscreen=(self)",
  "geolocation=()",
  "gyroscope=()",
  "magnetometer=()",
  "microphone=()",
  "midi=()",
  "payment=()",
  "picture-in-picture=()",
  "publickey-credentials-get=()",
  "screen-wake-lock=()",
  "sync-xhr=()",
  "usb=()",
  "xr-spatial-tracking=()",
].join(", ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: permissionsPolicy },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
  { key: "X-DNS-Prefetch-Control", value: "off" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  // Don't ship source maps in the production server bundle. OpenNext
  // would otherwise inline them into the Cloudflare Worker, eating a
  // big chunk of the 3 MB / 10 MB script-size budget.
  productionBrowserSourceMaps: false,
  experimental: {
    // Enables React's <ViewTransition> component for cross-page navigation.
    // See docs/decisions and node_modules/next/dist/docs/01-app/02-guides/view-transitions.md
    viewTransition: true,
    // File uploads on requests use Server Actions with multipart/form-data.
    // Default limit is 1MB; we allow 30MB total for the form (max 10MB per
    // file × 10 files = 100MB but most users send 1-3 small attachments).
    serverActions: {
      bodySizeLimit: "30mb",
    },
    // Per-icon imports for these packages — without this, the whole
    // barrel gets pulled in and tree-shaking misses. Critical for the
    // Cloudflare Worker 3 MB free-tier ceiling.
    optimizePackageImports: ["lucide-react", "motion"],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
      {
        source: "/.well-known/security.txt",
        headers: [{ key: "Content-Type", value: "text/plain; charset=utf-8" }],
      },
    ];
  },
};

export default nextConfig;
