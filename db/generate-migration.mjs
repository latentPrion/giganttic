import { generateMigration } from "./drizzle-tooling.mjs";

function parseMigrationArgs(argv) {
  let fromSchemaName = null;
  let toSchemaName = null;

  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === "--from") {
      fromSchemaName = argv[index + 1] ?? null;
    }
    if (argv[index] === "--to") {
      toSchemaName = argv[index + 1] ?? null;
    }
  }

  return {
    fromSchemaName,
    toSchemaName,
  };
}

const {
  fromSchemaName,
  toSchemaName,
} = parseMigrationArgs(process.argv.slice(2));

if (!fromSchemaName || !toSchemaName) {
  throw new Error(
    "Usage: node db/generate-migration.mjs --from <schema-name> --to <schema-name>",
  );
}

process.env.GGTC_DB_SCHEMA_MIGRATION_SUBDIR_FROM = fromSchemaName;
process.env.GGTC_DB_SCHEMA_MIGRATION_SUBDIR_TO = toSchemaName;

await generateMigration({
  fromSchemaName,
  toSchemaName,
});

console.log(`Generated migration deliverable for ${fromSchemaName}--${toSchemaName}.`);
