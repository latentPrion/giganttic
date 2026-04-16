import React from "react";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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
import { renderWithTheme } from "./test/render-with-theme.js";
import { PROJECT_MANAGER_UNAUTHENTICATED_PROMPT_TEXT } from "./spas/project-manager/routes/ProjectManagerAuthenticatedRoute.js";
import { App } from "./App.js";

const authApiMock = vi.mocked(authApi);
const authTokenStorageMock = vi.mocked(authTokenStorage);
const lobbyApiMock = vi.mocked(lobbyApi);
const ganttApiMock = vi.mocked(ganttApi);
const issuesApiMock = vi.mocked(issuesApi);

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
    expect(
      screen.getByRole("link", { name: "Github" }),
    ).toHaveAttribute("href", "https://github.com/latentprion");
    expect(
      screen.getByRole("link", { name: "LinkedIn" }),
    ).toHaveAttribute("href", "https://www.linkedin.com/in/kofi-doku-atuah-0142054a/");
    expect(
      screen.getByText(/Giganttic is built by LatentPrion/i),
    ).toBeVisible();
  });

  it("renders public home routes correctly when mounted under a /pm basename", () => {
    renderWithTheme(<App />, {
      basename: "/pm",
      initialEntries: ["/pm/about"],
    });

    expect(
      screen.getByText(/Giganttic is built by LatentPrion/i),
    ).toBeVisible();
  });

  it("does not render the profile links on the public home route", () => {
    renderWithTheme(<App />, {
      initialEntries: ["/"],
    });

    expect(
      screen.queryByRole("link", { name: "Github" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "LinkedIn" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText("What Giganttic Can Do"),
    ).toBeVisible();
  });

  it("renders the authenticated username as a lobby link", async () => {
    authTokenStorageMock.read.mockReturnValue("persisted-token");
    authApiMock.getCurrentSession.mockResolvedValue(createAuthenticatedResponse());

    renderWithTheme(<App />);

    expect(
      await screen.findByRole("link", { name: "Go to your lobby" }),
    ).toHaveAttribute("href", "/user/lobby");
  });

  it("navigates to the lobby when the authenticated username chip is clicked", async () => {
    const user = userEvent.setup();
    authTokenStorageMock.read.mockReturnValue("persisted-token");
    authApiMock.getCurrentSession.mockResolvedValue(createAuthenticatedResponse());

    renderWithTheme(<App />);

    await user.click(await screen.findByRole("link", { name: "Go to your lobby" }));

    expect(await screen.findByRole("heading", { name: "Lobby" })).toBeVisible();
    expect(await screen.findByText("Your projects, teams, and organizations")).toBeVisible();
  });

  it("redirects unauthenticated user lobby requests to the public home route", async () => {
    renderWithTheme(<App />, {
      initialEntries: ["/user/lobby"],
    });

    expect(
      await screen.findByText("Run projects with clarity."),
    ).toBeVisible();
  });

  it("renders the user lobby for authenticated users", async () => {
    authTokenStorageMock.read.mockReturnValue("persisted-token");
    authApiMock.getCurrentSession.mockResolvedValue(createAuthenticatedResponse());

    renderWithTheme(<App />, {
      initialEntries: ["/user/lobby"],
    });

    expect(await screen.findByRole("heading", { name: "Lobby" })).toBeVisible();
    expect(await screen.findByRole("button", { name: /^Projects$/i })).toBeVisible();
    expect(screen.getByRole("button", { name: /^Teams$/i })).toBeVisible();
    expect(screen.getByRole("button", { name: /^Organizations$/i })).toBeVisible();
  });

  it("renders user routes correctly when mounted under a /pm basename", async () => {
    authTokenStorageMock.read.mockReturnValue("persisted-token");
    authApiMock.getCurrentSession.mockResolvedValue(createAuthenticatedResponse());

    renderWithTheme(<App />, {
      basename: "/pm",
      initialEntries: ["/pm/user/lobby"],
    });

    expect(await screen.findByText("User Lobby")).toBeVisible();
    expect(await screen.findByText("Your projects, teams, and organizations")).toBeVisible();
  });

  it("shows the PM sign-in prompt when unauthenticated on the project route", async () => {
    renderWithTheme(<App />, {
      initialEntries: ["/project?projectId=1"],
    });

    expect(
      await screen.findByText(PROJECT_MANAGER_UNAUTHENTICATED_PROMPT_TEXT),
    ).toBeVisible();
  });

  it("renders the PM project route for authenticated users", async () => {
    authTokenStorageMock.read.mockReturnValue("persisted-token");
    authApiMock.getCurrentSession.mockResolvedValue(createAuthenticatedResponse());

    renderWithTheme(<App />, {
      initialEntries: ["/project"],
    });

    expect(await screen.findByText("Project")).toBeVisible();
  });

  it("renders the PM project detail SPA for authenticated users", async () => {
    authTokenStorageMock.read.mockReturnValue("persisted-token");
    authApiMock.getCurrentSession.mockResolvedValue(createAuthenticatedResponse());

    renderWithTheme(<App />, {
      initialEntries: ["/project?projectId=1"],
    });

    expect(await screen.findByText("Project")).toBeVisible();
    expect(screen.getByText("Selected project: 1")).toBeVisible();
    expect(await screen.findByText("Detailed Project View")).toBeVisible();
  });

  /*
   * MemoryRouter `basename="/pm"` strips one leading `/pm`.
   * Route constants remain deploy-base-path agnostic (`/project/...`).
   */
  it("renders PM routes when MemoryRouter basename is /pm", async () => {
    authTokenStorageMock.read.mockReturnValue("persisted-token");
    authApiMock.getCurrentSession.mockResolvedValue(createAuthenticatedResponse());

    renderWithTheme(<App />, {
      basename: "/pm",
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
      initialEntries: ["/project/team?teamId=7"],
    });

    expect(await screen.findByText("Team")).toBeVisible();
    expect(await screen.findByText("Selected team: 7")).toBeVisible();
  });

  it("renders the PM organization SPA for authenticated users", async () => {
    authTokenStorageMock.read.mockReturnValue("persisted-token");
    authApiMock.getCurrentSession.mockResolvedValue(createAuthenticatedResponse());

    renderWithTheme(<App />, {
      initialEntries: ["/project/organization?organizationId=9"],
    });

    expect(await screen.findByText("Organization")).toBeVisible();
    expect(await screen.findByText("Selected organization: 9")).toBeVisible();
  });

  it("does not render a user SPA for /pm/user (invalid under deploy basename)", async () => {
    authTokenStorageMock.read.mockReturnValue("persisted-token");
    authApiMock.getCurrentSession.mockResolvedValue(createAuthenticatedResponse());

    renderWithTheme(<App />, {
      initialEntries: ["/pm/user?userId=101"],
    });

    expect(screen.queryByText("User Profile")).not.toBeInTheDocument();
    expect(screen.queryByText("User SPA")).not.toBeInTheDocument();
  });

  it("renders the standalone user SPA for authenticated self view", async () => {
    authTokenStorageMock.read.mockReturnValue("persisted-token");
    authApiMock.getCurrentSession.mockResolvedValue(createAuthenticatedResponse());

    renderWithTheme(<App />, {
      initialEntries: ["/user?userId=101"],
    });

    expect(await screen.findByText("User SPA")).toBeVisible();
    expect(await screen.findByText("Selected user: 101")).toBeVisible();
    expect(screen.getByRole("tab", { name: "Credentials" })).toBeVisible();
    expect(screen.getByRole("tab", { name: "Sessions" })).toBeVisible();
    expect(screen.getByRole("tab", { name: "Settings" })).toBeVisible();
  });

  it("redeems scoped token login route and redirects to the user lobby", async () => {
    authTokenStorageMock.read.mockReturnValue(null);
    authApiMock.loginWithScopedAccessToken.mockResolvedValue(createLoginResponse());

    renderWithTheme(<App />, {
      initialEntries: ["/auth/scoped-token-login?token=scoped-token-abc"],
    });

    expect(await screen.findByText("User Lobby")).toBeVisible();
    expect(authApiMock.loginWithScopedAccessToken).toHaveBeenCalledWith("scoped-token-abc");
    expect(authTokenStorageMock.write).toHaveBeenCalledWith("scoped-login-token");
  });

  it("hides self-only tabs for standalone user SPA non-self view", async () => {
    authTokenStorageMock.read.mockReturnValue("persisted-token");
    authApiMock.getCurrentSession.mockResolvedValue(createAuthenticatedResponse());

    renderWithTheme(<App />, {
      initialEntries: ["/user?userId=202&tab=credentials"],
    });

    expect(await screen.findByText("User SPA")).toBeVisible();
    expect(screen.queryByRole("tab", { name: "Settings" })).not.toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: "Credentials" })).not.toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: "Sessions" })).not.toBeInTheDocument();
  });

  it("renders the PM project gantt SPA for authenticated users", async () => {
    authTokenStorageMock.read.mockReturnValue("persisted-token");
    authApiMock.getCurrentSession.mockResolvedValue(createAuthenticatedResponse());

    renderWithTheme(<App />, {
      initialEntries: ["/project/gantt?projectId=1"],
    });

    expect(await screen.findByText("Project Manager Gantt")).toBeVisible();
    expect(screen.getByText("Selected project: 1")).toBeVisible();
    expect(await screen.findByRole("combobox", { name: "View" })).toBeVisible();
  });

  it("renders the PM project kanban SPA for authenticated users", async () => {
    authTokenStorageMock.read.mockReturnValue("persisted-token");
    authApiMock.getCurrentSession.mockResolvedValue(createAuthenticatedResponse());

    renderWithTheme(<App />, {
      initialEntries: ["/project/kanban?projectId=1"],
    });

    expect(await screen.findByText("Project Kanban Board")).toBeVisible();
    expect(screen.getByText("Selected project: 1")).toBeVisible();
    expect(await screen.findByRole("heading", { name: "Open" })).toBeVisible();
  });

  it("renders the PM tasks SPA for authenticated users", async () => {
    authTokenStorageMock.read.mockReturnValue("persisted-token");
    authApiMock.getCurrentSession.mockResolvedValue(createAuthenticatedResponse());

    renderWithTheme(<App />, {
      initialEntries: ["/project/tasks?projectId=1"],
    });

    expect(await screen.findByText("Project Tasks")).toBeVisible();
    expect(screen.getByText("Selected project: 1")).toBeVisible();
    expect(await screen.findByRole("tab", { name: "In Progress", selected: true })).toBeVisible();
  });

  it("renders the PM project route with a safe fallback when the project query param is invalid", async () => {
    authTokenStorageMock.read.mockReturnValue("persisted-token");
    authApiMock.getCurrentSession.mockResolvedValue(createAuthenticatedResponse());

    renderWithTheme(<App />, {
      initialEntries: ["/project?projectId=invalid"],
    });

    expect(await screen.findByText("Project")).toBeVisible();
    expect(screen.getByText("Provide a valid projectId to view a project.")).toBeVisible();
  });

  it("renders the PM project route with a safe fallback when the project query param is missing", async () => {
    authTokenStorageMock.read.mockReturnValue("persisted-token");
    authApiMock.getCurrentSession.mockResolvedValue(createAuthenticatedResponse());

    renderWithTheme(<App />, {
      initialEntries: ["/project"],
    });

    expect(await screen.findByText("Project")).toBeVisible();
    expect(screen.getByText("Provide a valid projectId to view a project.")).toBeVisible();
  });

  it("shows the PM sign-in prompt when unauthenticated on the issues route", async () => {
    renderWithTheme(<App />, {
      initialEntries: ["/project/issues?projectId=42"],
    });

    expect(
      await screen.findByText(PROJECT_MANAGER_UNAUTHENTICATED_PROMPT_TEXT),
    ).toBeVisible();
  });

  it("renders the PM issues SPA for authenticated users", async () => {
    authTokenStorageMock.read.mockReturnValue("persisted-token");
    authApiMock.getCurrentSession.mockResolvedValue(createAuthenticatedResponse());

    renderWithTheme(<App />, {
      initialEntries: ["/project/issues?projectId=42"],
    });

    expect(await screen.findByText("Project Issues")).toBeVisible();
    expect(screen.getByText("Selected project: 42")).toBeVisible();
    expect(await screen.findByRole("tab", { name: "In Progress", selected: true })).toBeVisible();
  });

  it("shows the PM sign-in prompt when unauthenticated on the issue detail route", async () => {
    renderWithTheme(<App />, {
      initialEntries: ["/project/issue?id=7&projectId=42"],
    });

    expect(
      await screen.findByText(PROJECT_MANAGER_UNAUTHENTICATED_PROMPT_TEXT),
    ).toBeVisible();
  });

  it("renders the PM issue detail SPA for authenticated users", async () => {
    authTokenStorageMock.read.mockReturnValue("persisted-token");
    authApiMock.getCurrentSession.mockResolvedValue(createAuthenticatedResponse());

    renderWithTheme(<App />, {
      initialEntries: ["/project/issue?id=7&projectId=42"],
    });

    expect(await screen.findByText("Issue Detail")).toBeVisible();
    expect(screen.getByText("Selected issue: 7")).toBeVisible();
    expect(await screen.findByText("Detailed Issue View")).toBeVisible();
  });

  it("renders a safe fallback when the PM gantt route is missing projectId", async () => {
    authTokenStorageMock.read.mockReturnValue("persisted-token");
    authApiMock.getCurrentSession.mockResolvedValue(createAuthenticatedResponse());

    renderWithTheme(<App />, {
      initialEntries: ["/project/gantt"],
    });

    expect(await screen.findByText("Project Manager Gantt")).toBeVisible();
    expect(screen.getByText("Selected project: None")).toBeVisible();
    expect(screen.getByText("Select a valid project to view its gantt chart.")).toBeVisible();
  });

  it("renders a safe fallback when the PM kanban route is missing projectId", async () => {
    authTokenStorageMock.read.mockReturnValue("persisted-token");
    authApiMock.getCurrentSession.mockResolvedValue(createAuthenticatedResponse());

    renderWithTheme(<App />, {
      initialEntries: ["/project/kanban"],
    });

    expect(await screen.findByText("Project Kanban Board")).toBeVisible();
    expect(screen.getByText("Select a valid project to view its kanban board.")).toBeVisible();
  });

  it("renders a safe fallback when the PM issues route is missing projectId", async () => {
    authTokenStorageMock.read.mockReturnValue("persisted-token");
    authApiMock.getCurrentSession.mockResolvedValue(createAuthenticatedResponse());

    renderWithTheme(<App />, {
      initialEntries: ["/project/issues"],
    });

    expect(await screen.findByText("Project Issues")).toBeVisible();
    expect(screen.getByText("Select a valid project to view its issues.")).toBeVisible();
  });

  it("renders a safe fallback when the PM tasks route is missing projectId", async () => {
    authTokenStorageMock.read.mockReturnValue("persisted-token");
    authApiMock.getCurrentSession.mockResolvedValue(createAuthenticatedResponse());

    renderWithTheme(<App />, {
      initialEntries: ["/project/tasks"],
    });

    expect(await screen.findByText("Project Tasks")).toBeVisible();
    expect(screen.getByText("Select a valid project to view its tasks.")).toBeVisible();
  });

  it("renders a safe fallback when the PM issue-detail route is missing issue id", async () => {
    authTokenStorageMock.read.mockReturnValue("persisted-token");
    authApiMock.getCurrentSession.mockResolvedValue(createAuthenticatedResponse());

    renderWithTheme(<App />, {
      initialEntries: ["/project/issue?projectId=42"],
    });

    expect(await screen.findByText("Issue Detail")).toBeVisible();
    expect(screen.getByText("Provide both a valid issue id and projectId to view an issue.")).toBeVisible();
  });
});
