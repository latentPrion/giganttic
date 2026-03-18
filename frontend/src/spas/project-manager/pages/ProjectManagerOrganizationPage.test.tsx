import React from "react";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithTheme } from "../../../test/render-with-theme.js";
import { lobbyApi } from "../../../lobby/api/lobby-api.js";
import { ProjectManagerOrganizationPage } from "./ProjectManagerOrganizationPage.js";

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
    assignOrganizationTeam: vi.fn(),
    associateProjectOrganization: vi.fn(),
    createProject: vi.fn(),
    createTeam: vi.fn(),
    deleteProject: vi.fn(),
    deleteTeam: vi.fn(),
    getOrganization: vi.fn(),
    listTeams: vi.fn(),
    listUsers: vi.fn(),
    replaceOrganizationUsers: vi.fn(),
    unassignOrganizationTeam: vi.fn(),
  },
}));

const lobbyApiMock = vi.mocked(lobbyApi);
const DEFAULT_CURRENT_USER_ID = 101;
const DEFAULT_TOKEN = "organization-token";
const DEFAULT_TIMESTAMP = "2026-03-08T00:00:00.000Z";

function createOrganizationResponse() {
  return {
    members: [{
      roleCodes: ["GGTC_ORGANIZATIONROLE_ORGANIZATION_MANAGER"],
      userId: 101,
      username: "demo-user",
    }],
    organization: {
      createdAt: DEFAULT_TIMESTAMP,
      description: "Organization description",
      id: 9,
      name: "Org 9",
      updatedAt: DEFAULT_TIMESTAMP,
    },
    organizationManagers: [{ userId: 101, username: "demo-user" }],
    organizationProjectManagers: [{ userId: 202, username: "org-pm" }],
    organizationTeamManagers: [{ userId: 303, username: "org-tm" }],
    projects: [{
      createdAt: DEFAULT_TIMESTAMP,
      description: "Project description",
      id: 42,
      journal: "Project journal",
      name: "Project 42",
      updatedAt: DEFAULT_TIMESTAMP,
    }],
    teams: [{
      createdAt: DEFAULT_TIMESTAMP,
      description: "Team description",
      id: 7,
      name: "Team 7",
      updatedAt: DEFAULT_TIMESTAMP,
    }],
  };
}

