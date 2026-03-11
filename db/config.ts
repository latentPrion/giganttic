import { readFileSync } from "node:fs";
import path from "node:path";

const CONFIG_FILE_PATH = path.resolve(process.cwd(), "db", "config.json");

type DbConfigFile = {
  availableSchemaVersions: string[];
  CONFIG_GGTC_DB_RT_SCHEMA_SNAPSHOT_SUBDIR: string;
  CONFIG_GGTC_DB_RT_TARGET: string;
};

function readDbConfigFile(): DbConfigFile {
  return JSON.parse(readFileSync(CONFIG_FILE_PATH, "utf8")) as DbConfigFile;
}

function ensureNonEmptyValue(value: string, name: string): string {
  if (value.trim().length === 0) {
    throw new Error(`${name} must not be empty.`);
  }

  return value;
}

function ensureRuntimeSchemaIsAvailable(
  schemaName: string,
  availableSchemas: readonly string[],
): string {
  if (!availableSchemas.includes(schemaName)) {
    throw new Error(
      `Runtime schema snapshot subdir ${schemaName} is not listed in db/config.json availableSchemaVersions.`,
    );
  }

  return schemaName;
}

const config = readDbConfigFile();

export const availableSchemaVersions = config.availableSchemaVersions as readonly string[];

export type SchemaVersion = (typeof availableSchemaVersions)[number];

export const configuredRuntimeSchemaSnapshotSubdir = ensureRuntimeSchemaIsAvailable(
  ensureNonEmptyValue(
    config.CONFIG_GGTC_DB_RT_SCHEMA_SNAPSHOT_SUBDIR,
    "CONFIG_GGTC_DB_RT_SCHEMA_SNAPSHOT_SUBDIR",
  ),
  availableSchemaVersions,
) as SchemaVersion;

export const configuredRuntimeTarget = ensureNonEmptyValue(
  config.CONFIG_GGTC_DB_RT_TARGET,
  "CONFIG_GGTC_DB_RT_TARGET",
);

export function resolveRuntimeSchemaSnapshotSubdir(
  env: NodeJS.ProcessEnv = process.env,
): SchemaVersion {
  const selectedSchema =
    env.GGTC_DB_RT_SCHEMA_SNAPSHOT_SUBDIR
    ?? configuredRuntimeSchemaSnapshotSubdir;

  return ensureRuntimeSchemaIsAvailable(
    ensureNonEmptyValue(
      selectedSchema,
      "GGTC_DB_RT_SCHEMA_SNAPSHOT_SUBDIR",
    ),
    availableSchemaVersions,
  ) as SchemaVersion;
}

export function resolveRuntimeTarget(
  env: NodeJS.ProcessEnv = process.env,
): string {
  return ensureNonEmptyValue(
    env.GGTC_DB_RT_TARGET ?? configuredRuntimeTarget,
    "GGTC_DB_RT_TARGET",
  );
}
