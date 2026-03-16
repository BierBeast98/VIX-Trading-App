import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["yahoo-finance2", "cheerio"],
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
