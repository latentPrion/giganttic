import { readFile } from "node:fs/promises";

import { applySqlDdl, runtimeSqliteDbPath } from "./apply-sql-ddl.mjs";
import {
  openDatabaseFromPath,
  persistDatabaseToPath,
  writeCurrentSchemaName,
} from "./runtime-db-state.mjs";

const config = JSON.parse(
  await readFile(new URL("./config.json", import.meta.url), "utf8"),
);

await applySqlDdl(runtimeSqliteDbPath, config.activeSchemaVersion);
const db = await openDatabaseFromPath(runtimeSqliteDbPath);
writeCurrentSchemaName(db, config.activeSchemaVersion);
await persistDatabaseToPath(runtimeSqliteDbPath, db);
db.close();

console.log(
  `Created SQLite database for schema ${config.activeSchemaVersion} at ${runtimeSqliteDbPath}`,
);
