import { applySqlDdl } from "../db/apply-sql-ddl.mjs";
import {
  openDatabaseFromPath,
  writeCurrentSchemaName,
} from "../db/runtime-db-state.mjs";
import { ensureReferenceData } from "../db/sqlite-reference-data-manager.mjs";
import { ensureSeededTestData } from "../db/sqlite-test-data-manager.mjs";
import { TEST_DATA_PROFILE_TESTSUITE } from "../db/test-data-seed-data.mjs";

interface SeedExecutionDatabaseOptions {
  dbPath: string;
  includeTestData: boolean;
  schemaName: string;
}

export async function seedExecutionDatabase({
  dbPath,
  includeTestData,
  schemaName,
}: SeedExecutionDatabaseOptions) {
  await applySqlDdl(dbPath, schemaName);

  const db = await openDatabaseFromPath(dbPath);

  try {
    writeCurrentSchemaName(db, schemaName);
    ensureReferenceData(db, schemaName);

    if (includeTestData) {
      ensureSeededTestData(db, schemaName, TEST_DATA_PROFILE_TESTSUITE);
    }
  } finally {
    db.close();
  }
}
