import "reflect-metadata";

import { readFile, rm } from "node:fs/promises";
import path from "node:path";

import { FastifyAdapter, type NestFastifyApplication } from "@nestjs/platform-fastify";
import { Test } from "@nestjs/testing";
import { afterEach, describe, expect, it } from "vitest";
import { AppModule } from "../backend/app.module.js";
import { buildBackendConfig } from "../backend/config/backend-config.js";
import {
  issues,
  issuesInsertSchema,
  organizationsTeams,
  organizationsTeamsInsertSchema,
} from "../db/index.js";

import {
  applySqlDdl,
  getGeneratedSqlDdlDir,
  getGeneratedSqlDdlFilePath,
} from "../db/apply-sql-ddl.mjs";
import {
  availableSchemaVersions,
} from "../db/config.js";
import { requireDbTestRuntimeConfig } from "./db-test-runtime-guard.js";
import { createDbTestExecutionSandbox, createDbTestTempDir } from "./db-test-execution-db.js";
import {
  openDatabaseConnection,
  querySingleValue,
} from "../db/native-sqlite.mjs";

const dbTestRuntimeConfig = requireDbTestRuntimeConfig();

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

  it("advertises v3 as the active schema version", () => {
    expect(availableSchemaVersions).toContain("v3");
    expect(dbTestRuntimeConfig.runtimeSchemaSnapshotSubdir).toBe("v3");
  });

  it("resolves generated artifact paths from explicit version arguments", () => {
    expect(getGeneratedSqlDdlDir("v1")).toContain("db/v1/generated-sql-ddl");
    expect(getGeneratedSqlDdlDir("v2")).toContain("db/v2/generated-sql-ddl");
    expect(getGeneratedSqlDdlDir("v3")).toContain("db/v3/generated-sql-ddl");
    expect(getGeneratedSqlDdlFilePath("v1")).toContain(
      "db/v1/generated-sql-ddl/schema.sql",
    );
    expect(getGeneratedSqlDdlFilePath("v2")).toContain(
      "db/v2/generated-sql-ddl/schema.sql",
    );
    expect(getGeneratedSqlDdlFilePath("v3")).toContain(
      "db/v3/generated-sql-ddl/schema.sql",
    );
  });

  it("can apply the active schema version without script edits", async () => {
    const sandbox = await createDbTestExecutionSandbox({
      contextLabel: "active schema version test database",
      copyBaseDb: false,
      dbFileName: "active.sqlite",
      runtimeConfig: dbTestRuntimeConfig,
      tempDirPrefix: "giganttic-active-db-",
    });
    const outputPath = sandbox.dbPath;
    const tempDir = sandbox.tempDir;
    tempDirs.push(tempDir);

    const appliedPath = await applySqlDdl(
      outputPath,
      dbTestRuntimeConfig.runtimeSchemaSnapshotSubdir,
    );
    const db = openDatabaseConnection(appliedPath, { readonly: true });
    const tableCount = querySingleValue(
      db,
      "SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name IN ('Projects', 'Teams', 'SystemRoles')",
    );

    expect(tableCount).toBe(3);
    db.close();
  });

  it("fails startup for a stale v1 runtime database instead of silently rebuilding it", async () => {
    const tempDir = await createDbTestTempDir("giganttic-runtime-db-");
    const dbPath = path.join(tempDir, "runtime.sqlite");
    tempDirs.push(tempDir);

    await applySqlDdl(dbPath, "v1");

    const config = buildBackendConfig({
      dbPath,
      port: 0,
    });
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule.register(config)],
    }).compile();

    const app = moduleRef.createNestApplication<NestFastifyApplication>(
      new FastifyAdapter(),
    );

    app.setGlobalPrefix(config.routePrefix);

    await expect(app.init()).rejects.toThrow(/does not match runtime schema/i);
    await app.close();
  });

  it("exports organization team artifacts from the active db facade", () => {
    expect(organizationsTeams).toBeDefined();
    expect(
      organizationsTeamsInsertSchema.parse({
        organizationId: 1,
        teamId: 2,
      }),
    ).toMatchObject({
      organizationId: 1,
      teamId: 2,
    });
  });

  it("exports issues artifacts from the active db facade", () => {
    expect(issues).toBeDefined();
    expect(
      issuesInsertSchema.parse({
        name: "Sample issue",
        projectId: 1,
        status: "ISSUE_STATUS_OPEN",
      }),
    ).toMatchObject({
      name: "Sample issue",
      projectId: 1,
      status: "ISSUE_STATUS_OPEN",
    });
  });
});
