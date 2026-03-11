import "reflect-metadata";

import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import os from "node:os";
import path from "node:path";

import initSqlJs from "sql.js";
import { afterEach, describe, expect, it } from "vitest";

import { configuredRuntimeSchemaSnapshotSubdir } from "../db/config.js";
import { createDatabaseFromSchema } from "../db/create-from-schema.mjs";
import { migrateDatabase } from "../db/migrate.mjs";
import { prepareDatabase } from "../db/prepare.mjs";
import { manageTestData } from "../db/test-data.mjs";
import {
  openDatabaseFromPath,
  readCurrentSchemaName,
} from "../db/runtime-db-state.mjs";
import {
  defaultDevSqliteDbPath,
  defaultProddevSqliteDbPath,
  defaultProdSqliteDbPath,
} from "../db/sqlite-db-paths.mjs";
import { seededTestAccounts } from "../backend/modules/auth/auth.seed-data.js";

const TEMP_DIR_PREFIX = "giganttic-db-lifecycle-";
const ISSUE_STATUSES_TABLE_NAME = "IssueStatuses";
const NON_TEST_EMAIL = "realuser@example.com";
const NON_TEST_USERNAME = "realuser";

function createTargetDbPath(projectRoot: string, dbTarget: "dev" | "prod") {
  return path.join(
    projectRoot,
    dbTarget === "dev" ? defaultDevSqliteDbPath : defaultProdSqliteDbPath,
  );
}

function createProddevDbPath(projectRoot: string) {
  return path.join(projectRoot, defaultProddevSqliteDbPath);
}

async function querySingleNumber(dbPath: string, sql: string) {
  const SQL = await initSqlJs();
  const db = new SQL.Database(new Uint8Array(await readFile(dbPath)));
  const result = db.exec(sql);
  db.close();

  return Number(result[0].values[0][0]);
}

async function countSeededUsers(dbPath: string) {
  const usernames = Object.values(seededTestAccounts).map((account) => account.username);
  const quotedUsernames = usernames.map((username) => `'${username}'`).join(", ");
  return querySingleNumber(
    dbPath,
    `SELECT COUNT(*) FROM Users WHERE username IN (${quotedUsernames});`,
  );
}

async function countAllUsers(dbPath: string) {
  return querySingleNumber(dbPath, "SELECT COUNT(*) FROM Users;");
}

async function countManagedTestDataRecords(dbPath: string) {
  return querySingleNumber(
    dbPath,
    "SELECT COUNT(*) FROM ManagedTestDataRecords;",
  );
}

async function countIssueStatuses(dbPath: string) {
  return querySingleNumber(
    dbPath,
    `SELECT COUNT(*) FROM ${ISSUE_STATUSES_TABLE_NAME};`,
  );
}

async function renameSeededUser(dbPath: string) {
  const SQL = await initSqlJs();
  const db = new SQL.Database(new Uint8Array(await readFile(dbPath)));

  db.exec(
    "UPDATE Users SET username = 'renamed-testadminuser' WHERE username = 'testadminuser';",
  );

  const bytes = db.export();
  db.close();
  await writeFile(dbPath, Buffer.from(bytes));
}

async function renameSeededProject(dbPath: string) {
  const SQL = await initSqlJs();
  const db = new SQL.Database(new Uint8Array(await readFile(dbPath)));

  db.exec(
    "UPDATE Projects SET name = 'renamed-seeded-project' WHERE id = 1;",
  );

  const bytes = db.export();
  db.close();
  await writeFile(dbPath, Buffer.from(bytes));
}

async function deleteOneSeededUser(dbPath: string) {
  const SQL = await initSqlJs();
  const db = new SQL.Database(new Uint8Array(await readFile(dbPath)));

  db.exec("DELETE FROM Users WHERE username = 'testadminuser';");

  const bytes = db.export();
  db.close();
  await writeFile(dbPath, Buffer.from(bytes));
}

async function insertNonTestUser(dbPath: string) {
  const SQL = await initSqlJs();
  const db = new SQL.Database(new Uint8Array(await readFile(dbPath)));

  db.exec(
    `INSERT INTO Users (username, email, isActive, createdAt, updatedAt)
     VALUES ('${NON_TEST_USERNAME}', '${NON_TEST_EMAIL}', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);`,
  );

  const bytes = db.export();
  db.close();
  await writeFile(dbPath, Buffer.from(bytes));
}

async function countUserByUsername(dbPath: string, username: string) {
  return querySingleNumber(
    dbPath,
    `SELECT COUNT(*) FROM Users WHERE username = '${username}';`,
  );
}

