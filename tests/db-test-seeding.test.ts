import { access, readFile, rm } from "node:fs/promises";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { openDatabaseConnection } from "../db/native-sqlite.mjs";
import { purgeSeededTestData } from "../db/sqlite-test-data-manager.mjs";
import { createDbTestExecutionSandbox } from "./db-test-execution-db.js";
import { requireDbTestRuntimeConfig } from "./db-test-runtime-guard.js";
import { seedExecutionDatabase } from "./db-test-seeding.js";

const dbTestRuntimeConfig = requireDbTestRuntimeConfig();
const PROJECT_SEED_KEY = "project:projectProjectManager";
const TEMP_DIR_PREFIX = "giganttic-db-seeding-";
const tempDirs: string[] = [];

async function pathExists(targetPath: string) {
  try {
    await access(targetPath);
    return true;
  } catch {
    return false;
  }
}

function readTrackedProjectId(dbPath: string, seedKey: string) {
  const db = openDatabaseConnection(dbPath, { readonly: true });
  try {
    const row = db.prepare(
      "SELECT entityId FROM ManagedTestDataRecords WHERE entityTable = 'Projects' AND seedKey = ?;",
    ).raw(true).get(seedKey) as [number] | undefined;

    return Number(row?.[0]);
  } finally {
    db.close();
  }
}

function purgeSeededDataInSandbox(dbPath: string, chartsDir: string) {
  const db = openDatabaseConnection(dbPath);

  try {
    purgeSeededTestData(db, chartsDir);
  } finally {
    db.close();
  }
}

async function createSeededSandbox(dbFileName: string) {
  const sandbox = await createDbTestExecutionSandbox({
    contextLabel: "db test seeded sandbox",
    copyBaseDb: false,
    dbFileName,
    runtimeConfig: dbTestRuntimeConfig,
    tempDirPrefix: TEMP_DIR_PREFIX,
  });
  tempDirs.push(sandbox.tempDir);

  await seedExecutionDatabase({
    dbPath: sandbox.dbPath,
    includeTestData: true,
    schemaName: dbTestRuntimeConfig.runtimeSchemaSnapshotSubdir,
  });

  return sandbox;
}

describe("db test seeding charts", () => {
  afterEach(async () => {
    while (tempDirs.length > 0) {
      const tempDir = tempDirs.pop();
      if (tempDir) {
        await rm(tempDir, { force: true, recursive: true });
      }
    }
  });

  it("writes seeded charts into the sandbox charts directory instead of the repo charts directory", async () => {
    const sandbox = await createSeededSandbox("seeded-sandbox.sqlite");
    const trackedProjectId = readTrackedProjectId(sandbox.dbPath, PROJECT_SEED_KEY);
    const sandboxChartPath = path.join(sandbox.tempDir, "charts", `${trackedProjectId}.xml`);
    const repoChartPath = path.join(process.cwd(), "charts", `${trackedProjectId}.xml`);

    expect(await pathExists(sandboxChartPath)).toBe(true);
    expect(path.resolve(sandboxChartPath).startsWith(path.resolve(sandbox.tempDir))).toBe(true);
    expect(path.resolve(sandboxChartPath)).not.toBe(path.resolve(repoChartPath));
  });

  it("creates unique seeded chart paths across parallel sandbox databases", async () => {
    const firstSandbox = await createSeededSandbox("first-seeded-sandbox.sqlite");
    const secondSandbox = await createSeededSandbox("second-seeded-sandbox.sqlite");
    const firstProjectId = readTrackedProjectId(firstSandbox.dbPath, PROJECT_SEED_KEY);
    const secondProjectId = readTrackedProjectId(secondSandbox.dbPath, PROJECT_SEED_KEY);
    const firstChartPath = path.join(firstSandbox.tempDir, "charts", `${firstProjectId}.xml`);
    const secondChartPath = path.join(secondSandbox.tempDir, "charts", `${secondProjectId}.xml`);

    expect(firstChartPath).not.toBe(secondChartPath);
    expect(await pathExists(firstChartPath)).toBe(true);
    expect(await pathExists(secondChartPath)).toBe(true);
  });

  it("purging seeded data in one sandbox leaves seeded charts intact in another sandbox", async () => {
    const firstSandbox = await createSeededSandbox("first-purge-sandbox.sqlite");
    const secondSandbox = await createSeededSandbox("second-purge-sandbox.sqlite");
    const firstProjectId = readTrackedProjectId(firstSandbox.dbPath, PROJECT_SEED_KEY);
    const secondProjectId = readTrackedProjectId(secondSandbox.dbPath, PROJECT_SEED_KEY);
    const firstChartPath = path.join(firstSandbox.tempDir, "charts", `${firstProjectId}.xml`);
    const secondChartPath = path.join(secondSandbox.tempDir, "charts", `${secondProjectId}.xml`);

    purgeSeededDataInSandbox(firstSandbox.dbPath, path.join(firstSandbox.tempDir, "charts"));

    expect(await pathExists(firstChartPath)).toBe(false);
    expect(await pathExists(secondChartPath)).toBe(true);
    expect(await readFile(secondChartPath, "utf8")).toContain("Direct PM kickoff");
  });
});
