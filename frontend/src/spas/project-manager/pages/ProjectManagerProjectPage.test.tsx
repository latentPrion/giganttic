import React from "react";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithTheme } from "../../../test/render-with-theme.js";
import { ApiError } from "../../../common/api/api-error.js";
import { lobbyApi } from "../../../lobby/api/lobby-api.js";
import { projectJournalApi } from "../api/project-journal-api.js";
import type { ProjectManagerSource } from "../../../lobby/contracts/lobby.contracts.js";
import { ProjectManagerProjectPage } from "./ProjectManagerProjectPage.js";

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
    associateProjectOrganization: vi.fn(),
    associateProjectTeam: vi.fn(),
    createOrganization: vi.fn(),
    createTeam: vi.fn(),
    deleteProject: vi.fn(),
    getProject: vi.fn(),
    listOrganizations: vi.fn(),
    listTeams: vi.fn(),
    updateProject: vi.fn(),
  },
}));

vi.mock("../api/project-journal-api.js", () => ({
  projectJournalApi: {
    getJournal: vi.fn(),
    updateJournal: vi.fn(),
  },
}));

const lobbyApiMock = vi.mocked(lobbyApi);
const projectJournalApiMock = vi.mocked(projectJournalApi);
const DEFAULT_TOKEN = "pm-token";
const DEFAULT_CURRENT_USER_ID = 101;
const DEFAULT_TIMESTAMP = "2026-03-08T00:00:00.000Z";

function createProjectManagerSources(
  ...sourceKinds: ProjectManagerSource[]
): ProjectManagerSource[] {
  return [...sourceKinds];
}

