import path from "node:path";

import { defineConfig } from "vitest/config";

import { configuredRuntimeSchemaSnapshotSubdir } from "./db/config.js";
import { defaultTestsuiteSqliteDbPath } from "./db/sqlite-db-paths.mjs";

export default defineConfig({
  resolve: {
    alias: {
      db: path.resolve(__dirname, "db/index.ts"),
    },
  },
  test: {
    env: {
      GGTC_DB_RT_SCHEMA_SNAPSHOT_SUBDIR: configuredRuntimeSchemaSnapshotSubdir,
      GGTC_DB_RT_TARGET: defaultTestsuiteSqliteDbPath,
    },
    environmentMatchGlobs: [["frontend/**/*.test.{ts,tsx}", "jsdom"]],
    setupFiles: ["frontend/src/test/setup-tests.ts"],
  },
});
