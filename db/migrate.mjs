import path from "node:path";
import {
  access,
  copyFile,
  mkdir,
  readFile,
} from "node:fs/promises";

import {
  createMigrationChecksum,
  openDatabaseFromPath,
  readCurrentSchemaName,
  recordAppliedMigration,
  writeCurrentSchemaName,
} from "./runtime-db-state.mjs";
import {
  DRIZZLE_MIGRATIONS_FILE_NAME,
  POST_STRUCTURAL_DATA_MIGRATION_FILE_NAME,
  PRE_STRUCTURAL_DATA_MIGRATION_FILE_NAME,
} from "./migration-files.mjs";
import {
  defaultDevSqliteDbPath,
  defaultProddevSqliteDbPath,
  defaultProdSqliteDbPath,
} from "./sqlite-db-paths.mjs";

const MIGRATIONS_DIR_NAME = "migrations";
const SUPPORTED_DB_TARGETS = ["dev", "proddev", "prod"];

function createMigrationUsageError() {
  return new Error(
    "Usage: node db/migrate.mjs --on-db <dev|proddev|prod> --with-migration <from>--<to>",
  );
}

function ensureNonEmptyValue(value, name) {
  if (!value || value.trim().length === 0) {
    throw new Error(`${name} must not be empty.`);
  }
}

function ensureMigrationPairNameIsSafe(migrationPairName) {
  ensureNonEmptyValue(migrationPairName, "Migration pair");

  if (path.basename(migrationPairName) !== migrationPairName) {
    throw new Error(
      `Migration pair must match a direct db/migrations/ subdirectory name: ${migrationPairName}`,
    );
  }
}

function parseMigrationPairName(migrationPairName) {
  ensureMigrationPairNameIsSafe(migrationPairName);

  const separatorIndex = migrationPairName.indexOf("--");

  if (separatorIndex <= 0 || separatorIndex >= migrationPairName.length - 2) {
    throw new Error(
      `Migration pair must use the format <from>--<to>: ${migrationPairName}`,
    );
  }

  const fromSchemaName = migrationPairName.slice(0, separatorIndex);
  const toSchemaName = migrationPairName.slice(separatorIndex + 2);

  ensureNonEmptyValue(fromSchemaName, "From schema");
  ensureNonEmptyValue(toSchemaName, "To schema");

  return {
    fromSchemaName,
    toSchemaName,
  };
}

function parseMigrateArgs(argv) {
  let dbTarget = null;
  let migrationPairName = null;

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];

    if (argument === "--on-db" || argument === "--on") {
      dbTarget = argv[index + 1] ?? null;
    }

    if (argument === "--with-migration" || argument === "--with") {
      migrationPairName = argv[index + 1] ?? null;
    }
  }

  return {
    dbTarget,
    migrationPairName,
  };
}

function ensureDbTargetIsSupported(dbTarget) {
  if (!SUPPORTED_DB_TARGETS.includes(dbTarget)) {
    throw new Error(
      `--on-db/--on must be one of: ${SUPPORTED_DB_TARGETS.join(", ")}`,
    );
  }
}

function createMigrationDirPath(projectRoot, migrationPairName) {
  return path.join(projectRoot, "db", MIGRATIONS_DIR_NAME, migrationPairName);
}

function createMigrationFilePaths(projectRoot, migrationPairName) {
  const migrationDirPath = createMigrationDirPath(projectRoot, migrationPairName);

  return {
    drizzleMigrationsPath: path.join(
      migrationDirPath,
      DRIZZLE_MIGRATIONS_FILE_NAME,
    ),
    migrationDirPath,
    postStructuralPath: path.join(
      migrationDirPath,
      POST_STRUCTURAL_DATA_MIGRATION_FILE_NAME,
    ),
    preStructuralPath: path.join(
      migrationDirPath,
      PRE_STRUCTURAL_DATA_MIGRATION_FILE_NAME,
    ),
  };
}

async function ensurePathExists(targetPath, message) {
  try {
    await access(targetPath);
  } catch {
    throw new Error(`${message}: ${targetPath}`);
  }
}

function resolveDbPath(projectRoot, candidatePath) {
  return path.resolve(projectRoot, candidatePath);
}

function resolveDbTargetPaths(projectRoot, dbTarget, migrationPairName) {
  if (dbTarget === "dev") {
    return {
      sourceDbPath: null,
      targetDbPath: resolveDbPath(projectRoot, defaultDevSqliteDbPath),
    };
  }

  const prodDbPath = defaultProdSqliteDbPath;

  if (dbTarget === "prod") {
    return {
      sourceDbPath: null,
      targetDbPath: resolveDbPath(projectRoot, prodDbPath),
    };
  }

  return {
    sourceDbPath: resolveDbPath(projectRoot, prodDbPath),
    targetDbPath: resolveDbPath(projectRoot, defaultProddevSqliteDbPath),
  };
}

