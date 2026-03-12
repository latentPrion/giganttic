import path from "node:path";
import {
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { createHash } from "node:crypto";

import { afterEach, describe, expect, it } from "vitest";
import initSqlJs from "sql.js";

import {
  DRIZZLE_MIGRATIONS_FILE_NAME,
  POST_STRUCTURAL_DATA_MIGRATION_FILE_NAME,
  PRE_STRUCTURAL_DATA_MIGRATION_FILE_NAME,
} from "../db/migration-files.mjs";
import {
  migrateDatabase,
  parseMigrateArgs,
  resolveDbTargetPaths,
} from "../db/migrate.mjs";
import {
  APPLIED_MIGRATIONS_TABLE_NAME,
  RUNTIME_METADATA_TABLE_NAME,
  SCHEMA_NAME_METADATA_KEY,
} from "../db/runtime-db-state.mjs";
import {
  defaultDevSqliteDbPath,
  defaultProddevSqliteDbPath,
  defaultProdSqliteDbPath,
} from "../db/sqlite-db-paths.mjs";
import {
  assertDoesNotUseRuntimeDbPath,
  requireDbTestRuntimeConfig,
} from "./db-test-runtime-guard.js";

const TEMP_ROOT_PREFIX = "giganttic-db-migrate-test-";
const dbTestRuntimeConfig = requireDbTestRuntimeConfig();

let tempProjectRoot = "";

function createMigrationDirPath(projectRoot: string, migrationPairName: string): string {
  return path.join(projectRoot, "db", "migrations", migrationPairName);
}

function createSqliteBufferSql(fromSchemaName: string): string {
  return `
CREATE TABLE IF NOT EXISTS ${RUNTIME_METADATA_TABLE_NAME} (
  key TEXT PRIMARY KEY NOT NULL,
  value TEXT NOT NULL
);
INSERT INTO ${RUNTIME_METADATA_TABLE_NAME} (key, value)
VALUES ('${SCHEMA_NAME_METADATA_KEY}', '${fromSchemaName}');
`;
}

async function createTempProjectRoot() {
  tempProjectRoot = await mkdtemp(path.join("/tmp", TEMP_ROOT_PREFIX));
}

async function createMigrationDeliverable(
  projectRoot: string,
  migrationPairName: string,
  options: {
    drizzleSql: string;
    postStructuralSql?: string;
    preStructuralSql?: string;
  },
) {
  const migrationDirPath = createMigrationDirPath(projectRoot, migrationPairName);

  await mkdir(migrationDirPath, { recursive: true });
  await writeFile(
    path.join(migrationDirPath, PRE_STRUCTURAL_DATA_MIGRATION_FILE_NAME),
    options.preStructuralSql ?? "-- pre\n",
  );
  await writeFile(
    path.join(migrationDirPath, DRIZZLE_MIGRATIONS_FILE_NAME),
    options.drizzleSql,
  );
  await writeFile(
    path.join(migrationDirPath, POST_STRUCTURAL_DATA_MIGRATION_FILE_NAME),
    options.postStructuralSql ?? "-- post\n",
  );
}

async function createDbFile(projectRoot: string, relativePath: string, fromSchemaName: string) {
  const SQL = await initSqlJs();
  const db = new SQL.Database();

  db.exec(createSqliteBufferSql(fromSchemaName));
  const outputPath = path.join(projectRoot, relativePath);

  await mkdir(path.dirname(outputPath), { recursive: true });
  assertDoesNotUseRuntimeDbPath(
    outputPath,
    dbTestRuntimeConfig,
    "db:migrate test database",
  );
  await writeFile(outputPath, Buffer.from(db.export()));
  db.close();

  return outputPath;
}

async function readSchemaNameFromDb(dbPath: string) {
  const SQL = await initSqlJs();
  const buffer = await readFile(dbPath);
  const db = new SQL.Database(buffer);
  const rows = db.exec(
    `SELECT value FROM ${RUNTIME_METADATA_TABLE_NAME} WHERE key = '${SCHEMA_NAME_METADATA_KEY}';`,
  );
  db.close();

  return String(rows[0].values[0][0]);
}

async function tableExists(dbPath: string, tableName: string) {
  const SQL = await initSqlJs();
  const buffer = await readFile(dbPath);
  const db = new SQL.Database(buffer);
  const rows = db.exec(
    `SELECT name FROM sqlite_master WHERE type = 'table' AND name = '${tableName}';`,
  );
  db.close();

  return rows.length > 0 && rows[0].values.length > 0;
}

async function countAppliedMigrations(dbPath: string) {
  const SQL = await initSqlJs();
  const buffer = await readFile(dbPath);
  const db = new SQL.Database(buffer);
  const tableRows = db.exec(
    `SELECT name FROM sqlite_master WHERE type = 'table' AND name = '${APPLIED_MIGRATIONS_TABLE_NAME}';`,
  );

  if (tableRows.length === 0 || tableRows[0].values.length === 0) {
    db.close();
    return 0;
  }

  const rows = db.exec(`SELECT COUNT(*) FROM ${APPLIED_MIGRATIONS_TABLE_NAME};`);
  db.close();

  return Number(rows[0].values[0][0]);
}

async function createFileHash(filePath: string) {
  const buffer = await readFile(filePath);
  return createHash("sha256").update(buffer).digest("hex");
}

describe("db migrate tooling", () => {
  afterEach(async () => {
    if (tempProjectRoot) {
      await rm(tempProjectRoot, { force: true, recursive: true });
      tempProjectRoot = "";
    }
  });

  it("parses shorthand and longhand migrate CLI aliases", () => {
    expect(parseMigrateArgs(["--on", "proddev", "--with", "foo--bar"])).toEqual({
      dbTarget: "proddev",
      migrationPairName: "foo--bar",
    });

    expect(parseMigrateArgs([
      "--on-db",
      "prod",
      "--with-migration",
      "alpha--beta",
    ])).toEqual({
      dbTarget: "prod",
      migrationPairName: "alpha--beta",
    });
  });

  it("applies an explicit migration package to the dev DB target", async () => {
    await createTempProjectRoot();
    await createMigrationDeliverable(tempProjectRoot, "foo--bar", {
      drizzleSql: "CREATE TABLE `Widgets` (`id` integer primary key autoincrement not null);",
    });
    const devDbPath = await createDbFile(tempProjectRoot, defaultDevSqliteDbPath, "foo");

    await migrateDatabase({
      dbTarget: "dev",
      migrationPairName: "foo--bar",
      projectRoot: tempProjectRoot,
    });

    await expect(readSchemaNameFromDb(devDbPath)).resolves.toBe("bar");
    await expect(tableExists(devDbPath, "Widgets")).resolves.toBe(true);
    await expect(countAppliedMigrations(devDbPath)).resolves.toBe(1);
  });

  it("copies the prod DB first when running in proddev mode", async () => {
    await createTempProjectRoot();
    await createMigrationDeliverable(tempProjectRoot, "foo--bar", {
      drizzleSql: "CREATE TABLE `Widgets` (`id` integer primary key autoincrement not null);",
    });
    const prodDbPath = await createDbFile(tempProjectRoot, defaultProdSqliteDbPath, "foo");
    const targetDbPath = path.join(tempProjectRoot, defaultProddevSqliteDbPath);
    assertDoesNotUseRuntimeDbPath(
      targetDbPath,
      dbTestRuntimeConfig,
      "db:migrate proddev sandbox",
    );

    await migrateDatabase({
      dbTarget: "proddev",
      migrationPairName: "foo--bar",
      projectRoot: tempProjectRoot,
    });

    await expect(readSchemaNameFromDb(prodDbPath)).resolves.toBe("foo");
    await expect(readSchemaNameFromDb(targetDbPath)).resolves.toBe("bar");
    await expect(tableExists(targetDbPath, "Widgets")).resolves.toBe(true);
  });

  it("uses isolated temp DB paths instead of the runtime DB path", async () => {
    await createTempProjectRoot();

    expect(
      path.resolve(path.join(tempProjectRoot, defaultDevSqliteDbPath)),
    ).not.toBe(path.resolve(dbTestRuntimeConfig.runtimeTargetPath));
    expect(
      path.resolve(path.join(tempProjectRoot, defaultProddevSqliteDbPath)),
    ).not.toBe(path.resolve(dbTestRuntimeConfig.runtimeTargetPath));
  });

  it("fails clearly for proddev migration when the prod source DB does not exist", async () => {
    await createTempProjectRoot();
    await createMigrationDeliverable(tempProjectRoot, "foo--bar", {
      drizzleSql: "CREATE TABLE `Widgets` (`id` integer primary key autoincrement not null);",
    });

    await expect(migrateDatabase({
      dbTarget: "proddev",
      migrationPairName: "foo--bar",
      projectRoot: tempProjectRoot,
    })).rejects.toThrow(/Missing source DB for proddev migration dry-run/i);
  });

  it("does not mutate the prod source DB file contents during proddev migration", async () => {
    await createTempProjectRoot();
    await createMigrationDeliverable(tempProjectRoot, "foo--bar", {
      drizzleSql: "CREATE TABLE `Widgets` (`id` integer primary key autoincrement not null);",
    });
    const prodDbPath = await createDbFile(tempProjectRoot, defaultProdSqliteDbPath, "foo");
    const originalProdDbPath = path.join(tempProjectRoot, "run", "prod-original.sqlite");
    await copyFile(prodDbPath, originalProdDbPath);
    const beforeHash = await createFileHash(prodDbPath);

    await migrateDatabase({
      dbTarget: "proddev",
      migrationPairName: "foo--bar",
      projectRoot: tempProjectRoot,
    });

    expect(await createFileHash(prodDbPath)).toBe(beforeHash);
    expect(await createFileHash(prodDbPath)).toBe(await createFileHash(originalProdDbPath));
  });

  it("aborts when the target DB schema state does not match the migration source", async () => {
    await createTempProjectRoot();
    await createMigrationDeliverable(tempProjectRoot, "foo--bar", {
      drizzleSql: "CREATE TABLE `Widgets` (`id` integer primary key autoincrement not null);",
    });
    await createDbFile(tempProjectRoot, defaultDevSqliteDbPath, "baz");

    await expect(migrateDatabase({
      dbTarget: "dev",
      migrationPairName: "foo--bar",
      projectRoot: tempProjectRoot,
    })).rejects.toThrow(/migration expects foo/);
  });

  it("does not record a migration when a required migration SQL file is missing", async () => {
    await createTempProjectRoot();
    const migrationPairName = "foo--bar";
    const migrationDirPath = createMigrationDirPath(tempProjectRoot, migrationPairName);
    await mkdir(migrationDirPath, { recursive: true });
    await writeFile(
      path.join(migrationDirPath, PRE_STRUCTURAL_DATA_MIGRATION_FILE_NAME),
      "-- pre\n",
    );
    await writeFile(
      path.join(migrationDirPath, POST_STRUCTURAL_DATA_MIGRATION_FILE_NAME),
      "-- post\n",
    );
    const devDbPath = await createDbFile(tempProjectRoot, defaultDevSqliteDbPath, "foo");

    await expect(migrateDatabase({
      dbTarget: "dev",
      migrationPairName,
      projectRoot: tempProjectRoot,
    })).rejects.toThrow(/Missing Drizzle migration SQL/);

    await expect(readSchemaNameFromDb(devDbPath)).resolves.toBe("foo");
    await expect(countAppliedMigrations(devDbPath)).resolves.toBe(0);
  });

  it("does not change schema metadata or applied migration records when migration SQL fails", async () => {
    await createTempProjectRoot();
    await createMigrationDeliverable(tempProjectRoot, "foo--bar", {
      drizzleSql: "THIS IS NOT VALID SQL;",
    });
    const devDbPath = await createDbFile(tempProjectRoot, defaultDevSqliteDbPath, "foo");

    await expect(migrateDatabase({
      dbTarget: "dev",
      migrationPairName: "foo--bar",
      projectRoot: tempProjectRoot,
    })).rejects.toThrow();

    await expect(readSchemaNameFromDb(devDbPath)).resolves.toBe("foo");
    await expect(countAppliedMigrations(devDbPath)).resolves.toBe(0);
  });
});
