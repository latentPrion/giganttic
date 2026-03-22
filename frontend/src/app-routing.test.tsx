import React from "react";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { authApi } from "./common/session/api/auth-api.js";
import { authTokenStorage } from "./common/session/storage/auth-token-storage.js";
import { lobbyApi } from "./lobby/api/lobby-api.js";
import { ganttApi } from "./spas/project-manager/api/gantt-api.js";
import { issuesApi } from "./spas/project-manager/api/issues-api.js";
import { renderWithTheme } from "./test/render-with-theme.js";
import { App } from "./App.js";

const { ROUTING_TEST_CHART_XML } = vi.hoisted(() => ({
  ROUTING_TEST_CHART_XML:
    "<?xml version=\"1.0\" encoding=\"UTF-8\"?><data><task id=\"1001\"><![CDATA[Test chart]]></task></data>",
}));

vi.mock("./spas/project-manager/lib/dhtmlx-gantt-adapter.js", () => ({
  getDhtmlxGantt: () => ({
    attachEvent: vi.fn(() => 1),
    clearAll: vi.fn(),
    config: {
      columns: [],
      date_format: "",
      grid_width: 0,
      keep_grid_width: false,
      layout: null,
      show_chart: true,
      show_grid: true,
    },
    destructor: vi.fn(),
    detachEvent: vi.fn(),
    init: vi.fn(),
    parse: vi.fn(),
    render: vi.fn(),
    resetLayout: vi.fn(),
    serialize: vi.fn(() => ROUTING_TEST_CHART_XML),
    setSizes: vi.fn(),
  }),
}));

vi.mock("./common/session/api/auth-api.js", () => ({
  authApi: {
    getCurrentSession: vi.fn(),
    login: vi.fn(),
    register: vi.fn(),
    revokeCurrentSession: vi.fn(),
  },
}));

vi.mock("./common/session/storage/auth-token-storage.js", () => ({
  authTokenStorage: {
    clear: vi.fn(),
    read: vi.fn(),
    write: vi.fn(),
  },
}));

vi.mock("./lobby/api/lobby-api.js", () => ({
  lobbyApi: {
    createOrganization: vi.fn(),
    createProject: vi.fn(),
    createTeam: vi.fn(),
    deleteOrganization: vi.fn(),
    deleteProject: vi.fn(),
    deleteTeam: vi.fn(),
    getOrganization: vi.fn(),
    getProject: vi.fn(),
    getTeam: vi.fn(),
    getUser: vi.fn(),
    listOrganizations: vi.fn(),
    listProjects: vi.fn(),
    listTeams: vi.fn(),
    associateProjectOrganization: vi.fn(),
    associateProjectTeam: vi.fn(),
    replaceOrganizationUsers: vi.fn(),
    replaceTeamMembers: vi.fn(),
    updateOrganization: vi.fn(),
    updateProject: vi.fn(),
    updateTeam: vi.fn(),
  },
}));

vi.mock("./spas/project-manager/api/issues-api.js", () => ({
  issuesApi: {
    createIssue: vi.fn(),
    deleteIssue: vi.fn(),
    getIssue: vi.fn(),
    listIssues: vi.fn(),
    updateIssue: vi.fn(),
  },
}));

vi.mock("./spas/project-manager/api/gantt-api.js", () => ({
  ganttApi: {
    getProjectChart: vi.fn(),
    getProjectChartExportCapabilities: vi.fn(),
    getProjectChartOrNull: vi.fn(),
    putProjectChart: vi.fn(),
  },
}));

const authApiMock = vi.mocked(authApi);
const authTokenStorageMock = vi.mocked(authTokenStorage);
const lobbyApiMock = vi.mocked(lobbyApi);
const ganttApiMock = vi.mocked(ganttApi);
const issuesApiMock = vi.mocked(issuesApi);

function createAuthenticatedResponse() {
  return {
    session: {
      expirationTimestamp: "2026-03-08T00:00:00.000Z",
      id: "session-1",
      ipAddress: "127.0.0.1",
      location: null,
      revokedAt: null,
      startTimestamp: "2026-03-07T00:00:00.000Z",
      userId: 101,
    },
    user: {
      email: "demo@example.com",
      id: 101,
      roles: ["GGTC_SYSTEMROLE_ADMIN"],
      username: "demo-user",
    },
  };
}

