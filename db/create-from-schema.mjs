import { access, rm } from "node:fs/promises";
import path from "node:path";

import { applySqlDdl } from "./apply-sql-ddl.mjs";
import {
  openDatabaseFromPath,
  persistDatabaseToPath,
  writeCurrentSchemaName,
} from "./runtime-db-state.mjs";
import {
  defaultDevSqliteDbPath,
  defaultProdSqliteDbPath,
} from "./sqlite-db-paths.mjs";

const SUPPORTED_DB_TARGETS = ["dev", "prod", "proddev"];
const GENERATED_SQL_DDL_FILE_NAME = "schema.sql";
const GENERATED_SQL_DDL_DIR_NAME = "generated-sql-ddl";
const SCHEMA_FILE_NAME = "schema.ts";

function createUsageError() {
  return new Error(
    "Usage: node db/create-from-schema.mjs --on <dev|prod> --schema <schema-name> [--overwrite-existing]",
  );
}

function ensureNonEmptyValue(value, name) {
  if (!value || value.trim().length === 0) {
    throw new Error(`${name} must not be empty.`);
  }
}

function parseArgs(argv) {
  let dbTarget = null;
  let overwriteExisting = false;
  let schemaName = null;

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];

    if (argument === "--on" || argument === "--on-db") {
      dbTarget = argv[index + 1] ?? null;
    }

    if (argument === "--schema") {
      schemaName = argv[index + 1] ?? null;
    }

    if (argument === "--overwrite-existing") {
      overwriteExisting = true;
    }
  }

  return {
    dbTarget,
    overwriteExisting,
    schemaName,
  };
}

function ensureSupportedTarget(dbTarget) {
  if (!SUPPORTED_DB_TARGETS.includes(dbTarget)) {
    throw new Error(`--on must be one of: ${SUPPORTED_DB_TARGETS.join(", ")}`);
  }
}

function ensureCreateFromTargetAllowed(dbTarget) {
  if (dbTarget === "proddev") {
    throw new Error(
      [
        "db:createfrom does not support --on proddev.",
        "proddev is a migration sandbox derived from prod.",
        "Create prod explicitly first with `npm run db:createfrom -- --on prod --schema <schema-name>` if needed,",
        "then use `npm run db:migrate -- --on proddev --with <from>--<to>` to create the copied sandbox.",
      ].join(" "),
    );
  }
}

function resolveDbPath(projectRoot, candidatePath) {
  return path.resolve(projectRoot, candidatePath);
}

function createSchemaDirPath(projectRoot, schemaName) {
  return path.join(projectRoot, "db", schemaName);
}

function createSchemaFilePath(projectRoot, schemaName) {
  return path.join(createSchemaDirPath(projectRoot, schemaName), SCHEMA_FILE_NAME);
}

function createGeneratedSqlDdlFilePath(projectRoot, schemaName) {
  return path.join(
    createSchemaDirPath(projectRoot, schemaName),
    GENERATED_SQL_DDL_DIR_NAME,
    GENERATED_SQL_DDL_FILE_NAME,
  );
}

function resolveCreateFromTargetPath(projectRoot, dbTarget) {
  if (dbTarget === "dev") {
    return resolveDbPath(projectRoot, defaultDevSqliteDbPath);
  }

  return resolveDbPath(projectRoot, defaultProdSqliteDbPath);
}

async function pathExists(targetPath) {
  try {
    await access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function ensureSchemaSnapshotArtifactsExist(projectRoot, schemaName) {
  const schemaFilePath = createSchemaFilePath(projectRoot, schemaName);
  const generatedSqlFilePath = createGeneratedSqlDdlFilePath(projectRoot, schemaName);

  if (!await pathExists(schemaFilePath)) {
    throw new Error(`Missing schema.ts for schema ${schemaName}: ${schemaFilePath}`);
  }

  if (!await pathExists(generatedSqlFilePath)) {
    throw new Error(
      `Missing generated schema.sql for schema ${schemaName}: ${generatedSqlFilePath}`,
    );
  }
}

async function createDatabaseFromSchema({
  dbTarget,
  overwriteExisting = false,
  projectRoot = process.cwd(),
  schemaName,
}) {
  ensureSupportedTarget(dbTarget);
  ensureCreateFromTargetAllowed(dbTarget);
  ensureNonEmptyValue(schemaName, "Schema name");
  await ensureSchemaSnapshotArtifactsExist(projectRoot, schemaName);

  process.env.GGTC_DB_MIGRATION_TARGET = dbTarget;
  process.env.GGTC_DB_MIGRATION_SNAPSHOT_SUBDIR = schemaName;

  const targetDbPath = resolveCreateFromTargetPath(projectRoot, dbTarget);

  if (await pathExists(targetDbPath)) {
    if (!overwriteExisting) {
      throw new Error(
        `Target DB already exists at ${targetDbPath}. Re-run with --overwrite-existing to replace it.`,
      );
    }

    await rm(targetDbPath, { force: true });
  }

  await applySqlDdl(targetDbPath, schemaName, projectRoot);
  const db = await openDatabaseFromPath(targetDbPath);
  writeCurrentSchemaName(db, schemaName);
  await persistDatabaseToPath(targetDbPath, db);
  db.close();

  return {
    dbTarget,
    schemaName,
    targetDbPath,
  };
}

const parsedArgs = parseArgs(process.argv.slice(2));

if (import.meta.url === `file://${process.argv[1]}`) {
  if (!parsedArgs.dbTarget || !parsedArgs.schemaName) {
    throw createUsageError();
  }

  const result = await createDatabaseFromSchema({
    dbTarget: parsedArgs.dbTarget,
    overwriteExisting: parsedArgs.overwriteExisting,
    schemaName: parsedArgs.schemaName,
  });

  console.log(
    `Created ${result.dbTarget} DB for schema ${result.schemaName} at ${result.targetDbPath}.`,
  );
}

export {
  createDatabaseFromSchema,
  parseArgs as parseCreateFromArgs,
  resolveCreateFromTargetPath,
};
