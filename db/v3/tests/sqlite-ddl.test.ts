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

const SCHEMA_VERSION = "v3";
const dbTestRuntimeConfig = requireDbTestRuntimeConfig();

async function createV3Database() {
  const db = openInMemoryDatabase();
  const statements = await readGeneratedSqlStatements(SCHEMA_VERSION);

  executeSqlStatements(db, statements);

  return db;
}

describe("generated sqlite ddl for v3", () => {
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
      "db/v3/generated-sql-ddl",
    );
    expect(getGeneratedSqlDdlFilePath(SCHEMA_VERSION)).toContain(
      "db/v3/generated-sql-ddl/schema.sql",
    );
  });

  it("applies cleanly and creates the expected v3 tables while removing v1 role tables", async () => {
    const tempDir = await createDbTestTempDir("giganttic-v3-ddl-");
    const outputPath = createDbTestExecutionPath(
      tempDir,
      "v3.sqlite",
      dbTestRuntimeConfig,
      "v3 sqlite-ddl test database",
    );
    tempPaths.push(tempDir);

    const appliedPath = await applySqlDdl(outputPath, SCHEMA_VERSION);
    const db = openDatabaseConnection(appliedPath, { readonly: true });

    const presentTableCount = querySingleValue(
      db,
      "SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name IN (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [
        "Users",
        "CredentialTypes",
        "Projects",
        "Teams",
        "Organizations",
        "Issues",
        "ManagedTestDataRecords",
        "SystemRoles",
        "ProjectRoles",
        "TeamRoles",
        "OrganizationRoles",
        "IssueStatuses",
        "ClosedReasons",
        "Projects_Users",
        "Teams_Users",
        "Projects_Teams",
        "Users_Organizations",
        "Projects_Organizations",
        "Organizations_Teams",
        "Users_SystemRoles",
        "Users_Projects_ProjectRoles",
        "Users_Teams_TeamRoles",
        "Users_Organizations_OrganizationRoles",
      ],
    );
    const removedTableCount = querySingleValue(
      db,
      "SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name IN (?, ?)",
      ["Roles", "Users_Roles"],
    );

    expect(presentTableCount).toBe(23);
    expect(removedTableCount).toBe(0);
    db.close();
  });

  it("allows duplicate team and project names", async () => {
    const db = await createV3Database();

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

  it("creates the Projects journal column", async () => {
    const db = await createV3Database();

    const columnNames = db.prepare("PRAGMA table_info('Projects');")
      .raw(true)
      .all()
      .map((row) => String((row as unknown[])[1]));

    expect(columnNames).toContain("journal");
    db.close();
  });

  it("creates the managed test-data tracking table", async () => {
    const db = await createV3Database();

    const columnNames = db.prepare("PRAGMA table_info('ManagedTestDataRecords');")
      .raw(true)
      .all()
      .map((row) => String((row as unknown[])[1]));

    expect(columnNames).toContain("seedKey");
    expect(columnNames).toContain("entityTable");
    expect(columnNames).toContain("entityId");
    db.close();
  });

  it("enforces mapping uniqueness and foreign keys", async () => {
    const db = await createV3Database();

    db.exec("INSERT INTO Users (id, username, email) VALUES (1, 'alice', 'alice@example.com');");
    db.exec("INSERT INTO Projects (id, name) VALUES (1, 'Apollo');");
    db.exec("INSERT INTO Teams (id, name) VALUES (1, 'Platform'), (2, 'Ops');");
    db.exec("INSERT INTO Organizations (id, name) VALUES (1, 'Umbrella');");
    db.exec(
      "INSERT INTO SystemRoles (code, displayName) VALUES ('GGTC_SYSTEMROLE_ADMIN', 'Administrator');",
    );
    db.exec(
      "INSERT INTO TeamRoles (code, displayName) VALUES ('GGTC_TEAMROLE_PROJECT_MANAGER', 'Project Manager');",
    );
    db.exec(
      "INSERT INTO OrganizationRoles (code, displayName) VALUES ('GGTC_ORGANIZATIONROLE_ORGANIZATION_MANAGER', 'Organization Manager');",
    );
    db.exec(
      "INSERT INTO IssueStatuses (code, displayName) VALUES ('ISSUE_STATUS_OPEN', 'Open');",
    );
    db.exec(
      "INSERT INTO IssueStatuses (code, displayName) VALUES ('ISSUE_STATUS_IN_PROGRESS', 'In Progress');",
    );
    db.exec(
      "INSERT INTO ClosedReasons (code, displayName) VALUES ('ISSUE_CLOSED_REASON_RESOLVED', 'Resolved');",
    );

    db.exec("INSERT INTO Projects_Users (userId, projectId) VALUES (1, 1);");
    db.exec("INSERT INTO Users_SystemRoles (userId, roleCode) VALUES (1, 'GGTC_SYSTEMROLE_ADMIN');");
    db.exec("INSERT INTO Organizations_Teams (organizationId, teamId) VALUES (1, 1);");
    db.exec(
      "INSERT INTO Issues (projectId, name, priority, status, progressPercentage) VALUES (1, 'Bug', 3, 'ISSUE_STATUS_OPEN', 25);",
    );

    expect(() =>
      db.exec("INSERT INTO Projects_Users (userId, projectId) VALUES (1, 1);"),
    ).toThrow(/unique/i);
    expect(() =>
      db.exec("INSERT INTO Organizations_Teams (organizationId, teamId) VALUES (1, 1);"),
    ).toThrow(/unique/i);
    expect(() =>
      db.exec("INSERT INTO Organizations_Teams (organizationId, teamId) VALUES (999, 2);"),
    ).toThrow(/foreign key/i);
    expect(() =>
      db.exec(
        "INSERT INTO Users_Teams_TeamRoles (userId, teamId, roleCode) VALUES (1, 999, 'GGTC_TEAMROLE_PROJECT_MANAGER');",
      ),
    ).toThrow(/foreign key/i);
    expect(() =>
      db.exec(
        "INSERT INTO Issues (projectId, name, priority, status, progressPercentage) VALUES (999, 'Ghost Bug', 1, 'ISSUE_STATUS_OPEN', 25);",
      ),
    ).toThrow(/foreign key/i);
    expect(() =>
      db.exec(
        "INSERT INTO Issues (projectId, name, priority, status, progressPercentage) VALUES (1, 'Bad Progress', 1, 'ISSUE_STATUS_OPEN', 101);",
      ),
    ).toThrow(/check/i);
    expect(() =>
      db.exec(
        "INSERT INTO Issues (projectId, name, priority, status, progressPercentage) VALUES (1, 'Negative Priority', -1, 'ISSUE_STATUS_OPEN', 0);",
      ),
    ).toThrow(/check/i);
    expect(() =>
      db.exec(
        "INSERT INTO Issues (projectId, name, priority, status, progressPercentage) VALUES (1, 'Too Urgent', 4, 'ISSUE_STATUS_OPEN', 0);",
      ),
    ).toThrow(/check/i);
    db.close();
  });

  it("supports project owner role rows and rejects unknown project-role assignments by foreign key", async () => {
    const db = await createV3Database();

    db.exec("INSERT INTO Users (id, username, email) VALUES (1, 'alice', 'alice@example.com');");
    db.exec("INSERT INTO Projects (id, name) VALUES (1, 'Apollo');");
    db.exec(
      "INSERT INTO ProjectRoles (code, displayName) VALUES ('GGTC_PROJECTROLE_PROJECT_OWNER', 'Project Owner');",
    );
    db.exec(
      "INSERT INTO Users_Projects_ProjectRoles (userId, projectId, roleCode) VALUES (1, 1, 'GGTC_PROJECTROLE_PROJECT_OWNER');",
    );

    expect(
      querySingleValue(
        db,
        "SELECT COUNT(*) FROM Users_Projects_ProjectRoles WHERE roleCode = 'GGTC_PROJECTROLE_PROJECT_OWNER'",
      ),
    ).toBe(1);
    expect(() =>
      db.exec(
        "INSERT INTO Users_Projects_ProjectRoles (userId, projectId, roleCode) VALUES (1, 1, 'GGTC_PROJECTROLE_NOT_REAL');",
      ),
    ).toThrow(/foreign key/i);
    db.close();
  });

  it("cascades project deletion to issues", async () => {
    const db = await createV3Database();

    db.exec(
      "INSERT INTO IssueStatuses (code, displayName) VALUES ('ISSUE_STATUS_OPEN', 'Open');",
    );
    db.exec(
      "INSERT INTO IssueStatuses (code, displayName) VALUES ('ISSUE_STATUS_IN_PROGRESS', 'In Progress');",
    );
    db.exec("INSERT INTO Projects (id, name) VALUES (1, 'Apollo');");
    db.exec(
      "INSERT INTO Issues (projectId, name, priority, status, progressPercentage) VALUES (1, 'Linked issue', 0, 'ISSUE_STATUS_OPEN', 0);",
    );

    db.exec("DELETE FROM Projects WHERE id = 1;");

    expect(querySingleValue(db, "SELECT COUNT(*) FROM Issues")).toBe(0);
    db.close();
  });
});
