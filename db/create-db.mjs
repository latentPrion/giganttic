import { readFile } from "node:fs/promises";

import { applySqlDdl, runtimeSqliteDbPath } from "./apply-sql-ddl.mjs";

const config = JSON.parse(
  await readFile(new URL("./config.json", import.meta.url), "utf8"),
);

await applySqlDdl(runtimeSqliteDbPath, config.activeSchemaVersion);

console.log(
  `Created SQLite database for schema ${config.activeSchemaVersion} at ${runtimeSqliteDbPath}`,
);
