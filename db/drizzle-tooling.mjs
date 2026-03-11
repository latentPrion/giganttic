import { execFile, spawn } from "node:child_process";
import {
  access,
  copyFile,
  cp,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const DB_DIR_NAME = "db";
const DRIZZLE_GENERATED_METADATA_DIR_NAME = "generated-drizzle-metadata";
const DRIZZLE_MIGRATIONS_FILE_NAME = "drizzle-migrations.sql";
const DRIZZLE_MIGRATION_PLACEHOLDER_COMMENT =
  "-- Reserved for hand-authored SQL that runs before/after Drizzle-generated migrations.\n";
const DRIZZLE_SNAPSHOT_META_DIR_NAME = "meta";
const GENERATED_SQL_DDL_DIR_NAME = "generated-sql-ddl";
const POST_STRUCTURAL_DATA_MIGRATION_FILE_NAME =
  "post-structural-data-migration.sql";
const PRE_STRUCTURAL_DATA_MIGRATION_FILE_NAME =
  "pre-structural-data-migration.sql";
const SCHEMA_FILE_NAME = "schema.ts";
const SCHEMA_SQL_FILE_NAME = "schema.sql";
const SQLITE_DIALECT = "sqlite";
const TEMP_DIR_PREFIX = "giganttic-drizzle-tooling-";
function createPathError(message, targetPath) {
  return new Error(`${message}: ${targetPath}`);
}

function ensureSchemaNameIsSafe(schemaName) {
  if (schemaName.trim().length === 0) {
    throw new Error("Schema name must not be empty.");
  }

  if (path.basename(schemaName) !== schemaName) {
    throw new Error(`Schema name must be a direct db/ subdirectory name: ${schemaName}`);
  }

  if (schemaName === "." || schemaName === "..") {
    throw new Error(`Schema name is not valid: ${schemaName}`);
  }
}

function createDrizzleKitBinPath(projectRoot) {
  return path.resolve(projectRoot, "node_modules/.bin/drizzle-kit");
}

function createDbRoot(projectRoot) {
  return path.join(projectRoot, DB_DIR_NAME);
}

function createSchemaDir(projectRoot, schemaName) {
  ensureSchemaNameIsSafe(schemaName);
  return path.join(createDbRoot(projectRoot), schemaName);
}

function createSchemaFilePath(projectRoot, schemaName) {
  return path.join(createSchemaDir(projectRoot, schemaName), SCHEMA_FILE_NAME);
}

function createGeneratedSqlDdlDirPath(projectRoot, schemaName) {
  return path.join(
    createSchemaDir(projectRoot, schemaName),
    GENERATED_SQL_DDL_DIR_NAME,
  );
}

function createGeneratedMetadataDirPath(projectRoot, schemaName) {
  return path.join(
    createSchemaDir(projectRoot, schemaName),
    DRIZZLE_GENERATED_METADATA_DIR_NAME,
  );
}

function createMigrationDirPath(projectRoot, fromSchemaName, toSchemaName) {
  ensureSchemaNameIsSafe(fromSchemaName);
  ensureSchemaNameIsSafe(toSchemaName);

  return path.join(
    createDbRoot(projectRoot),
    "migrations",
    `${fromSchemaName}--${toSchemaName}`,
  );
}

function createRelativePath(projectRoot, targetPath) {
  return path.relative(projectRoot, targetPath).replaceAll(path.sep, "/");
}

async function ensurePathExists(targetPath, message) {
  try {
    await access(targetPath);
  } catch {
    throw createPathError(message, targetPath);
  }
}

async function createTempWorkdir(projectRoot, label) {
  const tempRoot = path.join(projectRoot, ".tmp");

  await mkdir(tempRoot, { recursive: true });
  return mkdtemp(path.join(tempRoot, `${TEMP_DIR_PREFIX}${label}-`));
}

async function listSqlFiles(targetDir) {
  const entries = await readdir(targetDir, { withFileTypes: true });

  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".sql"))
    .map((entry) => entry.name)
    .sort();
}

async function createSqlPlaceholderIfMissing(filePath) {
  try {
    await access(filePath);
  } catch {
    await writeFile(filePath, DRIZZLE_MIGRATION_PLACEHOLDER_COMMENT);
  }
}

