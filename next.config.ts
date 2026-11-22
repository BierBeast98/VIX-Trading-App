import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: { cpus: 1 },
  serverExternalPackages: ["tesseract.js", "@tesseract.js-data/deu", "yahoo-finance2", "cheerio", "@neondatabase/serverless", "@prisma/adapter-neon", "@prisma/client", "ws"],
  outputFileTracingIncludes: {
    "/api/signals/check": ["./node_modules/@tesseract.js-data/deu/4.0.0/*", "./node_modules/tesseract.js/src/**/*", "./node_modules/tesseract.js-core/*"],
    "/api/telegram/receipts": ["./node_modules/@tesseract.js-data/deu/4.0.0/*", "./node_modules/tesseract.js/src/**/*", "./node_modules/tesseract.js-core/*"],
  },
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
