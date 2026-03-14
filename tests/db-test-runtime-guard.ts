import path from "node:path";

import {
  defaultDevSqliteDbPath,
  defaultProdSqliteDbPath,
  defaultProddevSqliteDbPath,
  defaultTestsuiteSqliteDbPath,
} from "../db/sqlite-db-paths.mjs";

const REQUIRED_DB_TEST_ENV_ERROR_PREFIX =
  "DB-affecting tests require explicit GGTC_DB_RT_* configuration.";
const CANONICAL_DB_TEST_RUNTIME_TARGET = defaultTestsuiteSqliteDbPath;
const FORBIDDEN_CANONICAL_DB_TARGETS = [
  defaultDevSqliteDbPath,
  defaultProdSqliteDbPath,
  defaultProddevSqliteDbPath,
] as const;

function createRequiredTargetMessage() {
  return `GGTC_DB_RT_TARGET must be set to ${CANONICAL_DB_TEST_RUNTIME_TARGET} for DB-affecting tests.`;
}

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

  if (runtimeTarget !== CANONICAL_DB_TEST_RUNTIME_TARGET) {
    throw new Error(createRequiredTargetMessage());
  }

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
  const forbiddenPaths = [
    runtimeConfig.runtimeTargetPath,
    ...FORBIDDEN_CANONICAL_DB_TARGETS.map((target) => path.resolve(process.cwd(), target)),
  ];

  if (forbiddenPaths.includes(path.resolve(dbPath))) {
    throw new Error(
      `${contextLabel} must not target the runtime DB path or canonical dev/prod/proddev DBs.`,
    );
  }
}