function createProjectResponse() {
  return {
    members: [{
      roleCodes: ["GGTC_PROJECTROLE_PROJECT_MANAGER", "GGTC_PROJECTROLE_PROJECT_OWNER"],
      userId: 101,
      username: "demo-user",
    }],
    organizations: [{
      createdAt: DEFAULT_TIMESTAMP,
      description: "Org description",
      id: 9,
      name: "Org 9",
      updatedAt: DEFAULT_TIMESTAMP,
    }],
    project: {
      createdAt: DEFAULT_TIMESTAMP,
      description: "Project description",
      id: 42,
      name: "Project 42",
      updatedAt: DEFAULT_TIMESTAMP,
    },
    projectManagers: [{
      sourceKinds: createProjectManagerSources("direct", "team"),
      userId: 101,
      username: "demo-user",
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

function requireProjectRow(): HTMLElement {
  const projectRow = screen.getByText("Project 42").closest(".MuiPaper-root");
  expect(projectRow).not.toBeNull();
  return projectRow as HTMLElement;
}

describe("ProjectManagerProjectPage", () => {
  beforeEach(async () => {
    navigateMock.mockReset();
    lobbyApiMock.associateProjectOrganization.mockReset();
    lobbyApiMock.associateProjectTeam.mockReset();
    lobbyApiMock.createOrganization.mockReset();
    lobbyApiMock.createTeam.mockReset();
    lobbyApiMock.deleteProject.mockReset();
    lobbyApiMock.getProject.mockReset();
    lobbyApiMock.listOrganizations.mockReset();
    lobbyApiMock.listTeams.mockReset();
    lobbyApiMock.updateProject.mockReset();
    projectJournalApiMock.getJournal.mockReset();
    projectJournalApiMock.updateJournal.mockReset();
    lobbyApiMock.getProject.mockResolvedValue(createProjectResponse());
    projectJournalApiMock.getJournal.mockResolvedValue({
      journalExists: true,
      markdown: "Project execution journal",
    });
    projectJournalApiMock.updateJournal.mockResolvedValue({
      journalExists: true,
      markdown: "Updated PM journal",
    });
    lobbyApiMock.listOrganizations.mockResolvedValue({
      organizations: [{
        createdAt: DEFAULT_TIMESTAMP,
        description: "Available Org",
        id: 12,
        name: "Org 12",
        updatedAt: DEFAULT_TIMESTAMP,
      }],
    });
    lobbyApiMock.listTeams.mockResolvedValue({
      teams: [{
        createdAt: DEFAULT_TIMESTAMP,
        description: "Available Team",
        id: 8,
        name: "Team 8",
        updatedAt: DEFAULT_TIMESTAMP,
      }],
    });
    lobbyApiMock.associateProjectTeam.mockResolvedValue({
      projectId: 42,
      teams: [
        ...createProjectResponse().teams,
        {
          createdAt: DEFAULT_TIMESTAMP,
          description: "Available Team",
          id: 8,
          name: "Team 8",
          updatedAt: DEFAULT_TIMESTAMP,
        },
      ],
    });
    lobbyApiMock.associateProjectOrganization.mockResolvedValue({
      organizations: [
        ...createProjectResponse().organizations,
        {
          createdAt: DEFAULT_TIMESTAMP,
          description: "Available Org",
          id: 12,
          name: "Org 12",
          updatedAt: DEFAULT_TIMESTAMP,
        },
      ],
      projectId: 42,
    });
    lobbyApiMock.updateProject.mockResolvedValue({
      project: {
        ...createProjectResponse().project,
        name: "Project 42 Updated",
      },
    });
  });

  it("renders the project detail view for the selected project", async () => {
    renderWithTheme(
      <ProjectManagerProjectPage
        currentUserId={DEFAULT_CURRENT_USER_ID}
        projectId={42}
        token={DEFAULT_TOKEN}
      />,
    );

    expect(await screen.findByText("Project")).toBeVisible();
    expect(await screen.findByText("Project 42")).toBeVisible();
    expect(screen.getByText("Detailed Project View")).toBeVisible();
    expect(screen.getByText("Project Journal")).toBeVisible();
    expect(screen.getByText("Project execution journal")).toBeVisible();
    expect(screen.getByText("Project Owners")).toBeVisible();
    expect(screen.getByText("Project Managers")).toBeVisible();
    expect(screen.getByText("Direct")).toBeVisible();
    expect(screen.getByText("Team")).toBeVisible();
    expect(lobbyApiMock.getProject).toHaveBeenCalledWith(DEFAULT_TOKEN, 42);
  });

  it("shows a friendly missing-journal message instead of a raw API error", async () => {
    projectJournalApiMock.getJournal.mockRejectedValueOnce(
      new ApiError("http", "HTTP 404", {
        responseBody: "Cannot GET journal",
        status: 404,
      }),
    );

    renderWithTheme(
      <ProjectManagerProjectPage
        currentUserId={DEFAULT_CURRENT_USER_ID}
        projectId={42}
        token={DEFAULT_TOKEN}
      />,
    );

    expect(await screen.findByText("No journal exists for this project as yet.")).toBeVisible();
    expect(screen.queryByText("Cannot GET journal")).not.toBeInTheDocument();
  });

  it("opens the summary modal from the project view button", async () => {
    const user = userEvent.setup();

    renderWithTheme(
      <ProjectManagerProjectPage
        currentUserId={DEFAULT_CURRENT_USER_ID}
        projectId={42}
        token={DEFAULT_TOKEN}
      />,
    );

    await user.click(await screen.findByRole("button", { name: "View" }));

    expect(await screen.findByRole("dialog", { name: "Project Summary" })).toBeVisible();
  });

  it("opens the edit modal and submits project metadata updates", async () => {
    const user = userEvent.setup();

    renderWithTheme(
      <ProjectManagerProjectPage
        currentUserId={DEFAULT_CURRENT_USER_ID}
        projectId={42}
        token={DEFAULT_TOKEN}
      />,
    );

    await screen.findByText("Project 42");
    await user.click(within(requireProjectRow()).getByRole("button", { name: "Edit" }));

    const nameInput = await screen.findByLabelText("Name");
    nameInput.focus();
    await user.keyboard("{Enter}");

    await waitFor(() => {
      expect(lobbyApiMock.updateProject).toHaveBeenCalledWith(DEFAULT_TOKEN, 42, {
        description: "Project description",
        name: "Project 42",
      });
    });
  });

  it("navigates between details and gantt views while preserving project id", async () => {
    const user = userEvent.setup();

    renderWithTheme(
      <ProjectManagerProjectPage
        currentUserId={DEFAULT_CURRENT_USER_ID}
        projectId={42}
        token={DEFAULT_TOKEN}
      />,
    );

    await user.click(await screen.findByRole("tab", { name: "Gantt" }));

    expect(navigateMock).toHaveBeenCalledWith("/pm/project/gantt?projectId=42");
  });

  it("navigates to the kanban route while preserving project id", async () => {
    const user = userEvent.setup();

    renderWithTheme(
      <ProjectManagerProjectPage
        currentUserId={DEFAULT_CURRENT_USER_ID}
        projectId={42}
        token={DEFAULT_TOKEN}
      />,
    );

    await user.click(await screen.findByRole("tab", { name: "Kanban Board" }));

    expect(navigateMock).toHaveBeenCalledWith("/pm/project/kanban?projectId=42");
  });

  it("navigates to the issues route while preserving project id", async () => {
    const user = userEvent.setup();

    renderWithTheme(
      <ProjectManagerProjectPage
        currentUserId={DEFAULT_CURRENT_USER_ID}
        projectId={42}
        token={DEFAULT_TOKEN}
      />,
    );

    await user.click(await screen.findByRole("tab", { name: "Issues" }));

    expect(navigateMock).toHaveBeenCalledWith("/pm/project/issues?projectId=42");
  });

  it("navigates to the tasks route while preserving project id", async () => {
    const user = userEvent.setup();

    renderWithTheme(
      <ProjectManagerProjectPage
        currentUserId={DEFAULT_CURRENT_USER_ID}
        projectId={42}
        token={DEFAULT_TOKEN}
      />,
    );

    await user.click(await screen.findByRole("tab", { name: "Tasks" }));

    expect(navigateMock).toHaveBeenCalledWith("/pm/project/tasks?projectId=42");
  });

  it("switches between the local Details, Teams, and Organizations tabs", async () => {
    const user = userEvent.setup();

    renderWithTheme(
      <ProjectManagerProjectPage
        currentUserId={DEFAULT_CURRENT_USER_ID}
        projectId={42}
        token={DEFAULT_TOKEN}
      />,
    );

    expect(await screen.findByText("Project Managers")).toBeVisible();

    await user.click(screen.getByRole("tab", { name: "Teams" }));
    expect(await screen.findByText("Team 7")).toBeVisible();
    expect(screen.getAllByRole("button", { name: "View" }).length).toBeGreaterThan(1);

    await user.click(screen.getByRole("tab", { name: "Organizations" }));
    expect(await screen.findByText("Org 9")).toBeVisible();

    await user.click(screen.getAllByRole("tab", { name: "Details" })[1]!);
    expect(await screen.findByText("Project Managers")).toBeVisible();
  });

  it("opens team and organization summary modals from their local tabs", async () => {
    const user = userEvent.setup();

    renderWithTheme(
      <ProjectManagerProjectPage
        currentUserId={DEFAULT_CURRENT_USER_ID}
        projectId={42}
        token={DEFAULT_TOKEN}
      />,
    );

    await user.click(await screen.findByRole("tab", { name: "Teams" }));
    const teamRow = screen.getByText("Team 7").closest(".MuiPaper-root");
    expect(teamRow).not.toBeNull();
    await user.click(within(teamRow as HTMLElement).getByRole("button", { name: "View" }));
    expect(await screen.findByRole("heading", { name: "Team Summary" })).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Close" }));
    await waitFor(() => {
      expect(screen.queryByRole("heading", { name: "Team Summary" })).not.toBeInTheDocument();
    });

    await user.click(screen.getByRole("tab", { name: "Organizations" }));
    const organizationRow = screen.getByText("Org 9").closest(".MuiPaper-root");
    expect(organizationRow).not.toBeNull();
    await user.click(within(organizationRow as HTMLElement).getByRole("button", { name: "View" }));
    expect(await screen.findByRole("heading", { name: "Organization Summary" })).toBeVisible();
  });

  it("navigates to PM team and organization routes from local rows", async () => {
    const user = userEvent.setup();

    renderWithTheme(
      <ProjectManagerProjectPage
        currentUserId={DEFAULT_CURRENT_USER_ID}
        projectId={42}
        token={DEFAULT_TOKEN}
      />,
    );

    await user.click(await screen.findByRole("tab", { name: "Teams" }));
    await user.click(screen.getByText("Team 7"));
    expect(navigateMock).toHaveBeenCalledWith("/pm/team?teamId=7");

    await user.click(screen.getByRole("tab", { name: "Organizations" }));
    await user.click(screen.getByText("Org 9"));
    expect(navigateMock).toHaveBeenCalledWith("/pm/organization?organizationId=9");
  });

  it("navigates to the PM user route from project owner and manager rows", async () => {
    const user = userEvent.setup();

    renderWithTheme(
      <ProjectManagerProjectPage
        currentUserId={DEFAULT_CURRENT_USER_ID}
        projectId={42}
        token={DEFAULT_TOKEN}
      />,
    );

    const userButtons = await screen.findAllByRole("button", { name: /demo-user/i });
    await user.click(userButtons[0]!);

    expect(navigateMock).toHaveBeenCalledWith("/user?userId=101");
  });

  it("associates an existing team from the teams tab", async () => {
    const user = userEvent.setup();

    renderWithTheme(
      <ProjectManagerProjectPage
        currentUserId={DEFAULT_CURRENT_USER_ID}
        projectId={42}
        token={DEFAULT_TOKEN}
      />,
    );

    await user.click(await screen.findByRole("tab", { name: "Teams" }));
    await user.click(screen.getByRole("button", { name: "Associate Existing Team" }));
    await user.click(await screen.findByRole("button", { name: "Associate Team" }));

    await waitFor(() => {
      expect(lobbyApiMock.associateProjectTeam).toHaveBeenCalledWith(DEFAULT_TOKEN, 42, {
        teamId: 8,
      });
    });
    expect(await screen.findByText("Team 8")).toBeVisible();
  });

  it("does not load project data when projectId is missing and shows the route fallback", async () => {
    renderWithTheme(
      <ProjectManagerProjectPage
        currentUserId={DEFAULT_CURRENT_USER_ID}
        projectId={null}
        token={DEFAULT_TOKEN}
      />,
    );

    expect(await screen.findByText("Provide a valid projectId to view a project.")).toBeVisible();
    expect(lobbyApiMock.getProject).not.toHaveBeenCalled();
  });

  it("shows the fallback error when loading the project fails", async () => {
    lobbyApiMock.getProject.mockRejectedValueOnce(new Error("network down"));

    renderWithTheme(
      <ProjectManagerProjectPage
        currentUserId={DEFAULT_CURRENT_USER_ID}
        projectId={42}
        token={DEFAULT_TOKEN}
      />,
    );

    expect(await screen.findByText("Unable to load that project right now.")).toBeVisible();
  });

  it("renders project manager rows without action buttons", async () => {
    renderWithTheme(
      <ProjectManagerProjectPage
        currentUserId={DEFAULT_CURRENT_USER_ID}
        projectId={42}
        token={DEFAULT_TOKEN}
      />,
    );

    expect(await screen.findByText("Project Owners")).toBeVisible();
    expect(screen.getAllByText("demo-user").length).toBeGreaterThan(0);
    expect(within(requireProjectRow()).getByRole("button", { name: "Delete" })).toBeVisible();
    expect(within(requireProjectRow()).getByRole("button", { name: "Edit" })).toBeVisible();
    expect(screen.getByText("Project Managers")).toBeVisible();
    const managerRow = screen.getAllByRole("button", { name: /demo-user/i })[1]?.closest(".MuiPaper-root");

    expect(managerRow).not.toBeNull();
    expect(within(managerRow as HTMLElement).queryByRole("button", { name: "Edit" })).not.toBeInTheDocument();
    expect(within(managerRow as HTMLElement).queryByRole("button", { name: "Delete" })).not.toBeInTheDocument();
  });

  it("hides delete for an effective project manager who is not a direct owner", async () => {
    lobbyApiMock.getProject.mockResolvedValueOnce({
      ...createProjectResponse(),
      members: [{
        roleCodes: ["GGTC_PROJECTROLE_PROJECT_MANAGER"],
        userId: DEFAULT_CURRENT_USER_ID,
        username: "demo-user",
      }],
    });

    renderWithTheme(
      <ProjectManagerProjectPage
        currentUserId={DEFAULT_CURRENT_USER_ID}
        projectId={42}
        token={DEFAULT_TOKEN}
      />,
    );

    await screen.findByText("Project 42");
    expect(within(requireProjectRow()).getByRole("button", { name: "Edit" })).toBeVisible();
    expect(within(requireProjectRow()).queryByRole("button", { name: "Delete" })).not.toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole("tab", { name: "Teams" }));
    expect(screen.queryByRole("button", { name: "Associate Existing Team" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Create Team" })).not.toBeInTheDocument();
  });
});
