import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import initSqlJs from "sql.js";
import { defaultDevSqliteDbPath } from "./sqlite-db-paths.mjs";

const config = JSON.parse(
  await readFile(new URL("./config.json", import.meta.url), "utf8"),
);

export const runtimeSqliteDbPath = path.resolve(
  process.cwd(),
  defaultDevSqliteDbPath,
);

export function getGeneratedSqlDdlDir(
  schemaVersion = config.activeSchemaVersion,
  projectRoot = process.cwd(),
) {
  return path.resolve(projectRoot, `db/${schemaVersion}/generated-sql-ddl`);
}

export function getGeneratedSqlDdlFilePath(
  schemaVersion = config.activeSchemaVersion,
  projectRoot = process.cwd(),
) {
  return path.join(getGeneratedSqlDdlDir(schemaVersion, projectRoot), "schema.sql");
}

export async function readGeneratedSqlStatements(
  schemaVersion = config.activeSchemaVersion,
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
  schemaVersion = config.activeSchemaVersion,
  projectRoot = process.cwd(),
) {
  const SQL = await initSqlJs();
  const db = new SQL.Database();
  const statements = await readGeneratedSqlStatements(schemaVersion, projectRoot);

  db.exec("PRAGMA foreign_keys = ON;");
  for (const statement of statements) {
    db.exec(statement);
  }

  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, Buffer.from(db.export()));
  db.close();

  return outputPath;
}
