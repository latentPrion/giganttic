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
  return path.join(projectRoot, "charts", `${projectId}.xml`);
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

  it("prepareDatabase on v3 re-seeds a missing project owner reference row", async () => {
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

  it("migrates v2 to v3 without changing existing project-manager assignments and seeds the owner role once after prepare", async () => {
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
    await prepareDatabase({
      dbTarget: "dev",
      projectRoot: tempDir,
    });

    expect(await readSchemaName(dbPath)).toBe("v3");
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
