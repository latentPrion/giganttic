import React from "react";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithTheme } from "../../../test/render-with-theme.js";
import { lobbyApi } from "../../../lobby/api/lobby-api.js";
import { ProjectManagerTeamPage } from "./ProjectManagerTeamPage.js";

const navigateMock = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

vi.mock("../../../lobby/api/lobby-api.js", () => ({
  lobbyApi: {
    associateProjectTeam: vi.fn(),
    createProject: vi.fn(),
    deleteProject: vi.fn(),
    getTeam: vi.fn(),
    listUsers: vi.fn(),
    replaceTeamMembers: vi.fn(),
  },
}));

const lobbyApiMock = vi.mocked(lobbyApi);
const DEFAULT_CURRENT_USER_ID = 101;
const DEFAULT_TOKEN = "team-token";
const DEFAULT_TIMESTAMP = "2026-03-08T00:00:00.000Z";

function createTeamResponse() {
  return {
    members: [{
      roleCodes: ["GGTC_TEAMROLE_TEAM_MANAGER"],
      userId: 101,
      username: "demo-user",
    }],
    projects: [{
      createdAt: DEFAULT_TIMESTAMP,
      description: "Project description",
      id: 42,
      journal: "Project journal",
      name: "Project 42",
      updatedAt: DEFAULT_TIMESTAMP,
    }],
    team: {
      createdAt: DEFAULT_TIMESTAMP,
      description: "Team description",
      id: 7,
      name: "Team 7",
      updatedAt: DEFAULT_TIMESTAMP,
    },
    teamManagers: [{ userId: 101, username: "demo-user" }],
    teamProjectManagers: [{ userId: 202, username: "team-pm" }],
  };
}

describe("ProjectManagerTeamPage", () => {
  beforeEach(() => {
    navigateMock.mockReset();
    lobbyApiMock.associateProjectTeam.mockReset();
    lobbyApiMock.createProject.mockReset();
    lobbyApiMock.deleteProject.mockReset();
    lobbyApiMock.getTeam.mockReset();
    lobbyApiMock.listUsers.mockReset();
    lobbyApiMock.replaceTeamMembers.mockReset();
    lobbyApiMock.getTeam.mockResolvedValue(createTeamResponse());
    lobbyApiMock.listUsers.mockResolvedValue({
      users: [{
        createdAt: DEFAULT_TIMESTAMP,
        id: 404,
        isActive: true,
        updatedAt: DEFAULT_TIMESTAMP,
        username: "new-user",
      }],
    });
    lobbyApiMock.replaceTeamMembers.mockResolvedValue({
      members: [
        ...createTeamResponse().members,
        {
          roleCodes: [],
          userId: 404,
          username: "new-user",
        },
      ],
      teamId: 7,
    });
    lobbyApiMock.createProject.mockResolvedValue({
      project: {
        createdAt: DEFAULT_TIMESTAMP,
        description: "Created project",
        id: 55,
        journal: "Created journal",
        name: "Created Project",
        updatedAt: DEFAULT_TIMESTAMP,
      },
    });
    lobbyApiMock.associateProjectTeam.mockResolvedValue({
      projectId: 55,
      teams: [{
        createdAt: DEFAULT_TIMESTAMP,
        description: "Team description",
        id: 7,
        name: "Team 7",
        updatedAt: DEFAULT_TIMESTAMP,
      }],
    });
  });

  it("renders members, manager sections, and linked projects", async () => {
    renderWithTheme(
      <ProjectManagerTeamPage
        currentUserId={DEFAULT_CURRENT_USER_ID}
        teamId={7}
        token={DEFAULT_TOKEN}
      />,
    );

    expect(await screen.findByText("Team")).toBeVisible();
    expect(await screen.findByText("Team 7")).toBeVisible();
    expect(screen.getByText("Members")).toBeVisible();
    expect(screen.getByText("Current Team Managers")).toBeVisible();
    expect(screen.getByText("Current Team Project Managers")).toBeVisible();
    expect(screen.getByText("Current Projects")).toBeVisible();
    expect(screen.getByText("Project 42")).toBeVisible();
  });

  it("creates a project and associates it to the viewed team", async () => {
    const user = userEvent.setup();

    renderWithTheme(
      <ProjectManagerTeamPage
        currentUserId={DEFAULT_CURRENT_USER_ID}
        teamId={7}
        token={DEFAULT_TOKEN}
      />,
    );

    await user.click(await screen.findByRole("button", { name: "Create Project" }));
    await user.type(await screen.findByLabelText("Name"), "Created Project");
    await user.click(screen.getByRole("button", { name: "Create Project" }));

    await waitFor(() => {
      expect(lobbyApiMock.associateProjectTeam).toHaveBeenCalledWith(DEFAULT_TOKEN, 55, {
        teamId: 7,
      });
    });
    expect(navigateMock).toHaveBeenCalledWith("/pm/project?projectId=55");
  });

  it("navigates to the PM user route from a team member row", async () => {
    const user = userEvent.setup();

    renderWithTheme(
      <ProjectManagerTeamPage
        currentUserId={DEFAULT_CURRENT_USER_ID}
        teamId={7}
        token={DEFAULT_TOKEN}
      />,
    );

    const userButtons = await screen.findAllByRole("button", { name: /demo-user/i });
    await user.click(userButtons[0]!);

    expect(navigateMock).toHaveBeenCalledWith("/pm/user?userId=101");
  });

  it("adds a member user when the current user can manage the team", async () => {
    const user = userEvent.setup();

    renderWithTheme(
      <ProjectManagerTeamPage
        currentUserId={DEFAULT_CURRENT_USER_ID}
        teamId={7}
        token={DEFAULT_TOKEN}
      />,
    );

    await user.click(await screen.findByRole("button", { name: "Add Member User" }));
    await waitFor(() => {
      expect(
        within(screen.getByRole("dialog", { name: "Add Member User" }))
          .getByRole("button", { name: "Add Member User" }),
      ).toBeEnabled();
    });
    await user.click(
      within(screen.getByRole("dialog", { name: "Add Member User" }))
        .getByRole("button", { name: "Add Member User" }),
    );

    await waitFor(() => {
      expect(lobbyApiMock.replaceTeamMembers).toHaveBeenCalledWith(
        DEFAULT_TOKEN,
        7,
        {
          members: [
            {
              roleCodes: ["GGTC_TEAMROLE_TEAM_MANAGER"],
              userId: 101,
            },
            {
              roleCodes: [],
              userId: 404,
            },
          ],
        },
      );
    });
  });

  it("hides the add member user button when the current user cannot manage the team", async () => {
    renderWithTheme(
      <ProjectManagerTeamPage
        currentUserId={999}
        teamId={7}
        token={DEFAULT_TOKEN}
      />,
    );

    expect(await screen.findByText("Team 7")).toBeVisible();
    expect(screen.queryByRole("button", { name: "Add Member User" })).not.toBeInTheDocument();
  });
});
