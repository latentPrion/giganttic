import React from "react";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "../../../common/api/api-error.js";
import { lobbyApi } from "../../../lobby/api/lobby-api.js";
import { renderWithTheme } from "../../../test/render-with-theme.js";
import { ganttApi } from "../api/gantt-api.js";
import { issuesApi } from "../api/issues-api.js";
import { ProjectManagerKanbanPage } from "./ProjectManagerKanbanPage.js";
import { clearGanttRuntimeChartCache } from "../lib/gantt-runtime-chart-cache.js";
import {
  emitGanttRuntimeChartUpdatedEvent,
  GANTT_RUNTIME_METADATA_RELOAD_REQUESTED_EVENT,
} from "../lib/gantt-runtime-chart-events.js";
import { PROJECT_MANAGER_ISSUE_UPDATED_EVENT } from "../lib/issue-updated-events.js";

const DEFAULT_TOKEN = "pm-token";
const DEFAULT_CURRENT_USER_ID = 101;
const DEFAULT_TIMESTAMP = "2026-03-08T00:00:00.000Z";
const ACTIVE_GANTT_XML = `<?xml version="1.0" encoding="UTF-8"?>
<data>
  <task id="101" start_date="2000-03-03 09:00" progress="0.65" ggtc_task_status="ISSUE_STATUS_IN_PROGRESS"><![CDATA[Started task]]></task>
  <task id="102" start_date="2999-03-20 09:00" progress="0.1" ggtc_task_status="ISSUE_STATUS_OPEN"><![CDATA[Future open task]]></task>
  <task id="103" start_date="2000-03-01 09:00" progress="1" ggtc_task_status="ISSUE_STATUS_CLOSED"><![CDATA[Completed task]]></task>
  <task id="104" start_date="2999-03-21 09:00" progress="0.2" ggtc_task_status="ISSUE_STATUS_BLOCKED"><![CDATA[Future blocked task]]></task>
</data>
`;

vi.mock("../api/issues-api.js", () => ({
  issuesApi: {
    listIssues: vi.fn(),
    updateIssue: vi.fn(),
  },
}));

vi.mock("../api/gantt-api.js", () => ({
  ganttApi: {
    getProjectChartOrNull: vi.fn(),
  },
}));

vi.mock("../../../lobby/api/lobby-api.js", () => ({
  lobbyApi: {
    getProject: vi.fn(),
  },
}));

const issuesApiMock = vi.mocked(issuesApi);
const ganttApiMock = vi.mocked(ganttApi);
const lobbyApiMock = vi.mocked(lobbyApi);
const navigateMock = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

function createIssue(overrides: Partial<Awaited<ReturnType<typeof issuesApi.listIssues>>["issues"][number]> = {}) {
  return {
    closedAt: null,
    closedReason: null,
    closedReasonDescription: null,
    createdAt: DEFAULT_TIMESTAMP,
    description: "Issue description",
    id: 7,
    name: "Issue 7",
    openedAt: DEFAULT_TIMESTAMP,
    priority: 2,
    progressPercentage: 35,
    projectId: 42,
    status: "ISSUE_STATUS_IN_PROGRESS" as const,
    updatedAt: DEFAULT_TIMESTAMP,
    ...overrides,
  };
}

function getColumn(columnName: "Open" | "In Progress" | "Blocked" | "Closed") {
  const heading = screen.getByRole("heading", { name: columnName });
  return heading.closest(".MuiPaper-root") as HTMLElement;
}

function renderKanbanPage(projectId: number | null = 42) {
  return renderWithTheme(
    <ProjectManagerKanbanPage
      currentUserId={DEFAULT_CURRENT_USER_ID}
      projectId={projectId}
      token={DEFAULT_TOKEN}
    />,
  );
}

function createProjectAccessResponse(options: {
  projectManagers?: Array<{ sourceKinds: Array<"direct" | "org" | "team">; userId: number; username: string }>;
} = {}) {
  return {
    members: [{
      roleCodes: [],
      userId: DEFAULT_CURRENT_USER_ID,
      username: "demo-user",
    }],
    organizations: [],
    project: {
      createdAt: DEFAULT_TIMESTAMP,
      description: "Project description",
      id: 42,
      name: "Project 42",
      updatedAt: DEFAULT_TIMESTAMP,
    },
    projectManagers: options.projectManagers ?? [{
      sourceKinds: ["direct"],
      userId: DEFAULT_CURRENT_USER_ID,
      username: "demo-user",
    }],
    teams: [],
  };
}

