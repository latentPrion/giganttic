import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import initSqlJs from "sql.js";
import { afterEach, describe, expect, it } from "vitest";

import {
  applySqlDdl,
  getGeneratedSqlDdlDir,
  getGeneratedSqlDdlFilePath,
} from "../db/apply-sql-ddl.mjs";
import { activeSchemaVersion, availableSchemaVersions } from "../db/config.js";

describe("db version selection pipeline", () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    while (tempDirs.length > 0) {
      const tempDir = tempDirs.pop();
      if (tempDir) {
        await rm(tempDir, { force: true, recursive: true });
      }
    }
  });

  it("advertises v2 as the active schema version", () => {
    expect(availableSchemaVersions).toContain("v2");
    expect(activeSchemaVersion).toBe("v2");
  });

  it("resolves generated artifact paths from explicit version arguments", () => {
    expect(getGeneratedSqlDdlDir("v1")).toContain("db/v1/generated-sql-ddl");
    expect(getGeneratedSqlDdlDir("v2")).toContain("db/v2/generated-sql-ddl");
    expect(getGeneratedSqlDdlFilePath("v1")).toContain(
      "db/v1/generated-sql-ddl/schema.sql",
    );
    expect(getGeneratedSqlDdlFilePath("v2")).toContain(
      "db/v2/generated-sql-ddl/schema.sql",
    );
  });

  it("can apply the active schema version without script edits", async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "giganttic-active-db-"));
    const outputPath = path.join(tempDir, "active.sqlite");
    tempDirs.push(tempDir);

    const appliedPath = await applySqlDdl(outputPath, activeSchemaVersion);
    const SQL = await initSqlJs();
    const db = new SQL.Database(new Uint8Array(await readFile(appliedPath)));
    const result = db.exec(
      "SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name IN ('Projects', 'Teams', 'SystemRoles')",
    );

    expect(result[0]?.values[0]?.[0]).toBe(3);
    db.close();
  });
});
