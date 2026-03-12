import path from "node:path";

import { describe, expect, it } from "vitest";

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
          GGTC_DB_RT_TARGET: "run/giganttic-dev.sqlite",
        },
        "/tmp/project-root",
      ),
    ).toEqual({
      runtimeSchemaSnapshotSubdir: "v2",
      runtimeTarget: "run/giganttic-dev.sqlite",
      runtimeTargetPath: path.resolve(
        "/tmp/project-root",
        "run/giganttic-dev.sqlite",
      ),
    });
  });

  it("fails when a destructive test path points at the runtime DB", () => {
    const runtimeConfig = getRequiredDbTestRuntimeConfig(
      {
        GGTC_DB_RT_SCHEMA_SNAPSHOT_SUBDIR: "v2",
        GGTC_DB_RT_TARGET: "run/giganttic-dev.sqlite",
      },
      "/tmp/project-root",
    );

    expect(() =>
      assertDoesNotUseRuntimeDbPath(
        path.resolve("/tmp/project-root", "run/giganttic-dev.sqlite"),
        runtimeConfig,
        "destructive suite",
      ),
    ).toThrow(/must not target the runtime DB path/i);
  });
});
