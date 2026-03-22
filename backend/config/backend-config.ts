import path from "node:path";

import {
  resolveRuntimeSchemaSnapshotSubdir,
  resolveRuntimeTarget,
} from "../../db/config.js";

export interface BackendConfig {
  allowCloudGanttExportFallback: boolean;
  chartsDir: string;
  dbPath: string;
  ganttExportServerUrl: string | null;
  host: string;
  port: number;
  routePrefix: string;
  runtimeSchemaSnapshotSubdir: string;
  sessionTtlMs: number;
  createDbIfMissing: boolean;
}

export const BACKEND_CONFIG = Symbol("BACKEND_CONFIG");

export function buildBackendConfig(
  overrides: Partial<BackendConfig> = {},
): BackendConfig {
  return {
    allowCloudGanttExportFallback: true,
    chartsDir: path.resolve(process.cwd(), "charts"),
    dbPath: path.resolve(process.cwd(), resolveRuntimeTarget(process.env)),
    createDbIfMissing: false,
    ganttExportServerUrl: null,
    host: "127.0.0.1",
    port: 3000,
    routePrefix: "stc-proj-mgmt/api",
    runtimeSchemaSnapshotSubdir: resolveRuntimeSchemaSnapshotSubdir(process.env),
    sessionTtlMs: 1000 * 60 * 60 * 24 * 7,
    ...overrides,
  };
}

export function buildBackendConfigFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): BackendConfig {
  const overrides: Partial<BackendConfig> = {};

  overrides.allowCloudGanttExportFallback =
    env.GGTC_ALLOW_CLOUD_GANTT_EXPORT_FALLBACK !== "false";
  overrides.chartsDir = path.resolve(process.cwd(), "charts");
  overrides.dbPath = path.resolve(process.cwd(), resolveRuntimeTarget(env));
  overrides.ganttExportServerUrl = normalizeOptionalUrl(
    env.GGTC_GANTT_EXPORT_SERVER_URL,
  );
  overrides.runtimeSchemaSnapshotSubdir = resolveRuntimeSchemaSnapshotSubdir(env);

  if (env.GGTC_CREATE_DB_IF_MISSING) {
    overrides.createDbIfMissing = env.GGTC_CREATE_DB_IF_MISSING !== "false";
  }

  if (env.PORT) {
    const port = Number(env.PORT);
    if (Number.isFinite(port)) {
      overrides.port = port;
    }
  }

  if (env.HOST) {
    overrides.host = env.HOST;
  }

  if (env.GGTC_SESSION_TTL_MS) {
    const sessionTtlMs = Number(env.GGTC_SESSION_TTL_MS);
    if (Number.isFinite(sessionTtlMs)) {
      overrides.sessionTtlMs = sessionTtlMs;
    }
  }

  return buildBackendConfig(overrides);
}

function normalizeOptionalUrl(value: string | undefined): string | null {
  const trimmedValue = value?.trim() ?? "";

  return trimmedValue.length > 0 ? trimmedValue : null;
}
