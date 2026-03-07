# Design

## Purpose

This project is a TypeScript-first project management system that turns team/client conversations and documents into structured project artifacts, including Gantt charts and later Kanban-style views.

The system must support:

- Creating and uploading project chart documents
- Rendering DHTMLX Gantt charts in a browser SPA
- Selecting different frontend view modes
- Persisting project data with a centrally defined, type-safe schema
- Ingesting and processing external collaboration data over time
- Evolving toward a larger platform where this module can be embedded under a route namespace

## Core Architectural Decisions

### Language

All application code should be implemented in TypeScript.

This includes:

- frontend application code
- backend HTTP API code
- background workflow code
- shared domain types and schemas
- database schema definitions

Vendored third-party runtime assets may remain in their original formats.

### Frontend

The frontend is a single-page React application written in TypeScript.

Responsibilities:

- render the main application shell
- render the Gantt chart area
- provide controls for chart selection and upload
- provide a configurable backend storage-directory input for testing
- provide a tabset or segmented control to choose the current rendered view mode
- communicate with the backend REST API
- use shared typed DTOs and Zod schemas for transport objects

Preferred entry points:

- `frontend/src/main.tsx`
- `frontend/src/App.tsx`

### Backend

The backend is a TypeScript HTTP service with a modular structure suitable for future embedding in a larger application.

The backend should be implemented as a reusable module, not as an inseparable monolith.

Responsibilities:

- serve REST endpoints for project/chart management
- accept uploaded chart documents
- list existing charts from a configurable backend directory
- read and write chart JSON documents
- validate request and response payloads
- expose the frontend SPA in standalone mode
- support mounting the project-management routes under a namespace in a larger parent application

### Background Processing

The system should use Temporal for workflow orchestration and long-running asynchronous work.

Temporal is responsible for:

- polling external systems
- scheduling recurring syncs
- durable retries and backoff
- orchestration of multi-step ingestion pipelines
- recovery from worker or process restarts
- long-running conversation/document enrichment pipelines

Temporal is not the owner of the database schema or API schema.

## Recommended Stack

### Backend Framework

Recommended backend framework: NestJS

Reasoning:

- strong TypeScript ergonomics
- modular structure
- clear separation of controllers, services, and modules
- good long-term maintainability for a growing system
- suitable for reusable submodules mounted under a route namespace
- good fit for combining HTTP APIs with background-processing integrations

### Workflow Engine

Recommended workflow engine: Temporal

Reasoning:

- durable workflows
- reliable retries
- good fit for external polling and sync orchestration
- better suited than ad hoc cron jobs for ingestion pipelines

### Database Layer and Validation

The system uses Drizzle and Zod for end-to-end type safety.

- Drizzle is the canonical source of truth for the persisted database schema and relational data model.
- Zod is the canonical source of truth for runtime validation of request, response, and integration payloads.
- Shared DTOs and validation schemas should be defined once and reused across backend and frontend TypeScript code.
- Temporal workflows and activities should consume the same shared typed contracts, but Temporal is not the owner of the database schema.

In practice:

- database schema: Drizzle
- runtime API validation: Zod
- shared transport/domain contracts: shared TypeScript + Zod modules
- workflow orchestration: Temporal

## End-to-End Type Safety Strategy

The project should enforce type safety across the full stack.

### Canonical Ownership

- persisted relational schema is defined in Drizzle
- runtime API payload validation is defined in Zod
- shared DTOs are exported from shared TypeScript modules
- frontend consumes those same shared schemas and inferred types
- backend handlers validate incoming payloads with Zod before use
- Temporal workflows and activities consume the same shared contract types

### Goals

- avoid duplicated interface definitions across frontend and backend
- avoid unvalidated JSON crossing trust boundaries
- ensure data sent to the frontend is statically typed and runtime-validated
- keep schema evolution explicit and migration-backed

### Non-Goals

- Temporal is not used as an ORM
- ad hoc untyped request bodies are not acceptable
- frontend-only type definitions that diverge from backend contracts are not acceptable

## Namespacing and Embedding

The project-management API must be namespaced so it can later be mounted into a larger application.

Recommended namespace:

- `/stc-proj-mgmt`

The REST API should live under a nested API prefix such as:

- `/stc-proj-mgmt/api`

The backend module should be designed so that a higher-level application can register or mount it cleanly without rewriting route logic.

This means:

- avoid hard-coding global app assumptions
- keep the project-management module self-contained
- keep route registration modular
- keep configuration injectable

## Frontend UI Requirements

### Main Areas

The frontend should contain:

- a control panel for backend connectivity and chart actions
- a chart-selection area
- a main canvas area for rendering the current view
- a view-type tabset or segmented control

### Required Testing-Stage Controls

For early development and testing, the frontend must expose an input field where the user can configure the backend storage directory used for chart listing and upload.

That control is a temporary operational/testing feature, but it is intentionally part of the current design.

### View Selection

The frontend must expose a UI control that allows the user to choose which view type to render.

Initial supported modes:

