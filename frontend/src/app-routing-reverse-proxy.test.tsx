/**
 * Comprehensive reverse-proxy / sub-directory deployment routing tests.
 *
 * These tests exist to prevent the recurring blank-screen bug that has appeared
 * multiple times when:
 *
 * 1. A route path constant lacks the `/pm` prefix (e.g. `/auth/scoped-token-login`
 *    instead of `/pm/auth/scoped-token-login`) — the browser URL includes `/pm/...`
 *    but React Router sees no match. (commits f2db0ed, current scoped-token fix)
 *
 * 2. `BrowserRouter basename` is set to the deploy prefix (`/pm`) instead of `"/"`
 *    — React Router strips `/pm` from the pathname, so full-path routes like
 *    `/pm/project` no longer match the stripped `/project`. (commit 3e5d74e)
 *
 * 3. A navigable URL like `/pm` or `/pm/` has no corresponding route entry and
 *    renders nothing. (commit b514142)
 *
 * 4. A new route is added but not wired into `AppRoutes`, or wired with the wrong
 *    path. (commits a56aadf, d100501 — mgr-uploads)
 *
 * 5. Redirect routes (typos, legacy patterns) break under sub-path deployment
 *    because the target path is wrong.
 *
 * The tests verify every registered route renders content (not a blank screen)
 * under the production deployment shape: `BrowserRouter basename="/"` with route
 * paths that include the `/pm` prefix.
 *
 * **Why `basename="/"`?**  See `common/routes/app-route-paths.ts` — all PM route
 * constants encode full site pathnames (`/pm/project`, `/pm/team`, etc.). With
 * `basename="/"`, React Router matches against the full `location.pathname`. If
 * `basename` were `/pm`, the router would strip one `/pm` segment and route
 * constants would need to omit it — a different (and previously broken) design.
 */
