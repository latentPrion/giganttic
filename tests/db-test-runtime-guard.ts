import path from "node:path";

const REQUIRED_DB_TEST_ENV_ERROR_PREFIX =
  "DB-affecting tests require explicit GGTC_DB_RT_* configuration.";

function readRequiredValue(
  env: NodeJS.ProcessEnv,
  variableName: "GGTC_DB_RT_TARGET" | "GGTC_DB_RT_SCHEMA_SNAPSHOT_SUBDIR",
) {
  const value = env[variableName];

  if (!value) {
    throw new Error(
      [
        REQUIRED_DB_TEST_ENV_ERROR_PREFIX,
        `Missing ${variableName}.`,
        "Set both GGTC_DB_RT_TARGET and GGTC_DB_RT_SCHEMA_SNAPSHOT_SUBDIR before running npm test.",
      ].join(" "),
    );
  }

  return value;
}

export interface DbTestRuntimeConfig {
  runtimeSchemaSnapshotSubdir: string;
  runtimeTarget: string;
  runtimeTargetPath: string;
}

export function getRequiredDbTestRuntimeConfig(
  env: NodeJS.ProcessEnv = process.env,
  projectRoot = process.cwd(),
): DbTestRuntimeConfig {
  const runtimeTarget = readRequiredValue(env, "GGTC_DB_RT_TARGET");
  const runtimeSchemaSnapshotSubdir = readRequiredValue(
    env,
    "GGTC_DB_RT_SCHEMA_SNAPSHOT_SUBDIR",
  );

  return {
    runtimeSchemaSnapshotSubdir,
    runtimeTarget,
    runtimeTargetPath: path.resolve(projectRoot, runtimeTarget),
  };
}

export function requireDbTestRuntimeConfig(
  env: NodeJS.ProcessEnv = process.env,
  projectRoot = process.cwd(),
) {
  return getRequiredDbTestRuntimeConfig(env, projectRoot);
}

export function assertDoesNotUseRuntimeDbPath(
  dbPath: string,
  runtimeConfig: DbTestRuntimeConfig,
  contextLabel: string,
) {
  if (path.resolve(dbPath) === runtimeConfig.runtimeTargetPath) {
    throw new Error(
      `${contextLabel} must not target the runtime DB path ${runtimeConfig.runtimeTargetPath}.`,
    );
  }
}
