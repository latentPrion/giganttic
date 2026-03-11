import { readFile } from "node:fs/promises";

const CONFIG_FILE_URL = new URL("./config.json", import.meta.url);

function ensureNonEmptyValue(value, name) {
  if (!value || value.trim().length === 0) {
    throw new Error(`${name} must not be empty.`);
  }

  return value;
}

export async function readRuntimeConfigFile() {
  return JSON.parse(await readFile(CONFIG_FILE_URL, "utf8"));
}

export async function resolveConfiguredRuntimeTarget() {
  const config = await readRuntimeConfigFile();
  return ensureNonEmptyValue(
    config.CONFIG_GGTC_DB_RT_TARGET,
    "CONFIG_GGTC_DB_RT_TARGET",
  );
}

export async function resolveConfiguredRuntimeSchemaSnapshotSubdir() {
  const config = await readRuntimeConfigFile();
  return ensureNonEmptyValue(
    config.CONFIG_GGTC_DB_RT_SCHEMA_SNAPSHOT_SUBDIR,
    "CONFIG_GGTC_DB_RT_SCHEMA_SNAPSHOT_SUBDIR",
  );
}

export async function resolveRuntimeTarget(env = process.env) {
  return ensureNonEmptyValue(
    env.GGTC_DB_RT_TARGET ?? await resolveConfiguredRuntimeTarget(),
    "GGTC_DB_RT_TARGET",
  );
}

export async function resolveRuntimeSchemaSnapshotSubdir(env = process.env) {
  return ensureNonEmptyValue(
    env.GGTC_DB_RT_SCHEMA_SNAPSHOT_SUBDIR
      ?? await resolveConfiguredRuntimeSchemaSnapshotSubdir(),
    "GGTC_DB_RT_SCHEMA_SNAPSHOT_SUBDIR",
  );
}