describe("ProjectManagerKanbanPage", () => {
  beforeEach(() => {
    clearGanttRuntimeChartCache();
    issuesApiMock.listIssues.mockReset();
    issuesApiMock.updateIssue.mockReset();
    ganttApiMock.getProjectChartOrNull.mockReset();
    lobbyApiMock.getProject.mockReset();
    navigateMock.mockReset();
    issuesApiMock.listIssues.mockResolvedValue({
      issues: [
        createIssue({ id: 1, name: "Open issue", status: "ISSUE_STATUS_OPEN" }),
        createIssue({ id: 2, name: "Progress issue", status: "ISSUE_STATUS_IN_PROGRESS" }),
        createIssue({ id: 3, name: "Blocked issue", status: "ISSUE_STATUS_BLOCKED" }),
        createIssue({
          closedAt: DEFAULT_TIMESTAMP,
          closedReason: "ISSUE_CLOSED_REASON_RESOLVED",
          id: 4,
          name: "Closed issue",
          progressPercentage: 100,
          status: "ISSUE_STATUS_CLOSED",
        }),
      ],
    });
    issuesApiMock.updateIssue.mockImplementation(async (_token, _projectId, issueId, payload) => ({
      issue: createIssue({
        id: issueId,
        status: (payload.status ?? "ISSUE_STATUS_IN_PROGRESS"),
      }),
    }));
    ganttApiMock.getProjectChartOrNull.mockResolvedValue({
      content: ACTIVE_GANTT_XML,
      type: "xml",
    });
    lobbyApiMock.getProject.mockResolvedValue(createProjectAccessResponse());
  });

  it("renders the mixed kanban board with issue columns and visible gantt tasks", async () => {
    renderKanbanPage();

    expect(await screen.findByText("Project Kanban Board")).toBeVisible();
    expect(await screen.findByText("Selected project: 42")).toBeVisible();

    expect(within(getColumn("Open")).getByText("Open issue")).toBeVisible();
    expect(within(getColumn("In Progress")).getByText("Progress issue")).toBeVisible();
    expect(await within(getColumn("In Progress")).findByText("Started task")).toBeVisible();
    expect(within(getColumn("Blocked")).getByText("Blocked issue")).toBeVisible();
    expect(within(getColumn("Blocked")).getByText("Future blocked task")).toBeVisible();
    expect(within(getColumn("Closed")).getByText("Closed issue")).toBeVisible();
    expect(within(getColumn("Closed")).getByText("Completed task")).toBeVisible();
  });

  it("filters out future open gantt tasks", async () => {
    renderKanbanPage();

    await screen.findByText("Started task");

    expect(screen.queryByText("Future open task")).not.toBeInTheDocument();
  });

  it("continues rendering the issue board when the chart route returns 404", async () => {
    ganttApiMock.getProjectChartOrNull.mockResolvedValue(null);

    renderKanbanPage();

    expect(await screen.findByText("Open issue")).toBeVisible();
    expect(screen.queryByText("Started task")).not.toBeInTheDocument();
  });

  it("initializes kanban gantt tasks from cached gantt runtime xml when update happened before mount", async () => {
    emitGanttRuntimeChartUpdatedEvent({
      projectId: 42,
      serializedXml: ACTIVE_GANTT_XML,
    });

    renderKanbanPage();

    expect(await screen.findByText("Started task")).toBeVisible();
    expect(ganttApiMock.getProjectChartOrNull).not.toHaveBeenCalled();
  });

  it("re-renders kanban gantt tasks when gantt runtime cache updates while mounted", async () => {
    renderKanbanPage();

    expect(await screen.findByText("Started task")).toBeVisible();

    const completedStartedTaskXml = ACTIVE_GANTT_XML.replace(
      'id="101" start_date="2000-03-03 09:00" progress="0.65" ggtc_task_status="ISSUE_STATUS_IN_PROGRESS"',
      'id="101" start_date="2000-03-03 09:00" progress="1" ggtc_task_status="ISSUE_STATUS_CLOSED"',
    );

    emitGanttRuntimeChartUpdatedEvent({
      projectId: 42,
      serializedXml: completedStartedTaskXml,
    });

    expect(await within(getColumn("Closed")).findByText("Started task")).toBeVisible();
  });

  it("shows an error when issue loading fails", async () => {
    issuesApiMock.listIssues.mockRejectedValue(new Error("Issue load failed"));

    renderKanbanPage();

    expect(
      await screen.findByText("Unable to load that project kanban board right now."),
    ).toBeVisible();
  });

  it("shows an error when chart loading fails with a non-404 status", async () => {
    ganttApiMock.getProjectChartOrNull.mockRejectedValue(
      new ApiError("http", "HTTP 500", {
        responseBody: "{\"message\":\"Chart load failed\"}",
        status: 500,
      }),
    );

    renderKanbanPage();

    expect(await screen.findByText("Chart load failed")).toBeVisible();
  });

  it("shows the missing-project fallback without loading data", async () => {
    renderKanbanPage(null);

    expect(await screen.findByText("Select a valid project to view its kanban board.")).toBeVisible();
    expect(issuesApiMock.listIssues).not.toHaveBeenCalled();
    expect(ganttApiMock.getProjectChartOrNull).not.toHaveBeenCalled();
  });

  it("loads both issues and chart XML for the selected project", async () => {
    renderKanbanPage();

    await waitFor(() => {
      expect(issuesApiMock.listIssues).toHaveBeenCalledWith(DEFAULT_TOKEN, 42);
      expect(ganttApiMock.getProjectChartOrNull).toHaveBeenCalledWith(DEFAULT_TOKEN, 42);
    });
  });

  it("updates issue status on double click and persists to backend", async () => {
    const user = userEvent.setup();
    renderKanbanPage();

    const issueCard = await screen.findByTestId("kanban-issue-card-1");
    fireEvent.doubleClick(issueCard);
    await user.click(await screen.findByRole("menuitem", { name: "blocked" }));

    await waitFor(() => {
      expect(issuesApiMock.updateIssue).toHaveBeenCalledWith(
        DEFAULT_TOKEN,
        42,
        1,
        expect.objectContaining({ status: "ISSUE_STATUS_BLOCKED" }),
      );
    });

    expect(navigateMock).not.toHaveBeenCalled();
  });

  it("still allows non-PM project participants to change issue status", async () => {
    const user = userEvent.setup();
    lobbyApiMock.getProject.mockResolvedValueOnce(createProjectAccessResponse({
      projectManagers: [],
    }));

    renderKanbanPage();

    const issueCard = await screen.findByTestId("kanban-issue-card-1");
    fireEvent.doubleClick(issueCard);
    await user.click(await screen.findByRole("menuitem", { name: "blocked" }));

    await waitFor(() => {
      expect(issuesApiMock.updateIssue).toHaveBeenCalledWith(
        DEFAULT_TOKEN,
        42,
        1,
        expect.objectContaining({ status: "ISSUE_STATUS_BLOCKED" }),
      );
    });
  });

  it("does not navigate when dismissing the status menu (double click then click off)", async () => {
    const user = userEvent.setup();
    renderKanbanPage();

    const issueCard = await screen.findByTestId("kanban-issue-card-1");
    fireEvent.doubleClick(issueCard);

    // Clicking off the menu should dismiss it, but must not trigger
    // delayed single-click navigation to the per-issue detail view.
    await user.click(document.body);

    await new Promise((resolve) => setTimeout(resolve, 450));

    expect(navigateMock).not.toHaveBeenCalled();
  });

  it("opens the per-issue view on single click", async () => {
    const user = userEvent.setup();
    renderKanbanPage();

    const issueCard = await screen.findByTestId("kanban-issue-card-1");
    await user.click(issueCard);

    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith("/pm/pm/project/issue?projectId=42&id=1");
    });
  });

  it("opens the task detail view on single click", async () => {
    const user = userEvent.setup();
    renderKanbanPage();

    const taskCard = await screen.findByTestId("kanban-task-card-101");
    await user.click(taskCard);

    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith("/pm/pm/project/task?projectId=42&id=101");
    });
  });

  it("updates non-milestone task status in cache and emits gantt metadata reload event", async () => {
    const user = userEvent.setup();
    const metadataReloadListener = vi.fn();
    window.addEventListener(GANTT_RUNTIME_METADATA_RELOAD_REQUESTED_EVENT, metadataReloadListener);

    renderKanbanPage();

    const taskCard = await screen.findByTestId("kanban-task-card-101");
    fireEvent.doubleClick(taskCard);
    await user.click(await screen.findByRole("menuitem", { name: "blocked" }));

    await waitFor(() => {
      expect(metadataReloadListener).toHaveBeenCalled();
    });
    expect(within(getColumn("Blocked")).getByText("Started task")).toBeVisible();
    expect(navigateMock).not.toHaveBeenCalled();

    window.removeEventListener(GANTT_RUNTIME_METADATA_RELOAD_REQUESTED_EVENT, metadataReloadListener);
  });

  it("does not navigate when dismissing the task status menu after double click", async () => {
    const user = userEvent.setup();
    renderKanbanPage();

    const taskCard = await screen.findByTestId("kanban-task-card-101");
    fireEvent.doubleClick(taskCard);
    await user.click(document.body);

    await new Promise((resolve) => setTimeout(resolve, 450));

    expect(navigateMock).not.toHaveBeenCalled();
  });

  it("does not open the task status menu for non-PM project participants", async () => {
    lobbyApiMock.getProject.mockResolvedValueOnce(createProjectAccessResponse({
      projectManagers: [],
    }));

    renderKanbanPage();

    const taskCard = await screen.findByTestId("kanban-task-card-101");
    fireEvent.doubleClick(taskCard);

    expect(screen.queryByRole("menuitem", { name: "blocked" })).not.toBeInTheDocument();
  });

  it("reloads issues when issue-updated event is emitted", async () => {
    renderKanbanPage();
    await screen.findByText("Open issue");
    expect(issuesApiMock.listIssues).toHaveBeenCalledTimes(1);

    window.dispatchEvent(new CustomEvent(PROJECT_MANAGER_ISSUE_UPDATED_EVENT, {
      detail: { issueId: 1, projectId: 42 },
    }));

    await waitFor(() => {
      expect(issuesApiMock.listIssues).toHaveBeenCalledTimes(2);
    });
  });
});
