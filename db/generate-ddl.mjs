import { readFile, readdir, rename, rm } from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

import { getGeneratedSqlDdlDir } from "./apply-sql-ddl.mjs";

const execFileAsync = promisify(execFile);
const config = JSON.parse(
  await readFile(new URL("./config.json", import.meta.url), "utf8"),
);

const schemaVersion = config.activeSchemaVersion;
const schemaDir = path.resolve(process.cwd(), `db/${schemaVersion}`);
const outputDir = getGeneratedSqlDdlDir(schemaVersion);
const drizzleKitBin = path.resolve(
  process.cwd(),
  "node_modules/.bin/drizzle-kit",
);

await rm(outputDir, { recursive: true, force: true });

await execFileAsync(drizzleKitBin, [
  "generate",
  "--dialect",
  "sqlite",
  "--schema",
  path.join(schemaDir, "schema.ts"),
  "--out",
  outputDir,
], {
  cwd: process.cwd(),
  env: process.env,
});

const sqlFiles = (await readdir(outputDir))
  .filter((entry) => entry.endsWith(".sql"))
  .sort();

if (sqlFiles.length !== 1) {
  throw new Error(
    `Expected exactly one generated SQL file for ${schemaVersion}, found ${sqlFiles.length}.`,
  );
}

await rename(
  path.join(outputDir, sqlFiles[0]),
  path.join(outputDir, "schema.sql"),
);
await rm(path.join(outputDir, "meta"), { recursive: true, force: true });
