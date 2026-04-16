/**
 * Comprehensive reverse-proxy / sub-directory deployment routing tests.
 *
 * Canonical PM URLs use **two** `/pm` segments: nginx + `VITE_APP_BASE_PATH` mount (`/pm/`)
 * and the PM module root (`/pm/pm/...`). There are no compatibility redirects for older URL shapes.
 *
 * Failure modes this suite guards against (see git history around f2db0ed, 3e5d74e, b514142):
 *
 * 1. **Missing deploy or PM prefix on a route constant** — e.g. `/auth/scoped-token-login`
 *    instead of `/pm/pm/auth/scoped-token-login` — no `<Route>` match → blank screen.
 *
 * 2. **`BrowserRouter basename` set to `/pm`** — strips one segment; full path constants
 *    then stop matching unless tests and routes are redesigned together.
 *
 * 3. **No route entry for a navigable URL** — e.g. `/pm/pm` with no `<Route>` → blank.
 *
 * 4. **New `app-route-paths` exports** — structural tests auto-enumerate string exports.
 *
 * 5. **Hardcoded path strings in AppRoutes.tsx** — caught by a source-text assertion.
 *
 * 6. **No catch-all route** — unregistered paths fall through to `path="*"`.
 *
 * 7. **`buildAppRelativeUrl`** — idempotent under the deploy prefix (no throws); PM paths
 *    are full `/pm/pm/...` constants, not built by prepending twice.
 *
 * **Why `basename="/"` in `main.tsx`?** PM constants are full site pathnames (`/pm/pm/...`).
 */
import React from "react";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import "./app-routing-test-vi-mocks.js";
import { authApi } from "./common/session/api/auth-api.js";
import { authTokenStorage } from "./common/session/storage/auth-token-storage.js";
import { lobbyApi } from "./lobby/api/lobby-api.js";
import { ganttApi } from "./spas/project-manager/api/gantt-api.js";
import { issuesApi } from "./spas/project-manager/api/issues-api.js";
import {
  createAuthenticatedResponse,
  createLoginResponse,
} from "./app-routing-test-auth-helpers.js";
import {
  ROUTING_TEST_CHART_XML,
  listMgrUploadsFilesMock,
} from "./app-routing-test-vi-mocks.js";
import * as routePaths from "../../common/routes/app-route-paths.js";
import {
  ABOUT_ROUTE_PATH,
  CONTACT_ROUTE_PATH,
  HOME_ROUTE_PATH,
  PROJECT_MANAGER_GANTT_ROUTE_PATH,
  PROJECT_MANAGER_ISSUES_ROUTE_PATH,
  PROJECT_MANAGER_ISSUE_ROUTE_PATH,
  PROJECT_MANAGER_KANBAN_ROUTE_PATH,
  PROJECT_MANAGER_MGR_UPLOADS_ROUTE_PATH,
  PROJECT_MANAGER_NOTIFICATIONS_ROUTE_PATH,
  PROJECT_MANAGER_ORGANIZATION_ROUTE_PATH,
  PROJECT_MANAGER_ROUTE_PATH,
  PROJECT_MANAGER_ROUTE_ROOT,
  PROJECT_MANAGER_TASKS_ROUTE_PATH,
  PROJECT_MANAGER_TASK_ROUTE_PATH,
  PROJECT_MANAGER_TEAM_ROUTE_PATH,
  SCOPED_ACCESS_TOKEN_LOGIN_ROUTE_PATH,
  USER_LOBBY_ROUTE_PATH,
  USER_ROUTE_PATH,
} from "../../common/routes/app-route-paths.js";
import { renderWithTheme } from "./test/render-with-theme.js";
import { App } from "./App.js";

const authApiMock = vi.mocked(authApi);
const authTokenStorageMock = vi.mocked(authTokenStorage);
const lobbyApiMock = vi.mocked(lobbyApi);
const ganttApiMock = vi.mocked(ganttApi);
const issuesApiMock = vi.mocked(issuesApi);

// ---------------------------------------------------------------------------
// Shared setup
// ---------------------------------------------------------------------------

function authenticateUser() {
  authTokenStorageMock.read.mockReturnValue("persisted-token");
  authApiMock.getCurrentSession.mockResolvedValue(createAuthenticatedResponse());
}

