import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  buildBackendConfigFromEnv,
} from "../backend/config/backend-config.js";
import {
  configuredRuntimeSchemaSnapshotSubdir,
  configuredRuntimeTarget,
  resolveRuntimeSchemaSnapshotSubdir,
  resolveRuntimeTarget,
} from "../db/config.js";

describe("db runtime config", () => {
  it("uses checked-in runtime defaults when no runtime env overrides are present", () => {
    expect(configuredRuntimeSchemaSnapshotSubdir).toBe("v2");
    expect(configuredRuntimeTarget).toBe("run/giganttic-dev.sqlite");
    expect(resolveRuntimeSchemaSnapshotSubdir({})).toBe("v2");
    expect(resolveRuntimeTarget({})).toBe("run/giganttic-dev.sqlite");
  });

  it("prefers runtime env overrides when they are provided", () => {
    const env = {
      GGTC_DB_RT_SCHEMA_SNAPSHOT_SUBDIR: "v1",
      GGTC_DB_RT_TARGET: "run/custom-runtime.sqlite",
    };

    expect(resolveRuntimeSchemaSnapshotSubdir(env)).toBe("v1");
    expect(resolveRuntimeTarget(env)).toBe("run/custom-runtime.sqlite");
  });

  it("builds backend runtime config from GGTC_DB_RT_* only", () => {
    const config = buildBackendConfigFromEnv({
      GGTC_DB_RT_SCHEMA_SNAPSHOT_SUBDIR: "v1",
      GGTC_DB_RT_TARGET: "run/runtime-prod.sqlite",
    });

    expect(config.runtimeSchemaSnapshotSubdir).toBe("v1");
    expect(config.dbPath).toBe(
      path.resolve(process.cwd(), "run/runtime-prod.sqlite"),
    );
  });
});
