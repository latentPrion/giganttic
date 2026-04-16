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

const SCHEMA_VERSION = "v10";
const dbTestRuntimeConfig = requireDbTestRuntimeConfig();

async function createV10Database() {
  const db = openInMemoryDatabase();
  const statements = await readGeneratedSqlStatements(SCHEMA_VERSION);
  executeSqlStatements(db, statements);
  return db;
}

describe("generated sqlite ddl for v10", () => {
  const tempPaths: string[] = [];

  afterEach(async () => {
    while (tempPaths.length > 0) {
      const tempPath = tempPaths.pop();
      if (tempPath) {
        await rm(tempPath, { force: true, recursive: true });
      }
    }
  });

  it("contains executable SQL statements for v10", async () => {
    const statements = await readGeneratedSqlStatements(SCHEMA_VERSION);

    expect(statements.length).toBeGreaterThan(0);
    expect(
      statements.some((statement) => statement.includes("CREATE TABLE `Notifications`")),
    ).toBe(true);
    expect(
      statements.some((statement) => statement.includes("CREATE TABLE `Users_Notifications`")),
    ).toBe(true);
    expect(
      statements.some((statement) => statement.includes("CREATE TABLE `Mentions`")),
    ).toBe(true);
    expect(getGeneratedSqlDdlDir(SCHEMA_VERSION)).toContain("db/v10/generated-sql-ddl");
    expect(getGeneratedSqlDdlFilePath(SCHEMA_VERSION)).toContain(
      "db/v10/generated-sql-ddl/schema.sql",
    );
  });

  it("applies cleanly and creates v10 notification and mention tables", async () => {
    const tempDir = await createDbTestTempDir("giganttic-v10-ddl-");
    const outputPath = createDbTestExecutionPath(
      tempDir,
      "v10.sqlite",
      dbTestRuntimeConfig,
      "v10 sqlite-ddl test database",
    );
    tempPaths.push(tempDir);

    const appliedPath = await applySqlDdl(outputPath, SCHEMA_VERSION);
    const db = openDatabaseConnection(appliedPath, { readonly: true });

    const tableCount = querySingleValue(
      db,
      "SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name IN (?, ?, ?)",
      ["Notifications", "Users_Notifications", "Mentions"],
    );

    expect(tableCount).toBe(3);
    db.close();
  });

  it("enforces mention uniqueness per logical container and mentioned user", async () => {
    const db = await createV10Database();

    db.exec(
      "INSERT INTO Users (id, username, email) VALUES (1, 'alice', 'alice@example.com'), (2, 'bob', 'bob@example.com');",
    );
    db.exec("INSERT INTO Projects (id, name) VALUES (1, 'Apollo');");
    db.exec(
      "INSERT INTO IssueStatuses (code, displayName) VALUES ('ISSUE_STATUS_OPEN', 'Open');",
    );
    db.exec(
      "INSERT INTO Issues (id, projectId, name, status) VALUES (10, 1, 'Issue A', 'ISSUE_STATUS_OPEN');",
    );
    db.exec(
      `INSERT INTO Mentions (speakerUserId, mentionedUserId, projectId, issueId, taskId, commentId, mentionContainerType, containerKey)
       VALUES (1, 2, 1, 10, NULL, 77, 'MENTION_CONTAINER_ISSUE_COMMENT', '1:10:-:77');`,
    );

    expect(() =>
      db.exec(
        `INSERT INTO Mentions (speakerUserId, mentionedUserId, projectId, issueId, taskId, commentId, mentionContainerType, containerKey)
         VALUES (1, 2, 1, 10, NULL, 77, 'MENTION_CONTAINER_ISSUE_COMMENT', '1:10:-:77');`,
      ),
    ).toThrow(/unique/i);
    db.close();
  });

  it("cascades user notification deliveries when the parent notification is deleted", async () => {
    const db = await createV10Database();

    db.exec(
      "INSERT INTO Users (id, username, email) VALUES (1, 'alice', 'alice@example.com'), (2, 'bob', 'bob@example.com');",
    );
    db.exec("INSERT INTO Projects (id, name) VALUES (1, 'Apollo');");
    db.exec(
      "INSERT INTO Notifications (id, eventType, actorUserId, projectId, issueId, taskId, commentId, attachmentId, mentionedUserId, message, targetUrl) VALUES (10, 'NOTIFICATION_EVENT_PROJECT_JOURNAL_MENTIONED', 1, 1, NULL, NULL, NULL, NULL, 2, 'alice mentioned you in the journal for Project \"Apollo\".', '/pm/pm/project?projectId=1#project-journal');",
    );
    db.exec(
      "INSERT INTO Users_Notifications (userId, notificationId, hasBeenNoticed) VALUES (2, 10, 0);",
    );

    db.exec("DELETE FROM Notifications WHERE id = 10;");

    expect(querySingleValue(db, "SELECT COUNT(*) FROM Notifications")).toBe(0);
    expect(querySingleValue(db, "SELECT COUNT(*) FROM Users_Notifications")).toBe(0);
    db.close();
  });

  it("cascades mention rows when the mentioned user is deleted", async () => {
    const db = await createV10Database();

    db.exec(
      "INSERT INTO Users (id, username, email) VALUES (1, 'alice', 'alice@example.com'), (2, 'bob', 'bob@example.com');",
    );
    db.exec("INSERT INTO Projects (id, name) VALUES (1, 'Apollo');");
    db.exec(
      `INSERT INTO Mentions (speakerUserId, mentionedUserId, projectId, issueId, taskId, commentId, mentionContainerType, containerKey)
       VALUES (1, 2, 1, NULL, NULL, NULL, 'MENTION_CONTAINER_PROJECT_JOURNAL', '1:-:-:-');`,
    );

    db.exec("DELETE FROM Users WHERE id = 2;");

    expect(querySingleValue(db, "SELECT COUNT(*) FROM Mentions")).toBe(0);
    db.close();
  });
});
