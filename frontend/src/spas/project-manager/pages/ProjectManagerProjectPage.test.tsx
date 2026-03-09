import React from "react";
import {
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithTheme } from "../../../test/render-with-theme.js";
import { lobbyApi } from "../../../lobby/api/lobby-api.js";
import { ProjectManagerProjectPage } from "./ProjectManagerProjectPage.js";

const navigateMock = vi.fn();
const mockRepoChartSource = {
  content: "<?xml version=\"1.0\" encoding=\"UTF-8\"?><data><task id=\"1001\"><![CDATA[Repo chart task]]></task></data>",
  type: "xml" as const,
};
const mockGantt = {
  clearAll: vi.fn(),
  config: {
    columns: [] as unknown[],
    date_format: "",
    grid_width: 0,
    keep_grid_width: false,
    layout: null as unknown,
    show_chart: true,
    show_grid: true,
  },
  destructor: vi.fn(),
  init: vi.fn(),
  parse: vi.fn(),
  render: vi.fn(),
  resetLayout: vi.fn(),
  setSizes: vi.fn(),
};

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

vi.mock("../lib/dhtmlx-gantt-adapter.js", () => ({
  getDhtmlxGantt: () => mockGantt,
}));

vi.mock("../data/repo-gantt-chart-source.js", () => ({
  getRepoGanttChartSource: vi.fn(),
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
    mockGantt.clearAll.mockReset();
    mockGantt.init.mockReset();
    mockGantt.parse.mockReset();
    mockGantt.render.mockReset();
    mockGantt.setSizes.mockReset();
    const ganttData = await import("../data/repo-gantt-chart-source.js");
    vi.mocked(ganttData.getRepoGanttChartSource).mockReset();
    vi.mocked(ganttData.getRepoGanttChartSource).mockReturnValue(mockRepoChartSource);
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
        viewMode="detail"
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
        viewMode="detail"
      />,
    );

    await user.click(await screen.findByRole("button", { name: "View" }));

    expect(await screen.findByRole("dialog", { name: "Project Summary" })).toBeVisible();
  });

  it("renders the gantt view for the selected project", async () => {
    renderWithTheme(
      <ProjectManagerProjectPage
        projectId={42}
        token={DEFAULT_TOKEN}
        viewMode="gantt"
      />,
    );

    expect(await screen.findByText("Project")).toBeVisible();
    expect(screen.getByRole("tab", { name: "Both" })).toBeVisible();

    await waitFor(() => {
      expect(mockGantt.init).toHaveBeenCalledTimes(1);
    });
  });

  it("navigates between detail and gantt views while preserving project id", async () => {
    const user = userEvent.setup();

    renderWithTheme(
      <ProjectManagerProjectPage
        projectId={42}
        token={DEFAULT_TOKEN}
        viewMode="detail"
      />,
    );

    await user.click(await screen.findByRole("tab", { name: "Gantt" }));

    expect(navigateMock).toHaveBeenCalledWith("/pm/project?projectId=42&view=gantt");
  });

  it("shows a clear message when the project chart file is missing", async () => {
    const ganttData = await import("../data/repo-gantt-chart-source.js");
    vi.mocked(ganttData.getRepoGanttChartSource).mockReturnValue(null);

    renderWithTheme(
      <ProjectManagerProjectPage
        projectId={42}
        token={DEFAULT_TOKEN}
        viewMode="gantt"
      />,
    );

    expect(await screen.findByText("No gantt chart file exists for this project yet.")).toBeVisible();
  });
});