async function deleteTrackedEntityBySeedKey(dbPath: string, seedKey: string) {
  const SQL = await initSqlJs();
  const db = new SQL.Database(new Uint8Array(await readFile(dbPath)));
  const rows = db.exec(
    `SELECT entityTable, entityId FROM ManagedTestDataRecords WHERE seedKey = '${seedKey}';`,
  );

  if (rows.length > 0 && rows[0].values.length > 0) {
    const [entityTable, entityId] = rows[0].values[0];
    db.exec(`DELETE FROM ${String(entityTable)} WHERE id = ${Number(entityId)};`);
  }

  const bytes = db.export();
  db.close();
  await writeFile(dbPath, Buffer.from(bytes));
}

async function createEmptyDbFile(dbPath: string) {
  const SQL = await initSqlJs();
  const db = new SQL.Database();
  const bytes = db.export();
  db.close();
  await mkdir(path.dirname(dbPath), { recursive: true });
  await writeFile(dbPath, Buffer.from(bytes));
}

async function createFileHash(filePath: string) {
  const buffer = await readFile(filePath);
  return createHash("sha256").update(buffer).digest("hex");
}

async function readSchemaName(dbPath: string) {
  const db = await openDatabaseFromPath(dbPath);
  const schemaName = readCurrentSchemaName(db);
  db.close();
  return schemaName;
}

async function createRuntimeSchemaDb(projectRoot: string, dbTarget: "dev" | "prod") {
  await ensureDbArtifacts(projectRoot);
  return createDatabaseFromSchema({
    dbTarget,
    projectRoot,
    schemaName: configuredRuntimeSchemaSnapshotSubdir,
  });
}

async function ensureDbArtifacts(projectRoot: string) {
  await cp(path.join(process.cwd(), "db"), path.join(projectRoot, "db"), {
    errorOnExist: false,
    force: false,
    recursive: true,
  });
}

async function prepareDevDbWithTestData(projectRoot: string) {
  await createRuntimeSchemaDb(projectRoot, "dev");
  await prepareDatabase({
    dbTarget: "dev",
    projectRoot,
  });
  await manageTestData({
    dbTarget: "dev",
    mode: "ensure",
    projectRoot,
  });
}

