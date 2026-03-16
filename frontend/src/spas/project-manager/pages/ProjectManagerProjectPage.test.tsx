import React from "react";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithTheme } from "../../../test/render-with-theme.js";
import { lobbyApi } from "../../../lobby/api/lobby-api.js";
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
    deleteProject: vi.fn(),
    getProject: vi.fn(),
    updateProject: vi.fn(),
  },
}));

const lobbyApiMock = vi.mocked(lobbyApi);
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
      journal: "Project execution journal",
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

describe("ProjectManagerProjectPage", () => {
  beforeEach(async () => {
    navigateMock.mockReset();
    lobbyApiMock.deleteProject.mockReset();
    lobbyApiMock.getProject.mockReset();
    lobbyApiMock.updateProject.mockReset();
    lobbyApiMock.getProject.mockResolvedValue(createProjectResponse());
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
    expect(screen.getByText("Journal")).toBeVisible();
    expect(screen.getByText("Project execution journal")).toBeVisible();
    expect(screen.getByText("Project Owners")).toBeVisible();
    expect(screen.getByText("Project Managers")).toBeVisible();
    expect(screen.getByText("Direct")).toBeVisible();
    expect(screen.getByText("Team")).toBeVisible();
    expect(lobbyApiMock.getProject).toHaveBeenCalledWith(DEFAULT_TOKEN, 42);
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

  it("opens the edit modal with the journal field and submits journal updates", async () => {
    const user = userEvent.setup();

    renderWithTheme(
      <ProjectManagerProjectPage
        currentUserId={DEFAULT_CURRENT_USER_ID}
        projectId={42}
        token={DEFAULT_TOKEN}
      />,
    );

    await user.click(await screen.findByRole("button", { name: "Edit" }));

    const journalInput = await screen.findByLabelText("Journal");
    expect(journalInput).toHaveValue("Project execution journal");
    await user.clear(journalInput);
    await user.type(journalInput, "Updated PM journal");
    const nameInput = screen.getByLabelText("Name");
    nameInput.focus();
    await user.keyboard("{Enter}");

    await waitFor(() => {
      expect(lobbyApiMock.updateProject).toHaveBeenCalledWith(DEFAULT_TOKEN, 42, {
        description: "Project description",
        journal: "Updated PM journal",
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
    expect(screen.getByRole("button", { name: "Delete" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Edit" })).toBeVisible();
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

    expect(await screen.findByRole("button", { name: "Edit" })).toBeVisible();
    expect(screen.queryByRole("button", { name: "Delete" })).not.toBeInTheDocument();
  });
});
