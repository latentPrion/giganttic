# DB Schemas And Migration

## Purpose

This repository separates three concerns that must not be conflated:

- schema snapshots
- migration deliverables
- runtime/build configuration and DB maintenance

The core production safety rule is:

- application launch must not invent or generate migrations
- application launch must not wipe an existing production database
- reviewed migration packages under `db/migrations/` are the only supported input to DB schema upgrade commands

The configuration split is:

- `GGTC_DB_SCHEMA_*`
  - internal variables set by snapshot/diff generation commands from required CLI args
- `GGTC_DB_MIGRATION_*`
  - internal variables set by `db:createfrom`, `db:migrate`, and `db:prepare` from required CLI args
- `GGTC_DB_RT_*`
  - runtime/build variables for the app, taken from CLI first and otherwise from checked-in config values:
    - `CONFIG_GGTC_DB_RT_TARGET`
    - `CONFIG_GGTC_DB_RT_SCHEMA_SNAPSHOT_SUBDIR`

There is no `activeSchemaVersion` fallback anymore.

## Schema Snapshot Layout

Every direct schema subdirectory under `db/` is treated as a self-contained schema snapshot, regardless of naming convention.

Examples:

- `db/v2/`
- `db/foobar-v6.7/`
- `db/test-schema/`

A valid schema snapshot directory contains:

```text
db/<schema-name>/
  schema.ts
  generated-sql-ddl/
    schema.sql
  generated-drizzle-metadata/
    _journal.json
    ...snapshot metadata...
```

The meaning of each artifact:

- `schema.ts`
  - source-of-truth schema definition
- `generated-sql-ddl/schema.sql`
  - full SQL DDL snapshot for that schema
- `generated-drizzle-metadata/`
  - canonical Drizzle baseline metadata for that schema

`generated-drizzle-metadata/` is generated fresh from that schema's `schema.ts`. It is not a rolling workdir copied from another schema snapshot directory.

## Migration Deliverable Layout

Pairwise migrations live under:

```text
db/migrations/<from-schema>--<to-schema>/
```

Each deliverable contains:

```text
db/migrations/<from>--<to>/
  pre-structural-data-migration.sql
  drizzle-migrations.sql
  post-structural-data-migration.sql
  generated-drizzle-metadata/
```

The intended application order is:

1. `pre-structural-data-migration.sql`
2. `drizzle-migrations.sql`
3. `post-structural-data-migration.sql`

Notes:

- `pre-structural-data-migration.sql` is for hand-authored data prep that must happen before structural changes.
- `drizzle-migrations.sql` is the Drizzle-generated migration output for the explicit `<from> -> <to>` pair.
- `post-structural-data-migration.sql` is for hand-authored cleanup, backfill, or verification SQL after the Drizzle migration finishes.
- `generated-drizzle-metadata/` captures the metadata state produced while generating that migration deliverable.

## Snapshot Generation

Generate or refresh a canonical snapshot for a specific schema directory:

```bash
npm run db:generate:snapshot -- --schema <schema-name>
```

Example:

```bash
npm run db:generate:snapshot -- --schema v2
```

This command updates:

- `db/<schema-name>/generated-sql-ddl/schema.sql`
- `db/<schema-name>/generated-drizzle-metadata/`

## Migration Generation

Generate a migration deliverable from one schema snapshot to another:

```bash
npm run db:generate:migration -- --from <from-schema> --to <to-schema>
```

Example:

```bash
npm run db:generate:migration -- --from v1 --to v2
```

This command:

- reads canonical Drizzle metadata from `db/<from-schema>/generated-drizzle-metadata/`
- compares it against `db/<to-schema>/schema.ts`
- writes a migration deliverable into `db/migrations/<from-schema>--<to-schema>/`

This command is allowed to generate artifacts.

## Migration Application

Migration application is a separate command and must use an already-generated migration deliverable.

Command:

```bash
npm run db:migrate -- --on-db <dev|proddev|prod> --with-migration <from>--<to>
```

Shorthand aliases:

- `--on` is an alias for `--on-db`
- `--with` is an alias for `--with-migration`

Equivalent examples:

```bash
npm run db:migrate -- --on-db proddev --with-migration v1--v2
npm run db:migrate -- --on proddev --with v1--v2
```

Important discipline:

- `db:migrate` must not generate migrations
- `db:migrate` must only apply the explicit migration package it is pointed at
- the `--on`/`--with` values are mandatory CLI inputs
- the command does not read target or migration selection from env/config

### DB target modes

- `dev`
  - applies the selected migration package directly to the dev DB file
  - target DB path resolves to `run/giganttic-dev.sqlite`

- `proddev`
  - copies the configured prod DB to a local scratch DB first
  - applies the migration package to that copy
  - source DB path resolves to `run/giganttic-prod.sqlite`
  - scratch target resolves to `run/giganttic-proddev-<migration-pair>.sqlite`