describe("db lifecycle scripts", () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    while (tempDirs.length > 0) {
      const tempDir = tempDirs.pop();
      if (tempDir) {
        await rm(tempDir, { force: true, recursive: true });
      }
    }
  });

  it("prepareDatabase in dev mode fails when the target DB is missing", async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), TEMP_DIR_PREFIX));
    tempDirs.push(tempDir);

    await expect(prepareDatabase({
      dbTarget: "dev",
      projectRoot: tempDir,
    })).rejects.toThrow(/Missing DB for prepare target dev/i);
  }, 20_000);

  it("supports the explicit fresh dev flow of createfrom then prepare without ensuring test data", async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), TEMP_DIR_PREFIX));
    tempDirs.push(tempDir);
    const dbPath = createTargetDbPath(tempDir, "dev");

    await createRuntimeSchemaDb(tempDir, "dev");

    await expect(prepareDatabase({
      dbTarget: "dev",
      projectRoot: tempDir,
    })).resolves.toMatchObject({
      dbTarget: "dev",
      targetDbPath: dbPath,
    });

    expect(await readSchemaName(dbPath)).toBe(configuredRuntimeSchemaSnapshotSubdir);
    expect(await countIssueStatuses(dbPath)).toBeGreaterThan(0);
    expect(await countManagedTestDataRecords(dbPath)).toBe(0);
    await expect(manageTestData({
      dbTarget: "dev",
      mode: "status",
      projectRoot: tempDir,
    })).resolves.toMatchObject({
      mode: "status",
      present: false,
    });
  }, 20_000);

  it("supports the explicit historical dev flow of createfrom then migrate then prepare", async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), TEMP_DIR_PREFIX));
    tempDirs.push(tempDir);
    const dbPath = createTargetDbPath(tempDir, "dev");

    await ensureDbArtifacts(tempDir);
    await createDatabaseFromSchema({
      dbTarget: "dev",
      projectRoot: tempDir,
      schemaName: "v1",
    });

    await migrateDatabase({
      dbTarget: "dev",
      migrationPairName: "v1--v2",
      projectRoot: tempDir,
    });

    await expect(prepareDatabase({
      dbTarget: "dev",
      projectRoot: tempDir,
    })).resolves.toMatchObject({
      dbTarget: "dev",
      targetDbPath: dbPath,
    });

    expect(await readSchemaName(dbPath)).toBe(configuredRuntimeSchemaSnapshotSubdir);
    expect(await countIssueStatuses(dbPath)).toBeGreaterThan(0);
    expect(await countManagedTestDataRecords(dbPath)).toBe(0);
  }, 20_000);

  it("supports the proddev sandbox flow by copying prod and migrating the copy without mutating prod", async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), TEMP_DIR_PREFIX));
    tempDirs.push(tempDir);
    const prodDbPath = createTargetDbPath(tempDir, "prod");
    const proddevDbPath = createProddevDbPath(tempDir);

    await ensureDbArtifacts(tempDir);
    await createDatabaseFromSchema({
      dbTarget: "prod",
      projectRoot: tempDir,
      schemaName: "v1",
    });

    await migrateDatabase({
      dbTarget: "proddev",
      migrationPairName: "v1--v2",
      projectRoot: tempDir,
    });

    expect(await readSchemaName(prodDbPath)).toBe("v1");
    expect(await readSchemaName(proddevDbPath)).toBe(configuredRuntimeSchemaSnapshotSubdir);
    expect(await countIssueStatuses(proddevDbPath)).toBe(0);
  }, 20_000);

  it("prepareDatabase in prod mode fails when test data is present", async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), TEMP_DIR_PREFIX));
    tempDirs.push(tempDir);
    const devDbPath = createTargetDbPath(tempDir, "dev");
    const prodDbPath = createTargetDbPath(tempDir, "prod");

    await prepareDevDbWithTestData(tempDir);
    await writeFile(prodDbPath, await readFile(devDbPath));

    await expect(prepareDatabase({
      dbTarget: "prod",
      projectRoot: tempDir,
    })).rejects.toThrow(/Test data is present/i);

    expect(await countSeededUsers(prodDbPath)).toBeGreaterThan(0);
  }, 20_000);

  it("manageTestData can report and purge seeded test data", async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), TEMP_DIR_PREFIX));
    tempDirs.push(tempDir);
    const dbPath = createTargetDbPath(tempDir, "dev");

    await prepareDevDbWithTestData(tempDir);

    await expect(manageTestData({
      dbTarget: "dev",
      mode: "status",
      projectRoot: tempDir,
    })).resolves.toMatchObject({
      mode: "status",
      present: true,
    });

    await manageTestData({
      dbTarget: "dev",
      mode: "purge",
      projectRoot: tempDir,
    });

    await expect(manageTestData({
      dbTarget: "dev",
      mode: "status",
      projectRoot: tempDir,
    })).resolves.toMatchObject({
      mode: "status",
      present: false,
    });

    expect(await countSeededUsers(dbPath)).toBe(0);
  }, 20_000);

  it("prepareDatabase in prod mode succeeds without modifying a cleaned DB", async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), TEMP_DIR_PREFIX));
    tempDirs.push(tempDir);
    const devDbPath = createTargetDbPath(tempDir, "dev");
    const prodDbPath = createTargetDbPath(tempDir, "prod");

    await prepareDevDbWithTestData(tempDir);

    await manageTestData({
      dbTarget: "dev",
      mode: "purge",
      projectRoot: tempDir,
    });
    await writeFile(prodDbPath, await readFile(devDbPath));

    const beforeHash = await createFileHash(prodDbPath);

    await expect(prepareDatabase({
      dbTarget: "prod",
      projectRoot: tempDir,
    })).resolves.toMatchObject({
      dbTarget: "prod",
      targetDbPath: prodDbPath,
    });

    const afterHash = await createFileHash(prodDbPath);
    expect(afterHash).toBe(beforeHash);
    expect(await countManagedTestDataRecords(prodDbPath)).toBe(0);
  }, 20_000);

  it("purges tracked test data even after a seeded row changes non-id fields", async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), TEMP_DIR_PREFIX));
    tempDirs.push(tempDir);
    const dbPath = createTargetDbPath(tempDir, "dev");

    await prepareDevDbWithTestData(tempDir);
    await renameSeededUser(dbPath);

    expect(await countSeededUsers(dbPath)).toBe(
      Object.keys(seededTestAccounts).length - 1,
    );
    expect(await countManagedTestDataRecords(dbPath)).toBeGreaterThan(0);

    await manageTestData({
      dbTarget: "dev",
      mode: "purge",
      projectRoot: tempDir,
    });

    expect(await countAllUsers(dbPath)).toBe(0);
    expect(await countManagedTestDataRecords(dbPath)).toBe(0);
  }, 20_000);

  it("purges tracked test data for renamed tracked projects and leaves non-test rows untouched", async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), TEMP_DIR_PREFIX));
    tempDirs.push(tempDir);
    const dbPath = createTargetDbPath(tempDir, "dev");

    await prepareDevDbWithTestData(tempDir);
    await insertNonTestUser(dbPath);
    await renameSeededProject(dbPath);

    await manageTestData({
      dbTarget: "dev",
      mode: "purge",
      projectRoot: tempDir,
    });

    expect(await countManagedTestDataRecords(dbPath)).toBe(0);
    expect(await countAllUsers(dbPath)).toBe(1);
    expect(await countUserByUsername(dbPath, NON_TEST_USERNAME)).toBe(1);
  }, 20_000);

  it("purges tracked test data successfully even if some tracked rows were deleted beforehand", async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), TEMP_DIR_PREFIX));
    tempDirs.push(tempDir);
    const dbPath = createTargetDbPath(tempDir, "dev");

    await prepareDevDbWithTestData(tempDir);
    await deleteOneSeededUser(dbPath);

    await expect(manageTestData({
      dbTarget: "dev",
      mode: "status",
      projectRoot: tempDir,
    })).resolves.toMatchObject({
      mode: "status",
      present: true,
    });

    await expect(manageTestData({
      dbTarget: "dev",
      mode: "purge",
      projectRoot: tempDir,
    })).resolves.toMatchObject({
      mode: "purge",
      present: false,
    });

    expect(await countAllUsers(dbPath)).toBe(0);
    expect(await countManagedTestDataRecords(dbPath)).toBe(0);
  }, 20_000);

  it("manageTestData ensure is idempotent and repairs stale tracked IDs after manual deletion", async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), TEMP_DIR_PREFIX));
    tempDirs.push(tempDir);
    const dbPath = createTargetDbPath(tempDir, "dev");

    await prepareDevDbWithTestData(tempDir);

    const initialTrackedRecordCount = await countManagedTestDataRecords(dbPath);
    await deleteTrackedEntityBySeedKey(dbPath, seededTestAccounts.teamTeamManager.seedKey);

    await manageTestData({
      dbTarget: "dev",
      mode: "ensure",
      projectRoot: tempDir,
    });

    const repairedTrackedRecordCount = await countManagedTestDataRecords(dbPath);
    expect(repairedTrackedRecordCount).toBe(initialTrackedRecordCount);
    expect(await countSeededUsers(dbPath)).toBe(Object.keys(seededTestAccounts).length);

    await manageTestData({
      dbTarget: "dev",
      mode: "ensure",
      projectRoot: tempDir,
    });

    expect(await countManagedTestDataRecords(dbPath)).toBe(repairedTrackedRecordCount);
    expect(await countSeededUsers(dbPath)).toBe(Object.keys(seededTestAccounts).length);
  }, 20_000);

  it("manageTestData purge is idempotent when run multiple times", async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), TEMP_DIR_PREFIX));
    tempDirs.push(tempDir);
    const dbPath = createTargetDbPath(tempDir, "dev");

    await prepareDevDbWithTestData(tempDir);

    await manageTestData({
      dbTarget: "dev",
      mode: "purge",
      projectRoot: tempDir,
    });

    await expect(manageTestData({
      dbTarget: "dev",
      mode: "purge",
      projectRoot: tempDir,
    })).resolves.toMatchObject({
      mode: "purge",
      present: false,
    });

    expect(await countManagedTestDataRecords(dbPath)).toBe(0);
    expect(await countAllUsers(dbPath)).toBe(0);
  }, 20_000);

  it("prepareDatabase in dev mode preserves non-test rows while keeping reference data stable without ensuring test data", async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), TEMP_DIR_PREFIX));
    tempDirs.push(tempDir);
    const dbPath = createTargetDbPath(tempDir, "dev");

    await createRuntimeSchemaDb(tempDir, "dev");
    await prepareDatabase({
      dbTarget: "dev",
      projectRoot: tempDir,
    });
    await insertNonTestUser(dbPath);

    const initialIssueStatusCount = await countIssueStatuses(dbPath);

    await prepareDatabase({
      dbTarget: "dev",
      projectRoot: tempDir,
    });

    expect(await countUserByUsername(dbPath, NON_TEST_USERNAME)).toBe(1);
    expect(await countIssueStatuses(dbPath)).toBe(initialIssueStatusCount);
    expect(await countSeededUsers(dbPath)).toBe(0);
    expect(await countManagedTestDataRecords(dbPath)).toBe(0);
  }, 20_000);

  it("prepareDatabase fails cleanly when the DB exists but has no schema metadata", async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), TEMP_DIR_PREFIX));
    tempDirs.push(tempDir);
    const dbPath = createTargetDbPath(tempDir, "dev");

    await createEmptyDbFile(dbPath);

    await expect(prepareDatabase({
      dbTarget: "dev",
      projectRoot: tempDir,
    })).rejects.toThrow(/runtime schema is/i);
  }, 20_000);
});