describe("ProjectManagerOrganizationPage", () => {
  beforeEach(() => {
    navigateMock.mockReset();
    lobbyApiMock.assignOrganizationTeam.mockReset();
    lobbyApiMock.associateProjectOrganization.mockReset();
    lobbyApiMock.createProject.mockReset();
    lobbyApiMock.createTeam.mockReset();
    lobbyApiMock.deleteProject.mockReset();
    lobbyApiMock.deleteTeam.mockReset();
    lobbyApiMock.getOrganization.mockReset();
    lobbyApiMock.listTeams.mockReset();
    lobbyApiMock.listUsers.mockReset();
    lobbyApiMock.replaceOrganizationUsers.mockReset();
    lobbyApiMock.unassignOrganizationTeam.mockReset();
    lobbyApiMock.getOrganization.mockResolvedValue(createOrganizationResponse());
    lobbyApiMock.listTeams.mockResolvedValue({
      teams: [{
        createdAt: DEFAULT_TIMESTAMP,
        description: "Team description",
        id: 12,
        name: "Team 12",
        updatedAt: DEFAULT_TIMESTAMP,
      }],
    });
    lobbyApiMock.listUsers.mockResolvedValue({
      users: [{
        createdAt: DEFAULT_TIMESTAMP,
        id: 404,
        isActive: true,
        updatedAt: DEFAULT_TIMESTAMP,
        username: "new-user",
      }],
    });
    lobbyApiMock.replaceOrganizationUsers.mockResolvedValue({
      members: [
        ...createOrganizationResponse().members,
        {
          roleCodes: [],
          userId: 404,
          username: "new-user",
        },
      ],
      organizationId: 9,
    });
    lobbyApiMock.assignOrganizationTeam.mockResolvedValue({
      organizationId: 9,
      teams: [
        ...createOrganizationResponse().teams,
        {
          createdAt: DEFAULT_TIMESTAMP,
          description: "Team description",
          id: 12,
          name: "Team 12",
          updatedAt: DEFAULT_TIMESTAMP,
        },
      ],
    });
    lobbyApiMock.unassignOrganizationTeam.mockResolvedValue({
      organizationId: 9,
      teams: [],
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
    lobbyApiMock.createTeam.mockResolvedValue({
      team: {
        createdAt: DEFAULT_TIMESTAMP,
        description: "Created team",
        id: 55,
        name: "Created Team",
        updatedAt: DEFAULT_TIMESTAMP,
      },
    });
    lobbyApiMock.associateProjectOrganization.mockResolvedValue({
      organizations: [{
        createdAt: DEFAULT_TIMESTAMP,
        description: "Organization description",
        id: 9,
        name: "Org 9",
        updatedAt: DEFAULT_TIMESTAMP,
      }],
      projectId: 55,
    });
  });

  it("renders members, manager sections, linked projects, and linked teams", async () => {
    renderWithTheme(
      <ProjectManagerOrganizationPage
        currentUserId={DEFAULT_CURRENT_USER_ID}
        organizationId={9}
        token={DEFAULT_TOKEN}
      />,
    );

    expect(await screen.findByText("Organization")).toBeVisible();
    expect(await screen.findByText("Org 9")).toBeVisible();
    expect(screen.getByText("Members")).toBeVisible();
    expect(screen.getByText("Current Organization Managers")).toBeVisible();
    expect(screen.getByText("Current Organization Project Managers")).toBeVisible();
    expect(screen.getByText("Current Organization Team Managers")).toBeVisible();
    expect(screen.getByText("Current Projects")).toBeVisible();
    expect(screen.getByText("Current Teams")).toBeVisible();
  });

  it("creates a project and associates it to the viewed organization", async () => {
    const user = userEvent.setup();

    renderWithTheme(
      <ProjectManagerOrganizationPage
        currentUserId={DEFAULT_CURRENT_USER_ID}
        organizationId={9}
        token={DEFAULT_TOKEN}
      />,
    );

    await user.click(await screen.findByRole("button", { name: "Create Project" }));
    await user.type(await screen.findByLabelText("Name"), "Created Project");
    await user.click(screen.getByRole("button", { name: "Create Project" }));

    await waitFor(() => {
      expect(lobbyApiMock.associateProjectOrganization).toHaveBeenCalledWith(
        DEFAULT_TOKEN,
        55,
        {
          organizationId: 9,
        },
      );
    });
    expect(navigateMock).toHaveBeenCalledWith("/pm/project?projectId=55");
  });

  it("creates a team and associates it to the viewed organization when the current user is an organization manager", async () => {
    const user = userEvent.setup();

    renderWithTheme(
      <ProjectManagerOrganizationPage
        currentUserId={DEFAULT_CURRENT_USER_ID}
        organizationId={9}
        token={DEFAULT_TOKEN}
      />,
    );

    await user.click(await screen.findByRole("button", { name: "Create Team" }));
    await user.type(await screen.findByLabelText("Name"), "Created Team");
    await user.click(screen.getByRole("button", { name: "Create Team" }));

    await waitFor(() => {
      expect(lobbyApiMock.createTeam).toHaveBeenCalledWith(DEFAULT_TOKEN, {
        description: null,
        name: "Created Team",
      });
    });
    await waitFor(() => {
      expect(lobbyApiMock.assignOrganizationTeam).toHaveBeenCalledWith(
        DEFAULT_TOKEN,
        9,
        {
          teamId: 55,
        },
      );
    });
  });

  it("navigates to the PM user route from an organization member row", async () => {
    const user = userEvent.setup();

    renderWithTheme(
      <ProjectManagerOrganizationPage
        currentUserId={DEFAULT_CURRENT_USER_ID}
        organizationId={9}
        token={DEFAULT_TOKEN}
      />,
    );

    const userButtons = await screen.findAllByRole("button", { name: /demo-user/i });
    await user.click(userButtons[0]!);

    expect(navigateMock).toHaveBeenCalledWith("/pm/user?userId=101");
  });

  it("adds a member user and a member team when the current user can manage the organization", async () => {
    const user = userEvent.setup();

    renderWithTheme(
      <ProjectManagerOrganizationPage
        currentUserId={DEFAULT_CURRENT_USER_ID}
        organizationId={9}
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
      expect(lobbyApiMock.replaceOrganizationUsers).toHaveBeenCalledWith(
        DEFAULT_TOKEN,
        9,
        {
          members: [
            { userId: 101 },
            { userId: 404 },
          ],
        },
      );
    });

    await user.click(await screen.findByRole("button", { name: "Add Member Team" }));
    await waitFor(() => {
      expect(
        within(screen.getByRole("dialog", { name: "Add Member Team" }))
          .getByRole("button", { name: "Add Member Team" }),
      ).toBeEnabled();
    });
    await user.click(
      within(screen.getByRole("dialog", { name: "Add Member Team" }))
        .getByRole("button", { name: "Add Member Team" }),
    );

    await waitFor(() => {
      expect(lobbyApiMock.assignOrganizationTeam).toHaveBeenCalledWith(
        DEFAULT_TOKEN,
        9,
        { teamId: 12 },
      );
    });
  });

  it("hides membership action buttons when the current user cannot manage the organization", async () => {
    renderWithTheme(
      <ProjectManagerOrganizationPage
        currentUserId={999}
        organizationId={9}
        token={DEFAULT_TOKEN}
      />,
    );

    expect(await screen.findByText("Org 9")).toBeVisible();
    expect(screen.queryByRole("button", { name: "Add Member User" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add Member Team" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Create Team" })).not.toBeInTheDocument();
  });

  it("removes a member user and a member team when the current user can manage the organization", async () => {
    const user = userEvent.setup();
    lobbyApiMock.getOrganization.mockResolvedValueOnce({
      ...createOrganizationResponse(),
      members: [
        ...createOrganizationResponse().members,
        {
          roleCodes: [],
          userId: 202,
          username: "removable-user",
        },
      ],
    });
    lobbyApiMock.replaceOrganizationUsers.mockResolvedValueOnce({
      members: createOrganizationResponse().members,
      organizationId: 9,
    });

    renderWithTheme(
      <ProjectManagerOrganizationPage
        currentUserId={DEFAULT_CURRENT_USER_ID}
        organizationId={9}
        token={DEFAULT_TOKEN}
      />,
    );

    const memberRow = (await screen.findByRole("button", { name: /removable-user/i }))
      .closest(".MuiPaper-root");
    expect(memberRow).not.toBeNull();
    await user.click(within(memberRow as HTMLElement).getByRole("button", { name: "Remove" }));

    await waitFor(() => {
      expect(lobbyApiMock.replaceOrganizationUsers).toHaveBeenCalledWith(
        DEFAULT_TOKEN,
        9,
        {
          members: [
            { userId: 101 },
          ],
        },
      );
    });

    const teamRow = screen.getByText("Team 7").closest(".MuiPaper-root");
    expect(teamRow).not.toBeNull();
    await user.click(within(teamRow as HTMLElement).getByRole("button", { name: "Remove" }));

    await waitFor(() => {
      expect(lobbyApiMock.unassignOrganizationTeam).toHaveBeenCalledWith(
        DEFAULT_TOKEN,
        9,
        7,
      );
    });
  });
});