async function copyDbForProddev(sourceDbPath, targetDbPath) {
  await ensurePathExists(
    sourceDbPath,
    "Missing source DB for proddev migration dry-run",
  );
  await mkdir(path.dirname(targetDbPath), { recursive: true });
  await copyFile(sourceDbPath, targetDbPath);
}

async function readSqlFileStatements(filePath) {
  const sqlContents = await readFile(filePath, "utf8");
  return sqlContents.trim();
}

function executeSqlIfPresent(db, sqlContents) {
  if (sqlContents.trim().length === 0) {
    return;
  }

  db.exec(sqlContents);
}

async function applyMigrationFiles(db, migrationFilePaths) {
  const preStructuralSql = await readSqlFileStatements(
    migrationFilePaths.preStructuralPath,
  );
  const drizzleMigrationsSql = await readSqlFileStatements(
    migrationFilePaths.drizzleMigrationsPath,
  );
  const postStructuralSql = await readSqlFileStatements(
    migrationFilePaths.postStructuralPath,
  );

  executeSqlIfPresent(db, preStructuralSql);
  executeSqlIfPresent(db, drizzleMigrationsSql);
  executeSqlIfPresent(db, postStructuralSql);

  return new Map([
    [PRE_STRUCTURAL_DATA_MIGRATION_FILE_NAME, preStructuralSql],
    [DRIZZLE_MIGRATIONS_FILE_NAME, drizzleMigrationsSql],
    [POST_STRUCTURAL_DATA_MIGRATION_FILE_NAME, postStructuralSql],
  ]);
}

async function ensureMigrationFilesExist(migrationFilePaths) {
  await ensurePathExists(
    migrationFilePaths.migrationDirPath,
    "Missing migration directory",
  );
  await ensurePathExists(
    migrationFilePaths.preStructuralPath,
    "Missing pre-structural migration SQL",
  );
  await ensurePathExists(
    migrationFilePaths.drizzleMigrationsPath,
    "Missing Drizzle migration SQL",
  );
  await ensurePathExists(
    migrationFilePaths.postStructuralPath,
    "Missing post-structural migration SQL",
  );
}

async function applyMigrationToSqliteDatabase({
  fromSchemaName,
  migrationPairName,
  migrationFilePaths,
  targetDbPath,
  toSchemaName,
}) {
  await ensurePathExists(targetDbPath, "Missing target DB file");
  const db = await openDatabaseFromPath(targetDbPath);

  const currentSchemaName = readCurrentSchemaName(db);

  if (currentSchemaName !== fromSchemaName) {
    db.close();
    throw new Error(
      `Target DB schema state is ${currentSchemaName ?? "<unset>"} but migration expects ${fromSchemaName}.`,
    );
  }

  try {
    db.exec("BEGIN TRANSACTION;");
    const migrationContents = await applyMigrationFiles(db, migrationFilePaths);
    writeCurrentSchemaName(db, toSchemaName);
    recordAppliedMigration(db, {
      appliedAt: new Date().toISOString(),
      checksumSha256: createMigrationChecksum(migrationContents),
      fromSchemaName,
      migrationPairName,
      toSchemaName,
    });
    db.exec("COMMIT;");
  } catch (error) {
    try {
      db.exec("ROLLBACK;");
    } catch {
      // no-op
    }
    db.close();
    throw error;
  }

  db.close();
}

async function migrateDatabase({
  dbTarget,
  migrationPairName,
  projectRoot = process.cwd(),
}) {
  ensureDbTargetIsSupported(dbTarget);
  const {
    fromSchemaName,
    toSchemaName,
  } = parseMigrationPairName(migrationPairName);
  const migrationFilePaths = createMigrationFilePaths(projectRoot, migrationPairName);

  await ensureMigrationFilesExist(migrationFilePaths);

  process.env.GGTC_DB_MIGRATION_TARGET = dbTarget;
  process.env.GGTC_DB_MIGRATION_WITH_SUBDIR = migrationPairName;

  const {
    sourceDbPath,
    targetDbPath,
  } = resolveDbTargetPaths(projectRoot, dbTarget, migrationPairName);

  if (dbTarget === "proddev") {
    await copyDbForProddev(sourceDbPath, targetDbPath);
  }

  await applyMigrationToSqliteDatabase({
    fromSchemaName,
    migrationPairName,
    migrationFilePaths,
    targetDbPath,
    toSchemaName,
  });

  return {
    migrationPairName,
    targetDbPath,
  };
}

const parsedArgs = parseMigrateArgs(process.argv.slice(2));

if (import.meta.url === `file://${process.argv[1]}`) {
  if (!parsedArgs.dbTarget || !parsedArgs.migrationPairName) {
    throw createMigrationUsageError();
  }

  const result = await migrateDatabase({
    dbTarget: parsedArgs.dbTarget,
    migrationPairName: parsedArgs.migrationPairName,
  });

  console.log(
    `Applied migration ${result.migrationPairName} to ${result.targetDbPath}.`,
  );
}

export {
  migrateDatabase,
  parseMigrateArgs,
  parseMigrationPairName,
  resolveDbTargetPaths,
};
