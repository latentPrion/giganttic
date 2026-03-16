import { access } from "node:fs/promises";
import { resolveDbTargetPaths } from "./migrate.mjs";
import {
  openDatabaseFromPath,
  persistDatabaseToPath,
  readCurrentSchemaName,
} from "./runtime-db-state.mjs";
import {
  ensureSeededTestData,
  hasSeededTestData,
  purgeSeededTestData,
} from "./sqlite-test-data-manager.mjs";
import {
  SUPPORTED_TEST_DATA_PROFILES,
  TEST_DATA_PROFILE_APP,
} from "./test-data-seed-data.mjs";

const SUPPORTED_DB_TARGETS = ["dev", "proddev", "prod"];
const SUPPORTED_MODES = ["ensure", "purge", "status"];

function createUsageError() {
  return new Error(
    "Usage: node db/test-data.mjs --mode <ensure|purge|status> --on <dev|proddev|prod> [--profile <app|testsuite>]",
  );
}

function parseArgs(argv) {
  let dbTarget = null;
  let mode = null;
  let profile = TEST_DATA_PROFILE_APP;

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];

    if (argument === "--mode") {
      mode = argv[index + 1] ?? null;
    }

    if (argument === "--on" || argument === "--on-db") {
      dbTarget = argv[index + 1] ?? null;
    }

    if (argument === "--profile") {
      profile = argv[index + 1] ?? null;
    }
  }

  return {
    dbTarget,
    mode,
    profile,
  };
}

function ensureSupportedTarget(dbTarget) {
  if (!SUPPORTED_DB_TARGETS.includes(dbTarget)) {
    throw new Error(`--on must be one of: ${SUPPORTED_DB_TARGETS.join(", ")}`);
  }
}

function ensureSupportedMode(mode) {
  if (!SUPPORTED_MODES.includes(mode)) {
    throw new Error(`--mode must be one of: ${SUPPORTED_MODES.join(", ")}`);
  }
}

function ensureSupportedProfile(profile) {
  if (!SUPPORTED_TEST_DATA_PROFILES.includes(profile)) {
    throw new Error(
      `--profile must be one of: ${SUPPORTED_TEST_DATA_PROFILES.join(", ")}`,
    );
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

async function ensureManagedTestData(targetDbPath, profile) {
  const db = await openDatabaseFromPath(targetDbPath);

  try {
    const schemaName = readCurrentSchemaName(db);

    if (schemaName === null) {
      throw new Error(`DB at ${targetDbPath} has no recorded schema name.`);
    }

    ensureSeededTestData(db, schemaName, profile);
    await persistDatabaseToPath(targetDbPath, db);
    return { present: true, profile };
  } finally {
    db.close();
  }
}

async function readManagedTestDataStatus(targetDbPath) {
  const db = await openDatabaseFromPath(targetDbPath);

  try {
    return { present: hasSeededTestData(db) };
  } finally {
    db.close();
  }
}

async function purgeManagedTestData(targetDbPath) {
  const db = await openDatabaseFromPath(targetDbPath);

  try {
    purgeSeededTestData(db);
    await persistDatabaseToPath(targetDbPath, db);
  } finally {
    db.close();
  }

  return { present: false };
}

async function manageTestData({
  dbTarget,
  mode,
  profile = TEST_DATA_PROFILE_APP,
  projectRoot = process.cwd(),
}) {
  ensureSupportedMode(mode);
  ensureSupportedTarget(dbTarget);
  ensureSupportedProfile(profile);
  process.env.GGTC_DB_MIGRATION_TARGET = dbTarget;

  const {
    targetDbPath,
  } = resolveDbTargetPaths(projectRoot, dbTarget, "test-data");

  if (!await pathExists(targetDbPath)) {
    throw new Error(`Missing DB for test-data target ${dbTarget}: ${targetDbPath}`);
  }

  if (mode === "ensure") {
    return {
      mode,
      profile,
      targetDbPath,
      ...(await ensureManagedTestData(targetDbPath, profile)),
    };
  }

  if (mode === "purge") {
    return {
      mode,
      profile,
      targetDbPath,
      ...(await purgeManagedTestData(targetDbPath)),
    };
  }

  return {
    mode,
    profile,
    targetDbPath,
    ...(await readManagedTestDataStatus(targetDbPath)),
  };
}

const parsedArgs = parseArgs(process.argv.slice(2));

if (import.meta.url === `file://${process.argv[1]}`) {
  if (!parsedArgs.mode || !parsedArgs.dbTarget) {
    throw createUsageError();
  }

  const result = await manageTestData({
    dbTarget: parsedArgs.dbTarget,
      mode: parsedArgs.mode,
      profile: parsedArgs.profile,
    });
  console.log(
    `Test data mode ${result.mode} completed for ${result.targetDbPath}; profile=${result.profile}; present=${String(result.present)}.`,
  );
}

export {
  manageTestData,
};