import React from "react";
import { screen, within } from "@testing-library/react";
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
import {
  ABOUT_ROUTE_PATH,
  CONTACT_ROUTE_PATH,
  HOME_ROUTE_PATH,
  LEGACY_PROJECT_ROUTE_PATTERN,
  PROJECT_MANAGER_GANTT_ROUTE_PATH,
  PROJECT_MANAGER_ISSUES_ROUTE_PATH,
  PROJECT_MANAGER_ISSUE_ROUTE_PATH,
  PROJECT_MANAGER_KANBAN_ROUTE_PATH,
  PROJECT_MANAGER_MGR_UPLOADS_ROUTE_PATH,
  PROJECT_MANAGER_MGR_UPLOAD_TYPO_ROUTE_PATH,
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
// Route path structural invariants
// ---------------------------------------------------------------------------

describe("route path constants — structural invariants", () => {
  it("all PM route paths start with PROJECT_MANAGER_ROUTE_ROOT", () => {
    const pmPaths = [
      PROJECT_MANAGER_ROUTE_PATH,
      PROJECT_MANAGER_TEAM_ROUTE_PATH,
      PROJECT_MANAGER_ORGANIZATION_ROUTE_PATH,
      PROJECT_MANAGER_NOTIFICATIONS_ROUTE_PATH,
      PROJECT_MANAGER_GANTT_ROUTE_PATH,
      PROJECT_MANAGER_KANBAN_ROUTE_PATH,
      PROJECT_MANAGER_ISSUES_ROUTE_PATH,
      PROJECT_MANAGER_TASKS_ROUTE_PATH,
      PROJECT_MANAGER_ISSUE_ROUTE_PATH,
      PROJECT_MANAGER_TASK_ROUTE_PATH,
      PROJECT_MANAGER_MGR_UPLOADS_ROUTE_PATH,
      PROJECT_MANAGER_MGR_UPLOAD_TYPO_ROUTE_PATH,
    ];

    for (const path of pmPaths) {
      expect(path, `PM route "${path}" must start with "${PROJECT_MANAGER_ROUTE_ROOT}"`).toMatch(
        new RegExp(`^${PROJECT_MANAGER_ROUTE_ROOT}(/|$)`),
      );
    }
  });

  it("scoped access token login path starts with the PM route root", () => {
    expect(
      SCOPED_ACCESS_TOKEN_LOGIN_ROUTE_PATH,
      "Scoped login path must start with the PM deploy prefix to be reachable in sub-dir deployments",
    ).toMatch(new RegExp(`^${PROJECT_MANAGER_ROUTE_ROOT}/`));
  });

  it("all route path constants start with a leading slash", () => {
    const allPaths = [
      HOME_ROUTE_PATH,
      CONTACT_ROUTE_PATH,
      ABOUT_ROUTE_PATH,
      SCOPED_ACCESS_TOKEN_LOGIN_ROUTE_PATH,
      USER_ROUTE_PATH,
      USER_LOBBY_ROUTE_PATH,
      PROJECT_MANAGER_ROUTE_ROOT,
      PROJECT_MANAGER_ROUTE_PATH,
      PROJECT_MANAGER_TEAM_ROUTE_PATH,
      PROJECT_MANAGER_ORGANIZATION_ROUTE_PATH,
      PROJECT_MANAGER_NOTIFICATIONS_ROUTE_PATH,
      PROJECT_MANAGER_GANTT_ROUTE_PATH,
      PROJECT_MANAGER_KANBAN_ROUTE_PATH,
      PROJECT_MANAGER_ISSUES_ROUTE_PATH,
      PROJECT_MANAGER_TASKS_ROUTE_PATH,
      PROJECT_MANAGER_ISSUE_ROUTE_PATH,
      PROJECT_MANAGER_TASK_ROUTE_PATH,
      PROJECT_MANAGER_MGR_UPLOADS_ROUTE_PATH,
      PROJECT_MANAGER_MGR_UPLOAD_TYPO_ROUTE_PATH,
    ];

    for (const path of allPaths) {
      expect(path, `Route "${path}" must start with /`).toMatch(/^\//);
    }
  });

  it("no route path constant contains a doubled slash", () => {
    const allPaths = [
      SCOPED_ACCESS_TOKEN_LOGIN_ROUTE_PATH,
      PROJECT_MANAGER_ROUTE_PATH,
      PROJECT_MANAGER_TEAM_ROUTE_PATH,
      PROJECT_MANAGER_ORGANIZATION_ROUTE_PATH,
      PROJECT_MANAGER_NOTIFICATIONS_ROUTE_PATH,
      PROJECT_MANAGER_GANTT_ROUTE_PATH,
      PROJECT_MANAGER_KANBAN_ROUTE_PATH,
      PROJECT_MANAGER_ISSUES_ROUTE_PATH,
      PROJECT_MANAGER_TASKS_ROUTE_PATH,
      PROJECT_MANAGER_ISSUE_ROUTE_PATH,
      PROJECT_MANAGER_TASK_ROUTE_PATH,
      PROJECT_MANAGER_MGR_UPLOADS_ROUTE_PATH,
      PROJECT_MANAGER_MGR_UPLOAD_TYPO_ROUTE_PATH,
      USER_ROUTE_PATH,
      USER_LOBBY_ROUTE_PATH,
    ];

    for (const path of allPaths) {
      expect(path, `Route "${path}" must not contain //`).not.toMatch(/\/\//);
    }
  });

  it("no route path constant has a trailing slash", () => {
    const allPaths = [
      SCOPED_ACCESS_TOKEN_LOGIN_ROUTE_PATH,
      PROJECT_MANAGER_ROUTE_PATH,
      PROJECT_MANAGER_TEAM_ROUTE_PATH,
      PROJECT_MANAGER_ORGANIZATION_ROUTE_PATH,
      PROJECT_MANAGER_NOTIFICATIONS_ROUTE_PATH,
      PROJECT_MANAGER_GANTT_ROUTE_PATH,
      PROJECT_MANAGER_KANBAN_ROUTE_PATH,
      PROJECT_MANAGER_ISSUES_ROUTE_PATH,
      PROJECT_MANAGER_TASKS_ROUTE_PATH,
      PROJECT_MANAGER_ISSUE_ROUTE_PATH,
      PROJECT_MANAGER_TASK_ROUTE_PATH,
      PROJECT_MANAGER_MGR_UPLOADS_ROUTE_PATH,
      PROJECT_MANAGER_MGR_UPLOAD_TYPO_ROUTE_PATH,
      USER_ROUTE_PATH,
      USER_LOBBY_ROUTE_PATH,
    ];

    for (const path of allPaths) {
      expect(path, `Route "${path}" must not end with /`).not.toMatch(/.+\/$/);
    }
  });
});

// ---------------------------------------------------------------------------
// Production deployment: basename="/" (the way main.tsx works)
// Every route must render visible content — never a blank screen.
// ---------------------------------------------------------------------------

describe("reverse-proxy deployment — all routes render content with basename='/'", () => {
  // --- Public routes (no auth) ---

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

  it("renders the scoped token login route at '/pm/auth/scoped-token-login'", async () => {
    authApiMock.loginWithScopedAccessToken.mockResolvedValue(createLoginResponse());

    renderWithTheme(<App />, {
      initialEntries: [`${SCOPED_ACCESS_TOKEN_LOGIN_ROUTE_PATH}?token=test-token`],
    });

    // Should show the spinner or redirect — not blank
    expect(
      await screen.findByText("Project"),
    ).toBeVisible();
    expect(authApiMock.loginWithScopedAccessToken).toHaveBeenCalledWith("test-token");
  });

  it("shows an error on the scoped token login route when the token is missing", async () => {
    renderWithTheme(<App />, {
      initialEntries: [SCOPED_ACCESS_TOKEN_LOGIN_ROUTE_PATH],
    });

    expect(
      await screen.findByText("Missing scoped access token query parameter."),
    ).toBeVisible();
  });

  // --- PM root redirect (the /pm -> /pm/project blank screen fix) ---

  it("redirects '/pm' to the PM project route for authenticated users", async () => {
    authenticateUser();

    renderWithTheme(<App />, { initialEntries: [PROJECT_MANAGER_ROUTE_ROOT] });

    expect(await screen.findByText("Project")).toBeVisible();
  });

  it("redirects '/pm/' to the PM project route for authenticated users", async () => {
    authenticateUser();

    renderWithTheme(<App />, { initialEntries: [`${PROJECT_MANAGER_ROUTE_ROOT}/`] });

    expect(await screen.findByText("Project")).toBeVisible();
  });

  // --- PM authenticated routes ---

  it("renders the PM project route at '/pm/project'", async () => {
    authenticateUser();

    renderWithTheme(<App />, {
      initialEntries: [`${PROJECT_MANAGER_ROUTE_PATH}?projectId=1`],
    });

    expect(await screen.findByText("Project")).toBeVisible();
    expect(screen.getByText("Selected project: 1")).toBeVisible();
  });

  it("renders the PM team route at '/pm/team'", async () => {
    authenticateUser();

    renderWithTheme(<App />, {
      initialEntries: [`${PROJECT_MANAGER_TEAM_ROUTE_PATH}?teamId=7`],
    });

    expect(await screen.findByText("Team")).toBeVisible();
    expect(await screen.findByText("Selected team: 7")).toBeVisible();
  });

  it("renders the PM organization route at '/pm/organization'", async () => {
    authenticateUser();

    renderWithTheme(<App />, {
      initialEntries: [`${PROJECT_MANAGER_ORGANIZATION_ROUTE_PATH}?organizationId=9`],
    });

    expect(await screen.findByText("Organization")).toBeVisible();
    expect(await screen.findByText("Selected organization: 9")).toBeVisible();
  });

  it("renders the PM gantt route at '/pm/project/gantt'", async () => {
    authenticateUser();

    renderWithTheme(<App />, {
      initialEntries: [`${PROJECT_MANAGER_GANTT_ROUTE_PATH}?projectId=1`],
    });

    expect(await screen.findByText("Project Manager Gantt")).toBeVisible();
  });

  it("renders the PM kanban route at '/pm/project/kanban'", async () => {
    authenticateUser();

    renderWithTheme(<App />, {
      initialEntries: [`${PROJECT_MANAGER_KANBAN_ROUTE_PATH}?projectId=1`],
    });

    expect(await screen.findByText("Project Kanban Board")).toBeVisible();
  });

  it("renders the PM issues route at '/pm/project/issues'", async () => {
    authenticateUser();

    renderWithTheme(<App />, {
      initialEntries: [`${PROJECT_MANAGER_ISSUES_ROUTE_PATH}?projectId=42`],
    });

    expect(await screen.findByText("Project Issues")).toBeVisible();
  });

  it("renders the PM tasks route at '/pm/project/tasks'", async () => {
    authenticateUser();

    renderWithTheme(<App />, {
      initialEntries: [`${PROJECT_MANAGER_TASKS_ROUTE_PATH}?projectId=1`],
    });

    expect(await screen.findByText("Project Tasks")).toBeVisible();
  });

  it("renders the PM issue detail route at '/pm/project/issue'", async () => {
    authenticateUser();

    renderWithTheme(<App />, {
      initialEntries: [`${PROJECT_MANAGER_ISSUE_ROUTE_PATH}?id=7&projectId=42`],
    });

    expect(await screen.findByText("Issue Detail")).toBeVisible();
  });

  it("renders the PM task detail route at '/pm/project/task'", async () => {
    authenticateUser();

    renderWithTheme(<App />, {
      initialEntries: [`${PROJECT_MANAGER_TASK_ROUTE_PATH}?taskId=1001&projectId=1`],
    });

    expect(await screen.findByText("Task Detail")).toBeVisible();
  });

  it("renders the PM notifications route at '/pm/notifications'", async () => {
    authenticateUser();

    renderWithTheme(<App />, {
      initialEntries: [PROJECT_MANAGER_NOTIFICATIONS_ROUTE_PATH],
    });

    expect(await screen.findByText("Notifications")).toBeVisible();
  });

  it("renders the PM mgr-uploads route at '/pm/mgr-uploads'", async () => {
    authenticateUser();

    renderWithTheme(<App />, {
      initialEntries: [PROJECT_MANAGER_MGR_UPLOADS_ROUTE_PATH],
    });

    expect(
      await screen.findByRole("heading", { name: "Shared instance uploads", level: 1 }),
    ).toBeVisible();
  });

  // --- Redirect routes ---

  it("redirects the mgr-upload typo to mgr-uploads", async () => {
    authenticateUser();

    renderWithTheme(<App />, {
      initialEntries: [PROJECT_MANAGER_MGR_UPLOAD_TYPO_ROUTE_PATH],
    });

    expect(
      await screen.findByRole("heading", { name: "Shared instance uploads", level: 1 }),
    ).toBeVisible();
  });

  it("redirects legacy /project/:projectId to the PM project route", async () => {
    authenticateUser();

    renderWithTheme(<App />, {
      initialEntries: ["/project/1"],
    });

    expect(await screen.findByText("Project")).toBeVisible();
    expect(screen.getByText("Selected project: 1")).toBeVisible();
  });

  // --- User routes ---

  it("renders the user lobby route at '/user/lobby'", async () => {
    authenticateUser();

    renderWithTheme(<App />, {
      initialEntries: [USER_LOBBY_ROUTE_PATH],
    });

    expect(await screen.findByText("User Lobby")).toBeVisible();
  });

  it("renders the user SPA route at '/user'", async () => {
    authenticateUser();

    renderWithTheme(<App />, {
      initialEntries: [`${USER_ROUTE_PATH}?userId=101`],
    });

    expect(await screen.findByText("User SPA")).toBeVisible();
  });

  // --- Unauthenticated guard (redirects to home, not blank screen) ---

  it("redirects unauthenticated PM project requests to the public home — not blank", async () => {
    renderWithTheme(<App />, {
      initialEntries: [PROJECT_MANAGER_ROUTE_PATH],
    });

    expect(await screen.findByText("Run projects with clarity.")).toBeVisible();
  });

  it("redirects unauthenticated PM gantt requests to the public home — not blank", async () => {
    renderWithTheme(<App />, {
      initialEntries: [`${PROJECT_MANAGER_GANTT_ROUTE_PATH}?projectId=1`],
    });

    expect(await screen.findByText("Run projects with clarity.")).toBeVisible();
  });

  it("redirects unauthenticated user lobby requests to the public home — not blank", async () => {
    renderWithTheme(<App />, {
      initialEntries: [USER_LOBBY_ROUTE_PATH],
    });

    expect(await screen.findByText("Run projects with clarity.")).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// URL builder consistency: scoped-login URLs match the route path
// ---------------------------------------------------------------------------

describe("scoped login URL builder consistency", () => {
  it("createScopedAccessLoginRelativeUrl produces a path that matches the route", async () => {
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

  it("the scoped login URL can be navigated in the app and renders content", async () => {
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
