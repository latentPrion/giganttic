# Design

## Purpose

Gigantt is a TypeScript-first project management system intended to evolve into
an application that turns conversations, documents, and other external inputs
into structured project artifacts such as Gantt charts and related views.

The current repository already contains a working auth/session backend slice and
a versioned database layer. The repository now also contains the first frontend
shell for session-aware header navigation. Frontend chart rendering, chart
storage, and Temporal workflows remain future work.

## Current Architecture

### Implemented Today

The repository currently contains:

- a NestJS backend under `backend/`
- a React frontend under `frontend/`
- a versioned Drizzle schema under `db/`
- generated Zod schemas derived from the active DB schema version
- generated full-schema SQLite DDL for the active DB schema version
- backend auth/session APIs for registration, login, session inspection, and
  session revocation
- a frontend header/navbar shell with login, registration, current-session
  lookup, and logout controls
- automated tests covering schema generation, SQLite DDL application, the root
  `db` facade, the auth/session API, and the frontend auth/session shell

### Not Yet Implemented

The repository does not yet contain:

- DHTMLX Gantt integration
- chart storage and chart-management APIs
- Temporal workers or workflows
- external ingestion integrations

## Core Architectural Decisions

### Language

All application code is TypeScript with strict type checking.

This includes:

- backend application code
- database schema definitions
- generated schema-facing TypeScript modules
- backend runtime validation contracts
- future frontend and workflow code

### Backend

The backend is implemented with NestJS and is designed to remain modular so it
can later be embedded under a larger parent application.

Current responsibilities:

- registration with username, email, and password
- login with opaque bearer session tokens
- current-session lookup
- active-session listing with role-aware authorization
- session revocation with role-aware authorization
- request and response validation with Zod
- DB bootstrap and seed-account initialization

Current route namespace:

- `/stc-proj-mgmt/api`

Current auth routes:

- `POST /stc-proj-mgmt/api/auth/register`
- `POST /stc-proj-mgmt/api/auth/login`
- `GET /stc-proj-mgmt/api/auth/session/me`
- `GET /stc-proj-mgmt/api/auth/session?userId=...`
- `POST /stc-proj-mgmt/api/auth/session/revoke`

### Database Layer

Drizzle is the source of truth for the persisted relational schema.

The repository uses:

- `db/<version>/schema.ts` as the canonical schema definition
- `db/<version>/generated-zod/` for version-specific generated Zod artifacts
- `db/<version>/generated-sql-ddl/schema.sql` for full-schema generated SQLite
  DDL
- `db/index.ts` as the schema-version-agnostic facade for the active schema

The active schema version is selected through `db/config.json`.

The current schema is documented in
[data-model.md](/media/latentprion/aafe96c9-7fcd-40ce-991d-ca2d23b5ba17/gits/gigantt-git/docs/data-model.md).

### Validation Strategy

Current validation ownership is:

- persisted schema and relations: Drizzle
- runtime request and response validation: Zod
- backend transport contracts: local TypeScript + Zod modules
- frontend transport contracts: local TypeScript + Zod modules

The backend validates request bodies and query parameters at the REST boundary
using Zod-backed Nest pipes.

The frontend validates auth/session REST responses with local Zod schemas before
response data is accepted into React state.

### Session Model

Current auth uses opaque bearer tokens.

Important rules:

- the raw bearer token is returned only to the client
- only a hash of the session token is stored in `Users_Sessions`
- sessions have `startTimestamp`, `expirationTimestamp`, `ipAddress`, optional
  `location`, and optional future-facing OAuth columns
- revoked or expired sessions are rejected by the auth guard
- admins may manage sessions for other users
- non-admins may query and revoke only their own sessions

### Seed Data

Backend bootstrap ensures the core auth lookup rows exist and seeds two local
test accounts for development and test use:

- `testadminuser`
- `testnoroleuser`

The admin test account is granted `GGTT_ROLE_ADMIN`.

## Current Module Layout

### Backend

Current backend structure:

- `backend/main.ts`
- `backend/app.module.ts`
- `backend/common/`
- `backend/config/`
- `backend/modules/auth/`
- `backend/modules/database/`

This is the actual implemented backend shape today.

### Database

Current DB structure is documented in
[data-model.md](/media/latentprion/aafe96c9-7fcd-40ce-991d-ca2d23b5ba17/gits/gigantt-git/docs/data-model.md).

At a high level:

- version-agnostic DB helpers live directly in `db/`
- version-specific schema code lives in `db/v1/`
- version-specific tests live in `db/v1/tests/`

### Tests

Current automated tests live in:

- `db/v1/tests/`
- `tests/`

The current integration suite verifies both the auth/session backend behavior
and the DB/schema generation path.

## Planned Architecture

### Frontend

The frontend is now a React SPA under `frontend/`.

Current responsibilities:

- render the application shell header/navbar
- host session-aware login, registration, current-session lookup, and logout UI
- validate auth REST payloads at the transport boundary with Zod before data
  enters frontend state

Planned future responsibilities:

- host DHTMLX Gantt
- render future project-management views
- communicate with the backend REST API

### Temporal

Temporal is still the intended workflow engine for future long-running and
integration-oriented processing.

Planned responsibilities:

- polling external systems
- recurring synchronization
- durable retries and orchestration
- long-running ingestion and enrichment pipelines

Temporal is not intended to own the DB schema or API validation model.

### Project and Chart Features

Still planned but not yet implemented:

- chart upload and listing APIs
- persisted project entities beyond auth
- DHTMLX Gantt-backed frontend rendering
- alternate project views such as Kanban or summaries
- external collaboration/document ingestion pipelines

## High-Level Principles

- Keep Drizzle as the persisted-schema source of truth.
- Keep schema versioning explicit through `db/<version>/`.
- Keep the root `db` import schema-version-agnostic.
- Keep backend modules self-contained and injectable.
- Keep REST inputs and outputs runtime-validated with Zod.
- Keep future frontend and workflow integrations aligned with the same typed
  contracts where practical.
