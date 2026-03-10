import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  generateMigration,
  generateSchemaSnapshot,
} from "../db/drizzle-tooling.mjs";

const PROJECT_ROOT = process.cwd();
const DB_ROOT = path.join(PROJECT_ROOT, "db");
const FROM_SCHEMA_NAME = "test-schema";
const TO_SCHEMA_NAME = "foobar-v6.7";

function createSchemaDirPath(schemaName: string): string {
  return path.join(DB_ROOT, schemaName);
}

function createMigrationDirPath(fromSchemaName: string, toSchemaName: string): string {
  return path.join(DB_ROOT, "migrations", `${fromSchemaName}--${toSchemaName}`);
}

function createSchemaSource(options: { includeDescriptionColumn: boolean }): string {
  const descriptionColumn = options.includeDescriptionColumn
    ? `,\n    description: text("description")`
    : "";

  return `import { sqliteTable, integer, text } from "drizzle-orm/sqlite-core";

export const widgets = sqliteTable("Widgets", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull()${descriptionColumn}
});
`;
}

async function writeSchemaSnapshotSource(
  schemaName: string,
  options: { includeDescriptionColumn: boolean },
) {
  const schemaDirPath = createSchemaDirPath(schemaName);

  await mkdir(schemaDirPath, { recursive: true });
  await writeFile(
    path.join(schemaDirPath, "schema.ts"),
    createSchemaSource(options),
  );
}

async function removeTestArtifacts() {
  await rm(createSchemaDirPath(FROM_SCHEMA_NAME), { force: true, recursive: true });
  await rm(createSchemaDirPath(TO_SCHEMA_NAME), { force: true, recursive: true });
  await rm(createMigrationDirPath(FROM_SCHEMA_NAME, TO_SCHEMA_NAME), {
    force: true,
    recursive: true,
  });
}

describe("db drizzle tooling", () => {
  afterEach(async () => {
    await removeTestArtifacts();
  });

  it("generates self-contained snapshot artifacts for arbitrary schema names idempotently", async () => {
    await writeSchemaSnapshotSource(FROM_SCHEMA_NAME, {
      includeDescriptionColumn: false,
    });

    await generateSchemaSnapshot({
      projectRoot: PROJECT_ROOT,
      schemaName: FROM_SCHEMA_NAME,
    });
    await generateSchemaSnapshot({
      projectRoot: PROJECT_ROOT,
      schemaName: FROM_SCHEMA_NAME,
    });

    const schemaDirPath = createSchemaDirPath(FROM_SCHEMA_NAME);
    const schemaSql = await readFile(
      path.join(schemaDirPath, "generated-sql-ddl", "schema.sql"),
      "utf8",
    );
    const journal = await readFile(
      path.join(schemaDirPath, "generated-drizzle-metadata", "_journal.json"),
      "utf8",
    );
    const snapshot = await readFile(
      path.join(schemaDirPath, "generated-drizzle-metadata", "0000_snapshot.json"),
      "utf8",
    );

    expect(schemaSql).toContain("CREATE TABLE `Widgets`");
    expect(journal).toContain("\"dialect\": \"sqlite\"");
    expect(snapshot).toContain("\"Widgets\"");
  });

  it("generates pairwise migration deliverables idempotently without mutating the from-schema snapshot metadata", async () => {
    await writeSchemaSnapshotSource(FROM_SCHEMA_NAME, {
      includeDescriptionColumn: false,
    });
    await writeSchemaSnapshotSource(TO_SCHEMA_NAME, {
      includeDescriptionColumn: true,
    });

    await generateSchemaSnapshot({
      projectRoot: PROJECT_ROOT,
      schemaName: FROM_SCHEMA_NAME,
    });
    await generateSchemaSnapshot({
      projectRoot: PROJECT_ROOT,
      schemaName: TO_SCHEMA_NAME,
    });

    const fromJournalPath = path.join(
      createSchemaDirPath(FROM_SCHEMA_NAME),
      "generated-drizzle-metadata",
      "_journal.json",
    );
    const beforeJournal = await readFile(fromJournalPath, "utf8");

    await generateMigration({
      fromSchemaName: FROM_SCHEMA_NAME,
      projectRoot: PROJECT_ROOT,
      toSchemaName: TO_SCHEMA_NAME,
    });

    const migrationDirPath = createMigrationDirPath(FROM_SCHEMA_NAME, TO_SCHEMA_NAME);
    const firstMigrationSql = await readFile(
      path.join(migrationDirPath, "drizzle-migrations.sql"),
      "utf8",
    );
    const afterFirstJournal = await readFile(fromJournalPath, "utf8");

    await generateMigration({
      fromSchemaName: FROM_SCHEMA_NAME,
      projectRoot: PROJECT_ROOT,
      toSchemaName: TO_SCHEMA_NAME,
    });

    const secondMigrationSql = await readFile(
      path.join(migrationDirPath, "drizzle-migrations.sql"),
      "utf8",
    );
    const prePlaceholder = await readFile(
      path.join(migrationDirPath, "pre-structural-data-migration.sql"),
      "utf8",
    );
    const postPlaceholder = await readFile(
      path.join(migrationDirPath, "post-structural-data-migration.sql"),
      "utf8",
    );
    const migrationJournal = await readFile(
      path.join(migrationDirPath, "generated-drizzle-metadata", "_journal.json"),
      "utf8",
    );

    expect(firstMigrationSql).toContain("ALTER TABLE `Widgets` ADD `description` text;");
    expect(secondMigrationSql).toBe(firstMigrationSql);
    expect(prePlaceholder).toContain("Reserved for hand-authored SQL");
    expect(postPlaceholder).toContain("Reserved for hand-authored SQL");
    expect(migrationJournal).toContain("\"dialect\": \"sqlite\"");
    expect(afterFirstJournal).toBe(beforeJournal);
  }, 20_000);

  it("fails clearly when the requested schema snapshot does not exist", async () => {
    await expect(generateSchemaSnapshot({
      projectRoot: PROJECT_ROOT,
      schemaName: FROM_SCHEMA_NAME,
    })).rejects.toThrow(/Missing schema\.ts/);
  });
});
