import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";

import { defaultDevSqliteDbPath } from "./sqlite-db-paths.mjs";
import {
  executeSqlStatements,
  openDatabaseConnection,
} from "./native-sqlite.mjs";

export const runtimeSqliteDbPath = path.resolve(
  process.cwd(),
  defaultDevSqliteDbPath,
);

export function getGeneratedSqlDdlDir(
  schemaVersion,
  projectRoot = process.cwd(),
) {
  if (!schemaVersion) {
    throw new Error("schemaVersion is required.");
  }

  return path.resolve(projectRoot, `db/${schemaVersion}/generated-sql-ddl`);
}

export function getGeneratedSqlDdlFilePath(
  schemaVersion,
  projectRoot = process.cwd(),
) {
  return path.join(getGeneratedSqlDdlDir(schemaVersion, projectRoot), "schema.sql");
}

export async function readGeneratedSqlStatements(
  schemaVersion,
  projectRoot = process.cwd(),
) {
  const ddl = await readFile(getGeneratedSqlDdlFilePath(schemaVersion, projectRoot), "utf8");

  return ddl
    .split("--> statement-breakpoint")
    .map((statement) => statement.trim())
    .filter((statement) => statement.length > 0);
}

export async function applySqlDdl(
  outputPath = runtimeSqliteDbPath,
  schemaVersion,
  projectRoot = process.cwd(),
) {
  if (!schemaVersion) {
    throw new Error("schemaVersion is required.");
  }

  const statements = await readGeneratedSqlStatements(schemaVersion, projectRoot);

  await mkdir(path.dirname(outputPath), { recursive: true });
  const db = openDatabaseConnection(outputPath);

  try {
    executeSqlStatements(db, statements);
  } finally {
    db.close();
  }

  return outputPath;
}
