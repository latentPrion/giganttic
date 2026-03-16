import React from "react";
import { screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "../../../common/api/api-error.js";
import { renderWithTheme } from "../../../test/render-with-theme.js";
import { ganttApi } from "../api/gantt-api.js";
import { issuesApi } from "../api/issues-api.js";
import { ProjectManagerKanbanPage } from "./ProjectManagerKanbanPage.js";

const DEFAULT_TOKEN = "pm-token";
const DEFAULT_TIMESTAMP = "2026-03-08T00:00:00.000Z";
const ACTIVE_GANTT_XML = `<?xml version="1.0" encoding="UTF-8"?>
<data>
  <task id="101" start_date="2000-03-03 09:00" progress="0.65"><![CDATA[Started task]]></task>
  <task id="102" start_date="2999-03-20 09:00" progress="0.1"><![CDATA[Future task]]></task>
  <task id="103" start_date="2000-03-01 09:00" progress="1"><![CDATA[Completed task]]></task>
</data>
`;

vi.mock("../api/issues-api.js", () => ({
  issuesApi: {
    listIssues: vi.fn(),
  },
}));

vi.mock("../api/gantt-api.js", () => ({
  ganttApi: {
    getProjectChart: vi.fn(),
  },
}));

const issuesApiMock = vi.mocked(issuesApi);
const ganttApiMock = vi.mocked(ganttApi);

function createIssue(overrides: Partial<Awaited<ReturnType<typeof issuesApi.listIssues>>["issues"][number]> = {}) {
  return {
    closedAt: null,
    closedReason: null,
    closedReasonDescription: null,
    createdAt: DEFAULT_TIMESTAMP,
    description: "Issue description",
    id: 7,
    journal: "Issue journal",
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

describe("ProjectManagerKanbanPage", () => {
  beforeEach(() => {
    issuesApiMock.listIssues.mockReset();
    ganttApiMock.getProjectChart.mockReset();
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
    ganttApiMock.getProjectChart.mockResolvedValue({
      content: ACTIVE_GANTT_XML,
      type: "xml",
    });
  });

  it("renders the mixed kanban board with issue columns and visible gantt tasks", async () => {
    renderWithTheme(<ProjectManagerKanbanPage projectId={42} token={DEFAULT_TOKEN} />);

    expect(await screen.findByText("Project Kanban Board")).toBeVisible();
    expect(await screen.findByText("Selected project: 42")).toBeVisible();

    expect(within(getColumn("Open")).getByText("Open issue")).toBeVisible();
    expect(within(getColumn("In Progress")).getByText("Progress issue")).toBeVisible();
    expect(within(getColumn("In Progress")).getByText("Started task")).toBeVisible();
    expect(within(getColumn("Blocked")).getByText("Blocked issue")).toBeVisible();
    expect(within(getColumn("Closed")).getByText("Closed issue")).toBeVisible();
  });

  it("filters out future and completed gantt tasks", async () => {
    renderWithTheme(<ProjectManagerKanbanPage projectId={42} token={DEFAULT_TOKEN} />);

    await screen.findByText("Started task");

    expect(screen.queryByText("Future task")).not.toBeInTheDocument();
    expect(screen.queryByText("Completed task")).not.toBeInTheDocument();
  });

  it("continues rendering the issue board when the chart route returns 404", async () => {
    ganttApiMock.getProjectChart.mockRejectedValue(
      new ApiError("http", "HTTP 404", {
        responseBody: "",
        status: 404,
      }),
    );

    renderWithTheme(<ProjectManagerKanbanPage projectId={42} token={DEFAULT_TOKEN} />);

    expect(await screen.findByText("Open issue")).toBeVisible();
    expect(screen.queryByText("Started task")).not.toBeInTheDocument();
  });

  it("shows an error when issue loading fails", async () => {
    issuesApiMock.listIssues.mockRejectedValue(new Error("Issue load failed"));

    renderWithTheme(<ProjectManagerKanbanPage projectId={42} token={DEFAULT_TOKEN} />);

    expect(
      await screen.findByText("Unable to load that project kanban board right now."),
    ).toBeVisible();
  });

  it("shows an error when chart loading fails with a non-404 status", async () => {
    ganttApiMock.getProjectChart.mockRejectedValue(
      new ApiError("http", "HTTP 500", {
        responseBody: "{\"message\":\"Chart load failed\"}",
        status: 500,
      }),
    );

    renderWithTheme(<ProjectManagerKanbanPage projectId={42} token={DEFAULT_TOKEN} />);

    expect(await screen.findByText("Chart load failed")).toBeVisible();
  });

  it("shows the missing-project fallback without loading data", async () => {
    renderWithTheme(<ProjectManagerKanbanPage projectId={null} token={DEFAULT_TOKEN} />);

    expect(await screen.findByText("Select a valid project to view its kanban board.")).toBeVisible();
    expect(issuesApiMock.listIssues).not.toHaveBeenCalled();
    expect(ganttApiMock.getProjectChart).not.toHaveBeenCalled();
  });

  it("loads both issues and chart XML for the selected project", async () => {
    renderWithTheme(<ProjectManagerKanbanPage projectId={42} token={DEFAULT_TOKEN} />);

    await waitFor(() => {
      expect(issuesApiMock.listIssues).toHaveBeenCalledWith(DEFAULT_TOKEN, 42);
      expect(ganttApiMock.getProjectChart).toHaveBeenCalledWith(DEFAULT_TOKEN, 42);
    });
  });
});
