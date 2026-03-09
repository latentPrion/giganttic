import React from "react";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { authApi } from "./common/session/api/auth-api.js";
import { authTokenStorage } from "./common/session/storage/auth-token-storage.js";
import { lobbyApi } from "./lobby/api/lobby-api.js";
import { issuesApi } from "./spas/project-manager/api/issues-api.js";
import { renderWithTheme } from "./test/render-with-theme.js";
import { App } from "./App.js";

vi.mock("./spas/project-manager/lib/dhtmlx-gantt-adapter.js", () => ({
  getDhtmlxGantt: () => ({
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
    init: vi.fn(),
    parse: vi.fn(),
    render: vi.fn(),
    resetLayout: vi.fn(),
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
    listOrganizations: vi.fn(),
    listProjects: vi.fn(),
    listTeams: vi.fn(),
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

const authApiMock = vi.mocked(authApi);
const authTokenStorageMock = vi.mocked(authTokenStorage);
const lobbyApiMock = vi.mocked(lobbyApi);
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
        progressPercentage: 15,
        projectId: 42,
        status: "ISSUE_STATUS_OPEN",
        updatedAt: "2026-03-08T00:00:00.000Z",
      }],
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

  it("redirects unauthenticated PM gantt requests to the public home route", async () => {
    renderWithTheme(<App />, {
      initialEntries: ["/pm/gantt?projectId=42"],
    });

    expect(
      await screen.findByText("Giganttic, built by LatentPrion"),
    ).toBeVisible();
  });

  it("renders the PM gantt SPA for authenticated users", async () => {
    authTokenStorageMock.read.mockReturnValue("persisted-token");
    authApiMock.getCurrentSession.mockResolvedValue(createAuthenticatedResponse());

    renderWithTheme(<App />, {
      initialEntries: ["/pm/gantt?projectId=42"],
    });

    expect(await screen.findByText("Project Manager Gantt")).toBeVisible();
    expect(screen.getByText("Selected project: 42")).toBeVisible();
    expect(screen.getByRole("tab", { name: "Both" })).toBeVisible();
  });

  it("renders the PM gantt SPA with sample fallback when the project query param is invalid", async () => {
    authTokenStorageMock.read.mockReturnValue("persisted-token");
    authApiMock.getCurrentSession.mockResolvedValue(createAuthenticatedResponse());

    renderWithTheme(<App />, {
      initialEntries: ["/pm/gantt?projectId=invalid"],
    });

    expect(await screen.findByText("Project Manager Gantt")).toBeVisible();
    expect(screen.getByText("Selected project: Sample chart")).toBeVisible();
  });

  it("renders the PM gantt SPA with sample fallback when the project query param is missing", async () => {
    authTokenStorageMock.read.mockReturnValue("persisted-token");
    authApiMock.getCurrentSession.mockResolvedValue(createAuthenticatedResponse());

    renderWithTheme(<App />, {
      initialEntries: ["/pm/gantt"],
    });

    expect(await screen.findByText("Project Manager Gantt")).toBeVisible();
    expect(screen.getByText("Selected project: Sample chart")).toBeVisible();
  });

  it("redirects unauthenticated PM issues requests to the public home route", async () => {
    renderWithTheme(<App />, {
      initialEntries: ["/pm/issues?projectId=42"],
    });

    expect(
      await screen.findByText("Giganttic, built by LatentPrion"),
    ).toBeVisible();
  });

  it("renders the PM issues SPA for authenticated users", async () => {
    authTokenStorageMock.read.mockReturnValue("persisted-token");
    authApiMock.getCurrentSession.mockResolvedValue(createAuthenticatedResponse());

    renderWithTheme(<App />, {
      initialEntries: ["/pm/issues?projectId=42"],
    });

    expect(await screen.findByText("Project Issues")).toBeVisible();
    expect(screen.getByText("Selected project: 42")).toBeVisible();
    expect(await screen.findByText("Issue 7")).toBeVisible();
  });

  it("renders the PM issue detail SPA for authenticated users", async () => {
    authTokenStorageMock.read.mockReturnValue("persisted-token");
    authApiMock.getCurrentSession.mockResolvedValue(createAuthenticatedResponse());

    renderWithTheme(<App />, {
      initialEntries: ["/pm/issue?id=7&projectId=42"],
    });

    expect(await screen.findByText("Issue Detail")).toBeVisible();
    expect(screen.getByText("Selected issue: 7")).toBeVisible();
    expect(await screen.findByText("Detailed Issue View")).toBeVisible();
  });
});
