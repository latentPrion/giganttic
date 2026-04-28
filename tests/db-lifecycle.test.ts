import "reflect-metadata";

import { access, cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { createDatabaseFromSchema } from "../db/create-from-schema.mjs";
import { migrateDatabase } from "../db/migrate.mjs";
import { prepareDatabase } from "../db/prepare.mjs";
import { manageTestData } from "../db/test-data.mjs";
import {
  openDatabaseFromPath,
  readCurrentSchemaName,
  writeCurrentSchemaName,
} from "../db/runtime-db-state.mjs";
import {
  defaultDevSqliteDbPath,
  defaultProddevSqliteDbPath,
  defaultProdSqliteDbPath,
} from "../db/sqlite-db-paths.mjs";
import { seededTestAccounts } from "../backend/modules/auth/auth.seed-data.js";
import {
  requireDbTestRuntimeConfig,
} from "./db-test-runtime-guard.js";
import { createDbTestExecutionPath, createDbTestTempDir } from "./db-test-execution-db.js";
import {
  openDatabaseConnection,
  querySingleValue,
} from "../db/native-sqlite.mjs";

const TEMP_DIR_PREFIX = "giganttic-db-lifecycle-";
const ISSUE_STATUSES_TABLE_NAME = "IssueStatuses";
const NON_TEST_EMAIL = "realuser@example.com";
const NON_TEST_USERNAME = "realuser";
const dbTestRuntimeConfig = requireDbTestRuntimeConfig();

function createTargetDbPath(projectRoot: string, dbTarget: "dev" | "prod") {
  return createDbTestExecutionPath(
    path.join(projectRoot, "run"),
    path.basename(
    dbTarget === "dev" ? defaultDevSqliteDbPath : defaultProdSqliteDbPath,
    ),
    dbTestRuntimeConfig,
    "db lifecycle test database",
  );
}

function createProddevDbPath(projectRoot: string) {
  return createDbTestExecutionPath(
    path.join(projectRoot, "run"),
    path.basename(defaultProddevSqliteDbPath),
    dbTestRuntimeConfig,
    "db lifecycle proddev sandbox",
  );
}

function createProjectChartPath(projectRoot: string, projectId: number) {
  return path.join(projectRoot, "charts", `${projectId}-0.xml`);
}

async function pathExists(targetPath: string) {
  try {
    await access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function querySingleNumber(dbPath: string, sql: string) {
  const db = openDatabaseConnection(dbPath, { readonly: true });
  const result = querySingleValue(db, sql);
  db.close();

  return Number(result);
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

async function countRowsWhere(dbPath: string, tableName: string, whereClause: string) {
  return querySingleNumber(
    dbPath,
    `SELECT COUNT(*) FROM ${tableName} WHERE ${whereClause};`,
  );
}

async function readTrackedProjectId(dbPath: string, seedKey: string) {
  return querySingleNumber(
    dbPath,
    `SELECT entityId FROM ManagedTestDataRecords WHERE entityTable = 'Projects' AND seedKey = '${seedKey}';`,
  );
}

async function renameSeededUser(dbPath: string) {
  const db = openDatabaseConnection(dbPath);
  db.exec(
    "UPDATE Users SET username = 'renamed-testadminuser' WHERE username = 'testadminuser';",
  );
  db.close();
}

async function renameSeededProject(dbPath: string) {
  const db = openDatabaseConnection(dbPath);
  db.exec(
    "UPDATE Projects SET name = 'renamed-seeded-project' WHERE id = 1;",
  );
  db.close();
}

async function deleteOneSeededUser(dbPath: string) {
  const db = openDatabaseConnection(dbPath);
  db.exec("DELETE FROM Users WHERE username = 'testadminuser';");
  db.close();
}

async function deleteProjectRoleCode(dbPath: string, roleCode: string) {
  const db = openDatabaseConnection(dbPath);
  db.exec(`DELETE FROM ProjectRoles WHERE code = '${roleCode}';`);
  db.close();
}

async function seedV2ProjectManagerAssignment(dbPath: string) {
  const db = openDatabaseConnection(dbPath);
  db.exec(
    `INSERT INTO ProjectRoles (code, displayName)
     VALUES ('GGTC_PROJECTROLE_PROJECT_MANAGER', 'Project Manager');`,
  );
  db.exec(
    `INSERT INTO Users (id, username, email, isActive, createdAt, updatedAt)
     VALUES (101, 'legacy-ownerless-manager', 'legacy-ownerless-manager@example.com', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);`,
  );
  db.exec(
    `INSERT INTO Projects (id, name, createdAt, updatedAt)
     VALUES (501, 'Legacy Managed Project', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);`,
  );
  db.exec(
    "INSERT INTO Projects_Users (userId, projectId) VALUES (101, 501);",
  );
  db.exec(
    `INSERT INTO Users_Projects_ProjectRoles (userId, projectId, roleCode)
     VALUES (101, 501, 'GGTC_PROJECTROLE_PROJECT_MANAGER');`,
  );
  db.close();
}

async function seedV10ProjectChartCutoverFixture(dbPath: string) {
  const db = openDatabaseConnection(dbPath);

  db.exec(
    `INSERT INTO Users (id, username, email, isActive, createdAt, updatedAt)
     VALUES
       (201, 'migration-user-201', 'migration-user-201@example.com', 1, 1000, 1000),
       (202, 'migration-user-202', 'migration-user-202@example.com', 1, 1000, 1000);`,
  );
  db.exec(
    `INSERT INTO Projects (id, name, createdAt, updatedAt)
     VALUES
       (601, 'Migration Project Alpha', 1000, 1000),
       (602, 'Migration Project Beta', 1000, 1000);`,
  );
  db.exec(
    `INSERT INTO TaskMirror (projectId, taskId, createdAt, updatedAt)
     VALUES
       (601, 'alpha-task-a', 1700000000001, 1700000000002),
       (601, 'alpha-task-b', 1700000000011, 1700000000012),
       (602, 'beta-task-a', 1700000000101, 1700000000102);`,
  );
  db.exec(
    `INSERT INTO Attachments (
       id, originalFilename, byteLength, contentHash, uploadedAt, uploadedByUserId, createdAt, updatedAt
     ) VALUES
       ('att-alpha-a', 'alpha-a.png', 12, 'hash-alpha-a', 1700000001000, 201, 1700000001000, 1700000001000),
       ('att-alpha-b', 'alpha-b.png', 13, 'hash-alpha-b', 1700000001001, 201, 1700000001001, 1700000001001),
       ('att-beta-a', 'beta-a.png', 14, 'hash-beta-a', 1700000001002, 202, 1700000001002, 1700000001002);`,
  );
  db.exec(
    `INSERT INTO TaskAttachments (projectId, taskId, attachmentId)
     VALUES
       (601, 'alpha-task-a', 'att-alpha-a'),
       (602, 'beta-task-a', 'att-beta-a');`,
  );
  db.exec(
    `INSERT INTO TaskComments (
       id, projectId, taskId, createdByUserId, parentCommentId, thumbsUpCount, thumbsDownCount, createdAt, updatedAt
     ) VALUES
       (901, 601, 'alpha-task-a', 201, NULL, 2, 0, 1700000002001, 1700000002002),
       (902, 601, 'alpha-task-a', 202, 901, 0, 1, 1700000002011, 1700000002012),
       (903, 602, 'beta-task-a', 202, NULL, 1, 0, 1700000002021, 1700000002022);`,
  );
  db.exec(
    `INSERT INTO TaskComments_Attachments (projectId, taskId, commentId, attachmentId)
     VALUES
       (601, 'alpha-task-a', 901, 'att-alpha-b'),
       (602, 'beta-task-a', 903, 'att-beta-a');`,
  );

  db.close();
}

async function seedV10ProjectsWithoutTasksFixture(dbPath: string) {
  const db = openDatabaseConnection(dbPath);
  db.exec(
    `INSERT INTO Projects (id, name, createdAt, updatedAt)
     VALUES
       (701, 'Migration Empty Project Alpha', 1000, 1000),
       (702, 'Migration Empty Project Beta', 1000, 1000);`,
  );
  db.close();
}

function readTableColumnNames(dbPath: string, tableName: string): string[] {
  const db = openDatabaseConnection(dbPath, { readonly: true });
  const columns = db.prepare(`PRAGMA table_info(${tableName});`).all() as Array<{ name: string }>;
  db.close();
  return columns.map((column) => column.name);
}

async function insertNonTestUser(dbPath: string) {
  const db = openDatabaseConnection(dbPath);
  db.exec(
    `INSERT INTO Users (username, email, isActive, createdAt, updatedAt)
     VALUES ('${NON_TEST_USERNAME}', '${NON_TEST_EMAIL}', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);`,
  );
  db.close();
}

async function insertNonTestProject(dbPath: string, name: string) {
  const db = openDatabaseConnection(dbPath);
  db.exec(
    `INSERT INTO Projects (name, createdAt, updatedAt)
     VALUES ('${name}', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);`,
  );
  db.close();
}

async function countUserByUsername(dbPath: string, username: string) {
  return querySingleNumber(
    dbPath,
    `SELECT COUNT(*) FROM Users WHERE username = '${username}';`,
  );
}

async function readLatestProjectId(dbPath: string) {
  return querySingleNumber(
    dbPath,
    "SELECT MAX(id) FROM Projects;",
  );
}

async function deleteTrackedEntityBySeedKey(dbPath: string, seedKey: string) {
  const db = openDatabaseConnection(dbPath);
  const row = db.prepare(
    "SELECT entityTable, entityId FROM ManagedTestDataRecords WHERE seedKey = ?;",
  ).raw(true).get(seedKey) as [string, number] | undefined;

  if (row) {
    const [entityTable, entityId] = row;
    db.exec(`DELETE FROM ${String(entityTable)} WHERE id = ${Number(entityId)};`);
  }
  db.close();
}

async function createEmptyDbFile(dbPath: string) {
  await mkdir(path.dirname(dbPath), { recursive: true });
  const db = openDatabaseConnection(dbPath);
  db.close();
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
    schemaName: dbTestRuntimeConfig.runtimeSchemaSnapshotSubdir,
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
    const tempDir = await createDbTestTempDir(TEMP_DIR_PREFIX);
    tempDirs.push(tempDir);

    await expect(prepareDatabase({
      dbTarget: "dev",
      projectRoot: tempDir,
    })).rejects.toThrow(/Missing DB for prepare target dev/i);
  }, 20_000);

  it("uses isolated temp DB paths instead of the runtime DB path", async () => {
    const tempDir = await createDbTestTempDir(TEMP_DIR_PREFIX);
    tempDirs.push(tempDir);

    expect(path.resolve(createTargetDbPath(tempDir, "dev"))).not.toBe(
      path.resolve(dbTestRuntimeConfig.runtimeTargetPath),
    );
    expect(path.resolve(createProddevDbPath(tempDir))).not.toBe(
      path.resolve(dbTestRuntimeConfig.runtimeTargetPath),
    );
  }, 20_000);

  it("supports the explicit fresh dev flow of createfrom then prepare without ensuring test data", async () => {
    const tempDir = await createDbTestTempDir(TEMP_DIR_PREFIX);
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

    expect(await readSchemaName(dbPath)).toBe(
      dbTestRuntimeConfig.runtimeSchemaSnapshotSubdir,
    );
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

  it("prepareDatabase upserts scoped access credential and ScopedAccessObjectTypes enum rows", async () => {
    const tempDir = await createDbTestTempDir(TEMP_DIR_PREFIX);
    tempDirs.push(tempDir);
    const dbPath = createTargetDbPath(tempDir, "dev");

    await createRuntimeSchemaDb(tempDir, "dev");
    await prepareDatabase({
      dbTarget: "dev",
      projectRoot: tempDir,
    });

    expect(
      await countRowsWhere(
        dbPath,
        "CredentialTypes",
        "code = 'CREDTYPE_SCOPED_ACCESS_TOKEN'",
      ),
    ).toBe(1);
    expect(
      await countRowsWhere(
        dbPath,
        "ScopedAccessObjectTypes",
        "code = 'SCOPED_ACCESS_OBJECT_TYPE_PROJECT'",
      ),
    ).toBe(1);
    expect(
      await countRowsWhere(
        dbPath,
        "ScopedAccessObjectTypes",
        "code = 'SCOPED_ACCESS_OBJECT_TYPE_TEAM'",
      ),
    ).toBe(1);
    expect(
      await countRowsWhere(
        dbPath,
        "ScopedAccessObjectTypes",
        "code = 'SCOPED_ACCESS_OBJECT_TYPE_ORGANIZATION'",
      ),
    ).toBe(1);
  }, 20_000);

  it("supports the explicit historical dev flow of createfrom then migrate then prepare", async () => {
    const tempDir = await createDbTestTempDir(TEMP_DIR_PREFIX);
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
    await migrateDatabase({
      dbTarget: "dev",
      migrationPairName: "v2--v3",
      projectRoot: tempDir,
    });
    await migrateDatabase({
      dbTarget: "dev",
      migrationPairName: "v3--v4",
      projectRoot: tempDir,
    });
    await migrateDatabase({
      dbTarget: "dev",
      migrationPairName: "v4--v5",
      projectRoot: tempDir,
    });
    await migrateDatabase({
      dbTarget: "dev",
      migrationPairName: "v5--v6",
      projectRoot: tempDir,
    });
    await migrateDatabase({
      dbTarget: "dev",
      migrationPairName: "v6--v7",
      projectRoot: tempDir,
    });
    await migrateDatabase({
      dbTarget: "dev",
      migrationPairName: "v7--v8",
      projectRoot: tempDir,
    });
    await migrateDatabase({
      dbTarget: "dev",
      migrationPairName: "v8--v9",
      projectRoot: tempDir,
    });
    await migrateDatabase({
      dbTarget: "dev",
      migrationPairName: "v9--v10",
      projectRoot: tempDir,
    });
    await migrateDatabase({
      dbTarget: "dev",
      migrationPairName: "v10--v11",
      projectRoot: tempDir,
    });

    await expect(prepareDatabase({
      dbTarget: "dev",
      projectRoot: tempDir,
    })).resolves.toMatchObject({
      dbTarget: "dev",
      targetDbPath: dbPath,
    });

    expect(await readSchemaName(dbPath)).toBe(
      dbTestRuntimeConfig.runtimeSchemaSnapshotSubdir,
    );
    expect(await countIssueStatuses(dbPath)).toBeGreaterThan(0);
    expect(await countManagedTestDataRecords(dbPath)).toBe(0);
  }, 20_000);

  it("supports the proddev sandbox flow by copying prod and migrating the copy without mutating prod", async () => {
    const tempDir = await createDbTestTempDir(TEMP_DIR_PREFIX);
    tempDirs.push(tempDir);
    const prodDbPath = createTargetDbPath(tempDir, "prod");
    const proddevDbPath = createProddevDbPath(tempDir);

    await ensureDbArtifacts(tempDir);
    await createDatabaseFromSchema({
      dbTarget: "prod",
      projectRoot: tempDir,
      schemaName: "v2",
    });

    await migrateDatabase({
      dbTarget: "proddev",
      migrationPairName: "v2--v3",
      projectRoot: tempDir,
    });
    await migrateDatabase({
      dbTarget: "proddev",
      migrationPairName: "v3--v4",
      projectRoot: tempDir,
    });
    await migrateDatabase({
      dbTarget: "proddev",
      migrationPairName: "v4--v5",
      projectRoot: tempDir,
    });
    await migrateDatabase({
      dbTarget: "proddev",
      migrationPairName: "v5--v6",
      projectRoot: tempDir,
    });
    await migrateDatabase({
      dbTarget: "proddev",
      migrationPairName: "v6--v7",
      projectRoot: tempDir,
    });
    await migrateDatabase({
      dbTarget: "proddev",
      migrationPairName: "v7--v8",
      projectRoot: tempDir,
    });
    await migrateDatabase({
      dbTarget: "proddev",
      migrationPairName: "v8--v9",
      projectRoot: tempDir,
    });
    await migrateDatabase({
      dbTarget: "proddev",
      migrationPairName: "v9--v10",
      projectRoot: tempDir,
    });
    await migrateDatabase({
      dbTarget: "proddev",
      migrationPairName: "v10--v11",
      projectRoot: tempDir,
    });

    expect(await readSchemaName(prodDbPath)).toBe("v2");
    expect(await readSchemaName(proddevDbPath)).toBe(
      dbTestRuntimeConfig.runtimeSchemaSnapshotSubdir,
    );
    expect(await countIssueStatuses(proddevDbPath)).toBe(0);
  }, 20_000);

  it("prepareDatabase in prod mode fails when test data is present", async () => {
    const tempDir = await createDbTestTempDir(TEMP_DIR_PREFIX);
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
    const tempDir = await createDbTestTempDir(TEMP_DIR_PREFIX);
    tempDirs.push(tempDir);
    const dbPath = createTargetDbPath(tempDir, "dev");

    await prepareDevDbWithTestData(tempDir);
    const trackedProjectId = await readTrackedProjectId(
      dbPath,
      "project:projectProjectManager",
    );
    const seededChartPath = createProjectChartPath(tempDir, trackedProjectId);

    await expect(manageTestData({
      dbTarget: "dev",
      mode: "status",
      projectRoot: tempDir,
    })).resolves.toMatchObject({
      mode: "status",
      present: true,
    });
    expect(await pathExists(seededChartPath)).toBe(true);

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
    expect(await pathExists(seededChartPath)).toBe(false);
  }, 20_000);

  it("prepareDatabase in prod mode succeeds without modifying a cleaned DB", async () => {
    const tempDir = await createDbTestTempDir(TEMP_DIR_PREFIX);
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
    const tempDir = await createDbTestTempDir(TEMP_DIR_PREFIX);
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

  it("manageTestData status remains true even if a seeded chart file is manually removed", async () => {
    const tempDir = await createDbTestTempDir(TEMP_DIR_PREFIX);
    tempDirs.push(tempDir);
    const dbPath = createTargetDbPath(tempDir, "dev");

    await prepareDevDbWithTestData(tempDir);
    const trackedProjectId = await readTrackedProjectId(
      dbPath,
      "project:projectProjectManager",
    );
    const seededChartPath = createProjectChartPath(tempDir, trackedProjectId);

    await rm(seededChartPath, { force: true });

    await expect(manageTestData({
      dbTarget: "dev",
      mode: "status",
      projectRoot: tempDir,
    })).resolves.toMatchObject({
      mode: "status",
      present: true,
    });
  }, 20_000);

  it("recreates seeded charts against the current tracked project ids after purge and re-ensure", async () => {
    const tempDir = await createDbTestTempDir(TEMP_DIR_PREFIX);
    tempDirs.push(tempDir);
    const dbPath = createTargetDbPath(tempDir, "dev");

    await prepareDevDbWithTestData(tempDir);
    const initialTrackedProjectId = await readTrackedProjectId(
      dbPath,
      "project:projectProjectManager",
    );
    const initialChartPath = createProjectChartPath(tempDir, initialTrackedProjectId);

    await manageTestData({
      dbTarget: "dev",
      mode: "purge",
      projectRoot: tempDir,
    });
    await insertNonTestProject(dbPath, "Intervening Manual Project");
    await manageTestData({
      dbTarget: "dev",
      mode: "ensure",
      projectRoot: tempDir,
    });

    const repairedTrackedProjectId = await readTrackedProjectId(
      dbPath,
      "project:projectProjectManager",
    );
    const repairedChartPath = createProjectChartPath(tempDir, repairedTrackedProjectId);

    expect(repairedTrackedProjectId).not.toBe(initialTrackedProjectId);
    expect(await pathExists(initialChartPath)).toBe(false);
    expect(await pathExists(repairedChartPath)).toBe(true);
    expect(await readFile(repairedChartPath, "utf8")).toContain("Direct PM kickoff");
  }, 20_000);

  it("purging seeded test data leaves non-seeded project charts intact", async () => {
    const tempDir = await createDbTestTempDir(TEMP_DIR_PREFIX);
    tempDirs.push(tempDir);
    const dbPath = createTargetDbPath(tempDir, "dev");

    await prepareDevDbWithTestData(tempDir);
    await insertNonTestProject(dbPath, "Manual Project With Chart");
    const manualProjectId = await readLatestProjectId(dbPath);
    const manualChartPath = createProjectChartPath(tempDir, manualProjectId);

    await writeFile(
      manualChartPath,
      "<?xml version=\"1.0\" encoding=\"UTF-8\"?><data><task id=\"7001\"><![CDATA[Manual chart]]></task></data>\n",
      "utf8",
    );

    await manageTestData({
      dbTarget: "dev",
      mode: "purge",
      projectRoot: tempDir,
    });

    expect(await pathExists(manualChartPath)).toBe(true);
    expect(await readFile(manualChartPath, "utf8")).toContain("Manual chart");
  }, 20_000);

  it("purges tracked test data for renamed tracked projects and leaves non-test rows untouched", async () => {
    const tempDir = await createDbTestTempDir(TEMP_DIR_PREFIX);
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
    const tempDir = await createDbTestTempDir(TEMP_DIR_PREFIX);
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
    const tempDir = await createDbTestTempDir(TEMP_DIR_PREFIX);
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
    const tempDir = await createDbTestTempDir(TEMP_DIR_PREFIX);
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
    const tempDir = await createDbTestTempDir(TEMP_DIR_PREFIX);
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

  it("prepareDatabase on the active schema re-seeds a missing project owner reference row", async () => {
    const tempDir = await createDbTestTempDir(TEMP_DIR_PREFIX);
    tempDirs.push(tempDir);
    const dbPath = createTargetDbPath(tempDir, "dev");

    await createRuntimeSchemaDb(tempDir, "dev");
    await prepareDatabase({
      dbTarget: "dev",
      projectRoot: tempDir,
    });
    await deleteProjectRoleCode(dbPath, "GGTC_PROJECTROLE_PROJECT_OWNER");

    expect(
      await countRowsWhere(
        dbPath,
        "ProjectRoles",
        "code = 'GGTC_PROJECTROLE_PROJECT_OWNER'",
      ),
    ).toBe(0);

    await prepareDatabase({
      dbTarget: "dev",
      projectRoot: tempDir,
    });

    expect(
      await countRowsWhere(
        dbPath,
        "ProjectRoles",
        "code = 'GGTC_PROJECTROLE_PROJECT_OWNER'",
      ),
    ).toBe(1);
  }, 20_000);

  it("migrates v2 through v11 without changing existing project-manager assignments and seeds the owner role once after prepare", async () => {
    const tempDir = await createDbTestTempDir(TEMP_DIR_PREFIX);
    tempDirs.push(tempDir);
    const dbPath = createTargetDbPath(tempDir, "dev");

    await ensureDbArtifacts(tempDir);
    await createDatabaseFromSchema({
      dbTarget: "dev",
      projectRoot: tempDir,
      schemaName: "v2",
    });
    await seedV2ProjectManagerAssignment(dbPath);

    expect(
      await countRowsWhere(
        dbPath,
        "Users_Projects_ProjectRoles",
        "roleCode = 'GGTC_PROJECTROLE_PROJECT_MANAGER'",
      ),
    ).toBe(1);

    await migrateDatabase({
      dbTarget: "dev",
      migrationPairName: "v2--v3",
      projectRoot: tempDir,
    });
    await migrateDatabase({
      dbTarget: "dev",
      migrationPairName: "v3--v4",
      projectRoot: tempDir,
    });
    await migrateDatabase({
      dbTarget: "dev",
      migrationPairName: "v4--v5",
      projectRoot: tempDir,
    });
    await migrateDatabase({
      dbTarget: "dev",
      migrationPairName: "v5--v6",
      projectRoot: tempDir,
    });
    await migrateDatabase({
      dbTarget: "dev",
      migrationPairName: "v6--v7",
      projectRoot: tempDir,
    });
    await migrateDatabase({
      dbTarget: "dev",
      migrationPairName: "v7--v8",
      projectRoot: tempDir,
    });
    await migrateDatabase({
      dbTarget: "dev",
      migrationPairName: "v8--v9",
      projectRoot: tempDir,
    });
    await migrateDatabase({
      dbTarget: "dev",
      migrationPairName: "v9--v10",
      projectRoot: tempDir,
    });
    await migrateDatabase({
      dbTarget: "dev",
      migrationPairName: "v10--v11",
      projectRoot: tempDir,
    });
    await prepareDatabase({
      dbTarget: "dev",
      projectRoot: tempDir,
    });

    expect(await readSchemaName(dbPath)).toBe("v11");
    expect(
      await countRowsWhere(
        dbPath,
        "Users_Projects_ProjectRoles",
        "roleCode = 'GGTC_PROJECTROLE_PROJECT_MANAGER'",
      ),
    ).toBe(1);
    expect(
      await countRowsWhere(
        dbPath,
        "ProjectRoles",
        "code = 'GGTC_PROJECTROLE_PROJECT_OWNER'",
      ),
    ).toBe(1);
  }, 20_000);

  it("migrates v10 multi-chart task/discussion rows to chart-scoped v11 keys without row loss", async () => {
    const tempDir = await createDbTestTempDir(TEMP_DIR_PREFIX);
    tempDirs.push(tempDir);
    const dbPath = createTargetDbPath(tempDir, "dev");

    await ensureDbArtifacts(tempDir);
    await createDatabaseFromSchema({
      dbTarget: "dev",
      projectRoot: tempDir,
      schemaName: "v10",
    });
    await seedV10ProjectChartCutoverFixture(dbPath);

    await migrateDatabase({
      dbTarget: "dev",
      migrationPairName: "v10--v11",
      projectRoot: tempDir,
    });

    expect(await readSchemaName(dbPath)).toBe("v11");
    expect(readTableColumnNames(dbPath, "TaskMirror")).toContain("projectGanttChartId");
    expect(readTableColumnNames(dbPath, "TaskMirror")).not.toContain("projectId");
    expect(readTableColumnNames(dbPath, "TaskComments")).toContain("projectGanttChartId");
    expect(readTableColumnNames(dbPath, "TaskComments")).not.toContain("projectId");
    expect(readTableColumnNames(dbPath, "TaskAttachments")).toContain("projectGanttChartId");
    expect(readTableColumnNames(dbPath, "TaskAttachments")).not.toContain("projectId");
    expect(readTableColumnNames(dbPath, "TaskComments_Attachments")).toContain("projectGanttChartId");
    expect(readTableColumnNames(dbPath, "TaskComments_Attachments")).not.toContain("projectId");

    const db = openDatabaseConnection(dbPath, { readonly: true });

    const chartRows = db.prepare(
      `SELECT projectId, chartId, name
       FROM ProjectGanttCharts
       ORDER BY projectId, chartId;`,
    ).all() as Array<{ chartId: number; name: string; projectId: number }>;
    expect(chartRows).toEqual([
      { chartId: 0, name: "default", projectId: 601 },
      { chartId: 0, name: "default", projectId: 602 },
    ]);

    const mirrorRows = db.prepare(
      `SELECT c.projectId AS projectId, tm.taskId AS taskId, tm.createdAt AS createdAt, tm.updatedAt AS updatedAt
       FROM TaskMirror tm
       INNER JOIN ProjectGanttCharts c ON c.id = tm.projectGanttChartId
       ORDER BY c.projectId, tm.taskId;`,
    ).all() as Array<{
      createdAt: number;
      projectId: number;
      taskId: string;
      updatedAt: number;
    }>;
    expect(mirrorRows).toEqual([
      { createdAt: 1700000000001, projectId: 601, taskId: "alpha-task-a", updatedAt: 1700000000002 },
      { createdAt: 1700000000011, projectId: 601, taskId: "alpha-task-b", updatedAt: 1700000000012 },
      { createdAt: 1700000000101, projectId: 602, taskId: "beta-task-a", updatedAt: 1700000000102 },
    ]);

    const attachmentRows = db.prepare(
      `SELECT c.projectId AS projectId, ta.taskId AS taskId, ta.attachmentId AS attachmentId
       FROM TaskAttachments ta
       INNER JOIN ProjectGanttCharts c ON c.id = ta.projectGanttChartId
       ORDER BY c.projectId, ta.taskId, ta.attachmentId;`,
    ).all() as Array<{
      attachmentId: string;
      projectId: number;
      taskId: string;
    }>;
    expect(attachmentRows).toEqual([
      { attachmentId: "att-alpha-a", projectId: 601, taskId: "alpha-task-a" },
      { attachmentId: "att-beta-a", projectId: 602, taskId: "beta-task-a" },
    ]);

    const commentRows = db.prepare(
      `SELECT tc.id AS id, c.projectId AS projectId, tc.taskId AS taskId, tc.createdByUserId AS createdByUserId
       FROM TaskComments tc
       INNER JOIN ProjectGanttCharts c ON c.id = tc.projectGanttChartId
       ORDER BY tc.id;`,
    ).all() as Array<{
      createdByUserId: number;
      id: number;
      projectId: number;
      taskId: string;
    }>;
    expect(commentRows).toEqual([
      { createdByUserId: 201, id: 901, projectId: 601, taskId: "alpha-task-a" },
      { createdByUserId: 202, id: 902, projectId: 601, taskId: "alpha-task-a" },
      { createdByUserId: 202, id: 903, projectId: 602, taskId: "beta-task-a" },
    ]);

    const commentAttachmentRows = db.prepare(
      `SELECT c.projectId AS projectId, tca.taskId AS taskId, tca.commentId AS commentId, tca.attachmentId AS attachmentId
       FROM TaskComments_Attachments tca
       INNER JOIN ProjectGanttCharts c ON c.id = tca.projectGanttChartId
       ORDER BY c.projectId, tca.commentId, tca.attachmentId;`,
    ).all() as Array<{
      attachmentId: string;
      commentId: number;
      projectId: number;
      taskId: string;
    }>;
    expect(commentAttachmentRows).toEqual([
      { attachmentId: "att-alpha-b", commentId: 901, projectId: 601, taskId: "alpha-task-a" },
      { attachmentId: "att-beta-a", commentId: 903, projectId: 602, taskId: "beta-task-a" },
    ]);

    expect(
      Number(
        querySingleValue(
          db,
          `SELECT COUNT(*)
           FROM TaskComments_Attachments tca
           INNER JOIN TaskComments tc
             ON tc.id = tca.commentId
            AND tc.projectGanttChartId = tca.projectGanttChartId
            AND tc.taskId = tca.taskId;`,
        ),
      ),
    ).toBe(commentAttachmentRows.length);

    db.close();
  }, 20_000);

  it("creates default chart rows for every v10 project even when task tables are empty", async () => {
    const tempDir = await createDbTestTempDir(TEMP_DIR_PREFIX);
    tempDirs.push(tempDir);
    const dbPath = createTargetDbPath(tempDir, "dev");

    await ensureDbArtifacts(tempDir);
    await createDatabaseFromSchema({
      dbTarget: "dev",
      projectRoot: tempDir,
      schemaName: "v10",
    });
    await seedV10ProjectsWithoutTasksFixture(dbPath);

    await migrateDatabase({
      dbTarget: "dev",
      migrationPairName: "v10--v11",
      projectRoot: tempDir,
    });

    const db = openDatabaseConnection(dbPath, { readonly: true });
    const chartRows = db.prepare(
      `SELECT projectId, chartId, name
       FROM ProjectGanttCharts
       ORDER BY projectId, chartId;`,
    ).all() as Array<{ chartId: number; name: string; projectId: number }>;
    db.close();

    expect(chartRows).toEqual([
      { chartId: 0, name: "default", projectId: 701 },
      { chartId: 0, name: "default", projectId: 702 },
    ]);
  }, 20_000);

  it("repairs legacy v9 mention rows by adding and backfilling containerKey during v9--v10", async () => {
    const tempDir = await createDbTestTempDir(TEMP_DIR_PREFIX);
    tempDirs.push(tempDir);
    const dbPath = createTargetDbPath(tempDir, "dev");

    await ensureDbArtifacts(tempDir);
    await createDatabaseFromSchema({
      dbTarget: "dev",
      projectRoot: tempDir,
      schemaName: "v8",
    });

    const db = openDatabaseConnection(dbPath);
    db.exec(
      `ALTER TABLE Notifications ADD COLUMN mentionedUserId integer REFERENCES Users(id);
       CREATE INDEX Notifications_commentId_mentionedUserId_idx ON Notifications (commentId, mentionedUserId);
       CREATE TABLE Mentions (
         id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
         speakerUserId integer NOT NULL,
         mentionedUserId integer NOT NULL,
         projectId integer NOT NULL,
         issueId integer,
         taskId text,
         commentId integer,
         mentionContainerType text NOT NULL,
         createdAt integer DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)) NOT NULL,
         updatedAt integer DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)) NOT NULL,
         FOREIGN KEY (speakerUserId) REFERENCES Users(id) ON UPDATE cascade ON DELETE cascade,
         FOREIGN KEY (mentionedUserId) REFERENCES Users(id) ON UPDATE cascade ON DELETE cascade,
         FOREIGN KEY (projectId) REFERENCES Projects(id) ON UPDATE cascade ON DELETE cascade,
         FOREIGN KEY (issueId) REFERENCES Issues(id) ON UPDATE cascade ON DELETE cascade
       );
       CREATE INDEX Mentions_projectId_issueId_taskId_commentId_idx ON Mentions (projectId, issueId, taskId, commentId);
       CREATE INDEX Mentions_mentionedUserId_idx ON Mentions (mentionedUserId);`,
    );
    db.exec(
      `INSERT INTO Users (id, username, email, isActive, createdAt, updatedAt)
       VALUES (101, 'legacy-speaker', 'legacy-speaker@example.com', 1, 0, 0),
              (102, 'legacy-mentioned', 'legacy-mentioned@example.com', 1, 0, 0);`,
    );
    db.exec(
      `INSERT INTO Projects (id, name, createdAt, updatedAt)
       VALUES (501, 'Legacy Project', 0, 0);`,
    );
    db.exec(
      `INSERT INTO IssueStatuses (code, displayName, createdAt)
       VALUES ('ISSUE_STATUS_OPEN', 'Open', 0);`,
    );
    db.exec(
      `INSERT INTO Issues (id, projectId, name, status, priority, progressPercentage, openedAt, createdAt, updatedAt)
       VALUES (601, 501, 'Legacy Issue', 'ISSUE_STATUS_OPEN', 0, 0, 0, 0, 0);`,
    );
    db.exec(
      `INSERT INTO Mentions (speakerUserId, mentionedUserId, projectId, issueId, taskId, commentId, mentionContainerType, createdAt, updatedAt)
       VALUES (101, 102, 501, 601, NULL, 701, 'MENTION_CONTAINER_ISSUE_COMMENT', 0, 0);`,
    );
    writeCurrentSchemaName(db, "v9");
    db.close();

    await migrateDatabase({
      dbTarget: "dev",
      migrationPairName: "v9--v10",
      projectRoot: tempDir,
    });

    const migratedDb = openDatabaseConnection(dbPath, { readonly: true });
    const mentionColumns = migratedDb.prepare("PRAGMA table_info(Mentions);").all() as Array<{ name: string }>;
    const mentionRow = migratedDb.prepare(
      "SELECT containerKey FROM Mentions WHERE mentionedUserId = 102;",
    ).get() as { containerKey: string } | undefined;
    const mentionIndexNames = migratedDb.prepare("PRAGMA index_list(Mentions);").all() as Array<{ name: string }>;
    migratedDb.close();

    expect(mentionColumns.some((column) => column.name === "containerKey")).toBe(true);
    expect(mentionRow).toMatchObject({ containerKey: "501:601:-:701" });
    expect(
      mentionIndexNames.some((indexRow) => indexRow.name === "Mentions_containerKey_idx"),
    ).toBe(true);
    expect(
      mentionIndexNames.some(
        (indexRow) => indexRow.name === "Mentions_mentionedUserId_mentionContainerType_containerKey_unique",
      ),
    ).toBe(true);
    expect(await readSchemaName(dbPath)).toBe("v10");
  }, 20_000);

  it("prepareDatabase fails cleanly when the DB exists but has no schema metadata", async () => {
    const tempDir = await createDbTestTempDir(TEMP_DIR_PREFIX);
    tempDirs.push(tempDir);
    const dbPath = createTargetDbPath(tempDir, "dev");

    await createEmptyDbFile(dbPath);

    await expect(prepareDatabase({
      dbTarget: "dev",
      projectRoot: tempDir,
    })).rejects.toThrow(/runtime schema is/i);
  }, 20_000);
});
