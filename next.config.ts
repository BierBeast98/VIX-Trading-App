import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["yahoo-finance2", "cheerio", "@neondatabase/serverless", "@prisma/adapter-neon", "@prisma/client", "ws"],
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
