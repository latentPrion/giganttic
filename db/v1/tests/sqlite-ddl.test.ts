import { rm } from "node:fs/promises";
import { afterEach, describe, expect, it } from "vitest";

import {
  applySqlDdl,
  getGeneratedSqlDdlDir,
  getGeneratedSqlDdlFilePath,
  readGeneratedSqlStatements,
} from "../../apply-sql-ddl.mjs";
import {
  requireDbTestRuntimeConfig,
} from "../../../tests/db-test-runtime-guard.js";
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

const SCHEMA_VERSION = "v1";
const TEMP_DIR_PREFIX = "giganttic-v1-ddl-";
const dbTestRuntimeConfig = requireDbTestRuntimeConfig();

describe("generated sqlite ddl", () => {
  const tempPaths: string[] = [];

  afterEach(async () => {
    while (tempPaths.length > 0) {
      const tempPath = tempPaths.pop();
      if (tempPath) {
        await rm(tempPath, { force: true, recursive: true });
      }
    }
  });

  it("contains executable SQL statements", async () => {
    const statements = await readGeneratedSqlStatements(SCHEMA_VERSION);

    expect(statements.length).toBeGreaterThan(0);
    expect(
      statements.some((statement) =>
        statement.includes("CREATE TABLE `CredentialTypes`"),
      ),
    ).toBe(true);
    expect(getGeneratedSqlDdlDir(SCHEMA_VERSION)).toContain(
      `db/${SCHEMA_VERSION}/generated-sql-ddl`,
    );
    expect(getGeneratedSqlDdlFilePath(SCHEMA_VERSION)).toContain(
      `db/${SCHEMA_VERSION}/generated-sql-ddl/schema.sql`,
    );
  });

  it("applies cleanly and creates the expected tables", async () => {
    const tempDir = await createDbTestTempDir(TEMP_DIR_PREFIX);
    const outputPath = createDbTestExecutionPath(
      tempDir,
      "v1.sqlite",
      dbTestRuntimeConfig,
      "v1 sqlite-ddl test database",
    );
    tempPaths.push(tempDir);
    const appliedPath = await applySqlDdl(outputPath, SCHEMA_VERSION);
    const db = openDatabaseConnection(appliedPath, { readonly: true });

    const tableCount = querySingleValue(
      db,
      "SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name IN (?, ?, ?, ?, ?, ?, ?)",
      [
        "Users",
        "Roles",
        "CredentialTypes",
        "Users_Roles",
        "Users_CredentialTypes",
        "Users_PasswordCredentials",
        "Users_Sessions",
      ],
    );

    expect(tableCount).toBe(7);
    expect(appliedPath).toBe(outputPath);
    db.close();
  });

  it("enforces unique username and email constraints", async () => {
    const db = openInMemoryDatabase();
    const statements = await readGeneratedSqlStatements(SCHEMA_VERSION);

    executeSqlStatements(db, statements);

    db.exec(
      "INSERT INTO Users (username, email) VALUES ('alice', 'alice@example.com');",
    );

    expect(() =>
      db.exec(
        "INSERT INTO Users (username, email) VALUES ('alice', 'alice-2@example.com');",
      ),
    ).toThrow(/unique/i);
    expect(() =>
      db.exec(
        "INSERT INTO Users (username, email) VALUES ('alice-2', 'alice@example.com');",
      ),
    ).toThrow(/unique/i);
    db.close();
  });

  it("enforces singleton password credentials and session timestamp checks", async () => {
    const db = openInMemoryDatabase();
    const statements = await readGeneratedSqlStatements(SCHEMA_VERSION);

    executeSqlStatements(db, statements);

    db.exec(
      "INSERT INTO Users (id, username, email) VALUES (1, 'bob', 'bob@example.com');",
    );
    db.exec(
      "INSERT INTO CredentialTypes (code, displayName) VALUES ('GGTC_CREDTYPE_USERNAME_PASSWORD', 'Username and Password');",
    );
    db.exec(
      "INSERT INTO Users_CredentialTypes (id, userId, credentialTypeCode) VALUES (1, 1, 'GGTC_CREDTYPE_USERNAME_PASSWORD');",
    );
    db.exec(
      "INSERT INTO Users_PasswordCredentials (userCredentialTypeId, passwordHash) VALUES (1, 'argon2id$hash1');",
    );

    expect(() =>
      db.exec(
        "INSERT INTO Users_CredentialTypes (id, userId, credentialTypeCode) VALUES (2, 1, 'GGTC_CREDTYPE_USERNAME_PASSWORD');",
      ),
    ).toThrow(/unique/i);
    expect(() =>
      db.exec(
        "INSERT INTO Users_Sessions (id, userId, sessionTokenHash, startTimestamp, expirationTimestamp, ipAddress) VALUES ('sess-1', 1, 'hash-1', 200, 100, '127.0.0.1');",
      ),
    ).toThrow(/check/i);
    db.close();
  });
});
