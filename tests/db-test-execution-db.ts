import { access, copyFile, mkdir, mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import initSqlJs from "sql.js";

import type { DbTestRuntimeConfig } from "./db-test-runtime-guard.js";
import { assertDoesNotUseRuntimeDbPath } from "./db-test-runtime-guard.js";

export interface DbTestExecutionSandbox {
  dbPath: string;
  tempDir: string;
}

async function pathExists(targetPath: string) {
  try {
    await access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function createEmptySqliteDatabase(filePath: string) {
  const SQL = await initSqlJs();
  const db = new SQL.Database();
  const bytes = db.export();
  db.close();
  await writeFile(filePath, Buffer.from(bytes));
}

export async function ensureDbTestBaseDatabase(
  runtimeConfig: DbTestRuntimeConfig,
) {
  await mkdir(path.dirname(runtimeConfig.runtimeTargetPath), { recursive: true });

  if (await pathExists(runtimeConfig.runtimeTargetPath)) {
    return runtimeConfig.runtimeTargetPath;
  }

  await createEmptySqliteDatabase(runtimeConfig.runtimeTargetPath);
  return runtimeConfig.runtimeTargetPath;
}

export async function createDbTestTempDir(prefix: string) {
  return mkdtemp(path.join(os.tmpdir(), prefix));
}

export function createDbTestExecutionPath(
  tempDir: string,
  fileName: string,
  runtimeConfig: DbTestRuntimeConfig,
  contextLabel: string,
) {
  const dbPath = path.join(tempDir, fileName);
  assertDoesNotUseRuntimeDbPath(dbPath, runtimeConfig, contextLabel);
  return dbPath;
}

export async function createDbTestExecutionSandbox(options: {
  contextLabel: string;
  copyBaseDb?: boolean;
  dbFileName: string;
  runtimeConfig: DbTestRuntimeConfig;
  tempDirPrefix: string;
}) {
  const tempDir = await createDbTestTempDir(options.tempDirPrefix);
  const dbPath = createDbTestExecutionPath(
    tempDir,
    options.dbFileName,
    options.runtimeConfig,
    options.contextLabel,
  );

  if (options.copyBaseDb !== false) {
    const baseDbPath = await ensureDbTestBaseDatabase(options.runtimeConfig);
    await copyFile(baseDbPath, dbPath);
  }

  return {
    dbPath,
    tempDir,
  } satisfies DbTestExecutionSandbox;
}
