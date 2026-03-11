import { createMaintenanceContext } from "./backend-maintenance-context.mjs";
import { resolveDbTargetPaths } from "./migrate.mjs";
import {
  openDatabaseFromPath,
  persistDatabaseToPath,
} from "./runtime-db-state.mjs";
import {
  hasSeededTestData,
  purgeSeededTestData,
} from "./sqlite-test-data-manager.mjs";

const SUPPORTED_DB_TARGETS = ["dev", "proddev", "prod"];
const SUPPORTED_MODES = ["ensure", "purge", "status"];

function createUsageError() {
  return new Error(
    "Usage: node db/test-data.mjs --mode <ensure|purge|status> --on <dev|proddev|prod>",
  );
}

function parseArgs(argv) {
  let dbTarget = null;
  let mode = null;

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];

    if (argument === "--mode") {
      mode = argv[index + 1] ?? null;
    }

    if (argument === "--on" || argument === "--on-db") {
      dbTarget = argv[index + 1] ?? null;
    }
  }

  return {
    dbTarget,
    mode,
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

function createMaintenanceConfig(targetDbPath) {
  return {
    createDbIfMissing: false,
    dbPath: targetDbPath,
    ensureReferenceData: false,
    failIfTestDataPresent: false,
    port: 0,
    seedTestAccounts: false,
  };
}

async function ensureManagedTestData(targetDbPath, env) {
  const appContext = await createMaintenanceContext(
    {
      ...createMaintenanceConfig(targetDbPath),
      seedTestAccounts: true,
    },
    env,
  );

  try {
    return { present: true };
  } finally {
    await appContext.close();
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
  env = process.env,
  mode,
  projectRoot = process.cwd(),
}) {
  ensureSupportedMode(mode);
  ensureSupportedTarget(dbTarget);
  process.env.GGTC_DB_MIGRATION_TARGET = dbTarget;

  const {
    targetDbPath,
  } = resolveDbTargetPaths(projectRoot, dbTarget, "test-data");
  if (mode === "ensure") {
    return {
      mode,
      targetDbPath,
      ...(await ensureManagedTestData(targetDbPath, env)),
    };
  }

  if (mode === "purge") {
    return {
      mode,
      targetDbPath,
      ...(await purgeManagedTestData(targetDbPath)),
    };
  }

  return {
    mode,
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
  });
  console.log(
    `Test data mode ${result.mode} completed for ${result.targetDbPath}; present=${String(result.present)}.`,
  );
}

export {
  manageTestData,
};
