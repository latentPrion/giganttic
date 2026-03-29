import { rm } from "node:fs/promises";
import { afterEach, describe, expect, it } from "vitest";

import {
  applySqlDdl,
  getGeneratedSqlDdlDir,
  getGeneratedSqlDdlFilePath,
  readGeneratedSqlStatements,
} from "../../apply-sql-ddl.mjs";
import {
  executeSqlStatements,
  openDatabaseConnection,
  openInMemoryDatabase,
  querySingleValue,
} from "../../native-sqlite.mjs";
import {
  createDbTestExecutionPath,
  createDbTestTempDir,
} from "../../../tests/db-test-execution-db.js";
import { requireDbTestRuntimeConfig } from "../../../tests/db-test-runtime-guard.js";

const SCHEMA_VERSION = "v7";
const dbTestRuntimeConfig = requireDbTestRuntimeConfig();

async function createV7Database() {
  const db = openInMemoryDatabase();
  const statements = await readGeneratedSqlStatements(SCHEMA_VERSION);
  executeSqlStatements(db, statements);
  return db;
}

describe("generated sqlite ddl for v7", () => {
  const tempPaths: string[] = [];

  afterEach(async () => {
    while (tempPaths.length > 0) {
      const tempPath = tempPaths.pop();
      if (tempPath) {
        await rm(tempPath, { force: true, recursive: true });
      }
    }
  });

  it("contains executable SQL statements for v7", async () => {
    const statements = await readGeneratedSqlStatements(SCHEMA_VERSION);

    expect(statements.length).toBeGreaterThan(0);
    expect(
      statements.some((statement) => statement.includes("CREATE TABLE `Projects_Attachments`")),
    ).toBe(true);
    expect(
      statements.some((statement) => statement.includes("CREATE TABLE `TaskMirror`")),
    ).toBe(true);
    expect(
      statements.some((statement) => statement.includes("reusable-v7-projects-journal")),
    ).toBe(true);
    expect(
      statements.some((statement) => statement.includes("reusable-v7-issues-journal")),
    ).toBe(true);
    expect(getGeneratedSqlDdlDir(SCHEMA_VERSION)).toContain("db/v7/generated-sql-ddl");
    expect(getGeneratedSqlDdlFilePath(SCHEMA_VERSION)).toContain(
      "db/v7/generated-sql-ddl/schema.sql",
    );
  });

  it("applies cleanly and creates v7 issue, project, and task discussion tables", async () => {
    const tempDir = await createDbTestTempDir("giganttic-v7-ddl-");
    const outputPath = createDbTestExecutionPath(
      tempDir,
      "v7.sqlite",
      dbTestRuntimeConfig,
      "v7 sqlite-ddl test database",
    );
    tempPaths.push(tempDir);

    const appliedPath = await applySqlDdl(outputPath, SCHEMA_VERSION);
    const db = openDatabaseConnection(appliedPath, { readonly: true });

    const discussionTableCount = querySingleValue(
      db,
      "SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name IN (?, ?, ?, ?, ?, ?, ?, ?)",
      [
        "Attachments",
        "Projects_Attachments",
        "Issues_Attachments",
        "IssueComments",
        "IssueComments_Attachments",
        "TaskMirror",
        "TaskAttachments",
        "TaskComments",
      ],
    );
    const taskCommentsAttachmentTableCount = querySingleValue(
      db,
      "SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = ?",
      ["TaskComments_Attachments"],
    );

    expect(discussionTableCount).toBe(8);
    expect(taskCommentsAttachmentTableCount).toBe(1);
    db.close();
  });

  it("enforces scoped token object composite uniqueness", async () => {
    const db = await createV7Database();

    db.exec(
      "INSERT INTO Users (id, username, email) VALUES (1, 'alice', 'alice@example.com');",
    );
    db.exec(
      "INSERT INTO CredentialTypes (code, displayName, allowsMultiplePerUser) VALUES ('GGTC_CREDTYPE_USERNAME_PASSWORD', 'Username and Password', 0), ('CREDTYPE_SCOPED_ACCESS_TOKEN', 'Scoped Access Token', 1);",
    );
    db.exec(
      "INSERT INTO Users_CredentialTypes (id, userId, credentialTypeCode, credentialLabel) VALUES (10, 1, 'CREDTYPE_SCOPED_ACCESS_TOKEN', 'share-link');",
    );
    db.exec(
      "INSERT INTO ScopedAccessObjectTypes (code, displayName) VALUES ('SCOPED_ACCESS_OBJECT_TYPE_PROJECT', 'Project');",
    );
    db.exec(
      "INSERT INTO Users_ScopedAccessTokenCredentials (id, ownerUserId, userCredentialTypeId, tokenHash) VALUES (100, 1, 10, 'hash-1');",
    );
    db.exec(
      "INSERT INTO ScopedAccessTokenCredentials_Objects (scopedAccessTokenCredentialId, scopedAccessObjectTypeCode, scopedAccessObjectId) VALUES (100, 'SCOPED_ACCESS_OBJECT_TYPE_PROJECT', 77);",
    );

    expect(() =>
      db.exec(
        "INSERT INTO ScopedAccessTokenCredentials_Objects (scopedAccessTokenCredentialId, scopedAccessObjectTypeCode, scopedAccessObjectId) VALUES (100, 'SCOPED_ACCESS_OBJECT_TYPE_PROJECT', 77);",
      ),
    ).toThrow(/unique/i);
    db.close();
  });

  it("cascades task discussion rows when the task mirror row is deleted", async () => {
    const db = await createV7Database();

    db.exec("INSERT INTO Users (id, username, email) VALUES (1, 'alice', 'alice@example.com');");
    db.exec("INSERT INTO Projects (id, name) VALUES (1, 'Apollo');");
    db.exec(
      "INSERT INTO Attachments (id, originalFilename, byteLength, contentHash, uploadedByUserId) VALUES ('att-1', 'a.txt', 12, 'hash-a', 1), ('att-2', 'b.txt', 34, 'hash-b', 1);",
    );
    db.exec("INSERT INTO TaskMirror (projectId, taskId) VALUES (1, 'task-1');");
    db.exec(
      "INSERT INTO TaskComments (id, projectId, taskId, createdByUserId) VALUES (101, 1, 'task-1', 1);",
    );
    db.exec(
      "INSERT INTO TaskAttachments (projectId, taskId, attachmentId) VALUES (1, 'task-1', 'att-1');",
    );
    db.exec(
      "INSERT INTO TaskComments_Attachments (projectId, taskId, commentId, attachmentId) VALUES (1, 'task-1', 101, 'att-2');",
    );

    db.exec("DELETE FROM TaskMirror WHERE projectId = 1 AND taskId = 'task-1';");

    expect(querySingleValue(db, "SELECT COUNT(*) FROM TaskMirror")).toBe(0);
    expect(querySingleValue(db, "SELECT COUNT(*) FROM TaskComments")).toBe(0);
    expect(querySingleValue(db, "SELECT COUNT(*) FROM TaskAttachments")).toBe(0);
    expect(querySingleValue(db, "SELECT COUNT(*) FROM TaskComments_Attachments")).toBe(0);
    db.close();
  });

  it("cascades task mirror rows when the parent project is deleted", async () => {
    const db = await createV7Database();

    db.exec("INSERT INTO Projects (id, name) VALUES (1, 'Apollo');");
    db.exec("INSERT INTO TaskMirror (projectId, taskId) VALUES (1, 'task-1');");

    db.exec("DELETE FROM Projects WHERE id = 1;");

    expect(querySingleValue(db, "SELECT COUNT(*) FROM TaskMirror")).toBe(0);
    db.close();
  });
});
