import React from "react";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "../../common/api/api-error.js";
import { renderWithTheme } from "../../test/render-with-theme.js";
import { lobbyApi } from "../api/lobby-api.js";
import { UserLobbyPage } from "./UserLobbyPage.js";

vi.mock("../api/lobby-api.js", () => ({
  lobbyApi: {
    deleteProject: vi.fn(),
    getOrganization: vi.fn(),
    getTeam: vi.fn(),
    listOrganizations: vi.fn(),
    listProjects: vi.fn(),
    listTeams: vi.fn(),
    replaceOrganizationUsers: vi.fn(),
    replaceTeamMembers: vi.fn(),
  },
}));

const lobbyApiMock = vi.mocked(lobbyApi);
const CURRENT_USER_ID = 101;
const TOKEN = "demo-token";
const DEFAULT_TIMESTAMP = "2026-03-08T00:00:00.000Z";
const LOBBY_ERROR_MESSAGE = "Unable to load your lobby right now.";
const TEAM_LOCKED_MESSAGE = "You are the only member of that team.";
const ORG_LOCKED_MESSAGE = "You are the only member of that organization.";

function createProject(overrides: Partial<{
  description: string | null;
  id: number;
  name: string;
}> = {}) {
  return {
    createdAt: DEFAULT_TIMESTAMP,
    description: "Delivery pipeline",
    id: 1,
    name: "Apollo",
    updatedAt: DEFAULT_TIMESTAMP,
    ...overrides,
  };
}

function createTeam(overrides: Partial<{
  description: string | null;
  id: number;
  name: string;
}> = {}) {
  return {
    createdAt: DEFAULT_TIMESTAMP,
    description: "Operations squad",
    id: 11,
    name: "Operators",
    updatedAt: DEFAULT_TIMESTAMP,
    ...overrides,
  };
}

function createOrganization(overrides: Partial<{
  description: string | null;
  id: number;
  name: string;
}> = {}) {
  return {
    createdAt: DEFAULT_TIMESTAMP,
    description: "Shared org",
    id: 21,
    name: "Giganttic Org",
    updatedAt: DEFAULT_TIMESTAMP,
    ...overrides,
  };
}

function createTeamMember(overrides: Partial<{
  roleCodes: string[];
  userId: number;
  username: string;
}> = {}) {
  return {
    roleCodes: [],
    userId: CURRENT_USER_ID,
    username: "demo-user",
    ...overrides,
  };
}

function createOrganizationMember(overrides: Partial<{
  roleCodes: string[];
  userId: number;
  username: string;
}> = {}) {
  return {
    roleCodes: [],
    userId: CURRENT_USER_ID,
    username: "demo-user",
    ...overrides,
  };
}

function renderLobbyPage() {
  return renderWithTheme(
    <UserLobbyPage currentUserId={CURRENT_USER_ID} token={TOKEN} />,
  );
}

beforeEach(() => {
  lobbyApiMock.deleteProject.mockReset();
  lobbyApiMock.getOrganization.mockReset();
  lobbyApiMock.getTeam.mockReset();
  lobbyApiMock.listOrganizations.mockReset();
  lobbyApiMock.listProjects.mockReset();
  lobbyApiMock.listTeams.mockReset();
  lobbyApiMock.replaceOrganizationUsers.mockReset();
  lobbyApiMock.replaceTeamMembers.mockReset();

  lobbyApiMock.listProjects.mockResolvedValue({
    projects: [createProject()],
  });
  lobbyApiMock.listTeams.mockResolvedValue({
    teams: [createTeam()],
  });
  lobbyApiMock.listOrganizations.mockResolvedValue({
    organizations: [createOrganization()],
  });
});

