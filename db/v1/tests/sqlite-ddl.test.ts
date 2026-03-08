import { readFile } from "node:fs/promises";

import initSqlJs from "sql.js";
import type { Database } from "sql.js";
import { describe, expect, it } from "vitest";

import {
  applySqlDdl,
  getGeneratedSqlDdlDir,
  getGeneratedSqlDdlFilePath,
  readGeneratedSqlStatements,
  runtimeSqliteDbPath,
} from "../../apply-sql-ddl.mjs";

const SCHEMA_VERSION = "v1";

function querySingleValue(
  db: Database,
  sql: string,
  params: (string | number | null)[] = [],
): unknown {
  const result = db.exec(sql, params);
  const value = result[0]?.values[0]?.[0];

  if (value === undefined) {
    throw new Error(`No rows returned for query: ${sql}`);
  }

  return value;
}

describe("generated sqlite ddl", () => {
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
    const outputPath = await applySqlDdl(runtimeSqliteDbPath, SCHEMA_VERSION);
    const SQL = await initSqlJs();
    const db = new SQL.Database(new Uint8Array(await readFile(outputPath)));

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
    expect(outputPath).toBe(runtimeSqliteDbPath);
    db.close();
  });

  it("enforces unique username and email constraints", async () => {
    const SQL = await initSqlJs();
    const db = new SQL.Database();
    const statements = await readGeneratedSqlStatements(SCHEMA_VERSION);

    db.exec("PRAGMA foreign_keys = ON;");
    for (const statement of statements) {
      db.exec(statement);
    }

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
    const SQL = await initSqlJs();
    const db = new SQL.Database();
    const statements = await readGeneratedSqlStatements(SCHEMA_VERSION);

    db.exec("PRAGMA foreign_keys = ON;");
    for (const statement of statements) {
      db.exec(statement);
    }

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
