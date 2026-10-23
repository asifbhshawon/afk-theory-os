import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    fileParallelism: false,
    testTimeout: 20000,
    exclude: ["**/node_modules/**", "**/.next/**", "dist/**"],
    include: ["tests/**/*.test.ts"],
    env: {
      DATABASE_URL: "postgresql://postgres:postgres@127.0.0.1:5432/afk_test_db",
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
