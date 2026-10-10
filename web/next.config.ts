import type { NextConfig } from "next";

// The app is fully client-side (all data comes from the chain), so no Cache Components.
const nextConfig: NextConfig = {
  // Load only the parts of these big libraries that the app uses.
  experimental: { optimizePackageImports: ["viem", "wagmi"] },
  // Old links (shared cards, partner widgets) keep working after /vault became /round.
  async redirects() {
    return [{ source: "/vault/:id", destination: "/round/:id", permanent: true }];
  },
};

export default nextConfig;
