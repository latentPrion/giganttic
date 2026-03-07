import path from "node:path";

import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      db: path.resolve(__dirname, "db/index.ts"),
    },
  },
  test: {
    environmentMatchGlobs: [["frontend/**/*.test.{ts,tsx}", "jsdom"]],
    setupFiles: ["frontend/src/test/setup-tests.ts"],
  },
});
