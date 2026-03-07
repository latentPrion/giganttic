import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

import initSqlJs from "sql.js";

const config = JSON.parse(
  await readFile(new URL("./config.json", import.meta.url), "utf8"),
);

export const runtimeSqliteDbPath = path.resolve(
  process.cwd(),
  "run/gigantt.sqlite",
);

export function getGeneratedSqlDdlDir(
  schemaVersion = config.activeSchemaVersion,
) {
  return path.resolve(process.cwd(), `db/${schemaVersion}/generated-sql-ddl`);
}

export async function readGeneratedSqlStatements(
  schemaVersion = config.activeSchemaVersion,
) {
  const generatedSqlDdlDir = getGeneratedSqlDdlDir(schemaVersion);
  const files = (await readdir(generatedSqlDdlDir))
    .filter((entry) => entry.endsWith(".sql"))
    .sort();

  const statements = [];

  for (const file of files) {
    const ddl = await readFile(path.join(generatedSqlDdlDir, file), "utf8");

    statements.push(
      ...ddl
        .split("--> statement-breakpoint")
        .map((statement) => statement.trim())
        .filter((statement) => statement.length > 0),
    );
  }

  return statements;
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