async function runDrizzleGenerateNonInteractive(projectRoot, schemaFilePath, outDirPath) {
  const drizzleKitBin = createDrizzleKitBinPath(projectRoot);
  const args = [
    "generate",
    "--dialect",
    SQLITE_DIALECT,
    "--schema",
    createRelativePath(projectRoot, schemaFilePath),
    "--out",
    createRelativePath(projectRoot, outDirPath),
  ];

  return execFileAsync(drizzleKitBin, args, {
    cwd: projectRoot,
    env: process.env,
  });
}

function canUseInteractiveTty() {
  return Boolean(process.stdin.isTTY && process.stdout.isTTY && process.stderr.isTTY);
}

async function runDrizzleGenerateWithInheritedTty(projectRoot, schemaFilePath, outDirPath) {
  const drizzleKitBin = createDrizzleKitBinPath(projectRoot);
  const args = [
    "generate",
    "--dialect",
    SQLITE_DIALECT,
    "--schema",
    createRelativePath(projectRoot, schemaFilePath),
    "--out",
    createRelativePath(projectRoot, outDirPath),
  ];

  await new Promise((resolve, reject) => {
    const child = spawn(drizzleKitBin, args, {
      cwd: projectRoot,
      env: process.env,
      stdio: "inherit",
    });

    child.on("error", reject);
    child.on("exit", (code, signal) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(
        new Error(
          `drizzle-kit generate exited with code ${code ?? "unknown"}${signal ? ` (signal: ${signal})` : ""}.`,
        ),
      );
    });
  });
}

function shouldRetryWithTty(result) {
  const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;

  return output.includes("create table")
    || output.includes("rename table")
    || output.includes("no such file or directory")
    || output.includes("Is ");
}

async function ensureGeneratedSqlExists(targetDir) {
  const sqlFiles = await listSqlFiles(targetDir);

  if (sqlFiles.length === 0) {
    throw createPathError("Drizzle did not emit any SQL files", targetDir);
  }

  return sqlFiles;
}

async function runDrizzleGenerate(projectRoot, schemaFilePath, outDirPath) {
  if (canUseInteractiveTty()) {
    await runDrizzleGenerateWithInheritedTty(
      projectRoot,
      schemaFilePath,
      outDirPath,
    );
    await ensureGeneratedSqlExists(outDirPath);
    return;
  }

  let firstAttempt;

  try {
    firstAttempt = await runDrizzleGenerateNonInteractive(
      projectRoot,
      schemaFilePath,
      outDirPath,
    );
    const sqlFiles = await listSqlFiles(outDirPath);

    if (sqlFiles.length > 0) {
      return firstAttempt;
    }
  } catch (error) {
    firstAttempt = error;
  }

  if (!shouldRetryWithTty(firstAttempt ?? { stderr: "", stdout: "" })) {
    throw firstAttempt;
  }

  try {
    throw new Error(
      [
        "Unable to generate Drizzle migration diff non-interactively.",
        "The schema change likely triggered rename prompts.",
        "Run the same command from a real TTY so Drizzle can ask its interactive questions.",
      ].join(" "),
    );
  } catch (error) {
    throw error;
  }
}

async function copySqlFileToSchemaSnapshot(tempOutDir, destinationDir) {
  const sqlFiles = await ensureGeneratedSqlExists(tempOutDir);
  const latestSqlFileName = sqlFiles[sqlFiles.length - 1];

  await mkdir(destinationDir, { recursive: true });
  await copyFile(
    path.join(tempOutDir, latestSqlFileName),
    path.join(destinationDir, SCHEMA_SQL_FILE_NAME),
  );
}

async function copyMetaDir(sourceDir, destinationDir) {
  await rm(destinationDir, { recursive: true, force: true });
  await mkdir(path.dirname(destinationDir), { recursive: true });
  await cp(sourceDir, destinationDir, { recursive: true });
}

async function copyGeneratedMigrationSql(tempOutDir, destinationPath) {
  const sqlFiles = await ensureGeneratedSqlExists(tempOutDir);
  const contents = await Promise.all(
    sqlFiles.map(async (sqlFileName) =>
      readFile(path.join(tempOutDir, sqlFileName), "utf8")),
  );

  await writeFile(
    destinationPath,
    contents.join("\n\n"),
  );
}

