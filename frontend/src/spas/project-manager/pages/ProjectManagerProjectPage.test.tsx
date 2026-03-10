import React from "react";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithTheme } from "../../../test/render-with-theme.js";
import { lobbyApi } from "../../../lobby/api/lobby-api.js";
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
const DEFAULT_TIMESTAMP = "2026-03-08T00:00:00.000Z";

function createProjectResponse() {
  return {
    members: [{
      roleCodes: ["GGTC_PROJECTROLE_PROJECT_MANAGER"],
      userId: 101,
      username: "demo-user",
    }],
    project: {
      createdAt: DEFAULT_TIMESTAMP,
      description: "Project description",
      id: 42,
      name: "Project 42",
      updatedAt: DEFAULT_TIMESTAMP,
    },
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
        projectId={42}
        token={DEFAULT_TOKEN}
      />,
    );

    expect(await screen.findByText("Project")).toBeVisible();
    expect(await screen.findByText("Project 42")).toBeVisible();
    expect(screen.getByText("Detailed Project View")).toBeVisible();
    expect(lobbyApiMock.getProject).toHaveBeenCalledWith(DEFAULT_TOKEN, 42);
  });

  it("opens the summary modal from the project view button", async () => {
    const user = userEvent.setup();

    renderWithTheme(
      <ProjectManagerProjectPage
        projectId={42}
        token={DEFAULT_TOKEN}
      />,
    );

    await user.click(await screen.findByRole("button", { name: "View" }));

    expect(await screen.findByRole("dialog", { name: "Project Summary" })).toBeVisible();
  });

  it("navigates between detail and gantt views while preserving project id", async () => {
    const user = userEvent.setup();

    renderWithTheme(
      <ProjectManagerProjectPage
        projectId={42}
        token={DEFAULT_TOKEN}
      />,
    );

    await user.click(await screen.findByRole("tab", { name: "Gantt" }));

    expect(navigateMock).toHaveBeenCalledWith("/pm/project/gantt?projectId=42");
  });

  it("navigates to the issues route while preserving project id", async () => {
    const user = userEvent.setup();

    renderWithTheme(
      <ProjectManagerProjectPage
        projectId={42}
        token={DEFAULT_TOKEN}
      />,
    );

    await user.click(await screen.findByRole("tab", { name: "Issues" }));

    expect(navigateMock).toHaveBeenCalledWith("/pm/project/issues?projectId=42");
  });
});
