# Gantt Workspace Design

## Summary

This project is intended to become a small web application for creating, uploading, browsing, and rendering Gantt chart documents. The system has two main parts:

- a single-page React frontend implemented in TypeScript
- a Node.js backend implemented in TypeScript and built around Fastify, exposed as a reusable route plugin

The backend is designed so its project-management routes can either run standalone or be mounted into a larger Fastify application under a namespace such as `/stc-proj-mgmt/api`.

The frontend is designed to work against that namespaced REST API and to use the DHTMLX Gantt library as the chart renderer.

Type safety is a design goal. Shared shapes such as chart documents, task records, backend config payloads, chart list items, and create/upload request bodies should be modeled with explicit TypeScript types.

## Top-Level Architecture

The target project layout is:

```text
/
  docs/
    design.md
  frontend/
    index.html
    frontend.css
    src/
      main.tsx
    dist/
      app.js
  plugins/
    stc-proj-mgmt-routes.ts
  charts/
    welcome-chart.json
  app.ts
  server.ts
  build.mjs
  package.json
  gantt-git/
    codebase/
      dhtmlxgantt.js
      dhtmlxgantt.css
      ...
```

Responsibilities:

- `frontend/` contains the browser UI
- `plugins/stc-proj-mgmt-routes.ts` contains reusable Fastify route registration plus chart-storage logic
- `app.ts` creates the standalone Fastify app by combining static serving and the plugin
- `server.ts` is a thin bootstrap entrypoint
- `charts/` is the default backend-relative storage directory for chart JSON files
- `gantt-git/codebase/` remains the source of the DHTMLX runtime assets

## Frontend Design

The frontend should be a React SPA written in TypeScript with one primary shell:

- left control panel / sidebar
- main rendering stage

The control panel should provide:

- a text input for the backend storage subdirectory
- an apply/save action for that directory
- a list of available chart files returned by the backend
- an action to create a new sample chart
- an action to upload a chart JSON file
- a view-type tabset for renderer modes

The rendering stage should provide:

- a permanently mounted DHTMLX Gantt host element
- empty-state UI as an overlay, never as a replacement for the host node
- a header showing the selected chart name and active view mode

### Frontend View Modes

The UI should expose a tabset with these modes:

- `Grid + Chart`
- `Chart Only`
- `Grid Only`

These modes should drive DHTMLX config, not separate renderers:

- `show_grid`
- `show_chart`
- `grid_width`
- `resetLayout()`

When switching modes:

- the grid host must not be conditionally mounted/unmounted
- the grid width must be explicitly reset when returning from `Grid Only` to `Grid + Chart`
- the app should reuse one DHTMLX instance and update it incrementally

### Frontend Data Flow

On startup:

1. fetch backend config
2. fetch chart list for the configured storage directory
3. auto-load the first chart if one exists
4. initialize DHTMLX against the mounted host
5. apply the selected view mode and parse the loaded chart

When no charts exist:

- keep the host mounted
- show an overlay explaining that no charts are loaded yet

When a chart is selected, created, or uploaded:

- refresh the chart list
- load the selected file
- call `gantt.clearAll()` and `gantt.parse(chart)`

### Frontend Typing Expectations

The frontend should define explicit types for at least:

- chart document
- task record
- link record
- chart list response
- chart config response
- view-mode option
- create/upload request payloads

The React app should not rely on untyped `any` state for API responses.

## Backend Design

The backend should be implemented in TypeScript and should center on a reusable Fastify plugin, for example:

```ts
app.register(stcProjMgmtRoutes, {
  prefix: "/stc-proj-mgmt/api",
  projectRoot: __dirname,
  defaultStorageDir: "charts"
});
```

The plugin should encapsulate:

- chart storage directory management
- chart file listing
- chart file reading
- chart file creation
- chart file upload
- default sample-chart creation for first run

### Route Namespace

The REST API should live under a namespace intended for future composition:

```text
/stc-proj-mgmt/api
```

Expected route shape:

