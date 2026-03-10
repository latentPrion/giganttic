import React from "react";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "../../common/api/api-error.js";
import { renderWithTheme } from "../../test/render-with-theme.js";
import { lobbyApi } from "../api/lobby-api.js";
import type { ProjectManagerSource } from "../contracts/lobby.contracts.js";
import { UserLobbyPage } from "./UserLobbyPage.js";

const navigateMock = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

vi.mock("../api/lobby-api.js", () => ({
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

const lobbyApiMock = vi.mocked(lobbyApi);
const CURRENT_USER_ID = 101;
const TOKEN = "demo-token";
const DEFAULT_TIMESTAMP = "2026-03-08T00:00:00.000Z";
const LOBBY_ERROR_MESSAGE = "Unable to load your lobby right now.";

function createProjectManagerSources(
  ...sourceKinds: ProjectManagerSource[]
): ProjectManagerSource[] {
  return [...sourceKinds];
}

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

function createProjectMember(overrides: Partial<{
  roleCodes: string[];
  userId: number;
  username: string;
}> = {}) {
  return {
    roleCodes: ["GGTC_PROJECTROLE_PROJECT_MANAGER"],
    userId: CURRENT_USER_ID,
    username: "demo-user",
    ...overrides,
  };
}

function createProjectDetailResponse(overrides: Partial<{
  members: Array<{
    roleCodes: string[];
    userId: number;
    username: string;
  }>;
  organizations: ReturnType<typeof createOrganization>[];
  project: ReturnType<typeof createProject>;
  projectManagers: Array<{
    sourceKinds: Array<"direct" | "org" | "team">;
    userId: number;
    username: string;
  }>;
  teams: ReturnType<typeof createTeam>[];
}> = {}) {
  return {
    members: [
      createProjectMember(),
      createProjectMember({
        roleCodes: [],
        userId: 202,
        username: "reviewer",
      }),
    ],
    organizations: [createOrganization()],
    project: createProject(),
    projectManagers: [{
      sourceKinds: createProjectManagerSources("direct"),
      userId: CURRENT_USER_ID,
      username: "demo-user",
    }],
    teams: [createTeam()],
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

function createTeamDetailResponse(overrides: Partial<{
  members: Array<{
    roleCodes: string[];
    userId: number;
    username: string;
  }>;
  team: ReturnType<typeof createTeam>;
}> = {}) {
  return {
    members: [
      createTeamMember({
        roleCodes: ["GGTC_TEAMROLE_TEAM_MANAGER"],
      }),
      createTeamMember({
        roleCodes: [],
        userId: 202,
        username: "ops-user",
      }),
    ],
    team: createTeam(),
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

function createOrganizationDetailResponse(overrides: Partial<{
  members: Array<{
    roleCodes: string[];
    userId: number;
    username: string;
  }>;
  organization: ReturnType<typeof createOrganization>;
  projects: Array<{ projectId: number }>;
  teams: Array<{ teamId: number }>;
}> = {}) {
  return {
    members: [
      createOrganizationMember({
        roleCodes: ["GGTC_ORGANIZATIONROLE_ORGANIZATION_MANAGER"],
      }),
      createOrganizationMember({
        roleCodes: [],
        userId: 303,
        username: "org-user",
      }),
    ],
    organization: createOrganization(),
    projects: [{ projectId: 1 }],
    teams: [{ teamId: 11 }],
    ...overrides,
  };
}

function renderLobbyPage() {
  return renderWithTheme(
    <UserLobbyPage currentUserId={CURRENT_USER_ID} token={TOKEN} />,
  );
}

async function openProjectsSection(): Promise<void> {
  await screen.findByText("Apollo");
}

async function openTeamsSection(user: ReturnType<typeof userEvent.setup>): Promise<void> {
  await openProjectsSection();
  await user.click(screen.getByRole("button", { name: /^Teams$/i }));
  expect(await screen.findByText("Operators")).toBeVisible();
}

async function openOrganizationsSection(user: ReturnType<typeof userEvent.setup>): Promise<void> {
  await openProjectsSection();
  await user.click(screen.getByRole("button", { name: /^Organizations$/i }));
  expect(await screen.findByText("Giganttic Org")).toBeVisible();
}

async function findOrganizationCard(): Promise<HTMLElement> {
  return await screen.findByText("Giganttic Org").then((element) =>
    element.closest(".MuiPaper-root") as HTMLElement
  );
}

beforeEach(() => {
  navigateMock.mockReset();
  lobbyApiMock.createOrganization.mockReset();
  lobbyApiMock.createProject.mockReset();
  lobbyApiMock.createTeam.mockReset();
  lobbyApiMock.deleteOrganization.mockReset();
  lobbyApiMock.deleteProject.mockReset();
  lobbyApiMock.deleteTeam.mockReset();
  lobbyApiMock.getOrganization.mockReset();
  lobbyApiMock.getProject.mockReset();
  lobbyApiMock.getTeam.mockReset();
  lobbyApiMock.listOrganizations.mockReset();
  lobbyApiMock.listProjects.mockReset();
  lobbyApiMock.listTeams.mockReset();
  lobbyApiMock.replaceOrganizationUsers.mockReset();
  lobbyApiMock.replaceTeamMembers.mockReset();
  lobbyApiMock.updateOrganization.mockReset();
  lobbyApiMock.updateProject.mockReset();
  lobbyApiMock.updateTeam.mockReset();

  lobbyApiMock.createOrganization.mockResolvedValue({
    organization: createOrganization({ id: 29, name: "Created Org" }),
  });
  lobbyApiMock.createProject.mockResolvedValue({
    project: createProject({ id: 9, name: "Created Project" }),
  });
  lobbyApiMock.createTeam.mockResolvedValue({
    team: createTeam({ id: 19, name: "Created Team" }),
  });
  lobbyApiMock.getOrganization.mockResolvedValue(createOrganizationDetailResponse());
  lobbyApiMock.getProject.mockResolvedValue(createProjectDetailResponse());
  lobbyApiMock.getTeam.mockResolvedValue(createTeamDetailResponse());
  lobbyApiMock.listProjects.mockResolvedValue({
    projects: [createProject()],
  });
  lobbyApiMock.listTeams.mockResolvedValue({
    teams: [createTeam()],
  });
  lobbyApiMock.listOrganizations.mockResolvedValue({
    organizations: [createOrganization()],
  });
  lobbyApiMock.updateProject.mockResolvedValue({
    project: createProject({
      description: "Updated description",
      name: "Apollo Prime",
    }),
  });
  lobbyApiMock.updateTeam.mockResolvedValue({
    team: createTeam({
      description: "Updated team description",
      name: "Operators Prime",
    }),
  });
  lobbyApiMock.updateOrganization.mockResolvedValue({
    organization: createOrganization({
      description: "Updated organization description",
      name: "Giganttic Org Prime",
    }),
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

  it("renders each lobby section list inside an entity item list container using main-listing-view", async () => {
    const user = userEvent.setup();

    renderLobbyPage();

    await openProjectsSection();
    await openTeamsSection(user);
    await openOrganizationsSection(user);

    const entityLists = document.querySelectorAll('[data-entity-item-list="true"]');
    expect(entityLists).toHaveLength(3);
    entityLists.forEach((entityList) => {
      expect(entityList).toHaveAttribute("data-view-mode", "main-listing-view");
    });
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
    const projectsButton = screen.getByRole("button", { name: /^Projects$/i });
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

  it("navigates to the PM project route when the project row is clicked", async () => {
    const user = userEvent.setup();

    renderLobbyPage();

    await user.click(await screen.findByRole("button", { name: /Apollo/i }));

    expect(navigateMock).toHaveBeenCalledWith("/pm/project?projectId=1");
  });

  it("opens a project summary modal from the view button", async () => {
    const user = userEvent.setup();

    renderLobbyPage();

    await user.click((await screen.findAllByRole("button", { name: "View" }))[0]!);

    expect(await screen.findByRole("heading", { name: "Project Summary" })).toBeVisible();
    expect(await screen.findByText("Members: 2")).toBeVisible();
    expect(await screen.findByText("demo-user (GGTC_PROJECTROLE_PROJECT_MANAGER)")).toBeVisible();
    expect(lobbyApiMock.getProject).toHaveBeenCalledWith(TOKEN, 1);
  });

  it("opens the create project modal from the section header button and creates a project", async () => {
    const user = userEvent.setup();

    renderLobbyPage();

    await openProjectsSection();
    await user.click(screen.getByRole("button", { name: "Create Project" }));

    expect(await screen.findByRole("heading", { name: "Create Project" })).toBeVisible();
    const nameInput = screen.getByLabelText("Name");
    await user.type(nameInput, "Zeus");
    await user.type(screen.getByLabelText("Description"), "Fresh project");
    nameInput.focus();
    await user.keyboard("{Enter}");

    await waitFor(() => {
      expect(lobbyApiMock.createProject).toHaveBeenCalledWith(TOKEN, {
        description: "Fresh project",
        name: "Zeus",
      });
    });
    expect(await screen.findByText("Created Project")).toBeVisible();
  });

  it("autofocuses the first field in the create project modal", async () => {
    const user = userEvent.setup();

    renderLobbyPage();

    await openProjectsSection();
    await user.click(screen.getByRole("button", { name: "Create Project" }));

    expect(await screen.findByLabelText("Name")).toHaveFocus();
  });

  it("opens the edit modal from the reusable edit button and updates the project row", async () => {
    const user = userEvent.setup();

    renderLobbyPage();

    await openProjectsSection();
    await user.click(screen.getByRole("button", { name: "Edit" }));

    const nameInput = await screen.findByLabelText("Name");
    expect(nameInput).toHaveValue("Apollo");
    await user.clear(nameInput);
    await user.type(nameInput, "Apollo Prime");
    const descriptionInput = screen.getByLabelText("Description");
    await user.clear(descriptionInput);
    await user.type(descriptionInput, "Updated description");
    nameInput.focus();
    await user.keyboard("{Enter}");

    await waitFor(() => {
      expect(lobbyApiMock.updateProject).toHaveBeenCalledWith(TOKEN, 1, {
        description: "Updated description",
        name: "Apollo Prime",
      });
    });

    expect(await screen.findByText("Apollo Prime")).toBeVisible();
  });

  it("autofocuses the first field in the edit project modal", async () => {
    const user = userEvent.setup();

    renderLobbyPage();

    await openProjectsSection();
    await user.click(screen.getByRole("button", { name: "Edit" }));

    expect(await screen.findByLabelText("Name")).toHaveFocus();
  });

  it("refreshes project summary data after editing the same project", async () => {
    const user = userEvent.setup();
    lobbyApiMock.getProject
      .mockResolvedValueOnce(createProjectDetailResponse())
      .mockResolvedValueOnce(createProjectDetailResponse({
        members: [
          createProjectMember({
            username: "updated-manager",
          }),
        ],
        project: createProject({
          description: "Updated description",
          name: "Apollo Prime",
        }),
      }));

    renderLobbyPage();

    await openProjectsSection();
    await user.click((await screen.findAllByRole("button", { name: "View" }))[0]!);
    expect(await screen.findByText("demo-user (GGTC_PROJECTROLE_PROJECT_MANAGER)")).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Close" }));
    await waitFor(() => {
      expect(
        screen.queryByRole("heading", { name: "Project Summary" }),
      ).not.toBeInTheDocument();
    });
    await user.click(screen.getByRole("button", { name: "Edit" }));

    const nameInput = await screen.findByLabelText("Name");
    await user.clear(nameInput);
    await user.type(nameInput, "Apollo Prime");
    const descriptionInput = screen.getByLabelText("Description");
    await user.clear(descriptionInput);
    await user.type(descriptionInput, "Updated description");
    nameInput.focus();
    await user.keyboard("{Enter}");

    await user.click((await screen.findAllByRole("button", { name: "View" }))[0]!);

    expect(await screen.findByText("updated-manager (GGTC_PROJECTROLE_PROJECT_MANAGER)")).toBeVisible();
    expect(lobbyApiMock.getProject).toHaveBeenCalledTimes(2);
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

  it("renders modal failure feedback when project creation fails", async () => {
    const user = userEvent.setup();
    lobbyApiMock.createProject.mockRejectedValue(new ApiError("http", "HTTP 409", {
      responseBody: "Project name already exists.",
      status: 409,
    }));

    renderLobbyPage();

    await openProjectsSection();
    await user.click(screen.getByRole("button", { name: "Create Project" }));
    const nameInput = await screen.findByLabelText("Name");
    await user.type(nameInput, "Apollo");
    nameInput.focus();
    await user.keyboard("{Enter}");

    expect((await screen.findAllByText("Project name already exists.")).length).toBeGreaterThan(0);
  });

  it("renders modal failure feedback when project editing fails", async () => {
    const user = userEvent.setup();
    lobbyApiMock.updateProject.mockRejectedValue(new ApiError("http", "HTTP 409", {
      responseBody: "Project update failed.",
      status: 409,
    }));

    renderLobbyPage();

    await openProjectsSection();
    await user.click(screen.getByRole("button", { name: "Edit" }));
    const nameInput = await screen.findByLabelText("Name");
    nameInput.focus();
    await user.keyboard("{Enter}");

    expect((await screen.findAllByText("Project update failed.")).length).toBeGreaterThan(0);
  });

  it("opens a team summary modal from the view button", async () => {
    const user = userEvent.setup();

    renderLobbyPage();

    await openTeamsSection(user);
    await user.click(screen.getAllByRole("button", { name: "View" })[1]!);
    expect(await screen.findByRole("heading", { name: "Team Summary" })).toBeVisible();
    expect(await screen.findByText("Members: 2")).toBeVisible();
    expect(await screen.findByText("demo-user (GGTC_TEAMROLE_TEAM_MANAGER)")).toBeVisible();
    expect(lobbyApiMock.getTeam).toHaveBeenCalledWith(TOKEN, 11);
  });

  it("opens an organization summary modal from the view button", async () => {
    const user = userEvent.setup();

    renderLobbyPage();

    await openOrganizationsSection(user);
    await user.click(screen.getAllByRole("button", { name: "View" })[1]!);
    expect(await screen.findByRole("heading", { name: "Organization Summary" })).toBeVisible();
    expect(await screen.findByText("Members: 2")).toBeVisible();
    expect(await screen.findByText("Projects: 1")).toBeVisible();
    expect(await screen.findByText("Teams: 1")).toBeVisible();
    expect(lobbyApiMock.getOrganization).toHaveBeenCalledWith(TOKEN, 21);
  });

  it("opens the create team modal and creates a team", async () => {
    const user = userEvent.setup();

    renderLobbyPage();

    await openTeamsSection(user);
    await user.click(screen.getByRole("button", { name: "Create Team" }));
    expect(await screen.findByRole("heading", { name: "Create Team" })).toBeVisible();
    const nameInput = screen.getByLabelText("Name");
    await user.type(nameInput, "New Team");
    await user.type(screen.getByLabelText("Description"), "Team details");
    nameInput.focus();
    await user.keyboard("{Enter}");

    await waitFor(() => {
      expect(lobbyApiMock.createTeam).toHaveBeenCalledWith(TOKEN, {
        description: "Team details",
        name: "New Team",
      });
    });
    expect(await screen.findByText("Created Team")).toBeVisible();
  });

  it("autofocuses the first field in the create team modal", async () => {
    const user = userEvent.setup();

    renderLobbyPage();

    await openTeamsSection(user);
    await user.click(screen.getByRole("button", { name: "Create Team" }));

    expect(await screen.findByLabelText("Name")).toHaveFocus();
  });

  it("opens the edit team modal and updates the team row", async () => {
    const user = userEvent.setup();

    renderLobbyPage();

    await openTeamsSection(user);
    await user.click(screen.getAllByRole("button", { name: "Edit" })[1]!);

    const nameInput = await screen.findByLabelText("Name");
    expect(nameInput).toHaveValue("Operators");
    await user.clear(nameInput);
    await user.type(nameInput, "Operators Prime");
    const descriptionInput = screen.getByLabelText("Description");
    await user.clear(descriptionInput);
    await user.type(descriptionInput, "Updated team description");
    nameInput.focus();
    await user.keyboard("{Enter}");

    await waitFor(() => {
      expect(lobbyApiMock.updateTeam).toHaveBeenCalledWith(TOKEN, 11, {
        description: "Updated team description",
        name: "Operators Prime",
      });
    });
    expect(await screen.findByText("Operators Prime")).toBeVisible();
  });

  it("autofocuses the first field in the edit team modal", async () => {
    const user = userEvent.setup();

    renderLobbyPage();

    await openTeamsSection(user);
    await user.click(screen.getAllByRole("button", { name: "Edit" })[1]!);

    expect(await screen.findByLabelText("Name")).toHaveFocus();
  });

  it("deletes a team and removes it from the lobby list", async () => {
    const user = userEvent.setup();
    lobbyApiMock.deleteTeam.mockResolvedValue({ deletedTeamId: 11 });

    renderLobbyPage();

    await openTeamsSection(user);
    await user.click(screen.getAllByRole("button", { name: "Delete" })[1]!);

    await waitFor(() => {
      expect(lobbyApiMock.deleteTeam).toHaveBeenCalledWith(TOKEN, 11);
    });
    expect(screen.queryByText("Operators")).not.toBeInTheDocument();
  });

  it("renders modal failure feedback when team creation fails", async () => {
    const user = userEvent.setup();
    lobbyApiMock.createTeam.mockRejectedValue(new ApiError("http", "HTTP 409", {
      responseBody: "Team name already exists.",
      status: 409,
    }));

    renderLobbyPage();

    await openTeamsSection(user);
    await user.click(screen.getByRole("button", { name: "Create Team" }));
    const nameInput = await screen.findByLabelText("Name");
    await user.type(nameInput, "Operators");
    nameInput.focus();
    await user.keyboard("{Enter}");

    expect((await screen.findAllByText("Team name already exists.")).length).toBeGreaterThan(0);
  });

  it("renders modal failure feedback when team editing fails", async () => {
    const user = userEvent.setup();
    lobbyApiMock.updateTeam.mockRejectedValue(new ApiError("http", "HTTP 409", {
      responseBody: "Team update failed.",
      status: 409,
    }));

    renderLobbyPage();

    await openTeamsSection(user);
    await user.click(screen.getAllByRole("button", { name: "Edit" })[1]!);
    const nameInput = await screen.findByLabelText("Name");
    nameInput.focus();
    await user.keyboard("{Enter}");

    expect((await screen.findAllByText("Team update failed.")).length).toBeGreaterThan(0);
  });

  it("opens the create organization modal and creates an organization", async () => {
    const user = userEvent.setup();

    renderLobbyPage();

    await openOrganizationsSection(user);
    await user.click(screen.getByRole("button", { name: "Create Organization" }));
    expect(await screen.findByRole("heading", { name: "Create Organization" })).toBeVisible();
    const nameInput = screen.getByLabelText("Name");
    await user.type(nameInput, "New Organization");
    await user.type(screen.getByLabelText("Description"), "Organization details");
    nameInput.focus();
    await user.keyboard("{Enter}");

    await waitFor(() => {
      expect(lobbyApiMock.createOrganization).toHaveBeenCalledWith(TOKEN, {
        description: "Organization details",
        name: "New Organization",
      });
    });
    expect(await screen.findByText("Created Org")).toBeVisible();
  });

  it("autofocuses the first field in the create organization modal", async () => {
    const user = userEvent.setup();

    renderLobbyPage();

    await openOrganizationsSection(user);
    await user.click(screen.getByRole("button", { name: "Create Organization" }));

    expect(await screen.findByLabelText("Name")).toHaveFocus();
  });

  it("opens the edit organization modal and updates the organization row", async () => {
    const user = userEvent.setup();

    renderLobbyPage();

    await openOrganizationsSection(user);
    await user.click(within(await findOrganizationCard()).getByRole("button", { name: "Edit" }));

    const nameInput = await screen.findByLabelText("Name");
    expect(nameInput).toHaveValue("Giganttic Org");
    await user.clear(nameInput);
    await user.type(nameInput, "Giganttic Org Prime");
    const descriptionInput = screen.getByLabelText("Description");
    await user.clear(descriptionInput);
    await user.type(descriptionInput, "Updated organization description");
    nameInput.focus();
    await user.keyboard("{Enter}");

    await waitFor(() => {
      expect(lobbyApiMock.updateOrganization).toHaveBeenCalledWith(TOKEN, 21, {
        description: "Updated organization description",
        name: "Giganttic Org Prime",
      });
    });
    expect(await screen.findByText("Giganttic Org Prime")).toBeVisible();
  });

  it("autofocuses the first field in the edit organization modal", async () => {
    const user = userEvent.setup();

    renderLobbyPage();

    await openOrganizationsSection(user);
    await user.click(within(await findOrganizationCard()).getByRole("button", { name: "Edit" }));

    expect(await screen.findByLabelText("Name")).toHaveFocus();
  });

  it("deletes an organization and removes it from the lobby list", async () => {
    const user = userEvent.setup();
    lobbyApiMock.deleteOrganization.mockResolvedValue({ deletedOrganizationId: 21 });

    renderLobbyPage();

    await openOrganizationsSection(user);
    await user.click(within(await findOrganizationCard()).getByRole("button", { name: "Delete" }));

    await waitFor(() => {
      expect(lobbyApiMock.deleteOrganization).toHaveBeenCalledWith(TOKEN, 21);
    });
    expect(screen.queryByText("Giganttic Org")).not.toBeInTheDocument();
  });

  it("renders modal failure feedback when organization creation fails", async () => {
    const user = userEvent.setup();
    lobbyApiMock.createOrganization.mockRejectedValue(new ApiError("http", "HTTP 409", {
      responseBody: "Organization name already exists.",
      status: 409,
    }));

    renderLobbyPage();

    await openOrganizationsSection(user);
    await user.click(screen.getByRole("button", { name: "Create Organization" }));
    const nameInput = await screen.findByLabelText("Name");
    await user.type(nameInput, "Giganttic Org");
    nameInput.focus();
    await user.keyboard("{Enter}");

    expect((await screen.findAllByText("Organization name already exists.")).length)
      .toBeGreaterThan(0);
  });

  it("renders modal failure feedback when organization editing fails", async () => {
    const user = userEvent.setup();
    lobbyApiMock.updateOrganization.mockRejectedValue(new ApiError("http", "HTTP 409", {
      responseBody: "Organization update failed.",
      status: 409,
    }));

    renderLobbyPage();

    await openOrganizationsSection(user);
    await user.click(within(await findOrganizationCard()).getByRole("button", { name: "Edit" }));
    const nameInput = await screen.findByLabelText("Name");
    nameInput.focus();
    await user.keyboard("{Enter}");

    expect((await screen.findAllByText("Organization update failed.")).length)
      .toBeGreaterThan(0);
  });
});
