import type { NextConfig } from "next";

const SECURITY_HEADERS = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "X-DNS-Prefetch-Control", value: "on" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  },
];

const nextConfig: NextConfig = {
  transpilePackages: [
    "@clutchlab/ui",
    "@clutchlab/config",
    "@clutchlab/types",
    "@clutchlab/content",
    "@clutchlab/meta-engine",
    "@clutchlab/coach",
    "@clutchlab/billing",
  ],
  eslint: {
    // Linting runs as a dedicated `pnpm lint` gate; don't duplicate it inside `next build`.
    ignoreDuringBuilds: true,
  },
  async headers() {
    return [
      { source: "/:path*", headers: SECURITY_HEADERS },
      {
        // The service worker must revalidate so updates propagate promptly.
        source: "/sw.js",
        headers: [{ key: "Cache-Control", value: "public, max-age=0, must-revalidate" }],
      },
    ];
  },
  webpack: (config) => {
    // Benign OpenTelemetry dynamic-require warning from @sentry/nextjs's server
    // bundle (the same suppression withSentryConfig applies).
    config.ignoreWarnings = [
      ...(config.ignoreWarnings ?? []),
      { module: /require-in-the-middle/ },
      { module: /@opentelemetry\/instrumentation/ },
    ];
    return config;
  },
};

export default nextConfig;
