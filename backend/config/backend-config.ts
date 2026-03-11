import path from "node:path";

export interface BackendConfig {
  dbPath: string;
  ensureReferenceData: boolean;
  failIfTestDataPresent: boolean;
  host: string;
  port: number;
  routePrefix: string;
  seedTestAccounts: boolean;
  sessionTtlMs: number;
  createDbIfMissing: boolean;
}

export const BACKEND_CONFIG = Symbol("BACKEND_CONFIG");

export function buildBackendConfig(
  overrides: Partial<BackendConfig> = {},
): BackendConfig {
  return {
    dbPath: path.resolve(process.cwd(), "run/giganttic.sqlite"),
    createDbIfMissing: false,
    ensureReferenceData: true,
    failIfTestDataPresent: false,
    host: "127.0.0.1",
    port: 3000,
    routePrefix: "stc-proj-mgmt/api",
    seedTestAccounts: false,
    sessionTtlMs: 1000 * 60 * 60 * 24 * 7,
    ...overrides,
  };
}

export function buildBackendConfigFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): BackendConfig {
  const overrides: Partial<BackendConfig> = {};

  if (env.GGTC_DB_PATH) {
    overrides.dbPath = path.resolve(process.cwd(), env.GGTC_DB_PATH);
  }

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

  if (env.GGTC_SEED_TEST_ACCOUNTS) {
    overrides.seedTestAccounts = env.GGTC_SEED_TEST_ACCOUNTS !== "false";
  }

  if (env.GGTC_ENSURE_REFERENCE_DATA) {
    overrides.ensureReferenceData = env.GGTC_ENSURE_REFERENCE_DATA !== "false";
  }

  if (env.GGTC_FAIL_IF_TEST_DATA_PRESENT) {
    overrides.failIfTestDataPresent =
      env.GGTC_FAIL_IF_TEST_DATA_PRESENT !== "false";
  }

  return buildBackendConfig(overrides);
}
