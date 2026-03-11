import "reflect-metadata";

import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import os from "node:os";
import path from "node:path";

import initSqlJs from "sql.js";
import { afterEach, describe, expect, it } from "vitest";

import { activeSchemaVersion } from "../db/config.js";
import { prepareDatabase } from "../db/prepare.mjs";
import { manageTestData } from "../db/test-data.mjs";
import {
  openDatabaseFromPath,
  readCurrentSchemaName,
} from "../db/runtime-db-state.mjs";
import { seededTestAccounts } from "../backend/modules/auth/auth.seed-data.js";

const TEMP_DIR_PREFIX = "giganttic-db-lifecycle-";
const TEST_DB_FILE_NAME = "dev-lifecycle.sqlite";
const ISSUE_STATUSES_TABLE_NAME = "IssueStatuses";
const NON_TEST_EMAIL = "realuser@example.com";
const NON_TEST_USERNAME = "realuser";

function createRelativeDbPath(tempDir: string) {
  return path.relative(process.cwd(), path.join(tempDir, TEST_DB_FILE_NAME));
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

  it("prepareDatabase in dev mode creates a missing DB and seeds reference plus test data idempotently", async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), TEMP_DIR_PREFIX));
    tempDirs.push(tempDir);
    const relativeDbPath = createRelativeDbPath(tempDir);
    const dbPath = path.join(process.cwd(), relativeDbPath);
    const env = {
      GGTC_DEV_DB_PATH: relativeDbPath,
    };

    await prepareDatabase({
      dbTarget: "dev",
      env,
    });

    expect(await readSchemaName(dbPath)).toBe(activeSchemaVersion);
    const firstSeededUserCount = await countSeededUsers(dbPath);
    expect(firstSeededUserCount).toBe(Object.keys(seededTestAccounts).length);

    await prepareDatabase({
      dbTarget: "dev",
      env,
    });

    const secondSeededUserCount = await countSeededUsers(dbPath);
    expect(secondSeededUserCount).toBe(firstSeededUserCount);
  }, 20_000);

  it("prepareDatabase in prod mode fails when test data is present", async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), TEMP_DIR_PREFIX));
    tempDirs.push(tempDir);
    const relativeDbPath = createRelativeDbPath(tempDir);
    const dbPath = path.join(process.cwd(), relativeDbPath);

    await prepareDatabase({
      dbTarget: "dev",
      env: {
        GGTC_DEV_DB_PATH: relativeDbPath,
      },
    });

    await expect(prepareDatabase({
      dbTarget: "prod",
      env: {
        GGTC_DB_PATH: relativeDbPath,
      },
    })).rejects.toThrow(/Test data is present/i);

    expect(await countSeededUsers(dbPath)).toBeGreaterThan(0);
  }, 20_000);

  it("manageTestData can report and purge seeded test data", async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), TEMP_DIR_PREFIX));
    tempDirs.push(tempDir);
    const relativeDbPath = createRelativeDbPath(tempDir);
    const dbPath = path.join(process.cwd(), relativeDbPath);
    const env = {
      GGTC_DEV_DB_PATH: relativeDbPath,
    };

    await prepareDatabase({
      dbTarget: "dev",
      env,
    });

    await expect(manageTestData({
      dbTarget: "dev",
      env,
      mode: "status",
    })).resolves.toMatchObject({
      mode: "status",
      present: true,
    });

    await manageTestData({
      dbTarget: "dev",
      env,
      mode: "purge",
    });

    await expect(manageTestData({
      dbTarget: "dev",
      env,
      mode: "status",
    })).resolves.toMatchObject({
      mode: "status",
      present: false,
    });

    expect(await countSeededUsers(dbPath)).toBe(0);
  }, 20_000);

  it("prepareDatabase in prod mode succeeds without modifying a cleaned DB", async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), TEMP_DIR_PREFIX));
    tempDirs.push(tempDir);
    const relativeDbPath = createRelativeDbPath(tempDir);
    const dbPath = path.join(process.cwd(), relativeDbPath);

    await prepareDatabase({
      dbTarget: "dev",
      env: {
        GGTC_DEV_DB_PATH: relativeDbPath,
      },
    });

    await manageTestData({
      dbTarget: "dev",
      env: {
        GGTC_DEV_DB_PATH: relativeDbPath,
      },
      mode: "purge",
    });

    const beforeHash = await createFileHash(dbPath);

    await expect(prepareDatabase({
      dbTarget: "prod",
      env: {
        GGTC_DB_PATH: relativeDbPath,
      },
    })).resolves.toMatchObject({
      dbTarget: "prod",
      targetDbPath: dbPath,
    });

    const afterHash = await createFileHash(dbPath);
    expect(afterHash).toBe(beforeHash);
    expect(await countManagedTestDataRecords(dbPath)).toBe(0);
  }, 20_000);

  it("purges tracked test data even after a seeded row changes non-id fields", async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), TEMP_DIR_PREFIX));
    tempDirs.push(tempDir);
    const relativeDbPath = createRelativeDbPath(tempDir);
    const dbPath = path.join(process.cwd(), relativeDbPath);
    const env = {
      GGTC_DEV_DB_PATH: relativeDbPath,
    };

    await prepareDatabase({
      dbTarget: "dev",
      env,
    });
    await renameSeededUser(dbPath);

    expect(await countSeededUsers(dbPath)).toBe(
      Object.keys(seededTestAccounts).length - 1,
    );
    expect(await countManagedTestDataRecords(dbPath)).toBeGreaterThan(0);

    await manageTestData({
      dbTarget: "dev",
      env,
      mode: "purge",
    });

    expect(await countAllUsers(dbPath)).toBe(0);
    expect(await countManagedTestDataRecords(dbPath)).toBe(0);
  }, 20_000);

  it("purges tracked test data for renamed tracked projects and leaves non-test rows untouched", async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), TEMP_DIR_PREFIX));
    tempDirs.push(tempDir);
    const relativeDbPath = createRelativeDbPath(tempDir);
    const dbPath = path.join(process.cwd(), relativeDbPath);
    const env = {
      GGTC_DEV_DB_PATH: relativeDbPath,
    };

    await prepareDatabase({
      dbTarget: "dev",
      env,
    });
    await insertNonTestUser(dbPath);
    await renameSeededProject(dbPath);

    await manageTestData({
      dbTarget: "dev",
      env,
      mode: "purge",
    });

    expect(await countManagedTestDataRecords(dbPath)).toBe(0);
    expect(await countAllUsers(dbPath)).toBe(1);
    expect(await countUserByUsername(dbPath, NON_TEST_USERNAME)).toBe(1);
  }, 20_000);

  it("purges tracked test data successfully even if some tracked rows were deleted beforehand", async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), TEMP_DIR_PREFIX));
    tempDirs.push(tempDir);
    const relativeDbPath = createRelativeDbPath(tempDir);
    const dbPath = path.join(process.cwd(), relativeDbPath);
    const env = {
      GGTC_DEV_DB_PATH: relativeDbPath,
    };

    await prepareDatabase({
      dbTarget: "dev",
      env,
    });
    await deleteOneSeededUser(dbPath);

    await expect(manageTestData({
      dbTarget: "dev",
      env,
      mode: "status",
    })).resolves.toMatchObject({
      mode: "status",
      present: true,
    });

    await expect(manageTestData({
      dbTarget: "dev",
      env,
      mode: "purge",
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
    const relativeDbPath = createRelativeDbPath(tempDir);
    const dbPath = path.join(process.cwd(), relativeDbPath);
    const env = {
      GGTC_DEV_DB_PATH: relativeDbPath,
    };

    await prepareDatabase({
      dbTarget: "dev",
      env,
    });

    const initialTrackedRecordCount = await countManagedTestDataRecords(dbPath);
    await deleteTrackedEntityBySeedKey(dbPath, seededTestAccounts.teamTeamManager.seedKey);

    await manageTestData({
      dbTarget: "dev",
      env,
      mode: "ensure",
    });

    const repairedTrackedRecordCount = await countManagedTestDataRecords(dbPath);
    expect(repairedTrackedRecordCount).toBe(initialTrackedRecordCount);
    expect(await countSeededUsers(dbPath)).toBe(Object.keys(seededTestAccounts).length);

    await manageTestData({
      dbTarget: "dev",
      env,
      mode: "ensure",
    });

    expect(await countManagedTestDataRecords(dbPath)).toBe(repairedTrackedRecordCount);
    expect(await countSeededUsers(dbPath)).toBe(Object.keys(seededTestAccounts).length);
  }, 20_000);

  it("manageTestData purge is idempotent when run multiple times", async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), TEMP_DIR_PREFIX));
    tempDirs.push(tempDir);
    const relativeDbPath = createRelativeDbPath(tempDir);
    const dbPath = path.join(process.cwd(), relativeDbPath);
    const env = {
      GGTC_DEV_DB_PATH: relativeDbPath,
    };

    await prepareDatabase({
      dbTarget: "dev",
      env,
    });

    await manageTestData({
      dbTarget: "dev",
      env,
      mode: "purge",
    });

    await expect(manageTestData({
      dbTarget: "dev",
      env,
      mode: "purge",
    })).resolves.toMatchObject({
      mode: "purge",
      present: false,
    });

    expect(await countManagedTestDataRecords(dbPath)).toBe(0);
    expect(await countAllUsers(dbPath)).toBe(0);
  }, 20_000);

  it("prepareDatabase in dev mode preserves non-test rows while keeping reference data stable", async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), TEMP_DIR_PREFIX));
    tempDirs.push(tempDir);
    const relativeDbPath = createRelativeDbPath(tempDir);
    const dbPath = path.join(process.cwd(), relativeDbPath);
    const env = {
      GGTC_DEV_DB_PATH: relativeDbPath,
    };

    await prepareDatabase({
      dbTarget: "dev",
      env,
    });
    await insertNonTestUser(dbPath);

    const initialIssueStatusCount = await countIssueStatuses(dbPath);

    await prepareDatabase({
      dbTarget: "dev",
      env,
    });

    expect(await countUserByUsername(dbPath, NON_TEST_USERNAME)).toBe(1);
    expect(await countIssueStatuses(dbPath)).toBe(initialIssueStatusCount);
    expect(await countSeededUsers(dbPath)).toBe(Object.keys(seededTestAccounts).length);
  }, 20_000);

  it("prepareDatabase fails cleanly when the DB exists but has no schema metadata", async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), TEMP_DIR_PREFIX));
    tempDirs.push(tempDir);
    const relativeDbPath = createRelativeDbPath(tempDir);
    const dbPath = path.join(process.cwd(), relativeDbPath);

    await createEmptyDbFile(dbPath);

    await expect(prepareDatabase({
      dbTarget: "dev",
      env: {
        GGTC_DEV_DB_PATH: relativeDbPath,
      },
    })).rejects.toThrow(/active schema is/i);
  }, 20_000);
});
