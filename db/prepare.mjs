import { access } from "node:fs/promises";

import { createMaintenanceContext } from "./backend-maintenance-context.mjs";
import { applySqlDdl } from "./apply-sql-ddl.mjs";
import { resolveDbTargetPaths } from "./migrate.mjs";
import {
  openDatabaseFromPath,
  persistDatabaseToPath,
  readCurrentSchemaName,
  writeCurrentSchemaName,
} from "./runtime-db-state.mjs";
import { resolveRuntimeSchemaSnapshotSubdir } from "./runtime-config.mjs";
import { hasSeededTestData } from "./sqlite-test-data-manager.mjs";

const SUPPORTED_DB_TARGETS = ["dev", "proddev", "prod"];

function createUsageError() {
  return new Error(
    "Usage: node db/prepare.mjs --on <dev|proddev|prod>",
  );
}

function parseArgs(argv) {
  let dbTarget = null;

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--on" || argument === "--on-db") {
      dbTarget = argv[index + 1] ?? null;
    }
  }

  return { dbTarget };
}

function ensureSupportedTarget(dbTarget) {
  if (!SUPPORTED_DB_TARGETS.includes(dbTarget)) {
    throw new Error(`--on must be one of: ${SUPPORTED_DB_TARGETS.join(", ")}`);
  }
}

async function pathExists(targetPath) {
  try {
    await access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function initializeDevDatabaseIfMissing(targetDbPath, schemaName) {
  const dbExists = await pathExists(targetDbPath);

  if (dbExists) {
    return;
  }

  await applySqlDdl(targetDbPath, schemaName);
  const db = await openDatabaseFromPath(targetDbPath);
  writeCurrentSchemaName(db, schemaName);
  await persistDatabaseToPath(targetDbPath, db);
  db.close();
}

async function verifySchemaState(targetDbPath, expectedSchemaName) {
  const db = await openDatabaseFromPath(targetDbPath);
  const schemaName = readCurrentSchemaName(db);
  db.close();

  if (schemaName !== expectedSchemaName) {
    throw new Error(
      `DB at ${targetDbPath} is on schema ${schemaName ?? "<unset>"} but runtime schema is ${expectedSchemaName}.`,
    );
  }
}

function createMaintenanceConfig(dbTarget, targetDbPath) {
  return {
    createDbIfMissing: false,
    dbPath: targetDbPath,
    ensureReferenceData: true,
    failIfTestDataPresent: dbTarget === "prod",
    port: 0,
    seedTestAccounts: dbTarget === "dev",
  };
}

async function ensureProdHasNoTestData(targetDbPath) {
  const db = await openDatabaseFromPath(targetDbPath);

  try {
    if (hasSeededTestData(db)) {
      throw new Error("Test data is present but forbidden in prod mode.");
    }
  } finally {
    db.close();
  }
}

async function prepareDatabase({
  dbTarget,
  projectRoot = process.cwd(),
}) {
  ensureSupportedTarget(dbTarget);
  process.env.GGTC_DB_MIGRATION_TARGET = dbTarget;

  const runtimeSchemaSnapshotSubdir = await resolveRuntimeSchemaSnapshotSubdir(
    process.env,
  );
  const {
    targetDbPath,
  } = resolveDbTargetPaths(projectRoot, dbTarget, "prepare");

  if (dbTarget === "dev") {
    await initializeDevDatabaseIfMissing(
      targetDbPath,
      runtimeSchemaSnapshotSubdir,
    );
  }

  if (!await pathExists(targetDbPath)) {
    throw new Error(`Missing DB for prepare target ${dbTarget}: ${targetDbPath}`);
  }

  await verifySchemaState(targetDbPath, runtimeSchemaSnapshotSubdir);

  const appContext = await createMaintenanceContext(
    createMaintenanceConfig(dbTarget, targetDbPath),
    process.env,
  );

  try {
    if (dbTarget === "prod") {
      await ensureProdHasNoTestData(targetDbPath);
    }
  } finally {
    await appContext.close();
  }

  return {
    dbTarget,
    runtimeSchemaSnapshotSubdir,
    targetDbPath,
  };
}

const parsedArgs = parseArgs(process.argv.slice(2));

if (import.meta.url === `file://${process.argv[1]}`) {
  if (!parsedArgs.dbTarget) {
    throw createUsageError();
  }

  const result = await prepareDatabase({
    dbTarget: parsedArgs.dbTarget,
  });
  console.log(`Prepared ${result.dbTarget} DB at ${result.targetDbPath}.`);
}

export {
  prepareDatabase,
};
