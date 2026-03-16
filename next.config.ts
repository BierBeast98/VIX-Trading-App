import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["yahoo-finance2", "cheerio"],
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
