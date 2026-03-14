import path from "node:path";

import { describe, expect, it } from "vitest";

import { defaultTestsuiteSqliteDbPath } from "../db/sqlite-db-paths.mjs";
import {
  assertDoesNotUseRuntimeDbPath,
  getRequiredDbTestRuntimeConfig,
} from "./db-test-runtime-guard.js";

describe("db test runtime guard", () => {
  it("fails when GGTC_DB_RT_TARGET is missing", () => {
    expect(() =>
      getRequiredDbTestRuntimeConfig({
        GGTC_DB_RT_SCHEMA_SNAPSHOT_SUBDIR: "v2",
      }),
    ).toThrow(/Missing GGTC_DB_RT_TARGET/i);
  });

  it("fails when GGTC_DB_RT_SCHEMA_SNAPSHOT_SUBDIR is missing", () => {
    expect(() =>
      getRequiredDbTestRuntimeConfig({
        GGTC_DB_RT_TARGET: "run/giganttic-dev.sqlite",
      }),
    ).toThrow(/Missing GGTC_DB_RT_SCHEMA_SNAPSHOT_SUBDIR/i);
  });

  it("returns the resolved runtime target path when both variables are set", () => {
    expect(
      getRequiredDbTestRuntimeConfig(
        {
          GGTC_DB_RT_SCHEMA_SNAPSHOT_SUBDIR: "v2",
          GGTC_DB_RT_TARGET: defaultTestsuiteSqliteDbPath,
        },
        "/tmp/project-root",
      ),
    ).toEqual({
      runtimeSchemaSnapshotSubdir: "v2",
      runtimeTarget: defaultTestsuiteSqliteDbPath,
      runtimeTargetPath: path.resolve(
        "/tmp/project-root",
        defaultTestsuiteSqliteDbPath,
      ),
    });
  });

  it("fails when the runtime DB target is not the shared testsuite DB", () => {
    expect(() =>
      getRequiredDbTestRuntimeConfig({
        GGTC_DB_RT_SCHEMA_SNAPSHOT_SUBDIR: "v2",
        GGTC_DB_RT_TARGET: "run/giganttic-dev.sqlite",
      }),
    ).toThrow(/must be set to run\/giganttic-testsuite\.sqlite/i);
  });

  it("fails when a destructive test path points at the runtime DB", () => {
    const runtimeConfig = getRequiredDbTestRuntimeConfig(
      {
        GGTC_DB_RT_SCHEMA_SNAPSHOT_SUBDIR: "v2",
        GGTC_DB_RT_TARGET: defaultTestsuiteSqliteDbPath,
      },
      "/tmp/project-root",
    );

    expect(() =>
      assertDoesNotUseRuntimeDbPath(
        path.resolve("/tmp/project-root", defaultTestsuiteSqliteDbPath),
        runtimeConfig,
        "destructive suite",
      ),
    ).toThrow(/must not target the runtime DB path or canonical dev\/prod\/proddev DBs/i);
  });

  it("fails when a destructive test path points at the canonical dev DB", () => {
    const runtimeConfig = getRequiredDbTestRuntimeConfig(
      {
        GGTC_DB_RT_SCHEMA_SNAPSHOT_SUBDIR: "v2",
        GGTC_DB_RT_TARGET: defaultTestsuiteSqliteDbPath,
      },
      process.cwd(),
    );

    expect(() =>
      assertDoesNotUseRuntimeDbPath(
        path.resolve(process.cwd(), "run/giganttic-dev.sqlite"),
        runtimeConfig,
        "destructive suite",
      ),
    ).toThrow(/must not target the runtime DB path or canonical dev\/prod\/proddev DBs/i);
  });
});
