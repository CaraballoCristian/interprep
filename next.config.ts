import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["better-sqlite3"],
  outputFileTracingExcludes: {
    // Never bundle the local SQLite file into the standalone image.
    "/*": ["./data/**/*"],
  },
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
