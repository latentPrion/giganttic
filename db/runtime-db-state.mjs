import { createHash } from "node:crypto";
import { mkdir } from "node:fs/promises";
import path from "node:path";

import { openDatabaseConnection } from "./native-sqlite.mjs";

const APPLIED_MIGRATIONS_TABLE_NAME = "_Giganttic_AppliedMigrations";
const RUNTIME_METADATA_TABLE_NAME = "_Giganttic_RuntimeMetadata";
const SCHEMA_NAME_METADATA_KEY = "schemaName";

function createRuntimeMetadataTableSql() {
  return `CREATE TABLE IF NOT EXISTS ${RUNTIME_METADATA_TABLE_NAME} (
  key TEXT PRIMARY KEY NOT NULL,
  value TEXT NOT NULL
);`;
}

function createAppliedMigrationsTableSql() {
  return `CREATE TABLE IF NOT EXISTS ${APPLIED_MIGRATIONS_TABLE_NAME} (
  migrationPairName TEXT PRIMARY KEY NOT NULL,
  fromSchemaName TEXT NOT NULL,
  toSchemaName TEXT NOT NULL,
  checksumSha256 TEXT NOT NULL,
  appliedAt TEXT NOT NULL
);`;
}

function createSchemaNameSelectSql() {
  return `SELECT value FROM ${RUNTIME_METADATA_TABLE_NAME} WHERE key = '${SCHEMA_NAME_METADATA_KEY}';`;
}

function createSchemaNameUpsertSql(schemaName) {
  return `INSERT INTO ${RUNTIME_METADATA_TABLE_NAME} (key, value)
VALUES ('${SCHEMA_NAME_METADATA_KEY}', '${schemaName}')
ON CONFLICT(key) DO UPDATE SET value = excluded.value;`;
}

function createAppliedMigrationUpsertSql(record) {
  return `INSERT INTO ${APPLIED_MIGRATIONS_TABLE_NAME} (
  migrationPairName,
  fromSchemaName,
  toSchemaName,
  checksumSha256,
  appliedAt
)
VALUES (
  '${record.migrationPairName}',
  '${record.fromSchemaName}',
  '${record.toSchemaName}',
  '${record.checksumSha256}',
  '${record.appliedAt}'
)
ON CONFLICT(migrationPairName) DO UPDATE SET
  fromSchemaName = excluded.fromSchemaName,
  toSchemaName = excluded.toSchemaName,
  checksumSha256 = excluded.checksumSha256,
  appliedAt = excluded.appliedAt;`;
}

async function openDatabaseFromPath(dbPath) {
  await mkdir(path.dirname(dbPath), { recursive: true });
  return openDatabaseConnection(dbPath);
}

function ensureOperationalTables(db) {
  db.exec(createRuntimeMetadataTableSql());
  db.exec(createAppliedMigrationsTableSql());
}

function readCurrentSchemaName(db) {
  ensureOperationalTables(db);
  const row = db.prepare(createSchemaNameSelectSql()).raw(true).get();

  if (!row || row[0] === undefined) {
    return null;
  }

  return String(row[0]);
}

function writeCurrentSchemaName(db, schemaName) {
  ensureOperationalTables(db);
  db.exec(createSchemaNameUpsertSql(schemaName));
}

function recordAppliedMigration(db, record) {
  ensureOperationalTables(db);
  db.exec(createAppliedMigrationUpsertSql(record));
}

function createMigrationChecksum(contentsByFileName) {
  const digest = createHash("sha256");
  const sortedEntries = [...contentsByFileName.entries()].sort(([left], [right]) =>
    left.localeCompare(right)
  );

  for (const [fileName, contents] of sortedEntries) {
    digest.update(fileName);
    digest.update("\n");
    digest.update(contents);
    digest.update("\n");
  }

  return digest.digest("hex");
}

export {
  APPLIED_MIGRATIONS_TABLE_NAME,
  RUNTIME_METADATA_TABLE_NAME,
  SCHEMA_NAME_METADATA_KEY,
  createMigrationChecksum,
  ensureOperationalTables,
  openDatabaseFromPath,
  readCurrentSchemaName,
  recordAppliedMigration,
  writeCurrentSchemaName,
};
