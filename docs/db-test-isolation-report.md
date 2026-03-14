# DB Test Isolation Report

This report lists the DB-affecting suites that use the shared runtime test target `run/giganttic-testsuite.sqlite` as their base while executing against temp copies for parallel safety.

## Suites That Need Per-Test Temp Copies

- `tests/db-createfrom.test.ts`
  - Validates DB creation and overwrite behavior.
  - Needs a fresh temp execution DB per test.

- `tests/db-migrate.test.ts`
  - Validates migration application, proddev copy behavior, and failure paths.
  - Needs a fresh temp execution DB per test.

- `tests/db-lifecycle.test.ts`
  - Validates lifecycle flows such as `createfrom -> migrate -> prepare`, plus test-data ensure/purge/status.
  - Needs a fresh temp execution DB per test.

- `tests/db-versioning.test.ts`
  - Simulates historical schema states and stale-runtime startup behavior.
  - Needs a fresh temp execution DB per test.

- `db/v1/tests/sqlite-ddl.test.ts`
  - Materializes the v1 schema from generated SQL and inspects the result.
  - Needs a fresh temp execution DB per test.

- `db/v2/tests/sqlite-ddl.test.ts`
  - Materializes the v2 schema from generated SQL and inspects the result.
  - Needs a fresh temp execution DB per test.

## Suites That Need Per-Suite Temp Copies

- `tests/backend-auth.test.ts`
  - Boots the backend against a seeded DB and exercises auth/session flows.
  - Needs one temp execution DB per suite.

- `tests/projects-crud.test.ts`
- `tests/teams-crud.test.ts`
- `tests/organizations-crud.test.ts`
- `tests/users-crud.test.ts`
- `tests/issues-crud.test.ts`
  - Backend integration suites that create and mutate application entities heavily.
  - Need one temp execution DB per suite.

## Suites That Do Not Need Their Own DB Files

- `tests/db-runtime-config.test.ts`
  - Config resolution only; no DB mutation.

- `tests/db-module.test.ts`
  - DB facade/type export checks only; no DB mutation.

- `db/v1/tests/schema.test.ts`
- `db/v2/tests/schema.test.ts`
  - Schema/type validation only; no persisted DB creation.

- `tests/db-drizzle-tooling.test.ts`
  - Requires isolated schema snapshot and migration artifact directories, but not isolated SQLite DB files.

## Policy

- All DB-affecting test runs use `GGTC_DB_RT_TARGET=run/giganttic-testsuite.sqlite`.
- The shared testsuite DB is a base file and must not be mutated directly by suites.
- Execution happens in temp copies so Vitest can keep parallelism without touching `dev`, `prod`, or `proddev`.