- `GET /stc-proj-mgmt/api/config`
- `PUT /stc-proj-mgmt/api/config`
- `GET /stc-proj-mgmt/api/charts`
- `GET /stc-proj-mgmt/api/chart`
- `POST /stc-proj-mgmt/api/charts/create`
- `POST /stc-proj-mgmt/api/charts/upload`

These routes should be implemented inside the plugin so they can be mounted into a larger parent Fastify app without rewriting handler logic.

### Backend Storage Rules

The storage directory should be:

- relative to the backend project root
- configurable by the frontend
- created automatically if missing
- constrained so it cannot escape the backend project root

Chart files should be JSON documents with a DHTMLX-compatible structure:

```json
{
  "data": [...],
  "links": [...]
}
```

File names should be normalized to `.json` and should not allow path traversal.

### Backend Typing Expectations

The backend should define explicit TypeScript interfaces or types for:

- plugin options
- storage directory resolution results
- chart list items
- chart document payloads
- create/upload request bodies
- route response shapes

The plugin API should be strongly typed so that both standalone use and embedded parent-app registration remain type-safe.

## Chart Document Model

Charts are stored as JSON and rendered by DHTMLX Gantt. The current intended sample model supports:

- regular tasks
- project/summary tasks
- milestones
- dependency links
- optional grouping metadata

Representative task fields:

- `id`
- `text`
- `start_date`
- `duration`
- `progress`
- `parent`
- `type`
- `open`
- `group_id`
- `key`
- `label`

This allows the sample data to demonstrate:

- hierarchical plans
- milestone rendering
- grouping metadata for future filtering or alternate views

## DHTMLX Integration Rules

The frontend should treat DHTMLX as a rendering engine over loaded chart JSON, not as the source of truth.

Important integration rules:

- initialize DHTMLX once against a stable DOM host
- keep the host mounted for the lifetime of the page
- update data with `clearAll()` + `parse(...)`
- update layout mode with `show_grid`, `show_chart`, `grid_width`, and `resetLayout()`
- never rely on a conditionally mounted host node for initialization

The DHTMLX assets should be served statically from the vendored `gantt-git/codebase/` directory.

Where DHTMLX has incomplete or weak typings, wrapper-layer types should be introduced at the application boundary rather than allowing type unsafety to spread through the app.

## Standalone vs Embedded Use

The design intentionally supports two deployment patterns.

### Standalone

`server.ts` starts a local Fastify app, serves:

- the SPA
- the built React bundle
- the DHTMLX static assets
- the namespaced project-management API

### Embedded

A larger application can import the plugin and register it into its own main Fastify app. In that mode:

- the plugin provides only the project-management API behavior
- the parent app decides final route composition, auth, logging, and other cross-cutting concerns

If desired later, the SPA itself can also be made mount-path-aware so both the UI and API can live under a larger application prefix.

## Sample Welcome Chart

The default `welcome-chart.json` should be rich enough to validate:

- multiple regular tasks
- multiple milestones
- multiple summary/project tasks
- dependencies across streams
- grouping metadata such as product, engineering, and delivery

This sample should serve as the first-run chart returned by the backend when the default chart directory is empty.

## Testing Expectations

Minimum behavior to verify after rebuild:

- the root page serves the React SPA
- the namespaced API returns config and chart metadata
- the default welcome chart loads automatically
- DHTMLX renders visible grid/chart content on first load
- switching between `Grid + Chart`, `Chart Only`, and `Grid Only` works without layout corruption
- an empty storage directory shows the overlay empty state while keeping the host mounted
- creating a sample chart populates the directory and renders immediately
- uploading a valid chart JSON renders immediately
- TypeScript compilation passes with no intentional type holes in application code

## Future Extensions

The architecture is intentionally compatible with future additions such as:

- authentication and authorization in the parent Fastify app
- alternate chart storage backends
- Kanban or filtered views derived from chart metadata
- custom task properties such as `description` or `status`
- deeper chart management workflows beyond simple JSON file storage
