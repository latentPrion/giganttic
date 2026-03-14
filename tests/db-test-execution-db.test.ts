import { access, readFile, rm } from "node:fs/promises";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  createDbTestExecutionSandbox,
  ensureDbTestBaseDatabase,
} from "./db-test-execution-db.js";
import { requireDbTestRuntimeConfig } from "./db-test-runtime-guard.js";

const dbTestRuntimeConfig = requireDbTestRuntimeConfig();
const tempDirs: string[] = [];

describe("db test execution sandbox", () => {
  afterEach(async () => {
    while (tempDirs.length > 0) {
      const tempDir = tempDirs.pop();
      if (tempDir) {
        await rm(tempDir, { force: true, recursive: true });
      }
    }
  });

  it("creates a temp execution DB distinct from the shared testsuite DB", async () => {
    const sandbox = await createDbTestExecutionSandbox({
      contextLabel: "db test sandbox",
      dbFileName: "sandbox.sqlite",
      runtimeConfig: dbTestRuntimeConfig,
      tempDirPrefix: "giganttic-db-sandbox-",
    });
    tempDirs.push(sandbox.tempDir);

    await expect(access(sandbox.dbPath)).resolves.toBeUndefined();
    expect(path.resolve(sandbox.dbPath)).not.toBe(
      path.resolve(dbTestRuntimeConfig.runtimeTargetPath),
    );
  });

  it("creates unique temp execution DB paths across repeated calls", async () => {
    const first = await createDbTestExecutionSandbox({
      contextLabel: "db test sandbox",
      dbFileName: "sandbox.sqlite",
      runtimeConfig: dbTestRuntimeConfig,
      tempDirPrefix: "giganttic-db-sandbox-",
    });
    const second = await createDbTestExecutionSandbox({
      contextLabel: "db test sandbox",
      dbFileName: "sandbox.sqlite",
      runtimeConfig: dbTestRuntimeConfig,
      tempDirPrefix: "giganttic-db-sandbox-",
    });
    tempDirs.push(first.tempDir, second.tempDir);

    expect(first.dbPath).not.toBe(second.dbPath);
  });

  it("preserves the shared testsuite base file while copying from it", async () => {
    const baseDbPath = await ensureDbTestBaseDatabase(dbTestRuntimeConfig);
    const baseBefore = await readFile(baseDbPath);
    const sandbox = await createDbTestExecutionSandbox({
      contextLabel: "db test sandbox",
      dbFileName: "sandbox.sqlite",
      runtimeConfig: dbTestRuntimeConfig,
      tempDirPrefix: "giganttic-db-sandbox-",
    });
    tempDirs.push(sandbox.tempDir);
    const baseAfter = await readFile(baseDbPath);

    expect(baseAfter.equals(baseBefore)).toBe(true);
  });
});