describe("UserLobbyPage", () => {
  it("loads and renders lobby entities from all three lobby endpoints", async () => {
    renderLobbyPage();

    expect(await screen.findByText("Apollo")).toBeVisible();
    expect(screen.getByText("Operators")).toBeInTheDocument();
    expect(screen.getByText("Giganttic Org")).toBeInTheDocument();

    expect(lobbyApiMock.listProjects).toHaveBeenCalledWith(TOKEN);
    expect(lobbyApiMock.listTeams).toHaveBeenCalledWith(TOKEN);
    expect(lobbyApiMock.listOrganizations).toHaveBeenCalledWith(TOKEN);
  });

  it("shows the fallback lobby error message when initial loading fails", async () => {
    lobbyApiMock.listProjects.mockRejectedValue(new Error("network down"));

    renderLobbyPage();

    expect(await screen.findByText(LOBBY_ERROR_MESSAGE)).toBeVisible();
  });

  it("expands and collapses the projects section", async () => {
    const user = userEvent.setup();

    renderLobbyPage();

    expect(await screen.findByText("Apollo")).toBeVisible();
    const projectsButton = screen.getByRole("button", { name: /Projects/i });
    expect(projectsButton).toHaveAttribute("aria-expanded", "true");

    await user.click(projectsButton);

    await waitFor(() => {
      expect(projectsButton).toHaveAttribute("aria-expanded", "false");
    });
    expect(screen.getByText("Apollo")).not.toBeVisible();

    await user.click(projectsButton);

    await waitFor(() => {
      expect(projectsButton).toHaveAttribute("aria-expanded", "true");
    });
    expect(screen.getByText("Apollo")).toBeVisible();
  });

  it("deletes a project and removes it from the lobby list", async () => {
    const user = userEvent.setup();
    lobbyApiMock.deleteProject.mockResolvedValue({ deletedProjectId: 1 });

    renderLobbyPage();

    expect(await screen.findByText("Apollo")).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Delete" }));

    await waitFor(() => {
      expect(lobbyApiMock.deleteProject).toHaveBeenCalledWith(TOKEN, 1);
    });
    expect(screen.queryByText("Apollo")).not.toBeInTheDocument();
  });

  it("lets the current user leave a team when other members remain", async () => {
    const user = userEvent.setup();
    lobbyApiMock.getTeam.mockResolvedValue({
      members: [
        createTeamMember(),
        createTeamMember({
          roleCodes: ["GGTC_TEAMROLE_TEAM_MANAGER"],
          userId: 202,
          username: "other-user",
        }),
      ],
      team: createTeam(),
    });
    lobbyApiMock.replaceTeamMembers.mockResolvedValue({
      members: [createTeamMember({
        roleCodes: ["GGTC_TEAMROLE_TEAM_MANAGER"],
        userId: 202,
        username: "other-user",
      })],
      teamId: 11,
    });

    renderLobbyPage();

    await screen.findByText("Apollo");
    await user.click(screen.getByRole("button", { name: /^Teams$/i }));
    expect(await screen.findByText("Operators")).toBeVisible();

    await user.click(screen.getAllByRole("button", { name: "Leave" })[0]);

    await waitFor(() => {
      expect(lobbyApiMock.replaceTeamMembers).toHaveBeenCalledWith(TOKEN, 11, {
        members: [
          {
            roleCodes: ["GGTC_TEAMROLE_TEAM_MANAGER"],
            userId: 202,
          },
        ],
      });
    });
    expect(screen.queryByText("Operators")).not.toBeInTheDocument();
  });

  it("prevents leaving a single-member team and disables the leave action after warning", async () => {
    const user = userEvent.setup();
    lobbyApiMock.getTeam.mockResolvedValue({
      members: [createTeamMember()],
      team: createTeam(),
    });

    renderLobbyPage();

    await screen.findByText("Apollo");
    await user.click(screen.getByRole("button", { name: /^Teams$/i }));
    expect(await screen.findByText("Operators")).toBeVisible();

    const leaveTeamButton = screen.getAllByRole("button", { name: "Leave" })[0];
    await user.click(leaveTeamButton);

    expect(await screen.findByText(TEAM_LOCKED_MESSAGE)).toBeVisible();
    expect(lobbyApiMock.replaceTeamMembers).not.toHaveBeenCalled();
    expect(leaveTeamButton).toBeDisabled();
  });

  it("lets the current user leave an organization when other members remain", async () => {
    const user = userEvent.setup();
    lobbyApiMock.getOrganization.mockResolvedValue({
      members: [
        createOrganizationMember(),
        createOrganizationMember({
          roleCodes: ["GGTC_ORGANIZATIONROLE_ORGANIZATION_MANAGER"],
          userId: 303,
          username: "org-admin",
        }),
      ],
      organization: createOrganization(),
      projects: [],
      teams: [],
    });
    lobbyApiMock.replaceOrganizationUsers.mockResolvedValue({
      members: [createOrganizationMember({
        roleCodes: ["GGTC_ORGANIZATIONROLE_ORGANIZATION_MANAGER"],
        userId: 303,
        username: "org-admin",
      })],
      organizationId: 21,
    });

    renderLobbyPage();

    await screen.findByText("Apollo");
    await user.click(screen.getByRole("button", { name: /^Organizations$/i }));
    const orgCard = await screen.findByText("Giganttic Org").then((el) => el.closest(".MuiPaper-root") as HTMLElement);
    expect(orgCard).toBeTruthy();
    await user.click(within(orgCard).getByRole("button", { name: "Leave" }));

    await waitFor(() => {
      expect(lobbyApiMock.replaceOrganizationUsers).toHaveBeenCalledWith(TOKEN, 21, {
        members: [{ userId: 303 }],
      });
    });
    expect(screen.queryByText("Giganttic Org")).not.toBeInTheDocument();
  });

  it("prevents leaving a single-member organization and disables the leave action after warning", async () => {
    const user = userEvent.setup();
    lobbyApiMock.getOrganization.mockResolvedValue({
      members: [createOrganizationMember()],
      organization: createOrganization(),
      projects: [],
      teams: [],
    });

    renderLobbyPage();

    await screen.findByText("Apollo");
    await user.click(screen.getByRole("button", { name: /^Organizations$/i }));
    const orgCard = await screen.findByText("Giganttic Org").then((el) => el.closest(".MuiPaper-root") as HTMLElement);
    const leaveOrganizationButton = within(orgCard).getByRole("button", { name: "Leave" });
    await user.click(leaveOrganizationButton);

    expect(await screen.findByText(ORG_LOCKED_MESSAGE)).toBeVisible();
    expect(lobbyApiMock.replaceOrganizationUsers).not.toHaveBeenCalled();
    expect(leaveOrganizationButton).toBeDisabled();
  });

  it("shows the API error body when deleting a project fails", async () => {
    const user = userEvent.setup();
    lobbyApiMock.deleteProject.mockRejectedValue(new ApiError("http", "HTTP 409", {
      responseBody: "Project still has dependent work.",
      status: 409,
    }));

    renderLobbyPage();

    expect(await screen.findByText("Apollo")).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Delete" }));

    expect(
      await screen.findByText("Project still has dependent work."),
    ).toBeVisible();
    expect(screen.getByText("Apollo")).toBeVisible();
  });
});
