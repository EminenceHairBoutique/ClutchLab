import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@clutchlab/ui", "@clutchlab/config", "@clutchlab/types"],
  eslint: {
    // Linting runs as a dedicated `pnpm lint` gate; don't duplicate it inside `next build`.
    ignoreDuringBuilds: true,
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
