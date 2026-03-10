# Database Migrations

Each direct `db/<schema-name>/` subdirectory containing `schema.ts` is treated as a
canonical schema snapshot, regardless of folder naming format.

Each schema snapshot directory should contain:

- `schema.ts`
- `generated-sql-ddl/schema.sql`
- `generated-drizzle-metadata/`

Migration directories follow the `<from-schema>--<to-schema>` naming rule and contain
the deliverables needed to move between those two named schema snapshots:

- `pre-structural-data-migration.sql`
- `drizzle-migrations.sql`
- `post-structural-data-migration.sql`
- `generated-drizzle-metadata/`

Use the explicit tooling commands to refresh these artifacts:

- `npm run db:generate:snapshot -- --schema <schema-name>`
- `npm run db:generate:migration -- --from <schema-name> --to <schema-name>`

The runtime DB facade only tracks the active schema version. Migration pair selection
is always explicit via `--from` and `--to`.
