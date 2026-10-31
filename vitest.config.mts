import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["lib/**/*.test.ts", "tests/**/*.test.ts"],
    passWithNoTests: true,
  },
  resolve: {
    alias: {
      "@lib": path.resolve(import.meta.dirname, "./lib"),
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
});