async function seedMigrationWorkdirFromSnapshot(
  projectRoot,
  fromSchemaName,
  tempOutDir,
) {
  const sourceMetadataDir = createGeneratedMetadataDirPath(projectRoot, fromSchemaName);
  const targetMetadataDir = path.join(tempOutDir, DRIZZLE_SNAPSHOT_META_DIR_NAME);

  await ensurePathExists(
    sourceMetadataDir,
    "Missing Drizzle-generated metadata for schema snapshot",
  );
  await copyMetaDir(sourceMetadataDir, targetMetadataDir);
}

export async function generateSchemaSnapshot({
  projectRoot = process.cwd(),
  schemaName,
}) {
  const schemaFilePath = createSchemaFilePath(projectRoot, schemaName);
  const generatedSqlDirPath = createGeneratedSqlDdlDirPath(projectRoot, schemaName);
  const generatedMetadataDirPath = createGeneratedMetadataDirPath(projectRoot, schemaName);
  const tempOutDir = await createTempWorkdir(projectRoot, `snapshot-${schemaName}`);

  await ensurePathExists(schemaFilePath, "Missing schema.ts for schema snapshot");
  await rm(tempOutDir, { recursive: true, force: true });
  await mkdir(tempOutDir, { recursive: true });

  try {
    await runDrizzleGenerateNonInteractive(projectRoot, schemaFilePath, tempOutDir);
    await rm(generatedSqlDirPath, { recursive: true, force: true });
    await mkdir(generatedSqlDirPath, { recursive: true });
    await copySqlFileToSchemaSnapshot(tempOutDir, generatedSqlDirPath);
    await copyMetaDir(
      path.join(tempOutDir, DRIZZLE_SNAPSHOT_META_DIR_NAME),
      generatedMetadataDirPath,
    );
  } finally {
    await rm(tempOutDir, { recursive: true, force: true });
  }

  return {
    generatedMetadataDirPath,
    generatedSqlDirPath,
    schemaFilePath,
  };
}

export async function generateMigration({
  fromSchemaName,
  projectRoot = process.cwd(),
  toSchemaName,
}) {
  const fromSchemaFilePath = createSchemaFilePath(projectRoot, fromSchemaName);
  const toSchemaFilePath = createSchemaFilePath(projectRoot, toSchemaName);
  const migrationDirPath = createMigrationDirPath(
    projectRoot,
    fromSchemaName,
    toSchemaName,
  );
  const migrationMetadataDirPath = path.join(
    migrationDirPath,
    DRIZZLE_GENERATED_METADATA_DIR_NAME,
  );
  const drizzleMigrationFilePath = path.join(
    migrationDirPath,
    DRIZZLE_MIGRATIONS_FILE_NAME,
  );
  const preStructuralDataMigrationPath = path.join(
    migrationDirPath,
    PRE_STRUCTURAL_DATA_MIGRATION_FILE_NAME,
  );
  const postStructuralDataMigrationPath = path.join(
    migrationDirPath,
    POST_STRUCTURAL_DATA_MIGRATION_FILE_NAME,
  );
  const tempOutDir = await createTempWorkdir(
    projectRoot,
    `migration-${fromSchemaName}-${toSchemaName}`,
  );

  await ensurePathExists(
    fromSchemaFilePath,
    "Missing schema.ts for from-schema snapshot",
  );
  await ensurePathExists(
    toSchemaFilePath,
    "Missing schema.ts for to-schema snapshot",
  );

  await rm(tempOutDir, { recursive: true, force: true });
  await mkdir(tempOutDir, { recursive: true });

  try {
    await seedMigrationWorkdirFromSnapshot(projectRoot, fromSchemaName, tempOutDir);
    await runDrizzleGenerate(projectRoot, toSchemaFilePath, tempOutDir);
    await mkdir(migrationDirPath, { recursive: true });
    await copyGeneratedMigrationSql(tempOutDir, drizzleMigrationFilePath);
    await copyMetaDir(
      path.join(tempOutDir, DRIZZLE_SNAPSHOT_META_DIR_NAME),
      migrationMetadataDirPath,
    );
    await createSqlPlaceholderIfMissing(preStructuralDataMigrationPath);
    await createSqlPlaceholderIfMissing(postStructuralDataMigrationPath);
  } finally {
    await rm(tempOutDir, { recursive: true, force: true });
  }

  return {
    drizzleMigrationFilePath,
    migrationDirPath,
    migrationMetadataDirPath,
    postStructuralDataMigrationPath,
    preStructuralDataMigrationPath,
  };
}
