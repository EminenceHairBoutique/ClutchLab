import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@clutchlab/ui", "@clutchlab/config"],
  eslint: {
    // Linting runs as a dedicated `pnpm lint` gate; don't duplicate it inside `next build`.
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
