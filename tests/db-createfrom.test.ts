import { access, cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import initSqlJs from "sql.js";
import { afterEach, describe, expect, it } from "vitest";

import {
  createDatabaseFromSchema,
  parseCreateFromArgs,
} from "../db/create-from-schema.mjs";
import { migrateDatabase } from "../db/migrate.mjs";
import { prepareDatabase } from "../db/prepare.mjs";
import {
  APPLIED_MIGRATIONS_TABLE_NAME,
  openDatabaseFromPath,
  readCurrentSchemaName,
} from "../db/runtime-db-state.mjs";
import { activeSchemaVersion } from "../db/config.js";

const TEMP_ROOT_PREFIX = "giganttic-db-createfrom-test-";
const CUSTOM_SCHEMA_SQL = `
CREATE TABLE "_Giganttic_RuntimeMetadata" (
  "key" text PRIMARY KEY NOT NULL,
  "value" text NOT NULL
);
`;

let tempProjectRoot = "";

async function createTempProjectRoot() {
  tempProjectRoot = await mkdtemp(path.join(os.tmpdir(), TEMP_ROOT_PREFIX));
}

function createTempDbPath(fileName: string) {
  return path.join(tempProjectRoot, fileName);
}

async function pathExists(targetPath: string) {
  try {
    await access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function writeGarbageDb(filePath: string) {
  const SQL = await initSqlJs();
  const db = new SQL.Database();
  db.exec("CREATE TABLE Noise (id integer primary key);");
  await writeFile(filePath, Buffer.from(db.export()));
  db.close();
}

async function readSchemaNameFromDb(dbPath: string) {
  const db = await openDatabaseFromPath(dbPath);
  const schemaName = readCurrentSchemaName(db);
  db.close();
  return schemaName;
}

async function countRows(dbPath: string, tableName: string) {
  const SQL = await initSqlJs();
  const db = new SQL.Database(new Uint8Array(await readFile(dbPath)));
  const rows = db.exec(`SELECT COUNT(*) FROM ${tableName};`);
  db.close();
  return Number(rows[0].values[0][0]);
}

async function tableExists(dbPath: string, tableName: string) {
  const SQL = await initSqlJs();
  const db = new SQL.Database(new Uint8Array(await readFile(dbPath)));
  const rows = db.exec(
    `SELECT name FROM sqlite_master WHERE type = 'table' AND name = '${tableName}';`,
  );
  db.close();
  return rows.length > 0 && rows[0].values.length > 0;
}

async function createSchemaSnapshot(projectRoot: string, schemaName: string, sql = CUSTOM_SCHEMA_SQL) {
  const schemaDirPath = path.join(projectRoot, "db", schemaName);
  await mkdir(path.join(schemaDirPath, "generated-sql-ddl"), { recursive: true });
  await writeFile(path.join(schemaDirPath, "schema.ts"), "export {};\n");
  await writeFile(path.join(schemaDirPath, "generated-sql-ddl", "schema.sql"), sql);
}

async function createArbitrarySchemaProjectRoot(schemaName: string) {
  await createTempProjectRoot();
  await createSchemaSnapshot(tempProjectRoot, schemaName);
}

describe("db createfrom tooling", () => {
  afterEach(async () => {
    if (tempProjectRoot) {
      await rm(tempProjectRoot, { force: true, recursive: true });
      tempProjectRoot = "";
    }
  });

  it("parses longhand and shorthand CLI aliases", () => {
    expect(parseCreateFromArgs(["--on", "dev", "--schema", "v2"])).toEqual({
      dbTarget: "dev",
      overwriteExisting: false,
      schemaName: "v2",
    });

    expect(parseCreateFromArgs([
      "--on-db",
      "prod",
      "--schema",
      "foobar-v6.7",
      "--overwrite-existing",
    ])).toEqual({
      dbTarget: "prod",
      overwriteExisting: true,
      schemaName: "foobar-v6.7",
    });
  });

  it("creates a fresh dev DB from an explicit schema snapshot", async () => {
    await createTempProjectRoot();
    const dbPath = createTempDbPath("fresh-dev.sqlite");
    const result = await createDatabaseFromSchema({
      dbTarget: "dev",
      env: {
        GGTC_DEV_DB_PATH: dbPath,
      },
      projectRoot: process.cwd(),
      schemaName: "v1",
    });

    expect(result.targetDbPath).toBe(dbPath);
    await expect(pathExists(result.targetDbPath)).resolves.toBe(true);
    await expect(readSchemaNameFromDb(result.targetDbPath)).resolves.toBe("v1");
  });

  it("creates a fresh prod DB from an explicit schema snapshot", async () => {
    await createTempProjectRoot();
    const dbPath = createTempDbPath("fresh-prod.sqlite");
    const result = await createDatabaseFromSchema({
      dbTarget: "prod",
      env: {
        GGTC_DB_PATH: dbPath,
      },
      projectRoot: process.cwd(),
      schemaName: "v2",
    });

    expect(result.targetDbPath).toBe(dbPath);
    await expect(pathExists(result.targetDbPath)).resolves.toBe(true);
    await expect(readSchemaNameFromDb(result.targetDbPath)).resolves.toBe("v2");
  });

  it("respects GGTC_DEV_DB_PATH when creating the dev DB", async () => {
    await createTempProjectRoot();
    const customDbPath = path.join(tempProjectRoot, "nested", "dev", "custom-dev.sqlite");
    const expectedPath = customDbPath;

    const result = await createDatabaseFromSchema({
      dbTarget: "dev",
      env: {
        GGTC_DEV_DB_PATH: customDbPath,
      },
      projectRoot: process.cwd(),
      schemaName: "v1",
    });

    expect(result.targetDbPath).toBe(expectedPath);
    await expect(pathExists(expectedPath)).resolves.toBe(true);
    await expect(readSchemaNameFromDb(expectedPath)).resolves.toBe("v1");
  });

  it("respects GGTC_DB_PATH when creating the prod DB", async () => {
    await createTempProjectRoot();
    const customDbPath = path.join(tempProjectRoot, "nested", "prod", "custom-prod.sqlite");
    const expectedPath = customDbPath;

    const result = await createDatabaseFromSchema({
      dbTarget: "prod",
      env: {
        GGTC_DB_PATH: customDbPath,
      },
      projectRoot: process.cwd(),
      schemaName: "v2",
    });

    expect(result.targetDbPath).toBe(expectedPath);
    await expect(pathExists(expectedPath)).resolves.toBe(true);
    await expect(readSchemaNameFromDb(expectedPath)).resolves.toBe("v2");
  });

  it("refuses to overwrite an existing DB unless explicitly told to", async () => {
    await createTempProjectRoot();
    const existingDbPath = createTempDbPath("existing-dev.sqlite");
    await createDatabaseFromSchema({
      dbTarget: "dev",
      env: {
        GGTC_DEV_DB_PATH: existingDbPath,
      },
      projectRoot: process.cwd(),
      schemaName: "v1",
    });

    await expect(createDatabaseFromSchema({
      dbTarget: "dev",
      env: {
        GGTC_DEV_DB_PATH: existingDbPath,
      },
      projectRoot: process.cwd(),
      schemaName: "v2",
    })).rejects.toThrow(/--overwrite-existing/);

    await expect(readSchemaNameFromDb(existingDbPath)).resolves.toBe("v1");
  });

  it("replaces an existing DB when overwrite is explicitly enabled", async () => {
    await createTempProjectRoot();
    const existingDbPath = createTempDbPath("existing-prod.sqlite");

    await createDatabaseFromSchema({
      dbTarget: "prod",
      env: {
        GGTC_DB_PATH: existingDbPath,
      },
      projectRoot: process.cwd(),
      schemaName: "v1",
    });
    await writeGarbageDb(existingDbPath);

    await createDatabaseFromSchema({
      dbTarget: "prod",
      env: {
        GGTC_DB_PATH: existingDbPath,
      },
      overwriteExisting: true,
      projectRoot: process.cwd(),
      schemaName: "v2",
    });

    await expect(readSchemaNameFromDb(existingDbPath)).resolves.toBe("v2");
  });

  it("overwrite replaces the entire DB contents and leaves no applied migrations table", async () => {
    await createTempProjectRoot();
    const existingDbPath = createTempDbPath("noise-prod.sqlite");

    await createDatabaseFromSchema({
      dbTarget: "prod",
      env: {
        GGTC_DB_PATH: existingDbPath,
      },
      projectRoot: process.cwd(),
      schemaName: "v1",
    });

    const SQL = await initSqlJs();
    const db = new SQL.Database(new Uint8Array(await readFile(existingDbPath)));
    db.exec("CREATE TABLE Noise (id integer primary key, name text);");
    db.exec("INSERT INTO Noise (id, name) VALUES (1, 'junk');");
    const bytes = db.export();
    db.close();
    await writeFile(existingDbPath, Buffer.from(bytes));

    await createDatabaseFromSchema({
      dbTarget: "prod",
      env: {
        GGTC_DB_PATH: existingDbPath,
      },
      overwriteExisting: true,
      projectRoot: process.cwd(),
      schemaName: "v2",
    });

    await expect(readSchemaNameFromDb(existingDbPath)).resolves.toBe("v2");
    await expect(tableExists(existingDbPath, "Noise")).resolves.toBe(false);
    await expect(tableExists(existingDbPath, APPLIED_MIGRATIONS_TABLE_NAME)).resolves.toBe(true);
    await expect(countRows(existingDbPath, APPLIED_MIGRATIONS_TABLE_NAME)).resolves.toBe(0);
  });

  it("rejects proddev creation with explicit guidance", async () => {
    await createTempProjectRoot();

    await expect(createDatabaseFromSchema({
      dbTarget: "proddev",
      projectRoot: process.cwd(),
      schemaName: "v1",
    })).rejects.toThrow(/db:createfrom does not support --on proddev/i);
  });

  it("rejects unsupported createfrom targets", async () => {
    await createTempProjectRoot();

    await expect(createDatabaseFromSchema({
      dbTarget: "sandbox" as never,
      projectRoot: process.cwd(),
      schemaName: "v1",
    })).rejects.toThrow(/--on must be one of/i);
  });

  it("fails clearly when schema.ts is missing for the requested schema", async () => {
    await createTempProjectRoot();
    const schemaDirPath = path.join(tempProjectRoot, "db", "test-schema");
    await mkdir(path.join(schemaDirPath, "generated-sql-ddl"), { recursive: true });
    await writeFile(path.join(schemaDirPath, "generated-sql-ddl", "schema.sql"), CUSTOM_SCHEMA_SQL);

    await expect(createDatabaseFromSchema({
      dbTarget: "dev",
      projectRoot: tempProjectRoot,
      schemaName: "test-schema",
    })).rejects.toThrow(/Missing schema\.ts/i);
  });

  it("fails clearly when generated schema.sql is missing for the requested schema", async () => {
    await createTempProjectRoot();
    const schemaDirPath = path.join(tempProjectRoot, "db", "test-schema");
    await mkdir(schemaDirPath, { recursive: true });
    await writeFile(path.join(schemaDirPath, "schema.ts"), "export {};\n");

    await expect(createDatabaseFromSchema({
      dbTarget: "dev",
      projectRoot: tempProjectRoot,
      schemaName: "test-schema",
    })).rejects.toThrow(/Missing generated schema\.sql/i);
  });

  it("supports arbitrary schema directory names", async () => {
    await createArbitrarySchemaProjectRoot("foobar-v6.7");

    const result = await createDatabaseFromSchema({
      dbTarget: "dev",
      projectRoot: tempProjectRoot,
      schemaName: "foobar-v6.7",
    });

    await expect(pathExists(result.targetDbPath)).resolves.toBe(true);
    await expect(readSchemaNameFromDb(result.targetDbPath)).resolves.toBe("foobar-v6.7");
  });

  it("creates parent directories for nested overridden DB paths", async () => {
    await createArbitrarySchemaProjectRoot("test-schema");
    const nestedDbPath = path.join(tempProjectRoot, "a", "deep", "tree", "test.sqlite");

    const result = await createDatabaseFromSchema({
      dbTarget: "dev",
      env: {
        GGTC_DEV_DB_PATH: path.relative(tempProjectRoot, nestedDbPath),
      },
      projectRoot: tempProjectRoot,
      schemaName: "test-schema",
    });

    expect(result.targetDbPath).toBe(nestedDbPath);
    await expect(pathExists(nestedDbPath)).resolves.toBe(true);
  });

  it("does not seed reference data or test data by itself", async () => {
    await createTempProjectRoot();
    const dbPath = createTempDbPath("unseeded-dev.sqlite");

    await createDatabaseFromSchema({
      dbTarget: "dev",
      env: {
        GGTC_DEV_DB_PATH: dbPath,
      },
      projectRoot: process.cwd(),
      schemaName: activeSchemaVersion,
    });

    await expect(countRows(dbPath, "Users")).resolves.toBe(0);
    await expect(countRows(dbPath, "IssueStatuses")).resolves.toBe(0);
    await expect(countRows(dbPath, "ManagedTestDataRecords")).resolves.toBe(0);
  });

  it("supports createfrom v1 followed by migrate v1--v2", async () => {
    await createTempProjectRoot();
    const devDbPath = createTempDbPath("migrate-dev.sqlite");
    await cp(path.join(process.cwd(), "db"), path.join(tempProjectRoot, "db"), { recursive: true });

    await createDatabaseFromSchema({
      dbTarget: "dev",
      env: {
        GGTC_DEV_DB_PATH: devDbPath,
      },
      projectRoot: tempProjectRoot,
      schemaName: "v1",
    });

    await migrateDatabase({
      dbTarget: "dev",
      env: {
        GGTC_DEV_DB_PATH: devDbPath,
      },
      migrationPairName: "v1--v2",
      projectRoot: tempProjectRoot,
    });

    await expect(readSchemaNameFromDb(devDbPath)).resolves.toBe("v2");
    await expect(tableExists(devDbPath, "Issues")).resolves.toBe(true);
  }, 20_000);

  it("fails migrating v1--v2 after createfrom already created a v2 DB", async () => {
    await createTempProjectRoot();
    await cp(path.join(process.cwd(), "db"), path.join(tempProjectRoot, "db"), { recursive: true });
    const devDbPath = createTempDbPath("already-v2.sqlite");

    await createDatabaseFromSchema({
      dbTarget: "dev",
      env: {
        GGTC_DEV_DB_PATH: devDbPath,
      },
      projectRoot: tempProjectRoot,
      schemaName: "v2",
    });

    await expect(migrateDatabase({
      dbTarget: "dev",
      env: {
        GGTC_DEV_DB_PATH: devDbPath,
      },
      migrationPairName: "v1--v2",
      projectRoot: tempProjectRoot,
    })).rejects.toThrow(/migration expects v1/i);
  }, 20_000);

  it("prepare succeeds after createfrom when the created schema is the active schema", async () => {
    await createTempProjectRoot();
    const dbPath = path.join(tempProjectRoot, "prepared-dev.sqlite");

    await createDatabaseFromSchema({
      dbTarget: "dev",
      env: {
        GGTC_DEV_DB_PATH: dbPath,
      },
      projectRoot: process.cwd(),
      schemaName: activeSchemaVersion,
    });

    await expect(prepareDatabase({
      dbTarget: "dev",
      env: {
        GGTC_DEV_DB_PATH: dbPath,
      },
    })).resolves.toMatchObject({
      dbTarget: "dev",
      targetDbPath: dbPath,
    });

    expect(await countRows(dbPath, "IssueStatuses")).toBeGreaterThan(0);
    expect(await countRows(dbPath, "ManagedTestDataRecords")).toBeGreaterThan(0);
  }, 20_000);

  it("prepare fails after createfrom when the created schema is not the active schema", async () => {
    await createTempProjectRoot();
    const dbPath = path.join(tempProjectRoot, "prepared-dev.sqlite");

    await createDatabaseFromSchema({
      dbTarget: "dev",
      env: {
        GGTC_DEV_DB_PATH: dbPath,
      },
      projectRoot: process.cwd(),
      schemaName: "v1",
    });

    await expect(prepareDatabase({
      dbTarget: "dev",
      env: {
        GGTC_DEV_DB_PATH: dbPath,
      },
    })).rejects.toThrow(/active schema is/i);
  }, 20_000);
});