describe("app routing", () => {
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
        journal: "Issue journal",
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
        journal: "Issue journal",
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
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("renders the contact route in the public home app", () => {
    renderWithTheme(<App />, {
      initialEntries: ["/contact"],
    });

    expect(
      screen.getByRole("heading", { name: "Contact" }),
    ).toBeVisible();
  });

  it("renders the about route in the public home app", () => {
    renderWithTheme(<App />, {
      initialEntries: ["/about"],
    });

    expect(
      screen.getByRole("heading", { name: "About" }),
    ).toBeVisible();
  });

  it("renders the authenticated username as a lobby link", async () => {
    authTokenStorageMock.read.mockReturnValue("persisted-token");
    authApiMock.getCurrentSession.mockResolvedValue(createAuthenticatedResponse());

    renderWithTheme(<App />);

    expect(
      await screen.findByRole("link", { name: "Go to your lobby" }),
    ).toHaveAttribute("href", "/lobby");
  });

  it("navigates to the lobby when the authenticated username chip is clicked", async () => {
    const user = userEvent.setup();
    authTokenStorageMock.read.mockReturnValue("persisted-token");
    authApiMock.getCurrentSession.mockResolvedValue(createAuthenticatedResponse());

    renderWithTheme(<App />);

    await user.click(await screen.findByRole("link", { name: "Go to your lobby" }));

    expect(await screen.findByText("User Lobby")).toBeVisible();
    expect(await screen.findByText("Your projects, teams, and organizations")).toBeVisible();
  });

  it("redirects unauthenticated lobby requests to the public home route", async () => {
    renderWithTheme(<App />, {
      initialEntries: ["/lobby"],
    });

    expect(
      await screen.findByText("Giganttic, built by LatentPrion"),
    ).toBeVisible();
  });

  it("renders the user lobby for authenticated users", async () => {
    authTokenStorageMock.read.mockReturnValue("persisted-token");
    authApiMock.getCurrentSession.mockResolvedValue(createAuthenticatedResponse());

    renderWithTheme(<App />, {
      initialEntries: ["/lobby"],
    });

    expect(await screen.findByText("User Lobby")).toBeVisible();
    expect(await screen.findByRole("button", { name: /^Projects$/i })).toBeVisible();
    expect(screen.getByRole("button", { name: /^Teams$/i })).toBeVisible();
    expect(screen.getByRole("button", { name: /^Organizations$/i })).toBeVisible();
  });

  it("redirects unauthenticated PM project requests to the public home route", async () => {
    renderWithTheme(<App />, {
      initialEntries: ["/pm/project?projectId=1"],
    });

    expect(
      await screen.findByText("Giganttic, built by LatentPrion"),
    ).toBeVisible();
  });

  it("renders the PM project detail SPA for authenticated users", async () => {
    authTokenStorageMock.read.mockReturnValue("persisted-token");
    authApiMock.getCurrentSession.mockResolvedValue(createAuthenticatedResponse());

    renderWithTheme(<App />, {
      initialEntries: ["/pm/project?projectId=1"],
    });

    expect(await screen.findByText("Project")).toBeVisible();
    expect(screen.getByText("Selected project: 1")).toBeVisible();
    expect(await screen.findByText("Detailed Project View")).toBeVisible();
  });

  it("renders the PM team SPA for authenticated users", async () => {
    authTokenStorageMock.read.mockReturnValue("persisted-token");
    authApiMock.getCurrentSession.mockResolvedValue(createAuthenticatedResponse());

    renderWithTheme(<App />, {
      initialEntries: ["/pm/team?teamId=7"],
    });

    expect(await screen.findByText("Team")).toBeVisible();
    expect(await screen.findByText("Selected team: 7")).toBeVisible();
  });

  it("renders the PM organization SPA for authenticated users", async () => {
    authTokenStorageMock.read.mockReturnValue("persisted-token");
    authApiMock.getCurrentSession.mockResolvedValue(createAuthenticatedResponse());

    renderWithTheme(<App />, {
      initialEntries: ["/pm/organization?organizationId=9"],
    });

    expect(await screen.findByText("Organization")).toBeVisible();
    expect(await screen.findByText("Selected organization: 9")).toBeVisible();
  });

  it("renders the PM user SPA for authenticated users", async () => {
    authTokenStorageMock.read.mockReturnValue("persisted-token");
    authApiMock.getCurrentSession.mockResolvedValue(createAuthenticatedResponse());

    renderWithTheme(<App />, {
      initialEntries: ["/pm/user?userId=101"],
    });

    expect(await screen.findByText("User Profile")).toBeVisible();
    expect(await screen.findByText("Selected user: 101")).toBeVisible();
  });

  it("renders the PM project gantt SPA for authenticated users", async () => {
    authTokenStorageMock.read.mockReturnValue("persisted-token");
    authApiMock.getCurrentSession.mockResolvedValue(createAuthenticatedResponse());

    renderWithTheme(<App />, {
      initialEntries: ["/pm/project/gantt?projectId=1"],
    });

    expect(await screen.findByText("Project Manager Gantt")).toBeVisible();
    expect(screen.getByText("Selected project: 1")).toBeVisible();
    expect(await screen.findByRole("tab", { name: "Both" })).toBeVisible();
  });

  it("renders the PM project kanban SPA for authenticated users", async () => {
    authTokenStorageMock.read.mockReturnValue("persisted-token");
    authApiMock.getCurrentSession.mockResolvedValue(createAuthenticatedResponse());

    renderWithTheme(<App />, {
      initialEntries: ["/pm/project/kanban?projectId=1"],
    });

    expect(await screen.findByText("Project Kanban Board")).toBeVisible();
    expect(screen.getByText("Selected project: 1")).toBeVisible();
    expect(await screen.findByRole("heading", { name: "Open" })).toBeVisible();
  });

  it("renders the PM project route with a safe fallback when the project query param is invalid", async () => {
    authTokenStorageMock.read.mockReturnValue("persisted-token");
    authApiMock.getCurrentSession.mockResolvedValue(createAuthenticatedResponse());

    renderWithTheme(<App />, {
      initialEntries: ["/pm/project?projectId=invalid"],
    });

    expect(await screen.findByText("Project")).toBeVisible();
    expect(screen.getByText("Provide a valid projectId to view a project.")).toBeVisible();
  });

  it("renders the PM project route with a safe fallback when the project query param is missing", async () => {
    authTokenStorageMock.read.mockReturnValue("persisted-token");
    authApiMock.getCurrentSession.mockResolvedValue(createAuthenticatedResponse());

    renderWithTheme(<App />, {
      initialEntries: ["/pm/project"],
    });

    expect(await screen.findByText("Project")).toBeVisible();
    expect(screen.getByText("Provide a valid projectId to view a project.")).toBeVisible();
  });

  it("redirects unauthenticated PM issues requests to the public home route", async () => {
    renderWithTheme(<App />, {
      initialEntries: ["/pm/project/issues?projectId=42"],
    });

    expect(
      await screen.findByText("Giganttic, built by LatentPrion"),
    ).toBeVisible();
  });

  it("renders the PM issues SPA for authenticated users", async () => {
    authTokenStorageMock.read.mockReturnValue("persisted-token");
    authApiMock.getCurrentSession.mockResolvedValue(createAuthenticatedResponse());

    renderWithTheme(<App />, {
      initialEntries: ["/pm/project/issues?projectId=42"],
    });

    expect(await screen.findByText("Project Issues")).toBeVisible();
    expect(screen.getByText("Selected project: 42")).toBeVisible();
    expect(await screen.findByRole("tab", { name: "In Progress", selected: true })).toBeVisible();
  });

  it("redirects unauthenticated PM issue-detail requests to the public home route", async () => {
    renderWithTheme(<App />, {
      initialEntries: ["/pm/project/issue?id=7&projectId=42"],
    });

    expect(
      await screen.findByText("Giganttic, built by LatentPrion"),
    ).toBeVisible();
  });

  it("renders the PM issue detail SPA for authenticated users", async () => {
    authTokenStorageMock.read.mockReturnValue("persisted-token");
    authApiMock.getCurrentSession.mockResolvedValue(createAuthenticatedResponse());

    renderWithTheme(<App />, {
      initialEntries: ["/pm/project/issue?id=7&projectId=42"],
    });

    expect(await screen.findByText("Issue Detail")).toBeVisible();
    expect(screen.getByText("Selected issue: 7")).toBeVisible();
    expect(await screen.findByText("Detailed Issue View")).toBeVisible();
  });

  it("renders a safe fallback when the PM gantt route is missing projectId", async () => {
    authTokenStorageMock.read.mockReturnValue("persisted-token");
    authApiMock.getCurrentSession.mockResolvedValue(createAuthenticatedResponse());

    renderWithTheme(<App />, {
      initialEntries: ["/pm/project/gantt"],
    });

    expect(await screen.findByText("Project Manager Gantt")).toBeVisible();
    expect(screen.getByText("Selected project: None")).toBeVisible();
    expect(screen.getByText("Select a valid project to view its gantt chart.")).toBeVisible();
  });

  it("renders a safe fallback when the PM kanban route is missing projectId", async () => {
    authTokenStorageMock.read.mockReturnValue("persisted-token");
    authApiMock.getCurrentSession.mockResolvedValue(createAuthenticatedResponse());

    renderWithTheme(<App />, {
      initialEntries: ["/pm/project/kanban"],
    });

    expect(await screen.findByText("Project Kanban Board")).toBeVisible();
    expect(screen.getByText("Select a valid project to view its kanban board.")).toBeVisible();
  });

  it("renders a safe fallback when the PM issues route is missing projectId", async () => {
    authTokenStorageMock.read.mockReturnValue("persisted-token");
    authApiMock.getCurrentSession.mockResolvedValue(createAuthenticatedResponse());

    renderWithTheme(<App />, {
      initialEntries: ["/pm/project/issues"],
    });

    expect(await screen.findByText("Project Issues")).toBeVisible();
    expect(screen.getByText("Select a valid project to view its issues.")).toBeVisible();
  });

  it("renders a safe fallback when the PM issue-detail route is missing issue id", async () => {
    authTokenStorageMock.read.mockReturnValue("persisted-token");
    authApiMock.getCurrentSession.mockResolvedValue(createAuthenticatedResponse());

    renderWithTheme(<App />, {
      initialEntries: ["/pm/project/issue?projectId=42"],
    });

    expect(await screen.findByText("Issue Detail")).toBeVisible();
    expect(screen.getByText("Provide both a valid issue id and projectId to view an issue.")).toBeVisible();
  });
});
