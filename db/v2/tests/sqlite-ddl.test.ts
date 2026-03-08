import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import initSqlJs from "sql.js";
import type { Database } from "sql.js";
import { afterEach, describe, expect, it } from "vitest";

import {
  applySqlDdl,
  getGeneratedSqlDdlDir,
  getGeneratedSqlDdlFilePath,
  readGeneratedSqlStatements,
} from "../../apply-sql-ddl.mjs";

const SCHEMA_VERSION = "v2";

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

async function createV2Database() {
  const SQL = await initSqlJs();
  const db = new SQL.Database();
  const statements = await readGeneratedSqlStatements(SCHEMA_VERSION);

  db.exec("PRAGMA foreign_keys = ON;");
  for (const statement of statements) {
    db.exec(statement);
  }

  return db;
}

describe("generated sqlite ddl for v2", () => {
  const tempPaths: string[] = [];

  afterEach(async () => {
    while (tempPaths.length > 0) {
      const tempPath = tempPaths.pop();
      if (tempPath) {
        await rm(tempPath, { force: true, recursive: true });
      }
    }
  });

  it("contains executable SQL statements for the requested schema version", async () => {
    const statements = await readGeneratedSqlStatements(SCHEMA_VERSION);

    expect(statements.length).toBeGreaterThan(0);
    expect(
      statements.some((statement) => statement.includes("CREATE TABLE `Projects`")),
    ).toBe(true);
    expect(getGeneratedSqlDdlDir(SCHEMA_VERSION)).toContain(
      "db/v2/generated-sql-ddl",
    );
    expect(getGeneratedSqlDdlFilePath(SCHEMA_VERSION)).toContain(
      "db/v2/generated-sql-ddl/schema.sql",
    );
  });

  it("applies cleanly and creates the expected v2 tables while removing v1 role tables", async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "giganttic-v2-ddl-"));
    const outputPath = path.join(tempDir, "v2.sqlite");
    tempPaths.push(tempDir);

    const appliedPath = await applySqlDdl(outputPath, SCHEMA_VERSION);
    const SQL = await initSqlJs();
    const db = new SQL.Database(new Uint8Array(await readFile(appliedPath)));

    const presentTableCount = querySingleValue(
      db,
      "SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name IN (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [
        "Users",
        "CredentialTypes",
        "Projects",
        "Teams",
        "SystemRoles",
        "ProjectRoles",
        "TeamRoles",
        "Projects_Users",
        "Teams_Users",
        "Projects_Teams",
        "Users_SystemRoles",
        "Users_Projects_ProjectRoles",
        "Users_Teams_TeamRoles",
      ],
    );
    const removedTableCount = querySingleValue(
      db,
      "SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name IN (?, ?)",
      ["Roles", "Users_Roles"],
    );

    expect(presentTableCount).toBe(13);
    expect(removedTableCount).toBe(0);
    db.close();
  });

  it("allows duplicate team and project names", async () => {
    const db = await createV2Database();

    db.exec(
      "INSERT INTO Projects (id, name, description) VALUES (1, 'Apollo', 'One'), (2, 'Apollo', 'Two');",
    );
    db.exec(
      "INSERT INTO Teams (id, name, description) VALUES (1, 'Platform', 'One'), (2, 'Platform', 'Two');",
    );

    expect(
      querySingleValue(db, "SELECT COUNT(*) FROM Projects WHERE name = 'Apollo'"),
    ).toBe(2);
    expect(
      querySingleValue(db, "SELECT COUNT(*) FROM Teams WHERE name = 'Platform'"),
    ).toBe(2);
    db.close();
  });

  it("enforces mapping uniqueness and foreign keys", async () => {
    const db = await createV2Database();

    db.exec("INSERT INTO Users (id, username, email) VALUES (1, 'alice', 'alice@example.com');");
    db.exec("INSERT INTO Projects (id, name) VALUES (1, 'Apollo');");
    db.exec("INSERT INTO Teams (id, name) VALUES (1, 'Platform');");
    db.exec(
      "INSERT INTO SystemRoles (code, displayName) VALUES ('GGTC_SYSTEMROLE_ADMIN', 'Administrator');",
    );
    db.exec(
      "INSERT INTO TeamRoles (code, displayName) VALUES ('GGTC_TEAMROLE_PROJECT_MANAGER', 'Project Manager');",
    );

    db.exec("INSERT INTO Projects_Users (userId, projectId) VALUES (1, 1);");
    db.exec("INSERT INTO Users_SystemRoles (userId, roleCode) VALUES (1, 'GGTC_SYSTEMROLE_ADMIN');");

    expect(() =>
      db.exec("INSERT INTO Projects_Users (userId, projectId) VALUES (1, 1);"),
    ).toThrow(/unique/i);
    expect(() =>
      db.exec(
        "INSERT INTO Users_Teams_TeamRoles (userId, teamId, roleCode) VALUES (1, 999, 'GGTC_TEAMROLE_PROJECT_MANAGER');",
      ),
    ).toThrow(/foreign key/i);
    db.close();
  });
});
