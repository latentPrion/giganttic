import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import initSqlJs from "sql.js";

const config = JSON.parse(
  await readFile(new URL("./config.json", import.meta.url), "utf8"),
);

export const runtimeSqliteDbPath = path.resolve(
  process.cwd(),
  "run/giganttic.sqlite",
);

export function getGeneratedSqlDdlDir(
  schemaVersion = config.activeSchemaVersion,
) {
  return path.resolve(process.cwd(), `db/${schemaVersion}/generated-sql-ddl`);
}

export function getGeneratedSqlDdlFilePath(
  schemaVersion = config.activeSchemaVersion,
) {
  return path.join(getGeneratedSqlDdlDir(schemaVersion), "schema.sql");
}

export async function readGeneratedSqlStatements(
  schemaVersion = config.activeSchemaVersion,
) {
  const ddl = await readFile(getGeneratedSqlDdlFilePath(schemaVersion), "utf8");

  return ddl
    .split("--> statement-breakpoint")
    .map((statement) => statement.trim())
    .filter((statement) => statement.length > 0);
}

export async function applySqlDdl(
  outputPath = runtimeSqliteDbPath,
  schemaVersion = config.activeSchemaVersion,
) {
  const SQL = await initSqlJs();
  const db = new SQL.Database();
  const statements = await readGeneratedSqlStatements(schemaVersion);

  db.exec("PRAGMA foreign_keys = ON;");
  for (const statement of statements) {
    db.exec(statement);
  }

  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, Buffer.from(db.export()));
  db.close();

  return outputPath;
}