beforeEach(() => {
  authTokenStorageMock.read.mockReturnValue(null);
  authApiMock.getCurrentSession.mockReset();
  lobbyApiMock.listOrganizations.mockResolvedValue({ organizations: [] });
  lobbyApiMock.listProjects.mockResolvedValue({ projects: [] });
  lobbyApiMock.listTeams.mockResolvedValue({ teams: [] });
  ganttApiMock.getProjectChart.mockResolvedValue({
    content: ROUTING_TEST_CHART_XML,
    type: "xml",
  });
  ganttApiMock.getProjectChartExportCapabilities.mockResolvedValue({
    ganttExport: {
      dhtmlxXml: { enabled: true },
      msProjectXml: {
        enabled: true,
        mode: "cloud_fallback",
        serverUrl: null,
      },
    },
  });
  ganttApiMock.getProjectChartOrNull.mockResolvedValue({
    content: ROUTING_TEST_CHART_XML,
    type: "xml",
  });
  ganttApiMock.putProjectChart.mockResolvedValue({ ok: true });
  issuesApiMock.getIssue.mockResolvedValue({
    issue: {
      closedAt: null,
      closedReason: null,
      closedReasonDescription: null,
      createdAt: "2026-03-08T00:00:00.000Z",
      description: "Issue description",
      id: 7,
      name: "Issue 7",
      openedAt: "2026-03-08T00:00:00.000Z",
      priority: 2,
      progressPercentage: 15,
      projectId: 42,
      status: "ISSUE_STATUS_OPEN",
      updatedAt: "2026-03-08T00:00:00.000Z",
    },
  });
  issuesApiMock.listIssues.mockResolvedValue({
    issues: [{
      closedAt: null,
      closedReason: null,
      closedReasonDescription: null,
      createdAt: "2026-03-08T00:00:00.000Z",
      description: "Issue description",
      id: 7,
      name: "Issue 7",
      openedAt: "2026-03-08T00:00:00.000Z",
      priority: 2,
      progressPercentage: 15,
      projectId: 42,
      status: "ISSUE_STATUS_IN_PROGRESS",
      updatedAt: "2026-03-08T00:00:00.000Z",
    }],
  });
  lobbyApiMock.getProject.mockResolvedValue({
    members: [{
      roleCodes: ["GGTC_PROJECTROLE_PROJECT_MANAGER"],
      userId: 101,
      username: "demo-user",
    }],
    organizations: [],
    project: {
      createdAt: "2026-03-08T00:00:00.000Z",
      description: "Project description",
      id: 1,
      name: "Project 1",
      updatedAt: "2026-03-08T00:00:00.000Z",
    },
    projectManagers: [{
      sourceKinds: ["direct"],
      userId: 101,
      username: "demo-user",
    }],
    teams: [],
  });
  lobbyApiMock.getTeam.mockResolvedValue({
    members: [{
      roleCodes: ["GGTC_TEAMROLE_TEAM_MANAGER"],
      userId: 101,
      username: "demo-user",
    }],
    projects: [],
    team: {
      createdAt: "2026-03-08T00:00:00.000Z",
      description: "Team description",
      id: 7,
      name: "Team 7",
      updatedAt: "2026-03-08T00:00:00.000Z",
    },
    teamManagers: [{ userId: 101, username: "demo-user" }],
    teamProjectManagers: [],
  });
  lobbyApiMock.getOrganization.mockResolvedValue({
    members: [{
      roleCodes: ["GGTC_ORGANIZATIONROLE_ORGANIZATION_MANAGER"],
      userId: 101,
      username: "demo-user",
    }],
    organization: {
      createdAt: "2026-03-08T00:00:00.000Z",
      description: "Organization description",
      id: 9,
      name: "Org 9",
      updatedAt: "2026-03-08T00:00:00.000Z",
    },
    organizationManagers: [{ userId: 101, username: "demo-user" }],
    organizationProjectManagers: [],
    organizationTeamManagers: [],
    projects: [],
    teams: [],
  });
  lobbyApiMock.getUser.mockResolvedValue({
    organizations: [],
    projects: [],
    teams: [],
    user: {
      createdAt: "2026-03-08T00:00:00.000Z",
      id: 101,
      isActive: true,
      updatedAt: "2026-03-08T00:00:00.000Z",
      username: "demo-user",
    },
  });
  listMgrUploadsFilesMock.mockReset();
  listMgrUploadsFilesMock.mockResolvedValue({
    files: [],
    storage: {
      availableBytes: 100,
      availableMib: 0.0,
      devicePath: "/dev/sda1",
    },
  });
});

afterEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// #4 — Route path structural invariants (auto-enumerate all exports)
//
// These tests import the entire `app-route-paths` module so every export is
// automatically covered — no manual list to forget to update.
// ---------------------------------------------------------------------------

describe("route path constants — structural invariants (auto-enumerated)", () => {
  // All string exports (route constants) — filter out non-string values if any
  // are ever added to the module.
  const allExportedPaths = Object.entries(routePaths)
    .filter((entry): entry is [string, string] => typeof entry[1] === "string")
    .map(([name, value]) => ({ name, value }));

  // PM-specific exports: every export whose name starts with PROJECT_MANAGER_
  const pmExports = allExportedPaths.filter(({ name }) =>
    name.startsWith("PROJECT_MANAGER_"),
  );

  it("all PROJECT_MANAGER_ route constants start with PROJECT_MANAGER_ROUTE_ROOT", () => {
    const root = routePaths.PROJECT_MANAGER_ROUTE_ROOT;
    for (const { name, value } of pmExports) {
      expect(value, `${name} must start with "${root}"`).toMatch(
        new RegExp(`^${root}(/|$)`),
      );
    }
  });

  it("SCOPED_ACCESS_TOKEN_LOGIN_ROUTE_PATH starts with the PM route root", () => {
    expect(
      routePaths.SCOPED_ACCESS_TOKEN_LOGIN_ROUTE_PATH,
      "Scoped login path must start with PROJECT_MANAGER_ROUTE_ROOT",
    ).toMatch(new RegExp(`^${routePaths.PROJECT_MANAGER_ROUTE_ROOT}/`));
  });

  it("all exported route path constants start with a leading slash", () => {
    for (const { name, value } of allExportedPaths) {
      expect(value, `${name} must start with /`).toMatch(/^\//);
    }
  });

  it("no exported route path constant contains a doubled slash", () => {
    for (const { name, value } of allExportedPaths) {
      expect(value, `${name} must not contain //`).not.toMatch(/\/\//);
    }
  });

  it("no exported route path constant ends with a trailing slash (except root '/')", () => {
    for (const { name, value } of allExportedPaths) {
      if (value === "/") continue;
      expect(value, `${name} must not end with /`).not.toMatch(/.+\/$/);
    }
  });
});

// ---------------------------------------------------------------------------
// #5 — AppRoutes uses constants, not hardcoded path strings
//
// Reads AppRoutes.tsx source text and asserts that no `path=` JSX attribute
// carries a bare string literal. All paths must come from imported constants
// or template expressions — never from inline strings that bypass the invariant
// checks above.
// ---------------------------------------------------------------------------

describe("AppRoutes source — no hardcoded path string literals", () => {
  it("every path= prop in AppRoutes uses a constant or template expression, not a bare string", () => {
    const dir = path.dirname(fileURLToPath(import.meta.url));
    const src = readFileSync(path.join(dir, "app/AppRoutes.tsx"), "utf8");

    // Match path={...} JSX attributes. Capture the inner expression.
    // We want to flag any where the value is a plain string literal:
    //   path="/some/literal"          ← bad (unquoted or double-quoted attr)
    //   path={'some/literal'}         ← bad (single-quoted JSX expression)
    //   path={`/some/literal`}        ← bad (template literal with no interpolation)
    //   path={SOME_CONSTANT}          ← ok
    //   path={`${EXPR}/suffix`}       ← ok (template with at least one interpolation)
    //   path="*"                      ← ok (the catch-all, not a real route)
    //
    // Branch 1: path="..." or path={"..."} (double-quoted string)
    // Branch 2: path={'...'} (single-quoted JSX expression)
    // Branch 3: path={`...`} where the template contains no ${ interpolation
    const pathAttrRe =
      /\bpath=\{?"([^"*][^"]*)"\}?|\bpath=\{'([^']*)'\}|\bpath=\{`([^`$]*)`\}/g;
    const violations: string[] = [];

    for (const match of src.matchAll(pathAttrRe)) {
      const literal = match[1] ?? match[2] ?? match[3];
      // Allow the catch-all wildcard exactly
      if (literal !== "*") {
        violations.push(literal);
      }
    }

    expect(
      violations,
      `AppRoutes.tsx contains hardcoded path string literals — move them to app-route-paths.ts constants: ${violations.join(", ")}`,
    ).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// #2 — Catch-all route: unknown paths redirect to home, never blank
// ---------------------------------------------------------------------------

describe("catch-all route — unknown paths never render blank", () => {
  it("redirects a completely unknown path to the public home page", async () => {
    renderWithTheme(<App />, {
      initialEntries: ["/pm/this-route-does-not-exist"],
    });

    expect(await screen.findByText("Run projects with clarity.")).toBeVisible();
  });

  it("redirects an unknown nested path to the public home page", async () => {
    renderWithTheme(<App />, {
      initialEntries: ["/pm/pm/project/nonexistent-sub-route"],
    });

    expect(await screen.findByText("Run projects with clarity.")).toBeVisible();
  });

  it("redirects a path completely outside the PM prefix to the public home page", async () => {
    renderWithTheme(<App />, {
      initialEntries: ["/totally/unknown/path"],
    });

    expect(await screen.findByText("Run projects with clarity.")).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Production deployment: basename="/" — every route renders content
// ---------------------------------------------------------------------------

describe("reverse-proxy deployment — all routes render content with basename='/'", () => {
  // --- Public routes ---

  it("renders the public home page at '/'", () => {
    renderWithTheme(<App />, { initialEntries: ["/"] });
    expect(screen.getByText("What Giganttic Can Do")).toBeVisible();
  });

  it("renders the contact page at '/contact'", () => {
    renderWithTheme(<App />, { initialEntries: [CONTACT_ROUTE_PATH] });
    expect(screen.getByRole("heading", { name: "Contact" })).toBeVisible();
  });

  it("renders the about page at '/about'", () => {
    renderWithTheme(<App />, { initialEntries: [ABOUT_ROUTE_PATH] });
    expect(screen.getByText(/Giganttic is built by LatentPrion/i)).toBeVisible();
  });

  // --- Scoped token login ---

  it("renders the scoped token login route and redirects after success", async () => {
    authApiMock.loginWithScopedAccessToken.mockResolvedValue(createLoginResponse());

    renderWithTheme(<App />, {
      initialEntries: [`${SCOPED_ACCESS_TOKEN_LOGIN_ROUTE_PATH}?token=test-token`],
    });

    expect(await screen.findByText("Project")).toBeVisible();
    expect(authApiMock.loginWithScopedAccessToken).toHaveBeenCalledWith("test-token");
  });

  it("shows an error when the scoped token query param is missing", async () => {
    renderWithTheme(<App />, {
      initialEntries: [SCOPED_ACCESS_TOKEN_LOGIN_ROUTE_PATH],
    });

    expect(
      await screen.findByText("Missing scoped access token query parameter."),
    ).toBeVisible();
  });

  // --- PM root redirects ---

  it("redirects '/pm/pm' to the PM project route", async () => {
    authenticateUser();
    renderWithTheme(<App />, { initialEntries: [PROJECT_MANAGER_ROUTE_ROOT] });
    expect(await screen.findByText("Project")).toBeVisible();
  });

  it("redirects '/pm/pm/' to the PM project route", async () => {
    authenticateUser();
    renderWithTheme(<App />, { initialEntries: [`${PROJECT_MANAGER_ROUTE_ROOT}/`] });
    expect(await screen.findByText("Project")).toBeVisible();
  });

  // --- PM authenticated routes ---

  it("renders the PM project route at '/pm/pm/project'", async () => {
    authenticateUser();
    renderWithTheme(<App />, {
      initialEntries: [`${PROJECT_MANAGER_ROUTE_PATH}?projectId=1`],
    });
    expect(await screen.findByText("Project")).toBeVisible();
    expect(screen.getByText("Selected project: 1")).toBeVisible();
  });

  it("renders the PM team route at '/pm/pm/team'", async () => {
    authenticateUser();
    renderWithTheme(<App />, {
      initialEntries: [`${PROJECT_MANAGER_TEAM_ROUTE_PATH}?teamId=7`],
    });
    expect(await screen.findByText("Team")).toBeVisible();
    expect(await screen.findByText("Selected team: 7")).toBeVisible();
  });

  it("renders the PM organization route at '/pm/pm/organization'", async () => {
    authenticateUser();
    renderWithTheme(<App />, {
      initialEntries: [`${PROJECT_MANAGER_ORGANIZATION_ROUTE_PATH}?organizationId=9`],
    });
    expect(await screen.findByText("Organization")).toBeVisible();
    expect(await screen.findByText("Selected organization: 9")).toBeVisible();
  });

  it("renders the PM gantt route at '/pm/pm/project/gantt'", async () => {
    authenticateUser();
    renderWithTheme(<App />, {
      initialEntries: [`${PROJECT_MANAGER_GANTT_ROUTE_PATH}?projectId=1`],
    });
    expect(await screen.findByText("Project Manager Gantt")).toBeVisible();
  });

  it("renders the PM kanban route at '/pm/pm/project/kanban'", async () => {
    authenticateUser();
    renderWithTheme(<App />, {
      initialEntries: [`${PROJECT_MANAGER_KANBAN_ROUTE_PATH}?projectId=1`],
    });
    expect(await screen.findByText("Project Kanban Board")).toBeVisible();
  });

  it("renders the PM issues route at '/pm/pm/project/issues'", async () => {
    authenticateUser();
    renderWithTheme(<App />, {
      initialEntries: [`${PROJECT_MANAGER_ISSUES_ROUTE_PATH}?projectId=42`],
    });
    expect(await screen.findByText("Project Issues")).toBeVisible();
  });

  it("renders the PM tasks route at '/pm/pm/project/tasks'", async () => {
    authenticateUser();
    renderWithTheme(<App />, {
      initialEntries: [`${PROJECT_MANAGER_TASKS_ROUTE_PATH}?projectId=1`],
    });
    expect(await screen.findByText("Project Tasks")).toBeVisible();
  });

  it("renders the PM issue detail route at '/pm/pm/project/issue'", async () => {
    authenticateUser();
    renderWithTheme(<App />, {
      initialEntries: [`${PROJECT_MANAGER_ISSUE_ROUTE_PATH}?id=7&projectId=42`],
    });
    expect(await screen.findByText("Issue Detail")).toBeVisible();
  });

  it("renders the PM task detail route at '/pm/pm/project/task'", async () => {
    authenticateUser();
    renderWithTheme(<App />, {
      initialEntries: [`${PROJECT_MANAGER_TASK_ROUTE_PATH}?taskId=1001&projectId=1`],
    });
    expect(await screen.findByText("Task Detail")).toBeVisible();
  });

  it("renders the PM notifications route at '/pm/pm/notifications'", async () => {
    authenticateUser();
    renderWithTheme(<App />, {
      initialEntries: [PROJECT_MANAGER_NOTIFICATIONS_ROUTE_PATH],
    });
    expect(await screen.findByText("Notifications")).toBeVisible();
  });

  it("renders the PM mgr-uploads route at '/pm/pm/mgr-uploads'", async () => {
    authenticateUser();
    renderWithTheme(<App />, {
      initialEntries: [PROJECT_MANAGER_MGR_UPLOADS_ROUTE_PATH],
    });
    expect(
      await screen.findByRole("heading", { name: "Shared instance uploads", level: 1 }),
    ).toBeVisible();
  });

  // --- User routes ---

  it("renders the user lobby route at '/user/lobby'", async () => {
    authenticateUser();
    renderWithTheme(<App />, { initialEntries: [USER_LOBBY_ROUTE_PATH] });
    expect(await screen.findByText("User Lobby")).toBeVisible();
  });

  it("renders the user SPA route at '/user'", async () => {
    authenticateUser();
    renderWithTheme(<App />, { initialEntries: [`${USER_ROUTE_PATH}?userId=101`] });
    expect(await screen.findByText("User SPA")).toBeVisible();
  });

  // --- Unauthenticated guard: redirect to home, not blank ---

  it("redirects unauthenticated PM project requests to home — not blank", async () => {
    renderWithTheme(<App />, { initialEntries: [PROJECT_MANAGER_ROUTE_PATH] });
    expect(await screen.findByText("Run projects with clarity.")).toBeVisible();
  });

  it("redirects unauthenticated PM gantt requests to home — not blank", async () => {
    renderWithTheme(<App />, {
      initialEntries: [`${PROJECT_MANAGER_GANTT_ROUTE_PATH}?projectId=1`],
    });
    expect(await screen.findByText("Run projects with clarity.")).toBeVisible();
  });

  it("redirects unauthenticated user lobby requests to home — not blank", async () => {
    renderWithTheme(<App />, { initialEntries: [USER_LOBBY_ROUTE_PATH] });
    expect(await screen.findByText("Run projects with clarity.")).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// #7 — buildAppRelativeUrl is idempotent under the deploy prefix
// ---------------------------------------------------------------------------

describe("buildAppRelativeUrl — idempotent deploy prefix", () => {
  it("returns the path unchanged when it already starts with appBasePath", async () => {
    const { buildAppRelativeUrl } = await import(
      "./common/routing/public-app-url.js"
    );

    expect(buildAppRelativeUrl("/pm", "/pm")).toBe("/pm");
    expect(buildAppRelativeUrl("/pm/pm/project", "/pm")).toBe("/pm/pm/project");
    expect(buildAppRelativeUrl(PROJECT_MANAGER_ROUTE_PATH, "/pm")).toBe(
      PROJECT_MANAGER_ROUTE_PATH,
    );
    expect(buildAppRelativeUrl(SCOPED_ACCESS_TOKEN_LOGIN_ROUTE_PATH, "/pm")).toBe(
      SCOPED_ACCESS_TOKEN_LOGIN_ROUTE_PATH,
    );
  });

  it("prefixes when the path is not yet under appBasePath", async () => {
    const { buildAppRelativeUrl } = await import(
      "./common/routing/public-app-url.js"
    );

    expect(buildAppRelativeUrl("/contact", "/pm")).toBe("/pm/contact");
    expect(buildAppRelativeUrl("/auth/scoped-token-login", "/pm")).toBe(
      "/pm/auth/scoped-token-login",
    );
  });

  it("does not add a prefix for root appBasePath", async () => {
    const { buildAppRelativeUrl } = await import(
      "./common/routing/public-app-url.js"
    );

    expect(buildAppRelativeUrl("/pm/pm/project", "/")).toBe("/pm/pm/project");
  });
});

// ---------------------------------------------------------------------------
// URL builder consistency: generated scoped-login URLs match the route
// ---------------------------------------------------------------------------

describe("scoped login URL builder consistency", () => {
  it("createScopedAccessLoginRelativeUrl produces a path matching the route constant", async () => {
    const { createScopedAccessLoginRelativeUrl } = await import(
      "./common/routing/public-app-url.js"
    );
    const url = createScopedAccessLoginRelativeUrl("test-token");
    const [pathname] = url.split("?");

    expect(pathname).toBe(SCOPED_ACCESS_TOKEN_LOGIN_ROUTE_PATH);
  });

  it("createScopedAccessLoginAbsoluteUrl includes the route path after the origin", async () => {
    const { createScopedAccessLoginAbsoluteUrl } = await import(
      "./common/routing/public-app-url.js"
    );
    const url = createScopedAccessLoginAbsoluteUrl("test-token", "https://workio.ai");

    expect(url).toContain(`https://workio.ai${SCOPED_ACCESS_TOKEN_LOGIN_ROUTE_PATH}`);
  });

  it("a generated scoped-login URL navigated in the app renders content", async () => {
    const { createScopedAccessLoginRelativeUrl } = await import(
      "./common/routing/public-app-url.js"
    );
    authApiMock.loginWithScopedAccessToken.mockResolvedValue(createLoginResponse());

    const url = createScopedAccessLoginRelativeUrl("my-scoped-token");
    renderWithTheme(<App />, { initialEntries: [url] });

    expect(await screen.findByText("Project")).toBeVisible();
    expect(authApiMock.loginWithScopedAccessToken).toHaveBeenCalledWith("my-scoped-token");
  });
});
