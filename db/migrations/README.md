# Database Migrations

`db/v1/schema.ts` is the canonical source of truth for the current persisted model.
Version-specific schema DDL should be generated into that schema version's
`generated-sql-ddl/` directory rather than hand-written here.

Migration directories follow the `<from-schema>--<to-schema>` naming rule. The repository includes:

- `v1--v2/` as the placeholder for the next schema transition

Future migration directories should contain all SQL and helper assets required to move between those two named schema versions.
