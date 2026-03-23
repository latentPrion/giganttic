# Design

## Purpose

Giganttic is a TypeScript-first project management system intended to evolve into
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

Backend bootstrap ensures the core auth lookup rows exist and seeds local
development and test accounts for manual testing and backend integration
coverage:

- `testadminuser`
- `testnoroleuser`
- `testorgorgmanageruser`
- `testorgprojectmanageruser`
- `testorgteammanageruser`
- `testprojectprojectmanageruser`
- `testteamprojectmanageruser`
- `testteamteammanageruser`

All seeded local accounts use plaintext password `1234`.

The seeded capability fixtures are:

- `testadminuser`: granted `GGTC_SYSTEMROLE_ADMIN`
- `testnoroleuser`: no scoped or system roles
- `testorgorgmanageruser`: seeded with `GGTC_ORGANIZATIONROLE_ORGANIZATION_MANAGER`
- `testorgprojectmanageruser`: seeded with
  `GGTC_ORGANIZATIONROLE_PROJECT_MANAGER`
- `testorgteammanageruser`: seeded with `GGTC_ORGANIZATIONROLE_TEAM_MANAGER`
- `testprojectprojectmanageruser`: seeded with
  `GGTC_PROJECTROLE_PROJECT_MANAGER`
- `testteamprojectmanageruser`: seeded with
  `GGTC_TEAMROLE_PROJECT_MANAGER`
- `testteamteammanageruser`: seeded with `GGTC_TEAMROLE_TEAM_MANAGER`

Backend bootstrap also seeds deterministic fixture entities used by those
accounts:

- organizations for the org-scoped role fixtures
- teams for the org-team-manager, team-project-manager, and team-team-manager
  fixtures
- projects for the org-project-manager, team-project-manager, and
  project-project-manager fixtures

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
- version-specific schema code lives in `db/<version>/`
- version-specific tests live in `db/<version>/tests/`

### Tests

Current automated tests live in:

- `db/v1/tests/`
- `db/v2/tests/`
- `tests/`

The current integration suite verifies both the auth/session backend behavior
and the DB/schema generation path.

## Planned Architecture

### Frontend

The frontend is now a React SPA under `frontend/`.

Current responsibilities:

- render the application shell header/navbar
- host session-aware login, registration, current-session lookup, and logout UI
- host the normal user lobby SPA for the current user's associated projects,
  teams, and organizations
- host authenticated project-manager routes at `/pm/project`,
  `/pm/project/gantt`, `/pm/project/issues`, and `/pm/project/issue`
- render reusable entity list items in the user lobby, with view-specific action
  affordances controlled by parent-selected render modes
- provide reusable project, team, and organization create, edit, and summary
  modal workflows in the user lobby
- validate auth REST payloads at the transport boundary with Zod before data
  enters frontend state

Planned future responsibilities:

- add a separate admin SPA for broad administrative discovery and management of
  entities outside the current user's normal associations
- expand the project-manager SPA beyond the initial gantt route

Current lobby interaction model:

- entity rows are reusable JSX list-item components
- parent views choose the row render mode, such as main listing vs narrower
  future views
- clicking a project row navigates to the project-manager project route
- team and organization summaries are opened from dedicated `View` action
  buttons until their entity routes are defined
- project, team, and organization create/edit actions are reusable button +
  modal flows
- delete actions for project, team, and organization rows are reusable button
  components in the main listing view
- user list-item/button scaffolding exists, but modal-backed user CRUD is still
  deferred until matching backend routes exist
- render future project-management views
- communicate with the backend REST API

Current project-manager SPA interaction model:

- `/pm/project` is authenticated-only and reuses the shared app shell/header
- the selected project is read from the `projectId` query parameter
- `/pm/project?projectId=...` shows the selected project entity in detail
- `/pm/project/gantt?projectId=...` shows the selected project's gantt chart
- the gantt view loads XML from `charts/<projectId>.xml`
- `/pm/project/issues?projectId=...` is authenticated-only and lists all
  issues for the selected project
- `/pm/project/issue?projectId=...&id=...` is authenticated-only and shows a
  single issue detail view
- PM issue routes use reusable `IssueListItem` rows together with reusable
  create, edit, delete, and open-detail issue buttons
- clicking an issue row navigates to the issue detail route
- issue summary modals are opened from the reusable `View` button
- all project-scoped PM pages show shared route-based navigation among detail,
  gantt, and issues
- the issue detail page renders a summary-preview row above a detailed issue
  card so edits can be previewed against the row presentation
- DHTMLX Gantt is loaded from the `dhtmlx-gantt/` git submodule rather than an
  npm package
- a hideable bottom `GanttChartControlPanel` hosts a tabset for `Both`, `Grid`,
  and `Chart` display modes
- GGTC task XML extensions (status, closed reason) and save-time enforcement vs
  load/listener enrichment: [gantt-chart-ggtc-extensions.md](./gantt-chart-ggtc-extensions.md)

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