- `prod`
  - applies the migration package directly to `run/giganttic-prod.sqlite`

### Current schema-state verification

The migration applicator refuses to run unless the target database already records the expected source schema.

The current implementation stores runtime schema state in the SQLite metadata table:

```text
_Giganttic_RuntimeMetadata
```

with key:

```text
schemaName
```

This allows `db:migrate` to verify:

- the selected DB is really on `<from-schema>`
- the migration package is appropriate for that DB

If the target DB reports a different schema name, migration aborts.

## Explicit DB Creation

Fresh DB creation is a separate command and must use an already-generated schema snapshot.

Command:

```bash
npm run db:createfrom -- --on <dev|prod> --schema <schema-name> [--overwrite-existing]
```

Notes:

- `db:createfrom` creates a brand-new DB directly from `db/<schema-name>/generated-sql-ddl/schema.sql`
- it writes runtime schema metadata so the new DB records `<schema-name>` as its current schema
- it refuses to overwrite an existing DB unless `--overwrite-existing` is explicitly passed
- it does not apply migrations
- it does not seed test data
- the `--on` and `--schema` values are mandatory CLI inputs
- it does not read DB target or schema selection from env/config

### Supported create targets

- `dev`
  - creates the dev DB directly
  - target DB path resolves to `run/giganttic-dev.sqlite`

- `prod`
  - creates the prod DB directly
  - target DB path resolves to `run/giganttic-prod.sqlite`

- `proddev`
  - intentionally unsupported for `db:createfrom`
  - `proddev` is defined as a migration sandbox copied from `prod`
  - create prod explicitly first if needed, then use `db:migrate -- --on proddev --with <from>--<to>`

## Recommended Operator Flow

### 1. Change the target schema

Edit:

```text
db/<to-schema>/schema.ts
```

### 2. Refresh the target snapshot

```bash
npm run db:generate:snapshot -- --schema <to-schema>
```

### 3. Generate the migration deliverable

```bash
npm run db:generate:migration -- --from <from-schema> --to <to-schema>
```

### 4. Review the migration package

Review at minimum:

- `db/migrations/<from>--<to>/drizzle-migrations.sql`
- `db/migrations/<from>--<to>/pre-structural-data-migration.sql`
- `db/migrations/<from>--<to>/post-structural-data-migration.sql`

### 5. If a fresh base DB is needed, create it explicitly

Examples:

```bash
npm run db:createfrom -- --on dev --schema <schema-name>
npm run db:createfrom -- --on prod --schema <schema-name>
```

### 6. Dry-run against a copied production DB

```bash
npm run db:migrate -- --on proddev --with <from-schema>--<to-schema>
```

### 7. Apply to production deliberately

```bash
npm run db:migrate -- --on prod --with <from-schema>--<to-schema>
```

### 8. Prepare the DB for runtime

`db:prepare` is a DB-maintenance command, not a migration generator:

```bash
npm run db:prepare -- --on <dev|proddev|prod>
```

It:

- verifies the selected DB exists
- verifies the selected DB's recorded schema matches the runtime schema selection
- reconciles immutable/reference data
- enforces test-data policy for the selected target

It does not:

- generate migrations
- apply migrations
- choose targets from env/config
- wipe the DB

## Test Data Management

Test data is a separate concern from schema snapshots and migrations.

The intended long-term separation is:

- immutable/reference data management
- test data management
- schema migration management

## Runtime Configuration

Runtime/build configuration is separate from schema tooling and migration actions.

The checked-in defaults live in `db/config.json`:

- `CONFIG_GGTC_DB_RT_TARGET`
- `CONFIG_GGTC_DB_RT_SCHEMA_SNAPSHOT_SUBDIR`

Runtime resolution order is:

1. CLI / process env values:
   - `GGTC_DB_RT_TARGET`
   - `GGTC_DB_RT_SCHEMA_SNAPSHOT_SUBDIR`
2. checked-in config values above

At runtime:

- `GGTC_DB_RT_TARGET` selects the DB instance/path the backend connects to
- `GGTC_DB_RT_SCHEMA_SNAPSHOT_SUBDIR` selects the schema snapshot/contract set the backend expects
- backend startup fails if the DB metadata schema name does not match `GGTC_DB_RT_SCHEMA_SNAPSHOT_SUBDIR`

Migration application must not:

- seed test data
- purge test data
- regenerate schema artifacts

Those should remain separate commands and policies.

## Production Safety Rules

These are the non-negotiable rules for production:

- production app launch must not wipe the DB
- production app launch must not generate migrations
- production app launch must not silently reseed test data
- production migration application must abort on any mismatch or SQL error
- migration packages must be reviewed before being applied upstream

## Current Scope

The current `db:migrate` implementation is intentionally narrow:

- SQLite-focused
- explicit migration-package application only
- no inference of migration paths
- no automatic generation during apply

That is by design.