- `grid-chart`
- `grid-only`
- `chart-only`

Future modes may include:

- `kanban`
- `timeline-summary`
- `document-context`

The view-selection state is frontend-owned UI state. It may later be persisted per project or per user.

## Gantt Integration

DHTMLX Gantt is currently the chart-rendering engine.

### Initial Integration Rules

- the frontend hosts a DHTMLX Gantt instance inside a stable DOM container
- the Gantt host element must remain mounted while view/data state changes
- empty-state UI should be rendered as an overlay or sibling, not by removing the Gantt host
- the frontend controls when chart data is parsed into the Gantt instance
- the frontend controls view-mode switching by updating Gantt configuration and layout state

### Data Expectations

Initial chart documents should contain:

- tasks
- links
- milestones where needed
- hierarchical task relationships
- grouping metadata where useful

Example concepts that should be supported in stored chart data:

- normal tasks
- milestone tasks
- subgroup or stream metadata
- progress state
- future custom metadata such as external sync identifiers

### Important Constraint

DHTMLX-specific UI concerns such as lightbox configuration are not the source of truth for the project data model.

The source of truth is the shared typed application model.

## Chart Storage Model

### Initial Storage Strategy

For early development, chart documents may be stored as JSON files in a configurable server-side directory.

The backend must support:

- listing available chart documents
- reading a selected chart document
- writing a new chart document
- uploading a chart JSON file
- switching the active storage directory for testing purposes

### Future Storage Strategy

File-backed chart storage is a transitional development-stage approach.

The long-term architecture should evolve toward persisted project entities in the database, where JSON file import/export becomes an integration feature rather than the primary source of truth.

## External Integration Goals

The long-term system is intended to integrate with external collaboration and document systems, including examples such as:

- Discord
- Gmail
- Slack
- Fireflies meeting transcripts
- Google Docs
- Google Meet related documents or metadata
- NotebookLM push/export workflows

These integrations should be modeled as ingestion pipelines that normalize external content into internal domain objects.

Likely normalized concepts include:

- conversation threads
- transcript excerpts
- decisions
- action items
- blockers
- milestones
- project updates
- inferred schedule changes

Those internal domain objects can then drive updates to project plans and chart views.

## Suggested High-Level Module Layout

### Frontend

Suggested frontend structure:

- `frontend/src/main.tsx`
- `frontend/src/App.tsx`
- `frontend/src/components/`
- `frontend/src/features/charts/`
- `frontend/src/features/views/`
- `frontend/src/lib/api/`
- `frontend/src/lib/gantt/`

### Backend

Suggested backend structure:

- `backend/main.ts`
- `backend/app.module.ts`
- `backend/modules/stc-proj-mgmt/`
- `backend/modules/charts/`
- `backend/modules/storage/`
- `backend/modules/integrations/`
- `backend/modules/documents/`

### Shared Contracts

Suggested shared structure:

- `packages/shared/src/schemas/`
- `packages/shared/src/contracts/`
- `packages/shared/src/domain/`

### Database

Suggested schema structure:

- `backend/db/schema/`
- `backend/db/migrations/`

### Temporal

Suggested workflow structure:

- `backend/temporal/workflows/`
- `backend/temporal/activities/`
- `backend/temporal/workers/`

## API Design Principles

- all request bodies must be validated with Zod
- all response shapes should correspond to shared contract types
- routes must stay namespaced under `/stc-proj-mgmt`
- the API should remain usable both in standalone mode and when embedded into a larger host app
- storage-directory overrides must be explicit and validated
- upload endpoints must validate file type and payload structure
- route handlers should be thin; business logic belongs in services

## Development Priorities

### Phase 1

- establish the TypeScript project structure
- stand up the React SPA
- stand up the namespaced backend API
- define shared Zod schemas and DTOs
- define initial Drizzle schema
- implement file-backed chart listing, reading, and upload
- render DHTMLX Gantt in the frontend
- expose a view-mode selector
- expose testing-stage storage-directory input

### Phase 2

- persist projects and chart metadata in the database
- add user/project identity concepts
- move from file-centric state toward database-backed state
- import/export chart JSON as an edge feature rather than the core data model
- add normalized document and conversation entities

### Phase 3

- add Temporal workers and workflows
- add integration adapters
- ingest external conversations and documents
- derive project updates from normalized records
- support richer planning and collaboration views, including Kanban

## Testing Expectations

The implementation should support:

- unit tests for schema validation and domain logic
- integration tests for API routes
- frontend tests for view switching and chart selection
- workflow tests for Temporal activities and orchestration logic
- migration discipline for schema changes
- typed contract tests across backend and frontend boundaries

## Summary

This system is a TypeScript-first project-management platform with:

- React on the frontend
- NestJS on the backend
- Drizzle as the canonical database schema layer
- Zod as the canonical runtime-validation and shared contract layer
- Temporal for durable asynchronous workflows
- DHTMLX Gantt as the initial chart-rendering engine
- namespaced routes under `/stc-proj-mgmt`
- a modular structure suitable for later embedding into a larger application
