import { rm } from "node:fs/promises";
import { afterEach, describe, expect, it } from "vitest";

import {
  applySqlDdl,
  getGeneratedSqlDdlDir,
  getGeneratedSqlDdlFilePath,
  readGeneratedSqlStatements,
} from "../../apply-sql-ddl.mjs";
import { requireDbTestRuntimeConfig } from "../../../tests/db-test-runtime-guard.js";
import {
  createDbTestExecutionPath,
  createDbTestTempDir,
} from "../../../tests/db-test-execution-db.js";
import {
  executeSqlStatements,
  openDatabaseConnection,
  openInMemoryDatabase,
  querySingleValue,
} from "../../native-sqlite.mjs";

const SCHEMA_VERSION = "v5";
const dbTestRuntimeConfig = requireDbTestRuntimeConfig();

async function createV5Database() {
  const db = openInMemoryDatabase();
  const statements = await readGeneratedSqlStatements(SCHEMA_VERSION);
  executeSqlStatements(db, statements);
  return db;
}

describe("generated sqlite ddl for v5", () => {
  const tempPaths: string[] = [];

  afterEach(async () => {
    while (tempPaths.length > 0) {
      const tempPath = tempPaths.pop();
      if (tempPath) {
        await rm(tempPath, { force: true, recursive: true });
      }
    }
  });

  it("contains executable SQL statements for v5", async () => {
    const statements = await readGeneratedSqlStatements(SCHEMA_VERSION);

    expect(statements.length).toBeGreaterThan(0);
    expect(
      statements.some((statement) =>
        statement.includes("CREATE TABLE `Attachments`"),
      ),
    ).toBe(true);
    expect(
      statements.some((statement) =>
        statement.includes("CREATE TABLE `IssueComments`"),
      ),
    ).toBe(true);
    expect(getGeneratedSqlDdlDir(SCHEMA_VERSION)).toContain(
      "db/v5/generated-sql-ddl",
    );
    expect(getGeneratedSqlDdlFilePath(SCHEMA_VERSION)).toContain(
      "db/v5/generated-sql-ddl/schema.sql",
    );
  });

  it("applies cleanly and creates v5 attachment + comment tables", async () => {
    const tempDir = await createDbTestTempDir("giganttic-v5-ddl-");
    const outputPath = createDbTestExecutionPath(
      tempDir,
      "v5.sqlite",
      dbTestRuntimeConfig,
      "v5 sqlite-ddl test database",
    );
    tempPaths.push(tempDir);

    const appliedPath = await applySqlDdl(outputPath, SCHEMA_VERSION);
    const db = openDatabaseConnection(appliedPath, { readonly: true });

    const extraTableCount = querySingleValue(
      db,
      "SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name IN (?, ?, ?, ?)",
      [
        "Attachments",
        "Issues_Attachments",
        "IssueComments",
        "IssueComments_Attachments",
      ],
    );

    expect(extraTableCount).toBe(4);
    db.close();
  });

  it("enforces scoped token object composite uniqueness", async () => {
    const db = await createV5Database();

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
});
