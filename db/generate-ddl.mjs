import { generateSchemaSnapshot } from "./drizzle-tooling.mjs";

function parseSchemaNameFromArgs(argv) {
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === "--schema") {
      return argv[index + 1] ?? null;
    }
  }

  return null;
}

const schemaName = parseSchemaNameFromArgs(process.argv.slice(2));

if (!schemaName) {
  throw new Error("Usage: node db/generate-ddl.mjs --schema <schema-name>");
}

process.env.GGTC_DB_SCHEMA_SNAPSHOT_SUBDIR = schemaName;

await generateSchemaSnapshot({
  schemaName,
});

console.log(`Generated schema snapshot artifacts for ${schemaName}.`);
