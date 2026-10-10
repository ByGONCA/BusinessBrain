import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";

// Content-Security-Policy directives
// In production, 'unsafe-eval' is strictly excluded.
// It is explicitly isolated to development mode solely for Next.js Fast Refresh source mapping.
const scriptSrcDirectives = [
  "'self'",
  "https://js.stripe.com",
  "'unsafe-inline'", // Required for Next.js App Router hydration scripts
  ...(isDev ? ["'unsafe-eval'"] : []),
];

const cspDirectives = [
  "default-src 'self'",
  `script-src ${scriptSrcDirectives.join(" ")}`,
  "style-src 'self' 'unsafe-inline'", // Required for Tailwind CSS runtime and Next.js styles
  "img-src 'self' data: blob: https: http: https://*.supabase.co https://lh3.googleusercontent.com https://avatars.githubusercontent.com https://*.stripe.com",
  "font-src 'self' data:",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.stripe.com https://accounts.google.com https://oauth2.googleapis.com",
  "frame-src 'self' https://js.stripe.com https://hooks.stripe.com",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self' https://accounts.google.com https://github.com",
];

const securityHeaders = [
  {
    key: "X-DNS-Prefetch-Control",
    value: "on",
  },
  {
    key: "Strict-Transport-Security",
    // Configured without preload as requested
    value: "max-age=63072000; includeSubDomains",
  },
  {
    key: "X-Frame-Options",
    value: "DENY",
  },
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), browsing-topics=()",
  },
  {
    key: "Content-Security-Policy",
    value: cspDirectives.join("; "),
  },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
